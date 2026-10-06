# SPEC-106: 전체 음식점 장소 ID별 좌표 수집과 조회 DB 연결

- 상태: Implemented
- 작성일: 2026-10-06
- 최종 수정일: 2026-10-06
- 관련 이슈: 사용자 요청 — 음식점 모두에 대해 좌표 다시 수집
- 관련 문서: [데이터 계약](data_contracts.md), [아키텍처](architecture.md), [수집 안내](kakao_restaurant_collection.md)
- 선행 SPEC: SPEC-085, SPEC-103, SPEC-104
- 관련 코드: `scripts/collect_restaurant_coordinates.py`, `scripts/validate_restaurant_coordinates.py`, `scripts/build_restaurant_coordinate_catalog.py`, `scripts/test_restaurant_coordinates.py`, `config/restaurant_catalog.v3.sql`

## 배경

사실: 음식점 정본/v2 DB의 13,561개 장소는 좌표가 전부 null이다. v1/v2 스키마는 null만 허용한다. 2026-10-06 공개 카카오 장소 웹 코드와 실제 2개 식당 응답에서 `https://place.map.kakao.com/places/panel3/{place_id}`의 `summary.confirm_id`, `summary.point.lon/lat`를 확인했다. 웹 코드는 이 좌표를 WGS84 지도 좌표로 사용한다. 이는 공개 페이지 내부 응답이며 공식 안정 API 계약은 아니다. 사용자 요청은 기존 수집 식당 전체의 최신 좌표 확인이다.

## 목표와 비목표

13,561개 기존 ID를 빠짐없이 좌표 확인 대상으로 등록하고 출처·확인 시각·성공/누락/오류를 보존한다. 같은 이름이나 주소로 임의 대체하지 않는다. 원본 수집 DB, v1 정본, v2 DB와 원본 수집기 변경·재라벨링·리뷰/시간 재수집·서비스 배포는 범위 밖이다.

## 요구사항

- REQ-10601: v1 정본의 장소 ID/source_order 전체를 고정 입력으로 삼고 입력 해시와 대상 13,561개를 기록한다. 동명이점/주소 지오코딩 폴백으로 ID를 바꾸지 않는다.
- REQ-10602: 공개 장소 응답의 confirm_id가 요청 ID와 같을 때만 좌표를 연결한다. 숫자·유한성·경도/위도 범위와 제주 권역을 검증한다. 경도→위도 WGS84이며 미확인은 null이다.
- REQ-10603: canonical_id, 원본 ID, 경도/위도, 상태, 원관측 장소명/주소/지역/공급자 상태, source_url, checked_at, HTTP 상태, 응답 SHA-256, 시도 수와 오류를 별도 재개용 SQLite·정본 JSONL로 기록한다. 다른 응답 영역의 리뷰·작성자·사진은 저장하지 않는다.
- REQ-10604: 최대 4개 HTTP 작업과 전역 요청 간격, timeout, 체크포인트·STOP·동시 실행 잠금을 사용한다. 401/403/429 또는 접근 제한은 저장 후 전체 중단하며 우회하지 않는다. 연속 네트워크/서버 오류도 중단하고 재개한다. 404/410은 unavailable이며 수집 성공 좌표로 바꾸지 않는다.
- REQ-10605: 전체 대상에 대한 최종 확인 결과를 보고한다. available/missing/unavailable/identity_mismatch/outside_jeju/invalid_coordinates/error/pending을 구분하며 누락은 성공으로 보고하지 않는다. 오류 재시도는 명시적 옵션으로 수행한다.
- REQ-10606: 좌표를 포함하는 별도 v3 조회 DB를 생성한다. 기존 조회 데이터와 base record hash를 보존하고 좌표 출처·확인 시각·관측 hash를 연결한다. v1 JSONL/v2 SQLite를 덮어쓰지 않는다.
- REQ-10607: 원본과 v1/v2 해시 불변, 전 대상 ID 대응, 성공 좌표의 유효성, 기존 리뷰/시간 데이터 불변 및 재구축 digest 일치 검증을 수행한다. 데이터 파일은 로컬, 코드·스키마·문서·작은 manifest만 Git 관리한다.

## 입력과 출력

- 입력: `data/catalogs/jeju/2026-09-21/restaurant-catalog-v1/places.jsonl`와 manifest.
- 좌표 출력: `data/kakao/jeju/2026-10-06/restaurant-coordinates/`의 `coordinates.sqlite3`, `coordinates.jsonl`, `manifest.json`. 진행 로그는 표준 출력에 기록한다.
- 조회 출력: `data/catalogs/jeju/2026-10-06/restaurant-catalog-v3/`의 `restaurants.sqlite3`, `manifest.json`, 로컬 검증 보고서 `validation.json`.
- 날짜는 KST 시간대 포함 ISO 8601이다. 주소/지명과 범위(125≤경도≤127.5, 32.8≤위도≤34.2)를 제주 확인 보조 근거로 사용하며 행정 경계 polygon 판정으로 표현하지 않는다.

## 설계 (구현됨)

정본 대상 목록→공개 장소 ID 응답→최소 필드 추출/검증→단일 writer 체크포인트→최종 JSONL·coverage manifest→v3 조회 DB 조인. rate limiter는 worker 전체에 적용하며 일반 실패는 상태 보존 후 다음 대상으로 진행한다. 최신 응답에서 이름/주소가 바뀌어도 기존 ID와 원관측을 보존하고 기존 식당 메타데이터를 자동 덮어쓰지 않는다. 제공처 상태는 원문 그대로 저장하며 영업 중/폐업으로 임의 해석하지 않는다.

구현 결정: 4 worker, 기본 간격 0.15초/허용 최솟값 0.1초, 실제 전체 실행은 0.1초를 사용한다. 각 결과는 즉시 SQLite commit하며 약 15초마다 정본/manifest를 내보낸다. v3는 pending이 0일 때만 게시한다. `places.record_sha256`은 기존 v1 hash를 유지하며 `coordinate_record_sha256`을 별도로 추가한다. 조회 테이블에 좌표 raw JSON을 복제하지 않는다. v3와 좌표 manifest는 정본 간의 상대 경로·해시를 연결한다.

## 예외와 폴백

누락·삭제·ID 불일치·제주 외 이전·비정상 좌표는 별도 상태로 남기고 위치를 추정하지 않는다. 사이트 제한과 스키마 변경은 안전하게 중단/오류 처리한다. 원본 데이터와 이미 저장한 성공 좌표는 재개 시 보존한다.

## 영향 범위

새 좌표 수집기·회귀·좌표 데이터·v3 스키마/빌더/검증 및 SPEC·문서. 다른 진행 중인 SPEC-105 관련 로컬 설계 변경은 보존한다.

## 승인 기준과 테스트 계획

| 기준 | 검증 |
|---|---|
| AC-10601 | 고정 13,561개 대상, 동일 ID만 연결, 중단·재개·중복 방지 회귀 |
| AC-10602 | 실제 표본의 ID/경도/위도·출처·시각 검증, ID 불일치/축 교환/누락/404/접근 제한 회귀 |
| AC-10603 | 전체 실행의 시도/성공/누락 상태 및 전 대상 집계·JSONL/SQLite 일치 |
| AC-10604 | v3 좌표 및 기존 컬럼 전 행 비교, 원본 해시 불변, 재구축·FK/integrity·파일 해시 검증 |
| AC-10605 | Git 제외와 관련 코드/문서만 반영, 다른 로컬 작업 보존 |

검증 명령: `python scripts/test_restaurant_coordinates.py`, `python scripts/collect_restaurant_coordinates.py --interval 0.1`, `python scripts/validate_restaurant_coordinates.py`, `python scripts/build_restaurant_coordinate_catalog.py`, `python scripts/build_restaurant_coordinate_catalog.py --validate-only`.

## 구현 결과

2026-10-06 09:23:50~09:50:22 KST에 고정 대상 **13,561개를 모두 1회씩 확인**했다. available **13,475개**, unavailable(HTTP 404) **82개**, identity_mismatch **4개**, pending/error/missing/outside_jeju/invalid_coordinates **0개**다. 총 86개는 좌표를 추정하지 않고 null로 보존했다. 전체 대상 확인 완료이며 전체 대상의 좌표 확보 성공을 뜻하지 않는다.

실제 생성한 v3 DB는 **60,420,096 bytes**이고 장소 13,561개·리뷰 44,156개·운영시간 13,561개·기존 수집 오류 367개를 포함한다. `coordinates.jsonl`은 8,573,889 bytes다. DB SHA-256은 `199f1434c9ac5e414d306cdd3f43214d46508bb4f452b2021c3c46635ed58808`, v3 논리 digest는 `25a2a86a8845803b9740c57592d6df9dae6b9e99a7503768dcd3de035c932515`다.

| 기준 | 실제 검증 결과 |
|---|---|
| AC-10601 | 정본 대상 13,561개와 좌표 JSONL/체크포인트의 ID·순서·상태·시도 수 전 행 일치, 모두 attempts=1 |
| AC-10602 | 실제 2개 조사 표본·첫 20개 실행 표본 성공, 최종 좌표 전 행 유효성 검증; ID 불일치·축 교환·제주 외·누락·404/410·429·비JSON 회귀 통과 |
| AC-10603 | 전체 상태 합계 13,561, pending/error 0; SQLite integrity 및 JSONL 레코드 전 행 동일 |
| AC-10604 | v3 생성 후 기본 상대 경로 검증 통과; v2의 장소 좌표 외 19개 컬럼·리뷰 12개·시간 13개·오류 8개 컬럼 전 행 동일; 원본 DB·v1/v2 산출물·원본 수집기 총 13개 파일 해시와 빈 원본 WAL 보존; 별도 임시 폴더 전체 재구축 논리 digest 동일 |
| AC-10605 | 원본/좌표/조회 DB와 JSONL은 Git 제외, 작은 manifest만 포함; 기존 staged 4개 및 SPEC-105 문서 작업과 구분하여 반영 |

`python scripts/test_restaurant_coordinates.py`: **12개 통과**. 중단/재개, STOP 사전 요청, 잠금, 오류만 재시도, 입력 변조/다른 snapshot 거절, 원본 보존, 기존 DB 없이 JSONL 복원, SQL/관측 ID 변조 탐지, pending 출력 거절을 확인했다. 전체 실데이터 검증·재구축 결과는 v3 폴더의 로컬 `validation.json`에 보관한다.

## 설계와 달라진 점

없음.

## 알려진 제한

공개 페이지 내부 응답은 변경될 수 있다. 조회 불가 82개와 ID 불일치 4개는 미확인으로 남는다. ID 불일치의 반환 ID가 기존 인벤토리에 있는 경우도 있지만 임의 병합하지 않는다. 조회 불가를 폐업으로 해석하지 않는다. 식당 인벤토리 자체의 공개 검색 전수성 한계는 SPEC-085와 동일하다. 좌표는 최신 확인값이고 기존 이름·주소·리뷰·영업시간은 원래 스냅샷 시점을 유지한다. 지도/추천 런타임 연결은 수행하지 않았다.

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-06 | 좌표 누락 확인·공개 응답 표본 조사·구현 전 범위/검증 계획 등록 |
| 2026-10-06 | 13,561개 전체 확인, 좌표 13,475개·미확인 86개 보존, v3 DB 생성·전 행 대조·원본 보존·복원 검증 완료 |
