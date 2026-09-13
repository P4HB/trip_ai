# SPEC-081: Vercel 호스팅과 기존 DB 평가 저장 연결

- 상태: Implemented
- 작성일: 2026-09-13
- 최종 수정일: 2026-09-13
- 관련 이슈: 사용자 요청 — Vercel hosting 복구 및 Vercel 평가를 친구 서버의 기존 DB에 저장
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [자동 저장](spec_060.md), [안전 및 개인정보](safety_privacy.md)
- 관련 코드: `map-ui/vercel.json`, `scripts/check_vercel_feedback_proxy.py`, `server/travel-feedback/feedback_api.py`(기존 계약)
- 선행 SPEC: SPEC-057, SPEC-060, SPEC-079

## 배경

- 사실: Vercel Production 배포 `5Lx5kELXcZCNQxadYrgbSqjVRgv8`은 Git `9dca06f`를 배포했으며 Ready 상태다.
- 사실: `https://trip-ai-wine-eight.vercel.app/`은 HTTP 404, `/map-ui/`는 제주 여행 추천 HTML과 HTTP 200을 반환한다.
- 사실: 저장소 루트에는 `index.html`이 없으며 실제 정적 앱 진입점은 `map-ui/index.html`이다. 저장소에 Vercel 설정 파일은 없다.
- 사실: 기존 `https://168-107-40-231.sslip.io/travel/`은 HTTP 200이다. Python 후기·평가 API는 이 기존 서버에서 별도로 실행된다.
- 결정: 현재 Vercel 프로젝트의 공개 폴더를 `map-ui`로 제한해 기본 주소에서 정적 앱을 제공한다.
- 사실: 후속 확인에서 Vercel `/`은 HTTP 200, `/map-ui/`는 404로 바뀌어 정적 앱 루트 변경이 적용됐다.
- 사실: 친구 서버 SSH는 현재 연결 시간 초과지만 기존 HTTPS API는 접근 가능하다.
- 결정: 사용자의 후속 요청에 따라 기존 DB 평가 저장과 후기 API 전달을 범위에 포함한다. 브라우저 화면 조작은 중단하고 Git·HTTPS로 작업한다.

## 목표

- Vercel 기본 도메인에서 지도·추천 UI의 첫 화면과 정적 자산을 정상 제공한다.
- 다음 배포에도 적용되는 프로젝트 설정으로 잘못된 공개 경로를 수정한다.
- Vercel에서의 평가 생성·수정을 친구 서버의 기존 SQLite 세션 행에 저장한다.
- 같은 화면의 Kakao 후기 조회도 기존 API로 연결한다.

## 비목표

- Python·SQLite API나 기존 데이터의 이관, 기존 서버 재시작 및 Origin 허용 설정 변경
- 기존 `/travel/` 서버 재배포, 추천 알고리즘·데이터 변경

## 요구사항

- `REQ-8101`: 기존 Vercel 프로젝트에 `map-ui`를 정적 앱 루트로 지정하고 Production에 재배포한다.
- `REQ-8102`: 기본 도메인의 `/`와 HTML이 참조하는 로컬 JavaScript·CSS·데이터·지도 vendor가 HTTP 200이어야 한다.
- `REQ-8103`: 배포 산출물은 `map-ui/`로 한정하고 저장소의 서버 코드·연구 자료를 포함하지 않는다.
- `REQ-8104`: 기존 서버·DB·API 동작과 기존 사용자 저장을 유지한다.
- `REQ-8105`: `POST /travel/api/feedback`을 기존 서버의 같은 경로로 전달하고 원래 body·상태·session_id·revision 영수증을 보존한다.
- `REQ-8106`: Origin이 정확히 `https://trip-ai-wine-eight.vercel.app`인 POST만 기존 서버 Origin으로 변환한다. 다른 Origin은 그대로 전달해 기존 서버의 거부 정책을 유지한다. Origin 없는 서버 요청도 기존 정책을 따른다. 와일드카드 도메인 허용과 전역 Origin 삭제는 하지 않는다.
- `REQ-8107`: `/api/places/{contentid}/reviews`의 숫자 ID GET만 기존 `/travel/api/places/{contentid}/reviews`로 전달하고 query를 유지한다.
- `REQ-8108`: 피드백 요청·응답에 캐시를 사용하지 않는다. 별도 body 로그·저장소·새 수집 필드를 추가하지 않고 기존 90일 보존·payload·전송 시점을 유지한다.
- `REQ-8109`: 사용자 브라우저를 조작하지 않고 Git 기반 배포와 HTTPS 검증을 사용한다.

## 입력과 출력

- 입력: Git `main`의 기존 `map-ui/` 정적 파일과 Vercel 프로젝트 설정
- 출력: `https://trip-ai-wine-eight.vercel.app/`의 지도·추천 UI 및 친구 서버 DB에 저장되는 기존 v3 스냅샷
- 데이터 생성·스키마·좌표 변환: 없음

## 설계

현재 적용된 Root Directory `map-ui`를 유지하고 `map-ui/vercel.json`에 빌드 없는 정적 출력과 한정된 외부 전달 경로를 기록한다. Vercel routes의 조건부 request-header transform은 공개 Vercel Origin에 정확히 일치하는 POST만 기존 서버 Origin으로 변환한다. 조건 밖의 Origin은 손대지 않아 기존 API의 403 정책을 유지한다. 숫자 장소 ID의 리뷰 GET도 연결하고 나머지는 정적 파일 시스템으로 처리한다. API를 HTML로 돌려주는 catch-all rewrite는 추가하지 않는다.

기존 서버의 코드·Origin 설정·DB 볼륨은 변경하지 않는다. 새로운 Vercel 함수·DB·비밀키는 필요하지 않다. Vercel 전달 구간에서 기존 이름·별칭·평가 payload를 처리하지만 별도 저장소나 body 로그를 만들지 않는다. Git main에 설정을 푸시해 기존 자동 배포를 사용한다.

합성 세션 1개를 Vercel에서 생성·수정한 뒤, 기존 서버에서 같은 payload의 중복·지연 영수증을 받아 같은 DB를 사용하는지 검증한다. 합성 세션에는 명확한 테스트 이름과 source 태그를 넣는다. 관리 접근이 없으면 테스트 행 1개는 기존 90일 보존 대상이며 실제 테스터 분석에서 제외해야 한다.

## 예외와 폴백

- 접근·재배포 실패 시 실제 상태와 남은 작업을 기록한다. 검증 전 완료로 보고하지 않는다.
- 기존 API 장애 시 기존 저장 실패 표시와 동일 revision 자동 재시도를 유지한다. 영수증 없이 저장 완료로 처리하지 않는다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_081.md`, `docs/architecture.md`, `docs/safety_privacy.md`, `map-ui/README.md`, `map-ui/vercel.json`, `scripts/check_vercel_feedback_proxy.py`
- 외부 설정: Vercel `trip-ai` Root Directory 및 Production 재배포
- 데이터 마이그레이션: 없음
- 호환성 영향: Vercel 앱 기본 경로가 `/map-ui/`에서 `/`로 변경된다.
- 보안·개인정보 영향: 정적 출력은 `map-ui/`로 제한한다. 기존 서버 보안 설정은 유지하고 Vercel의 정확한 공개 Origin만 변환한다. 기존 메모리 rate limit은 같은 Vercel 전달 IP 사용자에게 합산될 수 있다.

## 승인 기준

- `AC-8101`: 새 Git main 커밋의 Vercel 배포가 성공하고 `/`에서 앱을 제공한다.
- `AC-8102`: `/`와 HTML에서 참조하는 정적 자산이 HTTP 200이며 로컬·배포 파일이 동일하다. 사용자 화면 접근 없이 HTTP·파일 해시로 검증한다.
- `AC-8103`: 공개 출력에 `docs/README.md`와 `server/travel-feedback/feedback_api.py`가 없고 두 경로가 404다.
- `AC-8104`: 기존 `/travel/`과 리뷰 API가 정상 응답하며 Vercel 리뷰 응답·query 결과가 기존 서버와 일치한다.
- `AC-8105`: 합성 v3 세션을 Vercel에서 revision 1 생성(201), revision 2 수정(200)한다. 기존 서버의 같은 revision 1·2 요청으로 중복·지연 응답과 같은 session_id·revision을 확인한다. 잘못된 Origin·유사 도메인·null Origin은 403, 잘못된 JSON은 400, 비정상 payload는 422다.
- `AC-8106`: feedback 응답은 `Cache-Control: no-store`이고 동일·낮은 revision이 새 세션 행을 만들거나 최신 값을 덮어쓰지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-8101 | GitHub 배포 상태·공개 도메인 확인 | GitHub commit status, HTTPS |
| AC-8102 | HTML 참조 자산 HTTP·해시 검사 | Vercel 기본 도메인 |
| AC-8103 | 비배포 경로 HTTP 상태 확인 | `/docs/README.md`, `/server/travel-feedback/feedback_api.py` |
| AC-8104 | 기존 서버와 Vercel API 상태 비교 | 기존 `/travel/`, 양쪽 리뷰 API |
| AC-8105~AC-8106 | 실제 HTTPS API 합성 세션 교차 검증 | `python3 scripts/check_vercel_feedback_proxy.py --write-test` |

설정은 Vercel 공식 JSON Schema로 검증하고 기존 API 단위 테스트를 실행한다. 추천 코드·생성 데이터 변경이 없으므로 알고리즘 회귀와 데이터 재생성은 수행하지 않는다.

## 구현 결과

- 최초 작업에서 Vercel Root Directory를 `map-ui`로 저장 요청한 뒤 화면 연결이 종료됐다. 후속 HTTP 확인으로 루트 변경이 적용된 것을 확인했다. 이후 사용자 화면에는 접근하지 않았다.
- `map-ui/vercel.json`의 정확한 Origin 조건·외부 POST·리뷰 GET 전달 설정을 커밋 `ef216f4`로 main에 푸시했다. Vercel 배포 `6zLrFd3aoCFVGU2hgN921cwUSG98`과 GitHub Production deployment `6421977413`가 성공했다.
- 원래 서버에 직접 보낸 Vercel Origin의 POST는 403이다. Vercel 전달 경로를 거치면 정상 Origin 검사 후 원래 API가 처리한다. 기존 서버 코드·설정·DB와 운영 컨테이너는 변경하지 않았다.
- `AC-8101~8102`: 공개 루트 HTML 및 참조 정적 자산 10개의 내용·해시가 로컬 파일과 일치했다. 지도 데이터 생성이나 추천 코드 변경은 없다.
- `AC-8103~8104`: 비공개 경로·GET 평가 조회 경로는 404이며 원래 `/travel/`은 200이다. Vercel 후기 조회의 `limit=1`, `offset=0/1` 결과가 기존 서버 JSON과 일치했다.
- `AC-8105~8106`: 합성 세션을 Vercel에서 revision 1로 생성(201), revision 2로 수정(200)했다. 원래 서버에 각각 같은 payload를 보내 `created=false`와 같은 revision을 확인했다. Vercel에 오래된 revision 1을 재전송하면 `stale=true`, `revision=2`를 반환해 같은 DB의 최신 상태를 확인했다. 저장 영수증과 오류 응답은 모두 `no-store`였다.
- 잘못된 Origin, 도메인 뒤 문자열을 붙인 Origin, 점을 다른 문자로 바꾼 유사 Origin, `null` Origin은 모두 403이었다. 정상 Vercel Origin의 잘못된 JSON은 400, 잘못된 payload는 422였다.
- 검증 명령: `python3 -m unittest server/travel-feedback/test_feedback_api.py` 19건 통과; `python3 -m py_compile scripts/check_vercel_feedback_proxy.py` 통과; Vercel 공식 JSON Schema를 적용한 설정 검증 오류 0개; `python3 scripts/check_vercel_feedback_proxy.py --write-test` 전체 통과; `git diff --check` 통과.
- 합성 세션 ID는 `b474f0c1-f40c-44b4-ae74-0f40845c2ead`, 이름은 `DEPLOYMENT-TEST-SPEC081`, source.ui_version은 `deployment-smoke-spec081`이다. 가상 장소·가상 평가만 담은 **테스트 행 1개**이며 기존 90일 보존 대상이다. 실제 테스터 분석에서 제외한다.
- 통합 검증 스크립트의 후속 네트워크 요청은 gzip 전송을 지원하도록 개선했다. 압축 응답을 해제한 후 원본 바이트·해시를 비교한다.

## 설계와 달라진 점

친구 서버에 Vercel Origin 허용 목록을 추가하는 대신, Vercel 배포 설정에서 정확한 공개 Origin에 한정해 기존 서버 Origin으로 변환했다. 기존 서버 SSH가 시간 초과인 상황에서도 기존 보안 정책·DB·컨테이너를 변경하지 않고 연결할 수 있으며, 다른 Origin 거부를 공개 HTTPS에서 검증했다. 원래 서버에서 같은 세션의 중복·지연 영수증을 확인하는 방식으로 DB 공유를 검증했으며 DB 파일 자체를 내려받거나 실제 사용자 데이터를 열지 않았다.

## 알려진 제한

- 친구 서버가 계속 실행돼야 Vercel에서도 평가 저장·후기 조회가 가능하다.
- 임시 Preview 도메인의 브라우저 평가는 허용하지 않는다. 공개 Vercel 도메인 변경 시 정확한 Origin 설정을 함께 갱신해야 한다.
- 기존 IP별 rate limit은 Vercel 프록시 IP 기준으로 합산될 수 있다.
- 테스트 행 1개는 관리 접근이 없어 삭제하지 않았다. 운영자가 위 합성 세션 ID로 삭제하거나 기존 보존 만료를 적용할 수 있다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-13 | 배포 성공·루트 404·하위 앱 200 확인, 정적 공개 폴더 복구 범위 작성 |
| 2026-09-13 | Root Directory 수정 저장 요청 후 브라우저 연결 불가. 저장 완료 확인과 Production 재배포는 미완료 |
| 2026-09-13 | 사용자 요청으로 기존 DB 평가 저장·후기 연결을 승인 범위에 포함, 브라우저 조작 없이 Git·HTTPS 기반 진행 |
| 2026-09-13 | 커밋 `ef216f4` Vercel Production 배포, 원래 DB와 합성 세션 생성·갱신·중복 교차 검증 완료 |
