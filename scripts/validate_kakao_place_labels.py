#!/usr/bin/env python3
"""Validate SPEC-022 agent results and deterministically add derived labels."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Kakao 장소별 라벨 결과 검증")
    parser.add_argument(
        "--contract",
        type=Path,
        default=Path("config/kakao_place_label_contract.v1.json"),
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=Path(
            "data/labeling/jeju/2026-08-24/kakao-place-label-v1/agent-results"
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(
            "data/labeling/jeju/2026-08-24/kakao-place-label-v1/validated"
        ),
    )
    parser.add_argument("--place-id", action="append", default=[])
    return parser.parse_args()


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def quantize(value: float, scale: list[float]) -> float:
    distances = [(abs(candidate - value), -candidate, candidate) for candidate in scale]
    return min(distances)[2]


def contains_forbidden_key(value: Any, forbidden: str) -> bool:
    if isinstance(value, dict):
        return forbidden in value or any(
            contains_forbidden_key(item, forbidden) for item in value.values()
        )
    if isinstance(value, list):
        return any(contains_forbidden_key(item, forbidden) for item in value)
    return False


def validate_axis(
    label: str,
    record: Any,
    contract: dict[str, Any],
    errors: list[str],
    *,
    allow_not_applicable: bool,
    normalizations: list[str],
) -> None:
    prefix = f"{label}:"
    require(isinstance(record, dict), f"{prefix} 레코드가 객체가 아닙니다", errors)
    if not isinstance(record, dict):
        return

    state = record.get("state", "numeric")
    if state in {"applicable", "fit", "caution"}:
        normalizations.append(f"{label}.state:{state}->numeric")
        state = "numeric"
        record["state"] = state
    require(
        state in ({"numeric", "not_applicable"} if allow_not_applicable else {"numeric"}),
        f"{prefix} state가 잘못됐습니다: {state}",
        errors,
    )
    value = record.get("value")
    scale = contract["score_scale"]
    if state == "not_applicable":
        require(value is None, f"{prefix} not_applicable value는 null이어야 합니다", errors)
    else:
        require(value in scale, f"{prefix} 허용되지 않은 값입니다: {value}", errors)

    confidence = record.get("confidence")
    require(
        isinstance(confidence, (int, float))
        and not isinstance(confidence, bool)
        and 0 <= confidence <= 1,
        f"{prefix} confidence가 잘못됐습니다: {confidence}",
        errors,
    )
    status = record.get("status")
    inference = record.get("inference_level")
    require(
        status in contract["review_statuses"],
        f"{prefix} status가 잘못됐습니다: {status}",
        errors,
    )
    require(
        inference in contract["inference_levels"],
        f"{prefix} inference_level이 잘못됐습니다: {inference}",
        errors,
    )
    require(
        isinstance(record.get("rationale"), str) and bool(record["rationale"].strip()),
        f"{prefix} rationale이 없습니다",
        errors,
    )
    require(isinstance(record.get("source_ids"), list), f"{prefix} source_ids가 배열이 아닙니다", errors)
    require(isinstance(record.get("rule_ids"), list), f"{prefix} rule_ids가 배열이 아닙니다", errors)

    if state == "numeric" and value in {0, 1} and inference != "direct_evidence":
        errors.append(f"{prefix} 비직접 극단값은 허용되지 않습니다")
    if status == "fallback" and confidence != contract["policies"]["fallback_confidence"]:
        errors.append(f"{prefix} fallback confidence는 0.25여야 합니다")


def derived_labels(
    atomic: dict[str, dict[str, Any]], scale: list[float]
) -> dict[str, dict[str, Any]]:
    def value(key: str) -> float:
        return float(atomic[key]["value"])

    def copied(target: str, source: str) -> tuple[str, dict[str, Any]]:
        record = atomic[source]
        return target, {
            "value": record["value"],
            "confidence": record["confidence"],
            "status": record["status"],
            "inference_level": record["inference_level"],
            "calculation": f"copy({source})",
            "input_labels": [source],
        }

    inputs = [
        "style_evidence.restfulness",
        "style_evidence.physical_ease",
        "style_evidence.visit_duration_flexibility",
    ]
    healing_raw = 0.4 * value(inputs[0]) + 0.3 * value(inputs[1]) + 0.3 * value(inputs[2])
    healing_records = [atomic[key] for key in inputs]
    derived: dict[str, dict[str, Any]] = {
        "derived_style.healing_slow": {
            "value": quantize(healing_raw, scale),
            "confidence": min(float(record["confidence"]) for record in healing_records),
            "status": "confirmed"
            if all(record["status"] == "confirmed" for record in healing_records)
            else "needs_review",
            "inference_level": min(
                (record["inference_level"] for record in healing_records),
                key=[
                    "direct_evidence",
                    "researched_inference",
                    "archetype_prior",
                    "climate_heuristic",
                ].index,
            ),
            "calculation": (
                "quantize(0.4*style_evidence.restfulness+"
                "0.3*style_evidence.physical_ease+"
                "0.3*style_evidence.visit_duration_flexibility)"
            ),
            "input_labels": inputs,
        },
        "derived_style.discovery_explorer": {
            "value": 0.5,
            "confidence": 0.25,
            "status": "needs_review",
            "inference_level": "archetype_prior",
            "calculation": "constant(0.5)",
            "input_labels": [],
        },
    }
    for target, source in [
        ("derived_style.scenic_immersion", "style_evidence.scenic_value"),
        ("derived_style.local_immersion", "style_evidence.local_embeddedness"),
        ("derived_style.iconic_highlight", "style_evidence.landmark_significance"),
        ("derived_style.photo_mood", "style_evidence.photo_value"),
    ]:
        key, record = copied(target, source)
        derived[key] = record
    return derived


def validate_result(path: Path, contract: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    normalizations: list[str] = []
    try:
        result = json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:  # noqa: BLE001
        return {}, [f"JSON 파싱 실패: {error}"]

    place_id = str(result.get("place_id") or "")
    require(result.get("schema_version") == "kakao-place-label-agent-result-v1", "schema_version이 잘못됐습니다", errors)
    require(place_id == path.stem, f"place_id가 파일명과 다릅니다: {place_id}", errors)
    require(result.get("canonical_id") == f"kakao:{place_id}", "canonical_id가 잘못됐습니다", errors)
    require(result.get("model") == "gpt-5.6-terra", "model이 잘못됐습니다", errors)
    require(result.get("reasoning_effort") == "medium", "reasoning_effort가 잘못됐습니다", errors)
    require(not contains_forbidden_key(result, "reviewer"), "reviewer 키가 포함됐습니다", errors)

    eligibility = result.get("eligibility")
    require(isinstance(eligibility, dict), "eligibility가 객체가 아닙니다", errors)
    eligibility_status = eligibility.get("status") if isinstance(eligibility, dict) else None
    require(eligibility_status in contract["eligibility_statuses"], f"eligibility status가 잘못됐습니다: {eligibility_status}", errors)

    atomic = result.get("atomic_labels")
    companion = result.get("companion_fit")
    month = result.get("month_fit")
    require(isinstance(atomic, dict), "atomic_labels가 객체가 아닙니다", errors)
    require(isinstance(companion, dict), "companion_fit이 객체가 아닙니다", errors)
    require(isinstance(month, dict), "month_fit이 객체가 아닙니다", errors)

    if eligibility_status == "eligible" and all(isinstance(item, dict) for item in [atomic, companion, month]):
        require(set(atomic) == set(contract["atomic_labels"]), "원자 라벨 키 집합이 다릅니다", errors)
        require(set(companion) == set(contract["companion_keys"]), "companion 키 집합이 다릅니다", errors)
        require(set(month) == set(contract["month_keys"]), "month 키 집합이 다릅니다", errors)
        for key, record in atomic.items():
            validate_axis(
                key,
                record,
                contract,
                errors,
                allow_not_applicable=False,
                normalizations=normalizations,
            )
        for key, record in companion.items():
            validate_axis(
                f"companion.{key}",
                record,
                contract,
                errors,
                allow_not_applicable=False,
                normalizations=normalizations,
            )
        for key, record in month.items():
            validate_axis(
                f"month.{key}",
                record,
                contract,
                errors,
                allow_not_applicable=True,
                normalizations=normalizations,
            )
    elif all(isinstance(item, dict) for item in [atomic, companion, month]):
        require(not atomic and not companion and not month, "비적격 장소의 라벨 맵은 비어 있어야 합니다", errors)

    require(result.get("review_priority") in {"low", "medium", "high"}, "review_priority가 잘못됐습니다", errors)
    require(isinstance(result.get("hard_constraints"), list), "hard_constraints가 배열이 아닙니다", errors)
    require(isinstance(result.get("research"), dict), "research가 객체가 아닙니다", errors)

    validated = dict(result)
    validated["derived_labels"] = (
        derived_labels(atomic, contract["score_scale"])
        if eligibility_status == "eligible" and not errors
        else {}
    )
    validated["validation"] = {
        "status": "passed" if not errors else "failed",
        "validator": "validate-kakao-place-labels-v1",
        "error_count": len(errors),
        "errors": errors,
        "normalizations": normalizations,
    }
    return validated, errors


def main() -> None:
    args = parse_args()
    contract = json.loads(args.contract.read_text(encoding="utf-8"))
    if args.place_id:
        paths = [args.results_dir / f"{place_id}.json" for place_id in args.place_id]
    else:
        paths = sorted(args.results_dir.glob("*.json"), key=lambda item: int(item.stem))
    if not paths:
        raise ValueError("검증할 결과가 없습니다")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    failures: dict[str, list[str]] = {}
    for path in paths:
        if not path.exists():
            failures[path.stem] = ["결과 파일이 없습니다"]
            continue
        validated, errors = validate_result(path, contract)
        output_path = args.output_dir / path.name
        output_path.write_text(
            json.dumps(validated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        if errors:
            failures[path.stem] = errors

    summary = {
        "checked": len(paths),
        "passed": len(paths) - len(failures),
        "failed": len(failures),
        "failures": failures,
    }
    print(json.dumps(summary, ensure_ascii=False))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
