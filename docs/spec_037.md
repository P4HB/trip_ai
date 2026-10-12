# SPEC-037: Cafe unknown-intro Companion 경계 재검토 batch 06

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [README](README.md), [SPEC-022](spec_022.md), `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`
- 관련 데이터: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/03_cafe_unknown_intro.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/batches/calibrated_batch_06.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

`cafe_unknown_intro` batch 06의 기존 AI 초안에서 0.5, 0.75, 1 경계를 입력의 `source_excerpt`로 다시 검토한다. 정책은 이 유형에 장소 소개 원문 및 동행 근거가 없을 때 임의 분산하지 않고 모든 축을 0.5로 두도록 명시한다.

## 목표와 비목표

- 입력 50개 장소의 Companion 5축을 독립적으로 재검토한 sidecar를 새 파일로 생성한다.
- 각 축에 실제 `source_excerpt`의 미확인 사실을 근거로 남기고 경계 재검토 규칙 ID를 기록한다.
- 기존 초안, 입력, canonical 라벨, Month 축은 수정하거나 승격하지 않는다.

## 요구사항

- `REQ-3701`: 입력의 50개 장소를 입력 순서와 `contentid`, `title`, `source_order`, `calibration_family`를 보존하여 모두 출력한다.
- `REQ-3702`: 모든 Companion 축은 완전한 numeric AxisLabel이며 값은 정책 예외에 따라 0.5, `confidence`는 0.3 이하, `inference_level=unknown`, `status=ai_draft`, `null_reason=null`이다.
- `REQ-3703`: 모든 rationale은 `source_excerpt`의 “소개 원문·웹 조사 facts가 없음. TourAPI 기본 메타데이터만 제공됨.” 사실 및 동행 조건 직접 근거 부재를 포함한다.
- `REQ-3704`: 모든 `rule_ids`는 `CALIBRATED-BOUNDARY-REVIEW-V2`를 포함하고 각 입력의 `evidence_ids`를 보존한다.
- `REQ-3705`: 기존 파일을 수정하지 않고 결과는 `calibration_outputs/reviewed/reviewed_calibrated_batch_06.jsonl`에만 생성한다.

## 입력과 출력

- 입력: `calibration_inputs/03_cafe_unknown_intro.jsonl` (50개, source order 1464–1513).
- 정책: `companion_calibration_policy.md`.
- 동일 유형 앵커: `calibration_outputs/companion_calibration_guide.json`.
- 기존 초안: `calibration_outputs/batches/calibrated_batch_06.jsonl`.
- 출력: `calibration_outputs/reviewed/reviewed_calibrated_batch_06.jsonl`.

## 영향 범위

- 변경 파일: 본 SPEC과 신규 reviewed JSONL.
- 데이터 마이그레이션·호환성·개인정보 영향: 없음.

## 승인 기준과 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| `AC-3701` | JSONL이 50행이며 입력의 식별자·순서·family와 정확히 일치한다. |
| `AC-3702` | 250개 축 모두 완전한 AxisLabel이고 0.5/낮은 confidence/unknown 상태 및 요구 rule ID를 만족한다. |
| `AC-3703` | rationale에 실제 source_excerpt 사실이 있고, 기존 초안과 입력의 SHA-256이 변경되지 않는다. |

## 구현 결과

`calibration_outputs/reviewed/reviewed_calibrated_batch_06.jsonl`에 50개 장소와 250개 Companion AxisLabel을 생성했다. 모든 입력 식별자·순서·family·evidence ID를 보존했다. `cafe_unknown_intro` 예외에 따라 다섯 축 모두 0.5, confidence 0.25, unknown 추론으로 유지했고, 각 rationale에는 소개 원문·웹 조사 facts 부재와 TourAPI 기본 메타데이터만 제공된다는 source_excerpt 사실을 기록했다. 모든 축의 rule IDs에 `CALIBRATED-BOUNDARY-REVIEW-V2`를 추가했다.

검증에서 입력·기존 초안·출력은 각각 50행이고 입력/출력 식별 필드가 일치했으며, 250개 축의 완전 객체, 값 0.5, 상태, evidence ID, rationale, rule ID를 확인했다. 기존 초안 대비 점수 변경은 0축이며 `git diff --check`도 통과했다.

## 알려진 제한

입력에 장소 소개와 동행 조건 근거가 없으므로 개별 장소의 실제 적합도 차이는 판정하지 않는다. 0.5는 방문 금지가 아닌 상대적 중립값이다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | batch 06의 cafe_unknown_intro 경계 재검토 범위와 승인 기준으로 동기화. |
