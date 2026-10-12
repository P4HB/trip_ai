# SPEC-054: outdoor_nature Companion final review batch 13

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [SPEC-022](spec_022.md), [SPEC-049](spec_049.md)
- 관련 데이터: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/14_outdoor_nature.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`

## 배경

outdoor_nature batch 13의 50개 장소에 대해 소개 원문·unknowns·evidence ID에 근거한 1차 Companion 판정과 경계 재검토를 별도 sidecar로 남긴다.

## 목표와 비목표

- 입력 순서와 식별 필드를 보존한 5축 complete numeric AxisLabel을 생성한다.
- 정책 범위를 quota가 아닌 경계 경보로 적용하고, 일반 경관·관람만으로 solo/couple/friends 고점을 만들지 않는다.
- 입력, canonical 라벨, 기존 산출물, 정책과 앵커는 수정하지 않는다.

## 요구사항

- `REQ-5401`: 50개 입력 행의 식별 필드와 family를 보존하고 5축 complete 객체를 출력한다.
- `REQ-5402`: 각 rationale은 원문 사실 또는 unknown을 포함하고 evidence ID를 보존하며 review rule ID를 포함한다.
- `REQ-5403`: kids/parents는 연령·안전·활동·보행·가족 직접 근거로만 조정하고, 0은 방문 금지가 아닌 상대 최저점으로 쓴다.
- `REQ-5404`: 1차→경계 재검토 차이를 계산하되 reviewed JSONL만 데이터 산출물로 쓴다.

## 입력과 출력

- 입력: `calibration_inputs/14_outdoor_nature.jsonl` 50행.
- 출력: `calibration_outputs/reviewed/reviewed_calibrated_batch_13.jsonl` 50행 JSONL.

## 승인 기준과 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| `AC-5401` | 입력 순서·식별자·family와 출력 50행을 전수 비교한다. |
| `AC-5402` | 250축의 허용값, complete schema, status, provenance와 rationale을 전수 검사한다. |
| `AC-5403` | 경계 재검토 차이와 분포를 출력하고 기존 파일 변경 여부를 확인한다. |

## 구현 결과

- `calibration_outputs/reviewed/reviewed_calibrated_batch_13.jsonl`에 입력 순서 그대로 50행·250축을 생성했다.
- `scripts/review_calibrated_batch_13.py`는 1차 판정과 경계 재검토 차이를 메모리에서 비교하고, `--check`로 입력 순서·식별자·5축 schema·값·상태·provenance를 전수 검사한다.
- 검증 통과: `python -m py_compile scripts/review_calibrated_batch_13.py`, 생성, `python scripts/review_calibrated_batch_13.py --check`, `git diff --check`.
- 최종 분포: solo `{0.5: 48, 0.75: 2}`; couple `{0.5: 49, 0.75: 1}`; friends `{0.5: 48, 0.75: 2}`; kids `{0.25: 1, 0.5: 39, 0.75: 8, 1: 2}`; parents `{0.25: 1, 0.5: 46, 0.75: 2, 1: 1}`. 5축 동일값 장소는 38개, 1차→경계 재검토 변경은 3축이다.

## 알려진 제한

소개에 없는 동행 선호, 접근성, 연령 및 안전 조건은 추정하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | batch 13 최종 검토 SPEC 작성 |
| 2026-08-12 | reviewed sidecar 생성 및 전수 검증 |
