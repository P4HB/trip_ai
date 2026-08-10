# SPEC-008: AI 초안 인지형 개인화 장소 추천 엔진 상세 설계

- 상태: Draft
- 작성일: 2026-08-10
- 최종 수정일: 2026-08-10
- 관련 이슈: 전체 비음식점 `ai_draft` 프로필을 과신하지 않는 장소 추천 엔진을 구체화하고 GitHub에 설계 기록을 남김
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [데이터 계약](data_contracts.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md), [안전 및 개인정보](safety_privacy.md), [SPEC-007](spec_007.md)
- 관련 코드: 계획 — `recommendation/`, `scripts/evaluate_place_ranker.py`; 현재 구현 없음
- 선행 SPEC: [SPEC-007](spec_007.md)

## 배경

SPEC-007은 제주 비음식점 1,434건을 웹 조사하고 companion 7,170축, 비축제 month 16,872축과 축제 N/A 336축을 생성했다. 그러나 결과는 사람 검수 전 `ai_draft`다. 전체 24,378축 중 직접 웹 근거는 82축뿐이고 나머지는 조사 사실 추론 6,755축, 장소 유형 prior 501축, 기후 휴리스틱 16,704축과 축제 N/A 336축이다. 수치 축 24,042개에서 직접 근거 비율은 약 0.34%다.

웹 조사 상태는 1,434건 모두 `matched`지만 공통 기본 출처는 K-TRIP TIPS라는 `reputable_secondary` 2차 상세 자료다. hard constraint 1,518건도 1,515건이 `verify`이며 조건과 적용 범위가 자유 텍스트라 현재 상태 그대로 자동 필터로 실행할 수 없다. 장소 절대 품질, 인기도, 체류시간, 정규화 가격, 실시간 운영 여부와 이동시간 데이터도 없다.

기존 추천 알고리즘 초안은 거리·이동시간을 장소 기본 랭킹 특징으로 예시했지만 이후 합의는 장소 적합도와 일정 편의성을 분리했다. 이번 SPEC은 후자의 결정을 기준으로 삼아 장소 추천 점수에는 이동거리·이동시간·경로 효율을 넣지 않는다.

이번 변경은 추천 코드를 구현하지 않는다. 저장소의 모든 현존 Markdown 문서와 실제 manifest·JSONL·SQLite 계약을 검토해 후속 구현이 따라야 할 요청·후보·제약·점수·불확실성·설명·평가 경계를 상세히 제안한다.

## 사실, 결정, 가정, 미결정 사항

### 사실

- 현재 추천·랭킹·추천 API·일정 최적화 코드는 없다.
- 경험 범위는 `representative_visit` 800건, `shopping_visit` 397건, `stay` 209건, `event_participation` 28건이다.
- companion·month 수치 대부분의 confidence는 `0.5`이며 구조화된 사람 검수 완료 데이터는 0건이다.
- `review_priority`는 검수 작업 순서이며 장소 품질이나 추천 confidence가 아니다.
- hard constraint 원천 상태는 `confirmed=1,489`, `stale=23`, `unknown=6`이고 원천 action은 `verify=1,515`, `exclude=3`이다.
- 현재 SQLite는 LCLS, `place_kind`, `experience_scope`, `environment`, 축과 constraint를 포함하지만 JSONL proposal의 archetype·flags 일부는 포함하지 않는다.

### Draft 결정 제안

- 첫 구현은 `ai_draft`를 명시적으로 허용한 내부 오프라인 장소 랭커다. 사용자 공개 운영, HTTP API와 일정 생성은 후속 SPEC 범위다.
- raw JSONL이나 SQLite를 랭커가 직접 읽지 않고 두 경로를 공통 `RecommendationFeatureSnapshot`으로 투영한다.
- 장소 적합도와 일정 최적화를 분리한다. 지역은 후보 필터로 쓸 수 있지만 거리·이동시간·권역·경로 비용은 장소 적합도 점수에 넣지 않는다.
- 대표 방문, 쇼핑, 숙박, 축제는 요청 intent별 lane으로 분리한다.
- 후보 자격, 필수 제약 판정, 선호 점수와 결과 다양성을 서로 다른 단계로 유지한다.
- 기존 `ai_draft` 축은 confidence와 provenance에 따라 중립 `0.5` 쪽으로 축소한다.
- active hard requirement가 `unknown`인 후보는 일반 결과와 섞지 않고 별도 확인 후보로 보낸다.
- `baseline-v0` 설명은 결정적 reason code와 템플릿으로 만들고 LLM 자유문장을 사용하지 않는다.

### 가정

- 1,434건은 해당 intent lane 전건을 구조화 필터와 점수 계산에 통과시키기에 충분히 작다.
- 후속 구현은 canonical JSONL set+원본 장소와 읽기 전용 SQLite 중 어느 경로에서도 같은 feature snapshot을 만들 수 있다.
- [추천 알고리즘](recommendation_algorithm.md)의 계수·가중치·유사도는 오프라인 비교를 위한 시작 설정이며 운영 품질이 입증된 값이 아니다.

### 미결정 사항

- 내부 알파 이후 경고가 있는 제한 베타까지 `ai_draft` 결과를 노출할지 여부
- 통제 취향 태그 사전의 실제 항목과 자연어 mapper 모델·수락 임계값
- `baseline-v0` 계수·가중치·다양성 설정의 최종 승인값
- 제약 종류별 predicate, freshness 기간과 `unknown` 정책
- 사람 검수 override ingest와 데이터셋 승격·철회 절차
- 장소 절대 품질·인기도를 정의할 별도 데이터와 편집 정책
- 공식 운영·가격·날씨·이동시간 제공자
- 백엔드 언어·HTTP 프레임워크·배포·관측 방식
- 행동 로그의 동의, 보관 기간과 삭제 정책

## 목표

- 현재 `ai_draft` 데이터의 한계를 시스템 동작으로 강제한다.
- JSONL과 SQLite 차이를 숨기는 versioned 추천 feature snapshot 계약을 정의한다.
- intent와 `experience_scope`가 맞는 후보 lane을 정의한다.
- 기계 실행 가능한 필수 제약과 확인이 필요한 자유 텍스트 사실을 구분한다.
- 동행·월·taxonomy·environment를 재현 가능하게 보정·합성하는 시작 규칙을 정의한다.
- 점수 기여·coverage·근거 강도·제약·evidence를 모두 추적하는 결과 계약을 정의한다.
- 장소 적합도와 일정 가능성을 분리해 각각 독립 평가할 수 있게 한다.
- 사람 검수·오프라인 기준선·회귀·단계적 출시 gate를 정의한다.

## 비목표

- 추천 엔진·CLI·API·UI 코드 구현
- 일정 생성, 권역 배정, 체류시간 또는 경로 최적화
- 음식점 720건 추천
- style·theme·recommendable·인기도·절대 품질 라벨 생성
- 실시간 영업·가격·날씨·예약·재고 보장
- 학습 랭커, 온라인 개인화 또는 행동 로그 수집
- 현재 `ai_draft`를 사람 승인 라벨이나 운영 골드 데이터로 승격
- 자연어 모델이 임의의 장소 사실·점수·추천 이유를 생성하도록 허용

## 요구사항

- `REQ-001`: 데이터셋 상태가 `ai_draft`이면 신뢰된 런타임의 `execution_mode=internal_experiment`에서만 실행한다. 클라이언트 요청이 gate나 경고를 해제할 수 없어야 한다.
- `REQ-002`: 랭커 입력은 versioned `RecommendationFeatureSnapshot`이다. JSONL+원본 장소와 SQLite+manifest materializer는 같은 canonical digest를 만들어야 하며 한 경로에만 있는 archetype·flags를 baseline 특징으로 사용하지 않는다. digest는 digest 필드 자신을 제외한 payload에서 계산한다.
- `REQ-003`: 정규화된 요청은 `visit`, `shopping`, `stay`, `event` intent를 반드시 가진다. 입력 adapter가 값을 받지 않았다면 직렬화 전에 `visit`을 넣고 서로 다른 scope를 전역 순위에 묵시적으로 섞지 않는다.
- `REQ-004`: 일반 탐색의 travel window는 선택이지만 `event`에는 필수다. 축제는 여행 기간과 비교 가능한 구조화 개최일이 있을 때만 eligible이다.
- `REQ-005`: 후보 자격은 식별·research status·scope·요청 지역·사용자 제외로 판단하며 선호 점수와 분리한다. 절대 품질 근거가 없으므로 “제주 최고 장소”로 표현하지 않는다.
- `REQ-006`: 필수 제약 판정은 `pass`, `fail`, `unknown`, `not_applicable`을 사용한다. 원천 `confirmed`나 `exclude` 자체를 판정으로 복사하지 않는다.
- `REQ-007`: 자유 텍스트·stale·원천 unknown·대응 사실 없음은 `unknown+verification_required`다. 현재 자유 텍스트 `exclude` 3건도 predicate 구조화·검수 전 자동 `fail`로 변환하지 않는다.
- `REQ-008`: active hard requirement가 `unknown`인 후보는 일반 `items`가 아닌 `verification_candidates`로 반환한다. 사용자 요구와 무관한 source fact는 item 경고로 남길 수 있다. 확인 후보는 점수 순위가 아니며 `source_order`, `contentid` 오름차순으로 정렬한다.
- `REQ-009`: 자연어 mapper는 LCLS·`place_kind`·environment 기반 통제 태그를 제안한다. accepted 양수 weight 태그만 점수에 들어가며 hard constraint는 반드시 사용자 확인을 요구한다.
- `REQ-010`: 동행 축은 `solo→solo`, `couple→couple`, `friends→friends`, 만 4~12세 아이→`kids`, 고령자→`parents`로 만든다. `family/custom` 관계를 추측하지 않고 여러 활성 축은 같은 시작 가중치를 쓴다.
- `REQ-011`: companion·month 축은 `adjusted=0.5+reliability×(raw-0.5)`로 축소한다. `reliability=axis_confidence×provenance_factor×0.80`이며 v0에서는 모든 축이 `ai_draft`다.
- `REQ-012`: companion은 adjusted 축의 `0.7×mean+0.3×min`, month는 여행 기간의 월별 일수 가중 평균을 사용한다. 축제에는 month를 적용하지 않는다.
- `REQ-013`: taxonomy와 environment의 유사도·reliability를 포함한 정확한 `baseline-v0` feature 정의는 [추천 알고리즘](recommendation_algorithm.md)의 versioned 시작 규칙을 따른다.
- `REQ-014`: 기본 가중치는 taxonomy/companion/month/environment `0.40/0.35/0.15/0.10`이다. 없는 특징은 0점 처리하지 않고 비활성화한다.
- `REQ-015`: `effective_weight`, `contribution`, `place_fit`, 휴리스틱 `result_confidence`와 별도 `request_coverage`를 trace 가능한 식으로 계산한다. active 특징이 없으면 `ranking_mode=exploration`, fit `0.5`, confidence·coverage `0`이다.
- `REQ-016`: 기본 후보 정렬, MMR pool·유사도·동점 규칙은 [추천 알고리즘](recommendation_algorithm.md)의 `diversity-v0`를 따른다. 최종 MMR 순서와 `place_fit` 내림차순이 다를 수 있음을 계약에 표시한다.
- `REQ-017`: 각 결과는 후보 lane, 자격·제약 판정, 특징군과 하위 축 raw·adjusted·reliability·effective weight·contribution, evidence·rule ID, coverage, MMR trace와 모든 버전을 가진다.
- `REQ-018`: 설명은 실제 양의 기여와 통과한 구조화 조건에서 결정적 템플릿으로 만든다. 변동 정보와 자유 텍스트 제약은 추천 장점이 아니라 확인 항목이다.
- `REQ-019`: 장소 적합도에는 거리·이동시간·권역·경로 비용을 넣지 않는다. 후속 일정 엔진은 `place_fit`을 보존하고 별도 schedule 지표를 사용한다.
- `REQ-020`: 구현 SPEC은 taxonomy-only, raw axis, uncertainty-adjusted, uncertainty+diversity 네 통제 기준선과 독립 사람 평가를 포함해야 한다.
- `REQ-021`: 정확한 사용자 위치가 필요하지 않으면 행정구역·격자·place ID를 사용하고 자연어·접근성 정보의 외부 전송과 행동 로그 저장은 별도 승인 없이는 금지한다.
- `REQ-022`: 이 SPEC은 설계 문서만 변경한다. 추천 실행 코드를 추가하거나 현재 제품에서 추천이 동작한다고 표시하지 않는다.

## 입력과 출력

정본 의미 계약은 [데이터 계약](data_contracts.md)의 다음 타입을 따른다.

```text
RecommendationExecutionContext
RecommendationFeatureSnapshot
PlaceRecommendationRequest
RecommendationCandidateTrace
PlaceRecommendationResult
```

핵심 입력:

```text
trusted execution_mode
trusted evaluation_as_of
feature snapshot + digest
request
  destination_region, travel_window?
  intent, party, hard_constraints
  accepted preference_tags, environment_preferences
  excluded_place_ids, result_count, diversity
```

핵심 출력:

```text
data snapshot + ai_draft + manifest/logical/feature digests
algorithm versions
items[]
  place_id, location, experience_scope, rank
  place_fit, request_coverage, result_confidence, ranking_mode
  constraint decisions, score/axis trace, reasons, warnings, sources
verification_candidates[]
filtered_summary, relaxation_options, warnings
```

## 상세 설계

### 1. Feature snapshot

materializer는 공통 계약에 필요한 필드만 투영한다.

- ID·순서·유형·LCLS·제목·주소·경도·위도·원본 지역 코드
- `place_kind`, `experience_scope`, `environment`, research status
- companion/month 축 value·confidence·inference·evidence·rule
- 원천 constraint의 condition text·status·action·freshness·predicate review 상태·source
- source metadata와 모든 input digest

SQLite에 없는 proposal archetype·flags는 요구하지 않는다. 정확한 canonical serialization과 digest 알고리즘은 구현 SPEC에서 고정한다.

### 2. 요청과 동행 정규화

- 정규화된 intent는 필수고 UI·CLI 기본 선택만 `visit`이다.
- `event` 요청은 travel window가 없으면 검증 오류다.
- `family/custom`은 관계 축을 추측하지 않는다. 아이·고령자 신호가 없으면 companion 특징이 비활성일 수 있다.
- 만 4세 미만·13세 이상 아이만 있으면 현 `kids` 축 coverage 밖임을 표시한다.
- 접근성은 `parents`·`kids`가 아닌 별도 hard constraint다.
- mapper는 proposed와 accepted를 분리하고 원문 span·버전·confidence·수락 근거를 남긴다.

### 3. 후보·제약·축제

| intent | scope | 건수 |
|---|---|---:|
| `visit` | `representative_visit` | 800 |
| `shopping` | `shopping_visit` | 397 |
| `stay` | `stay` | 209 |
| `event` | `event_participation` | 28 |

fresh·confirmed이고 검수된 predicate만 사용자 requirement와 비교해 `pass/fail`을 만들 수 있다. freshness는 snapshot에 저장하지 않고 신뢰된 `evaluation_as_of`, 원천 checked_at과 versioned policy에서 계산한다. 요구사항 scope가 적용되지 않을 때만 `not_applicable`이며, 적용되지만 사실이 없으면 `unknown`이다.

현재 축제 날짜는 기계 predicate가 아니므로 `baseline-v0`의 event 후보는 구조화 날짜가 생기기 전 `verification_candidates`에만 들어간다. 일반 `items`와 MMR에는 참여하지 않는다.

### 4. 점수와 confidence

[추천 알고리즘](recommendation_algorithm.md)이 다음을 정본으로 정의한다.

- `taxonomy-similarity-v0`과 place tag source factor
- companion·month 하위 축 reliability와 그룹 합성
- environment 일치 행렬과 현재 고정 reliability
- effective weight·contribution·fit·confidence·coverage 식
- active 특징 0개인 exploration 폴백

`result_confidence`는 성공 확률이 아니라 근거 강도다. requested 특징이 빠졌을 때 이를 숨기지 않도록 `request_coverage`를 별도 반환한다.

### 5. 다양성과 순위

`diversity-v0`는 eligible 기본 정렬의 `min(N,max(5K,50))` pool에서 `lambda=0.8` MMR을 수행한다. LCLS category, `place_kind`, 공통 통제 태그만 사용하며 지리 거리는 쓰지 않는다.

최종 rank는 MMR 선택 순서다. 각 반복의 동점은 MMR, fit, coverage, confidence, `source_order`, `contentid` 순으로 결정한다. diversity가 꺼지면 기본 후보 정렬을 쓴다.

### 6. 설명과 LLM

`baseline-v0`는 reason code와 검증된 slot을 쓰는 결정적 템플릿만 허용한다. LLM이 장소 사실·점수·필터를 직접 만들지 않는다. 후속 LLM 실험도 proposed 태그나 구조화 reason 선택으로 제한하며 accepted 요청과 score trace가 authoritative하다.

### 7. 장소 추천과 일정 최적화

장소 추천기는 적합도·coverage·confidence·후보 자격·확인 항목·catalog 위치와 버전을 반환한다. 일정 최적화기는 별도 체류시간, 실제 이동시간 행렬, 운영·예약 time window, 일별 시작·종료 위치와 휴식 규칙을 받는다.

일정기가 동선 때문에 장소를 제외하거나 다른 날로 옮겨도 원래 `place_fit`을 변경하지 않는다. 일정 결과에는 별도 `schedule_feasibility`와 `schedule_utility`를 사용한다.

## 예외와 폴백

- `ai_draft`인데 내부 실험 모드가 아니면 결과를 만들지 않는다.
- intent scope 후보가 없으면 다른 scope를 자동 혼합하지 않는다.
- active hard requirement가 `unknown`이면 일반 결과로 표현하지 않는다.
- 특정 feature가 없으면 0점 처리하지 않고 coverage에 반영한다.
- active feature가 없으면 개인화가 아닌 `exploration`으로 표시한다.
- event travel window가 없으면 요청 오류, 구조화 개최일이 없으면 확인 후보로 반환한다.
- 좌표가 비정상이면 catalog에 상태를 남기고 지도·일정 입력으로 사용하지 않는다.
- 결과가 비면 조건별 복구 건수를 보여주되 자동 완화하지 않는다.
- mapper 실패 시 구조화 입력만 사용하고 매핑되지 않은 원문을 경고한다.

## 평가와 단계적 출시

### 데이터·계약 회귀

- JSONL 경로와 SQLite 경로 feature snapshot digest 일치
- 같은 입력·버전 결과와 trace 결정성 100%
- 제외 ID·구조화 fail 재노출 0건
- `unknown→pass`, scope 혼입, 축제 date gate 회귀 0건
- component 합계·reason·evidence·version 기록 일치 100%

### 사람 라벨 평가

- high 40건 전수와 high를 제외해 scope·유형·지역·추론 수준을 층화한 160건, 총 200건을 두 명 이상 독립 검수한다.
- 5단계 축의 가중 일치도, 한 단계 이내 일치율과 추론 수준별 오차를 측정한다.
- reliability calibration은 “사람 기준과 한 단계 이내 일치”를 우선 사건으로 정의하고 confidence 구간별 실제 비율을 본다.
- 현재 AI 라벨을 정답으로 사용하지 않는다.

### 랭킹 평가

네 기준선은 같은 feature snapshot, intent lane, 제약, taxonomy·environment를 유지하고 다음 요소만 바꾼다.

1. taxonomy-only
2. taxonomy + raw companion/month
3. 2와 같은 특징 + reliability shrink
4. 3 + MMR

독립 relevance 판단으로 NDCG@10, Recall@20, pairwise accuracy를 측정하고 request coverage·scope·유형·지역별 편차, coverage@K, intra-list similarity와 경고 누락률을 함께 본다.

### 출시 단계

1. Draft 결정·ontology·golden fixture 승인
2. feature snapshot builder와 로컬 CLI·오프라인 평가기 구현
3. 200건 독립 검수와 baseline 계수 조정
4. 내부 shadow와 실패·설명 검토
5. 제한 베타 여부 별도 승인
6. 공식 변동 정보와 구조화 constraint 확대
7. 충분한 독립 정답·행동 데이터 뒤 학습 랭커 shadow 비교
8. 일정 최적화는 별도 SPEC으로 구현

## 영향 범위

- 변경 파일: `README.md`, `docs/spec_008.md`, `docs/README.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/recommendation_algorithm.md`, `docs/evaluation.md`, `docs/safety_privacy.md`, `docs/spec_003.md`, `docs/spec_007.md`, `handoff.md`, `data/labeling/jeju/README.md`
- 데이터 마이그레이션: 없음
- 호환성 영향: 추천 코드가 없으므로 런타임 영향 없음. 후속 구현은 새 versioned 계약을 사용한다.
- 보안·개인정보 영향: 사용자 프로필·위치·접근성·자연어 입력의 최소화 원칙과 외부 모델 전송 제한을 설계에 추가한다.

## 승인 기준

- `AC-001`: 현행 구현·통계·`ai_draft` 한계가 manifest·SQLite와 일치한다.
- `AC-002`: JSONL과 SQLite가 공통 feature snapshot으로 수렴하고 한 경로에만 있는 필드를 baseline이 요구하지 않는다.
- `AC-003`: normalized intent, party 축 매핑, scope lane, event와 active hard requirement의 확인 후보 정책이 모순 없이 정의된다.
- `AC-004`: 원천 constraint와 4상태 추천 판정의 mapping이 정의되고 자유 텍스트를 자동 pass/fail로 사용하지 않는다.
- `AC-005`: baseline-v0 특징·reliability·그룹 합성·기여·fit·coverage·confidence·MMR·동점 규칙이 구현 가능한 수준으로 정의된다.
- `AC-006`: 요청·snapshot·중간 trace·결과 계약이 기준 문서에 있고 모든 설명이 계산 근거에 연결된다.
- `AC-007`: mapper·LLM 역할이 authoritative 구조화 요청과 결정적 랭커를 침해하지 않는다.
- `AC-008`: 현재 AI 라벨을 정답으로 쓰지 않는 오프라인 평가, 독립 사람 검수와 단계적 출시 계획이 정의된다.
- `AC-009`: 모든 문서가 추천을 `미구현` 또는 `Draft`로 표시하고 SPEC-007 구현 사실과 충돌하지 않는다.
- `AC-010`: 문서 상대 링크, code fence, Markdown 형식과 Git diff 검사가 통과하며 추천 코드·생성 데이터는 변경되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001 | manifest·SQLite 통계와 문서 수치 대조 | `python scripts/validate_all_place_profiles.py`, 읽기 전용 SQLite 집계 |
| AC-002~AC-008 | SPEC과 기준 문서의 용어·수식·계약 교차 검토 | `docs/spec_008.md`, `docs/architecture.md`, `docs/data_contracts.md`, `docs/recommendation_algorithm.md`, `docs/evaluation.md`, `docs/safety_privacy.md` |
| AC-009 | 구현 상태·과거 충돌 표현 검색 | `rg` 기반 상태·용어 검사 |
| AC-010 | 상대 링크·fence·형식·변경 범위 검사 | Markdown 검사, `git diff --check`, `git status --short` |

## 구현 결과

- 상세 설계와 기준 문서 동기화만 수행했다.
- 추천 엔진, feature snapshot builder, API, UI, 사용자 프로필과 일정 최적화는 계속 미구현이다.
- 후속 구현은 이 Draft의 미결정 사항을 승인하고 상태를 `Approved`로 바꾼 뒤 시작해야 한다.

### 문서·데이터 검증 결과

| 검증 | 결과 |
|---|---|
| 전체 프로필 validator | `valid=true`, 장소 1,434건, 축 24,378건, hard constraint 1,518건 |
| 실제 SQLite 집계 | scope·원천 constraint status/action·review priority가 문서와 일치 |
| 상대 Markdown 링크 | 누락 0건 |
| Markdown code fence·공백 | 균형·trailing whitespace 검사 통과 |
| `git diff --check` | 오류 0건. 로컬 `core.autocrlf`에 따른 LF→CRLF 경고만 존재 |
| 코드·생성 데이터 | 추천 코드 추가 0건, SPEC-007 full 산출물 변경 0건 |

## 설계와 달라진 점

- 오래된 초안의 거리·이동시간 기본 랭킹 특징을 제거하고 지역 필터와 후속 일정 입력으로만 사용하도록 경계를 정정했다.
- style·theme는 현재 데이터에 없으므로 첫 baseline은 LCLS·`place_kind`·environment를 사용한다.
- JSONL과 SQLite가 같은 필드를 가진다는 가정을 버리고 공통 feature snapshot·digest 단계를 추가했다.
- LLM 설명 대신 검증 가능한 결정적 reason template을 첫 baseline으로 정했다.

## 알려진 제한

- 수식의 계수·ontology 유사도는 평가 전 시작값이며 품질이 입증되지 않았다.
- 현재 hard constraint 대부분은 자동 실행할 수 없는 자유 텍스트다.
- 사람 검수 완료 라벨과 독립 relevance 판단이 없어 운영 출시 임계값을 계산할 수 없다.
- feature snapshot schema·builder·digest는 아직 구현되지 않았다.
- 데이터·원문 재배포 조건, 루트 프로젝트 라이선스와 외부 제공자 약관은 별도 확인이 필요하다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-10 | 전체 문서·데이터 계약 감사 후 AI 초안 인지형 장소 추천 엔진 상세 설계 Draft 작성 |
| 2026-08-10 | JSONL/SQLite 공통 snapshot, party·constraint mapping, score coverage, MMR·event·LLM 경계를 구현 가능 수준으로 보완 |
