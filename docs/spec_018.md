# SPEC-018: 클러스터 재사용·일자 한계효용 기반 일정 배분 v5

- 상태: Draft
- 작성일: 2026-08-17
- 최종 수정일: 2026-08-17
- 관련 이슈: 자차 일정의 `R=15km`를 새 중심 간 최소거리로도 사용하면서 기존 권역의 더 좋은 장소를 제외하고 먼 권역을 강제로 추천하는 문제
- 관련 문서: [문서 색인](README.md), [CCU-MMR 알고리즘 초안](ccu_mmr_algorithm_draft.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md), [SPEC-015](spec_015.md), [SPEC-017](spec_017.md)
- 관련 코드: `map-ui/ccu-mmr.js`, `map-ui/app.js`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-015, SPEC-017

## 배경

### 사실: 현재 동작

- 자차 일정은 일자 중심에서 장소까지의 Haversine 직선거리 반경 `R_day=15km`, 비자차는 `R_day=5km`를 사용한다.
- 한 일자의 capacity는 최대 6곳이다.
- 필수 장소 군집과 사용자 anchor를 만든 뒤 여행일이 남으면, 선택 course variant의 Top-N 중 **기존 모든 중심에서 `R_day` 밖인 장소**를 새 일자의 자동 anchor로 사용한다.
- 같은 권역에 미사용 고득점 장소가 남아 있어도 새 일자 중심 후보에서는 제외된다.
- 따라서 현재 구현은 사실상 `하루 수 = 서로 떨어진 권역 수`를 요구하며, 여행일이 늘어날수록 멀리 떨어진 장소 또는 주변 후보가 빈약한 장소가 선택될 수 있다.

### 문제 정의

`R_day`는 한 일자 안에서 이동 가능한 근사 활동 반경이다. 이를 새 중심 사이의 최소 분리 거리로 동시에 사용하면 다음 두 판단이 섞인다.

1. 어떤 장소가 특정 일자에 들어갈 수 있는가.
2. 새로운 일자를 기존 권역에 배정할지 새로운 권역에 배정할지.

한 권역에 좋은 장소가 12곳 있다면 하루 6곳씩 이틀을 배정할 수 있어야 한다. 한 지역을 하루만 방문해야 한다는 제약은 현재 요구사항에 없다.

## 결정 후보 — 미구현 초안

- `R_day`는 일자 중심과 장소 사이의 hard gate로만 사용한다.
- 서로 다른 일자가 같은 지리 클러스터 또는 같은 중심을 재사용할 수 있게 한다.
- 남은 일자마다 `기존 클러스터 재사용`과 `새 클러스터 개설`을 모두 시뮬레이션한다.
- 각 선택으로 최대 6곳의 실제 하루 후보를 구성한 뒤, 그 하루가 추가하는 한계효용 `DayGain`을 비교한다.
- 새 중심은 anchor 한 곳의 관련도만 보지 않고 반경 안 미사용 장소의 품질·밀도와 기존 일정에서의 이동거리까지 평가한다.
- 기존 권역보다 효용이 낮은 먼 권역을 여행일을 채우기 위해 강제로 선택하지 않는다. 기준 미달이면 일부 일자를 비운 `partially_filled` 결과와 이유를 반환할 수 있다.

## 목표

- 같은 권역의 고득점 미사용 장소를 버리지 않고 여러 일자에 배분한다.
- 여행일이 늘어난다는 이유만으로 일정 중심이 제주 전역으로 과도하게 퍼지는 현상을 줄인다.
- 기존 클러스터 재사용과 새 클러스터 개설을 같은 하루 단위 효용으로 비교한다.
- 새 중심 주변에 하루를 구성할 만큼 충분한 추천 후보가 있는지 평가한다.
- 필수 장소, 제외 장소, `R_day`, 하루 6곳 capacity와 후보 자격은 기존처럼 hard constraint로 유지한다.
- 선택 근거와 거리·밀도·한계효용 trace를 결과에 남긴다.

## 비목표

- 실제 도로시간·교통량·선박 시간·영업시간·예약·체류시간을 사용하는 완전한 경로 최적화
- 날짜 안의 방문 순서 최적화
- 자차 15km·비자차 5km 반경 자체의 품질을 이번 초안에서 확정하는 것
- 사용자 입력 없이 임의의 최대 이동거리 값을 운영 정책으로 확정하는 것
- 장소 관련도 `R_i`를 거리 때문에 변경하는 것

## 요구사항 — 미구현

- `REQ-1801`: 일자 활동 반경 `R_day`와 일자 중심 간 거리 정책을 분리한다.
- `REQ-1802`: 같은 지리 클러스터에 둘 이상의 일자를 배정할 수 있다.
- `REQ-1803`: 이미 일정에 사용한 장소는 다른 일자에 중복 배치하지 않는다.
- `REQ-1804`: 남은 일자마다 기존 클러스터 재사용 action과 새 클러스터 개설 action을 생성한다.
- `REQ-1805`: 각 action은 실제 후보를 최대 daily capacity까지 임시 배치한 뒤 평가한다.
- `REQ-1806`: 기존 클러스터 재사용은 해당 중심의 `R_day` 안에 있는 미사용 후보를 대상으로 한다.
- `REQ-1807`: 새 중심 action은 anchor 관련도, 반경 안 미사용 후보의 품질·개수와 기존 일정 중심까지의 거리를 함께 평가한다.
- `REQ-1808`: 선택 course variant 후보를 우선하되, variant 여부만으로 더 높은 총효용의 비-variant action을 배제하지 않는다.
- `REQ-1809`: 모든 배치에서 필수 장소, 후보 자격, 반경과 하루 capacity를 위반하지 않는다.
- `REQ-1810`: 선택할 만한 action이 없으면 먼 저효용 권역으로 강제 확장하지 않고 부분 일정과 미배정 이유를 반환한다.
- `REQ-1811`: 같은 입력·variant·config에서 action 생성, 점수와 일정 결과는 결정적이어야 한다.
- `REQ-1812`: 결과는 일자별 action type, 중심 재사용 여부, 후보 밀도, 거리 비용, 선택·탈락한 action의 점수 trace를 제공한다.

## 입력과 출력 — 제안

기존 요청의 `scheduleConfig`에 다음 파생 설정을 추가하는 안을 검토한다.

```text
scheduleConfig: {
  tripDays,
  dayRadiusKm,               // 자차 15, 비자차 5; 일자 중심→장소 hard gate
  dailyCapacity,             // 현재 6
  allocationMethod,          // marginal-day-gain-v1
  minDayGain?,               // 미결정
  minClusterCandidateCount?, // 미결정
  transitionPenaltyWeight?,  // 미결정
  maxCenterHopKm?            // 미결정; 도입 시 Haversine 근사임을 명시
}
```

일정 결과에는 다음 trace를 추가하는 안을 검토한다.

```text
schedule: {
  status: feasible | partially_filled | infeasible | not_requested,
  allocationMethod,
  dayClusters[]: {
    allocationAction: reuse_cluster | open_cluster | required_cluster | user_anchor,
    reusedClusterId?,
    candidateCountWithinRadius,
    placeUtility,
    coverageGain,
    redundancyPenalty,
    transitionDistanceKm,
    transitionPenalty,
    dayGain
  },
  unassignedDays[]: {
    dayIndex,
    reason
  }
}
```

## 설계 — 미구현

### 1. 필수 일정 생성

기존처럼 필수 장소를 `R_day`와 capacity로 군집화한다. 필수 군집 수가 여행일을 넘으면 `infeasible`을 유지한다.

### 2. 일자 action 생성

아직 배정하지 않은 일자마다 두 종류의 action을 만든다.

```text
reuse_cluster(C)
  = 기존 중심 C의 R_day 안에서
    아직 사용하지 않은 후보로 다음 하루 구성

open_cluster(a)
  = 미사용 후보 a를 중심 후보로 두고
    a의 R_day 안에서 다음 하루 구성
```

기존 중심 안의 후보가 이미 첫날 capacity를 채웠더라도, 미사용 후보가 남아 있으면 같은 중심으로 두 번째 날을 만들 수 있다.

### 3. 하루 후보 시뮬레이션

각 action은 현재 일자별 MMR 규칙으로 최대 6곳을 임시 선택한다. 선택 course variant 장소를 우선 평가하지만, 더 이상 없으면 전체 eligible 후보를 사용한다.

새 중심 후보는 anchor 한 곳의 점수만으로 선택하지 않는다. 최소한 다음 값을 계산한다.

```text
anchor relevance
반경 안 미사용 eligible 후보 수
반경 안 상위 후보의 관련도 또는 day relevance
현재 전체 일정과의 의미 중복
기존 일정 중심까지의 Haversine 거리
```

### 4. 한계효용 비교

초기 비교식은 다음 구조로 두고 실제 계수는 오프라인 시나리오로 결정한다.

```text
DayGain(action)
  = PlaceUtility(action)
  + w_coverage * CoverageGain(action)
  - w_redundancy * GlobalRedundancy(action)
  - w_transition * TransitionCost(action)
  - SparseDayPenalty(action)
```

- `PlaceUtility`: 임시 하루에 들어간 미사용 장소들의 요청 적합도·중심 적합도 합 또는 정규화 평균
- `CoverageGain`: 새 유형·경험·권역이 추가되는 값
- `GlobalRedundancy`: 이전 일자 장소들과의 의미 중복
- `TransitionCost`: 기존 일정 중심과 새 중심 사이의 거리 비용. 실제 도로시간이 없으므로 Haversine 근사임을 표시한다.
- `SparseDayPenalty`: 하루를 채울 후보가 너무 적거나 품질이 낮을 때의 패널티

가장 높은 `DayGain` action을 선택하고 사용 장소를 제거한 뒤 다음 일자를 다시 평가한다. `DayGain`이 최소 기준보다 낮으면 해당 일자를 억지로 채우지 않는다.

### 5. 클러스터와 날짜의 관계

```text
기존: 1 cluster ≈ 1 day

제안: 1 cluster → 1..N days
      1 day     → 정확히 1개의 활동 중심과 최대 6곳
```

지리 클러스터는 방문 권역이고, 일자는 그 권역에 배정되는 capacity slot으로 본다.

## 간단한 예시

```text
여행일: 3일
서귀포 중심 15km 안 미사용 고득점 장소: 10곳
제주시 새 중심 15km 안 후보: 5곳
두 중심 사이 거리: 큼

현재 방식:
  1일차 서귀포 6곳
  2일차 반경 밖 새 권역
  3일차 또 다른 반경 밖 새 권역

제안 방식:
  1일차 서귀포 상위 6곳
  2일차 서귀포 남은 4곳 action과 제주시 5곳 action의 DayGain 비교
  3일차 남은 후보로 다시 비교
```

새 권역의 관련도·경험 다양성 이득이 이동비용보다 클 때만 새 중심을 연다.

## 예외와 폴백

- 기존 클러스터 안 미사용 후보가 없으면 해당 reuse action을 만들지 않는다.
- 새 중심 주변에 후보가 거의 없으면 sparse penalty를 적용하거나 action을 제외한다.
- 필수 장소 때문에 먼 권역이 필요한 경우에는 거리 패널티로 필수 장소를 제거하지 않는다.
- 모든 action이 최소 효용 기준에 미달하면 `partially_filled`와 미배정 일자를 반환한다.
- 실제 이동시간이 없으므로 transition cost는 직선거리 근사이며 확정 이동시간으로 표현하지 않는다.
- `diversity=off`에서도 일정 배분의 거리 문제는 존재하므로, 적용 여부는 다양성 설정과 독립적으로 검토한다.

## 사실·가정·미결정 사항

### 사실

- 현재 데이터에는 모든 후보 사이의 실제 도로시간 행렬과 신뢰할 수 있는 체류시간이 없다.
- 현재 하루 capacity는 장소 수 6개이고 자차 반경은 15km다.
- 현재 자동 anchor는 기존 모든 중심 반경 밖이라는 hard gate를 사용한다.

### 가정

- 같은 권역의 미사용 고득점 후보가 충분하면 해당 권역에 추가 일자를 배정하는 것이 먼 저밀도 권역을 여는 것보다 사용자 만족도가 높을 가능성이 있다.
- Haversine 거리는 실제 이동시간보다 부정확하지만 현재 구현에서 상대적 과도 이동을 억제하는 근사 비용으로는 사용할 수 있다.

### 미결정 사항

- `DayGain` 각 계수와 최소 허용값
- 하루를 충분히 구성한다고 볼 최소 후보 수 또는 최소 품질 합
- transition distance를 최근 일자, 가장 가까운 기존 중심, 숙소 기준 중 무엇으로 계산할지
- 직선거리 최대 guardrail을 둘지와 자차·비자차별 값
- 같은 중심을 그대로 재사용할지, 남은 후보의 weighted medoid로 일자 중심을 재계산할지
- 비어 있는 일자를 허용할지 또는 사용자에게 선택지를 보여줄지
- course variant 우선권을 hard priority로 유지할지 soft bonus로 바꿀지

## 영향 범위

- 변경 예정 파일: 미정. 구현 승인 시 `map-ui/ccu-mmr.js`, `map-ui/app.js`, 문서·단위 테스트·실데이터 검증 스크립트가 주요 범위다.
- 데이터 마이그레이션: 현재 예상 없음.
- 호환성 영향: 일정 method·status와 trace가 바뀌므로 결과 schema version 검토가 필요하다.
- 보안·개인정보 영향: 현재 예상 없음. 정확한 사용자 위치나 숙소 위치를 입력으로 추가할 경우 별도 개인정보 검토가 필요하다.

## 승인 기준 — 구현 시 검증안

- `AC-1801`: 한 권역에 6곳을 초과하는 고득점 후보가 있으면 같은 클러스터를 둘 이상의 일자에 재사용할 수 있다.
- `AC-1802`: 기존 클러스터 안의 다음 하루 효용이 더 높으면 반경 밖 새 중심을 선택하지 않는다.
- `AC-1803`: 새 중심의 효용이 더 높을 때는 새 권역을 열 수 있다.
- `AC-1804`: 모든 일자에서 중심-장소 거리가 `R_day` 이내이고 하루 6곳을 넘지 않는다.
- `AC-1805`: 필수 장소는 정확히 한 번 포함되고 제외 장소는 재노출되지 않는다.
- `AC-1806`: 주변 후보가 빈약한 고득점 단독 장소가 자동 중심으로 과도하게 선택되지 않는다.
- `AC-1807`: 고정 시나리오에서 기존 v4보다 최대 중심 확산 거리와 총 중심 간 거리가 감소한다.
- `AC-1808`: 같은 입력·variant·config에서 action 점수와 결과가 재현된다.
- `AC-1809`: 선택·탈락 action의 품질·밀도·거리 trace가 실제 계산과 일치한다.
- `AC-1810`: 적합한 action이 없을 때 먼 저효용 장소를 강제 추천하지 않고 부분 일정 상태를 반환한다.

## 테스트 계획 — 구현 시

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-1801~AC-1803 | 조밀한 기존 권역과 먼 새 권역의 action 비교 단위 테스트 | `scripts/test_ccu_mmr.cjs` |
| AC-1804~AC-1806 | 반경·capacity·필수·밀도 회귀 | `scripts/test_ccu_mmr.cjs` |
| AC-1807 | 기존 v4 대비 중심 확산·총 거리 고정 시나리오 비교 | 신규 오프라인 fixture 또는 `scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-1808~AC-1809 | 결정성·trace 재계산 검증 | `scripts/test_ccu_mmr.cjs` |
| AC-1810 | 저효용 후보만 남은 부분 일정 시나리오 | `scripts/test_ccu_mmr.cjs` |
| UI | 재사용 중심·새 중심·미배정 이유 표시 확인 | `map-ui/` 로컬 브라우저 |

## 구현 결과

미구현. 사용자와 설계 방향을 논의하기 위한 초안이다.

## 설계와 달라진 점

미구현이므로 없음.

## 알려진 제한

- 계수와 임계값은 독립 사용자 평가 없이 확정할 수 없다.
- 실제 도로시간이 없어 제주 지형·우회·교통과 선박 이동을 정확히 반영하지 못한다.
- greedy marginal gain은 전체 여행의 전역 최적해를 보장하지 않는다. 필요하면 후속 단계에서 beam search 또는 정수계획 기준선과 비교한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-17 | 반경을 새 중심 분리 조건으로 사용해 발생하는 먼 장소 추천 문제와 클러스터 재사용·일자 한계효용 해결안을 Draft로 작성 |
