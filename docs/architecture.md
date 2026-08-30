# 시스템 아키텍처

- 문서 상태: 현재 구현 + 목표 구조
- 최종 수정일: 2026-08-28

## 현재 구현

현재 제품은 제주 장소 데이터를 수집하고 브라우저 지도에서 탐색하며, 구조화된 입력으로 CCU-MMR 내부 실험을 실행하는 정적 MVP다. 서버 추천 API와 운영 추천 엔진은 없다.

```text
한국관광공사 TourAPI
        |
        v
scripts/collect_tourapi_jeju.py
        |
        v
data/tourapi/jeju/YYYY-MM-DD/
  - 원본 응답
  - JSON/JSONL/CSV
  - 품질 리포트와 manifest
        |
        +-------------------------------+
        |                               |
        v                               v
scripts/build_map_ui_data.mjs   scripts/split_tourapi_jeju_places.mjs
        |                               |
        v                               v
map-ui/data/jeju-places.js      data/labeling/jeju/YYYY-MM-DD/
        |                         - restaurants.json
        v                         - non_restaurants.json
map-ui/index.html + app.js        - manifest.json
        |                               |
        v                               v
Leaflet 지도 탐색 UI            고정 100건 v1 AI 초안
                                        |
                          +-------------+----------------+
                          |                              |
                          v                              v
              상세 페이지 100건 열기         장소별 사실·출처·라벨 재작성
                          |                              |
                          +--------------+---------------+
                                         v
                         scripts/build_place_profile_research_v2.mjs
                                         |
                                         v
                          웹 조사 v2 sidecar + provenance
                                         |
                                         v
                  scripts/build_place_profile_autolabel_v3.mjs
                    - v2 직접 근거 재검증
                    - 장소 경험 archetype 보완
                    - 고정 KMA fixture에서 1991~2020 제주 기후평년 파생
                    - hard constraint·검수 우선순위 분리
                                         |
                                         v
                       자동 가중치 v3 + 축별 provenance
                                         |
                                         v
                           scripts/build_labeling_review_ui.mjs
                                         |
                                         v
                            labeling-review/index.html
                              - 조사 사실·미확인·출처 우선 표시
                              - 전 축 AI 제안·근거 수준 표시
                              - 낮음·중간 우선순위별 명시적 일괄 승인
                              - 축제 월 N/A를 작업량에서 제외
                              - 브라우저 자동 저장
                              - 사람 검수 JSON 내보내기
```

고정 100건 검수 파이프라인과 별도로, 같은 비음식점 분할의 1,434건 전체에는 다음 파생 파이프라인이 구현되어 있다. 기존 100건은 회귀 앵커로 재사용하며 원본·파일럿·지도·검수 UI를 수정하지 않는다.

```text
data/labeling/jeju/YYYY-MM-DD/non_restaurants.json (1,434건)
        |
        v
scripts/fetch_all_place_web_pages.mjs
  - contentid 상세 페이지 조회
  - 성공 cache skip·원자적 checkpoint
        |
        v
research/web_pages.jsonl
        |
        v
scripts/build_all_place_profiles.py
  - 파일럿 100건 회귀 앵커 연결
  - 조사 사실·동행 5축·월 12축·hard constraint 생성
  - canonical JSONL + 단일 writer SQLite 생성
        |
        v
scripts/validate_all_place_profiles.py
  - coverage·provenance·파일럿 회귀
  - JSONL↔SQLite·integrity·FK·manifest 전수 검증
```

### 컴포넌트 책임

- `scripts/collect_tourapi_jeju.py`: API 키 로드, 전체 페이지 수집, ID 무결성 및 좌표 품질 검사, 날짜별 스냅샷과 해시 생성
- `data/tourapi/jeju/`: 재현 가능한 원본·정제 데이터와 수집 메타데이터 보관
- `scripts/build_map_ui_data.mjs`: 2026-08-09 TourAPI·24축·Companion/Month 17축 snapshot 일치를 검증하고 지도용 필드·제약·v5 웹 조사 claim·버전 metadata를 결합하며 제주 표시 범위를 벗어난 좌표를 제외
- `scripts/split_tourapi_jeju_places.mjs`: 가장 최근 원본 스냅샷을 음식점과 비음식점으로 완전 분할하고 출처·건수·해시 기록
- `data/labeling/jeju/`: 원본 필드와 순서를 보존한 날짜별 라벨링 입력 파생물 보관
- `scripts/fetch_place_profile_web_pages.mjs`: 고정 100건의 공개 상세 페이지를 열어 HTTP 상태, 본문·안내 항목과 페이지 해시를 조사 캐시에 기록
- `scripts/build_place_profile_research_v2.mjs`: 세 조사 배치를 ID 순서대로 병합하고 웹 조사 레코드·v2 프로필·검토 보고서·provenance manifest 생성
- `scripts/validate_place_profile_research_v2.mjs`: 원문 연결, 조사 스키마, 출처별 주장, unknown 정책, companion·month 근거와 출력 해시 검증
- `data/climate/kma/1991-2020/jeju_four_station_monthly_normals.json`: 기상청 4지점 월평년 원표 추출값·태풍 통계·제품용 월 벡터·원문 PDF 및 canonical SHA-256을 고정한 재현 입력
- `scripts/build_place_profile_autolabel_v3.mjs`: v2 facts를 유지하고 실제 직접 근거를 재검증한 뒤 장소 경험 프로필과 고정 기후 fixture로 전 축을 완성하며 적용 범위가 있는 hard constraint와 검수 우선순위를 별도 생성
- `scripts/validate_place_profile_autolabel_v3.mjs`: 500 companion·1,152 비축제 month·48 축제 N/A, 직접 근거 매핑, 추론 provenance·극단값 정책, 기후 fixture의 전 월·파생 벡터, TourAPI 원본과 출력 해시 검증
- `scripts/build_labeling_review_ui.mjs`: v3 100건, v2 웹 조사, 자동 라벨 provenance와 표시용 원본 필드를 검증해 외부 코드 의존성이 없는 단일 검수 HTML 생성
- `labeling-review/`: 조사 사실과 전 축 AI 제안을 함께 보여주고, 낮음·중간 우선순위별 명시적 일괄 승인 및 장소별 override·상태·코멘트를 JSON sidecar로 내보내는 정적 UI
- `scripts/fetch_all_place_web_pages.mjs`: 비음식점 1,434건의 공개 상세 페이지를 최대 동시성 5로 조회하고 성공 레코드를 건너뛰는 원자적 JSONL checkpoint를 만든다.
- `scripts/build_all_place_profiles.py`: 웹 조사 cache와 파일럿·기후 fixture를 고정 입력으로 사용해 전체 조사·자동 라벨·검수 큐·hard constraint를 canonical JSONL과 파생 SQLite로 결정적으로 생성한다.
- `scripts/validate_all_place_profiles.py`: 전체 ID·순서·축·근거·제약·파일럿 회귀, JSONL↔SQLite 일치, SQLite integrity/FK, manifest와 보호 입력 해시를 독립 검증한다.
- `data/labeling/jeju/2026-08-09/full/place-profile-v1-all-1434/`: 전체 비음식점 AI 초안의 재개 가능 웹 cache, canonical JSONL, 질의용 SQLite, manifest와 검수 보고서를 보관한다.
- `map-ui/`: 동행자·날짜·여행 방식·취향·확인을 한 단계씩 진행하는 베타 입력 흐름과 검색·지도 탐색을 제공한다. 취향 단계에서는 프리셋·세부 조정과 함께 여행 MBTI를 시작하고 결과 가중치를 적용할 수 있다. 최종 확인 뒤 `ccu-mmr-v6-travel-mbti-three-axis` 구조화 입력, P/A/M 관련도, 관련도 상위 3개를 각각 seed로 한 코스 3안, 최초 `0.5/0.3/0.2` 선택, 세션 재추천, 요청 인지형 MMR, 선택 코스 자동 일정 중심과 일차 hover/focus 지도 강조를 계산한다. 베타 추천 카드는 장소 요약·수치 없는 추천 이유·상세보기·1~5 만족도만 먼저 표시하고, ID·출처·점수 trace·41축은 장소 상세 패널에서 확인한다. 시작일·종료일로 만든 일자별 일정의 각 장소에도 같은 1~5 만족도와 최대 300자 의견을 표시하며, 추천 목록과 일정의 같은 장소는 ID 기준으로 입력 상태를 즉시 동기화한다. `preference-elicitation.js`는 A/R·O/I·L/H 축마다 6개씩 총 18개 질문과 최대 3개 적응형 가상 pair에서 연속 원자 라벨 가중치와 3축 8개 여행 MBTI를 결정적으로 만들며 DOM과 분리된다.

- 760px 이하 `map-ui`는 다섯 입력 section을 모두 펼친 단일 문서 흐름으로 표시하고, 명시적 실행 뒤 결과·일정을 입력 아래, 지도를 그 아래에 배치한다. 761px 이상은 기존 단계형 wizard와 태블릿 drawer 경계를 유지한다.

### 현재 런타임 경계

- 공개 베타 배포는 `https://168-107-40-231.sslip.io/travel/`에서 제공한다. 같은 Caddy edge의 기존 Rail Desk `/`와 `/healthz`를 유지하고, 버전된 Docker 릴리스가 Map UI 정적 파일을 `/srv/travel/`에 포함해 `/travel/` 경로로만 노출한다. `/travel`은 `/travel/`로 영구 리다이렉트한다.
- 브라우저에 API 키를 전달하지 않는다.
- 지도 라이브러리는 `map-ui/vendor/`의 로컬 파일을 사용한다.
- 지도 타일과 장소 이미지는 외부 네트워크에 의존한다.
- 지도 UI는 생성된 `window.JEJU_PLACES`와 `window.JEJU_DATA_META`를 읽는다.
- 추천 입력·결과, 여행 MBTI 질문·pair 응답·프로필과 장소별 만족도·의견은 평가 전까지 브라우저 메모리에 있다. 만족도 선택은 즉시, 의견은 800ms debounce 뒤 Map UI가 전체 최신 `travel-recommendation-feedback-log-v3` 스냅샷을 동일 출처 `POST /travel/api/feedback`으로 전송한다. Caddy는 이 경로만 전용 `travel-feedback` 서비스로 프록시하며 서비스는 입력을 검증해 Rail Desk와 분리된 SQLite 볼륨의 `feedback_sessions`에 추천 세션별 한 행으로 UPSERT하고 90일 보관한다. 단조 증가 revision으로 지연 요청의 역덮어쓰기를 막고 실패한 동일 payload를 자동 재시도한다. IP·User-Agent·쿠키·Rail Desk 계정 정보는 DB에 저장하지 않으며 공개 조회 API와 Web Storage는 없다. 기존 v2 수동 제출 계약은 열린 이전 탭 호환성을 위해 유지한다. 공유 문구는 유형 코드·이름·공개 설명만 포함한다. 날씨·실제 이동시간·가격은 현재 계산에 없다.
- 단계형 입력 상태도 브라우저 메모리에만 있고 초기 화면에서는 예시 추천을 자동 실행하지 않는다. 여행 MBTI를 적용해도 취향 단계에 머무르며, 사용자가 5단계 확인 화면에서 명시적으로 실행한 뒤에만 추천 결과를 계산한다.
- `ccu-mmr-v6-travel-mbti-three-axis`는 SPEC-008의 목표 `baseline-v0`와 별도인 `internal_experiment`다. `balanced` 모드는 상위 3개 seed variant를 결정적으로 미리 계산하고 최초 표시만 가중 선택하며, 브라우저 세션에서 미노출 variant를 우선한다. 개인화는 P 블록 안의 원자 feature weight만 바꾸고 P/A/M 고정 비율과 제약·일정 경계는 유지한다. 이는 AI 초안 데이터의 운영 승격을 뜻하지 않는다.
- 근사 일정은 필수 군집과 사용자 중심을 먼저 보존한 뒤 선택 variant Top-N에서 남은 일자의 자동 중심을 만든다. 자차 15km/비자차 5km와 하루 최대 6곳을 사용하며, 중심-장소 Haversine 직선거리 군집일 뿐 도로·교통·방문 순서를 계산하지 않는다.
- 검수 UI는 100건 v3 제안, v2 웹 조사 레코드, 기후 기준과 기준 SHA-256을 HTML에 내장하며 서버 API를 호출하지 않는다.
- 브라우저는 조사 시점에 캐시한 페이지를 다시 가져오지 않는다. 출처 링크를 여는 동작만 외부 네트워크에 의존한다.
- 사람 입력은 현재 브라우저의 `localStorage`와 사용자가 내려받은 JSON 파일에만 저장된다.
- 전체 장소 SQLite는 로컬 질의용 파생 산출물이며 현재 서버 API나 브라우저 런타임에서 읽지 않는다. 교환 정본은 `source_order` 순서의 canonical JSONL이다.

## 목표 장소 추천 구조 — 미구현

아래 구조는 Draft 상태인 [SPEC-008](spec_008.md)이 제안하는 첫 내부 오프라인 랭커의 컴포넌트 경계다. 설계 문서이며 구현 완료나 승인된 구현 범위를 의미하지 않는다.

```text
canonical JSONL set + 원본 장소 ─┐
read-only SQLite + manifest ─────┴─> feature snapshot materializer
                                        |
                                        v
                 RecommendationFeatureSnapshot + digest
                                        |
                                        v
                              dataset-status gate <── trusted runtime
                                        |
구조화 요청 ───────────────> request validator/normalizer
자연어 ─> controlled mapper ─> proposed/accepted 분리 ─┘
                                        |
                                        v
 intent lane ─> 후보 자격 ─> 4상태 제약 판정 ─> verification candidates
                                        |
                                        v
 feature registry ─> reliability 보정 ─> 결정적 place ranker
                                        |
                                        v
                          다양성 재정렬 + reason trace
                                        |
                         +--------------+--------------+
                         v                             v
              versioned result artifact       offline evaluator
```

### 계획 컴포넌트 책임

- `feature snapshot materializer`: canonical JSONL set과 원본 장소 또는 읽기 전용 SQLite를 공통 `RecommendationFeatureSnapshot`으로 투영한다. 원본 지역 코드도 보존하고 두 경로의 canonical digest 동등성을 검증하며, 현재 SQLite에 없는 archetype·flags를 baseline 입력으로 가정하지 않는다. digest는 digest 필드 자신을 제외한 payload에서 계산한다.
- `dataset-status gate`: 클라이언트가 바꿀 수 없는 신뢰된 런타임 설정을 읽어 `ai_draft`를 `internal_experiment`에서만 허용하고 모든 결과에 상태 경고를 강제한다.
- `request validator/normalizer`: 날짜·시간대·intent·party·필수 제약·선호를 검증하고 hard/soft를 분리한다.
- `controlled mapper`: 선택 컴포넌트다. 자연어에서 허용된 taxonomy·environment 태그를 `proposed` 상태로만 만든다. 사용자 확인 또는 versioned policy threshold를 통과한 `accepted` 태그만 정규화 요청에 들어가며, mapper가 장소 점수나 필터 결과를 직접 출력하지 않는다.
- `intent lane 후보 생성`: `visit`, `shopping`, `stay`, `event`를 각 `experience_scope`에 연결하고 초기에는 해당 lane 전건을 읽는다.
- `후보 자격·제약 판정`: scope·지역·명시 제외와 기계 실행 가능한 제약을 점수 전에 적용한다. 현재 자유 텍스트 `verify` 제약은 확인 필요로만 보낸다.
- `feature registry`: taxonomy, companion, month, environment 정의와 입력·출력 범위, reliability, 버전을 관리한다.
- `결정적 place ranker`: AI 초안 값을 중립으로 수축한 적합도와 별도 confidence를 계산한다. 거리·이동시간은 사용하지 않는다.
- `다양성·reason trace`: 적합도 값을 바꾸지 않고 표시 순서를 재조정하며 실제 score·constraint·evidence만 설명 입력으로 만든다.
- `offline evaluator`: 결정성, 제약, 독립 사람 라벨, 랭킹, 다양성, 설명 provenance를 기준선과 비교한다.

### 장소 추천과 일정 최적화 경계

장소 추천 출력은 장소별 적합도, request coverage, confidence, 후보 자격, 확인 필요사항, catalog 위치와 버전이다. 향후 일정 최적화기는 이를 입력 후보로 사용하되 다음 데이터를 별도로 요구한다.

```text
예상 체류시간 + 실제 이동시간 행렬 + 운영/예약 time window
일별 시작·종료 위치 + 이동수단·휴식 규칙
        |
        v
schedule feasibility / schedule utility
```

일정기는 동선 때문에 장소를 제외할 수 있지만 원래 `place_fit`을 변경하지 않는다. 현재 저장소에는 신뢰할 수 있는 체류시간·이동시간과 운영 time window가 없으므로 완전한 일정 최적화기는 후속 SPEC 범위다. 다만 SPEC-015·017의 내부 실험 UI는 장소 좌표만 사용해 필수 장소를 중심 반경과 하루 장소 수로 나누고, 선택한 코스 variant를 남은 일자의 자동 중심과 일자별 후보 우선순위로 연결한다. 이 군집은 `place_fit`을 바꾸지 않는 별도 단계다.

### 유지할 경계

- 원본 데이터, 조사·정규화 데이터, 추천 feature snapshot을 구분한다.
- 후보 자격, 필수 제약, 선호 점수와 다양성 재정렬을 분리한다.
- `review_priority`를 추천 품질이나 confidence로 사용하지 않는다.
- 랭킹과 일정 최적화를 독립적으로 버전 관리하고 평가한다.
- 결과에 데이터 snapshot·manifest hash·logical digest·feature snapshot digest와 모든 알고리즘 버전을 포함한다.
- 설명은 계산된 score·constraint·evidence trace만 사용한다.

## 아직 결정되지 않은 사항

- 백엔드 언어와 HTTP 프레임워크
- 통제 취향 태그 사전과 자연어 mapper
- 온라인 저장소와 사용자 프로필 저장 방식
- 구조화 constraint 종류·freshness·unknown 정책
- 공식 운영·가격·날씨 제공자
- 경로·이동시간 제공자와 일정 최적화 방식
- 사람 검수 승격 절차와 제한 베타 범위
- 배포 환경, 관측 도구와 행동 로그 정책

각 결정은 구현 전에 활성 SPEC에서 승인한다.
