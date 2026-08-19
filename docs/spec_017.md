# SPEC-017: 세션 코스 3안·자동 일정 anchor v4

- 상태: Implemented
- 작성일: 2026-08-16
- 최종 수정일: 2026-08-16
- 관련 요청: 첫 추천 코스가 마음에 들지 않을 때 즉시 다른 코스를 보여주고 일자별 일정도 함께 달라지게 한다.
- 관련 문서: [문서 색인](README.md), [CCU-MMR 알고리즘 초안](ccu_mmr_algorithm_draft.md), [데이터 계약](data_contracts.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md), [SPEC-014](spec_014.md), [SPEC-015](spec_015.md), [SPEC-016](spec_016.md)
- 관련 코드: `map-ui/ccu-mmr.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css`, `scripts/build_map_ui_data.mjs`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-014, SPEC-015, SPEC-016

## 배경

SPEC-016은 관련도 상위 3개 중 첫 seed를 `0.5/0.3/0.2`로 추첨해 Top-N MMR 목록을 바꾼다. 그러나 매 실행이 독립 추첨이어서 사용자가 다른 코스를 원해도 직전 seed가 다시 나올 수 있고, 일정 군집은 선택된 Top-N이 아니라 전체 관련도 후보를 사용하므로 목록이 달라도 일자별 일정은 그대로일 수 있다. 또한 MMR 유사도는 사용자가 이미 선호로 지정한 축까지 중복 패널티에 넣어 원하는 공통 특성을 과도하게 다양화할 수 있다.

## 결정

- `balanced` 요청은 관련도 1·2·3위 각각을 첫 seed로 하는 코스 variant를 최대 3개 미리 계산한다.
- 최초 variant 노출만 `0.5/0.3/0.2`로 선택한다.
- UI의 `다른 코스 보기`는 현재 요청 세션에서 아직 보여주지 않은 variant 중 seed 순위가 높은 것을 먼저 보여준다.
- 세 variant를 모두 본 뒤에는 현재 variant를 제외하고 새 순환을 시작해 직전 코스가 즉시 반복되지 않게 한다.
- 일정은 필수 장소 군집과 사용자 anchor를 먼저 만들고, 남은 일자를 선택 variant의 Top-N 순서에서 중심 반경 밖 장소로 자동 채운다. 부족할 때만 전체 관련도 후보로 보완한다.
- 일자별 추가 장소는 반경 안의 선택 variant Top-N 후보를 우선해 MMR로 채우고, 더 없을 때 전체 후보를 사용한다.
- 사용자가 선호로 지정한 원자 feature는 MMR 중복 유사도 feature 집합에서 제외한다. 관련도에는 계속 사용한다.
- `diversity=off`는 단일 관련도 순 variant와 기존 결정적 일정 흐름을 유지한다.

## 목표

- 같은 요청에서 seed 1·2·3위 기반 코스 최대 3안을 한 번의 랭킹 실행 경계 안에서 생성한다.
- 다른 코스 보기에서 직전 variant가 반복되지 않고 세션 노출 이력을 관리한다.
- 코스 변경이 Top-N 목록뿐 아니라 자동 일정 중심과 일자별 장소에도 반영되게 한다.
- 이전 코스와 현재 코스의 Top-N 중복 장소 수·비율·변경 장소 수를 표시한다.
- 필수 장소·사용자 제외·반경·capacity와 확인 필요 조건을 기존처럼 우선한다.
- 추천 결과와 일정에 variant·세션·자동 anchor trace를 남긴다.

## 비목표

- 사용자 계정이나 서버에 재추천 이력을 저장하는 것
- 관련도 점수 차이에 따라 `0.5/0.3/0.2` 자체를 다시 보정하는 것
- MMR의 모든 반복 단계에 난수를 추가하는 것
- 실제 도로시간, 체류시간, 영업시간 또는 방문 순서 최적화
- AI 초안 라벨을 사람 승인 데이터로 승격하는 것

## 요구사항

- `REQ-1701`: `balanced` 후보가 3개 이상이면 관련도 1·2·3위 seed variant 세 개를 결정적으로 생성한다.
- `REQ-1702`: 각 variant는 지정 seed를 첫 선택으로 사용하고 이후 기존 MMR 점수·동점 규칙을 적용한다.
- `REQ-1703`: 최초 선택은 기존 `0.5/0.3/0.2` 경계를 유지하고 명시적 `variantId` 실행에서는 난수를 사용하지 않는다.
- `REQ-1704`: 결과는 각 variant의 ID, seed 장소·관련도 순위·기본 확률, Top-N 장소 ID와 평균 관련도를 제공한다.
- `REQ-1705`: UI는 요청 fingerprint별 메모리 세션에서 노출 variant를 기록하고 다른 코스 보기는 미노출 variant를 우선한다.
- `REQ-1706`: 모든 variant를 본 뒤에는 현재 variant를 제외한 새 순환을 시작해 즉시 같은 코스를 반환하지 않는다.
- `REQ-1707`: 코스 변경 결과는 이전 Top-N과의 교집합 수, 교집합 비율과 변경 장소 수를 기록·표시한다.
- `REQ-1708`: 일정은 필수 장소 군집, 사용자 anchor, 선택 variant 자동 anchor 순으로 중심을 만든다.
- `REQ-1709`: 자동 anchor는 기존 모든 중심에서 적용 반경 밖이고 현재 후보 자격·좌표·중복 조건을 만족해야 한다.
- `REQ-1710`: 선택 variant만으로 여행일을 채우지 못하면 전체 관련도 후보에서 같은 조건으로 자동 보완한다.
- `REQ-1711`: 일자별 추가 추천은 반경·capacity를 지키면서 선택 variant 장소를 먼저 MMR 평가하고 부족할 때 전체 후보를 평가한다.
- `REQ-1712`: 일정 결과는 variant ID, seed 장소 ID, 자동 anchor ID·출처와 개수를 제공한다.
- `REQ-1713`: 요청 선호 feature는 관련도 계산에 유지하되 MMR feature 유사도 집합에서는 제외한다.
- `REQ-1714`: 선호 feature를 모두 제외해 feature 집합이 비면 장소 유형·지역 유사도만 사용하고 오류 없이 동작한다.
- `REQ-1715`: `diversity=off`는 단일 variant를 반환하고 다른 코스 보기와 자동 variant anchor를 비활성화한다.
- `REQ-1716`: 기존 필수 장소 정확히 한 번, 하루 6곳, 자차 15km·비자차 5km와 실행 불가 정책을 유지한다.
- `REQ-1717`: 알고리즘·결과 schema·지도 metadata와 문서를 v4로 동기화한다.

## 입력과 출력

요청 `ccu-mmr-request-v2`에 파생 필드 `diversityFeatureKeys`를 기록한다. 이는 사용자가 선택하지 않은 원자 feature 목록이다.

`rank` 런타임은 최초 추첨 또는 명시적 variant 선택 중 하나를 지원한다.

```text
rank(places, request, {
  random?: () => number,
  variantId?: string
})
```

결과 `ccu-mmr-result-v4`에는 다음 계약을 추가한다.

```text
courseVariant: {
  variantId,
  seedPlaceId,
  seedRelevanceRank,
  baseProbability,
  placeIds[],
  averageRelevance
}

courseVariants[]: CourseVariantSummary

schedule: {
  ...existing,
  courseVariantId,
  variantSeedPlaceId,
  autoAnchorCount,
  autoAnchorIds[],
  autoAnchors[] { placeId, source: variant | relevance_fallback }
}
```

UI가 추가하는 세션 trace는 결과 JSON에도 포함한다.

```text
rerollSession: {
  rerollIndex,
  previousVariantId,
  shownVariantIds[],
  overlapCount,
  overlapRate,
  changedPlaceCount
}
```

## 설계

```text
관련도 정렬 Top-100
→ seed 1위 variant MMR
→ seed 2위 variant MMR
→ seed 3위 variant MMR
→ 최초 0.5/0.3/0.2 또는 명시 variant 선택
→ 필수 군집·사용자 anchor
→ 선택 variant 순서로 남은 일자 자동 anchor
→ 전체 관련도 후보로 부족한 anchor 보완
→ 각 일자에서 variant 후보 우선 MMR
→ Top-N·일정·variant·중복 trace 출력
```

다른 코스 보기는 새 장소 점수를 계산하는 방식이 아니라 같은 정규화 요청과 후보에서 미리 정의된 seed variant를 선택해 다시 `rank`한다. 필수 조건과 관련도는 variant 사이에서 바뀌지 않는다.

## 예외와 폴백

- 추천 가능 후보가 1·2개면 존재하는 수만큼 variant를 만든다.
- 명시한 `variantId`가 현재 후보에서 만들어지지 않으면 실행 오류다.
- 여행 기간이 없으면 일정은 기존 `not_requested`이며 variant Top-N만 반환한다.
- 필수 군집이 여행일을 초과하면 자동 anchor를 만들지 않고 `infeasible`을 유지한다.
- 반경 밖 자동 anchor가 부족하면 남은 일자를 비우고 기존 `needs_anchor_selection`과 후보를 제공한다.
- 후보가 하나뿐이면 다른 코스 보기 버튼을 숨긴다.

## 영향 범위

- 변경 예정 파일: `docs/spec_017.md`, `docs/README.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/ccu_mmr_algorithm_draft.md`, `docs/evaluation.md`, `map-ui/README.md`, `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`, `map-ui/ccu-mmr.js`, `scripts/build_map_ui_data.mjs`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`, 생성된 `map-ui/data/jeju-places.js`
- 데이터 마이그레이션: 없음. 지도 bundle metadata의 알고리즘 버전만 변경한다.
- 호환성 영향: 요청 schema version은 유지하되 파생 필드를 추가한다. 결과는 v4로 변경한다.
- 보안·개인정보 영향: 세션은 현재 브라우저 메모리에만 있고 계정·정확한 사용자 위치·외부 전송을 추가하지 않는다.

## 승인 기준

- `AC-1701`: seed 1·2·3위 variant가 각각 해당 장소로 시작하고 같은 입력에서는 각 variant Top-N이 재현된다.
- `AC-1702`: 최초 난수 경계 `0.5/0.8`과 명시 variant 선택이 정확하고 명시 선택은 난수를 호출하지 않는다.
- `AC-1703`: 다른 코스 보기를 세 번 누르는 동안 가능한 variant를 중복 없이 보고, 새 순환 첫 결과는 직전 variant와 다르다.
- `AC-1704`: 이전 코스와의 중복 수·비율·변경 수가 실제 place ID 교집합과 일치한다.
- `AC-1705`: 여행일이 있고 필수 장소가 없으면 선택 variant seed가 첫 자동 anchor가 되며 가능한 범위에서 모든 일자를 자동 채운다.
- `AC-1706`: 필수 장소가 있으면 필수 군집을 보존하고 남은 날짜만 자동 anchor로 채운다.
- `AC-1707`: 모든 자동 anchor가 기존 중심 반경 밖이고 일자별 capacity·반경을 만족한다.
- `AC-1708`: variant 변경 시 실제 일자별 anchor 또는 장소 집합이 달라진다.
- `AC-1709`: 요청 선호 feature가 `diversityFeatureKeys`에서 제외되고 관련도 값은 변하지 않는다.
- `AC-1710`: 실제 1,663개 추천 가능 bundle에서 세 variant·자동 일정·41축·웹 조사 통합 검증이 통과한다.
- `AC-1711`: 데스크톱·모바일 UI에서 다른 코스 보기, variant 진행 상태, 이전 코스 중복과 자동 중심을 확인할 수 있다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-1701~AC-1702, AC-1705~AC-1709 | variant·명시 선택·일정·MMR 단위 테스트 | `node scripts/test_ccu_mmr.cjs` |
| AC-1710 | 실제 지도 bundle 통합 검증 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-1703~AC-1704, AC-1711 | 로컬 HTTP 브라우저 재추천 세션 검사 | `map-ui/` |
| 전체 | 구문·생성 diff 검사 | `node --check ...`, `git diff --check` |

## 구현 결과

- `map-ui/ccu-mmr.js`를 `ccu-mmr-v4-session-variants-schedule` / `ccu-mmr-result-v4`로 갱신했다.
- `balanced` 요청마다 관련도 1·2·3위 seed variant를 최대 세 개 결정적으로 계산하고, 최초 표시만 `0.5/0.3/0.2`로 선택한다. 런타임 `variantId`로 명시 선택하면 난수를 호출하지 않는다.
- 요청 선호 feature를 `diversityFeatureKeys`에서 제외해 관련도와 MMR 중복 축의 역할을 분리했다.
- 필수 군집과 사용자 anchor 뒤 남은 일자는 선택 variant 순서로 자동 중심을 만들며, 부족할 때 관련도 후보로 보완한다. 일자별 장소도 선택 variant 후보를 먼저 평가한다.
- `courseVariant`, `courseVariants`, 일정의 variant·자동 anchor trace와 UI의 `rerollSession` 교집합 trace를 추가했다.
- 화면에 `다른 코스 보기`, 현재 코스안·기본 확률, 노출 진행 상태, 직전 코스와의 중복 장소 수·비율·변경 수, 자동 중심 출처를 표시한다.
- 브라우저 메모리의 요청 fingerprint와 노출 이력으로 미노출 variant를 우선하고, 새 순환에서는 직전 variant를 제외한다.
- 지도 bundle metadata와 기준 문서를 v4로 동기화했다.

검증 결과:

- `node --check map-ui/ccu-mmr.js` 통과
- `node --check map-ui/app.js` 통과
- `node --check scripts/build_map_ui_data.mjs` 통과
- `node scripts/test_ccu_mmr.cjs` 통과
- `node scripts/validate_ccu_mmr_dashboard.cjs` 통과: 2,153곳, 추천 가능 1,663곳, 41축, Top-10, 3일 자동 일정 `feasible`
- `node scripts/build_map_ui_data.mjs` 재생성 통과: 입력 2,154곳, 정상 좌표 2,153곳, 추천 가능 1,663곳
- 로컬 브라우저 데스크톱: 코스 1안에서 2안으로 전환, `8/10곳(80%) 겹침 · 2곳 변경`, 세 일차 `선택 코스 자동 중심`, 콘솔 오류 0건 확인
- 로컬 브라우저 모바일 `390×844`: 코스 변경 영역·버튼·결과 패널 표시 확인
- 세 variant 노출 뒤 새 순환의 첫 variant가 직전 variant와 다른 것을 확인

## 설계와 달라진 점

- 세션 순환과 교집합 계산을 UI 내부에만 두지 않고 `selectNextCourseVariant`, `courseOverlapTrace` 순수 함수로 랭커 모듈에서 제공해 단위 테스트가 가능하게 했다. 노출 이력과 `rerollSession` 부착은 계획대로 UI 메모리 경계에 남겼다.
- 자동 anchor가 같은 Top-N 집합에서도 seed 순서에 따라 일자 순서를 바꿀 수 있다. 따라서 코스 차이는 장소 교체뿐 아니라 일정 중심 순서 변화로도 나타나며, UI는 장소 집합 교집합을 별도로 표시한다.

## 알려진 제한

- variant는 첫 seed만 다르므로 Top-N의 일부가 서로 겹칠 수 있다.
- 실제 bundle에서 두 variant가 같은 Top-N 집합을 다른 순서로 반환하는 경우도 확인됐다. 이 경우 `0곳 변경`으로 표시되지만 자동 일정 중심 순서는 달라질 수 있다.
- 세션은 새로고침하면 초기화된다.
- 자동 anchor는 직선거리 중심이며 실제 이동시간과 방문 순서를 뜻하지 않는다.
- 점수 차이에 따른 seed 확률 보정과 사람 추천 품질 평가는 후속 범위다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-16 | 사용자 승인으로 세션 코스 3안·자동 일정 anchor v4 구현 시작 |
| 2026-08-16 | 코스 variant·세션 순환·요청 인지형 MMR·자동 일정·UI·회귀 검증을 완료하고 Implemented로 전환 |
