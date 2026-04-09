export type CourseSection = 'overview' | 'content' | 'notices' | 'exams' | 'attendance' | 'manage'
export type AttendancePage = 'timeline' | 'timer' | 'roster'

export type AppRoute =
  | { kind: 'login' }
  | { kind: 'dashboard' }
  | { kind: 'profile' }
  | { kind: 'notice'; noticeId: number }
  | {
      kind: 'course'
      courseCode: string
      section: CourseSection
      attendancePage?: AttendancePage
      sessionId?: number
      projectionKey?: string
      examId?: number
      examMode?: 'take'
    }

function cleanPathname(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

export function parseAppRoute(pathname: string): AppRoute {
  const normalizedPath = cleanPathname(pathname)

  if (normalizedPath === '/' || normalizedPath === '/dashboard') {
    return { kind: 'dashboard' }
  }

  if (normalizedPath === '/login') {
    return { kind: 'login' }
  }

  if (normalizedPath === '/profile') {
    return { kind: 'profile' }
  }

  const noticeMatch = normalizedPath.match(/^\/notices\/(\d+)$/)
  if (noticeMatch) {
    return { kind: 'notice', noticeId: Number(noticeMatch[1]) }
  }

  const courseAttendanceBundleMatch = normalizedPath.match(
    /^\/courses\/([^/]+)\/attendance\/sessions\/(\d+)\/(timer|roster)$/,
  )
  if (courseAttendanceBundleMatch) {
    return {
      kind: 'course',
      courseCode: decodeURIComponent(courseAttendanceBundleMatch[1]),
      section: 'attendance',
      sessionId: Number(courseAttendanceBundleMatch[2]),
      attendancePage: courseAttendanceBundleMatch[3] as AttendancePage,
    }
  }

  const courseAttendanceSlotRosterMatch = normalizedPath.match(
    /^\/courses\/([^/]+)\/attendance\/slots\/([^/]+)\/roster$/,
  )
  if (courseAttendanceSlotRosterMatch) {
    return {
      kind: 'course',
      courseCode: decodeURIComponent(courseAttendanceSlotRosterMatch[1]),
      section: 'attendance',
      projectionKey: decodeURIComponent(courseAttendanceSlotRosterMatch[2]),
      attendancePage: 'roster',
    }
  }

  const courseExamTakeMatch = normalizedPath.match(/^\/courses\/([^/]+)\/exams\/(\d+)\/take$/)
  if (courseExamTakeMatch) {
    return {
      kind: 'course',
      courseCode: decodeURIComponent(courseExamTakeMatch[1]),
      section: 'exams',
      examId: Number(courseExamTakeMatch[2]),
      examMode: 'take',
    }
  }

  const courseSectionMatch = normalizedPath.match(/^\/courses\/([^/]+)\/(content|notices|exams|attendance|manage)$/)
  if (courseSectionMatch) {
    return {
      kind: 'course',
      courseCode: decodeURIComponent(courseSectionMatch[1]),
      section: courseSectionMatch[2] as CourseSection,
      attendancePage: courseSectionMatch[2] === 'attendance' ? 'timeline' : undefined,
    }
  }

  const courseOverviewMatch = normalizedPath.match(/^\/courses\/([^/]+)$/)
  if (courseOverviewMatch) {
    return {
      kind: 'course',
      courseCode: decodeURIComponent(courseOverviewMatch[1]),
      section: 'overview',
    }
  }

  return { kind: 'dashboard' }
}

export function buildAppPath(route: AppRoute) {
  switch (route.kind) {
    case 'login':
      return '/login'
    case 'dashboard':
      return '/dashboard'
    case 'profile':
      return '/profile'
    case 'notice':
      return `/notices/${route.noticeId}`
    case 'course': {
      const basePath = `/courses/${encodeURIComponent(route.courseCode)}`
      if (route.section === 'overview') return basePath
      if (route.section === 'exams' && route.examMode === 'take' && route.examId != null) {
        return `${basePath}/exams/${route.examId}/take`
      }
      if (route.section !== 'attendance') return `${basePath}/${route.section}`
      if (route.attendancePage && route.attendancePage !== 'timeline' && route.sessionId) {
        return `${basePath}/attendance/sessions/${route.sessionId}/${route.attendancePage}`
      }
      if (route.attendancePage === 'roster' && route.projectionKey) {
        return `${basePath}/attendance/slots/${encodeURIComponent(route.projectionKey)}/${route.attendancePage}`
      }
      return `${basePath}/attendance`
    }
  }
}
