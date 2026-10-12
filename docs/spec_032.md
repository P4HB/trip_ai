# SPEC-032: Companion 상대 5점 재판정 batch 05

- 상태: In Progress
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 SPEC: [SPEC-022](spec_022.md)
- 관련 기준 문서: [데이터 계약](data_contracts.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/companion_relative_05.jsonl`

## 배경과 목표

SPEC-022의 병합 입력 중 0-based source order 1111–1387, 총 277곳의 Companion 5축을 장소별 `source_excerpt`, `unknowns`, `evidence_ids`를 직접 근거로 다시 판정한다. 이번 배치는 절대적인 방문 가능성이 아니라 같은 장소의 대표 경험에 대한 동행별 상대 순위 5점을 표현한다.

## 비목표

- Month 축, 표준 `place_fit_labels.jsonl`, 원본 audit 입력 수정
- 접근성·운영 여부 같은 미확인 사실의 확정

## 요구사항

- `REQ-3201`: source order 1111–1387의 277개 입력을 원래 순서로 모두 포함한다.
- `REQ-3202`: 각 장소의 solo/couple/friends/kids/parents는 0, 0.25, 0.5, 0.75, 1 중 하나의 서로 비교 가능한 값으로 판정하고, 5축 전체가 같은 값인 장소를 만들지 않는다.
- `REQ-3203`: 각 축은 full AxisLabel 필드, `status=ai_draft`, 입력의 `evidence_ids`, `RELATIVE-DIRECT-INTRO-COMPANION-V3` rule ID를 가진다.
- `REQ-3204`: 소개가 부족한 경우에도 `unknowns`의 아동·고령자·보행 정보 미확인과 대표 경험의 단독/그룹 마찰을 rationale에 밝혀 상대 차이를 기록한다.
- `REQ-3205`: 출력은 `batches/companion_relative_05.jsonl` 신규 파일만 사용한다.

## 승인 기준

- `AC-3201`: 277개 source order와 contentid가 입력 slice와 순서까지 일치한다.
- `AC-3202`: 1,385개 축이 완전한 스키마·허용값·상태·provenance를 만족하고, 다섯 값이 모두 같은 장소는 0개다.
- `AC-3203`: 입력·Month·표준 JSONL에는 변경이 없다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-3201~AC-3202 | 입력 slice와 출력 JSONL 전수 비교, 스키마·값·분포 검사 | 생성 후 PowerShell 검사 |
| AC-3203 | Git diff 확인 | `git status --short` |

## 구현 결과

생성 및 검증 후 기록한다.

## 설계와 달라진 점

없음.

## 알려진 제한

소개가 접근성이나 연령 적합성을 명시하지 않은 경우 상대 점수는 AI 추론이며 낮은 confidence로 남긴다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 상대 5점 Companion batch 범위와 검증 기준 작성 |
