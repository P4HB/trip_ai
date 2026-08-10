# SPEC-005: 100건 장소별 웹 조사와 근거 강화 검수 화면

- 상태: Implemented
- 작성일: 2026-08-10
- 최종 수정일: 2026-08-10
- 관련 이슈: 사용자 검수 피드백
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-003](spec_003.md), [SPEC-004](spec_004.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/pilots/place-profile-v2-100/`, `scripts/build_place_profile_research_v2.mjs`, `labeling-review/`
- 선행 SPEC: [SPEC-003](spec_003.md), [SPEC-004](spec_004.md)

## 배경

SPEC-003의 100건 AI 초안 중 장소별 직접 출처가 연결된 곳은 10건뿐이다. 나머지 90건은 TourAPI 제목·분류와 공통 사전값에 크게 의존한다. SPEC-004 검수 화면이 이 한계를 표시하기는 하지만, 사용자가 실제 장소 특성을 알 수 있는 설명과 시설·보행·계절 정보를 제공하지 않아 companion과 month 라벨을 판단하기 어렵다.

현재 초안은 사람 검수용 기준으로도 근거 밀도가 부족하다. 기존 v1 산출물과 원본 데이터는 보존하고, 같은 100건을 장소별로 웹 조사한 v2 sidecar와 검수 화면을 만든다.

## 목표

- 100개 장소를 각각 웹에서 조사하고 장소 식별·방문 경험·시설·접근성·날씨·계절·운영 제약 정보를 구조화한다.
- 사용한 페이지와 페이지가 뒷받침하는 주장을 장소별로 연결한다.
- 조사 사실을 먼저 기록한 뒤 companion 5축과 month 12축을 다시 제안한다.
- 검수 화면에서 라벨보다 앞에 장소 설명, 핵심 사실, 불확실성, 출처를 보여준다.
- 기존 TourAPI, v1 프로필과 데이터베이스를 수정하지 않는다.

## 비목표

- 실시간 영업 여부·가격·당일 날씨 보장
- 블로그 후기나 검색 결과 스니펫만으로 확정 라벨 생성
- 100건 밖의 나머지 후보 장소 조사
- 사람 검수 완료 또는 운영용 골드 라벨 선언
- 원격 저장, 계정, 다중 사용자 편집

## 요구사항

- `REQ-001`: 입력 ID와 순서는 SPEC-003의 고정 100건과 정확히 같아야 하며 v1 파일은 변경하지 않아야 한다.
- `REQ-002`: 각 장소는 제목·주소·유형을 사용해 동명이인과 지점을 구분하고 `matched`, `uncertain`, `not_found` 중 조사 상태를 기록해야 한다.
- `REQ-003`: 모든 장소에 실제 웹 검색을 수행하고, 검색 결과 목록·스니펫이 아니라 열어 확인한 HTTP(S) 페이지와 확인일을 기록해야 한다.
- `REQ-004`: 출처 유형과 권위를 명시한다. 균일한 100건 기초 조사는 신뢰 가능한 2차 관광 상세 자료를 사용할 수 있지만 공식·공공·운영자 출처로 오인하지 않는다. 출처 충돌, 현재 운영 여부 또는 변동 정보가 라벨을 좌우할 때는 1차 출처 재확인을 요구한다.
- `REQ-005`: `matched` 장소는 최소 한 개의 확인된 상세 페이지와 출처별 구체 주장 두 개 이상이 있어야 한다. 찾지 못한 장소는 추측 대신 검색 시도와 미확인 사항을 기록한다.
- `REQ-006`: 장소별 조사 정보는 요약, 대표 경험, 실내·실외, 걷기·경사·계단, 유모차·휠체어 단서, 좌석·화장실, 아이·부모님 단서, 비·바람·더위·추위 영향, 계절 특징, 운영·행사 제약과 미확인 사항을 구분해야 한다.
- `REQ-007`: 변동 가능한 운영시간·휴무·가격·행사일은 출처 확인일과 함께 참고 정보로만 표시하며 companion·month 점수로 필수 제약을 상쇄하지 않아야 한다.
- `REQ-008`: 각 비 `null` 라벨은 장소별 조사 주장 또는 명시적인 중립·환경 노출 규칙으로 설명되어야 한다. companion은 해당 동행 축의 직접 단서가 있어야 하며, 근거가 부족하거나 상충하면 `null`과 제한사항을 사용한다.
- `REQ-009`: month 라벨은 평년의 장소 경험 적합도이며 실제 예보·휴무·축제 개최월과 분리한다. 행사성 장소의 월별 값은 개최일 정보만으로 채우지 않는다.
- `REQ-010`: 조사 원문을 길게 복제하지 않고 사실을 요약한다. 각 출처의 직접 인용은 필요한 짧은 구절만 허용한다.
- `REQ-011`: v2 검수 화면은 조사 요약·핵심 사실·출처별 주장·미확인 사항을 라벨 입력보다 먼저 보여줘야 한다.
- `REQ-012`: 각 v2 프로필은 연결 조사 레코드 해시를 포함한다. 이 프로필 파일 해시로 별도 localStorage 키를 사용해 v1 사람 입력 또는 다른 조사 버전과 묵시적으로 합치지 않아야 한다.

## 입력과 출력

입력:

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100/selection_ids.json
data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100/place_profiles.json
data/tourapi/jeju/2026-08-09/jeju_places.json
열어 확인한 공개 웹 페이지
```

출력:

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v2-100/
  research/web_pages.json
  research/part_1.json
  research/part_2.json
  research/part_3.json
  place_web_research.json
  place_profiles.json
  manifest.json
  review_report.md
labeling-review/index.html
```

장소별 조사 레코드의 논리 구조:

```text
PlaceWebResearch {
  contentid: string
  title: string
  research_status: matched | uncertain | not_found
  identity_notes: string
  checked_at: date
  summary: string
  experience_tags: string[]
  facts: {
    environment: indoor | outdoor | mixed | unknown
    typical_visit: string | null
    walking: string | null
    stairs_slopes: string | null
    stroller_wheelchair: string | null
    seating_restroom: string | null
    kids: string | null
    seniors: string | null
    rain: string | null
    wind: string | null
    heat: string | null
    cold: string | null
    seasonality: string | null
    availability: string | null
  }
  evidence_scores: {
    physical_effort: LabelValue
    indoor_ratio: LabelValue
    rain_sensitivity: LabelValue
    wind_sensitivity: LabelValue
    heat_sensitivity: LabelValue
    cold_sensitivity: LabelValue
    seasonal_peak_months: integer[]
    availability_separate: boolean
  }
  sources: SourceClaim[]
  search_attempts: string[]
  unknowns: string[]
  proposed_companion_fit: map<CompanionKey, LabelValue>
  proposed_month_fit: map<MonthKey, LabelValue>
  companion_rationale: map<CompanionKey, string>
  month_rationale: string
  confidence: { identity: LabelValue, companion_fit: LabelValue, month_fit: LabelValue }
}

SourceClaim {
  url: string
  title: string
  publisher: string
  source_type: official_tourism | public_agency | official_operator |
               heritage | reputable_secondary
  checked_at: date
  claims: string[]
}
```

## 설계

```text
고정 100건 + TourAPI 식별 정보
            |
            v
장소별 웹 검색 -> 페이지 열람·추출 캐시 -> 주장·출처 구조화
            |
            v
research/part_*.json
            |
            v
병합·스키마·출처·ID 검증
            |
            +--> place_web_research.json
            +--> place_profiles.json (v2 제안 라벨)
            +--> review_report.md / manifest.json
            |
            v
근거 강화 labeling-review/index.html
```

조사 레코드는 사실과 제안 라벨을 함께 담되 UI는 사실과 출처를 먼저 렌더링한다. `not_found`는 공통 사전값으로 억지 라벨을 채우지 않고 관련 축을 `null`로 둔다.

## 예외와 폴백

- 동명이인 또는 장소 지점이 불명확하면 `uncertain`으로 두고 해당 페이지를 확정 근거로 쓰지 않는다.
- 공식 페이지가 사라졌으면 공공 아카이브나 신뢰 가능한 2차 출처를 사용하되 현재 운영을 확정하지 않는다.
- 폐업·종료·휴장 가능성은 `availability`와 `unknowns`에 기록하고 장소 경험 점수와 분리한다.
- 서로 다른 출처가 충돌하면 둘 다 기록하고 관련 라벨을 `null`로 둔다.
- 페이지 접근 실패는 URL과 실패 이유를 검색 시도에 기록하되 검색 스니펫을 사실로 옮기지 않는다.

## 영향 범위

- 변경 예정 파일: `docs/spec_005.md`, `docs/README.md`, `docs/data_contracts.md`, `data/.../place-profile-v2-100/`, v2 생성·검증 스크립트, `labeling-review/`
- 데이터 마이그레이션: 없음. v1을 보존하고 v2를 추가한다.
- 호환성 영향: v2 프로필 해시가 달라 기존 브라우저 검수 세션은 자동 이관하지 않는다.
- 보안·개인정보 영향: 공개 장소 정보와 공개 URL만 처리한다.

## 승인 기준

- `AC-001`: v2 조사와 프로필이 정확히 같은 100개 ID·순서를 가지며 v1과 원본 파일 해시는 변하지 않는다.
- `AC-002`: 100건 모두 검색 시도와 조사 상태가 있고 `matched`는 열어 확인한 출처와 구체 주장 두 개 이상을 가진다.
- `AC-003`: 모든 URL이 HTTP(S)이고 검색 결과 URL이 소비 출처로 남지 않으며 확인일·출처 유형·주장이 완전하다.
- `AC-004`: 모든 사실 필드가 존재하고 미확인 정보는 `null` 또는 `unknowns`로 드러난다.
- `AC-005`: 5개 companion·12개월 값, 축별 companion 근거와 month 근거가 허용 스키마를 만족한다.
- `AC-006`: 행사기간·운영 제약과 month 적합도, 실제 날씨와 평년 민감도가 분리된다.
- `AC-007`: 검수 화면에서 조사 요약·사실·미확인 사항·출처별 주장을 라벨보다 먼저 확인할 수 있다.
- `AC-008`: 같은 조사 입력으로 v2 산출물과 HTML을 재생성하면 데이터 파일이 바이트 단위로 같다.
- `AC-009`: 기존 v1·TourAPI·지도 산출물과 데이터베이스는 변경되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001~AC-006 | ID·스키마·출처·값·의미 규칙 검사 | `node scripts/validate_place_profile_research_v2.mjs` |
| AC-007 | 생성 HTML 데이터·필수 UI 블록 검사 | `node scripts/validate_labeling_review_ui.mjs` |
| AC-008 | 생성 전후 SHA-256 비교 | v2 빌드와 HTML 빌드 2회 |
| AC-009 | 보호 경로 상태와 기존 검증 | `git status --short -- data/tourapi/jeju map-ui data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100` |

## 구현 결과

- `scripts/fetch_place_profile_web_pages.mjs`가 고정 100건의 K-TRIP TIPS 상세 페이지를 실제로 열어 100/100 HTTP 200 응답, 본문·안내 항목과 페이지 해시를 `research/web_pages.json`에 기록했다.
- 페이지 제목은 79건이 입력 제목과 정확히 일치했고 21건은 별칭·띄어쓰기·지점 표기 차이였다. 21건 모두 실제 페이지 제목과 contentid·주소 근거를 조사 레코드에 남겼다.
- 세 조사 배치를 원문과 독립 재감사해 일반 문구로 채운 companion, 지명·상징을 날씨 민감도로 오해한 사실, 혼잡을 계절 최고점으로 사용한 값, 코스 거리 충돌 은폐를 제거했다.
- 최종 조사는 `matched` 100건, 확인 페이지 100개, 출처 연결 주장 300개 이상, 명시적 미확인 사항 328개다. 공통 출처 100개는 모두 `reputable_secondary`로 정확히 표시했다.
- 직접 동행 근거가 있는 companion 44축만 비 `null`로 남겼고 73개 장소는 다섯 축 모두 `null`이다. month는 근거 있는 165축만 비 `null`이며 84개 장소는 12개월 모두 `null`이다.
- `place_profiles.json`은 각 조사 레코드 SHA-256을 포함하며 최종 파일 SHA-256은 `39e6fa8f0abfd5d4b675917c98cb3f1cacf9f5eb954d0320a704dd4294437e31`이다.
- `labeling-review/index.html`은 조사 요약, 대표 경험, 14개 구조화 사실, 미확인 사항, 출처별 주장과 검색 과정을 라벨 입력보다 먼저 표시한다. 최종 단일 HTML은 100건·출처 100개를 내장한다.
- v1 프로필, TourAPI 원본, 지도 데이터와 데이터베이스는 변경하지 않았다.

## 검증 결과

- `node scripts/validate_place_profile_research_v2.mjs`: 100건, `matched` 100, 출처 100, 미확인 사항 328, ID·출처·사실·라벨·환경 휴리스틱·해시 검증 통과.
- `node scripts/validate_labeling_review_ui.mjs`: 100건, 출처 보유 장소 100, 단일 HTML, 기준 SHA 일치, 위험 DOM sink 0으로 통과.
- `node scripts/test_labeling_review_model.mjs`: 초기 상태, override와 명시적 null, 상태 전이, 저장·복원, 내보내기·가져오기, 잘못된 입력 12종 거부와 필터를 포함한 10개 그룹 통과.
- v2 빌드와 HTML 빌드를 다시 실행한 뒤 `place_web_research.json`, `place_profiles.json`, `review_report.md`, `manifest.json`, `labeling-review/index.html`의 SHA-256이 모두 동일했다.
- 관련 JavaScript 파일의 `node --check`, 기존 v1 validator, 수집기 `py_compile`, 지도 빌더와 앱 구문 검사가 모두 통과했다.
- `git status --short -- data/tourapi/jeju map-ui data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100` 출력은 비어 있었고 `git diff --check` 오류는 없었다.

## 설계와 달라진 점

- 공식 출처를 장소마다 먼저 찾는 방식은 균일한 100건을 한 번에 재조사하기에 인증·접근성과 호출 비용이 불안정했다. 이번 배치는 K-TRIP TIPS 상세 페이지를 공통 2차 기준으로 사용하고 권위를 명시했으며, 공식·공공 출처 재확인은 변동 정보와 후속 고위험 판단으로 한정했다.
- 초기 조사 배치가 활동 존재만으로 companion과 month를 과도하게 채워 독립 원문 감사 후 정책을 강화했다. companion 직접 단서가 없거나 실외 계절 근거가 없으면 기본값이 아니라 `null`을 사용한다.
- 직접 날씨 문장이 없는 evidence는 페이지 사실인 실내·실외 환경에서만 `indoor=0.25`, `mixed=0.5`, `outdoor=0.75`, `unknown=null` 휴리스틱을 사용한다. 실제 예보와 month 값에는 적용하지 않는다.
- UI 기준 프로필에 `research_record_sha256`을 추가했다. 따라서 라벨이 같아도 조사 사실이 바뀌면 전체 프로필 SHA와 브라우저 저장 키가 달라진다.

## 알려진 제한

- 웹 페이지는 이후 변경되거나 사라질 수 있다.
- 실제 방문 없이 웹 정보만으로 확인하기 어려운 체감 보행 난이도와 혼잡도는 사람 검수 대상이다.
- 100건 공통 출처는 2차 관광 상세 자료 한 곳이며 공식 운영자·공공기관 출처를 전건 교차검증하지 않았다. 운영시간·휴무·가격·행사일은 링크에서 다시 확인해야 한다.
- 보수적 근거 정책 때문에 companion 또는 month가 `null`인 장소가 많다. 이는 부적합이 아니라 정보 부족이며 사람이 조사·판정해야 한다.
- 연결된 브라우저 인스턴스가 없어 실제 픽셀 화면 조작은 수행하지 못했다. 단일 HTML 구조, 안전한 DOM 사용, 입력 상태, 자동 저장, 내보내기·가져오기와 반응형 소스 계약은 자동 검증했다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-10 | 사용자 검수 피드백에 따라 100건 장소별 웹 조사와 근거 강화 v2 범위 승인 |
| 2026-08-10 | 100개 페이지 추출, 세 배치 원문 감사, 보수적 라벨 재작성과 근거 우선 검수 HTML 구현 |
| 2026-08-10 | 출처 권위 표시, 환경 노출 휴리스틱, 조사 레코드 해시와 의미 회귀 검증 규칙 반영 후 Implemented |
