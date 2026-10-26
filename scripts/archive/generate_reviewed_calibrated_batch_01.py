"""Create the additive boundary-review sidecar for activity calibration batch 01."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path


ROOT = Path("data/labeling/jeju/2026-08-09/place-fit-relabel-v2")
INPUT = ROOT / "calibration_inputs/01_activity_family.jsonl"
DRAFT = ROOT / "calibration_outputs/batches/calibrated_batch_01.jsonl"
OUTPUT = ROOT / "calibration_outputs/reviewed/reviewed_calibrated_batch_01.jsonl"
REVIEW_RULE = "CALIBRATED-BOUNDARY-REVIEW-V2"
CHANGES = {
    ("2638441", "solo"): (0.5, 0.55, "limited_direct_evidence", "가상국가형 테마파크의 여권·화폐·비자 발급 경험은 소개되지만 혼자 이용을 위한 실제 활동이나 대상은 명시되지 않아 0.5로 재판정했다."),
    ("2705373", "solo"): (0.5, 0.55, "limited_direct_evidence", "목장 철로의 레일바이크와 동물 먹이주기는 실제 체험이지만 2~4인승으로 소개되어 혼자 이용 근거는 없어 0.5로 재판정했다."),
    ("2705373", "parents"): (0.75, 0.8, "direct_evidence", "자동 주행이라 페달을 밟지 않아도 되고 다른 레일바이크보다 힘이 덜 든다고 소개되어 고령 동행의 활동 부담을 낮추는 실제 편의 근거로 0.75로 재판정했다."),
    ("2714222", "kids"): (0.5, 0.55, "limited_direct_evidence", "피너츠 테마홀과 가든에서 걷고 보고 쉬는 경험은 소개되지만 어린이를 위한 활동·안전 근거는 명시되지 않아 0.5로 재판정했다."),
    ("2714659", "solo"): (0.5, 0.55, "limited_direct_evidence", "꽃·밭작물·동물 관람 농장은 소개되지만 혼자 이용을 위한 실제 활동이나 대상은 명시되지 않아 0.5로 재판정했다."),
    ("2734909", "solo"): (0.5, 0.55, "limited_direct_evidence", "35개 캠핑 사이트와 4인용 텐트·카라반·펜션 이용은 소개되지만 혼자 이용을 위한 근거는 없어 0.5로 재판정했다."),
    ("2738653", "solo"): (0.5, 0.55, "limited_direct_evidence", "성인용과 아이용 쿠킹 랩 및 다양한 요리 체험은 소개되지만 혼자 참여를 위한 근거는 명시되지 않아 0.5로 재판정했다."),
    ("2759120", "solo"): (0.5, 0.55, "limited_direct_evidence", "유령의집·유령미로·공포 가상현실과 휴식·먹거리 시설은 소개되지만 가족·친구 방문만 명시되고 혼자 이용 근거는 없어 0.5로 재판정했다."),
    ("2759624", "kids"): (0.5, 0.55, "limited_direct_evidence", "감귤 따는 방법 안내와 시식이 있는 체험 농장이지만 어린이 대상·보호자·안전 조건은 명시되지 않아 0.5로 재판정했다."),
    ("2767627", "solo"): (0.5, 0.55, "limited_direct_evidence", "새연교를 건너 약 20분 동안 항구와 다리 풍경을 감상하는 공원이지만 혼자 이용을 위한 실제 활동 근거는 없어 0.5로 재판정했다."),
    ("2779449", "solo"): (0.5, 0.55, "limited_direct_evidence", "편백나무 숲·초원·포토 스폿과 계절 꽃을 보는 자연 명소지만 혼자 이용을 위한 실제 활동 근거는 없어 0.5로 재판정했다."),
    ("2852581", "solo"): (0.5, 0.55, "limited_direct_evidence", "곶자왈 원시림 조망 객실과 레스토랑·라운지·인피니티 풀을 갖춘 호텔이지만 혼자 이용을 위한 근거는 명시되지 않아 0.5로 재판정했다."),
    ("2854437", "couple"): (0.75, 0.8, "direct_evidence", "수국밭의 포토존과 웨딩 스냅·커플 사진 촬영지라는 실제 둘의 촬영 활용이 소개되어 0.75로 재판정했다."),
    ("2858860", "parents"): (0.75, 0.8, "direct_evidence", "남녀노소가 즐길 수 있고 안전한 시스템의 실내 클라이밍을 갖춘다고 소개되어 고령 동행에도 실제 체험·안전 근거가 있어 0.75로 재판정했다."),
}


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def main() -> None:
    source_rows, draft_rows = read_jsonl(INPUT), read_jsonl(DRAFT)
    if len(source_rows) != 50 or len(draft_rows) != 50:
        raise ValueError("expected 50 input and draft records")
    reviewed = []
    for source, draft in zip(source_rows, draft_rows, strict=True):
        for field in ("contentid", "title", "source_order", "calibration_family"):
            if source[field] != draft[field]:
                raise ValueError(f"input/draft mismatch for {field}: {source['contentid']}")
        row = deepcopy(draft)
        for axis, label in row["companion_fit"].items():
            if change := CHANGES.get((row["contentid"], axis)):
                label["value"], label["confidence"], label["inference_level"], label["rationale"] = change
            if REVIEW_RULE not in label["rule_ids"]:
                label["rule_ids"].append(REVIEW_RULE)
        reviewed.append(row)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in reviewed), encoding="utf-8")


if __name__ == "__main__":
    main()
