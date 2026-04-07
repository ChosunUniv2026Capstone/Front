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
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const envelope = payload as ApiErrorEnvelope | undefined
    const message =
      typeof payload === 'string'
        ? payload
        : envelope?.error?.message ?? payload?.detail ?? payload?.message ?? 'Request failed'
    throw new Error(message)
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

export const api = {
  health: () => request<{ status?: string }>('/health'),
  login: (payload: { login_id: string; password: string }) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
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
}

export function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}
