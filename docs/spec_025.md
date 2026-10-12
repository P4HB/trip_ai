# SPEC-025: Companion 품질 감사 배치 001a

- 상태: Implemented
- 작성일: 2026-08-12
- 최종 수정일: 2026-08-12
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [SPEC-022](spec_022.md)
- 관련 코드: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_001a.jsonl`
- 선행 SPEC: [SPEC-022](spec_022.md)

## 배경

장소 소개 원문과 미확인 사항을 기준으로 Companion 다섯 축을 소규모 품질 감사한다.

## 목표

- audit input의 0-based 0–24, 25개 장소에 125개 Companion 축을 독립 판정한다.
- 기존 JSONL과 Month 및 기존 batch를 변경하지 않고 별도 quality batch를 만든다.

## 비목표

- Month 라벨, 기존 canonical JSONL 또는 기존 batch 수정
- 원문에 없는 접근성·연령 조건의 추정

## 요구사항

- `REQ-2501`: 각 입력의 `source_excerpt`와 `unknowns`를 읽고 `solo/couple/friends/kids/parents`를 모두 기록한다.
- `REQ-2502`: 값은 0/0.25/0.5/0.75/1이며, 모든 축은 numeric·`ai_draft`·`QUALITY-DIRECT-INTRO-COMPANION-V1`을 가진다.
- `REQ-2503`: 근거 부족 축은 0.5와 낮은 confidence를 사용하며, 접근성·연령을 창작하지 않는다.

## 입력과 출력

입력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/companion_audit_01.jsonl`의 줄 0–24.

출력: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/quality_batches/quality_companion_001a.jsonl`. 각 레코드는 contentid, title, source_order 및 5개 AxisLabel을 가진다.

## 설계

소개에 명시된 대표 활동·환경·시설을 축별로 읽는다. `unknowns`가 보행·연령·접근성을 미확인으로 하면 해당 사실을 적합 근거로 사용하지 않는다.

## 예외와 폴백

직접 동행 근거가 부족하면 중립 0.5와 낮은 confidence를 사용한다.

## 영향 범위

- 변경 파일: 본 SPEC, 품질 감사 JSONL
- 데이터 마이그레이션: 없음
- 호환성 영향: 없음
- 보안·개인정보 영향: 공개 장소 소개만 처리

## 승인 기준

- `AC-2501`: 정확히 25개 레코드와 125개 numeric 축이 있다.
- `AC-2502`: 다섯 축, 전체 AxisLabel 필드, status/rule ID와 허용값을 전수 확인한다.
- `AC-2503`: 기존 JSONL·Month·기존 batch의 변경이 없다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-2501~AC-2502 | JSONL 파싱·축·값·provenance 확인 | PowerShell 검사 |
| AC-2503 | git diff 확인 | `git status --short` |

## 구현 결과

25개 레코드와 125개 AI 초안 축을 생성했다. source_excerpt와 unknowns를 각 장소별로 읽어 근거 부족 축은 낮은 confidence의 0.5로 유지했다.

## 설계와 달라진 점

없음.

## 알려진 제한

AI 초안이며 사람 검수 전 운영 추천 입력으로 사용하지 않는다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-12 | 품질 감사 배치 001a 생성 |

