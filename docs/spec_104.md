# SPEC-104: 음식점 조회 DB의 중복 JSON 제거

- 상태: Implemented
- 작성일: 2026-10-06
- 최종 수정일: 2026-10-06
- 관련 이슈: 사용자 요청 — 중복 저장을 줄여 음식점 DB 재구축
- 관련 문서: [데이터 계약](data_contracts.md), [아키텍처](architecture.md), [실행 안내](kakao_restaurant_collection.md)
- 관련 코드: `scripts/build_restaurant_query_db.py`, `scripts/validate_restaurant_query_db.py`, `scripts/test_restaurant_query_db.py`, `config/restaurant_catalog.v2.sql`
- 선행 SPEC: [SPEC-103](spec_103.md)

## 배경

사실: 기존 음식점 조회 DB는 215,818,240 bytes다. raw_json 필드에 약 77.4MB, source_json에 약 29.8MB가 있으며 같은 본문·관측이 일반 컬럼과 중복된다. canonical JSONL에 원관측과 전체 레코드가 이미 보존되어 있다. 사용자는 이 중복을 줄이는 재구축을 승인했다.

## 목표

- 원본·정본 JSONL과 기존 v1 산출물을 보존하면서 더 작은 v2 조회 DB를 실제 생성한다.
- 식당·리뷰·영업시간·수집 오류의 조회 값과 출처/시각/상태/순서/해시를 보존한다.

## 비목표

- 원본 수집 DB, 정본 JSONL, 이전 DB 삭제·덮어쓰기
- 장소·리뷰 삭제, 원문 요약·압축 손실, 재수집, 검색 범위 변경
- 기존 지도·추천·공개 리뷰 서비스 연결, DB의 Git 업로드

## 요구사항

- `REQ-10401`: 검증된 v1 JSONL 4개와 manifest를 읽기 전용 입력으로 사용한다. 원본·입력 JSONL·기존 v1 DB의 해시가 바뀌지 않아야 한다.
- `REQ-10402`: SQLite에서 raw_json 전부와 places/reviews의 source_json만 제외한다. 나머지 조회 컬럼, record_sha256, 인덱스와 FK/UNIQUE/CHECK를 유지한다. business_hours.schedule_json은 조회 값이므로 유지한다.
- `REQ-10403`: 전체 원관측은 기존 JSONL에 보존하며 v2 DB에 복제하지 않는다. v2 manifest에 canonical 계약·정본 manifest의 의미 해시·정본 레코드 digest·JSONL 파일 해시·상대 위치를 기록한다. 별도 복사본을 만들지 않는다.
- `REQ-10404`: v2 DB의 typed column 전 행을 정본에서 투영한 값과 비교한다. DB 논리 해시는 v2 조회 행, canonical 논리 해시는 기존 v1 정본 전체 레코드를 기준으로 별도 기록한다.
- `REQ-10405`: 임시 폴더에 생성·검증 후 새 폴더에 게시한다. 동일 입력 재실행은 검증 후 재사용하고, 다른 입력으로 기존 폴더를 덮어쓰지 않는다. 입력 정본 폴더 이동은 명시적 --canonical-dir로 지원한다.
- `REQ-10406`: JSONL과 manifest만으로 재구축 가능해야 하며, v1 SQLite가 없어도 동작해야 한다. 대용량 파일은 계속 Git 제외하고 코드·스키마·문서·작은 manifest만 반영한다.

## 입력과 출력

- 입력: `data/catalogs/jeju/2026-09-21/restaurant-catalog-v1/`의 4개 JSONL과 manifest. v1 SQLite는 입력에 필요하지 않다.
- 출력: 같은 날짜 `restaurant-catalog-v2/`의 `restaurants.sqlite3`와 `manifest.json`.
- 계약: v2 조회 DB는 `restaurant-catalog-v2`, 정본은 기존 `restaurant-catalog-v1`. 좌표 순서는 경도→위도, 미확인은 null/기존 상태, 시각은 원래 시간대를 유지한다.

## 설계

정본 v1 검증→전체 조회 컬럼을 v2 SQL에 투영→파일/논리 digest·정본 참조 manifest 작성→독립 검증→원자적 게시. record_sha256은 전체 canonical 레코드의 기존 해시다. v2 DB 자체만으로 raw/source JSON을 복원할 수 없으며 상세 원관측 조회에는 정본 파일이 필요하다. 두 버전 폴더를 함께 이동하면 상대 경로가 유지되고, 다른 위치에 옮겼으면 --canonical-dir로 실제 위치를 지정한다. 경로는 로컬 정본 폴더이며 네트워크 요청은 없다.

## 예외와 폴백

누락/변조된 정본, FK·건수·상태·typed-column 불일치, 다른 snapshot의 출력 덮어쓰기는 실패다. 실패하면 기존 DB를 유지한다. 기존 v1 생성기·검증기와 스키마는 그대로 지원한다.

## 영향 범위

- 신규 v2 SQL·생성기·검증기·회귀 테스트·작은 manifest 및 기존 문서·Git 제외 규칙.
- v1 생성/검증 도구, 수집기, 기존 서비스 DB 변경 없음.
- canonical_id 등의 조회 계약은 유지하며 raw_json/source_json을 직접 읽던 코드는 v1 또는 JSONL을 사용해야 한다.
- 원본 및 v1을 삭제하지 않으므로 전체 디스크 사용량 절감은 별도 정리 작업의 범위다.

## 승인 기준

- `AC-10401`: 13,561곳·44,156개 리뷰·13,561개 시간 상태·367개 오류 레코드를 보존한다.
- `AC-10402`: 모든 유지 컬럼과 record_sha256이 v1과 동일하며 정본/원본 해시 불변, DB integrity/FK/스키마/파일 해시 검증 통과.
- `AC-10403`: v1 DB 없이 복원·다른 위치로 정본 이동·반복 실행이 가능하고 변조·다른 입력 덮어쓰기는 탐지한다.
- `AC-10404`: 실제 v2 DB가 v1보다 작고 크기·감소율을 보고한다. v2 DB도 Git에서 제외되고 다른 로컬 작업은 보존한다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-10401~10403 | fixture 전 행 비교·원본 없는 복원·이동·변조·덮어쓰기 회귀 | `python scripts/test_restaurant_query_db.py` |
| AC-10401~10404 | 실제 전체 재구축·검증·컬럼 전 행 비교·SHA·크기 비교 | `python scripts/build_restaurant_query_db.py`, `python scripts/validate_restaurant_query_db.py` |
| AC-10404 | Git 제외·변경 범위 | `git check-ignore`, 커밋 경로 검사 |

## 구현 결과

- `AC-10401~10402`: 실제 `restaurant-catalog-v2/restaurants.sqlite3`를 생성하고 v1과 모든 유지 컬럼을 행별 비교했다. 장소 13,561행·리뷰 44,156행·운영시간 13,561행·오류 367행 모두 동일하며 record_sha256도 같다. FK·무결성·스키마·파일 해시·정본 해시·논리 digest 검증 통과.
- 원본 `collection.sqlite3`와 WAL, v1 JSONL 4개·manifest·SQLite의 생성 전후 SHA-256이 모두 동일했다. 원본 DB와 v1 DB를 삭제하거나 수정하지 않았고, JSONL 추가 복사본도 만들지 않았다.
- `AC-10403`: JSONL만 사용하는 별도 임시 폴더의 전체 재구축과 독립 검증을 통과했다. v2 논리 digest는 `aae79e2c3dee562cdeb4e2aaf960865f9c20c25978ae06b7805ada45853e91aa`로 재구축 시 동일하다.
- `python -X utf8 scripts/test_restaurant_query_db.py`: 7개 통과. 모든 유지 컬럼/입력 해시 보존, v1 SQLite 없는 재구축·재실행, 정본 상대 이동·명시적 위치 지정, DB 내용 변조 탐지, 변조 정본 게시 거부, 다른 snapshot 덮어쓰기 거부, CRLF 스키마/manifest 호환을 검증했다. Windows sandbox 임시 폴더 제한이 이미 확인되어 승인된 환경에서 실행했다.
- 신규 Python 3개 `py_compile` 통과. v1 생성기·검증기·회귀 테스트·스키마 및 수집기는 변경하지 않았다.
- `AC-10404`: 215,818,240 bytes → 55,853,056 bytes, **159,965,184 bytes(74.12%) 감소**. v2 DB와 로컬 검증 기록의 Git 제외를 확인했으며 코드·SQL·문서·작은 manifest만 반영한다.

## 설계와 달라진 점

없음.

## 알려진 제한

수집 미확인·실패 상태 및 외부 백업 미지정은 SPEC-103과 동일하다. 이전 DB를 보존하므로 전체 디스크 사용량은 자동 감소하지 않는다. 더 작은 v2 파일이 현재 조회용이며 원관측 확인·전체 검증에는 v1 정본 JSONL이 필요하다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-10-06 | 사용자 승인 범위와 구현 전 설계·검증 계획 등록 |
| 2026-10-06 | v2 실제 생성, 74.12% 축소, 전체 컬럼·입력 SHA 보존·재구축 동등성·7개 회귀 검증 완료 |
