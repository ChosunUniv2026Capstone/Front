import { useEffect, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { AppShell } from './app/AppShell'
import {
  api,
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
  canManageDevices,
  getDefaultCourseTab,
  getDefaultView,
  getVisibleCourseTabs,
  isEligibilityVisible,
  type AppRole,
  type AppView,
  type CourseTab,
} from './app/model'
import { LoginScreen } from './features/auth/LoginScreen'
import { CourseView } from './features/course/CourseView'
import { DashboardView } from './features/dashboard/DashboardView'
import { getPrimaryNavigation } from './features/navigation/navigation'
import { ProfileView } from './features/profile/ProfileView'

function App() {
  const [loginId, setLoginId] = useState('20201234')
  const [password, setPassword] = useState('devpass123')
  const [currentUser, setCurrentUser] = useState<LoginUser | null>(null)
  const [view, setView] = useState<AppView>(() => getDefaultView('student'))
  const [courseTab, setCourseTab] = useState<CourseTab>(() => getDefaultCourseTab(null))
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

  const currentRole: AppRole | null = currentUser?.role ?? null
  const isProfessor = currentRole === 'professor'
  const isAdmin = currentRole === 'admin'
  const deviceManagementEnabled = currentRole ? canManageDevices(currentRole) : false
  const eligibilityVisible = currentRole ? isEligibilityVisible(currentRole) : false
  const visibleCourseTabs: CourseTab[] = currentRole ? getVisibleCourseTabs(currentRole) : ['notices']
  const primaryNavigation = currentRole ? getPrimaryNavigation(currentRole) : []

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

  function resetRoleData(role: AppRole | null) {
    setDevices([])
    setEligibility(null)
    setCourses([])
    setNotices([])
    setAdminUsers([])
    setAdminClassrooms([])
    setAdminNetworks([])
    setSelectedCourse(null)
    setCourseTab(getDefaultCourseTab(role))
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    try {
      setError(null)
      const result = await api.login({ login_id: loginId, password })
      setCurrentUser(result.user)
      resetRoleData(result.user.role)
      if (result.user.role === 'student') {
        await hydrateStudent(result.user.login_id)
      } else if (result.user.role === 'professor') {
        await hydrateProfessor(result.user.login_id)
      } else {
        await hydrateAdmin()
      }
      setView(getDefaultView(result.user.role))
    } catch (caughtError) {
      setCurrentUser(null)
      resetRoleData(null)
      setError(caughtError instanceof Error ? caughtError.message : '로그인에 실패했습니다.')
    }
  }

  function handleLogout() {
    setCurrentUser(null)
    resetRoleData(null)
    setError(null)
    setView(getDefaultView('student'))
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
    setCourseTab(getDefaultCourseTab(currentRole))
    setView('course')
  }

  const roleSummary = currentUser
    ? `${currentUser.name} · ${currentUser.role} · ${currentUser.login_id}`
    : '로그인이 필요합니다.'

  const workspaceTitle = view === 'course' && selectedCourse ? selectedCourse.title : 'Learning Workspace'
  const workspaceSubtitle =
    view === 'course' && selectedCourse
      ? `${selectedCourse.course_code} · ${selectedCourse.professor_name ?? '-'} / ${selectedCourse.classroom_code ?? '-'}`
      : view === 'profile'
        ? '계정 정보와 역할별 설정을 확인합니다.'
        : isAdmin
          ? '학생, 교수, 강의실, AP 매핑 현황을 안정적으로 확인합니다.'
          : '현재 역할에 맞는 강의와 공지를 빠르게 이어서 확인합니다.'

  if (!currentUser) {
    return (
      <LoginScreen
        loginId={loginId}
        password={password}
        error={error}
        onLoginIdChange={(event) => setLoginId(event.target.value)}
        onPasswordChange={(event) => setPassword(event.target.value)}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <AppShell
      title={workspaceTitle}
      subtitle={workspaceSubtitle}
      accountInfo={roleSummary}
      health={health}
      navigationItems={primaryNavigation}
      activeView={view}
      onNavigate={setView}
      onLogout={handleLogout}
    >
      {error ? <p className="banner banner--error">{error}</p> : null}
      {view === 'dashboard' ? (
        <DashboardView
          isAdmin={isAdmin}
          courses={courses}
          notices={notices}
          adminUsers={adminUsers}
          adminClassrooms={adminClassrooms}
          adminNetworks={adminNetworks}
          onOpenCourse={openCourse}
        />
      ) : null}
      {view === 'profile' ? (
        <ProfileView
          currentUser={currentUser}
          deviceManagementEnabled={deviceManagementEnabled}
          label={label}
          macAddress={macAddress}
          devices={devices}
          onLabelChange={setLabel}
          onMacAddressChange={setMacAddress}
          onRegisterDevice={handleRegisterDevice}
          onDeleteDevice={(deviceId) => void handleDeleteDevice(deviceId)}
        />
      ) : null}
      {view === 'course' ? (
        <CourseView
          selectedCourse={selectedCourse}
          courseTab={courseTab}
          visibleCourseTabs={visibleCourseTabs}
          isProfessor={isProfessor}
          eligibilityVisible={eligibilityVisible}
          notices={notices}
          noticeTitle={noticeTitle}
          noticeBody={noticeBody}
          onNoticeTitleChange={setNoticeTitle}
          onNoticeBodyChange={setNoticeBody}
          onCreateNotice={handleCreateNotice}
          courseId={courseId}
          classroomId={classroomId}
          purpose={purpose}
          onCourseIdChange={setCourseId}
          onClassroomIdChange={setClassroomId}
          onPurposeChange={setPurpose}
          onCheckEligibility={handleCheckEligibility}
          isPending={isPending}
          eligibility={eligibility}
          onSelectTab={setCourseTab}
        />
      ) : null}
    </AppShell>
  )
}

export default App
