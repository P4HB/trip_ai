# SPEC-022: Kakao 신규 후보 2,374건 41축 에이전트 라벨링 v1

- 상태: In Progress
- 작성일: 2026-08-24
- 최종 수정일: 2026-08-28
- 관련 이슈: 사용자 요청
- 관련 문서: `docs/data_contracts.md`, `docs/spec_007.md`, `docs/spec_009.md`, `docs/spec_014.md`, `docs/spec_020.md`, `docs/spec_021.md`
- 관련 코드: `config/kakao_place_label_contract.v1.json`, `scripts/build_kakao_labeling_match_inputs.py`, `scripts/build_kakao_labeling_queue.py`, `scripts/build_kakao_agent_inputs.py`, `scripts/validate_kakao_place_labels.py`
- 선행 SPEC: SPEC-020, SPEC-021

## 배경

SPEC-020과 SPEC-021 산출물의 Kakao 고유 `place_id` 합집합은 3,665개다. 현행 추천 번들은 좌표와 41축이 완전한 기존 장소 1,663개를 사용한다. 최초 범위는 두 건수의 단순 차이인 2,002개로 가정했지만, 공급자 간 N:1 관계와 기존 Kakao 미수록 장소가 있어 실제 ID 차집합이 아니었다. 전수 교차 매칭과 FD05 보강 결과 기존 추천 장소와 대응하는 Kakao ID는 1,291개, 신규·별도 후보는 2,374개로 확인됐고 사용자가 2026-08-24 이 2,374개 전수 라벨링을 승인했다. 장소 한 곳마다 `gpt-5.6-terra` reasoning effort `medium` 서브에이전트 한 개를 배정한다.

두 공급자의 식별자가 다르고 한 Kakao 장소가 여러 TourAPI 레코드와 대응할 수 있으므로 단순 건수 차이를 장소 집합 차이로 간주하지 않는다. 에이전트 실행 전 승인된 교차 식별자와 FD05 보강 판정으로 신규 `place_id` 큐 2,374개를 재현한다.

## 목표

- 기존 추천 가능 1,663개와 겹치지 않는 Kakao 장소 작업 큐 2,374개를 고정한다.
- 신규 장소 한 곳마다 독립 Terra Medium 에이전트가 근거와 41축 라벨 제안을 생성한다.
- 기존 Theme·Environment·Style 24축과 Companion·Month 17축의 키, 척도, 추론 우선순위와 파생 공식을 재사용한다.
- 장소별 결과를 체크포인트로 저장하고 자동 검증 실패 건만 재실행할 수 있게 한다.
- 기존 라벨과 원본 Kakao 수집 파일을 변경하지 않는 새 버전 sidecar를 만든다.

## 비목표

- 기존 1,663개 라벨 재판정
- Kakao 평점이나 리뷰 수를 추천 적합도 점수로 직접 변환
- 영업시간·가격·휴무처럼 변하는 정보를 확인 시각 없이 확정
- 라벨링과 동시에 추천 알고리즘 또는 지도 운영 번들에 반영
- 부속 시설·중복·장소 식별 불가 레코드에 억지로 완전 숫자 벡터 부여

## 요구사항

- `REQ-001`: 입력 Kakao 합집합은 SPEC-020의 2,768개와 SPEC-021의 897개 고유 `place_id`이며 두 집합의 교집합은 0이어야 한다.
- `REQ-002`: 기존 추천 가능 장소와의 교차 매칭은 공급자 ID, 이름, 주소, 좌표와 승인된 SPEC-021 판정을 사용하고 N:1 및 1:N 관계를 보존한다.
- `REQ-003`: 라벨링 큐는 고유 `canonical_id=kakao:<place_id>`를 사용하고 `provider=kakao`, 원본 `place_id`, 이름, URL, 수집 시각과 입력 근거 경로를 가진다.
- `REQ-004`: 큐 생성기는 신규 후보가 정확히 2,374개인지 검증한다. 다르면 에이전트를 실행하지 않고 차이 보고서를 생성한다.
- `REQ-005`: 각 작업은 장소 한 곳만 포함하고 `gpt-5.6-terra`, reasoning effort `medium` 에이전트가 독립 처리한다. 동시에 실행하는 작업은 사용 가능한 슬롯을 넘지 않는다.
- `REQ-006`: 선호 라벨은 Theme 8, Environment 2, Style evidence 8, Derived style 6의 24축을 사용한다. 원자 18축을 먼저 판정하고 Derived 6축은 결정적 공식으로 다시 계산한다.
- `REQ-007`: 상황 라벨은 `solo`, `couple`, `friends`, `kids`, `parents` 5축과 1~12월 12축을 사용한다.
- `REQ-008`: 수치값은 `0`, `0.25`, `0.5`, `0.75`, `1`만 사용한다. `not_applicable`은 `value=null`로 저장한다.
- `REQ-009`: 추론 우선순위는 `direct_evidence > researched_inference > archetype_prior > climate_heuristic`이며 비직접 `0`·`1`은 금지한다. 불확실 fallback은 `confidence=0.25`와 검수 사유를 가진다.
- `REQ-010`: Kakao 공개 리뷰는 방문 경험의 보조 근거로만 사용한다. 평점·리뷰 수·작성자 인기도는 라벨값의 직접 근거가 아니다.
- `REQ-011`: 각 원자·상황 축은 값, confidence, 상태, inference level, 한국어 rationale, rule ID와 source ID를 가진다.
- `REQ-012`: 각 장소는 `eligible`, `duplicate`, `subordinate_facility`, `out_of_scope`, `identity_unknown` 중 하나의 적격 상태를 가진다. `eligible`만 추천용 완전 벡터 후보가 된다.
- `REQ-013`: 장소별 결과는 원자적으로 저장하고 완료된 `canonical_id`는 재실행 시 건너뛴다. 스키마·공식 검증 실패 결과는 승인 데이터에 병합하지 않는다.
- `REQ-014`: 기존 1,663개 라벨과 SPEC-020·021 원본 산출물은 읽기 전용으로 유지한다.

## 입력과 출력

입력:

- `data/kakao/jeju/2026-08-19/places.csv`
- `data/kakao/jeju/2026-08-19/place_review_summary.csv`
- `data/kakao/jeju/2026-08-19/reviews.csv`
- `data/kakao/jeju/2026-08-20/db-place-backfill/final_review_queue.csv`
- `data/kakao/jeju/2026-08-20/db-place-backfill/place_review_summary.csv`
- `data/kakao/jeju/2026-08-20/db-place-backfill/reviews.csv`
- SPEC-021 crosswalk와 최종 사람 판정 sidecar
- 기존 1,663개 추천 가능 장소 번들 및 v5 라벨

출력 기준 위치:

`data/labeling/jeju/2026-08-24/kakao-place-label-v1/`

- `candidate_crosswalk.csv`: 기존 장소와 Kakao 장소의 중복 판정
- `labeling_queue.jsonl`: 검증된 신규 장소 작업 큐
- `queue_manifest.json`: 입력 해시, 집합 건수, 규칙 버전
- `agent-inputs/<place_id>.json`: 장소별 고정 입력 패킷
- `agent-results/<place_id>.json`: 에이전트 원본 결과
- `validated/<place_id>.json`: 자동 검증 및 파생 공식 재계산 결과
- `review_queue.jsonl`: 충돌·저신뢰·fallback·적격성 검수 대상
- `coverage_report.json`: 상태·출처·축·신뢰도 coverage
- `manifest.json`: 최종 데이터 버전과 파일 해시

좌표는 WGS84 `longitude`, `latitude` 순서다. 시간은 `Asia/Seoul` ISO 8601로 기록한다. 리뷰 작성자 표시 이름은 에이전트 입력 및 라벨 결과에서 제외한다.

## 설계

1. 두 Kakao 인벤토리를 `place_id`로 합친다.
2. 기존 추천 장소 및 승인된 SPEC-021 판정과 대조해 신규 후보 큐를 고정한다.
   기존 crosswalk 입력에서 빠진 FD05 카페·찻집은 현행 추천 번들에서 별도 매칭 입력 DB를 생성해 같은 SPEC-021 규칙으로 교차 매칭한다.
3. 장소별 Kakao 메타데이터와 작성자 정보가 제거된 리뷰 근거 패킷을 만든다.
4. 가용 동시성만큼 Terra Medium 에이전트를 생성하며 에이전트 하나가 장소 하나만 처리한다.
5. 에이전트는 적격 상태, 18개 원자 선호축, Companion 5축, Month 12축, 출처와 근거를 JSON으로 반환한다.
6. 메인 프로세스가 Derived 6축을 재계산하고 스키마·척도·근거·극단값 규칙을 검증한다.
7. 통과 결과를 장소별 체크포인트에 저장하고 실패 결과는 원인과 함께 재실행 큐로 보낸다.
8. 검수 완료 전에는 기존 추천 번들과 결합하지 않는다.

## 예외와 폴백

- 실제 신규 큐가 2,374개가 아니면 라벨링을 중단하고 `candidate_count_mismatch`를 기록한다.
- 공식·공공 출처를 찾지 못하면 Kakao 메타데이터와 리뷰를 보조 근거로 사용할 수 있으나 직접 조사로 과장하지 않는다.
- 장소 식별이 불명확하면 `identity_unknown`으로 반환하고 유형 prior를 추천용 확정값으로 사용하지 않는다.
- 부속 시설과 중복 장소는 별도 상태로 보존하고 추천 벡터에 병합하지 않는다.
- 에이전트 출력이 JSON 스키마를 위반하거나 파생 공식이 맞지 않으면 해당 장소만 재실행한다.
- 외부 검색 실패는 원본 Kakao 근거만 보존하고 `needs_review`로 남긴다.

## 영향 범위

- 변경 예정 파일: `docs/README.md`, `docs/spec_022.md`, `docs/data_contracts.md`, 신규 큐·검증 스크립트와 버전 산출물
- 데이터 마이그레이션: 없음. 새 sidecar만 생성
- 호환성 영향: 기존 1,663개 추천 번들에는 검수 완료 전 영향 없음
- 보안·개인정보 영향: 공개 리뷰 작성자 표시 이름을 라벨링 입력과 결과에서 제거하고 공개 장소 정보만 처리

## 승인 기준

- `AC-001`: Kakao 입력 합집합이 3,665개이고 입력 두 집합의 교집합이 0이다.
- `AC-002`: 기존 추천 장소와 중복 제거 후 큐가 2,374개 고유 `canonical_id`를 가진다.
- `AC-003`: 모든 에이전트 작업이 정확히 한 장소만 포함하고 모델·reasoning 설정을 기록한다.
- `AC-004`: `eligible` 결과는 24개 선호축과 17개 상황축을 모두 가지며 허용 척도와 상태 계약을 만족한다.
- `AC-005`: Derived 6축의 에이전트 출력과 결정적 재계산 차이가 0건이다.
- `AC-006`: 비직접 `0`·`1`, 출처 없는 직접 근거, 중복 장소 병합이 각각 0건이다.
- `AC-007`: 기존 1,663개 라벨과 기존 Kakao 원본 파일의 해시는 변경되지 않는다.
- `AC-008`: 동일 입력과 규칙 버전으로 큐와 검증 결과를 재생성하면 동일한 파일 해시가 나온다.
- `AC-009`: 검수 완료 전 신규 결과가 추천·지도 운영 번들에 포함되지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-001~002 | 입력·교집합·차집합·중복 전수 검사 | `python scripts/build_kakao_labeling_queue.py` |
| AC-003~006 | 장소별 JSON 스키마·값·근거·파생 공식 검사 | `python scripts/validate_kakao_place_labels.py` |
| AC-007 | 입력·기존 라벨 SHA-256 회귀 검사 | `queue_manifest.json`, `manifest.json` |
| AC-008 | 두 번 생성 후 해시 비교 | 큐·validator 재실행 |
| AC-009 | 기존 지도 번들 diff 확인 | `git diff -- map-ui/data.js` |

## 구현 결과

- Kakao 입력 합집합 3,665개와 기존 추천 가능 TourAPI 장소 1,663개를 공급자 ID 단순 뺄셈으로 비교할 수 없음을 전수 감사로 확인했다.
- 기존 SPEC-021의 승인된 관계를 추천 가능 장소로 제한하면 기존과 겹치는 Kakao ID는 1,287개다.
- SPEC-021 입력에서 빠졌던 FD05 카페·찻집 230개를 동일 매칭 규칙으로 검색했다. 결과는 `matched_existing=4`, `matched_new=189`, `ambiguous=32`, `not_found=5`다.
- FD05 애매 32개를 장소당 Terra Medium 에이전트 한 명으로 판정했다. 결과는 `same_place=24`, `different_place=6`, `unresolved=2`이며 `same_place` 24개 ID는 모두 현행 3,665개 인벤토리 밖이다.
- 따라서 현재 증거로 기존과 겹치는 Kakao ID는 1,291개이고 신규 후보는 2,374개다. 사용자가 2026-08-24 이 증거 기반 2,374개 전수 라벨링을 승인했다.
- `scripts/build_kakao_labeling_match_inputs.py`와 `scripts/build_kakao_labeling_queue.py`가 입력·관계·차집합을 재현하고 mismatch 보고서를 생성한다.
- 2026-08-28 기준 큐 2,374건 전부에 원본 결과와 검증 결과를 생성했고 전체 자동 계약 검증 `checked=2374`, `passed=2374`, `failed=0`을 확인했다. 큐·원본 결과의 누락과 고아 파일은 각각 0건이며 모델·reasoning 기록 불일치도 각각 0건이다.
- 최종 적격 상태 분포는 `eligible=931`, `identity_unknown=821`, `subordinate_facility=400`, `out_of_scope=202`, `duplicate=20`이다.
- 최종 검수 우선순위 분포는 `high=1895`, `medium=378`, `low=101`이다. 자동 검증 통과는 사람 검수 완료를 뜻하지 않으며 신규 결과는 아직 추천·지도 운영 번들에 포함하지 않았다.

## 설계와 달라진 점

- 전역 에이전트 완료 이력이 실행 슬롯을 계속 점유해 장소마다 신규 에이전트를 생성하는 방식으로 전수 실행을 마칠 수 없었다. 후반부는 동일한 `gpt-5.6-terra` medium 작업자 엔트리를 장소별 독립 턴으로 재호출했고, 마지막 구간은 한 작업자가 최대 5개 장소를 순차 처리하는 마이크로배치를 사용했다. 각 장소의 입력·원본 결과·단건 validator는 분리했지만 `REQ-005`와 `AC-003`의 “장소마다 독립 에이전트 한 개”는 엄밀히 충족하지 않으므로 상태를 `In Progress`로 유지한다.
- 장시간 조사 정체를 피하기 위해 후반부 장소는 공개 근거를 짧게 확인하고, 충분한 동일 장소 근거가 없으면 계약에 정의된 `identity_unknown` 또는 저신뢰 `needs_review` 폴백을 적용했다. 이 때문에 사람 검수 우선순위 `high`가 1,895건으로 많다.

## 알려진 제한

- Kakao 전체 인벤토리와 TourAPI 추천 장소는 공급자별 장소 분할 기준이 달라 단순 건수 차이가 정확한 신규 장소 수를 보장하지 않는다.
- `gpt-5.6-terra` 장소별 결과는 AI 초안이며 자동 검증 통과가 사람 검수 완료를 의미하지 않는다.
- 2,374개 전수 실행은 동시성 제한에 따라 여러 wave로 진행한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-24 | 사용자 승인 범위로 초안 작성 및 구현 시작 |
| 2026-08-24 | 공급자 교차 매칭 결과를 반영해 사용자가 신규 후보 2,374개 전수 라벨링을 승인 |
| 2026-08-24 | 장소별 Terra Medium 300건 실행 및 자동 계약 검증 300/300 통과 체크포인트 기록 |
| 2026-08-24 | 다음 300건을 추가 실행해 누적 600건 생성, 자동 계약 검증 600/600 통과 및 무누락·무고아 체크포인트 기록 |
| 2026-08-25 | 장소별 실행을 이어 누적 1,412건까지 생성하고 실패 결과를 동일 장소 보완으로 복구 |
| 2026-08-28 | 잔여 전수 실행 완료: 원본·검증 각 2,374건, 전체 validator 2,374/2,374 통과, 누락·고아·모델 설정 불일치 0건 확인 |
| 2026-08-28 | 전역 스레드 한도에 따른 작업자 재호출·마이크로배치 실행 차이를 기록하고 SPEC 상태를 In Progress로 유지 |
