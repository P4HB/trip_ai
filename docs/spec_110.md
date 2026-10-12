# SPEC-110: Gemini 이미지 장소 추출과 기존 메타데이터·라벨 연결

- 상태: Implemented
- 작성일: 2026-10-11
- 최종 수정일: 2026-10-12
- 승인 근거: 사용자가 Gemini API 키 등록 후 즉시 진행하도록 요청했다.
- 관련 문서: [아키텍처](architecture.md), [데이터 계약](data_contracts.md), [실행 방법](../server/instagram-import/README.md)
- 관련 코드: `server/instagram-import/`, `scripts/test_instagram_import.py`, `scripts/test_instagram_gemini.py`, `scripts/test_instagram_import_ui.cjs`, `scripts/evaluate_instagram_import.py`, `scripts/fixtures/instagram_places.v1.json`
- 선행 SPEC: [SPEC-102](spec_102.md), [전체 목표 초안 SPEC-101](spec_101.md)

## 배경

사실: SPEC-102의 EasyOCR는 인스타 게시물의 테두리 글꼴에서 장소명을 오인식한다. 사진 다운로드와 기존 catalog/41축 라벨 조회는 이미 구현되어 있다. 사용자는 로컬 OCR 대안을 검토하고 Gemini 키를 등록했다. Windows 사용자 환경변수와 이미 실행 중인 프로세스의 환경변수는 다를 수 있다.

## 목표와 비목표

Gemini가 다운로드한 각 사진의 장소명과 같은 패널에 적힌 주소를 구조화해 읽고 기존 resolver로 연결한다. 사용자 제공 단일 사진·캐러셀 게시물로 실제 API와 품질을 검증한다. 추천·일정·새 라벨 생성·catalog 보정·공개 배포·결제 설정은 이번 범위에 없다.

## 요구사항

- `REQ-001`: `GEMINI_API_KEY`가 있으면 auto 모드는 Gemini를 사용한다. 명시적 로컬 OCR 선택은 유지한다. 모델은 호출 시 설정하며 `GEMINI_MODEL`/CLI로 변경할 수 있다. 키/과금 설정은 코드·문서·결과에 저장하지 않는다.
- `REQ-002`: 각 사진을 별도로 읽고 literal 장소명·주소·지역 근거·불명확 여부를 구조화한다. 게시물 내용은 입력 데이터로만 취급하고 그 안의 지시를 실행하지 않는다. 이미지에 없는 장소·주소·좌표·라벨을 생성하지 않는다.
- `REQ-003`: API 응답을 서버에서 검증하고 성공·실패한 사진 수와 오류 코드를 기록한다. 인증·모델·할당량 오류를 표시하고 다른 모델이나 로컬 OCR로 몰래 재호출하지 않는다.
- `REQ-004`: 모델·프롬프트 버전·API 사용량·사진 근거와 추정 bbox를 추적한다. 모델 확신을 수치 정확도로 표현하지 않는다. 원문/사진/추출 중간 파일은 기존 TTL/삭제 규칙을 따른다.
- `REQ-005`: SPEC-102의 식별/주소 충돌/기존 라벨 보존 규칙을 유지한다. 판독이 불명확한 이름은 자동 연결하지 않는다. 다운로드·영상 미처리·OCR와 Gemini 분석을 구분한다.
- `REQ-006`: 단일 사진과 캐러셀을 재처리하고 수동 확인 이름과 비교한다. 메타데이터 미매칭은 인식 오류와 별도로 보고한다.
- `REQ-007`: 평가의 수동 정답은 이미지 제목의 이름에 근거하고, 공백/구두점 정규화 후 정확 일치로 비교한다. 작은 표본을 전체 정확도로 일반화하지 않는다. 중복 패널·복합 제목의 판정 규칙을 fixture에 명시한다.
- `REQ-008`: 사용자가 명시적으로 실패 사진 분석을 재시도할 수 있다. 같은 모델/프롬프트로 실패 사진만 호출하고 기존 성공 결과·이름 검수·사용자 선택을 보존한다. 사진 보관 만료·다른 모델/프롬프트는 기존 작업 재시도를 거부한다. 재시도 기록을 보존하며 자동 재호출은 없다.

## 입력과 출력

입력은 기존 인스타 HTTPS URL과 환경변수다. Google에 전송하는 것은 다운로드한 JPEG와 해당 게시물 캡션뿐이다. 작성자·댓글·쿠키·키·기존 라벨 전체를 프롬프트에 넣지 않는다. 시각은 UTC ISO 8601, catalog 좌표는 WGS84 `[longitude, latitude]`다.

기존 `instagram-place-import-v1`에 필드를 추가한다. `coverage.extraction`과 `extraction_processed_image_count`는 엔진 공통 분석 상태다. Gemini는 `coverage.ocr=not_used`, OCR 처리 수 0을 기록한다. `provenance.extraction_adapter`와 `model`, `prompt_version`, `output_schema_version`, 사진별 usage/model/오류를 보존한다. Gemini 근거는 `kind=image_model`, bbox는 픽셀 `[x,y,width,height]`이며 `bbox_source=model_estimated`다. 로컬 OCR 근거와 과거 결과는 호환된다.

## 설계와 결정

구현: Instaloader → 전체 사진 다운로드 → Gemini REST(구조화 출력, 도구 없음, 서버 측 응답 저장 비활성) → 서버 스키마 검증 → 관측 이름 중복 제거 → 기존 resolver → 기존 metadata/labels. 직접 REST 호출로 SDK 의존성은 추가하지 않는다. 1사진당 1회, 순차 호출, 자동 재시도 없음. 인증/모델/할당량 등 공통 실패 후 남은 사진을 실패로 표시하고 호출을 중단한다. 추출 결과는 별도 `extraction.json`으로 보존한다.

결정: 사용자 API 키의 모델 목록 조회에 성공했고 초기 후보 `gemini-3.8-flash`를 실제 검증했다. 최종 기본 모델은 아래 Flash-Lite 결정에 따른다. 모델 목록만으로 무료 호출 성공이나 과금 여부를 보장하지 않으므로 실제 요청을 검증하고 과금 설정을 변경하지 않는다. 프로세스 환경변수가 없으면 Windows 사용자 환경변수에서 키/모델을 읽어 이미 열린 터미널에서도 설정을 사용할 수 있다.

실행 결정: 3.8 Flash 실제 단일 사진 성공 후 캐러셀 도중 무료 일일 20회 제한에 도달했다(요청 형식 진단 포함). API가 약 17시간 후 재시도를 안내했다. 결제 없이 검증을 이어가기 위해 공식 무료 지원 모델 `gemini-3.1-flash-lite`를 명시적으로 선택해 별도 평가한다. 실행 시 모델 지정이며, 실패 후 자동 모델 변경 기능은 추가하지 않는다.

실행 중 작업 진행 상태 저장에서 일시적인 Windows `PermissionError`가 관측되었다. 로컬 JSON의 원자적 교체만 짧게 최대 3회 재시도한다. API 요청 재시도와 별개이며, 계속 잠겨 있으면 오류를 숨기지 않는다.

Flash-Lite 평가에서 소개 제목 외에 배경의 이웃 가게 간판이 추가 후보로 나왔다. 프롬프트 v2는 소개 제목이 있으면 그 제목만 읽고 주변 간판/출처 계정/워터마크를 제외한다. 제목이 없는 일반 사진의 명확한 간판은 읽을 수 있다. SPEC의 장소 범위를 사진에 등장하는 모든 상호로 확대하지 않는다.

최종 기본 모델 결정: 무료 환경에서 실제 이미지 분석을 검증한 `gemini-3.1-flash-lite`를 기본값으로 사용한다. `gemini-3.8-flash`는 `GEMINI_MODEL`/`--model`로 명시적으로 선택할 수 있다. 실패 시 자동 모델 교체 정책은 없다.

## 예외와 폴백

키 없음은 auto의 기존 EasyOCR 경로다. 명시적 Gemini에 키가 없으면 `gemini_key_missing`이다. 사진 일부 실패는 `partial`; 빈 정상 결과는 장소 0개다. 응답이 잘리거나 스키마가 틀리면 해당 사진은 실패다. 오류 메시지/응답 원문/요청 헤더/키는 사용자에게 노출하지 않고 고정 오류 코드만 저장한다. 주소 충돌·동명이점은 검토, 없는 catalog 장소는 `not_found`, 없는 라벨은 `labels_missing`다.

## 영향 범위

- 변경 파일: Gemini 어댑터, 기존 pipeline/extractor/HTTP/CLI/UI, 관련 테스트·기준 문서·실행 문서.
- 마이그레이션: 없음. 기존 작업 JSON은 읽을 수 있다. 기존 catalog·라벨·지도 번들 변경 없음.
- 보안·개인정보: 승인된 Gemini 전송이 추가된다. API 키는 환경변수와 메모리에만 두고 고정 Google 호스트에 헤더로 전송한다. HTTP redirect를 거부한다. API 제공자의 데이터 정책은 로컬 TTL과 별개다.

## 승인 기준과 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| `AC-001` 키 자동 선택/모델 설정/비밀 비노출 | 어댑터·설정·오류 테스트, 실제 모델 조회 | `python scripts/test_instagram_gemini.py` |
| `AC-002` 구조화 응답 검증/중복/주소 충돌/불명확 이름 | 고정 응답 fixture 회귀 | 동일 |
| `AC-003` 일부 실패·quota 중단·usage·TTL·구 UI 호환 | pipeline/HTTP/UI 테스트 | 동일, `python scripts/test_instagram_import.py`, `node scripts/test_instagram_import_ui.cjs` |
| `AC-004` 기존 metadata/labels 보존 | 기존 테스트와 결과 검토 | `python scripts/test_instagram_import.py` |
| `AC-005` 실제 사진 분석과 이름 품질 확인 | 사용자 두 링크 실제 실행·수동 이름 비교 | 로컬 `.data/` 작업 결과, 아래 구현 결과 |
| `AC-006` 실패 사진만 수동 재시도·검수 보존 | 1장 실패 fixture와 실제 캐러셀 재시도, UI | `python scripts/test_instagram_gemini.py`, `node scripts/test_instagram_import_ui.cjs` |

## 구현 결과

- `gemini.py`: 표준 라이브러리 Interactions REST, 기본 `gemini-3.1-flash-lite`, 프롬프트 `instagram-literal-places-v2`, 키·모델 환경변수/Windows 사용자 환경변수 읽기, 고정 오류, 60초 timeout, 2MiB 응답 상한, redirect 거부, 비밀키 비노출.
- `core.py`/`extractor.py`: 모델 구조화 장소와 OCR 경로 공존, 공통 coverage, 이름/근거/필드 검증, 같은 이름의 주소·도시 충돌 분리, 불명확 이름 자동 연결 방지, 기존 resolver/labels 재사용.
- `app.py`/`web/`: auto/모델 CLI, 엔진 health, 사진별 분석 상태·한도 오류 표시, 실패 사진만 수동 재시도, 재시도 이력·검수 보존. 기존 24시간/7일 TTL·삭제에 `extraction.json` 포함.
- `scripts/fixtures/instagram_places.v1.json`/`scripts/evaluate_instagram_import.py`: 원본 이미지의 소개 제목 수동 정답과 이름 정확 일치 평가. catalog 연결 수는 별도 지표다.

실제 검증은 2026-10-11 사용자 URL을 새로 다운로드해 수행했다. 이전 EasyOCR 작업과 새 작업의 JPEG SHA-256이 두 게시물 모두 동일하다. 최종 결과는 같은 Flash-Lite/프롬프트 v2다.

| 게시물 | 사진 다운로드/분석 | 이름 정확 일치: EasyOCR → Gemini | 기존 metadata 자동 연결 | 기존 라벨 연결 | 검토/미매칭 |
|---|---|---|---|---|---|
| `DdvUunhprFx` | 1/1, 1/1 | 5/10 → 10/10 | 5 → 7 | 5 → 7 (각 41축) | 3 / 0 |
| `DEhnuo1KmAd` | 8/8, 8/8 | 6/16 → 16/16 | 2 → 4 | 0 (음식점 기존 라벨 없음) | 4 / 8 |

캐러셀은 영상 1개·사진 8개이며 영상은 분석 제외다. 제목 패널 17개 중 같은 문개항아리 제목/주소 2패널은 하나로 묶어 고유 이름 16개다. 소개 문구의 총 장소 수를 이미지 정답 수로 사용하지 않았다. 프롬프트 v2 첫 분석은 사진 1장이 응답 검증에 실패했고, HTTP 수동 재시도로 그 1장만 추가 호출하여 분석 8/8을 확인했다. 캐러셀에 기존 라벨을 새로 만들지 않았다. 주소가 서로 다른 문개항아리 후보도 자동 연결하지 않았다.

최종 로컬 작업(보관 기간 후 삭제 가능):

- 단일: `server/instagram-import/.data/3742168add974a9dbb5a415fceac14e7/job.json`
- 캐러셀: `server/instagram-import/.data/a6b021e3c6c14e0b8f4f23f3e7b0eceb/job.json`
- 비교 기준: SPEC-102의 기존 단일/캐러셀 작업. 평가 명령: `python scripts/evaluate_instagram_import.py <job.json> --baseline <기존-job.json>`

검증 결과:

- `python scripts/test_instagram_import.py`: 기존 16개 통과 (`AC-003`, `AC-004`).
- `python scripts/test_instagram_gemini.py`: 15개 통과 (`AC-001`~`AC-004`, `AC-006`), 실패 사진만 호출·검수 보존·만료/모델 변경 거부·지속 파일 잠금 실패 포함.
- `node scripts/test_instagram_import_ui.cjs`: XSS·기존 coverage·N/A·Gemini 상태/한도·재시도 버튼 통과.
- `python -m py_compile server/instagram-import/app.py server/instagram-import/core.py server/instagram-import/gemini.py server/instagram-import/extractor.py scripts/evaluate_instagram_import.py`, `node --check server/instagram-import/web/app.js`: 통과.
- 실제 models 조회, HTTP 링크 처리·health·수동 재시도, 두 이미지 집합의 이름 평가 통과 (`AC-001`, `AC-005`, `AC-006`). 코드/문서/런타임 결과·로그 32파일의 실제 키 포함 여부 검사: 발견 0. 키 값을 출력하지 않았다.

- 2026-10-12: 최신 `origin/main` (`649167d4`) 기반의 분리된 작업 디렉터리에서 위 Python 31개·UI 회귀·Python/JavaScript 문법 검사를 다시 실행해 모두 통과했다. API 재호출 없이 이번 변경만 검증했고, 기존 음식점 SPEC-103~109를 보존한 채 SPEC-110과 문서 색인을 갱신했다.

## 설계와 달라진 점

실제 API가 null union/배열 길이/추가 속성 금지 조건이 포함된 전체 JSON Schema를 400으로 거부했다. 기본 타입·필수 필드로 줄인 스키마와 같은 모델/생성 설정은 성공했다. 외부 요청은 기본 스키마, 없는 주소/지역은 빈 문자열로 표현하고 서버에서 null로 변환한다. 길이·필드·좌표·근거 검증은 서버에서 엄격하게 수행한다. 자동 스키마 폴백이나 모델 교체는 하지 않는다.

## 알려진 제한

두 게시물 26개 이름의 결과는 이 표본에만 적용된다. Gemini도 판독 오류/누락이 가능하고 기본 스키마에 맞지 않는 응답은 수동 재시도가 필요할 수 있다. bbox는 추정 위치이며 인식 확률이 아니다. 게시물 접근 및 API 한도는 외부 상태에 달려 있다. 3.8 Flash는 이 프로젝트에서 실제 무료 일일 20회 제한을 관측했으며 다른 프로젝트/모델에 일반화하지 않는다. 음식점 미매칭과 라벨 부재는 Gemini가 해결하는 범위가 아니다. 운영 도입 전 API 제공자의 데이터 처리 조건과 사용자 동의 UI를 결정해야 한다. 개인 저장·추천 연결·운영 배포는 SPEC-101 후속 범위다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-11 | 사용자 승인 범위에 따라 Gemini 전환 SPEC 작성 |
| 2026-10-11 | 실제 API 스키마 호환 검증, Flash-Lite 기본값, 소개 제목 범위·수동 재시도 추가, 31개 Python 테스트/UI 및 두 게시물 검증 완료 |
| 2026-10-12 | 원격 저장소의 음식점 SPEC-103과 번호 충돌을 확인하여 SPEC-110으로 이동하고 링크 조정. 최신 origin/main 위에서 이번 변경만 검증·push |
