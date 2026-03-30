import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { AppShell } from '../src/app/AppShell.js'
import { LoginScreen } from '../src/features/auth/LoginScreen.js'

test('LoginScreen renders the narrative sign-in surface with seed guidance and error messaging', () => {
  const html = renderToStaticMarkup(
    createElement(LoginScreen, {
      loginId: '20201234',
      password: 'devpass123',
      error: '로그인에 실패했습니다.',
      onLoginIdChange: () => undefined,
      onPasswordChange: () => undefined,
      onSubmit: () => undefined,
    }),
  )

  assert.match(html, /Smart Class MVP/)
  assert.match(html, /Campus presence-aware learning workspace/)
  assert.match(html, /20201234 \/ PRF001 \/ ADM001/)
  assert.match(html, /로그인에 실패했습니다\./)
  assert.match(html, /로그인/)
})

test('AppShell renders calm workspace framing, navigation state, health, account info, and child content', () => {
  const html = renderToStaticMarkup(
    createElement(
      AppShell,
      {
        title: 'Learning Workspace',
        subtitle: '학생, 교수, 관리자 공통 업무 화면',
        accountInfo: '김학생 · student · 20201234',
        health: 'online',
        navigationItems: [
          { id: 'dashboard', label: '워크스페이스' },
          { id: 'profile', label: '프로필' },
        ],
        activeView: 'profile',
        onNavigate: () => undefined,
        onLogout: () => undefined,
      },
      createElement('section', null, 'workspace body'),
    ),
  )

  assert.match(html, /Learning Workspace/)
  assert.match(html, /학생, 교수, 관리자 공통 업무 화면/)
  assert.match(html, /system online/)
  assert.match(html, /김학생 · student · 20201234/)
  assert.match(html, /aria-current="page"[^>]*>프로필</)
  assert.match(html, /workspace body/)
  assert.match(html, /로그아웃/)
})

test('authenticated shell mobile styles stack the header and clear desktop min-width constraints', () => {
  const cssPath = path.join(process.cwd(), 'src/styles/surfaces.css')
  const css = readFileSync(cssPath, 'utf8')
  const mobileStyles = css.match(/@media \(max-width: 980px\) \{([\s\S]+)\}\s*$/)

  assert.ok(mobileStyles, 'expected a mobile responsive block in surfaces.css')
  assert.match(
    mobileStyles[1],
    /\.workspace-header\s*\{[\s\S]*flex-direction:\s*column;/,
    'expected the mobile header to stack vertically',
  )
  assert.match(
    mobileStyles[1],
    /\.workspace-status,\s*[\r\n\s]*\.workspace-account,\s*[\r\n\s]*\.danger-button\s*\{[\s\S]*min-width:\s*0;/,
    'expected mobile shell controls to drop desktop min-width constraints',
  )
  assert.match(
    mobileStyles[1],
    /\.workspace-nav\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(140px,\s*1fr\)\);[\s\S]*overflow-x:\s*visible;/,
    'expected mobile navigation to wrap within the viewport instead of relying on horizontal scrolling',
  )
})
