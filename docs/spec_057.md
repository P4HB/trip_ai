# SPEC-057: Map UI `/travel/` 정적 호스팅 배포

- 상태: Implemented
- 작성일: 2026-08-24
- 최종 수정일: 2026-08-24
- 관련 이슈: 사용자 요청 — 기존 Rail Desk 서비스를 유지하며 제주 Map UI를 `/travel/` 경로에 배포
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md)
- 관련 코드: `map-ui/`, 서버의 정적 파일 및 리버스 프록시 설정
- 선행 SPEC: SPEC-019, SPEC-020, SPEC-056

## 배경

현재 `map-ui`는 로컬 HTTP 서버에서 실행되는 정적 웹 앱이다. 대상 서버의 루트 경로에는 기존 Rail Desk 서비스가 운영 중이므로 이를 변경하지 않고 `/travel/` 하위 경로에 Map UI를 분리 배포해야 한다.

## 목표

- 현재 체크아웃된 `map-ui` 정적 파일을 `https://168-107-40-231.sslip.io/travel/`에서 제공한다.
- 기존 `/`, `/healthz`와 Rail Desk 동작을 보존한다.
- `/travel` 요청은 `/travel/`로 정규화하고 Map UI의 상대 자산을 정상 제공한다.

## 비목표

- 추천 API, 사용자 계정, 피드백 서버 저장 구현
- 기존 Rail Desk 애플리케이션 변경
- 도메인 또는 서버 제공자 변경

## 요구사항

- `REQ-5701`: 배포 입력은 현재 저장소의 `map-ui/` 디렉터리다.
- `REQ-5702`: 공개 경로는 `/travel/`이며 기존 루트 서비스와 `/healthz`를 변경하지 않는다.
- `REQ-5703`: HTML, JavaScript, CSS, 지도 vendor, 생성 장소 데이터가 HTTPS에서 로드되어야 한다.
- `REQ-5704`: 비밀키·로그인 정보·SSH 개인키를 배포 파일이나 저장소에 포함하지 않는다.
- `REQ-5705`: 배포 전 Map UI JavaScript 문법 및 정적 대시보드 계약을 검증한다.
- `REQ-5706`: 배포 후 `/travel/` HTTP 200, 주요 자산 HTTP 200, 기존 `/`와 `/healthz` HTTP 200을 확인한다.

## 입력과 출력

- 입력: 저장소 루트 기준 `map-ui/` 정적 파일
- 출력: `https://168-107-40-231.sslip.io/travel/`
- 외부 의존성: OpenStreetMap 지도 타일과 장소 이미지 네트워크

## 설계

서버 파일 배포 또는 서버가 제공하는 관리 인터페이스를 사용해 `map-ui/`를 정적 디렉터리에 동기화한다. 웹 서버는 `/travel/`을 해당 디렉터리에 매핑하고 `/travel`을 `/travel/`로 리다이렉트한다. 기존 루트 서비스의 프록시 규칙은 유지한다.

## 예외와 폴백

- SSH가 차단되어 있으면 승인된 HTTPS 관리 인터페이스가 배포 기능을 제공하는지 확인한다.
- 서버 파일 변경 통로가 없으면 배포를 시도하지 않고 필요한 최소 접근 조건을 보고한다.
- 배포 후 검증 실패 시 기존 Rail Desk 경로를 변경하지 않고 Map UI 경로만 롤백한다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_057.md`, 대상 서버의 `/travel/` 정적 파일 및 웹 서버 경로 설정
- 데이터 마이그레이션: 없음
- 호환성 영향: 기존 Rail Desk 루트 경로 유지
- 보안·개인정보 영향: 자격증명과 개인키는 배포 산출물에 포함하지 않음

## 승인 기준

- `AC-5701`: 로컬 JavaScript 및 대시보드 검증이 통과한다.
- `AC-5702`: `/travel/`과 핵심 정적 자산이 HTTPS 200을 반환한다.
- `AC-5703`: 브라우저에서 제목과 초기 입력 UI가 표시되고 치명적 콘솔 오류가 없다.
- `AC-5704`: 기존 `/`와 `/healthz`가 계속 HTTP 200을 반환한다.
- `AC-5705`: 배포 파일에 자격증명·개인키가 포함되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-5701 | JavaScript 문법·대시보드 계약 | `node --check map-ui/preference-elicitation.js`, `node --check map-ui/ccu-mmr.js`, `node --check map-ui/app.js`, `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-5702 | 공개 URL·핵심 자산 상태 확인 | `https://168-107-40-231.sslip.io/travel/` |
| AC-5703 | 공개 브라우저 화면과 콘솔 확인 | `/travel/` |
| AC-5704 | 기존 서비스 회귀 확인 | `/`, `/healthz` |
| AC-5705 | 배포 입력 파일 목록 검사 | `map-ui/` |

## 구현 결과

- 구현 완료. 서버 릴리스 `20260824-travel-feedback-01`이 활성화됐다.
- `map-ui/`의 JavaScript 문법 검사는 통과했다.
- `map-ui/index.html`과 `map-ui/styles.css`에서 `/travel/` 배포를 막는 루트 절대 자산 경로는 발견되지 않았다.
- SSH 개인키로 대상 서버에 접속해 기존 Rail Desk의 버전된 Docker 릴리스·자동 헬스체크·롤백 절차를 그대로 사용했다.
- 최초 배포에서 Caddy의 `/travel/` 정적 라우트와 `/travel` 308 리다이렉트를 추가했다. 현재 릴리스는 Git 커밋 `f52fcc5`의 Map UI 19개 파일 19,434,696바이트를 새 edge 이미지의 `/srv/travel/`에 포함한다.
- 기존 Rail Desk `/`와 `/healthz`, `/travel/`, 핵심 JavaScript·CSS·장소 데이터가 모두 HTTPS 200을 반환한다.
- 공개 브라우저에서 `제주 여행 추천 베타`, `나에게 맞는 제주 여행`, MBTI UI와 만족도 완료형 JSON 저장 안내·초기 disabled 버튼을 확인했고 콘솔 경고·오류는 0건이다.
- Git 원격 `main`은 다른 문서 변경과 병합한 `5377d88`이며 기능 커밋 `f52fcc5`를 포함한다.
- Windows CRLF에서도 여행 MBTI 적용 함수 경계를 찾도록 `scripts/validate_ccu_mmr_dashboard.cjs`를 보정했고 JavaScript 문법·대시보드 계약 검증이 모두 통과했다.

## 설계와 달라진 점

- 배포 전 검증 과정에서 Windows CRLF를 처리하지 못하던 기존 대시보드 검증 정규식을 함께 보정했다. 제품 동작에는 영향이 없다.

## 알려진 제한

- Map UI의 추천 입력과 피드백은 기본적으로 브라우저 메모리에 유지된다. 모든 만족도를 완료하고 사용자가 저장 버튼을 누르면 사용자 기기에 JSON 파일을 만들 수 있지만 서버에는 저장하지 않는다.
- 지도 타일과 장소 이미지는 외부 네트워크 상태에 의존한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-24 | `/travel/` 정적 호스팅 배포 범위 승인 및 작업 시작 |
| 2026-08-24 | Docker 릴리스 `20260824-travel-02` 활성화, 공개 URL·기존 서비스·브라우저 회귀 검증 완료 |
| 2026-08-24 | 만족도 JSON 저장 기능 커밋 `f52fcc5`를 포함한 `20260824-travel-feedback-01` 활성화 및 공개 회귀 검증 완료 |
