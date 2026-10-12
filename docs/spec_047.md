# SPEC-047: Cafe unknown-intro Companion 최종 검토 batch 08

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [README](README.md), [SPEC-022](spec_022.md), `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`
- 관련 데이터: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/04_cafe_unknown_intro.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/reviewed/reviewed_calibrated_batch_08.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

`cafe_unknown_intro` batch 08의 모든 장소에 소개 원문과 웹 조사 facts가 없어, 정책 예외에 따른 직접 판정과 경계 재검토를 한 작업에서 수행한다.

## 목표와 비목표

- 입력 50개 장소의 Companion 5축을 입력 순서로 최종 검토 sidecar에 기록한다.
- 소개 원문·동행 직접 근거 부재를 근거로 모든 축을 중립값으로 유지한다.
- 입력, 기존 라벨, 다른 산출물 및 Month 축은 수정하지 않는다.

## 요구사항

- `REQ-4701`: 입력의 모든 장소에 대해 `contentid`, `title`, `source_order`, `calibration_family`를 보존한 5축 결과를 출력한다.
- `REQ-4702`: 모든 축은 complete numeric AxisLabel이며 `value=0.5`, `confidence<=0.3`, `status=ai_draft`, `inference_level=unknown`, `null_reason=null`이다.
- `REQ-4703`: rationale은 source excerpt와 unknowns의 소개·동행 근거 부재를 기록하고, evidence IDs를 보존하며 `CALIBRATED-BOUNDARY-REVIEW-V2`를 포함한다.
- `REQ-4704`: 기존 파일을 수정하지 않고 reviewed JSONL만 새로 생성한다.

## 입력과 출력

- 입력: `calibration_inputs/04_cafe_unknown_intro.jsonl` (50개, source order 1514–1563).
- 정책: `companion_calibration_policy.md`.
- 앵커: `calibration_outputs/companion_calibration_guide.json`.
- 출력: `calibration_outputs/reviewed/reviewed_calibrated_batch_08.jsonl`.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, 신규 reviewed JSONL.
- 데이터 마이그레이션·호환성·개인정보 영향: 없음.

## 승인 기준과 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| `AC-4701` | JSONL 50행의 식별자·순서·family가 입력과 정확히 일치한다. |
| `AC-4702` | 250개 축이 complete AxisLabel이며 정책 예외의 값·confidence·상태를 만족한다. |
| `AC-4703` | rationale·evidence IDs·rule IDs를 확인하고, 기존 파일이 변경되지 않았음을 Git diff로 확인한다. |

## 구현 결과

1차 직접 판정 후 경계 재검토를 모두 수행했다. 50개 장소·250개 축은 모두 `cafe_unknown_intro` 정책 예외를 적용해 0.5, confidence 0.25, unknown 추론으로 유지했다. 1차→재검토 변경 축 수는 0이다.

검증에서 입력·출력의 50행 식별 필드와 순서, 250개 complete AxisLabel, 모든 축의 0.5/0.25/unknown/ai_draft/null, evidence IDs와 요구 rule ID를 확인했다.

## 알려진 제한

입력에 소개 원문·웹 조사 facts 및 동행 직접 근거가 없으므로 장소별 차이는 추정하지 않는다. 0.5는 방문 불가가 아니라 상대적 중립값이다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | batch 08 최종 직접 판정·경계 재검토 및 검증 완료. |

