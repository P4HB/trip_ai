# SPEC-080: 날짜 없는 여행 기간 선택

- 상태: Implemented
- 작성일: 2026-09-13
- 최종 수정일: 2026-09-13
- 관련 이슈: 사용자 요청 — 실제 날짜 대신 1박 2일·2박 3일·3박 4일로 여행 일수 선택
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [데이터 계약](data_contracts.md), [CCU-MMR 알고리즘](ccu_mmr_algorithm_draft.md), [SPEC-020](spec_020.md), [SPEC-064](spec_064.md), [SPEC-078](spec_078.md)
- 관련 코드: `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`, `map-ui/ccu-mmr.js`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-020, SPEC-064, SPEC-078

## 배경

현재 날짜 단계는 출발일·돌아오는 날을 모두 입력하거나 날짜 미정을 선택하는 두 경로만 제공한다. 날짜 미정은 월별 점수뿐 아니라 일정 생성도 제외하므로, 여행 날짜는 정하지 않았지만 여행 일수는 정한 사용자가 2~4일 일정을 받을 수 없다.

## 목표

- 실제 날짜 없이 1박 2일·2박 3일·3박 4일 중 하나를 선택할 수 있게 한다.
- 기간만 선택해도 선택한 일수만큼 기존 근사 일정을 생성한다.
- 실제 날짜·기간만 선택·일정 없는 추천 세 경로를 명확히 구분한다.

## 비목표

- 4박 5일 이상 또는 사용자 지정 일수 입력
- 기간만 선택한 요청의 계절·월 추정
- 실제 이동시간·숙박 예약·영업시간 기반 일정 최적화
- 축제·행사를 실제 날짜 없이 추천

## 요구사항

- `REQ-8001`: 날짜 단계에 1박 2일(2일), 2박 3일(3일), 3박 4일(4일) 선택지를 제공해야 한다.
- `REQ-8002`: 기간 선택 시 기존 날짜와 날짜 미정 선택을 해제하고, 날짜 입력 또는 날짜 미정 선택 시 기간 선택을 해제해야 한다.
- `REQ-8003`: 기간만 선택한 요청은 `travelWindow=null`, `tripDays=2|3|4`로 정규화해야 한다.
- `REQ-8004`: 정규화기는 날짜가 있으면 날짜에서 계산한 일수를 우선하고, 날짜가 없으면 유효한 `tripDays`로 일정을 생성해야 한다.
- `REQ-8005`: 기간만 선택하면 Month 점수를 활성화하지 않고 일차 날짜는 null로 유지해야 한다.
- `REQ-8006`: 축제·행사는 기존처럼 실제 출발일·종료일이 필요하며 기간만 선택 또는 날짜 미정을 완료로 처리하지 않아야 한다.
- `REQ-8007`: 데스크톱 단계형 UI와 모바일 단일 스크롤 UI에서 같은 선택·검증·요약 동작을 제공해야 한다.

## 입력과 출력

- UI 입력: `tripDurationDays` 빈 값 또는 문자열 `2`, `3`, `4`
- 추천 요청 추가 필드: `tripDays: integer | null`
- 날짜 지정: `travelWindow={startDate,endDate}`, `tripDays=null`; 월 점수와 날짜가 있는 일정 생성
- 기간 지정: `travelWindow=null`, `tripDays=2|3|4`; 월 점수 없이 날짜가 없는 일정 생성
- 일정 없음: `travelWindow=null`, `tripDays=null`; 장소 추천만 생성

## 설계

날짜 카드 아래에 기간 선택 버튼 3개와 숨은 select를 둔다. 기존 choice-card 동기화 경계를 재사용하되 날짜·기간·미정이 상호 배타가 되도록 change/input 이벤트에서 나머지 값을 해제한다. 엔진 `normalizeRequest`는 선택적 `tripDays`를 검증하고 `scheduleConfig.tripDays`에 날짜 계산값을 우선 적용한다. 기존 `dateForDay`의 null 폴백으로 기간 일정의 날짜 표시는 `1일차`만 사용한다.

## 예외와 폴백

- `tripDays`가 정수가 아니거나 1~30 범위를 벗어나면 요청을 거부한다.
- 날짜와 `tripDays`가 함께 들어오면 실제 날짜를 우선하고 직접 입력 일수는 무시한다.
- 축제·행사와 기간만 선택이 결합되면 날짜 단계에서 실제 날짜 입력을 안내한다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/ccu_mmr_algorithm_draft.md`, `docs/spec_080.md`, `map-ui/README.md`, `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`, `map-ui/ccu-mmr.js`, 관련 테스트
- 데이터 마이그레이션: 없음
- 호환성 영향: 기존 요청에 선택적 `tripDays`를 추가하며 기존 날짜·날짜 미정 요청은 동일하게 동작
- 보안·개인정보 영향: 개인 식별 정보가 아닌 기간 정수만 기존 추천·평가 요청에 포함

## 승인 기준

- `AC-8001`: 세 기간 버튼이 선택 상태를 명확히 표시하고 날짜·미정과 상호 배타로 동작한다.
- `AC-8002`: 1박 2일·2박 3일·3박 4일이 각각 2·3·4일 일정으로 생성된다.
- `AC-8003`: 기간 요청의 Month 블록은 비활성이며 일정 날짜는 null이다.
- `AC-8004`: 실제 날짜와 기존 날짜 미정 흐름 및 추천 결과가 회귀하지 않는다.
- `AC-8005`: 축제·행사에서 기간 선택은 완료로 계산되지 않고 실제 날짜를 요구한다.
- `AC-8006`: 390px 모바일과 데스크톱에서 가로 넘침 없이 선택·요약·검증이 동작한다.
- `AC-8007`: 앱·엔진 문법, 엔진 단위 테스트와 정적 대시보드 계약 검증이 통과한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-8001, AC-8005 | DOM·이벤트·검증 정적 계약 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-8002~AC-8004 | 엔진 정규화·일정 회귀 | `node scripts/test_ccu_mmr.cjs` |
| AC-8006 | 데스크톱·390px 브라우저 시나리오 | 로컬 `map-ui/` |
| AC-8007 | 문법·회귀 검사 | `node --check map-ui/app.js`; `node --check map-ui/ccu-mmr.js`; `git diff --check` |

## 구현 결과

- 날짜 단계에 1박 2일·2박 3일·3박 4일 선택 카드를 추가하고, 실제 날짜·기간·미정이 서로 하나만 선택되도록 동기화했다.
- 추천 요청에 선택적 `tripDays`를 추가해 실제 날짜가 없어도 2~4일 일정을 생성하며, 기간 일정은 월 점수와 일차별 실제 날짜를 사용하지 않는다.
- 축제·행사는 기간이나 미정 선택으로 날짜 요구사항을 통과할 수 없게 유지했다.
- 데스크톱 단계형 화면에서 기간 선택으로 다음 단계 진행, 실제 날짜와 기간·미정 간 상호 해제 동작을 브라우저에서 확인했다.
- 390×844 모바일 화면에서 세 기간 카드의 선택 상태와 가로 넘침 0px를 확인했다.
- 검증 결과:
  - `node --check map-ui/app.js`: 통과
  - `node --check map-ui/ccu-mmr.js`: 통과
  - `node scripts/test_ccu_mmr.cjs`: 통과
  - `node scripts/test_daily_type_limit.cjs`: 48개 실제 데이터 시나리오 통과
  - `node scripts/validate_ccu_mmr_dashboard.cjs`: 2,153개 장소·추천 가능 1,663개·41개 라벨 계약 통과
  - `git diff --check`: 통과

## 설계와 달라진 점

없음.

## 알려진 제한

- 기간만 선택하면 계절을 알 수 없어 Month 점수와 축제 날짜 교차검증을 적용하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-13 | 사용자 요청을 승인 근거로 구현 시작 |
| 2026-09-13 | 기간 선택 UI·요청 계약·일정 생성과 회귀 검증을 완료하고 Implemented로 전환 |
