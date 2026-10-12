# SPEC-029: Companion 엄격 품질 판정 batch strict-001b

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-022](spec_022.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_strict_001b.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

일반 경관·전망·산책·관람을 특정 동행의 장점으로 과대 해석하지 않도록, 지정 25개 장소의 Companion 축을 장소 소개와 미확인 사항만으로 엄격하게 독립 재판정한다.

## 목표

- source order 25~49의 25개 장소와 Companion 125축을 재판정한다.
- 일반 방문 경험은 0.5로 두고, 동행별 직접 근거가 있을 때만 0.75 이상을 부여한다.
- 기존 배치와 분리된 strict JSONL sidecar를 만든다.

## 비목표

- 기존 JSONL, Month 축, canonical 결과, audit 입력의 수정 또는 승격
- 장소 소개와 unknowns에 없는 접근성·연령·동행 장점의 추정

## 요구사항

- `REQ-2901`: 입력은 `audit_inputs/companion_audit_01.jsonl`의 0-based 25~49행만 사용하며, 각 행의 `source_excerpt`와 `unknowns`를 읽는다.
- `REQ-2902`: 일반 경관·전망·산책·관람만으로 solo/couple/friends에 0.75를 부여하지 않고 0.5를 기본값으로 한다. 동행별 직접 장점, 직접 대상·추천 또는 독립 강한 근거 둘 이상일 때만 상향한다.
- `REQ-2903`: 정보가 부족한 축은 0.5, confidence 0.4~0.55, unknown을 포함한 rationale로 기록한다.
- `REQ-2904`: 각 축은 완전한 AxisLabel 구조, numeric 허용값, `status=ai_draft`, `null_reason=null`, 입력 evidence ID 및 `STRICT-QUALITY-DIRECT-COMPANION-V2` rule ID를 가진다.
- `REQ-2905`: 출력은 `quality_batches/quality_companion_strict_001b.jsonl` 신규 파일에만 기록한다.

## 입력과 출력

입력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/companion_audit_01.jsonl`의 25~49행.

출력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_strict_001b.jsonl`의 JSONL 25개 레코드. 각 레코드는 `contentid`, `title`, `source_order`, `companion_fit`을 가진다.

## 설계

각 축은 원문에 명시된 동행별 대상·활동·시설·편의를 우선한다. 일반적인 관람은 중립값이며, 아동·고령 동행은 unknowns에 마찰 또는 동선 미확인이 있으면 이를 rationale에 남겨 0.5와 낮은 confidence로 보수 처리한다. `inference_level`은 직접 근거가 있으면 `direct_evidence`, 그 밖의 중립 폴백은 `unknown`으로 한다.

## 예외와 폴백

- 대표 경험과 명백히 맞지 않을 때만 0 또는 0.25를 사용한다. 0은 방문 불가를 뜻하지 않는다.
- unknowns는 긍정 근거로 바꾸지 않으며, 원문 근거가 부족한 축의 rationale에 명시한다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, 신규 strict quality batch JSONL
- 데이터 마이그레이션·호환성 영향: 없음. 별도 검수용 sidecar다.
- 보안·개인정보 영향: 공개 장소 소개만 처리한다.

## 승인 기준

- `AC-2901`: source_order 25~49의 25개가 한 번씩, 입력 순서로 출력된다.
- `AC-2902`: 125축이 완전한 AxisLabel 구조·허용값·상태·provenance를 가진다.
- `AC-2903`: 0.75 이상 축은 해당 동행의 직접 근거를 rationale에 담고, 정보 부족 축은 unknown과 0.4~0.55 confidence를 가진다.
- `AC-2904`: 기존 배치·canonical·입력은 변경되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-2901~AC-2903 | JSONL 구조, 대상 slice, 값, provenance, confidence, 5점 분포 검사 | 출력 생성 후 Python 검사 |
| AC-2904 | 출력 외 데이터 경로 상태 확인 | `git status --short` |

## 구현 결과

- `quality_batches/quality_companion_strict_001b.jsonl`에 source_order 25~49의 25개 장소와 Companion 125축을 생성했다.
- 일반 경관·전망·산책·관람은 0.5로 유지했다. 직접 게임 참여 경험이 명시된 김녕미로공원 friends 축만 0.75로 판정했다.
- 전체 5점 분포는 `0: 0`, `0.25: 0`, `0.5: 124`, `0.75: 1`, `1: 0`이다.

### 검증 결과

| 항목 | 결과 |
|---|---|
| 대상 slice·순서·contentid·title | source_order 25~49의 25개와 전수 일치 |
| 축 구조·값·상태·provenance | 125/125 통과 |
| unknown 폴백 confidence·rationale | 124/124 통과 |
| 직접 상향 축 | 김녕미로공원 friends 1/1, `direct_evidence` 통과 |
| 기존 파일 보호 | 신규 strict 출력과 본 SPEC·색인만 변경 |

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며 사람 검수 전 운영 추천 또는 골드 라벨로 사용하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 엄격 Companion 품질 배치 생성 및 구조 검증 완료 |
