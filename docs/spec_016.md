# SPEC-016: CCU-MMR 상위 3개 가중 랜덤 seed v3

- 상태: Implemented
- 작성일: 2026-08-16
- 최종 수정일: 2026-08-16
- 관련 요청: 같은 입력으로 다시 추천할 때 첫 장소와 후속 MMR 결과가 제한적으로 달라질 수 있게 한다.
- 관련 문서: [문서 색인](README.md), [CCU-MMR 알고리즘 초안](ccu_mmr_algorithm_draft.md), [데이터 계약](data_contracts.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md), [SPEC-014](spec_014.md), [SPEC-015](spec_015.md)
- 관련 코드: `map-ui/ccu-mmr.js`, `map-ui/app.js`, `map-ui/index.html`, `scripts/build_map_ui_data.mjs`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-014, SPEC-015

## 배경

현재 `balanced` 추천은 관련도 상위 후보를 첫 MMR 장소로 항상 선택한 뒤 나머지를 결정적으로 재정렬한다. 따라서 같은 입력을 다시 실행해도 첫 장소와 후속 추천 결과가 항상 같다. 사용자가 첫 추천 코스를 선호하지 않을 때 상위권 품질을 크게 낮추지 않으면서 다른 MMR 경로를 탐색할 수 있도록 첫 seed에만 제한된 랜덤성을 추가한다.

## 결정

- `balanced` 모드의 첫 MMR seed는 관련도 정렬 상위 최대 3개에서 선택한다.
- 후보가 3개 이상이면 관련도 1·2·3위의 선택 확률은 각각 `0.5`, `0.3`, `0.2`다.
- 후보가 2개 이하이면 존재하는 후보의 원래 가중치를 합이 1이 되도록 정규화한다. 후보가 1개면 확률 1이다.
- 첫 seed를 고른 뒤의 모든 MMR 선택은 기존 점수와 동점 규칙을 유지한다.
- `diversity=off`는 기존 관련도 순을 유지하며 랜덤 seed를 적용하지 않는다.
- 브라우저 실행은 런타임 난수를 사용하고, 테스트는 주입한 난수로 경계와 결과를 재현한다.

## 목표

- 같은 구조화 입력을 다시 실행했을 때 첫 seed가 상위 3개 안에서 지정 확률로 달라질 수 있게 한다.
- 선택된 seed를 기준으로 기존 MMR 다양성 재정렬을 계속 수행한다.
- 추첨 후보, 정규화 확률, 난수값과 선택 결과를 결과 trace와 UI에서 확인할 수 있게 한다.
- 기존 관련도 계산, 후보 필터, 필수 제약, 일정 군집과 웹 조사 표시를 유지한다.

## 비목표

- 모든 MMR 반복 단계에 랜덤성을 추가하는 것
- 관련도 상위 3개 밖의 장소를 첫 seed로 선택하는 것
- 확률을 사용자 입력으로 노출하거나 개인별로 학습하는 것
- 일정 군집, 일자별 MMR, 관련도 점수 또는 장소 라벨을 변경하는 것
- 난수 seed를 서버에 저장하거나 사용자별 추천 이력을 구현하는 것

## 요구사항

- `REQ-1601`: `balanced` 모드에서 관련도 상위 최대 3개를 첫 seed 후보로 사용한다.
- `REQ-1602`: 후보가 3개 이상이면 1위·2위·3위를 `0.5/0.3/0.2` 확률로 선택한다.
- `REQ-1603`: 후보가 2개이면 `0.5/0.3`을 정규화하고 후보가 1개이면 확률 1로 선택한다.
- `REQ-1604`: 첫 seed 이후의 MMR 점수, 유사도 패널티와 동점 규칙은 기존 구현을 유지한다.
- `REQ-1605`: `diversity=off`에서는 난수를 소비하지 않고 관련도 순을 유지한다.
- `REQ-1606`: 결과는 적용 여부, 후보별 관련도 순위와 확률, 난수값, 선택된 장소와 확률을 trace로 제공한다.
- `REQ-1607`: 난수는 `0 <= r < 1`이어야 하며 테스트에서 난수 함수를 주입할 수 있어야 한다.
- `REQ-1608`: UI는 첫 추천 카드와 결과 요약에서 가중 추첨 적용 사실과 선택 순위·확률을 표시한다.
- `REQ-1609`: 알고리즘 버전을 갱신하고 지도 metadata·문서를 같은 버전으로 동기화한다.

## 입력과 출력

구조화 요청 `ccu-mmr-request-v2`는 변경하지 않는다. `rank` 실행의 세 번째 런타임 인자로 테스트 가능한 난수 함수를 선택적으로 받는다.

```text
rank(places, request, runtime?)

runtime.random: () => number  # 선택, 기본 Math.random, 범위 [0,1)
```

결과에는 다음 additive trace를 포함한다.

```text
seedSelection: {
  strategy: "weighted-top-relevance-3"
  applied: boolean
  randomValue: number | null
  candidates: Array<{
    placeId: string
    relevanceRank: 1 | 2 | 3
    weight: number
    probability: number
  }>
  selectedPlaceId: string | null
  selectedRelevanceRank: number | null
  selectedProbability: number | null
}
```

## 설계

```text
관련도 정렬 후보
→ 상위 최대 3개와 0.5/0.3/0.2 가중치 구성
→ 존재 후보 기준 확률 정규화
→ 난수 1회로 첫 seed 선택
→ 선택 seed를 selected 집합에 추가
→ 기존 MMR 반복 선택
→ seedSelection trace + Top-N 출력
```

일정 군집은 기존 관련도 후보와 필수·anchor 장소를 사용하는 별도 단계이므로 이번 seed 추첨의 입력이나 결과로 바꾸지 않는다.

## 예외와 폴백

- 추천 후보가 없으면 seed 추첨을 적용하지 않고 기존 빈 결과를 반환한다.
- 후보가 1개면 난수를 사용하더라도 유일한 후보를 확률 1로 선택한다.
- 주입 난수가 숫자가 아니거나 `[0,1)` 밖이면 실행 오류로 처리한다.
- `diversity=off`에서는 seed trace에 미적용 상태를 기록하고 기존 관련도 순을 반환한다.

## 영향 범위

- 변경 예정 파일: `docs/spec_016.md`, `docs/README.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/ccu_mmr_algorithm_draft.md`, `docs/evaluation.md`, `map-ui/README.md`, `map-ui/index.html`, `map-ui/app.js`, `map-ui/ccu-mmr.js`, `scripts/build_map_ui_data.mjs`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`, 생성된 `map-ui/data/jeju-places.js`
- 데이터 마이그레이션: 없음. 생성 지도 bundle의 알고리즘 metadata만 갱신한다.
- 호환성 영향: 요청 스키마는 유지하고 결과에 seed trace를 추가한다. `balanced` 결과의 동일 입력 결정성은 의도적으로 제거한다.
- 보안·개인정보 영향: 없음. 난수와 선택 trace는 브라우저 메모리에만 남는다.

## 승인 기준

- `AC-1601`: 난수 `0.0`, `0.499999`, `0.5`, `0.799999`, `0.8`, `0.999999`에서 각각 정의된 상위 후보가 선택된다.
- `AC-1602`: 첫 seed가 2위 또는 3위로 선택되면 이후 결과가 그 seed를 선선택한 기존 MMR 순서와 일치한다.
- `AC-1603`: 후보 1개와 2개의 정규화 확률과 선택 경계가 정확하다.
- `AC-1604`: `diversity=off`는 주입 난수를 호출하지 않고 관련도 순을 반환한다.
- `AC-1605`: 실제 1,663개 추천 가능 번들에서 seed가 상위 3개 중 하나이고 trace와 첫 결과가 일치한다.
- `AC-1606`: 기존 점수·필터·일정·41축·웹 조사 통합 검증이 회귀 없이 통과한다.
- `AC-1607`: UI에서 알고리즘 버전, 가중 seed 적용 요약과 첫 장소의 관련도 순위·선택 확률을 확인할 수 있다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-1601~AC-1604 | 주입 난수 경계·후속 MMR·미적용 단위 테스트 | `node scripts/test_ccu_mmr.cjs` |
| AC-1605~AC-1606 | 실제 지도 bundle 통합 검증 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-1607 | 구문 검사와 브라우저 결과 카드·JSON 확인 | `node --check map-ui/ccu-mmr.js`, `node --check map-ui/app.js` |

## 구현 결과

- `map-ui/ccu-mmr.js`의 알고리즘을 `ccu-mmr-v3-weighted-seed-schedule`로 갱신하고 `balanced` 첫 seed를 관련도 상위 3개의 `0.5/0.3/0.2` 가중 추첨으로 선택했다.
- 후보가 2개면 `0.625/0.375`, 1개면 `1.0`으로 정규화하며 이후 선택은 기존 MMR 점수·유사도·동점 규칙을 그대로 사용한다.
- `rank`의 선택적 런타임 난수 함수와 `seedSelection` 결과 trace를 추가했다. 브라우저는 기본 난수를 사용하고 테스트는 경계값을 주입한다.
- 첫 추천 카드에 관련도 순위와 선택 확률을, 결과 요약에 실제 선택된 seed 순위·확률을 표시한다.
- 요청 계약은 `ccu-mmr-request-v2`를 유지하고 결과 계약을 additive trace가 포함된 `ccu-mmr-result-v3`로 갱신했다.
- 지도 bundle을 재생성해 metadata 알고리즘 버전을 동기화했다. 장소 2,153건, 추천 가능 1,663건, 41축과 웹 조사 1,663건 coverage는 유지됐다.
- 로컬 브라우저에서 동일 입력을 6회 재실행해 첫 seed가 관련도 1위와 2위로 바뀌고 카드·요약이 일치하는 것을 확인했다. 콘솔 오류는 0건이었다.

검증 결과:

```text
node --check scripts/build_map_ui_data.mjs        PASS
node --check map-ui/ccu-mmr.js                    PASS
node --check map-ui/app.js                        PASS
node scripts/test_ccu_mmr.cjs                     PASS
node scripts/validate_ccu_mmr_dashboard.cjs       PASS
git diff --check                                  PASS
로컬 HTTP 브라우저 재실행·표시·콘솔 검사         PASS
```

## 설계와 달라진 점

없음.

## 알려진 제한

- 확률은 장기 실행 빈도에서 수렴하며 소수의 재실행에서는 정확히 `5:3:2`로 나타나지 않는다.
- 브라우저 난수값을 기록하지만 사용자별 추천 이력이나 재실행 seed 저장은 제공하지 않는다.
- 추천 품질 변화에 대한 독립 사람 평가는 아직 없다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-16 | 사용자 요청을 승인 근거로 상위 3개 가중 랜덤 seed 구현 시작 |
| 2026-08-16 | 가중 경계·후속 MMR·실데이터·브라우저 검증과 문서 동기화를 완료하고 Implemented로 전환 |
