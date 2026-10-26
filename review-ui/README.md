# 제주 v5 라벨 뷰어

현재 기본 화면은 1,664개 장소의 v5 웹 근거 기반 검수 결과를 읽기 전용으로 보여준다. 장소를 선택하면 24개 라벨, 값, 신뢰도, 판정 사유와 해당 공식·공공 웹 출처를 즉시 확인할 수 있다.

## v5 뷰어 실행

```powershell
node scripts/build_v5_researched_viewer_data.mjs
python -m http.server 8080
```

<http://localhost:8080/review-ui/>로 연다. 기본 선택은 넥슨컴퓨터박물관이며, 장소 검색으로 다른 장소를 선택할 수 있다.

`review-ui/data/v5-researched-data.js`는 생성 파일이므로 직접 수정하지 않는다.

## 레거시 v1 라벨 검토실

SPEC-004 자동 라벨의 사람 검토용 v1 화면(`review-model.js`, `styles.css`, `data/review-data.js`, `data/ai-review-proposals.js`)은 생성·검증 스크립트가 이미 제거돼 다시 만들 수 없고 어떤 페이지도 불러오지 않아 [SPEC-113](../docs/spec_113.md)에서 삭제했다. 필요하면 Git 이력에서 복원한다.
