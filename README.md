# Trip AI — 제주 플레이스 지도 MVP

한국관광공사 TourAPI에서 제주 장소 데이터를 수집하고, 카테고리별로 검색·탐색할 수 있도록 만든 정적 지도 MVP입니다.

별도의 로그인, 프레임워크, 빌드 과정 없이 HTML/CSS/JavaScript만으로 실행됩니다. 현재 스냅샷에는 제주 장소 2,154건이 있으며, 좌표가 정상인 2,153건을 지도에 표시합니다.

## 프로젝트 상태와 AI 초안 주의

- 현재 사용자 실행 기능은 정적 지도 탐색과 `ai_draft` 기반 CCU-MMR 내부 추천·근사 일정 실험 UI입니다.
- 음식점을 제외한 1,434개 장소에는 웹 조사, 동행자 적합도 5축, 비축제 월별 적합도 12축, 필수 제약과 근거 추적 정보를 담은 canonical JSONL·SQLite가 생성되어 있습니다.
- 이 장소 프로필은 구조화된 사람 검수 완료가 0건인 `ai_draft`입니다. 운영 추천, 골드 라벨 또는 “제주 최고 장소” 순위로 사용하면 안 됩니다.
- 운영 개인화 추천·추천 API와 실제 이동시간 기반 일정 최적화는 아직 구현되지 않았습니다. 정적 지도 내부 실험에는 관련도 상위 3개 seed 코스안, 세션 재추천, 요청 인지형 MMR과 선택 코스 기반 근사 일정이 구현되어 있습니다.
- AI 초안을 보수적으로 사용하는 첫 장소 추천 엔진은 [SPEC-008 Draft](docs/spec_008.md)에 설계되어 있으며, 구현 전 별도 승인과 독립 평가가 필요합니다.

전체 AI 초안과 검증 명령은 [제주 장소 라벨링 데이터 안내](data/labeling/jeju/README.md)를 참고합니다.

## 현재까지 구현한 내용

| 단계 | 구현 결과 | 근거 문서 |
|---|---|---|
| TourAPI 수집·지도 MVP | 제주 장소 2,154건을 수집·검증하고, 정상 좌표 2,153건을 검색·필터·클러스터링하는 정적 지도를 구현 | [데이터 안내](data/tourapi/jeju/README.md), [지도 안내](map-ui/README.md) |
| SDD 문서 체계 | 요구사항·승인 기준·테스트 결과를 SPEC 단위로 추적하는 문서 체계를 도입 | [SPEC-001](docs/spec_001.md) |
| 라벨링 입력 분리 | 원본 순서를 유지한 채 음식점 720건과 비음식점 1,434건을 결정적으로 분리 | [SPEC-002](docs/spec_002.md) |
| 100건 파일럿 | 관광지 68·문화시설 12·축제 4·레포츠 16건에 동행자 5축과 월별 12축 AI 초안을 생성 | [SPEC-003](docs/spec_003.md) |
| 사람 검수 도구 | 검색·필터·수정·상태 관리·JSON 입출력이 가능한 100건 단일 HTML 검수 화면을 구현 | [SPEC-004](docs/spec_004.md) |
| 장소별 웹 조사 | 파일럿 100건의 상세 페이지를 확인해 출처·페이지 해시·사실·미확인 사항을 구조화 | [SPEC-005](docs/spec_005.md) |
| 자동 가중치 v3 | 동행자 500축과 비축제 월별 1,152축을 채우고, 축제 월별 48축은 날짜 종속 `N/A`로 분리 | [SPEC-006](docs/spec_006.md) |
| 비음식점 전체 확장 | 1,434건 전부를 조사해 24,378개 축, 필수 제약 1,518건, 검수 큐와 canonical JSONL·SQLite를 생성 | [SPEC-007](docs/spec_007.md) |
| 추천 엔진 설계 | AI 초안 보정, 필수 제약, 설명·추적 계약을 설계했으나 코드는 아직 미구현 | [SPEC-008 Draft](docs/spec_008.md) |
| 정적 추천·일정 실험 | 코스 3안의 최초 가중 선택, 미노출 코스 재추천, 중복 표시와 선택 코스 기반 자동 일정 중심을 구현 | [SPEC-017](docs/spec_017.md) |

## 라벨링 결과 요약

| 구분 | 현재 결과 | 검수 상태 |
|---|---:|---|
| 음식점 분리 데이터 | 720곳 | 라벨 체계 미정 |
| 비음식점 전체 프로필 | 1,434곳 | 전부 `ai_draft` |
| 동행자 적합도 | 7,170축 | 사람 검수 완료 0축 |
| 비축제 월별 적합도 | 16,872축 | 사람 검수 완료 0축 |
| 축제 월별 적합도 | 336축 | 개최일 종속 `N/A` |
| 필수 제약 | 1,518건 | 실제 추천 전 재확인 필요 |

동행자 적합도는 `solo`, `couple`, `friends`, `kids`, `parents`를 독립 축으로 저장합니다. 수치 라벨과 별도로 예약·연령·인원·운영일·날씨·접근 조건을 필수 제약으로 관리하며, 출처와 추론 수준을 함께 보존합니다. 상세 파일 구성, 재생성 방법, 검증 명령과 해석상 주의점은 [라벨링 데이터 안내](data/labeling/jeju/README.md)가 기준입니다.

## 주요 기능

- 실제 지도 확대·축소 및 이동
- 2,153개 장소 마커 클러스터링
- 관광지·문화시설·축제·레포츠·숙박·쇼핑·음식점 필터
- 장소명과 주소 통합 검색
- 현재 지도 범위에 포함된 장소 목록
- 목록, 마커, 상세 패널 간 선택 상태 연동
- 장소 이미지·주소·전화번호·수정일 확인
- 선택 위치 복사
- 데스크톱·모바일 반응형 UI

## 빠른 실행

### 방법 1: 파일로 바로 열기

[`map-ui/index.html`](map-ui/index.html)을 브라우저에서 엽니다.

### 방법 2: 로컬 서버 사용

저장소 루트에서 다음 명령을 실행합니다.

```powershell
python -m http.server 8080 -d map-ui
```

이후 <http://localhost:8080>으로 접속합니다.

지도 타일과 TourAPI 장소 이미지를 표시하려면 인터넷 연결이 필요합니다.

## 데이터 현황

수집일: **2026-08-09**

| 분류 | TourAPI 수집 건수 | 지도 표시 건수 |
|---|---:|---:|
| 관광지 | 566 | 565 |
| 문화시설 | 97 | 97 |
| 축제·공연·행사 | 28 | 28 |
| 여행코스 | 0 | 0 |
| 레포츠 | 137 | 137 |
| 숙박 | 209 | 209 |
| 쇼핑 | 397 | 397 |
| 음식점 | 720 | 720 |
| **합계** | **2,154** | **2,153** |

`영주산(contentid: 2704351)`은 TourAPI 경도 값이 `12.79737228191`로 제공되어 제주 좌표 범위를 벗어나므로 지도 데이터 생성 과정에서 제외됩니다. 원본 값과 검증 결과는 데이터 스냅샷에 그대로 보존되어 있습니다.

## TourAPI 데이터 다시 수집하기

Python 3.10 이상이 필요합니다. 이 수집기는 Python 표준 라이브러리만 사용합니다.

1. 환경파일을 준비합니다.

```powershell
Copy-Item .env.example .env.local
```

2. `.env.local`에 공공데이터포털 서비스 키를 입력합니다.

```dotenv
KTO_TOUR_API_KEY=your_data_go_kr_service_key
```

3. 제주 전체 장소를 수집합니다.

```powershell
python scripts/collect_tourapi_jeju.py
```

수집 결과는 `data/tourapi/jeju/YYYY-MM-DD/` 아래에 JSON, JSONL, CSV, 원본 응답, 품질 검증 결과와 함께 저장됩니다. 서비스 키는 출력 파일에 기록되지 않습니다.

## 지도용 데이터 갱신하기

수집이 끝난 후 Node.js 20.11 이상에서 다음 명령을 실행합니다.

```powershell
node scripts/build_map_ui_data.mjs
```

스크립트가 가장 최근 날짜의 `jeju_places.json`을 찾아 좌표를 검증하고, 브라우저가 바로 읽을 수 있는 `map-ui/data/jeju-places.js`를 생성합니다.

## 디렉터리 구조

```text
.
├─ map-ui/                         # 정적 지도 애플리케이션
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  ├─ data/jeju-places.js          # 브라우저용 경량 데이터
│  └─ vendor/                      # Leaflet 및 MarkerCluster
├─ scripts/
│  ├─ collect_tourapi_jeju.py      # TourAPI 전체 수집·검증
│  ├─ build_map_ui_data.mjs        # 지도용 데이터 변환
│  └─ ...                          # 장소 조사·라벨·검증 파이프라인
├─ data/
│  ├─ tourapi/jeju/                # 날짜별 원본 데이터 스냅샷
│  └─ labeling/jeju/               # 파일럿 및 전체 AI 초안
├─ labeling-review/                # 100건 정적 사람 검수 도구
├─ docs/                           # SPEC·설계·계약·평가 기준 문서
├─ COMPETITOR_RESEARCH_2026-08-02.md
├─ .env.example
└─ README.md
```

## 기술 구성

- HTML5, CSS3, Vanilla JavaScript
- [Leaflet](https://leafletjs.com/)
- [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- [OpenStreetMap](https://www.openstreetmap.org/) 지도 타일
- 한국관광공사 국문 관광정보 서비스 `KorService2`

Leaflet 및 MarkerCluster 라이선스는 각 `map-ui/vendor/` 하위에 포함되어 있습니다. 현재 OpenStreetMap 표준 타일은 MVP와 로컬 검증 용도이며, 공개 서비스의 트래픽이 커지기 전에는 운영용 타일 제공자를 별도로 선정해야 합니다.

## 관련 문서

- [개발 SPEC 및 설계 문서 색인](docs/README.md)
- [AI 초안 인지형 장소 추천 엔진 Draft](docs/spec_008.md)
- [경쟁사 및 시장 조사](COMPETITOR_RESEARCH_2026-08-02.md)
- [지도 UI 실행 안내](map-ui/README.md)
