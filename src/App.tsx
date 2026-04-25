import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ApiRequestError,
  buildAttendanceWebSocketUrl,
  type AttendanceHistory,
  type ExamSummary,
  type ProfessorAttendanceStudentStats,
  type ProfessorExamCreatePayload,
  type ProfessorExamDetail,
  type AttendanceSlot,
  type AttendanceTimeline,
  type AttendanceSessionRoster,
  type StudentExamDetail,
  type StudentExamQuestion,
  type StudentExamSummary,
  type StudentAttendanceSemesterMatrix,
  type AdminPresenceOverlayRequest,
  type AdminPresenceSnapshot,
  type AdminPresenceStation,
  api,
  formatJson,
  setAuthFailureHandler,
  type Classroom,
  type ClassroomNetwork,
  type Course,
  type Device,
  type EligibilityResponse,
  type LoginUser,
  type Notice,
  type UserSummary,
} from './api'
import {
  buildAppPath,
  parseAppRoute,
  type AppRoute,
  type AttendancePage,
  type CourseSection,
} from './router'

type AppView = 'dashboard' | 'profile' | 'course' | 'notice'
type AdminTab = 'users' | 'networks' | 'demo'

type LearningItem = {
  id: string
  course_code: string
  kind: 'material' | 'video'
  title: string
  description: string
  week_label: string
  format_label: string
  uploaded_at: string
  author_name: string
  duration_label?: string
}

type Metric = {
  label: string
  value: number | string
  tone?: 'accent' | 'neutral'
}

type ProfessorExamDraftQuestion = {
  prompt: string
  optionTexts: string[]
  correctOptionOrder: number
  points: string
}

type ProfessorExamDraft = {
  examId: number | null
  title: string
  description: string
  examType: ExamSummary['exam_type']
  startsAt: string
  endsAt: string
  durationMinutes: string
  maxAttempts: string
  lateEntryAllowed: boolean
  autoSubmitEnabled: boolean
  questions: ProfessorExamDraftQuestion[]
}

const ROLE_LABEL: Record<LoginUser['role'], string> = {
  student: '학생',
  professor: '교수',
  admin: '관리자',
}

const HEALTH_LABEL: Record<'checking' | 'online' | 'offline', string> = {
  checking: '점검 중',
  online: '정상',
  offline: '오프라인',
}

const LEARNING_KIND_LABEL: Record<LearningItem['kind'], string> = {
  material: '자료',
  video: '영상',
}

const DEMO_DEVICE_MAC = '52:54:00:12:34:56'

const EXAM_TYPE_LABEL: Record<ExamSummary['exam_type'], string> = {
  quiz: '퀴즈',
  midterm: '중간고사',
  final: '기말고사',
  practice: '연습 시험',
  custom: '시험',
}

const EXAM_STATUS_LABEL: Record<ExamSummary['status'], string> = {
  draft: '초안',
  published: '게시 예정',
  open: '진행 중',
  closed: '종료',
  archived: '보관',
}

function getStudentExamStatusMeta(exam: StudentExamSummary) {
  const availabilityCode = exam.availability?.code
  const attemptStatus = exam.attempt?.status

  if (exam.status === 'closed' || availabilityCode === 'closed') {
    return { label: '종료', tone: 'closed' as const }
  }

  if (attemptStatus && ['submitted', 'auto_submitted', 'graded'].includes(attemptStatus)) {
    return { label: '응시 완료', tone: 'completed' as const }
  }

  if (attemptStatus === 'in_progress' || availabilityCode === 'in_progress') {
    return { label: '응시 중', tone: 'live' as const }
  }

  if (availabilityCode === 'available' || exam.status === 'open') {
    return { label: '응시 가능', tone: 'live' as const }
  }

  if (availabilityCode === 'upcoming' || exam.status === 'published') {
    return { label: '공개 예정', tone: 'upcoming' as const }
  }

  if (availabilityCode === 'late_entry_blocked') {
    return { label: '응시 불가', tone: 'blocked' as const }
  }

  if (exam.status === 'draft') {
    return { label: '초안', tone: 'draft' as const }
  }

  return { label: EXAM_STATUS_LABEL[exam.status], tone: 'upcoming' as const }
}

function getProfessorExamStatusMeta(exam: ExamSummary) {
  const now = Date.now()
  const startsAt = new Date(exam.starts_at).getTime()
  const endsAt = new Date(exam.ends_at).getTime()

  if (exam.status === 'closed' || (!Number.isNaN(endsAt) && now >= endsAt)) {
    return { label: '종료', tone: 'closed' as const }
  }

  if (
    (exam.status === 'published' || exam.status === 'open') &&
    !Number.isNaN(startsAt) &&
    !Number.isNaN(endsAt) &&
    now >= startsAt &&
    now < endsAt
  ) {
    return { label: '진행 중', tone: 'live' as const }
  }

  if (exam.status === 'published') {
    return { label: '게시 예정', tone: 'upcoming' as const }
  }

  if (exam.status === 'draft') {
    return { label: '초안', tone: 'draft' as const }
  }

  return { label: EXAM_STATUS_LABEL[exam.status], tone: exam.status === 'open' ? 'live' as const : 'upcoming' as const }
}

function getExamSubmissionStatusMeta(status: string) {
  switch (status) {
    case 'in_progress':
      return { label: '응시 중', tone: 'live' as const }
    case 'submitted':
      return { label: '제출 완료', tone: 'completed' as const }
    case 'auto_submitted':
      return { label: '자동 제출', tone: 'completed' as const }
    case 'graded':
      return { label: '채점 완료', tone: 'completed' as const }
    case 'not_started':
      return { label: '응시 전', tone: 'draft' as const }
    default:
      return { label: status, tone: 'upcoming' as const }
  }
}

function getStudentAttemptDurationMinutes(exam: StudentExamSummary | StudentExamDetail) {
  const startedAt = exam.attempt?.started_at ? new Date(exam.attempt.started_at).getTime() : Number.NaN
  const expiresAt = exam.attempt?.expires_at ? new Date(exam.attempt.expires_at).getTime() : Number.NaN
  if (Number.isNaN(startedAt) || Number.isNaN(expiresAt) || expiresAt <= startedAt) {
    return null
  }
  return Math.ceil((expiresAt - startedAt) / 60000)
}

function getStudentExamDurationMeta(exam: StudentExamSummary | StudentExamDetail) {
  const actualMinutes = getStudentAttemptDurationMinutes(exam)
  if (actualMinutes != null && actualMinutes !== exam.duration_minutes) {
    return {
      label: '실제 응시 시간',
      value: `${actualMinutes}분`,
    }
  }

  return {
    label: '응시 시간',
    value: `${exam.duration_minutes}분`,
  }
}

function getEligibilityReasonLabel(reasonCode?: string | null) {
  switch (reasonCode) {
    case 'OK':
      return '현재 조건에서 출석 또는 시험 확인이 가능합니다.'
    case 'OUTSIDE_CLASS_WINDOW':
      return '현재 수업 시간이 아니어서 확인이 제한되었습니다.'
    case 'DEVICE_NOT_REGISTERED':
      return '등록된 활성 단말이 없어 시험 또는 출석 확인을 진행할 수 없습니다.'
    case 'DEVICE_NOT_PRESENT':
      return '등록 단말이 현재 강의실 네트워크에서 관측되지 않았습니다.'
    default:
      return '현재 조건으로는 확인이 제한되었습니다.'
  }
}

function createLearningSeed(courses: Course[], authorName?: string) {
  return courses.flatMap((course, index) => {
    const weekLabel = `${(index % 4) + 1}주차`
    return [
      {
        id: `${course.course_code}-material`,
        course_code: course.course_code,
        kind: 'material' as const,
        title: `${weekLabel} 강의자료`,
        description: `${course.title} 수업 핵심 개념과 실습 예시를 정리한 자료입니다.`,
        week_label: weekLabel,
        format_label: 'PDF',
        uploaded_at: `2026-03-${String((index % 9) + 11).padStart(2, '0')}`,
        author_name: course.professor_name ?? authorName ?? '담당 교수',
      },
      {
        id: `${course.course_code}-video`,
        course_code: course.course_code,
        kind: 'video' as const,
        title: `${weekLabel} 강의영상`,
        description: `${course.title} 핵심 내용을 다시 확인할 수 있는 영상입니다.`,
        week_label: weekLabel,
        format_label: 'LINK',
        duration_label: `${20 + (index % 3) * 10}분`,
        uploaded_at: `2026-03-${String((index % 9) + 12).padStart(2, '0')}`,
        author_name: course.professor_name ?? authorName ?? '담당 교수',
      },
    ]
  })
}

function formatBoardDate(value?: string | null) {
  if (!value) return '-'

  const directMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (directMatch) {
    return `${directMatch[1].slice(2)}-${directMatch[2]}-${directMatch[3]}`
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const year = String(parsed.getFullYear()).slice(2)
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const year = String(parsed.getFullYear()).slice(2)
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  const seconds = String(parsed.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatExamDateTime(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const year = String(parsed.getFullYear())
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatExamWindow(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt || !endsAt) return '-'
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startsAt} ~ ${endsAt}`
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()

  const startText = formatExamDateTime(startsAt)
  if (!sameDay) {
    return `${startText} ~ ${formatExamDateTime(endsAt)}`
  }

  const endHours = String(end.getHours()).padStart(2, '0')
  const endMinutes = String(end.getMinutes()).padStart(2, '0')
  return `${startText} ~ ${endHours}:${endMinutes}`
}

function toDateTimeLocalInputValue(value?: string | Date | null) {
  if (!value) return ''
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function toApiDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toISOString()
}

function createDefaultProfessorExamQuestion(): ProfessorExamDraftQuestion {
  return {
    prompt: '',
    optionTexts: ['', '', '', ''],
    correctOptionOrder: 1,
    points: '5',
  }
}

function getExamStartErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.code === 'PRESENCE_INELIGIBLE') {
    const reasonCode =
      typeof error.details?.reason_code === 'string'
        ? error.details.reason_code
        : typeof error.details?.reasonCode === 'string'
          ? error.details.reasonCode
          : null
    if (reasonCode === 'DEVICE_NOT_REGISTERED') {
      return '등록된 단말이 아닙니다. 단말기기를 등록해주세요.'
    }
    return `시험 시작 조건을 충족하지 못했습니다. ${getEligibilityReasonLabel(reasonCode)}`
  }

  return error instanceof Error ? error.message : '시험 응시를 시작하지 못했습니다.'
}

function createDefaultProfessorExamDraft(): ProfessorExamDraft {
  const startsAt = new Date()
  startsAt.setMinutes(Math.ceil(startsAt.getMinutes() / 10) * 10, 0, 0)
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)

  return {
    examId: null,
    title: '',
    description: '',
    examType: 'midterm',
    startsAt: toDateTimeLocalInputValue(startsAt),
    endsAt: toDateTimeLocalInputValue(endsAt),
    durationMinutes: '60',
    maxAttempts: '1',
    lateEntryAllowed: true,
    autoSubmitEnabled: true,
    questions: [createDefaultProfessorExamQuestion()],
  }
}

function normalizeProfessorEditableExamType(examType: ExamSummary['exam_type']): ProfessorExamDraft['examType'] {
  return examType === 'final' ? 'final' : 'midterm'
}

function toProfessorExamPayload(draft: ProfessorExamDraft): ProfessorExamCreatePayload {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    exam_type: draft.examType,
    starts_at: toApiDateTime(draft.startsAt),
    ends_at: toApiDateTime(draft.endsAt),
    duration_minutes: Number(draft.durationMinutes) || 60,
    requires_presence: true,
    late_entry_allowed: draft.lateEntryAllowed,
    auto_submit_enabled: draft.autoSubmitEnabled,
    shuffle_questions: false,
    shuffle_options: false,
    max_attempts: Math.max(1, Number(draft.maxAttempts) || 1),
    questions: draft.questions.map((question) => ({
        question_type: 'multiple_choice',
        prompt: question.prompt.trim(),
        points: Math.max(1, Number(question.points) || 1),
        explanation: null,
        is_required: true,
        options: question.optionTexts.map((optionText, index) => ({
          option_text: optionText.trim(),
          is_correct: index + 1 === question.correctOptionOrder,
        })),
      })),
  }
}

function loadProfessorExamIntoDraft(detail: ProfessorExamDetail): ProfessorExamDraft {
  return {
    examId: detail.id,
    title: detail.title,
    description: detail.description ?? '',
    examType: normalizeProfessorEditableExamType(detail.exam_type),
    startsAt: toDateTimeLocalInputValue(detail.starts_at),
    endsAt: toDateTimeLocalInputValue(detail.ends_at),
    durationMinutes: String(detail.duration_minutes),
    maxAttempts: String(detail.max_attempts),
    lateEntryAllowed: detail.late_entry_allowed ?? false,
    autoSubmitEnabled: detail.auto_submit_enabled ?? false,
    questions:
      detail.questions.length > 0
        ? detail.questions.map((question) => ({
            prompt: question.prompt ?? '',
            optionTexts: Array.from({ length: 4 }, (_, index) => question.options[index]?.option_text ?? ''),
            correctOptionOrder: question.options.find((option) => option.is_correct)?.option_order ?? 1,
            points: String(question.points ?? 5),
          }))
        : [createDefaultProfessorExamQuestion()],
  }
}

function SectionCard({
  title,
  action,
  children,
  compact = false,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  compact?: boolean
}) {
  return (
    <section className={`section-card${compact ? ' section-card--compact' : ''}`}>
      <header className="section-head">
        <h3>{title}</h3>
        {action ? <div className="section-head-action">{action}</div> : null}
      </header>
      {children}
    </section>
  )
}

function defaultRouteForUser(user: LoginUser | null): AppRoute {
  return user ? { kind: 'dashboard' } : { kind: 'login' }
}

function safeAttendanceRoute(
  courseCode: string,
  attendancePage: AttendancePage,
  options?: { sessionId?: number | null; projectionKey?: string | null },
): AppRoute {
  return {
    kind: 'course',
    courseCode,
    section: 'attendance',
    attendancePage,
    sessionId: options?.sessionId ?? undefined,
    projectionKey: options?.projectionKey ?? undefined,
  }
}

function App() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [currentUser, setCurrentUser] = useState<LoginUser | null>(null)
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(window.location.pathname))
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
  const [noticeReturnRoute, setNoticeReturnRoute] = useState<AppRoute>({ kind: 'dashboard' })
  const [adminTab, setAdminTab] = useState<AdminTab>('users')
  const [authReady, setAuthReady] = useState(false)

  const [studentId, setStudentId] = useState('20201234')
  const [label, setLabel] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const [learningItems, setLearningItems] = useState<LearningItem[]>([])
  const [selectedLearningItem, setSelectedLearningItem] = useState<LearningItem | null>(null)
  const [learningFilter, setLearningFilter] = useState<'all' | LearningItem['kind']>('all')
  const [learningKind, setLearningKind] = useState<LearningItem['kind']>('material')
  const [learningTitle, setLearningTitle] = useState('')
  const [learningDescription, setLearningDescription] = useState('')
  const [learningWeek, setLearningWeek] = useState('1주차')
  const [learningFormat, setLearningFormat] = useState('PDF')
  const [learningDuration, setLearningDuration] = useState('20분')

  const [devices, setDevices] = useState<Device[]>([])
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [adminUsers, setAdminUsers] = useState<UserSummary[]>([])
  const [adminClassrooms, setAdminClassrooms] = useState<Classroom[]>([])
  const [adminNetworks, setAdminNetworks] = useState<ClassroomNetwork[]>([])
  const [adminPresenceSnapshots, setAdminPresenceSnapshots] = useState<Record<string, AdminPresenceSnapshot>>({})
  const [attendanceTimeline, setAttendanceTimeline] = useState<AttendanceTimeline | null>(null)
  const [attendanceRoster, setAttendanceRoster] = useState<AttendanceSessionRoster | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistory | null>(null)
  const [attendanceStudentStats, setAttendanceStudentStats] = useState<ProfessorAttendanceStudentStats | null>(null)
  const [attendanceSemesterMatrix, setAttendanceSemesterMatrix] = useState<StudentAttendanceSemesterMatrix | null>(null)
  const [studentAttendanceSessions, setStudentAttendanceSessions] = useState<
    Awaited<ReturnType<typeof api.listStudentActiveAttendanceSessions>>['sessions']
  >([])
  const [studentExams, setStudentExams] = useState<StudentExamSummary[]>([])
  const [studentExamDetail, setStudentExamDetail] = useState<StudentExamDetail | null>(null)
  const [studentExamQuestionIndex, setStudentExamQuestionIndex] = useState(0)
  const [studentExamSubmitWarning, setStudentExamSubmitWarning] = useState<number[]>([])
  const [studentExamAutoSubmittingId, setStudentExamAutoSubmittingId] = useState<number | null>(null)
  const [professorExams, setProfessorExams] = useState<ExamSummary[]>([])
  const [professorExamDetail, setProfessorExamDetail] = useState<ProfessorExamDetail | null>(null)
  const [professorExamDraft, setProfessorExamDraft] = useState<ProfessorExamDraft>(() => createDefaultProfessorExamDraft())
  const [examLoading, setExamLoading] = useState(false)
  const [examBusyKey, setExamBusyKey] = useState<string | null>(null)
  const [examMessage, setExamMessage] = useState<string | null>(null)
  const [examNow, setExamNow] = useState(Date.now())
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null)
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false)
  const [attendanceModalAnchorSlot, setAttendanceModalAnchorSlot] = useState<AttendanceSlot | null>(null)
  const [selectedAttendanceMode, setSelectedAttendanceMode] = useState<'manual' | 'smart' | 'canceled'>('manual')
  const [selectedBatchProjectionKeys, setSelectedBatchProjectionKeys] = useState<string[]>([])
  const [attendanceNow, setAttendanceNow] = useState(Date.now())
  const [showProfessorStudentStats, setShowProfessorStudentStats] = useState(false)
  const [rosterDrafts, setRosterDrafts] = useState<
    Record<string, { status: 'present' | 'absent' | 'late' | 'official' | 'sick'; reason: string }>
  >({})
  const [studentSubmittingSessionId, setStudentSubmittingSessionId] = useState<number | null>(null)
  const [presenceControlClassroom, setPresenceControlClassroom] = useState('B101')
  const [presenceControlDeviceMac, setPresenceControlDeviceMac] = useState(DEMO_DEVICE_MAC)
  const [presenceControlApId, setPresenceControlApId] = useState('phy3-ap0')
  const [presenceControlAssociated, setPresenceControlAssociated] = useState(true)
  const [presenceControlSignalDbm, setPresenceControlSignalDbm] = useState(-47)
  const [presenceThresholdDbm, setPresenceThresholdDbm] = useState(-65)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking')
  const [isPending, startTransition] = useTransition()

  const view: AppView =
    route.kind === 'profile' ? 'profile' : route.kind === 'notice' ? 'notice' : route.kind === 'course' ? 'course' : 'dashboard'
  const courseSection: CourseSection = route.kind === 'course' ? route.section : 'overview'
  const routeAttendancePage: AttendancePage = route.kind === 'course' && route.section === 'attendance'
    ? route.attendancePage ?? 'timeline'
    : 'timeline'
  const routeProjectionKey = route.kind === 'course' && route.section === 'attendance' ? route.projectionKey ?? null : null
  const routeSessionId = route.kind === 'course' && route.section === 'attendance' ? route.sessionId ?? null : null
  const routeExamId = route.kind === 'course' && route.section === 'exams' ? route.examId ?? null : null
  const inStudentExamMode = route.kind === 'course' && route.section === 'exams' && route.examMode === 'take' && currentUser?.role === 'student'

  const isStudent = currentUser?.role === 'student'
  const isProfessor = currentUser?.role === 'professor'
  const isAdmin = currentUser?.role === 'admin'
  const selectedAdminSnapshot = adminPresenceSnapshots[presenceControlClassroom]
  const selectedAdminNetwork = useMemo(
    () =>
      selectedAdminSnapshot?.classroomNetworks.find((network) => network.ap_id === presenceControlApId) ?? null,
    [presenceControlApId, selectedAdminSnapshot],
  )
  const selectedAttendanceSlot = useMemo(
    () => findAttendanceSlot(attendanceTimeline, routeProjectionKey, routeSessionId),
    [attendanceTimeline, routeProjectionKey, routeSessionId],
  )

  useEffect(() => {
    let cancelled = false

    api
      .health()
      .then(() => {
        if (!cancelled) setHealth('online')
      })
      .catch(() => {
        if (!cancelled) setHealth('offline')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const navigate = useCallback((nextRoute: AppRoute, options?: { replace?: boolean }) => {
    const nextPath = buildAppPath(nextRoute)
    if (options?.replace) {
      window.history.replaceState(null, '', nextPath)
    } else if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath)
    }
    setRoute(nextRoute)
  }, [])

  const navigateToDefault = useCallback((user: LoginUser | null, options?: { replace?: boolean }) => {
    navigate(defaultRouteForUser(user), options)
  }, [navigate])

  useEffect(() => {
    const handlePopState = () => setRoute(parseAppRoute(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleSessionExpired = useCallback(() => {
    setCurrentUser(null)
    resetRoleData()
    setError('세션이 만료되어 다시 로그인해야 합니다.')
    navigate({ kind: 'login' }, { replace: true })
  }, [navigate])

  useEffect(() => {
    setAuthFailureHandler(handleSessionExpired)
    return () => setAuthFailureHandler(null)
  }, [handleSessionExpired])

  const refreshDevices = useCallback(async (nextStudentId: string) => {
    try {
      setError(null)
      const nextDevices = await api.listDevices(nextStudentId)
      setDevices(nextDevices)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : '등록 단말 목록을 불러오지 못했습니다.',
      )
    }
  }, [])

  const hydrateStudent = useCallback(async (studentLoginId: string) => {
    setStudentId(studentLoginId)
    const [nextCourses, nextNotices] = await Promise.all([
      api.listStudentCourses(studentLoginId),
      api.listNotices(studentLoginId),
      refreshDevices(studentLoginId),
    ])
    setCourses(nextCourses)
    setNotices(nextNotices)
    setLearningItems(createLearningSeed(nextCourses))
    setSelectedLearningItem(null)
  }, [refreshDevices])

  const hydrateProfessor = useCallback(async (professorLoginId: string, professorName?: string) => {
    const [nextCourses, nextNotices] = await Promise.all([
      api.listProfessorCourses(professorLoginId),
      api.listNotices(professorLoginId),
    ])
    setCourses(nextCourses)
    setNotices(nextNotices)
    setLearningItems(createLearningSeed(nextCourses, professorName))
    setSelectedLearningItem(null)
  }, [])

  const hydrateAdmin = useCallback(async () => {
    const [users, classrooms, networks] = await Promise.all([
      api.listUsers(),
      api.listClassrooms(),
      api.listClassroomNetworks(),
    ])
    const presenceEntries = await Promise.all(
      classrooms.map(async (classroom) => {
        try {
          const snapshot = await api.getAdminPresenceSnapshot(classroom.classroom_code)
          return [classroom.classroom_code, snapshot] as const
        } catch {
          return null
        }
      }),
    )
    setAdminUsers(users)
    setAdminClassrooms(classrooms)
    setAdminNetworks(networks)
    const nextSnapshots = Object.fromEntries(
      presenceEntries.filter((entry): entry is readonly [string, AdminPresenceSnapshot] => Boolean(entry)),
    )
    setAdminPresenceSnapshots(nextSnapshots)
    const initialSnapshot = nextSnapshots[presenceControlClassroom]
    const initialDevice =
      initialSnapshot?.deviceOptions.find((option) => option.macAddress === DEMO_DEVICE_MAC) ??
      initialSnapshot?.deviceOptions[0]
    if (initialDevice) {
      setPresenceControlDeviceMac(initialDevice.macAddress)
    }
    const initialAp = initialSnapshot?.aps[0]
    if (initialAp) {
      setPresenceControlApId(initialAp.apId)
      const matchingNetwork = nextSnapshots[presenceControlClassroom]?.classroomNetworks.find(
        (network) => network.ap_id === initialAp.apId,
      )
      setPresenceThresholdDbm(matchingNetwork?.signal_threshold_dbm ?? -65)
      const initialStation = initialAp.stations.find((station) => station.macAddress === (initialDevice?.macAddress ?? DEMO_DEVICE_MAC))
      if (initialStation) {
        setPresenceControlAssociated(Boolean(initialStation.associated))
        setPresenceControlSignalDbm(initialStation.signalDbm ?? -47)
      }
    }
  }, [presenceControlClassroom])

  useEffect(() => {
    let cancelled = false

    async function bootstrapSession() {
      try {
        const restored = await api.bootstrapSession()
        if (cancelled) return
        setCurrentUser(restored.user)
        resetRoleData()

        if (restored.user.role === 'student') {
          await hydrateStudent(restored.user.login_id)
        } else if (restored.user.role === 'professor') {
          await hydrateProfessor(restored.user.login_id, restored.user.name)
        } else {
          await hydrateAdmin()
        }

        if (parseAppRoute(window.location.pathname).kind === 'login') {
          navigateToDefault(restored.user, { replace: true })
        }
      } catch {
        if (cancelled) return
        setCurrentUser(null)
        resetRoleData()
        if (parseAppRoute(window.location.pathname).kind !== 'login') {
          navigate({ kind: 'login' }, { replace: true })
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true)
        }
      }
    }

    void bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [hydrateAdmin, hydrateProfessor, hydrateStudent, navigate, navigateToDefault])

  async function refreshAdminPresenceSnapshot(classroomCode: string) {
    const snapshot = await api.getAdminPresenceSnapshot(classroomCode)
    setAdminPresenceSnapshots((current) => ({
      ...current,
      [classroomCode]: snapshot,
    }))
    const matchingDevice =
      snapshot.deviceOptions.find((option) => option.macAddress === presenceControlDeviceMac) ?? snapshot.deviceOptions[0]
    if (matchingDevice) {
      setPresenceControlDeviceMac(matchingDevice.macAddress)
    }
    const matchingNetwork = snapshot.classroomNetworks.find((network) => network.ap_id === presenceControlApId)
    setPresenceThresholdDbm(matchingNetwork?.signal_threshold_dbm ?? -65)
    return snapshot
  }

  async function handleApplyPresenceControl(event: FormEvent) {
    event.preventDefault()
    try {
      setError(null)
      const payload: AdminPresenceOverlayRequest = {
        stations: [
          {
            macAddress: presenceControlDeviceMac.trim(),
            apId: presenceControlApId.trim() || null,
            associated: presenceControlAssociated,
            signalDbm: presenceControlSignalDbm,
          },
        ],
      }
      if (selectedAdminNetwork) {
        await api.updateClassroomNetworkThreshold(selectedAdminNetwork.id, {
          signal_threshold_dbm: presenceThresholdDbm,
        })
      }
      await api.applyAdminPresenceOverlay(presenceControlClassroom, payload)
      await refreshAdminPresenceSnapshot(presenceControlClassroom)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : '재실 시연 제어를 저장하지 못했습니다.',
      )
    }
  }

  async function handleResetPresenceControl() {
    try {
      setError(null)
      await api.resetAdminPresenceOverlay(presenceControlClassroom)
      await refreshAdminPresenceSnapshot(presenceControlClassroom)
      setPresenceControlDeviceMac(DEMO_DEVICE_MAC)
      setPresenceControlApId('phy3-ap0')
      setPresenceControlAssociated(true)
      setPresenceControlSignalDbm(-47)
      setPresenceThresholdDbm(-65)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : '재실 시연 제어를 초기화하지 못했습니다.',
      )
    }
  }

  function resetRoleData() {
    setDevices([])
    setEligibility(null)
    setCourses([])
    setNotices([])
    setAdminUsers([])
    setAdminClassrooms([])
    setAdminNetworks([])
    setAdminPresenceSnapshots({})
    setLearningItems([])
    setSelectedLearningItem(null)
    setSelectedCourse(null)
    setSelectedNotice(null)
    setNoticeReturnRoute({ kind: 'dashboard' })
    setAttendanceTimeline(null)
    setAttendanceRoster(null)
    setAttendanceHistory(null)
    setAttendanceStudentStats(null)
    setAttendanceSemesterMatrix(null)
    setStudentAttendanceSessions([])
    setAttendanceModalOpen(false)
    setAttendanceModalAnchorSlot(null)
    setSelectedBatchProjectionKeys([])
    setStudentSubmittingSessionId(null)
    setAttendanceMessage(null)
    setRosterDrafts({})
    setShowProfessorStudentStats(false)
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    try {
      setError(null)
      const result = await api.login({ login_id: loginId, password })
      setCurrentUser(result.user)
      resetRoleData()

      if (result.user.role === 'student') {
        await hydrateStudent(result.user.login_id)
      } else if (result.user.role === 'professor') {
        await hydrateProfessor(result.user.login_id, result.user.name)
      } else {
        await hydrateAdmin()
      }

      navigateToDefault(result.user, { replace: true })
    } catch (caughtError) {
      setCurrentUser(null)
      resetRoleData()
      setError(caughtError instanceof Error ? caughtError.message : '로그인에 실패했습니다.')
    }
  }

  async function handleLogout() {
    try {
      await api.logout()
    } catch {
      // ignore logout cleanup failures and continue local sign-out
    } finally {
      setCurrentUser(null)
      resetRoleData()
      setError(null)
      navigate({ kind: 'login' }, { replace: true })
    }
  }

  async function handleRegisterDevice(event: FormEvent) {
    event.preventDefault()
    try {
      setError(null)
      await api.createDevice(studentId, { label, mac_address: macAddress })
      setLabel('')
      setMacAddress('')
      await refreshDevices(studentId)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '기기 등록에 실패했습니다.')
    }
  }

  async function handleDeleteDevice(deviceId: number) {
    try {
      setError(null)
      await api.deleteDevice(studentId, deviceId)
      await refreshDevices(studentId)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '기기 삭제에 실패했습니다.')
    }
  }

  function handleCheckEligibility(event: FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        setError(null)
        if (!selectedCourse) {
          setError('현재 강의를 먼저 선택해주세요.')
          return
        }
        const result = await api.checkEligibility({
          student_id: studentId,
          course_code: selectedCourse.course_code,
        })
        setEligibility(result)
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : '재실 확인에 실패했습니다.')
      }
    })
  }

  async function handleCreateNotice(event: FormEvent) {
    event.preventDefault()
    if (!currentUser || currentUser.role !== 'professor') return

    try {
      setError(null)
      await api.createNotice(currentUser.login_id, {
        title: noticeTitle,
        body: noticeBody,
        course_code: selectedCourse?.course_code,
      })
      setNoticeTitle('')
      setNoticeBody('')
      setNotices(await api.listNotices(currentUser.login_id))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '공지 등록에 실패했습니다.')
    }
  }

  function openCourse(course: Course) {
    setSelectedCourse(course)
    setEligibility(null)
    setStudentExams([])
    setStudentExamDetail(null)
    setStudentExamSubmitWarning([])
    setStudentExamAutoSubmittingId(null)
    setProfessorExams([])
    setProfessorExamDetail(null)
    setProfessorExamDraft(createDefaultProfessorExamDraft())
    setExamMessage(null)
    setStudentExamQuestionIndex(0)
    setStudentExamSubmitWarning([])
    setStudentExamAutoSubmittingId(null)
    setAttendanceTimeline(null)
    setAttendanceRoster(null)
    setAttendanceHistory(null)
    setAttendanceStudentStats(null)
    setAttendanceSemesterMatrix(null)
    setStudentAttendanceSessions([])
    setAttendanceModalOpen(false)
    setAttendanceModalAnchorSlot(null)
    setSelectedBatchProjectionKeys([])
    setAttendanceMessage(null)
    setShowProfessorStudentStats(false)
    setSelectedLearningItem(null)
    setLearningFilter('all')
    navigate({
      kind: 'course',
      courseCode: course.course_code,
      section: 'overview',
    })
  }

  function findAttendanceSlot(
    nextTimeline: AttendanceTimeline | null,
    projectionKey: string | null,
    sessionId?: number | null,
  ) {
    if (!nextTimeline) return null
    if (sessionId != null) {
      for (const week of nextTimeline.weeks) {
        const slot = week.slots.find((item) => item.session_id === sessionId)
        if (slot) return slot
      }
    }
    if (!projectionKey) return null
    for (const week of nextTimeline.weeks) {
      const slot = week.slots.find((item) => item.projection_key === projectionKey)
      if (slot) return slot
    }
    return null
  }

  function getBundleSlots(
    nextTimeline: AttendanceTimeline | null,
    sessionId: number | null,
    fallbackProjectionKey?: string | null,
  ) {
    if (!nextTimeline) return []
    if (sessionId != null) {
      return nextTimeline.weeks
        .flatMap((week) => week.slots)
        .filter((slot) => slot.session_id === sessionId)
    }
    if (!fallbackProjectionKey) return []
    const slot = findAttendanceSlot(nextTimeline, fallbackProjectionKey, null)
    return slot ? [slot] : []
  }

  const refreshProfessorAttendance = useCallback(async (nextCourseCode = selectedCourse?.course_code) => {
    if (!currentUser || currentUser.role !== 'professor' || !nextCourseCode) return
    setAttendanceLoading(true)
    try {
      const [nextTimeline, nextStats] = await Promise.all([
        api.getProfessorAttendanceTimeline(currentUser.login_id, nextCourseCode),
        api.getProfessorAttendanceStudentStats(currentUser.login_id, nextCourseCode),
      ])
      setAttendanceTimeline(nextTimeline)
      setAttendanceStudentStats(nextStats)
      if (routeAttendancePage === 'timeline') {
        setAttendanceRoster(null)
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '출석 타임라인을 불러오지 못했습니다.')
    } finally {
      setAttendanceLoading(false)
    }
  }, [currentUser, routeAttendancePage, selectedCourse?.course_code])

  const refreshStudentAttendance = useCallback(async (nextCourseCode = selectedCourse?.course_code) => {
    if (!currentUser || currentUser.role !== 'student' || !nextCourseCode) return
    setAttendanceLoading(true)
    try {
      const [nextSessions, nextMatrix] = await Promise.all([
        api.listStudentActiveAttendanceSessions(currentUser.login_id, nextCourseCode),
        api.getStudentAttendanceSemesterMatrix(currentUser.login_id, nextCourseCode),
      ])
      setStudentAttendanceSessions(nextSessions.sessions)
      setAttendanceSemesterMatrix(nextMatrix)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '학생 출석 세션을 불러오지 못했습니다.')
    } finally {
      setAttendanceLoading(false)
    }
  }, [currentUser, selectedCourse?.course_code])

  function syncRosterDrafts(
    nextRoster: AttendanceSessionRoster,
    options?: { replaceExisting?: boolean },
  ) {
    setRosterDrafts((current) => {
      const nextDrafts = options?.replaceExisting ? {} : { ...current }
      nextRoster.students.forEach((student) => {
        if (!options?.replaceExisting && nextDrafts[student.student_id]) {
          return
        }
        nextDrafts[student.student_id] = {
          status: (student.final_status as 'present' | 'absent' | 'late' | 'official' | 'sick') ?? 'absent',
          reason: student.attendance_reason ?? '',
        }
      })
      return nextDrafts
    })
  }

  const loadAttendanceRoster = useCallback(async (sessionId: number, options?: { replaceDrafts?: boolean }) => {
    if (!currentUser || currentUser.role !== 'professor') return null
    try {
      const nextRoster = await api.getProfessorAttendanceRoster(currentUser.login_id, sessionId)
      setAttendanceRoster(nextRoster)
      syncRosterDrafts(nextRoster, { replaceExisting: options?.replaceDrafts })
      return nextRoster
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '출석 명단을 불러오지 못했습니다.')
      return null
    }
  }, [currentUser])

  const loadAttendanceSlotRoster = useCallback(async (projectionKey: string, options?: { replaceDrafts?: boolean }) => {
    if (!currentUser || currentUser.role !== 'professor' || !selectedCourse) return null
    try {
      const nextRoster = await api.getProfessorAttendanceSlotRoster(currentUser.login_id, selectedCourse.course_code, projectionKey)
      setAttendanceRoster(nextRoster)
      syncRosterDrafts(nextRoster, { replaceExisting: options?.replaceDrafts })
      return nextRoster
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '차시 출석 명단을 불러오지 못했습니다.')
      return null
    }
  }, [currentUser, selectedCourse])

  async function loadAttendanceHistory(studentIdValue: string) {
    if (!currentUser || currentUser.role !== 'professor' || !selectedCourse) return
    try {
      const nextHistory = await api.getProfessorAttendanceHistory(currentUser.login_id, selectedCourse.course_code, studentIdValue)
      setAttendanceHistory(nextHistory)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '출석 이력을 불러오지 못했습니다.')
    }
  }

  async function applyAttendanceBatch() {
    if (!currentUser || currentUser.role !== 'professor' || !selectedCourse || selectedBatchProjectionKeys.length === 0) {
      return
    }
    try {
      setAttendanceMessage(null)
      const result = await api.applyProfessorAttendanceBatch(currentUser.login_id, selectedCourse.course_code, {
        projection_keys: selectedBatchProjectionKeys,
        mode: selectedAttendanceMode,
      })
      const summary = result.results.map((item) => `${item.projection_key.split(':')[2]} ${item.code}`).join(', ')
      setAttendanceMessage(`출석 작업을 반영했습니다. ${summary}`)
      setSelectedBatchProjectionKeys([])
      setAttendanceModalOpen(false)
      setAttendanceModalAnchorSlot(null)
      await refreshProfessorAttendance(selectedCourse.course_code)
      const nextSessionId = result.changed_session_ids[0] ?? null
      const primaryProjectionKey = attendanceModalAnchorSlot?.projection_key ?? result.changed_projection_keys[0] ?? null
      if (selectedAttendanceMode === 'smart' && nextSessionId) {
        navigate(safeAttendanceRoute(selectedCourse.course_code, 'timer', { sessionId: nextSessionId }))
      } else if (selectedAttendanceMode === 'manual' && nextSessionId) {
        navigate(safeAttendanceRoute(selectedCourse.course_code, 'roster', { sessionId: nextSessionId }))
      } else if (selectedAttendanceMode === 'manual' && primaryProjectionKey) {
        navigate(safeAttendanceRoute(selectedCourse.course_code, 'roster', { projectionKey: primaryProjectionKey }))
      } else {
        navigate({
          kind: 'course',
          courseCode: selectedCourse.course_code,
          section: 'attendance',
          attendancePage: 'timeline',
        })
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '출석 세션을 적용하지 못했습니다.')
    }
  }

  async function closeAttendanceSession(sessionId: number) {
    if (!currentUser || currentUser.role !== 'professor') return
    try {
      await api.closeProfessorAttendanceSession(currentUser.login_id, sessionId)
      setAttendanceMessage('선택한 출석 세션을 종료했습니다.')
      setAttendanceRoster(null)
      setRosterDrafts({})
      await refreshProfessorAttendance(selectedCourse?.course_code)
      await loadAttendanceRoster(sessionId, { replaceDrafts: true })
      if (selectedCourse) {
        navigate(safeAttendanceRoute(selectedCourse.course_code, 'roster', { sessionId }), { replace: true })
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '출석 세션을 종료하지 못했습니다.')
    }
  }

  function handleAttendanceRowClick(slot: AttendanceSlot) {
    setAttendanceHistory(null)
    if (slot.session_id) {
      navigate(safeAttendanceRoute(slot.course_code, 'roster', { sessionId: slot.session_id }))
      return
    }
    navigate(safeAttendanceRoute(slot.course_code, 'roster', { projectionKey: slot.projection_key }))
  }

  function openAttendanceModal(slot: AttendanceSlot) {
    setAttendanceModalAnchorSlot(slot)
    setAttendanceModalOpen(true)
    setSelectedAttendanceMode(slot.slot_state === 'canceled' ? 'manual' : slot.session_mode === 'smart' ? 'smart' : 'manual')
    const sameDateSlots =
      attendanceTimeline?.weeks
        .flatMap((week) => week.slots)
        .filter((item) => item.session_date === slot.session_date)
        .map((item) => item.projection_key) ?? []
    setSelectedBatchProjectionKeys(sameDateSlots.includes(slot.projection_key) ? [slot.projection_key] : [])
  }

  function updateRosterDraft(studentIdValue: string, nextValue: Partial<{ status: 'present' | 'absent' | 'late' | 'official' | 'sick'; reason: string }>) {
    setRosterDrafts((current) => ({
      ...current,
      [studentIdValue]: {
        status: current[studentIdValue]?.status ?? 'absent',
        reason: current[studentIdValue]?.reason ?? '',
        ...nextValue,
      },
    }))
  }

  function toggleModalProjectionKey(projectionKey: string) {
    setSelectedBatchProjectionKeys((current) =>
      current.includes(projectionKey) ? current.filter((value) => value !== projectionKey) : [...current, projectionKey],
    )
  }

  async function submitRosterUpdate(studentIdValue: string) {
    if (!currentUser || currentUser.role !== 'professor' || !attendanceRoster) return
    if (!attendanceRoster.session.session_id) return
    const draft = rosterDrafts[studentIdValue]
    if (!draft) return
    try {
      await api.updateProfessorAttendanceRecord(currentUser.login_id, attendanceRoster.session.session_id, studentIdValue, {
        status: draft.status,
        reason: draft.reason,
      })
      setAttendanceMessage('학생 출석 상태를 저장했습니다.')
      await loadAttendanceRoster(attendanceRoster.session.session_id)
      await refreshProfessorAttendance()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '학생 출석 상태를 저장하지 못했습니다.')
    }
  }

  async function handleStudentCheckIn(sessionId: number) {
    if (!currentUser || currentUser.role !== 'student') return
    setStudentSubmittingSessionId(sessionId)
    try {
      const result = await api.studentAttendanceCheckIn(currentUser.login_id, sessionId)
      setAttendanceMessage(result.idempotent ? '이미 출석 처리된 세션입니다.' : '스마트 출석이 반영되었습니다.')
      await refreshStudentAttendance()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '스마트 출석에 실패했습니다.')
    } finally {
      setStudentSubmittingSessionId(null)
    }
  }

  useEffect(() => {
    if (courseSection !== 'attendance' || !selectedCourse || !currentUser) return
    if (currentUser.role === 'professor') {
      void refreshProfessorAttendance(selectedCourse.course_code)
    }
    if (currentUser.role === 'student') {
      void refreshStudentAttendance(selectedCourse.course_code)
    }
  }, [courseSection, currentUser, selectedCourse, refreshProfessorAttendance, refreshStudentAttendance])

  useEffect(() => {
    if (courseSection !== 'attendance') return
    const timer = window.setInterval(() => setAttendanceNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [courseSection])

  useEffect(() => {
    if (courseSection !== 'attendance' || !selectedCourse || !currentUser) return
    if (currentUser.role !== 'student') return
    const refresh = window.setInterval(() => {
      void refreshStudentAttendance(selectedCourse.course_code)
    }, 1000)
    return () => window.clearInterval(refresh)
  }, [courseSection, currentUser, refreshStudentAttendance, selectedCourse])

  useEffect(() => {
    if (courseSection !== 'attendance' || !selectedCourse || !currentUser) return
    const socket = new WebSocket(
      buildAttendanceWebSocketUrl(
        selectedCourse.course_code,
        currentUser.role === 'student' ? 'student' : 'professor',
      ),
    )
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { event_type?: string; changed_payload?: { data?: AttendanceTimeline | { sessions?: typeof studentAttendanceSessions } } }
        if (payload.event_type === 'attendance.bootstrap') {
          if (currentUser.role === 'student') {
            const nextData = payload.changed_payload?.data as { sessions?: typeof studentAttendanceSessions } | undefined
            setStudentAttendanceSessions(nextData?.sessions ?? [])
          } else {
            const nextData = payload.changed_payload?.data as AttendanceTimeline | undefined
            if (nextData) setAttendanceTimeline(nextData)
          }
          return
        }
        if (currentUser.role === 'student') {
          void refreshStudentAttendance(selectedCourse.course_code)
        } else {
          void refreshProfessorAttendance(selectedCourse.course_code)
        }
      } catch {
        if (currentUser.role === 'student') {
          void refreshStudentAttendance(selectedCourse.course_code)
        } else {
          void refreshProfessorAttendance(selectedCourse.course_code)
        }
      }
    }
    return () => socket.close()
  }, [courseSection, currentUser, selectedCourse, refreshProfessorAttendance, refreshStudentAttendance])

  const loadStudentExamList = useCallback(async (courseCode = selectedCourse?.course_code) => {
    if (!currentUser || currentUser.role !== 'student' || !courseCode) return
    const nextExams = await api.listStudentExams(currentUser.login_id, courseCode)
    setStudentExams(nextExams)
  }, [currentUser, selectedCourse?.course_code])

  async function loadProfessorExamList(courseCode = selectedCourse?.course_code) {
    if (!currentUser || currentUser.role !== 'professor' || !courseCode) return
    const nextExams = await api.listProfessorExams(currentUser.login_id, courseCode)
    setProfessorExams(nextExams)
  }

  const openStudentExamDetail = useCallback(async (examId: number, options?: { navigateToDetail?: boolean }) => {
    if (!currentUser || currentUser.role !== 'student' || !selectedCourse) return
    setExamLoading(true)
    try {
      setError(null)
      const detail = await api.getStudentExamDetail(currentUser.login_id, selectedCourse.course_code, examId)
      setStudentExamDetail(detail)
      setStudentExamQuestionIndex(0)
      setStudentExamSubmitWarning([])
      setStudentExamAutoSubmittingId(null)
      if (options?.navigateToDetail !== false) {
        navigate({
          kind: 'course',
          courseCode: selectedCourse.course_code,
          section: 'exams',
          examId,
        }, { replace: true })
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '시험 상세를 불러오지 못했습니다.')
    } finally {
      setExamLoading(false)
    }
  }, [currentUser, navigate, selectedCourse])

  async function openProfessorExamDetail(examId: number, options?: { loadIntoDraft?: boolean }) {
    if (!currentUser || currentUser.role !== 'professor' || !selectedCourse) return
    setExamLoading(true)
    try {
      setError(null)
      const detail = await api.getProfessorExamDetail(currentUser.login_id, selectedCourse.course_code, examId)
      setProfessorExamDetail(detail)
      if (options?.loadIntoDraft) {
        setProfessorExamDraft(loadProfessorExamIntoDraft(detail))
      }
      navigate({
        kind: 'course',
        courseCode: selectedCourse.course_code,
        section: 'exams',
        examId,
      }, { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '교수 시험 상세를 불러오지 못했습니다.')
    } finally {
      setExamLoading(false)
    }
  }

  function resetProfessorExamDraftForm() {
    setProfessorExamDraft(createDefaultProfessorExamDraft())
  }

  function updateProfessorExamDraft<K extends keyof ProfessorExamDraft>(key: K, value: ProfessorExamDraft[K]) {
    setProfessorExamDraft((current) => ({ ...current, [key]: value }))
  }

  function updateProfessorExamQuestion(
    questionIndex: number,
    key: keyof ProfessorExamDraftQuestion,
    value: ProfessorExamDraftQuestion[keyof ProfessorExamDraftQuestion],
  ) {
    setProfessorExamDraft((current) => ({
      ...current,
      questions: current.questions.map((question, currentIndex) =>
        currentIndex === questionIndex ? { ...question, [key]: value } : question,
      ),
    }))
  }

  function updateProfessorExamOption(questionIndex: number, optionIndex: number, value: string) {
    setProfessorExamDraft((current) => ({
      ...current,
      questions: current.questions.map((question, currentIndex) =>
        currentIndex === questionIndex
          ? {
              ...question,
              optionTexts: question.optionTexts.map((item, itemIndex) => (itemIndex === optionIndex ? value : item)),
            }
          : question,
      ),
    }))
  }

  function addProfessorExamQuestion() {
    setProfessorExamDraft((current) => ({
      ...current,
      questions: [...current.questions, createDefaultProfessorExamQuestion()],
    }))
  }

  function removeProfessorExamQuestion(questionIndex: number) {
    setProfessorExamDraft((current) => ({
      ...current,
      questions:
        current.questions.length <= 1
          ? current.questions
          : current.questions.filter((_, currentIndex) => currentIndex !== questionIndex),
    }))
  }

  async function handleProfessorExamSubmit(event: FormEvent) {
    event.preventDefault()
    if (!currentUser || currentUser.role !== 'professor' || !selectedCourse) return

    const payload = toProfessorExamPayload(professorExamDraft)
    if (
      !payload.title ||
      payload.questions.length === 0 ||
      payload.questions.some((question) => !question.prompt || question.options.some((option) => !option.option_text))
    ) {
      setError('시험명과 모든 문항, 보기 4개를 빠짐없이 입력해주세요.')
      return
    }

    setExamBusyKey('draft-submit')
    try {
      setError(null)
      setExamMessage(null)
      if (professorExamDraft.examId) {
        const detail = await api.updateProfessorExam(currentUser.login_id, selectedCourse.course_code, professorExamDraft.examId, payload)
        setProfessorExamDetail(detail)
        setProfessorExamDraft(loadProfessorExamIntoDraft(detail))
        setExamMessage('시험 초안을 수정했습니다.')
      } else {
        const detail = await api.createProfessorExam(currentUser.login_id, selectedCourse.course_code, payload)
        setProfessorExamDetail(detail)
        setProfessorExamDraft(loadProfessorExamIntoDraft(detail))
        setExamMessage('시험 초안을 만들었습니다.')
      }
      await loadProfessorExamList(selectedCourse.course_code)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '시험 초안을 저장하지 못했습니다.')
    } finally {
      setExamBusyKey(null)
    }
  }

  async function handleProfessorExamDelete(examId: number) {
    if (!currentUser || currentUser.role !== 'professor' || !selectedCourse) return
    setExamBusyKey(`delete-${examId}`)
    try {
      setError(null)
      await api.deleteProfessorExam(currentUser.login_id, selectedCourse.course_code, examId)
      setProfessorExamDetail((current) => (current?.id === examId ? null : current))
      if (professorExamDraft.examId === examId) {
        resetProfessorExamDraftForm()
      }
      await loadProfessorExamList(selectedCourse.course_code)
      navigate({
        kind: 'course',
        courseCode: selectedCourse.course_code,
        section: 'exams',
      }, { replace: true })
      setExamMessage('시험을 삭제했습니다.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '시험을 삭제하지 못했습니다.')
    } finally {
      setExamBusyKey(null)
    }
  }

  async function handleProfessorExamStatusAction(examId: number, action: 'publish' | 'close') {
    if (!currentUser || currentUser.role !== 'professor' || !selectedCourse) return
    setExamBusyKey(`${action}-${examId}`)
    try {
      setError(null)
      const detail =
        action === 'publish'
          ? await api.publishProfessorExam(currentUser.login_id, selectedCourse.course_code, examId)
          : await api.closeProfessorExam(currentUser.login_id, selectedCourse.course_code, examId)
      setProfessorExamDetail(detail)
      await loadProfessorExamList(selectedCourse.course_code)
      setExamMessage(action === 'publish' ? '시험을 게시했습니다.' : '시험을 종료했습니다.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '시험 상태를 변경하지 못했습니다.')
    } finally {
      setExamBusyKey(null)
    }
  }

  async function handleStudentExamStart(examId: number) {
    if (!currentUser || currentUser.role !== 'student' || !selectedCourse) return
    setExamBusyKey(`start-${examId}`)
    try {
      setError(null)
      await api.startStudentExam(currentUser.login_id, selectedCourse.course_code, examId)
      await loadStudentExamList(selectedCourse.course_code)
      await openStudentExamDetail(examId, { navigateToDetail: false })
      navigate({
        kind: 'course',
        courseCode: selectedCourse.course_code,
        section: 'exams',
        examId,
        examMode: 'take',
      })
    } catch (caughtError) {
      setError(getExamStartErrorMessage(caughtError))
    } finally {
      setExamBusyKey(null)
    }
  }

  async function handleStudentExamOptionSelect(question: StudentExamQuestion, selectedOptionId: number) {
    if (!currentUser || currentUser.role !== 'student' || !selectedCourse || !studentExamDetail?.attempt?.id) return
    setStudentExamSubmitWarning([])
    setStudentExamDetail((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((item) =>
              item.id === question.id ? { ...item, selected_option_id: selectedOptionId } : item,
            ),
          }
        : current,
    )
    setExamBusyKey(`answer-${question.id}`)
    try {
      await api.saveStudentExamAnswer(
        currentUser.login_id,
        selectedCourse.course_code,
        studentExamDetail.id,
        studentExamDetail.attempt.id,
        question.id,
        { selected_option_id: selectedOptionId },
      )
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '답안을 저장하지 못했습니다.')
    } finally {
      setExamBusyKey(null)
    }
  }

  const handleStudentExamSubmit = useCallback(async (options?: { skipUnansweredCheck?: boolean; auto?: boolean }) => {
    if (!currentUser || currentUser.role !== 'student' || !selectedCourse || !studentExamDetail) return
    if (!options?.skipUnansweredCheck) {
      const unansweredQuestions = studentExamDetail.questions
        .filter((question) => question.selected_option_id == null)
        .map((question) => question.question_order)
      if (unansweredQuestions.length > 0) {
        setStudentExamQuestionIndex(
          Math.max(
            0,
            studentExamDetail.questions.findIndex((question) => question.question_order === unansweredQuestions[0]),
          ),
        )
        setStudentExamSubmitWarning(unansweredQuestions)
        return
      }
    }
    setExamBusyKey(`submit-${studentExamDetail.id}`)
    try {
      setError(null)
      setStudentExamSubmitWarning([])
      if (options?.auto) {
        setStudentExamAutoSubmittingId(studentExamDetail.id)
      }
      await api.submitStudentExam(currentUser.login_id, selectedCourse.course_code, studentExamDetail.id, {
        answers: studentExamDetail.questions.map((question) => ({
          question_id: question.id,
          selected_option_id: question.selected_option_id ?? null,
          answer_text: null,
        })),
      })
      await loadStudentExamList(selectedCourse.course_code)
      await openStudentExamDetail(studentExamDetail.id, { navigateToDetail: false })
      navigate({
        kind: 'course',
        courseCode: selectedCourse.course_code,
        section: 'exams',
        examId: studentExamDetail.id,
      }, { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '답안을 제출하지 못했습니다.')
    } finally {
      setExamBusyKey(null)
      if (options?.auto) {
        setStudentExamAutoSubmittingId(null)
      }
    }
  }, [currentUser, loadStudentExamList, navigate, openStudentExamDetail, selectedCourse, studentExamDetail])

  useEffect(() => {
    if (courseSection !== 'exams' || !selectedCourse || !currentUser) return
    let cancelled = false

    ;(async () => {
      setExamLoading(true)
      try {
        if (currentUser.role === 'student') {
          const nextExams = await api.listStudentExams(currentUser.login_id, selectedCourse.course_code)
          if (cancelled) return
          setStudentExams(nextExams)
          if (routeExamId) {
            const detail = await api.getStudentExamDetail(currentUser.login_id, selectedCourse.course_code, routeExamId)
            if (cancelled) return
            setStudentExamDetail(detail)
            setStudentExamQuestionIndex(0)
          } else {
            setStudentExamDetail(null)
          }
        } else if (currentUser.role === 'professor') {
          const nextExams = await api.listProfessorExams(currentUser.login_id, selectedCourse.course_code)
          if (cancelled) return
          setProfessorExams(nextExams)
          if (routeExamId) {
            const detail = await api.getProfessorExamDetail(currentUser.login_id, selectedCourse.course_code, routeExamId)
            if (cancelled) return
            setProfessorExamDetail(detail)
          } else {
            setProfessorExamDetail(null)
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : '시험 정보를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) {
          setExamLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [courseSection, currentUser, routeExamId, selectedCourse])

  useEffect(() => {
    if (!inStudentExamMode) return
    const timer = window.setInterval(() => setExamNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [inStudentExamMode])

  useEffect(() => {
    if (!inStudentExamMode) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [inStudentExamMode])

  useEffect(() => {
    if (!inStudentExamMode || !studentExamDetail || studentExamDetail.attempt?.status !== 'in_progress') return
    if (!studentExamDetail.auto_submit_enabled) return
    if (examBusyKey === `submit-${studentExamDetail.id}` || studentExamAutoSubmittingId === studentExamDetail.id) return

    const targetEnd = studentExamDetail.attempt?.expires_at ?? studentExamDetail.ends_at ?? null
    if (!targetEnd) return
    if (new Date(targetEnd).getTime() > examNow) return

    void handleStudentExamSubmit({ skipUnansweredCheck: true, auto: true })
  }, [courseSection, currentUser, examBusyKey, examNow, handleStudentExamSubmit, inStudentExamMode, selectedCourse, studentExamAutoSubmittingId, studentExamDetail])

  function handleAddLearningItem(event: FormEvent) {
    event.preventDefault()
    if (!selectedCourse || !currentUser || currentUser.role !== 'professor') return

    const nextItem: LearningItem = {
      id: `${selectedCourse.course_code}-${learningKind}-${Date.now()}`,
      course_code: selectedCourse.course_code,
      kind: learningKind,
      title: learningTitle.trim(),
      description: learningDescription.trim(),
      week_label: learningWeek.trim() || '주차 미지정',
      format_label: learningFormat.trim() || (learningKind === 'video' ? 'LINK' : 'PDF'),
      uploaded_at: new Date().toISOString().slice(0, 10),
      author_name: currentUser.name,
      duration_label: learningKind === 'video' ? learningDuration.trim() || '재생시간 미정' : undefined,
    }

    if (!nextItem.title || !nextItem.description) {
      setError('자료 또는 영상의 제목과 설명을 입력해주세요.')
      return
    }

    setError(null)
    setLearningItems((current) => [nextItem, ...current])
    setSelectedLearningItem(nextItem)
    setLearningTitle('')
    setLearningDescription('')
    setLearningWeek('1주차')
    setLearningFormat(learningKind === 'video' ? 'LINK' : 'PDF')
    setLearningDuration('20분')
  }

  function handleDeleteLearningItem(itemId: string) {
    setLearningItems((current) => current.filter((item) => item.id !== itemId))
    setSelectedLearningItem((current) => (current?.id === itemId ? null : current))
  }

  async function openNotice(notice: Notice, fromView: AppView) {
    if (!currentUser) return

    try {
      setError(null)
      setNoticeReturnRoute(
        fromView === 'course' && selectedCourse
          ? { kind: 'course', courseCode: selectedCourse.course_code, section: courseSection }
          : { kind: 'dashboard' },
      )
      setSelectedNotice(notice)
      navigate({ kind: 'notice', noticeId: notice.id })
      const detail = await api.getNoticeDetail(currentUser.login_id, notice.id)
      setSelectedNotice(detail)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '공지 상세를 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    if (!currentUser) return

    if (route.kind === 'notice') {
      let cancelled = false
      void (async () => {
        try {
          const detail = await api.getNoticeDetail(currentUser.login_id, route.noticeId)
          if (!cancelled) {
            setSelectedNotice(detail)
          }
        } catch (caughtError) {
          if (!cancelled) {
            setError(caughtError instanceof Error ? caughtError.message : '공지 상세를 불러오지 못했습니다.')
            navigateToDefault(currentUser, { replace: true })
          }
        }
      })()
      return () => {
        cancelled = true
      }
    }

    setSelectedNotice(null)
    return undefined
  }, [currentUser, navigateToDefault, route])

  useEffect(() => {
    if (!currentUser) return

    if (route.kind !== 'course') {
      setAttendanceHistory(null)
      if (route.kind !== 'notice') {
        setSelectedCourse(null)
      }
      return
    }

    if (courses.length === 0) {
      return
    }

    const routeCourseCode = (route as { courseCode?: string }).courseCode ?? null
    if (!routeCourseCode) {
      return
    }

    const nextCourse = courses.find((course) => course.course_code === routeCourseCode)
    if (!nextCourse) {
      setError('해당 강의 경로에 접근할 수 없습니다.')
      navigateToDefault(currentUser, { replace: true })
      return
    }

    if (selectedCourse?.course_code !== nextCourse.course_code) {
      setEligibility(null)
      setStudentExams([])
      setStudentExamDetail(null)
      setProfessorExams([])
      setProfessorExamDetail(null)
      setProfessorExamDraft(createDefaultProfessorExamDraft())
      setExamMessage(null)
      setStudentExamQuestionIndex(0)
      setAttendanceTimeline(null)
      setAttendanceRoster(null)
      setAttendanceHistory(null)
      setStudentAttendanceSessions([])
      setAttendanceModalOpen(false)
      setAttendanceModalAnchorSlot(null)
      setSelectedBatchProjectionKeys([])
      setAttendanceMessage(null)
      setSelectedLearningItem(null)
      setLearningFilter('all')
      setSelectedCourse(nextCourse)
    }

    if (route.section === 'manage' && currentUser.role !== 'professor') {
      setError('해당 강의 운영 페이지는 교수만 접근할 수 있습니다.')
      navigate({
        kind: 'course',
        courseCode: nextCourse.course_code,
        section: 'overview',
      }, { replace: true })
      return
    }

    if (route.section === 'attendance' && currentUser.role === 'admin') {
      setError('관리자 계정에서는 강의 출석 페이지에 직접 접근할 수 없습니다.')
      navigate({
        kind: 'course',
        courseCode: nextCourse.course_code,
        section: 'overview',
      }, { replace: true })
    }
  }, [courses, currentUser, navigate, navigateToDefault, route, selectedCourse?.course_code])

  useEffect(() => {
    setRosterDrafts({})
  }, [routeProjectionKey, routeSessionId, routeAttendancePage])

  useEffect(() => {
    if (!selectedCourse || route.kind !== 'course' || route.section !== 'attendance' || !currentUser) {
      return
    }

    if (currentUser.role !== 'professor') {
      return
    }

    if (!routeProjectionKey && !routeSessionId) {
      setAttendanceRoster(null)
      return
    }

    const slot = findAttendanceSlot(attendanceTimeline, routeProjectionKey, routeSessionId)
    if (!slot) {
      if (attendanceTimeline) {
        setError('선택한 출석 차시를 찾지 못했습니다.')
        navigate({
          kind: 'course',
          courseCode: selectedCourse.course_code,
          section: 'attendance',
          attendancePage: 'timeline',
        }, { replace: true })
      }
      return
    }

    if (routeAttendancePage === 'timer') {
      const expired = !slot.expires_at || new Date(slot.expires_at).getTime() <= attendanceNow
      const inactive = slot.session_status && slot.session_status !== 'active'
      if (slot.session_id) {
        void loadAttendanceRoster(slot.session_id)
      }
      if (!slot.session_id || expired || inactive) {
        navigate(
          safeAttendanceRoute(
            selectedCourse.course_code,
            'roster',
            routeSessionId != null ? { sessionId: routeSessionId } : { projectionKey: slot.projection_key },
          ),
          { replace: true },
        )
      }
      return
    }

    if (routeAttendancePage === 'roster') {
      if (routeProjectionKey) {
        void loadAttendanceSlotRoster(slot.projection_key)
      } else if (slot.session_id) {
        void loadAttendanceRoster(slot.session_id)
      }
    }
  }, [
    attendanceNow,
    attendanceTimeline,
    currentUser,
    loadAttendanceRoster,
    loadAttendanceSlotRoster,
    navigate,
    route,
    routeAttendancePage,
    routeProjectionKey,
    routeSessionId,
    selectedCourse,
  ])

  const courseNotices = useMemo(() => {
    if (!selectedCourse) return []
    return notices.filter((notice) => notice.course_code === selectedCourse.course_code)
  }, [notices, selectedCourse])

  const recentNotices = useMemo(() => notices.slice(0, 4), [notices])
  const courseLearningItems = useMemo(() => {
    if (!selectedCourse) return []
    return learningItems.filter((item) => item.course_code === selectedCourse.course_code)
  }, [learningItems, selectedCourse])

  const visibleLearningItems = useMemo(() => {
    if (learningFilter === 'all') return courseLearningItems
    return courseLearningItems.filter((item) => item.kind === learningFilter)
  }, [courseLearningItems, learningFilter])

  const welcomeMetrics = useMemo<Metric[]>(() => {
    if (isAdmin) {
      return [
        { label: '운영 사용자', value: adminUsers.length, tone: 'accent' },
        { label: '강의실', value: adminClassrooms.length },
        { label: 'AP 매핑', value: adminNetworks.length },
      ]
    }

    if (isProfessor) {
      return [
        { label: '담당 강의', value: courses.length, tone: 'accent' },
        { label: '전체 공지', value: notices.length },
        { label: '시스템 상태', value: HEALTH_LABEL[health] },
      ]
    }

    return [
      { label: '수강 과목', value: courses.length, tone: 'accent' },
      { label: '등록 단말', value: devices.length },
      { label: '최근 공지', value: notices.length },
    ]
  }, [adminClassrooms.length, adminNetworks.length, adminUsers.length, courses.length, devices.length, health, isAdmin, isProfessor, notices.length])

  const roleHeadline = isAdmin
    ? '운영 현황을 한눈에 확인하세요'
    : isProfessor
      ? '담당 강의와 공지 관리를 빠르게 진행하세요'
      : '오늘 필요한 강의 정보와 개인 기능을 바로 확인하세요'

  const courseMenuItems = useMemo<Array<{ id: CourseSection; label: string }>>(() => {
    const commonItems: Array<{ id: CourseSection; label: string }> = [
      { id: 'overview', label: '강의 홈' },
      { id: 'content', label: '자료·영상' },
    ]

    if (isStudent) {
      return [...commonItems, { id: 'notices', label: '공지사항' }, { id: 'exams', label: '시험' }, { id: 'attendance', label: '출석 확인' }]
    }

    if (isProfessor) {
      return [...commonItems, { id: 'notices', label: '공지사항' }, { id: 'exams', label: '시험' }, { id: 'attendance', label: '출석 탭' }, { id: 'manage', label: '강의 운영' }]
    }

    return commonItems
  }, [isProfessor, isStudent])

  function renderLoginPage() {
    return (
      <main className="auth-page">
        <ul className="skip-links">
          <li>
            <a href="#login-form">로그인 바로가기</a>
          </li>
        </ul>

        <section className="auth-layout">
          <div className="auth-copy">
            <p className="eyebrow">조선대학교 차세대 사이버캠퍼스</p>
            <h1>학습과 수업 관리를 위한 통합 학습지원 시스템</h1>
            <p className="auth-description">
              강의 정보, 공지, 개인 단말 관리, 출석·시험 확인 기능을 하나의 화면 흐름으로 사용할 수
              있도록 정리한 캠퍼스 포털입니다.
            </p>
            <div className="auth-badges">
              <span className={`status-pill status-pill--${health}`}>시스템 {HEALTH_LABEL[health]}</span>
              <span className="info-chip">학생 · 교수 · 관리자 공통 이용</span>
            </div>
          </div>

          <div className="auth-panels">
            <article className="section-card auth-card">
              <header className="section-head">
                <h3>로그인</h3>
                <span className="caption-text">사용자 계정으로 접속</span>
              </header>
              <form id="login-form" className="stack" onSubmit={handleLogin}>
                <label>
                  아이디
                  <input
                    autoComplete="username"
                    value={loginId}
                    onChange={(event) => setLoginId(event.target.value)}
                    placeholder="학번 또는 사용자 ID"
                  />
                </label>
                <label>
                  비밀번호
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호 입력"
                  />
                </label>
                <button type="submit">로그인</button>
              </form>
              {error ? <p className="banner banner--error">{error}</p> : null}
            </article>

            <article className="section-card auth-card auth-card--muted">
              <header className="section-head">
                <h3>샘플 계정 안내</h3>
                <span className="caption-text">시연 및 점검용</span>
              </header>
              <div className="helper-list">
                <div className="helper-row">
                  <strong>학생</strong>
                  <span>20201234 / devpass123</span>
                </div>
                <div className="helper-row">
                  <strong>교수</strong>
                  <span>PRF001 / devpass123</span>
                </div>
                <div className="helper-row">
                  <strong>관리자</strong>
                  <span>ADM001 / devpass123</span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>
    )
  }

  function renderUtilityBar() {
    return (
      <div className="utility-bar">
        <div className="utility-brand">
          <span className="system-name">e-class system</span>
          <span className="caption-text">조선대학교 차세대 사이버캠퍼스</span>
        </div>
        <div className="utility-actions">
          <span className={`status-pill status-pill--${health}`}>시스템 {HEALTH_LABEL[health]}</span>
          <span className="info-chip">{currentUser ? ROLE_LABEL[currentUser.role] : '미로그인'}</span>
          <span className="user-meta">{currentUser?.name}</span>
          <button type="button" className="text-button" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </div>
    )
  }

  function renderHeader() {
    return (
      <header className="campus-header">
        <div className="branding">
          <p className="eyebrow">2026학년도 1학기</p>
          <h1>Chosun University Cyber Campus</h1>
          <p>학습과 수업 관리를 위한 통합 학습지원 시스템</p>
        </div>

        <nav id="main-nav" className="main-nav" aria-label="주요 메뉴">
          <button type="button" className={view === 'dashboard' ? 'active' : ''} onClick={() => navigate({ kind: 'dashboard' })}>
            대시보드
          </button>
          <button type="button" className={view === 'profile' ? 'active' : ''} onClick={() => navigate({ kind: 'profile' })}>
            내 정보
          </button>
          {selectedCourse ? (
            <button
              type="button"
              className={view === 'course' ? 'active' : ''}
              onClick={() => navigate({ kind: 'course', courseCode: selectedCourse.course_code, section: courseSection })}
            >
              강의 상세
            </button>
          ) : null}
        </nav>
      </header>
    )
  }

  function renderPageLead() {
    const title = view === 'profile'
      ? '내 정보와 개인 설정'
      : view === 'notice' && selectedNotice
        ? selectedNotice.title
      : view === 'course' && selectedCourse
        ? `${selectedCourse.title}`
        : `${currentUser?.name}님, 안녕하세요`

    const description = view === 'profile'
      ? '계정 정보와 개인 기능을 확인하고 학생 계정에서는 등록 단말을 관리할 수 있습니다.'
      : view === 'notice' && selectedNotice
        ? `${selectedNotice.course_code ?? '공통 공지'} · ${selectedNotice.author_name} · ${formatBoardDate(selectedNotice.created_at)}`
      : view === 'course' && selectedCourse
        ? `${selectedCourse.course_code} · ${selectedCourse.professor_name ?? '-'} · ${selectedCourse.classroom_code ?? '-'}`
        : roleHeadline

    return (
      <section className="page-lead">
        <div className="page-lead-copy">
          <p className="eyebrow">
            {view === 'profile'
              ? '마이페이지'
              : view === 'course'
                ? '강의 상세'
                : view === 'notice'
                  ? '공지 상세'
                  : '교육현황'}
          </p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="metric-grid">
          {welcomeMetrics.map((metric) => (
            <div key={metric.label} className={`metric-card${metric.tone === 'accent' ? ' metric-card--accent' : ''}`}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </section>
    )
  }

  function renderNoticeItems(list: Notice[]) {
    if (list.length === 0) {
      return <p className="empty-state">등록된 공지가 없습니다.</p>
    }

    return (
      <div className="board-wrap">
        <div className="board-head" aria-hidden="true">
          <span className="board-col board-col--tag">구분</span>
          <span className="board-col board-col--title">제목</span>
          <span className="board-col board-col--author">작성자</span>
          <span className="board-col board-col--date">등록일</span>
        </div>
        <ul className="board-list">
          {list.map((notice) => (
            <li key={notice.id} className="board-row">
              <button
                type="button"
                className="board-row-button"
                onClick={() => void openNotice(notice, view === 'course' ? 'course' : 'dashboard')}
              >
                <span className="board-col board-col--tag">
                  <span className="badge">{notice.course_code ?? '공통'}</span>
                </span>
                <span className="board-col board-col--title">
                  <span className="board-title">{notice.title}</span>
                  <span className="board-preview">{notice.body}</span>
                </span>
                <span className="board-col board-col--author">{notice.author_name}</span>
                <time className="board-col board-col--date">{formatBoardDate(notice.created_at)}</time>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  function renderNoticePage() {
    if (!selectedNotice) {
      return (
        <section className="section-card">
          <p className="empty-state">공지 내용을 불러오지 못했습니다.</p>
        </section>
      )
    }

    return (
      <section className="content-grid">
        <div className="main-column">
          <SectionCard
            title="공지 상세"
            action={(
              <button type="button" className="text-button" onClick={() => navigate(noticeReturnRoute)}>
                목록으로 돌아가기
              </button>
            )}
          >
            <div className="notice-detail">
              <div className="notice-detail-head">
                <div className="notice-detail-meta">
                  <span className="badge">{selectedNotice.course_code ?? '공통'}</span>
                  <span>{selectedNotice.author_name}</span>
                  <time>{formatBoardDate(selectedNotice.created_at)}</time>
                </div>
                <h3 className="notice-detail-title">{selectedNotice.title}</h3>
              </div>
              <div className="notice-detail-body">
                {selectedNotice.body.split('\n').map((line, index) => (
                  <p key={`${selectedNotice.id}-${index}`}>{line || '\u00A0'}</p>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="side-column">
          <SectionCard title="공지 정보" compact>
            <div className="helper-list">
              <div className="helper-row">
                <strong>구분</strong>
                <span>{selectedNotice.course_code ?? '공통'}</span>
              </div>
              <div className="helper-row">
                <strong>작성자</strong>
                <span>{selectedNotice.author_name}</span>
              </div>
              <div className="helper-row">
                <strong>등록일</strong>
                <span>{formatBoardDate(selectedNotice.created_at)}</span>
              </div>
            </div>
          </SectionCard>
        </aside>
      </section>
    )
  }

  function renderCourseList(actionLabel: string) {
    if (courses.length === 0) {
      return <p className="empty-state">표시할 강의가 없습니다.</p>
    }

    return (
      <div className="course-list">
        {courses.map((course) => (
          <button key={course.id} type="button" className="course-card" onClick={() => openCourse(course)}>
            <div>
              <p className="course-code">{course.course_code}</p>
              <h4>{course.title}</h4>
              <p>{course.professor_name ?? '-'} · {course.classroom_code ?? '-'}</p>
            </div>
            <span className="action-chip">{actionLabel}</span>
          </button>
        ))}
      </div>
    )
  }

  function renderPresenceStation(station: AdminPresenceStation) {
    return (
      <article key={`${station.macAddress}-${station.ownerLoginId ?? 'guest'}`} className="entity-row">
        <div>
          <p className="entity-title">{station.ownerName ?? station.deviceLabel ?? station.macAddress}</p>
          <p className="entity-subtitle">
            {station.ownerLoginId ?? '미등록'} · {station.deviceLabel ?? '단말명 없음'} · {station.macAddress}
          </p>
        </div>
        <span className={`badge${station.associated ? '' : ' badge--muted'}`}>
          {station.associated ? '연결됨' : '연결 끊김'}
        </span>
      </article>
    )
  }

  function renderAdminPresenceCard(classroom: Classroom) {
    const snapshot = adminPresenceSnapshots[classroom.classroom_code]
    const classroomNetworks = adminNetworks.filter(
      (network) => network.classroom_code === classroom.classroom_code,
    )

    return (
      <article key={classroom.id} className="admin-card">
        <div className="admin-card-head">
          <div>
            <p className="entity-title">{classroom.classroom_code}</p>
            <p className="entity-subtitle">
              {classroom.name} · {classroom.building ?? '-'} / {classroom.floor_label ?? '-'}
            </p>
          </div>
          <span className="info-chip">
            {snapshot ? `${snapshot.overlayActive ? 'Overlay' : '기본값'} · AP ${snapshot.aps.length}` : `AP ${classroomNetworks.length}`}
          </span>
        </div>
        {snapshot ? (
          <div className="helper-list">
            <div className="helper-row">
              <strong>수집 방식</strong>
              <span>{snapshot.collectionMode ?? '-'}</span>
            </div>
            <div className="helper-row">
              <strong>관측 시각</strong>
              <span>{formatDateTime(snapshot.observedAt)}</span>
            </div>
            <div className="helper-row">
              <strong>Threshold</strong>
              <span>
                {snapshot.classroomNetworks.map((network) => `${network.ap_id} ${network.signal_threshold_dbm ?? -65} dBm`).join(' · ')}
              </span>
            </div>
            {snapshot.aps.map((ap) => (
              <div key={ap.apId}>
                <div className="helper-row">
                  <strong>{ap.apId}</strong>
                  <span>{ap.ssid}</span>
                </div>
                <div className="entity-list">
                  {ap.stations.length ? (
                    ap.stations.map(renderPresenceStation)
                  ) : (
                    <p className="empty-state">현재 관측된 단말이 없습니다.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <pre>{formatJson(classroomNetworks)}</pre>
        )}
      </article>
    )
  }

  function renderDashboard() {
    if (isAdmin) {
      const selectedNetworks = selectedAdminSnapshot?.classroomNetworks ?? []
      const selectedDeviceOptions = selectedAdminSnapshot?.deviceOptions ?? []
      return (
        <section className="content-grid">
          <div className="main-column">
            <div className="menu-row">
              <button type="button" className={adminTab === 'users' ? 'menu-button active' : 'menu-button'} onClick={() => setAdminTab('users')}>
                사용자 현황
              </button>
              <button type="button" className={adminTab === 'networks' ? 'menu-button active' : 'menu-button'} onClick={() => setAdminTab('networks')}>
                강의실 및 네트워크 현황
              </button>
              <button type="button" className={adminTab === 'demo' ? 'menu-button active' : 'menu-button'} onClick={() => setAdminTab('demo')}>
                재실 시연 제어 (demo)
              </button>
            </div>

            {adminTab === 'users' ? (
              <SectionCard title="사용자 현황" action={<span className="info-chip">총 {adminUsers.length}명</span>}>
                <div className="entity-list">
                  {adminUsers.map((user) => (
                    <article key={user.id} className="entity-row">
                      <div>
                        <p className="entity-title">{user.name}</p>
                        <p className="entity-subtitle">{user.login_id}</p>
                      </div>
                      <span className="badge">{ROLE_LABEL[user.role]}</span>
                    </article>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {adminTab === 'networks' ? (
              <SectionCard title="강의실 및 네트워크 현황">
                <div className="admin-grid">
                  {adminClassrooms.map(renderAdminPresenceCard)}
                </div>
              </SectionCard>
            ) : null}

            {adminTab === 'demo' ? (
              <SectionCard title="재실 시연 제어" action={<span className="info-chip">Demo mode</span>}>
                <form className="stack-form" onSubmit={(event) => void handleApplyPresenceControl(event)}>
                  <label>
                    강의실
                    <select
                      value={presenceControlClassroom}
                      onChange={(event) => setPresenceControlClassroom(event.target.value)}
                    >
                      {adminClassrooms.map((classroom) => (
                        <option key={classroom.id} value={classroom.classroom_code}>
                          {classroom.classroom_code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    디바이스 선택
                    <select
                      value={presenceControlDeviceMac}
                      onChange={(event) => setPresenceControlDeviceMac(event.target.value)}
                    >
                      {selectedDeviceOptions.map((option) => (
                        <option key={option.macAddress} value={option.macAddress}>
                          {[option.studentLoginId, option.studentName, option.deviceLabel, option.macAddress].filter(Boolean).join(' / ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    AP ID
                    <select
                      value={presenceControlApId}
                      onChange={(event) => {
                        const nextApId = event.target.value
                        setPresenceControlApId(nextApId)
                        const nextNetwork = selectedAdminSnapshot?.classroomNetworks.find((network) => network.ap_id === nextApId)
                        setPresenceThresholdDbm(nextNetwork?.signal_threshold_dbm ?? -65)
                      }}
                    >
                      {selectedAdminSnapshot?.aps.map((ap) => (
                        <option key={ap.apId} value={ap.apId}>
                          {ap.apId} / {ap.ssid}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    연결 상태
                    <select
                      value={presenceControlAssociated ? 'associated' : 'detached'}
                      onChange={(event) => setPresenceControlAssociated(event.target.value === 'associated')}
                    >
                      <option value="associated">연결됨</option>
                      <option value="detached">연결 끊김</option>
                    </select>
                  </label>
                  <label>
                    신호 세기 ({presenceControlSignalDbm} dBm)
                    <input
                      type="range"
                      min={-90}
                      max={-30}
                      step={1}
                      value={presenceControlSignalDbm}
                      onChange={(event) => setPresenceControlSignalDbm(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    AP threshold ({presenceThresholdDbm} dBm)
                    <input
                      type="range"
                      min={-90}
                      max={-30}
                      step={1}
                      value={presenceThresholdDbm}
                      onChange={(event) => setPresenceThresholdDbm(Number(event.target.value))}
                    />
                  </label>
                  <div className="helper-list">
                    {selectedNetworks.map((network) => (
                      <div key={network.id} className="helper-row">
                        <strong>{network.ap_id}</strong>
                        <span>{network.signal_threshold_dbm ?? -65} dBm</span>
                      </div>
                    ))}
                  </div>
                  <div className="section-head-action">
                    <button type="submit">재실 상태 적용</button>
                    <button type="button" className="secondary-button" onClick={() => void handleResetPresenceControl()}>
                      Overlay 초기화
                    </button>
                  </div>
                </form>
              </SectionCard>
            ) : null}
          </div>

          <aside className="side-column">
            <SectionCard title="운영 요약" compact>
              <div className="summary-list">
                <div>
                  <strong>{adminUsers.filter((user) => user.role === 'student').length}</strong>
                  <span>학생</span>
                </div>
                <div>
                  <strong>{adminUsers.filter((user) => user.role === 'professor').length}</strong>
                  <span>교수</span>
                </div>
                <div>
                  <strong>{adminUsers.filter((user) => user.role === 'admin').length}</strong>
                  <span>관리자</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="운영 포인트" compact>
              <div className="helper-list">
                <div className="helper-row">
                  <strong>강의실</strong>
                  <span>{adminClassrooms.length}개</span>
                </div>
                <div className="helper-row">
                  <strong>AP 매핑</strong>
                  <span>{adminNetworks.length}건</span>
                </div>
                <div className="helper-row">
                  <strong>상태</strong>
                  <span>{HEALTH_LABEL[health]}</span>
                </div>
              </div>
            </SectionCard>
          </aside>
        </section>
      )
    }

    return (
      <section className="content-grid">
        <div className="main-column">
          <SectionCard title="공지사항" action={<span className="info-chip">최근 {recentNotices.length}건</span>}>
            {renderNoticeItems(recentNotices)}
          </SectionCard>

          <SectionCard
            title={isProfessor ? '담당 강의' : '내 강의'}
            action={<span className="caption-text">강의를 선택하면 상세 화면으로 이동합니다.</span>}
          >
            {renderCourseList(isProfessor ? '강의 열기' : '바로가기')}
          </SectionCard>
        </div>

        <aside className="side-column">
          <SectionCard title="한눈에 보기" compact>
            <div className="summary-list summary-list--single">
              {isProfessor ? (
                <>
                  <div>
                    <strong>{courses.length}</strong>
                    <span>담당 강의</span>
                  </div>
                  <div>
                    <strong>{notices.length}</strong>
                    <span>공지</span>
                  </div>
                  <div>
                    <strong>{selectedCourse?.course_code ?? '-'}</strong>
                    <span>선택 강의</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{courses.length}</strong>
                    <span>수강 과목</span>
                  </div>
                  <div>
                    <strong>{devices.length}</strong>
                    <span>등록 단말</span>
                  </div>
                  <div>
                    <strong>{eligibility ? (eligibility.eligible ? '이용 가능' : '확인 필요') : '-'}</strong>
                    <span>최근 확인 상태</span>
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard title="빠른 메뉴" compact>
            <div className="quick-actions">
              <button type="button" onClick={() => navigate({ kind: 'profile' })}>내 정보</button>
              {selectedCourse ? (
                <button type="button" onClick={() => navigate({ kind: 'course', courseCode: selectedCourse.course_code, section: courseSection })}>
                  강의 상세 열기
                </button>
              ) : null}
              {isStudent ? (
                <button type="button" onClick={() => navigate({ kind: 'profile' })}>등록 단말 관리</button>
              ) : (
                <button type="button" onClick={() => (courses[0] ? openCourse(courses[0]) : navigate({ kind: 'dashboard' }))}>
                  공지 작성 시작
                </button>
              )}
            </div>
          </SectionCard>
        </aside>
      </section>
    )
  }

  function renderProfile() {
    return (
      <section className="content-grid">
        <div className="main-column">
          <SectionCard title="기본 정보">
            <div className="detail-grid detail-grid--profile">
              <div>
                <dt>이름</dt>
                <dd>{currentUser?.name ?? '-'}</dd>
              </div>
              <div>
                <dt>역할</dt>
                <dd>{currentUser ? ROLE_LABEL[currentUser.role] : '-'}</dd>
              </div>
              <div>
                <dt>아이디</dt>
                <dd>{currentUser?.login_id ?? '-'}</dd>
              </div>
            </div>
          </SectionCard>

          {isStudent ? (
            <>
              <SectionCard title="등록 단말 관리" action={<span className="caption-text">학생 계정에서만 사용</span>}>
                <form className="stack" onSubmit={handleRegisterDevice}>
                  <div className="field-grid field-grid--2">
                    <label>
                      기기 이름
                      <input
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        placeholder="예: 개인 노트북"
                      />
                    </label>
                    <label>
                      MAC 주소
                      <input
                        value={macAddress}
                        onChange={(event) => setMacAddress(event.target.value)}
                        placeholder="36:68:99:4f:01:db"
                      />
                    </label>
                  </div>
                  <button type="submit">기기 등록</button>
                </form>
              </SectionCard>

              <SectionCard title="현재 등록된 단말" action={<span className="info-chip">{devices.length}대</span>}>
                {devices.length > 0 ? (
                  <div className="entity-list">
                    {devices.map((device) => (
                      <article key={device.id} className="entity-row entity-row--wide">
                        <div>
                          <p className="entity-title">{device.label}</p>
                          <p className="entity-subtitle">{device.mac_address}</p>
                        </div>
                        <div className="entity-actions">
                          <span className={`status-pill status-pill--${device.status}`}>{device.status}</span>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => void handleDeleteDevice(device.id)}
                          >
                            삭제
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">등록된 단말이 없습니다.</p>
                )}
              </SectionCard>
            </>
          ) : (
            <SectionCard title={isProfessor ? '강의 운영 안내' : '운영 권한 안내'}>
              <div className="helper-list">
                {isProfessor ? (
                  <>
                    <div className="helper-row">
                      <strong>담당 강의</strong>
                      <span>{courses.length}개</span>
                    </div>
                    <div className="helper-row">
                      <strong>공지 작성</strong>
                      <span>강의 상세 &gt; 강의 운영</span>
                    </div>
                    <div className="helper-row">
                      <strong>학생 단말</strong>
                      <span>학생 계정에서만 관리</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="helper-row">
                      <strong>운영 사용자</strong>
                      <span>{adminUsers.length}명</span>
                    </div>
                    <div className="helper-row">
                      <strong>강의실</strong>
                      <span>{adminClassrooms.length}개</span>
                    </div>
                    <div className="helper-row">
                      <strong>AP 매핑</strong>
                      <span>{adminNetworks.length}건</span>
                    </div>
                  </>
                )}
              </div>
            </SectionCard>
          )}
        </div>

        <aside className="side-column">
          <SectionCard title="개인 메뉴 요약" compact>
            <div className="summary-list">
              <div>
                <strong>{currentUser ? ROLE_LABEL[currentUser.role] : '-'}</strong>
                <span>현재 역할</span>
              </div>
              <div>
                <strong>{courses.length}</strong>
                <span>{isProfessor ? '담당 강의' : '수강 과목'}</span>
              </div>
              <div>
                <strong>{devices.length}</strong>
                <span>등록 단말</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="이용 안내" compact>
            <div className="helper-list">
              <div className="helper-row">
                <strong>출석·시험 확인</strong>
                <span>강의 상세에서 진행</span>
              </div>
              <div className="helper-row">
                <strong>단말 등록</strong>
                <span>최대 5대까지 가능</span>
              </div>
              <div className="helper-row">
                <strong>랜덤 MAC</strong>
                <span>직접 꺼야 정확히 판정됨</span>
              </div>
            </div>
          </SectionCard>
        </aside>
      </section>
    )
  }

  function renderCourseOverview() {
    return (
      <div className="course-stack">
        <SectionCard title="강의 기본 정보">
          <div className="detail-grid">
            <div>
              <dt>강의 코드</dt>
              <dd>{selectedCourse?.course_code ?? '-'}</dd>
            </div>
            <div>
              <dt>담당 교수</dt>
              <dd>{selectedCourse?.professor_name ?? '-'}</dd>
            </div>
            <div>
              <dt>강의실</dt>
              <dd>{selectedCourse?.classroom_code ?? '-'}</dd>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="최근 공지">
          {renderNoticeItems(courseNotices.slice(0, 3))}
        </SectionCard>

        <SectionCard title="최근 학습 자료" action={<span className="info-chip">임시 미리보기</span>}>
          {courseLearningItems.length > 0 ? (
            <div className="content-snippet-list">
              {courseLearningItems.slice(0, 3).map((item) => (
                <article key={item.id} className="content-snippet-item">
                  <span className="info-chip">{LEARNING_KIND_LABEL[item.kind]}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.week_label} · {formatBoardDate(item.uploaded_at)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">아직 표시할 임시 학습 자료가 없습니다.</p>
          )}
        </SectionCard>
      </div>
    )
  }

  function renderCourseContent() {
    return (
      <div className="course-stack">
        {isProfessor ? (
          <SectionCard title="자료·영상 등록" action={<span className="caption-text">세션 한정 임시 스캐폴드입니다.</span>}>
            <form className="stack" onSubmit={handleAddLearningItem}>
              <div className="field-grid field-grid--3">
                <label>
                  구분
                  <select
                    value={learningKind}
                    onChange={(event) => {
                      const nextKind = event.target.value as LearningItem['kind']
                      setLearningKind(nextKind)
                      setLearningFormat(nextKind === 'video' ? 'LINK' : 'PDF')
                    }}
                  >
                    <option value="material">강의자료</option>
                    <option value="video">강의영상</option>
                  </select>
                </label>
                <label>
                  주차
                  <input value={learningWeek} onChange={(event) => setLearningWeek(event.target.value)} />
                </label>
                <label>
                  형식
                  <input value={learningFormat} onChange={(event) => setLearningFormat(event.target.value)} />
                </label>
              </div>
              <label>
                제목
                <input value={learningTitle} onChange={(event) => setLearningTitle(event.target.value)} />
              </label>
              <label>
                설명
                <textarea value={learningDescription} onChange={(event) => setLearningDescription(event.target.value)} rows={4} />
              </label>
              {learningKind === 'video' ? (
                <label>
                  재생 시간
                  <input value={learningDuration} onChange={(event) => setLearningDuration(event.target.value)} placeholder="예: 20분" />
                </label>
              ) : null}
              <button type="submit">{learningKind === 'video' ? '임시 영상 등록' : '임시 자료 등록'}</button>
            </form>
          </SectionCard>
        ) : null}

        <SectionCard
          title="학습 자료·영상"
          action={(
            <>
              <span className="info-chip">임시 스캐폴드</span>
              <span className="info-chip">총 {courseLearningItems.length}건</span>
            </>
          )}
        >
          <p className="caption-text">현재 세션에서만 유지되며 Backend 또는 DB 에 저장되지 않습니다.</p>
          <div className="content-toolbar">
            <div className="content-filter-group">
              {(['all', 'material', 'video'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`filter-chip${learningFilter === item ? ' active' : ''}`}
                  onClick={() => setLearningFilter(item)}
                >
                  {item === 'all' ? '전체' : item === 'material' ? '자료' : '영상'}
                </button>
              ))}
            </div>
            <div className="content-summary">
              <span>자료 {courseLearningItems.filter((item) => item.kind === 'material').length}</span>
              <span>영상 {courseLearningItems.filter((item) => item.kind === 'video').length}</span>
            </div>
          </div>

          {visibleLearningItems.length > 0 ? (
            <div className="content-layout">
              <div className="content-list">
                {visibleLearningItems.map((item) => (
                  <article
                    key={item.id}
                    className={`content-row${selectedLearningItem?.id === item.id ? ' active' : ''}`}
                  >
                    <button type="button" className="content-row-button" onClick={() => setSelectedLearningItem(item)}>
                      <div className="content-icon">{item.kind === 'video' ? '▶' : '📄'}</div>
                      <div className="content-main">
                        <div className="content-meta">
                          <span className="badge">{LEARNING_KIND_LABEL[item.kind]}</span>
                          <span>{item.week_label}</span>
                          <span>{formatBoardDate(item.uploaded_at)}</span>
                        </div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                    </button>
                    <div className="content-actions">
                      <button type="button" className="text-button" onClick={() => setSelectedLearningItem(item)}>
                        {item.kind === 'video' ? '임시 보기' : '임시 열람'}
                      </button>
                      {isProfessor ? (
                        <button type="button" className="text-button danger-text" onClick={() => handleDeleteLearningItem(item.id)}>
                          삭제
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div className="content-preview">
                {selectedLearningItem ? (
                  <SectionCard title={selectedLearningItem.kind === 'video' ? '영상 정보' : '자료 정보'} compact>
                    <div className="content-preview-meta">
                      <span className="badge">{LEARNING_KIND_LABEL[selectedLearningItem.kind]}</span>
                      <span>{selectedLearningItem.week_label}</span>
                      <span>{formatBoardDate(selectedLearningItem.uploaded_at)}</span>
                    </div>
                    <h3 className="content-preview-title">{selectedLearningItem.title}</h3>
                    <p className="content-preview-text">{selectedLearningItem.description}</p>
                    <div className="helper-list">
                      <div className="helper-row">
                        <strong>형식</strong>
                        <span>{selectedLearningItem.format_label}</span>
                      </div>
                      {selectedLearningItem.duration_label ? (
                        <div className="helper-row">
                          <strong>재생 시간</strong>
                          <span>{selectedLearningItem.duration_label}</span>
                        </div>
                      ) : null}
                      <div className="helper-row">
                        <strong>등록자</strong>
                        <span>{selectedLearningItem.author_name}</span>
                      </div>
                      <div className="helper-row">
                        <strong>상태</strong>
                        <span>임시 미리보기 / 세션 한정</span>
                      </div>
                    </div>
                    <button type="button">
                      {selectedLearningItem.kind === 'video' ? '임시 영상 정보 보기' : '임시 자료 열람하기'}
                    </button>
                  </SectionCard>
                ) : (
                  <p className="empty-state">왼쪽 목록에서 자료 또는 영상을 선택해 내용을 확인하세요.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="empty-state">아직 표시할 임시 자료나 영상이 없습니다.</p>
          )}
        </SectionCard>
      </div>
    )
  }

  function renderCourseNotices() {
    return (
      <div className="course-stack">
        <SectionCard title="공지 목록" action={<span className="info-chip">{courseNotices.length}건</span>}>
          {renderNoticeItems(courseNotices)}
        </SectionCard>
      </div>
    )
  }

  function renderCourseManage() {
    if (isProfessor) {
      return (
        <div className="course-stack">
          <SectionCard title="공지 작성" action={<span className="caption-text">선택한 강의에 바로 등록됩니다.</span>}>
            <form className="stack" onSubmit={handleCreateNotice}>
              <label>
                제목
                <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} />
              </label>
              <label>
                내용
                <textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} rows={5} />
              </label>
              <button type="submit">공지 등록</button>
            </form>
          </SectionCard>

          <SectionCard title="운영 메모">
            <div className="helper-list">
              <div className="helper-row">
                <strong>강의 공지</strong>
                <span>현재 강의 범위 안에서만 작성 가능</span>
              </div>
              <div className="helper-row">
                <strong>추가 기능</strong>
                <span>과제·자료·출석 운영 기능을 현재 강의 흐름 안에서 함께 제공합니다.</span>
              </div>
            </div>
          </SectionCard>
        </div>
      )
    }

    return (
      <div className="course-stack">
        <SectionCard title="운영 기능">
          <p className="empty-state">현재 권한에서는 별도의 강의 운영 기능이 제공되지 않습니다.</p>
        </SectionCard>
      </div>
    )
  }

  function renderCourseAttendance() {
    function getSlotBadge(slot: AttendanceSlot) {
      switch (slot.slot_state) {
        case 'offline':
          return { symbol: '✔', className: 'attendance-slot-indicator attendance-slot-indicator--offline', label: '일반출석' }
        case 'online':
          return { symbol: '✔', className: 'attendance-slot-indicator attendance-slot-indicator--online', label: '스마트출석' }
        case 'canceled':
          return { symbol: '－', className: 'attendance-slot-indicator attendance-slot-indicator--canceled', label: '휴강' }
        default:
          return { symbol: '✔', className: 'attendance-slot-indicator attendance-slot-indicator--unchecked', label: '미체크' }
      }
    }

    function formatCountdown(expiresAt?: string | null) {
      if (!expiresAt) return '시간 정보 없음'
      const remainingMs = new Date(expiresAt).getTime() - attendanceNow
      if (remainingMs <= 0) return '00:00'
      const totalSeconds = Math.floor(remainingMs / 1000)
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
      const seconds = String(totalSeconds % 60).padStart(2, '0')
      return `${minutes}:${seconds}`
    }

    function isLiveCheckedIn(status?: string | null) {
      return status === 'present' || status === 'late' || status === 'official'
    }

    function getSemesterMatrixCellClass(status: string) {
      switch (status) {
        case 'present':
          return 'attendance-semester-cell attendance-semester-cell--present'
        case 'late':
          return 'attendance-semester-cell attendance-semester-cell--late'
        case 'absent':
          return 'attendance-semester-cell attendance-semester-cell--absent'
        case 'official':
          return 'attendance-semester-cell attendance-semester-cell--official'
        case 'canceled':
          return 'attendance-semester-cell attendance-semester-cell--canceled'
        default:
          return 'attendance-semester-cell attendance-semester-cell--pending'
      }
    }

    function getSemesterMatrixCellLabel(status: string) {
      switch (status) {
        case 'present':
          return '출석'
        case 'late':
          return '지각'
        case 'absent':
          return '결석'
        case 'official':
          return '공결'
        case 'canceled':
          return '휴강'
        case 'pending':
          return '진행 중'
        default:
          return '미진행'
      }
    }

    function formatProjectionKeySlotLabel(projectionKey: string) {
      const parts = projectionKey.split(':')
      if (parts.length >= 9) {
        return `${parts.slice(3, 6).join(':')} ~ ${parts.slice(6, 9).join(':')}`
      }
      return projectionKey
    }

    function getStudentBundleSlotLabels(session: (typeof studentAttendanceSessions)[number]) {
      if (session.slot_labels?.length) return session.slot_labels
      if (session.projection_keys?.length) return session.projection_keys.map(formatProjectionKeySlotLabel)
      return [session.display_label]
    }

    const reportSummary = attendanceTimeline?.report_summary
    const modalDateSlots =
      attendanceTimeline?.weeks
        .flatMap((week) => week.slots)
        .filter((slot) => slot.session_date === attendanceModalAnchorSlot?.session_date) ?? []
    const bundleSlots = getBundleSlots(
      attendanceTimeline,
      routeSessionId ?? selectedAttendanceSlot?.session_id ?? null,
      routeProjectionKey,
    )
    const showProfessorTimer = isProfessor && routeAttendancePage === 'timer' && Boolean(selectedAttendanceSlot)
    const showProfessorRoster = isProfessor && routeAttendancePage === 'roster' && Boolean(selectedAttendanceSlot)
    const semesterMatrixColumnCount = Math.max(
      0,
      ...((attendanceSemesterMatrix?.weeks ?? []).map((week) => week.slots.length)),
    )

    return (
      <div className="course-stack">
        {isStudent ? (
          <>
            <SectionCard title="출석 · 시험 확인" action={<span className="caption-text">시간과 상관없이 현재 강의 기준으로 조회할 수 있습니다.</span>}>
              <form className="stack" onSubmit={handleCheckEligibility}>
                <div className="helper-list">
                  <div className="helper-row">
                    <strong>강의 코드</strong>
                    <span>{selectedCourse?.course_code ?? '-'}</span>
                  </div>
                  <div className="helper-row">
                    <strong>강의실</strong>
                    <span>서버 매핑 기준 자동 확인</span>
                  </div>
                  <div className="helper-row">
                    <strong>확인 방식</strong>
                    <span>현재 강의 기준 자동 확인</span>
                  </div>
                </div>
                <button type="submit" disabled={isPending}>
                  {isPending ? '확인 중...' : '재실 가능 여부 확인'}
                </button>
              </form>
            </SectionCard>

            <SectionCard
              title="스마트 출석 현황"
              action={<span className="info-chip">{studentAttendanceSessions.length}개 세션</span>}
            >
              {studentAttendanceSessions.length > 0 ? (
                <div className="attendance-student-session-list">
                  {studentAttendanceSessions.map((session) => (
                    <article key={session.session_id} className="attendance-student-session-card">
                      <div className="attendance-student-session-head">
                        <strong>{session.display_label || `출석 #${session.session_id}`}</strong>
                        <span className="status-pill status-pill--ok">남은시간 {formatCountdown(session.expires_at)}</span>
                      </div>
                      <div className="helper-list">
                        <div className="helper-row">
                          <strong>포함 차시</strong>
                          <span>{getStudentBundleSlotLabels(session).join(' · ')}</span>
                        </div>
                        <div className="helper-row">
                          <strong>재실 판정</strong>
                          <span>{session.eligibility.eligible ? '출석 가능' : session.eligibility.reason_code}</span>
                        </div>
                        <div className="helper-row">
                          <strong>관측 단말</strong>
                          <span>{session.eligibility.matched_device_mac ?? '-'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleStudentCheckIn(session.session_id)}
                        disabled={!session.can_check_in || studentSubmittingSessionId === session.session_id}
                      >
                        {studentSubmittingSessionId === session.session_id ? '처리 중...' : session.can_check_in ? '출석하기' : '출석 불가'}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">현재 실시간으로 열린 스마트 출석이 없습니다.</p>
              )}
            </SectionCard>
            <SectionCard title="학기 전체 출석 현황" action={<span className="caption-text">주차별 차시 결과</span>}>
              {attendanceSemesterMatrix?.weeks.length ? (
                <>
                  <div className="attendance-semester-legend">
                    <span><i className="attendance-semester-dot attendance-semester-dot--present" />출석</span>
                    <span><i className="attendance-semester-dot attendance-semester-dot--late" />지각</span>
                    <span><i className="attendance-semester-dot attendance-semester-dot--absent" />결석</span>
                    <span><i className="attendance-semester-dot attendance-semester-dot--official" />공결</span>
                    <span><i className="attendance-semester-dot attendance-semester-dot--pending" />미진행/진행중</span>
                  </div>
                  <div className="attendance-roster-scroll">
                    <table className="attendance-semester-table">
                      <thead>
                        <tr>
                          <th scope="col">주차</th>
                          {Array.from({ length: semesterMatrixColumnCount }).map((_, index) => (
                            <th key={`semester-col-${index}`} scope="col">{index + 1}차시</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSemesterMatrix.weeks.map((week) => (
                          <tr key={`semester-week-${week.week_index}`}>
                            <th scope="row">{week.week_index}주차</th>
                            {Array.from({ length: semesterMatrixColumnCount }).map((_, index) => {
                              const slot = week.slots[index]
                              if (!slot) return <td key={`semester-empty-${week.week_index}-${index}`} className="attendance-semester-cell attendance-semester-cell--empty" />
                              return (
                                <td
                                  key={slot.projection_key}
                                  className={getSemesterMatrixCellClass(slot.status)}
                                  title={`${slot.display_label} · ${getSemesterMatrixCellLabel(slot.status)}`}
                                />
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="empty-state">학기 출석 현황을 불러오는 중입니다.</p>
              )}
            </SectionCard>
            {attendanceMessage ? <p className="success-text">{attendanceMessage}</p> : null}
          </>
        ) : (
          <div className="course-stack">
            {!showProfessorTimer && !showProfessorRoster ? (
            <SectionCard
              title="교수 출석 운영 대시보드"
              action={
                <div className="attendance-dashboard-action-group">
                  <button type="button" className="text-button" onClick={() => setShowProfessorStudentStats((current) => !current)}>
                    {showProfessorStudentStats ? '학생별 통계 닫기' : '학생별 통계'}
                  </button>
                  <span className="caption-text">학기 전체 차시 + 실시간 집계</span>
                </div>
              }
            >
              {reportSummary ? (
                <div className="attendance-report-grid">
                  <div className="attendance-report-card"><strong>{reportSummary.projection_slot_count}</strong><span>운영 차시</span></div>
                  <div className="attendance-report-card"><strong>{reportSummary.active_session_count}</strong><span>활성 세션</span></div>
                  <div className="attendance-report-card"><strong>{reportSummary.present}</strong><span>출석</span></div>
                  <div className="attendance-report-card"><strong>{reportSummary.late}</strong><span>지각</span></div>
                  <div className="attendance-report-card"><strong>{reportSummary.absent}</strong><span>결석</span></div>
                  <div className="attendance-report-card"><strong>{reportSummary.official}</strong><span>공결/병가</span></div>
                </div>
              ) : (
                <p className="empty-state">{attendanceLoading ? '출석 타임라인을 불러오는 중입니다.' : '출석 데이터가 아직 없습니다.'}</p>
              )}
            </SectionCard>
            ) : null}
            {!showProfessorTimer && !showProfessorRoster && showProfessorStudentStats ? (
              <SectionCard title="학생별 출석 누계" action={<span className="caption-text">{selectedCourse?.course_code} 학기 전체 기준</span>}>
                {attendanceStudentStats ? (
                  <div className="attendance-roster-scroll">
                    <table className="attendance-stats-table">
                      <thead>
                        <tr>
                          <th scope="col">학번</th>
                          <th scope="col">이름</th>
                          <th scope="col">출석 차시</th>
                          <th scope="col">지각 차시</th>
                          <th scope="col">결석 차시</th>
                          <th scope="col">공결 차시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceStudentStats.rows.map((row) => (
                          <tr key={`attendance-stat-${row.student_id}`}>
                            <td>{row.student_id}</td>
                            <td>{row.student_name}</td>
                            <td>{row.present}</td>
                            <td>{row.late}</td>
                            <td>{row.absent}</td>
                            <td>{row.official}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-state">학생별 누계 통계를 불러오는 중입니다.</p>
                )}
              </SectionCard>
            ) : null}

            {showProfessorTimer ? (
              <SectionCard title="스마트 출석 진행" action={<span className="caption-text">출석 세션 #{routeSessionId ?? selectedAttendanceSlot?.session_id ?? '-'}</span>}>
                <div className="attendance-slot-toolbar">
                  <button type="button" className="text-button" onClick={() => navigate(safeAttendanceRoute(selectedCourse?.course_code ?? '', 'timeline'))}>
                    타임라인으로
                  </button>
                  {selectedAttendanceSlot?.session_id ? (
                    <button type="button" className="secondary-button" onClick={() => void closeAttendanceSession(selectedAttendanceSlot.session_id!)}>
                      출석 종료
                    </button>
                  ) : null}
                </div>
                <div className="helper-list">
                  <div className="helper-row">
                    <strong>포함 차시</strong>
                    <span>{bundleSlots.map((slot) => `${slot.lesson_index_within_week}차시 ${slot.period_label}`).join(' · ')}</span>
                  </div>
                  <div className="helper-row">
                    <strong>Anchor 차시</strong>
                    <span>{selectedAttendanceSlot?.lesson_index_within_week}차시 · {selectedAttendanceSlot?.period_label}</span>
                  </div>
                  <div className="helper-row">
                    <strong>상태</strong>
                    <span>{selectedAttendanceSlot?.session_status ?? selectedAttendanceSlot?.slot_state ?? '-'}</span>
                  </div>
                  <div className="helper-row">
                    <strong>남은 시간</strong>
                    <span>{formatCountdown(selectedAttendanceSlot?.expires_at)}</span>
                  </div>
                </div>
                {attendanceRoster ? (
                  <div className="attendance-live-roster">
                    <div className="attendance-live-roster-head">
                      <strong>실시간 학생 현황</strong>
                      <span className="caption-text">학번 / 이름 / 체크 여부</span>
                    </div>
                    <div className="attendance-roster-scroll">
                      <table className="attendance-live-table">
                        <thead>
                          <tr>
                            <th scope="col">학번</th>
                            <th scope="col">이름</th>
                            <th scope="col">체크</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceRoster.students.map((student) => (
                            <tr key={student.student_id}>
                              <td className="attendance-roster-id-cell">{student.student_id}</td>
                              <td className="attendance-roster-name-cell">{student.student_name}</td>
                              <td>
                                <span className={`attendance-live-mark${isLiveCheckedIn(student.final_status) ? ' attendance-live-mark--checked' : ' attendance-live-mark--unchecked'}`}>
                                  {isLiveCheckedIn(student.final_status) ? 'O' : 'X'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">학생 체크 현황을 불러오는 중입니다.</p>
                )}
              </SectionCard>
            ) : null}

            {showProfessorRoster && selectedAttendanceSlot ? (
              <SectionCard
                title={routeSessionId != null ? '학생 목록 · 출석 현황' : '차시 예외 수정 · 출석 현황'}
                action={<span className="caption-text">{selectedAttendanceSlot.display_label}</span>}
              >
                <div className="attendance-slot-toolbar">
                  <button type="button" className="text-button" onClick={() => navigate(safeAttendanceRoute(selectedAttendanceSlot.course_code, 'timeline'))}>
                    타임라인으로
                  </button>
                  <span className="status-pill status-pill--ok">
                    {routeSessionId != null
                      ? selectedAttendanceSlot.session_mode === 'smart'
                        ? '스마트 출석'
                        : selectedAttendanceSlot.slot_state === 'canceled'
                          ? '휴강'
                          : selectedAttendanceSlot.slot_state === 'unchecked'
                            ? '미체크'
                            : '일반 출석'
                      : '차시 예외 수정'}
                  </span>
                </div>
                <div className="helper-list">
                  <div className="helper-row">
                    <strong>{routeSessionId != null ? '포함 차시' : '예외 수정 차시'}</strong>
                    <span>
                      {routeSessionId != null
                        ? bundleSlots.map((slot) => `${slot.lesson_index_within_week}차시 ${slot.period_label}`).join(' · ')
                        : `${selectedAttendanceSlot.lesson_index_within_week}차시 ${selectedAttendanceSlot.period_label}`}
                    </span>
                  </div>
                  {routeSessionId != null ? (
                    <div className="helper-row">
                      <strong>차시별 예외 수정</strong>
                      <span>
                        {bundleSlots.map((slot) => (
                          <button
                            key={slot.projection_key}
                            type="button"
                            className="text-button"
                            onClick={() =>
                              navigate(
                                safeAttendanceRoute(slot.course_code, 'roster', { projectionKey: slot.projection_key }),
                              )
                            }
                          >
                            {slot.lesson_index_within_week}차시
                          </button>
                        ))}
                      </span>
                    </div>
                  ) : null}
                </div>
                {attendanceRoster ? (
                  <div className="attendance-roster-scroll">
                    <table className="attendance-roster-table">
                      <thead>
                        <tr>
                          <th scope="col">학번</th>
                          <th scope="col">이름</th>
                          <th scope="col">출석 ●</th>
                          <th scope="col">지각 ▲</th>
                          <th scope="col">결석 ✕</th>
                          <th scope="col">공결 ★</th>
                          <th scope="col">사유</th>
                          <th scope="col">동작</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRoster.students.map((student) => {
                          const draft = rosterDrafts[student.student_id] ?? { status: 'absent' as const, reason: '' }
                          const radioName = `attendance-status-${student.student_id}`
                          return (
                            <tr key={student.student_id}>
                              <td className="attendance-roster-id-cell">{student.student_id}</td>
                              <td className="attendance-roster-name-cell">{student.student_name}</td>
                              <td>
                                <label className={`attendance-status-option attendance-status-option--present${draft.status === 'present' ? ' active' : ''}`}>
                                  <input
                                    type="radio"
                                    name={radioName}
                                    checked={draft.status === 'present'}
                                    onChange={() => updateRosterDraft(student.student_id, { status: 'present' })}
                                  />
                                  <span>●</span>
                                </label>
                              </td>
                              <td>
                                <label className={`attendance-status-option attendance-status-option--late${draft.status === 'late' ? ' active' : ''}`}>
                                  <input
                                    type="radio"
                                    name={radioName}
                                    checked={draft.status === 'late'}
                                    onChange={() => updateRosterDraft(student.student_id, { status: 'late' })}
                                  />
                                  <span>▲</span>
                                </label>
                              </td>
                              <td>
                                <label className={`attendance-status-option attendance-status-option--absent${draft.status === 'absent' ? ' active' : ''}`}>
                                  <input
                                    type="radio"
                                    name={radioName}
                                    checked={draft.status === 'absent'}
                                    onChange={() => updateRosterDraft(student.student_id, { status: 'absent' })}
                                  />
                                  <span>✕</span>
                                </label>
                              </td>
                              <td>
                                <label className={`attendance-status-option attendance-status-option--official${draft.status === 'official' ? ' active' : ''}`}>
                                  <input
                                    type="radio"
                                    name={radioName}
                                    checked={draft.status === 'official'}
                                    onChange={() => updateRosterDraft(student.student_id, { status: 'official' })}
                                  />
                                  <span>★</span>
                                </label>
                              </td>
                              <td>
                                <input
                                  className="attendance-reason-input"
                                  value={draft.reason}
                                  onChange={(event) => updateRosterDraft(student.student_id, { reason: event.target.value })}
                                  placeholder="사유 입력"
                                />
                              </td>
                              <td>
                                <div className="attendance-row-actions">
                                  {attendanceRoster.session.session_id ? (
                                    <button type="button" onClick={() => void submitRosterUpdate(student.student_id)}>저장</button>
                                  ) : null}
                                  <button type="button" className="text-button" onClick={() => void loadAttendanceHistory(student.student_id)}>
                                    이력
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-state">학생 목록을 불러오는 중입니다.</p>
                )}
              </SectionCard>
            ) : null}
            {attendanceMessage ? <p className="success-text">{attendanceMessage}</p> : null}

            {!showProfessorTimer && !showProfessorRoster ? (
            <SectionCard title="학기별 출석 타임라인">
              {attendanceTimeline?.weeks.length ? (
                <div className="attendance-timeline">
                  {attendanceTimeline.weeks.map((week) => (
                    <section key={week.week_index} className="attendance-week-block">
                      <header className="attendance-week-head">
                        <strong>{week.week_index}주차</strong>
                        <span>{week.week_start} ~ {week.week_end}</span>
                      </header>
                      <div className="attendance-slot-list">
                        {week.slots.map((slot) => {
                          const badge = getSlotBadge(slot)
                          const isSelected = routeSessionId != null
                            ? slot.session_id != null && slot.session_id === routeSessionId
                            : selectedAttendanceSlot?.projection_key === slot.projection_key
                          return (
                            <article key={slot.projection_key} className={`attendance-slot-row${isSelected ? ' active' : ''}`}>
                              <button
                                type="button"
                                className="attendance-slot-toggle"
                                onClick={() => openAttendanceModal(slot)}
                                aria-label={`${slot.display_label} 선택`}
                              >
                                <span className={badge.className}>{badge.symbol}</span>
                              </button>
                              <button type="button" className="attendance-slot-main" onClick={() => handleAttendanceRowClick(slot)}>
                                <div className="attendance-slot-title">
                                  <strong>{slot.lesson_index_within_week}차시 · {slot.period_label}</strong>
                                  <span>{slot.session_date}</span>
                                  <span>{slot.professor_name}({slot.professor_login_id})</span>
                                  <span>{slot.classroom_code}</span>
                                  {slot.expires_at ? <span className="caption-text">남은시간 {formatCountdown(slot.expires_at)}</span> : null}
                                </div>
                                <div className="caption-text">{slot.display_label}</div>
                                <div className="attendance-slot-metrics">
                                  <span className="attendance-metric attendance-metric--present">● {slot.aggregate.present}</span>
                                  <span className="attendance-metric attendance-metric--late">▲ {slot.aggregate.late}</span>
                                  <span className="attendance-metric attendance-metric--absent">✕ {slot.aggregate.absent}</span>
                                  <span className="attendance-metric attendance-metric--official">★ {slot.aggregate.official}</span>
                                </div>
                              </button>
                            </article>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="empty-state">표시할 출석 차시가 없습니다.</p>
              )}
            </SectionCard>
            ) : null}

            {attendanceModalOpen && attendanceModalAnchorSlot ? (
              <div className="attendance-modal-backdrop" role="presentation" onClick={() => setAttendanceModalOpen(false)}>
                <div className="attendance-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="attendance-modal-head">
                    <strong>출석 시작 · {attendanceModalAnchorSlot.session_date}</strong>
                    <button type="button" className="text-button" onClick={() => setAttendanceModalOpen(false)}>닫기</button>
                  </div>
                  <div className="attendance-mode-group">
                    {([
                      ['manual', '일반출석'],
                      ['smart', '스마트출석'],
                      ['canceled', '휴강'],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`filter-chip${selectedAttendanceMode === mode ? ' active' : ''}`}
                        onClick={() => setSelectedAttendanceMode(mode)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="attendance-modal-slot-list">
                    {modalDateSlots.map((slot) => (
                      <label key={slot.projection_key} className="attendance-modal-slot-option">
                        <input
                          type="checkbox"
                          checked={selectedBatchProjectionKeys.includes(slot.projection_key)}
                          onChange={() => toggleModalProjectionKey(slot.projection_key)}
                        />
                        <span>{slot.lesson_index_within_week}차시 · {slot.period_label} · {slot.slot_state}</span>
                      </label>
                    ))}
                  </div>
                  <div className="attendance-modal-actions">
                    <span className="caption-text">선택된 차시 {selectedBatchProjectionKeys.length}건</span>
                    <button type="button" onClick={() => void applyAttendanceBatch()} disabled={selectedBatchProjectionKeys.length === 0}>
                      선택 차시에 적용
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {attendanceHistory ? (
              <div className="attendance-modal-backdrop" role="presentation" onClick={() => setAttendanceHistory(null)}>
                <div className="attendance-modal attendance-modal--history" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="attendance-modal-head">
                    <strong>학생 출석 이력 · {attendanceHistory.student_name}</strong>
                    <button type="button" className="text-button" onClick={() => setAttendanceHistory(null)}>닫기</button>
                  </div>
                  <span className="caption-text">삭제 불가 이력</span>
                  <div className="attendance-history-list">
                    {attendanceHistory.entries.map((entry) => (
                      <article key={entry.audit_id} className="attendance-history-item">
                        <div className="attendance-history-head">
                          <strong>{entry.new_status ?? '상태 없음'}</strong>
                          <span>{entry.changed_at}</span>
                        </div>
                        <p>{entry.actor_name}({entry.actor_login_id}) · {entry.change_source}</p>
                        <p>{entry.previous_status ?? '-'} → {entry.new_status ?? '-'}</p>
                        <p>사유: {entry.reason ?? '-'}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {isStudent ? (
          <SectionCard title="확인 결과">
            {eligibility ? (
              <div className="result-card">
                <div className="result-summary">
                  <span className={`status-pill status-pill--${eligibility.eligible ? 'ok' : 'blocked'}`}>
                    {eligibility.eligible ? '이용 가능' : '이용 불가'}
                  </span>
                  <p>{getEligibilityReasonLabel(eligibility.reason_code)}</p>
                  <span className="caption-text">reason_code: {eligibility.reason_code}</span>
                </div>
                <div className="detail-grid">
                  <div>
                    <dt>등록 단말</dt>
                    <dd>{eligibility.matched_device_mac ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>관측 시각</dt>
                    <dd>{eligibility.observed_at ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>스냅샷 지연</dt>
                    <dd>{eligibility.snapshot_age_seconds ?? '-'}초</dd>
                  </div>
                </div>
                <pre>{formatJson(eligibility.evidence)}</pre>
              </div>
            ) : (
              <p className="empty-state">아직 확인 결과가 없습니다.</p>
            )}
          </SectionCard>
        ) : null}
      </div>
    )
  }

  function renderStudentExamSection() {
    return (
      <div className="course-stack exam-space exam-space--student">
        <SectionCard
          title="응시 가능한 시험"
          action={<span className="info-chip">총 {studentExams.length}건</span>}
        >
          {examLoading ? <p className="empty-state">시험 정보를 불러오는 중입니다.</p> : null}
          {!examLoading && studentExams.length === 0 ? <p className="empty-state">현재 확인 가능한 시험이 없습니다.</p> : null}
          {studentExams.length > 0 ? (
            <div className="exam-list-grid">
              {studentExams.map((exam) => (
                <article key={exam.id} className="exam-list-card exam-list-card--student">
                  {(() => {
                    const statusMeta = getStudentExamStatusMeta(exam)
                    const durationMeta = getStudentExamDurationMeta(exam)
                    return (
                      <>
                  <div className="exam-list-card-top">
                    <div className="exam-card-copy">
                      <span className="caption-text">{selectedCourse?.course_code}</span>
                      <h4>{exam.title}</h4>
                      {exam.description ? <p>{exam.description}</p> : null}
                    </div>
                    <span className={`status-pill status-pill--${statusMeta.tone}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="exam-fact-grid">
                    <article className="exam-fact-card">
                      <span>시험 구분</span>
                      <strong>{EXAM_TYPE_LABEL[exam.exam_type]}</strong>
                    </article>
                    <article className="exam-fact-card">
                      <span>{durationMeta.label}</span>
                      <strong>{durationMeta.value}</strong>
                    </article>
                    <article className="exam-fact-card">
                      <span>응시 현황</span>
                      <strong>{exam.attempts_used}/{exam.max_attempts}</strong>
                    </article>
                    <article className="exam-fact-card exam-fact-card--wide">
                      <span>시험 일정</span>
                      <strong>{formatExamWindow(exam.starts_at, exam.ends_at)}</strong>
                    </article>
                  </div>
                  <div className="exam-detail-actions">
                    {(exam.availability?.can_start ?? false) || exam.attempt?.status === 'in_progress' ? (
                      <button
                        type="button"
                        onClick={() => void handleStudentExamStart(exam.id)}
                        disabled={examBusyKey === `start-${exam.id}`}
                      >
                        {exam.attempt?.status === 'in_progress' ? '응시 이어하기' : '응시 시작'}
                      </button>
                    ) : null}
                  </div>
                      </>
                    )
                  })()}
                </article>
              ))}
            </div>
          ) : null}
        </SectionCard>
      </div>
    )
  }

  function renderProfessorExamSection() {
    const isEditing = professorExamDraft.examId != null
    return (
      <div className="course-stack exam-space">
        {examMessage ? <p className="banner">{examMessage}</p> : null}
        <SectionCard title={isEditing ? '시험 편집' : '시험 작성'}>
          <form className="stack exam-form-shell" onSubmit={handleProfessorExamSubmit}>
            <div className="exam-form-grid">
              <section className="exam-form-section">
                <div className="exam-form-section-head">
                  <strong>기본 정보</strong>
                  <span className="caption-text">시험명과 시험 종류를 먼저 정리합니다.</span>
                </div>
                <div className="exam-form-grid exam-form-grid--compact">
                  <label>
                    시험명
                    <input
                      value={professorExamDraft.title}
                      onChange={(event) => updateProfessorExamDraft('title', event.target.value)}
                      placeholder="예: 자료구조 중간고사"
                    />
                  </label>
                  <label>
                    시험 구분
                    <select
                      value={professorExamDraft.examType}
                      onChange={(event) => updateProfessorExamDraft('examType', event.target.value as ProfessorExamDraft['examType'])}
                    >
                      <option value="midterm">중간고사</option>
                      <option value="final">기말고사</option>
                    </select>
                  </label>
                </div>
                <label>
                  설명
                  <textarea
                    value={professorExamDraft.description}
                    onChange={(event) => updateProfessorExamDraft('description', event.target.value)}
                    rows={3}
                    placeholder="학생에게 보여줄 간단한 안내를 입력하세요."
                  />
                </label>
              </section>

              <section className="exam-form-section">
                <div className="exam-form-section-head">
                  <strong>일정 및 응시 설정</strong>
                </div>
                <div className="exam-form-stack">
                  <label>
                    시작 시각
                    <input
                      type="datetime-local"
                      value={professorExamDraft.startsAt}
                      onChange={(event) => updateProfessorExamDraft('startsAt', event.target.value)}
                    />
                  </label>
                  <label>
                    종료 시각
                    <input
                      type="datetime-local"
                      value={professorExamDraft.endsAt}
                      onChange={(event) => updateProfessorExamDraft('endsAt', event.target.value)}
                    />
                  </label>
                </div>
                <div className="exam-form-grid exam-form-grid--compact">
                  <label>
                    시험 시간(분)
                    <input
                      value={professorExamDraft.durationMinutes}
                      onChange={(event) => updateProfessorExamDraft('durationMinutes', event.target.value)}
                    />
                  </label>
                  <label>
                    최대 응시 횟수
                    <input
                      value={professorExamDraft.maxAttempts}
                      onChange={(event) => updateProfessorExamDraft('maxAttempts', event.target.value)}
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="exam-toggle-row">
              <label className="exam-toggle-card">
                <span>지각 입장 허용</span>
                <input
                  type="checkbox"
                  checked={professorExamDraft.lateEntryAllowed}
                  onChange={(event) => updateProfessorExamDraft('lateEntryAllowed', event.target.checked)}
                />
              </label>
              <label className="exam-toggle-card">
                <span>자동 제출 사용</span>
                <input
                  type="checkbox"
                  checked={professorExamDraft.autoSubmitEnabled}
                  onChange={(event) => updateProfessorExamDraft('autoSubmitEnabled', event.target.checked)}
                />
              </label>
            </div>

            <div className="exam-builder-list">
              {professorExamDraft.questions.map((question, questionIndex) => (
                <article key={questionIndex} className="exam-builder-card">
                  <header className="exam-builder-card-head">
                    <div>
                      <h4>기본 객관식 문항</h4>
                    </div>
                    <div className="exam-builder-actions">
                      <span className="info-chip">{professorExamDraft.questions.length}문항</span>
                      {professorExamDraft.questions.length > 1 ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => removeProfessorExamQuestion(questionIndex)}
                        >
                          문항 삭제
                        </button>
                      ) : null}
                    </div>
                  </header>
                  <div className="stack">
                    <label>
                      문제
                      <textarea
                        value={question.prompt}
                        onChange={(event) => updateProfessorExamQuestion(questionIndex, 'prompt', event.target.value)}
                        rows={3}
                        placeholder="문항 내용을 입력하세요."
                      />
                    </label>
                    <div className="detail-grid">
                      <label>
                        배점
                        <input
                          value={question.points}
                          onChange={(event) => updateProfessorExamQuestion(questionIndex, 'points', event.target.value)}
                        />
                      </label>
                      <label>
                        정답 보기
                        <select
                          value={question.correctOptionOrder}
                          onChange={(event) =>
                            updateProfessorExamQuestion(questionIndex, 'correctOptionOrder', Number(event.target.value))
                          }
                        >
                          {[1, 2, 3, 4].map((order) => (
                            <option key={order} value={order}>{order}번</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="exam-option-list">
                      {question.optionTexts.map((optionText, optionIndex) => (
                        <label key={optionIndex}>
                          보기 {optionIndex + 1}
                          <input
                            value={optionText}
                            onChange={(event) => updateProfessorExamOption(questionIndex, optionIndex, event.target.value)}
                            placeholder={`보기 ${optionIndex + 1}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="exam-detail-actions">
              <button type="button" className="secondary-button" onClick={addProfessorExamQuestion}>
                문항 추가
              </button>
              <button type="submit" disabled={examBusyKey === 'draft-submit'}>
                {isEditing ? '변경 저장' : '초안 저장'}
              </button>
              {isEditing ? (
                <button type="button" className="secondary-button" onClick={resetProfessorExamDraftForm}>
                  새 초안 작성
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="시험 목록" action={<span className="info-chip">{professorExams.length}건</span>}>
          {examLoading ? <p className="empty-state">시험 목록을 불러오는 중입니다.</p> : null}
          {!examLoading && professorExams.length === 0 ? <p className="empty-state">등록된 시험이 없습니다.</p> : null}
          {professorExams.length > 0 ? (
            <div className="exam-list-grid">
              {professorExams.map((exam) => (
                <article key={exam.id} className="exam-list-card exam-list-card--professor">
                  {(() => {
                    const statusMeta = getProfessorExamStatusMeta(exam)
                    return (
                      <>
                  <div className="exam-list-card-top">
                    <div className="exam-card-copy">
                      <span className="caption-text">{selectedCourse?.course_code}</span>
                      <h4>{exam.title}</h4>
                    </div>
                    <span className={`status-pill status-pill--${statusMeta.tone}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <p>{exam.description || '설명이 아직 없습니다.'}</p>
                  <div className="exam-fact-grid">
                    <article className="exam-fact-card">
                      <span>시험 구분</span>
                      <strong>{EXAM_TYPE_LABEL[exam.exam_type]}</strong>
                    </article>
                    <article className="exam-fact-card">
                      <span>응시 시간</span>
                      <strong>{exam.duration_minutes}분</strong>
                    </article>
                    <article className="exam-fact-card exam-fact-card--wide">
                      <span>시험 일정</span>
                      <strong>{formatExamWindow(exam.starts_at, exam.ends_at)}</strong>
                    </article>
                    <article className="exam-fact-card">
                      <span>응시 횟수</span>
                      <strong>{exam.max_attempts}회</strong>
                    </article>
                  </div>
                  <div className="exam-detail-actions">
                    <button type="button" className="text-button" onClick={() => void openProfessorExamDetail(exam.id)}>
                      상세 보기
                    </button>
                    {exam.status === 'draft' ? (
                      <button type="button" className="text-button" onClick={() => void openProfessorExamDetail(exam.id, { loadIntoDraft: true })}>
                        편집
                      </button>
                    ) : null}
                  </div>
                      </>
                    )
                  })()}
                </article>
              ))}
            </div>
          ) : null}
        </SectionCard>

        {professorExamDetail ? (
          <SectionCard
            title={`시험 상세 · ${professorExamDetail.title}`}
            action={(() => {
              const statusMeta = getProfessorExamStatusMeta(professorExamDetail)
              return <span className={`status-pill status-pill--${statusMeta.tone}`}>{statusMeta.label}</span>
            })()}
          >
            <div className="exam-detail-grid">
              <article className="exam-detail-panel exam-detail-panel--summary">
                <div className="exam-fact-grid">
                  <article className="exam-fact-card">
                    <span>시험 구분</span>
                    <strong>{EXAM_TYPE_LABEL[professorExamDetail.exam_type]}</strong>
                  </article>
                  <article className="exam-fact-card">
                    <span>응시 시간</span>
                    <strong>{professorExamDetail.duration_minutes}분</strong>
                  </article>
                  <article className="exam-fact-card exam-fact-card--wide">
                    <span>시험 일정</span>
                    <strong>{formatExamWindow(professorExamDetail.starts_at, professorExamDetail.ends_at)}</strong>
                  </article>
                  <article className="exam-fact-card">
                    <span>재실 확인</span>
                    <strong>{professorExamDetail.requires_presence ? '사용' : '미사용'}</strong>
                  </article>
                  <article className="exam-fact-card">
                    <span>응시 횟수</span>
                    <strong>{professorExamDetail.max_attempts}회</strong>
                  </article>
                </div>
                <div className="exam-detail-actions">
                  {professorExamDetail.status === 'draft' ? (
                    <>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void handleProfessorExamStatusAction(professorExamDetail.id, 'publish')}
                        disabled={examBusyKey === `publish-${professorExamDetail.id}`}
                      >
                        공개
                      </button>
                    </>
                  ) : null}
                  {(professorExamDetail.status === 'published' || professorExamDetail.status === 'open') ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void handleProfessorExamStatusAction(professorExamDetail.id, 'close')}
                      disabled={examBusyKey === `close-${professorExamDetail.id}`}
                    >
                      종료
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-button exam-action-link--danger"
                    onClick={() => void handleProfessorExamDelete(professorExamDetail.id)}
                    disabled={examBusyKey === `delete-${professorExamDetail.id}`}
                  >
                    삭제
                  </button>
                </div>
              </article>

              <article className="exam-detail-panel exam-detail-panel--submissions">
                <header className="section-head">
                  <h3>응시 현황</h3>
                  <span className="caption-text">{professorExamDetail.submissions.length}명</span>
                </header>
                {professorExamDetail.submission_overview ? (
                  <div className="exam-metric-grid">
                    <article className="metric-card"><strong>{professorExamDetail.submission_overview.started_students}</strong><span>응시 시작</span></article>
                    <article className="metric-card"><strong>{professorExamDetail.submission_overview.submitted_students}</strong><span>제출 완료</span></article>
                    <article className="metric-card"><strong>{professorExamDetail.submission_overview.average_score ?? '-'}</strong><span>평균 점수</span></article>
                  </div>
                ) : null}
                <div className="exam-submission-list">
                  {professorExamDetail.submissions.map((submission) => (
                    <article key={`${submission.student_id}-${submission.attempt_no ?? 0}`} className="exam-submission-item">
                      {(() => {
                        const statusMeta = getExamSubmissionStatusMeta(submission.status)
                        return (
                          <>
                      <div className="exam-list-card-top">
                        <strong>{submission.student_name}</strong>
                        <span className={`status-pill status-pill--${statusMeta.tone}`}>{statusMeta.label}</span>
                      </div>
                      <p>{submission.student_id} · {submission.answered_count}/{submission.total_count} 문항</p>
                      <p>점수 {submission.score ?? '-'} / {submission.max_score}</p>
                          </>
                        )
                      })()}
                    </article>
                  ))}
                </div>
              </article>
            </div>
          </SectionCard>
        ) : null}
      </div>
    )
  }

  function renderStudentExamModePage() {
    const detail = studentExamDetail
    const questions = detail?.questions ?? []
    const currentQuestion = questions[studentExamQuestionIndex] ?? null
    const answeredCount = questions.filter((question) => question.selected_option_id != null).length
    const targetEnd = detail?.attempt?.expires_at ?? detail?.ends_at ?? null
    const remainingSeconds = targetEnd ? Math.max(0, Math.floor((new Date(targetEnd).getTime() - examNow) / 1000)) : 0
    const remainingMinutes = Math.floor(remainingSeconds / 60)
    const remainingRemainSeconds = remainingSeconds % 60

    return (
      <main className="exam-mode-page-shell">
        <div className="exam-mode-masthead">
          <div>
            <span className="caption-text">{selectedCourse?.course_code ?? ''}</span>
            <h1>{detail?.title ?? '시험 응시'}</h1>
          </div>
          <div className="exam-mode-masthead-status">
            <span className="status-pill status-pill--ok">시험 응시 중</span>
            <span className="info-chip">남은 시간 {remainingMinutes}:{String(remainingRemainSeconds).padStart(2, '0')}</span>
          </div>
        </div>

        {!detail || !currentQuestion ? (
          <section className="exam-mode-panel exam-mode-panel--hero">
            <p className="empty-state">시험 정보를 불러오는 중입니다.</p>
          </section>
        ) : (
          <div className="exam-mode-layout">
            <div className="exam-side-section">
              <section className="exam-mode-panel exam-mode-panel--question">
                <div className="exam-question-shell-head">
                  <div className="exam-progress-copy">
                    <h2>{currentQuestion.question_order}번 문항</h2>
                  </div>
                  <span className="info-chip">{currentQuestion.points}점</span>
                </div>
                <p className="exam-question-prompt">{currentQuestion.prompt}</p>
                <div className="exam-option-list">
                  {currentQuestion.options.map((option) => (
                    <label
                      key={option.id}
                      className={`exam-option-card exam-option-card--immersive${currentQuestion.selected_option_id === option.id ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        checked={currentQuestion.selected_option_id === option.id}
                        onChange={() => void handleStudentExamOptionSelect(currentQuestion, option.id)}
                      />
                      <span className="exam-option-order">{option.option_order}</span>
                      <span className="exam-option-copy">
                        <span>{option.option_text}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="exam-inline-actions exam-inline-actions--primary">
                  <button
                    type="button"
                    className="text-button exam-nav-action exam-nav-action--ghost"
                    onClick={() => setStudentExamQuestionIndex((current) => Math.max(0, current - 1))}
                    disabled={studentExamQuestionIndex === 0}
                  >
                    이전 문항
                  </button>
                  {studentExamQuestionIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      className="exam-nav-action exam-nav-action--primary"
                      onClick={() => setStudentExamQuestionIndex((current) => Math.min(questions.length - 1, current + 1))}
                    >
                      다음 문항
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="exam-nav-action exam-nav-action--submit"
                      onClick={() => void handleStudentExamSubmit()}
                      disabled={examBusyKey === `submit-${detail.id}`}
                    >
                      답안 제출
                    </button>
                  )}
                </div>
              </section>
            </div>

            <aside className="exam-mode-sidebar">
              <section className="exam-mode-panel exam-mode-panel--sidebar">
                <div className="exam-side-section">
                  <div className="exam-side-section-head">
                    <strong>시험 문제</strong>
                    <span className="caption-text exam-mode-count">{answeredCount}/{questions.length}</span>
                  </div>
                  <div className="exam-nav-grid exam-nav-grid--immersive exam-nav-grid--stacked">
                    {questions.map((question, index) => (
                      <button
                        key={question.id}
                        type="button"
                        className={`exam-nav-button${question.selected_option_id != null ? ' is-answered' : ''}${index === studentExamQuestionIndex ? ' is-active' : ''}`}
                        onClick={() => setStudentExamQuestionIndex(index)}
                      >
                        <span>{question.question_order}번</span>
                        <small>{question.selected_option_id != null ? '완료' : '대기'}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </aside>
          </div>
        )}
        {studentExamSubmitWarning.length > 0 ? (
          <div className="exam-submit-warning-backdrop" role="presentation" onClick={() => setStudentExamSubmitWarning([])}>
            <div className="exam-submit-warning-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <div className="exam-submit-warning-head">
                <strong>아직 답하지 않은 문제가 있어요.</strong>
                <button type="button" className="text-button" onClick={() => setStudentExamSubmitWarning([])}>닫기</button>
              </div>
              <p>
                미응답 문항: {studentExamSubmitWarning.map((questionOrder) => `${questionOrder}번`).join(', ')}
              </p>
              <span className="caption-text">첫 번째 미응답 문항으로 이동했습니다. 모든 문제를 답해야 제출할 수 있습니다.</span>
              <div className="exam-submit-warning-actions">
                <button type="button" onClick={() => setStudentExamSubmitWarning([])}>확인</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    )
  }

  function renderCourseExams() {
    if (isStudent) {
      return renderStudentExamSection()
    }
    if (isProfessor) {
      return renderProfessorExamSection()
    }
    return (
      <SectionCard title="시험">
        <p className="empty-state">관리자 계정에서는 시험 화면을 직접 사용할 수 없습니다.</p>
      </SectionCard>
    )
  }

  function renderCoursePage() {
    if (!selectedCourse) {
      return (
        <section className="section-card">
          <p className="empty-state">강의를 선택하면 상세 화면이 열립니다.</p>
        </section>
      )
    }

    return (
      <section className="course-layout">
        <aside className="course-sidebar">
          <SectionCard title="기능 메뉴" compact>
            <div className="menu-group">
              <p className="menu-group-title">공통 메뉴</p>
              {courseMenuItems.slice(0, 2).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`menu-button${courseSection === item.id ? ' active' : ''}`}
                  onClick={() => selectedCourse && navigate({ kind: 'course', courseCode: selectedCourse.course_code, section: item.id })}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {courseMenuItems.length > 2 ? (
              <div className="menu-group">
                <p className="menu-group-title">{isStudent ? '학습 지원' : '권한별 기능'}</p>
                {courseMenuItems.slice(2).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`menu-button${courseSection === item.id ? ' active' : ''}`}
                    onClick={() => selectedCourse && navigate({ kind: 'course', courseCode: selectedCourse.course_code, section: item.id })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="강의 정보" compact>
            <div className="helper-list">
              <div className="helper-row">
                <strong>강의 코드</strong>
                <span>{selectedCourse.course_code}</span>
              </div>
              <div className="helper-row">
                <strong>담당 교수</strong>
                <span>{selectedCourse.professor_name ?? '-'}</span>
              </div>
              <div className="helper-row">
                <strong>강의실</strong>
                <span>{selectedCourse.classroom_code ?? '-'}</span>
              </div>
            </div>
          </SectionCard>
        </aside>

        <div className="course-main">
          {courseSection === 'overview' ? renderCourseOverview() : null}
          {courseSection === 'content' ? renderCourseContent() : null}
          {courseSection === 'notices' ? renderCourseNotices() : null}
          {courseSection === 'exams' ? renderCourseExams() : null}
          {courseSection === 'attendance' ? renderCourseAttendance() : null}
          {courseSection === 'manage' ? renderCourseManage() : null}
        </div>
      </section>
    )
  }

  if (!authReady) {
    return (
      <main className="auth-page">
        <section className="auth-layout">
          <article className="section-card auth-card">
            <header className="section-head">
              <h3>세션 확인 중</h3>
              <span className="caption-text">로그인 상태와 경로를 복구하고 있습니다.</span>
            </header>
            <p className="empty-state">잠시만 기다려주세요.</p>
          </article>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    return renderLoginPage()
  }

  if (inStudentExamMode) {
    return renderStudentExamModePage()
  }

  return (
    <>
      <ul className="skip-links">
        <li>
          <a href="#main-content">본문 바로가기</a>
        </li>
        <li>
          <a href="#main-nav">주 메뉴 바로가기</a>
        </li>
      </ul>

      <main className="page-shell">
        <div className="page-inner">
          {renderUtilityBar()}
          {renderHeader()}
          {error ? <p className="banner banner--error">{error}</p> : null}
          {renderPageLead()}
          <div id="main-content">
            {view === 'dashboard' ? renderDashboard() : null}
            {view === 'profile' ? renderProfile() : null}
            {view === 'course' ? renderCoursePage() : null}
            {view === 'notice' ? renderNoticePage() : null}
          </div>
        </div>
      </main>
    </>
  )
}

export default App
