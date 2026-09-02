# 추천 평가 전략

- 문서 상태: 내부 데모 회귀 구현, 추천 품질 평가는 미구현
- 최종 수정일: 2026-08-13
- 활성 설계 초안: [SPEC-008](spec_008.md)

운영 품질을 판단하는 자동 추천 평가 파이프라인은 없다. SPEC-014~017은 수식·계약, 일정 회귀, 상위 3개 가중 seed 경계, 코스 variant·세션 순환·중복 trace와 자동 일정 중심을 확인하는 `scripts/test_ccu_mmr.cjs`와 실제 1,663곳 41축 번들을 검사하는 `scripts/validate_ccu_mmr_dashboard.cjs`만 구현했다. 이는 품질 평가나 출시 gate가 아니며 현행 AI 초안 라벨과 추천 결과를 정답으로 재사용하지 않는다.

## 현재 데이터 기준선

### 역사적 100건 파일럿

SPEC-003의 v1은 관광지·문화시설·축제·레포츠 100건의 companion·month 척도와 생성 파이프라인을 시험한 역사적 기준선이다.

- 유형 표본: 관광지 68, 문화시설 12, 축제 4, 레포츠 16
- 지역 표본: 제주시 53, 서귀포시 47
- 직접 상세·공식 출처가 연결된 장소: 10건
- 사람 검수 완료: 0건

이 수치는 전체 데이터 확장 전 당시의 기록이며 현재 품질 기준이나 사람 승인 결과가 아니다.

### 현재 1,434건 전체 AI 초안

SPEC-007은 비음식점 1,434건을 모두 조사·생성했다.

- 조사 상태 `matched`: 1,434건
- 경험 범위: 대표 방문 800, 쇼핑 방문 397, 숙박 209, 행사 참여 28
- 전체 축: 24,378
- 직접 근거 82, 조사 추론 6,755, archetype prior 501, 기후 휴리스틱 16,704, 축제 N/A 336
- hard constraint: 1,518건. 이 중 `verify` 1,515건
- 구조화된 사람 검수 완료: 0건

수치 축 24,042개 중 직접 근거는 약 0.34%다. 전체 확장은 coverage 구현 완료를 뜻하지만 품질 승격을 뜻하지 않는다. 공통 기본 상세 출처가 `reputable_secondary`이고 제약 대부분이 자유 텍스트인 한계도 평가 층에서 분리한다.

## 평가 계층

### 1. 데이터·계약 회귀

- ID, `source_order`, intent와 `experience_scope` coverage
- JSONL↔SQLite 전수 일치, integrity와 foreign key
- manifest 입력·출력 hash와 logical DB digest
- JSONL+원본 장소와 SQLite+manifest 경로의 `RecommendationFeatureSnapshot` canonical digest 일치
- 축별 값 범위, provenance, confidence와 evidence 연결
- `dataset_status=ai_draft` 실행 gate와 경고 누락률
- 관련도·각 seed variant·자동 일정은 같은 입력에서 결정적이어야 한다. 최초 브라우저 가중 seed는 상위 3개와 `0.5/0.3/0.2` 경계를 벗어나지 않고, 명시 variant 선택은 난수를 호출하지 않아야 한다.
- 여행 MBTI 질문·pair catalog ID와 mapping, 같은 답변의 profile JSON, A/B 대칭성, `both_like|both_dislike`의 축 중립·feature 부호 대칭·감쇠, 미노출 적응형 pair 선택, A/R·O/I·L/H 각 6문항과 선택지 방향 3:3 균형, 8개 유형과 최대 8개 active feature를 고정 fixture로 회귀한다. 기존 v2와 개인화 v4 요청을 분리해 v2 P/A/M/R/MMR·일정 결과가 유지되는지 확인한다.

### 2. 필수 제약 정확성

- 확정 필수 제약 위반률
- 제외 장소 재노출률
- `unknown`을 `pass`로 잘못 처리한 비율
- 자유 텍스트 `verify` 제약을 자동 predicate로 실행한 비율
- 축제 date gate 회귀
- 숙박·쇼핑·축제 scope 혼입률

필수 제약 위반, 제외 ID 재노출과 `unknown→pass` 오판 목표는 0건이다. 제약 자체를 확인할 데이터가 없는 경우에는 성공으로 계산하지 않고 `verification_required`로 집계한다.

### 3. 독립 사람 라벨 평가

현재 AI 라벨과 추천 결과를 정답으로 재사용하지 않는다.

- high 우선순위 40건 전수
- high 40건과 중복되지 않게 유형·scope·`place_kind`·지역·추론 수준을 층화한 160건
- 총 200건을 두 명 이상이 독립 검수
- 5단계 축의 가중 일치도와 한 단계 이내 일치율
- 유형·축·추론 수준별 오차
- 축 reliability calibration: 사람 기준과 한 단계 이내 일치를 성공 사건으로 두고 confidence 구간별 실제 비율 비교
- 불일치 조정 결과와 기준 예시집 version 관리

표본 선정과 검수자는 자동 생성 규칙을 그대로 따라 쓰지 않으며, 직접 출처·조사 추론·prior·기후 휴리스틱을 분리해 평가한다.

### 4. 랭킹 품질

최소 네 기준선을 같은 feature snapshot, intent lane, 제약, taxonomy와 environment 설정에서 동일한 독립 relevance 판단에 비교한다.

1. intent/scope와 구조화 taxonomy만 사용
2. 1과 같은 후보·필터·taxonomy/environment에 raw companion·month 추가
3. 2와 같은 특징에 reliability shrink 적용, 다양성 미적용
4. 3과 같은 점수에 결정적 다양성 재정렬 적용
5. 4의 첫 seed만 상위 3개 `0.5/0.3/0.2`로 추첨한 내부 실험
6. 5의 세 seed variant를 미리 계산하고 요청 선호 feature를 MMR 중복축에서 제외하며 선택 variant를 자동 일정에 연결한 내부 실험
7. 6과 같은 P/A/M·제약·MMR·일정에 질문·가상 pair로 추정한 연속 원자 feature weight만 적용한 개인화 내부 실험

권장 지표는 NDCG@10, Recall@20, pairwise preference accuracy다. `result_confidence`는 확률이 아닌 휴리스틱 근거 강도이므로 `request_coverage` 구간과 함께 품질 편차를 보고 calibration 전에는 성공 확률로 평가하지 않는다. 행동 로그가 생겨도 노출 편향을 포함하므로 단독 정답으로 사용하지 않는다.

### 5. 다양성과 노출

- category·`place_kind` coverage@K
- intra-list similarity와 동일 유형 반복률
- 지역·유형·사업자 노출 편차
- 다양성 적용 전후 적합도 손실
- 같은 제목·주소·좌표 후보의 표시 반복과 독립 `contentid` 보존

지리적 다양성과 일정 이동 편의는 장소 랭킹 품질과 별도 평가한다.

SPEC-016·017의 코스 variant는 후보별 실제 최초 선택 빈도, seed별 NDCG@10·intra-list similarity·적합도 손실, variant 간 Top-N 교집합·순위 변화와 재추천 만족도를 결정적 기준선과 별도로 비교한다. 세션 회귀는 미노출 variant 우선, 즉시 같은 variant 반복 없음과 교집합 trace 정확성을 검사한다. 단위 테스트는 경계·trace 재현만 보장하며 추천 품질 향상을 증명하지 않는다.

SPEC-019·065 개인화는 유형 분류 정확도를 추천 품질로 간주하지 않는다. 연속 profile에 대해 held-out 가상 pair 방향 일치, 반복 응답 안정성, active feature 수·confidence 분포, 중립 선택률별 profile 강도와 추천 Top-N 변화, 사용자 설명 납득도를 별도로 평가한다. 3글자 유형은 바이럴·설명 출력이므로 유형별 노출 편차와 공유 문구의 개인정보 최소화도 확인한다.

SPEC-015 근사 일정 군집은 다음 결정적 회귀 지표를 별도로 검사한다.

- 모든 필수 장소가 정확히 한 일자에 포함되는 비율
- 일자별 6곳 capacity 위반 수
- 중심-장소 반경 15km/5km 위반 수
- 필수 일자 군집 수가 여행일을 넘을 때 `infeasible` 반환율
- 추가 중심 후보가 기존 모든 중심 반경 밖에 있는 비율
- 같은 요청의 일정·anchor 후보 순서 결정성
- 선택 variant seed가 첫 자동 anchor가 되는 비율과 variant 변경 시 일정 장소·중심 변화율
- 자동 anchor의 출처 trace, 기존 중심 반경 밖 조건과 variant 우선 일자 채움 위반 수

이 지표는 실제 이동시간·방문 순서 품질을 뜻하지 않는다.

### 6. 설명 품질

- 설명 문장과 실제 score component·constraint trace 일치율
- evidence·rule·source reference 해소율
- 출처 없는 변동 정보 포함률
- `ai_draft`, 기후평년, 확인 필요 경고 누락률
- LLM이 허용된 fact 밖의 정보를 추가한 비율

### 7. 운영 품질

구현 후 별도 측정한다.

- 요청 지연시간과 오류율
- 빈 결과율과 조건별 폴백 비율
- 데이터·알고리즘·mapper 버전 기록 누락률
- 외부 제공자 실패와 stale snapshot 처리
- 개인정보 최소화·삭제 정책 회귀

완전한 일정 최적화의 시간 초과, 영업시간 충돌과 실제 이동 효율은 장소 랭커나 SPEC-015 근사 군집 gate에 섞지 않고 후속 일정 SPEC에서 평가한다.

## 골든 시나리오

첫 구현 SPEC은 최소한 다음 고정 시나리오를 포함한다.

- 취향 정보가 없는 첫 사용자
- 아이와 고령자가 함께 있는 다세대 동행
- 접근성 요구와 높은 companion 값이 충돌하는 경우
- 비 오는 시기 또는 실내 선호
- 서로 충돌하는 필수 조건
- 제약이 `unknown`, `stale` 또는 자유 텍스트 `verify`뿐인 경우
- 숙박·쇼핑·축제가 기본 `visit` lane에 섞일 수 있는 경우
- 축제 개최일을 확인할 수 없는 경우
- 직접 근거가 거의 없고 AI 초안 confidence가 낮은 경우
- 같은 category·`place_kind`만 높은 점수를 받는 경우
- 요청 신호가 없어 `ranking_mode=exploration`이 되는 경우
- active hard requirement가 unknown이라 확인 후보로 분리되는 경우
- mapper가 자연어를 통제 태그로 변환하지 못하는 경우
- 원본 좌표가 유효하지 않거나 제주 표시 범위를 벗어난 경우

각 시나리오는 입력 snapshot, 기대 불변조건, 허용 가능한 결과 범위와 trace 검사를 가진다. 특정 장소 순위가 본질이 아니면 순위를 고정하지 않고 제약·scope·결정성·설명 provenance를 검증한다.

## 단계적 출시와 gate

1. 로컬 CLI 또는 오프라인 평가기에서만 `ai_draft` 실행을 허용한다.
2. 200건 독립 검수와 기준선 비교로 가중치·reliability·MMR을 조정한다.
3. 내부 shadow에서 데이터 누락·조건부 후보·설명을 검토한다.
4. 사람 승인 범위와 출처·경고가 보이는 제한 베타는 별도 SPEC에서 결정한다.
5. 공식 운영·가격·날씨 데이터와 구조화 constraint가 생긴 뒤 동적 gate를 확장한다.
6. 충분한 독립 정답과 행동 데이터가 생긴 뒤에만 학습 랭커를 결정적 기준선과 shadow 비교한다.

최소 출시 gate는 다음과 같다.

- 필수 제약 위반, 제외 ID 재노출, `unknown→pass` 오판 0건
- 설명과 score/constraint trace 일치, 데이터·알고리즘 버전 기록 100%
- 핵심 랭킹 지표가 승인된 기준선보다 악화되지 않음
- 유형·scope·추론 수준별 심각한 회귀 없음
- 빈 결과, mapper 실패와 외부 데이터 실패 폴백 검증

정확한 품질 임계값과 운영 승격 조건은 구현 SPEC에서 독립 평가 결과와 함께 승인한다. 그 전까지 현재 데이터는 내부 실험용 `ai_draft`다.
