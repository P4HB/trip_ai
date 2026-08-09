# 데이터 계약

- 문서 상태: 현재 구현 + 목표 초안
- 최종 수정일: 2026-08-09

## 공통 규칙

- 텍스트 파일은 UTF-8을 기본으로 한다. Excel용 CSV는 UTF-8 BOM을 사용할 수 있다.
- 날짜는 `YYYY-MM-DD`, 시각은 시간대가 포함된 ISO 8601을 사용한다.
- 좌표는 WGS84를 전제로 하며 `longitude` 다음 `latitude` 순서를 명시한다.
- TourAPI의 `mapx`는 경도, `mapy`는 위도다.
- 알 수 없는 값은 임의로 보정하지 않는다. 스키마에 따라 `null`, 빈 값 또는 명시적 `unknown`을 사용한다.
- 외부 데이터에는 출처와 수집·확인 시각을 함께 보관한다.

## TourAPI 장소 원본 — 구현됨

기준 위치는 `data/tourapi/jeju/YYYY-MM-DD/jeju_places.json`이다. 주요 필드는 다음과 같다.

| 필드 | 의미 | 비고 |
|---|---|---|
| `contentid` | 장소 고유 ID | 수집 시 누락·중복 불가 |
| `contenttypeid` | TourAPI 장소 유형 | 12, 14, 15, 25, 28, 32, 38, 39 |
| `title` | 장소명 | 원본 값 |
| `addr1`, `addr2` | 주소 | 부분 누락 가능 |
| `tel` | 전화번호 | 누락 가능 |
| `mapx`, `mapy` | 경도, 위도 | 숫자 변환 및 범위 검증 필요 |
| `firstimage`, `firstimage2` | 대표 이미지 URL | 누락 가능 |
| `modifiedtime` | 제공처 수정 시각 | 문자열 원본 |
| `cat1`, `cat2`, `cat3` | 분류 코드 | 부분 누락 가능 |

`manifest.json`은 요청 조건, 건수, 품질 결과, 파일 해시를 기록한다. `quality_issues.csv`는 누락·비정상 좌표를 기록한다.

## 지도 장소 — 구현됨

`scripts/build_map_ui_data.mjs`가 `map-ui/data/jeju-places.js`에 아래 논리 구조를 생성한다.

```text
Place {
  id: string
  type: string
  title: string
  address: string
  phone: string
  lng: number
  lat: number
  image: string
  thumbnail: string
  modified: string
  category: [string, string, string]
}
```

- 유효 지도 좌표 범위는 경도 `125.5..127.5`, 위도 `32.5..34.2`다.
- 이미지 URL은 HTTP(S)만 허용하고 HTTP는 HTTPS로 정규화한다.
- 이름이 비어 있으면 `이름 없는 장소`를 사용한다.

## 라벨링용 장소 분할 — 구현됨

`scripts/split_tourapi_jeju_places.mjs`가 가장 최신 TourAPI 원본 배열을 다음 경로의 파생 데이터로 분리한다.

```text
data/labeling/jeju/YYYY-MM-DD/
  restaurants.json
  non_restaurants.json
  manifest.json
```

- `restaurants.json`: `contenttypeid`를 문자열로 정규화한 값이 `39`인 레코드
- `non_restaurants.json`: `contenttypeid`가 `12`, `14`, `15`, `25`, `28`, `32`, `38` 중 하나인 레코드
- 두 파일은 UTF-8 JSON 배열이며 원본 레코드의 모든 필드와 원본 순서를 보존한다.
- `contentid`가 집합 식별자다. 제목, 주소 또는 좌표가 같아도 자동 병합하지 않는다.
- 좌표 유효성은 분리 조건이 아니다. 지도에서 제외된 장소도 유형에 맞는 집합에 남는다.
- 빈 식별자, 중복 식별자, 빈 유형 또는 지원하지 않는 유형이 있으면 분리기는 오류로 종료한다.
- `non_restaurants.json`은 초기 일반 장소 라벨링 후보이며, 파일 생성만으로 라벨링이 완료된 것은 아니다.

`manifest.json`은 `tourapi-jeju-place-partition-v1` 계약을 사용하며 다음을 기록한다.

- 원본 파일의 저장소 상대 경로, 스냅샷 날짜, 수집 시각과 SHA-256
- 분리 필드, 음식점 값, 허용된 비음식점 값과 미지원 값 처리 정책
- 전체·집합별·유형별 건수
- `contentid` 완전 분할과 원본 보존 여부
- 두 출력 파일의 건수와 SHA-256

## 장소 프로필 100건 파일럿 — 구현됨, AI 초안

`SPEC-003`의 companion·월별 적합도 파일럿은 다음 sidecar 경로에 저장한다. 원본 장소나 데이터베이스 스키마에는 라벨을 추가하지 않는다.

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100/
  selection_ids.json
  research/part_*.json
  research/targeted_sources.json
  place_profiles.json
  manifest.json
  review_report.md
```

- 표본은 관광지 68, 문화시설 12, 축제 4, 레포츠 16건이다.
- `place_profiles.json`은 `contentid`를 원본 연결 키로 사용한다.
- `companion_fit`은 `solo`, `couple`, `friends`, `kids`, `parents` 다섯 독립 축이다.
- `month_fit`은 문자열 키 `1`부터 `12`까지 저장하며, 장소 내 연중 중립값 `0.5`를 기준으로 한 상대적 계절 조정값이다.
- 모든 라벨과 근거 속성은 `0`, `0.25`, `0.5`, `0.75`, `1`, `null` 중 하나를 사용한다.
- `null`은 정보 부족 또는 적용 보류이며 `0`과 다르다.
- 축제의 개최기간은 별도 가용성 제약이므로 확인되지 않은 월별 값은 `null`로 둔다.
- `label_evidence`는 환경, 체력 부담, 실내 비율, 계절 절정 월, 날씨 민감도, 판단 근거, 직접 출처와 제한사항을 보관한다.
- 검색 결과 목록이나 일반 포털 홈은 직접 근거로 인정하지 않는다.
- `label_meta`는 `place-profile-pilot-v1` 버전, 생성 방법, 특징군별 신뢰도와 `ai_draft` 또는 `needs_human_review` 상태를 기록한다.
- `research/part_*.json`은 저비용 조사 에이전트의 원시 초안이며 정규화·출처 필터를 거친 `place_profiles.json`만 소비 계약이다.
- `research/targeted_sources.json`은 취약 사례를 장소별 공식·공공 상세 페이지로 재확인한 보강 근거다. 원시 조사 파일의 검색 결과와 일반 포털 링크는 최종 `source_refs`에서 제거한다.
- 분류 사전값으로 동반자 점수를 만든 경우 연령·접근성·편의시설의 필드별 근거가 없는 `kids`와 `parents`는 원칙적으로 `null`로 보류한다. 제목 자체가 어린이 시설을 명시하거나 걷기 부담이 분류상 명확한 예외도 모두 사람 검수 대상으로 남긴다.
- `seasonal_peak_months`는 최종 `month_fit` 값이 정확히 `1`인 월과 일치해야 한다.

현재 파일럿은 사람 검수 전이므로 추천 운영 데이터나 골드 라벨로 사용하면 안 된다.

## 추천 요청 — 목표 초안, 미구현

정확한 API 스키마는 구현 SPEC에서 확정한다. 최소 도메인 필드는 다음을 고려한다.

```text
RecommendationRequest {
  request_id: string
  destination_region: string
  travel_dates: { start: date, end: date, timezone: string }
  party: { adults: integer, children: integer?, accessibility_needs: string[] }
  transport_modes: string[]
  origin: coarse_location | place_id | null
  budget: { amount: number?, currency: string, is_hard_limit: boolean }
  hard_constraints: Constraint[]
  preferences: Preference[]
  excluded_place_ids: string[]
}
```

- 필수 제약과 선호를 별도 필드로 유지한다.
- 정확한 실시간 위치가 필요하지 않으면 행정구역 또는 격자 수준 위치를 사용한다.
- 금액에는 통화를, 시간에는 시간대를 반드시 포함한다.

## 추천 결과 — 목표 초안, 미구현

```text
RecommendationResult {
  request_id: string
  generated_at: datetime
  data_snapshot: string
  algorithm_version: string
  items: RecommendationItem[]
  warnings: Warning[]
}

RecommendationItem {
  place_id: string
  rank: integer
  score: number
  score_components: map<string, number>
  matched_preferences: string[]
  reasons: EvidenceBackedReason[]
  uncertainty: string[]
}
```

- `reasons`는 실제 필터와 점수 특징에서 생성된 근거만 포함한다.
- 운영시간·가격 등 확인되지 않은 정보는 `uncertainty` 또는 `warnings`에 표시한다.
- 내부 점수 범위와 반올림 방식은 알고리즘 SPEC에서 버전별로 고정한다.
