# SPEC-006: 웹 조사 기반 AI 자동 가중치 완성과 저노력 검수

- 상태: Implemented
- 작성일: 2026-08-10
- 최종 수정일: 2026-08-10
- 관련 이슈: 사용자가 직접 새 라벨을 채우지 않고 AI 제안을 검수만 하도록 개선
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-005](spec_005.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/`, `scripts/build_place_profile_autolabel_v3.mjs`, `labeling-review/`
- 선행 SPEC: [SPEC-005](spec_005.md)

## 배경

SPEC-005는 100개 장소를 웹에서 조사하고 근거 없는 값을 `null`로 보수화했다. 사실 품질은 높아졌지만 companion 500축 중 44축, month 1,200축 중 165축만 값이 남아 사용자가 대부분을 직접 라벨링해야 한다. 이는 “AI 초안을 사람이 빠르게 검수한다”는 화면 목적과 맞지 않는다. 또한 v2 month의 수치 165축에는 실제 계절 직접 근거뿐 아니라 실내 연중 중립과 계절 문장에서 언급되지 않은 월의 규칙값이 섞여 있으므로, v3에서는 165축 전체를 직접 근거로 승격하지 않고 실제 계절 문장에 매핑되는 21축만 보존한다. 누락됐던 개오리오름 겨울 3축을 더해 v3의 직접 계절 축은 24개다.

웹 조사에 직접 적힌 동행·계절 단서만으로 모든 축을 채울 수는 없다. 이번 버전은 직접 근거와 추론을 숨기지 않고 구분하면서 장소 경험, 활동 강도, 공간 노출, 장소 유형과 버전이 고정된 제주 월별 기후 기준을 이용해 AI 기본값을 완성한다. 사람은 낮은 신뢰도와 예외를 우선 검수한다.

## 목표

- companion 5축 500개에 모두 AI 제안값을 만든다.
- 축제 네 건의 날짜 종속 month 48축만 명시적 `N/A(null)`로 제외하고, 나머지 96건의 1,152개 month 축을 모두 채운다.
- 각 값에 직접 근거, 조사 사실 추론, 장소 유형 사전값, 기후 휴리스틱 중 사용한 근거 수준과 한국어 설명을 연결한다.
- 검수 화면에서 AI 제안값이 기본 선택으로 보이고 사용자는 수정이 필요한 값만 바꾼다.
- 높은 위험 장소만 개별 검수하고, 낮은·중간 위험 장소는 우선순위별 명시적 확인으로 일괄 승인할 수 있다.
- 기존 TourAPI, 데이터베이스, 지도, v1·v2 산출물은 수정하지 않는다.

## 비목표

- 실시간 예보, 당일 운영 여부 또는 가격 보장
- 자동 제안을 사람 검수 완료나 운영용 골드 라벨로 선언
- 사용자 개인 취향을 반영한 최종 추천 랭킹
- 축제 개최월을 평년 날씨 적합도 점수로 위장
- 100건 밖의 나머지 장소 자동 라벨링

## 요구사항

- `REQ-001`: v3 입력은 SPEC-005의 최종 100건 조사 레코드와 동일한 ID·순서를 사용하고 v1·v2 파일을 변경하지 않아야 한다.
- `REQ-002`: companion은 `solo`, `couple`, `friends`, `kids`, `parents` 500축 전부 `0`, `0.25`, `0.5`, `0.75`, `1` 중 하나를 가져야 한다.
- `REQ-003`: 축제가 아닌 96건의 month 1,152축은 전부 수치여야 한다. 축제 네 건은 48축 모두 `null`이고 `date_gated_not_applicable` 이유를 가져 검수 누락과 구분해야 한다.
- `REQ-004`: 추론 우선순위는 `direct_evidence > researched_inference > archetype_prior > climate_heuristic`이다. 더 강한 근거가 있으면 일반 사전값을 덮는다.
- `REQ-005`: 각 companion 축과 month 프로필은 값, 근거 수준, confidence, 한국어 rationale을 가져야 한다. 사전값·기후 추론을 웹 직접 근거처럼 표현하지 않는다.
- `REQ-006`: companion 사전값은 대표 경험, 활동 참여 방식, 체력 부담, 혼자 안전 마찰, 공유 경험, 아이 흥미·제약, 부모님 보행·휴식 마찰을 사용한다. 필수 연령·신장·예약·안전 조건은 점수와 별도 제약으로 남긴다.
- `REQ-007`: month 사전값은 버전이 고정된 제주 기후 평년 기준과 장소 archetype, 실내 비율, 비·바람·더위·추위 민감도, 명시 계절 절정을 사용한다. 공식 기상청 제주·고산·성산·서귀포 1991~2020 월표, 우리나라 영향 태풍 월평년, 제품용 월 벡터는 별도 고정 input fixture와 canonical SHA-256으로 보존하고 빌드는 이 입력에서 `climate_baseline.json`과 `scoring/month_profiles.json`을 파생한다. 실제 예보·영업시간·휴무는 사용하지 않는다.
- `REQ-008`: 값 `1`은 대표적인 강점 또는 명시 계절 절정, `0`은 핵심 경험 불가능에만 사용한다. 근거 없는 극단값은 금지한다.
- `REQ-009`: 각 장소는 `low`, `medium`, `high` 검수 우선순위와 이유를 가진다. 낮은 confidence, hard constraint, 조사 충돌, 장거리·고강도, 아이·부모님 추론은 우선순위를 높인다.
- `REQ-010`: 검수 UI는 v3 제안값, 근거 수준과 우선순위를 표시하고 `low`와 `medium`을 서로 분리된 명시적 확인 모달 뒤 일괄 `approved_as_is`로 바꿀 수 있어야 한다. `high`, 이미 편집했거나 처리된 항목은 일괄 승인할 수 없고 자동으로 승인 상태를 만들면 안 된다.
- `REQ-011`: 축제 month의 `N/A`는 사람이 채워야 할 미정으로 집계하거나 필터링하지 않는다.
- `REQ-012`: v3 프로필·기후 기준·자동 라벨 메타데이터를 포함한 기준 SHA-256으로 v1·v2 검수 상태와 저장 키를 분리한다.

## 입력과 출력

직접 빌드 입력:

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v2-100/place_profiles.json
data/labeling/jeju/2026-08-09/pilots/place-profile-v2-100/place_web_research.json
data/labeling/jeju/2026-08-09/pilots/place-profile-v2-100/manifest.json
data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/scoring/assignments_part_1.json
data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/scoring/assignments_part_2.json
data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/scoring/assignments_part_3.json
data/climate/kma/1991-2020/jeju_four_station_monthly_normals.json
```

검증용 상위 원천:

```text
data/tourapi/jeju/2026-08-09/jeju_places.json
```

출력:

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/
  climate_baseline.json
  scoring/archetype_assignments.json
  scoring/companion_profiles.json
  scoring/month_profiles.json
  auto_label_proposals.json
  place_profiles.json
  manifest.json
  review_report.md
labeling-review/index.html
```

자동 라벨 메타데이터의 논리 구조:

```text
AutoLabelProposal {
  contentid: string
  title: string
  algorithm_version: string
  companion_archetype: string
  month_archetype: string
  flags: string[]
  assignment_rationale: string
  companion_fit: map<CompanionKey, AxisProposal>
  month_fit: map<MonthKey, AxisProposal>
  hard_constraints: HardConstraint[]
  review_priority: low | medium | high
  review_reasons: string[]
}

AxisProposal {
  value: 0 | 0.25 | 0.5 | 0.75 | 1 | null
  confidence: 0 | 0.25 | 0.5 | 0.75 | 1 | null
  inference_level: direct_evidence | researched_inference |
                   archetype_prior | climate_heuristic | not_applicable
  rationale: string
  evidence_ids: string[]
  rule_ids: string[]
  null_reason?: date_gated_not_applicable
}

HardConstraint {
  kind: string
  applies_to: string
  condition: string
  status: confirmed | unknown | stale
  action: exclude | verify
  source: string
  checked_at: date
  rule_id: string
}
```

## 설계

```text
v2 웹 조사 100건 + 제주 기후 기준
                |
                v
       장소 archetype 지정
                |
                v
 companion profile + month profile
                |
                v
 직접 근거·계절 근거·제약 override
                |
                v
 auto_label_proposals.json
                |
                v
 v3 place_profiles + manifest + report
                |
                v
 우선순위 기반 검수 HTML
```

기본값은 임의의 중립값이 아니라 명시적 archetype 규칙이다. UI에는 최종 숫자뿐 아니라 이 값이 직접 조사인지 사전 추론인지 표시한다. `low`·`medium` 일괄 승인은 서로 분리된 사용자의 확인 동작이며 원본 AI 데이터는 변경하지 않고 사람 검수 sidecar 상태만 갱신한다. `high`는 개별 검수만 허용한다.

## 예외와 폴백

- 장소 식별이 `matched`가 아니면 자동 라벨을 만들지 않고 `high` 우선순위로 둔다.
- archetype을 하나로 정하기 어려우면 대표 경험 기준 한 개를 선택하고 보조 경험과 불확실성을 review reason에 남긴다.
- 조사 사실과 사전값이 충돌하면 조사 사실을 우선하고 `high` 또는 `medium`으로 올린다.
- 축제 month는 개최월과 관계없이 date-gated `N/A`로 유지하고 별도 가용성 필터 대상으로 남긴다.
- 공식 기후 기준을 읽거나 검증하지 못하면 month 산출물을 만들지 않고 빌드를 실패시킨다.

## 영향 범위

- 변경 예정 파일: `docs/spec_006.md`, `docs/README.md`, `docs/data_contracts.md`, `docs/architecture.md`, v3 데이터·생성·검증 스크립트, `labeling-review/`
- 데이터 마이그레이션: 없음. v3 sidecar를 추가한다.
- 호환성 영향: v3 기준 SHA가 달라 기존 v1·v2 브라우저 검수 상태는 자동 이관하지 않는다.
- 보안·개인정보 영향: 공개 장소 정보와 공개 기후 자료만 사용한다.

## 승인 기준

- `AC-001`: v3가 v2와 같은 100개 ID·순서를 유지하고 보호 경로를 변경하지 않는다.
- `AC-002`: companion 500/500이 수치이고 축제 외 month 1,152/1,152가 수치이며 축제 month 48/48만 명시적 N/A다.
- `AC-003`: 1,700축 모두 rationale·inference level·confidence를 가지며 수치와 설명이 일치한다.
- `AC-004`: 고정 기후 input fixture가 공식 출처 URL·확인일·표 위치·원문 PDF SHA-256·canonical SHA-256을 기록한다. 기후 baseline 파일은 fixture에서 파생한 출처·기준기간·월 특성을 기록하고, manifest는 fixture와 산출물의 경로·파일 해시·canonical hash·기간·출처·scoring version을 고정한다.
- `AC-005`: validator가 fixture canonical hash, 12개월의 4지점 평균기온·강수량·평균풍속·우리나라 영향 태풍, 6~9월 평균 일최고기온·상대습도, `outdoor_comfort`와 모든 month archetype 벡터를 산출물과 전수 대조한다. 극단값, 직접 근거 override, hard constraint, 축제 N/A, review priority 규칙도 자동 검증된다.
- `AC-006`: UI가 AI 제안, 추론 수준, 우선순위를 표시하며 축제 N/A를 미정 작업으로 세지 않는다.
- `AC-007`: 사용자가 우선순위별로 확인한 뒤 미편집 `low` 또는 `medium`만 일괄 승인된다. `high`, 작성 중·처리 완료 항목은 바뀌지 않으며 초기화로 되돌릴 수 있다.
- `AC-008`: 같은 입력으로 v3 산출물과 HTML을 재생성하면 바이트 단위로 같다.
- `AC-009`: 기존 v1·v2·TourAPI·지도·데이터베이스는 변경되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001~AC-005 | ID·coverage·근거·고정 fixture 및 기후·월 벡터 전수대조·제약·우선순위 검증 | `node scripts/validate_place_profile_autolabel_v3.mjs` |
| AC-006~AC-007 | 생성 HTML과 review model 회귀 테스트 | `node scripts/validate_labeling_review_ui.mjs`, `node scripts/test_labeling_review_model.mjs` |
| AC-008 | v3와 HTML 재빌드 SHA 비교 | 빌드 2회 |
| AC-009 | TourAPI·지도·v1 Git 상태와 v2 manifest 해시·TourAPI 실제 원본 해시 검사 | `git status --short -- data/tourapi/jeju map-ui data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100`, `node scripts/validate_place_profile_autolabel_v3.mjs` |

## 구현 결과

- v2와 같은 100개 장소·순서를 사용하는 `place-profile-pilot-v3-auto` sidecar를 생성했다. companion 500축과 비축제 month 1,152축은 모두 수치이며 축제 4건의 month 48축만 날짜 종속 `N/A`다.
- companion은 v2 직접 근거 43축 유지와 최소 2인 조건 1축 신규를 합쳐 직접 근거 44축·보완 추론 456축이다. 비축제 month는 직접 계절 근거 24축·보완 추론 1,128축이다. 직접 근거가 아닌 값에서 `0` 또는 `1`인 축은 없다.
- 검수 우선순위는 `low` 18건, `medium` 66건, `high` 16건이다. UI에서 낮음과 중간을 각각 확인 후 일괄 승인할 수 있고 높음은 개별 검수만 가능하다.
- 모든 축에 값·confidence·추론 수준·한국어 rationale·근거 ID·규칙 ID를 기록했다. 예약·연령·인원·운영·기상·안전 조건은 적용 경험이 명시된 `hard_constraints.applies_to`로 점수와 분리했다.
- v3 프로필·자동 제안·기후 기준·웹 조사·UI 버전을 합성한 `review_base_sha256`으로 브라우저 저장과 가져오기를 격리했다. 검수 결과는 데이터베이스가 아니라 `place-profile-human-review-v2` JSON sidecar로만 내보낸다.
- 생성기·검증기·검수 UI 모델 테스트를 통과했고 동일 입력 재생성 시 v3 핵심 산출물과 단일 HTML이 바이트 단위로 동일함을 확인했다.

## 설계와 달라진 점

- v2의 수치 month 165축 전체를 직접 근거로 유지하려던 초기 해석을 수정했다. 그중 실제 계절 문장과 대응하는 21축만 직접 근거로 보존하고, v2에 누락됐던 개오리오름 겨울 3축을 더해 v3 직접 month를 24축으로 확정했다. 실내·연중 중립이나 계절 문장에 없는 월은 사전값 또는 기후 휴리스틱으로 provenance를 낮췄다.
- 복합 장소의 선택 활동이 전체 경험을 과도하게 낮추지 않도록 장소별 deterministic assignment와 적용 범위가 있는 제약 예외를 추가했다.
- 사용자의 검수량을 줄이기 위해 `low`뿐 아니라 `medium`도 별도 확인 모달에서 일괄 승인할 수 있게 했다. `high`와 이미 편집하거나 처리한 항목은 계속 개별 검수만 허용한다.

## 알려진 제한

- AI 자동값은 사람 검수 전 초안이며 개인 취향·당일 날씨·실제 운영 여부를 반영하지 않는다.
- 월 기본값은 기상청 저지대 4지점의 1991~2020 평년을 제품 규칙으로 해석한 값이다. 고지대 미기후와 특정 여행일의 예보·특보를 대신하지 않는다.
- 기상청 4지점 월표와 태풍 월평년, 제품용 월 벡터를 별도 고정 fixture로 분리했다. 빌드는 fixture의 canonical hash를 먼저 검증한 뒤 기후 평균과 month profile을 파생하며 validator는 관련 모든 월·벡터를 독립 계산해 전수 대조한다.
- 2026-08-10 `node scripts/validate_place_profile_autolabel_v3.mjs`가 4지점·12개월 기후 4종, 6~9월 보조 2종, outdoor 12축, month profile 9개 벡터와 TourAPI 원본 SHA를 포함한 검증을 통과했다. 같은 입력으로 빌드를 연속 두 번 실행해 관련 v3 산출물 해시가 동일함을 확인했다.
- 장소별 공통 웹 근거는 공개 2차 관광 상세 페이지이므로 변동 가능한 운영 정보와 `high` 16건의 안전·접근 조건은 개별 확인이 필요하다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-10 | 사용자 요청에 따라 AI가 대부분의 가중치를 채우고 사람은 예외만 검수하는 v3 범위 승인 |
| 2026-08-10 | 100건 자동 가중치 sidecar, 기후 기준, 검증기와 저노력 검수 UI 구현 및 SPEC 동기화 |
| 2026-08-10 | 공식 KMA 월표를 canonical hash 고정 fixture로 분리하고 기후·월 벡터 파생 및 전수 대조 계약 추가 |
