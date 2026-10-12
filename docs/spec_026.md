# SPEC-026: Companion 품질 재판정 001d

- 상태: Implemented
- 작성일: 2026-08-12
- 관련 SPEC: [SPEC-022](spec_022.md)
- 관련 기준 문서: [데이터 계약](data_contracts.md)

## 배경과 목표

장소 소개를 직접 읽는 Companion 라벨의 품질 점검으로, 지정 audit 입력의 0-based 순서 75–99에 해당하는 25개 장소를 독립 재판정한다. 각 장소의 `source_excerpt`와 `unknowns`만 근거로 5개 동행 축을 작성한다.

## 비목표

- 기존 표준 JSONL, Month 축, 기존 batch 또는 audit 입력 변경
- 소개에 없는 접근성·연령 조건의 추정
- 추천·랭킹·일정 기능 변경

## 요구사항

- `REQ-2601`: 입력 `audit_inputs/companion_audit_01.jsonl`의 순서 75–99, 25개만 처리한다.
- `REQ-2602`: 각 결과는 `solo`, `couple`, `friends`, `kids`, `parents` 5축을 독립적으로 가진다.
- `REQ-2603`: 값은 0, 0.25, 0.5, 0.75, 1 중 하나이며, 0.75/1에는 소개의 명시적 근거를 남긴다.
- `REQ-2604`: 모든 축은 `status=ai_draft`, `state=numeric`, `null_reason=null`이며 `QUALITY-DIRECT-INTRO-COMPANION-V1`을 rule ID로 포함한다.
- `REQ-2605`: 결과는 `quality_batches/quality_companion_001d.jsonl`에만 기록한다.

## 승인 기준과 테스트

- `AC-2601`: 25개 contentid가 입력 slice와 순서까지 일치하며 중복·누락이 없다.
- `AC-2602`: 125개 축이 완전한 AxisLabel 스키마, 허용값 및 필수 provenance를 만족한다.
- `AC-2603`: source excerpt·unknowns 외의 접근성·연령 사실을 주장하지 않고, 값별 분포를 보고한다.
- `AC-2604`: 보호 대상(기존 JSONL, Month, 기존 batch, 입력)에 변경이 없다.

검증은 JSONL 파싱, 대상 ID·축 키·상태·값·rule ID 검사 및 5단계 분포 집계로 수행한다.

## 상태

구현 완료. `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_001d.jsonl`에 source order 75–99의 25개 장소, 125개 Companion 축을 생성했다.

검증 결과: JSONL 파싱, 입력 slice 순서·contentid 일치, 5축 완전성, AxisLabel 필수 키, numeric 상태, 허용값, `ai_draft`, `null_reason=null`, rule ID 및 evidence ID를 모두 통과했다. 축별 값 분포는 solo `{0.5: 1, 0.75: 24}`, couple `{0.5: 4, 0.75: 18, 1: 3}`, friends `{0.5: 2, 0.75: 23}`, kids `{0: 1, 0.5: 15, 0.75: 4, 1: 5}`, parents `{0.25: 1, 0.5: 22, 0.75: 2}`이다.
