# Trip AI 문서 색인

이 파일은 에이전트와 개발자가 작업 시작 시 읽는 문서 진입점이다. 현재 작업과 관련된 문서만 선택해 읽고, 새 구현은 반드시 활성 SPEC을 기준으로 진행한다.

## 문서 우선순위

1. 승인되었거나 구현 중인 활성 SPEC이 해당 변경의 목표 동작을 정의한다.
2. 활성 SPEC이 없는 현재 시스템 동작은 기준 설계 문서와 코드가 함께 정의한다.
3. 구현 완료 시 SPEC과 기준 설계 문서를 실제 코드에 맞춰 동기화한다.
4. 충돌이나 불명확성이 있으면 추측하지 말고 SPEC에 결정 또는 미결정 사항으로 기록한다.

## 현재 제품 상태

- 구현됨: 제주 TourAPI 기본 장소 수집 및 검증
- 구현됨: 최신 스냅샷을 지도용 JavaScript 데이터로 변환
- 구현됨: 장소 검색, 카테고리 필터, 지도 마커·클러스터, 장소 상세 UI
- 미구현: 사용자 프로필, 개인화 추천, 랭킹, 일정 최적화, 추천 API, 추천 평가 파이프라인

## SPEC 색인

| SPEC | 제목 | 상태 | 관련 영역 |
|---|---|---|---|
| [SPEC-001](spec_001.md) | SDD 및 여행 추천 AI 문서 체계 도입 | Implemented | repository, docs |

- 다음 예약 번호: `SPEC-002`
- 새 번호를 사용할 때 이 표와 다음 예약 번호를 먼저 갱신한다.
- 하나의 기능을 여러 SPEC으로 나눌 때 선행 SPEC과 의존 관계를 각 문서에 기록한다.

## 기준 문서

| 문서 | 언제 읽는가 | 상태 |
|---|---|---|
| [시스템 아키텍처](architecture.md) | 컴포넌트 경계, 데이터 흐름, 배포 구조 변경 | 현재 구현 + 목표 구조 |
| [데이터 계약](data_contracts.md) | 장소, 사용자 조건, 추천 결과 스키마 변경 | 현재 구현 + 초안 |
| [추천 알고리즘](recommendation_algorithm.md) | 후보 생성, 필터, 랭킹, 다양성, 일정 생성 변경 | 목표 설계, 미구현 |
| [평가 전략](evaluation.md) | 추천 품질, 회귀 테스트, 출시 기준 변경 | 목표 설계, 미구현 |
| [안전 및 개인정보](safety_privacy.md) | 위치정보, 외부 데이터, 설명 안전성 변경 | 적용 원칙 |
| [SPEC 템플릿](spec_template.md) | 새 구현 SPEC 생성 | 템플릿 |

## 빠른 문서 선택

- TourAPI 수집기: 활성 SPEC + `data_contracts.md`
- 지도 데이터 생성: 활성 SPEC + `architecture.md` + `data_contracts.md`
- 지도 UI: 활성 SPEC + `architecture.md`
- 개인화 추천과 랭킹: 활성 SPEC + `recommendation_algorithm.md` + `data_contracts.md` + `evaluation.md`
- 일정 최적화: 활성 SPEC + `recommendation_algorithm.md` + `evaluation.md`
- 위치정보 또는 사용자 프로필: 위 문서에 더해 `safety_privacy.md`

## 상태 정의

- `Draft`: 요구사항이나 결정이 확정되지 않았다.
- `Approved`: 구현할 범위와 승인 기준이 정해졌다.
- `In Progress`: SPEC에 따른 구현이 진행 중이다.
- `Implemented`: 구현, 검증, 문서 동기화가 끝났다.
- `Superseded`: 더 새로운 SPEC으로 대체되었으며 대체 문서를 링크해야 한다.
