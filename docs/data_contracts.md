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
