export type Device = {
  id: number
  label: string
  mac_address: string
  status: 'active' | 'deleted'
  created_at?: string
}

export type LoginUser = {
  id: number
  role: 'student' | 'professor' | 'admin'
  login_id: string
  name: string
}

export type LoginResponse = {
  access_token: string
  user: LoginUser
}

export type Course = {
  id: number
  course_code: string
  title: string
  professor_name?: string | null
  classroom_code?: string | null
}

export type Notice = {
  id: number
  title: string
  body: string
  course_code?: string | null
  author_name: string
  created_at?: string | null
}

export type UserSummary = {
  id: number
  role: 'student' | 'professor' | 'admin'
  login_id: string
  name: string
}

export type Classroom = {
  id: number
  classroom_code: string
  name: string
  building?: string | null
  floor_label?: string | null
}

export type ClassroomNetwork = {
  id: number
  classroom_code: string
  ap_id: string
  ssid: string
  gateway_host?: string | null
  signal_threshold_dbm?: number | null
  collection_mode: string
}

export type EligibilityRequest = {
  student_id: string
  course_code: string
}

export type EligibilityResponse = {
  eligible: boolean
  reason_code: string
  matched_device_mac?: string | null
  observed_at?: string | null
  snapshot_age_seconds?: number | null
  evidence?: Record<string, unknown>
}

export type AdminPresenceStation = {
  macAddress: string
  associated?: boolean | null
  authenticated?: boolean | null
  authorized?: boolean | null
  signalDbm?: number | null
  connectedSeconds?: number | null
  rxBytes?: number | null
  txBytes?: number | null
  deviceLabel?: string | null
  ownerName?: string | null
  ownerLoginId?: string | null
}

export type AdminPresenceAccessPoint = {
  apId: string
  ssid: string
  sourceCommand: string
  stations: AdminPresenceStation[]
}

export type AdminPresenceSnapshot = {
  cacheHit: boolean
  overlayActive: boolean
  classroomCode: string
  observedAt?: string | null
  collectionMode?: string | null
  aps: AdminPresenceAccessPoint[]
  classroomNetworks: ClassroomNetwork[]
  deviceOptions: AdminPresenceDeviceOption[]
}

export type AdminPresenceOverlayRequest = {
  stations: Array<{
    macAddress: string
    apId?: string | null
    associated?: boolean | null
    authorized?: boolean | null
    authenticated?: boolean | null
    signalDbm?: number | null
    connectedSeconds?: number | null
    rxBytes?: number | null
    txBytes?: number | null
  }>
}

export type AdminPresenceDeviceOption = {
  studentLoginId?: string | null
  studentName?: string | null
  deviceLabel?: string | null
  macAddress: string
  observed: boolean
}

export type AttendanceSlotAggregate = {
  present: number
  late: number
  absent: number
  official: number
  sick: number
}

export type AttendanceSlot = {
  projection_key: string
  course_code: string
  classroom_code: string
  session_date: string
  slot_start_at: string
  slot_end_at: string
  week_index: number
  lesson_index_within_week: number
  period_label: string
  display_label: string
  professor_name: string
  professor_login_id: string
  slot_state: 'unchecked' | 'offline' | 'online' | 'canceled'
  session_id?: number | null
  session_mode?: 'manual' | 'smart' | 'canceled' | null
  session_status?: 'active' | 'closed' | 'expired' | 'canceled' | null
  expires_at?: string | null
  aggregate: AttendanceSlotAggregate
}

export type AttendanceWeek = {
  week_index: number
  week_start: string
  week_end: string
  slots: AttendanceSlot[]
}

export type AttendanceReportSummary = {
  projection_slot_count: number
  active_session_count: number
  smart_active_count: number
  canceled_count: number
  present: number
  late: number
  absent: number
  official: number
  sick: number
}

export type AttendanceTimeline = {
  course_code: string
  course_title: string
  semester_start: string
  semester_end: string
  weeks: AttendanceWeek[]
  report_summary: AttendanceReportSummary
}

export type AttendanceBatchResult = {
  projection_key: string
  success: boolean
  code: string
  message: string
  session_id?: number | null
  resulting_slot_state: 'unchecked' | 'offline' | 'online' | 'canceled'
  event_type?: string
  expires_at?: string | null
}

export type AttendanceBatchResponse = {
  course_code: string
  mode: 'manual' | 'smart' | 'canceled'
  results: AttendanceBatchResult[]
  changed_projection_keys: string[]
  changed_session_ids: number[]
  occurred_at: string
}

export type AttendanceRosterStudent = {
  student_id: string
  student_name: string
  final_status?: 'present' | 'absent' | 'late' | 'official' | 'sick' | null
  attendance_reason?: string | null
  history_count: number
}

export type AttendanceSessionRoster = {
  session: {
    session_id?: number | null
    projection_key: string
    projection_keys?: string[]
    mode?: 'manual' | 'smart' | 'canceled' | null
    status: 'active' | 'closed' | 'expired' | 'canceled' | 'unchecked'
    expires_at?: string | null
    version: number
    course_code: string
  }
  students: AttendanceRosterStudent[]
  aggregate: AttendanceSlotAggregate
}

export type AttendanceHistoryEntry = {
  audit_id: number
  projection_key: string
  change_source: string
  previous_status?: string | null
  new_status?: string | null
  reason?: string | null
  changed_at: string
  version: number
  actor_name: string
  actor_role: string
  actor_login_id: string
}

export type AttendanceHistory = {
  student_id: string
  student_name: string
  course_code: string
  entries: AttendanceHistoryEntry[]
}

export type StudentAttendanceSession = {
  session_id: number
  projection_key: string
  projection_keys?: string[]
  slot_labels?: string[]
  display_label: string
  session_date: string
  slot_start_at: string
  slot_end_at: string
  expires_at?: string | null
  can_check_in: boolean
  eligibility: EligibilityResponse
  version: number
}

export type StudentActiveAttendanceSessions = {
  course_code: string
  student_id: string
  sessions: StudentAttendanceSession[]
}

export type StudentAttendanceSemesterMatrixCell = {
  projection_key: string
  lesson_index_within_week: number
  period_label: string
  display_label: string
  session_date: string
  status: 'present' | 'late' | 'absent' | 'official' | 'pending' | 'upcoming' | 'canceled'
}

export type StudentAttendanceSemesterMatrixWeek = {
  week_index: number
  week_start: string
  week_end: string
  slots: StudentAttendanceSemesterMatrixCell[]
}

export type StudentAttendanceSemesterMatrix = {
  course_code: string
  course_title: string
  student_id: string
  student_name: string
  weeks: StudentAttendanceSemesterMatrixWeek[]
}

export type ProfessorAttendanceStudentStatsRow = {
  student_id: string
  student_name: string
  present: number
  late: number
  absent: number
  official: number
  sick: number
}

export type ProfessorAttendanceStudentStats = {
  course_code: string
  course_title: string
  rows: ProfessorAttendanceStudentStatsRow[]
}

export type AttendanceCheckInResult = {
  code: string
  session_id: number
  projection_key: string
  student_id: string
  status: string
  version: number
  occurred_at: string
  course_code: string
  idempotent: boolean
}

type ApiSuccessEnvelope<T> = {
  success: true
  data: T
  message?: string
  meta?: Record<string, unknown>
}

type ApiErrorEnvelope = {
  success: false
  error?: {
    code?: string
    message?: string
    details?: Record<string, unknown>
  }
}

const API_BASE = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000').replace(/\/$/, '')
let authFailureHandler: (() => void) | null = null
let refreshPromise: Promise<LoginResponse> | null = null

type RequestOptions = {
  allowSessionRefresh?: boolean
  suppressAuthFailureHandler?: boolean
}

class ApiRequestError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler
}

function shouldTrySessionRefresh(path: string) {
  return !['/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/bootstrap', '/api/auth/me'].includes(path)
}

async function requestInternal<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (response.status === 401 && options.allowSessionRefresh !== false && shouldTrySessionRefresh(path)) {
    try {
      await refreshAccessToken()
      return requestInternal<T>(path, init, {
        ...options,
        allowSessionRefresh: false,
      })
    } catch {
      // fall through to envelope parsing + auth failure handling below
    }
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()

  if (response.ok && (response.status === 204 || payload === '')) {
    return undefined as T
  }

  if (!response.ok) {
    const envelope = payload as ApiErrorEnvelope | undefined
    const code = envelope?.error?.code
    const message =
      typeof payload === 'string'
        ? payload
        : envelope?.error?.message ?? payload?.detail ?? payload?.message ?? 'Request failed'
    if (response.status === 401 && !options.suppressAuthFailureHandler) {
      authFailureHandler?.()
    }
    throw new ApiRequestError(message, response.status, code)
  }

  const successEnvelope = payload as ApiSuccessEnvelope<T> | undefined
  if (
    successEnvelope &&
    typeof successEnvelope === 'object' &&
    successEnvelope.success === true &&
    'data' in successEnvelope
  ) {
    return successEnvelope.data
  }

  return payload as T
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return requestInternal<T>(path, init, {
    allowSessionRefresh: false,
    suppressAuthFailureHandler: true,
  })
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = authRequest<LoginResponse>('/api/auth/refresh', {
      method: 'POST',
    })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestInternal<T>(path, init)
}

export const api = {
  health: () => request<{ status?: string }>('/health'),
  login: (payload: { login_id: string; password: string }) =>
    authRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  bootstrapSession: async () => {
    try {
      return await authRequest<LoginResponse>('/api/auth/bootstrap')
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) {
        return authRequest<LoginResponse>('/api/auth/me')
      }
      throw error
    }
  },
  refreshSession: () => refreshAccessToken(),
  logout: () =>
    authRequest<{ success?: boolean } | void>('/api/auth/logout', {
      method: 'POST',
    }),
  listStudentCourses: (studentId: string) => request<Course[]>(`/api/students/${studentId}/courses`),
  listProfessorCourses: (professorId: string) => request<Course[]>(`/api/professors/${professorId}/courses`),
  listDevices: (studentId: string) => request<Device[]>(`/api/students/${studentId}/devices`),
  createDevice: (studentId: string, payload: { label: string; mac_address: string }) =>
    request<Device>(`/api/students/${studentId}/devices`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteDevice: (studentId: string, deviceId: number) =>
    request<{ success?: boolean }>(`/api/students/${studentId}/devices/${deviceId}`, {
      method: 'DELETE',
    }),
  checkEligibility: (payload: EligibilityRequest) =>
    request<EligibilityResponse>('/api/attendance/eligibility', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listNotices: (loginId: string) => request<Notice[]>(`/api/notices/${loginId}`),
  getNoticeDetail: (loginId: string, noticeId: number) => request<Notice>(`/api/notices/${loginId}/${noticeId}`),
  createNotice: (professorId: string, payload: { title: string; body: string; course_code?: string }) =>
    request<Notice>(`/api/professors/${professorId}/notices`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listUsers: () => request<UserSummary[]>('/api/admin/users'),
  listClassrooms: () => request<Classroom[]>('/api/admin/classrooms'),
  listClassroomNetworks: () => request<ClassroomNetwork[]>('/api/admin/classroom-networks'),
  getAdminPresenceSnapshot: (classroomCode: string) =>
    request<AdminPresenceSnapshot>(`/api/admin/presence/classrooms/${classroomCode}/snapshot`),
  applyAdminPresenceOverlay: (classroomCode: string, payload: AdminPresenceOverlayRequest) =>
    request<AdminPresenceSnapshot>(`/api/admin/presence/classrooms/${classroomCode}/dummy-controls`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resetAdminPresenceOverlay: (classroomCode: string) =>
    request<AdminPresenceSnapshot>(`/api/admin/presence/classrooms/${classroomCode}/dummy-controls/reset`, {
      method: 'POST',
    }),
  updateClassroomNetworkThreshold: (networkId: number, payload: { signal_threshold_dbm: number | null }) =>
    request<ClassroomNetwork>(`/api/admin/classroom-networks/${networkId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getProfessorAttendanceTimeline: (professorId: string, courseCode: string) =>
    request<AttendanceTimeline>(`/api/professors/${professorId}/courses/${courseCode}/attendance/timeline`),
  applyProfessorAttendanceBatch: (
    professorId: string,
    courseCode: string,
    payload: { projection_keys: string[]; mode: 'manual' | 'smart' | 'canceled' },
  ) =>
    request<AttendanceBatchResponse>(`/api/professors/${professorId}/courses/${courseCode}/attendance/sessions/batch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closeProfessorAttendanceSession: (professorId: string, sessionId: number) =>
    request<{ session_id: number; projection_key: string; status: string; version: number; occurred_at: string; course_code: string }>(
      `/api/professors/${professorId}/attendance/sessions/${sessionId}/close`,
      {
        method: 'POST',
      },
    ),
  getProfessorAttendanceRoster: (professorId: string, sessionId: number) =>
    request<AttendanceSessionRoster>(`/api/professors/${professorId}/attendance/sessions/${sessionId}/roster`),
  getProfessorAttendanceSlotRoster: (professorId: string, courseCode: string, projectionKey: string) =>
    request<AttendanceSessionRoster>(
      `/api/professors/${professorId}/courses/${courseCode}/attendance/slot-roster?projection_key=${encodeURIComponent(projectionKey)}`,
    ),
  updateProfessorAttendanceRecord: (
    professorId: string,
    sessionId: number,
    studentId: string,
    payload: { status: 'present' | 'absent' | 'late' | 'official' | 'sick'; reason?: string | null },
  ) =>
    request<{
      session_id: number
      projection_key: string
      student_id: string
      new_status: string
      reason: string
      version: number
      course_code: string
      occurred_at: string
    }>(`/api/professors/${professorId}/attendance/sessions/${sessionId}/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getProfessorAttendanceHistory: (professorId: string, courseCode: string, studentId: string) =>
    request<AttendanceHistory>(`/api/professors/${professorId}/courses/${courseCode}/attendance/students/${studentId}/history`),
  getProfessorAttendanceStudentStats: (professorId: string, courseCode: string) =>
    request<ProfessorAttendanceStudentStats>(`/api/professors/${professorId}/courses/${courseCode}/attendance/student-stats`),
  listStudentActiveAttendanceSessions: (studentId: string, courseCode: string) =>
    request<StudentActiveAttendanceSessions>(`/api/students/${studentId}/courses/${courseCode}/attendance/active-sessions`),
  getStudentAttendanceSemesterMatrix: (studentId: string, courseCode: string) =>
    request<StudentAttendanceSemesterMatrix>(`/api/students/${studentId}/courses/${courseCode}/attendance/semester-matrix`),
  studentAttendanceCheckIn: (studentId: string, sessionId: number) =>
    request<AttendanceCheckInResult>(`/api/students/${studentId}/attendance/sessions/${sessionId}/check-in`, {
      method: 'POST',
    }),
}

export function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}
