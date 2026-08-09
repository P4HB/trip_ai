# 제주 TourAPI 기본 장소 데이터셋

한국관광공사 `KorService2/areaBasedList2`에서 제주 법정동 시도 코드
`lDongRegnCd=50`으로 조회한 전체 기본 장소 목록입니다.

## 파일 구성

- `YYYY-MM-DD/raw/area_based_page_*.json`: API 원본 응답
- `YYYY-MM-DD/jeju_places.json`: 전체 장소 JSON 배열
- `YYYY-MM-DD/jeju_places.jsonl`: 장소당 한 줄인 JSON Lines
- `YYYY-MM-DD/jeju_places.csv`: Excel 호환 UTF-8 CSV
- `YYYY-MM-DD/quality_issues.csv`: 누락·비정상 좌표 품질 리포트
- `YYYY-MM-DD/manifest.json`: 수집 조건, 검증 결과, 유형별 건수, 해시

이 데이터셋은 목록 API의 기본 필드만 포함합니다. 장소 설명, 운영시간,
휴무일, 주차, 반복정보 및 전체 이미지 목록은 상세 API 수집 단계에서
추가해야 합니다.

## 다시 수집하기

프로젝트 루트의 `.env.local`에 `KTO_TOUR_API_KEY`를 설정한 후 실행합니다.

```powershell
python scripts/collect_tourapi_jeju.py
```
