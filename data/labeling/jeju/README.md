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

## Companion·월별 적합도 파일럿

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
