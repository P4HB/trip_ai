# SPEC-007: 제주 비음식점 전체 웹 조사·DB 저장·자동 라벨 확장

- 상태: Implemented
- 작성일: 2026-08-10
- 최종 수정일: 2026-08-10
- 관련 이슈: 검수한 100건을 기준으로 음식점을 제외한 제주 장소 전체를 웹 조사하고 companion·월별 적합도를 자동 라벨링해 DB에 저장
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [시스템 아키텍처](architecture.md), [SPEC-006](spec_006.md)
- 관련 코드: `scripts/fetch_all_place_web_pages.mjs`, `scripts/build_all_place_profiles.py`, `scripts/validate_all_place_profiles.py`, `data/labeling/jeju/2026-08-09/full/place-profile-v1-all-1434/`
- 선행 SPEC: [SPEC-006](spec_006.md)

## 배경

제주 TourAPI 2026-08-09 스냅샷은 2,154건이며 음식점 720건과 비음식점 1,434건으로 분리되어 있다. SPEC-005와 SPEC-006은 비음식점 중 관광지·문화시설·축제·레포츠 100건만 실제 상세 페이지에서 조사하고 companion 5축과 month 12축 AI 초안을 만들었다. 사용자가 이 100건을 검토한 결과 대부분이 적절하다고 확인했고, 같은 원칙을 음식점을 제외한 나머지 전체 장소로 확장하도록 요청했다.

현재 100건 파이프라인은 날짜, 건수, 네 유형, 세 개 수동 배치와 개별 장소 예외를 하드코딩하므로 단순히 입력 건수만 바꿀 수 없다. 전체 비음식점에는 기존 파일럿에 없던 숙박 209건과 쇼핑 397건도 있다. 또한 현재 저장소에는 조사 사실과 라벨을 질의할 수 있는 데이터베이스가 없다.

이번 변경은 기존 TourAPI 스냅샷이나 지도 데이터를 수정하지 않고, 새 파생 SQLite 데이터베이스와 결정적 JSONL export를 만든다. 모든 `contentid`는 별도 장소로 유지한다. 같은 제목·주소·좌표가 있어도 자동 병합하지 않는다.

## 결정

- 사용자의 “음식점 빼고 전부” 요청에 따라 관광지, 문화시설, 축제, 레포츠, 숙박, 쇼핑 전부를 같은 5개 companion 축과 12개 month 축으로 자동 제안한다.
- 점수의 경험 범위는 유형별로 구분한다.
  - 관광지·문화시설·레포츠: 대표 방문 경험
  - 축제: 행사 참여 경험. month는 개최일 필터 대상이므로 12축 모두 N/A
  - 숙박: 해당 시설에서의 숙박 경험
  - 쇼핑: 관광 중 해당 시장·매장·쇼핑시설을 방문하는 경험
  - 여행코스: 코스 전체를 이동하는 경험. 현재 입력에는 0건이다.
- 기존 DB를 수정하는 것이 아니라 새 로컬 파생 SQLite를 생성한다.
- 사용자가 새 라벨을 직접 채우는 일을 최소화하기 위해 식별이 불확실한 장소도 유형 기반 저신뢰도 수치 prior를 제안한다. 다만 `confidence=0.25`, `high` 검수 우선순위와 불확실성 이유를 반드시 기록하고 직접 근거로 표현하지 않는다.
- 기존 100건의 v3 수치·제약·근거는 전체 산출물에 그대로 포함해 회귀 기준으로 사용한다. “대부분 적절”이라는 피드백을 전건 골드 승인으로 해석하지 않으며 전체 결과는 계속 `ai_draft`다.

## 목표

- 음식점을 제외한 1,434개 장소 모두에 대해 공개 상세 페이지를 실제 조회하거나 조회 실패를 명시적으로 기록한다.
- 어떤 곳인지 알 수 있도록 장소 식별 상태, 한줄 요약, 대표 경험, 환경, 구조화 사실, 미확인 사항, 확인한 URL·페이지 제목·해시·확인일을 저장한다.
- companion 7,170축 전부와 비축제 month 16,872축 전부에 자동 수치 제안을 만든다.
- 축제 28건의 month 336축만 날짜 종속 N/A로 구분한다.
- 수치, confidence, 추론 수준, rationale, 규칙·출처 provenance, hard constraint와 검수 우선순위를 SQLite와 canonical export에 함께 저장한다.
- 네트워크 중단 뒤 재개할 수 있고 같은 캐시·규칙 입력에서는 동일한 논리 결과를 생성한다.

## 비목표

- 음식점 720건 조사 또는 라벨링
- style, theme, recommendable 등 새 라벨 축 도입
- 추천·랭킹·일정 최적화 또는 운영 API 구현
- 실시간 날씨, 가격, 객실 재고, 영업·개최 여부 보장
- 장소 중복 ID 자동 삭제·병합
- 기존 100건 검수 HTML을 1,434건 UI로 확장
- 사람 검수 없이 AI 초안을 골드 라벨이나 운영 추천 데이터로 승격
- 웹 페이지 원문 HTML 전체를 Git 또는 SQLite BLOB로 보관

## 요구사항

- `REQ-001`: 입력은 `data/labeling/jeju/2026-08-09/non_restaurants.json`의 원본 순서 1,434건이며 `contenttypeid == "39"`를 한 건도 포함하지 않아야 한다. 유형 분포는 12=566, 14=97, 15=28, 28=137, 32=209, 38=397이다.
- `REQ-002`: 수집기는 각 `contentid`의 HTTP(S) 상세 페이지를 실제로 조회하고 URL, source type, HTTP 상태, 페이지 제목, 추출한 overview·안내 필드, 확인일, 본문 SHA-256 또는 오류를 checkpoint에 기록해야 한다. 검색 결과 목록과 snippet만으로 `matched`를 선언하지 않는다.
- `REQ-003`: 현재 인증 가능한 TourAPI 상세 API가 없을 때는 contentid 기반 K-TRIP TIPS 상세 페이지를 `reputable_secondary` 폴백으로 사용한다. 경로는 12=`tourspot`, 14=`culture`, 15=`festival`, 28=`leisure`, 32=`stay`, 38=`shopping`이다. 페이지가 제공하는 공식 홈페이지 URL은 별도 source candidate로 보존한다.
- `REQ-004`: 네트워크 수집은 최대 동시성 5, timeout, 재시도·backoff, 완료 ID skip과 원자적 checkpoint를 지원한다. HTTP 200도 제목·주소·유형 단서가 맞지 않으면 `uncertain`으로 기록한다.
- `REQ-005`: 조사 레코드는 `contentid`, `source_order`, `research_status`, `identity_notes`, `summary`, `place_kind`, `experience_scope`, `typical_visit`, 구조화 facts, sources, unknowns를 가져야 한다. 운영시간·가격·행사일처럼 변하는 값은 확인일과 `time_varying` 표시 없이 확정적으로 저장하지 않는다.
- `REQ-006`: 기존 파일럿 100건은 SPEC-005/006 산출물의 수치·축별 provenance·hard constraint를 변경 없이 전체 데이터에 연결하고 source hash를 기록한다. 나머지 1,334건만 새 웹 조사·일반화 규칙으로 보완한다.
- `REQ-007`: companion 키는 `solo`, `couple`, `friends`, `kids`, `parents`이고 전 1,434건 7,170축이 `0`, `0.25`, `0.5`, `0.75`, `1` 중 하나여야 한다.
- `REQ-008`: 축제가 아닌 1,406건의 month 16,872축은 모두 수치여야 한다. 축제 28건의 month 336축만 `not_applicable/date_gated_not_applicable`로 `null`이어야 한다.
- `REQ-009`: 추론 우선순위는 `pilot_reviewed_anchor > direct_evidence > researched_inference > archetype_prior > climate_heuristic`이다. 직접 claim이 연결되지 않은 `0`·`1`은 금지하고 일반·불확실 fallback은 `0.25..0.75`로 제한한다.
- `REQ-010`: 숙박은 숙박 경험, 쇼핑은 관광 중 쇼핑 방문 경험이라는 `experience_scope`를 각 축과 DB에 기록해 관광지 방문 점수와 혼동하지 않는다.
- `REQ-011`: 예약, 연령·신장·인원, 운영·개최일, 기상 통제, 접근·이동 부담은 점수와 별도 hard constraint로 저장한다. 각 제약은 구체적인 `applies_to`, condition, status, action, 출처와 확인일을 가져야 한다.
- `REQ-012`: 각 수치 축은 value, confidence, inference level, 한국어 rationale, rule ID와 가능한 source claim을 가져야 한다. `uncertain`·`not_found` 장소의 prior는 confidence 0.25와 `high` 우선순위를 강제한다.
- `REQ-013`: SQLite는 Python 표준 `sqlite3` 단일 writer가 빈 파일에 원자적으로 재생성한다. foreign key, unique key와 CHECK 제약을 사용하고 `INSERT OR REPLACE`로 immutable revision을 덮어쓰지 않는다.
- `REQ-014`: canonical JSONL이 정본 교환 형식이고 SQLite는 같은 레코드의 질의용 파생 DB다. 모든 JSONL은 UTF-8, `source_order` 순서이고 manifest는 원본·웹 cache·파일럿·기후 fixture·규칙·출력 파일의 SHA-256과 논리 DB digest를 기록한다.
- `REQ-015`: 동일 입력·cache·알고리즘 버전으로 재빌드하면 canonical JSONL과 논리 DB digest가 동일해야 한다. 네트워크 재조사는 명시적 refresh 없이는 기존 성공 cache를 덮지 않는다.
- `REQ-016`: TourAPI 원본, 음식점·비음식점 분할, 파일럿 v1/v2/v3, 기후 fixture, 지도와 기존 검수 HTML은 변경하지 않는다.

## 입력과 출력

입력:

```text
data/labeling/jeju/2026-08-09/non_restaurants.json
data/labeling/jeju/2026-08-09/manifest.json
data/labeling/jeju/2026-08-09/pilots/place-profile-v2-100/
data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/
data/climate/kma/1991-2020/jeju_four_station_monthly_normals.json
```

출력:

```text
data/labeling/jeju/2026-08-09/full/place-profile-v1-all-1434/
  research/web_pages.jsonl
  place_web_research.jsonl
  auto_label_proposals.jsonl
  hard_constraints.jsonl
  review_queue.jsonl
  place_profiles.sqlite3
  manifest.json
  review_report.md
```

SQLite의 최소 테이블:

```text
dataset_meta(key PK, value)
places(contentid PK, source_order UNIQUE, contenttypeid, title, address,
       longitude, latitude, lcls1, lcls2, lcls3, raw_json, record_sha256)
web_sources(source_id PK, contentid FK, url, publisher, source_type,
            fetched_on, http_status, page_title, page_sha256, retrieval_error)
research(contentid PK/FK, research_status, identity_notes, summary,
         place_kind, experience_scope, typical_visit, environment,
         facts_json, unknowns_json, record_sha256)
label_runs(label_run_id PK, algorithm_version, input_digest, climate_hash, status)
label_proposals(label_run_id+contentid PK/FK, review_priority,
                review_reasons_json, proposal_sha256)
label_axes(label_run_id+contentid+axis_group+axis_key PK/FK, state,
           value, confidence, inference_level, rationale, null_reason,
           evidence_ids_json, rule_ids_json)
hard_constraints(constraint_id PK, label_run_id+contentid FK, kind,
                 applies_to, condition, status, action, source_url,
                 checked_at, rule_id)
```

SQLite 파일 바이트 자체가 아니라 다음 정렬 canonical dump의 SHA-256을 논리 DB digest로 사용한다.

## 설계

```text
non_restaurants.json 1,434건
        |
        +--> 기존 100건 v2/v3 regression anchor
        |
        +--> 나머지 1,334건 contentid 상세 페이지 fetch/checkpoint
                            |
                            v
                  장소 요약·사실·출처·unknown
                            |
                            v
              experience scope + archetype + flags
                            |
                            v
       고정 companion 규칙 + KMA 기반 month 규칙
                            |
                            v
           canonical JSONL + 단일 writer SQLite + manifest
```

웹 조사와 점수 계산을 분리한다. 웹 단계는 페이지에서 확인한 사실만 저장하며 점수를 만들지 않는다. 자동 라벨 단계는 고정 규칙으로 수치를 만들고 사용한 fact·rule을 축별 provenance에 연결한다. 모델의 비공개 사고과정은 저장하지 않고 짧은 사용자용 rationale과 구조화 입력·출력만 보존한다.

DB는 원본 저장소를 대체하지 않는다. JSONL과 SQLite 모두 `contentid`를 식별자로 사용하고 제목·주소·좌표 중복을 제거하지 않는다. 동일 주소·좌표 군집은 검토 힌트로만 남긴다.

## 유형별 기본 정책

- 관광지·문화시설·레포츠는 SPEC-006 archetype과 기후 규칙을 일반화한다.
- 실내 문화·실내 쇼핑·일반 숙박은 month 전월 중립 0.5 prior를 사용한다. 악천후 월에 상대적 대안이라는 이유로 0.75를 주지 않는다.
- 야외 시장·해안 상점·야외형 숙영은 실제 환경에 맞는 mixed/outdoor 기후 prior를 사용한다.
- 숙박의 companion은 객실 유형, 가족·키즈 시설, 단체 정원, 엘리베이터·무장애, 공용공간 같은 직접 facts가 있으면 보정한다. 가격과 재고는 점수에 넣지 않는다.
- 쇼핑의 companion은 시장·복합몰·개별 매장·관광 기념품점의 대표 쇼핑 경험을 구분한다. 개별 브랜드가 같은 아울렛 주소를 공유해도 ID를 합치지 않는다.
- 축제 month는 개최월을 적합도 점수로 변환하지 않고 12축 N/A를 유지한다. 최신 개최 확인은 hard date gate다.

## 예외와 폴백

- HTTP timeout, 408, 429, 5xx만 제한적으로 재시도한다. 다른 4xx는 오류 상태를 기록하고 반복하지 않는다.
- 페이지가 없거나 식별이 불확실하면 `not_found` 또는 `uncertain`으로 종료한다. 장소를 누락하지 않고 유형 기반 수치를 만들되 confidence 0.25와 `high` 검수 이유를 기록한다.
- 페이지 제목이 다르더라도 contentid·주소·본문이 같은 장소임을 확인할 수 있으면 `identity_notes`에 근거를 남기고 `matched`로 둘 수 있다.
- 변동 정보가 없거나 오래됐으면 `unknown` 또는 `stale`로 두며 높은 fit으로 상쇄하지 않는다.
- 좌표 품질은 조사·라벨 포함 조건이 아니다. `영주산(2704351)`도 유지한다.
- 중간 중단 시 이미 성공한 cache는 보존하고 미완료·재시도 가능 오류만 이어서 조회한다.

## 영향 범위

- 변경 예정 파일: `docs/spec_007.md`, `docs/README.md`, `docs/data_contracts.md`, `docs/architecture.md`, 새 전체 조사·빌드·검증 스크립트와 전체 파생 데이터
- 데이터 마이그레이션: 없음. 새 파생 SQLite를 추가한다.
- 호환성 영향: 기존 100건 UI와 sidecar 계약은 변경하지 않는다.
- 보안·개인정보 영향: 공개 장소 정보와 공개 URL만 저장한다. API 키·쿠키·개인정보와 원문 HTML은 저장하지 않는다.

## 승인 기준

- `AC-001`: 정확히 1,434개 고유 비음식점 ID가 원본 순서로 존재하고 음식점은 0건이며 유형 분포가 입력과 같다.
- `AC-002`: 1,434건 모두 terminal research status와 최소 한 번의 상세 페이지 조회 결과 또는 명시적 오류를 가진다.
- `AC-003`: `matched` 전건이 열린 HTTP(S) 상세 URL, 페이지 hash, identity 근거, 비어 있지 않은 장소 요약과 대표 경험을 가진다.
- `AC-004`: 기존 파일럿 100건의 companion·month 값, 축제 N/A, hard constraint와 proposal hash가 전체 결과에서 전수 일치한다.
- `AC-005`: companion 7,170/7,170과 비축제 month 16,872/16,872가 수치이며 축제 month 336/336만 N/A다.
- `AC-006`: 모든 24,378축이 state, confidence, inference level, rationale, rule provenance를 가지며 직접 근거로 표시된 축은 실제 source evidence에 연결된다.
- `AC-007`: 비직접 `0`·`1`이 0건이고 `uncertain`·`not_found` 전건이 confidence 0.25와 high review priority를 가진다.
- `AC-008`: 모든 hard constraint의 `applies_to`가 비어 있지 않고 source·checked_at가 있으며 orphan FK가 0이다.
- `AC-009`: SQLite foreign key check, integrity check, 테이블·축 coverage와 canonical JSONL↔DB 전수 대조가 통과한다.
- `AC-010`: 동일 cache 재실행 시 canonical JSONL과 logical DB digest가 같고 완료 cache를 불필요하게 다시 요청하지 않는다.
- `AC-011`: manifest가 모든 입력·규칙·기후·출력 hash, research status·유형·inference·priority 분포와 DB logical digest를 실제 값과 일치하게 기록한다.
- `AC-012`: 기존 TourAPI·분할·파일럿·기후·지도·검수 UI 보호 경로가 변경되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001~AC-003 | 입력·웹 cache·조사 레코드 ID/순서/상태/출처/요약 검증 | `python scripts/validate_all_place_profiles.py` |
| AC-004~AC-008 | 파일럿 회귀, 축 coverage·provenance·제약 전수 검증 | `python scripts/validate_all_place_profiles.py` |
| AC-009 | SQLite integrity/FK와 canonical export 대조 | `python scripts/validate_all_place_profiles.py` |
| AC-010 | cache 재사용 빌드 2회 후 hash 비교 | fetch dry run + build 2회 |
| AC-011 | manifest hash·통계 독립 재계산 | `python scripts/validate_all_place_profiles.py` |
| AC-012 | 보호 경로 Git diff·원본 SHA 확인 | `git status --short -- data/tourapi/jeju map-ui labeling-review data/climate data/labeling/jeju/2026-08-09/pilots` |

## 구현 결과

- `scripts/fetch_all_place_web_pages.mjs`가 비음식점 1,434건의 K-TRIP TIPS `contentid` 상세 페이지를 모두 조회했다. 현재 cache는 HTTP 200·성공 1,434건, 오류 0건이며 파일럿 seed 100건과 신규 network 1,334건을 원본 순서로 보존한다.
- `scripts/build_all_place_profiles.py`가 조사 1,434건, proposal 1,434건, review queue 1,434건, hard constraint 1,518건, canonical JSONL과 파생 SQLite를 생성한다. 기존 파일럿 100건은 값·축별 provenance·hard constraint가 전수 일치하는 회귀 앵커다.
- companion 7,170축, 비축제 month 16,872축과 축제 month N/A 336축을 합친 24,378축이 완성됐다. 추론 분포는 `direct_evidence=82`, `researched_inference=6,755`, `archetype_prior=501`, `climate_heuristic=16,704`, `not_applicable=336`이다.
- 재개 점검 중 validator가 비파일럿의 명시적 동행 근거를 모두 `researched_inference`로 기록한 빌더 오류를 발견했다. 10개 장소 14축은 overview의 고유 문구가 현재 성공 페이지에 실제 포함될 때만 `direct_evidence`, value/confidence `0.75`로 기록하도록 fail-closed 보정했고 source·rule provenance 회귀 검사를 추가했다.
- SQLite `integrity_check`와 foreign key check, canonical JSONL↔DB 전수 대조, manifest 입력·출력 해시 검증이 통과했다. 최종 논리 DB digest는 `795010641f53664d4bfbd1164c1193168aa053370e45ec9a5aebd8ef78c6e517`이다.

### 검증 결과

| 승인 기준 | 실행 명령 | 결과 |
|---|---|---|
| AC-001~AC-009, AC-011 | `python scripts/validate_all_place_profiles.py` | `valid=true`, 장소 1,434건, 전체 축 24,378건, hard constraint 1,518건, DB·manifest 검증 통과 |
| AC-010 | `node scripts/fetch_all_place_web_pages.mjs --dry-run` | `cached_success=1434`, `to_fetch=0` |
| AC-010 | `python scripts/build_all_place_profiles.py` 2회 및 SHA-256·논리 digest 비교 | 네 canonical JSONL과 논리 DB digest 동일 |
| AC-012 | `git status --short -- data/tourapi/jeju map-ui labeling-review data/climate data/labeling/jeju/2026-08-09/pilots data/labeling/jeju/2026-08-09/non_restaurants.json data/labeling/jeju/2026-08-09/restaurants.json` | 보호 경로 변경 0건 |
| 스크립트 구문 | `node --check scripts/fetch_all_place_web_pages.mjs` | 통과 |
| 스크립트 구문 | `python -m py_compile scripts/build_all_place_profiles.py scripts/validate_all_place_profiles.py` | 통과 |

## 설계와 달라진 점

없음.

## 알려진 제한

- 인증된 TourAPI 상세 API 키가 현재 환경에 없어 이번 batch의 기본 상세 출처는 K-TRIP TIPS 폴백이다. 이후 키가 제공되면 새 research run으로 공식 상세를 교차검증해야 한다.
- 전체 사람 검수 UI와 골드 라벨 승격은 후속 SPEC에서 다룬다.
- 공식 홈페이지 후보는 저장하지만 서로 다른 사이트의 구조를 전건 자동 해석하지 않는다. 식별 불일치·고위험 장소는 review queue에 남긴다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-10 | 사용자 승인 범위에 따라 1,434건 전체 조사·자동 라벨·새 SQLite 저장 계약 작성 및 구현 시작 |
| 2026-08-10 | 1,434건 수집·자동 라벨·SQLite 생성, 직접 근거 회귀 보정, 결정성·전수 validator 검증을 완료하고 Implemented로 전환 |
