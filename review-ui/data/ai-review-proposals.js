window.TRIP_AI_REVIEW_PROPOSALS = Object.freeze({
  "schema_version": "place-label-ai-review-ui-data-v1",
  "snapshot_date": "2026-08-09",
  "checked_at": "2026-08-10T23:16:16+09:00",
  "method_version": "priority1-web-v1",
  "dataset_fingerprint": "5f2e9fea572b98f592cc742fdc17101c9ca959490547803aa8a24860d6719a21",
  "review_dataset_fingerprint": "2026-08-09:place-preference-label-v1:place-label-rules-v1:255ea2af6b276077dc73fbdbb9dac3d1ce71313a4b56f30ebe57ff78fe28fe98:66cf25f471ee30ef36e15d77ce3b08327a0b156817cf426ef1ef2036903de9a6",
  "summary": {
    "proposal_count": 63,
    "place_count": 32,
    "source_count": 73,
    "action_counts": {
      "approve": 0,
      "override": 59,
      "keep_null": 1,
      "unresolved": 3
    }
  },
  "proposals": [
    {
      "review_key": "125445::environment.indoor_ratio",
      "contentid": "125445",
      "title": "생각하는 정원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.93,
      "rationale": "정원 산책과 야외 경관 관람이 핵심이며 실내는 부수 시설이다.",
      "limitations": [
        "식당·체험 등 별도 부대시설은 일반 정원 관람 범위에서 제외했다."
      ],
      "source_ids": [
        "tourapi:125445",
        "web:125445"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "125445::environment.weather_sensitivity",
      "contentid": "125445",
      "title": "생각하는 정원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.84,
      "rationale": "비·바람은 야외 정원 산책과 경관 관람을 크게 제한한다.",
      "limitations": [
        "공식 악천후 폐쇄 기준은 확인하지 못했다."
      ],
      "source_ids": [
        "tourapi:125445",
        "web:125445"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "126452::environment.indoor_ratio",
      "contentid": "126452",
      "title": "만장굴 (제주도 국가지질공원)",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 1,
      "confidence": 0.98,
      "rationale": "일반 관람의 핵심은 1km 동굴 내부 공개구간 탐방이다.",
      "limitations": [
        "현재 임시 폐쇄 여부는 라벨과 별도의 가용성 정보다."
      ],
      "source_ids": [
        "tourapi:126452",
        "web:126452"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "126452::environment.weather_sensitivity",
      "contentid": "126452",
      "title": "만장굴 (제주도 국가지질공원)",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.86,
      "rationale": "핵심 동굴 내부 관람은 유지되고 입구·외부 접근이 부수적으로 영향받는다.",
      "limitations": [
        "특보별 통제 기준은 공개 자료에서 확인하지 못했다."
      ],
      "source_ids": [
        "tourapi:126452",
        "web:126452"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "126464::environment.indoor_ratio",
      "contentid": "126464",
      "title": "여미지식물원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.97,
      "rationale": "대규모 외부 정원과 대표 온실 식물원이 모두 핵심 관람 구성이다.",
      "limitations": [
        "평균 체류시간의 실내외 배분은 미공개다."
      ],
      "source_ids": [
        "tourapi:126464",
        "web:126464"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "126464::environment.weather_sensitivity",
      "contentid": "126464",
      "title": "여미지식물원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.91,
      "rationale": "옥외 정원은 영향받지만 대표 온실 콘텐츠는 유지된다.",
      "limitations": [
        "악천후별 폐쇄 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:126464",
        "web:126464"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "126472::environment.indoor_ratio",
      "contentid": "126472",
      "title": "비자림",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.98,
      "rationale": "숲 산책·산림욕이 핵심인 야외 관광지다.",
      "limitations": [
        "매표소·화장실 등 편의시설은 핵심 경험에서 제외했다."
      ],
      "source_ids": [
        "tourapi:126472",
        "web:126472"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "126472::environment.weather_sensitivity",
      "contentid": "126472",
      "title": "비자림",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.72,
      "rationale": "전면 야외이지만 공식 안내는 약한 비에도 숲 산책 경험이 유지된다고 설명한다.",
      "limitations": [
        "약한 비와 호우·강풍의 영향을 단일 점수로 압축했다."
      ],
      "source_ids": [
        "tourapi:126472",
        "web:126472",
        "web:126472:rain"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "127514::environment.indoor_ratio",
      "contentid": "127514",
      "title": "한라수목원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.96,
      "rationale": "야외 수목원·산책로가 중심이지만 온실·전시실·생태학습관이 의미 있는 부분을 차지한다.",
      "limitations": [
        "실내시설별 최신 운영상태는 방문 전 재확인이 필요하다."
      ],
      "source_ids": [
        "tourapi:127514",
        "web:127514"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "127514::environment.weather_sensitivity",
      "contentid": "127514",
      "title": "한라수목원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.86,
      "rationale": "야외 정원·산림욕은 영향받지만 온실·전시실 관람은 유지될 수 있다.",
      "limitations": [
        "공식 악천후 폐쇄 기준은 미확인이다."
      ],
      "source_ids": [
        "tourapi:127514",
        "web:127514"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "127860::environment.indoor_ratio",
      "contentid": "127860",
      "title": "금능석물원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.91,
      "rationale": "야외 석조각 공원이 중심이고 동굴·암자가 제한적으로 포함된다.",
      "limitations": [
        "공식 페이지의 실내 태그와 본문의 야외 공원 설명이 일부 충돌한다."
      ],
      "source_ids": [
        "tourapi:127860",
        "web:127860"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "127860::environment.weather_sensitivity",
      "contentid": "127860",
      "title": "금능석물원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.82,
      "rationale": "핵심 조각·정원 관람이 야외이므로 비·바람에 크게 영향받는다.",
      "limitations": [
        "우천 운영 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:127860",
        "web:127860"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "129276::environment.indoor_ratio",
      "contentid": "129276",
      "title": "숨도",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.94,
      "rationale": "생태정원·오솔길이 중심이고 석부작·분재 실내전시와 카페가 보조한다.",
      "limitations": [
        "실내외 체류시간 비율은 미공개다."
      ],
      "source_ids": [
        "tourapi:129276",
        "web:129276",
        "web:129276:rain"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "129276::environment.weather_sensitivity",
      "contentid": "129276",
      "title": "숨도",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.7,
      "rationale": "공식 장마 콘텐츠는 보통 비에도 정원 경험이 유지된다고 설명하지만, 야외 오솔길은 강풍·폭우·기온에 영향받고 실내 전시는 일부 대안만 제공한다.",
      "limitations": [
        "태풍·폭우·강풍별 통제 기준은 확인하지 못했다."
      ],
      "source_ids": [
        "tourapi:129276",
        "web:129276",
        "web:129276:rain"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "129619::environment.indoor_ratio",
      "contentid": "129619",
      "title": "협재동굴",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.92,
      "rationale": "개별 POI의 핵심은 동굴 내부 관람이지만 한림공원 내 야외 접근 동선이 필요하다.",
      "limitations": [
        "한림공원 전체와 개별 동굴 POI의 범위를 구분했다."
      ],
      "source_ids": [
        "tourapi:129619",
        "web:129619"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "129619::environment.weather_sensitivity",
      "contentid": "129619",
      "title": "협재동굴",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.86,
      "rationale": "동굴 내부 관람은 유지되고 공원 내 야외 접근만 부수적으로 영향받는다.",
      "limitations": [
        "우천 휴장 기준은 확인하지 못했다."
      ],
      "source_ids": [
        "tourapi:129619",
        "web:129619"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "129620::environment.indoor_ratio",
      "contentid": "129620",
      "title": "쌍용굴(한림공원)",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.92,
      "rationale": "개별 POI의 핵심은 동굴 내부 관람이지만 한림공원 내 야외 접근 동선이 필요하다.",
      "limitations": [
        "협재굴과 쌍용굴은 서로 다른 contentid이므로 별도 판정했다."
      ],
      "source_ids": [
        "tourapi:129620",
        "web:129620"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "129620::environment.weather_sensitivity",
      "contentid": "129620",
      "title": "쌍용굴(한림공원)",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.86,
      "rationale": "동굴 내부 관람은 유지되고 공원 내 야외 접근만 부수적으로 영향받는다.",
      "limitations": [
        "우천 휴장 기준은 확인하지 못했다."
      ],
      "source_ids": [
        "tourapi:129620",
        "web:129620"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "741109::environment.indoor_ratio",
      "contentid": "741109",
      "title": "카멜리아힐",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.95,
      "rationale": "동백숲·정원·전망대 순환 관람이 본체이고 온실·갤러리·카페가 보조한다.",
      "limitations": [
        "실내외 면적·체류시간 비율은 미공개다."
      ],
      "source_ids": [
        "tourapi:741109",
        "web:741109"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "741109::environment.weather_sensitivity",
      "contentid": "741109",
      "title": "카멜리아힐",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.85,
      "rationale": "핵심 숲길·정원 관람이 야외라 비·바람·시야에 크게 영향받는다.",
      "limitations": [
        "공식 악천후 통제 기준은 확인하지 못했다."
      ],
      "source_ids": [
        "tourapi:741109",
        "web:741109"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "802844::environment.indoor_ratio",
      "contentid": "802844",
      "title": "한라생태숲",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.98,
      "rationale": "숲·탐방로·트레킹·야생생물 관찰이 핵심인 야외 장소다.",
      "limitations": [
        "안내·관리 건물은 핵심 경험에서 제외했다."
      ],
      "source_ids": [
        "tourapi:802844",
        "web:802844"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "802844::environment.weather_sensitivity",
      "contentid": "802844",
      "title": "한라생태숲",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.98,
      "rationale": "야외 탐방로가 핵심이며 강풍주의보 등 기상특보 시 실제 통제 사례가 있다.",
      "limitations": [
        "통제 공지는 특정 특보 사례며 모든 날씨의 상시 정책표는 아니다."
      ],
      "source_ids": [
        "tourapi:802844",
        "web:802844",
        "web:802844:weather"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2479639::environment.indoor_ratio",
      "contentid": "2479639",
      "title": "제주불빛정원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.85,
      "rationale": "야간 야외 불빛정원이 핵심이고 실내 사진관·카페·VR이 의미 있는 보조 경험이다.",
      "limitations": [
        "실내외 면적·체류시간 비율은 미공개다."
      ],
      "source_ids": [
        "tourapi:2479639",
        "web:2479639"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2479639::environment.weather_sensitivity",
      "contentid": "2479639",
      "title": "제주불빛정원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.75,
      "rationale": "야외 LED 정원 산책과 사진 촬영이 핵심이고 TourAPI는 악천후 시 조기폐장 가능성을 안내한다.",
      "limitations": [
        "강우·강풍별 상세 휴장 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:2479639",
        "web:2479639"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2562214::environment.indoor_ratio",
      "contentid": "2562214",
      "title": "신화테마파크",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.85,
      "rationale": "대부분의 놀이기구·공연이 야외이고 우천 운영 가능 어트랙션은 일부에 그친다.",
      "limitations": [
        "시즌별 실제 운영 어트랙션은 바뀔 수 있다."
      ],
      "source_ids": [
        "tourapi:2562214",
        "web:2562214",
        "web:2562214:rain_rides"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2562214::environment.weather_sensitivity",
      "contentid": "2562214",
      "title": "신화테마파크",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.9,
      "rationale": "공식 FAQ가 우천 시 일부 어트랙션 제한·공연 취소와 악화 시 단축·휴장 가능성을 안내한다.",
      "limitations": [
        "약한 비에는 일부 운영이 유지된다."
      ],
      "source_ids": [
        "tourapi:2562214",
        "web:2562214",
        "web:2562214:weather"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2562239::environment.indoor_ratio",
      "contentid": "2562239",
      "title": "신화워터파크",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.95,
      "rationale": "실내 7개와 실외 11개 어트랙션이 모두 핵심 워터파크 경험을 구성한다.",
      "limitations": [
        "실외 시설은 주로 5~9월에만 운영하여 계절별 비중이 다르다."
      ],
      "source_ids": [
        "tourapi:2562239",
        "web:2562239"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2562239::environment.weather_sensitivity",
      "contentid": "2562239",
      "title": "신화워터파크",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.85,
      "rationale": "우천에도 운영하지만 실외 시설은 영향받고, 기상 악화 시 단축·휴장할 수 있으며 연중 실내 시설 일부는 유지된다.",
      "limitations": [
        "일반 비와 운영 중단 수준의 악천후를 단일 점수로 압축했다."
      ],
      "source_ids": [
        "tourapi:2562239",
        "web:2562239",
        "web:2562239:weather"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2738721::environment.indoor_ratio",
      "contentid": "2738721",
      "title": "미천굴",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.93,
      "rationale": "미천굴 내부 365m 관람과 미디어아트가 핵심이고 일출랜드 야외 접근·주변시설이 함께 있다.",
      "limitations": [
        "미천굴 개별 POI와 일출랜드 전체의 범위를 구분했다."
      ],
      "source_ids": [
        "tourapi:2738721",
        "web:2738721"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2738721::environment.weather_sensitivity",
      "contentid": "2738721",
      "title": "미천굴",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.68,
      "rationale": "핵심 동굴 내부 관람은 유지되고 일출랜드 안의 야외 접근 동선만 부수적으로 영향받는다.",
      "limitations": [
        "우천 휴장·침수 통제 정책은 확인하지 못했다."
      ],
      "source_ids": [
        "tourapi:2738721",
        "web:2738721"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2738730::environment.indoor_ratio",
      "contentid": "2738730",
      "title": "화순곶자왈 생태탐방숲길",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.95,
      "rationale": "세 개 숲길 탐방 코스·산책로·전망대의 야외 경험이 전체다.",
      "limitations": [
        "안내소·정자는 핵심 관람에서 제외했다."
      ],
      "source_ids": [
        "tourapi:2738730",
        "web:2738730"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2738730::environment.weather_sensitivity",
      "contentid": "2738730",
      "title": "화순곶자왈 생태탐방숲길",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.85,
      "rationale": "야외 숲길 보행과 전망이 핵심이며 악천후 시 같은 숲길의 공식 예약 프로그램도 취소될 수 있다.",
      "limitations": [
        "취소 문구는 자유 탐방이 아닌 사운드워킹 프로그램에 해당한다."
      ],
      "source_ids": [
        "tourapi:2738730",
        "web:2738730",
        "web:2738730:program"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2738734::environment.indoor_ratio",
      "contentid": "2738734",
      "title": "상효원수목원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.95,
      "rationale": "8만 평 테마정원·곶자왈 관람이 중심이고 카페·갤러리·돔은 보조한다.",
      "limitations": [
        "실내외 면적·체류시간 비율은 미공개다."
      ],
      "source_ids": [
        "tourapi:2738734",
        "web:2738734"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2738734::environment.weather_sensitivity",
      "contentid": "2738734",
      "title": "상효원수목원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.85,
      "rationale": "야외 테마정원 관람이 핵심이라 비·바람·기온에 크게 영향받는다.",
      "limitations": [
        "전면 우천 운영 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:2738734",
        "web:2738734"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2753082::environment.indoor_ratio",
      "contentid": "2753082",
      "title": "파더스가든",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.95,
      "rationale": "정원·동물농장·감귤따기 등 야외 경험이 본체이고 카페 등 실내는 보조한다.",
      "limitations": [
        "실내외 체류시간 비율은 미공개다."
      ],
      "source_ids": [
        "tourapi:2753082",
        "web:2753082"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2753082::environment.weather_sensitivity",
      "contentid": "2753082",
      "title": "파더스가든",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.98,
      "rationale": "야외 체험이 핵심이고 공식 안내가 기상변화에 따른 입장 제한 가능성을 명시한다.",
      "limitations": [
        "실내 보조 체험은 일부 유지될 수 있다."
      ],
      "source_ids": [
        "tourapi:2753082",
        "web:2753082"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2765245::environment.indoor_ratio",
      "contentid": "2765245",
      "title": "송악산 진지동굴",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.99,
      "rationale": "내부 진입이 금지되어 현재 방문 경험은 해안가에서 바라보는 야외 관람이다.",
      "limitations": [
        "내부 입장 금지는 별도의 가용성 하드 제약이다."
      ],
      "source_ids": [
        "tourapi:2765245",
        "web:2765245"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2765245::environment.weather_sensitivity",
      "contentid": "2765245",
      "title": "송악산 진지동굴",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.9,
      "rationale": "해안가 야외 전망이 핵심이므로 비·강풍·시야에 크게 영향받는다.",
      "limitations": [
        "현재 출입 통제 상태는 방문 전 재확인이 필요하다."
      ],
      "source_ids": [
        "tourapi:2765245",
        "web:2765245"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2767778::environment.indoor_ratio",
      "contentid": "2767778",
      "title": "황우지해안열두굴",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "unresolved",
      "proposed_value": null,
      "confidence": null,
      "rationale": "exact 공식 자료가 해안 인공굴의 존재·규모는 설명하지만 방문객의 내부 출입 범위를 명시하지 않아 핵심 경험의 실내 비중을 확정할 수 없다.",
      "limitations": [
        "별도 황우지해안의 현재 통제를 열두굴의 상시 출입 규칙으로 전이하지 않았다."
      ],
      "source_ids": [
        "tourapi:2767778",
        "web:2767778"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2767778::environment.weather_sensitivity",
      "contentid": "2767778",
      "title": "황우지해안열두굴",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.82,
      "rationale": "공식 자료가 열두굴을 해안에 노출된 역사·경관 장소로 설명해 비·바람·시야가 핵심 관람 품질에 큰 영향을 준다.",
      "limitations": [
        "정확한 관람 구간과 공식 우천·강풍 통제 기준은 확인하지 못했다."
      ],
      "source_ids": [
        "tourapi:2767778",
        "web:2767778"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2791430::environment.indoor_ratio",
      "contentid": "2791430",
      "title": "불란지야시장",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.85,
      "rationale": "여러 식당이 있지만 공식 설명이 실내보다 야외 테이블 공간을 핵심 매력으로 지목한다.",
      "limitations": [
        "개별 점포의 실내 좌석 비율은 미공개다."
      ],
      "source_ids": [
        "tourapi:2791430",
        "web:2791430"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2791430::environment.weather_sensitivity",
      "contentid": "2791430",
      "title": "불란지야시장",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.65,
      "rationale": "인기 있는 야외 취식 경험은 제한되지만 실내 식당 이용의 의미 있는 일부는 유지된다.",
      "limitations": [
        "공식 우천 취소·휴장 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:2791430",
        "web:2791430"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2798882::environment.weather_sensitivity",
      "contentid": "2798882",
      "title": "제주 우도 천진항 대합실",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "keep_null",
      "proposed_value": null,
      "confidence": 0.95,
      "rationale": "공식 조사는 완료됐지만 실내 대합실 건물의 날씨 영향과 필수 선박 접근의 기상 의존성이 서로 다른 값을 지지해 현재 단일 필드에는 null이 타당하다.",
      "limitations": [
        "장소 건물의 날씨 민감도와 선박 접근 가용성을 분리하는 데이터 계약이 필요하다."
      ],
      "source_ids": [
        "tourapi:2798882",
        "web:2798882"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2806043::environment.indoor_ratio",
      "contentid": "2806043",
      "title": "동백포레스트",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.9,
      "rationale": "동백 군락지·야외 산책·사진 촬영이 중심이고 실내 카페가 보조한다.",
      "limitations": [
        "야외·카페 체류시간 비율은 미공개다."
      ],
      "source_ids": [
        "tourapi:2806043",
        "web:2806043"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2806043::environment.weather_sensitivity",
      "contentid": "2806043",
      "title": "동백포레스트",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.8,
      "rationale": "핵심 정원 산책·사진 촬영이 야외라 비·강풍에 크게 영향받는다.",
      "limitations": [
        "공식 우천 휴장 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:2806043",
        "web:2806043"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2806115::environment.indoor_ratio",
      "contentid": "2806115",
      "title": "제주동백수목원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.9,
      "rationale": "동백숲·산책로·전망·야외 사진 촬영이 핵심이며 실내 핵심 시설이 확인되지 않았다.",
      "limitations": [
        "소규모 매표·편의시설은 있을 수 있다."
      ],
      "source_ids": [
        "tourapi:2806115",
        "web:2806115"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2806115::environment.weather_sensitivity",
      "contentid": "2806115",
      "title": "제주동백수목원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.8,
      "rationale": "야외 동백숲 산책과 사진 촬영이 핵심이라 악천후에 크게 제한된다.",
      "limitations": [
        "우천 운영 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:2806115",
        "web:2806115"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2836814::environment.indoor_ratio",
      "contentid": "2836814",
      "title": "서귀포칠십리시공원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.95,
      "rationale": "잔디·연못·산책·소풍의 야외 공원이 핵심이며 인근 기당미술관은 별도 POI라 공원 비중에 합산하지 않는다.",
      "limitations": [
        "매표·화장실 같은 부수 편의시설은 핵심 경험에서 제외했다."
      ],
      "source_ids": [
        "tourapi:2836814",
        "web:2836814",
        "web:2836814:museum"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2836814::environment.weather_sensitivity",
      "contentid": "2836814",
      "title": "서귀포칠십리시공원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.8,
      "rationale": "주요 산책·소풍·전망 경험이 야외라 악천후에 크게 영향받는다.",
      "limitations": [
        "인근 기당미술관은 별도 POI라 공원 경험의 대체 활동으로 계산하지 않았다."
      ],
      "source_ids": [
        "tourapi:2836814",
        "web:2836814",
        "web:2836814:museum"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2931257::environment.indoor_ratio",
      "contentid": "2931257",
      "title": "수목원길 야시장",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.95,
      "rationale": "4,000평 소나무숲 안의 야외 푸드트럭·산책 공간이 핵심이다.",
      "limitations": [
        "개별 판매대의 차양 구조는 핵심 실내 공간으로 보지 않았다."
      ],
      "source_ids": [
        "tourapi:2931257",
        "web:2931257"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "2931257::environment.weather_sensitivity",
      "contentid": "2931257",
      "title": "수목원길 야시장",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.8,
      "rationale": "소나무숲 야외 취식·야간 산책이 핵심이라 비·바람에 크게 영향받는다.",
      "limitations": [
        "공식 우천 취소 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:2931257",
        "web:2931257"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "3008392::environment.indoor_ratio",
      "contentid": "3008392",
      "title": "성읍녹차동굴",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.75,
      "rationale": "녹차밭·숲을 15~20분 걷는 야외 접근과 동굴 내부 자연광 촬영이 모두 핵심 경험이다.",
      "limitations": [
        "실제 동굴 내부 체류시간은 공개되지 않았고 인접 카페는 별도 시설로 제외했다."
      ],
      "source_ids": [
        "tourapi:3008392",
        "web:3008392"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "3008392::environment.weather_sensitivity",
      "contentid": "3008392",
      "title": "성읍녹차동굴",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.78,
      "rationale": "야외 보행과 자연광 사진이 상당히 영향받지만 동굴 포토스팟 일부는 유지된다.",
      "limitations": [
        "공식 우천 통제 기준은 없고 연중무휴로 안내된다."
      ],
      "source_ids": [
        "tourapi:3008392",
        "web:3008392"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "3317905::environment.indoor_ratio",
      "contentid": "3317905",
      "title": "현애원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.95,
      "rationale": "2만 평 야외 정원이 중심이고 입장 경험에 실내 카페 이용이 통합되어 있다.",
      "limitations": [
        "카페와 정원 체류시간 비율은 미공개다."
      ],
      "source_ids": [
        "tourapi:3317905",
        "web:3317905"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "3317905::environment.weather_sensitivity",
      "contentid": "3317905",
      "title": "현애원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.85,
      "rationale": "계절 꽃·정원 관람이 핵심이라 비·강풍에 크게 영향받는다.",
      "limitations": [
        "공식 악천후 휴장 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:3317905",
        "web:3317905"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "3371999::environment.indoor_ratio",
      "contentid": "3371999",
      "title": "제주동화마을",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.75,
      "rationale": "개방형 공원·14개 테마정원이 중심이고 카페·식당·상점·전시가 보조한다.",
      "limitations": [
        "복합단지의 실내외 체류 비율은 미공개이며 contentid 4026831 쇼핑 facet은 별도로 판정했다."
      ],
      "source_ids": [
        "tourapi:3371999",
        "web:3371999"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "3371999::environment.weather_sensitivity",
      "contentid": "3371999",
      "title": "제주동화마을",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.5,
      "confidence": 0.7,
      "rationale": "야외 공원은 영향받지만 카페·식당·상점·전시 등 실내 대체 경험이 의미 있게 남는다.",
      "limitations": [
        "POI를 야외 공원만으로 한정하면 0.75로 달라질 수 있다."
      ],
      "source_ids": [
        "tourapi:3371999",
        "web:3371999"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "3545719::environment.indoor_ratio",
      "contentid": "3545719",
      "title": "돌낭예술원",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0,
      "confidence": 0.9,
      "rationale": "수목·야생화·꽃밭·전망을 걷는 야외 생태예술정원이 핵심이다.",
      "limitations": [
        "소규모 매표·관리 건물은 있을 수 있다."
      ],
      "source_ids": [
        "tourapi:3545719",
        "web:3545719"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "3545719::environment.weather_sensitivity",
      "contentid": "3545719",
      "title": "돌낭예술원",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "category_ambiguous",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.8,
      "rationale": "야외 정원 산책과 바다·한라산 전망이 핵심이라 악천후에 크게 제한된다.",
      "limitations": [
        "공식 우천 운영 정책은 미확인이다."
      ],
      "source_ids": [
        "tourapi:3545719",
        "web:3545719"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "4026808::environment.indoor_ratio",
      "contentid": "4026808",
      "title": "신화테마파크",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.25,
      "confidence": 0.85,
      "rationale": "쇼핑 분류와 달리 exact TourAPI 설명과 공식 시설 페이지가 야외 어트랙션 중심의 테마파크 경험을 확인한다.",
      "limitations": [
        "같은 명칭·주소의 다른 contentid와 중복 가능성이 있어 추천 단계의 장소 중복 제거가 필요하다."
      ],
      "source_ids": [
        "tourapi:4026808",
        "web:4026808"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "4026808::environment.weather_sensitivity",
      "contentid": "4026808",
      "title": "신화테마파크",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "override",
      "proposed_value": 0.75,
      "confidence": 0.9,
      "rationale": "동일 신화테마파크의 야외 어트랙션·공연이 악천후에 크게 제한된다.",
      "limitations": [
        "약한 비에는 일부 우천 운영 어트랙션을 이용할 수 있다."
      ],
      "source_ids": [
        "tourapi:4026808",
        "web:4026808",
        "web:4026808:weather"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "4026831::environment.indoor_ratio",
      "contentid": "4026831",
      "title": "제주동화마을",
      "label": "environment.indoor_ratio",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "unresolved",
      "proposed_value": null,
      "confidence": null,
      "rationale": "공식 복합단지에는 야외 공원과 복수 실내 상점이 모두 있지만 이 쇼핑 contentid가 어느 facet을 지칭하는지 특정할 수 없다.",
      "limitations": [
        "장소 전체 값을 쇼핑 facet에 자동 복사하지 않았다."
      ],
      "source_ids": [
        "tourapi:4026831",
        "web:4026831"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    },
    {
      "review_key": "4026831::environment.weather_sensitivity",
      "contentid": "4026831",
      "title": "제주동화마을",
      "label": "environment.weather_sensitivity",
      "priority": 1,
      "queue_type": "source_conflict",
      "source_value": null,
      "action": "unresolved",
      "proposed_value": null,
      "confidence": null,
      "rationale": "야외 공원은 날씨 영향이 크고 실내 상점은 낮지만 해당 contentid의 정확한 이용 범위를 식별할 수 없다.",
      "limitations": [
        "POI facet 식별 보강이 필요하다."
      ],
      "source_ids": [
        "tourapi:4026831",
        "web:4026831"
      ],
      "proposal_stage": "ai_researched_proposal",
      "requires_human_review": true
    }
  ],
  "sources": [
    {
      "source_id": "tourapi:125445",
      "contentid": "125445",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 생각하는 정원은 자연 속에서 자기 자신을 만나고, 삶을 다시 돌아볼 수 있는 정원이다. 단순히 아름다운 정원을 감상하는 관광지가 아니다. 천천히 걷고, 머물고, 자연과 함께하는 시간 속에서 자신만의 질문과 답을 발견하는 곳이다. 이 정원은 한 사람이 60년 동안 포기하지 않고 자연과 함께 가꾸어 온 삶의 기록 위에 세워졌다. 그래서 이곳의 사유는 이론이 아니라 삶에서 태어나, 정원에서 발견되고, 다시 삶으로 이어진다. 자연을 통해 자기 자신을 만나고, 자신의 삶을 성찰하며, 다시 일상으로 나아갈 힘을 얻도록 도우려 한다. 때문에 아름다운 정원을 넘어, 사람을 자기 자신에게 돌아오게 하는 살아있는 문화유산을 지향한다. | 이용시간: 09:00~18:00 | 휴무: 연중무휴 | 체험: 맷돌커피 만들기 / 블랙푸드 통곡물 만들기 / 한국 파란나무 만들기 / 싱잉볼 명상체험 / 나무와 함께하는 힐링 프로그램 | 주차: 가능 (약 소형 40대 / 대형 20대) | 입장료: [개인] - 성인 15,000원 - 청소년/경로 13,000원 - 어린이 7,000원 [단체 (10인 이상)] - 성인 13,000원 - 청소년/경로 11,000원 - 어린이 6,000원 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "08d4aa3e44dd308313d644053bf84e7c77f389763c6ecf8472b8ba52077382a9"
    },
    {
      "source_id": "web:125445",
      "contentid": "125445",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000001191",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "1만2천 평 규모의 여러 정원과 폭포·연못·돌다리를 따라 걷는 야외 관람이 핵심임을 확인했다.",
      "failure_reason": null,
      "content_fingerprint": "2a0fa8c7e0160992872fc1a4e9ca335ad08ba5e1c18bbefbd094f6c25d232e1e"
    },
    {
      "source_id": "tourapi:126452",
      "contentid": "126452",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주시 구좌읍 김녕리에 위치하는 만장굴은 전체길이 약 7,400 m, 최대 높이 약 25 m, 최대 폭 약 18m로서 제주 세계자연유산의 한 부분인 거문오름용암동굴계(황상구 외, 2005)에 속하는 용암동굴이다. 특히 주 통로는 폭이 18m, 높이가 23m에 이르는 세계적으로도 큰 규모의 동굴이다. 전 세계에는 많은 용암동굴이 분포하지만 만장굴과 같이 수십만 년 전에 형성된 동굴로서 내부의 형태와 지형이 잘 보존되어 있는 용암동굴은 드물어서 학술적, 보전적 가치가 매우 크다. 만장굴은 동굴 중간 부분의 천장이 함몰되어 3개의 입구가 형성되어 있는데, 현재 일반인이 출입할 수 있는 입구는 제2입구이며, 1㎞만 탐방이 가능하다. 만장굴 내에는 용암종류, 용암석순, 용암유석, 용암유선, 용암선반, 용암표석 등의 다양한 용암동굴생성물이 발달하며, 특히 개방구간 끝에서 볼 수 있는 약 7.6m 높이의 용암석주는 세계에서 가장 큰 규모로 알려져 있다. (출처 : 제주도세계지질공원) | 이용시간: 09:00~18:00 (입장 마감 17:10) | 휴무: 매월 첫째 수요일 | 주차: 가능 (약 대형 60대, 소형 75대) | 입장료: [개인]- 성인 4,000원- 청소년/어린이/군인 2,000원 [단체 (10인 이상)]- 성인 3,000원- 청소년/어린이/군인 1,500원 | 주차요금: 무료 | 화장실: 있음 | 한국어안내서비스: 세계자연유산해설 / 만장굴 - 운영시간 : 10:00 ~ 16:00 (매시 정각 출발 / 1시간 소요)- 해설대상 : 탐방객 누구나 - 해설내용 : 세계자연유산 거문오름 용암동굴계의 생성 및 지질학적 특징, 만장굴 내부의 동굴생성물 소개 등",
      "failure_reason": null,
      "content_fingerprint": "2fc1b4c8fac07f4b9ca7a3835e34a09622eea747fb5d1e5c48327272b56030dc"
    },
    {
      "source_id": "web:126452",
      "contentid": "126452",
      "publisher": "제주특별자치도 세계유산본부",
      "source_type": "public_tourism",
      "url": "https://www.jeju.go.kr/jejuwnh/heritage/lavatube/manjanggul.htm",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "일반인은 제2입구를 통해 약 1km의 동굴 내부 공개구간을 탐방한다.",
      "failure_reason": null,
      "content_fingerprint": "353ab5fc3986054dc9e3c01645bc393ec6b0b3021fdb95b9f0dc9eae45a59bcd"
    },
    {
      "source_id": "tourapi:126464",
      "contentid": "126464",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 여미지식물원은 중문 관광단지 북쪽에 위치하며 1132로를 타면 쉽게 갈 수 있다. 아름다운 땅이란 뜻을 지닌 여미지식물원은 커다란 온실을 지니고 있으며, 대지 11만 2200㎡의 외부 정원과 1만 1361㎡의 실내 식물원으로 구성되어 있다. 외부 정원은 야자수와 같은 커다란 나무가 숲을 이루며, 한국, 일본, 이탈리아, 프랑스식 정원을 만들어 놓아 동, 서양의 정원을 감상할 수 있다. 총 2,300여 종의 식물이 살고 있으며, 온실 안에서는 약 절반인 1,300여 종의 식물이 살고 있다. 실내 식물원은 중앙홀과 높이가 38m인 중앙 전망탑이 있어 중문관광단지, 천제연폭포가 한눈에 들어오며 한라산과 인근 해안선 일대를 조망할 수 있음은 물론 쾌청한 날에는 국토 최남단 마라도까지 선명하게 바라볼 수 있다. 또한 다양한 테마로 꾸며진 정원을 볼 수 있는데, 신비의 정원, 꽃의 정원, 물의 정원, 선인장 정원, 열대 정원, 열대 과수원으로 이루어져 있다. 신비의 정원은 화산 암반석과 양치식물, 자생 식물들로 이루어져 있으며, 꽃의 정원은 열대 및 아열대 식물들로 조성되어 있다. 물의 정원은 연못과 습지로 조성되어 있으며, 열대 정원과 열대 과수원은 열대 과수와 식물들로 조성되어 있다. 선인장 정원은 어린 왕자에도 나오는 바오바브나무를 볼 수 있다. | 이용시간: 개장시간 09:00~18:00(매표마감 09:00~17:30)※ 온실식물원 : 18:00시까지 관람 가능※ 옥외식물원 : 일몰시까지 관람 가능※ 식물원 입장 : 17:30까지 가능※ 동절기(11월~2월) 17:00까지 입장 가능 | 휴무: 연중무휴 | 주차: 가능(약 소형 100대 / 대형 20대)요금(무료) | 입장료: [개인] - 어른 (20세 이상~65세 이하) 12,000원 - 청소년(14세 이상~19세 이하), 군경(현역병 및 전경/병장이하 계급) 8,000원 - 어린이(36개월 이상 ~13세 이하) 7,000원 - 경로(66세이상) 9,000원 [단체 (20인 이상)] - 어른 9,000원 - 청소년, 군경 6,000원 - 어린이(36개월 이상~13세 이하) 5,000원 - 경로 7,000원 [제주도민/국가유공자/참전용사/복지카드 소지자] 할인(증명서 확인) - 어른 9,000원 - 청소년 6,000원 - 경로 7,000원 - 어린이 5,000원 | 주차요금: 무료 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "863a6ff6a99ad8ec823af33acec0b94d38d93c056a2ec1303709014d4c811383"
    },
    {
      "source_id": "web:126464",
      "contentid": "126464",
      "publisher": "여미지식물원",
      "source_type": "official_place",
      "url": "https://www.yeomiji.or.kr/guide/guide_01.jsp",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "112,200㎡ 외부 정원과 11,361㎡ 실내 식물원, 온실 테마정원을 함께 운영한다.",
      "failure_reason": null,
      "content_fingerprint": "0247ece95a65c2b08c538c57a5d4830c8c65cc9499bc6f34fc4b6358f3729dd3"
    },
    {
      "source_id": "tourapi:126472",
      "contentid": "126472",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 천연기념물로 지정보호하고 있는 비자림은 448,165㎡의 면적에 500∼800년생 비자나무 2,800여 그루가 밀집하여 자생되고 있다. 나무의 높이는 7∼14m, 직경은 50∼110㎝ 그리고 수관폭은 10∼15m에 이르는 거목들이 군집한 세계적으로 보기 드문 비자나무 숲이다. 예부터 비자나무 열매인 비자는 구충제로 많이 쓰였고, 나무는 재질이 좋아 고급가구나 바둑판을 만드는 데 사용되어 왔다. 비자림은 나도풍란, 풍란, 콩짜개란, 흑난초, 비자란 등 희귀한 난과식물의 자생지이기도 하다. 녹음이 짙은 울창한 비자나무 숲 속의 삼림욕은 혈관을 유연하게 하고 정신적, 신체적 피로해소와 인체의 리듬을 되찾는 자연 건강 휴양효과가 있다. 또한 주변에는 자태가 아름다운 기생화산인 월랑봉, 아부오름, 용눈이오름 등이 있어 빼어난 자연경관을 자랑하고 있을 뿐만 아니라 가벼운 등산이나 운동을 하는데 안성맞춤인 코스이며 특히 영화 촬영지로서 매우 각광을 받고 있다. | 이용시간: 09:00~18:00 (입장 마감 17:00) | 휴무: 연중무휴 | 주차: 가능 | 입장료: [개인]- 일반 3,000원- 청소년·어린이 1,500원[단체]- 일반 2,500원- 청소년·어린이 1,000원 ※ 미취학 아동 무료 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "ee6c2a5bbefcbe8943006858816e2f01c4124991c0a0ae708e03cd51cabc9cad"
    },
    {
      "source_id": "web:126472",
      "contentid": "126472",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500270&menuId=DOM_000002000000000081",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "약 2.2km의 숲 산책 코스와 산림욕이 핵심인 전면 야외 장소다.",
      "failure_reason": null,
      "content_fingerprint": "9f179495aca0d2c2690e38cc11d240df70992c9886bf7daafc09dae4b2adb633"
    },
    {
      "source_id": "web:126472:rain",
      "contentid": "126472",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/themtour/view?contentsid=CNTS_200000000013646&menuId=DOM_700000000010810",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "약한 비와 안개비에도 비자림 숲 산책을 즐길 수 있는 장마철 여행지로 소개한다.",
      "failure_reason": null,
      "content_fingerprint": "3eca42ea47294e68533bb4c5a06ed845ed6d1942401dcf8abf38ddc0f77e9c81"
    },
    {
      "source_id": "tourapi:127514",
      "contentid": "127514",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주시 연동 1100 도로변 광이 오름 기슭에 위치한 한라수목원은 제주도 자생 수종과 아열대식물 등의 식물들이 식재, 전시되어 있는 수목원으로 학생 및 전문인들을 위한 교육과 연구의 장 역할을 하고 있으며, 테마 관광지로도 사랑받고 있다. 특히 2000년에 환경부는 이곳을 멸종 위기 보호야생식물의 서식지 외 보전 기관으로 지정했다. 환경부가 멸종 위기 식물로 지정한 나도 풍란, 한란과 파초일엽, 갯대추 등 보호 대상 식물을 포함하여 총 1,321종(목본류 530종, 초본류 791종), 10만여 본을 전시한다. 제주도 자생식물의 유전자원 보존 및 학습·연구의 장을 제공하고 도·시민에게 휴식 공간 제공 및 관광자원으로 활용하고 있다. ◎ 한류의 매력을 만나는 여행 정보 - 예능 제주살이의 상징이 된 효리네 민박 촬영지로 제주의 자생 수종과 아열대 식물 등 1,100여 종의 식물이 식재, 전시되어 있는 수목원이다. 멸종 위기종과 희귀한 식물도 많지만 가볍게 산책하며 힐링하기 좋다. 5만 평의 산림욕장은 관광객과 제주도민에게 도심 속 숲과 같은 휴식 공간이 되어준다. 야외 산책로는 오후 11시까지 관람 가능해 밤 산책을 하기에도 좋다. | 이용시간: [야외전시원 및 산책로] - 상시 개방 [야외 산책로] - 09:00~23:00 [실내시설] - 하절기 09:00~18:00 - 동절기 09:00~17:00 | 휴무: [야외전시원 및 산책로] - 연중무휴 [실내시설] - 설·추석 당일 | 주차: 가능 | 입 장 료: 무료 | 이용가능시설: 산림욕장 / 체력단련실 / 희귀특산수종원 / 관목원 / 수생식물원 등",
      "failure_reason": null,
      "content_fingerprint": "1031933b39507cb014abff165c0574a1044470ba89be3fea015bac1b21c83802"
    },
    {
      "source_id": "web:127514",
      "contentid": "127514",
      "publisher": "제주특별자치도 한라수목원",
      "source_type": "official_place",
      "url": "https://www.jeju.go.kr/sumokwon/index.htm",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "야외 전시원·산책로가 중심이며 온실·난 전시실·생태체험학습관 등 실내시설이 있다.",
      "failure_reason": null,
      "content_fingerprint": "870ac6fcd08a4734dc83d2cbff8fe539f25e1902b661a5628f3050d0dee2cace"
    },
    {
      "source_id": "tourapi:127860",
      "contentid": "127860",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 똑같이 생긴 하르방만 본 여행객들에게 제주 석물의 진수를 감상할 수 있게 하는 곳이 바로 금능석물원이다. 금능석물원은 40여 년을 돌하르방 제작에 힘쓴 장공익 명장이 조성한 공원이다. 돌하르방을 비롯해 해녀상, 동자상, 물허벅을 지고 아이를 돌보는 어머니상 등 제주 지역의 전설을 돌로 표현한 작품, 제주의 생활, 민속, 문화를 상징하는 조각품들이 전시되어 있다. 세계 여러 나라의 대통령과 총리, 지도자들이 제주도를 방문했을 때 선물했던 돌하르방 모형도 함께 전시해 놓았다. 금능석물원의 전체적인 분위기를 주도하는 불교적인 색채가 묻어나는 석불들도 볼 수 있다. 금릉석물원 내에는 정녀굴과 조롱굴 2개의 동굴이 있으며 굴 안에는 불공을 드릴 수 있는 암자가 있다. | 이용시간: 08:30~17:30 | 휴무: 연중무휴 | 주차: 가능 | 입 장 료: - 성인 6,000원 - 청소년 5,000원 - 어린이 무료 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "9af56e7f15c83e2da745b5d3612fc7e243c470e3d0e633ef40f901ee9fe2faa0"
    },
    {
      "source_id": "web:127860",
      "contentid": "127860",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000019446",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "야외 공원의 석조각이 중심이며 정여굴·조롱굴과 암자가 제한적으로 포함된다.",
      "failure_reason": null,
      "content_fingerprint": "9b7bc6abe8186a6010d652f81c16b3c0f881da53924880d29f12d0a97974ac9e"
    },
    {
      "source_id": "tourapi:129276",
      "contentid": "129276",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 숨도는 제주의 화산활동을 통해 크고 작은 구멍이 뚫려 있는 화산석 그 위에 자연 생태가 조성되는 신비롭고 경의로운 생육환경에 매료되어 이러한 제주 자연의 이야기를 전달하고 그 가치를 나누고자 문을 연 정원이다. 숨구멍이 듬성한 현무암 위에 풍란과 야생화를 착근 시켜 하나의 예술품으로 만들어 낸 것이 석부작이다. 투박한 돌덩이를 초록의 뿌리가 굽이굽이 휘어 감으며 껴안아가는 과정은 자연만이 줄 수 있는 생명의 감동으로서 숨도 정원의 영감의 시초라 볼 수 있다. 숨도는 이러한 석부작 분대를 기본으로 풍란, 복수초와 고란초, 죽백란, 만년석송, 한라구름채, 돌단풍 등 제주에서만 유일하게 볼 수 있는 야생화들로 최대한 제주 원형의 정원에 근간을 두고 있으며, 시그니처 뷰 중의 하나는 거의 일년 동안 매 계절 볼 수 있는 아름드리 하귤정원이다. 또한 여름에는 야외 수국 정원과 겨울에는 동백정원, 가을에는 제주억새와 팜파스, 황하코스모스등을 대표적으로 볼 수 있다. | 이용시간: 08:00~18:00 | 휴무: 연중무휴 | 주차: 가능 | 시설이용료: [개인]- 성인 6,000원- 군인/청소년 4,000원- 어린이/경로 3,000원[단체(30인 이상)]- 성인 5,000원- 군인/청소년 3,500원- 어린이/경로 3,000원※ 자세한 사항은 홈페이지 참조 | 주차요금: 무료 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "440081ac48cb00c8c35be39a58f7176b8eb3946da2b73afc86e2463553c69089"
    },
    {
      "source_id": "web:129276",
      "contentid": "129276",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500337",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "석부작박물관·분재 작품과 카페 등 장소의 실내 관람·편의 구성을 안내한다.",
      "failure_reason": null,
      "content_fingerprint": "97cfe809821f44edfea13425ef1c21c168a5ccf015a29e352f419576833f2f6e"
    },
    {
      "source_id": "web:129276:rain",
      "contentid": "129276",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/themtour/view?contentsid=CNTS_200000000013646&menuId=DOM_700000000010810",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "장마철 공식 여행 콘텐츠가 숨도의 빗물을 머금은 수국·오솔길과 실내 석부작·분재 전시를 함께 소개한다.",
      "failure_reason": null,
      "content_fingerprint": "ea98d710f6cdcfb3c6b819e5ac5c6af949786b21cc18ec9ea40dc568c16f740a"
    },
    {
      "source_id": "tourapi:129619",
      "contentid": "129619",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 협재동굴은 제주도의 대표적인 용암동굴이며 황금굴, 소천굴과 함께 제주도용암동굴지대를 이룬다. 용암동굴이자 석회동굴의 특징이 복합된 2차원적인 동굴이라는 점이 특이하며, 그 일대가 모래와 조개껍데기가 섞여 있는 패사층으로 되어 있다. 동굴 내부에는 천장에서 뻗어 나온 석종과 마치 바닥으로부터 솟구쳐 나온 듯이 보이는 석순 등이 신비로운 광경을 연출하며, 석종과 석순이 만나 하나의 기둥을 이루는 종유석이 기이하면서 아름답다. 동굴 벽면에는 석회분이 덮여있어 마치 하나의 거대한 벽화가 새겨져 있는 듯 웅장한 모습이다. 동굴 내부의 온도는 연중 내내 17~18℃를 유지하여 한여름의 이색적인 피서지가 되며, 한겨울에는 따뜻한 온도로 추위를 피할 수 있어 사계절 관광객에게 인기가 있다. 협재동굴은 천연기념물로 지정되어 있고, 페루의 돌소금동굴, 유고의 해중석회동굴과 더불에 세계 3대 불가사의 동굴로 꼽힐 만큼 유명한 곳이다. | 이용시간: [3월~9월] 08:30~19:00[7월15일~8월20일] 08:30~19:30[10월] 08:30~18:30[11월~2월] 18:30~18:00※ 계절별 일몰시간에 따라 변동가능 | 휴무: 연중무휴 | 주차: 가능 | 입장료: [개인]- 성인 15,000원- 경로 12,000원- 청소년 10,000원- 어린이 9,000원[단체]- 성인 12,000원- 경로 11,000원- 청소년 8,000원- 어린이 7,000원 | 화장실: 있음 | 한국어안내서비스: 지원",
      "failure_reason": null,
      "content_fingerprint": "5d739d8e7788db92e2f519f88d853653af60caf7ad959184355695f6c634a2d1"
    },
    {
      "source_id": "web:129619",
      "contentid": "129619",
      "publisher": "한림공원",
      "source_type": "official_place",
      "url": "https://hallimpark.com/park4",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "한림공원 내 실제 내부 관람형 협재굴이며 공원 내 야외 접근 동선이 필요하다.",
      "failure_reason": null,
      "content_fingerprint": "f58b32a219adf71843d73313f61233293377beae0f8e4b16b703f02d3039c5ab"
    },
    {
      "source_id": "tourapi:129620",
      "contentid": "129620",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 쌍용굴(쌍룡굴)은 황금굴, 소천굴, 만장굴과 더불어 제주도의 대표적인 용암동굴이다. 동굴의 길이는 약 400m, 너비 6m, 높이는 3m 정도의 규모이며, 250만 년 전 한라산 일대의 화산이 폭발하면서 협재굴과 함께 생성되었다. 용암동굴이자 석회동굴의 특징이 복합된 2차원적인 동굴이라는 점이 특이하며, 그 일대가 모래와 조개껍질이 섞여 있는 패사층으로 되어 있다. 쌍용굴은 좌우 양쪽으로 나뉘어 있으며 마치 용 두 마리가 굴 내부에 있다가 밖으로 빠져나간 듯한 모양을 하고 있다 해서 쌍용굴이라고 이름이 지어졌다. 쌍용굴의 제2입구와 협재굴의 끝부분이 인접해 있어 두 동굴은 원래 하나였다가 내부 함몰로 인해 나뉜 것으로 추정되고 있다. 협재굴과 마찬가지로 천연기념물로 지정되어 있다. 동굴 내부에는 석회동굴의 특징인 석순과 종유석이 곳곳에 기둥처럼 즐비해 있어 신비한 광경을 연출한다. 동굴 벽면에는 석회분이 덮여있어 마치 하나의 거대한 벽화가 새겨져 있는 듯 웅장한 모습을 보인다. 동굴 내부의 온도는 연중 내내 17~18℃를 유지하여 한여름의 이색적인 피서지로 주목을 받고 있고, 한겨울에는 따뜻한 온도로 추위를 피할 수 있어 사계절 사람이 찾는 관광명소이다. | 이용시간: [2월~5월]09:00~17:00[6월~8월]09:00~17:30[9월~10월]09:00~17:00[11월~1월]09:00~16:30※ 계절별 일몰시간에 따라 변동 가능 | 휴무: 연중무휴 | 주차: 가능 | 입장료: [개인]- 일반 15,000원- 경로 12,000원- 청소년 10,000원- 어린이 9,000원[단체 (20인 이상)]- 일반 12,000원- 경로 11,000원- 청소년 8,000원- 어린이 7,000원※ 자세한 내용은 홈페이지 참조 | 주차요금: 무료 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "c7920cf8171246a75ee6794a9f8409b6a885aff52e4b8e3c991a307073cda0fe"
    },
    {
      "source_id": "web:129620",
      "contentid": "129620",
      "publisher": "한림공원",
      "source_type": "official_place",
      "url": "https://hallimpark.com/park4",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "한림공원 내 약 400m의 실제 내부 관람형 쌍용굴이며 공원 내 야외 접근 동선이 필요하다.",
      "failure_reason": null,
      "content_fingerprint": "242d5c0bd501aa8543609316bb8dfb8f4971ec4870069934daedaf940005a4fb"
    },
    {
      "source_id": "tourapi:2479639",
      "contentid": "2479639",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주불빛정원은 2017년 개장한 이래 제주관광공사에서 선정한 제주야간관광 10선에 선정되는 등 아름다운 제주도의 밤을 가족과 친구들과 보낼 수 있는 야간 축제 관광지로써 발전해 왔다. LED조명과 아름다운 조형물을 기획하고 설치하는 기술을 토대로 아름다운 추억과 감성을 느낄 수 있도록 끊임없이 연구하고 있다. 제주도의 야간관광을 활성화하여 제주도를 방문하는 관광객들에게 더욱 알찬 관광의 기회를 제공하고 지역사회에 기여하고 있다. | 이용시간: 17:00~24:00 (입장 마감 23:00) ※ 악천후 시 조기폐장 가능 | 휴무: 연중무휴 | 주차: 가능 요금 (무료) | 화장실: 있음 | 입 장 료: - 성인 (20~65세) 12,000원 - 청소년 (중고등학생) 10,000원 - 어린이 (초등학생) 8,000원 - 경로우대/제주도민/장애인 (신분증 제시) 8,000원 ※ 만 3세 이하/생일 당일 방문 무료",
      "failure_reason": null,
      "content_fingerprint": "a5954eac7c6283515c2e74bfd93cf7153f91d5bf6bc06a3c586ea9f770bc4dac"
    },
    {
      "source_id": "web:2479639",
      "contentid": "2479639",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000022082",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "야간 야외 LED 정원·별빛터널이 핵심이고 실내 사진관·카페·VR 시설이 보조한다.",
      "failure_reason": null,
      "content_fingerprint": "176966f52cb7aa21c619525cf2bfefee8d273f7a986e9e0374ed5c6af633c491"
    },
    {
      "source_id": "tourapi:2562214",
      "contentid": "2562214",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 인기 캐릭터 ‘라바’를 탄생시킨 글로벌 3D 애니메이션 제작사, 투바앤(TUBAn)의 다양한 캐릭터와 스토리가 가득한 신화테마파크는 방문객들에게 흥미롭고 환상적인 하루를 선사한다. 환상적인 여행으로 안내하는 ‘로터리 파크’를 지나, 정글 속 신비한 고대 도시 ‘오스카 뉴월드’를 거쳐, 귀여운 캐릭터와 볼거리 가득한 ‘라바 어드벤처 빌리지’에 다다르는 여정, 12가지 짜릿한 놀이기구와 어트랙션을 즐길 수 있다. | 이용시간: 10:00~20:00 ※ 시즌 별로 운영 시간이 상이하므로 자세한 사항은 홈페이지 참조 | 휴무: 연중무휴 | 주차: 가능 | 입 장 료: [정상가] - 45,000원 [시즌 할인가] - 자유이용권 (1월~2월 / 11월~12월) 29,000원 - 자유이용권 (3월~10월) 39,000원 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "27699b08e53507cdf065b1fbb87a3b6bfabb24264e86fd75652f0ac26df2dd24"
    },
    {
      "source_id": "web:2562214",
      "contentid": "2562214",
      "publisher": "제주신화월드",
      "source_type": "official_place",
      "url": "https://www.shinhwaworld.com/themepark.jhtml",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "공식 테마파크 페이지가 야외 놀이기구·공연과 일부 실내 어트랙션의 시설 구성을 안내한다.",
      "failure_reason": null,
      "content_fingerprint": "d31e061e5e3313db7efb5668da13e6df87b936064f6e6ab8f79cd5bc6614bd8c"
    },
    {
      "source_id": "web:2562214:rain_rides",
      "contentid": "2562214",
      "publisher": "제주신화월드",
      "source_type": "official_place",
      "url": "https://www.shinhwaworld.com/themeparktip/39955.jhtml",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "공식 안내가 우천 시 운영하는 실내 중심 어트랙션 4개를 별도로 열거한다.",
      "failure_reason": null,
      "content_fingerprint": "0e476e5de9ee456c2122258e86684f7faa552b8f40fd179222314838f40c325a"
    },
    {
      "source_id": "web:2562214:weather",
      "contentid": "2562214",
      "publisher": "제주신화월드",
      "source_type": "official_place",
      "url": "https://www.shinhwaworld.com/themeparktip/39959.jhtml",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "공식 FAQ가 우천 시 일부 시설 제한·공연 취소와 기상 악화 시 단축 운영·휴장 가능성을 안내한다.",
      "failure_reason": null,
      "content_fingerprint": "9e17971d128cb0b483309df506e0954a582a6d4857aa955584e5a72336d3d6b3"
    },
    {
      "source_id": "tourapi:2562239",
      "contentid": "2562239",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 신화워터파크는 파도풀, 유수풀을 포함한 18개의 풀과 슬라이드, 5개의 식음 매장, 찜질방까지 갖춘 제주 최대 실내외 워터파크로 3,000명까지 동시 수용할 수 있다. 아시아에 최초로 도입된 슬라이드 ‘슈퍼 크리퍼코일’과 ‘자이언트 더블리프’와 함께 신화워터파크에서만 즐길 수 있는 짜릿한 즐거움과 어린이 전용 풀장, 프라이빗한 휴식을 제공하는 카바나, 다양한 음식을 즐길 수 있는 식음료 매장까지 경험할 수 있다. | 이용시간: ※ 시즌 별로 운영 시간이 상이하므로 자세한 사항은 홈페이지 참조 | 휴무: - 실내 수영장 연중무휴- 실외 수영장 5월~9월만 운영 | 주차: 가능 | 입장료: [정상가] 80,000원 [시즌 할인가] - 로우시즌 입장권 (1월 1일~5월 2일, 10월 10일~12월 31일) 40,000원 - 일반시즌 입장권 (5월 3일~7월 4일, 8월 25일~10월 9일) 53,000원 - 피크시즌 입장권(7월 5일~8월 24일) 75,000원 ※ 자세한 입장료는 공식 홈페이지 참조 | 내국인예약안내: 전화 / 홈페이지 예약 가능 | 외국인예약안내: 전화 / 홈페이지 예약 가능 | 주차요금: 무료 | 화장실: 있음 | 한국어안내서비스: 모든 직원 한국어 가능 | 외국어안내서비스: 영어, 중국어",
      "failure_reason": null,
      "content_fingerprint": "c0e2187960b58c72c4df029a5526efaddc7e0a32edcc7b87a3d76dc9531f81bb"
    },
    {
      "source_id": "web:2562239",
      "contentid": "2562239",
      "publisher": "제주신화월드",
      "source_type": "official_place",
      "url": "https://www.shinhwaworld.com/waterpark.jhtml",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "실내 7개·실외 11개 어트랙션으로 구성되며 실내는 연중, 실외는 주로 5~9월 운영한다.",
      "failure_reason": null,
      "content_fingerprint": "d2e8b506f7ca1e8a4e1494d19bd343102faed9730aa2aef0381372abbf7cc9bc"
    },
    {
      "source_id": "web:2562239:weather",
      "contentid": "2562239",
      "publisher": "제주신화월드",
      "source_type": "official_place",
      "url": "https://www.shinhwaworld.com/waterparktip/39964.jhtml",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "공식 FAQ가 우천에도 운영하되 기상 악화 시 운영시간 단축·휴장 가능성을 안내한다.",
      "failure_reason": null,
      "content_fingerprint": "f91acd0cc2233b89e37b9de957f89c05523da94338c0735ef4c89511977c9fa8"
    },
    {
      "source_id": "tourapi:2738721",
      "contentid": "2738721",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 미천굴은 학술적, 관광적, 문화적 가치를 간직한 중요한 자원이며, 주변의 맑은 공기와 깨끗한 물, 푸른 들판, 오름 등을 간직하고 있다. 특히 원초적인 암흑의 지하 공간은 인간의 본질과 미래에 대해 사색하고 추상하는 창조의 공간이 된다. 도시에서는 쉽게 경험할 수 없는 절대 자연미를 느낄 수 있는 공간으로, 총 1,700m 중 365m 구간을 개방하고 있다. 미천굴의 입구는 천정함몰에 의해 형성되었으며 천정 두께는 비교적 얕은 편이다. 동굴을 형성한 현무암류에서는 동굴 지표면상의 유동 방향을 나타내는 로피 구조를 엿볼 수 있다. | 이용시간: 09:00~18:00 (입장 마감 16:00) | 휴무: 연중무휴 | 주차: 가능 | 입 장 료: [개인] 일반 12,000원 경로 10,000원 청소년 8,000원 어린이 7,000원 [단체(30인 이상)] 일반 10,000원 경로 9,000원 청소년 6,000원 어린이 5,000원 | 화장실: 있음 | 이용가능시설: 수변공원 / 아트센터 / 식물원 등",
      "failure_reason": null,
      "content_fingerprint": "c712b15c981b96281d0ea9654d6e8950e117428f0cc4647818c0363ea5a0e07a"
    },
    {
      "source_id": "web:2738721",
      "contentid": "2738721",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500207",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "1,700m 중 365m를 실제 내부 관람구간으로 운영하며 일출랜드 야외 동선을 거쳐 접근한다.",
      "failure_reason": null,
      "content_fingerprint": "27a4fc51b67e29d0d476ea0a3eeeca42fa380f9ac61d94ea46d45508f94e09fb"
    },
    {
      "source_id": "tourapi:2738730",
      "contentid": "2738730",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 곶자왈은 화산활동으로 생긴 바윗덩어리들이 쪼개져 만들어진 요철 지형의 숲이다. 제주도에만 존재하며, 한라산을 중심으로 중산간 지대 여러 곳에 걸쳐 분포되어 있다. 독특한 지형이 구간마다 다른 기후대를 형성하여 같은 숲 안에 다양한 기후 대의 식물이 공존하는 특이한 생태계를 보인다. 그 중 하나인 화순곶자왈에서 북방한계식물과 남방한계식물을 동시에 관찰할 수 있다. 세계적으로 희귀한 동식물 50여 종이 서식하고 있다. 화순곶자왈 생태탐방숲길에 들어서면 곳곳에 마련된 이정표를 잘 따라야 한다. 탐방로가 세 코스로 나뉘어 있는데, 비교적 산책로가 잘 조성되어 편하게 거닐 수 있다. 산책로 양 옆에는 나무들이 우거져 있고 다양하게 자라난 식물들을 볼 수 있으며, 소나 말을 방목하여 기르기 위해 쌓아진 잣담도 볼 수 있다. 전망대에서는 소를 방목하는 목장이 보이고, 멀리 한라산과 산방산이 보이는 풍경을 눈에 담을 수 있다. ‘한국 아름다운 숲’ 공존상을 수상한 이력만큼 생태 그대로를 보전한 신비로운 원시림의 매력을 느낄 수 있다. | 이용시간: 상시 개방 | 휴무: 연중무휴 | 주차: 가능 | 입 장 료: 무료 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "9f52ae64e33786591a6ef06a959f8a463f8942a5bcd155d7794e26ea7565aaba"
    },
    {
      "source_id": "web:2738730",
      "contentid": "2738730",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000018797",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "세 개의 야외 탐방 코스와 산책로·전망대가 핵심인 화순곶자왈 생태탐방숲길의 장소 구조를 설명한다.",
      "failure_reason": null,
      "content_fingerprint": "e840359612e47a2f42b7a8af468d4dfdc3ad96bdc25aaf4d6a32d71855ac1216"
    },
    {
      "source_id": "web:2738730:program",
      "contentid": "2738730",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_300000000012760",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "해당 숲길에서 운영한 예약형 사운드워킹 프로그램은 악천후 시 취소될 수 있다고 안내한다.",
      "failure_reason": null,
      "content_fingerprint": "b1e2c89e16b1deb7ebb25e124002ea6f84f1b0b189562f501588655fac1f2b3d"
    },
    {
      "source_id": "tourapi:2738734",
      "contentid": "2738734",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 상효원은 약 264,462㎡ (8만 평) 규모를 가진 서귀포시 소재의 수목원이다. KC코트렐 이달우 회장이 아름다운 자연경관을 다른 사람들과 공유하고자 설립했다. 한라산과 서귀포 바다가 보이는 이곳은 해발 400m에 있으며, 제주 고유의 자생식물을 보유하고 있다. 제주 토종의 한란, 새우란과 같은 식물의 원생지이며, 100년 이상의 노거수와 상록 거목이 밀집해 있어, 수종의 다양성, 희귀성 측면에서 보존 가치가 높다. 상효원 내에는 엄마의 정원, 약용 식물원, 비밀의 정원, 곶자왈, 세미꼿 정원 등 16개의 테마의 정원이 조성되어 있어 공간별로 다채로운 식물을 세심하게 관찰할 수 있다. 또한 희귀ㆍ멸종 위기 식물의 식물자원을 보존하고, 원예적으로 가치가 높은 식물을 연구하여 보존하고자 식물자원연구소를 운영하고 있다. 카페, 한식당, 미니갤러리 & 기프트 샵을 비롯해, 웨딩(컨벤션)과 바람을 컨셉으로 한 최신시설의 연회장과 신나는 놀이 시설 에어바운싱돔, 캠핑장 등 다채로운 부대시설을 갖췄다. 이뿐만 아니라 친환경 전기기차를 타고 제주 고유의 자생식물들이 있는 본 수목원 곳곳을 관람할 수 있으며, 제주도의 '녹색 관광지 만들기' 사업 참여 관광지로서 친환경 소비 실천 시 다양한 혜택을 제공하는 그린카드 소지 관광객 대상으로 할인혜택을 제공한다. | 이용시간: [3월~9월] - 09:00~19:00 - 매표마감 18:00 - 카페뉴기니 09:30~19:00 - 한식당 11:00~18:00 [10월~2월] - 09:00~18:00 - 매표마감 17:00 - 카페뉴기니 09:00~18:00 - 한식당 11:00~18:00 | 휴무: 연중무휴 | 주차: 가능 (소형 82대 / 대형 18대) | 입 장 료: [개인] - 일반 9,000원 - 청소년, 경로(만65세 이상) 7,000원 - 어린이(만36개월~초등학생) 6,000원 [단체 (10인 이상)] - 일반 7,000원 - 청소년, 경로(만65세 이상) 6,000원 - 어린이(만36개월~초등학생) 5,000원 ※ 자세한 사항은 홈페이지 참조 | 이용가능시설: 한식당 / 카페 / 갤러리 / 매표소 / 연회장 / 화장실 / 로비갤러리 / 카페테리아 | 화장실: 있음 | 주차요금: 무료",
      "failure_reason": null,
      "content_fingerprint": "dea6adea094f4057c323e4c988a50ad7ef576faf29575db63719dbdf54996331"
    },
    {
      "source_id": "web:2738734",
      "contentid": "2738734",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000020676",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "약 8만 평 규모의 테마정원·곶자왈을 걷는 야외 관람이 중심인 상효원수목원을 설명한다.",
      "failure_reason": null,
      "content_fingerprint": "5aae3f6e5fd04dd3a57dfe204db649a942a2d14da1b61146aac2205a7e5e4099"
    },
    {
      "source_id": "tourapi:2753082",
      "contentid": "2753082",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 아름다운 제주도 여행의 첫 시작 감성정원 파더스가든은 제주의 사계절을 담은 감성정원이다. 드넓은 귤밭에서 감귤 따기는 물론 동물 먹이 주기 체험 그리고 유채꽃, 수국, 핑크뮬리, 팜파스, 동백꽃 등 계절마다 피어나는 다채로운 꽃을 감상할 수 있다. 호빗마을과 천국의 계단, 모래놀이터 등 어린이들과 연인 또는 가족들이 함께 시간을 보내기 좋다. 가든 곳곳에 있는 동물과 교감하고 핑크뮬리축제, 팜파스축제를 만끽하며 귤 따기 체험, 청귤차 만들기 등 계절마다 다양한 체험과 축제를 즐길 수 있는 대규모 테마파크이다. 나무 한 그루, 작은 꽃잎 하나까지도 온 가족의 정성과 소중한 마음으로 오랜 시간 가꾸어진 농장이 더 많은 사람들의 건강한 삶을 위한 힐링 장소로 자리매김하고 있다. | 이용시간: 09:00~18:00 (입장 마감 17:00) | 휴무: 연중무휴 | 주차: 가능 | 촬영장소: 아이유 삼다수 광고 촬영지 | 입 장 료: [개인] - 성인 13,000원 - 청소년, 어린이, 군인, 경로 11,000원 [단체(20명 이상)] - 성인 11,000원 - 청소년, 어린이, 군인, 경로 9,000원 ※ 자세한 사항은 전화문의 요망 | 화장실: 가능",
      "failure_reason": null,
      "content_fingerprint": "6f558fc5a039ce97bc7352d59d0684579036956d1bdc00153dfb8e0b6ec3ee97"
    },
    {
      "source_id": "web:2753082",
      "contentid": "2753082",
      "publisher": "파더스가든",
      "source_type": "official_place",
      "url": "https://www.fathersgarden.co.kr/guide",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "정원·동물농장·감귤따기 등 야외 경험이 본체이고 카페 등 실내는 보조하며, 기상에 따라 입장 제한 가능성을 명시한다.",
      "failure_reason": null,
      "content_fingerprint": "e7b649790e3d7f025716605695d4232aeef9bff50347b9ec63220842a7cedbf7"
    },
    {
      "source_id": "tourapi:2765245",
      "contentid": "2765245",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 송악산 해안 절벽에 있는 인공 동굴로, 1945년 초 일본군이 연합군의 공격에 대비하거나 중국 침략을 목적으로 구축해 둔 동굴이다. 송악산 해안 절벽을 훼손해 가며 모두 15개의 인공 동굴을 뚫었고, 제주도민들을 강제 동원한 곳이기도 하다. 동굴 너비는 3~4m, 길이는 20여 m로 우리나라에서는 쉽게 찾아볼 수 없는 일제 강점기 군사시설이다. 동굴 안쪽에서 바라보면 희미하게 형제섬이 보이는데, 바라보는 위치에 따라 두 개에서 네 개, 열 개로 쪼개지는 신기한 모습을 보여준다. 최근엔 붕괴 위험으로 접근이나 동굴 입장이 금지된 상태이다. | 이용시간: 상시 개방 | 휴무: 연중무휴 | 주차: 가능 요금 (무료) | 입 장 료: 무료",
      "failure_reason": null,
      "content_fingerprint": "75d62b4eb52791a0bac4382aa43602843d81d5754f531495d3780a84fbd002dc"
    },
    {
      "source_id": "web:2765245",
      "contentid": "2765245",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500379",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "붕괴 위험으로 동굴 내부 진입이 금지되어 송악산 해안가 야외에서 바라보는 방식이다.",
      "failure_reason": null,
      "content_fingerprint": "19f5320408a2292ed63ca612bfa9938270d78b95723b6ab30b46e6441a8f4c67"
    },
    {
      "source_id": "tourapi:2767778",
      "contentid": "2767778",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주도 내에는 일제 강점기 말에 이르러 일본군이 만든 군사 시설을 심심치 않게 찾아볼 수 있다. 삼매봉 남서쪽 해안가에는 ‘황우지굴’, ‘열두굴’ 등으로 불리는 황우지 해안 열두굴은 제2차 세계대전 당시 일본군이 미군의 공격을 대비해 어뢰정을 숨기기 위해 인공적으로 만들어 놓은 동굴이다. 각각 15m 안팎의 거리를 두고 직선으로 나란히 뚫려 있으며, 높이가 약 3m, 폭이 약 3m~4.5m, 깊이는 약 10m~30m이다. 열두 동굴 중 열 번째 굴과 열한 번째 동굴은 서로 내부에서 연결되어 독특한 h자 형을 이루고 있다. 이러한 인공굴은 일본 식민지 지배의 과거사와 강제 노역의 현장을 고증하고 있다는 점에서 역사적 가치가 있는 곳이다. | 이용시간: 상시 개방 | 휴무: 연중무휴 | 주차: 가능 | 입 장 료: 무료 | 화장실: 있음 | 주차요금: 무료",
      "failure_reason": null,
      "content_fingerprint": "d5a992cd5d8e74a4530913062080430f35191d881736b6e7077a7eb9cfa02ab7"
    },
    {
      "source_id": "web:2767778",
      "contentid": "2767778",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500704",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "해안의 군사용 인공굴 12개와 역사·규모를 설명하지만 방문객의 내부 출입 가능 여부는 명시하지 않는다.",
      "failure_reason": null,
      "content_fingerprint": "e971be5a274338000d8487fd50e5aab8faf5a110c7de22bc5188b2dfa07558cc"
    },
    {
      "source_id": "tourapi:2791430",
      "contentid": "2791430",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 불란지야시장은 중문 오일장 초입에 자리하고 있는 곳이다. 불란지는 반딧불이의 제주 사투리로 중문에 어둠이 깔릴 때 불이 켜진다. 싱싱한 활어회부터 파전, 토스트, 두루치기에 고기 국수까지, 가격과 입맛에 따라 음식을 골라 먹을 수 있는 재미가 있는 곳이다. 야시장에는 8개 정도의 식당이 모여 있는데 실내보다는 야외 공간이 특히 인기 있다. 마음에 드는 야외 테이블에 자리 잡고 먹고 싶은 음식들을 각 식당에 주문한 뒤 먹으면 된다.",
      "failure_reason": null,
      "content_fingerprint": "e98fc18f746aaf4ff500e263d6894eaa4f6bf2da54d91c08e381a83df4c8282a"
    },
    {
      "source_id": "web:2791430",
      "contentid": "2791430",
      "publisher": "한국관광공사",
      "source_type": "public_tourism",
      "url": "https://data.visitkorea.or.kr/linkedview/2791430",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "8개 정도의 식당이 모였고 실내보다 야외 테이블 공간이 특히 인기 있는 야시장으로 설명한다.",
      "failure_reason": null,
      "content_fingerprint": "7e38646add1ee735d1ad7a1791447ca7734abb81c89b9e34177bc71f64586d31"
    },
    {
      "source_id": "tourapi:2798882",
      "contentid": "2798882",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주도의 동쪽 끝에 있는 우도는 물소가 머리를 내민 모양(우두형)으로 있는 것 같다고 해서 붙여진 이름이다. 서울 면적의 약 100분의 1이며, 인구가 1,800여 명 정도 되는 제주도의 섬이다. 우도에는 2개의 선착장 천진항과 하우목동항이 있는데 우도의 관문 항구이자 관광객들에게 많이 알려진 곳은 천진항이다. 우도 유채꽃 마을 정보 센터와 바로 붙어있는 우도 천진항 대합실은 크지 않은 규모로 매표소와 대기석 그리고 간단한 간식과 기념품을 구매할 수 있는 매점이 있다. 대합실 근처에는 우도 관광의 편의를 위해 전기자동차 대여소들이 즐비해 있다. 우도로 들어올 때는 자동차와 스쿠터를 가지고 들어올 수 있다. 자동차는 선적증 구입 후 출항 시간 10분 전까지 선원의 지시에 따라 반드시 면허증 소유자가 선적시켜야 한다. | 이용시간: 07:00~17:00 ※ 30분 간격 운항 ※ 정원의 초과, 물때, 화물, 날씨에 따라 도착항이 변경 또는 조금 빨라지거나 지연될 가능성이 있음 | 휴무: 연중무휴 | 주차: 가능 | 이용가능시설: 매점 | 화장실: 있음 | 입 장 료: [편도] - 대인 4,500원 - 소인(2~13세) 1,500원 ※ 이용요금은 변동될 수 있으므로 홈페이지 참조 또는 전화 문의 요망",
      "failure_reason": null,
      "content_fingerprint": "82c7782651b864a029683ac1cfc06bded7d29215b319ac5b925f321da2450d5b"
    },
    {
      "source_id": "web:2798882",
      "contentid": "2798882",
      "publisher": "한국관광공사",
      "source_type": "public_tourism",
      "url": "https://data.visitkorea.or.kr/linkedview/2798882",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "실내 매표소·대기석·매점으로 구성된 대합실이지만 연결 선박은 날씨에 따라 도착항·시간이 바뀔 수 있다.",
      "failure_reason": null,
      "content_fingerprint": "2d7d2fd8e9a6f2ffadc5a475c8b222a6b9d253dc1f0eb144157b372ba1bef988"
    },
    {
      "source_id": "tourapi:2806043",
      "contentid": "2806043",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 동백포레스트는 제주 서귀포시 남원읍에 위치한 동백꽃 테마 농원으로 자연과 힐링을 동시에 즐길 수 있는 명소이다. 하얀 유럽풍 건물과 동글동글한 동백나무로 이국적인 분위기를 지녔으며, 11월부터 2월까지 동백꽃이 만개하여 붉은 꽃망울이 숲속을 물들이며, 방문객들에게 아름다운 풍경을 선사한다. 야외 정원은 물론 건물 내 카페가 있어 음료와 디저트를 즐기며 카페 1층의 창을 배경 삼아 사진 찍을 수 있는 포토존이 있다. 동백포레스트는 자연 속에서의 산책과 사진 촬영을 즐기기에 적합한 장소로, 제주 여행 중 특별한 추억을 남기기에 좋은 곳이다.​ | 이용시간: 09:00~18:00 (입장 마감 17:00) ※ 동백꽃 개화시기에 운영하므로 전화문의 요망 | 휴무: 3월~10월 ※ 동백꽃 개화시기에 운영하므로 전화문의 요망 | 주차: 가능 | 입 장 료: - 성인 6,000원 - 청소년, 어린이 4,000원",
      "failure_reason": null,
      "content_fingerprint": "1d5884edf54b2e847b6dbfc5b18ebf878a8c50592f387876340796252e61808c"
    },
    {
      "source_id": "web:2806043",
      "contentid": "2806043",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_200000000008003",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "동백 군락지·돌담·야외 산책로·사진 촬영이 핵심인 정원 구조를 설명한다.",
      "failure_reason": null,
      "content_fingerprint": "70b8d5a8b9a7c7d319e5f256f17a2edc6c090e84d94e7c6c6428f4cf701cde35"
    },
    {
      "source_id": "tourapi:2806115",
      "contentid": "2806115",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주동백수목원은 위미리 동백군락지를 일군 할머니의 증손자가 1977년부터 꺾꽂이로 정성스럽게 가꾼 둥근 수형의 애기동백나무 수백여 그루가 숲을 이루고 있는 수목원이다. 큰 애기동백나무 수백그루가 어우러져 있는 것을 볼 수 있고 수백 종류의 동백나무와 야생화, 야자수, 전망대, 연못, 방사탑, 조각상 등 다양한 볼거리가 있다. 분수대와 산책로도 있어 겨울마다 동백꽃의 풍경을 보며 걸을 수 있다. 가족과 친구, 연인과 방문해 동백나무를 배경으로 사진을 찍기에도 좋다. | 이용시간: 09:00~18:00 (입장 마감 17:00)※ 11월 중순부터 2월 말 운영으로 자세한 사항은 전화문의 요망 | 휴무: 연중무휴※ 겨울시즌 중 무휴 | 입장료: - 성인 8,000원- 어린이 5,000원",
      "failure_reason": null,
      "content_fingerprint": "8801a3d936cb6fe308b34585df6725e7b3312d44167171b398ce37686aa0b5fb"
    },
    {
      "source_id": "web:2806115",
      "contentid": "2806115",
      "publisher": "제주동백수목원",
      "source_type": "official_place",
      "url": "https://jejucamellia.co.kr/",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "수백 그루의 동백숲과 미로 같은 숲길 산책·조망이 핵심이다.",
      "failure_reason": null,
      "content_fingerprint": "75165fcf052ddcf59526164d2be14e62b5fe8c56c0b6ee24e65599b53a070dbc"
    },
    {
      "source_id": "tourapi:2836814",
      "contentid": "2836814",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주올레 6코스를 걷다 보면 외돌개와 해안 올레길을 연결하는 서귀포 칠십리공원을 발견할 수 있다. 이 공원을 둘러보면 시나 노래 가사가 새겨진 돌들을 볼 수 있는데, 여기에 새겨진 글들은 서귀포를 주제로 한 것들이기 때문에 더욱 더 서귀포의 분위기에 빠져들게 된다. 그냥 공원을 거닐거나 잠시 앉아 쉬는 것 뿐만 아니라 여유롭게 산책하며 마음의 양식을 쌓을 수 있는 시간을 보낼 수 있다. 풀과 나무, 연못 등 다양한 자연의 모습들이 조화돼 이곳의 풍경을 더 여유롭게 만들어준다. 천지연폭포와도 가까워 천지연폭포를 조망할 수 있는 특별함도 가지고 있다. 이 곳은 잔디가 넓게 펼쳐져 있어서 가족들이나 친구들과 소풍을 즐길 수도 있고, 놀이터도 있어 어린아이들이 뛰어 놀기에도 좋으며, 맑고 푸른 경치와 조용한 공원의 분위기를 느끼며 산책하기에도 좋다. 공원 안에는 다양한 조형물과 미술관도 자리 잡고 있기 때문에 문화예술적인 볼거리도 갖춰져 있어서 곳곳마다 발걸음을 멈추게 만들 것이다. 남녀노소 편하게 쉴 수 있는 쉼터로도 안성맞춤이고 다양한 볼거리가 있는 서귀포 칠십리공원에서 여유로운 휴식과 산책을 즐긴다면 제주 여행의 매력을 더 깊이 느낄 수 있다. (출처 : 비짓제주 홈페이지) | 이용시간: 상시 개방 | 휴무: 연중무휴 | 주차: 가능 | 입장료: 무료 | 주차요금: 무료",
      "failure_reason": null,
      "content_fingerprint": "7c894afef42dc21316a6863cf79c961679007958f629135b85fdeda36e287113"
    },
    {
      "source_id": "web:2836814",
      "contentid": "2836814",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000018447&menuId=DOM_000001718006000000",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "잔디·놀이터·연못·산책·전망으로 구성된 서귀포칠십리시공원의 야외 방문 경험을 설명한다.",
      "failure_reason": null,
      "content_fingerprint": "be83c8acad40481559c26cf571e47e3f85c3840062464283d4550509ff01f431"
    },
    {
      "source_id": "web:2836814:museum",
      "contentid": "2836814",
      "publisher": "서귀포시 공립미술관",
      "source_type": "official_place",
      "url": "https://ssam.seogwipo.go.kr/about/museum/2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": false,
      "evidence_summary": "인근 기당미술관은 별도 시설·별도 POI이므로 공원 자체의 실내 비중에 합산하지 않는다.",
      "failure_reason": null,
      "content_fingerprint": "5f5e42b5e3dd2784698ded912318c2d4ef055976c1271f8013e82b4a7a3d9641"
    },
    {
      "source_id": "tourapi:2931257",
      "contentid": "2931257",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주도에서 가장 오래되고 규모가 큰 소나무군락지에 복합테마파크 형태의 관광지로 조성된 야시장이다. 약 4,000평의 규모로 소나무 숲 안에 조성된 자연 그대로의 형태를 갖춘 야시장이다. 가족, 연인, 친구와 함께 방문하기 좋은 공간으로, 제주 밤 문화를 경험할 수 있는 복합 야간 관광지로 자리하고 있다.",
      "failure_reason": null,
      "content_fingerprint": "ff4275fdc7d9fd4ca9160dcf6b31730272888f026f3b03be5cbd025eda33c842"
    },
    {
      "source_id": "web:2931257",
      "contentid": "2931257",
      "publisher": "한국관광공사",
      "source_type": "public_tourism",
      "url": "https://data.visitkorea.or.kr/linkedview/2931257",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "4,000평 소나무숲 안의 자연형 야시장으로 야외 푸드트럭·산책 경험이 핵심이다.",
      "failure_reason": null,
      "content_fingerprint": "cf2aa5b66b3b0925a2d14bb1d1ceb0e2d2ffcb168454d4d90b0bcbc40353a4a6"
    },
    {
      "source_id": "tourapi:3008392",
      "contentid": "3008392",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 성읍녹차동굴은 제주의 대표적인 천연 용암동굴 포토존이다. 동굴 안쪽에서 입구를 바라보며 촬영하면 신비롭고 몽환적인 분위기의 사진을 남길 수 있다. 성읍녹차마을 다원 내에 위치해 있어 드넓은 녹차밭 풍경과 동굴을 함께 감상할 수 있다. 주차장에서 녹차밭을 따라 15~20분 정도 걸어가면 작은 숲이 나타나고, 숲 안쪽으로 들어가면 작은 동굴이 나온다. 여기서 조금 더 들어가면 규모가 더 큰 동굴을 만날 수 있으며, 큰 동굴 안쪽에서 바깥을 향해 사진을 찍으면 독특한 색감의 사진을 담을 수 있다. 동굴은 성읍녹차마을 다원 내에 있으므로 길도우미에 ‘오늘은 녹차한잔’ 또는 ‘성읍녹차마을’을 목적지로 설정해 방문하면 된다. ‘오늘은 녹차한잔’ 카페 1층에는 녹차 기념품 숍과 족욕 체험장이 있으며, 2층에는 베이커리 카페가 운영되고 있다. | 이용시간: 09:00~17:30 | 휴무: 연중무휴 | 주차: 가능 | 입장료: 무료",
      "failure_reason": null,
      "content_fingerprint": "c1bd15f997a7ca1a9a5093db08b35946d909e448a0c20268a4763d9ed2ec1cbd"
    },
    {
      "source_id": "web:3008392",
      "contentid": "3008392",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_300000000012850",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "주차장에서 녹차밭·숲을 15~20분 걷고 동굴 안쪽에서 바깥을 향해 촬영하는 자연광 포토스팟이다.",
      "failure_reason": null,
      "content_fingerprint": "4be1b1fcf46ad2afd6d0ff0cb743b4ab3f4f74d5f823d155d9b333688072be61"
    },
    {
      "source_id": "tourapi:3317905",
      "contentid": "3317905",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 현애원은 제주도 성산일출봉 근처에 위치한 2만 평 규모의 정원이다. 벚꽃, 영산홍, 철쭉, 병솔나무, 해바라기, 수국 등 다양한 꽃이 만개한 정원을 감상할 수 있다. 그중에서도 제주도의 수국 명소 중 한 곳으로 잘 알려져 있으며 수국이 만개한 시즌엔 입구부터 한가득 피어 있는 수국을 볼 수 있다. 정원 내부에는 이스틀리스 카페를 함께 운영하고 있으며 입장권을 구매한 입장객들에겐 정원 안에 있는 카페 이용권을 함께 증정한다. 입장권은 네이버를 통하여 예매도 가능하며 5세 이하의 아동은 무료입장이 가능하다. | 이용시간: 09:00~17:00 (입장 마감 16:40) | 휴무: 매주 일요일 | 주차: 가능 | 입장료: - 성인 7,000원- 청소년 5,000원- 어린이, 65세 이상 경로, 제주도민 3,000원",
      "failure_reason": null,
      "content_fingerprint": "62f03dff4a1b7a18e1d4bdf1deb017dd1006bbed1123c94f2f0a4f97eabbc519"
    },
    {
      "source_id": "web:3317905",
      "contentid": "3317905",
      "publisher": "제주관광공사 비짓제주",
      "source_type": "public_tourism",
      "url": "https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_300000000013063",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "2만 평 야외 정원과 계절 꽃이 중심이고 입장권에 실내 카페 음료 이용이 포함된다.",
      "failure_reason": null,
      "content_fingerprint": "190bcc841db2407316cac30e5c74ff62f0db64db926cc5f6cb460d30f6600693"
    },
    {
      "source_id": "tourapi:3371999",
      "contentid": "3371999",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주다운 개방형 공원을 표방하는 제주동화마을은 제주 동부 오름 군락 중심부인 구좌읍 송당리에 자리 잡고 있으며, 약 3만 평의 부지에 수백 년 수령의 팽나무, 조록 나무, 배롱나무 등 제주의 나무와 수십만 년 전 화산활동을 통해 형성된 S급의 자연석 5천 점을 기본 재료로 공원을 조성하였다. 문화재급 동자석, 문관석, 촛대석을 비롯해 상석류 200여 점을 수집하여 전시하였고 옛 문헌과 자료의 고증을 통하여 다양한 형태의 동자석 복원을 시도하고 있다. 향기체험관을 통해 농어촌 체험학습관을 시설하였고, 제이팜정육식당, 미스터밀크(성이시돌목장), 송당산들네식당(향토음식점) 등 제주의 맛을 맛볼 수 있는 음식점들은 물론, 관광지로서의 역할로 공원의 전경을 볼 수 있는 스타벅스, 파리바게뜨, 지브리공식 코리코카페, 지브리공식 도토리숲 등이 있다. 감성 소품과 편의점 물품을 판매하는 제스코 관광마트는 제주위미농협직판장, 성산포수협직판장, 제주시산림조합을 통한 제주 특산품 판매를 하고 있으며, 동시에 제주농촌관광 활성화를 위해 제주농촌 융복합산업 6차 산업 인증사업자들의 상품이 많은 비중을 차지하고 있어 제주관광 상품 및 제주 굿즈의 대부분을 한 곳에서 쇼핑할 수 있는 장소라 할 수 있다. | 이용시간: 09:00~20:00 | 휴무: 연중무휴 | 체험: 천연아로마 만들기 / 천연비누 만들기 / 스킨토너패드 만들기 등 | 주차: 가능 | 입장료: 무료 ※ 체험 비용은 별도로 부과됨으로 자세한 사항은 홈페이지 참조 및 전화 문의 요망 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "9e0499d275f05a716f2ab37319cb98ecedf183a485c3ecee3b8105735e430179"
    },
    {
      "source_id": "web:3371999",
      "contentid": "3371999",
      "publisher": "제주동화마을",
      "source_type": "official_place",
      "url": "https://www.jejudonghwa.com/",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "3만7천 평의 개방형 공원과 14개 테마정원이 중심이며 카페·식당·굿즈숍·관광마트·전시 공간이 함께 있다.",
      "failure_reason": null,
      "content_fingerprint": "47dbb7668e540b6bee1f8a479860a6f040450d8994aa09ef4d558855a64eaf25"
    },
    {
      "source_id": "tourapi:3545719",
      "contentid": "3545719",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 돌낭예술원은 14년 간 황무지땅을 일구어 가꿔 2024년 봄에 열었다. 아버지의 예술혼을 불어넣은 분재와 석부작을 주요 테마로 하여 다양한 제주자생식물과 화산석을 만날 수 있는 생태예술정원이다. 1만 4천 평 부지에 120여 종의 수목, 200종의 야생화와 수십 종류의 수국으로 숲을 이루고 곳곳에 샤스타데이지, 수레국화, 백일홍, 코스모스 등 계절별로 다양한 꽃밭도 준비되어 있다. 정원의 남쪽으로는 탁 트인 제주바다가 펼쳐지며 북쪽으로는 한라산 백롬담을 아주 가까이 전망할 수 있다. | 이용시간: [11월~5월]- 08:30~18:00 - 입장마감 17:00[6월~10월]- 08:30~18:30- 입장마감 17:30 | 휴무: 연중무휴 | 체험: 돌낭예술원 해설 투어 | 주차: 가능 | 입장료: [일반] - 성인(만 19세~만 64세) 10,000원 - 청소년(만 13세~18세) 8,000원 - 어린이(36개월~만 12세) 3,000원 - 경로(만 65세 이상) / 군인 / 임산부 8,000원 - 장애인(중증 1~3급) / 보훈 및 4·3유가족 7,000원 [도민 / 단체(20인 이상)] - 성인(만 19세~만 64세) 8,000원 - 청소년(만 13세~18세) 7,000원 - 어린이(생후36개월~만 12세) 3,000원 - 경로(만 65세 이상) / 군인 / 임산부 7,000원 - 장애인(중증 1~3급) / 보훈 및 4·3유가족 6,000원 ※ 이용요금은 변동될 수 있으므로 자세한 사항은 홈페이지 참조 또는 전화 문의 요망",
      "failure_reason": null,
      "content_fingerprint": "d66acbe85d88fd4cda19ec873a89020a44d21119a8331920893cd1ba56cb1857"
    },
    {
      "source_id": "web:3545719",
      "contentid": "3545719",
      "publisher": "돌낭예술원",
      "source_type": "official_place",
      "url": "https://www.dolnangartgarden.com/",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "1만4천 평 부지의 수목·야생화·꽃밭과 바다·한라산 전망을 걷는 야외 생태예술정원이다.",
      "failure_reason": null,
      "content_fingerprint": "2c62610865f7bd468dbfbf714a3759c8eda3eff7a302ec021a3db8a0b5287180"
    },
    {
      "source_id": "tourapi:4026808",
      "contentid": "4026808",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 신화테마파크는 제주 신화월드 내 위치하여 동화 같은 상상력과 즐거움을 선사하는 대한민국 대표 가족형 테마파크입니다. 다채로운 어트랙션과 이색적인 공연을 통해 남녀노소 누구나 잊지 못할 행복한 추억을 만드는 꿈의 전당입니다.",
      "failure_reason": null,
      "content_fingerprint": "9a3d9ebdea7bdcc2a3828fe456dbd675410e7390a4b00e76e361fac057b02504"
    },
    {
      "source_id": "web:4026808",
      "contentid": "4026808",
      "publisher": "제주신화월드",
      "source_type": "official_place",
      "url": "https://www.shinhwaworld.com/themepark.jhtml",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "exact TourAPI 설명에 대응하는 공식 시설 페이지가 야외 놀이기구·공연과 일부 실내 어트랙션의 테마파크 구성을 안내한다.",
      "failure_reason": null,
      "content_fingerprint": "8cd39751351a7f6782680464f6a92a0b417859e8cf61bb560bcb3c67e4221b28"
    },
    {
      "source_id": "web:4026808:weather",
      "contentid": "4026808",
      "publisher": "제주신화월드",
      "source_type": "official_place",
      "url": "https://www.shinhwaworld.com/themeparktip/39959.jhtml",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "동일 시설의 공식 FAQ가 우천 시 일부 시설 제한·공연 취소와 기상 악화 시 단축 운영·휴장 가능성을 안내한다.",
      "failure_reason": null,
      "content_fingerprint": "d3285eb19cd2a01c713cdece175235b2525f91db8a4734826798002aaacc56b2"
    },
    {
      "source_id": "tourapi:4026831",
      "contentid": "4026831",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 제주동화마을은 제주의 아름다운 풍경 속에 동화 같은 상상력을 입힌 테마형 라이프스타일 브랜드입니다. 제주의 자연과 캐릭터 콘텐츠가 어우러진 공간 체험과 굿즈를 통해 방문객들에게 마법 같은 순간을 제공합니다.",
      "failure_reason": null,
      "content_fingerprint": "ab08066839238dbc91815caa6ae194ba078b618b4930190b847d184df17e8f54"
    },
    {
      "source_id": "web:4026831",
      "contentid": "4026831",
      "publisher": "제주동화마을",
      "source_type": "official_place",
      "url": "https://www.jejudonghwa.com/",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": false,
      "evidence_summary": "공식 페이지는 야외 공원과 복수 실내 상점을 함께 설명하지만, contentid 4026831이 어느 쇼핑 facet을 지칭하는지 특정할 수 없다.",
      "failure_reason": null,
      "content_fingerprint": "fbfd42b03a32396be67dd9d9c8804435e77e8bb87c9ae2304a4bdca1271d8e41"
    },
    {
      "source_id": "tourapi:741109",
      "contentid": "741109",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 안덕면 상창리에 조성된 카멜리아힐은 세계에서 가장 큰 동백꽃을 비롯하여 가장 일찍 피는 동백꽃, 향기를 내는 동백꽃에 이르기까지 전 세계 500여 종 6000여 그루의 동백나무가 한데 모여 있다. 카멜리아힐은 동백과 함께 야자수 등 각종 조경수가 함께 어우러진 수목원이기도 하다. 야생화 코너를 비롯해 넓은 잔디광장, 생태연못 등도 골고루 갖추고 있다. 초가 별장과 목조 별장, 스틸하우스, 콘도형 별장 등 다양한 숙박시설을 비롯해 동백꽃을 소재로 제작된 공예품을 전시하는 갤러리, 다목적 세미나실도 마련했다. 카멜리아 힐은 30년 열정과 사랑으로 제주의 자연을 담은, 동양에서 가장 큰 동백 수목원이다. 가을부터 봄까지 시기를 달리해서 피는 동백나무 500여 품종 6000여 그루가 울창한 숲을 이루고 있다. 또 향기가 나는 동백을 보유하고 있어서 달콤하고 매혹적인 동백의 향기에 흠뻑 취할 수 있다. 그뿐만 아니라 제주 자생식물 250여 종을 비롯해 모양과 색깔, 향기가 각기 다른 다양한 꽃이 동백과 어우러져 계절마다 독특하고 아름다운 풍경을 연출해 준다. ◎ 한류의 매력을 만나는 여행 정보 - 예능 주원과 유정이 데이트를 즐기며 많은 시청자들에게 대리 설렘을 느끼게 했던 장소다. 수목원이라 사계절 아름답지만, 특히 동백이 피는 겨울에 붉은 꽃망울로 장관을 이룬다. | 이용시간: [하절기/간절기(3월~11월)]- 08:30~18:30- 입장 마감 17:30[동절기(11월~2월)]- 08:30~18:00- 입장 마감 17:00 | 휴무: 연중무휴 | 주차: 가능 | 입장료: [개인] - 성인 12,000원 - 청소년/경로/군인 10,000원 - 어린이/장애인/보훈대상/4.3유족 9,000원 [단체(30명 이상)] - 성인 10,000원 - 청소년/경로/군인 9,000원 - 어린이/장애인/보훈대상/4.3유족 8,000원 ※ 자세한 입장료는 공식 홈페이지 참조 | 주차요금: 무료 | 화장실: 있음",
      "failure_reason": null,
      "content_fingerprint": "dcdb8862c93f01a4dae930bf418ec6e03d12d3ce0e2dc50704d70cf97a938cbb"
    },
    {
      "source_id": "web:741109",
      "contentid": "741109",
      "publisher": "카멜리아힐",
      "source_type": "official_place",
      "url": "https://www.camelliahill.co.kr/information",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "야외 동백숲·정원·전망대 순환 관람이 본체이고 갤러리·온실·카페는 보조 시설이다.",
      "failure_reason": null,
      "content_fingerprint": "57d3e8df76181538b9c5bac584047c184f5285f5e6eaa0209df38eb61bb073ff"
    },
    {
      "source_id": "tourapi:802844",
      "contentid": "802844",
      "publisher": "한국관광공사",
      "source_type": "tourapi_detail",
      "url": "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "개요: 한라생태숲은 1970년대 초부터 1995년까지 개인에게 대부돼 마소의 방목지로 사용했던 곳이었다. 제주 식물의 보고에 걸맞은 산림생물 난대, 온대, 한대 식물 등 다양한 식물상을 조화롭게 설계하여 식재 생태복원 시켰으며, 곶자왈 지대, 천연림 지역을 유전자원 보전지역으로 관리하고 있다. 또한 한라생태숲은 시험연구림으로서의 기능도 갖추고 있어 제주도의 온.난대 수종 및 한라산 고산대 희귀수종에 대한 유전자 보전 연구와 한라산의 훼손지 복구를 위한 식물증식 및 내한성 적응시험림의 역할도 수행하고 있다. 한라생태숲은 훼손되어 방치되었던 야초지를 원래의 숲으로 복원 조성한 곳으로 산림트래킹과 함께 자연생태계의 다양한 모습을 즐길 수 있다. 한라산에 서식하는 동물을 만날 수 있으며, 특히 난대성식물에서부터 한라산 고산식물까지 모두 볼 수 있다. 생태로, 전망대, 양묘하우스, 테마별 산책로, 유전자보존 조직배양실 등 기반시설과 단풍나무숲, 벚나무숲, 구상나무숲, 참꽃나무숲 등 13개의 테마숲, 생태숲 전체의 축소판인 암석원이 중앙에 조성되어 숲다운 숲의 면모를 보여주고 있다. | 이용시간: [하절기(3~10월)] 9:00~18:00 (입장 마감 17:00) [동절기(11~2월)] 9:00~17:00 (입장 마감 16:00) | 휴무: 연중무휴 | 주차: 가능 | 주차요금: 무료 | 화장실: 있음 | 입 장 료: 무료 | 이용가능시설: 탐방안내센터 / 전망대 / 파고라 등",
      "failure_reason": null,
      "content_fingerprint": "d5bf298b3886c33ee2f21a1b2063e7533c26c8f309d544cfa3c1a33e9d6a6cfa"
    },
    {
      "source_id": "web:802844",
      "contentid": "802844",
      "publisher": "제주특별자치도 한라생태숲",
      "source_type": "official_place",
      "url": "https://www.jeju.go.kr/hallaecoforest/visit/info.htm",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "야외 숲·탐방로·트레킹이 핵심이다.",
      "failure_reason": null,
      "content_fingerprint": "301e910cf78785b31a0fb2a80f6b54249d2ff1f59955955fb1b594e20c454668"
    },
    {
      "source_id": "web:802844:weather",
      "contentid": "802844",
      "publisher": "제주특별자치도 한라생태숲",
      "source_type": "official_place",
      "url": "https://www.jeju.go.kr/hallaecoforest/community/notice.htm?act=view&seq=2025986",
      "checked_at": "2026-08-10T23:16:16+09:00",
      "retrieval_status": "ok",
      "identity_match": true,
      "evidence_summary": "강풍주의보에 따라 숲길 탐방로를 통제한 공지다.",
      "failure_reason": null,
      "content_fingerprint": "7a4d7e856af1df4ed664fa3157f9bd9b67605a9bb4e55663c617c72faccd7b49"
    }
  ]
});
