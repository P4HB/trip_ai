# SPEC-060: 추천 만족도 실시간 자동 저장

- 상태: Implemented
- 작성일: 2026-08-30
- 최종 수정일: 2026-08-30
- 관련 이슈: 사용자 요청 — 저장 버튼 없이 만족도 선택 즉시 서버 수집
- 관련 문서: [SPEC-059](spec_059.md), [시스템 아키텍처](architecture.md), [데이터 계약](data_contracts.md), [안전 및 개인정보](safety_privacy.md)
- 관련 코드: `map-ui/index.html`, `map-ui/app.js`, `map-ui/README.md`, `server/travel-feedback/`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-056, SPEC-057, SPEC-059

## 배경

현재는 모든 추천 장소 만족도를 완료한 뒤 사용자가 별도 저장 버튼을 눌러야 서버 로그가 생긴다. 실제 배포 후 저장 레코드가 0건이어서 완료 조건과 추가 클릭이 수집 이탈 지점으로 확인됐다. 사용자는 만족도 선택 자체를 저장 의사로 보고 선택 즉시 서버에 적재하기를 요청했다.

## 목표

- 추천 장소 만족도 1~5를 선택하거나 변경하면 별도 버튼 없이 즉시 서버에 저장한다.
- 자유 의견은 입력 중 요청 폭증을 막기 위해 마지막 입력 후 800ms에 저장한다.
- 한 추천 실행을 한 세션 레코드로 유지하고 최신 revision으로 갱신해 분석 시 변경 이력을 중복 사용자 응답으로 세지 않는다.
- 자동 저장 예정·저장 중·완료·오류 상태와 수집·보관 고지를 화면에 표시한다.

## 비목표

- 클릭별 이벤트 원장을 별도로 영구 보존
- 사용자 계정, 기기 식별자, IP, User-Agent, 쿠키 저장
- 페이지 방문만으로 로그 생성하거나 만족도 선택 전 사용자 선택을 전송
- 저장된 피드백의 추천 랭킹 자동 반영

## 요구사항

- `REQ-6001`: 추천 실행마다 임의 UUID `session_id`를 생성하며 만족도 또는 의견이 처음 바뀌기 전에는 네트워크 요청을 보내지 않는다.
- `REQ-6002`: 만족도 선택·변경은 즉시 `POST /travel/api/feedback`을 예약하고, 의견 입력은 마지막 입력 후 800ms에 예약한다.
- `REQ-6003`: 요청은 `travel-recommendation-feedback-log-v3` 최신 스냅샷이며 `session_id`, 단조 증가 `revision`, 생성·갱신 시각, 전체 사용자 선택·추천 결과와 모든 평가 대상의 현재 점수·의견을 포함한다.
- `REQ-6004`: 미평가 장소는 `score=null`, `score_label=null`로 포함하며 완료 수·전체 수·완료 여부가 현재 상태와 일치해야 한다.
- `REQ-6005`: 서버는 세션 UUID별 한 행을 UPSERT하고 저장 revision보다 큰 요청만 최신 payload로 갱신한다. 같은 revision·같은 payload와 낮은 revision은 중복·지연 응답으로 안전하게 처리하고 같은 revision·다른 payload는 409로 거부한다.
- `REQ-6006`: 클라이언트는 한 번에 한 요청만 전송하고 전송 중 변경이 생기면 직후 최신 revision을 추가 전송한다. 실패 시 입력을 유지하고 동일 revision을 자동 재시도한다.
- `REQ-6007`: 별도 저장 버튼을 제거하고 평가 영역에 선택 즉시 서버 저장, 90일 보관, 비수집 필드와 자동 저장 상태를 고지한다.
- `REQ-6008`: 서버는 v3 부분 스냅샷의 0..100개 완료 점수, 최대 100개 대상, 최대 300자 의견, 2 MiB 요청과 Origin을 검증한다.
- `REQ-6009`: IP별 메모리 rate limit은 자동 저장 트래픽을 고려해 분당 60건으로 조정하며 IP를 영속 저장하지 않는다.
- `REQ-6010`: 기존 v2 수동 제출 API와 테이블은 열린 이전 탭 호환성과 90일 보관을 위해 유지한다.

## 입력과 출력

- 입력: `POST /travel/api/feedback`, `application/json`, 최대 2 MiB
- 신규 본문: `TravelRecommendationFeedbackLogV3`
- 신규 저장: SQLite `feedback_sessions` 한 세션당 한 행
- 응답: 신규 201 또는 갱신·중복 200, `{ ok, session_id, revision, received_at, created, stale }`
- 보관 기간: 마지막 서버 갱신 시각 기준 90일
- v2 호환 입력·응답: SPEC-059 유지

## 설계

```text
만족도 click ───────────────┐
의견 input -- 800ms debounce ├─> 최신 revision snapshot
                            │       -> 동일 출처 POST
                            │       -> SQLite session_id UPSERT
UI 저장 상태 <───────────────┘       <- revision 영수증
```

- `revision`은 해당 페이지의 추천 세션 안에서 1부터 증가한다.
- 서버는 늦게 도착한 낮은 revision이 최신 상태를 덮어쓰지 못하게 한다.
- 추천 조건 변경·재실행·다른 코스 선택은 기존 요청을 취소하고 새 세션 UUID를 만든다.
- 저장 성공은 서버가 응답한 revision이 현재 revision 이상일 때만 최신 완료로 표시한다.

## 예외와 폴백

- 네트워크 실패는 현재 입력을 유지하고 상태 문구에 오류를 표시한 뒤 최대 15초 간격으로 재시도한다.
- 페이지가 재로딩되면 브라우저 메모리와 미전송 변경은 사라진다. `sendBeacon`과 Web Storage는 사용하지 않는다.
- 서버 저장 장애가 추천·지도 동작을 막지 않는다.
- v2와 v3 레코드는 별도 테이블에서 각각 보관·정리한다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_059.md`, `docs/spec_060.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/safety_privacy.md`, `map-ui/index.html`, `map-ui/app.js`, `map-ui/README.md`, `scripts/validate_ccu_mmr_dashboard.cjs`, `server/travel-feedback/*`, 서버 릴리스
- 데이터 마이그레이션: 신규 `feedback_sessions` 테이블 생성. 기존 `feedback_submissions` 유지
- 호환성 영향: v2 수동 저장은 API에서 허용하되 최신 UI에서는 제거
- 보안·개인정보 영향: 만족도 선택 즉시 고지된 payload가 전송됨. 방문·조회만으로는 수집하지 않음

## 승인 기준

- `AC-6001`: 첫 만족도 선택 한 번으로 서버에 revision 1 세션 행이 생성된다.
- `AC-6002`: 같은 세션의 점수 변경과 다른 장소 선택이 revision을 높여 같은 행을 갱신하고 행 수는 늘지 않는다.
- `AC-6003`: 낮은 revision이 최신 payload를 덮어쓰지 않고 같은 revision의 다른 payload는 409다.
- `AC-6004`: 의견 입력 여러 번은 800ms 뒤 최신 내용 한 번으로 저장되며 UI 상태가 예정·저장 중·완료를 표시한다.
- `AC-6005`: 추천 결과만 표시하거나 만족도를 누르지 않으면 서버 레코드가 생성되지 않는다.
- `AC-6006`: v2 제출 호환성, 요청 크기·Origin·점수·의견 검증과 90일 정리가 유지된다.
- `AC-6007`: 공개 지도·추천과 기존 `/`, `/healthz`, Rail Desk가 정상이며 신규 데이터는 컨테이너 재시작 뒤 유지된다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-6001~AC-6003, AC-6006 | API 단위 테스트 | `python -m unittest server/travel-feedback/test_feedback_api.py` |
| AC-6004~AC-6005 | UI 정적 계약과 브라우저 네트워크·상태 확인 | `node scripts/validate_ccu_mmr_dashboard.cjs`, `/travel/` |
| AC-6001~AC-6003, AC-6007 | 공개 API·SQLite 행/revision·재시작 검증 | 배포 서버 전용 볼륨 |
| AC-6007 | 기존 경로와 지도 회귀 | `/`, `/healthz`, `/travel/` |

## 구현 결과

- `map-ui/app.js`는 추천 실행마다 UUID 세션을 만들고 첫 만족도 선택을 즉시, 의견 입력은 마지막 입력 800ms 뒤 v3 전체 스냅샷으로 전송한다. 별도 저장 버튼을 제거하고 예정·저장 중·완료·자동 재시도 상태를 표시한다.
- 전송 중 입력은 최신 revision으로 후속 전송하며, 실패 재시도에는 같은 revision의 동일 payload를 재사용한다. 추천 재실행·조건 변경 시 기존 타이머와 요청을 취소하고 새 세션으로 분리한다.
- `server/travel-feedback/feedback_api.py`는 v3 부분 평가 스냅샷을 검증해 `feedback_sessions`에 세션별 최신 행을 저장한다. 낮은 revision은 무시하고 같은 revision의 다른 payload는 409로 거부한다. 기존 v2 API와 `feedback_submissions`는 유지했다.
- API 단위 테스트 12건, Python·JavaScript 문법 검사와 정적 대시보드 계약이 통과했다.
- 공개 서버 릴리스 `20260830-travel-feedback-autosave-v3`를 활성화했다. 공개 API에서 revision 1 생성과 revision 2 동일 행 갱신, 컨테이너 재시작 후 영속성을 확인하고 검증 세션을 삭제했다.
- 공개 브라우저에서 추천 10개·평가 버튼 50개, `만족도 0/10 완료`, 자동 저장·90일 고지, 수동 저장 버튼 0개, 지도 타일·마커와 콘솔 경고·오류 0건을 확인했다. 평가 선택 전에는 v3 행이 생성되지 않았다.
- 기존 `/`, `/healthz`, `/travel/`은 HTTPS 200이고 `edge`, `rail-api`, `travel-feedback` 컨테이너가 모두 healthy다.

## 설계와 달라진 점

- 공개 브라우저의 실제 만족도 클릭은 운영 수집을 만들기 때문에 수행하지 않았다. 같은 배포 빌드의 UI 상태는 브라우저에서 확인하고, 신규·갱신·영속 저장은 공개 HTTPS API와 서버 SQLite로 별도 검증했다.

## 알려진 제한

- 탭 종료 직전 800ms 이내 의견은 전송되지 않을 수 있다.
- 공개 사용자용 조회·삭제 UI는 없다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-30 | 만족도 선택 즉시 최신 세션 스냅샷을 자동 저장하는 범위 승인 및 구현 시작 |
| 2026-08-30 | v3 세션 UPSERT·UI 자동 저장·자동 재시도 구현, 공개 릴리스 배포와 회귀 검증 완료 |
