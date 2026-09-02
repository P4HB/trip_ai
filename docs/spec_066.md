# SPEC-066: 매칭 장소 카카오 리뷰 DB 연동·공개 상세 표시

- 상태: In Progress
- 작성일: 2026-09-02
- 최종 수정일: 2026-09-02
- 관련 이슈: 사용자 요청 — 수집한 카카오 리뷰를 매칭된 추천 장소 상세에서 조회하고 서버 배포
- 관련 문서: `docs/architecture.md`, `docs/data_contracts.md`, `docs/safety_privacy.md`, `docs/spec_057.md`, `docs/spec_060.md`
- 관련 코드: `scripts/build_kakao_review_db.py`, `server/travel-feedback/`, `map-ui/`
- 선행 SPEC: SPEC-020, SPEC-021, SPEC-057, SPEC-060

## 배경

현재 Map UI의 추천 가능 장소는 TourAPI `contentid` 1,663개이며 Kakao 수집 인벤토리와 승인된 교차 매칭으로 연결된 장소는 1,308개다. 두 Kakao 리뷰 CSV에는 공개 방문 후기 8,355행이 있지만 브라우저 런타임이나 서버 DB에는 연결되지 않았다. 교차 매칭된 장소 중 실제 수집 리뷰가 있는 TourAPI 장소는 1,094개다. 현재 공개 사이트는 정적 Map UI와 추천 만족도 저장 전용 Python·SQLite 서비스로 구성된다.

## 목표

- 승인된 `contentid`↔Kakao `place_id` 교차 매칭과 수집 리뷰를 결정적 SQLite로 만든다.
- 동일 출처의 읽기 전용 API로 장소별 리뷰를 페이지 단위 조회한다.
- 장소 상세 패널에서 수집 리뷰, 평점, 작성일, 태그, 좋아요 수, Kakao 원문 링크와 수집 시점을 표시한다.
- 기존 추천·지도·피드백 자동 저장과 Rail Desk 경로를 유지한 채 공개 서버에 배포한다.

## 비목표

- Kakao 실시간 재수집 또는 전체 후기 페이지네이션 수집
- 리뷰를 추천 점수나 41축 라벨에 반영
- 후기 작성자 표시명 공개 또는 DB 적재
- 카카오 미매칭 장소의 유사 이름 추정 연결
- 사용자 리뷰 작성·수정·삭제 기능

## 요구사항

- `REQ-6601`: DB 입력은 승인된 `candidate_crosswalk.csv`의 `overlap_status=existing_ready` 관계와 두 수집 스냅샷의 `reviews.csv`다.
- `REQ-6602`: 공급자 ID를 분리 보존하고 `contentid`↔`place_id` N:1·1:N 관계를 그대로 저장한다.
- `REQ-6603`: 리뷰 DB는 작성자 표시명을 포함하지 않고 본문 또는 본문 없음 상태, 평점, 작성일, 태그, 좋아요 수, Kakao 장소 URL, 입력 스냅샷과 결정적 리뷰 ID만 저장한다. 본문이 없어도 별점·태그가 있는 수집 후기는 보존한다.
- `REQ-6604`: 동일 리뷰는 `place_id`, 작성일, 평점, 본문, 태그, 좋아요의 정규화 해시로 중복 제거한다.
- `REQ-6605`: `GET /travel/api/places/{contentid}/reviews`는 유효한 숫자 ID만 받고 `limit=1..20`, `offset>=0`을 검증해 전체 수, 수집 시점, 연결 Kakao 장소와 리뷰 배열을 반환한다.
- `REQ-6606`: 미매칭 또는 리뷰가 없는 유효 장소는 오류가 아니라 빈 리뷰 배열과 `total=0`을 반환한다.
- `REQ-6607`: 리뷰 조회는 읽기 전용 SQLite 연결을 사용하고 공개 응답에 작성자명이나 서버 파일 경로를 포함하지 않는다.
- `REQ-6608`: 장소 상세는 로딩·성공·빈 결과·오류 상태를 분리하고 상세 패널을 닫거나 다른 장소를 선택했을 때 이전 응답을 잘못 표시하지 않는다.
- `REQ-6609`: UI는 리뷰가 수집 시점의 최대 5건 스냅샷임을 고지하고 Kakao 원문 링크를 새 창으로 제공한다.
- `REQ-6610`: 기존 피드백 POST API, `/travel/`, `/`, `/healthz`와 정적 추천 기능을 회귀 없이 유지한다.

## 입력과 출력

입력:

- `data/labeling/jeju/2026-08-24/kakao-place-label-v1/candidate_crosswalk.csv`
- `data/kakao/jeju/2026-08-19/reviews.csv`
- `data/kakao/jeju/2026-08-19/manifest.json`
- `data/kakao/jeju/2026-08-20/db-place-backfill/reviews.csv`
- `data/kakao/jeju/2026-08-20/db-place-backfill/review_manifest.json`

생성 출력:

- `server/travel-feedback/data/kakao_reviews.sqlite3`
- `server/travel-feedback/data/kakao_reviews_manifest.json`

API 응답은 `kakao-place-reviews-v1`이며 `place_id`는 TourAPI `contentid` 문자열이다. 리뷰 `date`는 원본 `YYYY.MM.DD.` 형식을 보존하고 `collected_at`은 시간대가 있는 ISO 8601 문자열이다.

## 설계

```text
승인 crosswalk + 두 Kakao reviews.csv
        -> 결정적 DB 생성·검증
        -> 읽기 전용 SQLite
        -> GET /travel/api/places/{contentid}/reviews
        -> 장소 상세의 Kakao 리뷰 섹션
```

추천 만족도 DB와 리뷰 카탈로그 DB는 파일·테이블·보존 정책을 분리한다. 리뷰 DB는 이미지에 포함된 읽기 전용 스냅샷이며, 피드백 DB만 영속 쓰기 볼륨을 사용한다. 브라우저는 장소 상세를 열 때만 최대 5건을 지연 조회한다.

## 예외와 폴백

- DB 파일이 없거나 무결성 검사에 실패하면 서비스 시작을 실패시켜 불완전 배포를 막는다.
- 유효하지 않은 ID·페이지 파라미터는 HTTP 400, 없는 API 경로는 404다.
- 조회 실패 시 지도·추천·기존 상세는 유지하고 리뷰 섹션만 재시도 안내를 표시한다.
- 본문이 비어 있고 평점·태그도 없는 행만 DB에서 제외한다. 본문이 없는 평점 후기는 본문 없음 상태로 표시하며 평점·작성일·좋아요 누락은 `null`, 태그 누락은 빈 배열로 보존한다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_066.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/safety_privacy.md`, `scripts/build_kakao_review_db.py`, `server/travel-feedback/*`, `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`, `map-ui/README.md`, 검증 스크립트, 서버 릴리스
- 데이터 마이그레이션: 원본 CSV를 수정하지 않는 신규 읽기 전용 SQLite 생성
- 호환성 영향: 기존 피드백 API 유지, 장소 상세에 비차단 리뷰 섹션 추가
- 보안·개인정보 영향: 공개 작성자 표시명을 DB·API·UI에서 제외하고 공개 장소 후기 스냅샷만 제공

## 승인 기준

- `AC-6601`: 생성기가 입력 해시·교차 관계·리뷰 중복을 검증하고 예상 coverage를 manifest에 기록한다.
- `AC-6602`: DB와 API 어디에도 원본 `reviewer` 값이나 `reviewer` 열이 없다.
- `AC-6603`: 리뷰가 있는 표본 장소는 전체 수와 최대 5건을 반환하고 빈 표본은 HTTP 200·빈 배열을 반환한다.
- `AC-6604`: 잘못된 ID·limit·offset이 거부되고 SQL 문자열이 입력으로 실행되지 않는다.
- `AC-6605`: 상세 화면에서 로딩·리뷰·빈 결과·오류 상태와 원문 링크가 정상 표시된다.
- `AC-6606`: Python·JavaScript 문법, API 단위 테스트, 대시보드 계약과 DB 무결성 검사가 통과한다.
- `AC-6607`: 공개 배포 후 리뷰 API·UI, 기존 피드백 API, `/`, `/healthz`, `/travel/`이 정상이고 컨테이너 재시작 뒤에도 동작한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-6601~AC-6602 | DB 결정성·스키마·coverage 검사 | `python scripts/build_kakao_review_db.py`, `python scripts/validate_kakao_review_db.py` |
| AC-6603~AC-6604 | API 단위 테스트 | `python -m unittest server/travel-feedback/test_feedback_api.py` |
| AC-6605~AC-6606 | 정적 계약·브라우저 QA | `node --check map-ui/app.js`, `node scripts/validate_ccu_mmr_dashboard.cjs`, 로컬 HTTP |
| AC-6607 | 공개 HTTPS·컨테이너 헬스·브라우저 회귀 | `/travel/`, 리뷰 API, `/travel/api/feedback`, `/`, `/healthz` |

## 구현 결과

- `scripts/build_kakao_review_db.py`가 승인된 Kakao ID 1,291개와 TourAPI 장소 1,308개의 관계를 보존하고, 입력 후기 8,355행 중 매칭 관계에 속한 고유 후기 4,817건을 작성자명 없이 SQLite로 생성한다. 리뷰가 있는 추천 장소는 1,094곳이며 입력 간 중복 후기 1건을 제거했다.
- 생성 DB는 같은 입력으로 두 번 재생성했을 때 SHA-256이 일치했고 `PRAGMA integrity_check=ok`, 금지 작성자 열 0개, 중복 review hash 0개를 확인했다.
- `travel-feedback` 서비스에 읽기 전용 `ReviewStore`와 `GET /travel/api/places/{contentid}/reviews`를 추가했다. 숫자 ID와 페이지 범위를 검증하고 리뷰가 없는 장소도 HTTP 200 빈 응답을 제공한다.
- Map UI 장소 상세에 비차단 후기 로딩, 본문·별점·작성일·태그·도움 수, 본문 없는 별점 후기 폴백, Kakao 원문 링크, 수집 한계 고지를 추가했다. 다른 장소 선택·상세 닫기 시 이전 요청을 중단하고 늦은 응답을 무시한다.
- Python API 단위 테스트 16건, Python·JavaScript 문법, 리뷰 DB validator, CCU-MMR 테스트와 실제 2,153개 지도 번들 대시보드 계약 검증이 통과했다.

## 설계와 달라진 점

- 초기 SPEC은 빈 본문 후기를 제외하려 했지만, 수집 데이터에는 본문 없이 별점만 있는 후기가 있어 추천 장소 coverage가 1,094곳에서 1,061곳으로 줄어드는 것을 데이터 게이트에서 확인했다. 별점 또는 태그가 있으면 보존하고 UI에서 본문 없음 상태를 명시하도록 계약을 먼저 수정했다.

## 알려진 제한

- 수집기는 Kakao가 당시 노출한 유용한 순 상위 후기 최대 5건만 보존하므로 전체 후기나 현재 상태를 뜻하지 않는다.
- 공개 운영 전 Kakao 약관·저작권 정책에 대한 별도 검토가 필요하다.
- 기존 `scripts/test_preference_elicitation.cjs`는 이 변경과 무관한 `travel-mbti-site/app/lib/preference-elicitation.js` 누락으로 실행되지 않는다. 실제 Map UI 모듈의 문법 검사와 이를 직접 불러오는 대시보드·CCU-MMR 검증은 통과했다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-02 | 사용자 승인 범위로 SPEC 작성 및 구현 시작 |
| 2026-09-02 | 본문 없는 별점 후기를 누락하지 않도록 nullable 본문·표시 폴백 계약 반영 |
| 2026-09-02 | 결정적 리뷰 DB·읽기 전용 API·장소 상세 UI 구현 및 로컬 계약 검증 완료 |
