# SPEC-049: outdoor_nature calibration batch 12 Companion boundary review

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [SPEC-022](spec_022.md), [SPEC-042](spec_042.md)
- 관련 데이터: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/13_outdoor_nature.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`
- 선행 SPEC: SPEC-042

## 배경

`outdoor_nature` batch 12의 50개 장소를 소개 원문, 미확인 사항, 근거 ID만으로 직접 판정하고, 같은 작업에서 점수 경계를 재검토한 별도 sidecar가 필요하다.

## 목표와 비목표

- 입력의 모든 장소를 순서와 식별 필드 그대로 reviewed JSONL에 기록하고 5축을 완전한 numeric AxisLabel로 생성한다.
- 정책과 앵커를 경계 참고·경보로 사용하되 quota로 강제하지 않는다.
- 입력, canonical 라벨, 기존 산출물과 앵커는 수정하지 않는다. 소개에 없는 사회성·접근성·안전성도 추정하지 않는다.

## 요구사항

- `REQ-4901`: 모든 입력 행의 `contentid`, `title`, `source_order`, `calibration_family`를 보존한다.
- `REQ-4902`: 각 축은 `state`, `value`, `confidence`, `status`, `inference_level`, `rationale`, `evidence_ids`, `rule_ids`, `null_reason`을 가진 numeric 객체다.
- `REQ-4903`: `source_excerpt`, `unknowns`, `evidence_ids`를 직접 읽어 1차 판정하고, 일반 경관·관람·쇼핑에 근거한 solo/couple/friends 고점은 0.5로 재검토한다.
- `REQ-4904`: kids/parents는 직접 연령·안전·활동·보행·가족 근거로만 경계를 조정하며 0은 방문 금지가 아닌 상대 최저점이다.
- `REQ-4905`: rationale은 원문 사실 또는 unknown을 포함하고 모든 축 `rule_ids`에 `CALIBRATED-BOUNDARY-REVIEW-V2`를 포함한다.
- `REQ-4906`: `cafe_unknown_intro`가 있으면 전축 0.5, confidence 0.3 이하, unknown으로 유지한다.
- `REQ-4907`: `calibration_outputs/reviewed/reviewed_calibrated_batch_12.jsonl`만 새로 생성한다.

## 입력과 출력

- 입력: `calibration_inputs/13_outdoor_nature.jsonl` 전체 50행.
- 출력: `calibration_outputs/reviewed/reviewed_calibrated_batch_12.jsonl` UTF-8 JSONL 50행, 행마다 5개 companion 축.

## 설계

각 장소의 근거를 바탕으로 1차 값을 정한 뒤 0.25/0.5/0.75/1 경계와 가족 축을 재독한다. 직접 대상·연령·활동·안전·보행 사실만 고점 또는 저점을 지지하며, 미확인은 0.5의 근거로 rationale에 남긴다.

## 예외와 폴백

동행 특화 근거가 없으면 방문 불가를 뜻하지 않는 상대 보통값 0.5를 사용한다. `cafe_unknown_intro`는 정책 예외를 따른다.

## 영향 범위

- 변경 파일: 본 SPEC, `docs/README.md`, `scripts/archive/review_calibrated_batch_12.py`, reviewed JSONL.
- 데이터 마이그레이션·호환성·보안·개인정보 영향: 없음.

## 승인 기준

- `AC-4901`: 출력 50행의 순서·식별자·family가 입력과 정확히 일치한다.
- `AC-4902`: 250축이 허용 5단계 값과 완전한 필드·provenance를 가진다.
- `AC-4903`: rationale이 원문 사실 또는 unknown을 포함하고 고점·가족 경계가 원문 근거를 가진다.
- `AC-4904`: 기존 파일은 변경하지 않는다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-4901~AC-4903 | JSONL 파싱, 순서·스키마·값·provenance 전수 검사 | `python scripts/archive/review_calibrated_batch_12.py --check` |
| AC-4904 | 생성 전후 변경 파일 확인 | `git diff --check`, `git status --short` |

## 구현 결과

- `calibration_outputs/reviewed/reviewed_calibrated_batch_12.jsonl`에 입력 순서 그대로 50행·250축을 생성했다.
- `scripts/archive/review_calibrated_batch_12.py`는 직접 판정값과 1차→경계 재검토 비교를 재현하고, `--check`에서 입력·출력 식별자 순서, 완전한 5축, 허용값, 상태, evidence ID, review rule ID를 전수 검증한다.
- 검증 통과: `python -m py_compile scripts/archive/review_calibrated_batch_12.py`, 생성, `--check`, `git diff --check`.
- 최종 분포: solo `{0.5: 47, 0.75: 3}`, couple `{0.5: 44, 0.75: 6}`, friends `{0.5: 42, 0.75: 8}`, kids `{0: 1, 0.25: 3, 0.5: 33, 0.75: 9, 1: 4}`, parents `{0.25: 4, 0.5: 41, 0.75: 5}`. 1차→경계 재검토 변경은 3축이다.

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며, 소개 원문에 없는 사회적 선호, 접근성, 연령·안전 조건은 추정하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | batch 12 직접 판정 및 경계 재검토 범위 작성 |
| 2026-08-12 | 50행 reviewed sidecar 생성 및 전수 검증 |
