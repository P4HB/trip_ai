# SPEC-019: 여행 MBTI·적응형 가상 장소 선택 기반 개인 선호 v2

- 상태: Implemented
- 작성일: 2026-08-22
- 최종 수정일: 2026-08-24
- 관련 요청: 여행 MBTI 형태의 질문 UI로 사용자별 장소 라벨 가중치를 추정하고, 애매한 축은 가상 장소 A/B 선택으로 보정해 개인화 추천과 공유 가능한 유형 결과를 제공한다.
- 관련 문서: [문서 색인](README.md), [시스템 아키텍처](architecture.md), [개인화 추천 설계](spec_008.md), [CCU-MMR 알고리즘 초안](ccu_mmr_algorithm_draft.md), [데이터 계약](data_contracts.md), [추천 알고리즘](recommendation_algorithm.md), [평가 전략](evaluation.md), [안전 및 개인정보](safety_privacy.md)
- 관련 코드: `map-ui/preference-elicitation.js`, `map-ui/ccu-mmr.js`, `map-ui/app.js`, `map-ui/index.html`, `map-ui/styles.css`, `travel-mbti-site/`, `scripts/test_preference_elicitation.cjs`, `scripts/test_ccu_mmr.cjs`, `scripts/validate_ccu_mmr_dashboard.cjs`
- 선행 SPEC: [SPEC-008](spec_008.md), [SPEC-014](spec_014.md), [SPEC-017](spec_017.md)
- 후속 초안: [SPEC-018](spec_018.md). 개인화가 장소 관련도 `R_i`를 바꾸므로 SPEC-019를 먼저 구현하고 SPEC-018은 이 결과를 기준으로 일정 계수와 회귀 fixture를 갱신한다.

## 배경

현재 정적 대시보드는 사용자가 18개 원자 라벨의 의미와 `benefit|avoid|target`, 중요도 `1|2|4`를 직접 이해하고 입력해야 한다. 사용자가 실제 여행 상황에 답하면 시스템이 라벨별 선호 방향·강도·확신도를 추정하고, 답변만으로 애매한 축만 가상 장소 A/B 비교로 재질문하는 흐름이 필요하다.

바이럴 결과를 위해 기억하기 쉬운 여행 MBTI 유형도 필요하다. 그러나 유형 하나를 추천 점수에 직접 넣으면 유형 경계 근처 사용자의 추천이 불연속적으로 바뀐다. 따라서 추천 정본은 연속형 라벨 프로필로 두고, 여행 MBTI는 같은 프로필을 결정적으로 요약한 별도 표시 결과로 만든다.

## 사실, 결정, 가정

### 사실

- 추천 점수에 직접 사용하는 취향 축은 원자 라벨 18개다. 파생 Style 6개는 중복 투입하지 않는다.
- Companion과 Month는 이번 여행의 맥락이며 사용자 성격 라벨이 아니다.
- 현행 `ccu-mmr-request-v2`는 선호 중요도 `1|2|4`와 고정 P/A/M 블록 가중치를 사용한다.
- 장소 라벨은 사람 검수 전 `ai_draft`이며 현재 기능은 `internal_experiment`다.

### 승인된 결정

- 사용자 요청으로 2026-08-22에 본 v1 범위를 승인하고 구현을 시작한다.
- 추천 입력은 18개 원자 라벨의 연속형 mean·uncertainty·confidence·weight다.
- 여행 MBTI는 바이럴·설명용 결과이며 후보 자격, 관련도, MMR, 일정에 직접 사용하지 않는다.
- 2026-08-24 사용자 확정에 따라 여행 MBTI는 A/R(활동/휴식)·O/I(야외/실내)·L/H(로컬/핫스폿) 세 축과 8개 유형을 사용하고 P/F는 제거한다.
- 유형 문자는 각 축 전용 6문항의 signed axis evidence로 계산한다. 추천은 같은 답변이 만든 원자 라벨 feature evidence를 사용해 유형 문자와 추천 가중치를 분리한다.
- 산·바다·문화·카페 같은 장소 주제는 서로의 반대축으로 강제하지 않고 연속형 세부 취향으로 유지한다.
- v1은 P/A/M 중요도를 학습하지 않는다. 기존 `0.70/0.15/0.10/0.05`와 활성 블록 재정규화를 유지한다.
- 질문은 축당 6개씩 고정된 상황 질문 18개다. 각 축에서 선택지 방향을 3회씩 뒤집어 위치 편향을 줄인다. 이후 불확실성과 예측 경계가 큰 가상 장소 pair를 최대 3개 적응형으로 제시한다.
- 기존 N/C 자연/문화 문항은 유형 축으로 사용하지 않고 산·바다·경관 대 문화·역사·시장 같은 세부 추천 라벨을 보정하는 가상 장소 pair 카탈로그로 사용한다.
- pair는 실제 장소명·사진을 쓰지 않고 `가상 여행지 A/B`임을 표시한다.
- 자동 활성 feature는 신호가 강한 상위 8개로 제한한다. 미측정·상충·저확신 축은 중립으로 남긴다.
- 새 개인화 요청만 연속형 weight를 허용하는 `ccu-mmr-request-v4-personalized`를 사용한다. 기존 v2 요청은 같은 의미 결과를 유지한다.
- 개인화 알고리즘은 `ccu-mmr-v6-travel-mbti-three-axis`, 결과는 `ccu-mmr-result-v6`다. SPEC-018 일정 변경은 후속 버전을 사용한다.
- 프로필과 응답은 현재 탭의 JavaScript 메모리에만 둔다. Web Storage·URL·서버·분석 이벤트에 저장하지 않는다.
- 공유 기능은 유형 코드·이름·공개 설명·상위 요약 문구만 복사한다. 전체 답변, 라벨 가중치, 확신도는 공유문에 포함하지 않는다.
- 2026-08-24 사용자 재지정에 따라 웹 배포의 주 화면은 단독 질문 UI가 아니라 기존 `map-ui`다. 지도 안에서 질문, 가상 장소 보정, 결과, 라벨 가중치 적용과 추천 실행이 한 흐름으로 이어져야 한다.
- 2026-08-24 사용자 요청에 따라 배포 URL은 ChatGPT 로그인 없이 일반 브라우저에서 바로 열리는 public 접근으로 제공한다.

### 가정과 제한

- 18개 질문과 최대 3개 pair는 모든 취향을 복원하기보다 세 축의 반복 응답과 추천에 유효한 상위 신호를 찾는 내부 실험이다.
- 여행 MBTI는 심리측정학적 MBTI 검사가 아니며 여행 취향을 재미있게 요약한 제품 유형이다.
- 유형 경계에 가까우면 같은 사용자가 다른 시점에 다른 유형을 받을 수 있지만 연속형 추천 가중치는 부드럽게 변한다.

## 목표

- 라벨 용어를 몰라도 3분 안에 여행 취향 프로필을 만들 수 있다.
- 질문에서 애매한 라벨만 가상 장소 선택으로 추가 확인한다.
- 사용자별 연속 가중치를 개인취향 `P` 안에 반영한다.
- 3축 8개 여행 MBTI와 공유 가능한 결과 카드를 제공한다.
- 기존 수동 입력, 필수 조건, 후보 lane, 고정 P/A/M, 코스 variant와 일정 로직을 보존한다.
- 답변 → feature estimate → 활성 preference → 점수 trace를 재현할 수 있다.

## 비목표

- P/A/M 블록 중요도 학습
- 심리검사로 검증된 성격 진단
- 계정·영구 프로필·기기 간 동기화
- 실제 장소 클릭·예약 행동을 사용한 온라인 학습
- 실제 장소나 생성 사진을 A/B 카드에 사용
- 필수 조건, 후보 lane, MMR 계수, 일정 군집 변경
- 운영 사용자 대상 품질 보장

## 요구사항

- `REQ-1901`: 기능은 `internal_experiment`와 `ai_draft`에서만 활성화하고 기존 경고를 유지한다.
- `REQ-1902`: 질문 카탈로그는 stable ID, version, 문구, 선택지와 sparse feature·display trait mapping을 가진다.
- `REQ-1903`: 같은 질문·pair 답변과 표시 trace는 바이트 단위로 같은 profile을 만든다.
- `REQ-1904`: 질문하지 않았거나 상충하는 feature는 중립·고불확실 상태로 남고 자동 활성화되지 않는다.
- `REQ-1905`: 다음 pair는 현재 uncertainty, 예측 경계, 미노출 여부로 결정하며 같은 pair를 반복하지 않는다.
- `REQ-1906`: pair는 항상 가상임을 표시하고 실제 고유명사·실제 또는 생성 사진을 사용하지 않는다.
- `REQ-1907`: 질문 18개 이후 pair는 최대 3개이며 `A|B|둘 다 비슷|건너뛰기`를 지원한다.
- `REQ-1908`: 활성 feature는 최대 8개이고 mean 방향에 따라 `benefit|avoid`로 변환한다.
- `REQ-1909`: 연속 weight는 feature 신호를 `1..4` 범위로 정규화하고 confidence·source와 함께 trace한다.
- `REQ-1910`: 기존 v2는 `1|2|4`만 허용하고 새 v4-personalized에서만 연속 weight와 profile snapshot을 허용한다.
- `REQ-1911`: P/A/M 블록 가중치, 필수 조건, 후보 lane, MMR·seed·reroll·일정은 기존 동작을 유지한다.
- `REQ-1912`: MBTI 유형은 A/R·O/I·L/H 세 축의 결정적 요약이며 추천 점수 입력으로 사용하지 않는다.
- `REQ-1913`: 결과 UI는 유형 코드·이름·설명, 세 축, 상위 선호·회피, 적용·해제·공유 문구 복사를 제공한다.
- `REQ-1914`: 사용자가 적용된 행을 직접 편집하면 해당 feature는 `manual_override`로 구분한다.
- `REQ-1915`: 프로필·응답은 메모리에만 두고 새로고침 시 사라지며 네트워크·Web Storage·URL에 기록하지 않는다.
- `REQ-1916`: wizard는 모바일·키보드에서 진행, 뒤로가기, 건너뛰기, 닫기, 적용이 가능하다.
- `REQ-1917`: 프로필이 없거나 유효하지 않으면 현행 수동 입력으로 폴백한다.
- `REQ-1918`: 프로필과 실제 사용한 preference source·confidence·weight를 결과 JSON에서 확인할 수 있다.
- `REQ-1919`: 기존 CCU-MMR·reroll·일정 회귀가 통과하고 개인화 profile에 따라 의도한 순위 방향 변화가 생긴다.
- `REQ-1920`: 카탈로그 ID·feature 범위·결정성·A/B 대칭성·미노출 pair 선택을 Node.js 테스트로 고정한다.
- `REQ-1921`: 지도 UI의 wizard는 모바일과 데스크톱에서 시작, 질문 응답, 뒤로가기, 건너뛰기, 가상 장소 보정, 결과 확인, 다시 하기와 공유 문구 복사를 제공한다.
- `REQ-1922`: 지도 통합 UI는 원문 응답이나 세부 프로필을 서버로 전송하거나 영구 저장하지 않으며 배포 빌드를 통과한 소스만 게시한다.
- `REQ-1923`: 배포 URL은 로그인 없이 기존 지도 UI를 직접 열고, 상단과 원자 라벨 선호 영역에서 여행 MBTI를 시작해 결과를 적용한 뒤 같은 화면에서 추천을 다시 계산할 수 있어야 한다.
- `REQ-1924`: 질문 카탈로그는 A/R·O/I·L/H 각각 정확히 6개이고, 각 축의 positive 선택지가 A와 B 위치에 정확히 3회씩 배치되어야 한다.
- `REQ-1925`: 유형 축 점수는 전용 axis evidence만 사용하고 feature estimate 변경이 같은 답변의 유형 문자를 역으로 바꾸지 않아야 한다.
- `REQ-1926`: 8개 유형 코드는 `AOL|AOH|AIL|AIH|ROL|ROH|RIL|RIH`만 허용한다.

## 질문 카탈로그 v2

정확한 numeric mapping은 `map-ui/preference-elicitation.js`가 정본이며 아래 문구와 ID를 고정한다. 한 선택지가 모든 축을 결정하지 않도록 관련 feature에만 sparse evidence를 더한다.

| ID | 축 | 질문 | 선택 A | 선택 B | 내부 방향 |
|---|---|---|---|---|---|
| `q01_arrival_energy` | A/R | 제주에 도착한 첫 시간, 더 끌리는 시작은? | 해안이나 오름을 걸으며 몸부터 깨운다 | 카페나 숙소에서 쉬며 천천히 시작한다 | A / R |
| `q02_fair_weather_space` | O/I | 날씨가 좋은 오후, 같은 두 시간을 보낸다면? | 바람과 햇빛을 느낄 수 있는 야외 공간을 고른다 | 쾌적하게 둘러볼 수 있는 실내 공간을 고른다 | O / I |
| `q03_first_region_choice` | L/H | 처음 가는 지역에서 먼저 확인할 곳은? | 놓치면 아쉬운 대표 명소부터 확인한다 | 지역색이 강한 골목과 작은 가게부터 찾아본다 | H / L |
| `q04_memory_energy` | A/R | 여행 후 가장 오래 남았으면 하는 기억은? | 조용한 풍경을 오래 바라보며 충분히 쉬었던 순간 | 직접 참여한 체험이나 축제의 신나는 순간 | R / A |
| `q05_rainy_day_space` | O/I | 비가 오락가락하는 날, 더 마음이 가는 선택은? | 전시관이나 실내 테마 공간으로 일정을 바꾼다 | 약한 비라면 우산을 쓰고 야외 명소를 계속 본다 | I / O |
| `q06_place_reputation` | L/H | 처음 보는 두 장소 중 더 끌리는 곳은? | 현지인의 생활 풍경과 지역 이야기가 느껴지는 곳 | 놓치면 아쉽다고 알려진 유명 명소 | L / H |
| `q07_free_half_day` | A/R | 여행 중 반나절이 비었다면 무엇을 추가할까요? | 레포츠나 참여형 테마 체험을 하나 더 넣는다 | 정원이나 전망 공간에서 충분히 쉬며 보낸다 | A / R |
| `q08_story_environment` | O/I | 지역 이야기를 접하는 방식으로 더 좋은 것은? | 야외 길을 걸으며 현장 해설을 듣는다 | 실내 전시와 자료를 천천히 살펴본다 | O / I |
| `q09_photo_story` | L/H | 여행에서 남기고 싶은 사진과 이야기는? | 누구나 알아보는 대표 명소의 사진 | 나만 발견한 장소와 그곳에서 만난 이야기 | H / L |
| `q10_after_three_places` | A/R | 두세 곳을 둘러본 뒤 시간이 남았다면? | 편한 장소에서 쉬며 여유롭게 마무리한다 | 체력이 남았다면 활동 하나를 더 추가한다 | R / A |
| `q11_unplanned_two_hours` | O/I | 예상하지 못한 두 시간의 자유 시간이 생겼다면? | 넓은 실내 공간을 찾아 천천히 둘러본다 | 목적지 없이 야외를 걸으며 주변을 발견한다 | I / O |
| `q12_souvenir_place` | L/H | 여행 기념품을 고른다면 어디로 갈까요? | 지역 시장이나 작은 작업실에서 고른다 | 유명 테마 공간이나 대표 매장에서 고른다 | L / H |
| `q13_effort_tradeoff` | A/R | 둘 중 한 장소만 고른다면? | 조금 힘들어도 직접 체험할 것이 많은 장소 | 볼거리가 적어도 동선이 편하고 오래 머물 수 있는 장소 | A / R |
| `q14_weather_dependency` | O/I | 장소를 고를 때 더 끌리는 설명은? | 날씨와 시간대에 따라 분위기가 크게 달라지는 곳 | 날씨와 관계없이 경험이 안정적인 곳 | O / I |
| `q15_review_count` | L/H | 검색 결과가 서로 다르다면 어떤 곳을 선택할까요? | 리뷰가 적어도 개성이 뚜렷한 장소를 시도한다 | 방문 후기가 많고 검증된 인기 장소를 우선한다 | L / H |
| `q16_last_night_energy` | A/R | 제주에서 마지막 밤을 보낸다면? | 조용한 카페나 노을을 보며 마무리한다 | 공연·축제·야시장처럼 활기찬 곳에서 마무리한다 | R / A |
| `q17_last_morning_space` | O/I | 여행 마지막 오전을 보낼 공간은? | 실내 공간에서 여유롭게 여행을 정리한다 | 마지막까지 바람과 햇빛을 느끼며 야외에서 보낸다 | I / O |
| `q18_final_place` | L/H | 여행의 마지막 한 곳을 정한다면? | 제주를 상징하는 대표 명소로 정한다 | 여행 중 우연히 발견한 동네로 정한다 | H / L |

각 축은 정확히 6문항이며 positive 방향(A·O·L)이 선택 A에 3회, 선택 B에 3회 배치된다. 유형용 `axisValue`와 추천용 sparse feature effect는 별도 필드로 기록한다.

## 적응형 가상 장소 pair v2

| ID | 가상 여행지 A | 가상 여행지 B | 주요 구분 |
|---|---|---|---|
| `p01_panorama_or_story` | 바람 전망지대 — 바다와 산 능선, 탁 트인 경관을 한눈에 보는 곳 | 섬 생활 이야기관 — 지역의 역사와 생활 도구, 장터 이야기를 따라가는 곳 | 자연 경관 / 문화·시장 |
| `p02_geology_or_life_history` | 지층 생태 관찰길 — 바위와 바다 생태가 만들어진 과정을 현장에서 보는 곳 | 마을 생활사 공방 — 주민의 생활 이야기와 전통 기술을 직접 접하는 곳 | 지질·생태 / 생활사·공예 |
| `p03_scenery_or_culture_archive` | 빛과 색 전망정원 — 계절의 색과 넓은 풍경을 사진으로 남기는 곳 | 지역 문화 아카이브 — 옛 사진과 구술 기록, 시장 문화를 살펴보는 곳 | 경관·사진 / 문화 기록 |
| `p04_market_or_coast` | 생활 장터 골목 — 지역 먹거리와 상인들의 생활 풍경이 이어지는 곳 | 해안 빛 산책길 — 수평선과 바람, 시간대별 경관을 따라 걷는 곳 | 시장·문화 / 바다·경관 |
| `p05_ecology_or_craft` | 숲과 바다 탐사교실 — 지질과 생태를 관찰하며 직접 기록하는 프로그램 | 지역 공예 배움터 — 생활사 이야기를 듣고 전통 재료를 다뤄보는 프로그램 | 자연 탐사 / 문화 체험 |
| `p06_nature_memory_or_culture_memory` | 자연색 관찰언덕 — 바다와 숲의 색, 빛의 변화가 오래 남는 곳 | 동네 기억 전시마을 — 지역 사람들의 문화 이야기와 공간의 흔적이 남는 곳 | 자연 기억 / 문화 기억 |

위 pair는 N/C 유형축을 만들지 않는다. 18문항 뒤 현재 feature uncertainty와 두 카드의 예측 경계를 사용해 미노출 후보 중 최대 3개를 골라 산·바다·경관·문화·역사·시장 같은 세부 라벨만 보정한다.

## 여행 MBTI 3축과 8개 유형

추천은 아래 유형이 아니라 원자 feature profile을 사용한다.

| 축 | 첫 글자 | 반대 글자 | 계산 근거 |
|---|---|---|---|
| 에너지 | `A` 활동 | `R` 휴식 | 에너지 축 전용 6문항의 signed axis evidence |
| 환경 | `O` 야외 | `I` 실내 | 환경 축 전용 6문항의 signed axis evidence |
| 발견 | `L` 로컬 | `H` 핫스폿 | 발견 축 전용 6문항의 signed axis evidence |

| 유형 | 이름 | 한 줄 설명 |
|---|---|---|
| `AOL` | 바람길 탐험가 | 로컬 야외 공간을 찾아 몸으로 경험하며 제주를 발견한다. |
| `AOH` | 버킷리스트 어드벤처 | 대표 야외 명소와 체험을 놓치지 않고 활기차게 누빈다. |
| `AIL` | 로컬 콘텐츠 탐험가 | 지역색이 강한 실내 공간과 참여형 콘텐츠를 찾아간다. |
| `AIH` | 핫플 콘텐츠 체이서 | 인기 실내 명소와 테마 콘텐츠를 에너지 있게 즐긴다. |
| `ROL` | 느린 풍경 기록가 | 로컬 야외 풍경과 마을의 결을 천천히 바라보고 기록한다. |
| `ROH` | 풍경 명소 큐레이터 | 대표 야외 경관을 편안하게 골라 오래 감상한다. |
| `RIL` | 동네 취향 아카이버 | 조용한 로컬 실내 공간에서 지역의 취향을 차분히 모은다. |
| `RIH` | 감성 콘텐츠 큐레이터 | 유명 실내 문화 공간과 분위기를 여유롭게 골라 즐긴다. |

## 입력과 출력 계약

```text
TravelerPreferenceProfileV2 {
  schemaVersion: traveler-preference-profile-v2-three-axis
  scope: browser-memory-session
  status: complete | partial
  versions: { questionnaire, pairCatalog, estimator, archetypeCatalog }
  featureEstimates[AtomicFeatureKey]: {
    mean: number[-1,1]
    uncertainty: number[0,1]
    confidence: number[0,1]
    evidenceCount: number
    active: boolean
    source: quiz | pairwise | quiz_pairwise | unmeasured
  }
  axisEstimates[energy | environment | discovery]: {
    mean: number[-1,1]
    uncertainty: number[0,1]
    confidence: number[0,1]
    answeredCount: number
  }
  answers: {
    questionnaire: [{ questionId, optionId }]
    pairwise: [{ pairId, choice }]
  }
  displaySummary: {
    archetypeId
    archetypeName
    description
    axes[]
    topPreferences[]
    topAvoidances[]
  }
}

CCUMMRRequestPersonalizedV2 extends current request {
  schemaVersion: ccu-mmr-request-v4-personalized
  preferenceProfile: TravelerPreferenceProfileV2
  preferences[]: {
    feature
    mode: benefit | avoid
    weight: number(0,4]
    confidence: number[0,1]
    source: quiz | pairwise | quiz_pairwise | manual_override
  }
}
```

## 추정과 pair 선택

feature별로 질문과 pair가 주는 signed evidence를 합산한다.

```text
mean_f = clamp(sum(signed_evidence_f) / sum(abs(evidence_f)), -1, 1)
uncertainty_f = 1 - min(1, evidence_f / 4.8)
signal_f = abs(mean_f) * (1 - uncertainty_f)
```

- `evidence >= 0.75`, `abs(mean) >= 0.30`, `signal >= 0.12`인 후보 중 signal 상위 8개만 active다.
- active weight는 세션의 최대 signal을 기준으로 `1 + 3 * normalized_signal`로 만들어 `1..4` 범위에 둔다.
- pair 선택 점수는 `평균 uncertainty × (1 - abs(predicted_preference)) × novelty`다. 동점은 `pair_id ASC`다.
- `둘 다 비슷`과 `건너뛰기`는 방향 evidence를 만들지 않는다.
- 유형 축 점수가 정확히 같으면 표의 첫 글자를 사용하는 안정 동점 규칙을 적용하고 축 confidence를 낮게 표시한다.

## UI 흐름

1. 원자 라벨 선호 영역에서 `내 여행 MBTI 찾기`를 누른다.
2. 상황 질문 18개에 답하거나 건너뛴다.
3. 현재 profile에서 정보량이 큰 가상 장소 A/B를 최대 3개 선택한다.
4. 3글자 유형, 이름, 설명, 세 축, 상위 선호·회피를 확인한다.
5. `이 취향 적용`으로 연속 가중치를 기존 선호 행과 새 v4 요청에 반영한다.
6. `결과 문구 복사`는 공개 유형 요약만 복사한다.
7. 적용 후 행을 수정하면 `manual_override`, `개인화 해제` 또는 예시값 복원 시 v2 수동 입력으로 돌아간다.

## 예외와 폴백

- 모든 질문을 건너뛰어 active feature가 없으면 프로필 적용을 막고 기존 수동 입력을 유지한다.
- pair 후보가 없거나 최대 노출에 도달하면 현재 profile로 결과를 만든다.
- 유효하지 않은 profile·연속 weight는 자동 적용하지 않고 오류를 표시한다.
- `ai_draft` 경고는 개인화 confidence와 관계없이 유지한다.
- 공유 문구 복사가 실패하면 화면의 공개 요약을 직접 복사할 수 있게 유지한다.

## 승인 기준

- `AC-1901`: 질문 18개와 pair 6개의 stable ID·문구·mapping이 중복 없이 검증되고, 축별 6문항·선택지 방향 3:3 균형을 만족한다.
- `AC-1902`: 같은 답변은 같은 profile JSON과 같은 3글자 유형을 만든다.
- `AC-1903`: A/B 카드와 선택을 대칭으로 바꾸면 같은 feature 추정이 나온다.
- `AC-1904`: 미측정·상충 feature가 임의의 강한 active 선호가 되지 않는다.
- `AC-1905`: pair가 미노출 후보 중 결정적으로 선택되고 최대 3개를 넘지 않는다.
- `AC-1906`: active preference는 최대 8개, weight는 `0 < w <= 4`, confidence는 `[0,1]`이다.
- `AC-1907`: 대표 fixture가 기대한 `AIL` 유형과 상위 선호를 만들고, pair 보정 뒤에도 유형 문자가 바뀌지 않는다.
- `AC-1908`: 새 v4 요청은 연속 weight와 profile trace를 사용하고 기존 v2는 연속 weight를 거부한다.
- `AC-1909`: profile 없는 기존 fixture의 P/A/M/R/MMR·seed·schedule 결과가 기존 회귀와 일치한다.
- `AC-1910`: 서로 다른 두 profile이 같은 후보에서 의도한 feature 방향으로 관련도 순위를 바꾼다.
- `AC-1911`: 데스크톱·모바일·키보드로 wizard 진행·건너뛰기·닫기·적용·해제가 가능하다.
- `AC-1912`: 공유 문구에는 유형 코드·이름·공개 설명 외 답변·세부 profile이 없다.
- `AC-1913`: Web Storage·URL·네트워크 전송 코드가 없고 새로고침 후 profile이 사라진다.
- `AC-1914`: 전체 결과에 `internal_experiment`·`ai_draft` 경고와 profile/version/score trace가 유지된다.
- `AC-1915`: 지도 통합 UI가 질문부터 결과·적용·공유까지 완료되고 배포 빌드 및 게시 상태 확인을 통과한다.
- `AC-1916`: 로그인 없는 배포 URL에서 제주 지도와 추천 입력이 먼저 보이고, 여행 MBTI 진입점·프로필 적용·추천 재계산이 기존 지도 UI 안에서 동작한다.

## 테스트 계획

| 승인 기준 | 검증 |
|---|---|
| AC-1901~AC-1907 | `node scripts/test_preference_elicitation.cjs` |
| AC-1908~AC-1910 | `node scripts/test_ccu_mmr.cjs` |
| AC-1911~AC-1914 | `node scripts/validate_ccu_mmr_dashboard.cjs`, 브라우저 데스크톱·모바일·키보드 확인 |
| 문법·bundle | `node --check map-ui/preference-elicitation.js`, `node --check map-ui/ccu-mmr.js`, `node --check map-ui/app.js`, `node scripts/build_map_ui_data.mjs` |
| 지도 통합 배포 | `map-ui` 정적 응답, `travel-mbti-site` 배포 빌드와 게시 URL 확인 |

## 구현 결과

- `map-ui/preference-elicitation.js`에 A/R·O/I·L/H 축별 6개인 18개 상황 질문, 자연·문화 세부 취향용 가상 장소 pair 6개, 최대 3개의 결정적 적응형 선택, 18개 원자 라벨의 연속형 선호 추정과 3축 8개 여행 MBTI 파생을 구현했다.
- 유형 문자는 질문의 전용 `axisValue`만 사용하고 pair 응답은 feature estimate만 보정하도록 분리했다. 각 축에서 positive 선택지가 A와 B에 정확히 3회씩 나오도록 카탈로그를 고정했다.
- `map-ui/index.html`, `map-ui/styles.css`, `map-ui/app.js`에 데스크톱·모바일 wizard, 진행·뒤로·건너뛰기, 결과 확인·복사·적용·해제 UI를 구현했다.
- `travel-mbti-site/`를 `map-ui/`의 배포 wrapper로 전환했다. 배포 루트는 `/map/index.html`로 이동하며 지도·추천 입력·여행 MBTI·결과 적용을 한 화면에서 제공한다.
- 지도 상단에 `여행 MBTI` 진입점을 추가해 원자 라벨 영역까지 스크롤하지 않아도 질문을 시작할 수 있게 했다.
- 적용된 profile은 최대 8개 선호 feature와 `0 < weight <= 4` 연속 가중치로 기존 장소 관련도에만 반영한다. 유형 코드는 점수에 사용하지 않고 P/A/M block 가중치도 바꾸지 않는다.
- `map-ui/ccu-mmr.js`에 `ccu-mmr-request-v4-personalized`, `traveler-preference-profile-v2-three-axis`, `ccu-mmr-result-v6` 계약을 추가했다. 기존 `ccu-mmr-request-v2`는 그대로 유지하며 연속 가중치를 거부한다.
- profile은 브라우저 메모리에만 두고, 공유 문구에는 유형 코드·이름·공개 설명만 포함한다.

## 검증 결과

- `node --check map-ui/preference-elicitation.js`, `node --check map-ui/ccu-mmr.js`, `node --check map-ui/app.js`: 통과.
- `node scripts/test_preference_elicitation.cjs`: 18문항·축별 6문항·선택지 방향 3:3·pair 6개·A/R·O/I·L/H 8개 유형·결정성·부호 대칭·pair 이후 유형 불변·선호 상한·공유 정보 최소화와 배포 사이트 엔진 snapshot 일치 검증 통과.
- `node scripts/test_ccu_mmr.cjs`: v4 연속 가중치·profile schema 일치·ranking 방향·v2 호환·잘못된 profile 거부와 기존 회귀 검증 통과.
- `node scripts/validate_ccu_mmr_dashboard.cjs`: DOM·script 순서·Web Storage/네트워크 미사용·전체 1,663개 추천 fixture 검증 통과.
- `node scripts/build_map_ui_data.mjs`: 장소 2,153건과 추천 준비 1,663건을 유지하고 알고리즘 metadata를 `ccu-mmr-v6-travel-mbti-three-axis`로 재생성했다.
- 대표 fixture가 `AIL`과 `활동·실내·로컬` 세 축을 만들고, 최대 3개의 세부 라벨 pair가 유형 코드를 바꾸지 않는 것을 Node.js 회귀로 확인했다.
- `travel-mbti-site`의 `npm run lint`와 `npm run build`가 통과했고, 루트 `307 → /map/index.html`, 지도 정적 문서 `200` 응답을 확인했다.
- 지도 통합 소셜 미리보기와 정적 `map-ui` snapshot을 포함한 Sites version 4가 `https://jeju-travel-mbti.fly2e123.chatgpt.site`에 `succeeded` 상태로 게시됐다. 접근 정책은 public이며 루트 `307 → /map/index.html`, `/map/` 최종 `200`과 `18문항`·`여행 MBTI` 표식을 확인했다.

## 설계와 달라진 점

- 최초 Draft의 사용자별 P/A/M block posterior 학습을 사용자 승인에 따라 v1에서 제거했다.
- 고정 유형을 비목표로 두었던 초안과 달리 바이럴용 3축 8개 유형을 정식 출력으로 추가했다. 단, 추천 정본은 계속 연속형 profile이다.
- 이전 4축 설계의 P/F는 고정 일정 추천 제품과 직접 관련이 약해 제거했고, N/C 성격의 자연·문화 선택은 유형축 대신 세부 라벨 보정 pair로 이동했다.

## 알려진 제한

- 자기보고와 가상 장소 선택은 실제 여행 행동과 다를 수 있다.
- 세 축은 여행 취향을 간단히 요약할 뿐 산·바다·문화·카페 같은 모든 세부 취향을 대체하지 않는다.
- 유형은 바이럴·설명용 제품 분류이며 심리 진단이 아니다.
- 장소 라벨이 `ai_draft`이므로 선호 추정 정밀도가 추천 품질을 보장하지 않는다.
- 메모리 한정이라 새로고침 후 프로필이 사라진다.

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-08-22 | 질문 prior, 적응형 가상 장소 pair와 P/A/M 중요도 학습을 포함한 첫 Draft 작성 |
| 2026-08-22 | 사용자 승인에 따라 라벨 가중치 중심 v1, 8개 질문, 최대 4개 pair, 4축 16개 바이럴 유형과 v3 요청 경계를 확정하고 구현 시작 |
| 2026-08-22 | preference engine·wizard·v3 요청 계약·회귀 테스트와 문서 동기화를 완료하고 Implemented로 전환 |
| 2026-08-22 | 사용자 피드백에 따라 표준 MBTI 축 도입을 배제하고, 표시 전용 Plan/Flow를 원자 라벨 기반 Open-air/Indoor 축으로 교체하는 변경을 시작 |
| 2026-08-22 | 질문·유형 카탈로그를 label-axis v2로 갱신하고 네 축의 원자 라벨 연결·ANLO fixture·브라우저 결과를 검증한 뒤 Implemented로 전환 |
| 2026-08-22 | 핫스폿 축이 이미 있음을 재확인한 사용자 결정에 따라 최초 A/R·N/C·L/H·P/F 구성을 복원하는 변경을 시작 |
| 2026-08-22 | N/C가 상호 배타적이지 않고 L/H와 겹친다는 사용자 피드백에 따라 N/C 대신 V/E 감상/체험 축을 확정하고 장소 주제는 세부 취향으로 분리 |
| 2026-08-22 | A/R·V/E·L/H·P/F 유형 카탈로그, AELP fixture와 브라우저 결과를 검증하고 Implemented로 전환 |
| 2026-08-24 | 사용자 요청에 따라 A/R·O/I·L/H·P/F와 기존 질문·적응형 가상 장소 흐름을 단독 웹 UI로 제공하고 게시하는 변경을 시작 |
| 2026-08-24 | O/I 엔진·16개 유형, 단독 반응형 UI, 소셜 미리보기, 회귀·배포 빌드와 owner-only 웹 게시를 완료하고 Implemented로 전환 |
| 2026-08-24 | 사용자 피드백에 따라 단독 MBTI 사이트를 최종 화면으로 사용한 판단을 철회하고, 기존 지도 UI 자체를 배포하는 통합 변경을 시작 |
| 2026-08-24 | 지도 상단 MBTI 진입점, 라벨 가중치 적용·추천 재계산 흐름, 지도 snapshot 배포 wrapper, 회귀·빌드와 owner-only 배포 v3를 완료하고 Implemented로 전환 |
| 2026-08-24 | 사용자 요청에 따라 Sites 접근을 public으로 전환하고 일반 브라우저에서 로그인 없이 지도 UI가 열리는 것을 확인 |
| 2026-08-24 | 사용자 확정에 따라 8문항·4축 16유형을 축당 6개인 18문항·3축 8유형과 최대 3개 보정 pair로 재설계하고 구현 시작 |
| 2026-08-24 | 18문항·축별 선택지 3:3·세부 라벨 pair 6개·3축 8유형, v4 개인화 요청·v6 결과 계약, 회귀·빌드와 public Sites version 4 게시를 완료하고 Implemented로 전환 |
