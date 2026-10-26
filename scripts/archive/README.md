# 보관 스크립트

과거 Companion·월별 라벨 배치를 만들거나 검토할 때 한 번 쓰고 끝난 스크립트다. 현재 데이터 빌드·검증 경로에서는 참조하지 않으며 [SPEC-113](../../docs/spec_113.md)에서 `scripts/`에서 옮겼다. 과거 SPEC의 재현 명령은 `scripts/archive/` 경로로 갱신했다.

- 저장소 루트에서 실행한다. `Path(__file__).resolve().parents[1]`로 루트를 찾던 스크립트는 이동에 맞춰 `parents[2]`로만 바꿨고 라벨 계산은 바꾸지 않았다.
- 상대 경로(`data/...`)를 쓰는 스크립트는 작업 디렉터리 기준이며, 일부는 당시 작업 환경의 절대 경로를 담고 있어 그대로는 실행되지 않는다.
- 활성 라벨을 바꾸는 작업에는 쓰지 않는다. 현재 활성 라벨 세대는 [`data/labeling/jeju/README.md`](../../data/labeling/jeju/README.md)를 따른다.
