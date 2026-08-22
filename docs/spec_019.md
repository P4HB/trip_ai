# SPEC-019: 질문·적응형 쌍대 선택 기반 개인 선호 추정 v1

- 상태: Draft
- 작성일: 2026-08-22
- 최종 수정일: 2026-08-22
- 관련 요청: 여행 유형 질문과 가상 장소 선택으로 사용자별 라벨 선호와 개인취향·동행·월 중요도를 추정해 CCU-MMR 추천에 반영
- 관련 문서: [문서 색인](README.md), [개인화 추천 설계](spec_008.md), [CCU-MMR 알고리즘 초안](ccu_mmr_algorithm_draft.md), [데이터 계약](data_contracts.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md), [안전 및 개인정보](safety_privacy.md)
- 관련 코드: 계획 — `map-ui/preference-elicitation.js`, `map-ui/ccu-mmr.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css`, `scripts/test_preference_elicitation.cjs`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: [SPEC-008](spec_008.md), [SPEC-014](spec_014.md), [SPEC-017](spec_017.md)
- 병렬 초안: [SPEC-018](spec_018.md). 일정 배분 v5와 기능 의존성은 없지만 일부 코드 경로가 겹치므로 구현 순서를 정한 뒤 알고리즘 버전을 배정한다.

## 배경

현재 정적 대시보드는 18개 원자 라벨에 대해 사용자가 `benefit|avoid|target`과 중요도 `1|2|4`를 직접 지정할 수 있다. 그러나 사용자가 자기 취향을 라벨 언어로 이미 알고 있다는 전제가 필요하고, 시스템이 질문이나 선택 행동으로 선호를 추정하지 않는다.

현행 `ccu-mmr-request-v2`의 개인취향·동행·월·날씨 블록 가중치는 `0.70/0.15/0.10/0.05`로 모든 요청에 동일하다. 날씨 블록은 비활성이므로 실제 관련도는 활성 P/A/M 블록의 고정 비율을 다시 정규화해 사용한다. 따라서 어떤 사용자는 계절 적합도를, 다른 사용자는 동행자 적합도를 더 중시하는 차이를 표현하기 어렵다.

41개 표시 라벨은 점수용 원자 라벨 18개, 표시 전용 파생 Style 6개, Companion 5개, Month 12개다. 41개 모두를 독립적인 사용자 성격 가중치로 학습하면 짧은 온보딩으로 식별할 수 없고, Month와 Companion의 의미도 왜곡된다. Month는 여행 날짜가 정하는 장소 적합도이고 Companion은 이번 여행의 동행 맥락이다. 학습할 값은 각 월이나 동행 유형 자체의 선호가 아니라, 원자 취향과 현재 여행에서 P/A/M을 얼마나 우선하는지다.

## 사실, 결정, 가정, 미결정 사항

### 사실

- 현재 추천 후보 1,663곳은 18개 원자 라벨과 Companion 5축·Month 12축을 가진다.
- 파생 Style 6축은 원자 라벨의 조합이므로 점수에 중복 투입하지 않는다.
- 현재 추천 입력과 코스 재추천 이력은 브라우저 메모리에만 있고 사용자 계정·프로필 저장소·행동 로그가 없다.
- 현행 CCU-MMR은 장소 라벨의 provenance·confidence를 점수에서 동일하게 취급하는 내부 데모다.
- 장소 라벨과 웹 조사 결과는 사람 검수 전 `ai_draft`이며 운영 추천 품질이 입증되지 않았다.
- SPEC-018은 일정 배분 변경 초안이며 아직 구현되지 않았다.

### Draft 결정 제안

- “여행 MBTI”는 온보딩 UX 이름과 결과 요약에만 사용한다. 추천 입력의 정본은 고정 유형이 아니라 연속적인 원자 선호 추정값, P/A/M 중요도와 각 값의 불확실성이다.
- 필수 제약, 여행 맥락, 안정적 취향을 분리한다. 접근성·연령·예약 같은 필수 제약은 선호 프로필에 넣지 않고 기존 후보 판정 경계를 유지한다.
- v1은 로그인 없는 내부 실험이며 프로필과 응답을 브라우저 메모리에만 둔다. `localStorage`, `sessionStorage`, 서버 전송, 분석 이벤트와 계정 결합은 하지 않는다.
- 질문 카탈로그는 최대 8개의 상황형 질문으로 구성하고 버전과 질문·선택지 ID, 각 원자 feature 및 P/A/M prior에 미치는 sparse mapping을 코드에 고정한다.
- 질문 뒤 최대 6개의 적응형 가상 장소 쌍을 제시한다. 앞부분은 불확실한 원자 취향을 구분하고, 뒷부분은 개인취향 P와 동행 A·월 M 사이의 trade-off를 구분한다. 충분한 신뢰도에 도달하면 일찍 종료할 수 있다.
- 카드는 실제 장소처럼 오인되지 않도록 항상 `가상 여행지 카드`로 표시한다. v1은 실제 장소명·실제 사진·생성 사진을 사용하지 않고 동일한 시각 품질의 아이콘과 구조화된 문장만 사용한다.
- 원자 취향은 질문 답변으로 만든 prior와 feature pair 선택을 결합한 regularized pairwise logistic 모델로 추정한다. 질문에 없고 비교되지 않은 축은 중립·고불확실 상태로 유지한다.
- P/A/M 중요도는 질문 prior와 P/A/M trade-off pair의 likelihood를 결합해 0.05 간격 simplex 후보를 평가한다. posterior 평균을 블록 가중치로, 분산을 불확실성으로 기록한다. 세 가중치는 음수가 아니며 합이 1이다.
- 선택 강도는 `strong_a|slight_a|tie|slight_b|strong_b|skip`을 사용한다. 강한 선택은 더 큰 관측 가중치를 갖고 `tie`와 `skip`은 방향을 임의로 만들지 않는다.
- 적응형 다음 pair는 현재 추정에서 선택 확률이 0.5에 가깝고, 불확실한 축을 크게 구분하며, 아직 노출되지 않은 카탈로그 항목을 우선한다. 동점 규칙과 선택 trace를 버전으로 고정한다.
- 프로필에서 충분히 비중립적이고 신뢰할 수 있는 원자 feature만 현행 `preferences[]`로 활성화한다. 미측정·상충 응답 축은 0점이나 반대 취향으로 해석하지 않는다.
- 현행 수동 라벨 편집을 유지한다. 프로필 적용 뒤 수동으로 바꾼 값은 해당 feature에서 우선하며 `manual_override`로 trace한다.
- `ccu-mmr-request-v2` 입력을 계속 받을 수 있게 하고, 새 요청만 연속형 원자 중요도·사용자별 블록 가중치·프로필 버전을 가진 새 스키마로 정규화한다.
- 랭커는 요청별 블록 가중치를 사용하되 데이터가 없는 블록은 지금처럼 비활성화하고 남은 활성 블록만 재정규화한다. 후보 lane, 필수 조건, MMR, 코스 variant와 일정 군집 로직은 이번 SPEC에서 바꾸지 않는다.
- 추천 설명은 실제 활성 원자 feature, 요청별 블록 가중치와 score trace에서만 만든다. 여행 유형 이름 자체를 추천 근거로 사용하지 않는다.
- 개인화 v1은 장소 라벨 신뢰도 보정 구현을 포함하지 않는다. `ai_draft` 경고와 내부 실험 gate를 유지하고, 사용자 선호 정밀도가 장소 라벨 품질을 보장하지 않음을 표시한다.

### 가정

- 최대 8개 질문과 최대 6개 쌍대 선택은 내부 사용성 실험을 시작하기에 허용 가능한 길이다.
- 18차원과 3개 블록의 작은 모델은 별도 의존성 없이 브라우저와 Node.js에서 결정적으로 계산할 수 있다.
- 정확한 모든 취향을 복원하는 것보다 미측정 축을 중립으로 남기고 상위 선호·회피 몇 개를 안정적으로 찾는 것이 v1에 적합하다.
- 여행 날짜와 대표 동행 유형은 기존 여행 맥락 입력에서 계속 받는다.

### 미결정 사항

- 실제 질문 문구, 선택지 표현, 질문 순서와 여행 유형 요약 이름
- feature 활성 임계값, logistic regularization·temperature, 조기 종료 불확실성 임계값
- `tie` 응답을 불확실성 감소에 사용할지 단순 무관측으로 둘지 여부
- P/A/M trade-off 카드에서 허용할 현실적인 조합과 dominance 방지 규칙
- SPEC-018과 SPEC-019 중 먼저 구현할 작업 및 그에 따른 CCU-MMR 알고리즘·결과 버전 번호
- 내부 사용성 평가 참여자 수와 제한 베타 전 최소 만족도 기준
- 후속 계정 프로필의 저장 기간·삭제·재동의 정책

## 목표

- 사용자가 18개 라벨을 직접 이해하지 않아도 짧은 상황 질문으로 초기 원자 취향을 추정한다.
- 질문만으로 구분하기 어려운 취향과 P/A/M 중요도를 가상 장소 쌍 선택으로 보정한다.
- 사용자별 연속 가중치와 불확실성을 versioned profile로 만들고 같은 응답에서 같은 결과를 재현한다.
- 고정 P/A/M 가중치를 요청별 값으로 대체할 수 있게 현행 CCU-MMR 요청·점수 trace를 확장한다.
- 필수 제약, 여행 맥락, 선호 점수와 다양성·일정 경계를 유지한다.
- 수동 선호 입력과 기존 요청의 동작을 보존해 개인화 적용 전후를 같은 대시보드에서 비교한다.
- 프로필이 왜 만들어졌고 추천 점수에 어떻게 기여했는지 질문·pair·feature·block 단위로 추적한다.

## 비목표

- 심리검사로 검증된 MBTI 또는 16개 고정 여행자 유형 개발
- 41개 장소 라벨을 모두 독립적인 사용자 성격 파라미터로 학습
- 사용자 계정, 서버 저장, 기기 간 동기화, 장기 행동 로그와 온라인 학습
- 실제 장소 카드의 클릭·저장·예약 행동을 정답으로 사용하는 학습 랭커
- 자연어 자유응답 분석 또는 외부 AI 모델 호출
- 장소 라벨 재생성·사람 검수·confidence calibration
- 실제 이동시간·영업시간·방문 순서 기반 일정 최적화
- 운영 사용자 대상 추천 API와 온라인 A/B 실험 인프라

## 요구사항

- `REQ-1901`: 기능은 `execution_mode=internal_experiment`, `dataset_status=ai_draft`에서만 활성화하고 기존 경고를 제거하지 않는다.
- `REQ-1902`: 프로필은 원자 feature 추정, P/A/M 중요도, 불확실성, 사용한 버전과 최소 응답 trace를 포함하고 개인 식별자·자유 텍스트·정확한 위치를 포함하지 않는다.
- `REQ-1903`: 필수 제약과 날짜·동행 맥락은 프로필 선호값과 분리하며 높은 선호 점수가 필수 제약을 상쇄하지 않는다.
- `REQ-1904`: 질문 카탈로그는 stable ID와 version, 표시 문구, 선택지, sparse prior mapping을 가지며 같은 질문·응답은 같은 prior를 만든다.
- `REQ-1905`: 질문하지 않았거나 응답이 상충하는 원자 feature는 중립·고불확실 상태로 유지하고 자동 활성화하지 않는다.
- `REQ-1906`: 모든 synthetic pair는 가상임을 표시하고 실제 장소명·실제 또는 생성 사진을 사용하지 않으며, 비교에 쓰는 feature·P/A/M 차이를 trace에 기록한다.
- `REQ-1907`: 좌우 표시 순서는 편향을 줄이도록 바꿀 수 있지만 presentation seed와 실제 좌우 배치를 trace해 같은 기록을 재생할 수 있어야 한다.
- `REQ-1908`: 다음 pair 선택은 불확실성·예측 경계·미노출 여부를 사용하며 동일 pair를 한 세션에 반복하지 않고 최대 노출 수를 넘지 않는다.
- `REQ-1909`: 원자 취향 추정기는 질문 prior에서 regularize된 pairwise logistic 목적함수를 결정적으로 풀고 mean·uncertainty·evidence count를 반환한다.
- `REQ-1910`: P/A/M 추정기는 음수가 아니고 합이 1인 후보만 사용하며 posterior mean·uncertainty와 비교 trace를 반환한다.
- `REQ-1911`: 새 요청 스키마는 연속형 선호 중요도, 요청별 P/A/M 가중치, profile·questionnaire·pair·model version을 전달한다. 이전 요청은 기존 기본 가중치로 같은 결과를 내야 한다.
- `REQ-1912`: companion이 `none`이거나 여행 기간이 없으면 해당 블록을 0점 처리하지 않고 비활성화한 뒤 요청별 활성 블록만 재정규화한다.
- `REQ-1913`: 개인화된 원자 feature는 방향·중요도·추정 신뢰도·source를 score trace에 남기고 MMR 중복 feature 제외 목록에도 동일하게 반영한다.
- `REQ-1914`: 수동 편집은 해당 feature의 추정값보다 우선하며 자동 프로필과 수동 override를 결과에서 구분한다.
- `REQ-1915`: 여행 유형 요약은 표시 전용이며 rank, 후보 자격, MMR 유사도나 일정 점수에 직접 들어가지 않는다.
- `REQ-1916`: 프로필·응답·pair history는 브라우저 메모리에만 유지하고 새로고침·탭 종료 시 사라지며 네트워크나 Web Storage로 전송·저장하지 않는다.
- `REQ-1917`: 개인화 적용·해제, 중단·건너뛰기와 수동 입력 폴백을 제공하고 키보드·모바일에서도 질문과 카드 선택을 완료할 수 있어야 한다.
- `REQ-1918`: 동일한 장소 후보·여행 조건에서 profile만 바꾼 비교 결과와 각 rank 변화의 P/A/M·원자 feature 기여를 확인할 수 있어야 한다.
- `REQ-1919`: 현행 필수 조건·후보 lane·seed variant·reroll·일정 회귀 테스트는 새 프로필 유무와 관계없이 통과해야 한다.
- `REQ-1920`: synthetic user 평가와 고정 golden answer fixture로 선호 방향 회복, block weight 정규화, held-out pair 예측과 결정성을 측정한다.

## 입력과 출력

### 개인 선호 프로필

정확한 JSON 필드명은 구현 시작 시 schema fixture로 고정한다. 의미 계약은 다음과 같다.

```text
TravelerPreferenceProfileV1 {
  schema_version: traveler-preference-profile-v1
  scope: browser_memory_session
  status: complete | partial | manual

  versions: {
    questionnaire_version
    pair_catalog_version
    feature_model_version
    block_model_version
  }

  feature_estimates: {
    [AtomicFeatureKey]: {
      mean: number[-1,1]
      uncertainty: number[0,1]
      active: boolean
      evidence_count: integer
      source: quiz | pairwise | quiz_pairwise | manual_override | unmeasured
    }
  }

  block_estimates: {
    preference: { mean: number[0,1], uncertainty: number[0,1] }
    companion:  { mean: number[0,1], uncertainty: number[0,1] }
    month:      { mean: number[0,1], uncertainty: number[0,1] }
  }

  answer_trace: {
    questionnaire: [{ question_id, option_id }]
    pairwise: [{ pair_id, kind, left_card_id, right_card_id, choice }]
  }

  display_summary: {
    top_preferences: AtomicFeatureKey[]
    top_avoidances: AtomicFeatureKey[]
    archetype_id: string?
  }
}
```

- `mean > 0`은 높은 값 선호, `mean < 0`은 낮은 값 선호, 0 근처는 중립이다.
- `uncertainty`는 선호가 맞을 확률이 아니라 현재 질문 설계에서 정보가 부족한 정도다.
- `archetype_id`는 결정적 요약 결과이며 알고리즘 입력이 아니다.
- 원문 질문과 카드 문구를 매 응답에 복제하지 않고 version+ID로 해소한다.

### 가상 장소 pair

```text
SyntheticPairV1 {
  pair_id
  kind: feature_disambiguation | block_tradeoff
  card_a: {
    card_id
    copy_tokens[]
    atomic_features: partial map[AtomicFeatureKey, number[0,1]]
    components: { preference?, companion?, month? }
  }
  card_b: same shape
  contrasted_dimensions[]
}
```

- `copy_tokens`는 허용된 구조화 표현 카탈로그에서만 조합하고 실재 장소처럼 보이는 고유명사를 만들지 않는다.
- dominated pair, 한 카드만 일방적으로 모든 축이 높은 pair와 현실적으로 모순된 조합은 카탈로그 검증에서 실패시킨다.

### CCU-MMR 요청 확장

```text
CCUMMRRequestPersonalizedV1 extends current request {
  preference_profile: TravelerPreferenceProfileV1?
  block_weights: {
    preference: number >= 0
    companion: number >= 0
    month: number >= 0
  }?
  preferences[] {
    feature
    mode: benefit | avoid | target
    weight: positive number
    confidence: number[0,1]?
    source: manual | quiz | pairwise | quiz_pairwise | manual_override
    target?
    tolerance?
  }
}
```

- 프로필이 없으면 현행 기본 블록 가중치와 수동 입력 의미를 유지한다.
- 프로필이 있으면 active feature만 `preferences[]`로 materialize하고 block posterior mean을 요청 가중치로 사용한다.
- 결과는 실제 사용한 normalized profile snapshot과 모든 모델·질문 버전을 기록한다.

## 설계

### 1. 모듈 경계

```text
versioned quiz catalog
  -> quiz prior
  -> adaptive feature pairs
  -> atomic feature estimator
  -> P/A/M trade-off pairs
  -> block importance estimator
  -> TravelerPreferenceProfileV1
  -> request adapter
  -> current CCU-MMR relevance
  -> current MMR/course/schedule
```

- `map-ui/preference-elicitation.js`는 DOM을 모르는 순수 모듈로 구현하고 브라우저와 Node.js 테스트에서 같은 함수를 사용한다.
- `map-ui/app.js`는 wizard 상태, 표시 순서, 수동 override와 profile→form/request 연결만 담당한다.
- `map-ui/ccu-mmr.js`는 프로필을 학습하지 않고 이미 정규화된 preferences와 block weights만 검증·점수화한다.

### 2. 질문 prior

- 각 선택지는 18개 feature의 일부와 P/A/M prior에만 sparse evidence를 더한다.
- 한 선택지가 서로 무관한 다수 축을 강하게 확정하지 않게 mapping 크기와 총 evidence를 제한한다.
- 질문은 자기보고식 라벨 문구보다 여행 상황의 trade-off를 사용한다.
- 응답하지 않은 feature의 prior mean은 0이며 uncertainty는 높게 유지한다.

### 3. 원자 취향 pairwise fit

feature pair `j`의 카드 차이를 `d_j = x_A - x_B`, 사용자 선택 방향을 `y_j`로 둔다.

```text
P(A | z, d_j) = sigmoid(temperature * dot(z, d_j))

objective(z)
  = quiz_prior_regularization(z, z0)
  + weighted_pairwise_log_loss(z, pairs)
```

- `z`는 feature별 `[-1,1]`로 제한한다.
- 강한 선택은 약한 선택보다 큰 sample weight를 사용한다.
- 고정 iteration·tolerance·동점 규칙으로 같은 입력에서 같은 값을 만든다.
- uncertainty는 regularization과 관측 Fisher 정보의 대각 근사로 계산하며 calibration된 확률로 표현하지 않는다.

### 4. P/A/M 중요도 fit

- feature fit을 먼저 고정하고 각 trade-off 카드의 개인취향 P, 동행 A, 월 M component를 계산한다.
- `0.05` 간격에서 `alpha_P + alpha_A + alpha_M = 1`인 모든 비음수 후보를 평가한다.
- 질문 prior와 pairwise likelihood를 결합한 posterior의 평균을 요청 block weight로 사용한다.
- posterior 분산이 큰 경우 결과에 `importance_uncertain`을 표시하고 기본 prior 쪽으로 수축한다.
- 날짜나 대표 동행이 없는 실제 추천 요청에서는 그 블록을 비활성화하고 남은 블록을 점수 계산 시 재정규화한다.

### 5. 적응형 pair 선택

```text
information_score(pair)
  = uncertainty_coverage
  * prediction_boundary_score
  * novelty_score
  * realism_gate
```

- 현재 모델이 거의 확실히 한쪽을 선택할 pair보다 결정 경계에 가까운 pair를 우선한다.
- 동일 축만 반복하지 않도록 feature coverage를 기록한다.
- `realism_gate`를 통과하지 못한 pair는 후보에서 제외하고, 동점은 `pair_id ASC`로 결정한다.
- 좌우 presentation은 별도 seed로 정하고 실제 배치를 answer trace에 기록한다.

### 6. 프로필의 추천 입력 변환

- active 양수 mean은 `benefit`, active 음수 mean은 `avoid`로 변환한다.
- weight는 `abs(mean)`과 추정 신뢰도에서 연속값으로 계산하고 활성 feature 사이에서 정규화한다.
- 수동 override가 있으면 해당 feature만 자동 추정 대신 수동 값을 사용한다.
- 요청에 profile이 없어도 기존 `1|2|4` 수동 값은 그대로 유효하다.
- `scorePlace`는 전역 상수 대신 normalized request의 block weight를 사용한다.
- 활성 feature 목록은 개인취향 P와 요청 인지형 MMR feature 제외에 동일하게 사용한다.

### 7. UI 흐름

1. 기존 여행 맥락 입력 유지
2. `내 여행 취향 찾기`로 wizard 시작
3. 최대 8개 상황 질문
4. 최대 6개 가상 장소 pair 선택
5. 상위 선호·회피, P/A/M 중요도와 불확실성 요약
6. `이 취향 적용`으로 기존 원자 라벨 행과 요청에 반영
7. 사용자가 행을 수정하면 override 표시
8. `개인화 해제` 시 현행 수동/default 동작으로 복귀

wizard 중단 시 완료된 응답만으로 partial profile을 적용할지, 모두 버릴지 사용자가 선택한다. 결과 화면은 유형 이름보다 실제 상위 feature와 P/A/M 비중을 먼저 보여준다.

## 예외와 폴백

- 모든 질문을 건너뛰면 profile을 만들지 않고 현행 수동/default 요청을 사용한다.
- 응답이 상충하면 관련 feature를 중립·고불확실로 남기며 임의의 방향을 정하지 않는다.
- 적합한 미노출 pair가 없으면 조기 종료하고 `partial` 상태와 미측정 축을 표시한다.
- `tie`·`skip`만 반복돼도 강한 가중치를 만들지 않는다.
- companion이 `none`이면 A 중요도 추정이 있어도 실제 장소 점수의 A 블록은 비활성이다.
- 여행 기간이 없으면 M 중요도 추정이 있어도 M 블록은 비활성이다.
- 프로필 스키마나 버전이 유효하지 않으면 자동 적용하지 않고 수동 입력으로 폴백한다.
- profile과 수동 입력이 충돌하면 명시적 수동 override가 우선한다.
- 새 알고리즘 버전과 생성 번들의 metadata가 다르면 현재 대시보드처럼 초기화를 실패시킨다.
- `ai_draft` 장소 라벨 경고는 개인화 confidence와 관계없이 항상 유지한다.

## 영향 범위

- 새 파일 계획: `map-ui/preference-elicitation.js`, `scripts/test_preference_elicitation.cjs`
- 변경 계획: `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`, `map-ui/ccu-mmr.js`
- 생성·검증 변경 계획: `scripts/build_map_ui_data.mjs`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`, `map-ui/data/jeju-places.js`
- 문서 변경 계획: `docs/README.md`, `docs/spec_019.md`, `docs/ccu_mmr_algorithm_draft.md`, `docs/data_contracts.md`, `docs/evaluation.md`, `docs/safety_privacy.md`, `map-ui/README.md`
- 원본 장소·라벨 데이터 마이그레이션: 없음
- 호환성: 기존 수동 요청 fixture는 기본 가중치로 같은 결과를 유지한다. 개인화 요청은 새 request/result/profile version을 사용한다.
- 개인정보: v1은 메모리 한정이며 외부 전송과 영속 저장이 없다. 계정·저장·분석을 추가하려면 후속 SPEC이 필요하다.
- SPEC-018 병행 영향: 두 SPEC 모두 `ccu-mmr.js`, `app.js`, 결과 버전에 영향을 준다. 한 SPEC 구현 중에는 다른 SPEC의 코드 구현을 동시에 진행하지 않고, 먼저 병합된 SPEC을 기준으로 후속 문서의 버전과 회귀 fixture를 갱신한다.

## 승인 기준

- `AC-1901`: 같은 질문·pair 응답과 presentation trace에서 profile JSON이 바이트 단위로 결정적이다.
- `AC-1902`: 질문·pair에서 측정하지 않은 feature는 active가 아니며, 상충 응답은 임의의 강한 선호로 바뀌지 않는다.
- `AC-1903`: A/B 좌우를 바꾸고 선택도 대칭으로 바꾼 fixture가 같은 feature·block 추정을 만든다.
- `AC-1904`: P/A/M mean은 각각 0 이상이고 합이 허용 오차 내 1이며, 맥락이 없는 블록은 점수에서 비활성·재정규화된다.
- `AC-1905`: 개인화 요청은 profile에서 기대한 feature 방향·연속 중요도·block weight·source·version trace를 가진다.
- `AC-1906`: profile이 없는 기존 요청 fixture는 새 schema/version과 명시적 기본 block weight 필드를 제외한 의미 입력, Top-N·P/A/M/R/MMR 결과가 승인된 baseline과 일치한다.
- `AC-1907`: 서로 다른 두 synthetic profile이 같은 여행 맥락에서 의도한 원자 feature 또는 P/A/M 방향으로 순위·기여도를 바꾼다.
- `AC-1908`: 필수 조건, 제외 ID, intent lane, seed variant, reroll과 일정 회귀가 개인화 유무에 관계없이 통과한다.
- `AC-1909`: wizard는 데스크톱·모바일·키보드에서 시작, 응답, 뒤로가기, 건너뛰기, 중단, 적용과 해제가 가능하다.
- `AC-1910`: 모든 카드는 가상임을 표시하며 카탈로그 검사에서 실재 고유명사·사진·dominated pair·중복 ID가 0건이다.
- `AC-1911`: 프로필·응답이 Web Storage, URL, 네트워크 요청이나 생성 번들에 기록되지 않는다.
- `AC-1912`: profile·questionnaire·pair·model·request·result·algorithm version과 실제 사용한 점수 trace가 결과 JSON에서 해소된다.
- `AC-1913`: synthetic user 평가가 고정 seed에서 재현되고, static default 대비 held-out pair accuracy·weight error·Top-N regret를 보고한다. 품질 임계값은 구현 전 승인한다.
- `AC-1914`: `ai_draft`·내부 실험·변동 정보 확인 경고가 개인화 UI와 결과에서 유지된다.

## 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| AC-1901~AC-1905 | `scripts/test_preference_elicitation.cjs`의 golden quiz, pair symmetry, conflict, skip, block simplex fixture |
| AC-1906~AC-1908 | 기존·확장 `scripts/test_ccu_mmr.cjs`에서 legacy compatibility, personalized score, MMR·schedule 회귀 |
| AC-1909~AC-1912 | `scripts/validate_ccu_mmr_dashboard.cjs` DOM 계약 검사와 로컬 브라우저 데스크톱·모바일·키보드 시나리오 |
| AC-1910 | 질문·pair 카탈로그 schema, ID, feature 범위, dominance·중복·표시 token 검사 |
| AC-1911 | 코드 검색과 브라우저 Network·Storage 검사 |
| AC-1913 | 고정 synthetic user set으로 profile recovery MAE, held-out pair accuracy, ranking regret 비교 |
| AC-1914 | 경고 DOM·result JSON 회귀 |

구현 시 최소 명령 후보:

```powershell
node --check map-ui/preference-elicitation.js
node --check map-ui/ccu-mmr.js
node --check map-ui/app.js
node scripts/test_preference_elicitation.cjs
node scripts/test_ccu_mmr.cjs
node scripts/build_map_ui_data.mjs
node scripts/validate_ccu_mmr_dashboard.cjs
```

지도용 데이터 재생성은 알고리즘 version metadata 동기화 때문에 필요하며 생성 diff에서 장소·라벨 payload가 의도 없이 바뀌지 않았는지 확인한다.

## 단계별 구현 계획

1. 질문·pair 카탈로그와 `TravelerPreferenceProfileV1` fixture를 승인한다.
2. DOM과 분리된 `preference-elicitation.js`에 prior, feature fit, block simplex fit, adaptive pair 선택과 profile materializer를 구현한다.
3. 새 모듈의 golden·대칭성·상충·결정성·synthetic user 테스트를 먼저 통과시킨다.
4. `ccu-mmr.js` 요청을 확장해 요청별 block weight와 연속형 feature 중요도를 적용하고 legacy fixture가 같은 결과인지 확인한다.
5. wizard UI와 profile 적용·수동 override·해제를 연결한다.
6. 결과 카드·상세·JSON에 profile과 실제 기여 trace를 표시한다.
7. metadata·기준 문서·생성 번들을 동기화하고 전체 CCU-MMR·일정 회귀를 실행한다.
8. 내부 사용성 표본에서 질문 이해도, 완료율, 응답 안정성과 held-out pair 예측을 확인한 뒤 제한 베타 또는 영속 프로필은 별도 SPEC으로 결정한다.

## 구현 결과

- 미구현. 이 문서는 구현 범위와 결정 후보를 정리한 Draft다.

## 설계와 달라진 점

- 없음. 구현 전이다.

## 알려진 제한

- 짧은 질문과 최대 6개 pair로 18개 취향을 모두 식별할 수 없다. 미측정 축을 neutral로 두는 것이 v1 정책이다.
- 자기보고와 가상 카드 선택은 실제 여행 행동과 다를 수 있다.
- 응답 컨텍스트가 바뀌면 같은 사람도 다른 가중치를 가질 수 있으므로 영구 성격으로 해석하지 않는다.
- 현재 장소 라벨이 `ai_draft`이므로 사용자 선호 추정 개선만으로 추천 품질이 보장되지 않는다.
- 브라우저 메모리 한정이라 새로고침 후 프로필이 사라진다.
- 여행 유형 요약은 사용자 이해를 위한 설명이며 심리측정학적으로 검증된 분류가 아니다.

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-08-22 | 질문 prior, 적응형 가상 장소 pair와 사용자별 P/A/M 가중치를 현행 CCU-MMR 앞단에 추가하는 v1 구현 계획 초안 작성 |
