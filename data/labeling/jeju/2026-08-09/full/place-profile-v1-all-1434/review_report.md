# 제주 비음식점 전체 장소 프로필 빌드 보고서

- 상태: `ai_draft`
- 알고리즘: `full-place-autolabel-rules-v1`
- 장소: 1,434건
- 파일럿 회귀 앵커: 100건
- companion 수치: 7,170/7,170
- 비축제 month 수치: 16,872/16,872
- 축제 month N/A: 336/336
- hard constraint: 1,518건
- 입력 digest: `5c262d088756d381c5718dda57eb100439b8604f572cbff5c840092a6e4e853a`
- 논리 DB digest: `795010641f53664d4bfbd1164c1193168aa053370e45ec9a5aebd8ef78c6e517`

## 분포

- 유형: `{"12":566,"14":97,"15":28,"28":137,"32":209,"38":397}`
- 조사 상태: `{"matched":1434}`
- 검수 우선순위: `{"high":40,"low":575,"medium":819}`
- 추론 수준: `{"archetype_prior":501,"climate_heuristic":16704,"direct_evidence":82,"not_applicable":336,"researched_inference":6755}`
- archetype: `{"active_shared_ride_or_leisure":37,"beach_or_water":37,"camping":22,"festival_or_event":28,"golf_or_team_play":12,"hands_on_craft_or_education":67,"hiking_or_trail":162,"history_or_religion":61,"indoor_culture_or_performance":87,"park_picnic_or_play":101,"quiet_indoor_reading_or_meditation":10,"scenic_photo_or_light_stroll":149,"shopping_visit":397,"spa_or_wellness":6,"sports_spectator":1,"stay":209,"transport_or_ferry":26,"unresolved_generic":2,"water_sport_caution":20}`

## 해석 주의

- 모든 값은 사람 검수 전 AI 초안이다.
- 숙박은 숙박 경험, 쇼핑은 관광 중 쇼핑 방문 경험 범위다.
- 운영시간·휴무·가격·객실 재고·행사일은 확인 시점의 참고 정보이며 hard constraint로 다시 확인한다.
- uncertain/not_found 장소는 수치 fallback을 유지하되 confidence 0.25와 high 우선순위다.
- `contentid=2704351`은 삭제하지 않았고 좌표 이상과 high 우선순위를 유지한다.
