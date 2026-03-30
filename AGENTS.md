# Front AGENTS

이 repo 는 학생/교수/관리자 웹 UI 를 담당한다.
비즈니스 판정 로직의 최종 권한은 backend / presence 서비스에 있다.

## 시작 전 필수
1. `git checkout main`
2. `git pull --ff-only origin main`
3. `git -C ../docs checkout main`
4. `git -C ../docs pull --ff-only origin main`

## 구현 전 반드시 확인할 문서
- `../docs/01-requirements/req-student-features.md`
- `../docs/01-requirements/req-professor-features.md`
- `../docs/01-requirements/req-admin-features.md`
- `../docs/03-conventions/conv-api-response.md`
- `../docs/03-conventions/conv-auth-and-session.md`
- 출석/시험 관련이면:
  - `../docs/01-requirements/req-attendance-presence.md`
  - `../docs/01-requirements/req-device-auth.md`
  - `../docs/02-decisions/adr-0004-attendance-authorization-flow.md`

## docs gap 규칙
다음이면 구현 중지:
- 필요한 API response / error 규약 문서가 없음
- 출석 가능/불가 상태 표현 규칙이 없음
- 새 UI 상태가 필요하지만 backend contract 가 없음

이 경우 `$spec-first-dev-guard` 절차를 따른다.

## Git 규칙
- 브랜치: `feat/frontend/<slug>` 등
- 커밋: `<type>(frontend): <subject>`
- UI screenshot / 수동 검증 결과를 PR 에 남긴다.
- business rule 을 프론트에 암묵적으로 넣지 않는다.

## 권장 skill
- 개발 전 문서 검증: `$spec-first-dev-guard`
- Git 규약: `$git-governance`
