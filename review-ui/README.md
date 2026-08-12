# 제주 v5 라벨 뷰어

현재 기본 화면은 1,664개 장소의 v5 웹 근거 기반 검수 결과를 읽기 전용으로 보여준다. 장소를 선택하면 24개 라벨, 값, 신뢰도, 판정 사유와 해당 공식·공공 웹 출처를 즉시 확인할 수 있다.

## v5 뷰어 실행

```powershell
node scripts/build_v5_researched_viewer_data.mjs
python -m http.server 8080
```

<http://localhost:8080/review-ui/>로 연다. 기본 선택은 넥슨컴퓨터박물관이며, 장소 검색으로 다른 장소를 선택할 수 있다.

`review-ui/data/v5-researched-data.js`는 생성 파일이므로 직접 수정하지 않는다.

---

# 레거시 v1 라벨 검토실

SPEC-004 자동 라벨 가운데 사람이 확인할 우선순위 1~3 작업을 장소별로 검토하는 정적 UI다. 원본 `review_queue.csv`와 `place_labels.jsonl`은 읽기 전용이며, 사람 판정은 브라우저 저장소와 별도 JSON 파일에만 기록한다.

## 실행

레거시 사람 검토 번들을 다시 생성한다.

```powershell
node scripts/build_review_ui_data.mjs
node scripts/validate_review_ui_data.mjs
```

그다음 [`index.html`](index.html)을 브라우저에서 직접 열거나 저장소 루트에서 로컬 서버를 실행한다.

```powershell
python -m http.server 8080
```

로컬 서버에서는 <http://localhost:8080/review-ui/>로 접속한다. 이미지와 외부 좌표 지도를 제외한 핵심 검토 기능은 네트워크 연결 없이 동작한다.

## 검토 방법

1. 왼쪽에서 전체·긴급·파일럿·낮은 신뢰 프리셋을 고르고, 필요하면 분류 모호·원천 충돌 같은 정확한 작업 유형까지 좁힌다.
2. 장소와 라벨을 선택해 현재값, confidence, 규칙 설명과 실제 근거를 확인한다.
3. 우선순위 1 Environment 항목은 `AI 공식 웹 조사 제안`에서 제안값·확신도·공식 출처·한계를 먼저 확인한다.
4. `제안값 폼에 적용` 또는 `null 유지 폼에 적용`은 점수·메모·근거 URL만 채운다. 이 단계에서는 저장되거나 완료 처리되지 않는다. `추가 조사 필요` 제안에는 적용 버튼이 없다.
5. 선택적으로 검토자 이름과 메모·HTTPS 근거 URL을 보완하고 `현재값 승인`, `점수 수정`, `null 유지` 중 하나로 판정한다.
6. 판정은 자동 저장되지만, 브라우저 데이터 삭제에 대비해 `판정 내보내기`로 JSON을 백업한다.
7. 같은 스냅샷·라벨·규칙의 JSON만 다시 가져올 수 있다.

현재 사람 작업은 2,669행·271곳이다. 시스템 백로그 34,251행은 개별 장소를 손으로 채우는 작업이 아니라 규칙 추가·상세 데이터 수집·파생 입력 보강 대상이므로 UI에는 집계만 표시한다.

## 파일

```text
review-ui/
  index.html
  styles.css
  review-model.js
  app.js
  data/review-data.js             # 사람 검토 기본 번들, 직접 수정 금지
  data/ai-review-proposals.js     # priority-1 AI 조사 제안, 직접 수정 금지
```

`review-data.js`는 classic script 전역 번들이므로 JSON fetch나 ES module 서버 없이 `file://`에서도 읽을 수 있다. 새 라벨 스냅샷이나 규칙을 생성한 뒤에는 반드시 번들을 다시 만들고 validator를 실행한다.

`ai-review-proposals.js`는 선택적 sidecar다. 파일이 없거나 손상됐거나 현재 검토 데이터 fingerprint와 다르면 AI 카드만 비활성화되고 기존 사람 검토 기능은 계속 동작한다. 저장된 조사 입력에서 다시 만들 때는 다음을 실행한다.

```powershell
node scripts/build_ai_review_proposals.mjs --snapshot-date 2026-08-09
node scripts/validate_ai_review_proposals.mjs --snapshot-date 2026-08-09
```

테스트용 별도 출력이 필요하면 `--output review-ui/data/파일명.js`를 사용할 수 있다. 자동 라벨 원본을 실수로 덮어쓰지 않도록 이 옵션은 `review-ui/data/` 아래의 `.js` 파일만 허용한다.

## 판정의 의미

- `현재값 승인`: 현재 비-null 자동값이 적절함
- `점수 수정`: `[0, 0.25, 0.5, 0.75, 1]` 중 하나로 교정
- `null 유지`: 근거가 부족하거나 판단하기 어려워 값을 확정하지 않음

이 판정 JSON은 자동 라벨을 즉시 덮어쓰는 골드 데이터가 아니다. 규칙 개선이나 검수 완료 데이터로 병합하려면 별도 SPEC과 검증 파이프라인이 필요하다.
