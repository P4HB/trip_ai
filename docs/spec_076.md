# SPEC-076: 장소 유형 사용자 확정과 경관·걷기 분류

- 상태: Implemented
- 작성일: 2026-09-11
- 관련 문서: [SPEC-075](spec_075.md), [데이터 계약](data_contracts.md)
- 관련 코드: `config/place_type_taxonomy.v1.json`, `scripts/classify_place_types.py`, `scripts/test_place_types.py`

## 배경
사용자가 검토 목록의 19곳에 대표 유형을 직접 지정했다. 기존 자동 추론과 사용자 확정 판정을 구별해야 한다.

## 목표
사용자 지정 19곳을 확정하고 경관·걷기 유형을 추가한다.

## 비목표
나머지 장소 재판정, 하루 상한 적용, 추천 엔진·원본 DB·지도 변경.

## 요구사항
- REQ-001: 지정 19곳에 사용자 지시를 ID로 연결하고 기존 유형의 약칭은 동일한 유형 ID로 해석한다. 중문관광단지는 기존 tourism_area에 유지한다.
- REQ-002: 쉬리의언덕·나바론하늘길·1100도로는 새 scenic_walk(경관·걷기)에 연결한다. 나머지 경관 장소는 자동 변경하지 않는다.
- REQ-003: 지정 항목은 user_confirmed, human_reviewed=true로 출력하고 확인일·사용자 판정 근거를 보존한다. 기존 보정 근거는 previous_decision에 보존한다. 사용자 확정은 웹 사실의 재검증을 뜻하지 않는다.
- REQ-004: 지정되지 않은 항목의 유형·검토 상태는 유지하고 산출물을 재생성한다.

## 입력과 출력
SPEC-075와 같은 입력/출력 경로. taxonomy version은 place-primary-types-v1.1-user-confirmed로 올리고 기존 ID는 유지한다.

## 설계
구현: ID 보정에 user_confirmation 기록 → 생성기에서 최우선 판정 → 검토 큐 해제 → JSONL·SQLite·report·manifest 재생성.

## 예외와 폴백
없는 ID·유형은 실패한다. 명시적으로 확정되지 않은 항목은 기존 상태를 유지한다.

## 영향 범위
분류 설정·생성기·테스트·sidecar·문서만 변경한다. 기존 DB 마이그레이션 없음.

## 승인 기준
- AC-001: 지정 19곳의 유형과 확정 출처가 정확하고 검토 큐는 27→8곳이다.
- AC-002: 나머지 2,134곳의 유형과 검토 상태는 변하지 않는다.
- AC-003: 2,153 ID 보존·SQLite 일치·재현성·원본 불변 검증 통과.

## 테스트 계획
`python -m py_compile scripts/classify_place_types.py scripts/test_place_types.py`
`python scripts/test_place_types.py`
변경 전 분류와 비교하여 AC-001~002를 검사한다.

## 구현 결과
아래는 19곳 확정 시점의 결과다. 후속 [SPEC-077](spec_077.md)에서 남은 8곳도 최초 제안대로 확정했다.
19곳을 user_confirmed로 확정했다. 경관·걷기 3곳을 추가해 대표 유형은 33개(unknown 별도)다. 총 2,153곳, 사용자 확정 19곳, 자동 분류 2,126곳, 검토 필요 8곳이다. JSONL·SQLite·report·manifest를 재생성했다. 변경 전 유형·상태는 `pre_user_confirmation_baseline.json`에 보존했다.

## 검증 결과

Python 컴파일과 `python scripts/test_place_types.py` 통과. 19곳 사용자 지정 일치, 나머지 2,134곳 유형·상태 불변, 검토 큐 8곳, 2,153 ID 보존, SQLite 무결성·JSONL 일치·재현성·원본 불변을 확인했다.

## 설계와 달라진 점
없음.

## 알려진 제한
나머지 검토 항목과 하루 상한은 후속 작업이다.

## 변경 이력
| 날짜 | 내용 |
|---|---|
| 2026-09-11 | 사용자 지정 19곳의 확정 반영 요구사항 작성 |
| 2026-09-11 | 확정 메타데이터·경관·걷기 유형·재생성과 회귀 검증 완료 |
