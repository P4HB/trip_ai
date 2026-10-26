# SPEC-113: 동작 보존 구조 리팩토링

- 상태: In Progress
- 작성일: 2026-10-26
- 최종 수정일: 2026-10-26
- 관련 이슈: 사용자 요청 "스파게티 코드 리팩토링"(단계별 전체 진행, SDD 절차 준수 결정)
- 관련 문서: [아키텍처](architecture.md), [데이터 계약](data_contracts.md), [CCU-MMR](ccu_mmr_algorithm_draft.md), [평가](evaluation.md)
- 관련 코드: `map-ui/`, `server/travel-feedback/`, `server/instagram-import/`, `scripts/`, `review-ui/`, 저장소 루트 설정
- 선행 SPEC: SPEC-110, SPEC-111, SPEC-112

## 배경

SPEC-111에서 3,217줄 `map-ui/app.js`를 모듈로 나눴지만 다음 구조 문제가 남아 있다(2026-10-26 조사).

- `map-ui/app.js`(1,340줄)가 조립 외에 상세 패널·추천 카드·일정·드로어·전체 이벤트 바인딩(`bindEvents` 200줄)을 갖고, 모듈 간 순환 의존을 지연 함수로 숨긴다. 7개 모듈이 같은 `state` 키를 쓴다.
- `scripts/validate_ccu_mmr_dashboard.cjs`가 소스 문자열을 정규식으로 고정(함수 인접 순서·들여쓰기·`fetch(` 개수)하고, 두 Playwright 테스트가 `app.js` 본문을 문자열 치환해 fixture를 주입한다. 동작이 같아도 코드 이동만으로 테스트가 깨진다.
- `ccu-mmr.js`의 `rank`(175줄)·`buildSchedule`(170줄), 서버의 `validate_day`(193줄)·`ItineraryService.generate`(157줄)·`validate_request`(126줄)가 여러 책임을 한 함수에 담는다.
- 어휘(동행자·의도·이벤트 유형 `"15"`), 날짜·시간(KST, HH:MM), 거리(지구 반지름 6371 vs 6371.0088), 해시, JSON/JSONL 입출력, HTTP JSON 응답 헬퍼가 여러 파일에 복제돼 있다.
- `feedback_api.py`는 if/elif 라우팅이며 요청 본문 파싱이 두 벌이고 검사 항목이 서로 다르다. 환경 변수 이름·기본값이 4개 모듈과 실행기·배포 스크립트에 흩어져 있다(`run_trip_ai_local.py`가 `GEMINI_FALLBACK_MODEL`을 미등록 이름으로 경고).
- `scripts/` 95개 중 27개가 참조 없는 일회성 스크립트이고, 공용 데이터 레이어(`scripts/lib/data_io.mjs`, `config/active_datasets.json`)는 2개 스크립트만 쓴다.
- `travel-mbti-site`는 `.gitmodules` 없는 gitlink이고 폐기된 지도 복사본을 담는다. `review-ui`의 v1 파일과 `validate_review_ui_data.mjs`(없는 모듈 import)는 실행되지 않는다.

## 목표

- 사용자 동작·추천 결과·API 응답·데이터 산출물을 바꾸지 않고 책임 경계를 정리해 이후 기능 변경 비용을 낮춘다.
- 소스 형태가 아니라 동작을 검증하는 테스트로 안전망을 바꾼다.
- 중복 헬퍼와 설정을 단일 출처로 모은다.

## 비목표

- 추천 점수·가중치·알고리즘 버전 변경, UI 시각 디자인 변경, CSS 색상 토큰화(시각 회귀 도구 도입 후 별도 SPEC).
- 데이터 재수집·라벨 재생성, 해시가 데이터 manifest에 고정된 `scripts/build_all_place_profiles.py`, `scripts/classify_place_types.py`와 동결 라벨 계보 스크립트의 내부 수정.
- 외부 LLM·경로 API 실제 호출, 운영 배포, Git 이력 재작성(피드백 파일 이력 삭제는 사용자 결정 사항).
- 프레임워크·번들러 도입.

## 요구사항

단계 순서대로 진행하며 각 단계는 전체 회귀가 통과한 상태로 끝낸다.

- `REQ-001` 안전망: 소스 정규식·함수 인접 검사를 DOM 계약·동작 검사로 바꾼다. Playwright fixture 주입은 페이지 로드 전에 설정하는 명시적 테스트 훅으로 바꾸며 훅은 테스트 플래그가 없으면 노출되지 않는다.
- `REQ-002` 골든 비교: CCU-MMR 순위·일정, 일정 검증, 피드백 검증의 결정적 시나리오 출력을 리팩토링 전 기준으로 저장하고 매 단계 동일함을 확인한다.
- `REQ-003` 단일 실행기: 저장소 루트에서 한 명령으로 모든 Python·Node·브라우저 회귀를 실행한다.
- `REQ-004` 저위험 정리: 참조 없는 일회성 스크립트를 `scripts/archive/`로 옮기고 SPEC 링크를 갱신한다. 실행 불가 파일(`review-ui` v1, 깨진 검증기)과 `travel-mbti-site` gitlink를 정리한다. 활성 라벨을 덮어쓰는 스크립트는 명시적 플래그 없이는 쓰지 않게 한다. 실행기의 LLM 환경 변수 목록 누락을 고친다.
- `REQ-005` 프론트 공통 도메인: 어휘·이벤트 유형·날짜·문자열 정규화·장소 enrich를 `domain.js`(또는 UMD 공용 모듈) 하나에서 제공하고 앱·테스트가 이를 사용한다.
- `REQ-006` 프론트 분해: `app.js`는 조립과 전역 단축키·리사이즈만 맡는다. 상세 패널, 추천 결과·일정 화면, 추천 실행 제어, 레이아웃(드로어·사이드바)을 별도 모듈로 옮기고 각 모듈이 자기 DOM 이벤트를 바인딩한다. 순환 의존은 명시적 콜백 또는 이벤트로 끊는다.
- `REQ-007` 랭커 분해: `rank`·`buildSchedule`을 필터·점수·변형·seed·일정·경고 단계 함수로 나누고 공개 API(`rank`, `normalizeRequest`, `CONFIG` 등)를 유지한다.
- `REQ-008` 서버 공통화: 시간·거리·원자적 JSON 쓰기·HTTP JSON 응답/본문 읽기를 공용 모듈로 모으고 라우트 테이블로 바꾼다. 환경 변수는 설정 객체 하나에서 읽는다. 테스트가 patch하는 모듈 전역 이름은 유지한다.
- `REQ-009` 서버 분해: `validate_day`, `ItineraryService.generate`, `validate_request`, 피드백 v2/v3 검증기의 공통 부분을 책임별 함수로 나눈다.
- `REQ-010` 스크립트 공용 계층: Python·Node 공용 I/O(JSONL·해시·원자적 쓰기·활성 데이터셋 manifest)를 두고 활성 수집·빌드·검증 스크립트를 옮긴다. 동결 계보와 해시 고정 파일은 제외한다.
- `REQ-011` 문서: 구조가 바뀐 경로를 기준 문서·README·색인에 반영한다.

## 입력과 출력

입력·출력 계약은 바꾸지 않는다. 장소 ID, 좌표 순서(lng, lat), 추천 결과 JSON, 평가 v2/v3 스키마, 일정 API 요청·응답, 인스타 작업 JSON, 생성 데이터 바이트를 유지한다.

## 설계

- 단계: 안전망(REQ-001~003) → 정리(REQ-004) → 프론트(REQ-005~007) → 서버(REQ-008~009) → 스크립트(REQ-010) → 문서(REQ-011).
- 테스트 훅: 테스트가 `page.addInitScript`로 테스트 플래그를 켠 경우에만 `app.js`가 내부 함수 묶음을 노출한다. 운영 경로의 동작과 네트워크 호출 수는 같다.
- 골든 출력은 `scripts/fixtures/golden/`에 JSON으로 저장하고 비교 스크립트가 차이를 보고한다.
- 각 단계는 별도 커밋으로 남긴다.

## 예외와 폴백

골든 비교에서 차이가 나면 해당 단계를 되돌리거나 원인을 SPEC에 기록하고 사용자 확인 전까지 진행하지 않는다. 테스트가 patch하는 이름이 이동해야 하면 기존 위치에 재노출한다.

## 영향 범위

- 변경 예정 파일: 위 관련 코드 경로, `scripts/test_*`, `scripts/validate_ccu_mmr_dashboard.cjs`, `server/travel-feedback/Dockerfile`(새 모듈 복사), 문서.
- 데이터 마이그레이션: 없음.
- 호환성 영향: 외부 계약 없음. 내부 파일 경로가 바뀌는 스크립트는 문서에 기록한다.
- 보안·개인정보 영향: 비밀 파일을 읽지 않는다. 피드백 원본 파일은 내용을 열람하지 않고 경로만 다룬다.

## 승인 기준

- `AC-001`: 각 단계 종료 시 단일 실행기의 모든 회귀가 통과한다.
- `AC-002`: 각 단계 종료 시 골든 출력이 리팩토링 전 기준과 바이트 단위로 같다.
- `AC-003`: 테스트가 소스 텍스트의 함수 순서·들여쓰기에 의존하지 않는다.
- `AC-004`: `map-ui/app.js`가 조립·전역 입력만 담당하고 모듈 간 순환 의존이 없다.
- `AC-005`: 제거·이동한 파일에 대한 현재 문서의 깨진 상대 링크가 0건이다.
- `AC-006`: 서버 HTTP 동작(상태 코드·응답 본문)이 기존 테스트와 추가 골든 요청에서 같다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001 | 전체 회귀 | `python -X utf8 scripts/run_tests.py` |
| AC-002 | 골든 비교 | `node scripts/check_golden_outputs.cjs`, `python -X utf8 scripts/check_golden_outputs.py` |
| AC-003 | 정적 계약과 브라우저 동작 검사 분리 | `scripts/validate_ccu_mmr_dashboard.cjs`(JS·CSS 소스 형태 미검사), `node scripts/test_dashboard_behavior.cjs` |
| AC-004 | 의존 그래프 검사 | 모듈 생성 인자 검토 |
| AC-005 | 링크 검사 | Markdown 상대 링크 검사 스크립트 |
| AC-006 | 서버 단위·골든 | `python -m unittest discover -s server/travel-feedback` |

## 구현 결과

진행 중. 단계별 결과를 아래에 추가한다.

### 단계 0 (사전 정리, 2026-10-26)

- 로컬 미푸시 커밋을 `origin/main`(`8fbab8e`) 위로 재적용하고 SPEC 번호 충돌을 SPEC-111·112로 해소했다. 기준선 회귀 전체 통과: 서버 168, 인스타 16+15, Node·브라우저 9종.
- Windows(Python 3.14, Node 24, Python Playwright 1.59 드라이버)에서도 같은 기준선 12종이 통과했다.

### 1단계 안전망 (REQ-001~003, 2026-10-26)

- `REQ-002` 골든 출력(리팩토링 전 코드로 먼저 기록):
  - `scripts/check_golden_outputs.cjs` → `scripts/fixtures/golden/js_outputs.json`. 실제 2,153곳 번들을 `app.js`와 같은 방식으로 보강한 결과, 4 intent × 6 동행(이동수단·기간·선호는 동행 순번으로 교차) × seed variant 3개 = 72개와 필수·필수+anchor·anchor·제외·hard constraint·결과 1/20개·기간만 2/3일·권역 2개·7일 여행·다양성 off·가중 seed 3개·오류 입력 7개를 합친 123개 `rank` 결과, `selectNextCourseVariant`·`courseOverlapTrace`, 여행 MBTI 답안 4세트의 `estimateProfile`→적응형 `nextAdaptivePair`→`materializePreferences`·`publicShareText`, `itinerary.js`의 `buildRequest`(정상·오류 10종)·`eligibility`·`travelerContext`·`foodContext`·`verdictLabel`·`partitionCandidates`·`selectedMealRoutes`를 저장한다.
  - `scripts/check_golden_outputs.py` → `scripts/fixtures/golden/py_outputs.json`. `evaluate_restaurant_candidates.py`와 같은 오프라인 구성(실제 일정 카탈로그·식당 sidecar, `EstimatedRouteProvider`, `FakeScheduler`)으로 7개 시나리오 × 4개 날짜 × 우회 20/10/5분 = 84개 `generate` 결과, 잘못된 일정 요청 21종의 오류, 피드백 v2/v3 payload 30종의 검증 결과를 저장한다. `itinerary_validation.fresh`의 기준 시각과 경로 `queriedAt`(생성자 `now`)을 `2026-10-19T09:00+09:00`으로 고정했다.
  - 두 스크립트를 새 프로세스로 반복 실행해 같은 결과를 확인했다. 랭커 반경 15→16km, 식당 후보 수 5→4로 일부러 바꾸면 각각 40개 이상 경로의 차이를 보고하고, 되돌리면 다시 통과했다.
- `REQ-001` 안전망 교체:
  - `map-ui/app.js`는 `window.__TRIP_AI_TEST__ === true`일 때만 `window.__TRIP_AI_INTERNALS__`(동결 객체: `algorithm`, `places`, `placeById`, `dom`, `state`와 fixture가 쓰는 함수 11개)를 노출한다. 운영 경로의 동작과 네트워크 호출은 같다.
  - `test_feedback_completion.cjs`, `test_itinerary_ui.cjs`는 `page.addInitScript`로 플래그를 켜고 로드 후 `page.evaluate(installFixture)`로 fixture를 설치한다. `app.js` 문자열 치환은 저장소에서 사라졌다.
  - `validate_ccu_mmr_dashboard.cjs`(374→248줄)는 HTML DOM 계약(id·마법사 1~5단계·choice target·필수 그룹), 스크립트 로드 순서(모든 1차 모듈 로드·`defer`·`domain.js` 선행·`app.js` 마지막·파일 존재), 모든 1차 모듈의 금지 API(localStorage·sessionStorage·sendBeacon·XMLHttpRequest)와 엔진 3개의 `fetch` 미사용, 데이터 수치, 랭커 결과만 검사한다. JS·CSS 소스 정규식(함수 인접 순서·들여쓰기·`fetch(` 개수 포함)은 제거했다.
  - 새 `scripts/test_dashboard_behavior.cjs`(Playwright)가 제거한 검사를 실제 동작으로 대신한다: 플래그 없는 페이지의 내부 미노출과 자동 추천 없음, 대시보드 검사 API 16개, 단계 검증과 오류 문구·포커스, 기간↔정확한 날짜 상호 배제, 축제 의도의 날짜 요구와 최종 제출 재검증, 여행 MBTI 4방향 응답·적용 후 미실행·요청 선호가 프로필에서만 나옴, CTA 문구 3상태, 추천 카드 내부 trace 미표시·상세 버튼·5점 평가·의견 300자, 일정 카드 비버튼 컨테이너, 같은 장소 점수·의견 동기화, 이름 없는 첫 전송 보류, 자동 저장 payload(v3·storage·session·revision 증가)·점수 즉시/의견 디바운스·쿠키 미전송, 데스크톱 카드→지도 상세, 상세의 내부 라벨 미표시·리뷰 표시·리뷰 스키마 거부, 이미지 사전 로드·4:3·`contain`·확대 대화상자 포커스 복귀·저해상도 표시·늦은 이미지 무시, 입력 변경 시 결과·평가 초기화, 사이드바 접기·Leaflet 크기 갱신·1,240px 경계 해제, 모바일 5단계 동시 노출·입력/결과/지도 순서·빈 결과 패널 숨김·필수 6개 오류 표시·미선택 문구, 모바일 상세 평가 안내 3상태·터치 크기·16px 입력, 모바일 평가 대화상자의 이미지·조사·리뷰·닫을 때 리뷰 요청 중단, 그리고 전체 흐름의 fetch/XHR이 피드백 POST와 리뷰 GET(`?limit=5&offset=0`)뿐이고 Web Storage가 비어 있음.
  - 일부러 동작을 바꾼 11개 변형(훅 항상 노출, MBTI 적용 시 추천 실행, 피드백 credentials, 의견 디바운스 제거, 카드에 내부 trace, 리뷰 스키마 검사 제거, 축제 날짜 검사 제거, 모바일 CSS order, 저해상도 표시 제거, 늦은 이미지 보호 제거, Leaflet 크기 갱신 제거)이 모두 이름 있는 assertion으로 실패하고 원복 후 통과했다.
- `REQ-003` 단일 실행기 `scripts/run_tests.py`: Python 8종(서버 unittest, 인스타 2, 식당 수집·카탈로그·좌표·조회 DB, 장소 유형), Node 8종, 골든 2종, 브라우저 3종을 순서대로 실행하고 실패 출력 끝부분을 요약한다. `-k`(이름 필터)·`--list`·`-v`를 지원한다. 실행 전후 `git status`를 비교해 `tmp/` 밖에 파일을 남기면 실패한다. Node `playwright`가 없으면 설치된 Python Playwright 드라이버를 `tmp/test-runtime` shim으로 재사용한다.
  - 확인 중 `test_itinerary_ui.cjs`의 스크린샷 기본 경로가 `/tmp/...`(Windows에서는 `C:\tmp`)인 것을 발견해 `tmp/test-artifacts/itinerary-ui/`로 바꿨다(기존 환경변수 덮어쓰기 유지).
- 검증(Windows, 2026-10-26): `python -X utf8 scripts/run_tests.py` → 19 통과, 2 SKIP(아래 알려진 제한), 0 실패, 약 67초. 서버 168, 인스타 16+15, 골든 JS 123 시나리오·Python 84+21+30 일치, 브라우저 3종 통과. 동작 테스트는 연속 3회 통과했다.

## 설계와 달라진 점

- 골든 해시는 키를 정렬한 JSON으로 계산한다. 리팩토링이 객체 속성 생성 순서만 바꾸는 경우를 차이로 보지 않기 위해서이며, 배열 순서와 숫자 값은 그대로 비교한다. AC-002의 "바이트 단위로 같다"는 이 정규화 출력과 골든 파일 내용 기준이다. 파일 비교는 Windows `core.autocrlf` 체크아웃의 줄바꿈 차이를 피하려고 파싱한 JSON끼리 한다.
- JS·CSS 소스 검사를 Playwright로 옮기면서 정적 검증기에 넣지 않고 별도 `test_dashboard_behavior.cjs`로 분리했다. 정적 검증기는 브라우저 없이 빠르게 돌고, 동작 검사는 실행기의 브라우저 단계에 둔다.
- `fetch(` 정확히 2회 검사는 "실제 흐름의 fetch/XHR이 허용된 두 엔드포인트뿐"이라는 네트워크 검사와 "엔진 3개는 `fetch`를 쓰지 않는다"는 금지 API 검사로 바꿨다. 금지 API 검사 범위는 7개 파일에서 `map-ui/`의 모든 1차 모듈로 넓혔다.
- 실행 환경이 고정 산출물 바이트를 재현할 수 없는 두 테스트는 실패 대신 사유와 함께 SKIP한다(통과로 세지 않는다). 조건이 맞는 체크아웃에서는 그대로 실행한다.
- 정적 검증기의 장소 보강 코드는 `app.js`와 다른 기존 구현을 그대로 두었다. 단일화는 REQ-005 범위다. 골든 스크립트는 기준선 `app.js` 보강을 복사해 `enrichedPlaces` 해시로 고정했다.

## 알려진 제한

- 피드백 파일(`travel-feedback-anonymized-since-0903 copy.json`)의 Git 이력 삭제 여부는 사용자 결정이 필요하다.
- 이 Windows 환경에서는 `test_place_types.py`(고정 SQLite가 3.37.2로 기록됨, 이 Python은 3.50.4)와 `test_labeling_review_model.mjs`(고정 해시 대상 JSON이 CRLF로 체크아웃됨)가 SKIP된다. 기준선 커밋에서도 같은 이유로 실패하는 사전 문제이며 이번 변경과 무관하다. 고정 데이터에 `eol=lf` 속성을 주는 정리는 별도 결정이 필요하다.
- 데스크톱 사이드바를 접으면 Leaflet의 마지막 `invalidateSize`(240ms)가 grid 전환 종료 직전에 실행돼 지도 크기가 컨테이너보다 약 2px 작게 남을 수 있다. 기존 동작이며 동작 보존 범위라 고치지 않았고, 테스트는 지도 폭이 커지고 컨테이너와 4px 이내인지만 확인한다.
- 골든 입력(지도 번들·일정 카탈로그·식당 sidecar·정책 버전)이 바뀌면 골든 비교가 실패한다. 데이터 재생성은 리팩토링이 아니므로 별도 SPEC에서 골든을 갱신한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-26 | 조사 결과를 바탕으로 초안 작성, 사용자 승인 범위(단계별 전체)로 In Progress |
| 2026-10-26 | 1단계 안전망(REQ-001~003) 구현: 골든 출력 2종, 테스트 플래그 훅, 정적 계약/브라우저 동작 검사 분리, 단일 실행기. 테스트 계획 명령 갱신 |
