# SPEC-023: Companion 재판정 batch 04

- 상태: Implemented
- 작성일: 2026-08-12
- 관련 SPEC: [SPEC-022](spec_022.md)
- 관련 기준 문서: [데이터 계약](data_contracts.md)

## 배경과 목표

SPEC-022의 1,664곳 중 병합 입력 순서 556–833(0-based), 총 278곳의 Companion 5축만 장소 소개와 조사 facts를 다시 읽어 재판정한다. 기존 표준 JSONL, Month 축, 원본 입력은 수정하지 않고 독립 batch로 저장한다.

## 비목표

- Month 축 재판정
- 기존 `place_fit_labels.jsonl` 또는 표준 JSONL 승격
- 음식점 FD05 이외 장소 포함

## 요구사항

- `REQ-2301`: 입력 순서는 비음식점 1,434곳 뒤 FD05 230곳이며 대상은 556–833이다.
- `REQ-2302`: 각 대상은 `solo`, `couple`, `friends`, `kids`, `parents`를 독립 판정한다.
- `REQ-2303`: 값은 0/0.25/0.5/0.75/1이며 `0.75`와 `1`은 소개의 명시적 근거가 있을 때만 사용한다.
- `REQ-2304`: 출력 축은 current JSONL의 전체 AxisLabel 스키마를 가지며 `status=ai_draft`, rule ID `DIRECT-COMPANION-5LEVEL-RECALIBRATED`를 포함한다.
- `REQ-2305`: 출력은 `batches/companion_recal_04.jsonl`에만 기록한다.

## 판정 규칙

0은 대표 경험이 최저 수준, 0.25는 뚜렷한 불편·미스매치, 0.5는 무난하지만 뚜렷한 장점이나 근거가 약함, 0.75는 소개에 해당 동행의 활동·시설·환경이 명확함, 1은 대표 타깃 명시 또는 강한 직접 근거 둘 이상으로 정의한다. 축별 근거가 약하면 0.5를 기계적으로 반복하지 않고 장소 경험과 마찰을 반영한다.

## 승인 기준과 검증

- `AC-2301`: 276개 ID가 정확히 대상 slice와 일치하고 중복·누락이 없다.
- `AC-2302`: 1,380개 축이 모두 스키마와 허용값을 만족한다.
- `AC-2303`: 5축별 분포를 집계해 보고한다.
- `AC-2304`: 기존 표준 JSONL, Month 및 입력 파일의 git 변경이 없다.

검증 명령: `python -m py_compile scripts/validate_place_fit_relabel_v2.py`, 대상 slice·JSONL 스키마·분포를 별도 검사한다.

## 상태

구현 완료. `batches/companion_recal_03.jsonl`에 278개를 생성했다. SHA-256은 `3e2bb31216f27611cf0b39686beff200492f4cd2255332828f52b8d3d00638f9`이다. 축별 값 분포는 solo `{0.25:2, 0.5:27, 0.75:199, 1:50}`, couple `{0.25:16, 0.5:28, 0.75:180, 1:54}`, friends `{0.25:10, 0.5:56, 0.75:148, 1:64}`, kids `{0.25:37, 0.5:141, 0.75:55, 1:45}`, parents `{0.25:8, 0.5:188, 0.75:56, 1:26}`이다. 대상 slice·중복·스키마·status/rule 검증과 py_compile을 통과했으며 보호 입력의 git 변경은 없다. 장소 소개가 구조화되지 않은 FD05 카페는 `restaurants.json` 제목·분류 근거에 한정해 보수적으로 판정했다.
