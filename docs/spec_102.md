# SPEC-102: 인스타 링크의 전체 사진 수집·장소 추출·기존 메타데이터와 라벨 연결 v1

- 상태: Implemented
- 작성일: 2026-10-05
- 최종 수정일: 2026-10-05
- 관련 이슈: 캐러셀 다운로드 성공 시 메타데이터 확인·기존 라벨 연결까지 구현하라는 사용자 요청
- 관련 문서: [설계 정본](spec_101.md), [데이터 계약](data_contracts.md), [아키텍처](architecture.md), [안전·개인정보](safety_privacy.md)
- 관련 코드: `server/instagram-import/`, `scripts/test_instagram_import.py`, `scripts/test_instagram_import_ui.cjs`
- 선행 SPEC: [SPEC-101](spec_101.md), [SPEC-022](spec_022.md)

## 배경

SPEC-101은 전체 목표 설계다. 작업 시작 시 온라인 import 모듈은 없었고, 사용자가 캐러셀 `DEhnuo1KmAd`의 모든 사진 다운로드를 검증한 뒤 웹 링크 입력 → 장소 추출 → 메타데이터 확인 → 기존 라벨 연결을 구현하도록 명시했다.

사실: 2026-10-05 비로그인 Instaloader 4.15.3의 메타데이터는 GraphSidecar 9개이며 사진 8개·영상 1개다. 8개 사진 모두 HTTP 200, JPEG 1080×1350으로 다운로드·Pillow 검증에 성공했다. 첫 영상은 미처리다. 단일 사진 `DdvUunhprFx`도 앞선 진단에서 1440×1798 전체 이미지 확보에 성공했다.

결정: 현재 저장소의 Python 수집기와 별도 정적 지도 UI를 유지하고, 독립된 로컬 Python HTTP 서비스·웹 입력 화면을 구현한다. 한국어 OCR은 로컬 EasyOCR ko/en adapter를 우선 사용하고 Windows.Media.Ocr를 선택 adapter로 제공한다. Windows OCR 실험에서 테두리 글꼴의 장소명 오인식이 많아 기본 경로를 변경했다. 외부 모델 API 키 없이 코드로 실행한다. Linux/운영 배포·계정 체계·원격 AI API 도입은 이번 범위를 임의 확대하지 않는다.

## 목표

- 링크 한 개에서 모든 사진을 순서대로 다운로드하고 성공 수와 전체 수를 검증한다.
- 캡션·사진 OCR에서 근거를 가진 장소를 추출하고 중복 근거를 합친다.
- 기존 TourAPI·Kakao 메타데이터 스냅샷에서 장소 후보·주소·경도/위도·도시를 확인하고 정확한 기존 ID에 라벨을 연결한다.
- 모호함·미매칭·기존 라벨 없음·영상 미처리를 결과와 화면에서 구분한다.
- 링크 입력·비동기 진행·사진/근거·메타데이터/라벨 결과·JSON 내보내기를 로컬 웹에서 사용한다.

## 비목표

- 신규 라벨 생성, 공용 장소 원본 수정, 개인 위시리스트, 추천·일정, 모바일 공유·DM, 영상/음성 분석
- 공개 배포·사용자 인증·지속 운영 큐, 모든 인스타 링크의 성공 보장
- 최신 영업시간·가격·휴무의 추측 또는 기존 스냅샷을 오늘 확인한 온라인 사실로 표시
- 사진에 이름 없는 장소의 확정, OCR 오타를 사실처럼 보정

## 요구사항

- `REQ-001`: HTTPS 인스타 p/reel/tv 링크를 정규화해 shortcode로 조회한다. 임의 호스트·포트·사용자정보·경로는 거부한다.
- `REQ-002`: 사진 전부 순회·다운로드·decode·SHA-256·순서·시각을 기록한다. 영상은 제외 수를 표시하며 일부 실패/열거 수 불일치를 전체 성공으로 보고하지 않는다.
- `REQ-003`: 로컬 한국어 OCR에서 텍스트·단어 위치를 읽고 캡션 및 사진별 근거 위치를 연결한다. 텍스트 없는 이미지를 장소 이름으로 만들어내지 않는다. adapter 실패도 결과에 남긴다.
- `REQ-004`: 기존 이름/별칭 후보와 제목·해시태그·주소 패턴을 사용하되 본문 광고/작성자 아이디를 장소로 확정하지 않는다. 같은 장소의 반복 근거를 합친다.
- `REQ-005`: 기존 catalog 이름+지역/주소/유형 근거를 확인한다. 이름만 같은 후보, 복수 후보, 부분문자열은 needs_review이고 미매칭은 not_found다. 사용자 후보 선택은 실제 제공 후보 중 하나에 한정한다. OCR 오인식은 원 관측 이름/근거를 유지하고 사용자 수정 이름으로 후보를 다시 조회한다.
- `REQ-006`: 메타데이터의 원본 ID·출처·스냅샷 날짜/확인일·WGS84 경도 다음 위도·도시·freshness를 보존한다. 스냅샷 연결과 실시간 운영정보를 구분한다.
- `REQ-007`: 기존 TourAPI 24+5+12축 및 선택적 Kakao validated v3를 읽기 전용으로 연결한다. 값·N/A·confidence·판정·근거·버전을 유지하고 부재/불완전 상태를 구분한다. 새 축/값을 생성하지 않는다.
- `REQ-008`: CLI와 loopback 웹의 공통 파이프라인·진행 단계·부분 결과·JSON 내보내기를 제공한다. 결과 후보 선택으로 기존 ID·라벨을 연결할 수 있다.
- `REQ-009`: 다운로드 host·DNS/IP·redirect·바이트/픽셀·시간 제한, 외부 텍스트 escaping, UUID 경로 격리, 같은 출처 쓰기 요청 검증을 적용한다. CDN 서명·작성자·댓글·쿠키를 결과/로그에 저장하지 않는다.
- `REQ-010`: 처리 결과는 독립 로컬 작업 저장소에 원자적으로 보관한다. 원문/이미지 24시간·결과 7일의 정리와 작업 삭제를 제공한다. 재시작 시 진행 작업은 중단 상태로 정리한다.

## 입력과 출력

`POST /api/imports {url}` → 202 `{job_id}`. `GET /api/imports/{id}` → 처리 단계·결과. `POST /api/imports/{id}/resolve {mention_id, candidate_id}` → 기존 후보를 명시적으로 연결. `POST /api/imports/{id}/review-name {mention_id, name}` → 원문을 보존하며 수정 이름으로 후보 재조회. `DELETE /api/imports/{id}` → 작업·사진·OCR·결과 삭제. `GET /api/imports/{id}/assets/{order}` → 검증된 작업 사진. `GET /api/imports/{id}/export` → 결과 JSON. `GET /api/health` → catalog/OCR 상태. CLI는 `python server/instagram-import/app.py import URL --output DIR`, 웹은 `... serve --port 8091`이다.

결과 계약 `instagram-place-import-v1`: source의 canonical URL·shortcode·수집 시각·caption, coverage의 reported/enumerated media·expected/downloaded image·영상 수·enumeration/images/carousel/video 상태, assets의 순번·형식·크기·digest·다운로드 상태, mentions의 이름·주소/지역 힌트·근거·후보·resolution·metadata·labels, warnings, catalog/라벨/추출기 버전과 해시. signed CDN URL은 제외한다.

metadata: provider·provider ID·canonical ID·name·address·longitude·latitude·city·category·source URL·checked_at/source_date·verification=snapshot_match·operational_status=unknown. coordinates는 `[longitude, latitude]`, WGS84. 모호/미매칭의 확정 metadata와 labels는 null이다. 라벨은 count/expected_count·status·version·원본 축/출처. 연결 완료도 추천/방문 자격을 보장하지 않는다.

## 설계

구현됨: `input → Instaloader acquisition → bounded image download → local Korean OCR → evidence-backed mentions → catalog candidates → identity check/user selection → metadata + existing labels`.

- Python stdlib HTTP server는 `127.0.0.1`에만 bind한다. 일단 동시 처리 한 작업으로 제한하고 백그라운드 작업을 순차 처리한다. 인증 없는 인터넷 노출은 지원하지 않는다.
- 모듈: acquisition/downloader, EasyOCR adapter+선택 PowerShell WinRT bridge, catalog/labels, extractor/resolver, job store/HTTP/CLI, 독립 웹 화면. 기존 지도/추천 서버를 변경하지 않는다. EasyOCR 모델은 초기 실행 시 공식 배포 파일을 로컬 cache에 받고 이미지 자체를 외부 OCR 서비스로 전송하지 않는다.
- catalog는 `map-ui/data/jeju-places.js`의 JSON 대입식을 코드 실행 없이 파싱한다. SHA-256·metadata 날짜를 보존한다. 선택적 기존 Kakao v2 상세 스냅샷/v3 validated 파일도 provider ID로 연결하되 TourAPI/Kakao ID를 임의 병합하지 않는다.
- OCR word bbox에서 제목·번호·주소·해시태그 근거를 식별한다. 사전에 없는 제목/해시태그도 후보 mention으로 보존하며 근거 없는 fuzzy 매칭 자동 확정을 금지한다.
- 사진 레이아웃의 같은 칸·같은 줄에서 겹치거나 분리된 제목 조각과 해시태그를 합친다. 제목과 본문 크기를 구분해 설명 속 기존 장소명이 별도 방문 대상으로 추출되지 않게 하고, 제주도/제주시 같은 지역명은 지역 힌트로만 사용한다. 주소 문맥도 인접 칸과 섞지 않는다.
- 테두리 글꼴은 원 이미지·밝은 글자 분리·연결 성분의 큰 테두리 제거를 로컬 OCR에서 비교한다. 낮은 OCR confidence의 큰 제목도 검토 후보로 남겨 조용히 누락하지 않는다. confidence는 인식기 내부 신호이며 장소 동일성 확률이 아니다.
- `name_status=review_required`는 낮은 OCR 인식 신호이고 `resolution`은 catalog 식별 상태다. 불명확한 제목은 원문/근거·이름 수정 입력을 유지한다. 후보가 없으면 `not_found`, 유사/복수/충돌 후보이면 `needs_review`다. 낮은 OCR 신호 자체를 장소 동일성 확률로 사용하거나 미매칭과 혼합하지 않는다. 이미 연결된 장소도 읽은 이름을 수정할 수 있다.
- 이름+주소/지역/유형 등 독립 단서가 일치한 유일 후보는 snapshot_match로 연결한다. 짧거나 모호한 이름은 후보 선택을 요구한다. 인스타 표기 주소는 source claim이며 검증 catalog 주소와 별도 보존한다.
- 원본 상태/라벨값을 유지하고 라벨 부재는 labels_missing, 부분 축은 labels_incomplete다. 식당이라고 관광지/카페 라벨을 억지 연결하지 않는다.
- 런타임 저장소 `server/instagram-import/.data/`는 Git 제외다. 원본은 다운로드 후 검증·저장하며 TTL 삭제 후 결과의 근거에는 expired 상태를 표시한다. active 작업은 정리/삭제 중 원자적 결과 commit을 차단한다.
- Windows 읽기 전용 작업 폴더/파일은 검증된 작업 경로 안에서 쓰기 속성을 복원해 삭제한다. 잠금 등으로 삭제가 계속 실패하면 `delete_failed` 상태·고정 HTTP 오류를 보존해 재시도를 허용한다. 삭제 중/실패 작업에는 worker 결과를 다시 commit하지 않는다. TTL의 삭제 실패도 다른 요청을 끊지 않는다.
- UI는 진행·사진 수/영상 제외·추출 근거·확정/검토/미매칭·주소/좌표/도시·출처 날짜·기존 라벨 값을 보여준다. API나 라이브러리 설명은 사용자 결정에 필요한 경우만 표시한다.

## 예외와 폴백

- invalid_url → 400, fetch 금지. metadata 실패 → content_unavailable, 파일 다운로드 일부 실패 → partial_media.
- 영상 → not_processed, 사진 8개 성공도 영상까지 분석 완료라고 표시하지 않는다.
- OCR 불가/빈 텍스트 → extraction_unavailable/no_place_mentions. 캡션 기반 부분 결과를 보존한다.
- 동일명/지역 충돌/부분 이름 → needs_review. 선택적 Kakao 파일 부재는 TourAPI로 처리한다.
- 최신 운영 정보·라벨 부재 → unknown/labels_missing. 신규 라벨링 작업은 생성하지 않는다.
- job 삭제/TTL/재시작 → deleted/expired/interrupted. 임의 파일 접근·외부 출처 POST는 거부한다.

## 영향 범위

- 변경 파일: `server/instagram-import/{app.py,core.py,catalog.py,extractor.py,ocr_windows.ps1,requirements.txt,README.md,web/}`, `scripts/test_instagram_import.py`, `scripts/test_instagram_import_ui.cjs`, `docs/spec_102.md`, `docs/{README.md,spec_101.md,architecture.md,data_contracts.md}`, `.gitignore`
- 데이터 마이그레이션: 없음. 기존 장소·라벨·bundle은 읽기 전용. 런타임 작업 파일만 새로 생성한다.
- 호환성 영향: 기존 추천/지도/피드백 동작 변화 없음.
- 보안·개인정보 영향: 로컬 링크 처리·임시 OCR/사진. 외부 AI 전송·쿠키·작성자 수집 없음. 삭제/TTL·최소 로그 적용.

## 승인 기준

- `AC-001` (REQ-001~002): 두 실제 링크에서 단일 사진 1/1·캐러셀 사진 8/8을 다운로드·decode하고 총 9개 중 영상 1개는 not_processed로 표시한다.
- `AC-002` (REQ-003~004): 단일 포스터의 장소 10개, 캐러셀 사진의 실제 제목/주소 블록을 근거로 추출하고 반복 장소를 합친다. 사진의 17개 블록 중 문개항아리 중복을 제외한 16곳을 시각 정답 후보로 비교한다. OCR 표기가 불명확한 이름은 원문·이름 검토 표시(`name_status`)를 유지하며 catalog 식별 상태(`resolution`)와 구분한다. 캡션의 18곳 문구를 실제 18개 추출로 표시하지 않는다.
- `AC-003` (REQ-005~006): 모호한 이름/지점·주소 충돌을 자동 확정하지 않는다. 사용자 선택은 허용 후보만 받는다. metadata/도시/좌표/출처/날짜가 기존 record와 일치한다.
- `AC-004` (REQ-007): 라벨 41축의 원본 값·N/A·상태·출처를 유지하고 기존값 변경 없이 연결한다. 라벨 없는 음식점 fixture는 labels_missing이다.
- `AC-005` (REQ-008): 로컬 HTTP에서 제출→진행→결과→후보 선택→JSON 다운로드→삭제와 사진 조회를 검증하고 CLI도 같은 결과 계약을 사용한다.
- `AC-006` (REQ-009): URL 변형·SSRF·다운로드 크기/형식·파일 경로·외부 origin·HTML 주입 fixture를 거부하고 signed URL/비밀을 결과에 남기지 않는다.
- `AC-007` (REQ-010): 삭제/TTL/중단 작업·원자적 저장 fixture, 별도 결과 보존과 원문 만료를 확인한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001~004/006~007 | 네트워크/가짜 OCR·catalog 독립 fixture | `python scripts/test_instagram_import.py` |
| AC-001~004 | 실제 2링크·다운로드 manifest·로컬 OCR·시각 정답 | `python server/instagram-import/app.py serve --port 8091` → `POST /api/imports` / 로컬 작업 JSON과 이미지 |
| AC-005~006 | HTTP 통합·외부 HTML 문자열을 실제 렌더러에 입력하는 DOM fixture·정적 구문 | 같은 unittest, `node scripts/test_instagram_import_ui.cjs`, `node --check server/instagram-import/web/app.js` |
| 전체 | Python 구문·diff 검사 | `python -m py_compile server/instagram-import/*.py scripts/test_instagram_import.py`, `git diff --check` |

## 구현 결과

승인된 로컬 범위를 구현했다. 웹 링크 입력·순차 작업·코드 수집·사진별 OCR·근거/후보·이름 수정/후보 선택·metadata/기존 라벨·JSON 내보내기·삭제를 제공한다. 저장소의 2,153개 TourAPI record와 선택적 2,374개 Kakao record를 읽기 전용으로 조회한다. 공급자 record 총 4,527개이며 실제 중복 장소를 통합한 개수는 아니다.

### 실제 링크 검증 — 2026-10-05

최종 코드의 로컬 HTTP 파이프라인에 두 실제 링크를 다시 제출했다. 브라우저는 수집에 사용하지 않았고 결과 화면만 확인했다.

| 링크 shortcode | 사진 수집·decode/OCR | 제목 블록 → 장소 후보 | 자동 metadata 연결 | 기존 라벨 |
|---|---|---|---|---|
| `DdvUunhprFx` | 1/1, JPEG 1440×1798 | 10 → 10 | 5 resolved, 5 needs_review | 연결된 5곳 각각 41/41축 |
| `DEhnuo1KmAd` | 8/8, 각 JPEG 1080×1350. 영상 1개 미처리 | 17 → 16, 문개항아리 두 근거 통합 | 2 resolved, 2 needs_review, 12 not_found | 노라바·놀맨의 metadata는 연결, 기존 라벨 없음 |

이 수치는 제목 블록 검출과 catalog 식별을 구분한다. 캐러셀 16개 후보가 모두 올바른 이름/metadata로 확정됐다는 뜻이 아니다. 테두리 글꼴 때문에 `온평바다한피릇`, `제주심만복` 등 오인식이 남고, catalog 자체에 없는 음식점도 있다. 오인식·미매칭은 화면에서 원문/사진과 대조해 이름을 수정할 수 있다. 문개항아리는 사진 주소가 후보 본점 주소와 달라 자동 연결하지 않았다. 캡션 18곳 문구를 실제 추출 수로 사용하지 않았다.

실제 자동 연결 7곳의 metadata와 labels를 각각 현재 Catalog 원본 조회 결과와 전체 객체 동등 비교해 통과했다. 원본 ID·주소·경도/위도·도시·source date·41축 값/출처가 유지된다. 사용자 선택/이름 수정 성공을 위 자동 연결 수에 합산하지 않았다.

초기 실제 대조에서 발생한 지역명/본문 장소의 오검출과 긴 제목 분할을 보정한 뒤, 동일 구조의 독립 2분할 fixture로 회귀를 고정했다. 외부 HTML 문자열은 실제 UI 렌더러에 입력한 DOM fixture에서 텍스트로만 남고 `javascript:` 출처 링크도 생성되지 않았다. 로컬 브라우저에서 첫 링크의 10개 후보/41축 표시와 캐러셀의 16개 후보/사진 8장·영상 제외/라벨 부재 표시를 확인했다.

### 테스트 결과

| 승인 기준 | 결과 |
|---|---|
| AC-001~002 | 실제 두 링크의 전체 사진 다운로드·decode·OCR 완료, 위 시각 블록 대조 통과. 사진/영상 범위 구분 |
| AC-003~004 | 실제 7곳의 metadata/labels snapshot 동등성, 유사명/주소/도시 충돌·화면 후보 상한 밖 동명 지점·41축 값/N/A·라벨 부재 fixture 통과 |
| AC-005 | CLI JSON 계약·HTTP 제출/진행/사진/수정/선택/내보내기/삭제 통합 fixture, 실제 결과 화면 확인 통과 |
| AC-006~007 | URL/SSRF/이미지 형식·크기/경로/origin·HTML 텍스트·서명 URL 미저장, 삭제/만료/재시작/진행 작업 삭제 fixture 통과 |

- `python scripts/test_instagram_import.py`: **16 tests OK**. 실제 Windows 읽기 전용 디렉터리/파일과 잠금 삭제 실패→고정 HTTP 오류→재시도·worker 재생성 방지도 포함한다.
- `node scripts/test_instagram_import_ui.cjs`: untrusted text·source URL·N/A·coverage 검증 통과.
- `python -m py_compile server/instagram-import/app.py server/instagram-import/core.py server/instagram-import/catalog.py server/instagram-import/extractor.py scripts/test_instagram_import.py`: 통과.
- `node --check server/instagram-import/web/app.js`: 통과.
- 관련 diff/신규 소스의 공백·문서 링크 검사: 통과. 기존 지도/라벨 데이터를 변경하거나 재생성하지 않았다.

실행·의존성·HTTP 계약은 [모듈 README](../server/instagram-import/README.md)를 따른다. 테스트 결과는 위 두 실제 게시물과 독립 fixture 범위이며 일반 게시물 전체 품질을 보장하지 않는다.

## 설계와 달라진 점

전체 SPEC-101 중 이번 승인 범위만 독립 로컬 서비스로 구현했다. 공용 DB/개인 저장·운영 큐/인증·추천·일정은 후속이다. 비밀키가 없는 현재 환경에서 로컬 한국어 OCR를 사용한다. Windows OCR의 실제 오인식 때문에 EasyOCR를 기본으로 변경했고 기존 Windows bridge도 선택 경로로 보존한다. OCR 인식 신호와 catalog 식별 상태는 별도 필드로 구체화했다. 미매칭을 모두 동명이점처럼 표현하지 않고 원문·이름 검토·수정 흐름을 제공한다.

## 알려진 제한

- OCR 오인식·시각적 장소 식별·영상 내용·일반 자유형 게시물의 추출 품질은 보장하지 않는다. 미확인 결과와 근거를 보존한다.
- 기본 메타데이터 확인은 기존 catalog 스냅샷 대조다. 실시간 영업/폐업/가격 확인을 뜻하지 않는다.
- 실제 캐러셀은 음식점 게시물로 기존 비음식점/카페 중심 라벨의 coverage가 낮고 테두리 글꼴 오인식이 많다. OCR 모델 평가·범용 레이아웃/해외 확장·온라인 장소 검색은 후속이다. 이 첫 버전만으로 모든 후보의 좌표/라벨을 채우지 않는다.
- 다운로드된 사진은 전체 프레임으로 검증했지만 저장 파일은 EXIF를 제거한 정규화 JPEG다. 업로드 전 원본 파일과 바이트 단위 동일성을 보장하지 않는다.
- 웹 TTL은 서버 실행/요청 시 정리하며 서버 중단 중 물리 삭제는 다음 실행까지 지연된다. CLI 명시 출력은 사용자가 보관/삭제한다.
- 운영 서버의 Linux OCR adapter·인증·공개 배포·외부 공급자 재검증은 후속 SPEC이 필요하다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-05 | 사진 8/8 다운로드 검증 성공 후 사용자 승인 범위의 구현 계약·승인 기준·테스트 계획 작성 |
| 2026-10-05 | 실제 사진의 테두리 글꼴 오인식 확인 후 기본 OCR를 로컬 EasyOCR로 변경. 사진 17개 장소 블록·동일 장소 중복과 캡션 18곳 문구를 구분 |
| 2026-10-05 | 사용자가 API 키 없이 로컬 OCR 진행을 확정. 오인식 이름의 원문 보존·수정 이름 후보 재조회 흐름 추가 |
| 2026-10-05 | 두 실제 링크의 최종 다운로드/OCR·제목 블록·메타데이터/라벨 대조와 UI fixture 완료. 지역/본문 오검출·제목 분할 보정 및 OCR 이름 검토와 식별 상태를 구분해 실제 구현 동기화 |
| 2026-10-05 | 최종 정리 중 Windows 읽기 전용 폴더 삭제 실패를 확인해 검증 경로 안에서 속성 복원·잠금 실패 재시도·worker 취소 유지·고정 HTTP 오류를 보정. 16개 테스트 통과 |
| 2026-10-05 | Git push 준비: 기존 전역 `web/` 제외 규칙에서 이 모듈의 정적 웹 소스만 예외 처리. 작업 데이터·OCR 모델·로컬 의존성은 계속 제외하고 최신 원격 main의 다른 변경을 보존해 병합 |
