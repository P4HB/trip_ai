# SPEC-071: 장소 상세 내부 라벨·변동 제약 표시 제거

- 상태: Implemented
- 작성일: 2026-09-02
- 최종 수정일: 2026-09-02
- 관련 이슈: 사용자 요청 — 장소 보기에서 41개 장소 라벨과 변동·제약 정보 제거
- 관련 문서: `docs/spec_013.md`, `docs/spec_014.md`, `docs/spec_068.md`, `docs/architecture.md`
- 관련 코드: `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: SPEC-013, SPEC-014, SPEC-068

## 배경

현재 장소 상세 창은 기본 장소 정보와 후기 아래에 추천 엔진용 41개 라벨 전체와 자유 텍스트 변동·제약 정보를 표시한다. 이 정보는 내부 추천 근거와 데이터 검수에는 필요하지만 일반 사용자의 장소 탐색 화면에는 지나치게 기술적이고 상세 창을 길게 만든다.

## 목표

- 장소 상세 창에서 `장소 라벨 41개` 전체 영역을 제거한다.
- 장소 상세 창에서 `변동·제약 정보` 영역을 제거한다.
- 추천 계산, 내부 결과 JSON, 장소 데이터, 사진, 기본 설명과 카카오 후기는 유지한다.

## 비목표

- 41축 장소 라벨 데이터나 추천 점수 계산 제거
- 변동·제약 데이터의 생성·검증·추천 후보 판정 변경
- 내부 추천 상세 trace 또는 전체 출력 JSON 변경
- 장소 사진·웹 조사 설명·카카오 후기 변경

## 요구사항

- `REQ-7101`: 장소 상세 DOM에 41개 라벨 영역을 렌더링하지 않는다.
- `REQ-7102`: 장소 상세 DOM에 변동·제약 정보 영역과 출처 링크를 렌더링하지 않는다.
- `REQ-7103`: 장소 선택 시 제거된 영역을 생성하거나 갱신하는 코드 경로가 없어야 한다.
- `REQ-7104`: 추천 엔진 입력용 `place.v5`, `place.fit`, `place.constraints` 데이터와 계산 로직은 유지한다.
- `REQ-7105`: 장소 사진·기본 정보·웹 조사 설명·카카오 후기·추천 내부 상세·지도 동작은 회귀 없이 유지한다.

## 입력과 출력

입력 데이터 계약은 변경하지 않는다. 출력 중 장소 상세 사용자 화면에서만 라벨 전체 목록과 자유 텍스트 제약 목록을 제외한다. 추천 결과 객체와 디버그 JSON에는 기존 데이터가 유지된다.

## 설계

`index.html`의 두 상세 섹션과 `app.js`의 전용 렌더러·호출을 제거한다. 더 이상 사용되지 않는 라벨 그룹 정의와 상세 전용 CSS를 함께 제거한다. 추천 trace에서 축 이름을 한국어로 바꾸는 `LABEL_NAMES`는 유지한다.

## 예외와 폴백

- 라벨 또는 제약 데이터가 있거나 없어도 상세 화면 구성은 동일하다.
- 데이터 번들에 해당 필드가 남아 있으므로 추천 계산과 전체 출력에는 영향을 주지 않는다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_013.md`, `docs/spec_071.md`, `map-ui/index.html`, `map-ui/app.js`, `map-ui/styles.css`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 데이터 마이그레이션: 없음
- 호환성 영향: 장소 상세 사용자 표시만 단순화
- 보안·개인정보 영향: 없음

## 승인 기준

- `AC-7101`: 장소를 열어도 `장소 라벨`, Theme, Environment, Atomic/Derived Style, Companion, Month 목록이 나타나지 않는다.
- `AC-7102`: 제약이 있는 장소를 열어도 `변동·제약 정보`, reservation, operating_schedule 항목이 나타나지 않는다.
- `AC-7103`: 상세의 사진·설명·카카오 후기와 추천 계산이 정상 동작한다.
- `AC-7104`: 정적 계약, JavaScript 문법, 추천 회귀 테스트가 통과한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-7101~AC-7102 | 제거된 DOM·렌더러·문구 부재 정적 계약 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-7103~AC-7104 | 구문·추천 회귀 | `node --check map-ui/app.js`; `node scripts/test_ccu_mmr.cjs` |
| AC-7101~AC-7103 | 실제 장소 상세 브라우저 확인 | 로컬 Map UI |

## 구현 결과

- 장소 상세 HTML에서 41개 라벨과 변동·제약 정보 섹션을 제거했다.
- 상세 선택 시 두 영역을 만들던 전용 렌더러·호출·DOM 참조와 더 이상 쓰이지 않는 라벨 그룹 정의를 제거했다.
- 라벨 chip, 근거 링크, 제약 안내 전용 CSS를 제거했다.
- 추천 계산용 `place.v5`, `place.fit`, `place.constraints`와 `LABEL_NAMES`, 내부 추천 trace 및 결과 JSON은 유지했다.
- 정적 계약에 제거된 DOM ID·렌더러·사용자 문구가 다시 들어오지 않는 회귀 검사를 추가했다.
- Git 커밋 `d032cd3`을 OCI 운영 릴리스 `/opt/rail-desk/releases/20260902-place-detail-d032cd3`로 배포했다. 공개 정적 파일에서 제거 대상 DOM·렌더러·CSS가 없고 기존 메인·헬스·여행 UI·리뷰 API가 모두 HTTP 200임을 확인했다.

## 설계와 달라진 점

없음.

## 알려진 제한

- 내부 추천 상세와 전체 출력 JSON은 본 SPEC의 제거 대상이 아니다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-02 | 사용자 승인 범위로 SPEC 작성 및 구현 시작 |
| 2026-09-02 | 장소 상세 라벨·변동 제약 UI와 전용 코드 제거 및 추천 회귀 검증 완료 |
| 2026-09-02 | 운영 릴리스 `20260902-place-detail-d032cd3` 배포 및 공개 HTTPS 회귀 검증 완료 |

## 테스트 결과

| 검증 | 결과 |
|---|---|
| `node --check map-ui/app.js` | 통과 |
| `node scripts/validate_ccu_mmr_dashboard.cjs` | 통과 — 2,153개 장소·1,663개 추천 가능 장소·장소당 41개 추천 라벨 데이터 유지 |
| `node scripts/test_ccu_mmr.cjs` | 통과 |
| `node scripts/test_preference_elicitation.cjs` | 통과 |
| `git diff --check` | 통과 |
| 로컬 실제 장소 상세 브라우저 QA | 통과 — `수망리 마흐니숲길` 상세에서 사진·기본 설명은 유지되고 라벨·변동 제약 문구는 없음 |
| 운영 공개 HTTPS 검증 | 통과 — `/`, `/healthz`, `/travel/`, JS/CSS, 리뷰 API HTTP 200 및 제거 대상 문자열 부재 |
