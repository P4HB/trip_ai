# SPEC-031: Companion 엄격 품질 재판정 strict-001a

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-022](spec_022.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_strict_001a.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

일반 경관·전망·산책·관람을 특정 동행의 장점으로 과대 해석하지 않도록, 지정 장소의 소개 원문과 unknowns만으로 Companion을 엄격히 재판정한다.

## 목표와 비목표

- 입력 source_order 0–24, 25개 장소의 125개 Companion 축을 독립 판정한다.
- 기존 JSONL·quality batch·audit input 및 Month 축은 수정하지 않는다.
- 장소 소개에 없는 안전·접근성·동행 장점은 추정하지 않는다.

## 요구사항

- `REQ-3101`: `source_excerpt`와 `unknowns`를 읽고 0–24행만 사용한다.
- `REQ-3102`: 일반 경험은 0.5이며 동행별 직접 장점이 있을 때만 0.75 이상, 명백한 대표 경험 미스매치일 때만 0.25 이하를 사용한다.
- `REQ-3103`: 정보 부족 축은 0.5, confidence 0.40–0.55, `unknown` 및 unknown을 포함한 rationale로 기록한다.
- `REQ-3104`: 모든 축은 full AxisLabel, `numeric`, `ai_draft`, `null_reason=null`, 입력 evidence ID, `STRICT-QUALITY-DIRECT-COMPANION-V2`를 가진다.
- `REQ-3105`: 결과는 `quality_batches/quality_companion_strict_001a.jsonl`에만 새로 기록한다.

## 입력과 출력

입력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/companion_audit_01.jsonl`의 source_order 0–24.

출력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_strict_001a.jsonl`의 JSONL 25행. 각 행은 `contentid`, `title`, `source_order`, `companion_fit`을 가진다.

## 설계와 영향 범위

직접 근거 없는 축은 해당 장소의 unknown을 rationale에 포함해 중립값으로 보수 처리한다. 직접 근거 9축만 0.75, 긴 산행·높은 파도·산중 사찰 오르기처럼 명백한 미스매치 4축만 0.25로 기록한다. 데이터 마이그레이션·운영 영향·개인정보 영향은 없다.

## 승인 기준과 테스트 결과

| 승인 기준 | 결과 |
|---|---|
| `AC-3101` 25개 장소·125 numeric 축 | 통과 |
| `AC-3102` full AxisLabel 및 status/rule/evidence | 통과 |
| `AC-3103` rationale에 원문 근거 또는 unknown 포함 | 통과 |
| `AC-3104` 기존 batch·audit input 미수정 | 통과 |

JSONL 파싱·slice·필수 필드·허용값·provenance 검사와 `git diff --check`를 통과했다. 5점 분포는 `0: 0`, `0.25: 4`, `0.5: 112`, `0.75: 9`, `1: 0`이다.

## 알려진 제한

AI 초안이며, unknown으로 표시한 접근성·연령 적합성은 운영 추천의 확정 근거가 아니다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | strict-001a 생성 및 구조 검증 완료 |
