# SPEC-035: Companion calibration shopping_market 기준 표본

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-022](spec_022.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

`shopping_market` 장소 유형의 Companion 5축을 장소 소개·미확인 사항·근거 ID에 따라 독립 calibration한다. 기존 입력과 표준 라벨은 보존한다.

## 목표

- shopping_market 30개 장소에 5단계 Companion AI 초안을 작성한다.
- 모든 축에 완전한 AxisLabel 구조와 원문 기반 rationale을 기록한다.

## 비목표

- 기존 라벨·입력 수정 및 Month 축 라벨링
- 소개에 없는 사회적 선호 추정

## 요구사항

- `REQ-3501`: shopping_market 행만 source order 순으로 출력한다.
- `REQ-3502`: 각 장소의 Companion 5축은 허용 numeric 값과 `ai_draft` 상태를 가진다.
- `REQ-3503`: rationale은 소개 사실 또는 unknown을, rule IDs는 `CALIBRATED-DIRECT-COMPANION-V1`을 포함한다.

## 입력과 출력

- 입력: `calibration_inputs/calibration_sample.jsonl`
- 출력: `calibration_outputs/calibrate_market.jsonl`
- 출력 행: `contentid`, `title`, `source_order`, `calibration_family`, `companion_fit`.

## 설계

명시된 동행 대상·활동·시설은 높은 값, 직접 명시된 불일치는 낮은 값, 동행별 정보가 부족한 일반 매장은 `0.5` 중심으로 보수 판정한다.

## 예외와 폴백

동행 관련 근거가 없으면 `inference_level=unknown`, 낮은 confidence와 해당 unknown을 rationale에 기록한다.

## 영향 범위

- 변경 파일: 본 SPEC, `calibration_outputs/calibrate_market.jsonl`
- 데이터 마이그레이션·호환성 영향·개인정보 처리: 없음

## 승인 기준

- `AC-3501`: 30개 필터 대상의 ID·순서가 입력과 일치한다.
- `AC-3502`: 150축이 완전한 AxisLabel, numeric, 허용값, `ai_draft`, evidence/rule provenance를 가진다.
- `AC-3503`: JSONL 파싱과 whitespace 검증이 통과한다.

## 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| AC-3501~AC-3502 | Python JSONL 구조·필터·축·provenance 검사 |
| AC-3503 | JSONL 파싱, `git diff --check` |

## 구현 결과

- `calibrate_market.jsonl`에 shopping_market 30개 장소·150개 Companion 축을 생성했다.
- 모든 축은 numeric·`ai_draft`·`null_reason=null`·입력 evidence IDs·지정 rule ID를 갖는다.
- 분포: solo `{0.5: 20, 0.75: 10}`, couple `{0.5: 29, 1: 1}`, friends `{0.5: 27, 0.75: 2, 1: 1}`, kids `{0: 1, 0.25: 2, 0.5: 22, 0.75: 4, 1: 1}`, parents `{0.25: 1, 0.5: 28, 0.75: 1}`.

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며 사람 검수 전 골드 라벨이나 운영 추천 근거로 사용하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 30개 장소·150개 Companion 축 생성 및 검증 완료 |
