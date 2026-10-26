# SPEC-113: 동작 보존 구조 리팩토링

- 상태: In Progress
- 작성일: 2026-10-26
- 최종 수정일: 2026-10-26
- 관련 이슈: 사용자 요청 "스파게티 코드 리팩토링"(단계별 전체 진행, SDD 절차 준수 결정)
- 관련 문서: [아키텍처](architecture.md), [데이터 계약](data_contracts.md), [CCU-MMR](ccu_mmr_algorithm_draft.md), [평가](evaluation.md)
- 관련 코드: `map-ui/`, `server/travel-feedback/`, `server/instagram-import/`, `scripts/`, `review-ui/`, 저장소 루트 설정
- 선행 SPEC: SPEC-110, SPEC-111, SPEC-112

## 배경

SPEC-111에서 3,217줄 `map-ui/app.js`를 모듈로 나눴지만 다음 구조 문제가 남아 있다(2026-10-26 조사).

- `map-ui/app.js`(1,340줄)가 조립 외에 상세 패널·추천 카드·일정·드로어·전체 이벤트 바인딩(`bindEvents` 200줄)을 갖고, 모듈 간 순환 의존을 지연 함수로 숨긴다. 7개 모듈이 같은 `state` 키를 쓴다.
- `scripts/validate_ccu_mmr_dashboard.cjs`가 소스 문자열을 정규식으로 고정(함수 인접 순서·들여쓰기·`fetch(` 개수)하고, 두 Playwright 테스트가 `app.js` 본문을 문자열 치환해 fixture를 주입한다. 동작이 같아도 코드 이동만으로 테스트가 깨진다.
- `ccu-mmr.js`의 `rank`(175줄)·`buildSchedule`(170줄), 서버의 `validate_day`(193줄)·`ItineraryService.generate`(157줄)·`validate_request`(126줄)가 여러 책임을 한 함수에 담는다.
- 어휘(동행자·의도·이벤트 유형 `"15"`), 날짜·시간(KST, HH:MM), 거리(지구 반지름 6371 vs 6371.0088), 해시, JSON/JSONL 입출력, HTTP JSON 응답 헬퍼가 여러 파일에 복제돼 있다.
- `feedback_api.py`는 if/elif 라우팅이며 요청 본문 파싱이 두 벌이고 검사 항목이 서로 다르다. 환경 변수 이름·기본값이 4개 모듈과 실행기·배포 스크립트에 흩어져 있다(`run_trip_ai_local.py`가 `GEMINI_FALLBACK_MODEL`을 미등록 이름으로 경고).
- `scripts/` 95개 중 27개가 참조 없는 일회성 스크립트이고, 공용 데이터 레이어(`scripts/lib/data_io.mjs`, `config/active_datasets.json`)는 2개 스크립트만 쓴다.
- `travel-mbti-site`는 `.gitmodules` 없는 gitlink이고 폐기된 지도 복사본을 담는다. `review-ui`의 v1 파일과 `validate_review_ui_data.mjs`(없는 모듈 import)는 실행되지 않는다.

## 목표

- 사용자 동작·추천 결과·API 응답·데이터 산출물을 바꾸지 않고 책임 경계를 정리해 이후 기능 변경 비용을 낮춘다.
- 소스 형태가 아니라 동작을 검증하는 테스트로 안전망을 바꾼다.
- 중복 헬퍼와 설정을 단일 출처로 모은다.

## 비목표

- 추천 점수·가중치·알고리즘 버전 변경, UI 시각 디자인 변경, CSS 색상 토큰화(시각 회귀 도구 도입 후 별도 SPEC).
- 데이터 재수집·라벨 재생성, 해시가 데이터 manifest에 고정된 `scripts/build_all_place_profiles.py`, `scripts/classify_place_types.py`와 동결 라벨 계보 스크립트의 내부 수정.
- 외부 LLM·경로 API 실제 호출, 운영 배포, Git 이력 재작성(피드백 파일 이력 삭제는 사용자 결정 사항).
- 프레임워크·번들러 도입.

## 요구사항

단계 순서대로 진행하며 각 단계는 전체 회귀가 통과한 상태로 끝낸다.

- `REQ-001` 안전망: 소스 정규식·함수 인접 검사를 DOM 계약·동작 검사로 바꾼다. Playwright fixture 주입은 페이지 로드 전에 설정하는 명시적 테스트 훅으로 바꾸며 훅은 테스트 플래그가 없으면 노출되지 않는다.
- `REQ-002` 골든 비교: CCU-MMR 순위·일정, 일정 검증, 피드백 검증의 결정적 시나리오 출력을 리팩토링 전 기준으로 저장하고 매 단계 동일함을 확인한다.
- `REQ-003` 단일 실행기: 저장소 루트에서 한 명령으로 모든 Python·Node·브라우저 회귀를 실행한다.
- `REQ-004` 저위험 정리: 참조 없는 일회성 스크립트를 `scripts/archive/`로 옮기고 SPEC 링크를 갱신한다. 실행 불가 파일(`review-ui` v1, 깨진 검증기)과 `travel-mbti-site` gitlink를 정리한다. 활성 라벨을 덮어쓰는 스크립트는 명시적 플래그 없이는 쓰지 않게 한다. 실행기의 LLM 환경 변수 목록 누락을 고친다.
- `REQ-005` 프론트 공통 도메인: 어휘·이벤트 유형·날짜·문자열 정규화·장소 enrich를 `domain.js`(또는 UMD 공용 모듈) 하나에서 제공하고 앱·테스트가 이를 사용한다.
- `REQ-006` 프론트 분해: `app.js`는 조립과 전역 단축키·리사이즈만 맡는다. 상세 패널, 추천 결과·일정 화면, 추천 실행 제어, 레이아웃(드로어·사이드바)을 별도 모듈로 옮기고 각 모듈이 자기 DOM 이벤트를 바인딩한다. 순환 의존은 명시적 콜백 또는 이벤트로 끊는다.
- `REQ-007` 랭커 분해: `rank`·`buildSchedule`을 필터·점수·변형·seed·일정·경고 단계 함수로 나누고 공개 API(`rank`, `normalizeRequest`, `CONFIG` 등)를 유지한다.
- `REQ-008` 서버 공통화: 시간·거리·원자적 JSON 쓰기·HTTP JSON 응답/본문 읽기를 공용 모듈로 모으고 라우트 테이블로 바꾼다. 환경 변수는 설정 객체 하나에서 읽는다. 테스트가 patch하는 모듈 전역 이름은 유지한다.
- `REQ-009` 서버 분해: `validate_day`, `ItineraryService.generate`, `validate_request`, 피드백 v2/v3 검증기의 공통 부분을 책임별 함수로 나눈다.
- `REQ-010` 스크립트 공용 계층: Python·Node 공용 I/O(JSONL·해시·원자적 쓰기·활성 데이터셋 manifest)를 두고 활성 수집·빌드·검증 스크립트를 옮긴다. 동결 계보와 해시 고정 파일은 제외한다.
- `REQ-011` 문서: 구조가 바뀐 경로를 기준 문서·README·색인에 반영한다.

## 입력과 출력

입력·출력 계약은 바꾸지 않는다. 장소 ID, 좌표 순서(lng, lat), 추천 결과 JSON, 평가 v2/v3 스키마, 일정 API 요청·응답, 인스타 작업 JSON, 생성 데이터 바이트를 유지한다.

## 설계

- 단계: 안전망(REQ-001~003) → 정리(REQ-004) → 프론트(REQ-005~007) → 서버(REQ-008~009) → 스크립트(REQ-010) → 문서(REQ-011).
- 테스트 훅: 테스트가 `page.addInitScript`로 테스트 플래그를 켠 경우에만 `app.js`가 내부 함수 묶음을 노출한다. 운영 경로의 동작과 네트워크 호출 수는 같다.
- 골든 출력은 `scripts/fixtures/golden/`에 JSON으로 저장하고 비교 스크립트가 차이를 보고한다.
- 각 단계는 별도 커밋으로 남긴다.

## 예외와 폴백

골든 비교에서 차이가 나면 해당 단계를 되돌리거나 원인을 SPEC에 기록하고 사용자 확인 전까지 진행하지 않는다. 테스트가 patch하는 이름이 이동해야 하면 기존 위치에 재노출한다.

## 영향 범위

- 변경 예정 파일: 위 관련 코드 경로, `scripts/test_*`, `scripts/validate_ccu_mmr_dashboard.cjs`, `server/travel-feedback/Dockerfile`(새 모듈 복사), 문서.
- 데이터 마이그레이션: 없음.
- 호환성 영향: 외부 계약 없음. 내부 파일 경로가 바뀌는 스크립트는 문서에 기록한다.
- 보안·개인정보 영향: 비밀 파일을 읽지 않는다. 피드백 원본 파일은 내용을 열람하지 않고 경로만 다룬다.

## 승인 기준

- `AC-001`: 각 단계 종료 시 단일 실행기의 모든 회귀가 통과한다.
- `AC-002`: 각 단계 종료 시 골든 출력이 리팩토링 전 기준과 바이트 단위로 같다.
- `AC-003`: 테스트가 소스 텍스트의 함수 순서·들여쓰기에 의존하지 않는다.
- `AC-004`: `map-ui/app.js`가 조립·전역 입력만 담당하고 모듈 간 순환 의존이 없다.
- `AC-005`: 제거·이동한 파일에 대한 현재 문서의 깨진 상대 링크가 0건이다.
- `AC-006`: 서버 HTTP 동작(상태 코드·응답 본문)이 기존 테스트와 추가 골든 요청에서 같다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001 | 전체 회귀 | `python scripts/run_tests.py` (REQ-003에서 추가) |
| AC-002 | 골든 비교 | `node scripts/check_golden_outputs.cjs` (REQ-002에서 추가) |
| AC-003 | 검증 스크립트 검토 | `scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-004 | 의존 그래프 검사 | 모듈 생성 인자 검토 |
| AC-005 | 링크 검사 | Markdown 상대 링크 검사 스크립트 |
| AC-006 | 서버 단위·골든 | `python -m unittest discover -s server/travel-feedback` |

## 구현 결과

진행 중. 단계별 결과를 아래에 추가한다.

### 단계 0 (사전 정리, 2026-10-26)

- 로컬 미푸시 커밋을 `origin/main`(`8fbab8e`) 위로 재적용하고 SPEC 번호 충돌을 SPEC-111·112로 해소했다. 기준선 회귀 전체 통과: 서버 168, 인스타 16+15, Node·브라우저 9종.

## 설계와 달라진 점

없음.

## 알려진 제한

- 피드백 파일(`travel-feedback-anonymized-since-0903 copy.json`)의 Git 이력 삭제 여부는 사용자 결정이 필요하다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-26 | 조사 결과를 바탕으로 초안 작성, 사용자 승인 범위(단계별 전체)로 In Progress |
