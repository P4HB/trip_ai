# SPEC-004: 장소 프로필 100건 사람 검수 HTML

- 상태: Implemented
- 작성일: 2026-08-10
- 최종 수정일: 2026-08-10
- 관련 이슈: 사용자 요청
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [데이터 계약](data_contracts.md), [SPEC-003](spec_003.md)
- 관련 코드: `labeling-review/`, `scripts/build_labeling_review_ui.mjs`, `scripts/validate_labeling_review_ui.mjs`, `scripts/test_labeling_review_model.mjs`
- 선행 SPEC: [SPEC-003](spec_003.md)

## 배경

SPEC-003의 100건 companion·월별 적합도는 모두 사람 검수 전 AI 초안이다. 현재 JSON과 Markdown 보고서는 전체 분포를 확인할 수 있지만, 비전문 사용자가 장소를 한 건씩 살펴보고 값을 수정하거나 코멘트를 남기기에는 불편하다.

검수 입력은 AI 원본이나 TourAPI 데이터를 덮어쓰지 않고 별도 사람 검수 sidecar로 관리해야 한다. 서버와 데이터베이스는 현재 범위에 없으므로 브라우저의 로컬 저장소와 JSON 파일 내보내기·불러오기를 사용한다.

## 목표

- 100건을 한 장소씩 탐색하며 companion 5축, month 12축과 장소 코멘트를 검수할 수 있는 보기 좋은 정적 HTML을 제공한다.
- AI 기준값, 사람 입력과 최종 적용값을 구분하고 변경된 축을 명확히 표시한다.
- 입력을 현재 브라우저에 자동 저장하고 검수 결과를 재현 가능한 JSON sidecar로 내보낸다.
- 검색, 상태·유형·근거 품질 필터와 진행률로 100건 검수 작업을 관리한다.
- 로컬 파일 하나만 열어도 핵심 기능이 동작하도록 외부 JavaScript·CSS 의존성 없는 `index.html`을 생성한다.

## 비목표

- 사용자 입력을 서버나 원격 데이터베이스로 자동 전송
- AI 원본 `place_profiles.json`, TourAPI 원본 또는 지도 데이터 수정
- 검수 결과를 운영용 골드 라벨에 자동 반영
- 계정, 로그인, 다중 사용자 동시 편집과 충돌 해결
- 장소 지도, 추천·랭킹 또는 일정 기능
- 외부 호스팅과 공개 배포

## 요구사항

- `REQ-001`: 입력은 SPEC-003의 `place_profiles.json`, pilot `manifest.json`과 동일 스냅샷의 `jeju_places.json`이어야 한다.
- `REQ-002`: 생성된 `labeling-review/index.html`은 정확히 100건을 원본 순서로 내장하고 외부 JavaScript·CSS·데이터 fetch 없이 열려야 한다.
- `REQ-003`: 장소 목록은 장소명·`contentid` 검색과 유형, 사람 검수 상태, 직접 출처 없음, companion `null`, month `null`, 사용자 변경 여부 필터를 AND 방식으로 제공해야 한다.
- `REQ-004`: 장소 상세는 이미지 또는 폴백, 주소, 유형·지역·신분류, AI 신뢰도, 제한사항, 판단 근거와 안전한 출처 링크를 보여줘야 한다.
- `REQ-005`: companion은 `solo`, `couple`, `friends`, `kids`, `parents`, month는 문자열 키 `1`부터 `12`까지 편집할 수 있어야 한다.
- `REQ-006`: 허용 값은 `0`, `0.25`, `0.5`, `0.75`, `1`, 명시적 `null`뿐이며, AI 값 유지와 `null` 입력을 구분해야 한다.
- `REQ-007`: AI 원본 객체는 변경하지 않고 사람 입력은 AI 값과 다른 축의 override만 저장해야 한다. AI 값으로 되돌리면 해당 override를 제거한다.
- `REQ-008`: 사람 검수 상태는 `unreviewed`, `in_progress`, `approved_as_is`, `approved_with_changes`, `needs_research`, `skipped`를 사용해야 하며 AI의 `label_meta.review_status`와 분리해야 한다.
- `REQ-009`: 장소별 2,000자 이하 코멘트를 입력할 수 있어야 한다. `needs_research`와 `skipped` 완료에는 코멘트가 필요하다.
- `REQ-010`: 입력 변경은 데이터 지문을 포함한 전용 `localStorage` 키에 자동 저장하되 저장 실패 시 작업을 중단하지 않고 경고와 JSON 내보내기 수단을 제공해야 한다.
- `REQ-011`: 내보내기는 `place-profile-human-review-v1` JSON으로 원본 100건 순서, 기준 프로필 SHA-256, 상태, override, 코멘트와 시간 정보를 포함해야 한다.
- `REQ-012`: 가져오기는 5 MiB 이하의 내보내기 완료 파일만 대상으로 스키마·UI 버전, 기준 정보 전체, 정확한 ID·제목 집합과 순서, 중복, 세션·상태별 시각, 허용 키·값·상태, override 기준값·무효 변경과 코멘트 길이를 모두 확인한 뒤 전체 상태를 원자적으로 교체해야 한다.
- `REQ-013`: 사용자 및 데이터 문자열은 안전한 DOM API로 렌더링하고 외부 링크와 이미지 URL은 HTTP(S)만 허용해야 한다.
- `REQ-014`: 데스크톱 2단 레이아웃과 모바일 목록 패널을 제공하며 키보드 포커스, native form control, 44px 이상 터치 영역, 색 이외 상태 표현과 `prefers-reduced-motion`을 지원해야 한다.
- `REQ-015`: 전체 초기화는 현재 데이터셋의 로컬 저장 키만 확인 후 삭제해야 한다.

## 입력과 출력

빌드 입력:

```text
data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100/place_profiles.json
data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100/manifest.json
data/tourapi/jeju/2026-08-09/jeju_places.json
labeling-review/src/index.template.html
labeling-review/src/styles.css
labeling-review/src/review-model.js
labeling-review/src/app.js
```

생성 출력:

```text
labeling-review/index.html
```

브라우저 내보내기 계약:

```text
PlaceProfileHumanReviewBundle {
  schema_version: "place-profile-human-review-v1"
  base: {
    label_version: "place-profile-pilot-v1"
    profile_path: string
    profile_sha256: string
    profile_count: 100
  }
  session: {
    session_id: string
    ui_version: "place-profile-review-ui-v1"
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

`LabelValue = 0 | 0.25 | 0.5 | 0.75 | 1 | null`이다. override가 없으면 AI 값을 그대로 적용한다. `approved_with_changes`의 override만 승인된 사람 라벨이며, `needs_research`와 `skipped`에 남은 override는 검수 화면에서 보존하는 제안일 뿐 후속 적용 대상이 아니다.

브라우저 내부 자동 저장본에서는 `session.exported_at`이 `null`일 수 있다. `결과 내보내기`로 생성되는 공유 파일은 이 필드가 ISO 8601 시각이어야 하며, 가져오기도 내보내기가 완료된 파일만 허용한다. 내보내기는 `exported_at`만 설정하고 마지막 실제 편집 시각인 `updated_at`은 바꾸지 않는다.

`session_id`는 비어 있지 않은 최대 128자 문자열이다. `unreviewed`에는 override·코멘트·검수 시각이 없어야 하고, `in_progress`에는 `started_at`·`updated_at`만 있어야 한다. `approved_as_is`, `approved_with_changes`, `needs_research`, `skipped`에는 `completed_at`까지 있어야 한다.

## 설계

```text
SPEC-003 place_profiles + TourAPI 표시 필드 + manifest hash
                         |
                         v
scripts/build_labeling_review_ui.mjs
                         |
                         v
labeling-review/index.html
  - 100건 내장 데이터
  - 목록·필터·검수 폼
  - localStorage 자동 저장
  - 검수 JSON import/export
```

- 데스크톱은 320px 안팎의 왼쪽 목록과 오른쪽 검수 폼을 사용한다. 모바일에서는 목록을 패널로 연다.
- 목록은 표본 순서를 유지하고 상태, 유형, 근거 품질과 변경 개수를 표시한다.
- AI 값은 기준값으로 표시하고 사용자 선택이 다를 때만 override와 `AI → 내 값` 차이를 만든다.
- companion은 native radio 기반 segmented control, month는 12개 native select 카드로 제공한다.
- 값이나 코멘트를 처음 변경하면 `in_progress`가 된다. 완료 동작은 override가 없으면 `approved_as_is`, 있으면 `approved_with_changes`로 정한다.
- `needs_research`와 `skipped`는 별도 처리 상태이며 완료 진행률과 상태별 수치를 함께 표시한다.
- 축제에는 month 값이 개최기간이나 실제 운영 여부가 아니라는 경고를 고정 표시한다.
- 모든 100건의 사람 검수 상태를 내보내되 원본 데이터는 복제하지 않고 override와 제목 스냅샷만 기록한다.

## 예외와 폴백

- 이미지가 없거나 로드에 실패하면 유형별 텍스트 폴백을 표시한다.
- `localStorage`를 사용할 수 없거나 용량 오류가 나면 메모리 상태를 유지하고 상단에 JSON 내보내기 경고를 표시한다.
- 손상된 로컬 저장값은 적용하지 않고 새 세션으로 시작한다.
- 다른 데이터 지문이나 잘못된 import 파일은 기존 상태를 바꾸지 않고 오류를 보여준다.
- 검색·필터 결과가 없으면 필터 초기화 동작을 제공한다.
- 직접 출처가 없으면 출처 없음과 낮은 신뢰도를 숨기지 않는다.
- 외부 URL이 HTTP(S)가 아니면 링크나 이미지로 사용하지 않는다.

## 영향 범위

- 변경 예정 파일: `docs/spec_004.md`, `docs/README.md`, `docs/architecture.md`, `docs/data_contracts.md`, `labeling-review/`, 생성·검증 스크립트
- 데이터 마이그레이션: 없음
- 호환성 영향: 원본 수집기, SPEC-002 분할 데이터, SPEC-003 프로필과 지도 UI에 영향 없음
- 보안·개인정보 영향: 사용자 코멘트는 브라우저와 다운로드 파일에만 존재한다. 민감한 개인정보를 코멘트에 적지 않도록 안내한다.

## 승인 기준

- `AC-001`: 생성 HTML의 내장 데이터가 원본 프로필 100건과 ID·순서·AI 라벨·기준 SHA-256까지 일치한다.
- `AC-002`: HTML이 외부 스크립트·스타일·fetch 없이 동작하고 데이터 블록의 종료 태그·특수 문자가 안전하게 이스케이프된다.
- `AC-003`: 목록, 검색과 모든 필터가 함께 동작하며 초기 유형 `68/12/4/16`, companion null 장소 80건, month null 장소 4건이 일치한다.
- `AC-004`: 5개 companion과 12개월 입력이 허용값과 AI 값 유지·명시적 `null`을 구분한다.
- `AC-005`: 변경, AI 값 복원, 코멘트와 여섯 사람 검수 상태가 진행률·변경 표시와 일관된다.
- `AC-006`: 정상 localStorage 저장·복원과 저장 실패 폴백이 앱 전체를 중단시키지 않는다.
- `AC-007`: export 후 import한 검수 상태가 export 시각을 제외하고 동일하며 잘못된 import는 기존 상태를 변경하지 않는다.
- `AC-008`: 데이터 문자열에 위험한 HTML이 있어도 실행되지 않고, 위험 DOM sink와 비 HTTP(S) 외부 URL을 사용하지 않는다.
- `AC-009`: 키보드와 모바일에서도 장소 선택, 라벨 입력, 상태 처리와 내보내기에 접근할 수 있다.
- `AC-010`: 원본 TourAPI·SPEC-003 프로필·지도 산출물은 변경되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001~AC-004 | 생성 HTML과 원본 JSON 교차검증 | `node scripts/validate_labeling_review_ui.mjs` |
| AC-005~AC-008 | 순수 상태 모델의 round-trip·오류 fixture 검사 | `node scripts/test_labeling_review_model.mjs` |
| AC-009 | semantic HTML, focus·반응형 규칙 정적 검사 | `node scripts/validate_labeling_review_ui.mjs` |
| AC-010 | 기존 산출물 상태와 구문 검사 | `git status --short -- data/tourapi/jeju map-ui data/labeling/jeju/2026-08-09/pilots/place-profile-v1-100`; 기존 검증 명령 |

## 구현 결과

- `labeling-review/index.html`에 100건의 AI 초안, CSS와 검수 애플리케이션을 모두 내장했다. 파일 하나를 직접 열어 검색·필터·라벨 편집·코멘트·상태 처리·JSON import/export를 사용할 수 있다.
- 데스크톱 2단 화면과 모바일 목록 패널, native form control, 키보드 단축키, 포커스 표시와 저장 상태 안내를 구현했다.
- 필터 결과가 없으면 검수 폼도 비우고, 완료 후 다음 장소는 현재 필터 범위의 미완료 항목에서만 선택한다. 편집 때문에 현재 장소가 상태·값 필터에서 빠질 때는 해당 동적 필터를 명시적으로 해제해 같은 장소를 계속 편집한다.
- 장소 신분류 3단계와 환경·체력 부담·실내 비율·날씨 민감도·계절 절정·가용성 분리 여부를 구조화 근거로 표시한다.
- 원본 프로필 SHA-256 `992fcad1b9b1b212da20ab78a21e8264a68d6a9b126e23d8d16b564f4d9f9b1b`를 데이터셋과 localStorage·내보내기 계약의 결합 키로 사용한다.
- 내장 데이터는 100건이며 유형 분포는 관광지 68, 문화시설 12, 축제 4, 레포츠 16이다. 직접 출처가 있는 장소는 10건, companion `null`이 있는 장소는 80건, month `null`이 있는 장소는 4건이다.
- 상태 모델 테스트 10개 그룹과 잘못된 import 12종을 통과했다. 생성 HTML은 346,493바이트이고 외부 스크립트·스타일·데이터 fetch와 위험 DOM sink가 없음을 정적으로 확인했다.
- 원본 TourAPI, SPEC-003 프로필과 지도 산출물은 변경하지 않았다.

## 설계와 달라진 점

- 축별 코멘트 대신 장소당 코멘트 하나를 사용했다. 17개 라벨을 빠르게 검수하는 파일럿 범위에서 입력 부담을 줄이기 위한 결정이다.
- 유지보수용 소스는 HTML·CSS·상태 모델·앱 파일로 분리하되 사용자가 여는 산출물은 이들을 내장한 단일 HTML로 생성한다.
- 외부 호스팅은 비목표에 따라 추가하지 않았다. 정적 UI라 서버 없이 동작하며 검수 결과 전달은 JSON 파일로 명시했다.

## 알려진 제한

- 정적 HTML이라 입력이 서버로 자동 전달되지 않는다. 사용자는 검수 결과 JSON을 다운로드해 다시 전달해야 한다.
- `file://`의 localStorage 동작은 브라우저마다 다를 수 있으므로 JSON 내보내기를 백업으로 사용해야 한다.
- 실제 브라우저별 `file://` 저장 동작과 시각 배치는 사용 환경에서 추가 확인이 필요하다. 자동 검증은 데이터·상태 모델·정적 HTML 계약을 대상으로 했다.
- 이번 UI는 SPEC-003의 고정된 100건 파일럿 전용이다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-10 | 사람 검수 UI, 로컬 저장과 JSON sidecar 계약 승인 |
| 2026-08-10 | 단일 HTML 구현, 상태 모델·import/export·정적 계약 검증 완료 |
