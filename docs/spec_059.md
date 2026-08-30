# SPEC-059: 추천 만족도 서버 적재 API

- 상태: Superseded
- 작성일: 2026-08-28
- 최종 수정일: 2026-08-28
- 관련 이슈: 사용자 정정 — 평가 로그 저장은 브라우저 JSON 다운로드가 아니라 서버 적재를 의미함
- 관련 문서: [SPEC-058](spec_058.md), [시스템 아키텍처](architecture.md), [데이터 계약](data_contracts.md), [안전 및 개인정보](safety_privacy.md), [배포 SPEC](spec_057.md)
- 관련 코드: `map-ui/`, `server/travel-feedback/`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-056, SPEC-057, SPEC-058
- 후속 SPEC: [SPEC-060](spec_060.md) — 저장 버튼 방식에서 선택 즉시 자동 저장으로 대체

## 배경

SPEC-058은 사용자의 `로그로 저장` 요청을 사용자 기기 JSON 다운로드로 해석했다. 사용자가 의도한 동작은 모든 만족도 입력 뒤 선택·추천 결과·피드백을 운영 서버에 적재하는 것이다. 현재 공개 Map UI는 정적 파일만 제공하므로 서버 수집 API와 영속 저장소가 없다.

## 목표

- 모든 고유 추천 장소의 만족도가 완료된 뒤 저장 버튼으로 로그를 동일 출처 서버 API에 전송한다.
- 서버가 입력을 검증하고 기존 Rail Desk 데이터와 분리된 영속 SQLite에 적재한다.
- 성공 시 영수증 ID를 화면에 표시하고 네트워크 실패 시 사용자가 같은 제출 ID로 안전하게 재시도할 수 있게 한다.
- 수집 목적·범위·보관 기간을 저장 버튼 가까이 고지한다.

## 비목표

- 사용자 계정, 실명, 연락처, 정확한 현재 위치 또는 클라이언트 IP 저장
- 공개 조회·수정·삭제 API와 운영 분석 대시보드
- 저장된 피드백을 추천 랭킹에 자동 반영
- 기존 Rail Desk API·DB 스키마 변경

## 요구사항

- `REQ-5901`: 브라우저는 모든 고유 장소의 만족도가 완료되고 사용자가 저장 버튼을 누른 경우에만 `POST /travel/api/feedback`으로 로그를 전송한다.
- `REQ-5902`: 제출 로그 스키마는 `travel-recommendation-feedback-log-v2`이며 제출 UUID, 생성 시각, 알고리즘·데이터 provenance, 사용자 선택, 여행 MBTI 상태, variant 세션, 전체 추천·일정 결과와 장소별 피드백을 포함한다.
- `REQ-5903`: 서버는 JSON Content-Type, 최대 2 MiB 요청, v2 스키마, UUID, 완료 건수 일치, 1~5 정수 점수, 최대 300자 의견과 최대 100개 피드백 항목을 검증한다.
- `REQ-5904`: 서버는 제출 UUID를 기본키로 사용해 재시도를 멱등 처리하고 `submission_id`, `received_at`, 원본 payload JSON을 분리된 SQLite에 저장한다.
- `REQ-5905`: 클라이언트 IP, User-Agent, 쿠키와 Rail Desk 계정 정보는 저장하지 않는다.
- `REQ-5906`: 성공 응답은 제출 UUID와 서버 수신 시각을 반환한다. UI는 성공 후 중복 클릭을 막고 입력 또는 추천 결과가 바뀌면 새 제출을 허용한다.
- `REQ-5907`: 실패 응답과 네트워크 오류는 입력을 유지하고 재시도 안내를 표시하며, 실패한 요청의 제출 UUID를 재사용한다.
- `REQ-5908`: 서버 적재 데이터는 90일 보관을 기본으로 하며 새 적재와 서비스 시작 시 만료 레코드를 삭제한다.
- `REQ-5909`: API는 CORS를 허용하지 않고, Origin이 있으면 공개 사이트 Origin과 일치해야 하며, 분당 IP별 20건을 초과하면 429를 반환한다. IP는 메모리 제한에만 사용하고 영속 저장하지 않는다.
- `REQ-5910`: 배포는 기존 `/`, `/healthz`, Rail Desk API·볼륨과 격리하고 `/travel/api/feedback`만 신규 서비스로 프록시한다.

## 입력과 출력

- 입력 경로: `POST /travel/api/feedback`
- Content-Type: `application/json`
- 요청 크기: 최대 2 MiB
- 입력 본문: `TravelRecommendationFeedbackLogV2`
- 성공: HTTP 201(신규) 또는 200(동일 UUID 재시도), `{ ok, submission_id, received_at, duplicate }`
- 실패: HTTP 400, 403, 413, 415, 422, 429 또는 500과 민감정보 없는 오류 코드
- 저장 위치: 전용 Docker 볼륨의 `/data/feedback.sqlite3`
- 보관 기간: 서버 수신 시각 기준 90일

## 설계

```text
Map UI 저장 버튼
  -> 동일 출처 POST /travel/api/feedback
  -> Caddy 경로 프록시
  -> travel-feedback Python 서비스
       -> 크기·Origin·스키마 검증
       -> SQLite INSERT (submission_id UNIQUE)
       -> 수신 영수증 반환
```

- 클라이언트는 `crypto.randomUUID()`로 제출 ID를 한 번 만들고 실패 재시도 동안 같은 payload를 유지한다.
- 서버는 Python 표준 라이브러리만 사용해 공격 표면과 외부 의존성을 줄인다.
- SQLite는 WAL 모드와 `busy_timeout`을 사용하고 단일 INSERT 트랜잭션으로 적재한다.
- 공개 API에는 조회 경로를 만들지 않는다. 운영자는 SSH와 Docker 볼륨을 통해서만 레코드 수·DB 상태를 확인한다.

## 예외와 폴백

- 완료되지 않은 만족도는 클라이언트와 서버 양쪽에서 거부한다.
- 잘못된 JSON·스키마·점수·의견 길이·건수는 저장하지 않고 4xx로 응답한다.
- 서버 응답을 잃은 재시도는 같은 UUID로 기존 영수증을 반환한다.
- 저장소 쓰기 실패는 500을 반환하고 기존 레코드를 손상시키지 않는다.
- API 장애가 있어도 지도 탐색과 추천 계산은 계속 동작한다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_058.md`, `docs/spec_059.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/safety_privacy.md`, `map-ui/index.html`, `map-ui/app.js`, `map-ui/README.md`, `scripts/validate_ccu_mmr_dashboard.cjs`, `server/travel-feedback/*`, 서버 Compose·Caddy 설정
- 데이터 마이그레이션: 기존 다운로드 파일 자동 이관 없음. 신규 SQLite 생성
- 호환성 영향: 기존 v1 브라우저 다운로드를 v2 서버 적재로 대체
- 보안·개인정보 영향: 여행 조건·취향·MBTI 응답·추천 결과·자유 의견을 서버에 90일 보관. 명시적 저장 동작과 고지 필요

## 승인 기준

- `AC-5901`: 전체 만족도 완료 후 버튼 클릭 한 번으로 서버가 201과 영수증을 반환하고 SQLite 레코드가 1건 증가한다.
- `AC-5902`: 같은 제출 UUID 재시도는 200·`duplicate=true`를 반환하며 레코드 수가 늘지 않는다.
- `AC-5903`: 미완료·잘못된 점수·긴 의견·과대 요청·잘못된 Origin을 서버가 저장 없이 거부한다.
- `AC-5904`: UI가 저장 중·성공·실패 상태를 표시하고 성공 후 버튼을 비활성화하며 입력 변경 시 새 제출 상태로 돌아간다.
- `AC-5905`: 저장 DB에 IP, User-Agent, 쿠키, Rail Desk 계정 정보가 없다.
- `AC-5906`: 공개 `/travel/` 지도·추천과 기존 `/`, `/healthz`, Rail Desk 컨테이너가 정상 동작한다.
- `AC-5907`: 서버 재시작과 새 릴리스 활성화 뒤에도 적재 레코드가 유지된다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-5901~AC-5903, AC-5905 | API 단위 테스트 | `python -m unittest server/travel-feedback/test_feedback_api.py` |
| AC-5904 | UI 정적 계약·공개 브라우저 제출 | `node --check map-ui/app.js`, `node scripts/validate_ccu_mmr_dashboard.cjs`, `/travel/` |
| AC-5901, AC-5902, AC-5907 | 공개 POST 후 서버 SQLite 집계·재시작 검증 | 배포 서버 전용 볼륨 |
| AC-5906 | 공개 상태·브라우저 지도 회귀 | `/`, `/healthz`, `/travel/` |

## 구현 결과

- `map-ui/app.js`가 v2 제출 UUID를 만들고 모든 고유 장소의 만족도 완료 뒤에만 동일 출처 API로 전송한다. 저장 중·성공·실패·멱등 재시도 상태와 15초 타임아웃을 구현했다.
- `server/travel-feedback/feedback_api.py`에 2 MiB 본문, Origin, UUID, 완료 건수, 1~5 점수, 300자 의견, 100건 상한을 검증하는 표준 라이브러리 HTTP 서비스를 구현했다.
- 전용 SQLite는 제출 UUID를 기본키로 사용하고 수신 시각·클라이언트 생성 시각·스키마·payload만 저장한다. 동일 UUID·동일 payload는 기존 영수증을 반환하고 다른 payload는 409로 거부한다.
- 메모리 기반 IP별 분당 20건 제한을 적용하되 IP·User-Agent·쿠키는 DB나 애플리케이션 로그에 저장하지 않는다. 90일 초과 레코드는 시작·신규 적재 시 정리한다.
- 공개 서버 릴리스 `20260828-travel-feedback-server-02`에 전용 컨테이너·볼륨과 Caddy `/travel/api/feedback` 프록시를 추가했다. Caddy가 `X-Travel-Client-IP`를 클라이언트 입력과 무관하게 덮어써 메모리 rate limit의 신뢰 경계를 만들며 기존 Rail Desk API·볼륨은 변경하지 않았다.
- API 단위 테스트 7건, Python·JavaScript 문법, 정적 대시보드 계약이 통과했다.
- 공개 API 신규 요청은 201, 동일 UUID 재시도는 200·`duplicate=true`, 잘못된 Origin은 403을 반환했다. 검증용 레코드는 컨테이너 재시작 뒤 유지됐으며 확인 후 제출 ID로 삭제했다.
- 공개 브라우저에서 추천 10개, 만족도 `0/10 → 10/10`, 서버 저장 버튼 활성화, 지도 타일 12개·마커 5개와 콘솔 경고·오류 0건을 확인했다. 브라우저에서는 검증 데이터의 실제 저장 버튼을 누르지 않고 공개 API 통합 검증을 별도로 수행했다.
- 기존 `/`, `/healthz`, `/travel/`은 모두 HTTPS 200이며 Rail Desk·edge·travel-feedback 컨테이너가 모두 healthy다.

## 설계와 달라진 점

- 브라우저 안전 정책상 공개 UI에서 실제 저장 클릭은 수행하지 않았다. 동일 빌드의 UI 활성화 상태를 브라우저로 확인하고, 공개 API 적재·멱등·거부·영속성은 별도 HTTPS 요청으로 검증했다.

## 알려진 제한

- 공개 사용자용 조회·삭제 기능은 이번 범위에 없다. 삭제 요청은 서버 운영자가 제출 ID로 처리한다.
- 메모리 기반 IP rate limit은 서비스 재시작 시 초기화되며 다중 인스턴스 간 공유되지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-28 | 사용자 정정에 따라 v1 다운로드를 서버 적재로 대체하는 범위 승인 및 구현 시작 |
| 2026-08-28 | v2 UI·검증 API·SQLite·보안 경계 구현, 공개 릴리스 배포와 회귀 검증 완료 |
| 2026-08-28 | 신뢰된 클라이언트 IP 전달 헤더를 추가한 `20260828-travel-feedback-server-02` 활성화 및 공개 적재 재검증 완료 |
