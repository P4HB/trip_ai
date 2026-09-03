# SPEC-072: 장소 상세 내부 추천 점수 trace 숨김

- 상태: In Progress
- 작성일: 2026-09-03
- 최종 수정일: 2026-09-03
- 관련 이슈: 사용자 요청 — 장소 상세의 coverage·R·MMR·P/A/M·중복 유사도·활성 블록·축별 계산 내역 제거
- 관련 문서: `docs/spec_056.md`, `docs/spec_071.md`, `docs/ccu_mmr_algorithm_draft.md`
- 관련 코드: `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-056, SPEC-071

## 배경

SPEC-071은 장소 상세에서 41개 라벨과 자유 텍스트 제약만 제거하고 `내부 추천 상세` trace는 명시적으로 유지했다. 그 결과 추천된 장소를 열면 coverage, 관련도, MMR, P/A/M, 중복 유사도, 활성 블록과 선호 축별 계산 내역이 일반 사용자에게 계속 노출된다.

## 목표

- 장소 상세에서 `내부 추천 상세` 영역 전체를 제거한다.
- 추천 계산 결과와 피드백 로그·전체 출력 JSON의 데이터는 유지한다.
- 장소 순위 badge, 사진, 설명, 카카오 후기와 지도 동작은 유지한다.

## 비목표

- CCU-MMR 계산식·가중치·추천 순위 변경
- 추천 결과 객체나 피드백 로그 스키마 변경
- 개발용 전체 출력 JSON 제거
- 추천 카드·일정 카드 구성 변경

## 요구사항

- `REQ-7201`: 장소 상세 DOM에 내부 추천 trace 섹션이 없어야 한다.
- `REQ-7202`: 장소를 선택하거나 추천 코스를 변경해도 내부 추천 trace를 렌더링하는 코드 경로가 없어야 한다.
- `REQ-7203`: coverage, R, MMR, P/A/M, 중복 유사도, 활성 블록, 축별 x/u/w 값은 장소 상세 사용자 화면에 표시하지 않는다.
- `REQ-7204`: 추천 결과 데이터와 계산, 순위 badge, 피드백 자동 저장은 유지한다.
- `REQ-7205`: 제거된 DOM·렌더러·문구가 다시 추가되지 않도록 정적 회귀 검사를 둔다.

## 입력과 출력

입력과 추천 결과 데이터 계약은 변경하지 않는다. 출력 중 장소 상세 화면의 내부 계산 trace만 제외한다.

## 설계

`index.html`의 `detailScoreTrace` 섹션, `app.js`의 DOM 참조·`scorePill`·`renderScoreTrace`·호출, 전용 CSS를 제거한다. 추천 객체와 `LABEL_NAMES`는 다른 내부 결과 표시와 로그에서 계속 사용한다.

## 예외와 폴백

- 추천된 장소와 일반 지도 장소 모두 동일한 상세 구조를 사용한다.
- 추천 정보가 있어도 상세에는 계산 trace를 만들지 않는다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_071.md`, `docs/spec_072.md`, `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 데이터 마이그레이션: 없음
- 호환성 영향: 사용자용 장소 상세 표시만 단순화
- 보안·개인정보 영향: 없음

## 승인 기준

- `AC-7201`: 추천된 `[제주올레 21코스] 하도-종달 올레` 상세에 내부 추천 상세와 점수 계산 내역이 나타나지 않는다.
- `AC-7202`: 추천 결과·순위·피드백 로그의 계산 데이터가 기존과 동일하게 생성된다.
- `AC-7203`: JavaScript 문법, 대시보드 계약, CCU-MMR과 선호 입력 회귀 테스트가 통과한다.
- `AC-7204`: 공개 배포 후 메인·헬스·여행 UI·리뷰 API가 정상이고 배포 정적 파일에 제거 대상 DOM·렌더러가 없다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-7201 | 제거 대상 DOM·렌더러·문구 부재 정적 계약 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-7202~AC-7203 | 추천·선호 회귀 | `node scripts/test_ccu_mmr.cjs`; `node scripts/test_preference_elicitation.cjs` |
| AC-7203 | 구문 검사 | `node --check map-ui/app.js` |
| AC-7204 | 공개 HTTPS와 컨테이너 헬스 | 운영 `/`, `/healthz`, `/travel/`, 리뷰 API |

## 구현 결과

구현 완료 후 기록한다.

## 설계와 달라진 점

없음.

## 알려진 제한

- 개발용 `전체 출력 JSON`은 본 SPEC의 제거 대상이 아니다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-03 | 사용자 승인 범위로 SPEC 작성 및 구현 시작 |
