# SPEC-084: 상관 feature의 취향 가중치 예산

- 상태: Implemented
- 작성일: 2026-09-26
- 최종 수정일: 2026-09-26
- 관련 요청: 추천 개선안 1(14~18번 가중치 합 25% 상한)과 2(경관·사진의 가중치 묶음)를 함께 반영한다.
- 관련 문서: [문서 색인](README.md), [CCU-MMR](ccu_mmr_algorithm_draft.md), [데이터 계약](data_contracts.md), [평가](evaluation.md)
- 관련 코드: `map-ui/ccu-mmr.js`, `map-ui/index.html`, `scripts/build_map_ui_data.mjs`, `map-ui/data/jeju-places.js`, `scripts/test_ccu_mmr.cjs`, `scripts/test_preference_weight_budget.cjs`, `scripts/evaluate_preference_weight_budget.cjs`
- 선행 SPEC: [SPEC-019](spec_019.md), [SPEC-065](spec_065.md), [SPEC-078](spec_078.md)

## 배경

현재 엔진은 활성 원자 feature의 효용을 원래 선호 가중치로 평균한다. 전체 추천 준비 장소 1,663곳에서 경관·독특함·로컬성·랜드마크성·사진 가치의 상관이 높아 유사 특성이 여러 축의 가중치를 확보할 수 있다. visit 799곳에서는 상관이 다르므로 다섯 라벨을 동일 개념으로 합치지는 않는다. 경관·사진의 visit Pearson 상관은 약 0.625다.

사실: 같은 방향으로 일관되게 응답한 합성 MBTI 8개에서 이 다섯 축의 기존 취향 가중치 비중은 28.0~38.3%다. 실제 사용자 통계나 과대 반영의 인과 증명은 아니다.

## 목표

- 라벨값과 취향 방향을 유지하면서 연관 축 개수 때문에 가중치가 누적되는 효과를 줄인다.
- 조정된 가중치·기여도로 점수와 추천 이유를 함께 계산하고 알고리즘 버전을 추적한다.

## 비목표

- 질문별 feature evidence, MBTI 추정, 라벨링·신뢰도·결측값 모델 변경
- P/A/M 블록 비율, 후보·필수 제약, MMR 유사도, seed·일정 유형 상한 변경
- 사용자 만족도 개선 보장, LLM 단계 도입, 서버 배포

## 요구사항

- `REQ-001`: 경관(`scenic_value`)·사진(`photo_value`)의 유효 선호 가중치를 하나의 예산으로 묶는다. 예산은 두 원래 가중치의 최댓값이며 내부 비율은 원래 비율을 유지한다. 한 축만 유효하면 그대로다.
- `REQ-002`: 묶음 처리 후 정규화한 취향 가중치에서 `scenic_value`, `distinctiveness`, `local_embeddedness`, `landmark_significance`, `photo_value`의 합을 최대 0.25로 제한한다. 초과할 때 그룹 내부 비율과 나머지 내부 비율을 각각 유지한다.
- `REQ-003`: 상한은 취향 P 내부에 적용하며 feature의 benefit/avoid/target 효용, 원래 요청 weight와 P/A/M 비율은 보존한다.
- `REQ-004`: 그룹 외 유효 선호가 없으면 존재하지 않는 선호를 추가하지 않고 묶음 처리 후 가중치 합 1을 유지한다. 상한 미적용 이유를 명시한다. 그룹 외 요청값이 결측인 경우도 이 폴백과 기존 coverage를 기록한다.
- `REQ-005`: 유효한 0점과 unknown을 구분한다. 결측은 대체하지 않고 기존 유효값 재정규화·coverage 정책을 유지한다. 유효한 선호가 전혀 없으면 기존 비활성 폴백을 유지한다.
- `REQ-006`: trace에 원래 weight, 묶음 후 weight, 상한 전 정규화 weight, 최종 effectiveWeight와 contribution을 남긴다. component에 정책 버전·묶음 예산·상한 전후 비중·적용 여부·미적용 이유를 남긴다.
- `REQ-007`: 모든 추천 경로가 동일한 취향 계산을 사용하고 알고리즘을 `ccu-mmr-v8-preference-budget`으로 올린다. 생성기 metadata, 번들, UI cache key를 동기화한다. 요청·결과 schema는 호환 가능한 추가 trace이므로 유지한다.
- `REQ-008`: 단위·기존 회귀와 실제 데이터 오프라인 비교를 수행하고 점수 정책 검증과 추천 품질 판단을 구분한다.

## 입력과 출력

입력 계약은 기존 `preferences[]`와 장소 `atomicFeatures`다. 좌표·시간·외부 입력은 변경하지 않는다. 사용자 질문·원래 weight는 수정하지 않는다.

출력의 `components.preference.traces[]`에 `groupedWeight`, `normalizedWeightBeforeCap`을 추가한다. 기존 `effectiveWeight`와 `contribution`은 최종 정책을 반영한다. `components.preference.weightAdjustment`는 정책 실행과 폴백을 설명한다. 숫자는 내부 정밀도를 유지하며 출력 전에 임의로 반올림하지 않는다.

## 설계 — 구현됨

순서는 **유효 효용 선택 → 경관·사진 예산 → 전체 정규화 → 5축 상한 → 효용 합산**이다.

경관·사진의 유효 축 집합을 V, 원래 가중치를 w라 하면:

```text
B = max(w[k] for k in V)
g[k] = B * w[k] / sum(w[j] for j in V)  (k in V)
g[k] = w[k]                            (그 외 유효 선호)
p[k] = g[k] / sum(g)

G = 위 REQ-002의 5축, s = sum(p[k] for k in G)
G 외 유효 선호가 있고 s > 0.25이면:
  final[k] = p[k] * 0.25 / s           (k in G)
  final[k] = p[k] * 0.75 / (1 - s)     (그 외)
그 외에는 final[k] = p[k]

contribution[k] = final[k] * utility[k]
P = sum(contribution)
```

실제 구현에서는 부동소수점 뺄셈 오차를 줄이기 위해 그룹 밖 가중치 합도 직접 구한다. 정책의 feature 목록과 0.25는 버전이 있는 고정 config에 둔다. `coverage`는 기존과 동일하게 원래 요청 weight 중 유효 weight 비율이며 상한 충족 여부와 별개다.

## 예외와 폴백

- 두 시각 feature 중 하나가 선택되지 않았거나 결측이면 나머지의 예산을 줄이지 않는다.
- 다섯 축이 하나도 없거나 상한 이하면 상한 조정하지 않는다.
- 다섯 축만 유효하면 `no_other_usable_features`를 기록하고 상한을 생략한다. 현재 지도 추천 준비 조건은 원자 18축 전부 유효하므로 그룹 밖 라벨 결측은 일반 번들에서는 발생하지 않는다.
- 전부 결측이면 effectiveWeight/contribution은 0이며 기존 비활성 component 처리를 유지한다.
- 상한은 선호와 회피에 동일하게 적용한다. 필수 조건은 점수로 상쇄하지 않는다.

## 영향 범위

- 변경 파일: 상단 관련 코드, 이 SPEC과 문서 색인·CCU-MMR·데이터 계약·평가 문서, `artifacts/evaluation/spec_084_preference_budget.json`.
- 데이터 마이그레이션: 없음. 생성 번들의 장소 내용·라벨은 그대로이며 알고리즘 metadata만 갱신한다.
- 호환성 영향: 동일 요청의 순위는 바뀔 수 있다. 요청 weight와 schema는 유지하며 결과에 조정 trace만 추가한다.
- 보안·개인정보 영향: 새 수집·전송 없음. 오프라인 평가는 합성 선호와 기존 공개 장소만 사용한다.

## 승인 기준

- `AC-001` (`REQ-001~003`): 동일/비동일 시각 가중치, 단일 시각 축, 상한 미만·경계·초과, 비그룹 선호 불변 및 benefit/avoid/target을 손계산과 비교한다.
- `AC-002` (`REQ-004~006`): 결측·0·빈 요청·그룹 전용 폴백을 검증하며 유효 합 1, 비음수, P 범위와 contribution 합 일치를 확인한다.
- `AC-003` (`REQ-003,006,007`): 실제 추천 순위가 정책에 따라 바뀌는 fixture, trace와 이유의 기여도, 결정성과 입력 불변을 검증한다. 기존 제약·개인화·seed·일정 회귀가 통과한다.
- `AC-004` (`REQ-007`): 생성기·번들·엔진 버전이 같고 UI가 새 스크립트를 참조한다. 재생성 전후 장소 데이터가 동일하다.
- `AC-005` (`REQ-008`): 실제 데이터에서 합성 MBTI 8개와 명시적 자연·사진 선호를 기존 엔진과 같은 조건으로 비교한다. 그룹 비중, Top 10 변화·유형 수·해변/오름 비중·프로필 간 중복을 기록한다. 지표 개선을 만족도 개선으로 해석하지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001~003 | 손계산·경계·순위 fixture | `node scripts/test_preference_weight_budget.cjs` |
| AC-003 | 기존 점수·seed·필수 제약·일정 | `node scripts/test_ccu_mmr.cjs` |
| AC-003 | 질문·개인화 입력 보존 | `node scripts/test_preference_elicitation.cjs` |
| AC-003 | 하루 유형 상한·실데이터 48조건 | `node scripts/test_daily_type_limit.cjs` |
| AC-004 | 문법·생성·UI 데이터 계약 | `node --check map-ui/ccu-mmr.js`, `node --check map-ui/app.js`, `node --check scripts/build_map_ui_data.mjs`, `node scripts/build_map_ui_data.mjs`, `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-004 | 생성 장소의 기존 유형·ID·내용 보존 | `python scripts/test_place_types.py`, 생성 전후 번들 구조 비교 |
| AC-005 | 변경 전 엔진 파일과 같은 요청 비교 | `node scripts/evaluate_preference_weight_budget.cjs --baseline-engine <보존한-v7-엔진.cjs>` |

## 구현 결과

- 엔진 `adjustPreferenceWeights`에 `preference-weight-budget-v1`을 적용했다. 경관·사진 예산을 먼저 나누고 5축 상한을 적용하며 최종 기여도 합으로 P를 계산한다. 기존 추천 이유 UI는 같은 contribution을 읽으므로 앱의 설명 생성 방식을 따로 복제하지 않았다.
- 알고리즘은 `ccu-mmr-v8-preference-budget`이다. 생성기는 엔진에서 버전을 직접 읽으며 HTML의 엔진·데이터 cache key와 표시 버전을 갱신했다.
- `map-ui/data/jeju-places.js` 재생성 전후를 구조 비교해 2,153곳 장소 내용이 모두 같고 metadata의 `algorithmVersion`만 달라짐을 확인했다. 추천 준비 1,663곳과 visit 799곳을 유지했다.
- 기존 작업트리의 관련 없는 변경과 기존 하루 유형 상한을 보존했다. 서버 배포는 수행하지 않았다.

### 검증 결과

- `node scripts/test_preference_weight_budget.cjs`: 18개 시나리오 통과(AC-001~003).
- `node scripts/test_ccu_mmr.cjs`: 통과. 기존 평면 가중평균 예시 한 건의 기대값을 승인된 25% 정책의 손계산으로 갱신했다.
- `node scripts/test_preference_elicitation.cjs`: 통과. 질문·프로필 생성 로직 변경 없음.
- `node scripts/test_daily_type_limit.cjs`: 타입 gate·필수 보존·48개 실제 데이터 일정 시나리오 통과.
- `node scripts/validate_ccu_mmr_dashboard.cjs`: UI·1,663개 41축 데이터 계약 통과.
- `python scripts/test_place_types.py`: 2,153개 ID, 유형 fixture, 원본 불변, SQLite·결정적 산출물 일치 통과.
- 엔진·앱·생성기·신규 두 검증 스크립트의 `node --check` 통과.
- `node scripts/evaluate_preference_weight_budget.cjs --baseline-engine <보존한-v7-엔진.cjs>`: 합성 10시나리오 × 다양성 off/balanced × 변경 전후 비교 완료. 입력·엔진 해시와 각 Top 10은 `artifacts/evaluation/spec_084_preference_budget.json`에 기록했다.

### 오프라인 비교

visit, 동행·월 미사용, 합성 MBTI 8개, balanced 첫 seed 고정의 결과다. 겹침은 두 Top 10의 공통 장소 수이며 8개 프로필 간 평균은 28쌍으로 계산한다.

| 지표 | 변경 전 | 변경 후 |
|---|---:|---:|
| 14~18번 취향 가중치 비중 | 27.95~38.27% | 모두 25% |
| Top 10 내 평균 해변·오름 수 | 1.625 | 1.375 |
| Top 10 내 평균 대표 유형 수 | 6.50 | 6.25 |
| 서로 다른 프로필 간 평균 공통 장소 수 | 0.857 | 0.893 |

동일 프로필의 변경 전후 Top 10은 평균 8곳이 같아 2곳이 교체됐다. 가중치 상한은 충족했지만 유형 다양성과 프로필 간 차별화가 개선됐다는 결과는 아니다. 다양성 off에서는 평균 유형 수가 5.5로 같고 해변·오름 수는 2.375→2.0, 프로필 간 공통 장소는 0.643→0.821이었다.

명시적 자연 선호 시나리오에서는 balanced Top 10의 바다 라벨 평균 0.9→1.0, 산 평균 0.9→0.8이었다. 이는 현재 라벨에 따른 성향 확인이며 실제 만족도 지표가 아니다. 사진만 요청한 예외 시나리오는 전후 Top 10과 사진 점수 평균 1.0을 그대로 유지했다.

## 설계와 달라진 점

없음.

## 알려진 제한

25%는 사용자가 선택한 실험 정책이며 학습된 최적값이 아니다. 비중 상한만으로 전체 후보의 자연경관 반복이나 추천 품질이 해결된다고 보장하지 않는다. 이번 합성 비교에서도 유형 다양성 개선은 확인되지 않았다. 결측 폴백과 그룹 전용 선호에는 상한 예외가 있다. 실제 사용자 만족도와 사람의 독립 적합도 평가는 후속 평가 대상이다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-26 | 사용자 요청 1·2번을 승인 범위로 기록, 계산 순서·예외·검증 계획 작성 |
| 2026-09-26 | 가중치 예산 v8 구현, 경계·기존 회귀·실데이터 비교 및 생성 데이터 불변 검증 완료 |
| 2026-09-26 | 최신 main의 기간·LLM 일정 기능을 보존해 통합하고 추천·실제 브라우저 회귀 검증 완료 |

## Git 반영을 위한 통합 검증

사용자의 Git push 요청에 따라 최신 `origin/main`의 `b0ac235`를 기준으로 이번 SPEC 변경을 통합했다. 원격의 날짜 없는 여행 기간과 LLM 동선·식사 기능, 기존 SPEC-083을 보존했다. 추천 가중치 코드·테스트·버전·계약·평가·SPEC-084만 반영하며 원래 작업트리의 기타 미완료 변경은 포함하지 않는다.

- 통합본에서 가중치 18개, 기존 CCU-MMR(날짜 없는 기간 포함), 취향 질문, 하루 유형 48조건, 지도 데이터 계약과 장소 유형 검증을 다시 통과했다.
- `node scripts/test_itinerary_ui.cjs`: 단위 검증과 실제 브라우저의 데스크톱·모바일 검증을 통과했다. 테스트 환경에는 번들 Playwright의 `NODE_PATH`와 설치된 Chrome을 가리키는 `FEEDBACK_TEST_CHROMIUM`을 사용했다. 날짜·차량 조건, 비동기 응답·타임아웃, 피드백·선택 상태 보존과 모바일 배치를 확인했다.
- 최신 main의 v7 엔진을 기준으로 오프라인 평가를 다시 생성해 통합본의 엔진·데이터 해시를 기록했으며 위 비교 지표는 동일했다.
- 최신 main 대비 재생성 번들의 2,153개 장소가 모두 동일하고 metadata의 `algorithmVersion`만 달라짐을 확인했다. 문법 검사와 `git diff --check`를 통과했다.
