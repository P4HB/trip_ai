"""Read existing place and label snapshots without modifying or executing them."""
from __future__ import annotations

import copy
import hashlib
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path


def normalized(text):
    return re.sub(r"[^0-9a-z가-힣]", "", unicodedata.normalize("NFKC", str(text)).lower())


def city_from_address(address):
    if "서귀포시" in address:
        return {"key": "KR-50130", "name": "서귀포시"}
    if "제주시" in address:
        return {"key": "KR-50110", "name": "제주시"}
    return {"key": None, "name": "unknown"}


class Catalog:
    def __init__(self, root: Path, include_kakao=True):
        self.root = root
        bundle = root / "map-ui/data/jeju-places.js"
        raw = bundle.read_bytes()
        text = raw.decode("utf-8-sig")
        decoder = json.JSONDecoder()

        def assignment(name):
            marker = f"window.{name} = "
            if marker not in text:
                raise ValueError("invalid_catalog_assignment")
            return decoder.raw_decode(text.split(marker, 1)[1])[0]

        self.bundle_meta = assignment("JEJU_DATA_META")
        self.provenance = {"tourapi_sha256": hashlib.sha256(raw).hexdigest(),
                           "source_date": self.bundle_meta.get("sourceDate"),
                           "preference_version": self.bundle_meta.get("preferenceLabelVersion"),
                           "fit_version": self.bundle_meta.get("fitLabelVersion")}
        self.places = {}
        for row in assignment("JEJU_PLACES"):
            cid = f"tourapi:{row['id']}"
            self.places[cid] = {
                "canonical_id": cid, "provider": "tourapi", "provider_id": row["id"],
                "name": row["title"], "address": row.get("address", ""),
                "longitude": row.get("lng"), "latitude": row.get("lat"),
                "category": row.get("primaryTypeLabel") or row.get("type"),
                "source_date": self.bundle_meta.get("sourceDate"), "checked_at": None,
                "source_url": "https://api.visitkorea.or.kr/",
                "source_snapshot": "map-ui/data/jeju-places.js", "raw": row,
            }
        if include_kakao:
            self._load_kakao()
        self.aliases = {}
        for cid, place in self.places.items():
            title = place["name"]
            values = {title}
            if "]" in title:
                values.add(title.split("]", 1)[1].strip())
            if title.endswith(" 제주"):
                values.add(title[:-3])
            # Generic words and numbered route prefixes are never aliases.
            for name in values:
                key = normalized(name)
                if len(key) >= 2:
                    self.aliases.setdefault(key, []).append(cid)
        self.label_keys = self._label_keys()

    def _label_keys(self):
        contract = json.loads((self.root / "config/kakao_place_label_contract.v1.json").read_text(encoding="utf-8"))
        return [*contract["atomic_labels"], *contract["derived_labels"],
                *[f"companion.{k}" for k in contract["companion_keys"]],
                *[f"month.{k}" for k in contract["month_keys"]]]

    def _load_kakao(self):
        base = self.root / "data/labeling/jeju/2026-08-30"
        details = base / "kakao-place-label-v2/enriched/place_details.jsonl"
        validated = base / "kakao-place-label-v3/validated.jsonl"
        labels = {}
        if validated.exists():
            self.provenance["kakao_labels_sha256"] = hashlib.sha256(validated.read_bytes()).hexdigest()
            with validated.open(encoding="utf-8") as handle:
                for line in handle:
                    if line.strip():
                        row = json.loads(line)
                        labels[str(row["place_id"])] = row
        if not details.exists():
            return
        self.provenance["kakao_metadata_sha256"] = hashlib.sha256(details.read_bytes()).hexdigest()
        with details.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                cid = f"kakao:{row['place_id']}"
                self.places[cid] = {
                    "canonical_id": cid, "provider": "kakao", "provider_id": str(row["place_id"]),
                    "name": row.get("name") or row.get("input_name", ""),
                    "address": row.get("address", ""), "longitude": row.get("longitude"),
                    "latitude": row.get("latitude"), "category": row.get("category"),
                    "source_date": str(row.get("checked_at", ""))[:10] or None,
                    "checked_at": row.get("checked_at"), "source_url": row.get("url"),
                    "source_snapshot": str(details.relative_to(self.root)).replace("\\", "/"),
                    "raw": row, "label_record": labels.get(str(row["place_id"])),
                }

    def candidates(self, name, limit=5):
        key = normalized(name)
        exact = self.aliases.get(key, [])
        scores = [(1.0, cid, "exact_name") for cid in exact]
        if not exact and len(key) >= 3:
            best = {}
            for alias, cids in self.aliases.items():
                ratio = SequenceMatcher(None, key, alias).ratio()
                if ratio < 0.62:
                    continue
                for cid in cids:
                    if ratio > best.get(cid, (0,))[0]:
                        best[cid] = (ratio, cid, "similar_name")
            scores = list(best.values())
        scores.sort(key=lambda v: (-v[0], v[1]))
        return [{**self.metadata(cid), "match_kind": kind, "name_similarity": round(score, 3)}
                for score, cid, kind in scores[:limit]]

    def metadata(self, cid):
        p = self.places[cid]
        coords = [p["longitude"], p["latitude"]]
        valid = all(isinstance(x, (int, float)) for x in coords) and -180 <= coords[0] <= 180 and -90 <= coords[1] <= 90
        return {k: copy.deepcopy(p[k]) for k in ["canonical_id", "provider", "provider_id", "name", "address", "category", "source_date", "checked_at", "source_url", "source_snapshot"]} | {
            "longitude": coords[0] if valid else None, "latitude": coords[1] if valid else None,
            "coordinates": coords if valid else None, "coordinate_order": "longitude,latitude", "crs": "WGS84",
            "city": city_from_address(p["address"]), "verification": "snapshot_match",
            "freshness": "verification_required", "operational_status": "unknown",
        }

    def labels(self, cid):
        p = self.places[cid]
        axes = {}
        sources = []
        versions = {}
        eligibility = None
        if p["provider"] == "tourapi":
            row = p["raw"]
            v5 = row.get("v5") or {}
            for axis in v5.get("labels", []):
                value = copy.deepcopy(axis)
                value.setdefault("state", "numeric" if value.get("value") is not None else "unknown")
                axes[axis["label"]] = value
            fit = row.get("fit") or {}
            for group in ["companion", "month"]:
                for axis in fit.get(group, []):
                    axes[f"{group}.{axis['key']}"] = copy.deepcopy(axis)
            sources = copy.deepcopy(v5.get("sources", []))
            versions = {"preference": self.bundle_meta.get("preferenceLabelVersion"), "fit": self.bundle_meta.get("fitLabelVersion")}
        else:
            row = p.get("label_record") or {}
            for group in ["atomic_labels", "derived_labels"]:
                axes.update(copy.deepcopy(row.get(group, {})))
            for group in ["companion", "month"]:
                values = row.get(group + "_fit", {})
                for key, axis in values.items():
                    axes[f"{group}.{key}"] = copy.deepcopy(axis)
            sources = copy.deepcopy((row.get("research") or {}).get("sources", []))
            versions = {"kakao": row.get("schema_version")}
            eligibility = copy.deepcopy(row.get("eligibility"))
        missing = [k for k in self.label_keys if k not in axes]
        malformed = [k for k, v in axes.items() if v.get("state") == "not_applicable" and v.get("value") is not None]
        return {"status": "labels_missing" if not axes else ("labels_incomplete" if missing or malformed else "linked"),
                "count": len(axes), "expected_count": 41, "missing_keys": missing,
                "validation_errors": malformed, "axes": axes, "sources": sources, "versions": versions,
                "dataset_status": "ai_draft", "eligibility": eligibility}
