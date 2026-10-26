# SPEC-051: Activity-family calibration batch 07 Companion boundary review

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [README](README.md), [data_contracts](data_contracts.md), [SPEC-022](spec_022.md), [SPEC-046](spec_046.md)
- 관련 데이터: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/02_activity_family.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`
- 선행 SPEC: [SPEC-046](spec_046.md)

## 배경

입력의 activity-family 34곳은 장소 소개·unknowns·evidence IDs에 기반한 1차 직접 판정과 경계 재검토가 필요하다. 정책의 분포 범위는 quota가 아닌 경보다.

## 목표와 비목표

- 34개 입력 장소에 대해 5축 complete AxisLabel reviewed sidecar를 생성한다.
- 입력·정책·앵커·기존 산출물·canonical 라벨·Month 축은 수정하지 않는다.
- 소개에 없는 사회적 적합성, 접근성, 연령·안전 조건을 추정하지 않는다.

## 요구사항

- `REQ-5101`: 모든 입력의 source excerpt·unknowns·evidence IDs를 읽고 식별자·순서·family를 보존한다.
- `REQ-5102`: 1차 판정 뒤 경계를 재검토하며, 단순 경관·관람·쇼핑만으로 올린 solo/couple/friends 고점은 `0.5`로 둔다.
- `REQ-5103`: kids/parents는 직접 명시된 연령·안전·활동·보행·가족 근거만으로 판정한다.
- `REQ-5104`: 170축은 complete numeric AxisLabel, `ai_draft`, null null-reason, 입력 evidence IDs, 원문 사실/unknown rationale, review rule ID를 갖는다.
- `REQ-5105`: cafe_unknown_intro가 있으면 모든 축 `0.5`, confidence 최대 `0.3`, `inference_level=unknown`을 유지한다. 이번 입력에는 없다.

## 입력과 출력

- 입력: `calibration_inputs/02_activity_family.jsonl` (34 JSONL 행).
- 출력: `calibration_outputs/reviewed/reviewed_calibrated_batch_07.jsonl` (34행, 170축).

## 설계

소개 원문을 우선 근거로 사용한다. named companion·연령·가족·안전·실제 활동만 비중립값의 근거로 쓰며, 1차 값은 변경 수 계산용으로만 메모리에 보관하고 최종 reviewed sidecar만 쓴다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, `scripts/archive/generate_reviewed_calibrated_batch_07.py`, reviewed JSONL sidecar.
- 데이터 마이그레이션·호환성·보안·개인정보 영향: 없음.

## 승인 기준

- `AC-5101`: 34행의 식별자·제목·순서·family가 입력과 일치한다.
- `AC-5102`: 170축 모두 complete numeric AxisLabel과 source-grounded provenance/rationale 계약을 만족한다.
- `AC-5103`: 입력·정책·앵커·기존 출력은 수정하지 않는다.
- `AC-5104`: 축별 분포, 5축 동일값 장소 수, 변경 축 수와 경계 사례 3개를 보고한다.

## 테스트 계획

| 승인 기준 | 검증 명령 |
|---|---|
| AC-5101~AC-5104 | `python scripts/archive/generate_reviewed_calibrated_batch_07.py --check` |

## 구현 결과

`calibration_outputs/reviewed/reviewed_calibrated_batch_07.jsonl`에 34개 장소와 170개 AxisLabel을 생성했다. SHA-256은 `92526d7985d048804949504eb58503ae4875b20554c864784729cb4d29324828`이다.

분포: solo `{0.5: 19, 0.75: 15}`, couple `{0.5: 33, 1: 1}`, friends `{0.5: 30, 0.75: 2, 1: 2}`, kids `{0.25: 3, 0.5: 20, 0.75: 6, 1: 5}`, parents `{0.25: 2, 0.5: 24, 0.75: 8}`. 5축 동일값 장소는 11곳이며 1차→재검토 변경은 3축이다: 달달미깡감귤밭 couple, 뱅듸승마클럽 friends, 세기알해변 couple을 각각 `0.75→0.5`로 조정했다.

생성, `--check`, `python -m py_compile scripts/archive/generate_reviewed_calibrated_batch_07.py`, `git diff --check`를 통과했다.

## 설계와 달라진 점

없음.

## 알려진 제한

AI draft이며, 소개 원문이 확정하지 않은 동행·접근성·안전 조건은 확정하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 34행 batch 07 직접 판정·경계 재검토 산출 및 검증. |
