"""Build/verify the compact v3 DB from canonical records and coordinate JSONL (SPEC-106)."""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory

import build_restaurant_catalog as canonical
import build_restaurant_query_db as query
import collect_restaurant_coordinates as coordinates
from validate_restaurant_catalog import expected_sql_values, read_records, require, unique_keys, validate_catalog
from validate_restaurant_coordinates import read_bundle

VERSION = "restaurant-catalog-v3"
SCHEMA = canonical.ROOT / "config/restaurant_catalog.v3.sql"
DEFAULT_OUTPUT = canonical.ROOT / "data/catalogs/jeju/2026-10-06/restaurant-catalog-v3"
COORDINATE_FIELDS = ("coordinate_status", "coordinate_source_url", "coordinate_checked_at", "coordinate_record_sha256")


def schema_digest():
    return hashlib.sha256(SCHEMA.read_text(encoding="utf-8").encode("utf-8")).hexdigest()


def metadata(source, coordinate_manifest):
    return {"contract": canonical.packed(VERSION), "schema_sha256": canonical.packed(schema_digest()),
            "canonical_manifest_sha256": canonical.packed(canonical.digest(source)),
            "canonical_logical_sha256": canonical.packed(source["database_logical_sha256"]),
            "coordinate_manifest_sha256": canonical.packed(canonical.digest(coordinate_manifest)),
            "coordinate_jsonl_sha256": canonical.packed(coordinate_manifest["files"]["coordinates.jsonl"]["sha256"])}


def projected(columns, record, observation=None):
    if observation is None:
        return query.projected_values(columns, record)
    merged = {**record, "longitude": observation["longitude"], "latitude": observation["latitude"],
              "coordinate_status": observation["status"], "coordinate_source_url": observation["source_url"],
              "coordinate_checked_at": observation["checked_at"], "coordinate_record_sha256": canonical.digest(observation)}
    values = query.projected_values(columns, merged)
    # The original canonical hash remains an explicit base-record identity.
    values["record_sha256"] = canonical.digest(record)
    return values


def build(output=DEFAULT_OUTPUT, *, canonical_dir=canonical.DEFAULT_OUTPUT, coordinates_dir=coordinates.DEFAULT_OUTPUT):
    output, canonical_dir, coordinates_dir = map(lambda p: Path(p).resolve(), (output, canonical_dir, coordinates_dir))
    source = validate_catalog(canonical_dir, jsonl_only=True)
    observations_manifest, observations = read_bundle(coordinates_dir, canonical_dir)
    if output.exists():
        old = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
        if (old.get("contract") != VERSION or old.get("canonical", {}).get("manifest_sha256") != canonical.digest(source)
                or old.get("coordinates", {}).get("manifest_sha256") != canonical.digest(observations_manifest)):
            raise ValueError("Output belongs to a different snapshot; choose a new output directory")
        return validate(output, canonical_dir=canonical_dir, coordinates_dir=coordinates_dir)
    records = read_records(canonical_dir)
    by_id = {r["canonical_id"]: r for r in observations}
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".restaurant-build-coordinates-", dir=output.parent) as temporary:
        staging = Path(temporary) / "catalog"
        staging.mkdir()
        with closing(sqlite3.connect(staging / canonical.DB_NAME)) as conn:
            conn.executescript(SCHEMA.read_text(encoding="utf-8"))
            with conn:
                conn.executemany("INSERT INTO dataset_meta VALUES (?,?)", metadata(source, observations_manifest).items())
                for table in canonical.TABLES:
                    columns = [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]
                    statement = f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})"
                    conn.executemany(statement, (tuple(projected(columns, record, by_id[record["canonical_id"]] if table == "places" else None).values())
                                                 for record in records[table]))
            logical_hash = query.database_digest(conn)
        database_path = staging / canonical.DB_NAME
        manifest = {"contract": VERSION, "generated_at": coordinates.now(),
            "schema_sha256": schema_digest(), "source": source["source"], "counts": source["counts"], "coverage": source["coverage"],
            "canonical": {"contract": source["contract"], "directory": Path(os.path.relpath(canonical_dir, output)).as_posix(),
                          "manifest_sha256": canonical.digest(source), "logical_sha256": source["database_logical_sha256"]},
            "coordinates": {"contract": observations_manifest["contract"], "directory": Path(os.path.relpath(coordinates_dir, output)).as_posix(),
                            "manifest_sha256": canonical.digest(observations_manifest), "files": observations_manifest["files"],
                            "counts": observations_manifest["counts"], "target_count": observations_manifest["target_count"]},
            "database_logical_sha256": logical_hash,
            "files": {canonical.DB_NAME: {"sha256": canonical.file_digest(database_path), "bytes": database_path.stat().st_size}},
            "storage": "local_only; restore from v1 canonical JSONL/manifest and coordinate JSONL/manifest; old v1/v2 unchanged",
            "hash_semantics": "places.record_sha256 identifies the original v1 record; coordinate_record_sha256 identifies its separate observation"}
        (staging / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        validate(staging, canonical_dir=canonical_dir, coordinates_dir=coordinates_dir)
        require(json.loads((coordinates_dir / "manifest.json").read_text(encoding="utf-8")) == observations_manifest,
                "Coordinate snapshot changed during build")
        require(json.loads((canonical_dir / "manifest.json").read_text(encoding="utf-8")) == source,
                "Canonical snapshot changed during build")
        staging.rename(output)
    return manifest


def validate(directory=DEFAULT_OUTPUT, *, canonical_dir=None, coordinates_dir=None):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"), object_pairs_hook=unique_keys)
    require(manifest["contract"] == VERSION and manifest["schema_sha256"] == schema_digest(), "Coordinate DB contract/schema differs")
    for key in ("canonical", "coordinates"):
        require(not Path(manifest[key]["directory"]).is_absolute(), f"{key} reference must be relative")
    canonical_dir = Path(canonical_dir).resolve() if canonical_dir else (directory / manifest["canonical"]["directory"]).resolve()
    coordinates_dir = Path(coordinates_dir).resolve() if coordinates_dir else (directory / manifest["coordinates"]["directory"]).resolve()
    source = validate_catalog(canonical_dir, jsonl_only=True)
    observation_manifest, observations = read_bundle(coordinates_dir, canonical_dir)
    require(manifest["canonical"]["manifest_sha256"] == canonical.digest(source), "Canonical manifest differs")
    require(manifest["canonical"]["contract"] == source["contract"] and
            manifest["canonical"]["logical_sha256"] == source["database_logical_sha256"], "Canonical identity differs")
    require(manifest["coordinates"]["manifest_sha256"] == canonical.digest(observation_manifest), "Coordinate manifest differs")
    for key in ("files", "counts", "target_count", "contract"):
        require(manifest["coordinates"][key] == observation_manifest[key], f"Coordinate {key} differs")
    for key in ("source", "counts", "coverage"):
        require(manifest[key] == source[key], f"Canonical {key} differs")
    path = directory / canonical.DB_NAME
    require(manifest["files"] == {canonical.DB_NAME: {"sha256": canonical.file_digest(path), "bytes": path.stat().st_size}},
            "Coordinate DB hash/size differs")
    records = read_records(canonical_dir)
    by_id = {r["canonical_id"]: r for r in observations}
    hasher = hashlib.sha256()
    with closing(canonical.read_only(path)) as actual, closing(sqlite3.connect(":memory:")) as reference:
        reference.executescript(SCHEMA.read_text(encoding="utf-8"))
        require(actual.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "Coordinate DB integrity failed")
        require(not actual.execute("PRAGMA foreign_key_check").fetchall(), "Coordinate DB foreign keys failed")
        require(actual.execute("PRAGMA user_version").fetchone()[0] == 3, "Coordinate DB version differs")
        schema_sql = "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name"
        require([tuple(row) for row in actual.execute(schema_sql)] == list(reference.execute(schema_sql)), "Coordinate DB schema differs")
        require(dict(actual.execute("SELECT key,value FROM dataset_meta")) == metadata(source, observation_manifest), "Coordinate DB metadata differs")
        for table in canonical.TABLES:
            hasher.update((table + "\n").encode())
            columns = {row[1] for row in reference.execute(f"PRAGMA table_info({table})")}
            cursor = actual.execute(f"SELECT * FROM {table} ORDER BY source_order")
            for record in records[table]:
                # Independent base projection from v1, then compare the two explicit coordinate inputs.
                expected = {key: value for key, value in expected_sql_values(record).items() if key not in ("raw_json", "source_json")}
                if table == "places":
                    observation = by_id[record["canonical_id"]]
                    expected.update(longitude=observation["longitude"], latitude=observation["latitude"],
                                    coordinate_status=observation["status"], coordinate_source_url=observation["source_url"],
                                    coordinate_checked_at=observation["checked_at"], coordinate_record_sha256=canonical.digest(observation))
                require(set(expected) == columns, f"{table}: projection columns differ")
                row = cursor.fetchone()
                require(row is not None and dict(row) == expected, f"{table}:{record['source_order']}: coordinate query columns differ")
                hasher.update((canonical.packed(expected) + "\n").encode("utf-8"))
            require(cursor.fetchone() is None, f"{table}: unexpected rows")
    require(hasher.hexdigest() == manifest["database_logical_sha256"], "Coordinate DB logical digest differs")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--canonical-dir", type=Path)
    parser.add_argument("--coordinates-dir", type=Path)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    kwargs = {key: value for key, value in {"canonical_dir": args.canonical_dir, "coordinates_dir": args.coordinates_dir}.items() if value is not None}
    manifest = (validate if args.validate_only else build)(args.output_dir, **kwargs)
    print(json.dumps({"valid": True, "counts": manifest["counts"], "coordinates": manifest["coordinates"]["counts"],
                      "database": manifest["files"][canonical.DB_NAME], "database_logical_sha256": manifest["database_logical_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
