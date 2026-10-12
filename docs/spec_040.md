# SPEC-040: shopping_market calibration batch 05 Companion 직접 판정

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [SPEC-022](spec_022.md), [SPEC-035](spec_035.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/28_shopping_market.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/batches/calibrated_batch_05.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md), [SPEC-035](spec_035.md)

## 배경

`shopping_market` 별도 calibration 배치의 Companion 5축을 장소 소개, 미확인 사항, evidence ID와 동형 앵커를 근거로 직접 판정한다. 기존 입력·기준 앵커·표준 라벨은 보존한다.

## 목표

- 입력 50개 장소의 Companion 250축 AI 초안을 생성한다.
- 모든 축에 원문 또는 unknown 기반 rationale과 provenance를 남긴다.

## 비목표

- 표준 라벨, 기존 calibration 파일, Month 축의 수정
- 소개에 없는 사회적 선호 추정과 앵커 분포 강제 일치

## 요구사항

- `REQ-4001`: 입력의 모든 행을 원래 순서로 출력한다.
- `REQ-4002`: 축마다 허용 numeric 값과 완전한 AxisLabel을 기록한다.
- `REQ-4003`: 모든 축은 `ai_draft`, `null_reason=null`, 입력 evidence IDs, `CALIBRATED-DIRECT-COMPANION-V1`, 원문/unknown 기반 rationale을 가진다.
- `REQ-4004`: 단순 쇼핑만으로 couple/friends 고점을 주지 않으며, 명시 대상·활동·환경·편의만 점수 보정 근거로 쓴다.

## 입력과 출력

- 입력: `calibration_inputs/28_shopping_market.jsonl`
- 앵커: `calibration_outputs/companion_calibration_guide.json`
- 출력: `calibration_outputs/batches/calibrated_batch_05.jsonl`

## 설계

각 행의 `source_excerpt`, `unknowns`, `evidence_ids`, `calibration_family`를 직접 읽는다. 앵커는 경계 사례와 rationale 표현만 참고한다. 명시 대상 또는 독립 근거 둘 이상은 1, 실제 동행 관련 장점은 0.75, 근거 부족은 0.5, 불리한 근거는 0.25, 직접 제외·위험은 0으로 판정한다.

## 예외와 폴백

동행별 근거가 부족하면 0.5·낮은 confidence·`inference_level=unknown`을 사용하고, rationale에 해당 unknown을 기록한다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, `calibration_outputs/batches/calibrated_batch_05.jsonl`
- 데이터 마이그레이션·호환성·보안·개인정보 영향: 없음

## 승인 기준

- `AC-4001`: 출력 행 수·ID·제목·source order·family가 입력과 일치한다.
- `AC-4002`: 250축이 허용 numeric 값, 필수 필드, `ai_draft`, rule/evidence provenance를 가진다.
- `AC-4003`: rationale에 원문 사실 또는 unknown이 있고 JSONL 파싱·whitespace 검증이 통과한다.

## 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| AC-4001~AC-4003 | JSONL 구조·입력 대조·축·provenance·rationale·분포 전수 검사 |
| AC-4003 | `git diff --check` |

## 구현 결과

- `calibration_outputs/batches/calibrated_batch_05.jsonl`에 50개 장소·250축을 생성했다.
- ID·순서·family·evidence IDs, 5축 완전성, 값, 필수 필드, provenance와 rationale을 전수 대조해 통과했다.
- 분포: solo `{0.5: 50}`, couple `{0.5: 50}`, friends `{0.5: 50}`, kids `{0.25: 7, 0.5: 39, 1: 4}`, parents `{0.5: 44, 0.75: 6}`. 5축이 모두 같은 값인 장소는 33개다.

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며 사람 검수 전 골드 라벨 또는 운영 추천 근거로 사용하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 배치 05 직접 판정·전수 검증 완료 |
