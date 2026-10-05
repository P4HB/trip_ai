# 제주 음식점 수집 실행 안내

기준은 [SPEC-085](spec_085.md)이다. 원본 `scripts/kakao_review_crawler.py`와 `scripts/collect_kakao_jeju_tourism_reviews.py`는 수정하지 않는다. 새 핵심 모듈 `scripts/kakao_restaurant_review_crawler.py`는 원본의 브라우저 생성·텍스트 유틸리티를 사용하고, 새 배치 실행기 `scripts/collect_kakao_jeju_restaurant_reviews.py`는 원본의 43개 지역 목록을 사용한다.

## 실행

Python, Chrome, `selenium`, `tzdata`가 필요하다. 저장소 루트에서 실행한다.

```powershell
python scripts/collect_kakao_jeju_restaurant_reviews.py --output-dir data/kakao/jeju/2026-09-21/restaurants
```

기본값은 제주 43개 구역 음식점, 평점 제한 없음, 카페·제과점 제외, 장소당 공개 후기 최대 5건이다. 주소가 제주인 결과만 포함하며 업종/주소 불명은 검토 대상으로 분리한다. 작성자 표시명·프로필은 저장하지 않는다. 장소 검색을 모두 진행한 뒤 상세와 후기를 방문한다. 검색 500건 상한을 관찰했으며 상한에 도달한 검색은 하위 음식 유형으로 나눠 추가 검색한다.

이미 발견한 음식점의 운영시간·후기를 검색과 동시에 채우는 실행은 다음과 같다. 검색용과 상세용 브라우저를 각각 하나씩 사용하며 배치 안에서 재사용한다. SQLite 쓰기는 주 실행 흐름 하나가 담당한다. 기존 폴더에서 전환해도 수집 범위와 저장 데이터는 유지된다.

```powershell
python scripts/collect_kakao_jeju_restaurant_reviews.py --output-dir data/kakao/jeju/2026-09-21/restaurants --concurrent
```

검색 계획을 모두 수행한 뒤에는 상세용 브라우저 두 개를 사용할 수 있다. 아직 상세 방문하지 않은 식당을 먼저 처리하고 실패한 식당 재시도와 기존 상세의 운영시간 보완을 이어간다. 두 브라우저의 장소 ID와 최대 시도 수를 공유해 중복 방문을 막는다.

```powershell
python scripts/collect_kakao_jeju_restaurant_reviews.py --output-dir data/kakao/jeju/2026-09-21/restaurants --concurrent --skip-inventory --detail-workers 2
```

후기 본문 수집 한도와 별도로 카카오맵에 표시된 방문자 후기 총수(`visitor_review_count`)와 블로그 리뷰 총수(`blog_review_count`)를 저장한다. `collected_review_count`는 실제 저장한 후기 본문 개수다. 예를 들어 방문자 후기 98건인 장소에서 본문 5건을 저장하면 각각 98과 5로 기록한다. 숫자가 확인되지 않으면 0으로 추정하지 않고 빈 값으로 둔다. 검색 관찰값과 상세 관찰값은 각 파일의 `collected_at` 시점을 따른다.

`review_status=not_provided`는 매장주 요청으로 후기 미제공 안내를 확인했다는 뜻이며 후기 0건과 다르다. 이때 방문자 후기 총수와 평점은 빈 값이다. 숨겨진 검색 DOM의 기본 숫자 `(30)`은 수집하지 않는다. 2026-09-29 수정 이전 데이터의 해당 값은 상세 미제공 확인 시 정정하므로 아직 상세 방문하지 않은 기존 레코드의 숫자는 검증 중이다. 수정 전 DB는 `collection-before-review-fix-20260929.sqlite3`에 보존했다.

상세 방문에서는 운영시간을 먼저 확인하고 후기를 수집한다. 영업시간·휴무일·브레이크타임·라스트오더 원문을 `business_hours.csv`와 SQLite 부가 테이블에 저장한다. 이미 저장된 식당도 운영시간 확인 기록이 없으면 상세 방문 대상에 포함된다. 후기 수집이 실패해도 앞서 확인한 운영시간은 보존한다.

같은 명령과 같은 출력 폴더로 재실행하면 미완료 검색·상세만 이어서 처리한다. 리뷰 설정·지역 범위·페이지 상한이 달라졌으면 새 폴더를 사용해야 한다. 날짜가 바뀌어도 이어서 수집하려면 기존 `--output-dir`을 명시한다.

- `--inventory-only`: 장소 검색만 실행한다.
- `--concurrent`: 검색과 상세를 동시에 진행한다. 최대 브라우저 2개이며 요청 대기, 실패 시 대기와 접근 제한 중단을 유지한다.
- `--detail-workers 2`: `--concurrent --skip-inventory`와 함께 사용하며 상세용 브라우저 2개를 실행한다. `--max-places`는 두 브라우저 합산 한도다.
- `--skip-inventory`: 이미 모은 장소의 미완료 상세만 처리한다.
- `--max-places 2`: 이번 실행에서 미완료 음식점 2곳만 상세 방문한다.
- `--place-id 20031551`: 이미 저장된 특정 식당만 상세 확인한다. 여러 번 지정할 수 있다. 표본 수집에 쓰며 전체 검색 계획은 유지한다.
- `--max-queries 1`: 이번 실행에서 검색어 1개만 처리한다. 남은 검색은 pending이다.
- `--max-regions 1 --max-pages 2`: 제한된 표본이며 전체 수집 결과가 아니다.
- `--max-reviews 0`: 리뷰 본문 수집 제외. `--max-reviews -1`: 공개 후기 전체 로딩을 시도한다. 기본 5건보다 훨씬 오래 걸린다.

## 진행 확인과 일시 정지

실행 중에는 출력 폴더의 `manifest.json`과 로그를 읽는다. 숨김 실행의 현재 PID와 로그 경로는 `runner.json`에 기록한다. 최초 실행 로그는 `run.log`, 운영시간 확장 후 로그는 `run-with-hours.log`다. 동시 실행은 파일 잠금으로 막는다. `collection.sqlite3`가 기준이며 CSV는 배치/검색 체크포인트에서 갱신된다. manifest의 `updated_at`과 `exported_at`을 구별한다.

병행 모드도 수집기 프로세스는 하나다. 페이지와 운영시간 저장을 확인한 뒤 다음 작업으로 넘어가며 manifest는 약 10초마다, CSV 전체는 완료 작업 20개마다와 종료 시 갱신한다. 재개 로그 이름은 `run-resume-*` 또는 `run-concurrent-*`이며 실제 현재 파일은 `runner.json`을 따른다.

출력 폴더에 `STOP`이라는 빈 파일을 만들면 다음 안전한 체크포인트에서 저장하고 종료한다. 콘솔의 Ctrl+C도 저장 후 종료한다. 재개할 때는 직접 `STOP` 파일을 삭제한 뒤 같은 명령을 실행한다. 실행 중인 Chrome 전체나 다른 수집 프로세스를 강제 종료하지 않는다.

수집기가 종료된 뒤 CSV와 현황을 DB에서 다시 만들려면 다음을 실행한다.

```powershell
python scripts/collect_kakao_jeju_restaurant_reviews.py --output-dir data/kakao/jeju/2026-09-21/restaurants --status
```

## 산출물과 상태

| 파일 | 내용 |
|---|---|
| `places.csv` | 포함된 음식점 고유 ID, 이름, 주소, 업종, 평점/후기 수의 관찰값, 출처와 발견 시각 |
| `excluded_places.csv` | 카페 등 제외·비제주·업종 불명·주소 불명과 사유 |
| `queries.csv` | 지역별 검색어, 페이지 수, 노출/표시 건수, 상태, 실패 이유 |
| `reviews.csv` | 장소 ID, 별점, 작성일, 본문, 태그, 좋아요, 출처와 수집 시각 |
| `place_review_summary.csv` | 상세 확인 시각·상태와 최대 5개 후기 요약 |
| `business_hours.csv` | 운영시간 확인 상태, 영업시간·휴무·휴게시간·라스트오더, 날짜/요일 원문, 출처 URL·확인 시각 |
| `collection.sqlite3` | 장소·검색·발견 관계·리뷰와 재개 상태의 기준 DB |
| `manifest.json` | 건수, 실행 상태, 설정, 원본/신규 코드 해시와 한계 |

실행 상태 `inventory_running`/`details_running`/`concurrent_running`은 진행 중, `paused`는 중단 요청, `failed`는 실행 실패, `partial`은 남은 작업/실패 존재다. `inventory_finished`는 검색 계획만 끝난 상태이며 후기는 아직 없을 수 있다. `finished_search_scope`는 예약한 검색과 발견한 음식점 상세 처리 완료를 뜻한다.

개별 검색 `truncated`는 표시된 건수보다 공개 페이지에서 얻은 결과가 적거나 페이지 상한에 도달했다는 뜻이다. 하위 검색으로 보완해도 등록된 모든 음식점의 전수성을 증명하지 못하므로 `all_jeju_restaurants_guaranteed`는 항상 `false`다. 실패·0건·요청한 만큼의 리뷰 스냅샷을 서로 구분하며 접근 제한을 우회하지 않는다.

이 데이터는 기존 지도/추천 DB에 자동 반영하거나 공개 배포하지 않는다.

운영시간 `status=available`은 정보 기재, `not_provided`는 명시적 미등록 안내 확인, `unrecognized`는 화면/파싱 미확인이다. 미확인을 휴무나 24시간 영업으로 바꾸지 않는다. `opening_hours`, `closed_days`, `break_time`, `last_order`는 표시된 날짜·요일 문구를 그대로 담고, `schedule_json`은 `label`과 `details` 배열의 원문이다. 표시된 일주일의 일정이 매주 반복된다고 가정하지 않는다. `hours_text`는 운영시간 영역의 원문, `source_url`은 카카오맵 상세 링크, `checked_at`은 확인 시각이다.

manifest의 `hours_checked_count`는 기재 또는 명시적 미등록을 확인한 수다. `business_hours`에는 상태별 수, `hours_pending_count`에는 아직 방문하지 않았거나 미확인인 수가 남는다. 모든 예약 검색·상세·운영시간 확인이 끝나기 전에는 전체 완료로 표시하지 않는다.

## 조회용 DB 저장과 복원

[SPEC-103](spec_103.md)은 재개용 원본 DB를 유지하면서 canonical JSONL·v1 SQLite를 생성한다. [SPEC-104](spec_104.md)는 같은 JSONL에서 중복 JSON을 제외한 **현재 조회용 v2 DB**를 생성한다. 카탈로그 작업에는 Python 3.11 이상, SQLite 3.37 이상이 필요하며 Python 표준 라이브러리만 사용한다. 파일·필드·상태의 정본은 [데이터 계약](data_contracts.md#음식점-정본조회용-카탈로그--구현됨), [v1 스키마](../config/restaurant_catalog.v1.sql), [v2 조회 스키마](../config/restaurant_catalog.v2.sql)다.

이미 v1 JSONL이 있으면 다음 명령으로 조회 DB를 생성·검증한다:

```powershell
python scripts/build_restaurant_query_db.py
python scripts/validate_restaurant_query_db.py
```

기본 정본 입력은 `data/catalogs/jeju/2026-09-21/restaurant-catalog-v1/`, 조회 출력은 같은 날짜의 `restaurant-catalog-v2/`다. 새 폴더에는 `restaurants.sqlite3`와 `manifest.json`만 생성하며 JSONL은 복제하지 않는다. v1의 raw_json/source_json을 제외한 컬럼은 모두 유지한다. 원관측은 정본 JSONL로 확인한다. 기존 v1 DB는 비교·복구용으로 보존하므로 총 디스크 사용량을 줄이는 삭제 작업은 수행하지 않는다.

2026-10-06 실제 v2 DB는 **55,853,056 bytes**로, v1 215,818,240 bytes에서 **74.12% 감소**했다. 모든 유지 컬럼·레코드 해시가 v1과 같고 원본·정본 파일 해시가 바뀌지 않았으며 전체 재구축도 같은 논리 digest를 생성했다.

정본부터 생성해야 할 때 사용하는 기존 v1 명령도 유지한다:

```powershell
python scripts/build_restaurant_catalog.py
python scripts/validate_restaurant_catalog.py
```

v1 기본 입력은 `data/kakao/jeju/2026-09-21/restaurants/collection.sqlite3`, 출력은 `data/catalogs/jeju/2026-09-21/restaurant-catalog-v1/`다. 출력 폴더에는 `places.jsonl`, `reviews.jsonl`, `business_hours.jsonl`, `collection_issues.jsonl`, `restaurants.sqlite3`, `manifest.json`이 생긴다. 원본은 일관된 읽기 전용 snapshot에서 읽고 출력은 임시 폴더에서 검증한 후 게시한다. 두 버전 모두 같은 입력의 재실행은 기존 결과를 검증해 재사용한다. 다른 입력이나 불완전한 출력 폴더가 있으면 새 `--output-dir`을 지정한다.

2026-10-06 저장·검증한 스냅샷은 식당 13,561곳, 후기 44,156건이다. 상세 완료 13,525곳·실패 36곳, 운영시간 기재 10,672곳·명시적 미등록 2,777곳·미확인 80곳·미수집 32곳을 그대로 보존한다. 43개 구역의 예약 검색 1,698개는 done 1,480개·truncated 218개이며 전체 등록 식당의 전수성을 보증하지 않는다. 카탈로그 검증 완료는 수집 미확인 항목의 해결을 뜻하지 않는다.

조회 예:

```sql
SELECT p.canonical_id, p.title, p.address,
       p.visitor_review_count, p.visitor_review_count_status,
       p.collected_review_count, h.status AS hours_status,
       h.opening_hours, h.checked_at
FROM places AS p
JOIN business_hours AS h USING (canonical_id)
ORDER BY p.source_order
LIMIT 20;
```

Git에는 수집/변환/검증 코드, SQL, 문서와 작은 manifest만 저장한다. 원본 DB·백업·CSV·로그 및 canonical JSONL·조회용 SQLite는 `.gitignore`로 제외한다. 실제 데이터는 현재 PC에 있으며 외부 백업은 아직 지정되지 않았다. 다른 PC에서는 원본 수집 DB 또는 canonical JSONL 4개와 `manifest.json`을 별도로 복사해야 한다. 사용 중인 원본 DB를 백업할 때는 SQLite backup을 사용하거나 수집기를 정상 종료한 뒤 일관된 파일을 복사한다.

SQLite 파일 없이 canonical 파일만으로 새 폴더에 복원할 수 있다:

```powershell
python scripts/validate_restaurant_catalog.py C:/data/restaurant-exchange --jsonl-only
python scripts/build_restaurant_query_db.py --canonical-dir C:/data/restaurant-exchange --output-dir C:/data/restaurant-restored
python scripts/validate_restaurant_query_db.py C:/data/restaurant-restored --canonical-dir C:/data/restaurant-exchange
```

두 폴더를 같은 상대 위치로 복사하면 v2 manifest에 기록된 정본 위치로 검증한다. 정본을 다른 곳으로 옮겼으면 `--canonical-dir`로 위치를 지정한다. Git에서 받은 manifest만으로 실제 데이터를 복원할 수는 없다.

검증기는 JSONL 전 행과 DB의 유지 컬럼·레코드 해시, 무결성·외래키·스키마·파일 해시·건수·상태를 비교한다. v2 `database_logical_sha256`은 중복 JSON을 제외한 조회 행의 해시이며 같은 v2 재구축끼리 같아야 한다. `canonical.logical_sha256`은 v1의 원관측을 포함한 전체 정본 해시다. 리뷰 개수와 본문, 영업시간은 각 출처의 관찰 시점 스냅샷이다.
