# 제주 장소 라벨 검수 화면

`index.html`은 SPEC-006의 자동 가중치 v3 초안 100건을 검수하기 위한 단일 정적 HTML이다. v2에서 실제로 연 웹 페이지의 조사 사실과 v3 수치 제안을 함께 내장하며 외부 JavaScript나 CSS 없이 파일 하나로 동작한다.

## 사용하기

1. `index.html`을 Chrome 또는 Edge로 연다.
2. `높음` 우선순위 16건부터 확인하거나 장소를 골라 조사 요약, 구조화 사실, 실제로 연 페이지와 AI 추론 수준을 확인한다.
3. 맞는 companion·month 값은 그대로 두고 잘못된 예외만 수정한다.
4. `낮은 위험 일괄 승인`과 별도의 `중간 위험 일괄 승인`으로 아무 수정도 하지 않은 해당 우선순위 장소를 확인 뒤 묶어 승인할 수 있다. 작성 중·처리 완료·높은 우선순위 장소는 바뀌지 않는다.
5. 높은 우선순위와 직접 바꿀 장소는 `AI 원안 승인 · 다음`, `수정 후 승인 · 다음`, `추가 조사` 또는 `건너뜀`으로 처리한다.
6. 작업 중에는 브라우저에 자동 저장된다.
7. 검수가 끝나면 `결과 내보내기`를 눌러 JSON을 내려받고 해당 파일을 다시 전달한다.

`AI 값 유지`와 검수자가 명시적으로 선택한 `미정(null)`은 다르다. 값을 AI 기준으로 되돌리면 override가 제거된다. 축제 4건의 월 48칸은 개최일 종속 `N/A`로 비활성화되어 있으며 미완료나 사용자 작업으로 세지 않는다.

현재 공통 확인 페이지는 K-TRIP TIPS의 2차 관광 상세 자료다. 페이지 본문에서 확인된 정보와 모르는 정보를 분리했지만 운영시간·휴무·가격처럼 바뀌는 값은 링크된 원문에서 다시 확인해야 한다. 월 기본값은 기상청 1991~2020 제주 기후평년 자료를 사용한 정적 제품 규칙이며 실제 여행일 예보가 아니다. v3의 기준 SHA-256이 v1·v2와 다르므로 이전 브라우저 검수 상태는 자동으로 합쳐지지 않는다.

정적 HTML에는 서버가 없으므로 입력이 저장소나 대화로 자동 전송되지 않는다. 브라우저별 `file://` 저장 차이에 대비해 작업 중간에도 JSON을 내보내 백업하는 것이 좋다. 가져오기는 같은 기준 SHA-256을 가진 이 100건 검수 JSON만 허용하고, 유효할 때 전체 상태를 한 번에 교체한다.

## 다시 생성하고 검증하기

저장소 루트에서 실행한다.

```powershell
node scripts/build_place_profile_research_v2.mjs
node scripts/validate_place_profile_research_v2.mjs
node scripts/build_place_profile_autolabel_v3.mjs
node scripts/validate_place_profile_autolabel_v3.mjs
node scripts/build_labeling_review_ui.mjs
node scripts/validate_labeling_review_ui.mjs
node scripts/test_labeling_review_model.mjs
```

소스는 `labeling-review/src/`에 있고 `index.html`은 생성 산출물이다. 사람 검수 입력은 AI 원본 `place_profiles.json`이나 TourAPI 데이터를 직접 수정하지 않는다.
