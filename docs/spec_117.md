# SPEC-117: 1단계 프로토타입 생성기의 원본 고정과 엄격 치환

- 상태: Implemented
- 작성일: 2026-10-30
- 최종 수정일: 2026-10-30
- 관련 이슈: `CODE_REVIEW_2026-10-26.md` 6번(프로토타입을 문자열 패치 50개로 생성). 사용자가 "원본 고정" 방향을 선택했다(2026-10-30).
- 관련 문서: SPEC-099·SPEC-100(Git 미추적 로컬 문서, 프로토타입 상품 비교), [SPEC-111](spec_111.md)(지도 UI 모듈 분리)
- 관련 코드: `scripts/stage1/build_prototype.py`, `scripts/stage1/source/`(로컬, Git 미추적)
- 선행 SPEC: SPEC-100, SPEC-111

## 배경

사실(2026-10-30 확인):

- `scripts/stage1/build_prototype.py`는 Git에 등록되지 않은 로컬 제출 도구다. 실행할 때마다 현재 `map-ui/`를 읽어 문자열을 고쳐 `1단계/03_Trip_AI_Prototype/`을 만든다.
- SPEC-111·113에서 `map-ui/app.js`가 2,823줄에서 193줄 조립 파일로 바뀌었다. 지금 실행하면 첫 패치 `replace_function(app, 'loadPlaceReviews', ...)`에서 `AssertionError`로 멈춘다.
- 함께 복사하는 `ccu-mmr.js`·`preference-elicitation.js`·`data/jeju-places.js`는 현재 해시가 제출본 `manifest.json`의 `reused` 해시와 다르다. `styles.css`는 이제 `@import` 8줄이어서 그대로 복사하면 스타일이 빠진다.
- 일반 `.replace` 33개(템플릿 후처리 포함)는 대상이 없어도 오류 없이 넘어간다.
- 분리 전 `app.js`·`index.html`·`styles.css`(pull 전 stash에 보존)와 제출본에 복사된 엔진·데이터를 입력으로 쓰면 생성된 `app.js`·`app.html`이 제출본과 같다.

## 목표

- 생성기가 제출 당시 입력을 해시로 고정한 스냅샷에서만 읽어, `map-ui`가 바뀌어도 같은 제출본을 재현한다.
- 모든 문자열 치환이 기대 횟수와 다르면 빌드가 실패하게 한다.

## 비목표

- 현재 `map-ui`에 설정 플래그를 넣어 프로토타입을 최신 UI로 다시 만드는 일(리뷰의 대안 방향, 별도 SPEC 필요).
- `1단계/03_Trip_AI_Prototype/` 제출본·ZIP 재생성이나 덮어쓰기, 템플릿·문구 변경.
- `map-ui/` 수정.

## 요구사항

- `REQ-001` 입력 고정: 생성기의 `map-ui` 입력은 `scripts/stage1/source/map-ui/`이며, `scripts/stage1/source/manifest.json`의 파일별 SHA-256과 하나라도 다르거나 목록 밖 파일이 있으면 생성 전에 실패한다.
- `REQ-002` 엄격 치환: 모든 문자열 치환은 대상 출현 횟수를 검사한다(기본 1회, 여러 번 바꾸는 곳은 기대 횟수를 명시). 정규식 치환도 정확히 1회만 허용한다.
- `REQ-003` 출력 위치: `--out DIR`로 출력 폴더를 바꿀 수 있다. 기본값은 기존과 같은 `1단계/03_Trip_AI_Prototype`이다.
- `REQ-004` 외부 요청 최소화: 대표 이미지가 출력 폴더에 없으면 제출본 `assets/hyeopjae.jpg`를 먼저 복사하고, 그것도 없을 때만 기존 URL에서 내려받는다.
- `REQ-005` 동일성: `tmp/` 아래로 생성한 결과가 제출본 폴더와 파일 목록·내용(줄바꿈 정규화 후)이 같다.

## 입력과 출력

- 입력: `scripts/stage1/source/map-ui/`(18개 파일), `scripts/stage1/templates/`, `scripts/stage1/revision.json`, `scripts/stage1/alignment.py`, `1단계/01_Trip_AI_1단계_Spec.md`(기존 해시 검사 유지).
- 출력: 기존과 같은 파일 구성. 제출 `manifest.json`의 `reused` 해시는 고정 원본 기준이므로 제출본과 같다.

## 설계

- 스냅샷 출처: `app.js`·`index.html`·`styles.css`는 pull 전 stash `claude-pre-pull-2026-10-30`의 로컬 작업본, 엔진 2개와 데이터는 제출본 사본(제출 manifest 해시와 일치), `vendor/`는 현재 `map-ui/vendor`(제출본과 바이트 동일). 출처를 `source/manifest.json`에 파일별로 적는다.
- `swap(text, old, new, count=1)`: `text.count(old) != count`이면 `AssertionError`(대상 앞 100자와 실제 횟수 포함). 기존 `replace_once`는 `swap`으로 통일한다.
- 기존 `replace_function`과 타일 정규식 검사는 유지한다.

## 예외와 폴백

- 스냅샷 해시 불일치·누락·추가 파일: 생성 전에 실패한다.
- 치환 대상 불일치: 해당 치환에서 실패하며 출력 폴더는 부분 생성 상태일 수 있다. 그래서 검증은 `tmp/`로 출력한다.

## 영향 범위

- 변경 예정 파일: `scripts/stage1/build_prototype.py`, `scripts/stage1/source/`(새로 추가), `docs/spec_116.md`, `docs/README.md`
- 데이터 마이그레이션: 없음
- 호환성 영향: 기본 출력 경로·출력 내용 유지. 실행 명령은 그대로 `python scripts/stage1/build_prototype.py`.
- 보안·개인정보 영향: 없음. 외부 다운로드는 대표 이미지가 어디에도 없을 때만 일어난다.
- 저장소 영향: `scripts/stage1/`와 `1단계/`는 로컬 제출 자료로 Git에 등록되어 있지 않다(SPEC-087 방침). 이 SPEC은 문서만 커밋하고 생성기·스냅샷(약 19MB)은 로컬에 둔다.

## 승인 기준

- `AC-001` 현재 상태에서 기존 생성기가 실패함을 재현한다(수정 전 기준).
- `AC-002` 수정한 생성기가 기본 출력 경로를 건드리지 않고 `--out tmp/...`로 성공한다.
- `AC-003` 생성 결과가 제출본과 파일 목록·내용 모두 같다(텍스트는 줄바꿈 정규화 후, 이진 파일은 바이트 비교).
- `AC-004` 스냅샷 파일 하나를 바꾸면 생성 전에 실패한다.
- `AC-005` 치환 대상 문자열 하나를 지우거나 늘리면 해당 치환에서 실패한다. 일반 `.replace` 호출이 남아 있지 않다.
- `AC-006` `python -m py_compile scripts/stage1/build_prototype.py` 통과.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001 | 기존 생성기를 출력만 `tmp/`로 바꿔 실행 | 구현 결과에 기록 |
| AC-002, AC-003 | 생성 후 폴더 비교 | `python scripts/stage1/build_prototype.py --out tmp/stage1-build-check`, 비교 스크립트 |
| AC-004 | 스냅샷 사본 1바이트 변경 후 실행 | 임시 사본에서 실행 |
| AC-005 | 고정 원본의 치환 대상 변경 후 실행, AST로 `.replace` 호출 검색 | 임시 사본에서 실행 |
| AC-006 | 문법 검사 | `python -m py_compile scripts/stage1/build_prototype.py` |

## 구현 결과

- `scripts/stage1/source/map-ui/`(18개 파일, 약 19MB)와 `scripts/stage1/source/manifest.json`(파일별 SHA-256·바이트·출처)을 만들었다. 엔진 2개·데이터 해시는 제출 `manifest.json`의 `reused`와 같다.
- `scripts/stage1/build_prototype.py`
  - `SRC`를 고정 원본으로 바꾸고 생성 전에 파일 목록·해시를 검사한다(`REQ-001`).
  - `replace_once` 17개와 일반 `.replace` 33개(연결 호출 2줄 분리 포함)를 모두 `swap`으로 바꿨다. 기록 모드(`STAGE1_RECORD_SWAPS=1`)로 확인한 실제 횟수는 48개가 1회, 2개가 0회였다(`REQ-002`). 남은 `.replace`는 `swap` 내부 1곳뿐이다.
  - `--out` 인자 추가(`REQ-003`), 대표 이미지는 제출본 사본을 먼저 복사(`REQ-004`). 쓰지 않게 된 `html.escape` import를 지웠다.

### 검증 결과(Windows, Python 3.10.4, 2026-10-30)

- `AC-001`: 수정 전 생성기를 출력만 `tmp/`로 바꿔 실행 → `replace_function(app, 'loadPlaceReviews', ...)`에서 `AssertionError`. 같은 생성기에 stash의 분리 전 `app.js`·`index.html`을 넣으면 `app.js`·`app.html`이 제출본과 같았다.
- `AC-002`: `python -X utf8 scripts/stage1/build_prototype.py --out tmp/stage1-build-check` 성공. 제출본 폴더에는 이 SPEC 작성 이후 수정된 파일이 없다.
- `AC-003`: 생성 결과 35개 파일과 제출본 35개 파일의 목록이 같고, 35개 모두 **바이트 단위로 동일**(줄바꿈 정규화 불필요).
- `AC-004`: 임시 사본(`tmp/stage1-neg`, 확인 후 삭제)에서 `styles.css`에 1바이트 추가 → `Pinned source changed: styles.css`, 출력 파일 0개. 목록 밖 파일 추가 → `Pinned source file list changed`.
- `AC-005`: 고정 원본의 `JEJU TRIP BETA`를 지우거나(0회) 하나 더 넣으면(2회) manifest 해시를 맞춰도 각각 `('JEJU TRIP BETA', 0, 1)`, `('JEJU TRIP BETA', 2, 1)`로 실패. AST 검색 결과 `swap` 밖 `.replace` 호출 0개.
- `AC-006`: `python -m py_compile scripts/stage1/build_prototype.py` 통과.

## 설계와 달라진 점

- `guide.html`의 `{{ALIGNMENT_ROWS}}`·`{{SOURCE_SHA256}}` 치환 2개는 템플릿에 자리표시자가 없어 원래부터 0회 치환(아무 일도 안 함)이었다. 기대 횟수 0으로 남기지 않고 치환과 표 행 계산을 지웠다. 출력은 같다(AC-003). `ALIGNMENT`는 제출 manifest의 `target_alignment`에 계속 쓴다.
- `guide.html`을 읽고 다시 쓰는 줄은 남겼다. 제출본의 플랫폼 줄바꿈을 그대로 재현하기 위해서다.

## 알려진 제한

- 프로토타입은 제출 당시 화면으로 고정된다. 현재 지도 UI의 수정은 반영되지 않는다.
- 스냅샷의 `app.js`·`index.html`은 Git 커밋에 없고 로컬 stash와 이 스냅샷에만 있다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-30 | 초안 작성, 구현 시작 |
| 2026-10-30 | 구현·검증 완료, Implemented |
