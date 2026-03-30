import type { AppRole, AppView } from '../../app/model.js'

export type NavigationItem = {
  id: AppView
  label: string
}

const roleNavigation = {
  student: [
    { id: 'dashboard', label: '워크스페이스' },
    { id: 'profile', label: '프로필' },
    { id: 'course', label: '강의' },
  ],
  professor: [
    { id: 'dashboard', label: '워크스페이스' },
    { id: 'profile', label: '프로필' },
    { id: 'course', label: '강의' },
  ],
  admin: [
    { id: 'dashboard', label: '운영 현황' },
    { id: 'profile', label: '계정' },
  ],
} satisfies Record<AppRole, ReadonlyArray<NavigationItem>>

export function getPrimaryNavigation(role: AppRole): NavigationItem[] {
  return roleNavigation[role].map((item) => ({ ...item }))
}
