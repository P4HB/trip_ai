# SPEC-065: 여행 MBTI 중립 선택지와 단일 취향 입력 흐름

- 상태: Implemented
- 작성일: 2026-09-02
- 최종 수정일: 2026-09-02
- 관련 요청: 여행 MBTI의 이분법 선택에 `둘 다 좋아요`·`둘 다 마음에 안 들어요`를 추가하고, MBTI 뒤에 중복 노출되는 바다·풍경 등 수동 취향 선택을 제거한다.
- 관련 문서: [문서 색인](README.md), [SPEC-019](spec_019.md), [SPEC-020](spec_020.md), [시스템 아키텍처](architecture.md), [데이터 계약](data_contracts.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md)
- 관련 코드: `map-ui/preference-elicitation.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css`, `scripts/test_preference_elicitation.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: [SPEC-019](spec_019.md), [SPEC-020](spec_020.md), [SPEC-064](spec_064.md)

## 배경

현재 여행 MBTI의 18개 상황 질문과 최대 3개 가상 여행지 비교는 한쪽 선택 또는 건너뛰기를 중심으로 구성되어 있다. 사용자는 두 장면이 모두 좋거나 모두 마음에 들지 않을 수 있지만 이를 표현할 수 없다. 또한 여행 MBTI로 연속형 원자 라벨 선호를 만든 뒤 같은 취향 단계에서 바다·풍경 등 프리셋과 세부 라벨을 다시 선택하게 해 같은 의도를 두 번 묻는 혼동이 있다.

## 목표

- 모든 여행 MBTI 상황 질문과 가상 여행지 비교에서 양쪽 긍정·양쪽 부정을 표현할 수 있게 한다.
- 양쪽 선택이 유형 축을 억지로 한쪽으로 기울이지 않으면서 추천용 연속 취향에는 구분되는 신호를 남기게 한다.
- 추천 입력의 여행 취향 경로를 여행 MBTI 하나로 통일한다.
- 여행 MBTI를 적용하지 않은 사용자는 취향 단계에서 검사 진입점만 보게 하고 추천을 실행할 수 없게 한다.

## 비목표

- A/R·O/I·L/H 세 축이나 8개 유형 체계 변경
- CCU-MMR의 P/A/M 비율, 후보 자격, MMR, 코스 variant, 일정 알고리즘 변경
- 계정 기반 MBTI 프로필 저장 또는 재사용
- 질문 문구나 가상 여행지 카탈로그 전면 개편

## 요구사항

- `REQ-6501`: 18개 상황 질문은 기존 A·B와 함께 `둘 다 좋아요`, `둘 다 마음에 안 들어요`, 건너뛰기를 지원해야 한다.
- `REQ-6502`: 최대 3개 가상 여행지 비교도 A·B와 함께 `둘 다 좋아요`, `둘 다 마음에 안 들어요`, 건너뛰기를 지원해야 한다.
- `REQ-6503`: 양쪽 선택은 A/R·O/I·L/H 축 evidence를 추가하지 않아야 한다. 명확한 A·B 응답만 유형 문자를 기울인다.
- `REQ-6504`: 상황 질문의 양쪽 긍정은 두 선택지 feature evidence 평균을 감쇠한 긍정 신호로, 양쪽 부정은 그 반대 부호의 회피 신호로 기록해야 한다.
- `REQ-6505`: 가상 여행지의 양쪽 긍정은 두 카드에 나타난 feature 강도 평균을 감쇠한 긍정 신호로, 양쪽 부정은 그 반대 부호의 회피 신호로 기록해야 한다. 두 선택의 상대 차이는 어느 쪽에도 가산하지 않는다.
- `REQ-6506`: `map-ui` 취향 단계에서 프리셋, `취향 없이 골고루`, 수동 세부 취향 입력을 제거해야 한다.
- `REQ-6507`: 적용된 여행 MBTI 프로필이 없으면 취향 단계 완료 조건은 false이고, 검사 진입 카드만 표시해야 한다.
- `REQ-6508`: 여행 MBTI 프로필을 적용하면 같은 프로필에서 materialize한 최대 8개 연속 preference만 추천 요청에 사용하고 취향 단계가 완료되어야 한다.
- `REQ-6509`: 적용 뒤에는 유형과 추천 반영 취향을 표시하고 `다시 검사`로 교체할 수 있어야 한다.
- `REQ-6510`: 응답·프로필은 기존처럼 브라우저 메모리와 만족도 자동 저장 snapshot 범위를 유지하며 Web Storage를 추가하지 않아야 한다.

## 입력과 출력

질문 응답 `optionId`는 `a | b | both_like | both_dislike | skip`을 허용한다. 가상 장소 응답 `choice`도 같은 값을 허용하며, 과거 snapshot 호환을 위해 기존 `tie`는 입력 정규화에서 계속 허용하되 새 UI에서는 만들지 않는다.

출력 프로필 구조와 `traveler-preference-profile-v2-three-axis` schema는 유지한다. 의미 변경은 프로필의 `versions.questionnaire`, `versions.pairCatalog`, `versions.estimator`를 올려 추적한다.

## 설계

### 상황 질문

```text
A 또는 B
  → 기존 option.axisValue와 option.effects를 그대로 사용

both_like
  → axis evidence 0
  → feature evidence = +0.75 × (effects_A + effects_B) / 2

both_dislike
  → axis evidence 0
  → feature evidence = -0.75 × (effects_A + effects_B) / 2
```

선택지별 signed effect를 평균하므로 서로 반대인 특성은 상쇄되고 두 장면에 공통으로 남는 특성만 주로 반영된다. 감쇠 계수 `0.75`는 한쪽을 명확히 고른 답보다 확신도를 낮춘다.

### 가상 여행지 비교

```text
A 또는 B
  → 기존 두 카드 feature 차이 × 1.25

both_like
  → 상대 차이 evidence 0
  → feature evidence = +0.60 × (features_A + features_B) / 2

both_dislike
  → 상대 차이 evidence 0
  → feature evidence = -0.60 × (features_A + features_B) / 2
```

가상 카드의 feature 값은 `0..1` 존재 강도이므로 두 카드에 강하게 나타나는 특성이 주로 남는다. 감쇠된 절대 신호는 기존 A/B 상대 비교보다 약하게 반영한다.

### 취향 단계 상태

```text
프로필 없음 → MBTI 검사 카드만 표시 → 단계 미완료
검사 결과 적용 → 적용 결과 카드 표시 → profile preference로 단계 완료
다시 검사 → 새 결과 적용 시 기존 profile preference를 원자적으로 교체
```

수동 프리셋과 원자 라벨 행은 DOM과 이벤트 경계에서 제거한다. 추천 요청의 `preferences`는 적용 프로필의 `materializePreferences()` 결과만 사용한다.

## 예외와 폴백

- `both_like`, `both_dislike`, 건너뛰기가 많아 active feature가 하나도 없으면 결과는 볼 수 있지만 적용 버튼을 비활성화하고 다시 답하도록 안내한다.
- 한 축의 방향 evidence가 완전히 0이면 기존 8유형 호환을 위해 결정적 0점 처리 규칙을 유지하고 confidence를 0으로 표시한다. 해당 유형 문자는 추천 점수에 사용하지 않는다.
- 과거 `tie` pair 응답은 방향·feature evidence가 없는 중립 응답으로 계속 읽는다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_065.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/recommendation_algorithm.md`, `docs/evaluation.md`, `map-ui/README.md`, `map-ui/preference-elicitation.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css`, `scripts/test_preference_elicitation.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 데이터 마이그레이션: 없음
- 호환성 영향: 프로필 schema는 유지하고 내부 component version만 증가한다. 기존 수동 preset UI 경로는 제거된다.
- 보안·개인정보 영향: 새 저장소·전송 경로 없음. 기존 만족도 snapshot에 선택 ID가 포함되는 범위만 유지한다.

## 승인 기준

- `AC-6501`: 상황 질문과 가상 여행지 화면 각각에 양쪽 긍정·양쪽 부정 선택지가 표시되고 다음 질문으로 진행한다.
- `AC-6502`: 양쪽 선택은 axis answered count·mean을 바꾸지 않으며 양쪽 긍정과 양쪽 부정의 feature mean 부호가 대칭이다.
- `AC-6503`: 양쪽 선택의 feature evidence가 A/B 명확 선택보다 약하고 component version으로 구분된다.
- `AC-6504`: 취향 단계 초기 DOM에 바다·풍경 프리셋, 취향 없음, 수동 세부 조정이 없고 MBTI 검사 진입만 표시된다.
- `AC-6505`: MBTI 미적용 상태에서는 취향 단계와 전체 필수 조건이 미완료이고 적용 뒤 완료된다.
- `AC-6506`: 적용 프로필에서 생성한 preference가 개인화 추천 요청과 trace에 유지되고 기존 추천·일정 회귀가 통과한다.
- `AC-6507`: 모바일·데스크톱에서 초기 취향 단계, 질문 선택지, 적용 결과와 다시 검사 흐름이 레이아웃 깨짐 없이 동작한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-6501~AC-6503 | 응답 enum, 축 중립, 부호 대칭, 감쇠, version 회귀 | `node scripts/test_preference_elicitation.cjs` |
| AC-6504~AC-6506 | DOM 계약, 필수 상태, profile-only request, 기존 추천 회귀 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-6506 | 개인화 ranker 회귀 | `node scripts/test_ccu_mmr.cjs` |
| AC-6507 | 로컬 서버에서 데스크톱·모바일 브라우저 확인 | `map-ui/index.html` |
| 전체 JavaScript | 구문 검사 | `node --check map-ui/preference-elicitation.js && node --check map-ui/app.js` |

## 구현 결과

- `map-ui/preference-elicitation.js`에 질문·pair의 `both_like|both_dislike` 정규화와 감쇠 evidence를 구현했다. 질문은 두 option signed effect 평균에 `0.75`, pair는 두 card feature 평균에 `0.60`을 곱하고 긍정·회피 부호를 적용한다. 유형 축에는 evidence를 더하지 않는다.
- questionnaire, pair catalog, estimator component version을 각각 `travel-mbti-questions-v5-four-way`, `travel-mbti-content-pairs-v3-four-way`, `axis-feature-evidence-v3-ambivalent`로 올렸다. profile schema와 CCU-MMR algorithm version은 유지했다.
- `map-ui` 취향 단계에서 프리셋 5개, 수동 세부 취향 DOM·이벤트·request 수집 경로를 제거했다. 미적용 상태에는 `검사하러 가기` 카드만 표시하고 적용 뒤에는 유형·추천 반영 취향·`다시 검사`만 표시한다.
- 필수 조건은 적용 프로필과 materialize된 preference가 있어야 완료된다. 추천 요청도 같은 프로필의 최대 8개 연속 preference만 사용한다.
- 질문과 가상 여행지 비교 모두 두 장의 기존 카드 아래에 `둘 다 좋아요`, `둘 다 마음에 안 들어요`를 제공한다. 모바일에서는 네 응답이 한 열로 표시된다.
- 결과 화면에서 숨김 footer가 author style 때문에 남던 표시 문제를 `[hidden]` 규칙으로 함께 바로잡았다.
- `scripts/test_preference_elicitation.cjs`에 양쪽 응답 enum, 축 중립, 질문·pair 긍정/부정 부호 대칭, 감쇠, version 검증을 추가했다. 삭제된 단독 사이트 snapshot은 파일이 실제로 존재할 때만 동기화를 검사하도록 stale 회귀 경계를 정리했다.
- `scripts/validate_ccu_mmr_dashboard.cjs`에 수동 취향 DOM·코드 부재, profile-only 완료·request, 네 방향 UI 계약을 추가했다.

### 검증 결과

- `git diff --check`: 통과
- `node --check map-ui/preference-elicitation.js`: 통과
- `node --check map-ui/app.js`: 통과
- `node scripts/test_preference_elicitation.cjs`: 통과
- `node scripts/test_ccu_mmr.cjs`: 통과
- `node scripts/validate_ccu_mmr_dashboard.cjs`: 통과. 장소 2,153건, 추천 준비 1,663건, 41축, 3일 일정 회귀 유지
- 로컬 브라우저 데스크톱: 초기 취향 단계에 검사 카드만 표시, 상황 질문과 pair의 네 응답 표시 확인
- 로컬 브라우저 390×844: 네 응답 한 열 배치, dialog viewport 수용, 적용 전 `5/6`, 적용 후 `6/6`, 검사 카드 숨김·적용 카드와 `다시 검사` 표시 확인
- 브라우저 console warning/error: 0건

## 설계와 달라진 점

없음. 결과 footer의 기존 숨김 표시 오류는 같은 MBTI 완료 흐름의 브라우저 검증 중 발견해 CSS 경계만 보완했다.

## 알려진 제한

- 방향 evidence가 모두 중립인 축도 기존 8유형 중 하나로 결정되지만 confidence 0이며 추천에는 유형 문자를 사용하지 않는다.
- 장소 라벨은 `ai_draft`이므로 선택 표현력 개선이 추천 품질을 보장하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-02 | 사용자 요청을 승인 범위로 반영해 중립 선택지와 MBTI 단일 취향 경로 구현 시작 |
| 2026-09-02 | 엔진·UI·문서·회귀 검증과 데스크톱·모바일 브라우저 확인을 완료하고 Implemented로 전환 |
