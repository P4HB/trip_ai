# 시스템 아키텍처

- 문서 상태: 현재 구현 + 목표 구조
- 최종 수정일: 2026-08-13

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
- `map-ui/`: 검색·지도 탐색과 함께 `ccu-mmr-v0-demo` 구조화 입력, P/A/M 관련도, Top-100 MMR, 추천 trace, 41축 상세, 출처가 연결된 웹 조사 장소 설명을 제공하는 정적 내부 실험 UI

### 현재 런타임 경계

- 브라우저에 API 키를 전달하지 않는다.
- 지도 라이브러리는 `map-ui/vendor/`의 로컬 파일을 사용한다.
- 지도 타일과 장소 이미지는 외부 네트워크에 의존한다.
- 지도 UI는 생성된 `window.JEJU_PLACES`와 `window.JEJU_DATA_META`를 읽는다.
- 추천 입력과 결과는 브라우저 메모리에만 있으며 서버나 외부 서비스로 전송·저장하지 않는다. 날씨·이동시간·가격은 현재 계산에 없다.
- `ccu-mmr-v0-demo`는 SPEC-008의 목표 `baseline-v0`와 별도인 `internal_experiment`이며 AI 초안 데이터의 운영 승격을 뜻하지 않는다.
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

일정기는 동선 때문에 장소를 제외할 수 있지만 원래 `place_fit`을 변경하지 않는다. 현재 저장소에는 신뢰할 수 있는 체류시간·이동시간과 운영 time window가 없으므로 이 컴포넌트는 후속 SPEC 범위다.

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
