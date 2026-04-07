import { useEffect, useMemo, useState, useTransition } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  type AdminPresenceOverlayRequest,
  type AdminPresenceSnapshot,
  type AdminPresenceStation,
  api,
  formatJson,
  setAccessToken,
  type Classroom,
  type ClassroomNetwork,
  type Course,
  type Device,
  type EligibilityResponse,
  type LoginUser,
  type Notice,
  type UserSummary,
} from './api'

type AppView = 'dashboard' | 'profile' | 'course' | 'notice'
type CourseSection = 'overview' | 'content' | 'notices' | 'attendance' | 'manage'

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

const PURPOSE_LABEL: Record<'attendance' | 'exam', string> = {
  attendance: '출석',
  exam: '시험',
}

const LEARNING_KIND_LABEL: Record<LearningItem['kind'], string> = {
  material: '자료',
  video: '영상',
}

const DEMO_STUDENT_LOGIN_ID = '20201239'
const DEMO_DEVICE_MAC = '52:54:00:12:34:56'

function getEligibilityReasonLabel(reasonCode?: string | null) {
  switch (reasonCode) {
    case 'OK':
      return '현재 조건에서 출석 또는 시험 확인이 가능합니다.'
    case 'OUTSIDE_CLASS_WINDOW':
      return '현재 수업 시간이 아니어서 확인이 제한되었습니다.'
    case 'DEVICE_NOT_REGISTERED':
      return '등록된 단말 정보가 없어 재실 판정을 진행할 수 없습니다.'
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

function App() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [currentUser, setCurrentUser] = useState<LoginUser | null>(null)
  const [view, setView] = useState<AppView>('dashboard')
  const [courseSection, setCourseSection] = useState<CourseSection>('overview')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
  const [noticeReturnView, setNoticeReturnView] = useState<AppView>('dashboard')

  const [studentId, setStudentId] = useState('20201234')
  const [label, setLabel] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [courseId, setCourseId] = useState('CSE101')
  const [classroomId, setClassroomId] = useState('B101')
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const [purpose, setPurpose] = useState<'attendance' | 'exam'>('attendance')
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
  const [presenceControlClassroom, setPresenceControlClassroom] = useState('B101')
  const [presenceControlMac, setPresenceControlMac] = useState(DEMO_DEVICE_MAC)
  const [presenceControlApId, setPresenceControlApId] = useState('phy3-ap0')
  const [presenceControlPresent, setPresenceControlPresent] = useState(true)
  const [presenceControlAssociated, setPresenceControlAssociated] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking')
  const [isPending, startTransition] = useTransition()

  const isStudent = currentUser?.role === 'student'
  const isProfessor = currentUser?.role === 'professor'
  const isAdmin = currentUser?.role === 'admin'

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

  async function refreshDevices(nextStudentId: string) {
    try {
      setError(null)
      const nextDevices = await api.listDevices(nextStudentId)
      setDevices(nextDevices)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : '등록 단말 목록을 불러오지 못했습니다.',
      )
    }
  }

  async function hydrateStudent(studentLoginId: string) {
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
  }

  async function hydrateProfessor(professorLoginId: string, professorName?: string) {
    const [nextCourses, nextNotices] = await Promise.all([
      api.listProfessorCourses(professorLoginId),
      api.listNotices(professorLoginId),
    ])
    setCourses(nextCourses)
    setNotices(nextNotices)
    setLearningItems(createLearningSeed(nextCourses, professorName))
    setSelectedLearningItem(null)
  }

  async function hydrateAdmin() {
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
    setAdminPresenceSnapshots(
      Object.fromEntries(
        presenceEntries.filter((entry): entry is readonly [string, AdminPresenceSnapshot] => Boolean(entry)),
      ),
    )
  }

  async function refreshAdminPresenceSnapshot(classroomCode: string) {
    const snapshot = await api.getAdminPresenceSnapshot(classroomCode)
    setAdminPresenceSnapshots((current) => ({
      ...current,
      [classroomCode]: snapshot,
    }))
    return snapshot
  }

  async function handleApplyPresenceControl(event: FormEvent) {
    event.preventDefault()
    try {
      setError(null)
      const payload: AdminPresenceOverlayRequest = {
        stations: [
          {
            macAddress: presenceControlMac.trim(),
            apId: presenceControlApId.trim() || null,
            present: presenceControlPresent,
            associated: presenceControlPresent ? presenceControlAssociated : false,
          },
        ],
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
      setPresenceControlMac(DEMO_DEVICE_MAC)
      setPresenceControlApId('phy3-ap0')
      setPresenceControlPresent(true)
      setPresenceControlAssociated(true)
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
    setNoticeReturnView('dashboard')
    setCourseSection('overview')
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    try {
      setError(null)
      const result = await api.login({ login_id: loginId, password })
      setAccessToken(result.access_token)
      setCurrentUser(result.user)
      resetRoleData()

      if (result.user.role === 'student') {
        await hydrateStudent(result.user.login_id)
      } else if (result.user.role === 'professor') {
        await hydrateProfessor(result.user.login_id, result.user.name)
      } else {
        await hydrateAdmin()
      }

      setView('dashboard')
    } catch (caughtError) {
      setAccessToken(null)
      setCurrentUser(null)
      resetRoleData()
      setError(caughtError instanceof Error ? caughtError.message : '로그인에 실패했습니다.')
    }
  }

  function handleLogout() {
    setAccessToken(null)
    setCurrentUser(null)
    resetRoleData()
    setError(null)
    setView('dashboard')
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
        const result = await api.checkEligibility({
          student_id: studentId,
          course_id: courseId,
          classroom_id: classroomId,
          purpose,
        })
        setEligibility(result)
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : '출석 또는 시험 확인에 실패했습니다.',
        )
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
        course_code: selectedCourse?.course_code ?? courseId,
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
    setCourseId(course.course_code)
    setClassroomId(course.classroom_code ?? 'B101')
    setEligibility(null)
    setCourseSection('overview')
    setSelectedLearningItem(null)
    setLearningFilter('all')
    setView('course')
  }

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
      setNoticeReturnView(fromView)
      setSelectedNotice(notice)
      setView('notice')
      const detail = await api.getNoticeDetail(currentUser.login_id, notice.id)
      setSelectedNotice(detail)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '공지 상세를 불러오지 못했습니다.')
    }
  }

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
      { id: 'notices', label: '공지사항' },
    ]

    if (isStudent) {
      return [...commonItems, { id: 'attendance', label: '출석 · 시험 확인' }]
    }

    if (isProfessor) {
      return [...commonItems, { id: 'manage', label: '강의 운영' }]
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
          <button type="button" className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
            교육현황
          </button>
          <button type="button" className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>
            내 정보
          </button>
          <button
            type="button"
            className={view === 'course' ? 'active' : ''}
            onClick={() => setView(selectedCourse ? 'course' : 'dashboard')}
            disabled={!selectedCourse}
          >
            강의 상세
          </button>
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
              <button type="button" className="text-button" onClick={() => setView(noticeReturnView)}>
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
          {station.associated ? '연결됨' : '관측 안됨'}
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
              <span>{formatBoardDate(snapshot.observedAt)}</span>
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
      return (
        <section className="content-grid">
          <div className="main-column">
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

            <SectionCard title="강의실 및 네트워크 현황">
              <div className="admin-grid">
                {adminClassrooms.map(renderAdminPresenceCard)}
              </div>
            </SectionCard>

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
                  대상 학생
                  <input value={DEMO_STUDENT_LOGIN_ID} readOnly />
                </label>
                <label>
                  대상 MAC
                  <input value={presenceControlMac} onChange={(event) => setPresenceControlMac(event.target.value)} />
                </label>
                <label>
                  AP ID
                  <input value={presenceControlApId} onChange={(event) => setPresenceControlApId(event.target.value)} />
                </label>
                <label>
                  관측 여부
                  <select
                    value={presenceControlPresent ? 'present' : 'missing'}
                    onChange={(event) => setPresenceControlPresent(event.target.value === 'present')}
                  >
                    <option value="present">관측됨</option>
                    <option value="missing">관측 안됨</option>
                  </select>
                </label>
                <label>
                  연결 상태
                  <select
                    value={presenceControlAssociated ? 'associated' : 'detached'}
                    onChange={(event) => setPresenceControlAssociated(event.target.value === 'associated')}
                    disabled={!presenceControlPresent}
                  >
                    <option value="associated">associated</option>
                    <option value="detached">not associated</option>
                  </select>
                </label>
                <div className="section-head-action">
                  <button type="submit">재실 상태 적용</button>
                  <button type="button" className="secondary-button" onClick={() => void handleResetPresenceControl()}>
                    Overlay 초기화
                  </button>
                </div>
              </form>
            </SectionCard>
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
              <button type="button" onClick={() => setView('profile')}>내 정보</button>
              <button type="button" onClick={() => (selectedCourse ? setView('course') : setView('dashboard'))}>
                강의 상세 열기
              </button>
              {isStudent ? (
                <button type="button" onClick={() => setView('profile')}>등록 단말 관리</button>
              ) : (
                <button type="button" onClick={() => (courses[0] ? openCourse(courses[0]) : setView('dashboard'))}>
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
                <span>과제·자료·출석 집계 기능은 후속 단계에서 확장</span>
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
    return (
      <div className="course-stack">
        {isStudent ? (
          <SectionCard title="출석 · 시험 확인" action={<span className="caption-text">현재 강의 기준으로 확인합니다.</span>}>
            <form className="stack" onSubmit={handleCheckEligibility}>
              <div className="field-grid field-grid--3">
                <label>
                  강의 코드
                  <input value={courseId} onChange={(event) => setCourseId(event.target.value)} />
                </label>
                <label>
                  강의실
                  <input value={classroomId} onChange={(event) => setClassroomId(event.target.value)} />
                </label>
                <label>
                  확인 항목
                  <select
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value as 'attendance' | 'exam')}
                  >
                    <option value="attendance">출석</option>
                    <option value="exam">시험</option>
                  </select>
                </label>
              </div>
              <button type="submit" disabled={isPending}>
                {isPending ? '확인 중...' : `${PURPOSE_LABEL[purpose]} 가능 여부 확인`}
              </button>
            </form>
          </SectionCard>
        ) : (
          <SectionCard title="출석 · 시험 확인">
            <p className="empty-state">학생 계정에서만 출석 및 시험 가능 여부를 확인할 수 있습니다.</p>
          </SectionCard>
        )}

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
      </div>
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
                  onClick={() => setCourseSection(item.id)}
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
                    onClick={() => setCourseSection(item.id)}
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
          {courseSection === 'attendance' ? renderCourseAttendance() : null}
          {courseSection === 'manage' ? renderCourseManage() : null}
        </div>
      </section>
    )
  }

  if (!currentUser) {
    return renderLoginPage()
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
