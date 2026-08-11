# SPEC-009: 제주 장소 24축 완전 숫자 라벨 데이터

- 상태: Implemented
- 작성일: 2026-08-11
- 최종 수정일: 2026-08-11
- 관련 이슈: 모든 대상 장소의 Theme·Environment·Style 라벨을 자동 규칙으로 숫자화해 추천 실험에 사용할 완전 벡터를 제공
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-007](spec_007.md), [SPEC-008](spec_008.md)
- 관련 코드: 없음 — 이번 변경은 데이터 산출물과 SPEC만 추가한다.
- 선행 SPEC: [SPEC-007](spec_007.md)

## 배경

원격 최신 데이터는 제주 비음식점 1,434건의 companion·월별 라벨을 제공하지만 Theme 8축, Environment 2축, Style 원자 8축, 파생 Style 6축으로 구성된 24축 완전 벡터는 제공하지 않는다. 추천 알고리즘 실험에서는 모든 대상 장소가 같은 차원의 숫자 벡터를 가져야 하므로, 기존 분류 근거로 부여된 값을 유지하고 비어 있던 축을 결정적 자동 규칙으로 채운 별도 데이터셋을 추가한다.

대상은 비음식점 1,434건과 음식점 분할 중 공식 신분류 `lclsSystm2=FD05`인 카페·찻집 230건이다. 일반 음식·주점 `FD01~FD04` 490건은 제외한다.

## 목표

- 대상 1,664곳 각각에 동일한 24개 라벨을 제공한다.
- 39,936개 라벨 값을 모두 `0`, `0.25`, `0.5`, `0.75`, `1` 중 하나로 저장한다.
- 기존 분류 근거로 채워진 3,470개 값과 사용자 확정값 4개를 유지하고 나머지 36,462개 값을 자동 완성한다.
- 장소, 라벨, 규칙, 근거 필드와 confidence를 레코드에서 추적할 수 있게 한다.
- 기존 분할 데이터와 SPEC-007 산출물은 수정하지 않는다.

## 비목표

- 일반 음식·주점 490건의 라벨링
- companion·월별 적합도 교체
- 추천 가중치, 랭킹, 경로 및 일정 최적화 구현
- 장소 통합 또는 중복 `contentid` 삭제
- 실시간 영업·휴무·날씨·가격 정보 반영

## 요구사항

- `REQ-901`: 입력 장소 순서는 `non_restaurants.json` 1,434건 다음 `restaurants.json`에서 `contenttypeid=39`, `lclsSystm2=FD05`인 230건의 원본 순서다.
- `REQ-902`: 각 장소는 Theme 8축, Environment 2축, Style evidence 8축, derived Style 6축의 총 24개 라벨을 가져야 한다.
- `REQ-903`: 모든 값은 `0/0.25/0.5/0.75/1` 중 하나이며 `null`은 허용하지 않는다.
- `REQ-904`: 기존 분류 근거가 있는 값과 provenance는 유지한다.
- `REQ-911`: 사용자 확정값 4개는 `status=reviewed`, `confidence=1`, 결정 일자와 고유 `rule_id`를 기록한다.
- `REQ-905`: 비어 있던 Theme는 해당 테마 일치 근거가 없으면 `0`으로 완성한다.
- `REQ-906`: 비어 있던 Environment와 Style evidence는 아래 content type 규칙을 사용하고, 분류가 없으면 `0.5`를 사용한다.
- `REQ-907`: 파생 Style은 완성된 원자값으로 계산하고 허용 점수 중 가장 가까운 값으로 반올림한다.
- `REQ-908`: 자동 완성 레코드는 `status=fallback`, `confidence=0.25`, C등급 evidence와 고유 `rule_id`를 가진다.
- `REQ-909`: manifest는 입력 분할과 출력 파일의 SHA-256, 바이트 수, 레코드 수를 기록한다.
- `REQ-910`: 데이터 파일과 SPEC 외 실행 코드·설정 파일은 이번 변경에 포함하지 않는다.

## 입력과 출력

입력:

```text
data/labeling/jeju/2026-08-09/manifest.json
data/labeling/jeju/2026-08-09/non_restaurants.json
data/labeling/jeju/2026-08-09/restaurants.json
```

출력:

```text
data/labeling/jeju/2026-08-09/place-preference-label-v2/
  place_labels.jsonl
  coverage_report.json
  fallback_report.json
  manifest.json
```

라벨 경로:

```text
theme.mountain
theme.ocean
theme.activity
theme.culture_history
theme.theme_park
theme.cafe
theme.traditional_market
theme.festival
environment.indoor_ratio
environment.weather_sensitivity
style_evidence.restfulness
style_evidence.physical_ease
style_evidence.visit_duration_flexibility
style_evidence.scenic_value
style_evidence.distinctiveness
style_evidence.local_embeddedness
style_evidence.landmark_significance
style_evidence.photo_value
derived_style.healing_slow
derived_style.scenic_immersion
derived_style.discovery_explorer
derived_style.local_immersion
derived_style.iconic_highlight
derived_style.photo_mood
```

## 설계

### 원자 라벨 자동 완성표

Theme 8축의 빈 값은 모두 `0`으로 채운다. Environment와 Style evidence는 `contenttypeid`별로 아래 값을 사용한다.

| contenttypeid | 유형 | indoor | weather | rest | ease | duration | scenic | distinct | local | landmark | photo |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 12 | 관광지 | 0.25 | 0.75 | 0.50 | 0.50 | 0.75 | 0.50 | 0.50 | 0.50 | 0.25 | 0.50 |
| 14 | 문화시설 | 0.75 | 0.25 | 0.50 | 0.75 | 0.75 | 0.25 | 0.50 | 0.50 | 0.25 | 0.50 |
| 15 | 축제·공연·행사 | 0.25 | 0.75 | 0.25 | 0.50 | 0.25 | 0.25 | 0.50 | 0.50 | 0.25 | 0.50 |
| 25 | 여행코스 | 0.25 | 0.75 | 0.50 | 0.50 | 0.50 | 0.50 | 0.50 | 0.50 | 0.25 | 0.50 |
| 28 | 레포츠 | 0.25 | 0.75 | 0.25 | 0.25 | 0.50 | 0.50 | 0.50 | 0.50 | 0.25 | 0.50 |
| 32 | 숙박 | 0.75 | 0.25 | 0.75 | 0.75 | 0.75 | 0.25 | 0.50 | 0.50 | 0.25 | 0.25 |
| 38 | 쇼핑 | 0.75 | 0.25 | 0.50 | 0.75 | 0.75 | 0.25 | 0.50 | 0.50 | 0.25 | 0.50 |
| 39/FD05 | 카페·찻집 | 0.75 | 0.25 | 0.75 | 0.75 | 0.75 | 0.25 | 0.50 | 0.50 | 0.25 | 0.50 |

### 파생 Style

- `healing_slow = 0.4×restfulness + 0.3×physical_ease + 0.3×visit_duration_flexibility`
- `scenic_immersion = scenic_value`
- `discovery_explorer = 0.5`
- `local_immersion = local_embeddedness`
- `iconic_highlight = landmark_significance`
- `photo_mood = photo_value`

계산 결과는 `0/0.25/0.5/0.75/1` 중 가장 가까운 값으로 반올림한다. 동률이면 큰 값을 선택한다.

## 예외와 폴백

- 입력 `contentid`가 중복되거나 대상 수가 1,664건이 아니면 데이터셋을 유효한 완성본으로 취급하지 않는다.
- 장소에 알려진 `contenttypeid`가 없으면 Theme은 `0`, 나머지 원자 라벨은 `0.5`를 사용한다.
- 기존 값은 자동 완성값으로 덮어쓰지 않는다.
- 출력 값, 라벨 수, 파일 해시가 manifest와 다르면 사용을 중단한다.

## 영향 범위

- 변경 파일: 신규 `place-preference-label-v2` 데이터 4개, `docs/spec_009.md`, `docs/README.md`
- 데이터 마이그레이션: 없음. 기존 데이터와 병렬로 추가한다.
- 호환성 영향: 기존 소비자는 변경되지 않는다. 신규 소비자는 `label_version=place-preference-label-v2`를 명시적으로 선택한다.
- 보안·개인정보 영향: 외부 API 호출, 비밀키, 사용자 개인정보를 포함하지 않는다.

## 승인 기준

- `AC-901`: 장소 1,664건이 고유 `contentid`를 갖고 입력 순서를 유지한다.
- `AC-902`: 각 장소가 24개 라벨을 가져 총 39,936개 값이 존재한다.
- `AC-903`: `null`이 0개이며 모든 값이 허용 점수다.
- `AC-904`: 기존 값 3,470개, 사용자 확정값 4개, 자동 완성값 36,462개의 합이 39,936개다.
- `AC-905`: 자동 완성 레코드가 status, confidence, rule ID, evidence 계약을 만족한다.
- `AC-906`: manifest의 입력·출력 해시와 실제 파일이 일치한다.
- `AC-907`: 커밋에는 데이터, SPEC, SPEC 색인 변경만 포함된다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-901~AC-905 | JSONL 전수 파싱, 장소·라벨·값·provenance 집계 | PowerShell에서 Node 인라인 검증 |
| AC-906 | SHA-256, bytes, records 재계산 | `Get-FileHash`, Node 인라인 검증 |
| AC-907 | staged 파일 범위와 whitespace 검사 | `git diff --cached --name-only`, `git diff --check` |

## 구현 결과

- `place_labels.jsonl`: 1,664건. 정확한 bytes와 SHA-256은 같은 디렉터리의 `manifest.json`에 기록한다.
- 총 라벨: 39,936개
- 기존값: 3,470개
- 사용자 확정값: 4개
- 자동 완성값: 36,462개
- null: 0개
- 라벨당 허용 점수 위반: 0개
- 중복 `contentid`: 0개

## 설계와 달라진 점

실행 코드와 별도 설정 파일은 포함하지 않고, 자동 완성 규칙을 이 SPEC에 고정했다. manifest는 원격 저장소에 존재하는 분할 manifest와 두 입력 JSON만 참조한다.

## 알려진 제한

- 자동 완성값은 장소 유형 공통 규칙을 사용하므로 같은 유형 안의 세부 차이는 별도 근거값만큼 세밀하게 표현하지 않는다.
- 실시간 운영 여부와 날짜별 이용 가능성은 이 데이터의 라벨 범위가 아니다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-11 | 1,664곳 × 24축 완전 숫자 라벨 데이터와 자동 완성 규칙 확정 |
