# SPEC-010: 지도 장소 상세 라벨 결과와 설명 툴팁

- 상태: Implemented
- 작성일: 2026-08-11
- 최종 수정일: 2026-08-11
- 관련 이슈: 지도 장소 뷰어에서 장소별 24축 라벨 값과 라벨·점수 의미를 바로 확인
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [데이터 계약](data_contracts.md), [SPEC-009](spec_009.md)
- 관련 코드: `scripts/build_map_ui_data.mjs`, `map-ui/`, `tests/map_ui_labels.test.mjs`
- 선행 SPEC: [SPEC-009](spec_009.md)

## 배경

현재 `map-ui`는 제주 장소의 위치·사진·주소·전화번호만 상세 카드에 표시한다. `SPEC-009`에서 1,664개 장소의 Theme·Environment·Style 24축 숫자 라벨을 추가했지만 지도 UI와 데이터 연결이 없어 사용자가 지도에서 장소를 선택해도 라벨링 결과를 확인할 수 없다.

지도에는 일반 음식·주점까지 2,153개 유효 좌표가 표시되며, 현재 라벨 범위는 비음식점과 FD05 카페·찻집 1,664개다. 좌표 오류로 지도에서 제외된 라벨 장소 1개와 라벨 범위 밖 음식점 490개가 있으므로 지도에 실제 표시되는 라벨 보유 장소는 1,663개다.

## 목표

- 지도 마커 또는 장소 목록에서 장소를 선택하면 상세 카드에 해당 장소의 24개 라벨 값을 그룹별로 표시한다.
- 각 라벨에 마우스를 올리거나 키보드로 focus하면 라벨 설명과 현재 점수의 의미를 보여준다.
- Environment 두 축은 축별 전용 점수 의미를 사용하고 나머지 축은 공통 강도 척도를 사용한다.
- 정적 HTML과 `file://` 실행 방식을 유지한다.
- 현재 라벨 범위 밖 장소도 기존 지도 탐색 기능을 유지하고 라벨 미제공 상태를 명시한다.

## 비목표

- 라벨 수정 또는 검토 기능
- 추천 점수, 순위 또는 일정 생성
- 일반 음식·주점의 새 라벨 생성
- 서버 API, 로그인 또는 외부 JavaScript 의존성 추가
- 라벨 provenance 전체와 검토 큐 표시

## 요구사항

- `REQ-1001`: 지도 데이터 생성기는 TourAPI 장소 데이터와 같은 스냅샷 날짜의 `place-preference-label-v2/place_labels.jsonl`을 읽어야 한다.
- `REQ-1002`: 생성기는 `map-ui/data/jeju-place-labels.js`에 label version, snapshot date, 24개 고정 경로와 `contentid -> 24개 숫자 배열`을 기록해야 한다.
- `REQ-1003`: 라벨 번들은 `window.JEJU_LABEL_META`, `window.JEJU_PLACE_LABELS` 전역을 사용하며 `jeju-places.js` 다음, `app.js` 전에 로드해야 한다.
- `REQ-1004`: 장소 상세는 `Theme`, `Environment`, `Style 근거`, `여행 스타일` 네 그룹을 고정 순서로 보여줘야 한다.
- `REQ-1005`: 각 라벨 항목은 한국어 표시명, `0/0.25/0.5/0.75/1` 값과 시각적 강도 표시를 가져야 한다.
- `REQ-1006`: 각 라벨은 hover와 keyboard focus에서 설명·현재 값의 의미를 포함한 툴팁을 표시하고 `aria-describedby`로 연결해야 한다.
- `REQ-1007`: `indoor_ratio`와 `weather_sensitivity`는 축별 5단계 의미를 사용한다. 나머지는 `없음/낮음/보통/높음/매우 높음` 공통 척도를 사용한다.
- `REQ-1008`: 라벨 범위 밖 장소는 기존 상세 정보와 동작을 유지하면서 라벨 영역에 미제공 상태를 표시해야 한다.
- `REQ-1009`: 라벨 파일 누락·파싱 실패 시 빈 라벨 번들을 생성하거나 라벨 영역만 비활성화하고 지도 자체는 계속 동작해야 한다.
- `REQ-1010`: 툴팁은 화면 밖으로 크게 벗어나지 않아야 하며 모바일에서는 focus 또는 tap으로 내용을 확인할 수 있어야 한다.
- `REQ-1011`: 라벨 추가 후 상세 카드가 데스크톱과 모바일 viewport에서 스크롤 가능해야 한다.

## 입력과 출력

입력:

```text
data/tourapi/jeju/YYYY-MM-DD/jeju_places.json
data/labeling/jeju/YYYY-MM-DD/place-preference-label-v2/place_labels.jsonl
data/labeling/jeju/YYYY-MM-DD/place-preference-label-v2/manifest.json
```

출력:

```text
map-ui/data/jeju-places.js
map-ui/data/jeju-place-labels.js
```

라벨 번들 논리 계약:

```text
LabelMeta {
  sourceDate: YYYY-MM-DD
  labelVersion: string
  labeledPlaces: number
  paths: string[24]
  scoreScale: [0, 0.25, 0.5, 0.75, 1]
}

PlaceLabels {
  [contentid: string]: number[24]
}
```

배열 인덱스는 `LabelMeta.paths`와 같은 순서를 사용한다.

## 설계

`build_map_ui_data.mjs`는 기존 지도 장소 번들과 별도로 compact 라벨 번들을 생성한다. UI는 로드 시 `paths`와 값 배열 길이를 확인해 `contentid`별 Map을 만들고, 장소를 선택할 때 현재 장소 한 건만 렌더링한다.

상세 라벨은 다음 그룹으로 나눈다.

- Theme: mountain, ocean, activity, culture_history, theme_park, cafe, traditional_market, festival
- Environment: indoor_ratio, weather_sensitivity
- Style 근거: restfulness, physical_ease, visit_duration_flexibility, scenic_value, distinctiveness, local_embeddedness, landmark_significance, photo_value
- 여행 스타일: healing_slow, scenic_immersion, discovery_explorer, local_immersion, iconic_highlight, photo_mood

Environment 점수 의미:

| 값 | indoor_ratio | weather_sensitivity |
|---:|---|---|
| 0 | 거의 전부 야외 | 날씨 영향이 거의 없음 |
| 0.25 | 야외 중심·일부 실내 | 날씨 영향이 적음 |
| 0.5 | 실내와 야외가 비슷함 | 날씨에 따라 일부 제한 |
| 0.75 | 실내 중심·일부 야외 | 핵심 경험이 크게 축소될 수 있음 |
| 1 | 거의 전부 실내 | 이용 곤란·취소 가능성이 매우 높음 |

나머지 축의 값 의미는 `0=없음`, `0.25=낮음`, `0.5=보통`, `0.75=높음`, `1=매우 높음`이다.

## 예외와 폴백

- 동일 날짜의 라벨 파일이 없으면 빈 번들과 누락 상태 metadata를 생성한다.
- 라벨 레코드의 `contentid`가 중복되거나 경로·값 수가 24개가 아니면 생성에 실패한다.
- UI에서 meta와 값 배열 계약이 맞지 않으면 해당 장소를 라벨 미제공으로 처리한다.
- 툴팁은 JavaScript 문자열을 HTML로 삽입하지 않고 DOM `textContent`로 구성한다.

## 영향 범위

- 변경 파일: 지도 데이터 생성기, 지도 정적 HTML/CSS/JS, 라벨 번들, 지도 README, 관련 문서와 테스트
- 데이터 마이그레이션: 없음. SPEC-009 라벨 데이터는 읽기 전용 입력이다.
- 호환성 영향: `jeju-places.js` 계약과 기존 지도 탐색 기능은 유지한다. 신규 라벨 번들은 선택적 확장이다.
- 보안·개인정보 영향: API 키와 사용자 정보는 브라우저에 전달하지 않는다. 외부 네트워크 의존성은 기존 지도 타일·장소 이미지와 동일하다.

## 승인 기준

- `AC-1001`: 라벨 번들에 1,664개 고유 ID와 각 24개 허용 점수가 들어 있다.
- `AC-1002`: 지도에 표시되는 라벨 보유 장소를 선택하면 24개 라벨이 네 그룹으로 렌더링된다.
- `AC-1003`: hover와 keyboard focus에서 라벨 설명과 현재 값 의미를 확인할 수 있다.
- `AC-1004`: 황우지해안열두굴, 제주 우도 천진항 대합실, 제주동화마을의 확정 Environment 값이 UI 번들에 유지된다.
- `AC-1005`: 라벨 범위 밖 음식점을 선택해도 지도와 상세 정보가 정상이며 미제공 상태가 표시된다.
- `AC-1006`: 1440px, 1024px, 375px viewport에서 상세 라벨을 스크롤·확인할 수 있고 주요 UI가 가려지지 않는다.
- `AC-1007`: 기존 검색, 필터, 마커 선택, 상세 닫기 동작이 유지된다.
- `AC-1008`: 같은 입력으로 라벨 번들을 두 번 생성하면 바이트가 동일하다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-1001, AC-1004, AC-1008 | 생성 번들 전수 계약·결정성 테스트 | `node --test tests/map_ui_labels.test.mjs` |
| AC-1002, AC-1003, AC-1005~AC-1007 | 로컬 HTTP에서 장소 선택·hover·focus·viewport 수동 회귀 | Browser로 `map-ui/` 확인 |
| 전체 | JavaScript 구문·생성 diff·whitespace | `node --check scripts/build_map_ui_data.mjs`; `node --check map-ui/app.js`; `node scripts/build_map_ui_data.mjs`; `git diff --check` |

## 구현 결과

- `map-ui/data/jeju-place-labels.js`: 163,798 bytes, SHA-256 `fca3b9aa4920c76d4f3ac54823c9395f4afe9ba7e78aa84ce72e069cef1b715e`
- 라벨 번들: 1,664개 고유 ID × 24개 허용 점수. 지도 유효 좌표와 연결되는 라벨 장소는 1,663개다.
- 지도 상세: Theme 8개, Environment 2개, Style 근거 8개, 여행 스타일 6개를 고정 순서로 표시한다.
- hover, keyboard focus와 모바일 tap에서 라벨 설명과 현재 점수 의미를 공통 fixed tooltip으로 표시한다.
- 라벨 범위 밖 일반 음식·주점 490개는 기존 장소 상세와 함께 라벨 미제공 상태를 표시한다.
- `node --test tests/map_ui_labels.test.mjs`: 5/5 통과. 2회 생성 해시, 원본 39,936개 값과 compact 번들 전수 일치, 지도 교집합, 사용자 확정값과 HTML 로드 순서를 검증했다.
- `node --check scripts/build_map_ui_data.mjs`, `node --check map-ui/app.js`, `node scripts/build_map_ui_data.mjs`, `git diff --check`: 통과. 기존 `jeju-places.js` 논리 diff는 0건이다.
- 브라우저 검증:
  - 1440×900: 상세 카드 920×720, 24개 라벨과 내부 세로 스크롤 정상
  - 1024×768: 상세 카드 586×644, 지도 영역 안 배치와 내부 스크롤 정상
  - 375×812: 상세 카드 355×724, 상단 이미지 118px와 라벨 영역 스크롤 정상
  - `1100도로`에서 24개 라벨·실내 비율 tooltip, hover·focus·`aria-describedby` 정상
  - `운정이네`에서 일반 음식·주점 라벨 미제공 상태 정상
  - 브라우저 console warning/error 0건

## 설계와 달라진 점

없음. tooltip을 상세 카드 내부가 아닌 `position: fixed` 단일 레이어로 구현해 카드 스크롤과 화면 경계 clipping을 피했다.

## 알려진 제한

- 라벨 데이터가 없는 일반 음식·주점은 값 대신 미제공 상태를 표시한다.
- 툴팁은 라벨 정의와 값 의미를 설명하며 전체 evidence·규칙 이력은 검토 UI 범위다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-11 | 사용자 요청에 따라 지도 장소 상세 라벨 표시와 설명 툴팁 범위 승인 |
| 2026-08-11 | compact 라벨 번들, 24축 상세, 점수 의미 툴팁, 반응형 스크롤과 회귀 테스트 구현 완료 |
