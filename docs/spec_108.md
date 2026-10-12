# SPEC-108: Gemini LLM 공급자 지원

- 상태: In Progress
- 작성일: 2026-10-12
- 최종 수정일: 2026-10-12
- 관련 이슈: 사용자 요청 — "gemini로 할거야" (동선 시간표·식당 판정·리뷰 분석 LLM을 Gemini로)
- 관련 문서: [SPEC-083](spec_083.md), [SPEC-107](spec_107.md), [SPEC-109](spec_109.md), [안전·개인정보](safety_privacy.md), [아키텍처](architecture.md)
- 관련 코드: `server/travel-feedback/llm_client.py`, `server/travel-feedback/feedback_api.py`, `server/travel-feedback/fake_llm_scheduler.py`, `server/travel-feedback/deploy_into_rail_release.py`, `scripts/run_trip_ai_local.py`, `scripts/build_visit_insights.py`, `.env.example`
- 선행 SPEC: SPEC-083(공통 structured LLM 인터페이스), SPEC-107(D8 키만으로 동작)

## 배경

사실: `llm_client.py`의 `OpenAIClient`만 있다(Responses API, strict JSON schema, `store=false`, 첫 호출 전 모델 접근 확인). 서버·실행기·리뷰 분석 스크립트가 `OPENAI_API_KEY`와 이 클래스를 직접 쓴다. 모든 호출부는 `generate_structured(task, input, schema, timeout)`만 사용하고 서버가 결과를 `validate_schema`로 다시 검증한다.

외부 확인(2026-10-12): Gemini Developer API의 `generateContent`는 계속 완전 지원되며(새 기능은 Interactions API 우선) REST `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, 헤더 `x-goog-api-key`를 쓴다. 현재 안정 텍스트 모델은 `gemini-3.8-flash`(2026-09-02 GA), `gemini-3.6-flash`, `gemini-3.5-flash-lite` 등이며 2.5 계열은 신규 접근이 제한된다. Gemini API 추가 약관(2026-03-23 시행)상 **무료(미결제) 사용분은 제품 개선에 쓰이고 사람이 검토할 수 있으며 개인정보를 보내지 말라**고 하고, 결제 연결 사용분은 개선에 쓰지 않고 남용 감지를 위해 제한 기간 로그만 남긴다.

## 목표와 비목표

- 목표: `GEMINI_API_KEY`만 넣어도 동선 시간표·식당 판정·리뷰 분석이 같은 계약으로 동작한다. OpenAI 경로는 그대로 둔다.
- 비목표: Interactions API 전환, 스트리밍·도구 호출, 다중 공급자 동시 비교, 실제 품질 평가.

## 요구사항

- `REQ-10801`: `GeminiClient.generate_structured()`가 OpenAI 어댑터와 같은 입출력·오류 코드를 낸다. 같은 task별 지시문(시스템 지시)을 쓰고, 입력은 비신뢰 데이터 JSON 한 덩어리로 보낸다. 결과는 기존 `validate_schema`로 검증한다.
- `REQ-10802`: 구조화 출력은 `generationConfig.responseMimeType=application/json`과 `responseJsonSchema`(JSON Schema)를 먼저 쓴다. 공급자가 400으로 거절하면 OpenAPI 부분집합 `responseSchema`(대문자 type, `additionalProperties` 제거, null 결합은 `nullable`)로 한 번 다시 보내고 이후 호출은 그 방식을 유지한다.
- `REQ-10803`: 첫 호출 전 `GET models/{model}`로 모델 접근을 확인한다. 키는 URL이 아닌 헤더로만 보내고 오류·로그·응답에 키·프롬프트·공급자 본문을 남기지 않는다. 사고(thought) part는 결과에서 제외한다. 차단(`promptFeedback.blockReason`, 안전 계열 `finishReason`)은 `llm_refused`, `MAX_TOKENS` 등 미완료는 `llm_incomplete`, JSON/스키마 오류는 `llm_invalid_output`이다.
- `REQ-10804`: 공급자 선택 `LLM_PROVIDER=auto|gemini|openai`(기본 auto). auto는 키가 하나뿐이면 그 공급자, 둘 다 있으면 기존 호환을 위해 openai다. 키 이름은 `GEMINI_API_KEY`(없으면 `GOOGLE_API_KEY`). 모델은 공급자 공통 `ITINERARY_LLM_MODEL`·`RESTAURANT_LLM_MODEL`로 바꾸며 기본값은 gemini `gemini-3.8-flash`, openai `gpt-5.6-terra`. 출력 상한 기본값은 Gemini 8,192(사고 토큰 여유), 허용 256~65,536. 선택적 `GEMINI_THINKING_LEVEL`을 `thinkingConfig.thinkingLevel`로 전달한다.
- `REQ-10805`: `ITINERARY_ENABLED=auto`는 선택된 공급자의 키가 있을 때 켠다. 로컬 실행기는 공급자 이름과 "키 설정됨/없음"만 출력한다. 배포 설치기와 `.env.example`에 새 변수를 추가한다.

## 설계

`llm_client.py`에 task별 지시문 함수를 분리해 두 어댑터가 공유하고, `GeminiClient`와 `create_llm_client()` 팩토리, `json_schema_to_gemini()` 변환기를 둔다. 서버(`feedback_api.load_itinerary_service`)와 `build_visit_insights.py`는 팩토리를 쓴다. 프롬프트 버전 문자열은 공급자와 무관하게 같고 provenance의 `model`·`adapterPromptVersion`으로 구분한다. 테스트·오프라인 평가용 `GeminiGenerateStub`은 `generateContent` 응답 모양을 흉내 낸다.

## 예외와 폴백

| 상황 | 동작 |
|---|---|
| 키 없음 | `llm_not_configured`, 기능 자동 비활성 |
| 모델 없음/권한 없음 | `llm_model_unavailable`(해당 날짜 unavailable, 다른 기능 유지) |
| `responseJsonSchema` 400 | `responseSchema`로 1회 재시도, 다시 실패하면 공급자 오류 |
| 안전 차단·미완료·형식 오류 | 위 오류 코드. 시간표는 기존 수정·실패 규칙, 식당 판정은 `judgement_unavailable` |
| 알 수 없는 `LLM_PROVIDER` | 동선 기능만 비활성 |

## 영향 범위

변경 파일은 관련 코드 목록과 테스트(`test_llm_gemini.py` 신규, `test_deploy_into_rail_release.py`), 문서(README 3종, `safety_privacy.md`, `architecture.md`, `docs/README.md`, SPEC-107 링크). 데이터·UI 변경 없음. 개인정보: 전송 데이터 범위는 SPEC-083/107과 같다(공개 장소·식당·리뷰 발췌와 허용 목록 여행자 맥락). 무료 키는 약관상 학습·사람 검토 대상이므로 **결제 연결 프로젝트 키를 권장**한다.

## 승인 기준과 테스트 계획

| 기준 | 검증 |
|---|---|
| AC-10801 | 요청 모양(헤더 키, URL에 키 없음, 시스템 지시·`responseJsonSchema`·`maxOutputTokens`), 결과 파싱·사용량, thought part 제외 |
| AC-10802 | 400 → `responseSchema` 변환 재시도와 유지, 변환 결과에 `additionalProperties` 없음·null→nullable(실제 3개 스키마) |
| AC-10803 | 모델 확인·불가 모델, 차단/안전/MAX_TOKENS/잘못된 JSON/스키마 위반, HTTP 오류 무누출, deadline·크기 제한 |
| AC-10804 | 공급자 선택 표, `GOOGLE_API_KEY` 대체, 잘못된 값 |
| AC-10805 | `GEMINI_API_KEY`만으로 서비스 로드·하루 생성(시간표+식당 판정 generateContent 2회), 키 미노출 |
| 회귀 | `python -m unittest discover -s server/travel-feedback -p "test_*.py"`, `node scripts/test_itinerary_ui.cjs` |

실제 Gemini 호출은 키가 있는 사용자 환경에서만 확인할 수 있으며 이 문서 작성 환경에서는 미검증이다.

## 구현 결과

**로컬 구현·검증 완료, 실제 Gemini 호출 미검증**이다. 키가 없는 환경이라 실제 계정의 모델 접근·구조화 출력 수락 여부·품질·지연·비용은 확인하지 않았으므로 상태는 `In Progress`로 둔다.

- `llm_client.py`: `task_instructions()` 분리(두 어댑터 공유), `GeminiClient`, `json_schema_to_gemini()`, `resolve_llm_provider()`, `llm_key_configured()`, `model_for_provider()`, `create_llm_client()`. 모델 확인은 응답 `name`이 `models/`로 시작하고 `supportedGenerationMethods`에 `generateContent`가 있으면 통과한다(`*-latest` 같은 별칭이 다른 이름으로 풀려도 막지 않기 위함).
- `feedback_api.py`: `itinerary_enabled()` auto 판정과 서비스 로더가 팩토리를 쓴다. 식당 판정 클라이언트도 같은 공급자로 만든다(`RESTAURANT_LLM_MODEL`, `RESTAURANT_LLM_MAX_OUTPUT_TOKENS`).
- `scripts/run_trip_ai_local.py`: 공급자와 "키 설정됨/없음"만 출력. `scripts/build_visit_insights.py`: 팩토리 사용.
- `deploy_into_rail_release.py`: `LLM_PROVIDER`, `GEMINI_API_KEY` 추가, `ITINERARY_LLM_MODEL` 기본값을 비워 공급자 기본 모델을 쓰게 하고 기존 설치의 `gpt-5.6-terra` 기본 줄을 업그레이드 시 중립화.
- `fake_llm_scheduler.py`: `GeminiGenerateStub`(모델 조회·generateContent 응답 모양, thought part 포함).
- 문서: 서버 README, 루트 README 방법 3, `.env.example`, `architecture.md`, `safety_privacy.md`(Gemini 약관·결제 키 권장), `docs/README.md`, SPEC-107 D8 링크.

검증(2026-10-12, Linux, Python 3.13, 저장소 루트 기준):

| 명령 | 결과 |
|---|---|
| `python -m unittest server/travel-feedback/test_llm_gemini.py` | 11개 통과(AC-10801~10805) |
| `python -m unittest discover -s server/travel-feedback -p "test_*.py"` | 156개 중 155개 통과. 실패 1건은 변경 전부터 실패하던 `test_itinerary_adapters`의 카탈로그 결정성 테스트(SPEC-107 기록과 동일) |
| `node scripts/test_itinerary_ui.cjs` | 3개 시나리오 통과(UI 변경 없음, 회귀 확인) |
| `GEMINI_API_KEY=<가짜 값> python scripts/run_trip_ai_local.py` | `LLM 공급자: gemini · 키 설정됨`, 시간표·판정 모델 `gemini-3.8-flash`, 키 값 미출력 |

설계 차이: 없음. 모델 이름 검사만 위처럼 완화했다.

## 알려진 제한

- `responseJsonSchema`/`responseSchema`가 받는 JSON Schema 부분집합과 사고 토큰 소비는 모델별로 다를 수 있다. 서버 재검증이 최종 기준이다.
- 무료 키 사용 시 입력이 Google 제품 개선·사람 검토에 쓰일 수 있다.
- 실제 Gemini 호출 미검증. 첫 실행 시 로컬 실행기로 하루 동선을 만들어 시간표와 식당 판정이 모두 나오는지 확인해야 한다. `responseJsonSchema`가 거절되면 자동으로 `responseSchema`로 바뀐다.
- 두 키가 모두 있으면 auto는 OpenAI를 고른다. Gemini를 쓰려면 `LLM_PROVIDER=gemini`.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-12 | Gemini 공식 문서·약관 확인, 요구사항·설계 작성(구현 전) |
| 2026-10-12 | 구현·로컬 검증 완료. 실제 Gemini 호출 미검증으로 In Progress 유지 |
