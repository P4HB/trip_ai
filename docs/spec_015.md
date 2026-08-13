# SPEC-015: 중심 반경·일일 수용량 기반 근사 일정 군집 v2

- 상태: Implemented
- 작성일: 2026-08-13
- 최종 수정일: 2026-08-13
- 관련 문서: [문서 색인](README.md), [CCU-MMR 알고리즘 초안](ccu_mmr_algorithm_draft.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md)
- 관련 코드: `map-ui/ccu-mmr.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css`
- 선행 SPEC: [SPEC-014](spec_014.md)

## 배경

현재 장소 추천 데모는 41축 라벨로 Top-N 장소를 고르지만 여행일별로 가까운 장소를 묶지 않는다. 실제 도로 이동시간은 아직 없으므로 v1은 장소 좌표와 클러스터 중심 사이의 Haversine 직선거리만 사용한다. 여행일 수는 기존 시작일·종료일에서 계산하고, 사용자는 자차 여부와 필수 장소를 입력한다.

반경만 제한하면 한 권역에 장소가 몰렸을 때 하루에 방문하기 어려운 수가 한 클러스터에 들어갈 수 있다. 따라서 하루 장소 수 상한도 독립적인 hard gate로 적용한다.

## 결정

| 항목 | v1 결정 |
|---|---|
| 여행일 `k` | 시작일과 종료일을 모두 포함한 날짜 수 |
| 이동수단 입력 | `car` 또는 `no_car` |
| 자차 반경 `R` | 15km |
| 비자차 반경 `R` | 5km |
| capacity mode | `place_count` |
| 하루 capacity `B` | 6곳 |
| 중심 근접도 가중치 | `beta_center = 0.20` |
| 거리 | 중심-장소 Haversine 직선거리 |
| 필수 장소 처리 | 모든 필수 장소를 정확히 한 번 포함 |
| 필수 장소가 없는 빈 일자 | 기존 중심 반경 밖 고득점 후보를 사용자에게 추가 중심지로 제안 |

반경과 capacity는 사용자가 직접 입력하지 않는다. UI에는 자차 여부만 받고 실제 적용값을 요청·결과 JSON과 안내 문구에 공개한다. 이후 실제 체류시간과 경로 데이터가 확보되면 별도 SPEC에서 정책을 교체한다.

## 목표

- 필수 장소를 중심 반경 `R` 안의 지리 클러스터로 묶는다.
- 같은 권역에 필수 장소가 몰려도 하루 6곳을 넘으면 여러 일자로 분할한다.
- 최종 클러스터 수가 여행일보다 많으면 강제 병합하지 않고 실행 불가를 알린다.
- 최종 클러스터 수가 여행일보다 적으면 기존 중심 반경 밖의 고득점 장소를 추가 중심 후보로 제안한다.
- 각 일자에서는 필수 장소와 사용자 선택 anchor를 MMR 선선택 집합에 포함해 추가 장소를 고른다.

## 비목표

- 도로망·대중교통·교통량을 사용한 실제 이동시간 계산
- 방문 순서 최적화, 영업시간, 예약, 식사시간, 숙박지 연계
- 장소별 체류시간 추정과 분 단위 일일 budget
- 자차 종류, 운전 숙련도, 정확한 사용자 위치 추적
- 반경과 capacity의 자동 학습 또는 개인별 최적화

## 요구사항

- `REQ-1501`: 여행일은 기존 여행 시작일·종료일에서 계산하며 두 날짜가 없으면 일정 군집을 만들지 않는다.
- `REQ-1502`: UI는 자차 여부를 필수 구조화 입력으로 받는다.
- `REQ-1503`: 자차면 `R=15km`, 비자차면 `R=5km`를 사용하고 `B=6곳/일`을 공통 적용한다.
- `REQ-1504`: UI는 필수 장소 ID 직접 입력 대신 장소명·주소·ID 검색과 선택 목록을 제공한다. 내부 요청은 선택된 장소의 ID 배열을 유지한다.
- `REQ-1505`: 필수 장소는 singleton에서 시작해 합친 중심에서 모든 구성 장소까지의 거리가 `R` 이하인 병합만 허용한다.
- `REQ-1506`: 지리 클러스터가 6곳을 넘으면 최소 `ceil(n/6)`개의 일자 클러스터로 분할한다. 분할된 클러스터는 부모 지리 중심을 유지해 반경 제약을 보존한다.
- `REQ-1507`: 모든 필수 장소는 최종 일자 클러스터에 정확히 한 번 포함되어야 한다.
- `REQ-1508`: 최종 필수 일자 클러스터 수가 `k`보다 많으면 상태를 `infeasible`로 반환하고 자동 제외나 강제 병합을 하지 않는다.
- `REQ-1509`: 최종 클러스터 수가 `k`보다 작으면 기존 모든 중심에서 `R` 밖인 고득점 후보를 추가 중심 후보로 반환한다.
- `REQ-1510`: 사용자가 선택한 추가 중심 장소는 해당 장소 좌표를 고정 중심으로 하는 새 일자 클러스터가 된다.
- `REQ-1511`: 일자별 추가 추천은 중심 반경과 남은 capacity를 hard gate로 적용한다.
- `REQ-1512`: 일자별 MMR의 선선택 집합에는 필수 장소, anchor, 이미 추가한 추천 장소를 모두 포함한다.
- `REQ-1513`: 결과에는 적용 반경, capacity, 중심, 최대 중심거리, 사용량, 상태와 제한 문구를 포함한다.
- `REQ-1514`: 결과를 실제 도로 이동시간이 반영된 확정 일정으로 표현하지 않는다.
- `REQ-1515`: 필수 장소 검색 결과는 현재 지역·장소 목적에 맞고 41축 추천 점수를 계산할 수 있는 장소만 표시하며 이미 선택된 장소는 중복 제안하지 않는다.
- `REQ-1516`: 선택된 필수 장소는 이름·유형·지역과 함께 표시하고 개별 삭제할 수 있어야 한다.
- `REQ-1517`: 필수 장소는 현재 후보 데이터에 존재하고 좌표와 추천 점수가 있어야 하며 제외 장소와 중복될 수 없다.
- `REQ-1518`: 오른쪽 일차 카드에 포인터를 올리거나 카드 내부에 키보드 포커스가 있는 동안 지도에는 해당 일차 장소만 표시하고 강조한다. 포인터와 포커스가 모두 벗어나면 전체 일정 장소를 복원한다.

## 입출력 계약

요청의 일정 관련 필드는 다음과 같다.

```text
{
  travelWindow: { startDate, endDate },
  transportMode: "car" | "no_car",
  requiredPlaceIds: string[],
  anchorPlaceIds: string[]
}
```

정규화 후에는 다음 설정이 명시된다.

```text
scheduleConfig: {
  tripDays,
  radiusKm,
  capacityMode: "place_count",
  dailyCapacity: 6,
  centerWeight: 0.20
}
```

결과에는 기존 Top-N `items`와 별도로 다음 근사 일정이 포함된다.

```text
schedule: {
  status: "feasible" | "needs_anchor_selection" | "infeasible" | "not_requested",
  method: "center-radius-capacity-v2",
  tripDays,
  radiusKm,
  dailyCapacity,
  geographicClusterCount,
  requiredDayClusterCount,
  unfilledDayCount,
  dayClusters[],
  anchorCandidates[],
  violations[]
}
```

경도·위도 순서는 각각 `lng`, `lat`이다.

## 일정 군집 절차

1. 필수 장소 각각을 singleton으로 만든다.
2. 합친 구면 중심에서 모든 구성 장소까지 15km 또는 5km 이내인 클러스터 쌍 중 합친 반경이 가장 작은 쌍을 반복 병합한다.
3. 각 지리 클러스터의 장소를 중심 기준 방위각 순으로 정렬하고 하루 6곳 이하의 연속 묶음으로 나눈다. 분할된 묶음은 부모 지리 중심을 유지한다.
4. 필수 일자 클러스터 수가 여행일을 넘으면 `infeasible`로 종료한다.
5. 부족한 일자는 기존 중심에서 반경 밖인 고득점 장소를 사용자에게 제안하고, 선택된 장소를 고정 중심으로 추가한다.
6. 각 일자 중심의 반경 안에서 아직 다른 일자에 쓰지 않은 후보를 대상으로 다음 점수를 반복 계산한다.

```text
center_fit(i,C) = max(0, 1 - distance(center(C), i) / R)
day_relevance(i,C) = 0.8 * relevance(i) + 0.2 * center_fit(i,C)
MMR_day(i,C) = 0.75 * day_relevance(i,C)
             - 0.25 * max feature_similarity(i,j), j in selected(C)
```

## 영향 범위

- 코드: `map-ui/ccu-mmr.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css`
- 테스트: `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 문서: `docs/README.md`, `docs/ccu_mmr_algorithm_draft.md`, `map-ui/README.md`
- 데이터 마이그레이션: 없음

## 승인 기준

- `AC-1501`: 자차/비자차 요청이 각각 15km/5km 반경으로 정규화된다.
- `AC-1502`: 가까운 필수 장소 8곳과 하루 6곳 조건이 2개 일자 클러스터로 나뉜다.
- `AC-1503`: 모든 일자 클러스터가 6곳 이하이고 중심거리 제한을 만족한다.
- `AC-1504`: 필수 일자 클러스터 수가 여행일보다 많으면 `infeasible`가 반환된다.
- `AC-1505`: 빈 일자가 있으면 반경 밖 후보가 제안되고 선택 anchor로 새 클러스터가 만들어진다.
- `AC-1506`: 일자 MMR에서 필수 장소와 anchor가 유사도 계산에 반영된다.
- `AC-1507`: UI에서 자차 여부를 입력하고 필수 장소를 검색·선택하여 적용 반경·capacity 및 일자별 결과를 확인할 수 있다.
- `AC-1508`: 기존 Top-N 추천과 실제 데이터 통합 검증이 회귀 없이 통과한다.
- `AC-1509`: 장소명 검색으로 필수 장소를 선택하면 해당 ID가 `requiredPlaceIds`에 들어가고 일정 카드에 필수 장소로 표시된다.
- `AC-1510`: 선택된 필수 장소를 삭제하면 요청과 일정 결과에서도 제거된다.
- `AC-1511`: 일차 카드 hover/focus 중 지도 대상은 해당 일차 장소 ID와 일치하고, 종료 후 전체 일정 장소 ID로 복원된다.

## 테스트 계획

```powershell
node --check map-ui/ccu-mmr.js
node --check map-ui/app.js
node scripts/test_ccu_mmr.cjs
node scripts/validate_ccu_mmr_dashboard.cjs
```

브라우저에서 다음을 추가 확인한다.

- 자차 여부 변경 시 요청 JSON의 반경이 15km와 5km로 바뀐다.
- 장소명으로 필수 장소를 검색·선택하면 일자별 카드에 정확히 한 번 표시된다.
- 선택된 필수 장소를 삭제하면 요청의 `requiredPlaceIds`에서도 제거된다.
- 빈 일자에서는 추가 중심 후보 선택 버튼이 보이고 선택 후 일자 클러스터가 늘어난다.
- 일차 카드 hover/focus 중 해당 일차 마커만 남고 카드에서 벗어나면 전체 일정 마커가 복원된다.

## 구현 결과

- `map-ui/ccu-mmr.js`에 `ccu-mmr-request-v2`와 `ccu-mmr-result-v2`, 자차 15km·비자차 5km 정규화, Haversine 중심 반경 병합, 하루 6곳 분할, 추가 중심 후보, 일자별 MMR을 구현했다.
- `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`에 자차 여부, 장소명·주소·ID 기반 필수 장소 검색 선택기, 선택 장소 삭제, 일자별 카드, 지도 `D1` 마커, 추가 중심 선택·취소 흐름을 구현했다.
- 일차 카드 hover/focus 동안 지도 데이터 대상을 해당 일차 ID로 제한하고 카드와 마커를 강조하며, 종료 시 전체 일정 ID를 복원하도록 구현했다.
- `scripts/test_ccu_mmr.cjs`에 반경 정규화, capacity 분할, 자차/비자차 경계, 실행 불가, anchor 및 필수 장소 MMR 회귀를 추가했다.
- `scripts/validate_ccu_mmr_dashboard.cjs`에서 실제 2,153개 번들, 추천 가능 1,663개, 필수 장소 일정과 anchor 후보를 검증했다.
- 브라우저에서 장소명 검색 결과, 필수 장소 선택 후 ID 요청 변환·일정 반영, 삭제 후 요청·일정 제거, 비자차 5km, 추가 중심 선택 후 3일 일정 완성, 각 일차 6곳, hover 시 18곳 중 해당 일차 6곳만 표시·종료 후 18곳 복원, 콘솔 오류 0건을 확인했다.

검증 결과:

```text
node --check scripts/build_map_ui_data.mjs        PASS
node --check map-ui/ccu-mmr.js                    PASS
node --check map-ui/app.js                        PASS
node scripts/test_ccu_mmr.cjs                     PASS
node scripts/validate_ccu_mmr_dashboard.cjs       PASS
git diff --check                                  PASS
```

## 알려진 제한

- 직선거리이므로 해안·산악·섬·도로 단절과 대중교통 소요시간을 반영하지 못한다.
- 하루 6곳은 체류시간 데이터가 없는 현재 단계의 상한값일 뿐, 모든 날에 6곳 방문을 보장하거나 권장하지 않는다.
- 필수 장소 capacity 분할은 결정론적 휴리스틱이며 전역 최적해를 보장하지 않는다.
- 장소 영업·휴무·예약·안전 조건은 일정 배치에 아직 반영되지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-13 | 중심반경·capacity 설계 초안 작성 |
| 2026-08-13 | 자차 15km, 비자차 5km, 하루 4곳의 구현 범위 승인 및 In Progress 전환 |
| 2026-08-13 | 필수 장소 ID 직접 입력을 장소명·주소·ID 검색 선택기로 교체 |
| 2026-08-13 | 하루 capacity를 최대 6곳으로 확대하고 일차 hover/focus 지도 강조 추가 |
