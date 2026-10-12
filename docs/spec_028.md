# SPEC-028: Companion 엄격 기준 품질 재판정 001d

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [데이터 계약](data_contracts.md)
- 선행 SPEC: [SPEC-026](spec_026.md)

## 배경

SPEC-026의 같은 25개 품질 표본을 일반 경관·관람·산책에 동행별 장점을 자동 부여하지 않는 엄격 기준으로 다시 독립 판정한다.

## 목표

- audit 입력의 0-based 75–99행만 `quality_companion_strict_001d.jsonl`에 새 JSONL로 기록한다.
- 모든 5축에 원문 직접 근거 또는 unknowns를 근거로 한 보수적 판단을 남긴다.

## 비목표

- 기존 001d 결과, canonical 라벨, audit 입력 수정
- 소개와 unknowns 밖 사실·접근성·연령 조건 추정

## 요구사항

- `REQ-2801`: 입력 25행의 contentid·제목·source_order를 순서대로 보존한다.
- `REQ-2802`: `solo`, `couple`, `friends`의 일반 관람·경관·산책 기본값은 0.5이며, 0.75 이상은 동행별 명시 근거가 있어야 한다.
- `REQ-2803`: 각 축은 AxisLabel 전체 구조, `ai_draft`, numeric, `null_reason=null`, `STRICT-QUALITY-DIRECT-COMPANION-V2` rule ID를 가진다.
- `REQ-2804`: 정보 부족은 0.5 및 0.40–0.55 confidence로 하고 rationale에 unknown을 명시한다.

## 입력과 출력

- 입력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/companion_audit_01.jsonl`의 0-based 75–99행.
- 출력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_strict_001d.jsonl`; 행마다 `contentid`, `title`, `source_order`, `companion_fit`을 둔다.

## 설계

`source_excerpt`와 `unknowns`만 읽었다. 0.75는 solo의 독립 활동, couple의 데이트·로맨틱·2인 근거, friends의 단체·함께 하는 활동·시장·공연·게임·스포츠, kids의 아동·가족 시설 또는 교육·놀이, parents의 고령 동행 편의가 직접 있을 때만 사용했다. 1은 직접 대상이거나 독립 강근거가 둘 이상일 때만 사용했다.

## 영향 범위

- 변경 파일: 이 SPEC, `docs/README.md`, 새 strict 품질 JSONL
- 데이터 마이그레이션·호환성·보안 영향: 없음

## 승인 기준

- `AC-2801`: 25행의 source_order/contentid가 입력 slice와 순서까지 일치한다.
- `AC-2802`: 125축이 완전 스키마·허용 값·상태·rule ID를 만족한다.
- `AC-2803`: 기존 파일과 입력은 변경하지 않으며, 5점 분포를 기록한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-2801, AC-2802 | JSONL 파싱·slice·스키마 검사 | PowerShell 검사 명령 |
| AC-2803 | git diff와 축별 분포 확인 | PowerShell 검사 명령 |

## 구현 결과

`quality_batches/quality_companion_strict_001d.jsonl`에 source order 75–99의 25행과 Companion 125축을 생성했다. 기존 001d 파일과 audit 입력은 수정하지 않았다.

검증 결과: JSONL 파싱, 입력 slice의 순서·contentid·title 일치, 5축 완전성, AxisLabel 필수 키, numeric 상태, 허용값, `ai_draft`, `null_reason=null`, evidence ID 및 `STRICT-QUALITY-DIRECT-COMPANION-V2` rule ID를 모두 통과했다.

5점 분포: solo `{0.5: 24, 0.75: 1}`, couple `{0.5: 22, 0.75: 2, 1: 1}`, friends `{0.5: 21, 0.75: 4}`, kids `{0: 1, 0.5: 18, 0.75: 4, 1: 2}`, parents `{0.5: 22, 0.75: 3}`.

## 설계와 달라진 점

없음.

## 알려진 제한

원문의 잘린 소개와 unknowns가 남긴 정보 공백은 추정하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 엄격 기준 재판정 및 검증 완료 |
