# SPEC-014: CCU-MMR 제주 추천 실험 대시보드 v1

- 상태: Implemented
- 작성일: 2026-08-13
- 최종 수정일: 2026-08-13
- 관련 요청: 구조화된 사용자 입력으로 CCU-MMR 추천을 실행하고 지도에서 입력·출력·전체 라벨을 함께 확인한다.
- 관련 문서: [문서 색인](README.md), [CCU-MMR 알고리즘 초안](ccu_mmr_algorithm_draft.md), [데이터 계약](data_contracts.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md), [안전 및 개인정보](safety_privacy.md), [SPEC-013](spec_013.md)
- 관련 코드: `scripts/build_map_ui_data.mjs`, `map-ui/`
- 선행 SPEC: SPEC-008, SPEC-009, SPEC-013

## 배경

현재 `map-ui`는 제주 장소를 탐색하고 장소별 Theme·Environment·Style 24축을 표시하지만 개인화 추천은 실행하지 않는다. Companion 5축과 Month 12축은 별도 `place-fit-relabel-v2` 파일에 있어 지도 상세에서 확인할 수 없다. CCU-MMR 초안은 구조화된 선호 입력과 이 41개 장소·상황 라벨을 이용하는 내부 실험용 추천 방식을 제안한다.

현재 라벨은 `ai_draft`이며 hard constraint 1,518건은 대부분 자유 텍스트이고 실행 가능한 predicate가 없다. 따라서 이번 구현은 품질이 보장된 운영 추천이나 일정 생성이 아니라 입력·점수·다양성 결과를 사람이 비교하는 정적 로컬 대시보드다.

## 목표

- 제주 지도 화면에서 CCU-MMR 구조화 입력을 편집하고 추천을 실행한다.
- 추천 요청, 활성 가중치, 후보 수와 알고리즘 버전을 화면에서 확인한다.
- 관련도 계산과 MMR 재정렬을 수행해 Top-N 추천 장소와 점수 trace를 표시한다.
- 장소 상세에서 기존 24축에 Companion 5축과 Month 12축을 추가해 총 41축을 확인한다.
- 추천 장소를 지도 마커·목록에서 식별하고 선택해 전체 라벨을 비교한다.

## 비목표

- 사용자 계정·프로필 저장, 자연어 mapper, HTTP 추천 API
- 일정 생성, 이동시간·경로·가격 최적화
- 실시간 날씨·영업·예약·접근성 자동 판정
- AI 초안 라벨의 운영 승인 또는 추천 품질 보장

## 요구사항

- `REQ-1401`: 지도 데이터 생성기는 24축 선호 라벨과 17축 Companion·Month 라벨을 `contentid`로만 조인하고 데이터 버전·coverage를 metadata에 기록한다.
- `REQ-1402`: 요청 UI는 지역, intent, 여행 기간, 대표 동행 유형, 원자 선호 feature별 `benefit|avoid|target`과 중요도 `1|2|4`, 결과 수, 다양성 사용 여부를 제공한다.
- `REQ-1403`: 파생 Style 6축은 장소 상세에 표시하되 CCU 개인 취향 점수와 feature 유사도에는 중복 투입하지 않는다.
- `REQ-1404`: 개인 취향·동행·월 블록 중 사용 가능한 블록만 정규화해 관련도 `R_i`를 계산한다. 실시간 날씨가 없으므로 날씨 블록은 비활성이다.
- `REQ-1405`: 기본 block weight는 개인 취향/동행/월 `0.70/0.15/0.10`, MMR 관련도 비중은 `0.75`, pool은 관련도 상위 최대 100개, 결과 수 기본값은 10개다.
- `REQ-1406`: MMR 유사도는 18개 원자 feature Manhattan 유사도 0.70, 같은 TourAPI 유형 0.20, 같은 시·군 코드 0.10으로 계산한다.
- `REQ-1407`: 사용자에게 노출된 결과는 rank, 관련도, MMR 선택 점수, 개인 취향·동행·월 component와 실제 양의 기여 원자 라벨을 표시한다.
- `REQ-1408`: 추천 목록·지도 마커와 장소 상세가 연결되고, 장소 상세는 24축과 Companion 5축·Month 12축을 모두 표시한다.
- `REQ-1409`: 입력이 없는 블록은 0점이 아니라 비활성화한다. 개인 취향·동행·월이 모두 비활성이면 결정적인 탐색 결과와 경고를 반환한다.
- `REQ-1410`: 자유 텍스트 hard constraint는 자동 `pass/fail`로 실행하지 않으며, 접근성 등 구조화되지 않은 조건은 확인 필요 경고로만 표시한다.
- `REQ-1411`: 동일 입력과 데이터에서는 `source_order`, `contentid` 동점 규칙으로 같은 결과를 반환한다.

## 입력과 출력

사용자 입력은 브라우저 내 일회성 상태이며 서버나 외부 서비스로 전송·저장하지 않는다.

```text
CCUMMRRequestV1 {
  destination_region: jeju_all | jeju_city | seogwipo_city
  intent: visit | shopping | stay | event
  travel_window: { start_date, end_date, timezone=Asia/Seoul }?
  companion_type: solo | couple | friends | kids | parents | none
  preferences: Array<{
    feature: AtomicFeatureKey
    mode: benefit | avoid | target
    weight: 1 | 2 | 4
    target?: number[0,1]
    tolerance?: number>0
  }>
  result_count: integer[1,20]
  diversity: off | balanced
}
```

장소별 입력은 정적 지도 번들에서 읽는다.

```text
atomic labels: Theme 8 + Environment 2 + Atomic Style 8
display-only labels: Derived Style 6
context labels: Companion 5 + Month 12
catalog fields: contentid, contenttypeid, sigungucode, coordinate, source_order
```

출력은 추천 항목, 입력 snapshot, 활성 block weight, 후보·coverage 집계와 경고를 포함한다. 점수는 내부 계산 후 화면에서 소수 셋째 자리까지 표시한다.

## 설계

```text
정적 TourAPI 장소 + 24축 + 17축
→ intent·지역·기존 탐색 필터 후보 생성
→ 개인 취향 P, 동행 A, 월 M 계산
→ 활성 블록 가중 평균 R
→ Top 100 후보
→ MMR Top-N
→ 추천 패널·지도 마커·41축 상세
```

- `target` 효용은 `exp(-(x-target)^2/(2*tolerance^2))`를 사용한다.
- 월 적합도는 시작일과 종료일을 포함한 현지 날짜별 월 점수 평균이다.
- `event`의 month N/A는 낮은 점수가 아니므로 월 블록을 비활성화한다. 구조화 개최일이 없어 운영 가능성을 보장하지 않는다는 경고를 표시한다.
- intent lane은 TourAPI 유형을 사용해 `visit=12|14|25|28`, `shopping=38`, `stay=32`, `event=15`로 제한한다. 서로 다른 경험 scope를 한 순위에 섞는 `all` lane은 제공하지 않는다.
- 날씨, 이동시간, 가격, 정규화 hard constraint는 입력 데이터가 없어 점수화하지 않는다.

## 예외와 폴백

- 시작일이 종료일보다 늦거나 target/tolerance가 유효하지 않으면 실행하지 않고 입력 오류를 표시한다.
- 선택 intent·지역·탐색 필터에 후보가 없으면 필터를 자동 완화하지 않는다.
- 이번 고정 snapshot에서 18개 원자 라벨 또는 Companion 5축이 불완전한 장소는 추천 후보에서 제외한다. Month의 명시적 `not_applicable`은 해당 장소의 월 component만 비활성화한다.
- eligible 후보가 결과 수보다 적으면 가능한 후보만 반환한다.
- 실시간 운영·예약·행사·접근성 정보는 추천 점수와 별도 확인 사항으로 표시한다.

## 영향 범위

- 변경 예정 파일: `docs/spec_014.md`, `docs/README.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/evaluation.md`, `scripts/build_map_ui_data.mjs`, `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`, `map-ui/README.md`, 생성된 `map-ui/data/jeju-places.js`
- 데이터 마이그레이션: 없음. 기존 원본·라벨 JSONL은 읽기 전용이다.
- 호환성 영향: 기존 지도 검색·카테고리 필터·24축 상세를 유지하면서 추천 실험 패널과 17축을 추가한다.
- 보안·개인정보 영향: 정확한 사용자 위치·자연어·계정 정보를 받지 않고 입력은 브라우저 메모리에만 둔다.

## 승인 기준

- `AC-1401`: 원본 라벨 대상 1,664개 중 지도 좌표가 정상인 1,663개가 생성 번들에서 24축과 17축을 가지며, 좌표 이상 1개는 metadata에 명시된다.
- `AC-1402`: 바다 benefit, 활동 avoid, 부모님 동행, 8월 기간 입력을 실행하면 Top-N과 P/A/M/R/MMR trace가 표시된다.
- `AC-1403`: 다양성을 끄면 관련도 순, 켜면 결정적 MMR 순으로 표시되고 동일 입력 재실행 결과가 같다.
- `AC-1404`: 추천 장소 상세에서 Theme 8, Environment 2, Style 8, Derived 6, Companion 5, Month 12가 표시된다.
- `AC-1405`: 잘못된 기간, 빈 후보, event N/A와 결측 라벨 폴백이 오류 없이 표시된다.
- `AC-1406`: 기존 검색·카테고리 필터·마커·상세 기능이 유지되고 정적 로컬 HTTP에서 동작한다.

## 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| AC-1401 | 지도 데이터 재생성 후 metadata·표본 장소 41축 검사 |
| AC-1402~AC-1405 | CCU-MMR 단위 테스트와 브라우저 DOM 시나리오 검사 |
| AC-1406 | 생성기·앱 구문 검사, 로컬 HTTP, 지도 화면 상호작용 확인 |

## 구현 결과

- `map-ui/ccu-mmr.js`에 `ccu-mmr-v0-demo` 순수 랭커와 요청 정규화, P/A/M, Top-100, 결정적 MMR trace를 구현했다.
- 지도 번들에 1,663곳의 41축 라벨, 권역, source order, 자유 텍스트 제약과 데이터 버전을 결합했다. 지도 탐색 전용 490곳은 추천에서 제외한다.
- 입력·설정 JSON, 후보 집계, Top-N 카드, 확인 필요 후보, 전체 결과 JSON과 추천 마커를 3열 대시보드에 구현했다.
- 장소 상세에 41축과 사용 라벨 강조, P/A/M/R/MMR trace를 추가했다.
- `scripts/test_ccu_mmr.cjs`와 `scripts/validate_ccu_mmr_dashboard.cjs`로 수식·결정성·실제 번들 41축을 검증했다.
- 로컬 HTTP 브라우저에서 데스크톱 3열, 모바일 입력·결과 드로어, 입력 재실행, 41축 클릭 상세를 확인했다.

## 설계와 달라진 점

- 초안의 날씨 블록은 실시간 공급자가 없어 `weatherEnabled=false`로 명시하고 활성 블록 합만 재정규화한다.
- 자유 텍스트 hard constraint를 선택하면 자동 통과시키지 않고 해당 후보를 모두 별도 확인 목록으로 보낸다.
- 이 구현은 SPEC-008 `baseline-v0`가 아니라 별도 `ccu-mmr-v0-demo` 내부 실험이다.

## 알려진 제한

- 현재 데이터는 `ai_draft`이며 독립 사람 평가 전 내부 비교용이다.
- hard constraint와 실시간 날씨·운영·가격 데이터가 없어 추천 결과가 실제 방문 가능성을 보장하지 않는다.
- `same_region`은 현재 TourAPI `sigungucode` 동일 여부를 사용하며 일정 동선 효율을 뜻하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-13 | 사용자 요청을 승인 근거로 CCU-MMR 정적 실험 대시보드 구현 시작 |
| 2026-08-13 | 알고리즘·41축 번들·입출력 대시보드·회귀 및 브라우저 검증 완료 |
