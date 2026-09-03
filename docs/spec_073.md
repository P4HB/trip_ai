# SPEC-073: 모바일 장소 상세 추천 평가 입력

- 상태: Implemented
- 작성일: 2026-09-03
- 최종 수정일: 2026-09-03
- 관련 이슈: 사용자 요청 — 모바일에서 장소를 누르면 점수·의견 입력과 상세 정보를 함께 표시
- 관련 문서: `docs/spec_056.md`, `docs/spec_060.md`, `docs/spec_062.md`, `docs/spec_071.md`, `docs/spec_072.md`
- 관련 코드: `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-056, SPEC-060, SPEC-062, SPEC-072

## 배경

모바일에서 지도 장소를 누르면 사진·기본 정보·설명·카카오 후기는 열리지만 추천 만족도와 의견 입력은 추천 결과 카드 또는 일정 카드에서만 제공된다. 사용자가 지도와 장소 상세을 탐색하는 흐름 안에서 바로 평가하려면 기존 피드백 컴포넌트를 상세 시트에도 연결해야 한다.

## 목표

- 모바일 장소 상세에 추천 장소의 1~5점 만족도와 최대 300자 의견 입력을 제공한다.
- 추천 카드·일정 카드·모바일 상세의 동일 장소 평가를 즉시 동기화한다.
- 기존 서버 자동 저장과 이름·별칭 대기 정책을 그대로 사용한다.
- 일반 탐색 장소는 상세 정보만 표시하고 추천 후 평가할 수 있다는 안내를 제공한다.

## 비목표

- 추천되지 않은 모든 지도 장소를 피드백 로그 대상으로 확대
- 피드백 API·DB·로그 스키마 변경
- 추천 알고리즘·랭킹·평가 대상 계산 변경
- 데스크톱 장소 상세에 평가 입력 추가

## 요구사항

- `REQ-7301`: 760px 이하에서 장소 상세에 모바일 전용 평가 영역을 표시한다.
- `REQ-7302`: 현재 추천 결과에 포함된 장소는 기존 공통 피드백 컴포넌트로 1~5점과 최대 300자 의견을 입력할 수 있어야 한다.
- `REQ-7303`: 같은 장소의 추천 카드·일정 카드·모바일 상세 입력은 `placeId` 기준으로 점수·의견·글자 수가 양방향 동기화되어야 한다.
- `REQ-7304`: 점수 선택은 즉시, 의견은 800ms 후 기존 v3 자동 저장 경로를 사용하며 이름·별칭이 없으면 기존 정책대로 저장을 대기한다.
- `REQ-7305`: 추천 전에는 추천 실행 후 평가 가능 안내, 추천 후 비대상 장소에는 이번 추천 장소만 평가 가능 안내를 표시한다.
- `REQ-7306`: 761px 이상에서는 모바일 평가 영역을 표시하지 않고 기존 데스크톱 상세과 추천 카드 구성을 유지한다.
- `REQ-7307`: 모바일의 점수 버튼은 최소 44px, 의견 textarea는 iOS 자동 확대를 피하도록 16px 이상 글자 크기를 사용한다.
- `REQ-7308`: 사진·장소 정보·웹 조사 설명·카카오 후기·지도 중심·위치 복사와 상세 닫기 동작은 유지한다.

## 입력과 출력

입력과 서버 출력은 기존 `travel-recommendation-feedback-log-v3` 계약을 그대로 사용한다. 모바일 상세은 새 평가 대상을 만들지 않고 `recommendationFeedbackTargets()`에 이미 포함된 장소만 편집한다.

## 설계

```text
모바일 지도 장소 선택
  -> 공통 상세 렌더
  -> 추천 대상인가?
       yes: createRecommendationFeedback(place, "mobile-detail")
            -> placeId 공유 Map -> 카드·일정과 동기화 -> 기존 자동 저장
       no:  상세 정보 + 평가 가능 조건 안내
```

HTML에 모바일 평가 mount section을 추가하고 `renderMobileDetailFeedback`에서 추천 포함 여부에 따라 공통 피드백 또는 안내 상태를 렌더링한다. CSS media query로 760px 이하에서만 표시한다.

## 예외와 폴백

- 추천 결과가 갱신되거나 코스가 바뀌면 현재 열린 장소의 평가 가능 여부를 다시 렌더링한다.
- 장소 상세을 닫아도 메모리 피드백과 자동 저장 상태는 유지한다.
- 이름·별칭 미입력 시 입력은 메모리에 남고 기존 안내에 따라 저장만 대기한다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_073.md`, `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 데이터 마이그레이션: 없음
- 호환성 영향: 모바일 장소 상세에 기존 피드백 입력 인스턴스 추가
- 보안·개인정보 영향: 기존 고지·최소 수집·90일 보관 정책 유지

## 승인 기준

- `AC-7301`: 390px 화면에서 추천 장소를 열면 1~5점과 300자 의견 입력이 상세 정보와 함께 보이며 가로로 넘치지 않는다.
- `AC-7302`: 모바일 상세에서 변경한 평가가 동일 장소의 추천·일정 카드에 반영되고 반대 방향도 동기화된다.
- `AC-7303`: 추천 전·비추천 장소 안내가 구분되며 일반 장소가 로그 평가 대상으로 추가되지 않는다.
- `AC-7304`: 데스크톱 상세에는 새 평가 영역이 나타나지 않는다.
- `AC-7305`: 정적 계약, JavaScript 문법, 추천·선호·피드백 API 회귀 테스트가 통과한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-7301~AC-7304 | DOM·공통 컴포넌트·media query 정적 계약 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-7302~AC-7303 | 브라우저 390px 장소 상세 시나리오 | 로컬 Map UI |
| AC-7305 | 구문·추천·선호 회귀 | `node --check map-ui/app.js`; `node scripts/test_ccu_mmr.cjs`; `node scripts/test_preference_elicitation.cjs` |
| AC-7305 | 서버 API 회귀 | `python -m unittest server/travel-feedback/test_feedback_api.py` |

## 구현 결과

- 장소 상세 DOM에 `detailMobileFeedback` mount를 추가하고 760px 이하에서만 표시했다.
- `renderMobileDetailFeedback()`이 현재 추천 대상에는 공통 `createRecommendationFeedback(place, "mobile-detail")`을 연결하고, 추천 전·비대상 장소에는 서로 다른 안내 문구를 표시한다.
- 공통 `placeId` 상태를 사용하므로 상세·추천 카드·일정 카드의 점수, 의견, 글자 수가 즉시 동기화되고 기존 즉시/800ms 자동 저장 정책을 그대로 따른다.
- 모바일 점수 버튼을 44px로, 의견 입력 글자 크기를 16px로 조정했으며 사진·설명·후기·장소 액션은 기존 순서로 유지했다.

### 검증 결과

- `node --check map-ui/app.js`: 통과
- `node scripts/validate_ccu_mmr_dashboard.cjs`: 통과 (`recommendationReady=1663`, `labelsPerReadyPlace=41`)
- `node scripts/test_ccu_mmr.cjs`: 통과
- `node scripts/test_preference_elicitation.cjs`: 통과
- `python -m unittest server/travel-feedback/test_feedback_api.py`: 19건 통과
- `git diff --check`: 통과
- Chrome 390×844: 추천 장소 상세에서 1~5점·300자 의견·장소 설명·후기 영역 표시 확인, 상세의 4점 및 13자 의견이 추천 카드에 즉시 동기화됨을 확인, 이름·별칭 미입력 시 저장 대기 및 콘솔 오류 없음 확인

## 설계와 달라진 점

없음.

## 알려진 제한

- 추천되지 않은 일반 지도 장소의 탐색 피드백 수집은 별도 로그 계약이 필요하다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-03 | 사용자 승인 범위로 SPEC 작성 및 구현 시작 |
| 2026-09-03 | 모바일 상세 평가·안내·동기화 구현 및 정적·회귀·390px 브라우저 검증 완료 |
