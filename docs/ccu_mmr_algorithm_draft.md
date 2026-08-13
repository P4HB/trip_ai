# CCU-MMR 장소 추천 및 일정 군집 알고리즘 초안

- 문서 상태: 장소 추천 내부 데모와 중심 반경·capacity 근사 일정 v2 구현
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-13
- 관련 SPEC: [SPEC-008](spec_008.md), [SPEC-014](spec_014.md), [SPEC-015](spec_015.md)
- 관련 기준 문서: [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md)

> 이 문서는 41개 장소·상황 라벨을 사용하는 CCU-MMR 장소 추천과, 추천 결과를 여행일별로 묶기 위한 중심 반경·일일 capacity 군집을 하나의 흐름으로 정리한다. 중심 반경·capacity 일정 v2는 SPEC-015에 따라 구현하며 실제 이동시간, 체류시간과 방문 순서 최적화는 포함하지 않는다.

## 1. 알고리즘 한눈에 보기

CCU-MMR은 다음 세 가지를 결합한다.

```text
CCU-MMR
= Constraint-First
+ Contextual Utility
+ Maximal Marginal Relevance
```

- `Constraint-First`: 갈 수 없거나 목적에 맞지 않는 장소를 먼저 제외한다.
- `Contextual Utility`: 현재 취향·동행자·여행 월에 맞는 장소 적합도를 계산한다.
- `MMR`: 적합도가 높으면서 이미 선택한 장소와 경험이 지나치게 겹치지 않는 장소를 고른다.

일정 군집까지 포함한 전체 흐름은 다음과 같다.

```text
구조화된 여행 입력
→ 후보 자격과 필수 조건 검사
→ 18개 원자 라벨 취향 적합도 P
→ 동행자 A와 월 M 결합
→ 장소 관련도 R 계산
→ 필수 장소를 중심 반경으로 지리 군집화
→ 일일 capacity 초과 군집 재분할
→ 여행일보다 군집이 적으면 사용자에게 새 anchor 제안
→ 날짜별 필수 장소·anchor를 선선택한 CCU-MMR
→ 반경과 남은 capacity 안에서 추가 장소 선택
→ 일자별 장소 군집 출력
```

장소 관련도와 일정 배치는 분리한다. 거리 때문에 장소 적합도 `R_i`를 바꾸지 않고, 중심 근접도와 capacity는 특정 날짜에 배치할 수 있는지를 판단하는 별도 값으로 사용한다.

## 2. 입력

초기 버전은 자연어 입력을 사용하지 않고 UI 또는 API의 구조화된 값을 받는다.

```text
CCUMMRScheduleRequest {
  destination_region
  intent: visit | shopping | stay | event
  travel_start_date
  travel_end_date
  trip_days: k
  transport_mode: car | no_car
  companion_type: solo | couple | friends | kids | parents | none
  preferences[] {
    feature
    mode: benefit | avoid | target
    weight: 1 | 2 | 4
    target?
    tolerance?
  }
  required_place_ids[]
  anchor_place_ids[]
  excluded_place_ids[]
  schedule_config {
    cluster_radius_km: 15 if car, otherwise 5
    capacity_mode: place_count
    daily_capacity: 6
    beta_center: 0.20
  }
}
```

`required_place_ids`는 반드시 일정에 들어가야 하는 장소다. 여행일 `k`는 시작일과 종료일을 포함해 계산한다. 사용자는 자차 여부만 입력하며 v1은 자차면 반경 15km, 비자차면 5km를 적용한다. 이 반경은 실제 도로시간이 아니라 중심과 장소 사이의 Haversine 직선거리 임계값이다.

v2 capacity는 체류시간 데이터가 없는 현재 한계를 명시하고 `place_count=6곳/일`을 상한으로 사용한다. `visit_minutes` 방식은 체류시간 데이터가 확보된 뒤 도입한다.

## 3. 라벨 구성

### 3.1 점수에 직접 사용하는 원자 라벨 18개

| 그룹 | 라벨 |
|---|---|
| Theme 8 | `mountain`, `ocean`, `activity`, `culture_history`, `theme_park`, `cafe`, `traditional_market`, `festival` |
| Environment 2 | `indoor_ratio`, `weather_sensitivity` |
| Atomic Style 8 | `restfulness`, `physical_ease`, `visit_duration_flexibility`, `scenic_value`, `distinctiveness`, `local_embeddedness`, `landmark_significance`, `photo_value` |

### 3.2 직접 점수에 다시 넣지 않는 파생 Style 6개

```text
healing_slow
scenic_immersion
discovery_explorer
local_immersion
iconic_highlight
photo_mood
```

파생 Style은 원자 라벨로부터 계산되므로 직접 점수에 함께 넣으면 같은 특성이 중복 반영된다. UI 프리셋과 요약 태그에만 사용한다.

### 3.3 상황 라벨 17개

| 그룹 | 라벨 수 | 사용 방식 |
|---|---:|---|
| Companion | 5 | 대표 동행 유형 하나의 축을 사용 |
| Month | 12 | 여행 기간에 포함된 월을 일수로 가중 평균 |

모든 라벨의 신뢰도는 동일하게 취급한다. 출처·검수 상태·confidence에 따른 수축이나 추가 감점 없이 저장된 라벨값을 그대로 사용한다. 출처 정보는 데이터 품질 관리에는 유지하지만 초기 추천 점수에는 넣지 않는다.

## 4. 후보 자격과 필수 조건

취향 점수보다 먼저 장소의 후보 자격을 판정한다.

| 상태 | 의미 |
|---|---|
| `eligible` | 활성 필수 조건을 충족해 일반 추천 가능 |
| `conditional` | 예약·영업·접근성 등 추가 확인 필요 |
| `ineligible` | 필수 조건 위반 또는 사용자 제외 장소 |

필수 조건 위반은 높은 취향 점수로 상쇄하지 않는다. 구조화되지 않은 영업·예약·접근성 정보는 자동으로 통과시키지 않고 조건부 후보나 확인 사항으로 분리한다.

intent lane은 서로 섞지 않는다.

```text
visit    → 관광·문화·레포츠
shopping → 쇼핑
stay     → 숙박
event    → 축제·행사
```

## 5. 구조화된 선호 효용

각 활성 원자 라벨에 대한 선호는 다음 구조를 가진다.

```text
p_k = (mode, weight, target, tolerance)
```

```text
benefit: u_k(x) = x
avoid:   u_k(x) = 1 - x
target:  u_k(x) = exp(-(x-target)^2 / (2*tolerance^2))
ignore:  계산에서 제외
```

중요도는 `1`, `2`, `4`를 사용하고 활성 가중치의 합으로 정규화한다. “반드시”는 큰 가중치가 아니라 필수 조건으로 입력해야 한다.

## 6. 장소 관련도 계산

### 6.1 개인 취향 P

```text
P_i
  = sum(w_k * u_k(x_ik))
    / sum(w_k)
```

사용자가 선택하지 않은 라벨은 0점으로 넣지 않고 계산에서 제외한다.

### 6.2 동행자 A

대표 동행 유형 하나를 사용한다.

```text
A_i(g) = companion_score_i,g
```

아이·고령자의 안전이나 휠체어 접근 요구는 동행 점수가 아니라 별도 필수 조건이다.

### 6.3 여행 월 M

```text
M_i(date_range)
  = sum(days_in_month_m * month_score_i,m)
    / sum(days_in_month_m)
```

축제는 일반 월 적합도로 개최 가능성을 대신하지 않는다. 구조화된 개최일 확인이 별도로 필요하다.

### 6.4 날씨 W

실시간 날씨가 연결된 후에만 다음 값을 사용할 수 있다.

```text
W_i(context)
  = 1 - weather_badness(context) * weather_sensitivity_i
```

현재 `ccu-mmr-v2-six-place-schedule`은 날씨 블록을 비활성화한다.

### 6.5 최종 장소 관련도 R

활성 블록만 다시 정규화한다.

```text
R_i
  = normalized_sum(
      W_P * P_i,
      W_A * A_i,
      W_M * M_i,
      W_W * W_i
    )
```

평가 전 block weight seed는 다음과 같다.

| 블록 | 초기값 |
|---|---:|
| 개인 취향 P | 0.70 |
| 동행자 A | 0.15 |
| 월 M | 0.10 |
| 날씨 W | 0.05 |

`R_i`는 장소의 절대 품질이 아니라 현재 요청에 대한 적합도다.

## 7. 필수 장소의 중심 반경 지리 군집

실제 장소 간 도로 이동시간은 사용하지 않는다. 필수 장소의 좌표로 각 군집의 중심을 계산하고 중심에서 각 장소까지의 Haversine 거리만 검사한다.

```text
center(C)
  = 필수 장소 좌표의 구면 또는 지역 투영 평균점

radius(C)
  = max Haversine(center(C), place_i)
```

각 필수 장소를 singleton 군집으로 시작한다. 두 군집을 합친 뒤 새 중심을 계산했을 때 모든 장소가 반경 `R` 안에 들어오는 병합 중 반경 증가가 가장 작은 병합을 반복한다.

```text
merge(A,B) allowed
  iff radius(A union B) <= R
```

더 이상 병합할 수 없을 때 `c_geo`개의 지리 군집을 얻는다.

이 방법은 Complete-link HAC가 아니다. Complete-link는 클러스터 간 가장 먼 장소 쌍을 사용하지만, 이 초안은 오직 `중심 ↔ 장소` 거리만 사용한다. 한 클러스터의 반대편에 있는 두 장소는 서로 최대 약 `2R` 떨어질 수 있다.

기존 필수 장소 군집의 중심은 이후 추가 추천 장소 때문에 이동시키지 않는다. 그래야 추천이 반복되면서 권역이 계속 밀려나는 현상을 막을 수 있다.

## 8. 일일 capacity와 초과 군집 재분할

지리적으로 가까운 장소가 많으면 `c_geo <= k`여도 하루에 모두 방문할 수 없다. 따라서 각 지리 군집의 수요 합을 검사한다.

```text
demand_i = estimated_visit_minutes_i  if mode = visit_minutes
demand_i = 1                          if mode = place_count

used_capacity(C) = sum demand_i
```

```text
used_capacity(C) <= B
  → 하루 군집 하나로 사용 가능

used_capacity(C) > B
  → 같은 권역이어도 여러 하루 군집으로 분할
```

지리 군집 `G`의 최소 필요 군집 수 하한은 다음과 같다.

```text
q_lower(G) = ceil(sum demand_i / B)
```

`q=q_lower`부터 증가시키며 capacity-constrained center clustering을 실행한다. 각 분할 군집은 동시에 다음 조건을 만족해야 한다.

```text
max Haversine(center(C), place_i) <= R
sum demand_i <= B
```

조건을 만족하는 첫 `q`를 `q*(G)`로 사용한다. 구현 후보는 capacity-constrained k-means 또는 작은 필수 장소 집합에 대한 중심 후보 기반 CP-SAT 할당이다.

예를 들어 모든 필수 장소가 한 반경 안에 있어 `c_geo=1`이어도 장소가 8개이고 하루 최대 장소 수가 4개라면 다음과 같다.

```text
q_lower = ceil(8 / 4) = 2
```

따라서 최소 두 개의 하루 군집을 만든다. 두 군집의 중심이 서로 가까워도 서로 다른 날짜를 의미하므로 문제가 아니다.

## 9. 최종 군집 수와 새 추천 anchor

모든 지리 군집의 capacity 분할 결과를 합산한다.

```text
c_final = sum(q*(G))
```

### 9.1 `c_final > k`

현재 필수 장소·반경·capacity로는 여행일 안에 배치할 수 없다. 먼 군집을 억지로 합치거나 필수 장소를 자동 제외하지 않는다.

사용자에게 다음 조정안을 보여준다.

- 여행일 증가
- 하루 capacity 증가
- 반경 증가
- 필수 장소 일부 해제

### 9.2 `c_final = k`

각 하루 군집의 남은 capacity 안에서 추가 장소를 추천한다.

### 9.3 `c_final < k`

기존 모든 군집 중심에서 반경 밖에 있는 장소 중 CCU 관련도가 높은 후보를 사용자에게 보여준다.

```text
outside(i)
  = for every C:
      Haversine(center(C), i) > R
```

사용자가 선택한 장소를 새 군집의 고정 `anchor`로 사용한다.

```text
new_cluster = { selected_anchor }
center(new_cluster) = coordinates(selected_anchor)
```

이 과정을 `c_final=k`가 되거나 사용자가 더 이상 날짜를 채우지 않을 때까지 반복한다. 선택된 anchor는 해당 날짜에 반드시 들어가는 장소로 취급한다.

## 10. 하루 군집 안의 추가 장소 CCU-MMR

각 하루 군집에서 필수 장소와 anchor를 먼저 선택된 집합으로 둔다.

```text
selected(C)
  = required_places(C)
    union {anchor(C)}
    union already_recommended(C)
```

후보는 다음 hard gate를 통과해야 한다.

```text
Haversine(center(C), candidate) <= R
used_capacity(C) + demand(candidate) <= B
candidate constraint status = eligible
```

중심에 가까울수록 높은 별도 배치값을 줄 수 있다.

```text
center_fit(i,C)
  = max(0, 1 - Haversine(center(C),i) / R)
```

장소 적합도와 중심 근접도를 결합해 날짜 안에서의 관련도를 만든다.

```text
day_relevance(i,C)
  = (1 - beta_center) * R_i
  + beta_center * center_fit(i,C)
```

그다음 MMR로 의미 중복을 줄인다.

```text
MMR_day(i,C)
  = lambda_MMR * day_relevance(i,C)
  - (1 - lambda_MMR)
    * max similarity(i,j) for j in selected(C)
```

필수 장소와 anchor가 `selected(C)`에 들어 있으므로 추가 추천은 이들과도 의미적으로 겹치지 않게 선택된다.

장소 유사도는 18개 원자 라벨만 사용한다.

```text
feature_distance(i,j)
  = sum(v_k * abs(x_ik - x_jk)) / sum(v_k)

feature_similarity(i,j)
  = 1 - feature_distance(i,j)
```

후보를 하나 선택할 때마다 capacity를 차감하고 다음 후보를 다시 평가한다. 반경 또는 capacity를 넘는 후보는 점수를 낮추는 것이 아니라 해당 하루 후보에서 제외한다.

## 11. 출력

장소 추천과 일정 군집 결과를 분리해서 반환한다.

```text
CCUMMRScheduleResult {
  place_ranking[] {
    place_id
    relevance_R
    preference_P
    companion_A
    month_M
  }

  schedule_clustering {
    method: center-radius-capacity-v0
    approximation: straight_line_center_distance
    radius_km
    capacity_mode
    daily_capacity
    geographic_cluster_count
    final_day_cluster_count
    day_clusters[] {
      center
      center_type
      anchor_place_id?
      required_place_ids[]
      recommended_place_ids[]
      used_capacity
      remaining_capacity
      max_center_distance_km
    }
  }

  warnings[]
  relaxation_options[]
}
```

사용자에게는 장소 선정 이유와 일자 배치 이유를 구분해서 표시한다.

```text
장소 선정 이유:
  바다·경관 선호와 부모님 동행 적합도가 높음

일자 배치 이유:
  선택한 날짜 중심에서 반경 안에 있고 남은 방문 capacity를 충족함
```

## 12. 예외와 폴백

- 필수 장소가 없으면 모든 날짜의 anchor를 추천·사용자 선택으로 채운다.
- 필수 장소 하나는 해당 장소 좌표를 중심으로 singleton 군집을 만든다.
- 좌표가 없는 필수 장소는 추측하지 않고 일정 군집을 중단한다.
- 장소 하나의 demand가 하루 capacity보다 크면 실행 불가능으로 반환한다.
- `visit_minutes`에 필요한 체류시간이 없으면 버전된 폴백을 명시적으로 사용하거나 `place_count` mode로 전환한다.
- `c_final > k`이면 강제 병합이나 필수 장소 자동 제외를 하지 않는다.
- 새 anchor 후보가 없으면 날짜를 비워 두거나 반경·군집 정책 변경을 요청한다.
- 결과는 직선거리 기준 근사 군집이며 실제 도로, 산악 우회, 선박, 교통량과 방문 순서를 보장하지 않는다.
- 실제 이동시간을 확보하면 중심 반경 단계 뒤에 경로 실행 가능성 검사를 추가하되 장소 적합도 `R_i`는 유지한다.

## 13. 평가 전 파라미터와 미결정 사항

장소 추천 데모의 현재 seed는 다음과 같다.

| 항목 | 초기값 |
|---|---:|
| P/A/M/W block | `0.70 / 0.15 / 0.10 / 0.05` |
| MMR 관련도 비중 `lambda_MMR` | `0.75` |
| MMR 후보 pool | 최대 `100` |
| 기본 결과 수 | `10` |

일정 군집에서 새로 결정해야 할 값은 다음과 같다.

- 중심 반경 `R`
- 하루 최대 장소 수 또는 체류시간 capacity `B`
- 장소별 예상 체류시간 출처와 폴백
- capacity-constrained center clustering solver와 동점 규칙
- 중심 근접도 비중 `beta_center`
- 새 anchor 후보 수와 사용자 선택 UI
- 실제 도로시간 도입 시 근사 군집을 재검증하는 정책

## 14. 보장하려는 원칙

1. 갈 수 없는 장소는 높은 취향 점수로 복구하지 않는다.
2. 사용자가 선택한 원자 라벨만 장소 적합도에 사용한다.
3. 모든 라벨의 신뢰도는 동일하게 취급한다.
4. 필수 장소는 일정 군집에서 누락하지 않는다.
5. 지리적으로 가까워도 하루 capacity를 넘으면 여러 날짜로 나눈다.
6. 추가 추천 중심지는 사용자가 선택하며 새 날짜의 고정 anchor가 된다.
7. 필수 장소와 anchor를 MMR 중복 계산에 포함한다.
8. 장소 적합도와 일정 배치값을 분리한다.
9. 중심 반경 결과를 실제 이동시간 기반 확정 일정으로 표현하지 않는다.

## 15. 현재 구현 범위

- 구현됨: 구조화된 입력, P/A/M 관련도, 18원자 라벨 유사도, Top-N MMR, 지도·41축·웹 조사 표시 (`ccu-mmr-v2-six-place-schedule`)
- 구현됨: 자차 여부, 필수 장소, 중심 반경 병합, 하루 6곳 capacity 분할, 추가 중심 후보 선택, 날짜별 MMR, 일차 hover/focus 지도 강조 (`ccu-mmr-v2-six-place-schedule`)
- 미구현: 실제 이동시간·체류시간·영업시간·예약과 방문 순서 최적화

초기값과 정확한 입출력 계약은 [SPEC-015](spec_015.md)를 따른다.
