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

- `ITINERARY_ENABLED`: 기본 `0`, 활성화는 `1`. 비활성이나 잘못된 카탈로그 설정은 기존 평가·리뷰 서비스를 유지한다.
- `OPENAI_API_KEY`: OpenAI 서버 키. 첫 structured 호출 전 지정 모델의 계정 접근을 확인한다.
- `ITINERARY_LLM_MODEL`: 개발 후보 `gpt-5.6-terra`; 서버에서 교체 가능.
- `ITINERARY_LLM_MAX_OUTPUT_TOKENS`: 기본 4,000, 허용 256~8,000.
- `KAKAO_MOBILITY_API_KEY`: 카카오모빌리티 자동차 미래 운행 길찾기 키.
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
