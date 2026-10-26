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
- 프론트 모듈 구조(REQ-005~006 결정, 2026-10-26):
  - `domain.js`: 어휘(동행·의도·지역·이벤트 유형 `"15"`), 검색 정규화, 점 날짜 형식, 장소 보강 `enrichPlace`. 앱·정적 검증기·하루 유형 테스트·골든 스크립트가 공유한다.
  - `events.js`(`TRAVEL_EVENTS`): 아래 모듈이 위 모듈을 참조하지 않고 알리는 이름 있는 동기 이벤트. `conditions-changed`(추천 무효화), `rerun-requested`(추천 재실행), `feedback-completed`(평가 완료 후 화면별 후속 동작), `selection-changed`(지도 마커·목록 갱신과 지도 이동).
  - `view-helpers.js`: 카테고리·숫자·날짜·지역 표시, `debounce`, 빈 상태. `layout.js`: 모바일 판정, 로딩 표시, 사이드바·결과 서랍, 데스크톱 접기.
  - `detail-view.js`: 장소 선택·상세·이미지 대화상자·모바일 평가 대화상자. `results-view.js`: 추천 카드·검증 후보·일정·코스 표시와 `renderRecommendationOutput`. `recommendation-controller.js`: 코스 세션, `runRecommendation`·`rerollRecommendation`·`clearRecommendation`, 폼 제출·입력 변경·초기화.
  - 생성 순서는 helpers·state → layout → place-detail → feedback → itinerary-view → wizard → preference-view → detail-view → map-view → results-view → controller이며, 각 모듈은 앞에서 만든 모듈의 함수만 인자로 받는다. 뒤 모듈로 향하는 호출은 위 이벤트로 바꾼다. 각 모듈은 `bindEvents()`로 자기 DOM 이벤트를 연결하고, `app.js`는 조립·테스트 훅·전역 단축키(Escape)·리사이즈만 맡는다.
  - 같은 요소·같은 이벤트 유형의 리스너 등록 순서와 직접 호출 순서는 기존과 같게 유지한다. `dispatchEvent`는 동기이므로 이벤트로 바꾼 호출도 같은 시점에 실행된다.

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
| AC-005 | 링크 검사 | `python -X utf8 scripts/check_markdown_links.py` |
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
- 검증(Windows, 2026-10-26): `python -X utf8 scripts/run_tests.py` → 19 통과, 2 SKIP(아래 알려진 제한, 5단계에서 장소 유형 테스트를 XFAIL로 정정), 0 실패, 약 67초. 서버 168, 인스타 16+15, 골든 JS 123 시나리오·Python 84+21+30 일치, 브라우저 3종 통과. 동작 테스트는 연속 3회 통과했다.

### 2단계 저위험 정리 (REQ-004, 2026-10-26)

- 로컬 실행기: `scripts/run_trip_ai_local.py`의 `KNOWN_LLM_NAMES`에 `GEMINI_FALLBACK_MODEL`을 추가했다. 서버 모듈이 읽는 LLM 관련 환경변수 이름이 모두 실행기 목록에 있는지 소스에서 추출해 확인하는 테스트(`test_runner_recognizes_every_llm_setting_the_server_reads`)를 추가했다. 수정 전 코드에서는 이 테스트가 실패한다.
- 활성 라벨 보호: `merge_relative_five_level_companion.py`는 `--promote` 없이는 검토용 `relative_five_level_*` 파일만 쓰고, `recalibrate_companion_labels.py`는 `--promote` 없이는 아무것도 쓰지 않고 종료 코드 2로 끝난다. 라벨 계산은 바꾸지 않았다. 두 기존 스크립트(`merge_direct_place_fit_labels.py`, `merge_calibrated_companion_labels.py`)는 이미 `--promote`가 필요하다. 플래그 없는 실행에서 활성 `place_fit_labels.jsonl`·`manifest.json`·`coverage_report.json`의 바이트가 그대로이고 검토용 출력이 현재 활성 라벨과 같음(LF 기준)을 확인한 뒤 갱신된 sidecar를 되돌렸다. `data/labeling/jeju/README.md`는 이전 세대로 되돌리는 `merge_direct_place_fit_labels.py --promote` 대신 현재 세대(`place-fit-relabel-v2-relative-five-level-companion`)의 재적용·검증 명령과 이전 세대 `--promote` 경고를 안내한다. `validate_place_fit_relabel_v2.py` 통과.
- 실행 불가 파일 삭제: 생성·검증 스크립트가 이미 없어 재생성할 수 없고 어떤 페이지도 불러오지 않는 `review-ui/review-model.js`, `review-ui/styles.css`, `review-ui/data/review-data.js`, `review-ui/data/ai-review-proposals.js`와 없는 `scripts/lib/review_ui_data.mjs`를 import하는 `scripts/validate_review_ui_data.mjs`를 삭제하고 `review-ui/README.md`의 v1 안내를 삭제 기록으로 바꿨다. `labeling-review`는 자체 `src/review-model.js`를 쓰므로 영향이 없다.
- `travel-mbti-site`: `.gitmodules` 없는 gitlink(`a2c640f`)를 인덱스에서 제거하고 `.gitignore`에 추가했다. 로컬 디렉터리(자체 Git 저장소)는 그대로 둔다. 현재 문서의 참조는 과거 SPEC 기록뿐이다.
- 테스터 피드백: `travel-feedback-anonymized-since-0903 copy.json`을 추적 해제(`git rm --cached`)하고 `/travel-feedback-anonymized*.json`을 무시한다. `scripts/build_feedback_report.mjs`는 `--input <경로>`를 받고 기본값은 기존 루트 경로이며, 입력이 없으면 사용법과 함께 종료 코드 1로 끝난다. 파일 내용은 열람하지 않았고 프로그램의 `--check` 집계(9명·10세션·133평가·60의견)가 SPEC-070 기록과 같음만 확인했다. Git 이력 삭제는 하지 않았다.
- 일회성 스크립트 27개를 `git mv`로 `scripts/archive/`에 옮겼다(참조 0인 15개와 Implemented SPEC-034·042·043·046·048~055에서만 언급된 12개). 데이터 manifest에 해시가 고정된 스크립트는 없음을 확인했다. `Path(__file__).resolve().parents[1]`로 루트를 찾던 18개는 `parents[2]`로만 바꿨다. 과거 SPEC 12개의 경로를 `scripts/archive/...`로 갱신했고, SPEC에 기록된 재현 명령 3개(`review_calibrated_batch_12.py --check`, `generate_reviewed_calibrated_batch_07.py --check`, `review_calibrated_batch_13.py --check`)는 이동 전후 출력이 같다. `scripts/archive/README.md`에 보관 규칙을 적었다.
- 1단계 동작 테스트 보강: 2단계 전체 실행에서 사이드바 접기 뒤 Leaflet 폭이 컨테이너보다 5px 작아 4px 허용치를 넘는 간헐 실패가 났다(앱의 240ms `invalidateSize`와 grid 전환 종료 사이 경합, 알려진 제한 참조). 검사를 "300px 넘게 커지고 컨테이너의 90% 이상"으로 바꿨다. 같은 이유로 자동 저장 시간 검사를 부하에 흔들리지 않는 경계(점수 저장 800ms 미만, 의견 저장 700ms 이상)로 바꿨다. 6회 연속 통과했고 크기 갱신 제거·의견 디바운스 제거·점수 즉시 저장 제거 변형은 모두 실패한다.
- 링크 검사(AC-005): `scripts/check_markdown_links.py`는 추적 중인 Markdown의 상대 링크·이미지 경로를 검사한다(외부 URL·앵커·코드 내부 제외). 처음 실행에서 기존 깨진 링크 1건(`docs/spec_012.md`의 존재한 적 없는 `spec_011.md`)을 찾아 일반 텍스트로 바꿨고, 이제 135개 파일에서 0건이다. 단일 실행기에 `docs: markdown links` 단계로 추가했다.

### 3단계 프론트 (REQ-005~007, 2026-10-26)

- `REQ-005` 공통 도메인: `map-ui/domain.js`에 이벤트 유형 `EVENT_CONTENT_TYPE`/`isEventPlace`, `COMPANION_TYPES`·`COMPANION_LABELS`·`TRIP_CHOICE_LABELS`, `normalizeSearchText`(NFKC+`ko-KR` 소문자), `formatDotDate`, `featureKey`, `enrichPlace`를 두었다. `"15"` 하드코딩(`ccu-mmr.js`, `wizard.js`), 동행 목록(`ccu-mmr.js`, `itinerary.js`), 정규화 5곳, 점 날짜 2곳, 장소 보강 4벌(`app.js`, `validate_ccu_mmr_dashboard.cjs`, `test_daily_type_limit.cjs`, 골든 스크립트)이 이를 쓴다. 날짜 형식은 기존처럼 `YYYY-MM-DD` 전체 일치만 바꾸고 각 호출부가 원래 대체값(`"—"`/원문, `"미선택"`)을 유지한다. 골든 스크립트를 기준 복사본에서 `Domain.enrichPlace`로 바꾼 뒤에도 저장된 `enrichedPlaces.sha256`이 같아 2,153곳 보강 결과가 기준선과 바이트 단위로 같음을 확인했다. 정적 검증기 출력도 기준선과 같다.
- `REQ-006` 프론트 분해: `app.js` 1,340줄 → 193줄. 새 모듈 `events.js`, `view-helpers.js`, `layout.js`, `detail-view.js`, `results-view.js`, `recommendation-controller.js`를 만들고 함수 본문은 생성 스크립트로 원문 그대로 옮겼다(교체마다 1회 일치를 확인). `bindEvents` 200줄은 각 모듈의 `bindEvents()`로 나눴다(피드백 이름 입력→`feedback.js`, 단계·선택 카드·날짜·필수 장소 검색→`wizard.js`, MBTI 버튼→`preference-view.js`, 일정 폼→`itinerary-view.js`, 검색·필터·지도 맞춤→`map-view.js`, 상세·대화상자→`detail-view.js`, 서랍·접기→`layout.js`, 폼 제출·입력 변경·초기화·재추천→컨트롤러). 같은 요소·같은 이벤트 유형의 리스너는 한 모듈 안에 있어 등록 순서가 그대로다. 순환 의존(app↔wizard·preference-view·map-view·feedback)은 생성 인자 대신 `conditionsChanged`·`rerunRequested`·`feedbackCompleted`·`selectionChanged` 이벤트로 바꿨다. 지도 맞춤·필터 초기화·탐색 목록 항목은 `map-view.js`, `FEEDBACK_OPTIONS`는 `feedback.js`, `WIZARD_STEPS`는 `wizard.js`, `isMobileStackedFlow`는 `layout.js`, `recommendationFor`는 `state.js`로 옮겼다. `index.html`에 새 모듈 6개를 추가하고 바뀐 모듈의 캐시 버전을 `20261026-spec113`으로 올렸다.
  - AC-004 검사: `validate_ccu_mmr_dashboard.cjs`가 `app.js`의 모듈 생성 인자에 전달용 화살표 함수가 없음을 확인한다(앞 모듈만 직접 참조하므로 생성 순서가 의존 그래프다). 분해 전 `app.js`에서는 이 검사가 실패한다.
  - 동작 테스트 보강: 이벤트로 바꾼 경로(일정 중심 후보 선택·취소 재추천과 세션 유지, 필수 장소 추가·삭제와 결과 무효화 문구, 선택 마커 전환과 Escape 해제, 조건 초기화의 MBTI·선택·설정 초기화, 모바일 상세 평가 완료 후 상세 닫기·결과로 이동)를 `test_dashboard_behavior.cjs`에 추가했다. 보강한 테스트는 분해 전 커밋(`e781986`) 작업 트리와 분해 후 코드에서 모두 통과한다.
  - 생성 스크립트의 미정의 호출 검사(모듈별 직접 호출이 지역 정의·주입 인자·브라우저 전역인지)를 실행해 `results-view.js`의 `domain` 누락 1건을 고쳤다.
- `REQ-007` 랭커 분해: `rank` 175줄 → 35줄(`assertUniquePlaceIds`, `emptySummary`, `scoreEligiblePlaces`, `selectVariant`, `resultWarnings`), `buildSchedule` 170줄 → 48줄(`emptySchedule`, `assertSchedulablePlaces`, `anchorCluster`, `addUserAnchors`, `addAutomaticAnchors`, `anchorCandidatesOutside`, `dayPlan`). 두 MMR 경로의 최대 유사도 루프는 `mostSimilarChosen`으로 합쳤다(같은 계산·같은 순회 순서). 공개 API는 그대로다. 골든 123개 시나리오가 같고, 분해 전 랭커와 480개 요청(의도·이동·기간·다양성·필수·anchor·hard constraint·개인화·명시/가중 seed 조합)의 `JSON.stringify` 결과가 키 순서·오류 문구까지 같다.
- 검증(Windows): `python -X utf8 scripts/run_tests.py` → 20 통과, 2 SKIP(알려진 제한), 0 실패.

### 4단계 서버 (REQ-008~009, 2026-10-26)

- AC-006 골든 요청(서버 변경 전 커밋 `2be8e0c`): `check_golden_outputs.py`가 실제 `FeedbackHTTPServer`를 프로세스 안에서 띄워(임시 평가 DB, 실제 리뷰 DB, 오프라인 일정 서비스, `utc_now` 고정) 원시 HTTP 요청 58개의 상태 코드·고정 헤더·본문을 기록한다. 리뷰 페이지 규칙, 평가 v2/v3 생성·반복·이전 revision·충돌, 두 POST 경로의 Origin·Content-Type·Content-Length 누락·chunked·빈 본문·크기 초과·잘못된 JSON/UTF-8·검증 오류, 미구성 서비스, 신뢰 프록시 키별 속도 제한, 기본 501 응답을 포함한다. 기록 시점의 서버 코드는 0단계와 같다(README만 다름).
- `REQ-008` 공통화:
  - `settings.py`: 서버가 읽는 환경 변수 23개의 이름·기본값 레지스트리와 `env(name, environ)`. 값은 호출 시점에 원문 그대로 읽어 각 호출부의 기존 처리(공백 제거·숫자 변환·공급자별 대체값)를 유지한다. 기본값이 없던 `ITINERARY_LLM_MODEL`·`ITINERARY_ROUTE_PROVIDER`·`LLM_PROVIDER` 읽기는 `""` 기본값과 결과가 같음을 확인했다(`model_for_provider(None)`=`model_for_provider("")`, `"" or "estimate"`, `"" → "auto"`). `feedback_api.py`, `llm_client.py`, `route_provider.py`의 직접 환경 변수 읽기를 모두 바꿨고, 테스트가 소스에 `environ.get("…")` 직접 읽기가 남지 않았는지와 사용한 이름이 모두 등록됐는지 검사한다. 실행기 LLM 이름 테스트는 레지스트리를 기준으로 바꿨다.
  - `timeutil.py`: 3곳의 `KST`를 공유하고 기존 모듈 속성 이름(`itinerary_validation.KST` 등)은 유지한다.
  - `http_client.py`: `route_provider`가 `llm_client`에서 빌려 쓰던 `request_json`과 `ProviderError`·`provider_error_reason`을 옮겼다. `llm_client`가 같은 객체를 다시 내보내 `scripts/collect_place_operating_info.py` 등 기존 import가 그대로 동작한다.
  - `feedback_api.py`: GET/POST 라우트 표(`GET_ROUTES`, `POST_ROUTES`)와 `content_length()`·`read_json()` 공용 본문 함수. 두 POST 경로의 검사 순서·오류 형식·Transfer-Encoding·소켓 제한 시간 차이는 동작 보존을 위해 각 경로에 그대로 두었다(합치면 chunked 평가 요청이 411에서 400으로 바뀐다).
  - `Dockerfile`에 새 모듈 3개를 추가하고, `feedback_api.py`가 직간접으로 import하는 모든 로컬 모듈이 COPY 목록에 있는지 검사하는 테스트를 추가했다(하나를 빼면 실패함을 확인).
- `REQ-009` 분해: `validate_request` 126줄 → 12줄(`_request_window`, `_normalize_request_context`, `_excluded_place_ids`, `_normalize_request_day(s)`, `_normalize_meal_preferences`), `ItineraryService.generate` 157줄 → 14줄(`_response_shell`, `_failed_day`, `_generate_day`, `_DayRouter`, `_route_matrix`, `_prompt_places`, `_day_prompt`, `_propose_and_validate`, `_schedule_day`, `_summarize`), `validate_day` 193줄 → 36줄(`_reject`, `_check_stops`, `_check_visit_hours`, `_check_unscheduled`, `_check_meal_slots`, `_attach_legs`, `FATAL_PROPOSAL_ERRORS`). 평가 v2/v3 검증기는 UUID·storage·entries·장소·의견·메타데이터·스냅샷 구획 검사를 `feedback_contract.py`의 공용 함수로 옮겼다. 검사 순서와 오류 문구는 그대로다. 테스트가 patch하는 `itinerary_service.validate_day`는 모듈 전역 이름으로 계속 호출한다.
- 동일성 확인: 골든(일정 84·잘못된 요청 21·평가 30·HTTP 58)이 같고, 0~3단계 작업 트리(`e781986`)의 서버 코드와 새 코드로 일정 검증·생성 29건과 평가 검증 5건을 각각 실행한 `json.dumps` 결과(키 순서 포함)가 바이트 단위로 같다.
- 중복으로 지목됐지만 합치지 않은 것(결정): HH:MM 함수 5개는 서로 다른 연산(요청 검증, 원문 정규화, datetime 형식화, 분 단위+다음날 표기, 문자열→datetime)이라 하나로 합치면 동작이 바뀐다. 서버의 haversine은 `route_provider.haversine_meters` 하나뿐이고, 지구 반지름 차이(JS 6371km·Python 6371.0088km)는 서로 다른 런타임 간 차이라 맞추면 추천·이동시간 결과가 바뀐다. `atomic_json`은 인스타 가져오기 서버에만 있다. 인스타 가져오기 서버(`server/instagram-import`)는 별도 로컬 도구이고 배포 이미지가 달라 공용 모듈을 나누지 않았다.
- 검증(Windows): 서버 단위 테스트 171개(새 2개 포함) 통과. 한 번 실행에서 오류 1건이 났으나 이어진 10회 연속 실행에서 재현되지 않았다(로컬 소켓 시간 제한 테스트의 일시적 지연으로 추정). `python -X utf8 scripts/run_tests.py` → 20 통과, 2 SKIP, 0 실패.

### 5단계 스크립트 공용 계층 (REQ-010, 2026-10-26)

- `scripts/lib/data_io.py`(새, `data_io.mjs`의 Python 짝): `ROOT`, `sha256_file`, `json_text`, `atomic_write_text(path, text, *, newline=None, make_parents=False)`, `active_path`. `data_io.mjs`에 `sha256Hex`를 추가했다. `scripts/test_data_io.py`(실행기 등록)가 해시·JSON 형식·줄바꿈 모드·임시 파일 미잔존·상위 폴더 생성·manifest 조회를 검사한다.
- 옮긴 활성 스크립트: 파일 해시 4벌(`collect_tourapi_jeju.py`, `build_restaurant_meal_catalog.py`, `validate_kakao_review_db.py`, `build_kakao_review_db.py`), JSON 문서 쓰기(`collect_tourapi_jeju.py`), 원자적 쓰기 4벌(`build_visit_insights.py`, `collect_place_operating_info.py`, `collect_restaurant_coordinates.py`, `collect_kakao_jeju_restaurant_reviews.py`), JS 해시 3벌(`split_tourapi_jeju_places.mjs`, `build_itinerary_catalog.mjs`, `build_map_ui_data.mjs`). 기존 원자적 쓰기는 줄바꿈 처리(LF 고정과 플랫폼 기본값)와 상위 폴더 생성 여부가 서로 달라 호출부마다 기존 동작을 인자로 그대로 지정했다. 기존 함수 이름은 별칭으로 유지해 다른 스크립트·테스트의 import가 그대로다. `test_daily_type_limit.cjs`는 장소 유형 sidecar 경로를 `config/active_datasets.json`에서 읽는다.
- 동일성 확인: 변경 전 코드로 만든 출력과 비교해 식당 식사 카탈로그 SQLite가 바이트 단위로 같고 manifest는 생성 시각·지정한 출력 경로만 다르다. 카카오 리뷰 DB·방문 인사이트 검증 출력이 같다. TourAPI 분리·일정 카탈로그·지도 번들 재생성 결과가 커밋된 파일과 바이트 단위로 같다. 네트워크가 필요한 수집기는 실행하지 않고, 변경 전 커밋의 원래 함수 원문과 새 호출을 이 Windows 환경에서 같은 입력으로 실행해 출력 바이트(CRLF 변환 포함)가 모두 같음을 확인했다. 관련 단위 테스트(좌표·식당 수집기, 서버의 `build_visit_insights` import)가 통과한다.
- 옮기지 않은 것(결정): 해시가 manifest에 고정된 `build_all_place_profiles.py`·`classify_place_types.py`, 그 산출물을 검사하는 `validate_all_place_profiles.py`, 라벨 계보(`merge_*`, `recalibrate_*`, `build_place_profile_*`/`validate_place_profile_*`, `build_kakao_labeling_*`·`build_kakao_agent_inputs.py`, `fetch_*_web_pages.mjs`, `build_place_fit_relabel_viewer.py`, `build_labeling_review_ui.mjs`/`validate_labeling_review_ui.mjs`)와 보관 스크립트. `2026-08-09` 하드코딩 대부분은 이 계보 스크립트에 있다. 활성 데이터셋 manifest에 등록된 경로를 문자열로 가진 스크립트는 `classify_place_types.py`(동결)와 보관 스크립트, 위 테스트뿐이었다. 식당 파이프라인은 이미 `build_restaurant_catalog`를 공용 모듈로 쓰고, JSONL 읽기는 중복 키 검출 같은 고유 동작이 있어 그대로 두었다.

### 6단계 문서 (REQ-011, 2026-10-26)

- 구조 변경을 기준 문서와 README에 반영했다: `docs/architecture.md`(프론트 조립·이벤트, 서버 설정·라우트·공용 모듈, 스크립트 공용 I/O), `docs/data_contracts.md`(평가 대상 계산 위치), `docs/evaluation.md`(단일 실행기·골든·동작 테스트·SKIP/XFAIL), `map-ui/README.md`, `server/travel-feedback/README.md`, `review-ui/README.md`, `data/labeling/jeju/README.md`, `scripts/archive/README.md`, `AGENTS.md` 검증 명령. `python -X utf8 scripts/check_markdown_links.py`가 깨진 상대 링크 0건을 확인한다.
- 장소 유형 테스트의 원인 기록을 정정했다(알려진 제한). 실행기는 이 테스트를 `XFAIL`로 실행하고, 라벨 검수 해시 테스트는 LF 체크아웃이 아니면 SKIP한다.
- 상태: REQ-001~011을 구현했다. AC-002~006은 확인했고, AC-001은 SPEC-113 이전부터 실패하는 장소 유형 테스트 1개(`XFAIL`)와 환경 SKIP 1개를 빼고 통과한다. 장소 유형 산출물 재생성 여부(데이터 변경)를 사용자가 결정하기 전까지 `In Progress`로 둔다.

## 설계와 달라진 점

- 골든 해시는 키를 정렬한 JSON으로 계산한다. 리팩토링이 객체 속성 생성 순서만 바꾸는 경우를 차이로 보지 않기 위해서이며, 배열 순서와 숫자 값은 그대로 비교한다. AC-002의 "바이트 단위로 같다"는 이 정규화 출력과 골든 파일 내용 기준이다. 파일 비교는 Windows `core.autocrlf` 체크아웃의 줄바꿈 차이를 피하려고 파싱한 JSON끼리 한다.
- JS·CSS 소스 검사를 Playwright로 옮기면서 정적 검증기에 넣지 않고 별도 `test_dashboard_behavior.cjs`로 분리했다. 정적 검증기는 브라우저 없이 빠르게 돌고, 동작 검사는 실행기의 브라우저 단계에 둔다.
- `fetch(` 정확히 2회 검사는 "실제 흐름의 fetch/XHR이 허용된 두 엔드포인트뿐"이라는 네트워크 검사와 "엔진 3개는 `fetch`를 쓰지 않는다"는 금지 API 검사로 바꿨다. 금지 API 검사 범위는 7개 파일에서 `map-ui/`의 모든 1차 모듈로 넓혔다.
- 실행 환경이 고정 산출물 바이트를 재현할 수 없는 테스트는 실패 대신 사유와 함께 SKIP하고, SPEC-113 이전부터 실패하던 테스트는 `XFAIL`(알려진 실패)로 실행 결과와 원인을 보여 준다. 둘 다 통과로 세지 않으며, 알려진 실패가 통과하면 표시를 지우라고 알린다(5단계에서 정정, 아래 알려진 제한).
- 1단계에서는 정적 검증기의 장소 보강 코드를 그대로 두고 골든 스크립트가 기준선 `app.js` 보강을 복사해 `enrichedPlaces` 해시로 고정했다. 3단계(REQ-005)에서 넷 모두 `domain.enrichPlace`로 바꿨다.
- `preference-view.js`의 `clearTravelMbtiProfile({ run: true })` 분기(초기화 뒤 바로 추천 실행)는 호출하는 곳이 없어 제거했다. 유일한 호출부(조건 초기화)는 기존 `run: false` 동작 그대로다.

## 알려진 제한

- 피드백 파일(`travel-feedback-anonymized-since-0903 copy.json`)의 Git 이력 삭제 여부는 사용자 결정이 필요하다.
- `test_labeling_review_model.mjs`는 고정 해시 대상 JSON이 이 Windows 작업 사본에서 CRLF라 SKIP된다. 같은 파일을 LF 작업 사본으로 바꾸면 통과(종료 코드 0, 12개 묶음)함을 확인하고 되돌렸다. 고정 데이터에 `eol=lf` 속성을 주는 정리는 별도 결정이 필요하다.
- `test_place_types.py`는 SPEC-113 이전부터 실패한다(`XFAIL`). 1단계에서는 SQLite 버전·CRLF만 원인으로 기록했으나 5단계에서 다시 확인한 결과, 재생성한 JSONL·보고서는 줄바꿈만 다르고 내용이 같지만 `place-types-v1/manifest.json`이 SPEC-111 번들 변경 이전의 `map-ui/data/jeju-places.js` 해시를 고정하고 있어 어떤 환경에서도 일치하지 않는다. 0~2단계 작업 트리(`e781986`)에서도 같은 차이가 난다. 재생성은 데이터 변경이고 `classify_place_types.py`는 수정 금지 대상이라 SPEC-113 범위 밖이며 사용자 결정이 필요하다. 바이트 비교에는 SQLite 3.37.2와 LF 체크아웃도 필요하다.
- 데스크톱 사이드바를 접으면 Leaflet의 마지막 `invalidateSize`(240ms)가 grid 전환 종료 직전에 실행돼 지도 크기가 컨테이너보다 약 2px 작게 남을 수 있다. 기존 동작이며 동작 보존 범위라 고치지 않았고, 테스트는 지도 폭이 커지고 컨테이너와 4px 이내인지만 확인한다.
- 골든 입력(지도 번들·일정 카탈로그·식당 sidecar·정책 버전)이 바뀌면 골든 비교가 실패한다. 데이터 재생성은 리팩토링이 아니므로 별도 SPEC에서 골든을 갱신한다.
- 피드백 파일 추적 해제 커밋을 받는 다른 작업 사본에서는 Git이 그 파일을 작업 트리에서 지운다(이력에는 남음). 리포트를 다시 만들 사람은 받기 전에 로컬 사본을 저장소 밖에 보관하고 `--input`으로 지정해야 한다.
- 보관 스크립트 중 일부(`make_full_direct_04.py` 등)는 당시 작업 환경의 절대 경로를 담고 있어 그대로는 실행되지 않는다. 보관 기록이며 유지 대상이 아니다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-26 | 조사 결과를 바탕으로 초안 작성, 사용자 승인 범위(단계별 전체)로 In Progress |
| 2026-10-26 | 1단계 안전망(REQ-001~003) 구현: 골든 출력 2종, 테스트 플래그 훅, 정적 계약/브라우저 동작 검사 분리, 단일 실행기. 테스트 계획 명령 갱신 |
| 2026-10-26 | 2단계 저위험 정리(REQ-004) 구현: 실행기 LLM 이름, 활성 라벨 `--promote` 보호, review-ui v1·깨진 검증기 삭제, gitlink·피드백 파일 추적 해제, 일회성 스크립트 27개 보관, Markdown 링크 검사 |
| 2026-10-26 | 프론트 모듈 구조 결정을 설계에 기록하고 3단계(REQ-005~007) 구현: `domain.js` 공통화, `app.js` 분해와 이벤트 기반 의존 차단, 랭커 단계 함수 분해 |
| 2026-10-26 | HTTP 골든 58개를 먼저 기록하고 4단계(REQ-008~009) 구현: 설정 레지스트리·KST·HTTP 클라이언트 공통화, 라우트 표, 일정 요청 검증·생성·하루 검증·평가 검증기 분해, Docker 모듈 목록 검사 |
| 2026-10-26 | 5단계(REQ-010) 스크립트 공용 I/O, 6단계(REQ-011) 문서 반영. 장소 유형 테스트 원인 정정(SKIP→XFAIL)과 상태 판단 기록 |
