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
