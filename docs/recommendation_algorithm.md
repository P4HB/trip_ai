# 추천 알고리즘

- 문서 상태: 목표 설계 초안, 미구현
- 최종 수정일: 2026-08-22
- 활성 설계 초안: [SPEC-008](spec_008.md)

현재 코드에는 운영용 개인화 추천 알고리즘이 없다. 이 문서는 첫 운영 장소 추천 엔진이 따라야 할 공통 경계와 재현 가능한 `baseline-v0` 제안을 정의한다. 현재 1,434건 프로필은 모두 사람 검수 전 `ai_draft`이므로 운영용 장소 품질 점수나 골드 라벨로 취급하지 않는다.

현재 정적 지도에는 이 목표 `baseline-v0`와 별개인 `ccu-mmr-v6-travel-mbti-three-axis` 내부 실험이 구현되어 있다. SPEC-016·017·019·065에 따라 `balanced`는 관련도 1·2·3위 seed variant를 결정적으로 계산하고 최초 variant만 가중 선택하며, 같은 브라우저 요청 세션에서는 미노출 variant를 우선한다. 질문과 적응형 가상 장소 선택에서 추정한 연속형 라벨 선호는 장소 관련도에만 반영하고, P/A/M block 가중치는 고정한다. A·B는 기존 방향 evidence를 만들고, `둘 다 좋아요`·`둘 다 마음에 안 들어요`는 유형 축을 기울이지 않은 채 두 선택의 평균 feature를 감쇠된 긍정·회피 evidence로 반영한다. 현재 UI는 이 여행 MBTI 프로필 외의 프리셋·수동 취향 입력을 받지 않는다. 요청 선호 feature는 MMR 중복 feature에서 제외하고 선택 variant는 근사 일정의 자동 중심에 연결된다. A/R·O/I·L/H 3축 8개 여행 MBTI는 공유·설명용 파생 표시이며 점수 입력이 아니다. 이 문서의 결정적 baseline 요구는 후속 운영 후보 기준선에 그대로 유지한다.

## 목표와 점수의 의미

- 첫 목표는 내부 오프라인에서 실행하는 결정적 장소 적합도 랭커다.
- 점수는 “이 요청의 동행·시기·취향에 얼마나 맞는가”이며 장소의 절대 품질·인기도·영업 가능성·일정 가능성을 뜻하지 않는다.
- 필수 제약은 선호 점수와 분리하고 높은 점수로 상쇄하지 않는다.
- 동일한 정규화 요청·feature snapshot·설정 버전에서는 같은 결과와 trace를 만든다.
- 거리·이동시간·권역·경로 효율은 장소 적합도에 넣지 않고 후속 일정 최적화에서 별도로 다룬다.

## 단계별 파이프라인

### 1. 공통 feature snapshot과 실행 gate

랭커는 raw JSONL이나 SQLite 테이블을 직접 해석하지 않고 versioned `RecommendationFeatureSnapshot`만 입력받는다.

```text
canonical JSONL set + 원본 장소 ─┐
                                 ├─> feature snapshot materializer
read-only SQLite + manifest ─────┘                 |
                                                   v
                              RecommendationFeatureSnapshot
                              + feature_snapshot_digest
```

- 두 입력 경로는 `contentid`, `source_order`, LCLS, `place_kind`, `experience_scope`, `environment`, 축별 값·provenance, hard constraint와 source를 같은 계약으로 투영해야 한다.
- 현 SQLite에 없는 `companion_archetype`, `month_archetype`, `flags`는 baseline feature나 다양성 입력으로 사용하지 않는다.
- 같은 manifest 입력에서 두 materializer 결과의 canonical digest가 같아야 한다. 이 검증 전에는 “JSONL 또는 SQLite 어느 쪽이든 동일하다”고 가정하지 않는다.
- 현재 제주 adapter에서 `place_id`는 TourAPI `contentid` 문자열과 1:1이다.

현재 snapshot의 `dataset_status`는 `ai_draft`다.

```text
dataset_status = ai_draft
        |
        +-- execution_mode = internal_experiment  -> 실행
        +-- 그 밖의 실행                          -> 거부
```

- `execution_mode`는 신뢰된 CLI·서버 런타임 설정이며 클라이언트 요청 필드가 아니다.
- 모든 결과에 snapshot, manifest SHA-256, logical DB digest, feature snapshot digest와 `dataset_status=ai_draft`를 기록한다.

### 2. 요청 정규화

- 정규화된 요청의 intent는 `visit`, `shopping`, `stay`, `event` 중 하나로 반드시 존재한다. UI·CLI가 값을 받지 않았다면 직렬화 전에 `visit`을 넣는다.
- 여행 기간은 일반 탐색에서 생략할 수 있지만 `event` intent에는 필수다. 기간이 없으면 month 특징을 비활성화한다.
- 날짜·시간대, 대상 지역, 동행 구성, 필수 제약, 선호 태그와 제외 장소를 검증한다.
- 자연어 mapper는 `proposed` 태그만 반환한다. 사용자 확인 또는 버전된 정책 임계값을 통과해 `accepted`가 된 태그만 정규화 요청에 들어가 점수에 영향을 준다.
- accepted preference weight는 모두 `0 < weight <= 1`이어야 한다. preference가 없으면 taxonomy를 비활성화하고, 태그가 있는데 유효 양수 weight가 없으면 요청 오류다.
- mapper가 제안한 hard constraint는 사용자 확인 전에는 확정하지 않는다.

동행 축은 다음 규칙으로 만든다.

| 요청 신호 | 활성 companion 축 |
|---|---|
| `party.context=solo` | `solo` |
| `party.context=couple` | `couple` |
| `party.context=friends` | `friends` |
| 만 4~12세 아이가 한 명 이상 | `kids` 추가 |
| `senior_count > 0` | `parents` 추가 |
| `family` 또는 `custom` | 관계 축을 추측하지 않고 위 연령 축만 사용 |

- 여러 활성 축의 시작 가중치는 동일하다.
- `solo`인데 총 인원이 두 명 이상인 것처럼 구조적으로 모순된 입력은 정규화 오류다.
- 만 4세 미만·13세 이상 아이만 있으면 현 `kids` 축을 적용하지 않고 coverage 경고를 남긴다.
- `parents`는 평균적 보행이 가능한 60대 이상 동행 적합도이며 접근성 요구를 대신하지 않는다.

### 3. intent별 후보 lane

| intent | 허용 `experience_scope` | 현재 건수 | 기본 포함 |
|---|---|---:|---|
| `visit` | `representative_visit` | 800 | 예 |
| `shopping` | `shopping_visit` | 397 | 명시 요청 때 |
| `stay` | `stay` | 209 | 명시 요청 때 |
| `event` | `event_participation` | 28 | 개최일 predicate 확인 때 |

- 현재 규모에서는 해당 lane 전건을 구조화 필터와 점수 계산에 통과시킨다.
- 임베딩 검색은 자유문장 관심사의 보조 후보 경로일 수 있지만 초기 필수 경로가 아니며 단독 후보원으로 사용하지 않는다.
- 숙박·쇼핑·축제를 일반 관광지와 같은 의미의 점수로 한 목록에 묵시적으로 섞지 않는다.
- 현재 축제 개최일은 자유 텍스트이므로 `baseline-v0`에서 자동 eligible로 만들지 않는다. 여행 기간과 비교 가능한 구조화 날짜가 없는 축제는 별도 `verification_candidates`로 반환한다.

### 4. 후보 자격과 필수 제약

후보 자격은 점수 계산 전 결정한다. 사용자 hard requirement와 장소의 관계는 다음 네 상태를 쓴다.

```text
pass | fail | unknown | not_applicable
```

원천 constraint와 추천 판정을 구분한다.

| 원천 상태 | 추천 판정 |
|---|---|
| fresh `confirmed` + 검수된 predicate + 요구사항 적용 | operator 평가 결과 `pass` 또는 `fail` |
| 자유 텍스트, `stale`, 원천 `unknown` | `unknown`, `verification_required=true` |
| 요구사항 scope가 그 장소·경험에 적용되지 않음 | `not_applicable` |
| 요구사항이 적용되지만 대응 사실이 없음 | `unknown`, `verification_required=true` |

- 원천 `status=confirmed` 자체는 사용자 요구 충족을 뜻하지 않는다.
- fresh 여부는 snapshot에 저장하지 않고 신뢰된 `evaluation_as_of`, 원천 `checked_at`과 versioned freshness policy로 요청 시 계산한다.
- 원천 `action=exclude|verify`는 조사 단계의 조치 힌트다. 현재 자유 텍스트 `exclude` 3건도 predicate 구조화·검수 전에는 자동 `fail`로 바꾸지 않는다.
- 구조화된 `fail`은 점수 계산 전에 제외하고 높은 선호 점수로 복구하지 않는다.
- active hard requirement가 `unknown`인 후보는 일반 `items`와 섞지 않고 `verification_candidates`로 보낸다.
- 사용자 요구와 무관한 운영·예약 source fact는 후보를 conditional로 바꾸지 않으며 확인 경고로만 붙인다.
- 빈 결과에서도 필수 조건을 자동 완화하지 않고 조건별 복구 후보 수를 `relaxation_options`로 제안한다.
- 축제의 month N/A는 낮은 점수가 아니라 개최일 확인 gate다.

향후 실행 가능한 장소 제약은 다음 계약으로 정규화한다.

```text
ConstraintFact
  constraint_id, kind, subject_scope
  operator, value, unit
  source_status, source_action
  checked_at, predicate_status
  source_ref_id, provenance
```

### 5. 특징 계산

초기 `baseline-v0`는 공통 feature snapshot에서 재현 가능한 네 특징군만 사용한다.

- `taxonomy_preference`: LCLS와 `place_kind`에서 파생한 통제 태그와 accepted 선호 태그의 유사도
- `companion`: 요청에 적용되는 `solo/couple/friends/kids/parents` 축
- `month`: 여행 기간이 걸친 월의 적합도
- `environment`: 사용자가 실내·야외·혼합 선호를 명시했을 때의 일치도

현재 데이터에 없는 style, theme, 절대 품질, 인기도, 체류시간, 정규화 가격과 이동시간을 가진 것처럼 점수화하지 않는다.

#### Taxonomy

버전된 `taxonomy-similarity-v0`는 다음 시작 규칙을 사용한다.

```text
exact controlled tag       1.0
explicit configured parent 0.6
otherwise                  0.0

taxonomy_raw
  = weighted_mean_over_preferences(
      max_similarity(preference_tag, place_tags)
    )
```

- `place_tags`는 LCLS와 `place_kind`에서만 결정적으로 파생한다.
- 구조화 선호의 mapper confidence는 `1.0`, 자연어 accepted 태그는 mapper confidence를 사용한다.
- 선택된 place tag의 source factor는 LCLS `1.0`, `place_kind` `0.8`, 일치 태그가 없는 분류 completeness `0.5`다.
- max similarity 동점은 `similarity DESC`, `source_factor DESC`, `tag_id ASC`로 선택한다.
- `taxonomy_reliability`는 선호 가중치로 평균한 `mapper_confidence * source_factor`다.
- 최종 taxonomy 값은 `0.5 + taxonomy_reliability * (taxonomy_raw - 0.5)`다.

#### Companion

각 활성 축을 먼저 신뢰도로 보정한 뒤 동일 가중치로 결합한다.

```text
companion_value
  = 0.7 * mean(adjusted_relevant_axes)
  + 0.3 * min(adjusted_relevant_axes)

companion_reliability
  = 0.7 * mean(relevant_axis_reliability)
  + 0.3 * min(relevant_axis_reliability)
```

접근성은 companion 값이 아니라 별도 hard constraint다.

#### Month

```text
month_value
  = 여행 기간 중 각 월에 속한 일수로 가중한 adjusted month axis 평균

month_reliability
  = 같은 일수 가중치로 계산한 month axis reliability 평균
```

축제에는 month 특징을 적용하지 않는다. 현재 month 값은 실제 예보가 아니라 1991~2020 제주 기후평년 기반 상대 적합도다.

#### Environment

`any`는 특징을 비활성화한다. 그 밖에는 다음 행렬을 쓴다.

| 요청 \ 장소 | indoor | mixed | outdoor |
|---|---:|---:|---:|
| indoor | 1.00 | 0.75 | 0.25 |
| mixed | 0.75 | 1.00 | 0.75 |
| outdoor | 0.25 | 0.75 | 1.00 |

- `environment=unknown`은 비활성이다.
- 현재 environment에는 축별 confidence가 없으므로 `baseline-v0`는 matched AI 분류의 고정 reliability를 `0.5 * ai_draft 0.8 = 0.40`으로 둔다.
- 최종 environment 값은 `0.5 + 0.40 * (environment_raw - 0.5)`다.

### 6. `ai_draft` 신뢰도 보정

companion과 month 원시 축은 신뢰도만큼 중립값 `0.5`에서 벗어나게 한다.

```text
axis_reliability
  = axis_confidence * provenance_factor * review_factor

adjusted_axis
  = 0.5 + axis_reliability * (raw_axis - 0.5)
```

`baseline-v0`의 provenance 시작 계수는 다음과 같다.

| provenance | factor |
|---|---:|
| `direct_evidence` | 1.00 |
| `researched_inference` | 0.80 |
| `archetype_prior` | 0.65 |
| `climate_heuristic` | 0.65 |
| `not_applicable` | 비활성 |

현재 ingest 가능한 축은 모두 `ai_draft`이므로 `review_factor=0.80`만 사용한다. `approved_as_is`나 `approved_with_changes`의 축별 override·confidence 계약이 구현되기 전에는 사람 승인 factor를 사용하지 않는다.

정보가 약하면 긍정·부정 어느 쪽으로도 강하게 밀지 않는다. confidence는 장소 품질이 아니라 해당 특징 추정의 휴리스틱 근거 강도이며 calibration된 확률이 아니다.

### 7. 기본 점수, confidence와 coverage

초기 활성 특징 가중치는 다음 평가 시작값을 쓴다.

| 특징군 | 가중치 |
|---|---:|
| taxonomy preference | 0.40 |
| companion | 0.35 |
| month | 0.15 |
| environment | 0.10 |

입력 또는 장소 데이터가 없는 특징은 0점 처리하지 않고 비활성화한다.

```text
effective_weight_g
  = base_weight_g / sum(active_base_weights)

contribution_g
  = effective_weight_g * (feature_value_g - 0.5)

place_fit
  = clamp(0.5 + sum(contribution_g), 0, 1)

result_confidence
  = sum(effective_weight_g * feature_reliability_g)
```

`result_confidence`는 확률이 아니라 활성 특징의 근거 강도다. 요청 신호가 누락돼 confidence가 인위적으로 높아 보이지 않도록 별도 coverage를 반환한다.

```text
request_coverage
  = sum(base_weight of requested groups with usable place data)
    / sum(base_weight of requested groups)
```

- taxonomy는 accepted preference가 있을 때, companion은 활성 party 축이 있을 때, month는 여행 기간이 있고 event가 아닐 때, environment는 `any`가 아닐 때 requested group이다.
- requested group이 하나도 없거나 active group이 0개면 `ranking_mode=exploration`, `place_fit=0.5`, `result_confidence=0`, `request_coverage=0`으로 둔다.
- exploration은 장소 품질 순위가 아니며 category 다양성 탐색 결과라고 표시한다.

불확실성은 중립 수축에 이미 반영되므로 같은 신호를 별도 패널티로 다시 차감하지 않는다.

결정적 기본 후보 정렬은 다음과 같다.

```text
place_fit DESC
request_coverage DESC
result_confidence DESC
source_order ASC
contentid ASC
```

### 8. 다양성 재정렬

다양성은 기본 `place_fit`을 바꾸지 않고 eligible 후보의 최종 표시 순서만 조정한다. `K=result_count`, `N=eligible 후보 수`일 때 다음 규칙을 쓴다.

```text
pool_size = min(N, max(5 * K, 50))
normalized_place_fit = place_fit  # 이미 0..1, 요청 내 min-max 금지

mmr(candidate)
  = 0.8 * normalized_place_fit
  - 0.2 * max_similarity(candidate, selected)
```

- 첫 선택의 `max_similarity`는 `0`이다.
- candidate pool은 기본 후보 정렬의 앞 `pool_size`건이다.
- `verification_candidates`는 MMR에 참여하지 않는다.

`diversity-v0` 유사도는 공통 snapshot 필드만 사용한다.

```text
similarity
  = 0.50 * category_similarity
  + 0.30 * same_place_kind
  + 0.20 * jaccard(controlled_place_tags)

category_similarity
  = 1.0  if same non-empty LCLS3
    0.6  else if same non-empty LCLS2
    0.3  else if same contenttypeid
    0.0  otherwise
```

빈 태그 집합의 Jaccard는 `0`이다. 각 반복 선택은 다음 순서로 동점을 푼다.

```text
MMR DESC
place_fit DESC
request_coverage DESC
result_confidence DESC
source_order ASC
contentid ASC
```

최종 rank는 MMR 선택 순서이므로 `place_fit` 내림차순과 다를 수 있다. 다양성을 끄면 기본 후보 정렬을 그대로 사용한다. 제목·주소·좌표가 비슷해도 `contentid`를 병합하거나 삭제하지 않는다.

### 9. 근거 기반 설명

각 결과 trace에는 다음을 기록한다.

- feature snapshot과 후보 lane
- 자격 판정과 제약별 `pass/fail/unknown/not_applicable`
- 특징군 및 하위 축별 raw, adjusted, reliability, effective weight와 contribution
- 실제 evidence ID, rule ID와 source
- `place_fit`, `request_coverage`, `result_confidence`, MMR 선택값
- 데이터·feature·filter·scoring·diversity·mapper 버전

`baseline-v0`의 사용자 설명은 reason code와 검증된 slot을 사용하는 결정적 템플릿으로 만든다. 실제 기여도가 큰 긍정 이유 2~3개, 충족한 확정 조건, 확인할 변동 정보와 불확실성만 표시한다. 기존 장소 rationale 전체를 복사하지 않으며 `ai_draft`, 출처 등급, 확인일, 기후평년 기반 month라는 경고를 숨기지 않는다.

LLM은 장소 점수나 필터 결과를 직접 출력하지 않는다. 후속 실험에서 구조화 태그 제안이나 reason 선택에 쓰더라도 accepted 요청과 결정적 템플릿이 authoritative하다.

## 장소 추천과 일정 최적화의 경계

장소 추천기는 장소별 `place_fit`, coverage, confidence, 후보 자격, 제약·확인 필요사항, catalog 위치와 버전을 반환한다. 거리나 이동시간으로 이 점수를 바꾸지 않는다.

후속 일정 최적화기는 별도 입력으로 예상 체류시간, 실제 이동시간 행렬, 영업·예약 time window, 일별 시작·종료 위치와 휴식 규칙을 받는다. 동선 때문에 후보를 제외할 수는 있지만 원래 `place_fit`은 유지하고 `schedule_feasibility`와 `schedule_utility`를 별도로 반환한다. 현재 데이터에는 이 일정 입력이 충분하지 않으므로 일정 최적화는 미구현이다.

## 폴백 원칙

- 후보 없음: 실패한 필수 제약과 조건별 복구 후보 수를 보여주고 자동 완화하지 않는다.
- active hard requirement가 unknown: 일반 결과에 섞지 않고 `verification_candidates`로 반환한다.
- `verification_candidates`는 점수 순위가 아니며 `source_order ASC`, `contentid ASC`로 정렬한다.
- 취향 신호 없음: 모든 fit을 0.5로 둔 결정적 `exploration` 결과를 만들고 개인화·품질 순위가 아님을 표시한다.
- 변동 정보 없음: `verification_required`로 유지하며 방문 가능하다고 단정하지 않는다.
- 자연어 mapper 실패: 구조화된 입력만 사용하고 매핑되지 않은 원문을 경고한다.
- event 여행 기간 없음: 요청 검증 오류다.
- event 개최일 predicate 없음: 해당 후보를 `verification_candidates`로만 반환한다.
- 외부 서비스 실패: 마지막 검증 snapshot과 시각을 표시하거나 해당 동적 기능을 생략한다.

## 버전과 재현성

추천 결과에는 최소한 다음을 연결한다.

- 장소 데이터 snapshot과 `dataset_status`
- manifest SHA-256, logical DB digest와 feature snapshot digest
- 요청 schema, taxonomy mapper와 similarity 버전
- feature, filter, scoring, diversity 정책 버전
- 외부 문맥이 있다면 제공자·확인 시각·freshness

가중치·계수·특징·필터·동점 규칙 변경은 별도 SPEC과 [평가 전략](evaluation.md)의 회귀 결과를 필요로 한다.
