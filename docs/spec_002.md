# SPEC-002: 제주 장소 음식점·비음식점 라벨링 데이터 분리

- 상태: Implemented
- 작성일: 2026-08-09
- 최종 수정일: 2026-08-09
- 관련 이슈: 사용자 요청
- 관련 문서: [문서 색인](README.md), [데이터 계약](data_contracts.md), [시스템 아키텍처](architecture.md), [추천 알고리즘](recommendation_algorithm.md)
- 관련 코드: `scripts/split_tourapi_jeju_places.mjs`, `data/labeling/jeju/`
- 선행 SPEC: [SPEC-001](spec_001.md)

## 배경

2026-08-09 제주 TourAPI 스냅샷에는 장소 2,154건이 있으며 음식점 720건과 그 밖의 장소 1,434건이 한 배열에 들어 있다. 초기 장소 적합도 라벨링은 음식점을 제외하고 진행하므로, 원본 스냅샷을 변경하지 않으면서 두 집합을 명시적으로 분리한 재현 가능한 입력 데이터가 필요하다.

TourAPI의 장소 유형 필드 `contenttypeid`에서 문자열 값 `39`는 음식점을 뜻한다. 현재 원본의 음식점 외 유형은 관광지, 문화시설, 축제·공연·행사, 레포츠, 숙박, 쇼핑이며 여행코스는 0건이다.

## 목표

- 최신 제주 TourAPI 스냅샷을 음식점과 비음식점 장소로 정확히 분할한다.
- 비음식점 데이터를 초기 일반 장소 라벨링의 입력 후보로 제공한다.
- 원본 레코드의 필드와 배열 순서를 보존한다.
- 분리 규칙, 원본 스냅샷, 건수와 파일 해시를 추적할 수 있게 한다.
- 이후 스냅샷에도 같은 규칙을 재실행할 수 있는 스크립트를 제공한다.

## 비목표

- 장소 적합도 라벨 생성 또는 추천 점수 계산
- 음식점 전용 라벨 체계나 음식점 추천 정책 확정
- 숙박·쇼핑 등 비음식점 하위 유형의 추가 분리
- TourAPI 원본 및 지도용 데이터의 구조나 동작 변경
- 좌표가 비정상인 레코드의 제거 또는 보정

## 요구사항

- `REQ-001`: 분리기는 가장 최신의 `data/tourapi/jeju/YYYY-MM-DD/jeju_places.json`을 입력으로 선택해야 한다.
- `REQ-002`: `contenttypeid`를 문자열로 정규화했을 때 `39`인 레코드만 음식점 집합에 포함해야 한다.
- `REQ-003`: `contenttypeid`가 `12`, `14`, `15`, `25`, `28`, `32`, `38` 중 하나인 레코드는 비음식점 집합에 포함해야 한다.
- `REQ-004`: 입력의 모든 레코드는 정확히 한 출력 집합에 속해야 하며 두 집합의 `contentid`는 서로 겹치면 안 된다.
- `REQ-005`: 빈 `contentid`, 중복 `contentid`, 빈 `contenttypeid` 또는 지원하지 않는 `contenttypeid`가 있으면 잘못된 분리를 생성하지 않고 실패해야 한다.
- `REQ-006`: 출력 레코드는 원본의 모든 필드와 원본 배열 내 순서를 보존해야 한다.
- `REQ-007`: 분리 메타데이터에는 원본 경로·날짜·해시, 분리 규칙, 전체 및 집합별 건수, 유형별 건수, 출력 파일 해시를 기록해야 한다.
- `REQ-008`: 같은 입력으로 반복 실행하면 동일한 데이터 파일과 메타데이터를 생성해야 한다.

## 입력과 출력

입력:

- `data/tourapi/jeju/YYYY-MM-DD/jeju_places.json`
- UTF-8 JSON 배열
- 필수 분리 필드: `contentid`, `contenttypeid`

출력:

- `data/labeling/jeju/YYYY-MM-DD/restaurants.json`: `contenttypeid == "39"`인 음식점 배열
- `data/labeling/jeju/YYYY-MM-DD/non_restaurants.json`: `contenttypeid != "39"`인 비음식점 배열
- `data/labeling/jeju/YYYY-MM-DD/manifest.json`: 입력·규칙·건수·해시 메타데이터

현재 스냅샷의 예상 건수:

| 집합 | 건수 |
|---|---:|
| 음식점 | 720 |
| 비음식점 | 1,434 |
| 전체 | 2,154 |

좌표는 분리 조건에 사용하지 않으며 원본의 `mapx`(경도), `mapy`(위도)를 그대로 보존한다. 따라서 비정상 좌표 레코드도 해당 장소 유형 집합에 남는다.

## 설계

```text
최신 jeju_places.json
        |
        v
입력 배열·ID·유형 검증
        |
        +-- contenttypeid == "39" --> restaurants.json
        |
        +-- contenttypeid != "39" --> non_restaurants.json
        |
        v
건수·교집합·합집합 검증 --> manifest.json
```

분리기는 추천 특징을 추가하거나 원본 장소를 정규화하지 않는다. 두 출력은 원본의 파생 뷰이며, 비음식점 출력만 초기 일반 장소 라벨링 후보로 사용한다. 음식점 출력은 유실하지 않고 향후 별도 라벨 체계를 정의할 수 있도록 보존한다.

## 예외와 폴백

- 유효한 날짜 디렉터리 또는 `jeju_places.json`이 없으면 오류로 종료한다.
- 입력 최상위 값이 배열이 아니면 오류로 종료한다.
- 식별자·유형 무결성 검증에 실패하면 기존 생성 파일을 갱신하지 않고 오류로 종료한다.
- 비어 있거나 지원 목록에 없는 `contenttypeid`는 음식점 또는 비음식점으로 추측하지 않고 오류로 종료한다.
- 좌표와 기타 필드의 누락·비정상 값은 이 단계에서 보정하거나 제거하지 않는다.

## 영향 범위

- 변경 예정 파일: `scripts/split_tourapi_jeju_places.mjs`, `docs/README.md`, `docs/data_contracts.md`, `docs/architecture.md`, `data/labeling/jeju/README.md`
- 생성 산출물: `data/labeling/jeju/2026-08-09/`
- 데이터 마이그레이션: 없음. 원본 스냅샷은 불변이다.
- 호환성 영향: 기존 수집기, 지도 데이터 생성기와 지도 UI에 영향 없음
- 보안·개인정보 영향: 공개 TourAPI 장소 데이터만 복제하며 사용자 데이터는 처리하지 않음

## 승인 기준

- `AC-001`: 현재 스냅샷에서 음식점 720건과 비음식점 1,434건이 생성된다.
- `AC-002`: 두 출력의 합은 2,154건이며 `contentid` 교집합은 0건이다.
- `AC-003`: 음식점 출력의 모든 `contenttypeid`는 `39`이고 비음식점 출력에는 `39`가 없다.
- `AC-004`: 각 출력 레코드는 대응하는 원본 레코드와 필드·값이 동일하고 원본 내 순서를 유지한다.
- `AC-005`: 생성 manifest가 원본 스냅샷과 분리 규칙, 건수 및 SHA-256 해시를 기록한다.
- `AC-006`: 분리 스크립트 구문 검사와 반복 생성 결정성 검증을 통과한다.
- `AC-007`: 기존 지도 데이터 생성기와 지도 UI JavaScript의 구문 검사가 계속 통과한다.
- `AC-008`: 문서 색인과 기준 문서가 실제 경로 및 동작과 일치한다.

## 테스트 계획 및 결과

| 승인 기준 | 검증 방법 | 명령 또는 위치 | 결과 |
|---|---|---|---|
| AC-001~AC-005 | 생성 후 원본과 두 배열의 건수, 유형, ID 교집합·합집합, 객체·순서, 해시 독립 검증 | `node scripts/split_tourapi_jeju_places.mjs`; Node.js 무결성 검사 | 통과: 720 + 1,434 = 2,154, 교집합 0, 원본 객체·순서 및 해시 일치 |
| AC-006 | Node.js 구문 검사 후 재생성 전후 세 파일의 SHA-256 비교 | `node --check scripts/split_tourapi_jeju_places.mjs`; 반복 생성 해시 검사 | 통과: 세 파일 모두 byte-identical |
| AC-007 | 기존 JavaScript 구문 검사와 지도 데이터 재생성 결과 비교 | `node --check scripts/build_map_ui_data.mjs`; `node --check map-ui/app.js`; `node scripts/build_map_ui_data.mjs` | 통과: 구문 정상, 지도 데이터의 Git 정규화 내용 변경 없음 |
| AC-008 | 전체 Markdown 상대 링크와 Git diff 형식 검사 | Markdown 링크 검사; `git diff --check` | 통과 |

## 구현 결과

- `scripts/split_tourapi_jeju_places.mjs`를 추가해 최신 제주 스냅샷 선택, 원본 manifest 해시 확인, ID·유형 검증, 완전 분할과 deterministic 출력을 구현했다.
- `data/labeling/jeju/2026-08-09/restaurants.json`에 음식점 720건을 생성했다.
- `data/labeling/jeju/2026-08-09/non_restaurants.json`에 초기 일반 장소 라벨링 후보 1,434건을 생성했다.
- `data/labeling/jeju/2026-08-09/manifest.json`에 원본 출처, 분리 규칙, 건수와 SHA-256을 기록했다.
- 비정상 좌표가 있는 `contentid=2704351`을 비음식점 데이터에서 제거하지 않았고 원본 필드와 순서를 모두 보존했다.
- 데이터 계약, 아키텍처, 문서 색인과 라벨링 데이터 사용 안내를 실제 구현에 맞춰 갱신했다.

## 설계와 달라진 점

없음.

## 알려진 제한

- 음식점용 라벨 정의와 추천 정책은 후속 SPEC에서 결정해야 한다.
- 비음식점 집합에는 숙박과 쇼핑이 포함된다. 이 유형을 일반 관광 장소와 함께 라벨링할지는 후속 라벨링 SPEC에서 더 좁힐 수 있다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-08-09 | 음식점·비음식점 분리 규칙과 승인 기준 작성 |
| 2026-08-09 | 분리 스크립트와 파생 데이터 생성, 무결성 검증 및 기준 문서 동기화 완료 |
