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
  attachments?: StoredObjectAttachment[]
}

export type AssignmentStatus = 'upcoming' | 'open' | 'closed'

export type StoredObjectAttachment = {
  id: number
  original_filename: string
  mime_type?: string | null
  file_size_bytes: number
  uploaded_at?: string | null
  storage_provider?: string | null
  bucket_name?: string | null
}

export type AssignmentAttachment = StoredObjectAttachment

export type LearningItemKind = 'material' | 'video'

export type LearningItemAttachment = StoredObjectAttachment & {
  purpose?: LearningItemKind | string | null
}

export type LearningItem = {
  id: number
  course_code: string
  kind: LearningItemKind
  title: string
  description?: string | null
  week_label?: string | null
  format_label?: string | null
  author_name: string
  created_at?: string | null
  updated_at?: string | null
  attachments: LearningItemAttachment[]
  duration_label?: string | null
}

export type LearningItemCreatePayload = {
  kind: LearningItemKind
  title: string
  description?: string | null
  week_label?: string | null
  format_label?: string | null
  duration_label?: string | null
  files?: File[]
}

export type ExamMediaAttachment = StoredObjectAttachment & {
  question_id?: number | null
  answer_id?: number | null
  purpose?: 'question' | 'answer' | 'explanation' | string | null
}

export type ReportExport = StoredObjectAttachment & {
  export_type: 'attendance_csv' | string
  course_code: string
  status?: 'pending' | 'ready' | 'failed' | string
  generated_at?: string | null
}

export type StudentAssignmentSubmission = {
  id: number
  score?: number | null
  max_score?: number | null
  feedback?: string | null
  graded_at?: string | null
  grading_status?: AssignmentGradingStatus | string | null
  submission_text?: string | null
  submitted_at?: string | null
  updated_at?: string | null
  attachments: AssignmentAttachment[]
}

export type StudentAssignmentSummary = {
  id: number
  max_score?: number | null
  score?: number | null
  feedback?: string | null
  grading_status?: AssignmentGradingStatus | string | null
  title: string
  description?: string | null
  opens_at: string
  due_at: string
  status: AssignmentStatus
  created_at?: string | null
  submitted: boolean
  submitted_at?: string | null
  attachment_count: number
}

export type StudentAssignmentDetail = StudentAssignmentSummary & {
  submission?: StudentAssignmentSubmission | null
}

export type ProfessorAssignmentSubmission = {
  id: number
  score?: number | null
  max_score?: number | null
  feedback?: string | null
  graded_at?: string | null
  grading_status?: AssignmentGradingStatus | string | null
  student_id: string
  student_name: string
  submission_text?: string | null
  submitted_at?: string | null
  updated_at?: string | null
  attachments: AssignmentAttachment[]
}

export type ProfessorAssignmentSummary = {
  id: number
  max_score?: number | null
  title: string
  description?: string | null
  opens_at: string
  due_at: string
  status: AssignmentStatus
  created_at?: string | null
  submission_count: number
  total_students: number
}

export type ProfessorAssignmentDetail = ProfessorAssignmentSummary & {
  submissions: ProfessorAssignmentSubmission[]
}

export type ProfessorAssignmentCreatePayload = {
  title: string
  description?: string | null
  opens_at: string
  due_at: string
}


export type AssignmentGradingStatus = 'submitted' | 'graded' | 'returned'

export type AssignmentGradePayload = {
  score: number | null
  feedback: string | null
  grading_status: AssignmentGradingStatus
}

export type GradeBookItem = {
  item_type: 'assignment' | 'exam' | string
  item_id: number | string
  title: string
  score?: number | null
  max_score?: number | null
  percent?: number | null
  feedback?: string | null
  grading_status?: AssignmentGradingStatus | string | null
  graded_at?: string | null
  submitted_at?: string | null
  due_at?: string | null
}

export type StudentCourseGrades = {
  course_code: string
  student_id?: string | null
  student_name?: string | null
  overall_percent?: number | null
  items: GradeBookItem[]
}

export type ProfessorCourseGradeSummary = {
  student_id: string
  student_name: string
  overall_percent?: number | null
  items: GradeBookItem[]
}

export type CourseQnaPost = {
  id: number
  author_id?: number | null
  author_login_id?: string | null
  author_name?: string | null
  body: string
  post_type: 'question' | 'answer' | 'comment' | string
  created_at?: string | null
}

export type CourseQnaThread = {
  id: number
  title: string
  body: string
  status: 'open' | 'answered' | 'closed' | string
  student_id?: string | null
  student_name?: string | null
  created_at?: string | null
  updated_at?: string | null
  posts?: CourseQnaPost[]
}

export type StudentQnaCreatePayload = {
  title: string
  body: string
}

export type ProfessorQnaAnswerPayload = {
  body: string
  close: boolean
}

export type LearningProgressStatus = 'not_started' | 'in_progress' | 'completed'

export type LearningProgressUpdatePayload = {
  progress_percent: number
  status: LearningProgressStatus
}

export type StudentLearningProgressItem = {
  learning_item_id: number
  title: string
  kind?: LearningItemKind | string | null
  week_label?: string | null
  progress_percent: number
  status: LearningProgressStatus | string
  last_viewed_at?: string | null
  completed_at?: string | null
  updated_at?: string | null
}

export type ProfessorLearningProgressRow = StudentLearningProgressItem & {
  student_id: string
  student_name: string
}

export type ExamSummary = {
  id: number
  title: string
  description?: string | null
  exam_type: 'quiz' | 'midterm' | 'final' | 'practice' | 'custom'
  status: 'draft' | 'published' | 'open' | 'closed' | 'archived'
  starts_at: string
  ends_at: string
  duration_minutes: number
  requires_presence: boolean
  late_entry_allowed?: boolean
  auto_submit_enabled?: boolean
  shuffle_questions?: boolean
  shuffle_options?: boolean
  max_attempts: number
  question_count?: number
  attempt_count?: number
}

export type StudentExamAvailability = {
  code: string
  label: string
  can_start: boolean
  can_submit: boolean
}

export type StudentExamAttempt = {
  id: number
  attempt_no: number
  status: string
  started_at?: string | null
  submitted_at?: string | null
  expires_at?: string | null
  score?: number | null
  total_count: number
  answered_count: number
}

export type StudentExamSummary = ExamSummary & {
  attempts_used: number
  availability?: StudentExamAvailability | null
  attempt?: StudentExamAttempt | null
}

export type ExamQuestionOption = {
  id: number
  option_order: number
  option_text: string
  is_correct?: boolean | null
}

export type StudentExamQuestion = {
  id: number
  question_order: number
  question_type: 'multiple_choice' | 'true_false'
  prompt: string
  points: number
  explanation?: string | null
  is_required: boolean
  selected_option_id?: number | null
  options: ExamQuestionOption[]
  attachments?: ExamMediaAttachment[]
}

export type StudentExamDetail = StudentExamSummary & {
  questions: StudentExamQuestion[]
}

export type ExamSubmissionStart = {
  submission_id: number
  attempt_no: number
  status: string
  started_at: string
  expires_at: string
  idempotent: boolean
}

export type ProfessorExamDetail = ExamSummary & {
  questions: StudentExamQuestion[]
  submission_overview?: {
    total_students: number
    started_students: number
    submitted_students: number
    not_started_students: number
    average_score?: number | null
    max_score: number
  } | null
  submissions: Array<{
    student_id: string
    student_name: string
    status: string
    attempt_no?: number | null
    answered_count: number
    started_at?: string | null
    submitted_at?: string | null
    score?: number | null
    max_score: number
    total_count: number
  }>
}

export type ProfessorExamCreatePayload = {
  title: string
  description?: string | null
  exam_type: ExamSummary['exam_type']
  starts_at: string
  ends_at: string
  duration_minutes: number
  requires_presence: boolean
  late_entry_allowed: boolean
  auto_submit_enabled: boolean
  shuffle_questions: boolean
  shuffle_options: boolean
  max_attempts: number
  questions: Array<{
    question_type: 'multiple_choice' | 'true_false'
    prompt: string
    points: number
    explanation?: string | null
    is_required: boolean
    options: Array<{
      option_text: string
      is_correct: boolean
    }>
  }>
}

export type StudentExamSubmitPayload = {
  answers: Array<{
    question_id: number
    selected_option_id: number | null
    answer_text?: string | null
  }>
}

export type StudentExamSaveAnswerPayload = {
  selected_option_id: number | null
  answer_text?: string | null
}

export type StudentExamSavedAnswer = {
  submission_id: number
  question_id: number
  selected_option_id?: number | null
  answer_text?: string | null
  answered_at?: string | null
}

export type StudentExamSubmitResult = {
  exam_id: number
  attempt: StudentExamAttempt
  score?: number | null
  total_count: number
  answered_count: number
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

export type StudentAttendanceSlotEligibility = {
  projection_key: string
  eligibility: EligibilityResponse
}

export type StudentAttendanceEligibilitySummary = {
  eligible_slot_count: number
  rejected_slot_count: number
  per_slot: StudentAttendanceSlotEligibility[]
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
    present?: boolean
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
  included_slots?: {
    projection_key: string
    display_label?: string | null
    period_label?: string | null
    slot_order?: number | null
  }[]
  slot_labels?: string[]
  display_label: string
  session_date: string
  slot_start_at: string
  slot_end_at: string
  expires_at?: string | null
  can_check_in: boolean
  eligibility: EligibilityResponse | StudentAttendanceEligibilitySummary
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

export function resolveBackendHttpBase(configuredUrl = import.meta.env.VITE_BACKEND_URL): string {
  return (configuredUrl ?? '').trim().replace(/\/+$/, '')
}

type BrowserLocation = Pick<Location, 'protocol' | 'host'>

export function resolveBackendWebSocketBase(
  configuredUrl = import.meta.env.VITE_BACKEND_URL,
  location: BrowserLocation = window.location,
): string {
  const explicitBase = resolveBackendHttpBase(configuredUrl)
  if (explicitBase) {
    return explicitBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}`
}

export function buildAttendanceWebSocketUrl(
  courseCode: string,
  view: 'student' | 'professor',
  configuredUrl = import.meta.env.VITE_BACKEND_URL,
  location: BrowserLocation = window.location,
): string {
  const params = new URLSearchParams({
    courseCode,
    view,
  })
  return `${resolveBackendWebSocketBase(configuredUrl, location)}/ws/attendance?${params.toString()}`
}

const API_BASE = resolveBackendHttpBase()
let authFailureHandler: (() => void) | null = null
let refreshPromise: Promise<LoginResponse> | null = null

type RequestOptions = {
  allowSessionRefresh?: boolean
  suppressAuthFailureHandler?: boolean
}

export class ApiRequestError extends Error {
  status: number
  code?: string
  details?: Record<string, unknown> | null

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown> | null) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details ?? null
  }
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler
}

function shouldTrySessionRefresh(path: string) {
  return !['/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/bootstrap', '/api/auth/me'].includes(path)
}

function requiresApiEnvelope(path: string) {
  return path.startsWith('/api/')
}

async function requestInternal<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init?.headers ?? {})
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
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
    const envelopeDetails = envelope?.error?.details
    const detailMessage =
      typeof payload === 'object' && payload && 'detail' in payload && typeof payload.detail === 'object' && payload.detail
        ? (payload.detail as { message?: string; code?: string }).message ?? null
        : null
    const detailCode =
      typeof payload === 'object' && payload && 'detail' in payload && typeof payload.detail === 'object' && payload.detail
        ? (payload.detail as { message?: string; code?: string }).code ?? null
        : null
    const detailDetails =
      typeof payload === 'object' && payload && 'detail' in payload && typeof payload.detail === 'object' && payload.detail
        ? ((payload.detail as { details?: Record<string, unknown> }).details ?? null)
        : null
    const message =
      typeof payload === 'string'
        ? payload
        : envelope?.error?.message ?? detailMessage ?? payload?.message ?? 'Request failed'
    if (response.status === 401 && !options.suppressAuthFailureHandler) {
      authFailureHandler?.()
    }
    throw new ApiRequestError(message, response.status, code ?? detailCode ?? undefined, envelopeDetails ?? detailDetails ?? null)
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

  if (requiresApiEnvelope(path)) {
    throw new ApiRequestError('Invalid API response envelope', response.status, 'INVALID_API_RESPONSE_ENVELOPE', {
      path,
    })
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

function buildApiUrl(path: string) {
  return `${API_BASE}${path}`
}

function pathSegment(value: string | number) {
  return encodeURIComponent(String(value))
}

function learningItemFormData(payload: LearningItemCreatePayload) {
  const formData = new FormData()
  formData.append('kind', payload.kind)
  formData.append('title', payload.title)
  if (payload.description != null) formData.append('description', payload.description)
  if (payload.week_label != null) formData.append('week_label', payload.week_label)
  if (payload.format_label != null) formData.append('format_label', payload.format_label)
  if (payload.duration_label != null) formData.append('duration_label', payload.duration_label)
  for (const file of payload.files ?? []) {
    formData.append('files', file)
  }
  return formData
}

function noticeFormData(payload: { title: string; body: string; course_code?: string | null; files?: File[] }) {
  const formData = new FormData()
  formData.append('title', payload.title)
  formData.append('body', payload.body)
  if (payload.course_code != null) formData.append('course_code', payload.course_code)
  for (const file of payload.files ?? []) {
    formData.append('files', file)
  }
  return formData
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
  listStudentAssignments: (studentId: string, courseCode: string) =>
    request<StudentAssignmentSummary[]>(`/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/assignments`),
  getStudentAssignmentDetail: (studentId: string, courseCode: string, assignmentId: number) =>
    request<StudentAssignmentDetail>(`/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/assignments/${pathSegment(assignmentId)}`),
  submitStudentAssignment: (
    studentId: string,
    courseCode: string,
    assignmentId: number,
    payload: {
      submission_text?: string | null
      files?: File[]
    },
  ) => {
    const formData = new FormData()
    if (payload.submission_text != null) {
      formData.append('submission_text', payload.submission_text)
    }
    for (const file of payload.files ?? []) {
      formData.append('files', file)
    }
    return request<StudentAssignmentDetail>(
      `/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/assignments/${pathSegment(assignmentId)}/submission`,
      {
        method: 'POST',
        body: formData,
      },
    )
  },
  buildStudentAssignmentAttachmentUrl: (
    studentId: string,
    courseCode: string,
    assignmentId: number,
    attachmentId: number,
  ) =>
    buildApiUrl(`/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/assignments/${pathSegment(assignmentId)}/attachments/${pathSegment(attachmentId)}`),
  listProfessorAssignments: (professorId: string, courseCode: string) =>
    request<ProfessorAssignmentSummary[]>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/assignments`),
  getProfessorAssignmentDetail: (professorId: string, courseCode: string, assignmentId: number) =>
    request<ProfessorAssignmentDetail>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/assignments/${pathSegment(assignmentId)}`),
  createProfessorAssignment: (professorId: string, courseCode: string, payload: ProfessorAssignmentCreatePayload) =>
    request<ProfessorAssignmentDetail>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  gradeProfessorAssignmentSubmission: (
    professorId: string,
    courseCode: string,
    assignmentId: number,
    submissionId: number,
    payload: AssignmentGradePayload,
  ) =>
    request<ProfessorAssignmentDetail | ProfessorAssignmentSubmission>(
      `/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/assignments/${pathSegment(assignmentId)}/submissions/${pathSegment(submissionId)}/grade`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),
  getStudentGrades: (studentId: string, courseCode: string) =>
    request<StudentCourseGrades>(`/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/grades`),
  getProfessorGrades: (professorId: string, courseCode: string) =>
    request<ProfessorCourseGradeSummary[]>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/grades`),
  listStudentQna: (studentId: string, courseCode: string) =>
    request<CourseQnaThread[]>(`/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/qna`),
  createStudentQna: (studentId: string, courseCode: string, payload: StudentQnaCreatePayload) =>
    request<CourseQnaThread>(`/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/qna`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listProfessorQna: (professorId: string, courseCode: string) =>
    request<CourseQnaThread[]>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/qna`),
  answerProfessorQna: (professorId: string, courseCode: string, threadId: number, payload: ProfessorQnaAnswerPayload) =>
    request<CourseQnaThread>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/qna/${pathSegment(threadId)}/answer`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listStudentLearningProgress: (studentId: string, courseCode: string) =>
    request<StudentLearningProgressItem[]>(`/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/learning-progress`),
  updateStudentLearningProgress: (
    studentId: string,
    courseCode: string,
    learningItemId: number,
    payload: LearningProgressUpdatePayload,
  ) =>
    request<StudentLearningProgressItem>(
      `/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/learning-items/${pathSegment(learningItemId)}/progress`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),
  listProfessorLearningProgress: (professorId: string, courseCode: string) =>
    request<ProfessorLearningProgressRow[]>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/learning-progress`),
  buildProfessorAssignmentAttachmentUrl: (
    professorId: string,
    courseCode: string,
    assignmentId: number,
    attachmentId: number,
  ) =>
    buildApiUrl(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/assignments/${pathSegment(assignmentId)}/attachments/${pathSegment(attachmentId)}`),
  listStudentLearningItems: (studentId: string, courseCode: string) =>
    request<LearningItem[]>(`/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/learning-items`),
  listProfessorLearningItems: (professorId: string, courseCode: string) =>
    request<LearningItem[]>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/learning-items`),
  createProfessorLearningItem: (professorId: string, courseCode: string, payload: LearningItemCreatePayload) =>
    request<LearningItem>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/learning-items`, {
      method: 'POST',
      body: learningItemFormData(payload),
    }),
  deleteProfessorLearningItem: (professorId: string, courseCode: string, learningItemId: number) =>
    request<void>(
      `/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/learning-items/${pathSegment(learningItemId)}`,
      {
        method: 'DELETE',
      },
    ),
  buildStudentLearningAttachmentUrl: (studentId: string, courseCode: string, learningItemId: number, attachmentId: number) =>
    buildApiUrl(
      `/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/learning-items/${pathSegment(learningItemId)}/attachments/${pathSegment(attachmentId)}`,
    ),
  buildProfessorLearningAttachmentUrl: (professorId: string, courseCode: string, learningItemId: number, attachmentId: number) =>
    buildApiUrl(
      `/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/learning-items/${pathSegment(learningItemId)}/attachments/${pathSegment(attachmentId)}`,
    ),
  listStudentExams: (studentId: string, courseCode: string) =>
    request<StudentExamSummary[]>(`/api/students/${studentId}/courses/${courseCode}/exams`),
  getStudentExamDetail: (studentId: string, courseCode: string, examId: number) =>
    request<StudentExamDetail>(`/api/students/${studentId}/courses/${courseCode}/exams/${examId}`),
  startStudentExam: (studentId: string, courseCode: string, examId: number) =>
    request<ExamSubmissionStart>(`/api/students/${studentId}/courses/${courseCode}/exams/${examId}/start`, {
      method: 'POST',
    }),
  saveStudentExamAnswer: (
    studentId: string,
    courseCode: string,
    examId: number,
    submissionId: number,
    questionId: number,
    payload: StudentExamSaveAnswerPayload,
  ) =>
    request<StudentExamSavedAnswer>(
      `/api/students/${studentId}/courses/${courseCode}/exams/${examId}/submissions/${submissionId}/answers/${questionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),
  submitStudentExam: (studentId: string, courseCode: string, examId: number, payload: StudentExamSubmitPayload) =>
    request<StudentExamSubmitResult>(`/api/students/${studentId}/courses/${courseCode}/exams/${examId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listProfessorExams: (professorId: string, courseCode: string) =>
    request<ExamSummary[]>(`/api/professors/${professorId}/courses/${courseCode}/exams`),
  getProfessorExamDetail: (professorId: string, courseCode: string, examId: number) =>
    request<ProfessorExamDetail>(`/api/professors/${professorId}/courses/${courseCode}/exams/${examId}`),
  createProfessorExam: (professorId: string, courseCode: string, payload: ProfessorExamCreatePayload) =>
    request<ProfessorExamDetail>(`/api/professors/${professorId}/courses/${courseCode}/exams`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProfessorExam: (professorId: string, courseCode: string, examId: number, payload: ProfessorExamCreatePayload) =>
    request<ProfessorExamDetail>(`/api/professors/${professorId}/courses/${courseCode}/exams/${examId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProfessorExam: (professorId: string, courseCode: string, examId: number) =>
    request<void>(`/api/professors/${professorId}/courses/${courseCode}/exams/${examId}`, {
      method: 'DELETE',
    }),
  publishProfessorExam: (professorId: string, courseCode: string, examId: number) =>
    request<ProfessorExamDetail>(`/api/professors/${professorId}/courses/${courseCode}/exams/${examId}/publish`, {
      method: 'POST',
    }),
  closeProfessorExam: (professorId: string, courseCode: string, examId: number) =>
    request<ProfessorExamDetail>(`/api/professors/${professorId}/courses/${courseCode}/exams/${examId}/close`, {
      method: 'POST',
    }),
  uploadProfessorExamQuestionAttachment: (
    professorId: string,
    courseCode: string,
    examId: number,
    questionId: number,
    files: File[],
  ) => {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }
    return request<ExamMediaAttachment[]>(
      `/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/exams/${pathSegment(examId)}/questions/${pathSegment(questionId)}/attachments`,
      {
        method: 'POST',
        body: formData,
      },
    )
  },
  buildStudentExamQuestionAttachmentUrl: (
    studentId: string,
    courseCode: string,
    examId: number,
    questionId: number,
    attachmentId: number,
  ) =>
    buildApiUrl(
      `/api/students/${pathSegment(studentId)}/courses/${pathSegment(courseCode)}/exams/${pathSegment(examId)}/questions/${pathSegment(questionId)}/attachments/${pathSegment(attachmentId)}`,
    ),
  buildProfessorExamQuestionAttachmentUrl: (
    professorId: string,
    courseCode: string,
    examId: number,
    questionId: number,
    attachmentId: number,
  ) =>
    buildApiUrl(
      `/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/exams/${pathSegment(examId)}/questions/${pathSegment(questionId)}/attachments/${pathSegment(attachmentId)}`,
    ),
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
  createNoticeWithAttachments: (
    professorId: string,
    payload: { title: string; body: string; course_code?: string | null; files?: File[] },
  ) =>
    request<Notice>(`/api/professors/${pathSegment(professorId)}/notices`, {
      method: 'POST',
      body: noticeFormData(payload),
    }),
  buildNoticeAttachmentUrl: (loginId: string, noticeId: number, attachmentId: number) =>
    buildApiUrl(`/api/notices/${pathSegment(loginId)}/${pathSegment(noticeId)}/attachments/${pathSegment(attachmentId)}`),
  listUsers: () => request<UserSummary[]>('/api/admin/users'),
  listClassrooms: () => request<Classroom[]>('/api/admin/classrooms'),
  listClassroomNetworks: () => request<ClassroomNetwork[]>('/api/admin/classroom-networks'),
  getAdminPresenceSnapshot: (classroomCode: string, options?: { refresh?: boolean; source?: 'auto' | 'demo' }) => {
    const params = new URLSearchParams()
    if (options?.refresh) params.set('refresh', 'true')
    if (options?.source && options.source !== 'auto') params.set('source', options.source)
    const query = params.toString()
    return request<AdminPresenceSnapshot>(
      `/api/admin/presence/classrooms/${classroomCode}/snapshot${query ? `?${query}` : ''}`,
    )
  },
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
  createProfessorAttendanceCsvExport: (professorId: string, courseCode: string) =>
    request<ReportExport>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/attendance/report-exports`, {
      method: 'POST',
      body: JSON.stringify({ export_type: 'attendance_csv' }),
    }),
  listProfessorAttendanceReportExports: (professorId: string, courseCode: string) =>
    request<ReportExport[]>(`/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/attendance/report-exports`),
  buildProfessorAttendanceReportExportUrl: (professorId: string, courseCode: string, exportId: number) =>
    buildApiUrl(
      `/api/professors/${pathSegment(professorId)}/courses/${pathSegment(courseCode)}/attendance/report-exports/${pathSegment(exportId)}/download`,
    ),
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
