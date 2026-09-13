# SPEC-079: OpenStreetMap 타일 차단 복구

- 상태: In Progress
- 작성일: 2026-09-13
- 최종 수정일: 2026-09-13
- 관련 이슈: 사용자 요청 — 운영 `/travel/` 지도 타일 차단 수정 및 배포
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [Map UI 배포](spec_057.md)
- 관련 코드: `map-ui/app.js`, `server/travel-feedback/deploy_into_rail_release.py`, 운영 Caddy 설정
- 선행 SPEC: SPEC-057, SPEC-066

## 배경

운영 `/travel/`은 외부 OpenStreetMap 래스터 타일을 브라우저에서 직접 요청한다. 운영 Caddy가 모든 경로에 `Referrer-Policy: same-origin`을 적용해 교차 출처 타일 요청의 `Referer`가 제거되고, OpenStreetMap은 해당 요청에 정상 지도 대신 `Access blocked` PNG와 `x-blocked` 응답 헤더를 반환한다. 앱은 과거 호환 주소인 `{s}.tile.openstreetmap.org`도 사용하고 있다.

## 목표

- `/travel/`의 OSM 타일 요청에 출처를 식별할 수 있는 `Referer`가 전달되게 한다.
- OSM이 현재 요구하는 단일 HTTPS 타일 호스트를 사용한다.
- 기존 Rail Desk 비여행 경로의 리퍼러 정책과 동작을 보존한다.

## 비목표

- 상용 지도 사업자 도입 또는 자체 타일 서버 구축
- 지도 디자인·마커·클러스터·추천 알고리즘 변경
- 장소 이미지 제공 방식 변경

## 요구사항

- `REQ-7901`: Map UI는 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`를 사용해야 한다.
- `REQ-7902`: `/travel`과 `/travel/*` 응답은 `Referrer-Policy: strict-origin-when-cross-origin`을 사용해야 한다.
- `REQ-7903`: 비여행 경로는 기존 `Referrer-Policy: same-origin`을 유지해야 한다.
- `REQ-7904`: 배포 보조 스크립트는 기존 또는 이미 수정된 Caddy 설정을 안전하게 처리해야 한다.
- `REQ-7905`: 배포 후 지도 타일이 차단 PNG가 아닌 정상 이미지로 표시되고 기존 `/`, `/healthz`, `/travel/`이 정상 응답해야 한다.

## 입력과 출력

- 입력: `/travel/` 문서 응답 헤더와 Leaflet 타일 URL
- 출력: OSM 정상 래스터 타일과 기존 마커·클러스터가 함께 표시되는 지도
- 외부 의존성: OpenStreetMap 표준 타일 서비스의 가용성과 사용 정책

## 설계

Map UI의 Leaflet `tileLayer` URL에서 `{s}.`를 제거한다. Caddy의 전역 `Referrer-Policy`를 여행·비여행 상호 배타 경로 매처로 분리한다. 여행 경로는 교차 출처 요청에 origin만 전달하는 `strict-origin-when-cross-origin`, 나머지는 기존 `same-origin`을 유지한다. 배포 보조 스크립트가 새 Rail Desk 릴리스에 동일 설정을 재적용하도록 변환을 포함한다.

## 예외와 폴백

- OSM 자체 장애나 별도 사용량 차단은 이번 변경으로 보장하지 않는다.
- 배포 검증에서 정상 타일을 확인하지 못하면 새 릴리스를 완료로 기록하지 않고 직전 릴리스를 유지한다.
- 장기 안정성이 필요하면 후속 SPEC에서 관리형 타일 제공자 또는 자체 호스팅을 결정한다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/architecture.md`, `docs/spec_079.md`, `map-ui/app.js`, `server/travel-feedback/deploy_into_rail_release.py`, 관련 테스트
- 데이터 마이그레이션: 없음
- 호환성 영향: `/travel/`에서 외부 OSM으로 origin Referer가 전달됨. 비여행 경로는 변경 없음
- 보안·개인정보 영향: OSM에는 전체 경로가 아니라 공개 서비스 origin만 전달되며 사용자 입력은 포함되지 않음

## 승인 기준

- `AC-7901`: 소스와 배포 산출물의 타일 URL이 공식 단일 호스트를 사용한다.
- `AC-7902`: 운영 `/travel/`의 `Referrer-Policy`가 `strict-origin-when-cross-origin`이다.
- `AC-7903`: 운영 `/`의 `Referrer-Policy`는 `same-origin`이다.
- `AC-7904`: JavaScript 문법·대시보드 계약·배포 변환 테스트가 통과한다.
- `AC-7905`: 운영 브라우저에서 정상 지도 타일과 마커가 보이며 치명적 콘솔 오류가 없다.
- `AC-7906`: 운영 `/`, `/healthz`, `/travel/`과 핵심 자산이 HTTP 200이다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-7901 | 타일 URL 정적 검사 | `rg "tile.openstreetmap.org" map-ui/app.js` |
| AC-7902, AC-7903 | 공개 응답 헤더 비교 | `curl -I /travel/`, `curl -I /` |
| AC-7904 | 문법·회귀·단위 테스트 | `node --check map-ui/app.js`, `node scripts/validate_ccu_mmr_dashboard.cjs`, `python -m unittest server/travel-feedback/test_deploy_into_rail_release.py` |
| AC-7905 | 공개 브라우저 스크린샷·콘솔·타일 검사 | 운영 `/travel/` |
| AC-7906 | 공개 URL 상태 검사 | `/`, `/healthz`, `/travel/`, 핵심 자산 |

## 구현 결과

구현 및 운영 검증 후 기록한다.

## 설계와 달라진 점

없음.

## 알려진 제한

- OSM 표준 타일은 best-effort 서비스로 SLA가 없다. 관리형 제공자 전환은 후속 결정이 필요하다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-13 | 운영 차단 재현, 수정 범위 승인 및 구현 시작 |
