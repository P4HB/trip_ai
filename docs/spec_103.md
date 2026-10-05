# SPEC-103: 제주 음식점 정본 JSONL·조회용 SQLite 카탈로그

- 상태: Implemented
- 작성일: 2026-10-06
- 최종 수정일: 2026-10-06
- 관련 이슈: 기존 장소 DB 방식으로 음식점 저장, 대용량 원본 Git 제외
- 관련 문서: [데이터 계약](data_contracts.md), [아키텍처](architecture.md), [수집 SPEC](spec_085.md)
- 관련 코드: `scripts/build_restaurant_catalog.py`, `scripts/validate_restaurant_catalog.py`, `config/restaurant_catalog.v1.sql`
- 선행 SPEC: SPEC-007, SPEC-066, SPEC-085

## 배경

기존 장소는 source_order 순서 canonical JSONL, 제약·인덱스가 있는 조회용 SQLite, 건수·해시 manifest를 사용한다. 음식점 원본은 약 104MiB 재개용 SQLite이며 장소 13,561곳·리뷰 44,156건을 저장했다. 상세 실패 36곳과 운영시간 미확인/미수집 112곳이 남았다. 사용자 요청으로 같은 저장 방식을 적용하며 대용량 파일은 로컬에 둔다.

## 목표와 비목표

독립 음식점 카탈로그를 실제 생성·검증하고 JSONL만으로 DB를 재생성할 수 있게 한다. 원본/기존 DB 수정, 지도·추천 서비스 연결, TourAPI ID·좌표·라벨 추정, 미확인 수집의 완료 선언은 범위 밖이다.

## 요구사항

- `REQ-10301`: 원본은 읽기 전용으로 열어 SQLite backup의 일관된 메모리 snapshot에서 변환한다.
- `REQ-10302`: `kakao:{place_id}`와 원본 ID, title/address/longitude/latitude/source_order/raw_json/record_sha256을 보존한다. 좌표는 null이며 공급자 ID를 임의 병합하지 않는다.
- `REQ-10303`: places/reviews/business_hours/collection_issues canonical JSONL과 동등한 SQLite typed columns·원문 레코드·외래키·조회 인덱스를 생성한다. 작성자 식별 필드는 추가하지 않는다.
- `REQ-10304`: 후기 미제공·0건·미확인 개수 및 영업시간 기재·미등록·미확인·미수집을 구별한다. 과거 숨김 DOM 기본값 의심 개수는 상세 근거 없이는 확정하지 않는다.
- `REQ-10305`: 입력 논리 해시, 출력 SHA-256/크기/건수, 논리 DB 해시와 coverage를 manifest에 기록한다. 같은 JSONL 재구축은 논리 digest가 같아야 한다.
- `REQ-10306`: 생성/검증 코드·SQL 스키마·문서·작은 manifest만 Git 대상으로 삼고 수집 DB/CSV/로그 및 생성 JSONL/SQLite는 로컬 보존한다.

## 입력과 출력

- 입력: `data/kakao/jeju/2026-09-21/restaurants/collection.sqlite3` 또는 이미 생성한 JSONL 폴더.
- 출력: `data/catalogs/jeju/2026-09-21/restaurant-catalog-v1/`의 `places.jsonl`, `reviews.jsonl`, `business_hours.jsonl`, `collection_issues.jsonl`, `restaurants.sqlite3`, `manifest.json`.
- UTF-8, 0 기반 source_order, 경도→위도, 원본의 시간대 포함 관찰 시각을 유지한다.

## 설계

읽기 전용 수집 DB→일관 snapshot→canonical 레코드→JSONL+SQLite→독립 검증→임시 폴더에서 게시한다. raw_json뿐 아니라 typed columns도 전 행 비교한다. 같은 스냅샷의 재실행은 기존 결과를 검증해 재사용하고 다른 입력으로 기존 폴더를 덮어쓰지 않는다. Git의 manifest는 데이터를 포함하지 않고 로컬 파일의 해시·coverage를 설명한다.

장소 ID 문자열 순서로 0 기반 source_order를 부여한다. 리뷰는 장소 ID·원본 position 순서이며 같은 본문도 서로 다른 position이면 별도 관측으로 보존한다. 원본 필드는 허용 목록으로 복사하고 작성자 필드는 제외한다. 방문자 후기 수는 상세 요약을 우선하며 블로그 후기 수는 실제 검색 관찰 시각을 연결한다. 상세 평점/후기 수는 수집기의 검색값 폴백이 있을 수 있어 inventory/detail 원관측을 source에 함께 둔다. 상세 근거가 없는 수정 전 검색값 30은 unverified_legacy/null로 내보내고 원관측은 source에 보존한다. 실패 상세, 미확인/미수집 시간 및 검색 상한은 collection_issues에 남긴다.

## 예외와 폴백

ID·숫자·FK·해시·작성자 필드 또는 JSONL/DB 불일치는 실패다. 미확인 수집은 issue에 남긴다. 다른 PC에서 재구축하려면 Git 외의 실제 원본 또는 canonical JSONL 파일을 별도로 복사해야 한다.

## 영향 범위

신규 카탈로그·생성기·검증기·테스트·SQL·문서와 제한된 Git 제외 규칙. 기존 서비스 및 원본 DB 마이그레이션 없음.

## 승인 기준과 테스트 계획

| 기준 | 검증 |
|---|---|
| `AC-10301` | 실제 13,561곳·44,156건과 누락 상태 보존 |
| `AC-10302` | JSONL 전 행/typed columns/raw_json, integrity/FK, 해시, 작성자 필드 부재 검증 |
| `AC-10303` | JSONL 재구축 digest 동등, 원본 해시 불변, 대용량 Git 제외 |
| `AC-10304` | 이 작업과 사용자가 승인한 문서 병합만 Git 반영, 다른 로컬 수정 보존 |

`python scripts/test_restaurant_catalog.py`, 실제 생성·독립 검증·JSONL 재구축으로 검증한다.

## 구현 결과

- `AC-10301`: 실제 원본에서 장소 13,561곳·리뷰 44,156건·운영시간 상태 13,561행·issue 367건을 저장했다. 상세 done 13,525/failed 36, 시간 available 10,672/not_provided 2,777/unrecognized 80/uncollected 32를 보존했다. 원본 상세 실패 2곳에 남아 있던 이전 empty 요약도 보존해 review_status와 최근 detail_status를 독립적으로 기록한다.
- `AC-10302`: `python scripts/validate_restaurant_catalog.py`가 모든 JSONL·typed columns·raw_json·레코드/파일 해시·스키마·DB integrity/FK·상태 집계를 통과했다. 카탈로그 SQLite는 215,818,240 bytes이며 manifest는 약 4.6KB다.
- `AC-10303`: JSONL만 입력으로 별도 임시 폴더에 실제 전체 DB를 재구축했다. 4개 JSONL 파일의 SHA-256과 논리 DB 해시 `c3b2dd642be4b9df2358afedde4e02526597de2f934e2a01a86e8b6239ae154e`가 일치한다. 생성·재구축 전후 원본 DB SHA-256 `db602be31b7baa12a6d04dbb650e4326057b092245de6a2869e49f80b3e0b385`와 WAL 해시가 변하지 않았다. `git check-ignore`로 원본/CSV/생성 JSONL/SQLite 제외를 확인했다.
- `python -X utf8 scripts/test_restaurant_catalog.py`: 7개 통과. WAL snapshot, 0/미제공/의심 숫자 구별, 동일 본문 보존, 작성자 필드 제외, 원본 없는 복원, typed-column 변조 탐지, 건수 불일치·다른 입력 덮어쓰기 거부, CRLF 체크아웃 호환성을 검증한다.
- `python -X utf8 scripts/test_kakao_restaurant_collector.py`: 기존 19개 회귀 통과. 신규 6개 Python 파일의 py_compile 통과. 테스트의 최초 실행은 Windows sandbox 임시 폴더 SQLite 접근 제한으로 실패했으며, 승인된 정상 환경 재실행에서 통과했다.
- `AC-10304`: 사용자가 양쪽 문서 병합과 업로드를 승인하여 네 파일의 충돌 표시를 해제했다. 문서 색인은 번호순으로 정리하고 기존 로컬 SPEC-085~097과 원격 SPEC-101·102를 모두 유지했다. 로컬 전용 제출 자료는 제외 사실을 표시한다. 병합된 색인에서 참조하는 SPEC·사업 문서·기존 도구 제거 관련 문서를 함께 반영하고, 무관한 라벨링 산출물·사용자 UI 상태·그 외 로컬 작업은 보존한다.

## 설계와 달라진 점

없음.

## 알려진 제한

원 수집은 일부 미확인 상태이며 전수성을 보장하지 않는다. 데이터의 외부 백업 위치는 지정되지 않았다.

Git의 manifest만 받은 PC에서는 실제 데이터를 복원할 수 없다. 원본 SQLite 또는 canonical JSONL 4개와 manifest를 별도로 전달해야 한다. 기존 기본 출력 폴더에 manifest만 있으면 새 출력 폴더를 지정해 재구축한다. 공개 지도·추천·리뷰 API에 연결하지 않는다.

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-06 | 기존 저장 방식 조사, 구현 전 설계와 승인 기준 등록 |
| 2026-10-06 | 문서 병합 승인, 카탈로그 실제 저장·7개 회귀·전체 재구축·원본 해시 보존 검증 완료 |
