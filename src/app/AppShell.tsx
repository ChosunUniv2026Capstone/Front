import type { ReactNode } from 'react'

import type { AppView } from './model.js'
import type { NavigationItem } from '../features/navigation/navigation.js'

type AppShellProps = {
  title: string
  subtitle: string
  accountInfo: string
  health: 'checking' | 'online' | 'offline'
  navigationItems: NavigationItem[]
  activeView: AppView
  onNavigate: (view: AppView) => void
  onLogout: () => void
  children?: ReactNode
}

const healthCopy: Record<AppShellProps['health'], string> = {
  checking: 'system checking',
  online: 'system online',
  offline: 'system offline',
}

export function AppShell({
  title,
  subtitle,
  accountInfo,
  health,
  navigationItems,
  activeView,
  onNavigate,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <main className="workspace-shell">
      <header className="workspace-header panel">
        <div className="workspace-heading">
          <p className="workspace-kicker">Smart Class MVP</p>
          <h1>{title}</h1>
          <p className="workspace-subtitle">{subtitle}</p>
        </div>

        <div className="workspace-meta">
          <section className={`workspace-status workspace-status--${health}`} aria-label="System health">
            <span className="workspace-status__dot" aria-hidden="true" />
            <div>
              <p className="meta-label">System</p>
              <strong>{healthCopy[health]}</strong>
            </div>
          </section>

          <section className="workspace-account" aria-label="Account info">
            <p className="meta-label">Account</p>
            <strong>{accountInfo}</strong>
          </section>

          <button type="button" className="danger-button" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <div className="workspace-frame">
        <nav className="workspace-nav panel" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="workspace-nav__button"
              aria-current={item.id === activeView ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section className="workspace-content">{children}</section>
      </div>
    </main>
  )
}
