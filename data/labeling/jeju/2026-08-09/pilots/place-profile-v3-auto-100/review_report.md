# 장소 프로필 v3 자동 라벨 보고서

- 상태: AI 초안 — 사람 검수 전
- 규칙 버전: `companion-month-autolabel-rules-v1`
- 기준일: 2026-08-10
- 입력 v2 프로필 SHA-256: `39e6fa8f0abfd5d4b675917c98cb3f1cacf9f5eb954d0320a704dd4294437e31`
- 웹 조사 SHA-256: `e92ff9bafd94b2bdcdda2ae04ab9930235d16147717e698fd3bfe7766d302fc6`

## 완성도

- 장소: 100건
- companion: 500/500 수치, 직접 근거 44, 보완 추론 456
- 비축제 month: 1,152/1,152 수치, 직접 근거 24, 보완 추론 1128
- 축제 month: 48/48 N/A(date-gated)

## 분포

- 검수 우선순위: {"high":16,"low":18,"medium":66}
- companion archetype: {"active_shared_ride_or_leisure":5,"beach_or_water":10,"camping":2,"festival_or_event":4,"golf_or_team_play":2,"hands_on_craft_or_education":8,"hiking_or_trail":23,"history_or_religion":8,"indoor_culture_or_performance":8,"park_picnic_or_play":2,"quiet_indoor_reading_or_meditation":4,"scenic_photo_or_light_stroll":17,"spa_or_wellness":1,"sports_spectator":1,"transport_or_ferry":3,"unresolved_generic":2}
- month archetype: {"beach_water":6,"camping_outdoor_sport":8,"coast_photo":15,"festival_na":4,"forest_hike":18,"hot_spring":1,"indoor_neutral":12,"mixed_neutral":25,"outdoor_neutral":11}
- companion 추론 수준: {"archetype_prior":357,"direct_evidence":44,"researched_inference":99}
- month 추론 수준: {"archetype_prior":144,"climate_heuristic":984,"direct_evidence":24,"not_applicable":48}

## 해석 주의

- v2의 웹 조사 facts는 그대로 보존했다. v2 수치도 실제 직접 근거에 매핑되는지 다시 검증하고, 나머지 축은 archetype·조사 사실·기후 규칙으로 완성했다.
- prior와 기후 휴리스틱은 직접 추천 문장이 아니며, UI에서 근거 수준을 구분해 표시한다.
- 예약·연령·인원·기상·운영 조건은 점수와 별도 hard constraint다. 높은 적합도가 조건을 상쇄하지 않는다.
- 월 적합도는 평년의 정상 운영을 가정하며 실시간 예보가 아니다. 축제는 개최일이 확정된 뒤 날짜 필터로 처리한다.
