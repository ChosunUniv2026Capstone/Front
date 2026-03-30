import type { FormEventHandler } from 'react'

import { formatJson, type Course, type EligibilityResponse, type Notice } from '../../api.js'
import type { CourseTab } from '../../app/model.js'
import { presentEligibility } from '../eligibility/presenter.js'

const courseTabLabels: Record<CourseTab, string> = {
  notices: '공지사항',
  eligibility: '출석 / 시험 확인',
}

type CourseViewProps = {
  selectedCourse: Course | null
  courseTab: CourseTab
  visibleCourseTabs: CourseTab[]
  isProfessor: boolean
  eligibilityVisible: boolean
  notices: Notice[]
  noticeTitle: string
  noticeBody: string
  onNoticeTitleChange: (value: string) => void
  onNoticeBodyChange: (value: string) => void
  onCreateNotice: FormEventHandler<HTMLFormElement>
  courseId: string
  classroomId: string
  purpose: 'attendance' | 'exam'
  onCourseIdChange: (value: string) => void
  onClassroomIdChange: (value: string) => void
  onPurposeChange: (value: 'attendance' | 'exam') => void
  onCheckEligibility: FormEventHandler<HTMLFormElement>
  isPending: boolean
  eligibility: EligibilityResponse | null
  onSelectTab: (tab: CourseTab) => void
}

export function CourseView({
  selectedCourse,
  courseTab,
  visibleCourseTabs,
  isProfessor,
  eligibilityVisible,
  notices,
  noticeTitle,
  noticeBody,
  onNoticeTitleChange,
  onNoticeBodyChange,
  onCreateNotice,
  courseId,
  classroomId,
  purpose,
  onCourseIdChange,
  onClassroomIdChange,
  onPurposeChange,
  onCheckEligibility,
  isPending,
  eligibility,
  onSelectTab,
}: CourseViewProps) {
  if (!selectedCourse) {
    return (
      <section className="panel surface-panel">
        <p className="empty">강의를 선택하면 상세 페이지가 열립니다.</p>
      </section>
    )
  }

  const courseNotices = notices.filter((notice) => notice.course_code === selectedCourse.course_code)
  const eligibilityPresentation = eligibility
    ? presentEligibility({
        eligible: eligibility.eligible,
        reasonCode: eligibility.reason_code,
      })
    : null

  return (
    <section className="course-layout course-surface">
      <article className="panel panel--wide surface-panel">
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
              <form className="stack" onSubmit={onCreateNotice}>
                <label>
                  Notice Title
                  <input value={noticeTitle} onChange={(event) => onNoticeTitleChange(event.target.value)} />
                </label>
                <label>
                  Notice Body
                  <input value={noticeBody} onChange={(event) => onNoticeBodyChange(event.target.value)} />
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
        ) : eligibilityVisible ? (
          <>
            <form className="stack" onSubmit={onCheckEligibility}>
              <div className="inline-fields">
                <label>
                  Course ID
                  <input value={courseId} onChange={(event) => onCourseIdChange(event.target.value)} />
                </label>
                <label>
                  Classroom ID
                  <input value={classroomId} onChange={(event) => onClassroomIdChange(event.target.value)} />
                </label>
                <label>
                  Purpose
                  <select value={purpose} onChange={(event) => onPurposeChange(event.target.value as 'attendance' | 'exam')}>
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
                    className={`result-badge result-badge--${
                      eligibilityPresentation?.tone === 'success' ? 'ok' : 'blocked'
                    }`}
                  >
                    {eligibilityPresentation?.badgeLabel ?? '주의'}
                  </span>
                  <div>
                    <p>{eligibilityPresentation?.title ?? '출석 / 시험 상태를 확인했습니다.'}</p>
                    <p>{eligibilityPresentation?.body ?? '판정 결과를 확인하세요.'}</p>
                    <code>{eligibility.reason_code}</code>
                  </div>
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

      <aside className="panel course-sidebar surface-panel surface-panel--compact">
        {visibleCourseTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={courseTab === tab ? 'sidebar-link active-tab' : 'sidebar-link'}
            onClick={() => onSelectTab(tab)}
          >
            {courseTabLabels[tab]}
          </button>
        ))}
      </aside>
    </section>
  )
}
