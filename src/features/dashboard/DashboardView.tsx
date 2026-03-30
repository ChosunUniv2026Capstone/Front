import {
  formatJson,
  type Classroom,
  type ClassroomNetwork,
  type Course,
  type Notice,
  type UserSummary,
} from '../../api.js'

type DashboardViewProps = {
  isAdmin: boolean
  courses: Course[]
  notices: Notice[]
  adminUsers: UserSummary[]
  adminClassrooms: Classroom[]
  adminNetworks: ClassroomNetwork[]
  onOpenCourse: (course: Course) => void
}

function CourseGrid({ courses, onOpenCourse }: Pick<DashboardViewProps, 'courses' | 'onOpenCourse'>) {
  return (
    <div className="course-grid">
      {courses.length === 0 ? (
        <p className="empty">표시할 강의가 없습니다.</p>
      ) : (
        courses.map((course) => (
          <button key={course.id} type="button" className="course-card" onClick={() => onOpenCourse(course)}>
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

export function DashboardView({
  isAdmin,
  courses,
  notices,
  adminUsers,
  adminClassrooms,
  adminNetworks,
  onOpenCourse,
}: DashboardViewProps) {
  if (isAdmin) {
    return (
      <section className="grid grid--devices dashboard-surface">
        <article className="panel panel--wide surface-panel">
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

        <article className="panel panel--wide surface-panel">
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
    <section className="grid grid--devices dashboard-surface">
      <article className="panel panel--wide surface-panel">
        <header className="panel-header">
          <h2>Courses</h2>
          <p>클릭하면 강의별 상세 페이지로 이동합니다.</p>
        </header>
        <CourseGrid courses={courses} onOpenCourse={onOpenCourse} />
      </article>

      <article className="panel panel--wide surface-panel">
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
