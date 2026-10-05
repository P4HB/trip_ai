# Instagram 장소 가져오기

[SPEC-102](../../docs/spec_102.md)의 로컬 구현이다. 링크 하나 → 전체 사진 다운로드 → 로컬 한국어 OCR → 장소 후보 → 기존 스냅샷 메타데이터·41축 라벨 연결까지 처리한다. 개인 저장·추천·일정·신규 라벨 생성은 없다.

## 실행

현재 작업 환경에는 격리된 `.deps/`와 OCR 모델 cache가 준비되어 있다. 저장소 루트에서 실행한다.

```powershell
python server/instagram-import/app.py serve --port 8091
```

`http://127.0.0.1:8091`에서 인스타 링크를 입력한다. 첫 실행은 OCR 모델 로딩 때문에 시간이 걸릴 수 있다. 서버는 loopback에만 bind하며 기존 지도/피드백 서버와 독립적이다.

다른 PC 또는 깨끗한 환경은 Python 3.10 이상과 아래 격리 환경을 사용한다. 모델 파일은 첫 실행 때 EasyOCR의 공식 배포 주소에서 다운로드한다. 이미지 OCR 처리는 로컬에서 수행하며 API 키가 필요하지 않다.

```powershell
python -m venv server/instagram-import/.venv
server/instagram-import/.venv/Scripts/python.exe -m pip install -r server/instagram-import/requirements.txt
server/instagram-import/.venv/Scripts/python.exe server/instagram-import/app.py serve --port 8091
```

Windows 한국어 OCR를 비교할 때는 `python server/instagram-import/app.py --ocr windows serve --port 8091`을 사용한다. 이 경로는 Windows의 한국어 OCR 언어팩이 필요하며, 테두리 글꼴에서 오인식이 더 많다.

CLI에서도 같은 파이프라인을 실행할 수 있다.

```powershell
python server/instagram-import/app.py import "https://www.instagram.com/p/SHORTCODE/" --output server/instagram-import/.data/cli-result
```

CLI의 명시적 출력 디렉터리는 사용자가 보관·삭제한다. 웹 작업은 사진/원문 24시간·결과 7일 TTL과 작업 삭제를 지원한다. TTL 정리는 서버 시작과 API 접근 시 수행한다. 서버가 꺼져 있는 동안에는 다음 실행까지 물리 삭제가 지연된다.

Windows 읽기 전용 작업 파일은 해당 작업 경로 안에서 속성을 복원해 삭제한다. 다른 프로그램이 파일을 잠그고 있으면 오류를 표시하며, 파일을 닫은 뒤 작업 삭제를 다시 누를 수 있다. 삭제 실패 상태의 worker가 결과를 다시 저장하지 않는다.

## 결과 확인

- 사진 수와 다운로드 성공 수를 별도로 보여준다. 영상은 미처리이며 영상 썸네일을 사진으로 세지 않는다.
- 이미지에서 읽은 이름과 근거 위치를 보존한다. OCR의 잘못 읽힌 이름은 화면에서 수정해 후보를 다시 조회할 수 있다.
- 이름·지역/주소가 유일하게 일치한 후보만 자동 연결한다. 유사한 이름·복수 후보는 선택을 받는다. 사용자 선택/이름 수정은 결과 JSON에 기록한다.
- 메타데이터 확인은 기존 TourAPI 지도 번들과 선택적 Kakao 스냅샷의 대조다. 오늘 영업 중인지 확인한 결과가 아니다. 날짜·주소·경도/위도·도시·출처를 제공하며 현재 운영 정보는 unknown이다.
- 기존 라벨만 연결한다. 원본 값·N/A·판정·근거를 유지하고 원본 데이터는 변경하지 않는다. 음식점 등 기존 라벨이 없는 장소는 `labels_missing`이다.
- JSON 내보내기에 signed CDN URL·작성자·댓글·로그인 쿠키는 포함하지 않는다.

## API

| 요청 | 역할 |
|---|---|
| `POST /api/imports {url}` | 작업 접수, 202+job_id |
| `GET /api/imports/{job_id}` | 단계와 결과 |
| `POST /api/imports/{job_id}/review-name {mention_id,name}` | 원문을 유지하며 수정 이름으로 후보 재조회 |
| `POST /api/imports/{job_id}/resolve {mention_id,candidate_id}` | 제공한 후보를 명시적으로 연결 |
| `GET /api/imports/{job_id}/assets/{order}` | 처리 사진 |
| `GET /api/imports/{job_id}/export` | 결과 JSON |
| `DELETE /api/imports/{job_id}` | 작업·원문·사진·결과 삭제 |
| `GET /api/health` | catalog/OCR 준비 상태 |

이 서버는 개인 PC 검증용이다. 공개 배포를 위한 인증·다중 사용자 격리·지속 큐는 후속 범위다.

## 검증

```powershell
python scripts/test_instagram_import.py
node scripts/test_instagram_import_ui.cjs
python -m py_compile server/instagram-import/app.py server/instagram-import/core.py server/instagram-import/catalog.py server/instagram-import/extractor.py
node --check server/instagram-import/web/app.js
```
