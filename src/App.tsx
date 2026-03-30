import { useEffect, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import {
  api,
  formatJson,
  type Classroom,
  type ClassroomNetwork,
  type Course,
  type Device,
  type EligibilityResponse,
  type LoginUser,
  type Notice,
  type UserSummary,
} from './api'

type AppView = 'dashboard' | 'profile' | 'course'
type CourseTab = 'notices' | 'eligibility'

function App() {
  const [loginId, setLoginId] = useState('20201234')
  const [password, setPassword] = useState('devpass123')
  const [currentUser, setCurrentUser] = useState<LoginUser | null>(null)
  const [view, setView] = useState<AppView>('dashboard')
  const [courseTab, setCourseTab] = useState<CourseTab>('notices')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  const [studentId, setStudentId] = useState('20201234')
  const [label, setLabel] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [courseId, setCourseId] = useState('CSE101')
  const [classroomId, setClassroomId] = useState('B101')
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const [purpose, setPurpose] = useState<'attendance' | 'exam'>('attendance')

  const [devices, setDevices] = useState<Device[]>([])
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [adminUsers, setAdminUsers] = useState<UserSummary[]>([])
  const [adminClassrooms, setAdminClassrooms] = useState<Classroom[]>([])
  const [adminNetworks, setAdminNetworks] = useState<ClassroomNetwork[]>([])
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
        caughtError instanceof Error ? caughtError.message : '기기 목록을 불러오지 못했습니다.',
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
  }

  async function hydrateProfessor(professorLoginId: string) {
    const [nextCourses, nextNotices] = await Promise.all([
      api.listProfessorCourses(professorLoginId),
      api.listNotices(professorLoginId),
    ])
    setCourses(nextCourses)
    setNotices(nextNotices)
  }

  async function hydrateAdmin() {
    const [users, classrooms, networks] = await Promise.all([
      api.listUsers(),
      api.listClassrooms(),
      api.listClassroomNetworks(),
    ])
    setAdminUsers(users)
    setAdminClassrooms(classrooms)
    setAdminNetworks(networks)
  }

  function resetRoleData() {
    setDevices([])
    setEligibility(null)
    setCourses([])
    setNotices([])
    setAdminUsers([])
    setAdminClassrooms([])
    setAdminNetworks([])
    setSelectedCourse(null)
    setCourseTab('notices')
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
        await hydrateProfessor(result.user.login_id)
      } else {
        await hydrateAdmin()
      }
      setView('dashboard')
    } catch (caughtError) {
      setCurrentUser(null)
      resetRoleData()
      setError(caughtError instanceof Error ? caughtError.message : '로그인에 실패했습니다.')
    }
  }

  function handleLogout() {
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
        setError(caughtError instanceof Error ? caughtError.message : '출석 판정 확인에 실패했습니다.')
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
      setError(caughtError instanceof Error ? caughtError.message : '공지 작성에 실패했습니다.')
    }
  }

  function openCourse(course: Course) {
    setSelectedCourse(course)
    setCourseId(course.course_code)
    setClassroomId(course.classroom_code ?? 'B101')
    setEligibility(null)
    setCourseTab('notices')
    setView('course')
  }

  const courseNotices = (() => {
    if (!selectedCourse) return []
    return notices.filter((notice) => notice.course_code === selectedCourse.course_code)
  })()

  const roleSummary = currentUser
    ? `${currentUser.name} · ${currentUser.role} · ${currentUser.login_id}`
    : '로그인이 필요합니다.'

  function renderLoginPage() {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Smart Class MVP</p>
          <h1>Sign In</h1>
          <p className="hero-copy">
            학생, 교수, 관리자 공통 로그인 화면입니다. 개발용 CSV seed 계정을 사용합니다.
          </p>
          <form className="stack" onSubmit={handleLogin}>
            <label>
              Login ID
              <input
                autoComplete="username"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="20201234 / PRF001 / ADM001"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="devpass123"
              />
            </label>
            <button type="submit">로그인</button>
          </form>
          {error ? <p className="banner banner--error">{error}</p> : null}
        </section>
      </main>
    )
  }

  function renderTopBar() {
    return (
      <header className="topbar">
        <div>
          <p className="eyebrow">Smart Class MVP</p>
          <h1>{view === 'course' && selectedCourse ? selectedCourse.title : 'Learning Workspace'}</h1>
        </div>
        <div className="topbar-actions">
          <span className={`health-pill health-pill--${health}`}>{health}</span>
          <button type="button" className={view === 'dashboard' ? 'secondary-button active-tab' : 'secondary-button'} onClick={() => setView('dashboard')}>
            홈
          </button>
          <button type="button" className={view === 'profile' ? 'secondary-button active-tab' : 'secondary-button'} onClick={() => setView('profile')}>
            프로필
          </button>
          <div className="account-chip">
            <strong>{currentUser?.name}</strong>
            <span>{roleSummary}</span>
          </div>
          <button type="button" className="danger-button" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>
    )
  }

  function renderCourseGrid() {
    return (
      <div className="course-grid">
        {courses.length === 0 ? (
          <p className="empty">표시할 강의가 없습니다.</p>
        ) : (
          courses.map((course) => (
            <button key={course.id} type="button" className="course-card" onClick={() => openCourse(course)}>
              <p className="device-label">{course.course_code}</p>
              <h3>{course.title}</h3>
              <p>{course.professor_name ?? '-'}</p>
              <code>{course.classroom_code ?? '-'}</code>
            </button>
          ))
        )}
      </div>
    )
  }

  function renderDashboard() {
    if (isAdmin) {
      return (
        <section className="grid grid--devices">
          <article className="panel panel--wide">
            <header className="panel-header">
              <h2>Admin Users</h2>
              <p>학생, 교수, 관리자 목록입니다.</p>
            </header>
            <div className="device-list">
              {adminUsers.map((user) => (
                <div key={user.id} className="device-card">
                  <div>
                    <p className="device-label">{user.name}</p>
                    <code>{user.role} / {user.login_id}</code>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel panel--wide">
            <header className="panel-header">
              <h2>Classrooms & Wi-Fi</h2>
              <p>강의실과 AP 매핑 현황입니다.</p>
            </header>
            <div className="device-list">
              {adminClassrooms.map((classroom) => (
                <div key={classroom.id} className="device-card">
                  <div>
                    <p className="device-label">
                      {classroom.classroom_code} · {classroom.name}
                    </p>
                    <code>{classroom.building ?? '-'} / {classroom.floor_label ?? '-'}</code>
                    <pre>
                      {formatJson(
                        adminNetworks.filter((network) => network.classroom_code === classroom.classroom_code),
                      )}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )
    }

    return (
      <section className="grid grid--devices">
        <article className="panel panel--wide">
          <header className="panel-header">
            <h2>Courses</h2>
            <p>클릭하면 강의별 상세 페이지로 이동합니다.</p>
          </header>
          {renderCourseGrid()}
        </article>

        <article className="panel panel--wide">
          <header className="panel-header">
            <h2>Recent Notices</h2>
            <p>최근 공지를 빠르게 확인합니다.</p>
          </header>
          <div className="device-list">
            {notices.length === 0 ? (
              <p className="empty">표시할 공지가 없습니다.</p>
            ) : (
              notices.map((notice) => (
                <div key={notice.id} className="device-card">
                  <div>
                    <p className="device-label">
                      {notice.title} {notice.course_code ? `(${notice.course_code})` : ''}
                    </p>
                    <p>{notice.body}</p>
                    <code>{notice.author_name}</code>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    )
  }

  function renderProfile() {
    return (
      <section className="grid grid--devices">
        <article className="panel">
          <header className="panel-header">
            <h2>Profile</h2>
            <p>계정 정보와 역할 요약입니다.</p>
          </header>
          <div className="stack">
            <label>
              Name
              <input value={currentUser?.name ?? ''} disabled />
            </label>
            <label>
              Role
              <input value={currentUser?.role ?? ''} disabled />
            </label>
            <label>
              Login ID
              <input value={currentUser?.login_id ?? ''} disabled />
            </label>
          </div>
        </article>

        <article className="panel panel--wide">
          <header className="panel-header">
            <h2>Register Device</h2>
            <p>학생 프로필에서 단말 등록과 관리를 수행합니다.</p>
          </header>
          {isStudent ? (
            <form className="stack" onSubmit={handleRegisterDevice}>
              <label>
                Label
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Dev Laptop"
                />
              </label>
              <label>
                MAC Address
                <input
                  value={macAddress}
                  onChange={(event) => setMacAddress(event.target.value)}
                  placeholder="36:68:99:4f:01:db"
                />
              </label>
              <button type="submit">기기 등록</button>
            </form>
          ) : (
            <p className="empty">학생 계정에서만 단말 관리가 활성화됩니다.</p>
          )}
        </article>

        <article className="panel panel--wide">
          <header className="panel-header">
            <h2>Registered Devices</h2>
            <p>현재 등록된 단말 목록입니다.</p>
          </header>
          {isStudent ? (
            <div className="device-list">
              {devices.length === 0 ? (
                <p className="empty">등록된 단말이 없습니다.</p>
              ) : (
                devices.map((device) => (
                  <div key={device.id} className="device-card">
                    <div>
                      <p className="device-label">{device.label}</p>
                      <code>{device.mac_address}</code>
                    </div>
                    <div className="device-actions">
                      <span className={`status-tag status-tag--${device.status}`}>
                        {device.status}
                      </span>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void handleDeleteDevice(device.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="empty">학생 프로필에서만 단말 목록이 표시됩니다.</p>
          )}
        </article>
      </section>
    )
  }

  function renderCoursePage() {
    if (!selectedCourse) {
      return (
        <section className="panel">
          <p className="empty">강의를 선택하면 상세 페이지가 열립니다.</p>
        </section>
      )
    }

    return (
      <section className="course-layout">
        <article className="panel panel--wide">
          <header className="panel-header">
            <h2>
              {selectedCourse.course_code} · {selectedCourse.title}
            </h2>
            <p>
              {selectedCourse.professor_name ?? '-'} / {selectedCourse.classroom_code ?? '-'}
            </p>
          </header>

          {courseTab === 'notices' ? (
            <>
              {isProfessor ? (
                <form className="stack" onSubmit={handleCreateNotice}>
                  <label>
                    Notice Title
                    <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} />
                  </label>
                  <label>
                    Notice Body
                    <input value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} />
                  </label>
                  <button type="submit">공지 작성</button>
                </form>
              ) : null}
              <div className="device-list">
                {courseNotices.length === 0 ? (
                  <p className="empty">이 강의에는 아직 공지가 없습니다.</p>
                ) : (
                  courseNotices.map((notice) => (
                    <div key={notice.id} className="device-card">
                      <div>
                        <p className="device-label">{notice.title}</p>
                        <p>{notice.body}</p>
                        <code>{notice.author_name}</code>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : isStudent ? (
            <>
              <form className="stack" onSubmit={handleCheckEligibility}>
                <div className="inline-fields">
                  <label>
                    Course ID
                    <input value={courseId} onChange={(event) => setCourseId(event.target.value)} />
                  </label>
                  <label>
                    Classroom ID
                    <input value={classroomId} onChange={(event) => setClassroomId(event.target.value)} />
                  </label>
                  <label>
                    Purpose
                    <select
                      value={purpose}
                      onChange={(event) => setPurpose(event.target.value as 'attendance' | 'exam')}
                    >
                      <option value="attendance">attendance</option>
                      <option value="exam">exam</option>
                    </select>
                  </label>
                </div>
                <button type="submit" disabled={isPending}>
                  {isPending ? '확인 중...' : 'Eligibility 확인'}
                </button>
              </form>
              {eligibility ? (
                <div className="result-card">
                  <div className="result-summary">
                    <span
                      className={`result-badge result-badge--${eligibility.eligible ? 'ok' : 'blocked'}`}
                    >
                      {eligibility.eligible ? 'ELIGIBLE' : 'BLOCKED'}
                    </span>
                    <p>{eligibility.reason_code}</p>
                  </div>
                  <dl className="detail-grid">
                    <div>
                      <dt>matched_device_mac</dt>
                      <dd>{eligibility.matched_device_mac ?? '-'}</dd>
                    </div>
                    <div>
                      <dt>observed_at</dt>
                      <dd>{eligibility.observed_at ?? '-'}</dd>
                    </div>
                    <div>
                      <dt>snapshot_age_seconds</dt>
                      <dd>{eligibility.snapshot_age_seconds ?? '-'}</dd>
                    </div>
                  </dl>
                  <pre>{formatJson(eligibility.evidence)}</pre>
                </div>
              ) : (
                <p className="empty">아직 eligibility 결과가 없습니다.</p>
              )}
            </>
          ) : (
            <p className="empty">학생 계정에서만 이 강의의 eligibility 확인을 수행합니다.</p>
          )}
        </article>

        <aside className="course-sidebar">
          <button
            type="button"
            className={courseTab === 'notices' ? 'sidebar-link active-tab' : 'sidebar-link'}
            onClick={() => setCourseTab('notices')}
          >
            공지사항
          </button>
          <button
            type="button"
            className={courseTab === 'eligibility' ? 'sidebar-link active-tab' : 'sidebar-link'}
            onClick={() => setCourseTab('eligibility')}
          >
            출석 / 시험 확인
          </button>
        </aside>
      </section>
    )
  }

  if (!currentUser) {
    return renderLoginPage()
  }

  return (
    <main className="shell">
      {renderTopBar()}
      {error ? <p className="banner banner--error">{error}</p> : null}
      {view === 'dashboard' ? renderDashboard() : null}
      {view === 'profile' ? renderProfile() : null}
      {view === 'course' ? renderCoursePage() : null}
    </main>
  )
}

export default App
