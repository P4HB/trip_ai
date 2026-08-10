# 제주 장소 라벨링 입력 데이터

제주 TourAPI 기본 장소 스냅샷을 음식점과 비음식점으로 분리한 파생 데이터다. 원본은 `data/tourapi/jeju/YYYY-MM-DD/jeju_places.json`에 그대로 유지한다.

## 파일 구성

```text
YYYY-MM-DD/
  restaurants.json
  non_restaurants.json
  manifest.json
```

- `restaurants.json`: TourAPI `contenttypeid`가 `39`인 음식점
- `non_restaurants.json`: 관광지, 문화시설, 축제·공연·행사, 여행코스, 레포츠, 숙박, 쇼핑
- `manifest.json`: 원본 스냅샷, 분리 규칙, 건수, 무결성 정보와 파일 해시

초기 일반 장소 적합도 라벨링 대상은 `non_restaurants.json`이다. 음식점 데이터는 별도 라벨 체계가 정해질 때까지 `restaurants.json`에 보존한다. 이 분리는 추천·랭킹이나 실제 라벨 값을 만들지 않는다.

좌표는 분리 조건이 아니며 제목, 주소, 좌표가 같아도 `contentid`가 다르면 별도 장소로 유지한다.

## 다시 생성하기

저장소 루트에서 실행한다.

```powershell
node scripts/split_tourapi_jeju_places.mjs
```

스크립트는 가장 최신 날짜의 TourAPI 스냅샷을 선택한다. 빈·중복 `contentid`, 빈 `contenttypeid` 또는 지원하지 않는 장소 유형을 발견하면 출력하지 않고 오류로 종료한다.

## Companion·월별 적합도 파일럿 v1

100건 AI 초안은 다음 위치에 있다.

```text
2026-08-09/pilots/place-profile-v1-100/
  selection_ids.json
  research/part_*.json
  research/targeted_sources.json
  place_profiles.json
  manifest.json
  review_report.md
```

`place_profiles.json`은 데이터베이스를 변경하지 않는 `contentid` 기반 sidecar다. 관광지 68, 문화시설 12, 축제 4, 레포츠 16건을 포함하며 모든 항목은 사람 검수 전 상태다. 최종 프로필 10건에만 장소별 상세·공식 출처가 연결되어 있고, 나머지는 낮은 신뢰도의 분류 사전값이므로 운영용 골드 라벨로 사용하지 않는다.

원시 조사 조각을 다시 통합하고 검증하려면 다음을 실행한다.

```powershell
node scripts/build_place_profile_pilot.mjs
node scripts/validate_place_profile_pilot.mjs
```

## 장소별 웹 조사 v2

v3 자동 가중치의 사실 근거는 같은 100건을 장소별로 조사한 다음 경로다.

```text
2026-08-09/pilots/place-profile-v2-100/
  research/web_pages.json
  research/part_*.json
  place_web_research.json
  place_profiles.json
  manifest.json
  review_report.md
```

100개 장소 모두 공개 관광 상세 페이지를 실제로 열어 URL·본문 사실·안내 항목·페이지 해시를 보존했다. 공통 확인 페이지인 K-TRIP TIPS는 2차 관광 상세 자료이며, 운영시간·휴무·가격 같은 변동 정보는 사람 검수 시 링크에서 다시 확인한다. v2 역시 AI 초안이라 운영용 골드 라벨이 아니다.

캐시된 조사 입력을 다시 병합하고 검증하려면 다음을 실행한다. 웹 페이지 재수집은 외부 내용이 바뀔 수 있으므로 명시적으로 조사 스냅샷을 갱신할 때만 별도로 실행한다.

```powershell
node scripts/build_place_profile_research_v2.mjs
node scripts/validate_place_profile_research_v2.mjs
```

## 자동 가중치 v3

현재 사람 검수 기준은 v2 조사 결과의 빈 라벨을 장소 경험 유형과 기상청 1991~2020 제주 기후평년 규칙으로 보완한 다음 경로다.

```text
2026-08-09/pilots/place-profile-v3-auto-100/
  climate_baseline.json
  scoring/assignments_part_*.json
  scoring/archetype_assignments.json
  scoring/companion_profiles.json
  scoring/month_profiles.json
  auto_label_proposals.json
  place_profiles.json
  manifest.json
  review_report.md
```

companion 500축과 축제가 아닌 96건의 month 1,152축은 모두 AI 제안 수치가 있다. 축제 4건의 month 48축만 개최일 종속 `N/A`이며 사용자가 채울 미정값이 아니다. `auto_label_proposals.json`에는 각 축의 근거 수준·신뢰도·설명·규칙 ID가 있고, `place_profiles.json`은 같은 최종 수치를 편리하게 소비하는 파일이다.

월별 사전값의 고정 입력은 `data/climate/kma/1991-2020/jeju_four_station_monthly_normals.json`이다. 빌드는 기상청 PDF에서 추출한 제주·고산·성산·서귀포 4지점 월표와 canonical SHA-256을 확인한 뒤 기후 baseline과 month profile을 파생한다.

v3도 사람 검수 전 AI 초안이다. 예약·최소 인원·기상·운영·이동 조건은 `hard_constraints`에서 먼저 확인하고 fit 점수로 상쇄하지 않는다. 낮음·중간 우선순위 일괄 승인은 각각의 확인 모달 뒤 정적 검수 화면의 사람 상태만 변경하며 데이터베이스나 AI 원본을 수정하지 않는다. 높은 우선순위는 개별 검수한다.

다시 생성하고 검증하려면 다음을 실행한다.

```powershell
node scripts/build_place_profile_autolabel_v3.mjs
node scripts/validate_place_profile_autolabel_v3.mjs
node scripts/build_labeling_review_ui.mjs
node scripts/validate_labeling_review_ui.mjs
node scripts/test_labeling_review_model.mjs
```

## 비음식점 전체 장소 프로필 v1

SPEC-007이 생성한 비음식점 1,434건 전체 AI 초안은 다음 위치에 있다.

```text
2026-08-09/full/place-profile-v1-all-1434/
  research/web_pages.jsonl
  place_web_research.jsonl
  auto_label_proposals.jsonl
  review_queue.jsonl
  hard_constraints.jsonl
  place_profiles.sqlite3
  manifest.json
  review_report.md
```

- 조사 상태 `matched`: 1,434건
- companion: 7,170축
- 비축제 month 수치: 16,872축
- 축제 month N/A: 336축
- hard constraint: 1,518건
- 논리 DB digest: `795010641f53664d4bfbd1164c1193168aa053370e45ec9a5aebd8ef78c6e517`

canonical JSONL이 정본 교환 형식이고 `place_profiles.sqlite3`는 같은 레코드의 로컬 읽기·질의용 파생물이다. 전체 데이터도 사람 검수 전 `ai_draft`이며, 직접 근거는 전체 24,378축 중 82축뿐이다. 운영 추천 입력이나 골드 라벨로 승격하지 않는다.

기존 성공 cache를 확인하고 현재 산출물을 검증하려면 다음을 실행한다.

```powershell
node scripts/fetch_all_place_web_pages.mjs --dry-run
python scripts/validate_all_place_profiles.py
```

현재 cache는 1,434건 모두 성공해 `to_fetch=0`이다. `--refresh`는 외부 페이지를 전건 재조회해 조사 snapshot을 바꾸므로 명시적인 새 조사 run을 만들 때만 사용한다. canonical 산출물을 다시 만들 때는 고정 cache와 입력을 사용해 다음을 실행한다.

```powershell
python scripts/build_all_place_profiles.py
python scripts/validate_all_place_profiles.py
```
