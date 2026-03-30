export type AppRole = 'student' | 'professor' | 'admin'
export type AppView = 'dashboard' | 'profile' | 'course'
export type CourseTab = 'notices' | 'eligibility'

const defaultViewByRole: Record<AppRole, AppView> = {
  student: 'dashboard',
  professor: 'dashboard',
  admin: 'dashboard',
}

export function getDefaultView(role: AppRole): AppView {
  return defaultViewByRole[role]
}

export function getVisibleCourseTabs(role: AppRole): CourseTab[] {
  return role === 'student' ? ['notices', 'eligibility'] : ['notices']
}

export function getDefaultCourseTab(role: AppRole | null): CourseTab {
  if (!role) return 'notices'
  return getVisibleCourseTabs(role)[0] ?? 'notices'
}

export function canManageDevices(role: AppRole): boolean {
  return role === 'student'
}

export function isEligibilityVisible(role: AppRole): boolean {
  return role === 'student'
}
