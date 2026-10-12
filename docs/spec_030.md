# SPEC-030: Companion 엄격 품질 판정 batch 001c

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-022](spec_022.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_strict_001c.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md), [SPEC-027](spec_027.md)

## 배경

기존 품질 배치의 일반 경관·관람·산책 근거는 동행별 장점의 직접 근거가 아니다. 지정된 감사 입력의 0-based 50~74행은 원문 소개와 `unknowns`만으로, 더 엄격한 동행별 기준을 적용해 독립적으로 재판정한다.

## 목표

- 지정 장소 25개의 `solo`, `couple`, `friends`, `kids`, `parents` 125축을 엄격 5점 척도로 판정한다.
- 일반 경험은 0.5로 두고, 동행별 직접 장점이 명시된 경우에만 상향한다.

## 비목표

- 기존 JSONL·canonical 결과·입력 파일의 수정 또는 승격
- 장소 소개에 없는 접근성·연령·동행 경험의 추정

## 요구사항

- `REQ-3001`: 입력 `audit_inputs/companion_audit_01.jsonl`의 0-based 50~74행 25개만 사용하고 각 행의 `source_excerpt`, `unknowns`를 읽는다.
- `REQ-3002`: 125축은 모두 `0`, `0.25`, `0.5`, `0.75`, `1` 중 numeric 값과 완전한 AxisLabel 구조를 가진다.
- `REQ-3003`: 일반 경관·전망·산책·관람은 동행별 명시 장점이 없으면 0.5로 둔다. 정보 부족은 0.5, confidence 0.40~0.55, `unknown`과 rationale의 unknown 명시로 처리한다.
- `REQ-3004`: 각 축은 `status=ai_draft`, `null_reason=null`, 입력 `evidence_ids`, `STRICT-QUALITY-DIRECT-COMPANION-V2` rule ID를 가진다.
- `REQ-3005`: 출력은 `quality_batches/quality_companion_strict_001c.jsonl`에만 기록한다.

## 입력과 출력

입력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/companion_audit_01.jsonl`의 source order 50~74.

출력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_strict_001c.jsonl` JSONL 25행. 각 행은 `contentid`, `title`, `source_order`, `companion_fit`을 가진다.

## 설계

동행 축을 독립 판정한다. solo는 1인 성찰·명상 등, couple은 데이트·로맨틱한 2인 경험, friends는 단체 또는 함께 하는 활동, kids는 아동·가족·교육·안전 놀이, parents는 시니어 또는 편한 이동·휴식의 직접 근거가 있을 때만 0.75 이상으로 한다. 1은 직접 대상·추천 또는 독립된 강한 근거 둘 이상에 한정한다.

## 예외와 폴백

소개가 동행 특성을 뒷받침하지 않거나 `unknowns`가 관련 마찰을 남기면 0.5와 낮은 confidence를 사용한다. 0과 0.25는 대표 경험의 명백한 미스매치일 때만 사용한다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, 신규 quality batch JSONL
- 데이터 마이그레이션·호환성 영향: 없음. 검수용 sidecar만 추가한다.
- 보안·개인정보 영향: 공개 장소 소개만 처리한다.

## 승인 기준

- `AC-3001`: source_order 50~74의 25개가 순서대로 정확히 한 번씩 출력된다.
- `AC-3002`: 125축 모두 허용값, 다섯 축 키, 필수 AxisLabel 필드를 가진다.
- `AC-3003`: 모든 rationale이 실제 소개 근거 또는 unknown을 포함하며 입력 evidence ID와 지정 rule ID를 보존한다.
- `AC-3004`: 기존 파일과 감사 입력을 수정하지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-3001~AC-3003 | JSONL slice·구조·값·provenance·분포 검사 | Python 인라인 검사 |
| AC-3004 | 변경 경로 확인 | `git status --short` |

## 구현 결과

- `quality_batches/quality_companion_strict_001c.jsonl`에 source_order 50~74의 25개 장소와 125개 Companion 축을 생성했다.
- 일반 경관·관람·산책 축은 0.5로 유지했으며, 직접 근거가 있는 7축만 0.75로 판정했다. 1, 0.25, 0은 사용하지 않았다.

### 검증 결과

| 항목 | 결과 |
|---|---|
| 대상 slice·순서·contentid·title | source_order 50~74의 25개와 전수 일치 |
| 축 구조·값·상태·provenance | 125/125 통과 |
| evidence ID·rule ID·rationale | 125/125 통과 |
| 5점 분포 | `0: 0`, `0.25: 0`, `0.5: 118`, `0.75: 7`, `1: 0` |
| 입력 보호 | 입력은 작업 전부터 untracked이며 본 작업에서 수정하지 않음 |

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며 사람 검수 전 운영용 골드 라벨로 사용하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 엄격 Companion 품질 배치 초안 작성 |
| 2026-08-12 | 25개 엄격 재판정, JSONL 구조 검증 및 분포 확인 완료 |
