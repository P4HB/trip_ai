# SPEC-039: other_place Companion calibration batch 03

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-022](spec_022.md)
- 관련 데이터: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/10_other_place.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

`other_place` 20개 장소의 Companion 적합도를 장소 소개 원문·unknowns·evidence ID와 동일 유형 calibration guide를 기준으로 독립 판정한다. 기존 입력·canonical 라벨·기존 출력은 보존한다.

## 목표와 비목표

- 입력의 모든 행을 입력 순서대로 5축 Companion AI 초안으로 생성하고, 축마다 complete AxisLabel provenance와 원문 또는 unknown 기반 rationale을 기록한다.
- guide 분포 강제, Month 라벨링, canonical 변경, 소개에 없는 사회적 적합도 추정은 하지 않는다.

## 요구사항

- `REQ-3901`: `10_other_place.jsonl`의 20행만 source order 순으로 출력한다.
- `REQ-3902`: 모든 Companion 축은 허용 numeric 값과 complete AxisLabel, `status=ai_draft`, `null_reason=null`을 가진다.
- `REQ-3903`: rationale은 source excerpt의 실제 사실 또는 unknown을 직접 요약하고, 입력 evidence IDs와 `CALIBRATED-DIRECT-COMPANION-V1`을 기록한다.
- `REQ-3904`: 전망·관람·쇼핑만으로 couple/friends를 고점 처리하지 않으며, 직접 대상 또는 두 독립 근거가 없으면 `1`을 사용하지 않는다.

## 입력과 출력

- 입력: `calibration_inputs/10_other_place.jsonl`
- 앵커: `calibration_outputs/companion_calibration_guide.json`의 `other_place` 사례와 분포
- 출력: `calibration_outputs/batches/calibrated_batch_03.jsonl`
- 출력 행: `contentid`, `title`, `source_order`, `calibration_family`, `companion_fit` 5축

## 설계와 폴백

점수는 이용 가능 여부가 아니라 대표 경험의 상대 적합도다. 명시 대상 또는 독립 근거 2개 이상은 `1`, 실제 활동·시설·환경 장점 하나는 `0.75`, 동행별 근거 부족은 `0.5`, 명시된 마찰은 `0.25`, 심한 위험·미스매치는 `0`이다. 불명확한 연령·보행 조건은 rationale에 unknown으로 남기며, 근거 부족 축은 `inference_level=unknown`, `confidence=0.45`, `0.5`를 사용한다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, `calibration_outputs/batches/calibrated_batch_03.jsonl`
- 데이터 마이그레이션·호환성 영향·개인정보 처리: 없음

## 승인 기준과 테스트 계획

- `AC-3901`: 20개 출력 행의 ID·제목·순서·family가 입력과 일치한다.
- `AC-3902`: 100축이 complete AxisLabel, numeric 허용값, `ai_draft`, null reason, evidence/rule provenance를 가진다.
- `AC-3903`: 모든 rationale이 실제 소개 사실 또는 unknown을 포함하고 JSONL 파싱·whitespace 검증을 통과한다.

Node validator로 입력 대비 순서·스키마·값·provenance·rationale을 검사하고 `git diff --check`를 실행한다.

## 구현 결과

- `calibration_outputs/batches/calibrated_batch_03.jsonl`에 입력 순서의 20개 장소와 100개 Companion 축을 생성했다.
- JSONL 파싱 및 입력 대비 ID·제목·순서·family, AxisLabel 필수 키, numeric 허용값, 상태, null reason, evidence/rule provenance, rationale 검증을 통과했다. `git diff --check`도 통과했다.
- 축별 분포: solo `{0.5: 5, 0.75: 15}`, couple `{0.5: 19, 0.75: 1}`, friends `{0.5: 9, 0.75: 11}`, kids `{0.25: 1, 0.5: 14, 0.75: 3, 1: 2}`, parents `{0.5: 19, 1: 1}`.

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며, 소개에 없는 접근성·연령 조건은 확정하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 배치 03 범위와 판정·검증 기준 작성 |
| 2026-08-12 | 20개 장소·100축 생성 및 구조 검증 완료 |
