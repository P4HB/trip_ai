# SPEC-061: Graphify 프로젝트 전용 코드 지식 그래프 설정

- 상태: Implemented
- 작성일: 2026-08-30
- 최종 수정일: 2026-08-30
- 관련 이슈: 새 AI coding agent 세션의 반복적인 전체 코드베이스 탐색과 토큰 낭비 방지
- 관련 문서: [문서 색인](README.md), 루트 `AGENTS.md`
- 관련 코드: `AGENTS.md`, `graphify-out/`, `.gitattributes`, `.git/hooks/`
- 선행 SPEC: 없음

## 배경

새 coding agent 세션은 저장소 구조를 알기 위해 코드 전체를 반복 탐색할 수 있다. Graphify의 로컬 AST 지식 그래프를 프로젝트 탐색의 첫 단계로 사용하면 관련 모듈과 의존 관계를 먼저 좁힌 뒤 필요한 소스만 확인할 수 있다.

## 목표

- 공식 패키지 `graphifyy`와 프로젝트 전용 Codex integration을 설정한다.
- 외부 API key나 LLM 없이 코드 전용 로컬 AST 그래프를 생성한다.
- 새 세션이 Graphify를 먼저 조회하고 실제 소스를 최종 기준으로 확인하도록 `AGENTS.md`에 명시한다.
- Git commit 뒤 Graphify 그래프를 안전하게 갱신하는 공식 hook을 설치한다.

## 비목표

- 애플리케이션 소스코드 또는 런타임 동작 변경
- 문서·이미지의 LLM 분석
- 외부 LLM, API key 또는 원격 그래프 저장소 사용
- 자동 commit 또는 push

## 요구사항

- `REQ-6101`: Graphify는 `graphifyy` 패키지로 설치하고 프로젝트에만 Codex integration을 적용해야 한다.
- `REQ-6102`: 초기 그래프는 `--code-only` 로컬 AST 분석으로 생성해야 한다.
- `REQ-6103`: `AGENTS.md`의 기존 내용을 보존하고 Graphify 우선 탐색, 소스 직접 확인, 최소 파일 읽기, stale graph 갱신 원칙을 병합해야 한다.
- `REQ-6104`: 기존 Git hook을 덮어쓰지 않고 Graphify 공식 hook 설치 방식을 사용해야 한다.
- `REQ-6105`: 생성 결과와 간단한 query를 검증하고 파일·노드 수 및 제한을 기록해야 한다.

## 입력과 출력

- 입력: 저장소의 코드 파일과 Graphify가 존중하는 ignore 규칙
- 출력: `graphify-out/graph.json`, `GRAPH_REPORT.md` 및 Graphify가 생성하는 프로젝트 통합·hook 설정

## 설계

`graphify install --project --platform codex`로 프로젝트 지침을 병합한다. `graphify extract . --code-only`로 초기 그래프를 만들고, query 결과로 관련 모듈 검색을 확인한다. Git 저장소에는 `graphify hook install`을 사용한다. Graphify 결과는 탐색 지도이며 수정 전 실제 source file을 반드시 확인한다.

## 예외와 폴백

- 기존 hook이 있으면 내용을 보존할 수 있는 Graphify 공식 병합 동작을 확인한 뒤 설치한다.
- 그래프 생성이 과도한 산출물이나 미지원 파일로 실패하면 `.graphifyignore` 등 Graphify 전용 설정만 조정한다.
- 그래프가 오래되었거나 코드 변경 후 불일치하면 `graphify update .` 또는 동등한 공식 명령으로 갱신한다.

## 영향 범위

- 변경 예정 파일: Graphify가 생성하는 integration·graph 산출물, `AGENTS.md`, `.gitattributes`, 본 SPEC과 `docs/README.md`, `.git/hooks/`의 Graphify hook
- 데이터 마이그레이션: 없음
- 호환성 영향: 애플리케이션 런타임 영향 없음
- 보안·개인정보 영향: 로컬 AST 분석만 사용하며 API key와 외부 LLM을 사용하지 않음

## 승인 기준

- `AC-6101`: 설치된 Graphify 버전을 확인할 수 있다.
- `AC-6102`: 프로젝트 전용 Codex integration과 요청한 `AGENTS.md` 원칙이 존재한다.
- `AC-6103`: `graphify-out/graph.json`과 보고서가 생성되고 파일·노드 수를 확인할 수 있다.
- `AC-6104`: Graphify Git hook 상태가 installed이며 기존 hook을 손상하지 않는다.
- `AC-6105`: 간단한 Graphify query에서 프로젝트 핵심 코드 모듈이 검색된다.
- `AC-6106`: 애플리케이션 소스코드 diff가 추가되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-6101 | CLI 버전 확인 | `graphify --version` |
| AC-6102 | integration·지침 내용 확인 | `graphify install --project --platform codex`, `AGENTS.md` |
| AC-6103 | 그래프 JSON·보고서 존재 및 통계 확인 | `graphify extract . --code-only`, `graphify-out/graph.json`, `GRAPH_REPORT.md` |
| AC-6104 | hook 설치 상태와 파일 내용 확인 | `graphify hook status`, `.git/hooks/` |
| AC-6105 | 핵심 모듈 query | `graphify query "..."` |
| AC-6106 | 변경 파일 경로 감사 | `git status --short`, `git diff --name-only` |

## 구현 결과

- `uv tool install graphifyy`로 Graphify 0.9.52를 설치했다.
- `graphify install --project --platform codex`로 프로젝트 전용 Codex skill과 `AGENTS.md` 지침을 설치했다.
- `graphify extract . --code-only`와 `graphify cluster-only . --no-label`로 외부 LLM 없이 그래프·보고서·HTML을 생성했다.
- code-only 탐지 8,959개 중 100개 source file이 노드를 생성했고 최종 그래프는 2,570 nodes, 4,302 links, 180 communities다.
- `graphify hook install`로 post-commit·post-checkout hook과 `graphify-out/graph.json` merge driver를 등록했다. 설치 전 active hook은 없었다.
- 테스트 query는 `collect_tourapi_jeju.py`, `split_tourapi_jeju_places.mjs`, `map-ui/app.js`, `map-ui/preference-elicitation.js`, `map-ui/ccu-mmr.js`, `feedback_api.py`와 관련 테스트 모듈을 반환했다.
- 애플리케이션 소스코드는 변경하지 않았다.

## 설계와 달라진 점

- Graphify 0.9.52의 `extract`는 그래프 JSON까지만 생성하고 보고서는 후속 `cluster-only`를 안내했다. 외부 LLM 금지 조건을 지키기 위해 `--no-label`로 보고서를 생성했다.
- 프로젝트 integration이 만든 `.codex/hooks.json`은 현재 Codex Desktop hot-reload에서 setup refresh 오류를 일으켰다. 해당 파일은 Graphify 출력상 intentional no-op이며 실제 지침은 `AGENTS.md`가 담당하므로 제거했다.

## 알려진 제한

- JSON 데이터가 code-only 탐지에 포함되어 초기 스캔 파일 수가 8,959개로 크다. 최종 노드에 기여한 source file은 100개이며 query는 핵심 코드 모듈을 정상 검색한다.
- 외부 LLM을 사용하지 않아 커뮤니티 이름은 `Community N` placeholder다.
- 프로젝트 skill 설치 직후 현재 Codex Desktop 세션의 hot-reload가 실패해 검증 명령은 승격 실행으로 계속했다. 새 세션 적용 대상인 skill과 `AGENTS.md`는 유지한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-30 | 사용자 승인 범위로 SPEC 작성 및 구현 시작 |
| 2026-08-30 | code-only 그래프·Codex integration·Git hook·query 검증 완료 |
