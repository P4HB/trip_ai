# SPEC-078: 하루 대표 유형당 1곳 제한

- 상태: Implemented
- 작성일: 2026-09-11
- 관련 문서: [SPEC-077](spec_077.md), [SPEC-015](spec_015.md), [CCU-MMR](ccu_mmr_algorithm_draft.md), [데이터 계약](data_contracts.md), [평가](evaluation.md), [아키텍처](architecture.md)

## 배경·목표
사용자 확정 대표 유형을 이용해 일정의 각 날짜에 같은 유형이 1곳을 초과하지 않도록 한다. 장소 랭킹과 날짜 배치는 구별한다.

## 비목표
전체 여행에서 유형 1곳 제한, Top-N 후보 목록 제한, 실제 이동시간, 배포, 점수·분류 변경.

## 요구사항
- REQ-001: 지도 생성기가 2,153곳의 분류 sidecar를 검증·조인하고 primaryType/primaryTypeLabel 및 버전을 번들에 넣는다.
- REQ-002: 자동 추천·필수 장소·사용자/자동 anchor 모두 하루 유형당 1곳 상한에 포함한다. 날짜가 다르면 같은 유형을 허용한다.
- REQ-003: 필수 장소가 같은 유형이면 기존 지리 군집 안에서 다른 날짜로 나눈다. 필요한 군집 수가 여행일을 초과하면 필수 장소를 삭제하지 않고 infeasible로 알린다.
- REQ-004: unknown/누락 유형은 자동 일정·중심 후보에서 제외한다. 필수 장소/사용자 anchor의 분류가 없으면 오류를 알린다.
- REQ-005: 후보 부족 시 최대 6곳을 억지로 채우지 않는다. UI에 유형당 1곳과 빈자리 사유를 표시한다. diversity=off도 일일 상한을 지킨다.
- REQ-006: 결과에 dailyTypeLimit=1과 장소 primaryType를 기록하고 알고리즘 버전을 v7로 변경한다.

## 입력·출력·설계
구현: 확정 sidecar → 지도 번들 → 기존 앱의 spread 입력 → 엔진 유형 검사. 필수 장소 지리 군집의 기존 bearing 순서를 유지하며 capacity와 유형 중복을 함께 검사해 첫 가능한 일자에 넣는다. 모든 하위 군집은 기존 고정 중심을 유지한다. 추가 추천은 유형 gate 후 기존 variant 우선/MMR을 수행한다.

## 예외·영향 범위
후보가 적으면 비운다. 새 분류가 누락/중복/미등록/검토 미완료면 번들 생성을 실패시킨다. 기존 필수 군집의 탐욕적 분할은 전역 최적 일정 가능성 보장이 아니다. UI·엔진·생성기·번들·회귀 테스트·분류 manifest와 문서를 변경한다.

## 승인 기준·테스트 계획
- AC-001: 모든 일자에 유형 중복 0, 다른 일자 동일 유형 허용.
- AC-002: 필수 동일 유형의 일자 분리·여행일 초과 infeasible, anchor 집계, unknown 폴백, 다양성 off를 검증한다.
- AC-003: 실제 2,153곳 입력·세 seed·여러 취향/교통/날짜 조건에서 상한과 반경·capacity·ID 보존 확인.
- AC-004: 기존 점수 회귀, 지도 입력 데이터와 분류 일치, 생성 diff 확인.
명령: `node --check map-ui/ccu-mmr.js`, `node --check map-ui/app.js`, `node --check scripts/build_map_ui_data.mjs`, `node scripts/build_map_ui_data.mjs`, `node scripts/test_ccu_mmr.cjs`, `node scripts/test_daily_type_limit.cjs`, `node scripts/validate_ccu_mmr_dashboard.cjs`, `python scripts/test_place_types.py`.

## 구현 결과
지도 번들 2,153곳에 primaryType/primaryTypeLabel을 조인하고 metadata에 분류 버전을 기록했다. 엔진 버전은 ccu-mmr-v7-daily-type-limit이다. 필수 장소 군집 분할·추천 후보·사용자/자동 anchor에서 하루 유형 1곳 상한을 적용했다. 일정 결과의 dailyTypeLimit=1 및 places[].primaryType로 추적한다. UI에 상한과 후보 부족 안내를 추가하고 script cache key를 갱신했다.

## 검증 결과

- 엔진·앱·생성기 Node 문법 검사 통과.
- `node scripts/build_map_ui_data.mjs`: 2,153 지도 장소/1,663 추천 준비 유지. 생성 diff를 구조적으로 비교한 결과 분류 두 필드 외 장소 변경 0곳, metadata는 algorithmVersion/primaryTypeVersion만 변경됐다.
- `node scripts/test_ccu_mmr.cjs`: 기존 점수·코스·일정 회귀 통과. 기존 synthetic fixture에 고유 대표 유형을 추가해 기존 거리/capacity 검증 목적을 유지했다.
- `node scripts/test_daily_type_limit.cjs`: 유형 상한·필수 동일 유형 분리·부족 여행일 infeasible/필수 보존·사용자/자동 anchor·unknown·diversity off 및 실제 데이터 48개 시나리오 통과.
- `node scripts/validate_ccu_mmr_dashboard.cjs`: UI 계약과 전체 데이터 fixture 통과.
- 번들 변경 후 `python scripts/classify_place_types.py`로 sidecar 입력 해시를 갱신하고 `python scripts/test_place_types.py` 통과. 분류값과 유형 건수는 유지됐다.
- 초기 구현 검증 당시 배포 및 실제 브라우저 시각 검증은 수행하지 않았다. 후속 배포 결과는 아래에 기록한다.

## 설계와 달라진 점
없음.

## 알려진 제한
직선거리 근사·일차 군집이며 실제 이동 및 방문순서 최적화가 아니다. Top-N 후보는 같은 유형을 포함할 수 있다.

## 변경 이력
| 날짜 | 내용 |
|---|---|
| 2026-09-11 | 일일 유형 1곳 상한 설계 |

## 후속 배포 계획
사용자가 Git push 및 서버 배포를 승인했다. 원격 main 최신 커밋 기반 별도 작업트리에서 이번 변경만 커밋·푸시한다. OCI 현재 릴리스의 edge 이미지를 기반으로 map-ui를 갱신한 새 이미지를 만들고 기존 `activate-edge-only.sh`로 전환한다. Rail API·피드백 컨테이너, 볼륨, Caddy 설정을 유지한다. 공개 HTTPS 파일 해시·버전·기존 healthz를 검증하며 실패 시 기존 edge 릴리스로 복구한다.

## 후속 배포 결과

- 기능 커밋 `7270b2a`, SPEC 색인 커밋 `fbda02c`를 `origin/main`에 푸시했다. 원격 기존 커밋을 보존하고 관련 없는 로컬 미완료 작업은 포함하지 않았다.
- `/opt/rail-desk/releases/20260911-travel-types-fbda02c`를 활성화했다. 이전 활성 릴리스 `20260911-clock-02`를 복제하고 기존 edge 이미지를 기반으로 `map-ui`만 교체한 `rail-desk-edge:travel-types-fbda02c`를 생성했다.
- 기존 `activate-edge-only.sh`가 서비스 설정 동일성·예약 작업 없음·헬스체크를 검증하고 전환했다. Rail API와 travel-feedback 컨테이너 ID는 유지됐으며 세 컨테이너 모두 healthy다.
- 공개 `/`, `/healthz`, `/travel/` HTTP 200. index/app/ccu-mmr/장소 데이터/styles/preference/Leaflet 자산 7개도 HTTP 200이며 업로드한 Git 아카이브와 SHA-256/바이트가 일치한다. Git archive의 Windows 줄바꿈 변환 때문에 Git blob 직접 비교와는 줄바꿈만 다르며 정규화 내용은 일치한다.
- 공개 URL: https://168-107-40-231.sslip.io/travel/
- 실제 브라우저 시각 검증은 별도로 수행하지 않았다. 기능은 앞서 통과한 48개 시나리오 코드와 동일한 파일이 배포됐다.
