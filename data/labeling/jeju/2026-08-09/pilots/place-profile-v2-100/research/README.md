# Place profile v2 웹 조사 배치 계약

이 폴더는 SPEC-005의 고정 100건을 장소별로 웹 조사한 원시 구조화 기록을 보관한다. v1 파일과 TourAPI 원본은 수정하지 않는다.

## 배치

- `web_pages.json`: 고정 100건의 K-TRIP TIPS 상세 페이지를 실제로 열어 추출한 제목, 본문 요약, 안내 항목, HTTP 상태와 페이지 SHA-256. 라벨 입력이 아니라 조사 원문 대조용 캐시다.
- `part_1.json`: v1 `place_profiles.json`의 인덱스 0~33, 34건
- `part_2.json`: 인덱스 34~66, 33건
- `part_3.json`: 인덱스 67~99, 33건

각 파일은 다음 형태다.

```json
{
  "schema_version": "place-web-research-v1",
  "batch_id": "part_1",
  "checked_at": "2026-08-10",
  "items": []
}
```

## 장소 레코드 필수 키

```text
contentid, title, research_status, identity_notes, checked_at,
summary, experience_tags, facts, sources, search_attempts, unknowns,
evidence_scores,
proposed_companion_fit, proposed_month_fit,
companion_rationale, month_rationale, confidence
```

`facts` 필수 키:

```text
environment, typical_visit, walking, stairs_slopes, stroller_wheelchair,
seating_restroom, kids, seniors, rain, wind, heat, cold, seasonality,
availability
```

`environment`는 `indoor`, `outdoor`, `mixed`, `unknown` 중 하나다. 나머지 사실은 한국어 요약 문자열 또는 `null`이다.

`evidence_scores` 필수 키:

```text
physical_effort, indoor_ratio, rain_sensitivity, wind_sensitivity,
heat_sensitivity, cold_sensitivity, seasonal_peak_months,
availability_separate
```

앞의 여섯 값은 허용 라벨 값, `seasonal_peak_months`는 1~12 정수 배열, `availability_separate`는 boolean이다. `seasonal_peak_months`는 `proposed_month_fit`이 정확히 `1`인 월과 같아야 한다.

`indoor_ratio`와 날씨 민감도는 페이지 사실과 분리한 명시적 환경 휴리스틱을 쓸 수 있다. 직접적인 비·바람·더위·추위 사실이 없으면 `indoor=0.25`, `mixed=0.5`, `outdoor=0.75`, `unknown=null`만 허용한다. 이는 실제 예보나 월 적합도가 아니라 노출도 초안이다. `physical_effort`는 보행 또는 계단·경사 사실이 있을 때만 수치를 둔다.

`sources[]` 필수 키:

```text
url, title, publisher, source_type, checked_at, claims
```

`source_type`은 `official_tourism`, `public_agency`, `official_operator`, `heritage`, `reputable_secondary` 중 하나다. `claims`는 해당 페이지를 직접 열어 확인한 사실의 한국어 요약 배열이다. 검색 결과 페이지와 검색 스니펫은 출처로 쓰지 않는다. 긴 원문이나 마케팅 문구를 복제하지 않는다.

`research_status`:

- `matched`: 제목·주소·유형으로 장소가 일치하고 열린 상세 페이지가 한 개 이상 있음
- `uncertain`: 관련 페이지를 열었지만 동명이인·지점·현재 상태가 불명확함
- `not_found`: 실제 검색을 수행했지만 사용할 상세 페이지를 찾지 못함

`search_attempts`에는 사용한 검색어 또는 열어 보았으나 제외한 URL과 이유를 짧게 기록한다. `matched`도 최소 한 개의 검색어를 기록한다.

현재 100건 공통 확인 페이지인 K-TRIP TIPS는 한국관광공사 정보를 재구성한 2차 관광 상세 자료이므로 `reputable_secondary`로 기록한다. 공식 운영자·공공기관 페이지로 오인해 표시하지 않으며, 운영시간·휴무·가격처럼 변하는 정보는 검수 시 원 출처를 다시 확인한다.

## 라벨 규칙

허용값은 `0`, `0.25`, `0.5`, `0.75`, `1`, `null`이다.

- companion 키: `solo`, `couple`, `friends`, `kids`, `parents`
- month 키: 문자열 `1`부터 `12`
- `companion_rationale`은 다섯 companion 키별 한국어 근거 문자열을 가진다.
- `month_rationale`은 평년·정상 운영을 전제로 한 계절 판단과 `null` 이유를 설명한다.
- `confidence`는 `identity`, `companion_fit`, `month_fit` 세 키를 가진다.
- 비 `null` 값은 `sources[].claims`, 구조화 사실 또는 명시적인 연중 중립 규칙으로 설명되어야 한다.
- 운영일·휴무·축제 개최월은 가용성 정보이며 month 점수로 바꾸지 않는다.
- 실제 예보를 month 점수에 넣지 않는다.
- 실외 장소는 본문에 계절 경험이나 연중 중립 근거가 없으면 `0.5`로 채우지 않고 전월 `null`로 둔다. `상시개방`과 `연중무휴`는 중립 근거가 아니라 가용성 정보다.
- 실내가 아닌 장소를 전월 `0.5`로 두려면 본문에 사계절·연중 경험 근거가 있어야 한다.
- companion은 활동의 존재만으로 자동 채우지 않는다. 혼자 안전수칙, 인원 정원, 가족·연인·친구 권장, 연령 제한처럼 해당 동행 축을 구체적으로 뒷받침하는 사실이 없으면 `null`로 둔다.
- 조사 근거가 없거나 충돌하면 관련 값을 `null`로 둔다.

## 조사 품질

- 공공·공식·운영자 상세 페이지를 먼저 찾는다.
- 가능하면 서로 독립적인 페이지 두 개를 연다.
- 운영시간·가격처럼 변하는 값은 단정하지 말고 확인일 기준 참고 정보로만 요약한다.
- 블로그, 지도 리뷰, 검색 결과 목록만으로 접근성·연령 적합도를 확정하지 않는다.
- 페이지가 장소 특성을 뒷받침하지 않으면 URL 수를 채우기 위해 남기지 않는다.
