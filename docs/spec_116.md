# SPEC-116: 음식점 병행 수집 루프 동작 보존 분해

- 상태: Implemented
- 작성일: 2026-10-30
- 최종 수정일: 2026-10-30
- 관련 이슈: 사용자 요청 "스파게티 코드 찾기" 후 1순위 `collect_concurrent` 리팩터링을 SPEC부터 진행하기로 결정(2026-10-30)
- 관련 문서: [SPEC-085](spec_085.md)(병행 수집 동작 정의), [음식점 수집 안내](kakao_restaurant_collection.md)
- 관련 코드: `scripts/collect_kakao_jeju_restaurant_reviews.py`, `scripts/test_kakao_restaurant_collector.py`
- 선행 SPEC: SPEC-085, SPEC-113(동작 보존 리팩토링 원칙·단일 실행기)

## 배경

사실(2026-10-30 AST 측정): `scripts/collect_kakao_jeju_restaurant_reviews.py`의 `collect_concurrent`는 165줄, 분기 점수 71, 중첩 깊이 8로 저장소 Python 함수 중 가장 복잡하다.

- 실행 흐름(lane)을 타입 없는 dict(`kind`, `pool`, `worker`, `future`, `row`, `attempted`, `failures`, `completed`, `ready`)로 다루고, 한 루프 안에서 `if kind == 'search'` 분기가 6번 반복된다.
- 하나의 `while` 루프가 STOP 확인, 저장 이벤트 처리, 완료 작업 수거, 진행 내보내기, 다음 작업 배정, 종료 정리를 모두 맡는다. `fatal`·`completed`·`stopped`를 여러 단계가 함께 바꾼다.
- 검색어 상태 갱신 SQL(`running`·`failed`·`pending` 복귀), 상세 실패 SQL, 다음 검색어 조회 SQL, 하위 업종 검색 추가가 `Store` 밖에 있고 순차 경로(`build_inventory`, `collect_details`)에 같은 SQL이 한 벌 더 있다.

## 목표

- `--concurrent` 수집과 순차 수집의 외부 동작을 바꾸지 않고, 병행 루프를 단계별 메서드와 검색·상세 lane 클래스로 나눠 읽고 고치기 쉽게 한다.
- 검색어·상세 상태 갱신 SQL을 `Store` 한 곳으로 모아 두 실행 경로가 같은 메서드를 쓰게 한다.

## 비목표

- 수집 순서, 대기 시간, 실패 한도, STOP·접근 제한 처리, CSV·manifest 형식, SQLite 스키마 변경.
- `scripts/kakao_restaurant_review_crawler.py`(브라우저·파서)와 원본 수집기(`kakao_review_crawler.py`, `collect_kakao_jeju_tourism_reviews.py`) 수정.
- 실제 Kakao 접속 검증(오프라인 회귀만 수행).
- 아래 "보존하는 기존 동작"의 동작 수정.

## 요구사항

- `REQ-001` `collect_concurrent(store, args)`는 같은 이름·인자로 남고, 내부를 단계 메서드(STOP 확인, 저장 이벤트 처리, 완료 수거, 진행 내보내기, 작업 배정, 종료 정리)를 가진 실행 객체로 옮긴다.
- `REQ-002` lane은 공통 `Lane`과 `SearchLane`·`DetailLane`으로 표현하고, 검색·상세별 차이(다음 행 선택, 시작 처리, 성공·중단·실패 기록, 기본 대기)는 각 클래스 메서드에 둔다. 실행 루프는 `kind` 문자열로 분기하지 않는다.
- `REQ-003` 검색어 `running` 표시, `failed` 기록, `pending` 복귀, 다음 대기 검색어 조회, 하위 업종 검색 추가, 상세 `failed` 기록은 `Store` 메서드로 옮기고 순차 경로도 이를 쓴다. SQL 문장과 파라미터는 기존과 같다.
- `REQ-004` 동작 보존: 기존 회귀 19개와 이번에 추가하는 병행 경로 고정 테스트가 리팩터링 전후 모두 통과한다.
- `REQ-005` 병행 경로에서 기존 테스트가 다루지 않던 동작(연속 실패 한도 중단, `truncated` 검색의 하위 업종 추가, 저장 실패 시 오류 전파)을 리팩터링 **전** 코드로 먼저 고정한다.

## 입력과 출력

변경 없음. CLI 인자, `collection.sqlite3` 스키마·상태 값, CSV·`manifest.json` 필드, 콘솔 진행 로그 문구를 유지한다.

- 예외: `manifest.json`의 `source_code` 해시는 수집기 파일 해시를 기록하는 필드이므로 다음 실행부터 새 파일 해시가 기록된다(의도된 추적 정보 변화, 계약 변경 아님).

## 설계

- `Store`에 `next_pending_query(exclude)`, `mark_query_running(query)`, `mark_query_failed(query, exc)`, `reset_query_pending(query)`, `add_refinements(region, term)`, `mark_detail_failed(place_id, exc)`를 추가한다.
- `Lane`: executor 1개·`BrowserWorker` 1개·시도 집합·현재 future/row·연속 실패·완료 수·다음 시작 가능 시각을 가진다. `start(row)`, `schedule_next()`, `close()`를 공통으로 제공한다.
  - `SearchLane`: lane별 시도 집합, `--max-queries` 한도, 시작 시 `running` 표시와 `[검색]` 로그, 성공 시 `finish_query`·하위 업종 추가, 중단 시 `pending` 복귀.
  - `DetailLane`: 상세 lane끼리 시도 집합과 대기열을 공유하고, `--max-places`(합산) 한도와 `--place-id` 필터를 적용한다.
- `ConcurrentRun`: 루프 한 번 = `_check_stop_file` → `_drain_events` → `_reap_finished` → `_export_progress` → (치명 오류가 있으면 실행 중 작업이 끝난 뒤 그 오류를 다시 던짐 / 없으면 `_dispatch_idle_lanes`, 실행·대기 작업이 없으면 종료) → 0.1초 대기. `finally`에서 `_shutdown`.

### 보존하는 기존 동작

리팩터링 중 발견했지만 동작 보존 원칙에 따라 바꾸지 않는다. 바꾸려면 별도 SPEC이 필요하다.

- 저장 이벤트 처리 실패는 이미 기록된 치명 오류를 덮어쓴다. 다른 경로(STOP, 작업 중단, 실패 한도)는 처음 기록된 치명 오류를 유지한다.
- 실패 한도 초과 시 던지는 `RuntimeError`는 원인 예외를 `__cause__`로 연결하지 않는다(순차 경로는 연결한다).

## 예외와 폴백

기존 SPEC-085 동작을 그대로 따른다. 이 SPEC은 새 폴백을 추가하지 않는다.

## 영향 범위

- 변경 예정 파일: `scripts/collect_kakao_jeju_restaurant_reviews.py`, `scripts/test_kakao_restaurant_collector.py`, `docs/spec_115.md`, `docs/README.md`
- 데이터 마이그레이션: 없음
- 호환성 영향: 없음. `collect_concurrent`, `Store`, `BrowserWorker`, `parse_args`와 테스트가 patch하는 모듈 전역(`build_driver`, `collect_query`, `collect_detail`) 이름을 유지한다.
- 보안·개인정보 영향: 없음

## 승인 기준

- `AC-001` 리팩터링 전 코드에서 기존 19개 + 추가 고정 테스트가 모두 통과한다.
- `AC-002` 리팩터링 후 같은 테스트가 수정 없이 모두 통과한다.
- `AC-003` `collect_concurrent` 실행 루프 본문에 `kind == 'search'` 분기가 없고, 실행 객체의 각 메서드는 40줄 이하다.
- `AC-004` 검색어·상세 상태 갱신 SQL이 `Store` 밖(병행·순차 경로)에 남아 있지 않다.
- `AC-005` 저장소 단일 회귀 실행기가 리팩터링 전과 같은 결과(실패 0)를 낸다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001 | 추가 테스트를 리팩터링 전 코드에 실행 | `python -X utf8 scripts/test_kakao_restaurant_collector.py` |
| AC-002 | 리팩터링 후 같은 테스트 실행, 문법 검사 | `python -X utf8 scripts/test_kakao_restaurant_collector.py`, `python -m py_compile scripts/collect_kakao_jeju_restaurant_reviews.py` |
| AC-003 | 코드 확인, 함수 길이 측정 | `scripts/collect_kakao_jeju_restaurant_reviews.py` |
| AC-004 | SQL 위치 검색 | `git grep -n "UPDATE queries\|UPDATE places SET detail_status='failed'" scripts/collect_kakao_jeju_restaurant_reviews.py` |
| AC-005 | 전체 회귀 | `python -X utf8 scripts/run_tests.py` |

## 구현 결과

- `scripts/collect_kakao_jeju_restaurant_reviews.py`
  - `Store`에 `next_pending_query`, `mark_query_running`, `mark_query_failed`, `reset_query_pending`, `add_refinements`, `mark_detail_failed`를 추가했다. 순차 경로(`build_inventory`, `collect_details`)와 병행 경로가 같은 메서드를 쓴다(`REQ-003`).
  - `Lane`·`SearchLane`·`DetailLane`과 `ConcurrentRun`을 추가했다. `collect_concurrent`는 `ConcurrentRun(store, args).run()`만 호출하는 3줄 함수다(`REQ-001`, `REQ-002`).
  - 측정(같은 AST 방식): 기존 `collect_concurrent` 165줄·분기 점수 71·중첩 8 → 새 메서드 최대 21줄(`_reap_finished`), 이 파일 함수는 저장소 복잡도 상위 25위 밖이다.
- `scripts/test_kakao_restaurant_collector.py`: 병행 경로 고정 테스트 3개 추가(`REQ-005`) — 연속 검색 실패 한도 중단과 `__cause__` 없음, `truncated` 검색의 하위 업종 15개 추가, 페이지 저장 실패의 오류 전파와 검색어 `failed` 기록.

### 검증 결과(Windows, Python 3.10.4, 2026-10-30)

- `AC-001`: 추가 테스트를 리팩터링 전 코드에 먼저 실행 → 22개 통과.
- `AC-002`: 리팩터링 후 `python -X utf8 scripts/test_kakao_restaurant_collector.py` 3회 연속 22개 통과. 테스트 중 출력된 검색·상세 진행 로그 21줄이 리팩터링 전과 정렬 비교로 동일. `python -m py_compile` 통과, `git diff --check` 통과.
- `AC-003`: 실행 객체 메서드 최대 21줄. 남은 `kind == 'search'` 1건은 변경하지 않은 `BrowserWorker.run`의 브라우저 호출 선택이며 실행 루프에는 없다.
- `AC-004`: `Store` 밖 최상위 정의에서 `UPDATE queries`, `detail_status='failed'`, 대기 검색어 조회 SQL 0건(AST 구간 검색).
- `AC-005`: `python -X utf8 scripts/run_tests.py` 결과가 리팩터링 전 코드(작업 파일 2개를 `HEAD`로 임시 복원해 실행)와 같다 — 14 통과, 1 SKIP, 8 실패. 8개 실패는 이번 변경과 무관한 기존 환경 문제다: Python 3.10에 없는 `hashlib.file_digest`(음식점 카탈로그·좌표·조회 DB 3종), Node `playwright` 미설치(브라우저 3종), Python 골든 HTTP 헤더·본문 해시 3곳, `server/travel-feedback` 일정 생성 테스트 1건과 같은 `file_digest` 오류.

## 설계와 달라진 점

- 없음. 설계대로 구현했다. 순차 경로의 `add_refinements` 호출은 기존 `row['term'] in REFINEMENTS` 확인을 메서드 안으로 옮긴 것이며, 병행 경로의 기존 `REFINEMENTS.get(term, [])` 빈 트랜잭션은 열지 않게 됐다(DB 결과 동일).

## 알려진 제한

- 실제 Kakao 접속 병행 수집은 다시 실행하지 않았다. 오프라인 회귀는 브라우저·수집 함수를 모의 객체로 바꿔 실행한다.
- "보존하는 기존 동작" 두 가지(저장 실패가 치명 오류를 덮어씀, 병행 실패 한도 오류의 원인 미연결)는 그대로다. 고치려면 별도 SPEC이 필요하다.
- 저장소 전체 회귀의 기존 실패 8건은 이 SPEC 범위 밖이다(Python 3.11 이상·Node `playwright` 환경에서 재확인 필요).

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-30 | 초안 작성, 구현 시작 |
| 2026-10-30 | 구현·검증 완료, Implemented |
