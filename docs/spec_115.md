# SPEC-115: 고정 데이터 해시의 플랫폼 간 재현성

- 상태: Implemented
- 작성일: 2026-10-27
- 최종 수정일: 2026-10-30
- 관련 이슈: [SPEC-113](spec_113.md) 알려진 제한(장소 유형 테스트 `XFAIL`, 라벨 검수 해시 테스트 Windows `SKIP`). 사용자 결정(2026-10-27): "SQLite 내용 비교 + 장소 유형 재생성"
- 관련 문서: [데이터 계약](data_contracts.md), [평가 전략](evaluation.md), [SPEC-075](spec_075.md)
- 관련 코드: `.gitattributes`, `scripts/test_place_types.py`, `scripts/run_tests.py`, `data/labeling/jeju/2026-09-11/place-types-v1/`
- 선행 SPEC: SPEC-075, SPEC-113

## 배경

SPEC-113의 단일 실행기(`python -X utf8 scripts/run_tests.py`)는 고정 산출물 검사 두 개를 통과로 세지 못한다. 2026-10-27 조사에서 확인한 사실은 다음과 같다.

- `scripts/test_place_types.py`는 `manifest.json`을 읽지 않는다. 임시 폴더에 새로 만든 출력과 커밋된 작업 사본(`place_types.jsonl`, `review_queue.jsonl`, `place_types.sqlite3`, `report.md`)을 바이트로 비교한다. 따라서 SPEC-113이 기록한 원인(manifest가 SPEC-111 이전 지도 번들 해시를 고정)은 실패 원인이 아니라 출처 기록 오류다.
- 현재 코드·입력으로 다시 만든 출력은 내용이 같다. JSONL·검토 큐·보고서는 줄바꿈 정규화 후 같고, SQLite는 `iterdump` 결과가 같다. SQLite 파일은 73바이트가 다르며 헤더 오프셋 96의 기록 라이브러리 버전(커밋 3.37.2, 이 PC의 Python 3.14는 3.50.4)과 페이지 내부 바이트다. WSL Ubuntu 24.04는 3.45.1이라 3.37.2 실행 환경이 없다.
- 장소 유형 manifest의 JSONL·보고서 해시는 CRLF 바이트다. 원래 Windows에서 생성됐고, 동결된 분류기는 플랫폼 줄바꿈(`os.linesep`)으로 쓴다. 테스트가 통과하려면 작업 사본이 플랫폼 줄바꿈이어야 한다.
- 추적 텍스트 파일의 64자리 16진수를 모든 추적 파일의 LF(Git blob)·CRLF 바이트 해시와 대조했다. manifest는 생성한 PC의 작업 사본 바이트를 기록했다. 장소 프로필 파일럿 v1~v3·기후 평년값은 LF, TourAPI 2026-08-09 스냅샷의 JSON·CSV·manifest는 CRLF(JSONL만 LF), relabel v2 최상위 라벨 JSONL은 CRLF, 장소 유형 산출물은 CRLF·분류기는 LF·taxonomy는 CRLF다. `non_restaurants.json`, `restaurants.json`, `full/place-profile-v1-all-1434/place_web_research.jsonl`은 현재 manifest에서 LF, 읽는 코드가 없는 `place-fit-relabel-v2/manifest.rules-v1.json`에서만 CRLF다.
- 그래서 전부 LF나 전부 CRLF로는 해결되지 않는다. 변경 전 Windows(`core.autocrlf=true`) 체크아웃에서는 라벨 검증기 6개 중 `validate_place_fit_relabel_v2.py`만 통과하고 라벨 검수 모델 테스트가 SKIP된다. Linux LF clone에서는 `validate_labeling_review_ui.mjs`와 라벨 검수 모델 테스트만 통과한다.

## 목표

- 실행기의 두 고정 산출물 검사가 Windows와 Linux 체크아웃에서 SKIP·XFAIL 없이 통과한다.
- 테스트·검증기가 읽는 고정 해시 데이터셋은 체크아웃 플랫폼과 `core.autocrlf` 설정에 관계없이 자기 manifest가 기록한 바이트를 재현한다.
- 장소 유형 manifest가 현재 입력을 기록한다.

## 비목표

- `scripts/classify_place_types.py`, `scripts/build_all_place_profiles.py` 등 해시가 manifest에 고정된 스크립트 수정.
- 분류·라벨 내용 변경과 다른 데이터셋 재생성.
- 내용 자체가 달라진 고정 해시 정리: `validate_all_place_profiles.py`의 보호 트리(`map-ui` 17개 등, 이후 SPEC에서 변경), v2 파일럿 manifest의 `research/part_3.json` 해시. 줄바꿈과 무관하며 별도 결정이 필요하다.
- 읽는 검사가 없는 계보 manifest(`manifest.rules-v1.json`, relabel v2 하위 배치·보정 manifest, v5 장소 리뷰 파일)의 줄바꿈 정리.

## 요구사항

- `REQ-001`: `.gitattributes`가 테스트·검증기가 읽는 고정 해시 데이터셋마다 자기 manifest가 해시한 줄바꿈을 지정한다. 장소 프로필 파일럿(`data/labeling/jeju/2026-08-09/pilots/**`)과 `data/climate/**`는 `eol=lf`, TourAPI 2026-08-09 스냅샷의 `jeju_places.json`·`jeju_places.csv`·`quality_issues.csv`·`manifest.json`은 `eol=crlf`, `jeju_places.jsonl`은 `eol=lf`, relabel v2 최상위 `*.jsonl`은 `eol=crlf`다.
- `REQ-002`: 장소 유형 텍스트 산출물(`*.jsonl`, `report.md`)은 `text`(플랫폼 줄바꿈)로 두어 `core.autocrlf=false`인 Windows에서도 CRLF가 되게 한다. manifest가 해시한 분류기 입력은 `scripts/classify_place_types.py`를 `eol=lf`, `config/place_type_taxonomy.v1.json`을 `eol=crlf`로 고정한다.
- `REQ-003`: `scripts/test_place_types.py`는 `place_types.sqlite3`를 실행 중인 SQLite 라이브러리 버전이 파일 헤더의 기록 버전과 같으면 바이트로, 다르면 스키마와 전체 행(`iterdump`)으로 비교한다. 다른 산출물의 바이트 비교, 같은 환경 두 번 생성의 바이트 동일성 검사와 나머지 의미 검사는 유지한다. 통과 메시지에 비교 방식을 표시한다.
- `REQ-004`: 수정하지 않은 `scripts/classify_place_types.py`를 실행해 `place-types-v1`을 재생성한다. 레코드는 같아야 한다(JSONL·검토 큐·보고서의 Git 차이 없음, SQLite `iterdump` 동일). manifest는 현재 지도 번들 해시를 기록하고 분류기·taxonomy·TourAPI 입력 해시는 기존 값과 같아야 한다.
- `REQ-005`: `scripts/run_tests.py`에서 장소 유형 검사의 `known_failure` 표시를 지운다. 두 검사의 전제 조건은 작업 사본 줄바꿈이 규칙과 다를 때(이 변경 전 체크아웃, `core.autocrlf=input` 등) 해당 파일을 다시 체크아웃하라는 사유로 SKIP한다.
- `REQ-006`: 고정 해시와 줄바꿈 규칙, 장소 유형 검증 방식, 실행기 동작을 기준 문서에 반영하고 SPEC-113의 알려진 제한을 이 SPEC으로 연결한다.

## 입력과 출력

- 입력: 현재 커밋의 `data/tourapi/jeju/2026-08-09/jeju_places.json`, `map-ui/data/jeju-places.js`, `config/place_type_taxonomy.v1.json`, `scripts/classify_place_types.py`.
- 출력: `data/labeling/jeju/2026-09-11/place-types-v1/`의 `place_types.jsonl`, `review_queue.jsonl`, `place_types.sqlite3`, `report.md`, `manifest.json`. 스키마·레코드·장소 ID·좌표는 바꾸지 않는다.

## 설계

- 줄바꿈 규칙은 "검사가 읽는 데이터셋은 자기 manifest가 기록한 바이트를 모든 체크아웃에서 재현한다"를 따른다. Git이 저장하는 내용은 모두 LF 그대로라 `git add --renormalize .`는 `.gitattributes` 외에 index 변경이 없고, 작업 사본만 다시 체크아웃한다.
- 장소 유형 테스트는 두 단계로 재현성을 본다. 같은 환경에서 두 번 만든 출력의 바이트 동일성(결정성)과, 커밋된 출력과의 일치(최신성)다. SQLite 페이지 바이트는 라이브러리 버전에 따라 달라지므로 기록 버전이 같을 때만 바이트로, 다를 때는 스키마·행으로 최신성을 확인한다.
- 재생성은 Windows(SQLite 3.50.4)에서 한다. JSONL·보고서는 CRLF로 쓰여 기존 manifest 해시와 같고, SQLite는 3.50.4 기록 파일로 바뀐다.

## 예외와 폴백

- 작업 사본 줄바꿈이 규칙과 다르면 실행기가 실패 대신 파일 목록과 다시 체크아웃하라는 사유로 SKIP한다. 직접 실행한 테스트는 기존처럼 실패한다.
- SQLite 헤더의 버전이 실행 환경과 다르면 내용 비교로 바뀌며 실패 메시지는 기존과 같은 `Stale output: place_types.sqlite3`다.

## 영향 범위

- 변경 파일: `.gitattributes`, `scripts/test_place_types.py`, `scripts/run_tests.py`, `data/labeling/jeju/2026-09-11/place-types-v1/manifest.json`, `place_types.sqlite3`, `docs/spec_115.md`, `docs/README.md`, `docs/data_contracts.md`, `docs/evaluation.md`, `docs/spec_113.md`.
- 데이터 마이그레이션: 없음. 장소 유형 레코드와 지도 번들은 바뀌지 않는다.
- 호환성 영향: 이 변경 전에 만든 작업 사본은 규칙이 바뀐 파일을 지우고 `git checkout -- <파일>`로 다시 받아야 한다. Linux 체크아웃의 TourAPI 스냅샷 JSON·CSV와 relabel v2 라벨은 CRLF가 된다. JSON·CSV 파서는 줄바꿈과 무관하다.
- 보안·개인정보 영향: 없음. `.env` 파일은 읽거나 해시하지 않는다.

## 승인 기준

- `AC-001`: Windows(`core.autocrlf=true`)에서 `python -X utf8 scripts/run_tests.py`가 장소 유형·라벨 검수 모델 검사를 PASS로 보고하고 SKIP·XFAIL이 0개다.
- `AC-002`: Linux LF clone(WSL Ubuntu 24.04, SQLite 3.45.1)에서 `test_place_types.py`와 `test_labeling_review_model.mjs`가 통과한다.
- `AC-003`: `validate_place_fit_relabel_v2.py`, `validate_labeling_review_ui.mjs`, `validate_place_profile_pilot.mjs`, `validate_place_profile_autolabel_v3.mjs`가 Windows와 Linux 모두에서 통과하고, 변경 전 통과하던 검증기가 어느 플랫폼에서도 실패로 바뀌지 않는다.
- `AC-004`: 재생성 후 `place_types.jsonl`·`review_queue.jsonl`·`report.md`의 Git 차이가 없고, SQLite `iterdump`가 이전 파일과 같으며, manifest 차이는 지도 번들 입력 해시와 SQLite 출력 해시뿐이다.
- `AC-005`: 커밋된 SQLite의 행 하나를 바꾸면 바이트 비교 방식과 내용 비교 방식 모두에서 `test_place_types.py`가 실패한다.
- `AC-006`: 기준 문서를 갱신하고 `python -X utf8 scripts/check_markdown_links.py`가 깨진 링크 0건을 보고한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001 | Windows 전체 실행 | `python -X utf8 scripts/run_tests.py` |
| AC-002 | WSL Linux LF clone에서 두 테스트 | `python3 -X utf8 scripts/test_place_types.py`, `node scripts/test_labeling_review_model.mjs` |
| AC-003 | 변경 전후 양 플랫폼 검증기 실행 비교 | `python scripts/validate_place_fit_relabel_v2.py`, `node scripts/validate_labeling_review_ui.mjs`, `node scripts/validate_place_profile_pilot.mjs`, `node scripts/validate_place_profile_autolabel_v3.mjs` |
| AC-004 | 재생성 후 Git 차이와 SQLite 덤프 비교 | `python -X utf8 scripts/classify_place_types.py`, `git diff --stat` |
| AC-005 | 버려지는 사본의 SQLite 행 변경 후 테스트 실패 확인 | Windows 작업 트리(복원), WSL clone |
| AC-006 | 링크 검사 | `python -X utf8 scripts/check_markdown_links.py` |

## 구현 결과

- `.gitattributes`(REQ-001·002): 위 규칙을 추가했다. `git add --renormalize .`는 `.gitattributes` 외 index 변경이 없었고, Windows 작업 사본에서 규칙과 다른 31개 파일(파일럿 28, 기후 1, TourAPI JSONL 1, 분류기 1)을 지우고 다시 체크아웃했다.
- `scripts/test_place_types.py`(REQ-003): SQLite 헤더 오프셋 96의 기록 버전이 `sqlite3.sqlite_version`과 같으면 바이트, 다르면 `iterdump`로 비교한다. 통과 메시지에 `bytes` 또는 `schema+rows (written by SQLite X, running Y)`를 표시한다.
- 재생성(REQ-004): Windows Python 3.14(SQLite 3.50.4)에서 `python -X utf8 scripts/classify_place_types.py`를 실행했다. 분류기 Git blob은 변경 전과 같다. `place_types.jsonl`·`review_queue.jsonl`·`report.md`는 Git 차이가 없고, SQLite는 이전 파일(3.37.2 기록)과 `iterdump` 2,157문장이 같다. manifest 차이는 `map-ui/data/jeju-places.js` 입력 해시(`9bc89b7a…`→`932f6a39…`)와 SQLite 출력 해시(`801a4610…`→`3d36b7fd…`)뿐이다. `node scripts/build_map_ui_data.mjs` 재실행 후 지도 번들 차이는 없다.
- `scripts/run_tests.py`(REQ-005): 장소 유형 `known_failure`와 쓰이지 않게 된 `sqlite3` import를 지웠다. 두 고정 산출물 검사는 작업 사본 줄바꿈이 규칙과 다르면 다시 체크아웃할 파일을 사유로 SKIP한다.
- 문서(REQ-006): `docs/data_contracts.md` 공통 규칙·장소 유형 절, `docs/evaluation.md` 실행기 절, `docs/spec_113.md` 알려진 제한·상태(Implemented), `docs/README.md` 색인.

검증(2026-10-27):

| 검사 | Windows 변경 전 | Windows 변경 후 | Linux 변경 전 | Linux 변경 후 |
|---|---|---|---|---|
| `test_labeling_review_model.mjs` | SKIP | 통과 | 통과 | 통과 |
| `test_place_types.py` | XFAIL | 통과(바이트) | 실패(SQLite) | 통과(내용) |
| `validate_place_fit_relabel_v2.py` | 통과 | 통과 | 실패 | 통과 |
| `validate_labeling_review_ui.mjs` | 실패 | 통과 | 통과 | 통과 |
| `validate_place_profile_pilot.mjs` | 실패 | 통과 | 실패 | 통과 |
| `validate_place_profile_autolabel_v3.mjs` | 실패 | 통과 | 실패 | 통과 |
| `validate_place_profile_research_v2.mjs` | 실패 | 실패(`part_3.json`) | 실패 | 실패(`part_3.json`) |
| `validate_all_place_profiles.py` | 실패 | 실패(보호 파일·트리) | 실패 | 실패(보호 트리) |

- AC-001: Windows(`core.autocrlf=true`, Python 3.14, SQLite 3.50.4) `python -X utf8 scripts/run_tests.py` → 23 통과, 0 SKIP, 0 XFAIL, 0 실패, 78.7초.
- AC-002: WSL Ubuntu 24.04 LF clone(Python 3.12.3, SQLite 3.45.1, Node 22)에서 두 테스트가 통과하고 `python3 -X utf8 scripts/run_tests.py -k pinned` → 2 통과.
- AC-003: 위 표의 대상 검증기 4개가 양 플랫폼에서 통과한다. 변경 전 통과하던 검사(Windows의 relabel v2, Linux의 검수 UI·검수 모델)는 그대로 통과한다.
- AC-004: 위 재생성 결과.
- AC-005: 행 하나(`125445`의 `primary_type`)를 바꾼 SQLite로 Windows 바이트 비교와 WSL 내용 비교가 모두 `Stale output: place_types.sqlite3`로 실패했고 원본으로 복원했다(복원 해시 `3d36b7fd…`). WSL clone에서 두 파일을 CRLF로 바꾸면 실행기가 두 검사를 다시 체크아웃할 파일과 함께 SKIP하고, 복원 후 통과한다.
- AC-006: `python -X utf8 scripts/check_markdown_links.py` 통과(AC-001 실행에 포함).

## 설계와 달라진 점

없음. 실행기의 XFAIL 처리는 범용 기능으로 남겼으며 현재 표시된 검사는 없다.

## 알려진 제한

- `validate_all_place_profiles.py`는 줄바꿈과 무관하게 실패한다. SPEC-007 당시의 보호 트리(`map-ui` 17개 파일 등, 현재 40개)와 `labeling-review`가 이후 SPEC에서 바뀌었다. 이 검증기만 읽는 `non_restaurants.json`·`restaurants.json`·`data/labeling/jeju/2026-08-09/manifest.json`의 LF 해시는 규칙을 주지 않아 Windows 작업 사본에서 다르다. 보호 해시 갱신은 별도 결정이 필요하다.
- `validate_place_profile_research_v2.mjs`는 v2 파일럿 manifest의 `research/part_3.json` 해시가 커밋된 유일한 파일 버전의 LF·CRLF 어느 바이트와도 맞지 않아 실패한다(내용 차이). 출처 기록 정리는 별도 결정이 필요하다.
- 읽는 검사가 없는 계보 manifest(`manifest.rules-v1.json`, relabel v2 하위 배치·보정 manifest, v5 장소 리뷰)는 LF·CRLF 해시가 섞여 있으며 규칙을 주지 않았다.
- 이 변경 전에 만든 작업 사본은 규칙이 바뀐 파일을 다시 체크아웃해야 한다. 그 전까지 실행기는 두 검사를 SKIP한다.
- 장소 유형 manifest의 JSONL·보고서 출력 해시는 CRLF 바이트라 Linux 작업 사본과 다르다. 테스트는 manifest 대신 새 생성 결과와 비교한다. SQLite 라이브러리 버전이 다른 환경에서는 바이트 수준 최신성 검사 대신 내용 검사를 하며, 같은 환경 두 번 생성의 바이트 결정성은 계속 검사한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-27 | 조사 결과·사용자 결정을 반영해 작성 |
| 2026-10-27 | `.gitattributes` 규칙, SQLite 비교 방식, 장소 유형 재생성, 실행기·문서 구현과 Windows·Linux 검증 결과 기록. Implemented |
| 2026-10-30 | SPEC-114로 작성했으나 같은 번호의 [SPEC-114](spec_114.md)(서비스 본질·제주 PoC)가 main에 먼저 반영되어 SPEC-115로 번호 변경. 본문 내용은 그대로 |
