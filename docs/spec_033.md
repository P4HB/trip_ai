# SPEC-033: Companion 상대 5점 재판정 01

- 상태: In Progress
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-022](spec_022.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

1,664개 병합 입력 중 source order 0–277의 278개 장소를 실제 장소 소개와 unknowns·evidence IDs에 근거해 Companion 상대 5점으로 다시 판정한다.

## 목표

- solo, couple, friends, kids, parents의 같은 장소 내 대표 경험 차이를 0~1의 5단계로 기록한다.
- 모든 축에 AxisLabel provenance를 기록하고 audit 입력 evidence IDs를 사용한다.
- 표준 JSONL과 Month 축, audit 입력을 변경하지 않고 독립 배치로 저장한다.

## 비목표

- Month·표준 canonical JSONL·기존 Companion 배치 수정
- 운영 추천 또는 사람 검수 완료 라벨 승격

## 요구사항

- `REQ-3301`: `companion_audit_01.jsonl`의 0–99, `companion_audit_02.jsonl`의 100–199, `companion_audit_03.jsonl`의 200–277을 source_order 오름차순으로 사용한다.
- `REQ-3302`: 각 5축은 numeric 값 `0`, `0.25`, `0.5`, `0.75`, `1` 중 하나이며, 한 장소의 5축을 모두 같은 값으로 두지 않는다.
- `REQ-3303`: rationale은 source_excerpt와 unknowns의 실제 근거 및 다른 동행 대비 이유를 요약한다. 직접 동행 근거가 없으면 confidence를 낮추되 상대적 마찰을 명시한다.
- `REQ-3304`: 모든 축은 `status=ai_draft`, `null_reason=null`, 입력 evidence IDs와 `RELATIVE-DIRECT-INTRO-COMPANION-V3` rule ID를 가진다.
- `REQ-3305`: 결과는 `batches/companion_relative_01.jsonl`에만 기록한다.

## 입력과 출력

입력은 세 audit JSONL의 `contentid`, `title`, `source_order`, `source_excerpt`, `unknowns`, `evidence_ids`다. 출력 행은 `contentid`, `title`, `source_order`, `companion_fit` 5축이며 축은 SPEC-022 AxisLabel 구조를 따른다.

## 설계

소개에 명시된 체험·경관·연령·이동·해상·성인 요소를 우선 읽는다. 5점은 방문 가능 여부가 아니라 같은 장소의 대표 경험에 대한 상대 순위다. unknowns의 보행·연령 정보 미확인은 kids·parents confidence를 낮추며, 자동 중립값 고정 대신 소개된 야외·조용한 관람·활동/체험·해상/경사 경험과의 상대 마찰을 rationale에 남긴다.

## 예외와 폴백

소개가 부족하면 `inference_level=unknown`과 낮은 confidence를 쓴다. 제목·주소로 보완하지 않고 source_excerpt의 대표 경험 및 unknowns에서 kids·parents와 solo/그룹의 상대 차이를 최소한 판정한다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, `batches/companion_relative_01.jsonl`
- 데이터 마이그레이션: 없음
- 호환성 영향: 독립 검토 배치이므로 canonical 소비자에 영향 없음
- 보안·개인정보 영향: 공개 장소 소개만 처리

## 승인 기준

- `AC-3301`: 278행이 source_order 0–277을 정확히 한 번씩, 입력 contentid·title과 함께 가진다.
- `AC-3302`: 각 행은 완전한 5개 AxisLabel, 허용 numeric 값, ai_draft, null_reason null, 입력 evidence IDs와 지정 rule ID를 가진다.
- `AC-3303`: 모든 장소가 5축 동일값이 아니며, rationale이 실제 소개/unknown 근거와 상대 이유를 기록한다.
- `AC-3304`: Month·표준 JSONL·audit 입력의 내용 변경이 없다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-3301~AC-3303 | JSONL 파싱, 입력 순서/ID, AxisLabel·값·provenance·동일값 검사 | 생성 후 Python 검증 |
| AC-3304 | git diff로 변경 경로 확인 | `git status --short` |

## 구현 결과

진행 중.

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며 장소 소개에 없는 실제 접근성·연령 조건은 확정하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 상대 5점 Companion 재판정 01 초안 작성 |
