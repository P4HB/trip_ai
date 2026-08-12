# SPEC-012: v5 전수 근거 라벨 뷰어 v1

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 요청: 전수 검수된 v5 장소를 선택하면 24개 라벨 결과와 웹 근거를 즉시 표시한다.
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-011](spec_011.md)
- 관련 코드: `scripts/build_v5_researched_viewer_data.mjs`, `review-ui/`
- 선행 SPEC: SPEC-011

## 배경

기존 `review-ui`는 `place-preference-label-v1`의 사람 검토 큐를 읽는다. 전수 웹 조사 결과는 `place-preference-label-v5-researched/reviews/<contentid>.json`에 별도로 존재하므로, 기존 UI에서 장소를 선택해도 v5 판정·근거가 표시되지 않는다.

## 목표

- 1,664개 v5 검수 JSON을 정적 브라우저 번들로 생성한다.
- 장소 검색·선택 시 24개 라벨, 값, 신뢰도, 판정 상태, 사유, 관련 출처와 출처 사실을 표시한다.
- 기본 선택 장소부터 전체 24개 라벨을 보이게 하며, 검토 큐 필터에 의해 빈 목록이 되지 않게 한다.

## 비목표

- v5 값을 브라우저에서 수정하거나 원본 JSON에 반영하는 기능
- 외부 API 호출, 계정, 다중 사용자 판정 기능

## 요구사항

- `REQ-1201`: 번들은 baseline 1,664개 `contentid`와 일대일 대응해야 한다.
- `REQ-1202`: 각 장소는 18개 원자 라벨과 6개 파생 라벨을 모두 표시해야 한다.
- `REQ-1203`: 각 라벨은 값·신뢰도·상태·사유 및 연결된 출처를 표시해야 한다.
- `REQ-1204`: 정적 UI는 서버 API/fetch 없이 local classic-script 데이터 번들을 읽어야 한다.
- `REQ-1205`: UI는 기본 장소를 선택하고 전체 라벨을 바로 렌더해야 한다.

## 입력과 출력

입력은 `data/labeling/jeju/2026-08-09/place-preference-label-v5-researched/reviews/*.json`이며 출력은 `review-ui/data/v5-researched-data.js`다. 출력은 `window.JEJU_V5_RESEARCHED_DATA`에 1,664개 장소의 v5 라벨·근거를 할당한다.

## 영향 범위

- 변경 파일: `docs/README.md`, `docs/spec_012.md`, `scripts/build_v5_researched_viewer_data.mjs`, `review-ui/index.html`, `review-ui/app.js`, `review-ui/v5-viewer.css`, `review-ui/data/v5-researched-data.js`, `review-ui/README.md`
- 기존 v1 자동 라벨과 review decision export는 수정하지 않는다.

## 승인 기준

- `AC-1201`: 생성기가 1,664개 장소·각 24개 라벨을 포함한 번들을 만든다.
- `AC-1202`: 장소를 선택할 때 검색 조건과 무관하게 라벨 24개가 표시된다.
- `AC-1203`: 넥슨컴퓨터박물관(contentid `2472824`)에서 v5 값과 두 공공 출처가 표시된다.
- `AC-1204`: Node 구문 검사와 HTTP 200 확인을 통과한다.

## 테스트 계획

| 승인 기준 | 검증 방법 |
|---|---|
| AC-1201 | `node scripts/build_v5_researched_viewer_data.mjs` 후 JSON payload 검사 |
| AC-1202, AC-1203 | 브라우저 정적 렌더링 및 `2472824` 데이터 검사 |
| AC-1204 | `node --check review-ui/app.js`, `Invoke-WebRequest http://127.0.0.1:8080/review-ui/` |

## 구현 결과

구현 완료.

- `scripts/build_v5_researched_viewer_data.mjs`가 v5 review JSON의 두 저장 형태(`atomic_labels` 또는 Theme·Environment·Style 그룹)를 정규화해 1,664개 장소 번들을 생성한다.
- `review-ui/index.html`과 `review-ui/app.js`는 v5 번들을 읽어 기본 선택 장소부터 24개 라벨을 표시한다. 라벨 선택 시 값·신뢰도·상태·사유·계산식·연결 출처 facts를 렌더한다.
- `scripts/validate_review_ui_data.mjs --snapshot-date 2026-08-09`가 legacy v1 번들과 v5 1,664개·24라벨·출처·허용 점수를 함께 검증한다.
- `129620.json`의 `healing_slow=0.575`는 고정 척도 위반이어서 가중합을 가장 가까운 허용값 0.5로 양자화했다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | v5 전수 검수 결과 전용 뷰어 구현 시작 |
| 2026-08-12 | 1,664개 정적 v5 번들·장소별 근거 UI·validator 구현 및 검증 완료 |
