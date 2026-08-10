# 데이터 계약

- 문서 상태: 현재 구현 + 목표 초안
- 최종 수정일: 2026-08-10

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

## 장소 프로필 100건 파일럿 v1 — 구현됨, AI 초안

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

v1은 장소별 직접 출처가 10건뿐이어서 현재 검수 기준으로 사용하지 않는다. 재현과 변경 이력 보존을 위해 파일은 그대로 유지한다.

## 장소 프로필 웹 조사 v2 — 구현됨, AI 초안

`SPEC-005`는 v1과 같은 100개 `contentid`·순서를 유지하면서 모든 장소에 실제로 연 웹 상세 페이지와 구조화 사실을 연결한다.

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v2-100/
  research/web_pages.json
  research/part_*.json
  place_web_research.json
  place_profiles.json
  manifest.json
  review_report.md
```

- `research/web_pages.json`은 100개 공개 상세 페이지의 URL, HTTP 상태, 페이지 제목, 본문·안내 항목 추출, 확인일과 페이지 SHA-256을 보관하는 원문 대조용 캐시다. 실행 중 외부 호출에 의존하는 소비 계약은 아니다.
- 현재 공통 확인 페이지 K-TRIP TIPS는 `reputable_secondary`로 분류한 2차 관광 상세 자료다. 공식 관광·공공기관·운영자 출처로 오인하지 않는다.
- `place_web_research.json`은 장소 식별 상태와 설명, 대표 경험, 보행·접근성·편의시설·연령·날씨·계절·가용성 사실, 미확인 사항, 출처별 주장, companion·month 제안과 축별 근거를 저장한다.
- 조사 상태는 `matched`, `uncertain`, `not_found` 중 하나다. 제목이 다른 상세 페이지를 연결한 경우 실제 페이지 제목과 contentid·주소 일치 근거를 `identity_notes`에 기록한다.
- 모든 확인 페이지는 검색 결과 URL이 아닌 HTTP(S) 상세 페이지여야 하고, 출처마다 페이지 본문에서 요약한 구체 주장 두 개 이상을 가진다.
- `matched` 장소는 대표 방문 경험 `typical_visit`과 확인 페이지를 반드시 가진다. 모르는 세부 정보는 추정하지 않고 `null`과 `unknowns`로 남긴다.
- 실외 장소의 계절 경험 근거가 없으면 month 값을 전월 `null`로 둔다. `상시개방`, `연중무휴`, 행사일과 영업시간은 `availability`이며 월별 경험 적합도를 뜻하지 않는다.
- 실내 연중형 장소만 명시적인 중립 규칙으로 전월 `0.5`를 사용할 수 있다. 비중립 월은 출처의 계절 사실이 있어야 한다. 축제 네 건의 12개월 값은 모두 `null`이다.
- 직접 날씨 사실이 없을 때 evidence의 비·바람·더위·추위 민감도는 공간 노출도 휴리스틱 `indoor=0.25`, `mixed=0.5`, `outdoor=0.75`, `unknown=null`만 사용한다. 이는 월별 날씨나 실제 예보가 아니다. 체력 부담은 보행 또는 계단·경사 사실이 있을 때만 수치를 둔다.
- companion 값은 활동 존재만으로 채우지 않고 혼자 안전수칙, 인원 정원, 가족·연인·친구 권장, 연령 제한처럼 해당 축의 출처 사실이 있을 때만 제안한다.
- `place_profiles.json`의 `label_meta.version`은 `place-profile-pilot-v2-web`이다. 각 프로필의 `research_record_sha256`이 연결된 조사 레코드 전체를 고정하므로 조사 사실이 바뀌면 검수 기준 SHA-256도 바뀐다.
- 운영시간·휴무·가격 등 변동 정보는 확인일 기준 참고 정보다. 사람 검수와 실제 여행 추천에서는 연결 페이지 또는 더 권위 있는 최신 출처를 다시 확인한다.

v2도 사람 검수 전 AI 제안이므로 추천 운영 데이터나 골드 라벨로 사용하면 안 된다.

## 장소 프로필 자동 가중치 v3 — 구현됨, AI 초안

`SPEC-006`은 v2의 웹 조사 facts를 변경하지 않고, 수치 라벨의 실제 직접 근거 여부를 다시 검증한 뒤 사람이 새 라벨을 직접 채우지 않도록 별도의 완전한 AI 제안층을 만든다.

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/
  climate_baseline.json
  scoring/assignments_part_*.json
  scoring/archetype_assignments.json
  scoring/companion_profiles.json
  scoring/month_profiles.json
  auto_label_proposals.json
  place_profiles.json
  manifest.json
  review_report.md
```

- 100건의 `contentid`·제목·순서는 v2와 동일하다. v1·v2, TourAPI, 지도와 데이터베이스는 수정하지 않는다.
- `place_profiles.json`의 `companion_fit` 500축은 모두 수치다. 축제가 아닌 96건의 `month_fit` 1,152축도 모두 수치다.
- 축제 4건의 month 48축만 `null`이고 `auto_label_proposals.json`에 `not_applicable` 및 `date_gated_not_applicable`을 기록한다. 이는 사용자가 채워야 하는 미정값이 아니다.
- v2의 수치라고 해서 자동으로 직접 근거로 승격하지 않는다. companion과 month 모두 실제 웹 문장에 대응하는 축만 `direct_evidence`로 사용하고, 나머지는 조사 사실·고정 archetype·1991~2020 제주 기후평년 규칙으로 다시 완성한다. v2 month 수치 165축 중 실제 계절 문장과 대응한 21축을 보존하고 누락됐던 개오리오름 겨울 3축을 더해 v3 직접 month는 24축이다. 따라서 위 v2의 “실외 무근거 month는 `null`” 정책은 v2 사실층에는 유지되지만 v3 AI 제안층에는 적용하지 않는다.
- 추론 우선순위는 직접 웹 근거, 구조화 조사 사실, 장소 유형 사전값, 기후 휴리스틱 순이다. 각 companion·month 축은 `value`, `confidence`, `inference_level`, 한국어 `rationale`, `evidence_ids`, `rule_ids`를 가진다.
- 직접 근거가 아닌 prior는 `0.25..0.75`로 제한한다. `0`과 `1`은 명시적 불가 조건 또는 직접 확인한 대표 강점·계절 절정에만 허용한다.
- `hard_constraints`는 예약, 최소 인원, 연령, 운영일, 기상 통제, 이동·안전 부담을 점수와 별도로 기록한다. 각 제약은 `applies_to`에 적용 경험을 명시한다. 추천 후보에서는 이 제약을 먼저 확인해야 하며 높은 fit으로 상쇄할 수 없다.
- 월별 기본값의 고정 입력은 `data/climate/kma/1991-2020/jeju_four_station_monthly_normals.json`이다. 이 fixture는 기상청 제주·고산·성산·서귀포의 1991~2020 월평년 표, 우리나라 영향 태풍 월평년, 원문·표 위치·확인일, 제품용 월 벡터와 canonical SHA-256을 보존한다. 빌드는 canonical hash를 확인한 입력에서 `climate_baseline.json`과 `scoring/month_profiles.json`을 파생한다. 4지점 단순평균은 기상청의 공식 “제주권 평균”이 아니며 고지대 미기후나 실제 여행일 예보를 뜻하지 않는다.
- `review_priority`는 `low`, `medium`, `high`다. 복합 안전·접근 조건, 날짜가 필요한 축제, 좌표·환경 불확실성을 우선 검수 대상으로 올린다. 직접 근거가 아닌 `kids`·`parents` 비중립값이나 높은 보행 부담이 있는 장소는 최소 `medium`으로 올려 `low` 일괄 승인에 섞이지 않게 한다.
- `place_profiles.json`은 편리한 수치 소비 파일이고 `auto_label_proposals.json`이 축별 추론 provenance의 기준 계약이다. 둘의 값이 다르면 검증 실패다.
- `manifest.json`은 v2 입력 SHA-256, 규칙 버전, 기후 fixture 경로·파일 SHA-256·canonical SHA-256·기준 기간·출처, coverage와 모든 생성 파일 해시를 기록한다. validator는 fixture에서 4지점 단순평균을 독립 계산해 12개월 평균기온·강수량·평균풍속·태풍, 6~9월 평균 일최고기온·상대습도, 모든 `outdoor_comfort`·month archetype 벡터를 산출물과 전수 대조한다.

v3도 사람 승인 전 AI 초안이다. `low`·`medium` 일괄 승인은 각각의 사용자 확인 뒤 사람 검수 sidecar 상태만 바꾸며 AI 원본이나 운영용 골드 라벨을 자동 변경하지 않는다. `high`는 개별 검수한다.

## 장소 프로필 사람 검수 피드백 — 구현됨

`labeling-review/index.html`은 v3 수치 제안과 v2의 조사 사실·미확인 사항·출처를 함께 보여주고, 100건 AI 제안을 읽기 전용 기준값으로 내장해 사람 검수 결과를 별도 sidecar로 내보낸다. 원본 `place_profiles.json`, TourAPI 데이터와 지도 데이터는 수정하지 않는다.

```text
PlaceProfileHumanReviewBundle {
  schema_version: "place-profile-human-review-v2"
  base: {
    label_version: "place-profile-pilot-v3-auto"
    profile_path: string
    profile_sha256: string
    review_base_sha256: string
    profile_count: 100
  }
  session: {
    session_id: string
    ui_version: "place-profile-review-ui-v3"
    created_at: datetime
    updated_at: datetime
    exported_at: datetime
  }
  reviews: HumanReview[100]
}

HumanReview {
  contentid: string
  title_snapshot: string
  status: unreviewed | in_progress | approved_as_is |
          approved_with_changes | needs_research | skipped
  overrides: {
    companion_fit: map<CompanionKey, { from: LabelValue, to: LabelValue }>
    month_fit: map<MonthKey, { from: LabelValue, to: LabelValue }>
  }
  comment: string
  started_at: datetime | null
  updated_at: datetime | null
  completed_at: datetime | null
}
```

- `LabelValue`는 `0`, `0.25`, `0.5`, `0.75`, `1`, `null` 중 하나다. 명시적 `null`은 AI 값 유지와 구분한다.
- 축제 month의 `not_applicable` 값은 편집할 수 없고 조치할 미정값으로 집계하지 않는다.
- `overrides`에는 AI 값과 다른 축만 기록하며 AI 값으로 되돌리면 해당 항목을 제거한다.
- `approved_as_is`는 override가 없는 완료, `approved_with_changes`는 하나 이상의 override가 있는 완료를 뜻한다.
- 승인된 사람 라벨로 적용할 수 있는 override는 `approved_with_changes` 상태뿐이다. `needs_research`와 `skipped`에 보존된 override는 검수 제안이며 후속 적용 대상이 아니다.
- `needs_research`와 `skipped`는 2,000자 이하의 비어 있지 않은 장소 코멘트가 있어야 한다.
- 브라우저 내부 자동 저장본에서는 `session.exported_at`이 `null`일 수 있다. 공유·가져오기 가능한 파일은 `결과 내보내기`가 설정한 ISO 8601 시각이 있어야 하며, 내보내기는 마지막 편집 시각인 `session.updated_at`을 바꾸지 않는다.
- 가져오기는 5 MiB 이하의 파일만 허용한다. 정확한 스키마·UI 버전, 기준 `label_version`·경로·SHA-256·건수, 100개 `contentid`와 제목의 집합·순서·중복, 세션 ID와 ISO 8601 시각, 상태별 시각 불변조건, 모든 허용 키·값, override의 현재 AI 기준값과 무효 변경 여부, 코멘트 길이를 검증한 뒤에만 기존 상태를 원자적으로 교체한다.
- `session_id`는 비어 있지 않은 최대 128자 문자열이다. `unreviewed`에는 override·코멘트·검수 시각이 없어야 한다. `in_progress`에는 `started_at`과 `updated_at`이 있고 `completed_at`은 `null`이어야 한다. 네 종료 상태에는 세 시각이 모두 있어야 한다.
- 브라우저 자동 저장 키에는 합성 기준값 `review_base_sha256`이 포함된다. 다른 데이터셋이나 근거 버전의 저장값을 묵시적으로 합치지 않는다.
- 우선순위별 일괄 승인은 아무 수정·코멘트가 없는 `unreviewed` `low` 또는 `medium` 항목만 해당 모달에서 `approved_as_is`로 바꾼다. 두 우선순위는 서로 분리하며 작성 중·완료·`high` 항목은 바꾸지 않는다.
- `review_base_sha256`은 프로필, 축별 자동 제안, 기후 기준, 웹 조사와 UI 버전 해시의 합성 기준값이다. 브라우저 저장 키와 import 검증은 이 값을 사용하므로 숫자가 같더라도 근거·기후·UI가 바뀌면 이전 검수 상태를 자동 재사용하지 않는다.
- v1·v2·v3는 기준 SHA-256이 다르므로 이전 버전 브라우저 상태나 내보내기 파일을 자동 병합하지 않는다.
- 다운로드한 JSON만 브라우저 밖으로 공유 가능한 사람 검수 결과다. 서버나 데이터베이스로 자동 전송하거나 운영 라벨에 자동 반영하는 단계는 구현하지 않았다.

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
