import type { ChangeEventHandler, FormEventHandler } from 'react'

type LoginScreenProps = {
  loginId: string
  password: string
  error: string | null
  onLoginIdChange: ChangeEventHandler<HTMLInputElement>
  onPasswordChange: ChangeEventHandler<HTMLInputElement>
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function LoginScreen({
  loginId,
  password,
  error,
  onLoginIdChange,
  onPasswordChange,
  onSubmit,
}: LoginScreenProps) {
  return (
    <main className="login-screen">
      <section className="login-hero">
        <p className="eyebrow">Smart Class MVP</p>
        <h1>Campus presence-aware learning workspace</h1>
        <p className="hero-copy">
          학생, 교수, 관리자 공통 로그인 화면입니다. 개발용 CSV seed 계정을 사용합니다.
        </p>
        <ul className="login-highlights">
          <li>학생: 수강 강의, 공지, 단말 등록, 출석 / 시험 확인</li>
          <li>교수: 담당 강의 운영, 공지 작성, 강의 컨텍스트 확인</li>
          <li>관리자: 사용자, 강의실, AP 매핑 현황 확인</li>
        </ul>
      </section>

      <section className="login-panel panel">
        <div className="login-panel__intro">
          <h2>Sign In</h2>
          <p>하나의 계정 진입면에서 역할별 워크스페이스로 바로 이동합니다.</p>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <label>
            Login ID
            <input
              autoComplete="username"
              value={loginId}
              onChange={onLoginIdChange}
              placeholder="20201234 / PRF001 / ADM001"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={onPasswordChange}
              placeholder="devpass123"
            />
          </label>

          <button type="submit">로그인</button>
        </form>

        {import.meta.env.DEV && (
          <div className="login-seed">
            <p className="meta-label">Seed accounts</p>
            <code>20201234 / PRF001 / ADM001</code>
            <code>password: devpass123</code>
          </div>
        )}

        {error ? <p className="banner banner--error">{error}</p> : null}
      </section>
    </main>
  )
}
