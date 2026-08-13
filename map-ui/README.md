# 제주 CCU-MMR 추천 실험실

프레임워크 없이 실행되는 정적 HTML 추천 대시보드입니다. 한국관광공사 TourAPI 제주 장소 2,154건 중 정상 좌표 2,153건을 표시하며, 24개 취향 라벨과 Companion 5개·Month 12개가 모두 있는 1,663곳을 `ccu-mmr-v0-demo`로 추천합니다.

## 실행

저장소 루트에서 다음 명령을 실행합니다.

```powershell
python -m http.server 8080 -d map-ui
```

그다음 <http://localhost:8080>을 엽니다. 지도 타일과 장소 이미지는 인터넷 연결이 필요합니다.

## 데이터 갱신

현재 데모는 TourAPI와 라벨 snapshot이 모두 `2026-08-09`일 때만 번들을 만듭니다. 원본·라벨을 갱신한 뒤 날짜 상수와 계약을 함께 검토하고 다음 스크립트를 실행합니다.

```powershell
node scripts/build_map_ui_data.mjs
```

지도 라이브러리는 `vendor` 폴더에 포함되어 있으며 실행 시 npm이나 별도의 로그인은 필요하지 않습니다.

## 검증

```powershell
node scripts/test_ccu_mmr.cjs
node scripts/validate_ccu_mmr_dashboard.cjs
```

이 화면은 `ai_draft` 내부 비교용입니다. 날씨·영업·예약·접근성·이동시간·가격을 보장하지 않으며 사용자 입력은 브라우저 메모리에만 남습니다.
