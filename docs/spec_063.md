# SPEC-063: 지도 UI 웹 조사 장소 설명 한국어화

- 상태: In Progress
- 작성일: 2026-08-31
- 최종 수정일: 2026-08-31
- 관련 요청: 지도 상세 및 추천 카드의 `어떤 곳인가요?` 영역에 노출되는 영문 장소 설명을 자연스러운 한국어로 정비한다.
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [데이터 계약](data_contracts.md), [SPEC-013](spec_013.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-preference-label-v5-researched/reviews/`, `scripts/build_map_ui_data.mjs`, `map-ui/data/jeju-places.js`, `map-ui/app.js`
- 선행 SPEC: SPEC-013

## 배경

지도 데이터 생성기는 v5 검토 JSON의 `sources[].facts[]`에서 장소별 웹 조사 설명을 골라 `research.highlights[].text`로 만든다. 일부 원본 fact가 영문 문장으로 작성되어 지도 상세와 추천 카드의 `어떤 곳인가요?` 영역에 그대로 노출될 수 있다.

## 목표

- 현재 지도 UI에 노출될 수 있는 영문 전용 웹 조사 설명을 전수 식별한다.
- 해당 설명을 원문의 사실관계와 provenance를 유지한 자연스럽고 간결한 한국어 문장으로 바꾼다.
- 지도 번들을 다시 생성하고 영문 전용 `research.highlights[].text`가 0건인지 전수 검증한다.
- 지도 상세와 추천 카드가 같은 한국어 설명을 정상적으로 표시하는지 확인한다.
- 검증된 변경을 Git 원격 `main`에 push하고 기존 버전 릴리스 절차로 `/travel/` 운영 서버에 배포한다.

## 비목표

- 이미 정상적인 한국어 fact의 문체를 일괄 수정하는 작업
- 내부 라벨 판정용 `rationale`, 라벨 점수, 출처 또는 다른 provenance의 번역·변경
- 웹 재조사, 새로운 사실 추가, 추천·랭킹 로직 변경

## 요구사항

- `REQ-6301`: v5 원본 `sources[].facts[]`와 생성된 `research.highlights[].text`를 대조해 현재 UI에 노출될 수 있는 영문 전용 설명을 전수 조사한다.
- `REQ-6302`: 영문 전용 UI 설명을 원문에 없는 정보를 더하지 않고 자연스럽고 간결한 한국어로 번역한다.
- `REQ-6303`: 장소명·인명·문화재명·시설명은 확인 가능한 공식 한국어 명칭을 우선하고, 연도·수치·접근성·운영 여부는 원문과 일치시킨다.
- `REQ-6304`: `source.id`, `publisher`, `url`, `checked_at`, 라벨 점수, `rationale` 및 다른 provenance 정보는 변경하지 않는다.
- `REQ-6305`: 원본 JSON 변경 후 지도 번들을 재생성하며, 생성된 모든 `research.highlights[].text`에서 영문 전용 설명이 0건이어야 한다.
- `REQ-6306`: 장소 상세와 추천 카드의 `어떤 곳인가요?` 제목 및 설명 표시 계약을 검증한다.
- `REQ-6307`: 이번 변경만 선택적으로 Git 커밋·push하고, 기존 Rail Desk 서비스와 피드백 데이터를 보존한 채 Map UI를 `/travel/`에 버전 배포한다.

## 입력과 출력

- 입력: `data/labeling/jeju/2026-08-09/place-preference-label-v5-researched/reviews/*.json`의 `sources[].facts[]`
- 출력: 같은 원본 JSON의 번역된 fact와 `map-ui/data/jeju-places.js`의 재생성된 `research.highlights[].text`
- 연결 키: 장소는 `contentid`, 설명 provenance는 `source.id`로 연결한다.
- 번역 판정: 한글 문자가 없고 영문 알파벳이 포함된 문자열을 영문 전용 설명으로 감사한다. URL·publisher 등 비설명 필드는 대상에서 제외한다.

## 설계

1. 현재 생성기와 동일한 선택 규칙으로 각 장소의 highlight를 계산해 UI 노출 가능 영문 문장과 원본 파일·source·fact 위치를 목록화한다.
2. 목록화된 원본 fact만 수동 검토해 한국어로 번역한다. 의미가 불명확하거나 공식 명칭을 확정할 수 없는 문장은 보류 목록에 남긴다.
3. 생성기를 실행해 `map-ui/data/jeju-places.js`를 갱신한다.
4. 생성된 모든 highlight에 한글 포함 여부와 영문 전용 판정을 적용하고, 원본 provenance 필드가 번역 전후 동일한지 검사한다.
5. 대시보드 검증과 DOM 계약 검사를 실행해 상세·추천 카드 표시를 확인한다.

## 예외와 폴백

- 고유명사나 브랜드 영문 표기가 필요하면 유지하되 문장 전체는 한국어로 작성한다.
- 공식 한국어 명칭을 확인할 수 없으면 원명의 음역 또는 영문 표기를 유지하고 과도하게 의역하지 않는다.
- 원문의 의미가 불명확해 사실을 보존한 번역이 불가능하면 임의로 보완하지 않고 보류 사유를 기록한다.

## 영향 범위

- 변경 예정 파일: 관련 v5 review JSON, `map-ui/data/jeju-places.js`, `docs/spec_063.md`, `docs/README.md`
- 데이터 마이그레이션: 없음. 기존 스키마와 provenance를 유지한 텍스트 정비 및 정적 번들 재생성이다.
- 호환성 영향: 없음. `research.highlights` 구조와 UI 렌더링 계약은 바꾸지 않는다.
- 보안·개인정보 영향: 없음. 공개 장소 설명만 수정한다.

## 승인 기준

- `AC-6301`: 번역 전 UI 노출 가능 영문 전용 highlight의 장소 수와 문장 수, 원본 위치가 전수 집계된다.
- `AC-6302`: 식별된 모든 문장이 사실관계를 보존한 한국어 문장으로 바뀌고, 보류가 있으면 장소명·원문·사유가 기록된다.
- `AC-6303`: 번역 대상 외 `source.id`, `publisher`, `url`, `checked_at`, 라벨 점수와 provenance 값이 바뀌지 않는다.
- `AC-6304`: 재생성된 `research.highlights[].text`의 영문 전용 설명 잔여 건수가 0이다.
- `AC-6305`: 지도 상세와 추천 카드에 `어떤 곳인가요?` 제목과 한국어 설명을 표시하는 DOM 계약 및 관련 대시보드 검증을 통과한다.
- `AC-6306`: 생성기·지도 앱 구문 검사와 지도 데이터 생성이 통과하고 SPEC에 실제 결과가 기록된다.
- `AC-6307`: 원격 `main`이 번역 커밋을 포함하고, 공개 `/travel/`과 핵심 장소 데이터, 기존 `/`, `/healthz`가 HTTP 200이며 서버 컨테이너가 healthy다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-6301, AC-6302 | 생성기 선택 규칙을 재현한 전수 감사 및 번역 전후 비교 | 임시 읽기 전용 Node 감사 스크립트 |
| AC-6303 | 번역 전 백업과 변경 JSON의 비대상 필드 구조 비교 | 임시 읽기 전용 Node 비교 스크립트 |
| AC-6304 | 생성 bundle의 모든 `research.highlights[].text` 전수 검사 | 임시 읽기 전용 Node 감사 스크립트 |
| AC-6305 | 상세·추천 카드 DOM 계약과 실제 bundle 연계 검사 | `node scripts/validate_ccu_mmr_dashboard.cjs` |
| AC-6306 | JavaScript 구문 검사와 결정적 데이터 생성 | `node --check scripts/build_map_ui_data.mjs`; `node --check map-ui/app.js`; `node scripts/build_map_ui_data.mjs` |
| AC-6307 | Git 원격·공개 경로·핵심 자산·서버 컨테이너 회귀 확인 | `git push origin main`; `/`, `/healthz`, `/travel/`; 서버 `docker compose ps` |

## 구현 결과

- 번역 전 생성 bundle에서 영문 전용 highlight 143문장, 73곳을 식별했다.
- 선택 문장을 한국어로 바꾼 뒤 번들을 재생성할 때 한국어 동적 정보 패턴이 적용되어 뒤쪽 영문 fact가 새로 선택되는 경우를 반복 감사했다. 추가로 노출된 37문장을 번역해 총 73곳 180문장을 수정했다.
- 원본 review JSON 73개에서는 `sources[].facts[]` 문자열 180개만 변경했다. 구조 비교 결과 `source.id`, `publisher`, `url`, `checked_at`, 라벨 점수, `rationale`와 다른 provenance 변경은 0건이다.
- `map-ui/data/jeju-places.js`를 다시 생성했다. 전체 3,199개 `research.highlights[].text`에서 영문 알파벳이 있으면서 한글이 없는 영문 전용 설명은 0건이다.
- 로컬 브라우저에서 송악산을 검색해 상세 패널의 `어떤 곳인가요?` 제목과 한국어 설명 2건을 확인했다. 같은 필터로 추천을 실행해 추천 카드 4개의 `어떤 곳인가요?` 제목과 한국어 설명 표시도 확인했으며 브라우저 경고·오류는 없었다.
- 의미 또는 공식 명칭이 불명확해 보류한 문장은 없다.

## 검증 결과

| 명령 또는 검사 | 결과 |
|---|---|
| 원본 JSON 구조 비교 | 통과 (73개 파일, fact 180문장 변경, 비대상 필드 변경 0건) |
| 생성 highlight 전수 감사 | 통과 (전체 3,199문장, 영문 전용 0건) |
| `node --check scripts/build_map_ui_data.mjs` | 통과 |
| `node --check map-ui/app.js` | 통과 |
| `node scripts/build_map_ui_data.mjs` | 통과 (유효 좌표 2,153곳, 추천 가능·research 연결 1,663곳) |
| `node scripts/validate_ccu_mmr_dashboard.cjs` | 통과 (장소 2,153곳, 추천 가능 1,663곳, 장소별 라벨 41개, research coverage 1,663곳) |
| 로컬 브라우저 상세·추천 카드 확인 | 통과 (송악산 상세 설명 2건, 추천 카드 4개, 콘솔 경고·오류 0건) |

## 설계와 달라진 점

최초 노출 143문장만 한 번에 수정하는 대신, 번역 후 동적 정보 판정과 정렬 결과가 달라져 새로 선택된 영문 fact를 반복 감사했다. 데이터 구조나 생성 알고리즘은 변경하지 않았다.

## 알려진 제한

- 이번 판정 대상은 한글이 없고 영문 알파벳이 포함된 UI 설명이다. 영문이 아닌 기존 손상 문자열 `?`로만 구성된 북앤북스(`3307523`) highlight 2건은 이번 영문 번역 범위 밖이라 변경하지 않았다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-31 | 승인된 요청을 기준으로 SPEC 작성 및 구현 시작 |
| 2026-08-31 | 73곳 180문장 한국어화, 번들 재생성, provenance·영문 잔여·대시보드·브라우저 표시 검증 완료 |
| 2026-08-31 | 사용자 후속 요청에 따라 Git push와 기존 `/travel/` 서버 배포 범위 승인 |
