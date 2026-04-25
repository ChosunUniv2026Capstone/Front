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
  - nginx path proxy 사용 시 REST 는 same-origin `/api`, `/health` 경로를 사용한다.
  - 출석 WebSocket 도 값이 비어 있으면 현재 페이지의 protocol/host 에서 `ws://` 또는 `wss://` 를 파생해 같은 origin 의 `/ws/attendance` 로 연결한다.
  - Vite dev server 에서 Backend 를 직접 호출해야 하는 경우에만 `.env` 에 `VITE_BACKEND_URL=http://localhost:8000` 을 설정한다.

## 로컬 실행

통합 개발의 공식 경로는 CodexKit Docker Compose 다. Front 만 직접 개발 서버로 띄울 때는 아래처럼 실행한다. 이 경우 Vite proxy 를 사용하지 않으므로 Backend 를 직접 호출해야 하면 `.env` 에 `VITE_BACKEND_URL=http://localhost:8000` 을 설정한다.

```bash
npm install
cp .env.example .env
# Backend 직접 호출이 필요한 경우 .env 에 VITE_BACKEND_URL=http://localhost:8000 설정
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

Docker 이미지는 Vite 빌드 산출물을 nginx 로 정적으로 제공한다. 통합 개발 / 시연 경로에서는 CodexKit edge nginx 가 외부 진입점과 Host 정책, `/api` / `/ws` / `/health` 프록시를 소유한다. 정적 nginx 컨테이너의 runtime environment 는 이미 빌드된 브라우저 번들을 다시 설정하지 않으므로, CodexKit Docker 경로에서는 `VITE_BACKEND_URL` 을 주입하지 않고 same-origin 프록시를 사용한다.

```bash
docker build -t smart-class-front .
docker run --rm -p 3000:80 smart-class-front
```

CodexKit/nginx 경로에서는 `VITE_BACKEND_URL` 값을 비워 same-origin REST/WebSocket 프록시를 사용한다. 직접 Vite dev server 에서 Backend 에 바로 연결해야 하면 `.env` 에 `VITE_BACKEND_URL=http://localhost:8000` 을 설정한다. 이번 구성에서는 Vite proxy 를 사용하지 않는다.
