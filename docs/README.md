# Trip AI 문서 색인

이 파일은 에이전트와 개발자가 작업 시작 시 읽는 문서 진입점이다. 현재 작업과 관련된 문서만 선택해 읽고, 새 구현은 반드시 활성 SPEC을 기준으로 진행한다.

## 문서 우선순위

1. 승인되었거나 구현 중인 활성 SPEC이 해당 변경의 목표 동작을 정의한다.
2. 활성 SPEC이 없는 현재 시스템 동작은 기준 설계 문서와 코드가 함께 정의한다.
3. 구현 완료 시 SPEC과 기준 설계 문서를 실제 코드에 맞춰 동기화한다.
4. 충돌이나 불명확성이 있으면 추측하지 말고 SPEC에 결정 또는 미결정 사항으로 기록한다.

## 현재 제품 상태

- 구현됨: 제주 TourAPI 기본 장소 수집 및 검증
- 구현됨: 최신 스냅샷을 지도용 JavaScript 데이터로 변환
- 구현됨: TourAPI 장소를 라벨링용 음식점·비음식점 데이터로 분리
- 구현됨: 관광지·문화시설·축제·레포츠 100건의 companion·월별 적합도 AI 초안 sidecar
- 구현됨: 같은 100건의 웹 상세 페이지를 열어 장소 사실·미확인 사항·출처별 주장을 연결한 v2 AI 초안 sidecar
- 구현됨: 웹 조사 사실을 먼저 읽고 100건 AI 초안을 한 건씩 검수해 JSON으로 내보낼 수 있는 단일 HTML. 구조화된 사람 검수 완료는 0건
- 구현됨: 비음식점 1,434건 전체 웹 조사·companion·월별 자동 라벨·canonical JSONL·SQLite (`ai_draft`)
- 구현됨: 비음식점과 FD05 카페·찻집 1,664건의 Theme·Environment·Style 24축 완전 숫자 라벨
- 구현됨: 장소 검색, 카테고리 필터, 지도 마커·클러스터, 장소 상세 UI
- 구현됨: 구조화된 입력으로 1,663개 41축 장소의 CCU-MMR 결과를 비교하는 정적 내부 실험 대시보드
- 구현됨: 관련도 상위 1·2·3위 seed 코스 3안, 최초 `0.5/0.3/0.2` 선택과 세션 미노출 코스 재추천
- 구현됨: 요청 선호 feature를 중복축에서 제외한 MMR과 선택 코스 기반 자동 일정 중심·일차별 지도 강조
- 구현됨: 동행자부터 조건 확인까지 5단계로 진행하는 베타 사용자용 추천 입력 UI
- 구현됨: A/R·O/I·L/H 축마다 6개씩 총 18개 상황 질문·최대 3개 적응형 가상 장소 A/B·연속 라벨 가중치
- 구현됨: 3축 8개 여행 MBTI를 내장한 지도 추천 UI
- 구현됨: 베타 추천 카드의 내부 trace 상세 분리와 추천 목록·일자별 일정 장소의 1~5·최대 300자 동기화 세션 피드백 UI
- 구현됨: 모든 고유 추천 장소의 만족도 입력 완료 후 명시적 저장 버튼으로 선택·추천 결과·피드백을 서버의 분리된 SQLite에 90일 적재
- 구현됨: 장소 만족도 선택 즉시 세션 최신 스냅샷을 서버에 자동 저장하고 의견 입력은 짧게 디바운스해 갱신
- 미구현: 운영 사용자 프로필, 실제 이동시간·방문 순서 기반 일정 최적화, 추천 API, 추천 품질 평가 파이프라인

## SPEC 색인

| SPEC | 제목 | 상태 | 관련 영역 |
|---|---|---|---|
| [SPEC-001](spec_001.md) | SDD 및 여행 추천 AI 문서 체계 도입 | Implemented | repository, docs |
| [SPEC-002](spec_002.md) | 제주 장소 음식점·비음식점 라벨링 데이터 분리 | Implemented | data, labeling |
| [SPEC-003](spec_003.md) | Companion·월별 적합도 100건 파일럿 라벨링 | Implemented | data, labeling, evaluation |
| [SPEC-004](spec_004.md) | 장소 프로필 100건 사람 검수 HTML | Implemented | labeling, UI |
| [SPEC-005](spec_005.md) | 100건 장소별 웹 조사와 근거 강화 검수 화면 | Implemented | research, labeling, UI |
| [SPEC-006](spec_006.md) | 웹 조사 기반 AI 자동 가중치 완성과 저노력 검수 | Implemented | scoring, labeling, UI |
| [SPEC-007](spec_007.md) | 제주 비음식점 전체 웹 조사·DB 저장·자동 라벨 확장 | Implemented | research, scoring, database, labeling |
| [SPEC-008](spec_008.md) | AI 초안 인지형 개인화 장소 추천 엔진 상세 설계 | Draft | recommendation, ranking, evaluation, safety |
| [SPEC-009](spec_009.md) | 제주 장소 24축 완전 숫자 라벨 데이터 | Implemented | data, labeling |
| [SPEC-012](spec_012.md) | v5 전수 근거 라벨 뷰어 v1 | Implemented | labeling, UI |
| [SPEC-013](spec_013.md) | 지도 UI v5 전수 근거 라벨 표시 v1 | Implemented | map, labeling, UI |
| [SPEC-014](spec_014.md) | CCU-MMR 제주 추천 실험 대시보드 v1 | Implemented | recommendation, map, UI |
| [SPEC-015](spec_015.md) | 중심 반경·일일 수용량 기반 근사 일정 군집 v2 | Implemented | itinerary, clustering, UI |
| [SPEC-016](spec_016.md) | CCU-MMR 상위 3개 가중 랜덤 seed v3 | Implemented | recommendation, ranking, UI, evaluation |
| [SPEC-017](spec_017.md) | 세션 코스 3안·자동 일정 anchor v4 | Implemented | recommendation, reroll, itinerary, UI, evaluation |
| [SPEC-018](spec_018.md) | 클러스터 재사용·일자 한계효용 기반 일정 배분 v5 | Draft | itinerary, clustering, distance, evaluation |
| [SPEC-019](spec_019.md) | 여행 MBTI·적응형 가상 장소 선택 기반 개인 선호 v2 | Implemented | personalization, preference elicitation, ranking, UI, viral |
| [SPEC-020](spec_020.md) | 베타 사용자용 단계형 여행 조건 입력 UI v1 | Implemented | recommendation, onboarding, map, UI |
| [SPEC-022](spec_022.md) | Kakao 신규 후보 2,374건 41축 에이전트 라벨링 v1 | In Progress | research, labeling, data |
| [SPEC-056](spec_056.md) | 베타 추천 카드 단순화와 장소별 만족도 UI | Implemented | recommendation, feedback, map, UI |
| [SPEC-057](spec_057.md) | Map UI `/travel/` 정적 호스팅 배포 | Implemented | deployment, hosting, map, UI |
| [SPEC-058](spec_058.md) | 추천 만족도 완료형 JSON 로그 저장 | Superseded | recommendation, feedback, privacy, UI |
| [SPEC-059](spec_059.md) | 추천 만족도 서버 적재 API | Superseded | recommendation, feedback, API, privacy, deployment |
| [SPEC-060](spec_060.md) | 추천 만족도 실시간 자동 저장 | Implemented | recommendation, feedback, autosave, API, privacy, deployment |
| [SPEC-061](spec_061.md) | Graphify 프로젝트 전용 코드 지식 그래프 설정 | Implemented | repository, agent, tooling |
| [SPEC-062](spec_062.md) | 모바일 단일 스크롤 추천 입력·결과 UI | In Progress | recommendation, onboarding, mobile, map, UI |
| [SPEC-063](spec_063.md) | 지도 UI 웹 조사 장소 설명 한국어화 | In Progress | research, labeling, map, UI, deployment |

- 다음 예약 번호: `SPEC-064`
- 새 번호를 사용할 때 이 표와 다음 예약 번호를 먼저 갱신한다.
- 하나의 기능을 여러 SPEC으로 나눌 때 선행 SPEC과 의존 관계를 각 문서에 기록한다.

## 사업 문서

| 문서 | 내용 | 상태 |
|---|---|---|
| [수익모델 및 사회적 기여 성과](business_model_and_social_impact.md) | B2B·B2G 대상, 과금 구조, 사회적 성과와 측정 지표 | 사업 제안 초안 |

## 기준 문서

| 문서 | 언제 읽는가 | 상태 |
|---|---|---|
| [시스템 아키텍처](architecture.md) | 컴포넌트 경계, 데이터 흐름, 배포 구조 변경 | 현재 구현 + 목표 구조 |
| [데이터 계약](data_contracts.md) | 장소, 사용자 조건, 추천 결과 스키마 변경 | 현재 구현 + 초안 |
| [추천 알고리즘](recommendation_algorithm.md) | 후보 생성, 필터, 랭킹, 다양성, 일정 생성 변경 | 목표 설계, 미구현 |
| [CCU-MMR 알고리즘 초안](ccu_mmr_algorithm_draft.md) | 41개 라벨 장소 추천과 중심 반경·capacity 근사 일정 | 코스 variant·자동 일정 v4 구현 |
| [평가 전략](evaluation.md) | 추천 품질, 회귀 테스트, 출시 기준 변경 | 목표 설계, 미구현 |
| [안전 및 개인정보](safety_privacy.md) | 위치정보, 외부 데이터, 설명 안전성 변경 | 적용 원칙 |
| [SPEC 템플릿](spec_template.md) | 새 구현 SPEC 생성 | 템플릿 |

## 빠른 문서 선택

- TourAPI 수집기: 활성 SPEC + `data_contracts.md`
- 지도 데이터 생성: 활성 SPEC + `architecture.md` + `data_contracts.md`
- 지도 UI: 활성 SPEC + `architecture.md`
- 개인화 추천과 랭킹: 활성 SPEC + `recommendation_algorithm.md` + `data_contracts.md` + `evaluation.md`
- 일정 최적화: 활성 SPEC + `recommendation_algorithm.md` + `evaluation.md`
- 위치정보 또는 사용자 프로필: 위 문서에 더해 `safety_privacy.md`

## 상태 정의

- `Draft`: 요구사항이나 결정이 확정되지 않았다.
- `Approved`: 구현할 범위와 승인 기준이 정해졌다.
- `In Progress`: SPEC에 따른 구현이 진행 중이다.
- `Implemented`: 구현, 검증, 문서 동기화가 끝났다.
- `Superseded`: 더 새로운 SPEC으로 대체되었으며 대체 문서를 링크해야 한다.
