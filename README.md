# Front

개발용 attendance MVP 프론트엔드다.

## 포함 기능

- 학생 / 교수 / 관리자 로그인
- 개발용 `student_id` 직접 입력
- 등록 단말 목록 조회
- 단말 등록
- 단말 삭제
- 출석 / 시험 eligibility 확인
- `reasonCode` 와 `evidence` 표시

## 환경 변수

- `VITE_BACKEND_URL`
  - 기본값: `http://localhost:8000`

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0 --port 3000
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
