# Trip AI — 제주 플레이스 지도 MVP

한국관광공사 TourAPI에서 제주 장소 데이터를 수집하고, 카테고리별로 검색·탐색할 수 있도록 만든 정적 지도 MVP입니다.

별도의 로그인, 프레임워크, 빌드 과정 없이 HTML/CSS/JavaScript만으로 실행됩니다. 현재 스냅샷에는 제주 장소 2,154건이 있으며, 좌표가 정상인 2,153건을 지도에 표시합니다.

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
│  └─ build_map_ui_data.mjs        # 지도용 데이터 변환
├─ data/tourapi/jeju/              # 날짜별 원본 데이터 스냅샷
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

- [경쟁사 및 시장 조사](COMPETITOR_RESEARCH_2026-08-02.md)
- [지도 UI 실행 안내](map-ui/README.md)
