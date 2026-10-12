# SPEC-109: 비밀 파일(.env) AI 열람 금지

- 상태: Implemented
- 작성일: 2026-10-12
- 최종 수정일: 2026-10-12
- 관련 이슈: 사용자 요청 — ".env 만들었는데 절대 열람금지로 박아놔"
- 관련 문서: [AGENTS.md](../AGENTS.md), [안전·개인정보](safety_privacy.md), [SPEC-107](spec_107.md), [SPEC-108](spec_108.md)
- 관련 코드: `AGENTS.md`, `.claude/settings.json`, `.cursorignore`, `.geminiignore`, `.aiexclude`, `.gitignore`(기존)
- 선행 SPEC: 없음

## 배경

사실: 사용자가 저장소 루트에 LLM API 키를 담은 `.env`를 만들었다. `.gitignore`는 이미 `.env`, `.env.*`를 제외하고 `.env.example`만 허용한다. 로컬 실행기(`scripts/run_trip_ai_local.py`)와 서버는 실행 시 환경변수·`.env`를 읽지만 값을 출력하지 않는다. 이 저장소는 여러 AI 도구(Codex, Claude, Cursor, Gemini 계열)가 다룬다.

## 목표와 비목표

- 목표: 어떤 AI 에이전트도 `.env` 내용을 읽거나 옮기지 못하게 저장소 규칙과 도구별 차단 설정을 둔다.
- 비목표: 프로그램이 실행 중 키를 읽는 동작 변경, 키 회전·암호화 저장소 도입, Git 이력 정리(커밋된 적 없음).

## 요구사항

- `REQ-10901`: `AGENTS.md`에 `.env`·`.env.*`(템플릿 `.env.example` 제외)와 키·토큰 파일의 열람·출력·검색·복사·업로드·편집·내용 인용 금지를 사용자 지시로 명시한다. 사용자의 명시적 재허락 전 예외가 없다.
- `REQ-10902`: 도구가 지원하는 차단 설정을 둔다. Claude Code `.claude/settings.json`의 `permissions.deny`(Read/Edit), Cursor `.cursorignore`, Gemini CLI `.geminiignore`, Gemini Code Assist `.aiexclude`.
- `REQ-10903`: 키가 필요한 코드는 값을 출력·로그·응답에 남기지 않고 "설정됨/없음"만 표시한다(기존 동작 유지·확인).

## 설계

규칙(AGENTS.md)이 정본이며 도구별 설정은 보조 차단이다. Claude Code 거부 규칙은 공식 예시 형태(`Read(./.env)`, `Read(./.env.*)`)를 쓰므로 `.env.example`도 Claude Code에서는 읽기 거부되지만 값이 없는 템플릿이라 영향이 없다. Cursor·Gemini CLI 파일은 gitignore 문법으로 `.env.example`만 다시 허용한다. Codex 등 별도 차단 설정이 없는 도구는 AGENTS.md 규칙으로만 통제된다.

## 승인 기준과 검증

| 기준 | 검증 |
|---|---|
| AC-10901 | AGENTS.md에 규칙 존재, 색인 등록 |
| AC-10902 | `.claude/settings.json` JSON 유효, ignore 파일 패턴 확인, `git check-ignore`로 `.env`·`.env.local` 무시·`.env.example` 비무시 확인 |
| AC-10903 | 로컬 실행기·서버 로더가 키 값을 출력하지 않는 테스트(`test_restaurant_candidates.py`, `test_llm_gemini.py`)와 코드 확인 |

## 구현 결과

- 위 다섯 파일을 추가·수정했다. `git check-ignore -v`: `.env`(.gitignore:1), `.env.local`(.gitignore:2) 무시, `.env.example`은 무시되지 않음.
- 이 작업 중 어떤 에이전트도 `.env`를 열거나 스테이징하지 않았다(파일 목록에서 존재·크기만 확인).

## 알려진 제한

규칙은 각 도구가 지켜야 효과가 있다. 차단 설정이 없는 도구나 사람이 직접 연 편집기·터미널은 막지 못한다. 키가 노출됐다고 의심되면 공급자 콘솔에서 키를 폐기·재발급한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-12 | 사용자 지시로 규칙·도구별 차단 설정 추가 |
