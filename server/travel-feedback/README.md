# Travel feedback API

`POST /travel/api/feedback`으로 `travel-recommendation-feedback-log-v3` 자동 저장 스냅샷과 기존 v2 수동 제출을 받아 전용 SQLite에 90일 보관하고, `GET /travel/api/places/{contentid}/reviews`로 작성자명이 제거된 Kakao 리뷰 스냅샷을 조회하는 표준 라이브러리 기반 Python 서비스다. v3는 추천 `session_id`별 최신 revision 한 행만 유지한다.

## 로컬 검증

```powershell
python -m unittest server/travel-feedback/test_feedback_api.py
python -m py_compile server/travel-feedback/feedback_api.py
python scripts/validate_kakao_review_db.py
```

## 환경 변수

- `TRAVEL_FEEDBACK_PORT`: 기본 `8200`
- `TRAVEL_FEEDBACK_DB_PATH`: 기본 `/data/feedback.sqlite3`
- `TRAVEL_PUBLIC_ORIGIN`: 허용할 동일 출처 Origin
- `TRAVEL_FEEDBACK_RETENTION_DAYS`: 기본 `90`
- `TRAVEL_REVIEW_DB_PATH`: 기본 `/app/data/kakao_reviews.sqlite3`

컨테이너에는 `/data` 전용 영속 볼륨을 연결한다. 서비스는 v3를 `feedback_sessions`, v2를 `feedback_submissions`에 분리해 요청 payload, UUID와 시각만 보관하고 IP·User-Agent·쿠키는 저장하지 않는다. Kakao 리뷰 DB는 이미지에 포함된 별도 읽기 전용 스냅샷이며 후기 작성자명은 저장하지 않는다.

## 날짜 기반 동선 (SPEC-083)

`POST /travel/api/itineraries`를 추가했다. 구현·모의 검증 범위와 실제 API 미검증 항목은 [SPEC-083](../../docs/spec_083.md)을 따른다. 추천 점수·일자 배정을 바꾸지 않고 별도 시간표를 반환하며, 유효한 실제 날짜·자동차·공개 시작/종료 위치·시각이 필요하다. 비자동차를 자동차 경로로 대체하지 않는다.

서버 설정:

- `ITINERARY_ENABLED`: 기본 `auto`(SPEC-107/108: 선택된 LLM 공급자의 키가 있으면 켜짐), `1` 강제 활성, `0` 비활성. 비활성이나 잘못된 카탈로그 설정은 기존 평가·리뷰 서비스를 유지한다.
- `LLM_PROVIDER`: `auto`(기본) | `gemini` | `openai` ([SPEC-108](../../docs/spec_108.md)). `auto`는 키가 하나만 있으면 그 공급자, 둘 다 있으면 `openai`. 잘못된 값이면 동선 기능만 꺼진다.
- `GEMINI_API_KEY`(없으면 `GOOGLE_API_KEY`): Gemini Developer API 키. `x-goog-api-key` 헤더로만 보낸다. 무료(미결제) 키 입력은 Google 약관상 제품 개선·사람 검토에 쓰일 수 있으므로 결제 연결 프로젝트 키를 권장한다.
- `OPENAI_API_KEY`: OpenAI 서버 키. 두 공급자 모두 첫 structured 호출 전 지정 모델의 계정 접근을 확인한다.
- `ITINERARY_LLM_MODEL`: 공급자 공통 모델 이름. 비우면 gemini `gemini-3.8-flash`, openai `gpt-5.6-terra`. 다른 공급자 이름(`gpt-*`↔`gemini*`)이 남아 있으면 무시하고 기본값을 쓴다.
- `ITINERARY_LLM_MAX_OUTPUT_TOKENS`: OpenAI 기본 4,000(256~8,000), Gemini 기본 8,192(사고 토큰 포함, 256~65,536).
- `GEMINI_THINKING_LEVEL`: 선택. 값이 있으면 `thinkingConfig.thinkingLevel`로 전달한다(예: `low`). 비우면 모델 기본값.
- `KAKAO_MOBILITY_API_KEY`: 카카오모빌리티 자동차 미래 운행 길찾기 키. SPEC-107 이후 `ITINERARY_ROUTE_PROVIDER=kakao`일 때만 사용한다(기본은 추정 이동시간).
- `ITINERARY_CATALOG_PATH`, `ITINERARY_INSIGHTS_PATH`: 기본은 서비스 폴더의 `data/itinerary_catalog.json`, `data/visit_insights.json`.
- `ITINERARY_REQUESTS_PER_MINUTE`, `ITINERARY_REQUESTS_PER_DAY`: 프로세스 전역 기본 10/100. 동시 2건, 본문 64 KiB. 공급자 계정의 프로젝트 예산도 별도로 설정한다.
- 일수·경로 호출·90초 deadline·체류·방문 여유·식사 기본값은 `itinerary_policy.json`에서 버전 관리한다. 개발 기본값이며 사용자 확정 운영 정책이 아니다.

화면은 전체 여행 날짜와 원래 일차 번호를 유지한 채 `generationScope=day`, `days` 한 건씩 순차 요청한다. 하루 요청의 호출은 분당/일일 제한에 각각 한 건으로 계산한다. 이전 `trip` 요청(생략 시 기본)도 받지만 긴 여행은 전체 90초 제한에 걸릴 수 있어 하루 요청을 권장한다. 날짜별 식사 자동/필수/제외와 `generation_failed` 응답의 의미, 호출 예산 및 실제 품질 gate는 SPEC-083의 최신 계약을 따른다. 브라우저 취소는 이미 진행 중인 서버의 공급자 호출 비용을 취소하지 않으며, 다시 만들기를 누르면 전체 날짜를 다시 요청한다.

공개 데이터 준비(원래 지도/리뷰/평가 데이터는 변경하지 않음):

```sh
# 키 없이 unknown 상태와 캐시 해시를 준비하고 서버 카탈로그 생성
python3 scripts/build_visit_insights.py --prepare-only
node scripts/build_itinerary_catalog.mjs
python3 scripts/collect_place_operating_info.py --dry-run --limit 30

# 키 설정 후 별도로 실행: 실제 외부 호출이 발생함
# TourAPI 수집 키는 KTO_TOUR_API_KEY 환경변수
python3 scripts/collect_place_operating_info.py --limit 30
python3 scripts/build_visit_insights.py --limit 30
node scripts/build_itinerary_catalog.mjs
```

수집은 기존 성공 파일을 건너뛰고 `--refresh`로 갱신한다. 복잡한 계절·휴일·회차 표현은 unknown 원문을 보존하며 출처 기반의 구조화 검수가 필요하다. 리뷰는 변경된 원문/모델/프롬프트만 재분석하고 삭제된 리뷰의 추론은 철회한다. 현재 포함된 카탈로그는 운영정보 수집 0건·리뷰 추론 완료 0건이며 `--prepare-only`의 unknown을 실제 분석 결과로 간주하면 안 된다.

```sh
python3 -m unittest discover -s server/travel-feedback -p 'test_*.py'
node scripts/test_itinerary_ui.cjs
node scripts/test_feedback_completion.cjs
python3 scripts/evaluate_itineraries.py --output /tmp/spec083-sample-audit.json
```

브라우저 테스트에는 Playwright와 Chromium 또는 `FEEDBACK_TEST_CHROMIUM` 경로가 필요하다. 샌드박스에서는 localhost 서버를 여는 권한이 필요할 수 있다. macOS Python 캐시 쓰기 제한이 있으면 `PYTHONPYCACHEPREFIX=/tmp/trip-ai-pycache`를 지정한다.

Docker는 새 모듈·정책·카탈로그·분석 sidecar를 포함한다. 릴리스 설치기는 기존 Caddy API 경로를 동선까지 확장하고 기존 서비스에도 새 환경변수를 추가한다. Vercel 프록시는 정확한 공개 Origin의 해당 POST만 변환한다. 아직 배포하지 않았으며 실제 Vercel 대기 한도·모델 지연·경로 이용 조건·비용은 별도 확인이 필요하다. 사용자 일정과 프롬프트는 영속 저장하지 않는다.

## 식사 시간대 식당 후보와 추정 이동시간 (SPEC-107)

[SPEC-107](../../docs/spec_107.md) 이후 이동시간은 기본적으로 외부 호출 없는 직선거리 기반 추정(`EstimatedRouteProvider`)이며, 검증된 날짜의 점심·저녁 slot마다 동선 일대·해당 시각 영업 식당 최대 5곳과 삽입 시뮬레이션·LLM 리뷰 판정을 함께 반환한다. **Gemini 또는 OpenAI 키 하나만 있으면 동작한다**(SPEC-108).

추가·변경된 설정:

- `ITINERARY_ENABLED`: 없거나 `auto`면 선택된 공급자의 키(`GEMINI_API_KEY` 또는 `OPENAI_API_KEY`)가 있을 때 켜진다. `1` 강제 활성, `0` 비활성.
- `ITINERARY_ROUTE_PROVIDER`: `estimate`(기본, 카카오 키 불필요) | `kakao`(기존 미래 경로, `KAKAO_MOBILITY_API_KEY`와 경로 호출 예산 적용). 잘못된 값이면 동선 기능만 꺼진다.
- `RESTAURANT_LLM_MODEL`: 식당 판정 모델. 없으면 `ITINERARY_LLM_MODEL`(없으면 공급자 기본 모델). `RESTAURANT_LLM_MAX_OUTPUT_TOKENS`(없으면 `ITINERARY_LLM_MAX_OUTPUT_TOKENS`, 공급자별 기본·허용 범위는 위와 같음)로 출력 상한을 따로 둘 수 있다.
- `ITINERARY_RESTAURANT_CATALOG_PATH`: 기본 `data/restaurant_meal_catalog.sqlite3`. 없거나 손상이면 장소 동선만 제공하고 `restaurantIntegrationStatus=catalog_unavailable`.
- 추정 속도·보정계수·식당 후보 수·리뷰 개수/길이·식사 외 업종은 `itinerary_policy.json`의 `routeEstimate`, `restaurant`에서 버전 관리한다(개발 기본값).

식당 sidecar 재생성(음식점 v3 DB가 로컬에 있을 때, 원본은 읽기 전용):

```sh
python scripts/build_restaurant_meal_catalog.py
python scripts/build_restaurant_meal_catalog.py --validate-only
```

로컬에서 지도 UI와 API를 한 주소로 실행(저장소 루트 `.env`의 키 사용, 키는 출력하지 않음):

```sh
python scripts/run_trip_ai_local.py   # http://127.0.0.1:8080
```

검증:

```sh
python -m unittest discover -s server/travel-feedback -p "test_*.py"
node scripts/test_itinerary_ui.cjs
python scripts/evaluate_restaurant_candidates.py --output /tmp/spec107-restaurant-candidates.json
```

`fake_llm_scheduler.py`는 테스트·오프라인 평가용 결정적 LLM 대역이며 Docker 이미지에 넣지 않는다. 요청당 LLM 호출은 시간표 1 + 수정 최대 1 + 식당 판정 1이며 `provenance.calls.restaurantLlm`으로 집계한다. 식당 판정 실패는 장소 일정을 실패시키지 않는다.
