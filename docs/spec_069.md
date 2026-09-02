# SPEC-069: 추천 평가 로그 참여자 이름·별칭 입력

- 상태: Implemented
- 작성일: 2026-09-02
- 최종 수정일: 2026-09-02
- 관련 이슈: 사용자 요청 — 추천 결과 최상단에서 이름을 입력하고 평가 로그에 수집
- 관련 문서: `docs/spec_060.md`, `docs/data_contracts.md`, `docs/safety_privacy.md`, `docs/architecture.md`
- 관련 코드: `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`, `server/travel-feedback/feedback_api.py`, `server/travel-feedback/test_feedback_api.py`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-060

## 배경

현재 추천 평가 로그는 세션 UUID로만 구분하며 계정·실명을 수집하지 않는다. 사용자는 베타 테스트 로그를 참여자별로 구분하기 위해 추천 결과 최상단에 이름 입력란을 추가하고 저장 로그에 포함하도록 요청했다. 이름은 직접 식별 정보가 될 수 있으므로 별칭 사용을 허용하고 길이·보관·전송 시점을 제한해야 한다.

## 목표

- 추천 결과 최상단에 명확한 이름 또는 별칭 입력란을 제공한다.
- 입력값을 현재 `travel-recommendation-feedback-log-v3` 최신 세션 스냅샷에 포함한다.
- 서버가 필드 형식과 길이를 검증하고 기존 payload JSON에 90일 보관한다.
- 이름만 입력했을 때는 전송하지 않고 만족도 또는 의견이 처음 변경된 뒤에만 자동 저장한다.

## 비목표

- 사용자 계정·로그인·고유 회원 ID 도입
- 연락처·이메일·전화번호·정확한 위치 수집
- 이름 검색·공개 조회 API 또는 관리자 UI
- 이름의 진위 확인이나 기존 세션 간 영구 사용자 식별

## 요구사항

- `REQ-6901`: 추천 결과가 생성되면 결과 스크롤의 첫 항목에 `이름 또는 별칭` 입력란을 표시한다.
- `REQ-6902`: 입력은 앞뒤 공백을 제거한 1..30자이며 별칭을 사용할 수 있다는 안내와 90일 보관 고지를 표시한다.
- `REQ-6903`: 만족도·의견이 변경됐지만 이름이 비어 있으면 전송을 보류하고 입력란과 저장 상태에 이유를 표시한다.
- `REQ-6904`: 유효한 이름을 입력하면 보류 중인 최신 평가 스냅샷을 자동 저장한다.
- `REQ-6905`: 저장 후 이름 변경은 새 revision으로 같은 세션 행을 갱신한다. 저장된 이름을 지우면 nullable 값으로 갱신해 삭제할 수 있다.
- `REQ-6906`: `TravelRecommendationFeedbackLogV3.participant_name`은 `null` 또는 trim된 1..30자 문자열이다.
- `REQ-6907`: 서버는 제어 문자를 포함하거나 30자를 초과하거나 앞뒤 공백이 있는 이름을 HTTP 422로 거부한다.
- `REQ-6908`: 기존 v3 클라이언트의 필드 누락은 `null`로 허용해 하위 호환성을 유지한다.
- `REQ-6909`: 이름은 기존 session payload JSON 안에만 저장하고 별도 검색 인덱스·쿠키·Web Storage를 만들지 않는다.

## 입력과 출력

```text
TravelRecommendationFeedbackLogV3 {
  participant_name: null | string  # trim된 1..30자 이름 또는 별칭
  ...기존 필드
}
```

브라우저 입력은 현재 탭 DOM에만 유지한다. 만족도 또는 의견 변경 전에는 서버로 전송하지 않는다. 서버는 기존 `feedback_sessions.payload_json`에 전체 스냅샷을 저장하므로 DB 스키마 변경은 없다.

## 설계

```text
추천 실행 → 결과 최상단 이름/별칭 입력 표시

평가 변경 + 이름 없음 → 메모리에 유지, awaiting_name
이름 입력             → revision 증가 → 기존 동일 출처 API → 세션 UPSERT
저장 후 이름 변경      → 새 revision으로 이름 갱신
저장 후 이름 삭제      → participant_name=null로 갱신
```

## 예외와 폴백

- 이름이 비어 있을 때 추천·지도·평가 입력은 유지하되 신규 서버 요청만 보류한다.
- 입력 중 네트워크 실패는 기존 자동 재시도 정책을 유지한다.
- 오래된 클라이언트가 필드를 보내지 않으면 서버가 `null`로 해석한다.
- 이름에 연락처를 적지 말라는 안내를 제공하지만 자유 입력의 의미를 자동 추론·정정하지 않는다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_069.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/safety_privacy.md`, `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`, `map-ui/README.md`, `scripts/validate_ccu_mmr_dashboard.cjs`, `server/travel-feedback/feedback_api.py`, `server/travel-feedback/test_feedback_api.py`
- 데이터 마이그레이션: 없음. 기존 JSON payload 열 재사용
- 호환성 영향: 기존 v3의 필드 누락 허용
- 보안·개인정보 영향: 사용자가 입력한 이름 또는 별칭을 평가 로그와 함께 90일 보관. 연락처·계정·IP·User-Agent·쿠키는 계속 비수집

## 승인 기준

- `AC-6901`: 추천 결과 최상단에서 이름 또는 별칭을 30자까지 입력할 수 있다.
- `AC-6902`: 이름 없이 평가하면 전송이 보류되고 이름 입력 후 revision 1 payload에 값이 포함된다.
- `AC-6903`: 저장 후 이름 변경·삭제가 같은 세션의 다음 revision에 반영된다.
- `AC-6904`: 서버가 유효 이름과 기존 필드 누락을 허용하고 잘못된 이름은 422로 거부한다.
- `AC-6905`: 90일 보관·전송 시점·별칭 권장 고지와 데이터 계약·안전 문서가 실제 동작과 일치한다.
- `AC-6906`: API·dashboard·추천 회귀와 데스크톱·모바일 브라우저 QA가 통과한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-6901~AC-6903 | DOM·payload·상태 정적 계약과 브라우저 QA | `node scripts/validate_ccu_mmr_dashboard.cjs`, 로컬 Map UI |
| AC-6904 | 유효·누락·초과·공백·제어문자 API 단위 테스트 | `python -m unittest server/travel-feedback/test_feedback_api.py` |
| AC-6905 | 문서·화면 고지 대조 | `docs/`, `map-ui/index.html` |
| AC-6906 | 구문·추천 회귀 | `node --check map-ui/app.js`; `python -m py_compile server/travel-feedback/feedback_api.py`; `node scripts/test_ccu_mmr.cjs` |

## 구현 결과

- 추천 결과 스크롤 첫 항목에 30자 제한 `이름 또는 별칭` 입력란과 별칭·90일 보관·연락처 비입력 안내를 추가했다.
- 이름 없이 만족도·의견을 입력하면 브라우저 메모리에 보류하고, 이름 입력 시 최신 평가를 revision 1로 자동 저장한다. 저장 후 이름 변경과 삭제도 다음 revision에 반영한다.
- v3 payload에 nullable `participant_name`을 추가하고 서버가 길이·trim·제어문자를 검증한다. 기존 필드 누락과 `null`은 호환 입력으로 유지하며 별도 DB 열이나 인덱스는 만들지 않았다.
- 데스크톱 1,280px와 모바일 390px 브라우저 QA에서 결과 최상단 표시, 빈 이름 보류 상태, 유효 이름 입력 후 pending 상태와 전체 너비 입력 레이아웃을 확인했다.
- 검증 결과:
  - `node --check map-ui/app.js`: 통과
  - `python -m py_compile server/travel-feedback/feedback_api.py`: 통과
  - `node scripts/validate_ccu_mmr_dashboard.cjs`: 통과, 추천 가능 1,663곳 계약 유지
  - `python -m unittest server/travel-feedback/test_feedback_api.py`: 19개 통과
  - `node scripts/test_ccu_mmr.cjs`: 통과

## 설계와 달라진 점

- 없음. 정적 로컬 서버는 POST API를 제공하지 않아 브라우저 QA의 실제 성공 응답은 확인하지 않았고, 동일 payload 저장과 검증은 API 단위 테스트로 확인했다.

## 알려진 제한

- 별칭의 동일인 여부와 이름의 진위는 검증하지 않는다.
- 공개 사용자용 조회 UI는 없으며 삭제는 기존 세션 ID 운영 절차를 사용한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-02 | 사용자 승인 범위로 SPEC 작성 및 구현 시작 |
| 2026-09-02 | 이름·별칭 UI, 자동저장 게이트, v3 계약·서버 검증, 문서와 회귀 테스트 구현 완료 |
