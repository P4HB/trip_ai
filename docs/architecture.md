# 시스템 아키텍처

- 문서 상태: 현재 구현 + 목표 구조
- 최종 수정일: 2026-08-10

## 현재 구현

현재 제품은 제주 장소 데이터를 수집하고 브라우저 지도에서 탐색하는 정적 MVP다. 개인화 추천 엔진과 서버 API는 없다.

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

### 컴포넌트 책임

- `scripts/collect_tourapi_jeju.py`: API 키 로드, 전체 페이지 수집, ID 무결성 및 좌표 품질 검사, 날짜별 스냅샷과 해시 생성
- `data/tourapi/jeju/`: 재현 가능한 원본·정제 데이터와 수집 메타데이터 보관
- `scripts/build_map_ui_data.mjs`: 가장 최근 스냅샷 선택, 지도용 필드 정규화, 제주 표시 범위를 벗어난 좌표 제외
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
- `map-ui/`: 검색, 카테고리 필터, 지도 범위 결과, 마커 클러스터, 장소 상세를 제공하는 정적 UI

### 현재 런타임 경계

- 브라우저에 API 키를 전달하지 않는다.
- 지도 라이브러리는 `map-ui/vendor/`의 로컬 파일을 사용한다.
- 지도 타일과 장소 이미지는 외부 네트워크에 의존한다.
- 지도 UI는 생성된 `window.JEJU_PLACES`와 `window.JEJU_DATA_META`를 읽는다.
- 검수 UI는 100건 v3 제안, v2 웹 조사 레코드, 기후 기준과 기준 SHA-256을 HTML에 내장하며 서버 API를 호출하지 않는다.
- 브라우저는 조사 시점에 캐시한 페이지를 다시 가져오지 않는다. 출처 링크를 여는 동작만 외부 네트워크에 의존한다.
- 사람 입력은 현재 브라우저의 `localStorage`와 사용자가 내려받은 JSON 파일에만 저장된다.

## 목표 추천 구조 — 미구현

아래 구조는 향후 SPEC을 나누기 위한 경계이며 구현 완료를 의미하지 않는다.

```text
장소·운영·날씨 데이터 -----> 데이터 정규화/품질 계층
                                   |
사용자 조건·취향 ----------> 추천 요청 검증
                                   |
                                   v
 후보 생성 -> 필수 제약 필터 -> 특징 계산 -> 랭킹/다양성 재정렬
                                   |
                                   v
                         일정 가능성/동선 최적화
                                   |
                                   v
                         추천 이유 + 근거 메타데이터
                                   |
                    결과 API/UI + 평가·관측 데이터
```

목표 구조를 구현할 때는 다음 경계를 유지한다.

- 원본 데이터, 정규화 데이터, 추천 특징을 구분한다.
- 필수 제약 필터와 선호 점수 계산을 분리한다.
- 랭킹과 일정 최적화를 독립적으로 평가할 수 있게 한다.
- 추천 결과에 데이터 버전과 알고리즘 버전을 포함한다.
- 설명은 추천 과정에서 계산된 근거만 사용한다.

## 아직 결정되지 않은 사항

- 백엔드 언어와 웹 프레임워크
- 온라인 저장소와 사용자 프로필 저장 방식
- 임베딩 또는 LLM 사용 범위
- 경로·이동시간 제공자
- 실시간 영업정보와 날씨 제공자
- 배포 환경과 관측 도구

각 결정은 구현 전에 별도 SPEC에 기록한다.
