# SPEC-062: 모바일 단일 스크롤 추천 입력·결과 UI

- 상태: Implemented
- 작성일: 2026-08-30
- 최종 수정일: 2026-08-30
- 관련 요청: 모바일 베타 테스터가 선택 항목을 한 화면 흐름에서 모두 고르고, 추천 결과를 바로 아래에서 연속으로 확인하게 한다.
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [SPEC-020](spec_020.md)
- 관련 코드: `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`, `map-ui/README.md`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-020, SPEC-060

## 배경

현재 1,240px 이하 화면은 여행 조건과 추천 결과를 각각 좌우 drawer로 열며, 760px 이하 모바일에서도 5단계 중 한 단계만 표시한다. 베타 테스터는 조건 버튼과 결과 버튼을 오가야 하고 전체 선택을 검토하거나 추천 결과를 연속해서 읽기 어렵다.

## 목표

- 모바일에서 동행자부터 최종 확인까지 모든 선택 구간을 하나의 세로 페이지로 펼친다.
- 추천 실행 버튼을 선택 영역 끝에 두고 모든 필수 조건을 한 번에 검증한다.
- 실행된 추천 장소와 일정이 선택 영역 바로 아래에 이어서 표시되게 한다.
- 모바일에서 drawer 전환 버튼·닫기 버튼·결과 FAB를 제거하고 자연스러운 문서 스크롤을 사용한다.
- 데스크톱과 태블릿의 기존 5단계·drawer 동작과 추천 알고리즘·데이터 계약을 유지한다.

## 비목표

- 추천 점수, 코스 variant, 일정 생성, 만족도 자동 저장 로직 변경
- 여행 조건 필드나 추천 결과 스키마 변경
- 지도 제거 또는 모바일 전용 별도 애플리케이션 생성
- 계정·영구 프로필·분석 이벤트 추가

## 요구사항

- `REQ-6201`: 760px 이하에서 5개 입력 section을 모두 보이고 진행률·이전·다음 제어를 숨겨야 한다.
- `REQ-6202`: 모바일 submit은 1~4단계 필수 입력을 순서대로 검증하고 첫 오류 위치를 보여줘야 한다.
- `REQ-6203`: 모바일 추천 실행 뒤 output panel은 drawer가 아닌 정적 본문으로 입력 아래에 표시되어야 한다.
- `REQ-6204`: 모바일 추천 완료 시 결과 시작 위치로 자연스럽게 스크롤해야 한다.
- `REQ-6205`: 모바일 source order는 `입력 → 결과 → 지도`이며 결과가 없을 때는 빈 output panel을 숨겨야 한다.
- `REQ-6206`: 모바일 header의 drawer 진입 버튼·결과 FAB·panel 닫기·backdrop은 표시하지 않아야 한다.
- `REQ-6207`: 761px 이상에서는 SPEC-020의 단계 전환과 1,240px 이하 drawer 동작을 유지해야 한다.
- `REQ-6208`: 입력·추천·피드백 데이터는 기존 브라우저 메모리와 서버 자동 저장 경계를 유지해야 한다.

## 입력과 출력

입력 및 출력 계약은 SPEC-020과 현재 `ccu-mmr-v6-travel-mbti-three-axis` 결과를 그대로 사용한다. 변경은 viewport에 따른 DOM 표시·검증·배치에 한정한다.

```text
모바일: 모든 조건 section → 전체 검증 → 추천 실행 → 결과·일정 → 지도
기타 화면: 기존 단계 wizard → 추천 실행 → 기존 output panel/drawer
```

## 설계

- `matchMedia('(max-width: 760px)')`를 기준으로 모바일 stacked flow를 판별한다.
- 모바일에서는 모든 wizard section의 `hidden`과 `aria-hidden`을 해제하고 review summary를 최신 입력과 동기화한다.
- submit 시 단계별 기존 validator를 재사용해 첫 실패 section으로 이동한다.
- CSS media query에서 workspace를 세로 flex로 전환하고 sidebar·output panel을 정적 요소로 만든다.
- 결과가 생성되기 전 output panel은 숨기고 `has-recommendation` 이후 입력과 지도 사이에 표시한다.

## 예외와 폴백

- viewport가 760px 경계를 넘으면 현재 단계형 DOM 상태를 즉시 복구한다.
- 추천 오류가 발생하면 입력 끝의 기존 오류 영역을 사용하며 결과 위치로 이동하지 않는다.
- JavaScript가 실패하면 기존 지도 로딩 오류 정책을 유지한다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_061.md`, `docs/spec_062.md`, `docs/architecture.md`, `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`, `map-ui/README.md`, `scripts/validate_ccu_mmr_dashboard.cjs`, `graphify-out/`
- 데이터 마이그레이션: 없음
- 호환성 영향: 760px 이하 표시 흐름만 변경하며 알고리즘·API 계약은 유지한다.
- 보안·개인정보 영향: 없음. 기존 입력·자동 저장 범위를 확장하지 않는다.

## 승인 기준

- `AC-6201`: 390px viewport에서 동행자·날짜·여행 방식·취향·확인 section이 한 세로 흐름에 모두 표시된다.
- `AC-6202`: 필수 입력 누락 시 추천이 실행되지 않고 첫 누락 section과 오류가 표시된다.
- `AC-6203`: 유효한 입력 실행 후 추천 장소·일정이 입력 바로 아래에 표시되고 결과 시작점으로 이동한다.
- `AC-6204`: 모바일에서 조건·결과 drawer 버튼, panel 닫기, 결과 FAB와 backdrop이 보이지 않는다.
- `AC-6205`: 761px 이상에서 기존 단계별 hidden·진행 버튼과 태블릿 drawer가 유지된다.
- `AC-6206`: 모바일 가로 넘침 없이 선택 카드·날짜·고급 조건·추천 카드·피드백을 사용할 수 있다.
- `AC-6207`: 정적 dashboard 검증, 앱 구문 검사와 추천 알고리즘 회귀 검사가 통과한다.
- `AC-6208`: 변경 후 Graphify 지식 그래프가 source와 동기화된다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-6201~AC-6205 | 모바일 stacked flow DOM·CSS·이벤트 정적 검증 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-6201~AC-6206 | 390×844 모바일 브라우저에서 선택→실행→결과→지도 흐름 확인 | `python -m http.server 8080 -d map-ui` |
| AC-6205~AC-6207 | 구문·알고리즘 회귀 | `node --check map-ui/app.js`; `node scripts/test_ccu_mmr.cjs` |
| AC-6208 | 증분 그래프 갱신 | `graphify update .` |

## 구현 결과

- 760px 이하에서 5개 wizard section의 `hidden`·`aria-hidden`을 해제해 동행자부터 조건 확인까지 한 페이지에 펼쳤다.
- 모바일 submit은 기존 단계 validator를 1~4단계 순서로 재사용하고 첫 누락 section으로 이동한다.
- 첫 누락 오류는 선택 위치로 이동하는 동시에 상단 고정 오류 안내로 즉시 보이게 했다.
- 모바일 workspace를 `입력 → 결과 → 지도` 세로 flex로 전환하고 결과 생성 전 output panel을 숨겼다.
- 추천 성공 시 정적 output panel 시작점으로 부드럽게 이동하며 drawer class를 열지 않는다.
- 모바일 header의 조건·결과 버튼, panel 닫기, 결과 FAB와 backdrop을 숨기고 3열 선택 카드는 2열로 완화했다.
- 761px 이상 단계형 UI와 1,240px 이하 태블릿 drawer 동작은 기존 경계를 유지했다.
- `node --check map-ui/app.js`, `node scripts/validate_ccu_mmr_dashboard.cjs`, `node scripts/test_ccu_mmr.cjs`, `node scripts/test_preference_elicitation.cjs`, `git diff --check`가 통과했다.
- `graphify update . --no-cluster`를 실행해 코드 그래프를 3,817 nodes·6,072 edges로 갱신했다.

## 설계와 달라진 점

자동 브라우저 제어가 현재 세션에 노출되지 않아 스크린샷 기반 시각 QA는 수행하지 못했다. 대신 stacked DOM, 전체 검증, source order, 빈 결과 숨김과 결과 scroll을 정적 회귀 검사에 추가했다.

## 알려진 제한

- breakpoint는 기존 모바일 스타일 경계와 같은 760px을 사용한다.
- 실제 기기별 주소창·키보드 높이 차이는 친구 베타 테스트에서 추가 확인이 필요하다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-30 | 사용자 승인 범위로 모바일 단일 스크롤 입력·결과 UI 구현 시작 |
| 2026-08-30 | 모바일 stacked flow·전체 검증·입력 아래 결과·지도 순서 구현 및 회귀 검증 완료 |
