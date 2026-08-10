# SPEC-003: Companion·월별 적합도 100건 파일럿 라벨링

- 상태: Implemented
- 작성일: 2026-08-09
- 최종 수정일: 2026-08-09
- 관련 이슈: 사용자 요청
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md), [`handoff.md`](../handoff.md)
- 관련 코드: `scripts/build_place_profile_pilot.mjs`, `scripts/validate_place_profile_pilot.mjs`, `data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100/`
- 선행 SPEC: [SPEC-002](spec_002.md)

## 배경

음식점을 제외한 제주 장소에 동행자 적합도와 월별 적합도를 부여하기 전에, 정의와 생성 절차가 실제 장소 유형에 일관되게 적용되는지 검증할 100건 파일럿이 필요하다. 원본 TourAPI 기본 목록에는 장소 설명, 시설, 보행 난이도, 계절 절정기와 운영기간이 충분하지 않으므로 제목과 분류만으로 확정적인 라벨을 만들어서는 안 된다.

이번 파일럿은 음식점뿐 아니라 의미가 다른 숙박과 쇼핑도 제외하고 관광지·문화시설·축제·레포츠 828건을 모집단으로 삼는다. 결과는 데이터베이스나 원본 장소 레코드에 추가하지 않고 `contentid`로 연결하는 별도 라벨링 산출물로 관리한다.

## 목표

- 828건에서 유형·신분류·지역·정보 완전성을 고려한 재현 가능한 100건 표본을 만든다.
- 각 장소에 `companion_fit` 다섯 축과 `month_fit` 12개월 초안 라벨을 부여한다.
- TourAPI 기본 필드와 신뢰 가능한 웹 근거를 함께 기록한다.
- 정보가 부족한 판단은 `null`, 낮은 신뢰도와 검수 필요 상태로 명시한다.
- 값 분포, 누락률, 신뢰도와 유형별 특성을 요약해 전체 라벨링 기준 개선에 사용한다.

## 비목표

- 100건을 운영용 정답 또는 사람 검수가 끝난 골드셋으로 간주
- 음식점·숙박·쇼핑 라벨링
- 스타일·테마·절대 품질·추천 점수 라벨링
- 실제 여행일의 날씨 예측이나 영업 여부 확정
- 추천·랭킹·일정 최적화 구현
- 원본 TourAPI 데이터나 데이터베이스 스키마 변경

## 요구사항

- `REQ-001`: 표본 모집단은 최신 스냅샷에서 `contenttypeid`가 `12`, `14`, `15`, `28`인 828건으로 제한해야 한다.
- `REQ-002`: 표본은 관광지 68, 문화시설 12, 축제 4, 레포츠 16건이어야 하며 `contentid`가 중복되면 안 된다.
- `REQ-003`: 유형 안에서 `lclsSystm2`를 최소 한 건씩 포함하고, 제주시·서귀포시 및 정보 불완전 레코드를 함께 포함하는 결정적 표본이어야 한다.
- `REQ-004`: 같은 스냅샷과 선택 버전으로 반복 실행하면 같은 100건과 같은 순서를 선택해야 한다.
- `REQ-005`: `companion_fit`은 `solo`, `couple`, `friends`, `kids`, `parents`를 독립적으로 저장해야 한다.
- `REQ-006`: `month_fit`은 문자열 키 `1`부터 `12`까지 모두 저장하되, 실제 운영기간이나 당일 날씨와 혼합하지 않아야 한다.
- `REQ-007`: 라벨 값은 `0`, `0.25`, `0.5`, `0.75`, `1`, `null`만 허용하고 `null`과 `0`을 구분해야 한다.
- `REQ-008`: 각 장소는 판단에 사용한 관찰 근거, 근거 출처, 특징군별 신뢰도, 라벨러 버전과 검수 상태를 기록해야 한다.
- `REQ-009`: 웹 근거는 한국관광공사·Visit 제주·지자체·공식 시설 등 1차 출처를 우선하고 URL과 확인일을 기록해야 한다. 블로그·검색 결과 요약만으로 확정 라벨을 만들지 않는다.
- `REQ-010`: 근거가 없거나 상충하면 추측하지 않고 관련 값을 `null`로 두며 검수 사유를 기록해야 한다.
- `REQ-011`: 축제 개최기간, 휴장 또는 계절 운영기간은 하드 가용성 정보로 취급하며 낮은 `month_fit`으로 대체하지 않아야 한다.
- `REQ-012`: 라벨 산출물은 원본 장소와 데이터베이스를 수정하지 않는 `contentid` 기반 sidecar여야 한다.

## 입력과 출력

입력:

- `data/tourapi/jeju/2026-08-09/jeju_places.json`
- TourAPI 기본 필드: `contentid`, `contenttypeid`, `title`, 주소, 좌표, `cat1/2/3`, `lclsSystm1/2/3`, 이미지 URL, 수정 시각
- 웹 근거: 공식 관광·지자체·시설 페이지의 장소 특성, 시설, 계절 및 행사 정보

출력:

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100/
  selection_ids.json
  research/part_*.json
  research/targeted_sources.json
  place_profiles.json
  manifest.json
  review_report.md
```

`place_profiles.json`의 논리 구조:

```text
PilotPlaceProfile {
  contentid: string
  title: string
  source_place: {
    contenttypeid: string
    lclsSystm1: string
    lclsSystm2: string
    lclsSystm3: string
    region_code: string
  }
  companion_fit: {
    solo: LabelValue
    couple: LabelValue
    friends: LabelValue
    kids: LabelValue
    parents: LabelValue
  }
  month_fit: { "1".."12": LabelValue }
  label_evidence: {
    environment: indoor | outdoor | mixed | unknown
    physical_effort: LabelValue
    indoor_ratio: LabelValue
    seasonal_peak_months: integer[]
    rain_sensitivity: LabelValue
    wind_sensitivity: LabelValue
    heat_sensitivity: LabelValue
    cold_sensitivity: LabelValue
    companion_basis: string[]
    month_basis: string[]
    source_refs: SourceRef[]
    limitations: string[]
  }
  label_meta: {
    version: "place-profile-pilot-v1"
    method: string
    confidence: { companion_fit: number, month_fit: number }
    review_status: ai_draft | needs_human_review | reviewed
  }
}
```

LabelValue = `0 | 0.25 | 0.5 | 0.75 | 1 | null`이다.

## 표본 설계

고정 시드 `2026-08-09|companion-month-pilot-v1|{contentid}`의 SHA-256 순서를 사용한다.

1. 유형별 표본 수를 `12:68`, `14:12`, `15:4`, `28:16`으로 고정한다.
2. 각 유형의 `lclsSystm2` 그룹에 최소 한 건을 배정하고 나머지는 그룹 크기에 비례 배정한다.
3. 유형별 제주시·서귀포시 비율을 모집단에 가깝게 맞춘다.
4. 이미지 누락 또는 비정상 좌표가 있는 정보 불완전 장소도 포함한다.
5. 유일한 비정상 좌표 `contentid=2704351`은 표본에 포함하되 좌표 기반 근거에는 사용하지 않는다.

표본은 기준 사례의 폭을 확보하기 위한 층화 표본이며 모집단 통계 추정용 무작위 표본이 아니다.

## 라벨 정의

### Companion

- `solo`: 혼자 방문의 자연스러움, 안전, 시간 조절 용이성
- `couple`: 분위기, 공유 경험, 경관과 대화 가능성
- `friends`: 2~5인의 공동 활동과 함께 머물 공간
- `kids`: 만 4~12세의 흥미, 안전, 화장실·휴식·유모차 편의
- `parents`: 평균적 보행이 가능한 60대 이상 성인의 보행 부담, 계단, 좌석, 화장실과 진입 편의

휠체어 등 명시적 접근성 요구는 `parents` 점수로 대체하지 않는다. 관찰 가능한 시설 근거가 없으면 특히 `kids`와 `parents`의 신뢰도를 낮추거나 `null`을 사용한다.

### Month fit

`month_fit`은 해당 장소의 연중 중립값을 `0.5`로 둔 상대적 계절 조정값이다.

- `1`: 장소 고유 경관·체험이 절정인 달
- `0.75`: 명확히 좋은 달
- `0.5`: 계절상 특별한 장점이나 불편이 없는 중립 달
- `0.25`: 기후 노출이나 경관 저하로 불리한 달
- `0`: 운영 여부와 별개로 장소 경험이 명백히 부적합한 달
- `null`: 근거 부족 또는 월별 적합도 자체를 판단할 수 없음

후속 추천 점수에서는 중립 장소가 불리해지지 않도록 `month_fit - 0.5` 같은 중심화된 사용을 검토해야 한다. 실제 비·강풍·폭염 등은 여행일의 동적 검증에서 처리한다.

## 라벨링 절차

1. 원본 필드에서 장소 식별자, 신분류, 환경과 계절 단서를 추출한다.
2. 저비용 웹 조사 에이전트가 1차 출처를 우선해 장소 설명·활동·시설·계절 단서를 수집한다.
3. 근거 속성을 먼저 기록한 뒤 공통 척도로 companion과 월별 값을 파생한다.
4. 규칙 기반 초안과 장소별 웹 근거가 충돌하면 웹 근거를 따르되 출처와 차이를 기록한다.
5. 극단값, `null`, 낮은 신뢰도, 월별 급변과 에이전트 간 불일치 항목을 집중 검수한다.
6. 결과 전체를 `ai_draft` 또는 `needs_human_review`로 표시하고 사용자 검토 전 골드 라벨로 사용하지 않는다.

## 예외와 폴백

- 공식 상세정보를 찾지 못하면 기본 분류 근거만 기록하고 신뢰도를 낮춘다.
- 검색 결과가 동명이인 또는 다른 지점을 가리키면 해당 근거를 사용하지 않는다.
- 변동 정보는 확인일 없이 현재 사실로 저장하지 않는다.
- 축제 날짜가 확인되지 않으면 `month_fit`을 임의의 개최 월로 채우지 않는다.
- `contentid=2704351`은 잘못된 좌표를 지역·날씨 근거로 사용하지 않는다.
- 일부 월만 판단 가능해도 나머지를 보간하지 않고 `null`을 허용한다.

## 영향 범위

- 변경 예정 파일: `docs/spec_003.md`, `docs/README.md`, `docs/data_contracts.md`, `docs/evaluation.md`, 라벨링 생성·검증 스크립트
- 생성 산출물: `data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100/`
- 데이터 마이그레이션: 없음
- 호환성 영향: 원본 수집기, 지도 데이터와 UI, SPEC-002 분할 산출물에 영향 없음
- 보안·개인정보 영향: 공개 장소 정보만 사용하며 사용자 프로필 또는 정확한 사용자 위치를 처리하지 않음

## 승인 기준

- `AC-001`: 100건 표본이 유형별 `68/12/4/16` 쿼터와 고유 `contentid` 조건을 만족한다.
- `AC-002`: 표본의 원본 필드가 최신 스냅샷과 일치하고 음식점·숙박·쇼핑이 없다.
- `AC-003`: 모든 companion 키와 12개 month 키가 존재하며 값은 허용 척도 또는 `null`이다.
- `AC-004`: 각 항목에 관찰 근거, 출처, 특징군별 신뢰도, 버전과 검수 상태가 있다.
- `AC-005`: 정보 부족이 `0`으로 자동 변환되지 않고 낮은 신뢰도·`null`·제한사항으로 드러난다.
- `AC-006`: 축제 운영기간과 실제 날씨가 `month_fit`에 잘못 혼합되지 않는다.
- `AC-007`: 라벨 파일의 ID·값·근거 스키마 자동 검증이 통과한다.
- `AC-008`: 보고서가 유형별 표본 수, 값 분포, `null`률, 신뢰도, 극단값과 알려진 제한을 요약한다.
- `AC-009`: 원본 TourAPI 파일, 지도 산출물과 데이터베이스 구조가 변경되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001~AC-006 | 표본·라벨 스키마 및 의미 규칙 검사 | `node scripts/validate_place_profile_pilot.mjs` |
| AC-007 | JavaScript 구문 검사와 검증기 실행 | `node --check scripts/build_place_profile_pilot.mjs`; `node --check scripts/validate_place_profile_pilot.mjs`; `node scripts/validate_place_profile_pilot.mjs` |
| AC-008 | 생성 보고서와 manifest 집계 교차검증 | `review_report.md`, `manifest.json` |
| AC-009 | Git diff와 원본 SHA-256 확인 | `git diff -- data/tourapi/jeju map-ui`; 원본 manifest |

검증 결과(2026-08-09):

- 생성기와 검증기 `node --check` 통과
- `node scripts/build_place_profile_pilot.mjs` 및 `node scripts/validate_place_profile_pilot.mjs` 통과: 100건, 유형 `68/12/4/16`, 직접 출처 10건, companion `null` 157개, month `null` 48개
- 같은 입력으로 재생성한 `place_profiles.json`, `manifest.json`, `review_report.md`의 SHA-256이 실행 전후 동일
- 기존 수집기 `py_compile`, 분리·지도 생성기와 지도 앱의 JavaScript 구문 검사 통과
- `git diff --check` 통과, `data/tourapi/jeju`와 `map-ui` 변경 없음, 원본 스냅샷 SHA-256 일치

## 구현 결과

- 관광지·문화시설·축제·레포츠 828건에서 유형 `68/12/4/16`, 지역 `53/47`로 100건을 고정 선정했다. 모든 유형별 `lclsSystm2` 그룹과 잘못된 좌표를 가진 `contentid=2704351`을 포함한다.
- `place_profiles.json`에 5개 companion 축, 12개월 적합도, 근거 속성, 출처, 신뢰도와 검수 상태를 기록했다. 100건 모두 `needs_human_review`다.
- 장소와 대응되는 공식·공공 상세 페이지는 10건에 연결했다. 일반 포털·검색 결과와 확인된 오연결 URL은 최종 근거에서 제거했다.
- companion 500개 중 157개를 `null`로 보류했다. `kids` 77건과 `parents` 80건으로, 연령·접근성·편의시설을 분류명만으로 단정하지 않기 위한 조치다.
- 축제 4건의 48개 월 값은 개최기간을 추측하지 않고 `null`로 두었다. 나머지 월별 값은 장소별 운영 여부가 아닌 상대적 계절 사전값이다.
- 생성기와 독립 검증기는 원본·선택·연구·보강 출처·출력 해시, 전체 manifest 통계, 값 스키마, 출처 대응, 보고서 100행, `month_fit=1`과 절정 월 일치를 검사한다.
- 원본 TourAPI 스냅샷, SPEC-002 분할 산출물, 지도 데이터·UI와 데이터베이스 구조는 변경하지 않았다.

## 설계와 달라진 점

- 저비용 웹 조사 결과의 대부분은 검색 결과 또는 일반 포털 수준이어서 직접 근거로 채택하지 않았다. 100건 전부에 웹 근거가 있다는 가정 대신, 검증된 10건만 `source_refs`에 남기고 90건을 명시적인 분류 사전값으로 처리했다.
- 취약 사례 감사에서 동굴, 레일바이크, 골프와 야외형 민속촌의 공통 분류 오차가 발견되어 별도 규칙을 추가했다. 만장굴·미천굴·제주레일바이크·블랙스톤 제주에는 후속 공식·공공 출처를 보강했다.
- 장소 상세 API를 통한 일괄 보강은 현재 실행 환경에서 인증 정보를 사용할 수 없어 수행하지 않았다. 이 파일럿은 웹 상세 페이지와 원본 기본 분류만 사용한다.

## 알려진 제한

- 이번 결과는 AI 보조 초안이며 사람 간 일치도를 측정한 골드셋이 아니다.
- 상세 API 인증키가 현재 저장소에 없어 공식 웹 페이지에서 찾지 못한 시설 정보는 누락될 수 있다.
- 장소별 상세·공식 출처 커버리지는 10%이며, 나머지 90건의 점수는 낮은 신뢰도 분류 사전값이다.
- 100건 모두 사람 검수 전이다. 특히 `kids`, `parents`, 계절 극단값은 사용자 검수 없이 추천 운영 점수로 사용하면 안 된다.
- 후속 [SPEC-007](spec_007.md)에서 숙박·쇼핑을 포함한 비음식점 1,434건으로 coverage를 확장했다. 이 확장은 품질 승격이나 사람 검수 완료를 뜻하지 않으며 기준 사례와 허용 오차는 여전히 독립 검수로 확정해야 한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-09 | 100건 표본, 라벨 정의, 근거 정책과 승인 기준 작성 |
| 2026-08-09 | 100건 AI 초안 생성·검증, 취약 사례 보강, 분포 보고서와 기준 문서 동기화 |
