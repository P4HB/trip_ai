# SPEC-027: Companion 품질 판정 batch 001b

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-022](spec_022.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_001b.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

사용자가 지정한 audit input의 0-based source_order 25~49, 25개 장소는 기존 라벨·분포와 독립적으로 장소 소개 원문과 unknowns만 근거로 Companion 5축을 재판정해야 한다.

## 목표

- 지정 25개 장소의 `solo`, `couple`, `friends`, `kids`, `parents` 125축을 5단계 척도로 판정한다.
- 각 축에 원문 근거, provenance, 상태와 신뢰도를 남긴 독립 JSONL 배치를 만든다.

## 비목표

- 기존 JSONL, Month 축, canonical 결과 또는 입력의 수정·승격
- 원문에 없는 접근성·연령 조건의 추정

## 요구사항

- `REQ-2701`: 입력은 `audit_inputs/companion_audit_01.jsonl`의 0-based 25~49행만 사용하며, 각 행의 `source_excerpt`와 `unknowns`를 읽는다.
- `REQ-2702`: 장소별 5개 독립 Companion 축을 모두 numeric 값 `0`, `0.25`, `0.5`, `0.75`, `1`로 기록한다.
- `REQ-2703`: 모든 축은 전체 AxisLabel 필드, `status=ai_draft`, `null_reason=null`, `QUALITY-DIRECT-INTRO-COMPANION-V1` rule ID를 가진다.
- `REQ-2704`: rationale은 실제 원문 인용 또는 정확한 요약과 점수 이유를 포함하고, evidence ID는 입력값을 보존한다.
- `REQ-2705`: 출력은 `quality_batches/quality_companion_001b.jsonl`에만 저장한다.

## 입력과 출력

입력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/companion_audit_01.jsonl`의 source_order 25~49.

출력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_001b.jsonl`의 JSONL 25개 레코드. 각 레코드는 `contentid`, `title`, `source_order`, `companion_fit`을 가진다.

## 설계

장소별 원문에서 동행 직접 대상·활동·환경·편의를 분리해 다섯 축을 독립 판정했다. 소개에 접근성 또는 연령 관련 근거가 없고 unknowns가 이를 명시하면 해당 축은 `0.5`, 낮은 confidence, `unknown` inference level으로 처리했다. 직접 대상 언급 또는 강한 독립 근거가 둘 이상일 때만 `1`을 썼다.

## 예외와 폴백

- 원문이 동행 적합성을 뒷받침하지 않으면 `0.5`와 낮은 confidence를 사용한다.
- unknowns가 보행·유모차·고령자 또는 아동 마찰을 알리면 이를 긍정 근거로 보완하지 않는다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, 신규 quality batch JSONL
- 데이터 마이그레이션·호환성 영향: 없음. 별도 검수용 sidecar다.
- 보안·개인정보 영향: 공개 장소 소개만 처리한다.

## 승인 기준

- `AC-2701`: 정확한 25개 source_order 25~49가 한 번씩 출력된다.
- `AC-2702`: 125축 모두 허용 수치·정확한 키·필수 provenance 필드를 가진다.
- `AC-2703`: 각 rationale이 원문 근거를 명시하고 입력 evidence ID와 지정 rule ID를 가진다.
- `AC-2704`: 기존 JSONL, Month, 입력 파일은 변경되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-2701~AC-2703 | JSONL 구조, 순서, 5축, 값, provenance, 분포 검사 | 출력 생성 후 Python 검사 |
| AC-2704 | Git 경로 상태 확인 | `git status --short` |

## 구현 결과

- 지정 입력의 source_order 25~49, 25개 장소와 125개 Companion 축을 직접 판정해 `quality_batches/quality_companion_001b.jsonl`에 생성했다.
- 모든 축은 `numeric`, `ai_draft`, `null_reason=null`, 입력 evidence ID, `QUALITY-DIRECT-INTRO-COMPANION-V1`을 기록한다.
- 전체 5단계 분포는 `0: 0`, `0.25: 2`, `0.5: 56`, `0.75: 60`, `1: 7`이다.

### 검증 결과

| 항목 | 결과 |
|---|---|
| 대상 slice·순서·contentid | source_order 25~49의 25개와 전수 일치 |
| 축 구조·값·provenance | 125/125 통과 |
| 입력 evidence ID·상태·rule ID | 125/125 통과 |
| 보호 경로 확인 | 표준 JSONL 변경 없음; 입력은 작업 전부터 미추적 |

## 설계와 달라진 점

없음

## 알려진 제한

AI 초안이며 사람 검수 전 운영 추천 또는 골드 라벨로 사용하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 25개 Companion 품질 배치 생성 및 구조 검증 완료 |
