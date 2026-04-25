# Front

개발용 smart-class LMS / attendance / exam MVP 프론트엔드다.

## 포함 기능

- 학생 / 교수 / 관리자 로그인과 세션 복구
- 프로필 기반 학생 단말 목록 조회 / 등록 / 삭제
- 학생 / 교수 강의 목록
- 강의 상세 화면과 섹션 라우팅
- 공지사항 목록 / 상세 / 교수 작성
- 강의자료 / 동영상 임시 Front 스캐폴드
- 학생 출석 eligibility 확인, active attendance session 조회, self check-in, 학기 출석 matrix
- 교수 attendance timeline, bundle session 생성/마감, roster, slot roster, 학생별 이력/통계
- 학생 시험 목록 / 상세 / 응시 시작 / 답안 저장 / 제출
- 교수 시험 생성 / 수정 / 삭제 / 게시 / 마감
- 관리자 사용자 / 강의실 / AP 매핑 조회
- 관리자 demo presence snapshot / overlay / reset 제어

## 환경 변수

- `VITE_BACKEND_URL`
  - 기본값: 빈 값 (`""`)
  - nginx path proxy 사용 시 same-origin `/api`, `/health` 경로를 사용한다.

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0 --port 3000
```

## 검증

```bash
npm run lint
npm run build
npm run test:e2e
```

## Dev login

- 학생: `20201234` / `devpass123`
- 교수: `PRF001` / `devpass123`
- 관리자: `ADM001` / `devpass123`

## Docker

```bash
docker build -t smart-class-front .
docker run --rm -p 3000:3000 -e VITE_BACKEND_URL=http://localhost:8000 smart-class-front
```

컨테이너는 Vite dev server 를 `3000` 포트로 노출한다.
