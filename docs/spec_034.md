# SPEC-034: outdoor_nature Companion calibration 표본 직접 라벨링

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [SPEC-022](spec_022.md)
- 관련 코드: `scripts/generate_outdoor_calibration.py`

## 배경

`outdoor_nature` 유형의 Companion 5축 상대 적합도를 원문 증거로 직접 보정하는 sidecar가 필요하다.

## 목표

- 입력 중 `outdoor_nature` 30건만 새 JSONL로 생성한다.
- 소개·unknowns·evidence_ids에 근거한 5단계 AxisLabel을 남긴다.

## 비목표

- 기존 입력·canonical 라벨 변경과 추천 기능 변경.

## 요구사항

- `REQ-3401`: 입력 순서와 식별 필드를 보존한다.
- `REQ-3402`: 150개 축은 완전한 numeric AxisLabel이며 지정 rule ID를 포함한다.
- `REQ-3403`: rationale은 source_excerpt 사실 또는 unknown을 포함한다.

## 승인 기준

- `AC-3401`: 출력은 `outdoor_nature` 30행이다.
- `AC-3402`: 150개 축이 스키마·허용값·provenance를 만족한다.
- `AC-3403`: 기존 파일은 수정하지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| AC-3401~AC-3402 | JSONL 전수 파싱 및 축·값·provenance 검사 |
| AC-3403 | 변경 파일 확인 |

## 구현 결과

- `scripts/generate_outdoor_calibration.py`가 입력의 `outdoor_nature` 30건만 읽어 출력 sidecar를 생성한다.
- 출력은 30행·150축이며 값 분포는 0=2, 0.25=8, 0.5=107, 0.75=31, 1=2다.
- Python 구문 검사, 전수 JSONL 구조·허용값·provenance 검사를 통과했다.

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며, 소개에 없는 사회적 선호·접근성은 추정하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | outdoor_nature 30건 calibration sidecar 생성 및 검증 |
