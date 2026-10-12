# SPEC-044: shopping_market batch 05 Companion 경계 재검토

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [SPEC-022](spec_022.md), [SPEC-035](spec_035.md), [SPEC-040](spec_040.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/28_shopping_market.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/batches/calibrated_batch_05.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/reviewed/reviewed_calibrated_batch_05.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md), [SPEC-035](spec_035.md), [SPEC-040](spec_040.md)

## 배경

기존 batch 05 초안의 0.5, 0.75, 1 경계값을 동일 유형 정책과 앵커에 맞춰 `source_excerpt` 근거로 재검토한다. 기존 초안은 보존하고 별도 reviewed 산출물을 만든다.

## 목표

- 입력 50개 장소와 250개 Companion 축을 원래 순서·완전 객체로 별도 출력한다.
- 일반 쇼핑의 근거 없는 solo/couple/friends 상향을 방지하고, kids/parents의 직접 대상 근거와 과대 점수를 재판정한다.

## 비목표

- 기존 batch 초안·입력·표준 라벨 수정
- 정책 목표 범위를 quota로 강제하거나 소개에 없는 동행 선호를 추정

## 요구사항

- `REQ-4401`: 입력의 모든 행에서 `contentid`, `title`, `source_order`, `calibration_family`, 5축 완전 객체를 보존한다.
- `REQ-4402`: 0.5/0.75/1 경계를 `source_excerpt` 실제 사실로 재검토하며, 일반 쇼핑의 solo/couple/friends는 실제 동행 활동 근거가 없으면 0.5를 유지한다.
- `REQ-4403`: kids/parents의 직접 대상·안전·체험 근거가 있는 0.5는 0.75/1로, 직접 근거 없는 과대 점수는 0.5로 조정한다.
- `REQ-4404`: 모든 축 rationale은 실제 원문 사실 또는 unknown을 포함하고 `CALIBRATED-BOUNDARY-REVIEW-V2` rule ID를 포함한다.

## 입력과 출력

- 입력: `calibration_inputs/28_shopping_market.jsonl`, 기존 초안 및 `companion_calibration_policy.md`, `companion_calibration_guide.json`
- 출력: `calibration_outputs/reviewed/reviewed_calibrated_batch_05.jsonl` (JSONL, 50행, 행마다 Companion 5축)

## 설계

같은 family의 앵커는 경계 판단 참고로만 사용한다. 0은 방문 금지가 아닌 상대 최저 적합도이며, 정책 분포는 품질 경보이지 목표 quota가 아니다. 각 축은 소개의 명시 대상·실제 활동·안전·편의만 반영하고, 불확실한 접근성·연령 마찰은 unknown으로 남긴다.

## 예외와 폴백

동행별 직접 근거가 없는 일반 매장은 0.5·`unknown` 추론 수준·낮은 confidence를 유지한다. `cafe_unknown_intro` 예외는 이 shopping_market 입력에 없다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, reviewed JSONL 산출물
- 데이터 마이그레이션·호환성·보안·개인정보 영향: 없음

## 승인 기준

- `AC-4401`: 출력 50행의 ID·제목·순서·family가 입력과 일치하고, 250축이 완전하다.
- `AC-4402`: 모든 값·상태·provenance·rationale이 유효하며 모든 축에 review rule ID가 있다.
- `AC-4403`: 원문 근거가 없는 solo/couple/friends 0.75 이상이 없고, kids/parents 변경은 원문 근거와 일치한다.
- `AC-4404`: JSONL 파싱과 whitespace 검증이 통과한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-4401~AC-4403 | 입력·출력 전수 대조 및 AxisLabel/provenance/분포 검사 | 인라인 Node 검증 |
| AC-4404 | JSONL 파싱 및 diff whitespace 검사 | `git diff --check` |

## 구현 결과

- `calibration_outputs/reviewed/reviewed_calibrated_batch_05.jsonl`에 입력 순서 그대로 50개 장소·250축을 생성했다.
- 기존 초안은 수정하지 않았다. 11축을 변경했으며, 일반 쇼핑의 solo·couple·friends 150축은 실제 동행 활동 근거가 없어 모두 0.5로 유지했다.
- 과대 판정된 약국·건강상품·일반 제화의 parents 4축은 0.75에서 0.5로 낮췄다. kids 상품·연령 포괄 의류·부모 명시 아동복 근거 7축은 0.5에서 0.75 또는 1로 올렸다.
- 최종 분포: solo `{0.5: 50}`, couple `{0.5: 50}`, friends `{0.5: 50}`, kids `{0.25: 7, 0.5: 35, 0.75: 4, 1: 4}`, parents `{0.5: 45, 0.75: 3, 1: 2}`.
- 인라인 Node 전수 검증으로 행·식별자·5축 구조·허용값·상태·evidence/rule provenance·rationale·사회 동행 고점 부재를 확인했고, `git diff --check`를 통과했다.

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며 사람 검수 전 골드 라벨 또는 운영 추천 근거로 사용하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 경계 재검토 SPEC 작성 |
| 2026-08-12 | reviewed sidecar 생성 및 전수 검증 완료 |
