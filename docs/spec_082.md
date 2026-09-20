# SPEC-082: 기존 카카오맵 수집기 Git 등록

- 상태: In Progress
- 작성일: 2026-09-20
- 최종 수정일: 2026-09-20
- 관련 이슈: 사용자 요청 — 로컬 카카오맵 크롤링 코드를 Git에 push
- 관련 문서: `docs/README.md`, `docs/spec_066.md`
- 관련 코드: `scripts/kakao_review_crawler.py`, `scripts/collect_kakao_jeju_tourism_reviews.py`
- 선행 SPEC: 없음

## 배경

사실: 두 수집기는 로컬 `scripts/`에 존재하지만 Git 미추적 상태다. 원격 `main`에는 수집된 리뷰의 DB 변환·조회 기능이 있으며, 수집기 소스는 없다. 원래 작업 폴더에는 다른 미커밋 변경이 있고 원격보다 이전 커밋을 사용한다.

결정: 사용자 요청을 승인된 범위로 보고 최신 원격 `main`의 별도 worktree에서 기존 소스 두 개를 그대로 등록한다. 사용 중인 SPEC 번호를 재사용하지 않고 원격 색인의 다음 번호 082를 사용한다.

## 목표

- 핵심 리뷰 수집기와 제주 지역별 배치 실행기를 원래 경로로 Git에서 조회할 수 있게 한다.
- 기존 소스와 의존 모듈의 연결을 보존하고 문법·CLI 진입점을 확인한다.

## 비목표

- 수집 로직, 기본 경로, CSV 스키마 또는 공개 UI 변경
- 실제 카카오맵 재수집, 기존 수집 데이터 업로드, DB 재생성 또는 배포
- 다른 미커밋 작업의 등록 또는 원래 작업 폴더의 동기화

## 요구사항

- `REQ-8201`: 두 Python 파일을 원본과 바이트 단위로 동일하게 등록한다.
- `REQ-8202`: 두 파일의 Python 문법 검사와 `--help` 실행이 성공해야 한다.
- `REQ-8203`: 커밋에는 두 수집기, 본 SPEC 및 SPEC 색인 변경만 포함한다.
- `REQ-8204`: 최신 원격 `main`을 기준으로 일반 push하며 기존 로컬 작업을 보존한다.

## 입력과 출력

이번 작업의 입력은 기존 Python 소스 두 파일이고 출력은 Git 커밋이다. 수집 결과 파일은 생성하지 않는다.

수집기는 검색어 또는 제주 43개 행정 구역으로 장소를 찾고 장소·리뷰 CSV를 출력한다. 배치 실행기는 완료 구역, 장소별 요약, 원본 리뷰와 `Asia/Seoul` 수집 시각이 있는 manifest를 저장해 다음 실행에서 이어서 수집한다. 기존 배치 출력 기본 경로는 `data/kakao/jeju/2026-08-19/`다.

## 설계

- `kakao_review_crawler.py`: Selenium Chrome 실행, 검색 결과·리뷰 파싱, CSV 저장, 단독 CLI.
- `collect_kakao_jeju_tourism_reviews.py`: 같은 폴더의 핵심 수집기를 import하고 지역별 장소 중복 제거, 배치 수집, 체크포인트 저장을 수행한다.
- 실행에는 Python 3.10 이상, Chrome, `selenium`이 필요하며 Windows의 `ZoneInfo` 사용에는 `tzdata`가 필요하다. 준비 명령은 `python -m pip install selenium tzdata`다.
- 코드·데이터 동작은 변경하지 않으므로 관련 기준 계약은 갱신하지 않는다.

## 예외와 폴백

기존 수집기의 타임아웃 처리, 배치 저장과 재개 동작을 그대로 보존한다. 검증이 실패하면 원인을 해결하거나 미검증 상태를 기록하고, 원격이 진행되면 최신 커밋에 반영한 뒤 일반 push한다.

## 영향 범위

- 변경 예정 파일: `scripts/kakao_review_crawler.py`, `scripts/collect_kakao_jeju_tourism_reviews.py`, `docs/spec_082.md`, `docs/README.md`
- 데이터 마이그레이션: 없음
- 호환성 영향: 기존 로컬 소스 및 기본값 유지
- 보안·개인정보 영향: 소스만 등록하며 수집 CSV와 작성자 표시명 등 원본 데이터는 포함하지 않는다.

## 승인 기준

- `AC-8201`: 두 원본과 worktree 사본의 SHA-256이 각각 일치한다.
- `AC-8202`: 두 파일의 문법 검사 및 `--help`가 종료 코드 0으로 완료된다.
- `AC-8203`: staged 파일 목록이 지정한 네 파일이며 `git diff --cached --check`가 통과한다.
- `AC-8204`: 원격 `main`에 커밋이 반영되고 원래 작업 폴더의 파일·인덱스가 유지된다.

## 테스트 계획

| 승인 기준 | 검증 방법 | 명령 또는 위치 |
|---|---|---|
| AC-8201 | 원본·사본 SHA-256 비교 | `Get-FileHash -Algorithm SHA256` |
| AC-8202 | 문법 검사 | `python -m py_compile scripts/kakao_review_crawler.py scripts/collect_kakao_jeju_tourism_reviews.py` |
| AC-8202 | import·인수 파서 확인 | `python scripts/kakao_review_crawler.py --help`, `python scripts/collect_kakao_jeju_tourism_reviews.py --help` |
| AC-8203 | 커밋 범위·공백 검사 | `git diff --cached --name-only`, `git diff --cached --check` |
| AC-8204 | push 및 원격 커밋 확인 | `git push origin HEAD:main`, `git ls-remote origin refs/heads/main` |

## 구현 결과

- 원본 소스 두 개를 변경 없이 복사했고 SHA-256 일치를 확인했다 (`AC-8201`).
- Python 3.10.4·Selenium 4.47.0 환경에서 두 파일의 `py_compile`과 각각의 `--help`가 모두 종료 코드 0으로 통과했다 (`AC-8202`). 브라우저나 수집 작업은 실행하지 않았다.
- Git 등록 대상은 요구사항에 명시한 네 파일이다. 커밋 범위 검토 및 원격 push를 진행한다.

## 설계와 달라진 점

없음.

## 알려진 제한

- 이번 작업에서는 카카오맵 사이트에 접속하지 않으므로 현재 DOM에 대한 실제 수집 동작은 검증하지 않는다.
- 배치 실행기의 기본 출력 경로에는 기존 날짜가 고정되어 있다. 다른 스냅샷을 수집할 때는 출력 경로 인수를 지정해야 한다.

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-09-20 | 승인된 Git 등록 범위·승인 기준·테스트 계획 작성 |
| 2026-09-20 | 원본 소스 동일성·Python 문법·CLI 진입점 검증 통과 |
