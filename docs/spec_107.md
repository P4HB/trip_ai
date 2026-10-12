# SPEC-107: 동선 기반 식사 시간대 식당 후보 추천과 추정 이동시간

- 상태: In Progress
- 작성일: 2026-10-12
- 최종 수정일: 2026-10-12
- 관련 이슈: 사용자 요청 — 장소 동선의 점심·저녁 칸마다 동선 일대에서 그 시각에 영업하는 식당 후보 5곳을 보여주고 사람이 고르게 한다. 카카오모빌리티 호출을 없애고 거리 기반 추정 이동시간을 쓴다. LLM 키만 넣으면 동작해야 한다.
- 관련 문서: [SPEC-083](spec_083.md), [SPEC-105](spec_105.md), [SPEC-103](spec_103.md), [SPEC-106](spec_106.md), [데이터 계약](data_contracts.md#날짜-기반-동선-계약--spec-083-로컬-구현), [아키텍처](architecture.md), [안전·개인정보](safety_privacy.md), [평가](evaluation.md)
- 관련 코드: `server/travel-feedback/route_provider.py`, `server/travel-feedback/restaurant_hours.py`, `server/travel-feedback/restaurant_catalog.py`, `server/travel-feedback/restaurant_candidates.py`, `server/travel-feedback/fake_llm_scheduler.py`(테스트·오프라인 대역), `server/travel-feedback/itinerary_service.py`, `server/travel-feedback/itinerary_validation.py`, `server/travel-feedback/llm_client.py`, `server/travel-feedback/feedback_api.py`, `server/travel-feedback/itinerary_policy.json`, `server/travel-feedback/Dockerfile`, `server/travel-feedback/deploy_into_rail_release.py`, `scripts/build_restaurant_meal_catalog.py`, `scripts/run_trip_ai_local.py`, `scripts/evaluate_restaurant_candidates.py`, `map-ui/itinerary.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css`
- 선행 SPEC: SPEC-083(현재 동선), SPEC-103·SPEC-106(음식점 DB·좌표), SPEC-105(장기 설계)

> SPEC-105는 사전 LLM 라벨·여행 전체 식당 조정까지 포함한 **장기 설계(Draft)** 로 유지한다. 이 문서는 그중 「식당 연결」 단계의 **1차 구현 범위**이며 사전 라벨링·전체 조합 최적화·최종 재생성은 하지 않는다.

## 배경

사실(2026-10-12 코드·데이터 확인):

- SPEC-083 동선은 CCU-MMR 일자 배정 → 하루 LLM 시간표 → 서버 검증·최대 1회 수정 흐름이다. 점심·저녁 `mealSlots`에 앞뒤 위치·기본 경로·우회 여유를 반환하지만 `restaurantStatus=pending`이고 식당 검색·선택은 없다.
- 이동시간은 카카오모빌리티 미래 출발 경로만 사용한다. 키가 없으면 모든 날짜가 `unavailable`이 되어 OpenAI 키만으로는 시간표를 만들 수 없다.
- 음식점 v3 조회 DB(SPEC-106): 13,561곳, 좌표 available 13,475곳, 영업시간 available 10,672곳, 리뷰 44,156건(식당당 최대 5건). 좌표와 영업시간이 모두 available인 곳은 10,634곳이다.
- `business_hours.schedule_json`은 수집일 기준 **화면에 보인 7일치 날짜/요일 행**이다(예: `화(9/22)`, `["11:00 ~ 22:00", "15:00 ~ 17:00 브레이크타임", "21:00 라스트오더"]`). 수집 주간은 2026-09-22~28과 09-29~10-05이며 추석(9/24~26)·개천절(10/3)·대체공휴일(10/5)이 섞여 있다.
- 업종(`category`) 실측 상위: 한식 2,714, 육류·고기 1,262, 치킨 665, 호프·요리주점 656 … 카페·디저트·베이커리·아이스크림은 수집 단계(`exclude_cafes_bakeries`)에서 이미 빠져 0건이다. 음식점이 아닌 업종(`단체,협회`, `선교회`, `양식업`(양식장), `수산물판매`, `구내식당`, `배달도시락`)이 소수 존재한다.

## 사용자 확정 결정

| # | 결정 |
|---|---|
| D1 | 장소 동선은 기존 알고리즘 그대로 먼저 만든다. 식당 때문에 장소 순서나 날짜를 바꾸지 않는다. |
| D2 | **카카오모빌리티 API를 호출하지 않는다.** 장소 동선과 식당 우회 모두 좌표 거리 기반 추정 이동시간을 쓴다. `KakaoRouteProvider`는 삭제하지 않고 설정으로만 비활성화한다. |
| D3 | `mealSlots`마다 앞뒤 장소 사이 동선 일대 식당을 고르고 그 시각 영업 여부로 먼저 거른다. |
| D4 | 영업시간 없음·미인식·미수집·해석 불가 식당과 좌표 미확인 식당은 제외한다. |
| D5 | 사전 LLM 라벨이 없으므로 걸러진 식당 중 **무작위 5곳**을 고른다. |
| D6 | 5곳의 리뷰를 요청 시 LLM에 보내 ① 취향·동행 ② 점심/저녁 적합 ③ 품질·평판 ④ 여행 전체 음식 다양성으로 판정한다. |
| D7 | 장소 동선을 먼저 보여주고, 식사 칸에서 사람이 후보 중 하나를 고른다. 선택하면 일정에 넣고 추정 이동시간으로 앞뒤 시간을 재검증해 경고를 보여준다. |
| D8 | LLM API 키만 넣으면 바로 동작해야 한다. ([SPEC-108](spec_108.md)에서 Gemini 키로 확장) |

### SPEC-083 원칙 변경 (사용자 결정)

SPEC-083 `REQ-8305`의 「직선거리로 확정 이동시간을 대신하지 않는다」와 카카오 미래 경로 사용을 **이 SPEC이 대체한다**. 사유는 외부 경로 호출의 키·과금·호출 예산·실패 경로 복잡도 제거다(D2). 대신 모든 이동시간은 `provider=estimated_haversine`, `predictionBasis=distance_estimate`로 표시하고, 응답 `assumptions`에 `route_estimated`(직선거리 기반 추정값)를 넣으며 UI는 모든 이동시간 옆에 「추정」을 표기한다. LLM은 여전히 이동시간을 만들지 않고 서버 추정값만 사용한다.

## 목표

- OpenAI 키(및 기능 플래그 자동 판정)만으로 하루 시간표와 식당 후보가 끝까지 생성된다.
- 확정된 식사 slot마다 동선 일대·해당 시각 영업 식당 최대 5곳과 삽입 시뮬레이션·LLM 적합도 판정을 반환한다.
- 사용자가 고른 식당을 일정에 끼워 보이고, 다음 장소 지연·위반을 경고한다. 선택은 다음 날 요청의 다양성 맥락으로 전달된다.

## 비목표

- 식당 사전 LLM 라벨링(음식 종류·로컬/인지도). 무작위 5곳은 라벨이 생기면 라벨 기반 후보 선정으로 대체한다(D5).
- 카카오모빌리티 등 외부 경로 호출, 실도로 geometry, 대중교통·도보.
- 식당 선택 후 전체 일정 재생성. 이번에는 삽입 시뮬레이션과 경고만 한다.
- 원본·v1·v2·v3 음식점 DB 수정·재수집, 배포, 사용자 선택의 서버 저장.
- 여행 전체 식당 조합 최적화(SPEC-105 6절), 공휴일별 영업 변동 데이터.

## 요구사항

- `REQ-10701` 추정 이동시간: `EstimatedRouteProvider`가 기존 `route(origin, destination, departure, mode, timeout)` 인터페이스와 반환 필드(`durationSeconds`, `durationMinutes`, `distanceMeters`, `provider`, `providerVersion`, `predictionBasis`, `routeRef`, `departureTime`, `queriedAt`, `geometry`)를 유지한다. Haversine × 도로 보정계수를 거리 구간별 속도로 누적 환산하고 고정 여유를 더해 **분 단위 올림**한다. 같은 위치는 0분이다. 값은 버전된 `itinerary_policy.json`의 `routeEstimate`에 둔다.
- `REQ-10702` 공급자 선택: `ITINERARY_ROUTE_PROVIDER=estimate|kakao`, 기본 `estimate`. `estimate`는 `KAKAO_MOBILITY_API_KEY` 없이 로드된다. 외부 호출이 아닌 추정 공급자에는 경로 호출 예산을 적용하지 않는다(카카오에는 기존 예산 유지).
- `REQ-10703` 키만으로 동작: `ITINERARY_ENABLED`가 없거나 `auto`면 `OPENAI_API_KEY`가 있을 때 활성화한다(`1` 강제 활성, `0` 비활성). 로컬 실행기 `scripts/run_trip_ai_local.py`는 저장소 루트 `.env`를 읽어 지도 UI와 API를 같은 출처로 제공한다. 키·프롬프트를 출력하지 않는다.
- `REQ-10704` 식당 카탈로그 sidecar: `scripts/build_restaurant_meal_catalog.py`가 v3 DB를 읽기 전용으로 열어 좌표 available·영업시간 available·영업시간 완전 해석·식사 업종인 식당만 담은 SQLite sidecar와 manifest(입력 해시, 생성 시각, 포함/제외 사유별 coverage, 출력 해시·크기)를 만든다. 원본 DB 해시는 생성 전후 같아야 한다. Docker 이미지에 포함한다.
- `REQ-10705` 영업시간 파서: 서버와 빌드가 공유하는 `restaurant_hours.py`가 관측 주간을 요일별 영업 구간·브레이크·라스트오더·정기 휴무·자정 넘김·날짜 지정 휴무로 해석한다. 해석할 수 없는 표현(격주, 매달 n째, 비정기, 재료 소진, 계절, 홀/포장 시간 분리 등)은 식당을 제외하고 추측하지 않는다. 공휴일 관측일은 아래 규칙으로만 요일 규칙에 반영한다. 확인 시각과 출처 URL을 보존한다.
- `REQ-10706` 후보 추출: slot 앞 장소 P(직전 출발지, 없으면 시작 위치)와 뒤 장소 N(직후 도착지, 없으면 종료 위치)에 대해 `est(P→R)+est(R→N)−est(P→N) ≤ maxDetourMinutes`인 식당 중 해당 날짜·도착 시각에 휴무가 아니고 `[도착, 도착+식사시간]`이 한 영업 구간(브레이크 제외) 안에 있으며 라스트오더가 있으면 `도착 ≤ 라스트오더`인 곳만 남긴다. `tripFoodContext.usedRestaurantIds`와 같은 날 앞 slot 후보를 제외하고 `sha256(requestId|slotId|catalogVersion)` 시드로 최대 5곳을 뽑는다. 0곳이면 사유(`no_restaurants_nearby|none_open_at_time|all_already_used`)를 낸다.
- `REQ-10707` 삽입 시뮬레이션: 후보마다 도착·식사 종료·N 도착 예정·원래 N 도착 대비 지연(분)과 `validate_restaurant_insertion()` 위반을 미리 계산해 응답에 넣는다. 사용자가 고를 때 서버를 다시 호출하지 않는다.
- `REQ-10708` LLM 판정: 그날 모든 slot 후보를 `restaurant_fit` task **1회 호출**로 판정한다. 입력은 slot 종류·시각, 허용 목록의 여행자 맥락(동행 유형·취향 신호), 이미 고른 식당 업종, 후보 ID·이름·업종·평균 별점·리뷰 수·리뷰(최근순 최대 8개, 400자)다. 출력은 후보마다 `verdict`, 4개 기준(`good|neutral|poor|unknown`), 한국어 80자 이내 `reason`, 근거 리뷰 ID다. 모델은 `RESTAURANT_LLM_MODEL`, 없으면 `ITINERARY_LLM_MODEL`.
- `REQ-10709` 판정 검증: 스키마를 검증한다. 입력에 없는 후보·누락·중복은 그날 판정 전체를 무효로 한다. 근거 리뷰가 그 후보의 실제 리뷰가 아니거나 `insufficient_evidence` 외 판정에 근거가 없으면 그 후보만 `insufficient_evidence`로 강등한다. `diversity`는 서버가 업종 반복 횟수로 계산한 값을 우선하고 LLM 값은 별도로 보존한다.
- `REQ-10710` 실패 격리: 판정 실패(타임아웃·거절·형식 오류·deadline 부족)는 장소 일정을 실패시키지 않는다. 후보는 `judgement.status=unavailable`로 그대로 반환하고 선택할 수 있다. 호출 집계에 `restaurantLlm`을 추가하며 하루 요청당 LLM은 시간표 1 + 수정 최대 1 + 식당 판정 1이다.
- `REQ-10711` 계약: 요청 `itinerary-request-v2`에 선택 필드 `tripFoodContext`, `travelerContext`를 추가하고 상한을 둔다. 서버가 아는 식당 ID만 쓰며 업종은 서버 카탈로그 값을 쓴다. 응답 `itinerary-result-v2`의 `mealSlots[]`에 `restaurantStatus`, `restaurantCandidates[]` 등을 추가하고 `restaurantIntegrationStatus=candidates_only`로 바꾼다. v1 요청은 계속 받는다.
- `REQ-10712` UI: 식사 칸에 후보(이름·업종·별점/리뷰 수·약 N분 우회(추정)·영업시간 요약과 확인일·판정 배지·한 줄 이유·카카오맵 링크)를 보인다. `not_recommended`는 접어 두고, 판정 실패는 「AI 판정 없음」으로 표시하되 선택을 허용한다. slot당 1곳 선택·해제, 선택 시 시간표 삽입과 경고, 다음 날 요청의 `tripFoodContext` 반영, 다시 만들기 시 선택 초기화, 모든 이동시간의 「추정」 표기, 키보드 조작·라벨·모바일 폭을 지원한다.
- `REQ-10713` 개인정보·안전: LLM에는 이름·평가 의견·MBTI 원문·정확한 위치·자유 입력 원문을 보내지 않는다. 리뷰는 비신뢰 인용이며 지시를 따르지 않는다. 비밀키·프롬프트·리뷰 원문을 로그·문서 예시에 남기지 않는다.

## 입력과 출력

### 요청 `itinerary-request-v2` (v1 호환)

기존 SPEC-083 필드에 아래 선택 필드를 더한다. v1 요청은 두 필드가 없는 v2로 처리한다.

| 필드 | 형식·상한 | 처리 |
|---|---|---|
| `tripFoodContext.usedRestaurantIds` | `kakao:{숫자}` 문자열 최대 28개 | 서버 카탈로그에 없는 ID는 버림. 후보에서 제외 |
| `tripFoodContext.chosen[]` | `{restaurantId, category}` 최대 14개, category 40자 | 업종은 서버 카탈로그 값으로 대체. 다양성 판정 입력 |
| `travelerContext.companionType` | `solo|couple|friends|kids|parents|none|null` | LLM 입력 |
| `travelerContext.preferenceSignals[]` | 최대 8개 `{feature, direction}`; feature는 CCU-MMR 18개 원자 feature, direction `benefit|avoid` | 서버가 한국어 라벨로 변환해 LLM 입력. 가중치·MBTI 유형·원문은 받지 않음 |

형식·상한 위반은 422(`needs_input`)다.

### 응답 `itinerary-result-v2`

- `restaurantIntegrationStatus`: `candidates_only`(사람이 선택해야 함) 또는 `catalog_unavailable`(식당 sidecar 미로드).
- `mealSlots[]` 추가 필드
  - `restaurantStatus`: `candidates_ready|no_candidates|judgement_unavailable` (`catalog_unavailable`일 때 `catalog_unavailable`)
  - `restaurantNoCandidateReason`: 0곳일 때 사유 코드와 `restaurantNoCandidateMessage`
  - `restaurantCandidatePool`: `{nearby, openAtTime, eligible}` 단계별 수
  - `restaurantCandidates[]`: `restaurantId`, `title`, `category`, `averageRating`, `reviewCount`, `sourceUrl`, `lng`, `lat`, `hoursSummary`, `hoursCheckedAt`, `hoursSourceUrl`, `hoursBasis=observed_week_projection`, `estimatedDetourMinutes`, `insertion{arrival, mealEnd, nextArrival, originalNextArrival, nextDelayMinutes, toRestaurantMinutes, fromRestaurantMinutes, violations[]}`, `judgement{status, verdict, criteria{companionFit, mealTimeFit, quality, diversity, diversityModel}, reason, evidenceReviewIds}`
  - 정렬: 판정 순서 `recommended → acceptable → insufficient_evidence → not_recommended`, 같은 판정 안에서는 무작위 순서 유지. 판정 실패면 무작위 순서 그대로.
- `assumptions[]`: `route_estimated`(직선거리 기반 추정 이동시간), `restaurant_hours_projection`(관측 주간 요일 패턴).
- `provenance`: `routeProvider`, `routeEstimateVersion`, `restaurantCatalogVersion`, `restaurantHoursParserVersion`, `restaurantPromptVersion`, `restaurantModel`, `calls.restaurantLlm`.

시각은 `+09:00` ISO 8601, 좌표는 `lng`(경도)·`lat`(위도), 이동시간 계산은 초(분 단위 올림 값의 60배), 화면은 분이다.

## 설계

```
하루 요청 → 검증(요청 v1/v2) → 추정 이동표 → LLM 시간표 → 검증/수정(기존)
  → 성공 상태 날짜의 mealSlot마다: P/N → 우회 필터(추정) → 영업 필터 → 제외 → 시드 무작위 5 → 삽입 시뮬레이션
  → 그날 후보 전체 LLM 1회 판정 → 서버 검증·강등·다양성 계산 → 정렬 → 응답
UI: 장소 시간표 → 식사 칸 후보 → 선택(클라이언트 상태) → 삽입 표시·경고 → 다음 날 요청 tripFoodContext
```

### 1. 추정 이동시간 (구현 기본값 — 근거 없는 개발 기본값)

`routeEstimate`(`haversine-road-factor-v1`):

| 항목 | 값 |
|---|---|
| 도로 보정계수 | 1.35 |
| 속도 | 0~3km 25km/h, 3~15km 40km/h, 15km 초과 55km/h |
| 고정 여유(주차·승하차) | 3분 |

`도로거리 = Haversine × 1.35`. **결정**: 「거리 구간별 평균 속도」를 구간 누적 방식(앞 3km는 25km/h, 다음 12km는 40km/h, 나머지 55km/h)으로 해석한다. 전체 거리 하나로 속도를 고르면 3km 경계에서 더 먼 거리가 더 빨리 도착하는 역전이 생겨 우회 계산이 음수가 될 수 있기 때문이다. `분 = ceil(누적 주행분 + 3)`, 직선거리 1m 미만은 0분이다. 실측 근거가 없는 개발값이며 실제 경로 API·현장 표본으로 보정 전 운영값이 아니다.

추정 공급자는 `external=False`로 표시하고 경로 호출 예산(`maxRouteCallsPerDay/PerRequest`)을 적용하지 않는다(외부 호출·비용이 없음). 90초 deadline은 유지한다.

### 2. 식당 sidecar

- **결정**: JSON 대신 SQLite sidecar `server/travel-feedback/data/restaurant_meal_catalog.sqlite3`(+ `restaurant_meal_catalog_manifest.json`)를 쓴다. 리뷰 본문을 포함한 JSON은 수십 MB가 되어 컨테이너 메모리 한도(192MB)에 부담이 되므로, 서버는 식당 메타데이터·영업 구간만 메모리에 올리고 리뷰는 고른 후보만 읽기 전용으로 조회한다. 실제 크기는 구현 결과에 기록한다.
- 테이블: `meta`, `restaurants(restaurant_id, title, category, lng, lat, average_rating, review_count, collected_review_count, source_url, hours_json, hours_checked_at, hours_source_url)`, `reviews(review_id, restaurant_id, rank, rating, date_raw, content, tags)`. 리뷰는 날짜 원문(`YYYY.MM.DD.`) 최근순·원래 위치순 최대 8개, 본문 400자. 작성자 정보는 없고 추가하지 않는다.
- `catalogVersion`은 정렬된 모든 행·파서 버전·업종 정책의 논리 SHA-256이다. 생성 시각은 manifest에만 둔다.
- 식사 외 업종 기본값(`restaurant.nonMealCategories`): 실측 분포 확인 후 `카페, 디저트, 제과,베이커리, 아이스크림`(수집 단계 제외로 현재 0건, 재수집 대비 유지) + `단체,협회, 선교회, 양식업, 수산물판매, 구내식당, 배달도시락`. 술집·호프·칵테일바·와인바·실내포장마차처럼 애매한 업종은 빼지 않고 LLM의 식사 시간대 적합 판정(②)에 맡긴다. 빌드와 서버가 모두 적용한다.

### 3. 영업시간 해석 규칙 (`kakao-observed-week-hours-v1`)

지원하는 실측 형태(표본 조사 결과):

| 원문 | 해석 |
|---|---|
| `HH:MM ~ HH:MM` | 영업 구간. 종료 ≤ 시작이면 다음 날(자정 넘김), `24:00` 허용 |
| `HH:MM ~ HH:MM 브레이크타임` | 해당 구간 안의 휴게. 구간을 둘로 나눈다 |
| `HH:MM 라스트오더` | 그 시각을 포함하는 영업 조각의 주문 마감. 어느 조각에도 없거나 한 조각에 둘이면 해석 불가 |
| `휴무일` | 그 날 휴무 |
| `추석당일 휴무` 등 `… 휴무` | 특별 휴무(정규 규칙 아님) |
| 메모 `매주 X요일(, Y요일…) 휴무` | 정기 휴무 요일 |
| 메모 `M/D(요) 휴무`, `M/D(요) ~ M/D(요) 휴무` | 날짜 지정 휴무. 해당 날짜는 휴무로 판정 |
| 메모 `요기요 제공`, `연중무휴`, `브레이크타임 없음`, 상태 표시줄 | 영향 없음 |

**결정 — 관측 주간의 요일 투영**: 데이터는 7일 관측뿐이므로 요일별 관측을 그 요일의 규칙으로 쓴다(`hoursBasis=observed_week_projection`). 기존 데이터 계약의 「날짜별 원문을 반복 규칙으로 바꾸지 않는다」는 정본 DB 계약으로 유지하고, 이 투영은 D3/D4 필터를 위한 서버 sidecar의 명시적 추정이다. 화면에 확인일과 함께 「요일 패턴 기준」을 표시한다. 보수 규칙:

- 관측일이 공휴일(2026-09-24~26, 10-03, 10-05, 10-09 표; 관측 범위 2026-09-01~10-31 밖이면 식당 제외)이면, 영업 구간이 그 식당의 **공휴일·날짜 지정 휴무가 아닌 관측일(주말 포함)** 최빈 구간과 같을 때만 채택하고(최빈이 동률이면 채택하지 않음), 휴무면 정기 휴무 요일일 때만 휴무로 채택한다. 그 외는 그 요일 `unknown`.
- 특별 휴무·날짜 지정 휴무에 걸린 관측일은 그 요일 `unknown`.
- 같은 요일 관측이 여러 개이고 서로 다르면 `unknown`. 관측되지 않은 요일도 `unknown`.
- 정기 휴무 요일인데 평일 관측이 영업이면 충돌로 `unknown`.
- 여행 날짜의 요일이 `unknown`이면 그 날짜에는 후보에서 제외한다(D4를 요일 단위로 적용). 해석 불가 메모·토큰이 하나라도 있으면 식당 전체를 제외한다.
- 영업정보 신선도 차단은 하지 않는다(수집 2026-09-21~29). 확인일을 표시하고 알려진 제한에 둔다.

### 4. 후보 추출과 삽입 시뮬레이션

- 사전 필터: `직선(P,R)+직선(R,N)−직선(P,N) ≤ (maxDetour−3)/(1.35×60/55)` km. 추정 함수는 오목·증가이므로 이 조건을 어기면 추정 우회도 반드시 한도를 넘는다(누락 없는 필터).
- 도착 = `max(slot.start, gapStart + est(P→R))`(gapStart = P 출발 + 방문 여유). 식사 종료 = 도착 + 식사시간, N 도착 = 식사 종료 + est(R→N), 지연 = `max(0, N 도착 − slot.nextArrival)` 분 올림.
- `validate_restaurant_insertion()`에 `window_start/window_end`(그 날짜의 식사 허용 창) 인자를 추가해 도착이 slot 시작보다 늦어져도 식사 창 안이면 위반이 아니게 한다. 인자를 주지 않는 기존 호출은 동작이 같다.
- 시드: `sha256(requestId|slotId|catalogVersion)` 앞 16자리 정수로 `random.Random`; 식당 ID 정렬 목록에서 `sample`.
- **결정(구현 중 보완)**: 무작위 표본은 삽입 시뮬레이션에 지연·위반이 없는 후보에서 먼저 뽑고, 5곳이 안 될 때만 경고가 붙는 후보로 채운다. 모두 같은 필터를 통과한 식당이며, 고르자마자 경고가 뜨는 후보가 자리를 차지하지 않게 하기 위함이다(`restaurantCandidatePool.feasibleInsertion`).
- 공간 사전 필터의 bounding box 여유는 타원(초점 P·N, 장축 c+B)의 단반경 `0.5·sqrt(B²+2Bc)`를 쓴다. 우회 한도 B(km)는 기준 구간의 분 올림까지 고려한 `max(0.002, (D−3+1)/기울기)`다. 실제 카탈로그 전수 대조로 누락 0을 검사한다.
- `generationScope=trip` 요청은 하나의 90초 deadline을 공유하므로 남은 날짜마다 25초(`restaurant.reservePerRemainingDaySeconds`)를 남기고, 부족하면 그날 판정을 건너뛴다(`judgement_unavailable`, `request_deadline`). 화면은 하루 요청이라 영향이 없다.

### 5. LLM 판정

- 후보 리뷰 ID는 64자 해시라 LLM에는 후보별 짧은 참조(`c{후보}r{리뷰}`)를 보내고 서버가 실제 `review_id`로 변환·검증한다. 응답의 `evidenceReviewIds`는 실제 리뷰 ID다.
- strict JSON schema에는 문자열 길이 키워드를 쓰지 않고 `reason`은 서버가 80자로 자른다.
- timeout은 `min(30, 남은 deadline − 1)`초, 남은 시간이 5초 미만이면 호출하지 않고 `judgement_unavailable`.
- 다양성(서버): 같은 업종을 이미 고른 횟수 0 → `good`, 1 → `neutral`, 2 이상 → `poor`.

### 6. UI 상태

- 선택은 `state.mealSelections`(slotId → 후보)로 탭 메모리에만 둔다. 동선 무효화·다시 만들기·추천 변경 시 초기화한다.
- 클라이언트는 날짜별 요청을 보낼 **그 시점**의 선택으로 `tripFoodContext`를 만든다. 이미 받은 다음 날 결과는 다시 요청하지 않는다.
- 선택하면 해당 식사 행이 「도착–식사 종료 · 식당명」으로 바뀌고 앞뒤 추정 이동과 지연·위반 경고를 보인다. 렌더 후 같은 버튼에 포커스를 복원한다.

## 예외와 폴백

| 상황 | 동작 |
|---|---|
| 식당 sidecar 없음/손상 | 장소 동선은 정상, `restaurantIntegrationStatus=catalog_unavailable`, 로그는 코드만 |
| 후보 0곳 | `no_candidates`와 사유. LLM 호출 없음 |
| LLM 실패·거절·형식 오류·deadline 부족 | `judgement_unavailable`, 후보 유지·선택 가능 |
| 후보 누락/추가/중복 판정 | 그날 판정 전체 무효 → `judgement_unavailable` |
| 가짜 리뷰 근거·근거 없는 판정 | 그 후보만 `insufficient_evidence` |
| 장소 일정 실패 날짜 | 식당 단계 생략(식사 slot 없음) |
| 알 수 없는 tripFoodContext ID | 버림 |
| `ITINERARY_ROUTE_PROVIDER` 잘못된 값 | 동선 기능만 비활성, 평가·리뷰 API 유지 |

## 영향 범위

- 변경 파일: 위 관련 코드, 테스트(`server/travel-feedback/test_itinerary*.py`, 신규 `test_restaurant_*.py`, `scripts/test_itinerary_ui.cjs`), 문서(`docs/README.md`, `spec_083.md`, `spec_105.md`, `data_contracts.md`, `architecture.md`, `safety_privacy.md`, `evaluation.md`, 서버·UI README), `.env.example`.
- 데이터 마이그레이션: 기존 DB·지도 번들·카탈로그는 변경하지 않는다. 신규 sidecar만 생성한다.
- 호환성: v1 요청 수용. 응답은 v2(상위 호환 필드 추가). `restaurantIntegrationStatus` 값이 `pending`에서 바뀐다. 카카오 경로는 `ITINERARY_ROUTE_PROVIDER=kakao`로 되돌릴 수 있다.
- 보안·개인정보: 공개 식당 리뷰(작성자 없음)와 허용 목록 여행자 맥락만 OpenAI로 전송한다. 사용자 선택은 서버에 저장하지 않는다.

## 승인 기준

- `AC-10701` (`REQ-10701,10702`): 거리 구간 경계·누적 연속성·올림·같은 장소 0분 단위 검사, 카카오 키 없이 추정 공급자로 서비스 로드.
- `AC-10702` (`REQ-10703`): `ITINERARY_ENABLED` 미설정 + fake OpenAI 키로 서비스 로드, 하루 생성 성공(경로 외부 호출 0).
- `AC-10703` (`REQ-10704,10705`): 파서 일반·브레이크·라스트오더·휴무 요일·자정 넘김·공휴일·날짜 지정 휴무·해석 불가 → 제외 단위 검사. 실제 빌드 coverage와 원본 해시 불변.
- `AC-10704` (`REQ-10706,10707`): 우회 경계, 영업 경계(정확히 마감), 사용 식당 제외, 0곳 사유, 시드 결정성·상한 5, 삽입 지연/위반 계산.
- `AC-10705` (`REQ-10708~10710`): fake LLM 정상 판정, 가짜 리뷰 ID 강등, 후보 누락/추가 무효, 타임아웃 → `judgement_unavailable`이면서 장소 일정 유지, 호출 집계.
- `AC-10706` (`REQ-10711,10713`): 요청 상한·알 수 없는 ID·허용 목록 검증, LLM 입력에 이름·의견·MBTI 원문·좌표 없음.
- `AC-10707` (`REQ-10712`): UI 후보 표시, 접기, 선택·해제, 경고, 다음 날 `tripFoodContext`, 다시 만들기 초기화, 「추정」 표기, 모바일 가로 넘침 0.
- `AC-10708`: 기존 회귀(서버 unittest, `test_itinerary_ui.cjs`, `test_feedback_completion.cjs`) 통과, 오프라인 시나리오의 slot별 후보 수 분포·0곳 비율 보고.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-10701, AC-10702 | 추정 공급자 단위·설정 로드·키 없이 생성 | `python -m unittest discover -s server/travel-feedback -p "test_*.py"` (`test_route_estimate.py`, `test_itinerary_api.py`) |
| AC-10703 | 파서 fixture, 실제 빌드·검증 | `test_restaurant_hours.py`, `python scripts/build_restaurant_meal_catalog.py`, `python scripts/build_restaurant_meal_catalog.py --validate-only` |
| AC-10704, AC-10705, AC-10706 | 고정 카탈로그·fake LLM | `test_restaurant_candidates.py` |
| AC-10707 | 실제 브라우저(Playwright) | `node scripts/test_itinerary_ui.cjs` |
| AC-10708 | 회귀·오프라인 시나리오 | `node scripts/test_feedback_completion.cjs`, `python scripts/evaluate_restaurant_candidates.py` |

실제 OpenAI 호출 검증은 키가 있을 때만 별도로 수행하며, 없으면 「실제 API 미검증」으로 기록한다.

## 구현 결과

**로컬 구현·검증 완료, 실제 OpenAI 호출 미검증**이다. 모든 승인 기준을 키 없는 고정 데이터·오프라인 LLM 대역·실제 브라우저로 검증했다. 실제 계정의 모델 접근·응답 품질·지연·비용은 키가 없어 검증하지 않았으므로 상태는 `In Progress`로 둔다.

### 변경 파일

| 파일 | 역할 |
|---|---|
| `server/travel-feedback/route_provider.py` | `RouteEstimator`·`EstimatedRouteProvider`(외부 호출 없음, `external=False`), `create_route_provider()`; `KakaoRouteProvider`는 그대로 보존 |
| `server/travel-feedback/restaurant_hours.py` (신규) | 관측 주간 → 요일 영업 조각 파서, `meal_fits()`, `hours_summary()` — 빌드와 서버 공용 |
| `server/travel-feedback/restaurant_catalog.py` (신규) | sidecar 스키마·논리 digest·읽기 전용 로더(메타데이터 메모리, 리뷰는 후보만 조회) |
| `server/travel-feedback/restaurant_candidates.py` (신규) | 요청 맥락 검증, slot 후보 추출·삽입 시뮬레이션, `restaurant_fit` 1회 판정·검증·정렬 |
| `server/travel-feedback/itinerary_service.py` | 요청 v1/v2, 결과 v2, 추정 공급자 예산 제외, `route_estimated` 가정, 식당 단계 격리·deadline 예약 |
| `server/travel-feedback/itinerary_validation.py` | `validate_restaurant_insertion(window_start, window_end)` 선택 인자 |
| `server/travel-feedback/llm_client.py` | `restaurant_fit` task 지시문, adapter 프롬프트 버전 `itinerary-review-restaurant-v2` |
| `server/travel-feedback/feedback_api.py` | `ITINERARY_ENABLED=auto`, 공급자 선택, 식당 카탈로그 로드, 식당 모델·출력 상한, `origin_allowed()`, 핸들러 주입 |
| `server/travel-feedback/itinerary_policy.json` | v3: `routeEstimate`, `restaurant`, `routeCallBudgetScope` |
| `server/travel-feedback/Dockerfile`, `deploy_into_rail_release.py` | 새 모듈·sidecar 포함, `ITINERARY_ROUTE_PROVIDER`·`RESTAURANT_LLM_MODEL`·`ITINERARY_ENABLED=auto` |
| `server/travel-feedback/data/restaurant_meal_catalog.sqlite3`, `..._manifest.json` (신규) | 식당 sidecar와 coverage manifest |
| `server/travel-feedback/fake_llm_scheduler.py` (신규) | 테스트·오프라인 평가용 결정적 LLM 대역(이미지 미포함) |
| `scripts/build_restaurant_meal_catalog.py` (신규) | sidecar 생성·`--validate-only` |
| `scripts/run_trip_ai_local.py` (신규) | `.env`를 읽어 지도 UI+API를 한 출처로 실행(정적 경로 검증) |
| `scripts/evaluate_restaurant_candidates.py` (신규) | 오프라인 시나리오 후보 수 분포·우회 민감도 보고 |
| `map-ui/itinerary.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css` | 요청 v2·여행자 맥락, 날짜별 전송 시점 `tripFoodContext`, 후보 목록·선택·경고·「추정」 표기 |
| 테스트 | 신규 `test_route_estimate.py`(10), `test_restaurant_hours.py`(13), `test_restaurant_candidates.py`(26); `test_deploy_into_rail_release.py`, `scripts/test_itinerary_ui.cjs` 확장 |
| 문서 | 이 SPEC, `docs/README.md`, `spec_083.md`·`spec_105.md` 링크, `data_contracts.md`, `architecture.md`, `safety_privacy.md`, `evaluation.md`, 루트·서버·UI README, `.env.example` |

### 식당 카탈로그 coverage (2026-10-12 실제 생성)

입력 v3 DB SHA-256 `199f1434…ed58808`(생성 전후 동일, SPEC-106 기록값과 일치), 60,420,096 bytes. 출력 `restaurant_meal_catalog.sqlite3` **19,091,456 bytes**, SHA-256 `7f294be0…f3795672`, `catalogVersion` `8c87b5bd…bc5482`. 같은 입력으로 다시 생성하면 파일 해시가 같다.

| 구분 | 수 |
|---|---|
| 전체 식당 | 13,561 |
| **포함** | **9,522** (리뷰 35,508건, 리뷰 보유 7,899곳, 보유 식당 평균 4.5건) |
| 제외 합계 | 4,039 |
| 영업시간 미등록 `hours_not_provided` | 2,763 |
| 해석 불가 메모(재료 소진·격주·매달·비정기·자유 문장 라스트오더 등) `note_unsupported` | 977 |
| 영업 요일 없음(모든 요일 휴무/unknown) | 113 |
| 좌표 조회 불가 / ID 불일치 | 82 / 4 |
| 영업시간 미인식 `hours_unrecognized` | 78 |
| 식사 외 업종 | 12 |
| 브레이크 구간 밖 / 라스트오더 구간 밖 / 요일 불일치 | 7 / 2 / 1 |

미수집 32곳은 좌표 실패와 겹쳐 좌표 사유로 먼저 집계됐다. 포함 식당의 요일별 영업 수는 월 8,524 · 화 8,681 · 수 8,885 · 목 9,097 · 금 9,291 · 토 8,565 · 일 7,847이다. 요일 `unknown`은 공휴일 관측 1,984 · 미관측 250 · 날짜 지정 휴무 61(식당×요일)이다.

### 승인 기준 검증

| 기준 | 결과 | 명령 |
|---|---|---|
| AC-10701 | 구간 경계(3km→11분, 15km→29분, 40km→56분), 정수 분 경계 올림 오차 없음, 0~60km 단조, 1m 미만 0분, 외부 호출 0(`urlopen` 차단 상태), 잘못된 입력·비자동차 거부, 공급자 선택(기본 estimate, kakao, 잘못된 값 거부), 예산 1회 정책에서도 추정 공급자 생성 성공·`route_estimated` | `python -m unittest discover -s server/travel-feedback -p "test_*.py"` |
| AC-10702 | `ITINERARY_ENABLED`·카카오 키 없이 가짜 `OPENAI_API_KEY`만으로 `load_itinerary_service()`가 추정 공급자·식당 카탈로그와 로드되고, 실제 `OpenAIClient` 어댑터(모델 확인·strict schema·task 지시문)를 HTTP 층 대역으로 거쳐 하루 생성 성공(responses 호출 2회: 시간표+식당). 카탈로그 없음/잘못된 공급자 값의 격리 | 위 명령(`KeyOnlyStartupTests`) |
| AC-10703 | 파서 13건(일반·정확한 마감·브레이크·구간별 라스트오더·정기 휴무·자정 넘김·공휴일 다른 시간/휴무·날짜 지정 휴무·해석 불가 7종·미관측 요일·상태별 제외). 실제 빌드·`--validate-only` 통과(해시·논리 digest·integrity·FK·리뷰 상한·업종·중복 ID), 원본 해시 불변 | `python scripts/build_restaurant_meal_catalog.py`, `--validate-only` |
| AC-10704 | 우회 한도 정확히 같음/1분 초과, 13:00 마감 경계 포함/12:59 제외, 라스트오더·정기 휴무 제외, 사용 식당·식사 외 업종 제외, 0곳 사유 3종, 시드 결정성·상한 5·요청별 다른 표본, 지연/위반 계산, 가능한 삽입 우선 표본, 실제 카탈로그 전수 대조로 사전 필터 누락 0(동서 장거리 구간, 우회 0~4분 무작위 40건) | 위 명령(`CandidateTests`, `ServiceIntegrationTests`) |
| AC-10705 | 하루 1회 호출·짧은 참조→실제 64자 리뷰 ID, 판정 순서 정렬, 서버 다양성 우선, 가짜 참조·근거 없는 판정만 강등, 누락/추가/중복 → 그날 판정 무효, 공급자 오류·비밀 문자열 미노출·deadline 부족 → `judgement_unavailable`이면서 후보·장소 일정 유지, 리뷰 저장소 오류 격리, trip 요청 deadline 예약, 0곳이면 호출 없음 | 위 명령(`JudgementTests` 등) |
| AC-10706 | v1 요청 수용, 맥락 상한·형식·허용 목록(동행 6종, 18 feature, 방향) 위반 422, 알 수 없는 식당 ID 제거, 클라이언트 업종 대신 서버 업종, LLM 입력에 좌표·이름·MBTI·가중치·사용 ID 없음 | 위 명령, `node scripts/test_itinerary_ui.cjs`(요청에 `PRIVATE_` 없음) |
| AC-10707 | 실제 Chromium: 후보 3개 표시+`not_recommended` 접힘, 배지·이유·확인일·우회(추정)·카카오맵 새 창 링크, 키보드 Enter 선택·포커스 복원, slot당 1곳, 지연 경고, 선택 해제, 접힌 그룹 안 선택/해제 시 그룹 유지·포커스 유지, 판정 없음 후보 선택, 2일차는 선택 전 전송·3일차 요청에 선택 반영, 다시 만들기 초기화, 390px 가로 넘침 0, 페이지 오류 0 | `node scripts/test_itinerary_ui.cjs` — PASS 3줄 |
| AC-10708 | 서버 **144개 중 143개 통과**(기존 95 → 신규 49 추가). 실패 1건은 변경 전부터 실패하던 `test_itinerary_adapters…test_build_is_deterministic…`(커밋된 `itinerary_catalog.json`의 `sourceHash`가 현재 지도 번들 해시와 다름 — 이번 변경과 무관, Windows에서는 CRLF 때문에 파싱도 실패). `test_feedback_completion.cjs`, `test_ccu_mmr.cjs`, `test_preference_elicitation.cjs`, `test_preference_weight_budget.cjs`, `validate_ccu_mmr_dashboard.cjs` 통과. `evaluate_itineraries.py` 결과 SPEC-083과 동일(24후보/16배정/위반 0). `test_daily_type_limit.cjs`는 입력 라벨 파일이 작업 환경에 없어 실행하지 못했다(`ccu-mmr.js` 미변경). 변경 Python `py_compile`, JS `node --check`, `git diff --check` 통과 | 각 명령 |

### 오프라인 시나리오 (fake LLM, 추정 이동시간, 실제 카탈로그)

`python scripts/evaluate_restaurant_candidates.py`: 7개 시나리오(서부·동부 해안, 동부·서남부 중산간, 서귀포 해안, 오후 출발 저녁만, 오전 종료 점심만) × 화·금·토·일 = 28일, 생성 실패 0, 식사 slot 48개(점심 24·저녁 24).

| 우회 한도 | slot별 후보 수 분포 (0/1/2/3/4/5곳) | 0곳 비율 |
|---|---|---|
| 20분(기본) | 0/0/0/0/0/48 | 0% |
| 10분 | 0/0/0/2/2/44 | 0% |
| 5분 | 0/4/0/4/0/40 | 0% |

기본 20분에서 필터 후 후보 풀 크기는 점심 중앙값 264곳(최소 9: 새별오름→아르떼뮤지엄 중산간), 저녁 중앙값 761곳이다. 장거리 이동 구간(예: 카멜리아힐→용두암)은 타원이 넓어 수천 곳이 후보 풀에 들어간다. 이 수치는 후보 공급량이며 판정 품질·실제 영업 여부가 아니다.

### 추가 확인

- 로컬 실행기 전 구간 확인(일회성, 저장소 테스트 아님): `run_trip_ai_local.py` 서버 + 실제 Chromium UI + OpenAI HTTP 층 대역으로 2일 동선을 생성해 slot 4개 모두 후보 5곳, 선택 표시, 페이지 오류 0을 확인했다. `/healthz`·리뷰 별칭 경로·정적 파일 제공, `..`·UNC·드라이브·NUL 경로 차단을 확인했다.
- 카탈로그 2종을 올린 서버 프로세스 최대 RSS 약 90MB(컨테이너 한도 192MB), 하루 생성의 서버 계산 시간 약 0.1초(LLM 제외).
- 별도 검토 에이전트가 찾은 6건(작은 우회 한도 사전 필터 누락, Windows UNC 경로, 리뷰 조회 오류 시 판정 상태 불일치, trip 요청 deadline 소진, 공휴일 최빈 규칙 문구, 접힌 그룹 포커스)을 수정하거나 문서에 반영하고 회귀 테스트를 추가했다.
- 실제 API: **미검증**. `gpt-5.6-terra`는 공개 모델 ID 목록에서 존재를 확인했으나(2026-07 기준 외부 목록) 이 계정의 접근·strict schema 응답·추론 토큰으로 인한 `llm_incomplete` 빈도·지연·비용은 키가 있을 때 별도 확인해야 한다. 실패해도 장소 일정은 유지되고 후보는 `AI 판정 없음`으로 선택할 수 있다.

## 설계와 달라진 점

- 구현 요청의 JSON sidecar 대신 SQLite sidecar(메모리 한도, 위 2절).
- 「거리 구간별 평균 속도」를 구간 누적으로 해석(경계 역전 방지, 위 1절).
- 기본 업종 제외 목록을 실측 분포로 확정(카페류 0건, 비음식점 업종 추가).
- 영업시간 「완전 해석」을 요일 단위로 적용: 공휴일·특별 휴무 관측 요일만 `unknown`으로 두고 그 요일 여행에서만 제외.
- LLM에는 짧은 리뷰 참조를 보내고 서버가 실제 ID로 변환.
- `validate_restaurant_insertion()`에 식사 창 인자 추가.
- `ITINERARY_ENABLED` 미설정 시 키 유무로 자동 판정, 로컬 실행기 추가(D8).
- 0점 평균 별점(카카오 별점은 1~5)은 별점 없음(null)으로 저장한다.
- 무작위 표본에서 삽입이 가능한 후보를 먼저 뽑는다(4절). trip 범위 요청은 남은 날짜용 deadline을 남긴다.
- 식당 판정 출력 상한 `RESTAURANT_LLM_MAX_OUTPUT_TOKENS`를 추가했다.
- 변경 전부터 실패하던 `itinerary_catalog.json` 결정성 테스트는 범위 밖이라 고치지 않았다(알려진 제한).

## 알려진 제한

- 추정 이동시간은 실제 도로·교통·페리를 반영하지 않는다. 실제 경로 API 복귀 조건: 운영 품질 평가에서 추정 대비 실도로 오차가 허용선을 넘거나, 다음 장소 지연 경고의 오탐/미탐이 문제가 될 때 `ITINERARY_ROUTE_PROVIDER=kakao`와 호출 예산으로 되돌린다.
- 영업시간은 2026-09-21~29에 관측한 한 주의 요일 패턴이다. 공휴일·임시 휴무·계절 변동·재료 소진은 반영하지 않는다. 신선도 차단이 없다.
- 무작위 5곳은 품질 순위가 아니다. 사전 라벨링(SPEC-105) 후 라벨 기반 선정으로 대체한다.
- 리뷰는 식당당 최대 5건이고 평균 약 3건이라 `insufficient_evidence`가 자주 나온다.
- 다양성은 업종 문자열 반복만 센다(한식처럼 넓은 업종은 거칠다). 다음 날 결과는 그 요청을 보낼 때까지의 선택만 반영하며, 이미 받은 날짜는 다시 판정하지 않는다.
- 식당 선택 후 뒤쪽 일정 전체를 다시 만들지 않는다. 경고만 표시한다.
- 섬(우도·가파도·마라도·추자도)과 페리 구간은 추정 이동시간이 반영하지 못한다. 섬 일정의 식사 후보는 본섬 식당과 섞일 수 있다.
- 해석 불가 메모로 977곳이 제외됐다(자유 문장 메모는 모두 보수적으로 제외). 메모 분류를 넓히면 coverage가 늘 수 있다.
- 실제 OpenAI 호출(접근·품질·지연·비용) 미검증. 기존 `test_itinerary_adapters`의 카탈로그 결정성 테스트 1건은 변경 전부터 실패한다(지도 번들과 커밋된 일정 카탈로그 해시 불일치).
- 다음 단계: ① 키로 실제 호출 검증과 판정 품질 표본 점검, ② SPEC-105 사전 라벨링(음식 종류·로컬/인지도) 후 무작위 대신 라벨 기반 후보 선정, ③ 실제 경로 API 복귀 조건 평가, ④ 메모 분류 확장과 영업정보 재수집 주기.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-12 | 사용자 확정 결정 D1~D8, 요구사항·계약·설계·테스트 계획 작성(구현 전) |
| 2026-10-12 | 구현·로컬 검증 완료, 검토 6건 반영, coverage·시나리오 결과 기록. 실제 OpenAI 호출 미검증으로 In Progress 유지 |
| 2026-10-12 | D8을 Gemini 키로 확장([SPEC-108](spec_108.md)), 식당 판정도 `LLM_PROVIDER`로 고른 공급자 사용 |
