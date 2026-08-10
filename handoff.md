# Trip AI 추천 설계 핸드오프

- 상태: Superseded
- 최종 수정일: 2026-08-10
- 대체 문서: [SPEC-008](docs/spec_008.md)

이 파일의 이전 초안은 장소 프로필과 추천 기능이 모두 미구현이던 시점에 작성됐다. 이후 SPEC-002부터 SPEC-007까지 구현됐고 제주 비음식점 1,434건의 `ai_draft` 프로필이 생성되어, 과거의 “SPEC-002를 새로 만들라”는 지시와 구현 상태 설명은 더 이상 유효하지 않다.

추천 엔진의 현재 기준은 다음 문서가 정의한다.

- 작업 진입점과 구현 상태: [docs/README.md](docs/README.md)
- AI 초안 인지형 엔진 상세 설계: [docs/spec_008.md](docs/spec_008.md)
- 장소 적합도·제약·다양성·일정 경계: [docs/recommendation_algorithm.md](docs/recommendation_algorithm.md)
- 요청·trace·결과 계약: [docs/data_contracts.md](docs/data_contracts.md)
- 평가와 단계적 출시 gate: [docs/evaluation.md](docs/evaluation.md)
- 개인정보·설명·AI 초안 안전 원칙: [docs/safety_privacy.md](docs/safety_privacy.md)

핵심 방향은 장소 적합도와 일정 최적화를 분리하는 것이다. Draft인 SPEC-008의 첫 구현 제안은 현재 `ai_draft`를 중립값 쪽으로 보정해 쓰는 내부 오프라인 장소 랭커이며, 추천 API·사용자 공개 운영·일정 최적화는 아직 미구현이다.

새 작업자는 항상 [docs/README.md](docs/README.md)를 먼저 읽고 활성 SPEC과 그 SPEC이 링크한 기준 문서를 따른다.
