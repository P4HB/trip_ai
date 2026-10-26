# Instagram 장소 가져오기

[SPEC-102](../../docs/spec_102.md)의 사진 수집·연결에 [SPEC-110](../../docs/spec_110.md)의 Gemini 이미지 판독을 추가한 로컬 서비스다. 링크 하나 → 전체 사진 다운로드 → 장소 후보 → 기존 스냅샷 메타데이터·41축 라벨 연결까지 처리한다. 개인 저장·추천·일정·신규 라벨 생성은 없다.

[SPEC-111](../../docs/spec_111.md): HTTP/CLI는 `app.py`, 작업 상태·취소·보존 관리는 `job_store.py`에 분리했다. 지도 번들의 간결한 값과 `data/catalogs/map-label-evidence.json.gz`의 전체 근거를 함께 읽고 해시를 검증한다. 근거 파일은 `node scripts/build_map_ui_data.mjs`로 재생성한다.

## 실행

현재 작업 환경에는 격리된 `.deps/`와 OCR 모델 cache가 준비되어 있다. 저장소 루트에서 실행한다.

```powershell
python server/instagram-import/app.py serve --port 8091
```

`http://127.0.0.1:8091`에서 인스타 링크를 입력한다. 서버는 loopback에만 bind하며 기존 지도/피드백 서버와 독립적이다.

기본 `auto` 모드는 `GEMINI_API_KEY`가 있으면 Gemini, 없으면 EasyOCR를 사용한다. Windows에서는 프로세스 환경변수가 없을 때 사용자 환경변수도 읽는다. 환경변수를 바꾼 뒤에는 서버를 재시작한다. 키는 파일·로그·결과·브라우저에 저장하지 않는다.

기본 모델은 `gemini-3.1-flash-lite`이며 `GEMINI_MODEL` 또는 `--model`로 호출 시 선택한다. 다음 명령은 Gemini 사용을 명시한다. 3.8 Flash를 비교하려면 모델 ID를 `gemini-3.8-flash`로 변경한다.

```powershell
python server/instagram-import/app.py --extractor gemini --model gemini-3.1-flash-lite serve --port 8091
```

Gemini는 사진마다 1회 순차 요청한다. 다운로드한 JPEG와 최대 5,000자의 캡션을 Google API에 전송한다. 도구·파일 업로드·응답 저장은 사용하지 않는다(`store=false`). API 제공자의 데이터 처리 정책은 로컬 보관 정책과 별개다. 프로젝트별 한도/사용 가능 모델을 따르며 무료 호출이나 무료 한도를 보장하지 않는다. 인증·모델·한도 오류는 남은 호출을 중단하며, 다른 모델이나 OCR로 자동 전환하지 않는다. 비용/결제 설정은 변경하지 않는다.

다른 PC 또는 깨끗한 환경은 Python 3.10 이상과 아래 격리 환경을 사용한다. Gemini는 Python 표준 라이브러리 REST를 사용하여 추가 SDK가 필요 없다. 로컬 EasyOCR를 선택하면 첫 실행 때 공식 배포 주소에서 모델 파일을 다운로드하며 API 키 없이 로컬에서 처리한다.

```powershell
python -m venv server/instagram-import/.venv
server/instagram-import/.venv/Scripts/python.exe -m pip install -r server/instagram-import/requirements.txt
server/instagram-import/.venv/Scripts/python.exe server/instagram-import/app.py serve --port 8091
```

Windows 한국어 OCR를 비교할 때는 `python server/instagram-import/app.py --ocr windows serve --port 8091`을 사용한다. 이 경로는 Windows의 한국어 OCR 언어팩이 필요하며, 테두리 글꼴에서 오인식이 더 많다.

키가 있는 환경에서도 로컬 OCR를 비교하려면 `--extractor easyocr`를 지정한다. 기존 `--ocr` 옵션은 `--extractor`의 별칭으로 유지한다.

CLI에서도 같은 파이프라인을 실행할 수 있다.

```powershell
python server/instagram-import/app.py import "https://www.instagram.com/p/SHORTCODE/" --output server/instagram-import/.data/cli-result
```

CLI의 명시적 출력 디렉터리는 사용자가 보관·삭제한다. 웹 작업은 사진/원문 24시간·결과 7일 TTL과 작업 삭제를 지원한다. TTL 정리는 서버 시작과 API 접근 시 수행한다. 서버가 꺼져 있는 동안에는 다음 실행까지 물리 삭제가 지연된다.

Windows 읽기 전용 작업 파일은 해당 작업 경로 안에서 속성을 복원해 삭제한다. 다른 프로그램이 파일을 잠그고 있으면 오류를 표시하며, 파일을 닫은 뒤 작업 삭제를 다시 누를 수 있다. 삭제 실패 상태의 worker가 결과를 다시 저장하지 않는다.

## 결과 확인

- 사진 수와 다운로드 성공 수를 별도로 보여준다. 영상은 미처리이며 영상 썸네일을 사진으로 세지 않는다.
- 일부 Gemini 사진 분석 실패 시 `실패한 사진만 다시 분석`을 누를 수 있다. 성공한 사진을 다시 호출하지 않으며 기존 검수·선택과 재시도 기록을 보존한다. 사진 만료, 모델/프롬프트/catalog 변경 후에는 새 작업으로 실행한다.
- 이미지에서 읽은 이름과 근거 위치를 보존한다. Gemini의 근거 위치는 모델이 추정한 위치이며 인식 확률을 제공하지 않는다. 불명확한 이름은 자동 연결하지 않는다. 잘못 읽힌 이름은 화면에서 수정해 후보를 다시 조회할 수 있다.
- 이름·지역/주소가 유일하게 일치한 후보만 자동 연결한다. 유사한 이름·복수 후보는 선택을 받는다. 사용자 선택/이름 수정은 결과 JSON에 기록한다.
- 메타데이터 확인은 기존 TourAPI 지도 번들과 선택적 Kakao 스냅샷의 대조다. 오늘 영업 중인지 확인한 결과가 아니다. 날짜·주소·경도/위도·도시·출처를 제공하며 현재 운영 정보는 unknown이다.
- 기존 라벨만 연결한다. 원본 값·N/A·판정·근거를 유지하고 원본 데이터는 변경하지 않는다. 음식점 등 기존 라벨이 없는 장소는 `labels_missing`이다.
- JSON 내보내기에 signed CDN URL·작성자·댓글·로그인 쿠키는 포함하지 않는다.

## API

| 요청 | 역할 |
|---|---|
| `POST /api/imports {url}` | 작업 접수, 202+job_id |
| `POST /api/imports/{job_id}/retry-extraction {}` | 같은 설정으로 실패 사진만 분석, 202 |
| `GET /api/imports/{job_id}` | 단계와 결과 |
| `POST /api/imports/{job_id}/review-name {mention_id,name}` | 원문을 유지하며 수정 이름으로 후보 재조회 |
| `POST /api/imports/{job_id}/resolve {mention_id,candidate_id}` | 제공한 후보를 명시적으로 연결 |
| `GET /api/imports/{job_id}/assets/{order}` | 처리 사진 |
| `GET /api/imports/{job_id}/export` | 결과 JSON |
| `DELETE /api/imports/{job_id}` | 작업·원문·사진·결과 삭제 |
| `GET /api/health` | catalog/추출 엔진·키 설정 여부·모델 (실제 호출 성공 확인과 별개) |

이 서버는 개인 PC 검증용이다. 공개 배포를 위한 인증·다중 사용자 격리·지속 큐는 후속 범위다.

## 검증

```powershell
python scripts/test_instagram_import.py
python scripts/test_instagram_gemini.py
node scripts/test_instagram_import_ui.cjs
python -m py_compile server/instagram-import/app.py server/instagram-import/core.py server/instagram-import/catalog.py server/instagram-import/extractor.py server/instagram-import/gemini.py
node --check server/instagram-import/web/app.js
```

실제 두 게시물 표본의 이름 정답·비교 방법과 결과는 SPEC-110에 기록했다. `python scripts/evaluate_instagram_import.py <job.json> --baseline <기존-job.json>`은 네트워크 요청 없이 이름 정확 일치를 평가한다.
