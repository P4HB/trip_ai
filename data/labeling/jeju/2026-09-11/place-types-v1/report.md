# 기존 지도 장소 대표 유형 분류

SPEC-075 / place-primary-types-v1.2-review-complete

기존 지도 2,153곳의 규칙 기반 분류 초안. 사람 전수 검수·일일 상한 적용은 아직 하지 않았다.
원본 분류 코드와 기존 조사 근거를 사용했다. rule_classified는 자동 판정, user_confirmed는 사용자가 대표 유형을 확정한 항목이다.
primary_type 한 개를 향후 하루 횟수 집계 단위로 사용한다. unknown 및 needs_review는 검토 전 확정 상한 집계에 사용하지 않는다.

- 전체: 2153 / 추천 준비: 1663 / 사용자 확정: 27 / 검토 필요: 0 / 미분류: 0

| 유형 ID | 이름 | 전체 | 추천 준비 | 정의 |
|---|---|---:|---:|---|
| mountain_oreum | 산·오름 | 94 | 94 | 산 정상·오름·분화구를 탐방하는 장소 |
| coast_beach | 해변·해안 | 115 | 115 | 해수욕장·해안·포구·해안도로의 경관 감상 |
| forest | 숲·휴양림 | 24 | 24 | 숲·곶자왈·자연휴양림의 산책과 탐방 |
| garden | 정원·수목원·꽃밭 | 34 | 34 | 식재된 정원·수목원·차밭·꽃밭 감상 |
| park | 공원 | 21 | 21 | 도시·생태공원 산책과 휴식 |
| museum_exhibition | 박물관·미술관·전시 | 79 | 79 | 자료·미술·미디어아트·과학 전시 관람 |
| cafe | 카페·찻집·베이커리 | 243 | 232 | 음료·차·디저트 중심 방문 |
| historic_religious | 유적·종교시설 | 61 | 61 | 역사 유적·기념물·사찰·성당 관람 |
| village_street | 마을·거리 | 20 | 20 | 마을·골목·문화거리 탐방 |
| island | 섬 | 12 | 12 | 섬 전체가 후보인 경우; 내부 장소와 별도 ID 유지 |
| viewpoint | 전망대·등대·경관시설 | 18 | 18 | 독립 전망대·등대·교량·경관 건축물 감상 |
| cave_geology | 동굴·지질명소 | 9 | 9 | 동굴·화석·지질 명소 관찰 |
| waterfall_valley | 폭포·계곡 | 16 | 16 | 폭포·계곡·하천 경관 감상 |
| lake_wetland | 호수·습지 | 7 | 7 | 못·저수지·습지·철새 관찰지 |
| animal_aquarium | 동물·목장·수족관 | 16 | 16 | 동물 관찰·먹이 체험·목장·수족관 |
| farm_experience | 농어촌 체험 | 43 | 43 | 수확·농어촌 생활·어촌 체험 |
| craft_experience | 공방·만들기 체험 | 9 | 9 | 공예·요리·양조 등 제작·산업 체험 |
| theme_park | 테마파크·놀이시설 | 25 | 25 | 복합 테마·놀이·미로·워터파크 |
| marine_activity | 수상·해양 레저 | 29 | 29 | 서핑·카약·요트·다이빙·낚시·유람·잠수함·수영 |
| land_activity | 육상 레저·스포츠 | 46 | 46 | 승마·카트·골프·ATV·스포츠 시설 |
| walking_route | 걷기·트레킹 코스 | 47 | 47 | 명시된 장거리 도보·올레·트레킹 경로 |
| spa_wellness | 온천·스파·웰니스 | 8 | 8 | 온천·족욕·명상·치유 프로그램 |
| performance | 공연 | 7 | 7 | 공연 관람 중심 시설 |
| market | 전통시장 | 20 | 20 | 정기·상설 전통시장 방문 |
| shopping | 쇼핑·서점 | 382 | 382 | 상품·기념품·책 구매 중심 장소 |
| restaurant | 음식점·주점 | 479 | 0 | 식사·주류 중심 장소 |
| accommodation | 숙박 | 213 | 213 | 호텔·리조트·펜션 등 숙박 |
| camping | 캠핑 | 22 | 22 | 캠핑·글램핑·카라반 |
| event | 축제·행사 | 28 | 28 | 기간이 있는 축제·행사 후보; 개최 여부는 별도 검증 |
| culture_learning | 문화·교육 체험시설 | 15 | 15 | 도서관·문화센터·교육·안전 체험 |
| transport_info | 교통·관광안내 | 4 | 4 | 여객선·관광안내·탐방안내 시설 |
| tourism_area | 관광단지·광역명소 | 4 | 4 | 여러 독립 장소를 포함하는 관광 권역 |
| unknown | 미분류 | 0 | 0 | 대표 경험 근거 부족으로 검토 필요 |
| scenic_walk | 경관·걷기 | 3 | 3 | 경관 감상과 가벼운 걷기를 함께 하는 길·언덕·경관도로; 사용자 지정 장소부터 적용 |

## 검토 필요

| ID | 장소 | 임시 유형 | 사유 |
|---|---|---|---|

## 전체 장소

| ID | 장소 | 대표 유형 | 판정 |
|---|---|---|---|
| 125445 | 생각하는 정원 | 정원·수목원·꽃밭 | rule_classified |
| 126434 | 수월봉 | 산·오름 | rule_classified |
| 126435 | 성산일출봉 [유네스코 세계자연유산] | 산·오름 | rule_classified |
| 126436 | 성판악 | 산·오름 | rule_classified |
| 126437 | 정방폭포 | 폭포·계곡 | rule_classified |
| 126438 | 천지연폭포 | 폭포·계곡 | rule_classified |
| 126439 | 천제연폭포 | 폭포·계곡 | rule_classified |
| 126440 | 안덕계곡 | 폭포·계곡 | rule_classified |
| 126441 | 돈내코 원앙폭포 | 폭포·계곡 | rule_classified |
| 126443 | 화순금모래해수욕장 | 해변·해안 | rule_classified |
| 126444 | 차귀도 | 섬 | rule_classified |
| 126445 | 제주 토끼섬 문주란 자생지 | 섬 | rule_classified |
| 126446 | 가파도 | 섬 | rule_classified |
| 126447 | 신양섭지해수욕장 | 해변·해안 | rule_classified |
| 126448 | 이호테우해변 | 해변·해안 | rule_classified |
| 126449 | 중문색달해수욕장 | 해변·해안 | rule_classified |
| 126450 | 마라도 | 섬 | rule_classified |
| 126451 | 함덕해수욕장 (함덕 서우봉 해변) | 해변·해안 | rule_classified |
| 126452 | 만장굴 (제주도 국가지질공원) | 동굴·지질명소 | rule_classified |
| 126454 | 사라봉공원 | 산·오름 | rule_classified |
| 126455 | 한림공원 | 공원 | user_confirmed |
| 126456 | 관음사(제주) | 유적·종교시설 | rule_classified |
| 126457 | 산방굴사(제주) | 유적·종교시설 | rule_classified |
| 126458 | 원당사지 | 유적·종교시설 | rule_classified |
| 126459 | 모충사 | 유적·종교시설 | rule_classified |
| 126460 | 관덕정(제주) | 유적·종교시설 | rule_classified |
| 126461 | 산천단곰솔 | 공원 | rule_classified |
| 126462 | 오현단 | 유적·종교시설 | rule_classified |
| 126463 | 연북정 | 유적·종교시설 | rule_classified |
| 126464 | 여미지식물원 | 정원·수목원·꽃밭 | rule_classified |
| 126465 | 혼인지 | 호수·습지 | rule_classified |
| 126466 | 퍼시픽 리솜 | 수상·해양 레저 | user_confirmed |
| 126467 | 무수천 | 폭포·계곡 | rule_classified |
| 126468 | 방선문 | 폭포·계곡 | rule_classified |
| 126469 | 한라산 영실 | 산·오름 | rule_classified |
| 126470 | 외돌개(제주) | 해변·해안 | rule_classified |
| 126471 | 성읍민속마을 | 유적·종교시설 | rule_classified |
| 126472 | 비자림 | 숲·휴양림 | rule_classified |
| 126473 | 연화못(하가못) | 호수·습지 | rule_classified |
| 126474 | 산굼부리 | 산·오름 | rule_classified |
| 126665 | 서귀포잠수함 | 수상·해양 레저 | rule_classified |
| 126672 | 송악산 | 산·오름 | rule_classified |
| 127046 | 김녕미로공원 | 테마파크·놀이시설 | rule_classified |
| 127048 | 문섬·섶섬·범섬·새섬 | 섬 | rule_classified |
| 127049 | 삼매봉 | 산·오름 | rule_classified |
| 127050 | 강정천 | 폭포·계곡 | rule_classified |
| 127051 | 고근산 | 산·오름 | rule_classified |
| 127052 | 엉또폭포 | 폭포·계곡 | rule_classified |
| 127053 | 대포주상절리 | 해변·해안 | rule_classified |
| 127055 | 사라봉(모충사) 의병항쟁기념탑 | 유적·종교시설 | rule_classified |
| 127202 | 어승생 | 산·오름 | rule_classified |
| 127283 | 이중섭 거주지 | 유적·종교시설 | rule_classified |
| 127310 | 금산공원(납읍난대림지대) | 숲·휴양림 | rule_classified |
| 127336 | 우도 | 섬 | rule_classified |
| 127363 | 우도잠수함 | 수상·해양 레저 | rule_classified |
| 127479 | 제주절물자연휴양림 | 숲·휴양림 | rule_classified |
| 127490 | 협재해수욕장 | 해변·해안 | rule_classified |
| 127492 | 중문관광단지 | 관광단지·광역명소 | user_confirmed |
| 127514 | 한라수목원 | 정원·수목원·꽃밭 | rule_classified |
| 127520 | 서귀포 김정희 유배지 | 유적·종교시설 | rule_classified |
| 127529 | 비양도 | 섬 | rule_classified |
| 127635 | 한라산 | 산·오름 | rule_classified |
| 127743 | 제주향교 | 유적·종교시설 | rule_classified |
| 127744 | 제주 삼성혈 | 유적·종교시설 | rule_classified |
| 127745 | 용연 | 폭포·계곡 | rule_classified |
| 127813 | 섭지코지 | 해변·해안 | rule_classified |
| 127857 | 일출랜드 | 공원 | rule_classified |
| 127860 | 금능석물원 | 정원·수목원·꽃밭 | rule_classified |
| 127861 | 제주 서귀포 산방산 | 산·오름 | rule_classified |
| 127862 | 약천사(제주) | 유적·종교시설 | rule_classified |
| 127863 | 추자도 | 섬 | rule_classified |
| 127870 | 곽지해수욕장 | 해변·해안 | rule_classified |
| 127909 | 명월대 | 유적·종교시설 | rule_classified |
| 128049 | 제주 센트럴파크 | 테마파크·놀이시설 | rule_classified |
| 128050 | 제주 항파두리 항몽 유적 | 유적·종교시설 | rule_classified |
| 128150 | 서광차밭 | 정원·수목원·꽃밭 | rule_classified |
| 128154 | 성산포유람선 | 수상·해양 레저 | rule_classified |
| 128175 | 서귀포자연휴양림 | 숲·휴양림 | rule_classified |
| 128326 | 신풍리체험휴양마을 | 농어촌 체험 | rule_classified |
| 128330 | 위미1리어촌체험마을 | 농어촌 체험 | rule_classified |
| 128345 | 제주허브동산 | 정원·수목원·꽃밭 | rule_classified |
| 128443 | 교래 삼다수마을 | 농어촌 체험 | rule_classified |
| 128444 | 낙천아홉굿마을 | 농어촌 체험 | rule_classified |
| 128555 | 제주 산방산탄산온천 | 온천·스파·웰니스 | rule_classified |
| 128556 | 제주러브랜드 | 테마파크·놀이시설 | rule_classified |
| 128640 | 알뜨르비행장 및 일본군 비행기 격납고 | 유적·종교시설 | rule_classified |
| 128641 | 제주목 관아 | 유적·종교시설 | rule_classified |
| 128665 | 워터월드 제주 | 테마파크·놀이시설 | rule_classified |
| 128777 | 돌하르방미술관 | 박물관·미술관·전시 | rule_classified |
| 128793 | 형제섬 | 섬 | rule_classified |
| 128794 | 표선해수욕장 | 해변·해안 | rule_classified |
| 128795 | 남원 큰엉해안 | 해변·해안 | rule_classified |
| 128796 | 별방진 | 유적·종교시설 | rule_classified |
| 128802 | 마라도가는여객선 | 교통·관광안내 | rule_classified |
| 128838 | 서귀포유람선 | 수상·해양 레저 | rule_classified |
| 129071 | 오조마을 | 마을·거리 | rule_classified |
| 129072 | 신양마을 | 마을·거리 | rule_classified |
| 129073 | 구엄어촌체험마을 | 농어촌 체험 | rule_classified |
| 129074 | 우도마을 | 마을·거리 | rule_classified |
| 129076 | 보목마을 | 마을·거리 | rule_classified |
| 129145 | 마라도 등대 | 전망대·등대·경관시설 | rule_classified |
| 129146 | 추자도 등대 | 전망대·등대·경관시설 | rule_classified |
| 129147 | 우도 등대 | 전망대·등대·경관시설 | rule_classified |
| 129148 | 산지 등대 | 전망대·등대·경관시설 | rule_classified |
| 129276 | 숨도 | 정원·수목원·꽃밭 | rule_classified |
| 129326 | 서귀포 예래생태마을 | 농어촌 체험 | rule_classified |
| 129327 | 서귀포 용왕난드르마을 | 농어촌 체험 | rule_classified |
| 129381 | 서귀포 알토산마을 | 농어촌 체험 | rule_classified |
| 129384 | 제주성지 | 유적·종교시설 | rule_classified |
| 129395 | 천지연 걸매생태공원 | 공원 | rule_classified |
| 129400 | 김녕해수욕장 | 해변·해안 | rule_classified |
| 129401 | 삼양해수욕장 | 해변·해안 | rule_classified |
| 129402 | 방사탑(제주) | 유적·종교시설 | rule_classified |
| 129403 | 복신미륵 | 유적·종교시설 | rule_classified |
| 129405 | 소정방폭포 | 폭포·계곡 | rule_classified |
| 129455 | 제주 삼양동 유적 | 유적·종교시설 | rule_classified |
| 129617 | 쇠소깍 | 폭포·계곡 | rule_classified |
| 129619 | 협재동굴 | 동굴·지질명소 | rule_classified |
| 129620 | 쌍용굴(한림공원) | 동굴·지질명소 | rule_classified |
| 129699 | 금오름 | 산·오름 | rule_classified |
| 129767 | 서귀포시립기당미술관 | 박물관·미술관·전시 | rule_classified |
| 129894 | 제주특별자치도 민속자연사박물관 | 박물관·미술관·전시 | rule_classified |
| 129895 | 제주 탑동해변공연장 | 공연 | rule_classified |
| 130036 | 제주문화원 | 문화·교육 체험시설 | rule_classified |
| 130088 | 제주교육박물관 | 박물관·미술관·전시 | rule_classified |
| 130141 | 한국야구명예전당 | 박물관·미술관·전시 | rule_classified |
| 130180 | 아프리카 박물관 | 박물관·미술관·전시 | rule_classified |
| 130193 | 서귀포문화원 | 문화·교육 체험시설 | rule_classified |
| 130308 | 제주항일기념관 | 박물관·미술관·전시 | rule_classified |
| 130317 | 테디베어뮤지엄 제주 | 박물관·미술관·전시 | rule_classified |
| 130363 | 초콜릿 박물관 | 박물관·미술관·전시 | rule_classified |
| 130461 | 국립제주박물관 | 박물관·미술관·전시 | rule_classified |
| 130474 | 제주민속촌 | 박물관·미술관·전시 | rule_classified |
| 130494 | 이중섭 미술관 | 박물관·미술관·전시 | rule_classified |
| 130512 | 제주아트서커스 | 공연 | rule_classified |
| 130682 | 서복전시관 | 박물관·미술관·전시 | rule_classified |
| 130723 | 김영갑갤러리두모악 | 박물관·미술관·전시 | rule_classified |
| 130745 | 제주통일관 | 박물관·미술관·전시 | rule_classified |
| 130853 | 건강과 성 박물관(제주) | 박물관·미술관·전시 | rule_classified |
| 130856 | 제주돌마을공원 | 공원 | user_confirmed |
| 130857 | 제주해녀박물관 | 박물관·미술관·전시 | rule_classified |
| 130872 | 제주국제평화센터 | 박물관·미술관·전시 | rule_classified |
| 130877 | 제주국제컨벤션센터 | 문화·교육 체험시설 | rule_classified |
| 131103 | 추자군도 | 섬 | user_confirmed |
| 131106 | 제주항 서부두방파제 | 해변·해안 | user_confirmed |
| 131107 | 차귀도 바다낚시 | 수상·해양 레저 | rule_classified |
| 131222 | 제주청소년수련원 | 문화·교육 체험시설 | rule_classified |
| 131268 | 오라컨트리클럽 | 육상 레저·스포츠 | rule_classified |
| 131269 | 캐슬렉스제주 골프클럽 | 육상 레저·스포츠 | rule_classified |
| 131546 | 어승생승마장 | 육상 레저·스포츠 | rule_classified |
| 131549 | 오케이 승마장 | 육상 레저·스포츠 | rule_classified |
| 131589 | 알프스제주 | 육상 레저·스포츠 | rule_classified |
| 131596 | 송당승마장 | 육상 레저·스포츠 | rule_classified |
| 131604 | 탐라승마장 | 육상 레저·스포츠 | rule_classified |
| 131623 | 제주해양레저 | 육상 레저·스포츠 | rule_classified |
| 131644 | 서귀포시청소년수련관 | 문화·교육 체험시설 | rule_classified |
| 131649 | 크라운컨트리클럽 | 육상 레저·스포츠 | rule_classified |
| 131708 | 중문골프클럽 | 육상 레저·스포츠 | rule_classified |
| 131717 | 제주월드컵경기장 | 육상 레저·스포츠 | rule_classified |
| 131784 | 대유ATV수렵사격랜드 | 육상 레저·스포츠 | rule_classified |
| 131829 | 제주제트 | 수상·해양 레저 | rule_classified |
| 131836 | 네모바지선 | 수상·해양 레저 | rule_classified |
| 131949 | 성읍승마장 | 육상 레저·스포츠 | rule_classified |
| 132159 | 고성오일시장 | 전통시장 | rule_classified |
| 132160 | 표선오일시장 | 전통시장 | rule_classified |
| 132161 | 대정오일시장 | 전통시장 | rule_classified |
| 132251 | 한국기념품백화점 | 쇼핑·서점 | rule_classified |
| 132556 | 서귀포향토오일시장 | 전통시장 | rule_classified |
| 132595 | 중문향토오일시장 | 전통시장 | rule_classified |
| 133258 | 도라지식당 | 음식점·주점 | rule_classified |
| 133974 | 옹포별장가든 | 음식점·주점 | rule_classified |
| 133976 | 초원흑돼지 | 음식점·주점 | rule_classified |
| 133990 | 큰갯물횟집 | 음식점·주점 | rule_classified |
| 134977 | 보영반점 | 음식점·주점 | rule_classified |
| 134980 | 성산해촌 | 음식점·주점 | rule_classified |
| 135288 | 고우니가든 | 음식점·주점 | rule_classified |
| 135919 | 돔베돈 | 음식점·주점 | rule_classified |
| 136453 | 썬랜드 호텔 | 숙박 | rule_classified |
| 137348 | 신세계호텔 | 숙박 | rule_classified |
| 137368 | 켄싱턴리조트 제주한림 | 숙박 | rule_classified |
| 137369 | 켄싱턴리조트 서귀포 | 숙박 | rule_classified |
| 137476 | 토비스콘도 제주 | 숙박 | rule_classified |
| 137788 | 서귀포 귤림성 | 숙박 | rule_classified |
| 137814 | 제주 금강산콘도 | 숙박 | rule_classified |
| 137826 | 라운지하우스 제주다 | 숙박 | rule_classified |
| 137957 | 티파니에서 아침을 | 숙박 | rule_classified |
| 138017 | 청재설헌 | 숙박 | rule_classified |
| 138019 | 소노캄 제주 | 숙박 | rule_classified |
| 138184 | 해비치 호텔&리조트 제주 | 숙박 | rule_classified |
| 138185 | 금호리조트 제주 | 숙박 | rule_classified |
| 138195 | 한화리조트 제주 | 숙박 | rule_classified |
| 138494 | 귤익는마을 | 숙박 | rule_classified |
| 138594 | 솔바람풍경소리 | 숙박 | rule_classified |
| 138597 | 그림리조트 | 숙박 | rule_classified |
| 138602 | 제주목화휴양펜션 | 숙박 | rule_classified |
| 138935 | 이어도성 펜션 | 숙박 | rule_classified |
| 139008 | 비치스토리호텔 | 숙박 | rule_classified |
| 139854 | 제주 라임오렌지빌 | 숙박 | rule_classified |
| 139855 | 그랑빌펜션 | 숙박 | rule_classified |
| 139856 | JJ하우스 | 숙박 | rule_classified |
| 139860 | 마레보 비치호텔 | 숙박 | rule_classified |
| 140930 | 탐라문화제 | 축제·행사 | rule_classified |
| 141736 | 서귀포유채꽃축제 | 축제·행사 | rule_classified |
| 142713 | 제주 스위트호텔 | 숙박 | rule_classified |
| 142943 | 제주 퍼시픽 호텔 | 숙박 | rule_classified |
| 142946 | 제주신라호텔 | 숙박 | rule_classified |
| 142948 | 씨에스 호텔 앤 리조트 | 숙박 | rule_classified |
| 142957 | 메종 글래드 제주 | 숙박 | rule_classified |
| 142965 | 서귀포칼호텔 (서귀포KAL호텔) | 숙박 | rule_classified |
| 142968 | 제주로얄호텔 | 숙박 | rule_classified |
| 142970 | 제주팔레스호텔 | 숙박 | rule_classified |
| 142972 | 제주 오리엔탈 호텔 | 숙박 | rule_classified |
| 142976 | 펄호텔제주 | 숙박 | rule_classified |
| 143025 | 롯데호텔 제주 | 숙박 | rule_classified |
| 143036 | 스타즈호텔 헤리티지 | 숙박 | rule_classified |
| 143120 | 오션그랜드호텔제주 | 숙박 | rule_classified |
| 228853 | 용두암 | 해변·해안 | rule_classified |
| 228854 | 용머리해안 | 해변·해안 | rule_classified |
| 228859 | 수월봉과 차귀해안 | 해변·해안 | rule_classified |
| 228864 | 절부암 | 해변·해안 | rule_classified |
| 231986 | 세리월드 | 육상 레저·스포츠 | rule_classified |
| 232284 | 제주애 펜션 | 숙박 | rule_classified |
| 232287 | 소노벨 제주 | 숙박 | rule_classified |
| 250412 | 용두암해수랜드 | 온천·스파·웰니스 | rule_classified |
| 264590 | 한라산 백록담 | 산·오름 | rule_classified |
| 309943 | 법화사 | 유적·종교시설 | rule_classified |
| 315926 | 보덕사(제주) | 유적·종교시설 | rule_classified |
| 316058 | 보림사(제주) | 유적·종교시설 | rule_classified |
| 317558 | 불탑사(제주) | 유적·종교시설 | rule_classified |
| 318339 | 선광사(제주) | 유적·종교시설 | rule_classified |
| 322836 | 휴애리자연생활공원 | 공원 | rule_classified |
| 347233 | 월영사(제주) | 유적·종교시설 | rule_classified |
| 347234 | 월정사(제주) | 유적·종교시설 | rule_classified |
| 397635 | 씨오르리조트 | 숙박 | rule_classified |
| 397643 | C&P리조트 | 숙박 | rule_classified |
| 404121 | 서귀포괸당네 | 음식점·주점 | rule_classified |
| 404126 | 굼부리식당 | 음식점·주점 | rule_classified |
| 404128 | 금강민물장어 | 음식점·주점 | rule_classified |
| 404135 | 대우정 | 음식점·주점 | rule_classified |
| 404139 | 등경돌식당 | 음식점·주점 | rule_classified |
| 404141 | 명원가든 | 음식점·주점 | rule_classified |
| 404151 | 생원전복 | 음식점·주점 | rule_classified |
| 404156 | 성읍칠십리식당 | 음식점·주점 | rule_classified |
| 404158 | 표선세화해녀의집 | 음식점·주점 | rule_classified |
| 404165 | 왕일번지식당 | 음식점·주점 | rule_classified |
| 404168 | 오조해녀의집 | 음식점·주점 | rule_classified |
| 404173 | 장수해장국 | 음식점·주점 | rule_classified |
| 404175 | 제주뚝배기 | 음식점·주점 | rule_classified |
| 404180 | 진미명가 | 음식점·주점 | rule_classified |
| 404182 | 천제연토속 | 음식점·주점 | rule_classified |
| 404185 | 하르방밀면 | 음식점·주점 | rule_classified |
| 404187 | 한성식당 | 음식점·주점 | rule_classified |
| 404193 | 고관심해장국 | 음식점·주점 | rule_classified |
| 404202 | 삼대국수회관 | 음식점·주점 | rule_classified |
| 404209 | 어장군 | 음식점·주점 | rule_classified |
| 404214 | 유빈 | 음식점·주점 | rule_classified |
| 404216 | 야자수식당 | 음식점·주점 | rule_classified |
| 482093 | 천왕사(제주) | 유적·종교시설 | rule_classified |
| 506616 | 서귀포칠십리축제 | 축제·행사 | rule_classified |
| 526666 | 제주유리박물관 | 박물관·미술관·전시 | rule_classified |
| 572960 | 용눈이오름 | 산·오름 | rule_classified |
| 572968 | 따라비 오름 | 산·오름 | rule_classified |
| 572973 | 새별오름 | 산·오름 | rule_classified |
| 577461 | 다랑쉬오름(월랑봉) | 산·오름 | rule_classified |
| 577899 | 쇠소깍축제 | 축제·행사 | rule_classified |
| 583141 | 휘닉스 아일랜드 | 숙박 | rule_classified |
| 590415 | 감귤박물관 | 박물관·미술관·전시 | rule_classified |
| 591798 | 하고수동해변 | 해변·해안 | rule_classified |
| 591866 | 금능해수욕장 | 해변·해안 | rule_classified |
| 594065 | 방림원 | 정원·수목원·꽃밭 | user_confirmed |
| 596964 | 세계자동차&피아노 박물관 | 박물관·미술관·전시 | rule_classified |
| 597562 | 제주현대미술관 | 박물관·미술관·전시 | rule_classified |
| 598187 | 선녀와나무꾼 | 테마파크·놀이시설 | rule_classified |
| 598558 | 우도산호해변 홍조단괴 서빈백사 | 해변·해안 | rule_classified |
| 598635 | 검멀레해변 | 해변·해안 | rule_classified |
| 598696 | 소머리오름(우도봉) | 산·오름 | rule_classified |
| 599863 | 동복해녀식당 | 음식점·주점 | rule_classified |
| 600584 | 금호리조트 제주아쿠아나 | 테마파크·놀이시설 | rule_classified |
| 601489 | 서귀포해양도립공원 | 관광단지·광역명소 | user_confirmed |
| 635460 | 제주도예촌 | 공방·만들기 체험 | rule_classified |
| 635593 | 갈중이(천연염색체험) | 공방·만들기 체험 | rule_classified |
| 635701 | 신풍 신천 바다목장 | 해변·해안 | rule_classified |
| 635928 | 최남단체험감귤농장 | 농어촌 체험 | rule_classified |
| 636073 | 다이브랜드 | 수상·해양 레저 | rule_classified |
| 636266 | 거문오름 | 산·오름 | rule_classified |
| 636393 | 제주선인장마을 | 마을·거리 | rule_classified |
| 637212 | 제주마방목지 | 동물·목장·수족관 | rule_classified |
| 637398 | 말 테마파크 골프장 (렛츠런파크 제주) | 육상 레저·스포츠 | rule_classified |
| 653140 | 엘리시안 제주 컨트리클럽 | 육상 레저·스포츠 | rule_classified |
| 655015 | 한라식당 | 음식점·주점 | rule_classified |
| 655543 | 서울뚝배기 | 음식점·주점 | rule_classified |
| 655553 | 신제주삼보식당 | 음식점·주점 | rule_classified |
| 660876 | 다인리조트 | 숙박 | rule_classified |
| 660972 | 하도리 철새도래지 | 호수·습지 | rule_classified |
| 664081 | 삼성혈해물탕 | 음식점·주점 | rule_classified |
| 664154 | 옛날옛적 성산본점 | 음식점·주점 | rule_classified |
| 664204 | 해오름 | 음식점·주점 | rule_classified |
| 664223 | 네거리식당 | 음식점·주점 | rule_classified |
| 664982 | 서귀포흑돼지명가 | 음식점·주점 | rule_classified |
| 665594 | 더마파크 | 테마파크·놀이시설 | user_confirmed |
| 667418 | 제주들불축제 | 축제·행사 | rule_classified |
| 686399 | 황금어장 | 음식점·주점 | rule_classified |
| 687563 | 제주미향 | 음식점·주점 | rule_classified |
| 687869 | 도남오거리식당 | 음식점·주점 | rule_classified |
| 696841 | 테디베어하우스 테지움 | 박물관·미술관·전시 | rule_classified |
| 719643 | 담앤루리조트 | 숙박 | rule_classified |
| 733414 | 노인과바다 | 숙박 | rule_classified |
| 733422 | 롱비치펜션 | 숙박 | rule_classified |
| 733516 | 바다에누워 펜션 | 숙박 | rule_classified |
| 733540 | 보물섬펜션 | 숙박 | rule_classified |
| 733569 | 뷰티풀하우스 | 숙박 | rule_classified |
| 733594 | 제주 써니데이 | 숙박 | rule_classified |
| 733613 | 아망뜨펜션(제주) | 숙박 | rule_classified |
| 733622 | 앙끄리에펜션 | 숙박 | rule_classified |
| 733684 | 제주바다산책 | 숙박 | rule_classified |
| 733784 | 제주 하이랜드 펜션 | 숙박 | rule_classified |
| 733799 | 제주 지삿개풍경 | 숙박 | rule_classified |
| 733924 | 해뜨는집 펜션 | 숙박 | rule_classified |
| 735314 | 까델아스 | 숙박 | rule_classified |
| 735781 | 꼬뜨도르 호텔 | 숙박 | rule_classified |
| 741109 | 카멜리아힐 | 정원·수목원·꽃밭 | rule_classified |
| 745313 | 제주별빛누리공원 | 박물관·미술관·전시 | rule_classified |
| 745449 | 다희연 | 정원·수목원·꽃밭 | rule_classified |
| 759595 | 제주특별자치도립미술관 | 박물관·미술관·전시 | rule_classified |
| 770036 | 성산포 해녀물질공연장 | 공연 | rule_classified |
| 778296 | 광명사(제주) | 유적·종교시설 | rule_classified |
| 780778 | 이상한나라의 앨리스 | 테마파크·놀이시설 | rule_classified |
| 782905 | 한라산컨트리클럽 | 육상 레저·스포츠 | rule_classified |
| 801097 | 제주 명도암참살이마을 | 농어촌 체험 | rule_classified |
| 802844 | 한라생태숲 | 숲·휴양림 | rule_classified |
| 819583 | 조안베어뮤지엄 | 박물관·미술관·전시 | rule_classified |
| 820822 | 돌하르방식당 | 음식점·주점 | rule_classified |
| 820903 | 대관원 | 음식점·주점 | rule_classified |
| 824619 | 한라산 트레킹 | 걷기·트레킹 코스 | rule_classified |
| 824811 | 늘송파크텔 | 숙박 | rule_classified |
| 879234 | 새연교 | 전망대·등대·경관시설 | rule_classified |
| 879633 | 물드리네 | 공방·만들기 체험 | rule_classified |
| 904802 | 제주 추억여행 | 숙박 | rule_classified |
| 905600 | 제주 뉴오션리조트 | 숙박 | rule_classified |
| 906173 | 제주 씨에코비치 | 숙박 | rule_classified |
| 921281 | 서귀포 유채꽃 국제걷기대회 | 축제·행사 | rule_classified |
| 930345 | 한수풀 해녀학교 | 문화·교육 체험시설 | rule_classified |
| 935073 | 라헨느리조트 | 숙박 | rule_classified |
| 970675 | 스프링힐 리조트 | 숙박 | rule_classified |
| 971331 | 오션하우스 | 숙박 | rule_classified |
| 972415 | 밀레니엄빌 | 숙박 | rule_classified |
| 973990 | 씨에나펜션 | 숙박 | rule_classified |
| 976820 | 제주시민속오일시장 (2, 7일) | 전통시장 | rule_classified |
| 977101 | 애월해안누리(구 하얀둥지) | 숙박 | rule_classified |
| 978165 | 포시즌펜션 | 숙박 | rule_classified |
| 978214 | 제주썬레이크빌 | 숙박 | rule_classified |
| 978343 | 샤뜰레 펜션 | 숙박 | rule_classified |
| 980356 | 제주펜션 향림원 | 숙박 | rule_classified |
| 983958 | 엘리시안 제주 | 숙박 | rule_classified |
| 984523 | 제주 블랙스톤 | 숙박 | rule_classified |
| 984562 | 타미우스골프&빌리지 | 숙박 | rule_classified |
| 984611 | 라온호텔 앤 리조트 | 숙박 | rule_classified |
| 985385 | 아침의향기 | 숙박 | rule_classified |
| 987913 | 점보빌리지 | 동물·목장·수족관 | rule_classified |
| 988207 | 서귀포천문과학문화관 | 박물관·미술관·전시 | rule_classified |
| 988238 | 제주 블랙스톤 골프클럽 | 육상 레저·스포츠 | rule_classified |
| 988441 | 선임교 | 전망대·등대·경관시설 | rule_classified |
| 989025 | 라온골프클럽 | 육상 레저·스포츠 | rule_classified |
| 989206 | 아난티 클럽 제주 | 육상 레저·스포츠 | rule_classified |
| 989242 | 에버리스골프리조트 | 육상 레저·스포츠 | rule_classified |
| 992261 | 세화민속오일시장(5일, 0일) | 전통시장 | rule_classified |
| 992309 | 보성시장 | 전통시장 | rule_classified |
| 993224 | 한림민속오일시장 | 전통시장 | rule_classified |
| 993261 | 서문공설시장 | 전통시장 | rule_classified |
| 1013246 | 동문재래시장 | 전통시장 | rule_classified |
| 1013258 | 서귀포매일올레시장 | 전통시장 | rule_classified |
| 1013289 | 이제주숍 | 쇼핑·서점 | rule_classified |
| 1014672 | 제주 중앙지하상가 | 쇼핑·서점 | rule_classified |
| 1018723 | 하영 흑돼지구이집 | 음식점·주점 | rule_classified |
| 1019491 | 흑돈가 제주 | 음식점·주점 | rule_classified |
| 1019521 | 진주식당 | 음식점·주점 | rule_classified |
| 1019773 | 제주레저힐링축제 | 축제·행사 | rule_classified |
| 1064572 | 김녕요트투어 | 수상·해양 레저 | rule_classified |
| 1069144 | 사라봉 | 산·오름 | rule_classified |
| 1069292 | 별도봉 | 산·오름 | rule_classified |
| 1069322 | 산지천 | 폭포·계곡 | rule_classified |
| 1146121 | 에코랜드테마파크 | 테마파크·놀이시설 | rule_classified |
| 1162240 | 제주도 국가지질공원 | 관광단지·광역명소 | user_confirmed |
| 1206420 | 제주힐링명상테마파크 | 온천·스파·웰니스 | rule_classified |
| 1215292 | 사라오름 | 산·오름 | rule_classified |
| 1220821 | 세계조가비박물관 | 박물관·미술관·전시 | rule_classified |
| 1305270 | 수희식당 | 음식점·주점 | rule_classified |
| 1308810 | 해진횟집 | 음식점·주점 | rule_classified |
| 1329201 | 메이즈랜드 | 테마파크·놀이시설 | rule_classified |
| 1348840 | 예래펜션 | 숙박 | rule_classified |
| 1351196 | 저지오름(닥몰오름,새오름) | 산·오름 | rule_classified |
| 1351320 | 아부오름 | 산·오름 | rule_classified |
| 1403482 | 오션스위츠 제주호텔 | 숙박 | rule_classified |
| 1404293 | 바그다드 | 음식점·주점 | rule_classified |
| 1405489 | 라지마할 | 음식점·주점 | rule_classified |
| 1420586 | 해녀횟집 | 음식점·주점 | rule_classified |
| 1544730 | 제주돌문화공원 | 박물관·미술관·전시 | rule_classified |
| 1556005 | 그리스신화박물관 | 박물관·미술관·전시 | rule_classified |
| 1620863 | 양금석가옥 | 유적·종교시설 | rule_classified |
| 1620883 | 하모해변 | 해변·해안 | rule_classified |
| 1620936 | 이중섭거리 | 마을·거리 | rule_classified |
| 1620988 | 이어도 승마장 | 육상 레저·스포츠 | rule_classified |
| 1620997 | 하멜기념비 | 유적·종교시설 | rule_classified |
| 1621032 | 평화통일 불사리탑 | 유적·종교시설 | rule_classified |
| 1621045 | 신촌향사 | 유적·종교시설 | rule_classified |
| 1621059 | 구시물 | 폭포·계곡 | rule_classified |
| 1621077 | 세화해수욕장 | 해변·해안 | rule_classified |
| 1621118 | 제주해녀항일운동기념탑 | 유적·종교시설 | rule_classified |
| 1621147 | 정의향교 | 유적·종교시설 | rule_classified |
| 1621155 | 제주 성읍마을 고평오 고택 | 유적·종교시설 | rule_classified |
| 1621161 | 제주 성읍마을 고창환 고택 | 유적·종교시설 | rule_classified |
| 1621165 | 정의현성 | 유적·종교시설 | rule_classified |
| 1621175 | 대정향교 | 유적·종교시설 | rule_classified |
| 1672315 | 제주 노루생태관찰원 | 동물·목장·수족관 | rule_classified |
| 1690237 | 산지천축제 | 축제·행사 | rule_classified |
| 1737497 | 초콜릿랜드 | 박물관·미술관·전시 | rule_classified |
| 1755101 | 제주승마공원 | 육상 레저·스포츠 | rule_classified |
| 1755350 | 탑 승마클럽 | 육상 레저·스포츠 | rule_classified |
| 1755806 | 제주아트센터 | 공연 | rule_classified |
| 1769266 | 제주 세계자연유산센터 | 박물관·미술관·전시 | rule_classified |
| 1798082 | 본태박물관 | 박물관·미술관·전시 | rule_classified |
| 1812994 | 조랑말체험공원 | 동물·목장·수족관 | user_confirmed |
| 1821483 | 제주올레하우스 | 숙박 | rule_classified |
| 1823088 | 서귀포시축협 축산물플라자 | 음식점·주점 | rule_classified |
| 1827714 | 올래국수 | 음식점·주점 | rule_classified |
| 1827790 | 돈사돈 | 음식점·주점 | rule_classified |
| 1828308 | 소라횟집 | 음식점·주점 | rule_classified |
| 1828395 | 순옥이네명가 | 음식점·주점 | rule_classified |
| 1834279 | 2026 하영 빛나는 서귀포 | 축제·행사 | rule_classified |
| 1839451 | [제주올레 1코스] 시흥-광치기 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839477 | [제주올레 2코스] 광치기-온평 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839491 | [제주올레 3코스] 온평-표선 올레 (A) | 걷기·트레킹 코스 | rule_classified |
| 1839536 | [제주올레 4코스] 표선-남원 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839552 | [제주올레 5코스] 남원-쇠소깍 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839621 | [제주올레 6코스] 쇠소깍-제주올레 여행자센터 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839630 | [제주올레 7코스] 제주올레 여행자센터 - 월평 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839701 | [제주올레 8코스] 월평-대평 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839709 | [제주올레 9코스] 대평-화순 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839713 | [제주올레 10코스] 화순-모슬포 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839727 | [제주올레 11코스] 모슬포-무릉 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839772 | [제주올레 12코스] 무릉-용수 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839784 | [제주올레 13코스] 용수-저지 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839801 | [제주올레 14코스] 저지-한림 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839833 | [제주올레 15코스] 한림-고내 올레 (A) | 걷기·트레킹 코스 | rule_classified |
| 1839864 | [제주올레 16코스] 고내-광령 올레 | 걷기·트레킹 코스 | rule_classified |
| 1839866 | [제주올레 17코스] 광령-제주원도심 올레 | 걷기·트레킹 코스 | rule_classified |
| 1840777 | [제주올레 18코스] 제주원도심-조천 올레 | 걷기·트레킹 코스 | rule_classified |
| 1840837 | [제주올레 19코스] 조천-김녕 올레 | 걷기·트레킹 코스 | rule_classified |
| 1840882 | [제주올레 20코스] 김녕-하도 올레 | 걷기·트레킹 코스 | rule_classified |
| 1840913 | [제주올레 21코스] 하도-종달 올레 | 걷기·트레킹 코스 | rule_classified |
| 1841003 | [제주올레 1-1코스] 우도-올레 | 걷기·트레킹 코스 | rule_classified |
| 1841056 | [제주올레 7-1코스] 서귀포 버스터미널 - 제주올레 여행자센터 올레 | 걷기·트레킹 코스 | rule_classified |
| 1841279 | [제주올레 10-1코스] 가파도 올레 | 걷기·트레킹 코스 | rule_classified |
| 1841313 | [제주올레 14-1코스] 저지-서광 올레 | 걷기·트레킹 코스 | rule_classified |
| 1844163 | [제주올레 18-1코스] 추자도 올레 | 걷기·트레킹 코스 | rule_classified |
| 1846473 | 신신호텔 제주오션 | 숙박 | rule_classified |
| 1847757 | 해녀촌 | 음식점·주점 | rule_classified |
| 1853848 | 바다하우스 | 숙박 | rule_classified |
| 1861280 | 은희네해장국 | 음식점·주점 | rule_classified |
| 1861333 | 비지곶식당 | 음식점·주점 | rule_classified |
| 1861336 | 광양해장국집 | 음식점·주점 | rule_classified |
| 1861360 | 모이세해장국 | 음식점·주점 | rule_classified |
| 1861656 | 1100고지습지 | 호수·습지 | rule_classified |
| 1862763 | 더 아일랜더 | 쇼핑·서점 | rule_classified |
| 1863246 | 바당수산 | 쇼핑·서점 | rule_classified |
| 1864828 | 제일토산품 | 쇼핑·서점 | rule_classified |
| 1865762 | 삼다도횟집 | 음식점·주점 | rule_classified |
| 1866904 | 가시식당 | 음식점·주점 | rule_classified |
| 1866954 | 감나무집 | 음식점·주점 | rule_classified |
| 1867129 | 제주민속식품(사월의 꿩) | 쇼핑·서점 | rule_classified |
| 1867998 | 고불락 | 음식점·주점 | rule_classified |
| 1868009 | 골막식당 | 음식점·주점 | rule_classified |
| 1869305 | 나.미.송 | 숙박 | rule_classified |
| 1871024 | 제주칠성로상점가 | 쇼핑·서점 | rule_classified |
| 1871028 | 중문농수산물직판장 | 쇼핑·서점 | rule_classified |
| 1872476 | 그옛맛 | 음식점·주점 | rule_classified |
| 1874612 | 지속가능환경교육센터 | 문화·교육 체험시설 | rule_classified |
| 1876804 | 금바우흑돼지참숯구이 | 음식점·주점 | rule_classified |
| 1876813 | 김대감숯불갈비 | 음식점·주점 | rule_classified |
| 1876822 | 깜돈 흑돼지 | 음식점·주점 | rule_classified |
| 1876994 | 낭뜰에쉼팡 | 음식점·주점 | rule_classified |
| 1876996 | 내가 찾은 맛고을 | 음식점·주점 | rule_classified |
| 1877056 | 다래향 | 음식점·주점 | rule_classified |
| 1877081 | 다미회 | 음식점·주점 | rule_classified |
| 1880892 | 제주카사블랑카 | 숙박 | rule_classified |
| 1881664 | 독개물항 | 음식점·주점 | rule_classified |
| 1882201 | 돈향기 | 음식점·주점 | rule_classified |
| 1882274 | 벵가스테이 | 숙박 | rule_classified |
| 1882353 | 둠비정원 | 음식점·주점 | rule_classified |
| 1882504 | 킴스캐빈 | 숙박 | rule_classified |
| 1883573 | 마돈 | 음식점·주점 | rule_classified |
| 1883622 | 만부정 | 음식점·주점 | rule_classified |
| 1883646 | 만세국수 | 음식점·주점 | rule_classified |
| 1883815 | 박물관은살아있다 제주 | 박물관·미술관·전시 | rule_classified |
| 1884191 | 가마오름 | 산·오름 | rule_classified |
| 1884505 | 가문이오름(감은이오름) | 산·오름 | rule_classified |
| 1884521 | 가새기오름 | 산·오름 | rule_classified |
| 1885746 | 가세오름 | 산·오름 | rule_classified |
| 1885754 | 가시오름 | 산·오름 | rule_classified |
| 1887368 | 각시바위오름 | 산·오름 | rule_classified |
| 1887381 | 갈마못(갈뫼못) | 호수·습지 | rule_classified |
| 1887493 | 감낭오름 | 산·오름 | rule_classified |
| 1887546 | 프레리아 커플 독채펜션 | 숙박 | rule_classified |
| 1887866 | 갑선이오름 | 산·오름 | rule_classified |
| 1887873 | 개오름 | 산·오름 | rule_classified |
| 1888034 | 소랑호젠 | 숙박 | rule_classified |
| 1889809 | 개오리오름 | 산·오름 | rule_classified |
| 1889833 | 갯거리오름 | 산·오름 | rule_classified |
| 1890152 | 거린사슴 | 산·오름 | rule_classified |
| 1890177 | 동검은이오름 | 산·오름 | rule_classified |
| 1890343 | 동부농원 | 쇼핑·서점 | rule_classified |
| 1890872 | 뒤굽은이오름 | 산·오름 | rule_classified |
| 1891566 | 와이리조트 제주 | 숙박 | rule_classified |
| 1891943 | 맛있는 집 | 음식점·주점 | rule_classified |
| 1891955 | 명문가시리식당 | 음식점·주점 | rule_classified |
| 1892305 | 몽생이 | 음식점·주점 | rule_classified |
| 1892321 | 무인카페 산책 | 카페·찻집·베이커리 | rule_classified |
| 1893137 | 펠리스타운 | 숙박 | rule_classified |
| 1893993 | 하얀언덕 | 숙박 | rule_classified |
| 1894943 | 포도호텔 | 숙박 | rule_classified |
| 1895611 | 천아오름 | 산·오름 | rule_classified |
| 1895633 | 비양봉 | 산·오름 | rule_classified |
| 1895793 | 바다잔치 | 음식점·주점 | rule_classified |
| 1896032 | 가름게스트하우스 | 숙박 | rule_classified |
| 1896087 | 범섬앞어촌계횟집 | 음식점·주점 | rule_classified |
| 1896538 | 오라숲소리 | 음식점·주점 | rule_classified |
| 1896585 | 금뽕똘 | 음식점·주점 | rule_classified |
| 1896649 | 본가 1호점 | 음식점·주점 | rule_classified |
| 1897905 | 노을담은뜨락 | 숙박 | rule_classified |
| 1898255 | 호텔제이엠 | 숙박 | rule_classified |
| 1898484 | 붉은오름자연휴양림 | 숲·휴양림 | rule_classified |
| 1898906 | 엉알해안 | 해변·해안 | rule_classified |
| 1899959 | 도리미오름 | 산·오름 | rule_classified |
| 1905280 | THE BAY 제주리조트 (더베이 제주리조트) | 숙박 | rule_classified |
| 1905844 | 비울채울 | 숙박 | rule_classified |
| 1906127 | 샤론의집 | 숙박 | rule_classified |
| 1906195 | 동백동산 | 숲·휴양림 | rule_classified |
| 1906211 | 두맹이골목 | 마을·거리 | rule_classified |
| 1907801 | 제주4·3평화공원 | 박물관·미술관·전시 | rule_classified |
| 1909258 | 수다뜰 | 음식점·주점 | rule_classified |
| 1909319 | 종달수다뜰 | 음식점·주점 | rule_classified |
| 1911160 | 헬로키티아일랜드 | 박물관·미술관·전시 | rule_classified |
| 1918413 | 지미봉 | 산·오름 | rule_classified |
| 1918417 | 제지기오름 | 산·오름 | rule_classified |
| 1918421 | 폭낭오름 | 산·오름 | rule_classified |
| 1918639 | 월정리해변(월정리해수욕장) | 해변·해안 | rule_classified |
| 1918643 | 한대오름 | 산·오름 | rule_classified |
| 1918646 | 거슨새미오름 | 산·오름 | rule_classified |
| 1918950 | 괴오름 | 산·오름 | rule_classified |
| 1918965 | 걸서악(걸세오름) | 산·오름 | rule_classified |
| 1918984 | 구두리오름 | 산·오름 | rule_classified |
| 1923590 | 하늬복이오름 | 산·오름 | rule_classified |
| 1925362 | 어영공원 | 공원 | rule_classified |
| 1925366 | 열안지오름(오라동) | 산·오름 | rule_classified |
| 1925369 | 열안지오름(봉개동) | 산·오름 | rule_classified |
| 1926354 | 오백나한 | 산·오름 | rule_classified |
| 1926369 | 정물알오름 | 산·오름 | rule_classified |
| 1926379 | 정물오름 | 산·오름 | rule_classified |
| 1926601 | 모구리오름 | 산·오름 | rule_classified |
| 1928045 | 모지오름 | 산·오름 | rule_classified |
| 1928421 | 다려도 | 섬 | rule_classified |
| 1928430 | 도너리오름 | 산·오름 | rule_classified |
| 1932636 | 제주 메이플호텔 | 숙박 | rule_classified |
| 1933208 | 둔지봉 | 산·오름 | rule_classified |
| 1933217 | 바늘오름 | 산·오름 | rule_classified |
| 1936039 | 서건도 | 섬 | rule_classified |
| 1936339 | 제주 청수리마을 | 농어촌 체험 | rule_classified |
| 1937744 | 소심한 책방 | 쇼핑·서점 | rule_classified |
| 1939078 | 조천읍도서관 | 문화·교육 체험시설 | rule_classified |
| 1939093 | 삼매봉도서관 | 문화·교육 체험시설 | rule_classified |
| 1939121 | 법환동 청소년문화의집 | 문화·교육 체험시설 | user_confirmed |
| 1941153 | 삼의악오름 | 산·오름 | rule_classified |
| 1945208 | 수악(물오름) | 산·오름 | rule_classified |
| 1945394 | 손지오름 | 산·오름 | rule_classified |
| 1945414 | 새신오름 | 산·오름 | rule_classified |
| 1945578 | 소남머리 | 해변·해안 | rule_classified |
| 1945592 | 송아오름 | 산·오름 | rule_classified |
| 1945768 | 군산오름 | 산·오름 | rule_classified |
| 1952520 | 차귀도요트 | 수상·해양 레저 | rule_classified |
| 1957971 | 제주도 관광특구 | 관광단지·광역명소 | user_confirmed |
| 1960087 | 귤림서원 | 유적·종교시설 | rule_classified |
| 1964460 | 바당국수 | 음식점·주점 | rule_classified |
| 1964507 | 놀맨 | 음식점·주점 | rule_classified |
| 1965800 | 높은오름 | 산·오름 | rule_classified |
| 1966821 | 모드락572 | 카페·찻집·베이커리 | rule_classified |
| 1973369 | 윗세오름 | 산·오름 | rule_classified |
| 1979715 | 호텔레오 | 숙박 | rule_classified |
| 1981890 | 베니키아 호텔 제주 | 숙박 | rule_classified |
| 1984133 | 바다는안보여요 | 카페·찻집·베이커리 | rule_classified |
| 1984236 | 백기해녀의집 | 음식점·주점 | rule_classified |
| 1984251 | 삼복가든 | 음식점·주점 | rule_classified |
| 1984252 | 새둥지 | 음식점·주점 | rule_classified |
| 1984253 | 성미가든 | 음식점·주점 | rule_classified |
| 1984276 | 오늘은 회 | 음식점·주점 | rule_classified |
| 1984286 | 용두암해촌 | 음식점·주점 | rule_classified |
| 1984486 | 오름가든 | 음식점·주점 | rule_classified |
| 1986683 | 청운식당 | 음식점·주점 | rule_classified |
| 1993734 | 녹산로 유채꽃도로 | 농어촌 체험 | rule_classified |
| 2007416 | 루체빌리조트 | 숙박 | rule_classified |
| 2019719 | 제주알(R)호텔 | 숙박 | rule_classified |
| 2021434 | 산들애풀하우스 | 숙박 | rule_classified |
| 2023328 | 하도어촌체험마을 | 농어촌 체험 | rule_classified |
| 2023350 | 제주 동백마을 | 농어촌 체험 | rule_classified |
| 2027184 | 금룡사(제주) | 유적·종교시설 | rule_classified |
| 2027203 | 백제사 | 유적·종교시설 | rule_classified |
| 2031663 | 김만덕기념관 | 박물관·미술관·전시 | rule_classified |
| 2035397 | 오름나그네 | 음식점·주점 | rule_classified |
| 2038553 | 베니키아 중문호텔 | 숙박 | rule_classified |
| 2045014 | 유수암마을 | 농어촌 체험 | rule_classified |
| 2046954 | 롯데시티호텔 제주 | 숙박 | rule_classified |
| 2048059 | 아쿠아플라넷 제주 | 동물·목장·수족관 | rule_classified |
| 2358196 | 동박생이 | 숙박 | rule_classified |
| 2359165 | 검은여닭도가니 | 음식점·주점 | rule_classified |
| 2359168 | 안거리 밖거리 | 음식점·주점 | rule_classified |
| 2359240 | 88돼지 | 음식점·주점 | rule_classified |
| 2363045 | 와랑와랑 | 카페·찻집·베이커리 | rule_classified |
| 2370834 | 산방산‧용머리해안 지질트레일 | 걷기·트레킹 코스 | rule_classified |
| 2371631 | 제30회 제주국제관광마라톤축제 | 축제·행사 | rule_classified |
| 2374023 | 샘모루펜션 | 숙박 | rule_classified |
| 2374199 | 나운터횟집 | 음식점·주점 | rule_classified |
| 2382246 | 제이뷰호텔 | 숙박 | rule_classified |
| 2384971 | 지오아라 | 카페·찻집·베이커리 | rule_classified |
| 2384996 | 젠하이드어웨이 | 카페·찻집·베이커리 | rule_classified |
| 2385005 | 카페코지 | 카페·찻집·베이커리 | rule_classified |
| 2390111 | 동광리농촌체험마을 | 농어촌 체험 | rule_classified |
| 2405466 | 카이로스 | 숙박 | rule_classified |
| 2405964 | 팜밸리 풀빌라 | 숙박 | rule_classified |
| 2406368 | 더럭펜션 | 숙박 | rule_classified |
| 2406460 | 제주 추사관 | 박물관·미술관·전시 | rule_classified |
| 2411625 | 호텔리젠트마린 제주 | 숙박 | rule_classified |
| 2414812 | 신산공원 | 공원 | rule_classified |
| 2414827 | 사려니숲길 | 걷기·트레킹 코스 | rule_classified |
| 2418778 | 다이나믹 메이즈 제주 | 테마파크·놀이시설 | rule_classified |
| 2433925 | 물영아리오름 | 산·오름 | rule_classified |
| 2434545 | 새연교 주말 문화공연 '금토금토 새연쇼' | 축제·행사 | rule_classified |
| 2469467 | 맥파이 브루어리 | 공방·만들기 체험 | rule_classified |
| 2472824 | 넥슨컴퓨터박물관 | 박물관·미술관·전시 | rule_classified |
| 2479639 | 제주불빛정원 | 정원·수목원·꽃밭 | rule_classified |
| 2481642 | 사해방흑돼지 | 음식점·주점 | rule_classified |
| 2498637 | 용산 제주유스호스텔 | 숙박 | rule_classified |
| 2498698 | 제주빅볼랜드 | 육상 레저·스포츠 | rule_classified |
| 2498717 | 월정 투명카약 | 수상·해양 레저 | rule_classified |
| 2499031 | WE호텔 | 숙박 | rule_classified |
| 2499713 | 송당나무 | 카페·찻집·베이커리 | rule_classified |
| 2503694 | 제주맥주 | 공방·만들기 체험 | rule_classified |
| 2516416 | 낙타트레킹 | 동물·목장·수족관 | rule_classified |
| 2522221 | 제주레포츠랜드 | 육상 레저·스포츠 | rule_classified |
| 2528102 | 꿈꾸는 노마드 | 숙박 | rule_classified |
| 2552837 | 제주 스카브로호텔 | 숙박 | rule_classified |
| 2553685 | 수목원테마파크(아이스뮤지엄) | 테마파크·놀이시설 | rule_classified |
| 2554570 | 제주샘주 양조장 | 공방·만들기 체험 | rule_classified |
| 2556500 | 제주마중 | 숙박 | rule_classified |
| 2561880 | 제주신화월드 호텔 앤 리조트 랜딩관 | 숙박 | rule_classified |
| 2561909 | 제주신화월드 호텔 앤 리조트 메리어트관 | 숙박 | rule_classified |
| 2561932 | 제주신화월드 호텔 앤 리조트 서머셋 | 숙박 | rule_classified |
| 2562214 | 신화테마파크 | 테마파크·놀이시설 | rule_classified |
| 2562239 | 신화워터파크 | 테마파크·놀이시설 | rule_classified |
| 2562475 | 동해미락 | 음식점·주점 | rule_classified |
| 2563236 | 향원복집 | 음식점·주점 | rule_classified |
| 2564158 | 광치기해변 | 해변·해안 | rule_classified |
| 2571240 | 제이엠그랑블루요트 | 수상·해양 레저 | rule_classified |
| 2594519 | 엘린호텔 | 숙박 | rule_classified |
| 2602741 | 종달리 해안도로 | 해변·해안 | rule_classified |
| 2602774 | 쉼한모금 | 카페·찻집·베이커리 | rule_classified |
| 2605527 | 에코그린리조트 | 숙박 | rule_classified |
| 2606209 | 화조원 | 동물·목장·수족관 | rule_classified |
| 2606211 | 피규어뮤지엄제주 | 박물관·미술관·전시 | rule_classified |
| 2606214 | 윈드1947 카트테마파크 | 육상 레저·스포츠 | rule_classified |
| 2606298 | 성이시돌목장 | 동물·목장·수족관 | rule_classified |
| 2606611 | 자연사랑미술관 | 박물관·미술관·전시 | rule_classified |
| 2606690 | 왈종미술관 | 박물관·미술관·전시 | rule_classified |
| 2606696 | 제주대 벚꽃길 | 정원·수목원·꽃밭 | rule_classified |
| 2609373 | 9.81 파크 제주 | 육상 레저·스포츠 | rule_classified |
| 2615028 | 서귀포 하논분화구 | 동굴·지질명소 | rule_classified |
| 2621853 | 돈내코힐 리조트 | 숙박 | rule_classified |
| 2621914 | 마라도 가파도 정기여객선 | 교통·관광안내 | rule_classified |
| 2621955 | 바다해호텔 | 숙박 | rule_classified |
| 2621969 | 펜션연리 | 숙박 | rule_classified |
| 2623005 | 백패커스홈 | 숙박 | rule_classified |
| 2623014 | 브릭216 | 숙박 | rule_classified |
| 2623579 | 틸다하우스 | 숙박 | rule_classified |
| 2623827 | 엠버리조트 | 숙박 | rule_classified |
| 2624249 | 취다선리조트(취다선 리조트 Tea&Meditation) | 숙박 | rule_classified |
| 2626055 | 나이스호텔 | 숙박 | rule_classified |
| 2626708 | 해성파크텔 | 숙박 | rule_classified |
| 2626800 | 오션힐스테이 | 숙박 | rule_classified |
| 2627229 | 천지연크리스탈호텔 | 숙박 | rule_classified |
| 2627908 | 칠십리호텔 | 숙박 | rule_classified |
| 2627965 | 제주브릭스 | 숙박 | rule_classified |
| 2633955 | 서프라이즈 테마파크 | 테마파크·놀이시설 | rule_classified |
| 2634320 | 아인스 호스텔 | 숙박 | rule_classified |
| 2638440 | 고흐의정원 | 박물관·미술관·전시 | user_confirmed |
| 2638441 | 제주탐나라공화국 | 테마파크·놀이시설 | rule_classified |
| 2652545 | 닭머르해안길 | 해변·해안 | rule_classified |
| 2660122 | 제주라프 | 육상 레저·스포츠 | user_confirmed |
| 2660763 | 서귀포 치유의 숲 | 숲·휴양림 | rule_classified |
| 2660802 | 오설록 티뮤지엄 | 박물관·미술관·전시 | rule_classified |
| 2661407 | 제주항공우주박물관 | 박물관·미술관·전시 | rule_classified |
| 2661514 | 휴림 | 숲·휴양림 | user_confirmed |
| 2661519 | 고살리 숲길 | 숲·휴양림 | rule_classified |
| 2661523 | 북촌마을 4·3길 | 유적·종교시설 | rule_classified |
| 2661821 | 신풍리 밭담길 | 마을·거리 | rule_classified |
| 2661848 | [한라산 둘레길 1구간] 천아숲길 | 걷기·트레킹 코스 | rule_classified |
| 2662724 | 머체왓숲길 | 걷기·트레킹 코스 | rule_classified |
| 2662743 | 엉덩물계곡 | 폭포·계곡 | rule_classified |
| 2663244 | 방주교회 | 유적·종교시설 | rule_classified |
| 2663250 | 신창풍차해안도로 | 해변·해안 | rule_classified |
| 2664574 | 허니문하우스 | 카페·찻집·베이커리 | rule_classified |
| 2666735 | 해녀의 부엌 | 음식점·주점 | rule_classified |
| 2667498 | 에덴호스텔 | 숙박 | rule_classified |
| 2667643 | 카이 호스텔 | 숙박 | rule_classified |
| 2674014 | 비체올린 | 테마파크·놀이시설 | user_confirmed |
| 2675039 | [한라산 둘레길 2구간] 돌오름길 | 걷기·트레킹 코스 | rule_classified |
| 2699343 | 솔트 | 숙박 | rule_classified |
| 2699863 | 호텔 서귀피안 | 숙박 | rule_classified |
| 2704232 | 성불오름 | 산·오름 | rule_classified |
| 2704242 | 해품은체험농장 | 농어촌 체험 | rule_classified |
| 2704352 | 번영로 명품도로 | 걷기·트레킹 코스 | rule_classified |
| 2704353 | 신비의도로 | 전망대·등대·경관시설 | rule_classified |
| 2704407 | 명월성지 | 유적·종교시설 | rule_classified |
| 2704412 | 아침미소목장 | 동물·목장·수족관 | rule_classified |
| 2704435 | 하도해변 | 해변·해안 | rule_classified |
| 2704447 | 당케포구 | 해변·해안 | rule_classified |
| 2704452 | 표선세화해안도로 | 걷기·트레킹 코스 | rule_classified |
| 2704456 | 노리매공원 | 정원·수목원·꽃밭 | user_confirmed |
| 2704703 | 당산봉 | 산·오름 | rule_classified |
| 2705296 | 물뫼힐링팜 | 온천·스파·웰니스 | rule_classified |
| 2705373 | 제주레일바이크 | 걷기·트레킹 코스 | rule_classified |
| 2707417 | 서툰가족 | 숙박 | rule_classified |
| 2707930 | 소인국테마파크 | 테마파크·놀이시설 | rule_classified |
| 2708336 | 제주관광공사 중문면세점 | 쇼핑·서점 | rule_classified |
| 2708338 | 더클리프 | 음식점·주점 | rule_classified |
| 2708692 | 색달해녀의집 | 음식점·주점 | rule_classified |
| 2709579 | 위미동백나무군락 | 정원·수목원·꽃밭 | rule_classified |
| 2710029 | [제주올레 3코스] 온평-표선 올레 (B) | 걷기·트레킹 코스 | rule_classified |
| 2710165 | [제주올레 15코스] 한림-고내 올레 (B) | 걷기·트레킹 코스 | rule_classified |
| 2710264 | 옷귀마테마타운 | 육상 레저·스포츠 | rule_classified |
| 2711404 | 내창트레킹 | 걷기·트레킹 코스 | rule_classified |
| 2713583 | 제주도립김창열미술관 | 박물관·미술관·전시 | rule_classified |
| 2713585 | 왕이메오름 | 산·오름 | rule_classified |
| 2714222 | 스누피가든 | 정원·수목원·꽃밭 | user_confirmed |
| 2714241 | 아르떼뮤지엄 제주 | 박물관·미술관·전시 | rule_classified |
| 2714306 | 제주 무지개해안도로 | 해변·해안 | rule_classified |
| 2714659 | 보롬왓 | 정원·수목원·꽃밭 | user_confirmed |
| 2714826 | 수산봉 | 산·오름 | rule_classified |
| 2715354 | 새빌 | 카페·찻집·베이커리 | rule_classified |
| 2715648 | 발자국화석공원 | 해변·해안 | rule_classified |
| 2715650 | 사계해변 | 해변·해안 | rule_classified |
| 2715651 | 섯알오름 | 산·오름 | rule_classified |
| 2716736 | 신라스테이 제주 | 숙박 | rule_classified |
| 2717330 | 유민 아르누보 뮤지엄 | 박물관·미술관·전시 | rule_classified |
| 2718006 | 벤티모 호텔 앤 레지던스 제주 | 숙박 | rule_classified |
| 2718541 | 재주도좋아·반짝반짝 지구상회 | 쇼핑·서점 | rule_classified |
| 2718799 | 제로포인트트레일 | 걷기·트레킹 코스 | rule_classified |
| 2723542 | 한담해변 | 해변·해안 | rule_classified |
| 2723555 | 평대해변 | 해변·해안 | rule_classified |
| 2723689 | 서귀다원 | 정원·수목원·꽃밭 | rule_classified |
| 2724387 | 안돌오름 | 산·오름 | rule_classified |
| 2726291 | 떡하니문어떡볶이 | 음식점·주점 | rule_classified |
| 2726675 | 관음사야영장 | 캠핑 | rule_classified |
| 2726704 | 자연인캠핑장 | 캠핑 | rule_classified |
| 2728613 | 귀몽 제주신화월드 | 축제·행사 | rule_classified |
| 2729335 | 돌하르방캠핑장 | 캠핑 | rule_classified |
| 2730822 | 제주벨리타캠핑장 | 캠핑 | rule_classified |
| 2730830 | 제주플래티늄카라반 | 캠핑 | rule_classified |
| 2731801 | 백약이오름 | 산·오름 | rule_classified |
| 2734081 | 어라운드폴리 | 캠핑 | rule_classified |
| 2734909 | 귤빛캠핑장 | 캠핑 | rule_classified |
| 2737284 | 커피프렌즈촬영지 | 카페·찻집·베이커리 | rule_classified |
| 2737330 | 동문수산시장 | 전통시장 | rule_classified |
| 2738653 | 토토아뜰리에 | 공방·만들기 체험 | rule_classified |
| 2738659 | 구엄포구 | 해변·해안 | rule_classified |
| 2738665 | 도두봉 | 산·오름 | rule_classified |
| 2738671 | 서우봉둘레길 | 걷기·트레킹 코스 | rule_classified |
| 2738675 | 선운정사 | 유적·종교시설 | rule_classified |
| 2738683 | 연대포구 | 해변·해안 | rule_classified |
| 2738692 | 용연구름다리 | 전망대·등대·경관시설 | rule_classified |
| 2738701 | 월정리해안도로 | 해변·해안 | rule_classified |
| 2738705 | 용담해안도로 | 해변·해안 | rule_classified |
| 2738709 | 제주카약올레 | 수상·해양 레저 | rule_classified |
| 2738712 | 큰노꼬메오름 | 산·오름 | rule_classified |
| 2738714 | 대포포구 | 해변·해안 | rule_classified |
| 2738715 | 신도포구 | 해변·해안 | rule_classified |
| 2738721 | 미천굴 | 동굴·지질명소 | rule_classified |
| 2738724 | 자구리문화예술공원(자구리공원) | 공원 | rule_classified |
| 2738726 | 중문미로파크 | 테마파크·놀이시설 | rule_classified |
| 2738728 | 법환포구 | 해변·해안 | rule_classified |
| 2738730 | 화순곶자왈 생태탐방숲길 | 숲·휴양림 | rule_classified |
| 2738734 | 상효원수목원 | 정원·수목원·꽃밭 | rule_classified |
| 2738742 | 보목포구 | 해변·해안 | rule_classified |
| 2738761 | 동일리포구 | 해변·해안 | rule_classified |
| 2738763 | 박수기정 | 해변·해안 | rule_classified |
| 2739395 | 골체오름캠핑 | 캠핑 | rule_classified |
| 2739407 | 캠파제주 | 캠핑 | rule_classified |
| 2740014 | 노형수퍼마켙 | 박물관·미술관·전시 | rule_classified |
| 2740047 | 논짓물 | 해변·해안 | rule_classified |
| 2740052 | 예래포구 | 해변·해안 | rule_classified |
| 2740056 | 산방산 유람선 | 수상·해양 레저 | rule_classified |
| 2740067 | 5.16 도로숲터널 | 전망대·등대·경관시설 | rule_classified |
| 2740123 | 이승이오름 (이승악) | 산·오름 | rule_classified |
| 2740127 | 느지리오름 | 산·오름 | rule_classified |
| 2740129 | 위미항 | 해변·해안 | rule_classified |
| 2740130 | 문도지오름 | 산·오름 | rule_classified |
| 2740133 | 아끈다랑쉬 오름 | 산·오름 | rule_classified |
| 2740135 | 알작지 | 해변·해안 | rule_classified |
| 2741532 | 제주 베스트힐 글램핑&펜션 | 캠핑 | rule_classified |
| 2742256 | 오조포구 | 해변·해안 | rule_classified |
| 2742257 | 월평포구 | 해변·해안 | rule_classified |
| 2742267 | 용수항 | 해변·해안 | rule_classified |
| 2742297 | 월령포구 | 해변·해안 | rule_classified |
| 2742301 | 형제해안도로 | 해변·해안 | rule_classified |
| 2742307 | 싱계물공원 | 해변·해안 | rule_classified |
| 2742344 | 새별프렌즈 | 동물·목장·수족관 | rule_classified |
| 2742357 | 월령 선인장군락지 | 정원·수목원·꽃밭 | rule_classified |
| 2742373 | 청수곶자왈 | 숲·휴양림 | rule_classified |
| 2744499 | 에어그라운드 | 캠핑 | rule_classified |
| 2746268 | 삼다수숲길 | 걷기·트레킹 코스 | rule_classified |
| 2747494 | 에코힐글램핑 | 캠핑 | rule_classified |
| 2747514 | 제주도파인비치 펜션 | 캠핑 | rule_classified |
| 2748154 | 무거카라반 | 캠핑 | rule_classified |
| 2751836 | 바이나흐튼 크리스마스박물관 | 박물관·미술관·전시 | rule_classified |
| 2751843 | 제주해양동물박물관 | 박물관·미술관·전시 | rule_classified |
| 2751848 | 국제리더스클럽 | 수상·해양 레저 | rule_classified |
| 2751854 | 도치돌 알파카목장 | 동물·목장·수족관 | rule_classified |
| 2751860 | 더쉼팡스파앤풀빌라 | 숙박 | rule_classified |
| 2751986 | 포레스트 공룡사파리 | 동물·목장·수족관 | rule_classified |
| 2752277 | 선양빌리지돔 | 캠핑 | rule_classified |
| 2752730 | 바이제주 | 쇼핑·서점 | rule_classified |
| 2752733 | 제라진어드벤쳐 | 육상 레저·스포츠 | rule_classified |
| 2752761 | 별헤는밤글램핑 | 캠핑 | rule_classified |
| 2752772 | 성김대건신부표착기념관 | 박물관·미술관·전시 | rule_classified |
| 2752778 | 모이소 | 쇼핑·서점 | rule_classified |
| 2752816 | 문서프 | 수상·해양 레저 | rule_classified |
| 2753021 | 국수바다 본점 | 음식점·주점 | rule_classified |
| 2753037 | 대기정 | 음식점·주점 | rule_classified |
| 2753045 | 카페서연의집 | 카페·찻집·베이커리 | rule_classified |
| 2753082 | 파더스가든 | 정원·수목원·꽃밭 | rule_classified |
| 2755000 | 돈이랑 | 음식점·주점 | rule_classified |
| 2755006 | 만덕이네 | 음식점·주점 | rule_classified |
| 2755023 | 모슬포중앙시장 | 전통시장 | rule_classified |
| 2755049 | 유채꽃프라자 | 농어촌 체험 | rule_classified |
| 2755053 | 가람돌솥밥 | 음식점·주점 | rule_classified |
| 2755444 | 난드르바당 | 음식점·주점 | rule_classified |
| 2755445 | 드르쿰다 | 카페·찻집·베이커리 | rule_classified |
| 2755457 | 제주오성갈치조림 | 음식점·주점 | rule_classified |
| 2755458 | 중문칠돈가 | 음식점·주점 | rule_classified |
| 2755466 | 코코마마 | 음식점·주점 | rule_classified |
| 2755469 | 에코그린캠핑장 | 캠핑 | rule_classified |
| 2755470 | 해왓 | 음식점·주점 | rule_classified |
| 2755492 | 제주자연생태공원 | 동물·목장·수족관 | rule_classified |
| 2755497 | 베이힐풀앤빌라 | 숙박 | rule_classified |
| 2755870 | 바다위에코끼리 | 카페·찻집·베이커리 | rule_classified |
| 2755879 | 스마일러 | 카페·찻집·베이커리 | rule_classified |
| 2755895 | 아트인명도암 | 카페·찻집·베이커리 | rule_classified |
| 2755913 | 하우스레서피 | 카페·찻집·베이커리 | rule_classified |
| 2756099 | 봉순이네흑돼지 | 음식점·주점 | rule_classified |
| 2756100 | 오전열한시 | 음식점·주점 | rule_classified |
| 2757210 | 플레이스 캠프 제주(Playce camp Jeju) | 숙박 | rule_classified |
| 2758836 | 경미네집 | 음식점·주점 | rule_classified |
| 2758837 | 복자씨연탄구이 | 음식점·주점 | rule_classified |
| 2758844 | 중문해녀의집 | 음식점·주점 | rule_classified |
| 2758848 | 부두식당 / (주)부두식당 | 음식점·주점 | rule_classified |
| 2758855 | 해녀잠수촌 | 음식점·주점 | rule_classified |
| 2758859 | 협재해녀의집 | 음식점·주점 | rule_classified |
| 2758900 | 제주광해 애월점 | 음식점·주점 | rule_classified |
| 2758924 | 미스칠 | 음식점·주점 | rule_classified |
| 2758939 | 도두해녀의집 | 음식점·주점 | rule_classified |
| 2759036 | 도시해녀 | 농어촌 체험 | rule_classified |
| 2759061 | 고이정 | 음식점·주점 | rule_classified |
| 2759091 | 구이사이 | 음식점·주점 | rule_classified |
| 2759096 | 곰막식당/곰막 | 음식점·주점 | rule_classified |
| 2759120 | 고스트타운 | 테마파크·놀이시설 | rule_classified |
| 2759603 | 교래손칼국수(원조교래손칼국수) | 음식점·주점 | rule_classified |
| 2759608 | 삼무국수 | 음식점·주점 | rule_classified |
| 2759610 | 손맛촌 | 음식점·주점 | rule_classified |
| 2759614 | 은혜전복 | 음식점·주점 | rule_classified |
| 2759616 | 이춘옥 원조 고등어쌈밥 | 음식점·주점 | rule_classified |
| 2759624 | 도련 감귤나무 숲 | 농어촌 체험 | rule_classified |
| 2759849 | 임금님밥상 | 음식점·주점 | rule_classified |
| 2763504 | 서건도카라반 | 캠핑 | rule_classified |
| 2763726 | 제주 스위스마을 | 마을·거리 | rule_classified |
| 2763739 | 제주 교래자연휴양림 | 숲·휴양림 | rule_classified |
| 2763746 | 카페 말로 | 카페·찻집·베이커리 | rule_classified |
| 2763762 | 구좌상회 | 카페·찻집·베이커리 | rule_classified |
| 2763767 | 바다를본돼지 | 음식점·주점 | rule_classified |
| 2763771 | 바다속고등어쌈밥 | 음식점·주점 | rule_classified |
| 2763796 | 착한집 | 음식점·주점 | rule_classified |
| 2763806 | 토끼와거북이 | 음식점·주점 | rule_classified |
| 2763820 | 아날로그감귤밭 | 농어촌 체험 | rule_classified |
| 2763826 | 세계술박물관 | 박물관·미술관·전시 | rule_classified |
| 2765208 | 슬슬슬로우 | 음식점·주점 | rule_classified |
| 2765209 | 아서원 | 음식점·주점 | rule_classified |
| 2765211 | 윈드스톤 | 카페·찻집·베이커리 | rule_classified |
| 2765214 | 올레안뜰 | 음식점·주점 | rule_classified |
| 2765215 | 제주돗 | 음식점·주점 | rule_classified |
| 2765218 | 돈카츠 서황 | 음식점·주점 | rule_classified |
| 2765223 | 미악산 | 산·오름 | rule_classified |
| 2765227 | 바리메오름 | 산·오름 | rule_classified |
| 2765233 | 용수성지 | 유적·종교시설 | rule_classified |
| 2765234 | 궷물오름 | 산·오름 | rule_classified |
| 2765237 | 송악산전망대 | 전망대·등대·경관시설 | rule_classified |
| 2765240 | 천주교 대정성지 | 유적·종교시설 | rule_classified |
| 2765245 | 송악산 진지동굴 | 동굴·지질명소 | rule_classified |
| 2765248 | 삼양해안도로 | 해변·해안 | rule_classified |
| 2765252 | 새미은총의동산 | 유적·종교시설 | rule_classified |
| 2765254 | 송악카트체험장 | 육상 레저·스포츠 | rule_classified |
| 2765268 | 저지문화예술인마을 | 마을·거리 | rule_classified |
| 2765280 | 하례감귤체험농장 | 농어촌 체험 | rule_classified |
| 2765293 | 귤향기 감귤체험농장 | 농어촌 체험 | rule_classified |
| 2765319 | 서부두수산시장 | 전통시장 | rule_classified |
| 2765334 | 한림매일시장 | 전통시장 | rule_classified |
| 2765345 | 함덕민속오일시장 | 전통시장 | rule_classified |
| 2766752 | 제주아이브리조트 | 숙박 | rule_classified |
| 2766781 | 비스타리조트 | 숙박 | rule_classified |
| 2767589 | 안녕전복 | 음식점·주점 | rule_classified |
| 2767627 | 새섬공원 | 공원 | rule_classified |
| 2767628 | 맛나식당 | 음식점·주점 | rule_classified |
| 2767629 | 당케올레국수 | 음식점·주점 | rule_classified |
| 2767638 | 소금바치순이네 | 음식점·주점 | rule_classified |
| 2767663 | 제주곰집 | 음식점·주점 | rule_classified |
| 2767694 | 신설오름 | 음식점·주점 | rule_classified |
| 2767695 | 큰사슴이오름 | 산·오름 | rule_classified |
| 2767696 | 국수만찬 | 음식점·주점 | rule_classified |
| 2767704 | 백리향 | 음식점·주점 | rule_classified |
| 2767722 | 해심가든 | 음식점·주점 | rule_classified |
| 2767778 | 황우지해안열두굴 | 동굴·지질명소 | rule_classified |
| 2767779 | 태광식당 | 음식점·주점 | rule_classified |
| 2767786 | 짬뽕에취한날 | 음식점·주점 | rule_classified |
| 2767790 | 답다니탑망대 | 전망대·등대·경관시설 | rule_classified |
| 2767799 | 중문카트체험장 | 육상 레저·스포츠 | rule_classified |
| 2767814 | 쌍둥이횟집본점 | 음식점·주점 | rule_classified |
| 2767884 | 우도천진항 | 해변·해안 | rule_classified |
| 2767885 | 하우목동항 | 해변·해안 | rule_classified |
| 2767900 | 용담공원 | 공원 | rule_classified |
| 2773755 | 제주에너지누리마당 | 박물관·미술관·전시 | rule_classified |
| 2774278 | 선흘2리마을 | 마을·거리 | rule_classified |
| 2774821 | 오늘은 카트레이싱 | 육상 레저·스포츠 | rule_classified |
| 2774868 | 영실국수 | 음식점·주점 | rule_classified |
| 2774884 | 운정이네 | 음식점·주점 | rule_classified |
| 2774895 | 목장카페드르쿰다 | 카페·찻집·베이커리 | rule_classified |
| 2777791 | 인디고트리 | 카페·찻집·베이커리 | rule_classified |
| 2778044 | 전농로 벚꽃거리 | 정원·수목원·꽃밭 | rule_classified |
| 2778809 | 제주 글라스하우스 | 전망대·등대·경관시설 | rule_classified |
| 2778874 | 춘미향 | 음식점·주점 | rule_classified |
| 2778890 | 노을해안로 | 해변·해안 | rule_classified |
| 2778897 | 안성리수국길 | 정원·수목원·꽃밭 | rule_classified |
| 2778905 | 해맞이해안로 | 해변·해안 | rule_classified |
| 2778915 | 나이롱책방 | 쇼핑·서점 | rule_classified |
| 2778916 | 제주살롱 | 카페·찻집·베이커리 | rule_classified |
| 2778939 | 밤수지맨드라미 | 쇼핑·서점 | rule_classified |
| 2779435 | 월정리갈비밥 | 음식점·주점 | rule_classified |
| 2779449 | 비밀의 숲 | 숲·휴양림 | rule_classified |
| 2779454 | 종달리 수국길 | 정원·수목원·꽃밭 | rule_classified |
| 2779457 | 종달리해변 | 해변·해안 | rule_classified |
| 2779462 | 종달항(두문포항) | 해변·해안 | rule_classified |
| 2779517 | 강정포구 | 해변·해안 | rule_classified |
| 2779522 | 고산일과해안도로 | 해변·해안 | rule_classified |
| 2779527 | 구엄리 돌염전 | 해변·해안 | rule_classified |
| 2780230 | 애월튀김간 | 음식점·주점 | rule_classified |
| 2780263 | 꽃밥 | 음식점·주점 | rule_classified |
| 2781324 | 모슬포한라전복 본점 | 음식점·주점 | rule_classified |
| 2781325 | 홍성방 | 음식점·주점 | rule_classified |
| 2781326 | 김녕항 | 해변·해안 | rule_classified |
| 2781327 | 운진항 | 해변·해안 | rule_classified |
| 2781375 | 공천포식당 | 음식점·주점 | rule_classified |
| 2781386 | 세천포구 | 해변·해안 | rule_classified |
| 2781394 | 구두미포구 | 해변·해안 | rule_classified |
| 2781401 | 소천지 | 해변·해안 | rule_classified |
| 2781422 | 대포해안 | 해변·해안 | rule_classified |
| 2781427 | 만지식당 | 음식점·주점 | rule_classified |
| 2781431 | 삼보식당 | 음식점·주점 | rule_classified |
| 2781493 | 키친아루요 | 음식점·주점 | rule_classified |
| 2782843 | 슬로보트 | 카페·찻집·베이커리 | rule_classified |
| 2782858 | 카페모알보알 제주점 | 카페·찻집·베이커리 | rule_classified |
| 2782867 | 커피템플 | 카페·찻집·베이커리 | rule_classified |
| 2783304 | 갈치왕 | 음식점·주점 | rule_classified |
| 2783376 | 순천미향 제주산방산본점 | 음식점·주점 | rule_classified |
| 2783381 | 예원이네 은갈치조림 | 음식점·주점 | rule_classified |
| 2783385 | 제주로운청해원 | 음식점·주점 | rule_classified |
| 2783386 | 카페 아오오 | 카페·찻집·베이커리 | rule_classified |
| 2783393 | 크래커스 | 카페·찻집·베이커리 | rule_classified |
| 2783400 | 논짓물식당 | 음식점·주점 | rule_classified |
| 2783406 | 델문도 | 카페·찻집·베이커리 | rule_classified |
| 2783430 | 마루나키친 | 음식점·주점 | rule_classified |
| 2783440 | 에오마르 | 카페·찻집·베이커리 | rule_classified |
| 2785301 | 제주순메밀막국수 | 음식점·주점 | rule_classified |
| 2785320 | 휴일로 | 카페·찻집·베이커리 | rule_classified |
| 2785326 | 월정리 달이뜨는식탁 (달이뜨는식탁) | 음식점·주점 | rule_classified |
| 2785334 | 카페리 | 카페·찻집·베이커리 | rule_classified |
| 2785869 | 판포포구 | 해변·해안 | rule_classified |
| 2785877 | 팰롱팰롱 빛나는 | 쇼핑·서점 | rule_classified |
| 2785883 | 아날로그사운즈 | 카페·찻집·베이커리 | rule_classified |
| 2786082 | 그초록 | 카페·찻집·베이커리 | rule_classified |
| 2788115 | 제주기념품가게 올레파머스 함덕점 | 쇼핑·서점 | rule_classified |
| 2788436 | 탑동광장 | 공원 | rule_classified |
| 2788879 | 해성도뚜리 | 음식점·주점 | rule_classified |
| 2788882 | 문개항아리 조천본점 | 음식점·주점 | rule_classified |
| 2789355 | 바람 | 쇼핑·서점 | rule_classified |
| 2789378 | 제주신흥해수욕장 | 해변·해안 | rule_classified |
| 2789395 | 제주태백산본점 | 음식점·주점 | rule_classified |
| 2789609 | 대평포구 | 해변·해안 | rule_classified |
| 2789652 | 순례자의 교회 | 유적·종교시설 | rule_classified |
| 2790487 | 제주돌창고 | 카페·찻집·베이커리 | rule_classified |
| 2790670 | 사일리커피 | 카페·찻집·베이커리 | rule_classified |
| 2791194 | 어니스트밀크 본점 | 카페·찻집·베이커리 | rule_classified |
| 2791213 | 오늘은녹차한잔 | 카페·찻집·베이커리 | rule_classified |
| 2791230 | 카페 이스틀리 | 카페·찻집·베이커리 | rule_classified |
| 2791425 | 중문수두리보말칼국수 | 음식점·주점 | rule_classified |
| 2791430 | 불란지야시장 | 전통시장 | rule_classified |
| 2791433 | 고내포구 | 해변·해안 | rule_classified |
| 2791440 | 제주한라국수 | 음식점·주점 | rule_classified |
| 2791450 | 성산세화해안도로 | 해변·해안 | rule_classified |
| 2791473 | 제주커피박물관 바움 | 박물관·미술관·전시 | rule_classified |
| 2791481 | 가시아방국수 | 음식점·주점 | rule_classified |
| 2791501 | 애월해안도로 | 해변·해안 | rule_classified |
| 2791505 | 서귀포항 | 해변·해안 | rule_classified |
| 2791511 | 제주항 | 해변·해안 | rule_classified |
| 2791523 | 제주양떼목장 | 동물·목장·수족관 | rule_classified |
| 2792522 | 면뽑는선생 만두빚는아내 | 음식점·주점 | rule_classified |
| 2792533 | 버드나무집 | 음식점·주점 | rule_classified |
| 2792535 | 선흘곶 | 음식점·주점 | rule_classified |
| 2792536 | 안녕협재씨 | 음식점·주점 | rule_classified |
| 2792539 | 한림칼국수 제주본점 | 음식점·주점 | rule_classified |
| 2792543 | 협재 수우동 | 음식점·주점 | rule_classified |
| 2792565 | 이호테우 말 등대 | 전망대·등대·경관시설 | rule_classified |
| 2792568 | 조천함덕해안도로 | 해변·해안 | rule_classified |
| 2792595 | 자구내포구 | 해변·해안 | rule_classified |
| 2792599 | 한림항 | 해변·해안 | rule_classified |
| 2792603 | 협재포구 | 해변·해안 | rule_classified |
| 2794659 | 도두항 | 해변·해안 | rule_classified |
| 2794667 | 사수항 | 해변·해안 | rule_classified |
| 2794971 | 일통이반 | 음식점·주점 | rule_classified |
| 2796715 | 베릿네오름 | 산·오름 | rule_classified |
| 2796937 | 제주드림타워 복합리조트 | 숙박 | rule_classified |
| 2798027 | 전이수갤러리 걸어가는늑대들 | 박물관·미술관·전시 | rule_classified |
| 2798036 | 숙성도 제주본점 | 음식점·주점 | rule_classified |
| 2798046 | 김택화 미술관 | 박물관·미술관·전시 | rule_classified |
| 2798131 | 성산포JC공원 | 공원 | rule_classified |
| 2798703 | 성산포성당 | 유적·종교시설 | rule_classified |
| 2798709 | 제주피싱테마파크 | 수상·해양 레저 | rule_classified |
| 2798882 | 제주 우도 천진항 대합실 | 수상·해양 레저 | rule_classified |
| 2798892 | 화북포구 | 해변·해안 | rule_classified |
| 2799740 | 비양도선착장 | 해변·해안 | rule_classified |
| 2800664 | 제주 성산항 | 해변·해안 | rule_classified |
| 2801936 | 집의기록상점 | 카페·찻집·베이커리 | rule_classified |
| 2801985 | 다람쥐민박 | 숙박 | rule_classified |
| 2802732 | 카페 귤꽃다락 | 카페·찻집·베이커리 | rule_classified |
| 2804378 | 효은디저트 | 카페·찻집·베이커리 | rule_classified |
| 2805240 | 가파도별미식당 | 음식점·주점 | rule_classified |
| 2805243 | 몰래물밥상 | 음식점·주점 | rule_classified |
| 2805320 | 착한제주고등어 | 음식점·주점 | rule_classified |
| 2805415 | 백록집 | 음식점·주점 | rule_classified |
| 2805483 | 올티스 | 카페·찻집·베이커리 | rule_classified |
| 2806020 | 삼다숯불갈비 | 음식점·주점 | rule_classified |
| 2806043 | 동백포레스트 | 정원·수목원·꽃밭 | rule_classified |
| 2806115 | 제주동백수목원 | 정원·수목원·꽃밭 | rule_classified |
| 2806554 | [하영올레] 1코스 | 걷기·트레킹 코스 | rule_classified |
| 2806555 | [하영올레] 2코스 | 걷기·트레킹 코스 | rule_classified |
| 2806561 | [하영올레] 3코스 | 걷기·트레킹 코스 | rule_classified |
| 2806871 | 도토리키친 | 음식점·주점 | rule_classified |
| 2807119 | 고서방 짬뽕 | 음식점·주점 | rule_classified |
| 2807124 | 채훈이네해장국 | 음식점·주점 | rule_classified |
| 2807387 | 커뮤니테이블 | 음식점·주점 | rule_classified |
| 2807920 | 달페이지 | 음식점·주점 | rule_classified |
| 2808037 | 원앤온리 | 카페·찻집·베이커리 | rule_classified |
| 2808238 | 청춘부부 | 카페·찻집·베이커리 | rule_classified |
| 2808937 | 오드랑베이커리 | 카페·찻집·베이커리 | rule_classified |
| 2809900 | 묘한식당 | 음식점·주점 | rule_classified |
| 2809970 | 바다밥상 | 음식점·주점 | rule_classified |
| 2810906 | 식당 마요네즈 | 음식점·주점 | rule_classified |
| 2810922 | 더스푼 | 음식점·주점 | rule_classified |
| 2811110 | 훈데르트바서파크 | 박물관·미술관·전시 | rule_classified |
| 2811459 | 훈데르트윈즈 | 카페·찻집·베이커리 | rule_classified |
| 2811460 | 카페 톨칸이 | 카페·찻집·베이커리 | rule_classified |
| 2814168 | 스테리나잇 제주 | 숙박 | rule_classified |
| 2814169 | 쿠지홀리데이 | 숙박 | rule_classified |
| 2815586 | 독고집 | 음식점·주점 | rule_classified |
| 2815713 | 오라디오라 | 카페·찻집·베이커리 | rule_classified |
| 2818722 | 모루쿠다 | 음식점·주점 | rule_classified |
| 2819194 | 이스방한상 | 음식점·주점 | rule_classified |
| 2819519 | 소길별하 | 쇼핑·서점 | rule_classified |
| 2819599 | 고배기동산 | 숲·휴양림 | rule_classified |
| 2819792 | 그시절그짬뽕 | 음식점·주점 | rule_classified |
| 2819964 | 그랜드 조선 제주 | 숙박 | rule_classified |
| 2820293 | 바다다이브 | 수상·해양 레저 | rule_classified |
| 2822432 | 서귀진지 | 유적·종교시설 | rule_classified |
| 2822959 | 히든 클리프 호텔 & 네이쳐 | 숙박 | rule_classified |
| 2824043 | 행복밀 | 카페·찻집·베이커리 | rule_classified |
| 2825241 | 철가방을든해녀 | 음식점·주점 | rule_classified |
| 2825249 | 금갈치 | 음식점·주점 | rule_classified |
| 2828666 | 표선우동가게 | 음식점·주점 | rule_classified |
| 2829786 | 비케이브 | 카페·찻집·베이커리 | rule_classified |
| 2829949 | 연돈 | 음식점·주점 | rule_classified |
| 2830204 | 무로이 | 카페·찻집·베이커리 | rule_classified |
| 2830228 | 도렐 제주 본점 | 카페·찻집·베이커리 | rule_classified |
| 2830340 | 우유부단 | 카페·찻집·베이커리 | rule_classified |
| 2830485 | 권가칼국수 | 음식점·주점 | rule_classified |
| 2830500 | 그럼외도 | 카페·찻집·베이커리 | rule_classified |
| 2831590 | 고집돌우럭 중문점 | 음식점·주점 | rule_classified |
| 2831622 | 미쁜제과 | 카페·찻집·베이커리 | rule_classified |
| 2831635 | 오는정김밥 | 음식점·주점 | rule_classified |
| 2831920 | 수애기베이커리 | 카페·찻집·베이커리 | rule_classified |
| 2831941 | 삼미흑돼지 중문점 | 음식점·주점 | rule_classified |
| 2831961 | 천짓골식당 | 음식점·주점 | rule_classified |
| 2833201 | 성산 부뚜막식당 | 음식점·주점 | rule_classified |
| 2833244 | 솔동산고기국수 | 음식점·주점 | rule_classified |
| 2833269 | 유동커피 | 카페·찻집·베이커리 | rule_classified |
| 2833308 | 성산 타쿠마스시 | 음식점·주점 | rule_classified |
| 2833409 | 선이네밥집 | 음식점·주점 | rule_classified |
| 2833763 | 산지천갤러리 | 박물관·미술관·전시 | rule_classified |
| 2834605 | 허디거디 이도점 | 음식점·주점 | rule_classified |
| 2834656 | 아라리오뮤지엄 동문모텔2 | 박물관·미술관·전시 | rule_classified |
| 2836502 | 제주해조네 보말성게전문점 | 음식점·주점 | rule_classified |
| 2836808 | 지은이네밥상 | 음식점·주점 | rule_classified |
| 2836814 | 서귀포칠십리시공원 | 공원 | rule_classified |
| 2836825 | 카페루시아 본점 | 카페·찻집·베이커리 | rule_classified |
| 2836855 | 포도뮤지엄 | 박물관·미술관·전시 | rule_classified |
| 2836873 | 미스틱3도 | 카페·찻집·베이커리 | rule_classified |
| 2836891 | 바람벽에흰당나귀 | 카페·찻집·베이커리 | rule_classified |
| 2836910 | 송당무끈모루 | 숲·휴양림 | rule_classified |
| 2836964 | 외도339 | 카페·찻집·베이커리 | rule_classified |
| 2836976 | 제주돔베고기집 | 음식점·주점 | rule_classified |
| 2836994 | 정가네밥상 | 음식점·주점 | rule_classified |
| 2837033 | 협재해물라면오빠네 | 음식점·주점 | rule_classified |
| 2837068 | 카페 나모나모베이커리 | 카페·찻집·베이커리 | rule_classified |
| 2837142 | 동광메밀짬뽕 | 음식점·주점 | rule_classified |
| 2837181 | 가시어멍김밥 | 음식점·주점 | rule_classified |
| 2837222 | 코난해변 | 해변·해안 | rule_classified |
| 2837242 | 리보스코화덕피자 | 음식점·주점 | rule_classified |
| 2837996 | 말고기연구소 | 음식점·주점 | rule_classified |
| 2838059 | 미엘드세화 | 카페·찻집·베이커리 | rule_classified |
| 2838079 | 비마이게스트 | 카페·찻집·베이커리 | rule_classified |
| 2838100 | 스시애월 | 음식점·주점 | rule_classified |
| 2839718 | 나비정원 | 카페·찻집·베이커리 | rule_classified |
| 2839730 | 서귀피안 보래드 베이커스 | 카페·찻집·베이커리 | rule_classified |
| 2839742 | 성산흑돼지두루치기 성산일출봉점 | 음식점·주점 | rule_classified |
| 2839759 | 니모메 | 카페·찻집·베이커리 | rule_classified |
| 2839771 | 롱로드 | 음식점·주점 | rule_classified |
| 2839783 | 서서방숯불닭갈비 제주본점 | 음식점·주점 | rule_classified |
| 2839794 | 임성반점 | 음식점·주점 | rule_classified |
| 2839903 | 피즈 버거 노형점 | 음식점·주점 | rule_classified |
| 2839916 | 한데모아 정실점 | 음식점·주점 | rule_classified |
| 2839938 | 한라향 | 음식점·주점 | rule_classified |
| 2840469 | 미친부엌 | 음식점·주점 | rule_classified |
| 2840487 | 섭섭이네 | 음식점·주점 | rule_classified |
| 2840505 | 순아커피 | 카페·찻집·베이커리 | rule_classified |
| 2840638 | 오짜장 | 음식점·주점 | rule_classified |
| 2840668 | 자연몸국 | 음식점·주점 | rule_classified |
| 2840695 | 카페477플러스 | 카페·찻집·베이커리 | rule_classified |
| 2840856 | 두모리이수사 | 음식점·주점 | rule_classified |
| 2840885 | 이어도식당 | 음식점·주점 | rule_classified |
| 2840903 | 양가네 신화월드 본점 | 음식점·주점 | rule_classified |
| 2840920 | 아리랑밀면 | 음식점·주점 | rule_classified |
| 2841345 | 착한튀김 | 음식점·주점 | rule_classified |
| 2841372 | 청도 | 음식점·주점 | rule_classified |
| 2843749 | 글라글라하와이 | 음식점·주점 | rule_classified |
| 2843766 | 김선장회센타 | 음식점·주점 | rule_classified |
| 2843803 | 다정이네 올레시장 본점 | 음식점·주점 | rule_classified |
| 2843815 | 동선제면가 | 음식점·주점 | rule_classified |
| 2843867 | 문치비 | 음식점·주점 | rule_classified |
| 2843885 | 바다다 | 카페·찻집·베이커리 | rule_classified |
| 2843921 | 스모크하우스인구억 | 음식점·주점 | rule_classified |
| 2843943 | 와토커피 | 카페·찻집·베이커리 | rule_classified |
| 2843955 | 중문갈치조림 이조은식당 | 음식점·주점 | rule_classified |
| 2843968 | 자리돔횟집 | 음식점·주점 | rule_classified |
| 2843982 | 제주고로 | 음식점·주점 | rule_classified |
| 2843997 | 짱구분식 | 음식점·주점 | rule_classified |
| 2844014 | 천돈가 중문본점 | 음식점·주점 | rule_classified |
| 2844044 | 카페텐저린 | 카페·찻집·베이커리 | rule_classified |
| 2844078 | 함쉐프키친 | 음식점·주점 | rule_classified |
| 2844094 | 화고 흑돼지 신시가지점 | 음식점·주점 | rule_classified |
| 2845281 | 덴드리 | 카페·찻집·베이커리 | rule_classified |
| 2845288 | 모노클제주 | 카페·찻집·베이커리 | rule_classified |
| 2845297 | 목화휴게소 | 음식점·주점 | rule_classified |
| 2845335 | 쉬어갓 | 카페·찻집·베이커리 | rule_classified |
| 2845353 | 오른 | 카페·찻집·베이커리 | rule_classified |
| 2845370 | 페를로 | 음식점·주점 | rule_classified |
| 2845383 | 한라산아래첫마을 영농조합법인 | 음식점·주점 | rule_classified |
| 2847188 | 호텔 휴식 서귀포 | 숙박 | rule_classified |
| 2847272 | 제주 항공우주 호텔 | 숙박 | rule_classified |
| 2847506 | 이후북스 제주점 | 쇼핑·서점 | rule_classified |
| 2847672 | 장인의집 | 음식점·주점 | rule_classified |
| 2847703 | 샤이니숲길 | 숲·휴양림 | rule_classified |
| 2847715 | 풀베개 | 카페·찻집·베이커리 | rule_classified |
| 2847726 | 상가리야자숲 | 숲·휴양림 | rule_classified |
| 2847737 | 제주선채향 | 음식점·주점 | rule_classified |
| 2847753 | 제주그림카페 | 카페·찻집·베이커리 | rule_classified |
| 2847791 | 사계의시간 | 음식점·주점 | rule_classified |
| 2847804 | 돗통 제주산방산본점 | 음식점·주점 | rule_classified |
| 2847812 | 그라나다 | 카페·찻집·베이커리 | rule_classified |
| 2847823 | 달팽이식당 | 음식점·주점 | rule_classified |
| 2847829 | 호랑호랑 성산카페 | 카페·찻집·베이커리 | rule_classified |
| 2847852 | 옛날팥죽 | 음식점·주점 | rule_classified |
| 2847876 | 블루마운틴4255 | 카페·찻집·베이커리 | rule_classified |
| 2847894 | 부촌 | 음식점·주점 | rule_classified |
| 2847916 | 제주고사리맛집 복돼지식당 | 음식점·주점 | rule_classified |
| 2848391 | 클래식문구사 | 쇼핑·서점 | rule_classified |
| 2849980 | 판포미인 | 음식점·주점 | rule_classified |
| 2849994 | 제주몹시 | 카페·찻집·베이커리 | rule_classified |
| 2850014 | 선흘방주할머니식당 | 음식점·주점 | rule_classified |
| 2850039 | 해물통라면 문개항아리 애월해안도로점 | 음식점·주점 | rule_classified |
| 2850048 | 도두반점 제주사수점 | 음식점·주점 | rule_classified |
| 2850078 | 원조남원포구식당 | 음식점·주점 | rule_classified |
| 2850090 | 쇠소깍 복순이네 | 음식점·주점 | rule_classified |
| 2850113 | 베케 | 카페·찻집·베이커리 | rule_classified |
| 2850127 | 더리트리브 | 카페·찻집·베이커리 | rule_classified |
| 2850913 | 가는곶 세화 | 카페·찻집·베이커리 | rule_classified |
| 2850960 | 중문 모메든식당 | 음식점·주점 | rule_classified |
| 2851007 | 바램목장&카페 | 카페·찻집·베이커리 | rule_classified |
| 2851090 | 볼스카페 | 카페·찻집·베이커리 | rule_classified |
| 2851125 | 아줄레주 | 카페·찻집·베이커리 | rule_classified |
| 2851126 | 산지해장국 | 음식점·주점 | rule_classified |
| 2851146 | 자연스러운식당 | 음식점·주점 | rule_classified |
| 2851196 | 친봉산장 | 카페·찻집·베이커리 | rule_classified |
| 2851274 | 유디에이(UDA) | 카페·찻집·베이커리 | rule_classified |
| 2851320 | 짱구네유채꽃밭 | 정원·수목원·꽃밭 | rule_classified |
| 2851375 | 아리 | 음식점·주점 | rule_classified |
| 2851443 | 호자 | 음식점·주점 | rule_classified |
| 2851487 | 톰톰카레 | 음식점·주점 | rule_classified |
| 2851546 | 카페 글렌코 | 카페·찻집·베이커리 | rule_classified |
| 2851565 | 쪼끌락 | 카페·찻집·베이커리 | rule_classified |
| 2851610 | 용꽈배기 | 카페·찻집·베이커리 | rule_classified |
| 2851643 | 모뉴에트 | 카페·찻집·베이커리 | rule_classified |
| 2851674 | 마틸다 | 카페·찻집·베이커리 | rule_classified |
| 2851686 | 김녕오라이 | 음식점·주점 | rule_classified |
| 2851706 | 영주말가든 | 음식점·주점 | rule_classified |
| 2851717 | 애월그때그집 제주도 본점 | 음식점·주점 | rule_classified |
| 2851862 | 곽지국시 | 음식점·주점 | rule_classified |
| 2851868 | 꽁순이네 | 음식점·주점 | rule_classified |
| 2851874 | 꿈낭밥집 | 음식점·주점 | rule_classified |
| 2851880 | 애월 너와의 첫 여행 감귤창고카페 | 카페·찻집·베이커리 | rule_classified |
| 2851889 | 노라바 | 음식점·주점 | rule_classified |
| 2851902 | 노을리 | 카페·찻집·베이커리 | rule_classified |
| 2851913 | 단소 | 음식점·주점 | rule_classified |
| 2851930 | 도치돌가든 | 음식점·주점 | rule_classified |
| 2851948 | 라라카페 | 카페·찻집·베이커리 | rule_classified |
| 2851992 | 마니주 | 음식점·주점 | rule_classified |
| 2852023 | 봉성식당 | 음식점·주점 | rule_classified |
| 2852038 | 블루사이공 | 음식점·주점 | rule_classified |
| 2852063 | 삼일해장국 | 음식점·주점 | rule_classified |
| 2852108 | 심바카레 | 음식점·주점 | rule_classified |
| 2852136 | 재벌식당 | 음식점·주점 | rule_classified |
| 2852155 | 제레미 | 카페·찻집·베이커리 | rule_classified |
| 2852187 | 카페브리프 | 카페·찻집·베이커리 | rule_classified |
| 2852215 | 코시롱 | 음식점·주점 | rule_classified |
| 2852232 | 해녀의집 | 음식점·주점 | rule_classified |
| 2852311 | 골목카페옥수 | 카페·찻집·베이커리 | rule_classified |
| 2852374 | 그러므로 파트2 (part2) | 카페·찻집·베이커리 | rule_classified |
| 2852379 | 구좌읍 우럭튀김 민경이네어등포식당 | 음식점·주점 | rule_classified |
| 2852457 | ABC 에이팩토리베이커리카페 | 카페·찻집·베이커리 | rule_classified |
| 2852520 | 커피스케치 | 카페·찻집·베이커리 | rule_classified |
| 2852532 | 선물가게 바나나 서귀포중문점 | 쇼핑·서점 | rule_classified |
| 2852538 | 산방산랜드 | 테마파크·놀이시설 | rule_classified |
| 2852563 | 제주부영호텔&리조트 | 숙박 | rule_classified |
| 2852581 | 머큐어앰배서더 제주 | 숙박 | rule_classified |
| 2852643 | 대왕수천예래생태공원 | 공원 | rule_classified |
| 2852695 | 예술공간 이아 | 박물관·미술관·전시 | rule_classified |
| 2853278 | 하르방짬뽕 | 음식점·주점 | rule_classified |
| 2853291 | 타무라 | 음식점·주점 | rule_classified |
| 2853302 | 마노커피하우스 | 카페·찻집·베이커리 | rule_classified |
| 2853435 | 갈치공장 | 음식점·주점 | rule_classified |
| 2853471 | 안도르 | 카페·찻집·베이커리 | rule_classified |
| 2853484 | 삼무공원 | 공원 | rule_classified |
| 2853566 | 정직한돈 본점 | 음식점·주점 | rule_classified |
| 2853604 | 우동카덴 | 음식점·주점 | rule_classified |
| 2853621 | 우무 본점 | 카페·찻집·베이커리 | rule_classified |
| 2853644 | 잇칸시타 | 음식점·주점 | rule_classified |
| 2853658 | 잔물결 | 카페·찻집·베이커리 | rule_classified |
| 2853982 | 라토커피제주 | 카페·찻집·베이커리 | rule_classified |
| 2854015 | 모들한상 | 음식점·주점 | rule_classified |
| 2854041 | 별돈별 정원본점 | 음식점·주점 | rule_classified |
| 2854069 | 소섬전복 | 음식점·주점 | rule_classified |
| 2854078 | 시골길 | 음식점·주점 | rule_classified |
| 2854102 | 신해바라기 | 음식점·주점 | rule_classified |
| 2854121 | 연정식당 | 음식점·주점 | rule_classified |
| 2854188 | 우호적무관심 | 카페·찻집·베이커리 | rule_classified |
| 2854211 | 인그리드 | 카페·찻집·베이커리 | rule_classified |
| 2854271 | 제주미담 | 음식점·주점 | rule_classified |
| 2854312 | 죽성고을 | 음식점·주점 | rule_classified |
| 2854335 | 피커스 제주 | 카페·찻집·베이커리 | rule_classified |
| 2854364 | 하하호호 | 음식점·주점 | rule_classified |
| 2854384 | 형돈 | 음식점·주점 | rule_classified |
| 2854403 | 함덕회춘 | 음식점·주점 | rule_classified |
| 2854417 | 훈남횟집 | 음식점·주점 | rule_classified |
| 2854437 | 답다니수국밭 | 정원·수목원·꽃밭 | rule_classified |
| 2854455 | 감따남 | 카페·찻집·베이커리 | rule_classified |
| 2854521 | 산방산유채꽃밭 | 정원·수목원·꽃밭 | rule_classified |
| 2856999 | 와르다레스토랑 | 음식점·주점 | rule_classified |
| 2857265 | 513텐동 | 음식점·주점 | rule_classified |
| 2857289 | 골목식당 | 음식점·주점 | rule_classified |
| 2857329 | 나라돈까스 | 음식점·주점 | rule_classified |
| 2857350 | 당당 | 카페·찻집·베이커리 | rule_classified |
| 2857388 | 온차 | 음식점·주점 | rule_classified |
| 2858291 | 어리목탐방안내소 | 교통·관광안내 | rule_classified |
| 2858304 | 호텔 더본 제주 | 숙박 | rule_classified |
| 2858406 | 중문회포장센터 새벽야시장 | 음식점·주점 | rule_classified |
| 2858423 | 트로피컬 하이드어웨이 카페 | 카페·찻집·베이커리 | rule_classified |
| 2858445 | 쉬리의언덕 | 경관·걷기 | user_confirmed |
| 2858467 | 제주곶자왈도립공원 | 숲·휴양림 | rule_classified |
| 2858473 | 인스밀 | 카페·찻집·베이커리 | rule_classified |
| 2858479 | 애플망고1947 | 카페·찻집·베이커리 | rule_classified |
| 2858485 | 동도원 | 음식점·주점 | rule_classified |
| 2858577 | 명랑스낵 | 음식점·주점 | rule_classified |
| 2858612 | 문쏘 제주협재점 | 음식점·주점 | rule_classified |
| 2858656 | 창꼼 | 해변·해안 | rule_classified |
| 2858680 | 카페콜라 | 카페·찻집·베이커리 | rule_classified |
| 2858860 | 액티브파크 제주 | 테마파크·놀이시설 | rule_classified |
| 2858942 | 스테이위드커피 | 카페·찻집·베이커리 | rule_classified |
| 2858976 | 카페더라이트 | 카페·찻집·베이커리 | rule_classified |
| 2858991 | 중문해물라면오빠네 | 음식점·주점 | rule_classified |
| 2859012 | 중문색달통갈치 본점 | 음식점·주점 | rule_classified |
| 2859034 | 제스토리 | 쇼핑·서점 | rule_classified |
| 2859054 | 올디벗구디 | 카페·찻집·베이커리 | rule_classified |
| 2859072 | 앙끄레국수 서귀포본점 | 음식점·주점 | rule_classified |
| 2859090 | 뷰스트 | 카페·찻집·베이커리 | rule_classified |
| 2859164 | 그리운바다성산포 | 음식점·주점 | rule_classified |
| 2859187 | 벙커하우스 | 카페·찻집·베이커리 | rule_classified |
| 2860575 | 효퇴국수국밥 | 음식점·주점 | rule_classified |
| 2860639 | 송림반점 | 음식점·주점 | rule_classified |
| 2860662 | 마마롱 | 카페·찻집·베이커리 | rule_classified |
| 2860687 | 동문공설시장 | 전통시장 | rule_classified |
| 2860705 | 남춘식당 | 음식점·주점 | rule_classified |
| 2860731 | 베메로 (BAKE MAKE ROAST) | 카페·찻집·베이커리 | rule_classified |
| 2861349 | 크라운돼지 | 음식점·주점 | rule_classified |
| 2861372 | 당포로나인 돈카츠 | 음식점·주점 | rule_classified |
| 2861378 | 평대스낵 | 음식점·주점 | rule_classified |
| 2861390 | 그레이그로브 | 카페·찻집·베이커리 | rule_classified |
| 2861425 | 바다보는날 | 음식점·주점 | rule_classified |
| 2861455 | 릴로 | 음식점·주점 | rule_classified |
| 2861489 | 동복뚝배기 | 음식점·주점 | rule_classified |
| 2861515 | 하라케케 | 카페·찻집·베이커리 | rule_classified |
| 2861616 | 카페지니 | 카페·찻집·베이커리 | rule_classified |
| 2861702 | 이돈갓 | 음식점·주점 | rule_classified |
| 2861708 | 피어22 | 음식점·주점 | rule_classified |
| 2861940 | 트라이브 | 카페·찻집·베이커리 | rule_classified |
| 2861952 | 제주에가면 | 음식점·주점 | rule_classified |
| 2861967 | 장모식탁 | 음식점·주점 | rule_classified |
| 2862045 | 애월더선셋 | 카페·찻집·베이커리 | rule_classified |
| 2862068 | 비양놀 | 카페·찻집·베이커리 | rule_classified |
| 2862097 | 담백 월정리본점 | 음식점·주점 | rule_classified |
| 2862117 | 그계절 | 카페·찻집·베이커리 | rule_classified |
| 2863597 | 젬마손 | 음식점·주점 | rule_classified |
| 2863603 | 차롱보말전복칼국수 제주공항점 | 음식점·주점 | rule_classified |
| 2863615 | 김녕 청굴물 | 해변·해안 | rule_classified |
| 2863622 | 카페한라산 | 카페·찻집·베이커리 | rule_classified |
| 2863633 | 인카페온더비치 | 카페·찻집·베이커리 | rule_classified |
| 2863658 | 싸이공레시피 | 음식점·주점 | rule_classified |
| 2863660 | 모래비 커피로스터스 앤 베이커리 | 카페·찻집·베이커리 | rule_classified |
| 2863701 | 중문고등어쌈밥 | 음식점·주점 | rule_classified |
| 2863719 | 제주약수터 | 음식점·주점 | rule_classified |
| 2863775 | 반양 | 음식점·주점 | rule_classified |
| 2863793 | 듀포레 | 카페·찻집·베이커리 | rule_classified |
| 2863811 | 도리 관광농원 | 카페·찻집·베이커리 | rule_classified |
| 2863882 | 나바론하늘길 | 경관·걷기 | user_confirmed |
| 2863893 | 김마리 | 음식점·주점 | rule_classified |
| 2863913 | 고토커피바 | 카페·찻집·베이커리 | rule_classified |
| 2863927 | 고사리커피 | 카페·찻집·베이커리 | rule_classified |
| 2863940 | 52번가 | 카페·찻집·베이커리 | rule_classified |
| 2864216 | 애월리순메밀막국수 | 음식점·주점 | rule_classified |
| 2864237 | 연화키친 | 음식점·주점 | rule_classified |
| 2864269 | 숲 제주 | 음식점·주점 | rule_classified |
| 2864287 | 윤스타피자앤파스타 | 음식점·주점 | rule_classified |
| 2864309 | 오뚜기빵집 | 음식점·주점 | rule_classified |
| 2864429 | 카페이면 | 카페·찻집·베이커리 | rule_classified |
| 2864448 | 옹포천어울공원수영장 | 수상·해양 레저 | rule_classified |
| 2869085 | 삼일삼오 | 숙박 | rule_classified |
| 2870495 | 만족한상회 중문점 | 음식점·주점 | rule_classified |
| 2870515 | 경성수산 | 음식점·주점 | rule_classified |
| 2870537 | 귤품은흑돼지 제주공항점 | 음식점·주점 | rule_classified |
| 2870559 | 금악 똣똣라면 | 음식점·주점 | rule_classified |
| 2870589 | 도갈비 | 음식점·주점 | rule_classified |
| 2870596 | 도두후레쉬 | 음식점·주점 | rule_classified |
| 2870602 | 뚱딴지 애월본점 | 음식점·주점 | rule_classified |
| 2870608 | 로맨틱새우 애월곽지본점 | 음식점·주점 | rule_classified |
| 2870619 | 바당한그릇 | 음식점·주점 | rule_classified |
| 2870651 | 섬소나이 우도본점 | 음식점·주점 | rule_classified |
| 2870797 | 어머니의뜻을담다 단지 | 음식점·주점 | rule_classified |
| 2870835 | 토토네 | 카페·찻집·베이커리 | rule_classified |
| 2870843 | 제주시새우리 | 음식점·주점 | rule_classified |
| 2870869 | 참맛나김밥 | 음식점·주점 | rule_classified |
| 2870910 | 사랑분식 | 음식점·주점 | rule_classified |
| 2870912 | 포도원흑돼지 | 음식점·주점 | rule_classified |
| 2870937 | 메콩스카이 | 음식점·주점 | rule_classified |
| 2870955 | 성산포 자연산 회센타 | 음식점·주점 | rule_classified |
| 2870974 | 협재신국수 | 음식점·주점 | rule_classified |
| 2871099 | 카페 동백 | 카페·찻집·베이커리 | rule_classified |
| 2871851 | 누이밥집 | 음식점·주점 | rule_classified |
| 2871863 | 포하노이 | 음식점·주점 | rule_classified |
| 2871879 | 모해통갈치화덕구이 | 음식점·주점 | rule_classified |
| 2871897 | 뱅인타코 제주본점 | 음식점·주점 | rule_classified |
| 2871898 | 제주연탄길 신제주본점 | 음식점·주점 | rule_classified |
| 2871913 | 봉주르마담 | 카페·찻집·베이커리 | rule_classified |
| 2871919 | 어멍이해녀 | 음식점·주점 | rule_classified |
| 2871931 | 센트로 | 음식점·주점 | rule_classified |
| 2871934 | 배셰프 | 음식점·주점 | rule_classified |
| 2871954 | 수망다원 | 카페·찻집·베이커리 | rule_classified |
| 2871956 | 만복반미 노형 본점 | 음식점·주점 | rule_classified |
| 2871971 | 시스터필드 | 카페·찻집·베이커리 | rule_classified |
| 2871977 | 김녕에사는김영훈 | 카페·찻집·베이커리 | rule_classified |
| 2871986 | 그린페블 | 카페·찻집·베이커리 | rule_classified |
| 2871997 | 코우 | 음식점·주점 | rule_classified |
| 2872007 | 영육일삼 | 음식점·주점 | rule_classified |
| 2872927 | 신촌 4·3 성터 | 유적·종교시설 | rule_classified |
| 2873679 | 검은노루 | 음식점·주점 | rule_classified |
| 2873708 | 모카다방 | 카페·찻집·베이커리 | rule_classified |
| 2873724 | 수와래베이커리 | 카페·찻집·베이커리 | rule_classified |
| 2873771 | 취향의섬 | 음식점·주점 | rule_classified |
| 2876416 | 다린 | 카페·찻집·베이커리 | rule_classified |
| 2876488 | 바타타식탁 | 음식점·주점 | rule_classified |
| 2876685 | 이정의댁 | 카페·찻집·베이커리 | rule_classified |
| 2876704 | 중문 돌담흑돼지 | 음식점·주점 | rule_classified |
| 2876795 | 그랜드 하얏트 제주 | 숙박 | rule_classified |
| 2876814 | 육도담 제주시청본점 | 음식점·주점 | rule_classified |
| 2876836 | 제주공항그때그집 | 음식점·주점 | rule_classified |
| 2876854 | 제주또시랑 | 음식점·주점 | rule_classified |
| 2877612 | 두리둠비 | 음식점·주점 | rule_classified |
| 2877634 | 랜딩커피 | 카페·찻집·베이커리 | rule_classified |
| 2877645 | 서귀피안 베이커리 | 카페·찻집·베이커리 | rule_classified |
| 2877671 | 서홍정원 | 카페·찻집·베이커리 | rule_classified |
| 2877734 | 소규모식탁 | 음식점·주점 | rule_classified |
| 2877751 | 신왕 | 음식점·주점 | rule_classified |
| 2877801 | 꼬스뗀뇨 | 카페·찻집·베이커리 | rule_classified |
| 2877807 | M1971 카페 엠브릿지 | 카페·찻집·베이커리 | rule_classified |
| 2877827 | 나이체 | 카페·찻집·베이커리 | rule_classified |
| 2877847 | 머문 | 카페·찻집·베이커리 | rule_classified |
| 2877937 | 연미정 | 음식점·주점 | rule_classified |
| 2877950 | 환영키친 | 음식점·주점 | rule_classified |
| 2891382 | 초가헌 | 카페·찻집·베이커리 | rule_classified |
| 2891397 | 한길정 | 음식점·주점 | rule_classified |
| 2891399 | 젤코바 베이커리 카페 | 카페·찻집·베이커리 | rule_classified |
| 2891424 | 카페하귀리 | 카페·찻집·베이커리 | rule_classified |
| 2891431 | 하귀정담 | 음식점·주점 | rule_classified |
| 2891438 | 헬로남생이 | 카페·찻집·베이커리 | rule_classified |
| 2892239 | 볕이드는곳벧디 | 카페·찻집·베이커리 | rule_classified |
| 2892256 | 블리스풀 | 카페·찻집·베이커리 | rule_classified |
| 2892282 | 영국찻집 | 카페·찻집·베이커리 | rule_classified |
| 2892313 | 커피냅로스터스 제주 | 카페·찻집·베이커리 | rule_classified |
| 2892326 | 콜린 제주 | 카페·찻집·베이커리 | rule_classified |
| 2892380 | 홀츠 애월 | 카페·찻집·베이커리 | rule_classified |
| 2893644 | 내셔널지오그래픽 신제주점 | 쇼핑·서점 | rule_classified |
| 2893659 | 마트로 탑동점 | 쇼핑·서점 | rule_classified |
| 2893682 | 뉴월드마트 신제주점 | 쇼핑·서점 | rule_classified |
| 2893702 | 회춘 애월점 | 카페·찻집·베이커리 | rule_classified |
| 2893725 | 제주해물밥 | 음식점·주점 | rule_classified |
| 2893743 | 썬셋클리프 | 카페·찻집·베이커리 | rule_classified |
| 2893826 | 루이까스텔 신제주점 | 쇼핑·서점 | rule_classified |
| 2893839 | 아디다스키즈 제주점 | 쇼핑·서점 | rule_classified |
| 2893882 | 아디다스 서귀포점 | 쇼핑·서점 | rule_classified |
| 2893962 | 베네통 | 쇼핑·서점 | rule_classified |
| 2893975 | 디스커버리 신제주점 | 쇼핑·서점 | rule_classified |
| 2894043 | 이니스프리 제주하우스 | 쇼핑·서점 | rule_classified |
| 2894117 | 테디베어하우스 테지움 | 쇼핑·서점 | rule_classified |
| 2894407 | 흑돼지해물삼합 | 음식점·주점 | rule_classified |
| 2894478 | 소리원 | 음식점·주점 | rule_classified |
| 2894496 | 순두부엔짬뽕 | 음식점·주점 | rule_classified |
| 2894522 | 풍천만가 | 음식점·주점 | rule_classified |
| 2894609 | 헬로키티아일랜드 | 쇼핑·서점 | rule_classified |
| 2899428 | 흑본오겹 함덕점 | 음식점·주점 | rule_classified |
| 2899449 | 트라인커피 | 카페·찻집·베이커리 | rule_classified |
| 2899468 | 카페유주 | 카페·찻집·베이커리 | rule_classified |
| 2899491 | 점점 | 카페·찻집·베이커리 | rule_classified |
| 2899509 | 자연과사람들 밀면 | 음식점·주점 | rule_classified |
| 2899528 | 양가형제 | 음식점·주점 | rule_classified |
| 2899545 | 아베베베이커리 | 카페·찻집·베이커리 | rule_classified |
| 2899568 | 블루메베이글 | 카페·찻집·베이커리 | rule_classified |
| 2899586 | 부온 | 음식점·주점 | rule_classified |
| 2899599 | 베카신 | 카페·찻집·베이커리 | rule_classified |
| 2899605 | 반디파스타 | 음식점·주점 | rule_classified |
| 2899623 | 무거버거 | 음식점·주점 | rule_classified |
| 2899667 | 먹돌 제주본점 | 음식점·주점 | rule_classified |
| 2899679 | 마두천손칼국수 | 음식점·주점 | rule_classified |
| 2899703 | 73st | 카페·찻집·베이커리 | rule_classified |
| 2899709 | 리틀포레스트 | 카페·찻집·베이커리 | rule_classified |
| 2899746 | 라임오렌지카페앤플라워 | 카페·찻집·베이커리 | rule_classified |
| 2900238 | 에잇세컨즈 제주중앙점 | 쇼핑·서점 | rule_classified |
| 2900852 | 스케쳐스 서귀포점 | 쇼핑·서점 | rule_classified |
| 2900956 | ABC마트 ST 서귀포점 | 쇼핑·서점 | rule_classified |
| 2901159 | 게스언더웨어 제주중앙지하상가점 | 쇼핑·서점 | rule_classified |
| 2901162 | 올리브영 제주연동점 | 쇼핑·서점 | rule_classified |
| 2901481 | 올리브영 제주탑동점 | 쇼핑·서점 | rule_classified |
| 2901520 | 오설록 티 뮤지엄 | 쇼핑·서점 | rule_classified |
| 2902472 | 제주사랑농수산 | 쇼핑·서점 | rule_classified |
| 2902737 | 바움하우스 | 음식점·주점 | rule_classified |
| 2902757 | 카페오놀 | 카페·찻집·베이커리 | rule_classified |
| 2902758 | 뿌리와열매 | 음식점·주점 | rule_classified |
| 2902776 | 쁠랑뜨 | 카페·찻집·베이커리 | rule_classified |
| 2902838 | 올리브영 제주함덕점 | 쇼핑·서점 | rule_classified |
| 2902911 | 아일랜드팩토리 풍류 | 카페·찻집·베이커리 | rule_classified |
| 2902941 | 내셔널지오그래픽 제주점 | 쇼핑·서점 | rule_classified |
| 2902945 | 핑골프스포츠 | 쇼핑·서점 | rule_classified |
| 2903062 | 크록스 제주점 | 쇼핑·서점 | rule_classified |
| 2903088 | 오스모시스 | 카페·찻집·베이커리 | rule_classified |
| 2903123 | 올드북촌 | 카페·찻집·베이커리 | rule_classified |
| 2903378 | 뉴에라 신제주점 | 쇼핑·서점 | rule_classified |
| 2903532 | 돌담너머바다 | 음식점·주점 | rule_classified |
| 2904020 | PXG 제주점 | 쇼핑·서점 | rule_classified |
| 2904321 | 피플 제주 | 쇼핑·서점 | rule_classified |
| 2904375 | 오랑우탄면사무소 | 음식점·주점 | rule_classified |
| 2904395 | 올드패션 | 카페·찻집·베이커리 | rule_classified |
| 2904412 | 우디글레이드 (Woody glade) | 카페·찻집·베이커리 | rule_classified |
| 2904424 | 제주명가두루치기 | 음식점·주점 | rule_classified |
| 2904457 | 헌마공신김만일기념관 | 박물관·미술관·전시 | rule_classified |
| 2904488 | 88로스터즈 | 카페·찻집·베이커리 | rule_classified |
| 2904508 | AND 유 CAFE | 카페·찻집·베이커리 | rule_classified |
| 2904549 | 고요산책 | 카페·찻집·베이커리 | rule_classified |
| 2904622 | 그린마일커피 애월점 | 카페·찻집·베이커리 | rule_classified |
| 2904635 | 도을 | 카페·찻집·베이커리 | rule_classified |
| 2904656 | 딜레탕트 | 카페·찻집·베이커리 | rule_classified |
| 2904691 | 라 플라주 | 카페·찻집·베이커리 | rule_classified |
| 2904827 | 마음에온 | 카페·찻집·베이커리 | rule_classified |
| 2904892 | 빵귿 | 카페·찻집·베이커리 | rule_classified |
| 2904931 | 스물다섯 | 카페·찻집·베이커리 | rule_classified |
| 2904947 | 신한온누리약국 | 쇼핑·서점 | rule_classified |
| 2904955 | 알엔알(rnr) | 카페·찻집·베이커리 | rule_classified |
| 2904992 | 오만정성 제주협재점 | 음식점·주점 | rule_classified |
| 2905025 | 옥란면옥 | 음식점·주점 | rule_classified |
| 2905045 | 와흘메밀마을 | 농어촌 체험 | rule_classified |
| 2905079 | 윤재커피 | 카페·찻집·베이커리 | rule_classified |
| 2905116 | 제주과학탐구체험관 | 박물관·미술관·전시 | rule_classified |
| 2905132 | 카페온 | 카페·찻집·베이커리 | rule_classified |
| 2905162 | K2 서귀포점 | 쇼핑·서점 | rule_classified |
| 2905171 | 카페허그 | 카페·찻집·베이커리 | rule_classified |
| 2905172 | 까스텔바작 | 쇼핑·서점 | rule_classified |
| 2905191 | 헬로효주 | 카페·찻집·베이커리 | rule_classified |
| 2905237 | 태양상회 | 음식점·주점 | rule_classified |
| 2905293 | 협재온다정 | 음식점·주점 | rule_classified |
| 2905314 | 협재해물라면 쪼꼴락상회 | 음식점·주점 | rule_classified |
| 2905340 | 살롱드라방 | 카페·찻집·베이커리 | rule_classified |
| 2905366 | 옛날국수집 | 음식점·주점 | rule_classified |
| 2905409 | 애월 우니담 | 음식점·주점 | rule_classified |
| 2905414 | 트리플스토어 시청점 | 쇼핑·서점 | rule_classified |
| 2905447 | 아디다스 신제주점 | 쇼핑·서점 | rule_classified |
| 2905452 | 아트박스 제주시청점 | 쇼핑·서점 | rule_classified |
| 2905453 | 나이키 서귀포점 | 쇼핑·서점 | rule_classified |
| 2905789 | 카페숑 | 카페·찻집·베이커리 | rule_classified |
| 2905901 | 카페단단 | 카페·찻집·베이커리 | rule_classified |
| 2906140 | 노스페이스 제주점 | 쇼핑·서점 | rule_classified |
| 2906155 | 가람 | 음식점·주점 | rule_classified |
| 2906163 | 구씨커피로스터스 | 카페·찻집·베이커리 | rule_classified |
| 2906174 | 금돈가 제주본점 | 음식점·주점 | rule_classified |
| 2906222 | 제주맛집칼국수 | 음식점·주점 | rule_classified |
| 2906322 | 항아리조림 | 음식점·주점 | rule_classified |
| 2906375 | 해왕성반점본점 | 음식점·주점 | rule_classified |
| 2906541 | 한형수정원 | 카페·찻집·베이커리 | rule_classified |
| 2906542 | 이니스프리 제주시청점 | 쇼핑·서점 | rule_classified |
| 2906595 | 하소로커피 | 카페·찻집·베이커리 | rule_classified |
| 2906602 | 스포츠메카 신제주점 | 쇼핑·서점 | rule_classified |
| 2907051 | 블랙야크 신제주점 | 쇼핑·서점 | rule_classified |
| 2907184 | 모이몰른 제주지하2호점 | 쇼핑·서점 | rule_classified |
| 2907285 | 다이소 제주연동점 | 쇼핑·서점 | rule_classified |
| 2907434 | 생각하는정원(청원) | 쇼핑·서점 | rule_classified |
| 2907482 | 홉히 | 카페·찻집·베이커리 | rule_classified |
| 2907667 | 탐라원특산품센터 | 쇼핑·서점 | rule_classified |
| 2907684 | 셀덴 제주중앙지하상가점 | 쇼핑·서점 | rule_classified |
| 2907715 | 금능해수욕장 야영장 | 캠핑 | rule_classified |
| 2907769 | 프리페어 칠성점 | 쇼핑·서점 | rule_classified |
| 2908659 | 트리플스토어 제원점 | 쇼핑·서점 | rule_classified |
| 2908746 | 파리게이츠 신제주점 | 쇼핑·서점 | rule_classified |
| 2908846 | 스타빌 | 캠핑 | rule_classified |
| 2909373 | 트리플스토어 칠성점 | 쇼핑·서점 | rule_classified |
| 2909701 | 정관장 광양점 | 쇼핑·서점 | rule_classified |
| 2909867 | 에스콰이아 제주점 | 쇼핑·서점 | rule_classified |
| 2909982 | 컴플리트커피 | 카페·찻집·베이커리 | rule_classified |
| 2910031 | 청담루이성형외과의원 | 쇼핑·서점 | rule_classified |
| 2910064 | 나이키골프 제주점 | 쇼핑·서점 | rule_classified |
| 2910530 | 탑텐키즈 롯데마트 제주점 | 쇼핑·서점 | rule_classified |
| 2910664 | 레노마홈 신제주노형점 | 쇼핑·서점 | rule_classified |
| 2910815 | 카페보롬왓 | 카페·찻집·베이커리 | rule_classified |
| 2910852 | 하례감귤점빵협동조합 | 카페·찻집·베이커리 | rule_classified |
| 2910854 | 이마트 서귀포점 | 쇼핑·서점 | rule_classified |
| 2910877 | 폴더 신제주점 | 쇼핑·서점 | rule_classified |
| 2910907 | 망고하이 | 카페·찻집·베이커리 | rule_classified |
| 2910930 | 래용 | 음식점·주점 | rule_classified |
| 2911053 | 알동네집 | 음식점·주점 | rule_classified |
| 2911088 | 5L2F | 카페·찻집·베이커리 | rule_classified |
| 2911139 | 폴더 제주점 | 쇼핑·서점 | rule_classified |
| 2911202 | 뉴발란스 신제주점 | 쇼핑·서점 | rule_classified |
| 2911298 | 웨스트우드 구제주점 | 쇼핑·서점 | rule_classified |
| 2911418 | 올리브영 제주대학병원점 | 쇼핑·서점 | rule_classified |
| 2911513 | 웨스트우드 신제주점 | 쇼핑·서점 | rule_classified |
| 2911579 | 올리브영 제주동문시장점 | 쇼핑·서점 | rule_classified |
| 2911661 | 올리브영 제주노형점 | 쇼핑·서점 | rule_classified |
| 2912373 | 네이처컬렉션 제주롯데시티점 | 쇼핑·서점 | rule_classified |
| 2912378 | 데상트 서귀포점 | 쇼핑·서점 | rule_classified |
| 2912411 | 올리브영 제주외도점 | 쇼핑·서점 | rule_classified |
| 2912430 | 풋조이 신제주점 | 쇼핑·서점 | rule_classified |
| 2912462 | 캘빈클라인 구제주대리점 | 쇼핑·서점 | rule_classified |
| 2912507 | 쌤소나이트 칠성로점 | 쇼핑·서점 | rule_classified |
| 2912583 | 금강제화 제주지점 | 쇼핑·서점 | rule_classified |
| 2912717 | 쉬즈미스 구제주점 | 쇼핑·서점 | rule_classified |
| 2913366 | 생생약국 | 쇼핑·서점 | rule_classified |
| 2913804 | 올리브영 제주하귀점 | 쇼핑·서점 | rule_classified |
| 2913989 | 롯데하이마트 제주점 | 쇼핑·서점 | rule_classified |
| 2914248 | 파렌하이트 제주점 | 쇼핑·서점 | rule_classified |
| 2914777 | 글라스스토리 렌즈스토리 중앙로점 | 쇼핑·서점 | rule_classified |
| 2914960 | 바인드 | 쇼핑·서점 | rule_classified |
| 2915071 | 팬텀골프 신제주점 | 쇼핑·서점 | rule_classified |
| 2916247 | 로가디스 제주점 | 쇼핑·서점 | rule_classified |
| 2916457 | 아트박스 제주연동점 | 쇼핑·서점 | rule_classified |
| 2916519 | 아트박스 제주칠성점 | 쇼핑·서점 | rule_classified |
| 2916532 | 로이드 신제주점 | 쇼핑·서점 | rule_classified |
| 2916577 | 컬럼비아 제주점 | 쇼핑·서점 | rule_classified |
| 2917170 | LG전자 베스트샵 제주본점 | 쇼핑·서점 | rule_classified |
| 2917176 | LG전자 베스트샵 이도본점 | 쇼핑·서점 | rule_classified |
| 2917270 | 그라벨호텔 | 숙박 | rule_classified |
| 2917746 | 유니클로 제주이도점 | 쇼핑·서점 | rule_classified |
| 2918447 | 다인오세아노 호텔 | 숙박 | rule_classified |
| 2918547 | 올리브영 제주중문점 | 쇼핑·서점 | rule_classified |
| 2918548 | 헤이, 서귀포 | 숙박 | rule_classified |
| 2918690 | 데상트 신제주점 | 쇼핑·서점 | rule_classified |
| 2922976 | 한국기념품백화점 | 쇼핑·서점 | rule_classified |
| 2923102 | 레노마 골프 제주점 | 쇼핑·서점 | rule_classified |
| 2923429 | 엠 할리데이 제주점 | 쇼핑·서점 | rule_classified |
| 2923531 | 이니스프리 제주롯데시티점 | 쇼핑·서점 | rule_classified |
| 2923731 | 에스마켓 제주칠성점 | 쇼핑·서점 | rule_classified |
| 2923735 | 스파오 신제주점 | 쇼핑·서점 | rule_classified |
| 2924017 | 캘빈클라인진 신제주대리점 | 쇼핑·서점 | rule_classified |
| 2924144 | 라코스테 신제주점 | 쇼핑·서점 | rule_classified |
| 2924160 | 삼성패션아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 2924333 | 베베드피노 제주노형점 | 쇼핑·서점 | rule_classified |
| 2924345 | 나이키 칠성로점 | 쇼핑·서점 | rule_classified |
| 2924420 | 팬텀 제주중앙점 | 쇼핑·서점 | rule_classified |
| 2924425 | 스케쳐스 신제주점 | 쇼핑·서점 | rule_classified |
| 2924636 | 아디다스 제주점 | 쇼핑·서점 | rule_classified |
| 2924947 | 빈폴 제주점 | 쇼핑·서점 | rule_classified |
| 2925278 | 정관장 서사라점 | 쇼핑·서점 | rule_classified |
| 2925633 | 이마트 제주점 | 쇼핑·서점 | rule_classified |
| 2925644 | 탑텐 이마트 신제주점 | 쇼핑·서점 | rule_classified |
| 2925674 | 게스 제주점 | 쇼핑·서점 | rule_classified |
| 2925738 | 스파오 제주중앙로점 | 쇼핑·서점 | rule_classified |
| 2925794 | 한섬 FX 마인 더캐시미어 제주점 | 쇼핑·서점 | rule_classified |
| 2925821 | 다이나핏 제주점 | 쇼핑·서점 | rule_classified |
| 2926949 | 제주엠리조트 | 숙박 | rule_classified |
| 2928848 | 베스띠벨리 구제주점 | 쇼핑·서점 | rule_classified |
| 2928853 | 제일모직아울렛 노형점 | 쇼핑·서점 | rule_classified |
| 2929365 | MLB 제주점 | 쇼핑·서점 | rule_classified |
| 2929823 | 올리브영 제주국제공항점 | 쇼핑·서점 | rule_classified |
| 2930569 | 원더플레이스 제주 칠성로점 | 쇼핑·서점 | rule_classified |
| 2930611 | 홈플러스 메가푸드마켓 서귀포점 | 쇼핑·서점 | rule_classified |
| 2930613 | 데상트골프 신제주점 | 쇼핑·서점 | rule_classified |
| 2930887 | 크록스 제주중문점 | 쇼핑·서점 | rule_classified |
| 2930914 | 루이까스텔 서귀포점 | 쇼핑·서점 | rule_classified |
| 2930935 | 한담해안산책로 | 해변·해안 | rule_classified |
| 2931100 | 에스마켓 서귀포점 | 쇼핑·서점 | rule_classified |
| 2931257 | 수목원길 야시장 | 전통시장 | rule_classified |
| 2931335 | 라코스테 제주점 | 쇼핑·서점 | rule_classified |
| 2931360 | 올리브영 제주한라병원점 | 쇼핑·서점 | rule_classified |
| 2931669 | 뉴발란스 제주점 | 쇼핑·서점 | rule_classified |
| 2931671 | 블랙야크 서귀포점 | 쇼핑·서점 | rule_classified |
| 2931723 | 제주901 | 숙박 | rule_classified |
| 2931727 | 아리따움 제주노형점 | 쇼핑·서점 | rule_classified |
| 2931775 | 고려홍삼 | 쇼핑·서점 | rule_classified |
| 2931892 | 빛의 벙커 | 박물관·미술관·전시 | rule_classified |
| 2931932 | 아라리오뮤지엄 탑동시네마 | 박물관·미술관·전시 | rule_classified |
| 2932006 | 서귀포 패류화석산지 | 동굴·지질명소 | user_confirmed |
| 2932050 | 휠라키즈 신제주점 | 쇼핑·서점 | rule_classified |
| 2932531 | 장수애섬식당 | 음식점·주점 | rule_classified |
| 2933508 | 유동룡미술관 | 박물관·미술관·전시 | rule_classified |
| 2938592 | 서작가초밥집 | 음식점·주점 | rule_classified |
| 2939004 | 돈물국수 | 음식점·주점 | rule_classified |
| 2940065 | 칠분의오 | 음식점·주점 | rule_classified |
| 2940076 | 카고크루즈 | 음식점·주점 | rule_classified |
| 2940391 | 광이멀스테이 | 숙박 | rule_classified |
| 2940981 | 루나폴 | 박물관·미술관·전시 | rule_classified |
| 2941421 | 수눌음 | 음식점·주점 | rule_classified |
| 2946074 | 금능포구 | 마을·거리 | rule_classified |
| 2946085 | 롤링브루잉 | 카페·찻집·베이커리 | rule_classified |
| 2946628 | 환상숲곶자왈공원 | 숲·휴양림 | rule_classified |
| 2948051 | 산양큰엉곶 | 숲·휴양림 | rule_classified |
| 2948165 | 에코랜드 호텔 | 숙박 | rule_classified |
| 2949573 | 제주문학관 | 박물관·미술관·전시 | rule_classified |
| 2953017 | 제주수울 (JEJUSUUL) | 쇼핑·서점 | rule_classified |
| 2977041 | 열대과일농장 유진팡 | 농어촌 체험 | rule_classified |
| 2980017 | 빈폴 제주점 | 쇼핑·서점 | rule_classified |
| 2986689 | 제주고산리유적안내센터 | 박물관·미술관·전시 | rule_classified |
| 2991120 | 물결그림 | 숙박 | rule_classified |
| 2994124 | 중문승마공원 | 육상 레저·스포츠 | rule_classified |
| 2997830 | 2025 제주 반려동물 문화산업 한마당 | 축제·행사 | rule_classified |
| 3005374 | 아이바가든 | 박물관·미술관·전시 | rule_classified |
| 3008392 | 성읍녹차동굴 | 동굴·지질명소 | rule_classified |
| 3009659 | 성읍녹차마을 | 마을·거리 | rule_classified |
| 3011245 | 수산한못 | 호수·습지 | rule_classified |
| 3011941 | 화북, 포구문화제 | 축제·행사 | rule_classified |
| 3012012 | 석예원 본초 족욕 성산점 | 온천·스파·웰니스 | rule_classified |
| 3013172 | 신천리 벽화마을 | 마을·거리 | rule_classified |
| 3013283 | 송악산둘레길 | 걷기·트레킹 코스 | rule_classified |
| 3013310 | 황우지선녀탕 | 해변·해안 | rule_classified |
| 3014969 | 문화의 달 행사 | 축제·행사 | rule_classified |
| 3015172 | 졸띠유채밭 | 정원·수목원·꽃밭 | rule_classified |
| 3015608 | 수망리 마흐니숲길 | 숲·휴양림 | rule_classified |
| 3015632 | 쇠소깍산물관광농원 | 농어촌 체험 | rule_classified |
| 3015651 | 태웃개 | 해변·해안 | rule_classified |
| 3015718 | 편백포레스트 | 동물·목장·수족관 | rule_classified |
| 3015782 | 거린사슴전망대 | 전망대·등대·경관시설 | rule_classified |
| 3022258 | 제원하늘농원 | 온천·스파·웰니스 | rule_classified |
| 3026604 | 효명사 | 유적·종교시설 | rule_classified |
| 3026668 | 안덕 월라봉 | 산·오름 | rule_classified |
| 3026711 | 가시리국산화풍력발전단지 | 전망대·등대·경관시설 | rule_classified |
| 3026734 | 표선소금막해변 | 해변·해안 | rule_classified |
| 3027466 | 달달미깡감귤밭 | 농어촌 체험 | rule_classified |
| 3030120 | 옥돔마을 | 음식점·주점 | rule_classified |
| 3030178 | 로빙화 | 음식점·주점 | rule_classified |
| 3030250 | 온더스톤 브런치카페 제주성산점 | 음식점·주점 | rule_classified |
| 3030286 | 어린왕자감귤밭 | 카페·찻집·베이커리 | rule_classified |
| 3030351 | 서귀포예술의전당 | 공연 | rule_classified |
| 3030422 | 제주아리랑 혼 | 공연 | rule_classified |
| 3030930 | 감귤카트 | 육상 레저·스포츠 | rule_classified |
| 3030949 | 우리승마장 | 육상 레저·스포츠 | rule_classified |
| 3030978 | 쇠와꽃승마장 | 육상 레저·스포츠 | rule_classified |
| 3031021 | 제주아리온승마장 | 육상 레저·스포츠 | rule_classified |
| 3031022 | 제주호텔더엠 | 숙박 | rule_classified |
| 3031466 | 디아넥스호텔 | 숙박 | rule_classified |
| 3031467 | 모구리야영장 | 캠핑 | rule_classified |
| 3031492 | 뷰 제주하늘 | 육상 레저·스포츠 | rule_classified |
| 3031517 | 표선해수욕장 야영장 | 캠핑 | rule_classified |
| 3031541 | 하모체육공원 | 공원 | rule_classified |
| 3031552 | 서귀포홍리실내수영장 | 수상·해양 레저 | rule_classified |
| 3031571 | 서광카트체험장 | 육상 레저·스포츠 | rule_classified |
| 3031581 | 카세로지 | 숙박 | rule_classified |
| 3035057 | 구팔일 댕댕이 대잔치！ | 축제·행사 | rule_classified |
| 3037417 | 미깡창고 | 농어촌 체험 | rule_classified |
| 3037574 | [한라산 둘레길 9구간] 숫모르편백숲길 | 걷기·트레킹 코스 | rule_classified |
| 3037603 | 맛동산 감귤체험농장 | 농어촌 체험 | rule_classified |
| 3037623 | 제주 스카이워터쇼 | 공연 | rule_classified |
| 3037793 | 금능돌담해변길 | 해변·해안 | rule_classified |
| 3037925 | 스페이스제로 | 카페·찻집·베이커리 | rule_classified |
| 3037977 | 청아투명카약 | 수상·해양 레저 | rule_classified |
| 3038062 | 제주이호랜드 | 해변·해안 | rule_classified |
| 3038449 | 더힐링타임 | 카페·찻집·베이커리 | rule_classified |
| 3038479 | 장생의숲길 | 숲·휴양림 | rule_classified |
| 3056135 | 호떡골목 | 마을·거리 | rule_classified |
| 3056151 | 제동목장 입구 | 마을·거리 | rule_classified |
| 3056205 | 관곶 | 해변·해안 | rule_classified |
| 3056279 | 누웨마루거리 | 마을·거리 | rule_classified |
| 3056356 | 카페술도가제주바당 | 음식점·주점 | rule_classified |
| 3056401 | 감수굴 밭담길 | 마을·거리 | rule_classified |
| 3056448 | 올레바당체험마을 | 농어촌 체험 | rule_classified |
| 3056519 | 귤의정원 바령 | 농어촌 체험 | rule_classified |
| 3056592 | 용담레포츠공원 | 공원 | rule_classified |
| 3056625 | 애월한담공원 | 해변·해안 | rule_classified |
| 3056663 | 엉알해안산책로 | 해변·해안 | rule_classified |
| 3056829 | 제주바다체험장 | 농어촌 체험 | rule_classified |
| 3057021 | 개똥이네농장 | 농어촌 체험 | rule_classified |
| 3057180 | 차귀도유람선 | 수상·해양 레저 | rule_classified |
| 3057219 | 두산봉 | 산·오름 | rule_classified |
| 3057244 | 조천만세동산 | 유적·종교시설 | rule_classified |
| 3057286 | 함덕잠수함 | 수상·해양 레저 | rule_classified |
| 3057363 | 탐나는농장 | 농어촌 체험 | rule_classified |
| 3057412 | 보메와산감귤체험농장 | 농어촌 체험 | rule_classified |
| 3057498 | 자드부팡 | 카페·찻집·베이커리 | rule_classified |
| 3059362 | 혼저 | 음식점·주점 | rule_classified |
| 3061575 | 흑돼지거리 | 마을·거리 | rule_classified |
| 3061637 | 렛츠런팜 | 동물·목장·수족관 | rule_classified |
| 3061676 | 너븐숭이 4.3기념관 | 박물관·미술관·전시 | rule_classified |
| 3061701 | 용두암해안도로 | 해변·해안 | rule_classified |
| 3061738 | 산지항로표지관리소 | 전망대·등대·경관시설 | rule_classified |
| 3061788 | 삼다수승마목장 | 육상 레저·스포츠 | rule_classified |
| 3062141 | 카페광령올레17 | 카페·찻집·베이커리 | rule_classified |
| 3063420 | 디앤디파트먼트 | 쇼핑·서점 | user_confirmed |
| 3065203 | 애월본카페 | 카페·찻집·베이커리 | rule_classified |
| 3066880 | 이스트포레스트 | 음식점·주점 | rule_classified |
| 3066924 | 제주웰컴센터 | 교통·관광안내 | rule_classified |
| 3066943 | 귀덕바다투명카약 | 수상·해양 레저 | rule_classified |
| 3066990 | 중문오프로드체험장 | 육상 레저·스포츠 | rule_classified |
| 3067040 | 제주홀스타승마장 | 육상 레저·스포츠 | rule_classified |
| 3067072 | 뱅듸승마클럽 | 육상 레저·스포츠 | rule_classified |
| 3069080 | 유채꽃재배단지 | 정원·수목원·꽃밭 | rule_classified |
| 3071677 | 서귀포 제주에인 감귤밭 카페 | 카페·찻집·베이커리 | rule_classified |
| 3071718 | 엉또돌다카페앤농원 | 농어촌 체험 | rule_classified |
| 3071744 | 속골유원지 | 공원 | rule_classified |
| 3071776 | 트로이테마농원 | 농어촌 체험 | rule_classified |
| 3071796 | 제주향농원 | 농어촌 체험 | rule_classified |
| 3071816 | 오저여 | 해변·해안 | rule_classified |
| 3071841 | 에코승마아카데미 | 육상 레저·스포츠 | rule_classified |
| 3071875 | 제주송정농원 | 농어촌 체험 | rule_classified |
| 3073199 | 유리바닥보트 | 수상·해양 레저 | rule_classified |
| 3075388 | 생약누리 | 박물관·미술관·전시 | rule_classified |
| 3075941 | 온오프 | 음식점·주점 | rule_classified |
| 3076367 | 아름다운리조트 | 숙박 | rule_classified |
| 3076375 | 골드원호텔앤스위트 | 숙박 | rule_classified |
| 3076381 | 유어스호텔 | 숙박 | rule_classified |
| 3076392 | 오션스퀘어리조트 | 숙박 | rule_classified |
| 3076441 | 제주헬스케어타운리조트 | 숙박 | rule_classified |
| 3076447 | 블룸호텔 | 숙박 | rule_classified |
| 3076459 | 비케이호텔 제주(BK호텔 제주) | 숙박 | rule_classified |
| 3076467 | 담모라 호텔앤리조트 | 숙박 | rule_classified |
| 3076478 | 키코앤일레인호텔 | 숙박 | rule_classified |
| 3076484 | 이스턴호텔제주 | 숙박 | rule_classified |
| 3076491 | 제주티라호텔 | 숙박 | rule_classified |
| 3079902 | 샐리스제주호텔 | 숙박 | rule_classified |
| 3079917 | 팜파스호텔 제주 | 숙박 | rule_classified |
| 3079932 | 제주노블레스관광호텔 | 숙박 | rule_classified |
| 3079939 | 라마다제주함덕호텔 | 숙박 | rule_classified |
| 3079952 | 제주서우봉비치호텔 | 숙박 | rule_classified |
| 3079965 | 탑스텐 빌라드 애월 제주 | 숙박 | rule_classified |
| 3079973 | 일성리조트 제주비치 | 숙박 | rule_classified |
| 3079994 | MJ리조트 | 숙박 | rule_classified |
| 3080046 | 수앤수리조트&호텔 | 숙박 | rule_classified |
| 3080144 | 김경숙해바라기농장 | 정원·수목원·꽃밭 | rule_classified |
| 3080165 | 봄날 | 카페·찻집·베이커리 | rule_classified |
| 3080382 | 아이미제주비치호텔 함덕 | 숙박 | rule_classified |
| 3080405 | 캔디원 | 공방·만들기 체험 | rule_classified |
| 3080468 | 마노르블랑 | 카페·찻집·베이커리 | rule_classified |
| 3081317 | 일출봉유채밭 | 정원·수목원·꽃밭 | rule_classified |
| 3082119 | 발트하우스 | 숙박 | rule_classified |
| 3082301 | 감사공묘역 | 유적·종교시설 | rule_classified |
| 3083715 | 제주홀릭뮤지엄 | 박물관·미술관·전시 | rule_classified |
| 3084957 | 리치호텔 | 숙박 | rule_classified |
| 3084988 | 아덴힐리조트&골프 | 숙박 | rule_classified |
| 3089161 | 호텔컬리넌 제주 | 숙박 | rule_classified |
| 3089169 | 호텔스위트캐슬 | 숙박 | rule_classified |
| 3089186 | 글로스터호텔 제주 | 숙박 | rule_classified |
| 3089195 | 어반아일랜드호텔 | 숙박 | rule_classified |
| 3090896 | 더스테이센추리호텔 | 숙박 | rule_classified |
| 3097805 | 떠오르길·김녕 바닷길 | 해변·해안 | rule_classified |
| 3097814 | 세기알해변 | 해변·해안 | rule_classified |
| 3102129 | 연월한옥 | 숙박 | rule_classified |
| 3108284 | 우도 소라축제 | 축제·행사 | rule_classified |
| 3110802 | 씬오브제주 | 공방·만들기 체험 | rule_classified |
| 3112168 | 아우아우 | 카페·찻집·베이커리 | rule_classified |
| 3303346 | 하우스오브레퓨즈 | 문화·교육 체험시설 | user_confirmed |
| 3303893 | 목장카페 밭디 | 카페·찻집·베이커리 | rule_classified |
| 3305345 | 오렌즈 신제주점 | 쇼핑·서점 | rule_classified |
| 3305425 | CU 제주신화빌라스점 | 쇼핑·서점 | rule_classified |
| 3305511 | CU 제주열린점 | 쇼핑·서점 | rule_classified |
| 3305535 | 코치 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3305644 | 마쥬 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3305715 | 톡스앤필의원 제주점 | 쇼핑·서점 | rule_classified |
| 3305760 | 올리브영 서귀포점 | 쇼핑·서점 | rule_classified |
| 3305767 | 휴고보스 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3305785 | 세인트앤드류스 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3305786 | GS25 서귀오션점 | 쇼핑·서점 | rule_classified |
| 3305842 | 빌라봉 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3305879 | 토즈 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306086 | SI빌리지 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306117 | 와인피부과의원 | 쇼핑·서점 | rule_classified |
| 3306134 | 올리브영 제주 타운 | 쇼핑·서점 | rule_classified |
| 3306189 | 에스마켓 신제주점 | 쇼핑·서점 | rule_classified |
| 3306257 | 올리브영 제주제원점 | 쇼핑·서점 | rule_classified |
| 3306392 | 올리브영 제주나인몰점 | 쇼핑·서점 | rule_classified |
| 3306402 | 헌터 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306485 | 써스데이아일랜드 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306640 | 올리브영 제주일도이동점 | 쇼핑·서점 | rule_classified |
| 3306704 | 질스튜어트 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306775 | 한섬 아울렛 FX 타임옴므 제주점 | 쇼핑·서점 | rule_classified |
| 3306785 | 골프존마켓 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306805 | 미즈노 신제주점 | 쇼핑·서점 | rule_classified |
| 3306817 | 올리브영 제주월랑로점 | 쇼핑·서점 | rule_classified |
| 3306863 | 락포트 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306873 | 캘빈클라인언더웨어 제주대리점 | 쇼핑·서점 | rule_classified |
| 3306874 | 노스페이스 신제주점 | 쇼핑·서점 | rule_classified |
| 3306898 | 송지오 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306940 | 올리브영 제주세화점 | 쇼핑·서점 | rule_classified |
| 3306943 | 디스커버리 제주점 | 쇼핑·서점 | rule_classified |
| 3306952 | 구호 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3306983 | 페세리코 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3307027 | 골든구스 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3307036 | 엄브로 제주점 | 쇼핑·서점 | rule_classified |
| 3307062 | 지오다노 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3307094 | 롯데하이마트 서귀포점 | 쇼핑·서점 | rule_classified |
| 3307098 | 라이프워크 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3307106 | CU 제주항국제여객터미널 | 쇼핑·서점 | rule_classified |
| 3307329 | 올리브영 서귀포광장점 | 쇼핑·서점 | rule_classified |
| 3307452 | 올리브영 제주한라대점 | 쇼핑·서점 | rule_classified |
| 3307504 | 올리브영 제주아라일동점 | 쇼핑·서점 | rule_classified |
| 3307523 | 북앤북스 | 쇼핑·서점 | rule_classified |
| 3307669 | 아이잗바바 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3307688 | 올리브영 제주협재점 | 쇼핑·서점 | rule_classified |
| 3307736 | 듀엘 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 3317905 | 현애원 | 정원·수목원·꽃밭 | rule_classified |
| 3318880 | 제8회 농촌융복합산업 제주국제박람회 | 축제·행사 | rule_classified |
| 3329719 | 제주안전체험관 | 문화·교육 체험시설 | rule_classified |
| 3331534 | 나무와열매 체험농장 | 농어촌 체험 | rule_classified |
| 3343597 | 오레브핫스프링앤스파 | 온천·스파·웰니스 | rule_classified |
| 3344437 | 가파도 소망전망대 | 전망대·등대·경관시설 | rule_classified |
| 3344565 | JW 메리어트 제주 리조트 & 스파 | 숙박 | rule_classified |
| 3349628 | 제주독서대전 | 축제·행사 | rule_classified |
| 3371999 | 제주동화마을 | 공원 | rule_classified |
| 3374822 | 서귀포은갈치축제 | 축제·행사 | rule_classified |
| 3386123 | 주정공장수용소 4·3역사관 | 박물관·미술관·전시 | rule_classified |
| 3396532 | 안의울림 | 온천·스파·웰니스 | rule_classified |
| 3399432 | 2026 제5회 제주비엔날레 허끄곡 모닥치곡 이야홍 : 변용의 기술 | 축제·행사 | rule_classified |
| 3401751 | 카페에벤에셀 | 카페·찻집·베이커리 | rule_classified |
| 3410530 | 뽀로로앤타요 테마파크 제주 | 테마파크·놀이시설 | rule_classified |
| 3410648 | 가을동화 감귤밭 | 농어촌 체험 | rule_classified |
| 3424281 | 코오롱스포츠 솟솟리버스제주점 | 쇼핑·서점 | rule_classified |
| 3434312 | 연리지가든 | 음식점·주점 | rule_classified |
| 3434326 | 언덕집국수 | 음식점·주점 | rule_classified |
| 3434327 | 신창흑돼지두루치기 | 음식점·주점 | rule_classified |
| 3439423 | 아르떼 키즈파크 제주 | 테마파크·놀이시설 | rule_classified |
| 3443241 | 코리코카페 제주점 | 카페·찻집·베이커리 | rule_classified |
| 3444948 | 부부요리단 | 음식점·주점 | rule_classified |
| 3464225 | 제주 서핑도 실내서핑장 | 수상·해양 레저 | rule_classified |
| 3478595 | 레몬뮤지엄 | 카페·찻집·베이커리 | rule_classified |
| 3482354 | 골체오름 벚꽃축제 | 축제·행사 | rule_classified |
| 3482430 | 켄싱턴리조트 제주중문 | 숙박 | rule_classified |
| 3483664 | 대한목장 | 카페·찻집·베이커리 | rule_classified |
| 3487794 | 선셋티아 | 숙박 | rule_classified |
| 3491457 | 빛의 섬 루미버스 | 테마파크·놀이시설 | rule_classified |
| 3492149 | 모아시 (MOASI) | 카페·찻집·베이커리 | rule_classified |
| 3495841 | 숲으로 오라 | 축제·행사 | rule_classified |
| 3497636 | 자매국수 | 음식점·주점 | rule_classified |
| 3498094 | 세화리 농어촌체험휴양마을 | 농어촌 체험 | rule_classified |
| 3502045 | 선물고팡 공항본점 | 쇼핑·서점 | rule_classified |
| 3505052 | 꽃귤농장 | 농어촌 체험 | rule_classified |
| 3512205 | 2026 서귀포 원도심 문화페스티벌 | 축제·행사 | rule_classified |
| 3515241 | 호텔 골든데이지 서귀포오션 | 숙박 | rule_classified |
| 3520495 | 취다선 리조트 | 숙박 | rule_classified |
| 3530351 | 샛도리물 | 해변·해안 | rule_classified |
| 3530411 | 정모시쉼터 | 폭포·계곡 | rule_classified |
| 3543626 | 몽라브 | 카페·찻집·베이커리 | rule_classified |
| 3544591 | 포켓몬 원더 아일랜드 in JEJU | 축제·행사 | rule_classified |
| 3545110 | 메르시제주소품샵 | 쇼핑·서점 | rule_classified |
| 3545698 | [제주올레 18-2코스] 하추자 올레 | 걷기·트레킹 코스 | rule_classified |
| 3545719 | 돌낭예술원 | 정원·수목원·꽃밭 | rule_classified |
| 3545735 | 만춘서점 | 쇼핑·서점 | rule_classified |
| 3545966 | 갈치바다 애월 | 음식점·주점 | rule_classified |
| 3546163 | 김영수도서관 | 문화·교육 체험시설 | rule_classified |
| 3546746 | 백가네제주한상 함덕본점 | 음식점·주점 | rule_classified |
| 3546882 | 2025 음악실연자 페스티벌 | 축제·행사 | rule_classified |
| 3553653 | 온평리 포구 | 해변·해안 | rule_classified |
| 3553902 | 신산환해장성 | 유적·종교시설 | rule_classified |
| 3553979 | 소라의성 | 전망대·등대·경관시설 | rule_classified |
| 3554702 | 원도심 야간여행 ‘섬夜시즌’ 운영 | 축제·행사 | rule_classified |
| 3557958 | 상추자항 | 해변·해안 | rule_classified |
| 3559559 | 두머니물공원 | 공원 | rule_classified |
| 3559716 | 대수산봉 | 산·오름 | rule_classified |
| 3559736 | 통오름 | 산·오름 | rule_classified |
| 3559794 | 모진이몽돌해변 | 해변·해안 | rule_classified |
| 3563239 | 남원용암해수풀장 | 수상·해양 레저 | rule_classified |
| 3571055 | 무릉외갓집 | 쇼핑·서점 | rule_classified |
| 3584915 | 코코컬처클럽 | 문화·교육 체험시설 | user_confirmed |
| 4002242 | 소랑아시 | 쇼핑·서점 | rule_classified |
| 4002695 | 대들보 | 음식점·주점 | rule_classified |
| 4002730 | 바다풍경 정육식당 | 음식점·주점 | rule_classified |
| 4002769 | 이금돈지 | 음식점·주점 | rule_classified |
| 4002802 | 제미니국수김밥 | 음식점·주점 | rule_classified |
| 4002839 | 제주할망밥상 | 음식점·주점 | rule_classified |
| 4002890 | 더해장 | 음식점·주점 | rule_classified |
| 4002932 | 볼고롱짬뽕 | 음식점·주점 | rule_classified |
| 4009584 | 러쉬 제주점 | 쇼핑·서점 | rule_classified |
| 4009585 | 올리브영 서귀포동광점 | 쇼핑·서점 | rule_classified |
| 4009586 | 탠디 신세계사이먼프리미엄 아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4009587 | 올리브영 서귀포혁신도시점 | 쇼핑·서점 | rule_classified |
| 4009588 | 나이키골프 제주중문점 | 쇼핑·서점 | rule_classified |
| 4009589 | 내셔널지오그래픽 서귀포점 | 쇼핑·서점 | rule_classified |
| 4009590 | 렌즈미 에비뉴안경 노형점 | 쇼핑·서점 | rule_classified |
| 4009591 | 올리브영 제주삼화점 | 쇼핑·서점 | rule_classified |
| 4009592 | 디어브리즈 | 쇼핑·서점 | rule_classified |
| 4009593 | 제주김치스쿨 | 쇼핑·서점 | rule_classified |
| 4009594 | 귤귤스토어 도두점 | 쇼핑·서점 | rule_classified |
| 4009595 | 올리브영 제주용담점 | 쇼핑·서점 | rule_classified |
| 4009596 | 몽클락 제주 | 쇼핑·서점 | rule_classified |
| 4009597 | 스노우피크 신제주점 | 쇼핑·서점 | rule_classified |
| 4009598 | 렌즈미 신제주점 | 쇼핑·서점 | rule_classified |
| 4009599 | 마리떼프랑스와저버 신제주점 | 쇼핑·서점 | rule_classified |
| 4009600 | CU 제주애월한담점 | 쇼핑·서점 | rule_classified |
| 4009601 | 섬타르 신제주점 | 쇼핑·서점 | rule_classified |
| 4009602 | 스마트약국 제주 | 쇼핑·서점 | rule_classified |
| 4009603 | 더한섬하우스 제주점 | 쇼핑·서점 | rule_classified |
| 4009610 | 디즈니골프 제주중앙지하상가점 | 쇼핑·서점 | rule_classified |
| 4009611 | 그린조이 제주중앙지하상가점 | 쇼핑·서점 | rule_classified |
| 4009612 | 모노로그 제주중앙지하상가점 | 쇼핑·서점 | rule_classified |
| 4009613 | 소품샵 제주소품 함덕점 | 쇼핑·서점 | rule_classified |
| 4009614 | 노르디스크 제주점 | 쇼핑·서점 | rule_classified |
| 4009615 | 로이드 제주점 | 쇼핑·서점 | rule_classified |
| 4009616 | 디스이즈네버댓 제주점 | 쇼핑·서점 | rule_classified |
| 4009617 | 문화공간 휴 | 쇼핑·서점 | rule_classified |
| 4009618 | 살로몬 제주점 | 쇼핑·서점 | rule_classified |
| 4012413 | 블랙야크 제주점 | 쇼핑·서점 | rule_classified |
| 4012996 | 안녕성산 | 쇼핑·서점 | rule_classified |
| 4012997 | 듀엘 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4012998 | 골든듀 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4012999 | 월드컵약국 | 쇼핑·서점 | rule_classified |
| 4013000 | 삼성스토어 서귀포 | 쇼핑·서점 | rule_classified |
| 4013001 | 중문안경방 | 쇼핑·서점 | rule_classified |
| 4013002 | 에잇세컨즈 서귀포점 | 쇼핑·서점 | rule_classified |
| 4013003 | 오름약국 | 쇼핑·서점 | rule_classified |
| 4013004 | 아이더 서귀포점 | 쇼핑·서점 | rule_classified |
| 4013200 | 코오롱스포츠 서귀포명동로점 | 쇼핑·서점 | rule_classified |
| 4013201 | 코오롱스포츠 신제주점 | 쇼핑·서점 | rule_classified |
| 4013202 | 더조은약국 | 쇼핑·서점 | rule_classified |
| 4013203 | 브라운브레스 제주칠성점 | 쇼핑·서점 | rule_classified |
| 4013204 | 탠저비 칠성로점 | 쇼핑·서점 | rule_classified |
| 4013205 | 리복 제주점 | 쇼핑·서점 | rule_classified |
| 4013206 | 내셔널지오그래픽키즈 제주점 | 쇼핑·서점 | rule_classified |
| 4013207 | 에브리바디빈티지 | 쇼핑·서점 | rule_classified |
| 4013208 | 아이더 신제주점 | 쇼핑·서점 | rule_classified |
| 4013209 | 마운티아 신제주점 | 쇼핑·서점 | rule_classified |
| 4013210 | 안녕제주 | 쇼핑·서점 | rule_classified |
| 4013211 | 올리브영 제주연동신라점 | 쇼핑·서점 | rule_classified |
| 4013212 | 에이플러스건강식품 | 쇼핑·서점 | rule_classified |
| 4013213 | 365열린약국 | 쇼핑·서점 | rule_classified |
| 4013214 | 롯데하이마트 신제주점 | 쇼핑·서점 | rule_classified |
| 4013215 | 휠라언더웨어 신제주점 | 쇼핑·서점 | rule_classified |
| 4013216 | 탠저비 한라병원점 | 쇼핑·서점 | rule_classified |
| 4013217 | 아이엠제주 탠저비 | 쇼핑·서점 | rule_classified |
| 4013218 | 한라미디어 | 쇼핑·서점 | rule_classified |
| 4013219 | 쌤소나이트 제주오라아울렛점 | 쇼핑·서점 | rule_classified |
| 4013220 | 탠저비 도두점 | 쇼핑·서점 | rule_classified |
| 4013221 | 어코드 제주 | 쇼핑·서점 | rule_classified |
| 4013222 | 피크 | 쇼핑·서점 | rule_classified |
| 4013223 | 슈마커 플러스 제주연동점 | 쇼핑·서점 | rule_classified |
| 4013224 | ABC마트 GSA 신제주연동점 | 쇼핑·서점 | rule_classified |
| 4013225 | 탠저비 제원점 | 쇼핑·서점 | rule_classified |
| 4013226 | GS25 연동서강점 | 쇼핑·서점 | rule_classified |
| 4013227 | 한라사이클 | 쇼핑·서점 | rule_classified |
| 4013228 | 귤귤스토어 애월점 | 쇼핑·서점 | rule_classified |
| 4013229 | 러블리제주 | 쇼핑·서점 | rule_classified |
| 4013230 | 하이츠 제주 | 쇼핑·서점 | rule_classified |
| 4013231 | 갤럭시 제주점 | 쇼핑·서점 | rule_classified |
| 4013232 | 말본골프 포트메인 제주직영점 | 쇼핑·서점 | rule_classified |
| 4013233 | 어메이징크리 제주점 | 쇼핑·서점 | rule_classified |
| 4013234 | 유타골프 제주점 | 쇼핑·서점 | rule_classified |
| 4013235 | 제주오라쇼핑 | 쇼핑·서점 | rule_classified |
| 4013236 | 스포츠메카 외도본점 | 쇼핑·서점 | rule_classified |
| 4013237 | 아일랜드 프로젝트 본점 | 쇼핑·서점 | rule_classified |
| 4013238 | 헬로제주 | 쇼핑·서점 | rule_classified |
| 4013239 | K2 제주MS | 쇼핑·서점 | rule_classified |
| 4013240 | 테일러메이드 구제주점 | 쇼핑·서점 | rule_classified |
| 4013241 | 링스스포츠 | 쇼핑·서점 | rule_classified |
| 4013242 | 무자크 제주중앙점 | 쇼핑·서점 | rule_classified |
| 4013243 | 안경사랑 제주시 | 쇼핑·서점 | rule_classified |
| 4013244 | 양키캔들 제주칠성로점 | 쇼핑·서점 | rule_classified |
| 4013245 | 아레나 제주점 | 쇼핑·서점 | rule_classified |
| 4013246 | 커버낫 제주점 | 쇼핑·서점 | rule_classified |
| 4013247 | 나이키칠성로점 | 쇼핑·서점 | rule_classified |
| 4013248 | 수풀 | 쇼핑·서점 | rule_classified |
| 4013249 | 낙산약국 | 쇼핑·서점 | rule_classified |
| 4013356 | 아일로 서귀포점 | 쇼핑·서점 | rule_classified |
| 4017092 | 금배네민박 | 숙박 | rule_classified |
| 4026795 | 베베드피노 서귀포점 | 쇼핑·서점 | rule_classified |
| 4026796 | 라이프워크 메가스토어 제주점 | 쇼핑·서점 | rule_classified |
| 4026797 | 아이에비뉴 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026798 | 코메타엘엑스 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026799 | 페트레이 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026800 | 산드로 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026801 | 아크테릭스 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026802 | 안다르 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026803 | 어뉴골프 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026804 | 와키윌리 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026805 | 조안테디베어 제주신화월드점 | 쇼핑·서점 | rule_classified |
| 4026806 | 커버낫 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026807 | 키르시 신세계사이먼프리미엄아울렛 제주점 | 쇼핑·서점 | rule_classified |
| 4026808 | 신화테마파크 | 쇼핑·서점 | rule_classified |
| 4026809 | 라이프워크 메가스토어 서귀포점 | 쇼핑·서점 | rule_classified |
| 4026810 | 다이소 서귀포혁신도시점 | 쇼핑·서점 | rule_classified |
| 4026811 | 모던하우스 서귀포점 | 쇼핑·서점 | rule_classified |
| 4026812 | 다이소 서귀포중문점 | 쇼핑·서점 | rule_classified |
| 4026813 | 캄포스 제주 부티크 | 쇼핑·서점 | rule_classified |
| 4026814 | 버디 | 쇼핑·서점 | rule_classified |
| 4026815 | 휠라키즈 서귀포점 | 쇼핑·서점 | rule_classified |
| 4026816 | 아리따움 제주서귀포점 | 쇼핑·서점 | rule_classified |
| 4026817 | 호성이네 빛나는 선물가게 | 쇼핑·서점 | rule_classified |
| 4026818 | 올레올레 서귀포올레시장점 | 쇼핑·서점 | rule_classified |
| 4026819 | 아트박스 서귀포점 | 쇼핑·서점 | rule_classified |
| 4026820 | CU 서귀포항점 | 쇼핑·서점 | rule_classified |
| 4026821 | 다이소 제주노형점 | 쇼핑·서점 | rule_classified |
| 4026822 | 정관장 일도점 | 쇼핑·서점 | rule_classified |
| 4026823 | 다이소 제주동문시장점 | 쇼핑·서점 | rule_classified |
| 4026824 | 레코브 씨티어브드림즈 제주점 | 쇼핑·서점 | rule_classified |
| 4026825 | 라이프워크 제주탑동직영점 | 쇼핑·서점 | rule_classified |
| 4026826 | 루이까스텔 칠성점 | 쇼핑·서점 | rule_classified |
| 4026827 | 수박빈티지 | 쇼핑·서점 | rule_classified |
| 4026828 | EE플레이스 제주시청점 | 쇼핑·서점 | rule_classified |
| 4026829 | 코데즈컴바인 제주이도점 | 쇼핑·서점 | rule_classified |
| 4026830 | 오브젝트 제주점 | 쇼핑·서점 | rule_classified |
| 4026831 | 제주동화마을 | 쇼핑·서점 | rule_classified |
| 4026832 | 헬로제주 구좌점 | 쇼핑·서점 | rule_classified |
| 4026833 | 조랑말을탄돈키호테제주소품샵 노형점 | 쇼핑·서점 | rule_classified |
| 4026834 | 다비치안경 신제주점 | 쇼핑·서점 | rule_classified |
| 4026835 | 피렌체 제주점 | 쇼핑·서점 | rule_classified |
| 4026836 | 와이드앵글 신제주점 | 쇼핑·서점 | rule_classified |
| 4026837 | ABC마트 GS 제주본점 | 쇼핑·서점 | rule_classified |
| 4026838 | GS25 제주노형점 | 쇼핑·서점 | rule_classified |
| 4026839 | 한국선간보 | 쇼핑·서점 | rule_classified |
| 4026840 | 토이마켓 제주점 | 쇼핑·서점 | rule_classified |
| 4026841 | 와인창고 동문시장점 | 쇼핑·서점 | rule_classified |
| 4026842 | 마이제주기프트 | 쇼핑·서점 | rule_classified |
| 4026843 | 아식스 신제주점 | 쇼핑·서점 | rule_classified |
| 4026844 | 정관장 연동점 | 쇼핑·서점 | rule_classified |
| 4026845 | 혜명한약국 | 쇼핑·서점 | rule_classified |
| 4026846 | CU 도두항점 | 쇼핑·서점 | rule_classified |
| 4026847 | 랜드로바 신제주점 | 쇼핑·서점 | rule_classified |
| 4026848 | 구호 신제주점 | 쇼핑·서점 | rule_classified |
| 4026849 | 비너스 와코루 마더피아 신제주특별자치도점 | 쇼핑·서점 | rule_classified |
| 4026850 | 믹스존 | 쇼핑·서점 | rule_classified |
| 4026851 | 라이프워크 메가스토어 애월점 | 쇼핑·서점 | rule_classified |
| 4026852 | 한국금거래소 제주직영점 | 쇼핑·서점 | rule_classified |
| 4026853 | 블랙야크키즈 제주점 | 쇼핑·서점 | rule_classified |
| 4026854 | AK골프 제주점 | 쇼핑·서점 | rule_classified |
| 4026855 | 타이틀리스트 제주점 | 쇼핑·서점 | rule_classified |
| 4026856 | 한국인삼백화점 | 쇼핑·서점 | rule_classified |
| 4026857 | 삼성스토어 제주인화 | 쇼핑·서점 | rule_classified |
| 4026858 | CU 제주연오로점 | 쇼핑·서점 | rule_classified |
| 4026859 | 정관장 노형점 | 쇼핑·서점 | rule_classified |
| 4026860 | 종종제주 | 쇼핑·서점 | rule_classified |
| 4026861 | 핸썸제주 | 쇼핑·서점 | rule_classified |
| 4026862 | 다이소 제주시청점 | 쇼핑·서점 | rule_classified |
| 4026863 | ABC마트 SP 제주시청점 | 쇼핑·서점 | rule_classified |
| 4026864 | 오렌즈 제주시청점 | 쇼핑·서점 | rule_classified |
| 4026865 | 마뗑킴 하고하우스 제주점 | 쇼핑·서점 | rule_classified |
| 4026866 | 아이더 제주점 | 쇼핑·서점 | rule_classified |
| 4026867 | 탑동보룡약국 | 쇼핑·서점 | rule_classified |
| 4026868 | 헬리녹스 크리에이티브 센터 제주 | 쇼핑·서점 | rule_classified |
| 4026869 | 이솝 제주 | 쇼핑·서점 | rule_classified |
| 4026870 | 다이소 제주애월점 | 쇼핑·서점 | rule_classified |
| 4026871 | 다이소 제주연동본점 | 쇼핑·서점 | rule_classified |
| 4026872 | 다이소 제주함덕점 | 쇼핑·서점 | rule_classified |
| 4033076 | 미스터밀크 송당점 | 카페·찻집·베이커리 | rule_classified |
| 4039258 | 제20회 한국후계농업경영인 전국대회 | 축제·행사 | rule_classified |
| 4039339 | 1100도로 | 경관·걷기 | user_confirmed |
| 4053764 | 담소요 | 카페·찻집·베이커리 | rule_classified |
| 4054291 | 생각하는 정원[면세점(TAX REFUND SHOP)] | 쇼핑·서점 | rule_classified |
| 4054311 | 모이소[면세점(TAX REFUND SHOP)] | 쇼핑·서점 | rule_classified |
| 4054639 | 시인이생진시비거리 | 마을·거리 | rule_classified |
| 4055439 | 카페 어림비 | 카페·찻집·베이커리 | rule_classified |
| 4056853 | 애월전당포 | 카페·찻집·베이커리 | rule_classified |
| 4057071 | 적점 제주 | 음식점·주점 | rule_classified |
| 4057123 | 종이잡지클럽 제주 | 쇼핑·서점 | rule_classified |
| 4057186 | 뚜띠콜로리 뮤제오 | 쇼핑·서점 | rule_classified |
| 4057215 | 회수다옥 | 카페·찻집·베이커리 | rule_classified |
| 4057731 | 제주책방·사랑방 | 문화·교육 체험시설 | rule_classified |
| 4057922 | 건입박물관 | 박물관·미술관·전시 | rule_classified |
| 4057941 | 제주물사랑홍보관 | 박물관·미술관·전시 | rule_classified |
| 4058075 | 사슴책방 | 쇼핑·서점 | rule_classified |
| 4058180 | 우뭇개해안 | 해변·해안 | rule_classified |
| 4058357 | 책방 소리소문 | 쇼핑·서점 | rule_classified |
| 4058390 | 신라스테이 플러스 이호테우 | 숙박 | rule_classified |
| 4060475 | 엄마국수 | 음식점·주점 | rule_classified |
| 4060735 | 하르방식당 | 음식점·주점 | rule_classified |
| 4060785 | 이끼숲소길 | 카페·찻집·베이커리 | rule_classified |
| 4060957 | 하리보 해피월드 | 박물관·미술관·전시 | rule_classified |
| 4061120 | 아라동 치유의 숲 | 숲·휴양림 | rule_classified |
| 4063148 | 수산저수지 | 호수·습지 | rule_classified |
| 4063885 | 안친오름 | 산·오름 | rule_classified |
| 4068781 | 뽈살집 본점 | 음식점·주점 | rule_classified |
| 4071126 | 핀스 | 카페·찻집·베이커리 | rule_classified |
| 4071128 | 뿔소라공원 | 해변·해안 | rule_classified |
| 4071129 | 코바라멘 | 음식점·주점 | rule_classified |
| 4073368 | 향사당 | 유적·종교시설 | rule_classified |
| 4073374 | 음파 | 카페·찻집·베이커리 | rule_classified |
| 4074622 | 연호제 구내식당 | 음식점·주점 | rule_classified |
| 4075750 | 보말칼국수 해월정 | 음식점·주점 | rule_classified |
| 4075756 | 소농로드 | 카페·찻집·베이커리 | rule_classified |
| 4078062 | 족은노꼬메오름 | 산·오름 | rule_classified |
| 4081269 | 파르나스 호텔 제주 | 숙박 | rule_classified |
| 4083815 | 고국수 | 음식점·주점 | rule_classified |
| 4091197 | 흘아카이브 | 박물관·미술관·전시 | rule_classified |
| 4092010 | 남매네왕갈치 | 음식점·주점 | rule_classified |
| 4092698 | 이상한선물가게앨리스 | 쇼핑·서점 | rule_classified |
| 4093735 | 오르머 | 쇼핑·서점 | rule_classified |
| 4094553 | 용오름stay | 숙박 | rule_classified |
