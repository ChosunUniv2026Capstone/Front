import { expect, test } from '@playwright/test'

const apiEnvelope = <T,>(data: T) => {
  if (data && typeof data === 'object' && 'success' in data) {
    return data
  }
  return { success: true, data, message: 'ok', meta: {} }
}

const professorSession = {
  success: true,
  data: {
    access_token: 'dev-token:PRF002',
    user: {
      id: 2,
      role: 'professor',
      login_id: 'PRF002',
      name: 'Lee Professor 02',
    },
  },
  message: 'ok',
  meta: {},
}

const professorCourses = [
  {
    id: 1,
    course_code: 'CSE116',
    title: 'Capstone Design A',
    professor_name: 'Lee Professor 02',
    classroom_code: 'B101',
  },
]

const studentSession = {
  success: true,
  data: {
    access_token: 'dev-token:20201234',
    user: {
      id: 10,
      role: 'student',
      login_id: '20201234',
      name: 'Kim Student 01',
    },
  },
  message: 'ok',
  meta: {},
}

const studentCourses = [
  {
    id: 1,
    course_code: 'CSE116',
    title: 'Capstone Design A',
    professor_name: 'Lee Professor 02',
    classroom_code: 'B101',
  },
]

const projectionKey = 'CSE116:B101:2026-03-03:15:00:00:15:30:00'

const attendanceTimeline = {
  course_code: 'CSE116',
  course_title: 'Capstone Design A',
  semester_start: '2026-03-03',
  semester_end: '2026-06-30',
  weeks: [
    {
      week_index: 1,
      week_start: '2026-03-02',
      week_end: '2026-03-08',
      slots: [
        {
          projection_key: projectionKey,
          course_code: 'CSE116',
          classroom_code: 'B101',
          session_date: '2026-03-03',
          slot_start_at: '15:00:00',
          slot_end_at: '15:30:00',
          week_index: 1,
          lesson_index_within_week: 1,
          period_label: '1교시',
          display_label: '1차시(1교시): 2026.03.03(화) Lee Professor 02(PRF002)',
          professor_name: 'Lee Professor 02',
          professor_login_id: 'PRF002',
          slot_state: 'unchecked',
          session_id: null,
          session_mode: null,
          session_status: null,
          expires_at: null,
          aggregate: {
            present: 0,
            late: 0,
            absent: 0,
            official: 0,
            sick: 0,
          },
        },
      ],
    },
  ],
  report_summary: {
    projection_slot_count: 1,
    active_session_count: 0,
    smart_active_count: 0,
    canceled_count: 0,
    present: 0,
    late: 0,
    absent: 0,
    official: 0,
    sick: 0,
  },
}

const slotRoster = {
  session: {
    session_id: null,
    projection_key: projectionKey,
    projection_keys: [projectionKey],
    mode: null,
    status: 'unchecked',
    expires_at: null,
    version: 0,
    course_code: 'CSE116',
  },
  students: [
    {
      student_id: '20201239',
      student_name: 'Kim Student 06',
      final_status: null,
      attendance_reason: null,
      history_count: 0,
    },
  ],
  aggregate: {
    present: 0,
    late: 0,
    absent: 0,
    official: 0,
    sick: 0,
  },
}

const professorStudentStats = {
  course_code: 'CSE116',
  course_title: 'Capstone Design A',
  rows: [
    {
      student_id: '20201239',
      student_name: 'Kim Student 06',
      present: 0,
      late: 0,
      absent: 1,
      official: 0,
      sick: 0,
    },
  ],
}

const studentSemesterMatrix = {
  course_code: 'CSE116',
  course_title: 'Capstone Design A',
  student_id: '20201234',
  student_name: 'Kim Student 01',
  weeks: [
    {
      week_index: 1,
      week_start: '2026-03-02',
      week_end: '2026-03-08',
      slots: [
        {
          projection_key: projectionKey,
          lesson_index_within_week: 1,
          period_label: '1교시',
          display_label: '1차시(1교시): 2026.03.03(화) Lee Professor 02(PRF002)',
          session_date: '2026-03-03',
          status: 'upcoming',
        },
      ],
    },
  ],
}

async function mockProfessorApp(page: Parameters<typeof test>[0]['page']) {
  await page.addInitScript(() => {
    class MockWebSocket {
      url
      readyState = 1
      onopen = null
      onmessage = null
      onerror = null
      onclose = null

      constructor(url: string) {
        this.url = url
        setTimeout(() => {
          this.onopen?.(new Event('open'))
        }, 0)
      }

      send() {}

      close() {
        this.readyState = 3
        this.onclose?.(new Event('close'))
      }
    }

    // @ts-expect-error browser override for test isolation
    window.WebSocket = MockWebSocket
  })

  await page.route('**/health', async (route) => {
    await route.fulfill({ json: { status: 'ok' } })
  })

  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({ json: apiEnvelope(professorSession) })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: apiEnvelope(professorSession) })
  })

  await page.route('**/api/professors/PRF002/courses', async (route) => {
    await route.fulfill({ json: apiEnvelope(professorCourses) })
  })

  await page.route('**/api/notices/PRF002', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/timeline', async (route) => {
    await route.fulfill({ json: apiEnvelope(attendanceTimeline) })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/student-stats', async (route) => {
    await route.fulfill({ json: apiEnvelope(professorStudentStats) })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/slot-roster?projection_key=*', async (route) => {
    await route.fulfill({ json: apiEnvelope(slotRoster) })
  })
}

async function mockProfessorFlowApp(page: Parameters<typeof test>[0]['page'], options?: {
  initialSlot?: Partial<(typeof attendanceTimeline.weeks)[number]['slots'][number]>
  rosterUpdates?: Array<{ status: string; reason?: string | null }>
  rosterStudents?: typeof slotRoster.students
}) {
  const slotState = {
    ...attendanceTimeline.weeks[0].slots[0],
    ...(options?.initialSlot ?? {}),
  }

  const rosterState = {
    session: {
      ...slotRoster.session,
      session_id: slotState.session_id,
      mode: slotState.session_mode,
      status: slotState.session_status ?? slotState.slot_state,
      expires_at: slotState.expires_at,
    },
    students: options?.rosterStudents ?? slotRoster.students,
    aggregate: slotRoster.aggregate,
  }

  const timelineResponse = () => ({
    ...attendanceTimeline,
    weeks: [
      {
        ...attendanceTimeline.weeks[0],
        slots: [slotState],
      },
    ],
  })

  await page.addInitScript(() => {
    class MockWebSocket {
      url
      readyState = 1
      onopen = null
      onmessage = null
      onerror = null
      onclose = null

      constructor(url: string) {
        this.url = url
        setTimeout(() => {
          this.onopen?.(new Event('open'))
        }, 0)
      }

      send() {}

      close() {
        this.readyState = 3
        this.onclose?.(new Event('close'))
      }
    }

    // @ts-expect-error browser override for test isolation
    window.WebSocket = MockWebSocket
  })

  await page.route('**/health', async (route) => {
    await route.fulfill({ json: { status: 'ok' } })
  })

  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({ json: apiEnvelope(professorSession) })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: apiEnvelope(professorSession) })
  })

  await page.route('**/api/professors/PRF002/courses', async (route) => {
    await route.fulfill({ json: apiEnvelope(professorCourses) })
  })

  await page.route('**/api/notices/PRF002', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/timeline', async (route) => {
    await route.fulfill({ json: apiEnvelope(timelineResponse()) })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/student-stats', async (route) => {
    await route.fulfill({ json: apiEnvelope(professorStudentStats) })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/sessions/batch', async (route) => {
    const body = route.request().postDataJSON() as { mode: 'manual' | 'smart' | 'canceled'; projection_keys: string[] }
    const nextSessionId = body.mode === 'smart' ? 701 : body.mode === 'manual' ? 702 : null
    slotState.session_id = nextSessionId
    slotState.session_mode = body.mode
    slotState.slot_state = body.mode === 'smart' ? 'online' : body.mode === 'manual' ? 'offline' : 'canceled'
    slotState.session_status = body.mode === 'canceled' ? 'canceled' : 'active'
    slotState.expires_at = body.mode === 'smart' ? '2099-03-03T15:10:00Z' : null
    rosterState.session.session_id = nextSessionId
    rosterState.session.mode = body.mode
    rosterState.session.status = slotState.session_status
    rosterState.session.expires_at = slotState.expires_at

    await route.fulfill({
      json: apiEnvelope({
        course_code: 'CSE116',
        mode: body.mode,
        results: [
          {
            projection_key: projectionKey,
            success: true,
            code: 'OK',
            message: 'attendance session applied',
            session_id: nextSessionId,
            resulting_slot_state: slotState.slot_state,
            event_type: body.mode === 'smart' ? 'session.opened' : body.mode === 'manual' ? 'session.opened' : 'session.canceled',
            expires_at: slotState.expires_at,
          },
        ],
        changed_projection_keys: [projectionKey],
        changed_session_ids: nextSessionId ? [nextSessionId] : [],
        occurred_at: '2099-03-03T15:00:00Z',
      }),
    })
  })

  await page.route('**/api/professors/PRF002/attendance/sessions/*/close', async (route) => {
    slotState.session_status = 'closed'
    slotState.expires_at = null
    rosterState.session.status = 'closed'
    rosterState.session.expires_at = null
    await route.fulfill({
      json: apiEnvelope({
        session_id: slotState.session_id,
        projection_key: projectionKey,
        status: 'closed',
        version: 2,
        occurred_at: '2099-03-03T15:05:00Z',
        course_code: 'CSE116',
      }),
    })
  })

  await page.route('**/api/professors/PRF002/attendance/sessions/*/roster', async (route) => {
    await route.fulfill({ json: apiEnvelope(rosterState) })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/slot-roster?projection_key=*', async (route) => {
    await route.fulfill({ json: apiEnvelope(rosterState) })
  })

  await page.route('**/api/professors/PRF002/attendance/sessions/*/students/*', async (route) => {
    const body = route.request().postDataJSON() as { status: 'present' | 'absent' | 'late' | 'official' | 'sick'; reason?: string | null }
    options?.rosterUpdates?.push(body)
    rosterState.students = rosterState.students.map((student) => ({
      ...student,
      final_status: body.status,
      attendance_reason: body.status === 'official' ? body.reason ?? null : null,
      history_count: student.history_count + 1,
    }))
    await route.fulfill({
      json: apiEnvelope({
        session_id: slotState.session_id,
        projection_key: projectionKey,
        projection_keys: [projectionKey],
        student_id: '20201239',
        new_status: body.status,
        reason: body.status === 'official' ? body.reason ?? null : null,
        version: 2,
        course_code: 'CSE116',
        occurred_at: '2099-03-03T15:02:00Z',
        changed: true,
      }),
    })
  })
}

async function mockStudentBundleApp(page: Parameters<typeof test>[0]['page']) {
  await page.addInitScript(() => {
    class MockWebSocket {
      url
      readyState = 1
      onopen = null
      onmessage = null
      onerror = null
      onclose = null

      constructor(url: string) {
        this.url = url
        setTimeout(() => {
          this.onopen?.(new Event('open'))
        }, 0)
      }

      send() {}

      close() {
        this.readyState = 3
        this.onclose?.(new Event('close'))
      }
    }

    // @ts-expect-error browser override for test isolation
    window.WebSocket = MockWebSocket
  })

  await page.route('**/health', async (route) => {
    await route.fulfill({ json: { status: 'ok' } })
  })

  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({ json: apiEnvelope(studentSession) })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: apiEnvelope(studentSession) })
  })

  await page.route('**/api/students/20201234/courses', async (route) => {
    await route.fulfill({ json: apiEnvelope(studentCourses) })
  })

  await page.route('**/api/notices/20201234', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })

  await page.route('**/api/students/20201234/devices', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })

  await page.route('**/api/students/20201234/courses/CSE116/attendance/active-sessions', async (route) => {
    await route.fulfill({
      json: apiEnvelope({
        course_code: 'CSE116',
        student_id: '20201234',
        sessions: [
          {
            session_id: 701,
            projection_key: projectionKey,
            projection_keys: [
              projectionKey,
              'CSE116:B101:2026-03-03:15:30:00:16:00:00',
            ],
            slot_labels: ['1차시 1교시', '2차시 2교시'],
            display_label: '캡스톤 디자인 A 스마트출석',
            session_date: '2026-03-03',
            slot_start_at: '15:00:00',
            slot_end_at: '16:00:00',
            expires_at: '2099-03-03T15:10:00Z',
            can_check_in: true,
            eligibility: {
              eligible_slot_count: 1,
              rejected_slot_count: 1,
              per_slot: [
                {
                  projection_key: projectionKey,
                  eligibility: {
                    eligible: true,
                    reason_code: 'OK',
                    matched_device_mac: 'AA:BB:CC:DD:EE:FF',
                  },
                },
                {
                  projection_key: 'CSE116:B101:2026-03-03:15:30:00:16:00:00',
                  eligibility: {
                    eligible: false,
                    reason_code: 'DEVICE_NOT_PRESENT',
                    matched_device_mac: null,
                  },
                },
              ],
            },
            version: 1,
          },
        ],
      }),
    })
  })

  await page.route('**/api/students/20201234/courses/CSE116/attendance/semester-matrix', async (route) => {
    await route.fulfill({
      json: apiEnvelope({
        ...studentSemesterMatrix,
        weeks: [
          {
            ...studentSemesterMatrix.weeks[0],
            slots: [
              {
                ...studentSemesterMatrix.weeks[0].slots[0],
                status: 'pending',
              },
            ],
          },
        ],
      }),
    })
  })

  await page.route('**/api/students/20201234/attendance/sessions/701/check-in', async (route) => {
    await route.fulfill({
      json: apiEnvelope({
        code: 'ATTENDANCE_CHECK_IN_OK',
        session_id: 701,
        projection_key: projectionKey,
        student_id: '20201234',
        status: 'present',
        version: 2,
        occurred_at: '2099-03-03T15:01:00Z',
        course_code: 'CSE116',
        idempotent: false,
      }),
    })
  })
}

test('refresh on nested professor attendance roster route restores same page', async ({ page }) => {
  await mockProfessorApp(page)

  const rosterPath = `/courses/CSE116/attendance/slots/${encodeURIComponent(projectionKey)}/roster`
  await page.goto(rosterPath)

  await expect(page.getByText('차시 예외 수정 · 출석 현황')).toBeVisible()
  await expect(page.getByText('예외 수정 차시')).toBeVisible()
  await expect(page.getByText('Kim Student 06')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${rosterPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))

  await page.reload()

  await expect(page.getByText('차시 예외 수정 · 출석 현황')).toBeVisible()
  await expect(page.getByText('Kim Student 06')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${rosterPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
})

test('browser back and forward restore overview timeline and roster pages', async ({ page }) => {
  await mockProfessorApp(page)

  const rosterPath = `/courses/CSE116/attendance/slots/${encodeURIComponent(projectionKey)}/roster`

  await page.goto('/dashboard')
  await page.getByRole('button', { name: /CSE116/ }).click()
  await expect(page).toHaveURL(/\/courses\/CSE116$/)
  await expect(page.getByText('강의 기본 정보')).toBeVisible()

  await page.getByRole('button', { name: '출석 탭' }).click()
  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance$/)
  await expect(page.getByText('학기별 출석 타임라인')).toBeVisible()

  await page.getByRole('button', { name: /1차시 · 1교시/ }).click()
  await expect(page).toHaveURL(new RegExp(`${rosterPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await expect(page.getByText('차시 예외 수정 · 출석 현황')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance$/)
  await expect(page.getByText('학기별 출석 타임라인')).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`${rosterPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await expect(page.getByText('차시 예외 수정 · 출석 현황')).toBeVisible()
})

test('unauthorized course restore falls back to a safe boundary', async ({ page }) => {
  await mockProfessorApp(page)

  await page.goto('/courses/CSE999/attendance')

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('해당 강의 경로에 접근할 수 없습니다.')).toBeVisible()
})

test('manual attendance selection routes to roster and shows required roster columns', async ({ page }) => {
  await mockProfessorFlowApp(page)

  await page.goto('/courses/CSE116/attendance')
  await page.getByRole('button', { name: /선택$/ }).click()
  await expect(page.getByText('출석 시작 · 2026-03-03')).toBeVisible()
  await expect(page.getByText('선택된 차시 1건')).toBeVisible()
  await page.getByRole('button', { name: '일반출석' }).click()
  await page.getByRole('button', { name: '선택 차시에 적용' }).click()

  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance\/sessions\/702\/roster$/)
  await expect(page.getByText('학생 목록 · 출석 현황')).toBeVisible()
  await expect(page.getByText('차시별 예외 수정')).toBeVisible()
  await expect(page.getByText('Kim Student 06')).toBeVisible()
})

test('smart attendance selection routes to timer and session stop returns to roster', async ({ page }) => {
  await mockProfessorFlowApp(page)

  await page.goto('/courses/CSE116/attendance')
  await page.getByRole('button', { name: /선택$/ }).click()
  await page.getByRole('button', { name: '스마트출석' }).click()
  await page.getByRole('button', { name: '선택 차시에 적용' }).click()

  await expect(page.getByText('스마트 출석 진행')).toBeVisible()
  await expect(page.getByText('남은 시간')).toBeVisible()

  await page.getByRole('button', { name: '출석 종료' }).click()
  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance\/sessions\/701\/roster$/)
  await expect(page.getByText('학생 목록 · 출석 현황')).toBeVisible()
})

test('revisiting an ended smart route restores to roster instead of stale timer UI', async ({ page }) => {
  await mockProfessorFlowApp(page, {
    initialSlot: {
      session_id: 703,
      session_mode: 'smart',
      session_status: 'expired',
      slot_state: 'online',
      expires_at: '2000-03-03T15:00:00Z',
    },
  })

  const timerPath = `/courses/CSE116/attendance/sessions/703/timer`
  await page.goto(timerPath)

  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance\/sessions\/703\/roster$/)
  await expect(page.getByText('학생 목록 · 출석 현황')).toBeVisible()
})

test('ended attendance slot reopens from the existing check button without a separate restart button', async ({ page }) => {
  await mockProfessorFlowApp(page, {
    initialSlot: {
      session_id: 703,
      session_mode: 'smart',
      session_status: 'closed',
      slot_state: 'online',
      expires_at: null,
    },
  })

  await page.goto('/courses/CSE116/attendance')

  await expect(page.getByText('종료된 세션 · 다시 시작 가능')).toBeVisible()
  await expect(page.getByRole('button', { name: '출석 다시 시작' })).toHaveCount(0)
  await page.getByRole('button', { name: /선택$/ }).click()
  await expect(page.getByText('출석 시작 · 2026-03-03')).toBeVisible()
  await expect(page.getByText('선택된 차시 1건')).toBeVisible()
  await page.getByRole('button', { name: '스마트출석' }).click()
  await page.getByRole('button', { name: '선택 차시에 적용' }).click()

  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance\/sessions\/701\/timer$/)
  await expect(page.getByText('스마트 출석 진행')).toBeVisible()
})

test('manual active roster hides smart conversion and only requires official reason', async ({ page }) => {
  const rosterUpdates: Array<{ status: string; reason?: string | null }> = []
  await mockProfessorFlowApp(page, {
    rosterUpdates,
    rosterStudents: [
      {
        ...slotRoster.students[0],
        final_status: 'present',
        attendance_reason: '과거 일반 상태 사유',
      },
    ],
    initialSlot: {
      session_id: 702,
      session_mode: 'manual',
      session_status: 'active',
      slot_state: 'offline',
      expires_at: null,
    },
  })

  await page.goto('/courses/CSE116/attendance')

  await expect(page.getByText('스마트 출석으로 전환')).toHaveCount(0)
  await expect(page.getByText('스마트 전환 가능')).toHaveCount(0)

  await page.locator('.attendance-slot-main').click()
  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance\/sessions\/702\/roster$/)
  await expect(page.getByText('학생 목록 · 출석 현황')).toBeVisible()
  await expect(page.getByText('스마트 출석으로 전환')).toHaveCount(0)
  await expect(page.getByText('스마트 전환 가능')).toHaveCount(0)
  await expect(page.getByPlaceholder('공결 사유 입력')).toHaveCount(0)

  await page.locator('input[name="attendance-status-20201239"]').nth(0).check({ force: true })
  await page.getByRole('button', { name: '저장' }).click()
  expect(rosterUpdates.at(-1)).toEqual({ status: 'present', reason: null })

  await page.locator('input[name="attendance-status-20201239"]').nth(3).check({ force: true })
  await expect(page.getByPlaceholder('공결 사유 입력')).toBeVisible()
  await expect(page.getByPlaceholder('공결 사유 입력')).toHaveValue('')
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled()

  await page.getByPlaceholder('공결 사유 입력').fill('공결 증빙 확인')
  await page.getByRole('button', { name: '저장' }).click()
  expect(rosterUpdates.at(-1)).toEqual({ status: 'official', reason: '공결 증빙 확인' })
})

test('clicking an active smart attendance slot opens the timer view', async ({ page }) => {
  await mockProfessorFlowApp(page, {
    initialSlot: {
      session_id: 701,
      session_mode: 'smart',
      session_status: 'active',
      slot_state: 'online',
      expires_at: '2099-03-03T15:10:00Z',
    },
  })

  await page.goto('/courses/CSE116/attendance')

  await page.locator('.attendance-slot-main').click()

  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance\/sessions\/701\/timer$/)
  await expect(page.getByText('스마트 출석 진행')).toBeVisible()
})


test('closing smart attendance refreshes roster state without requiring manual reload', async ({ page }) => {
  await mockProfessorFlowApp(page)

  await page.route('**/api/professors/PRF002/attendance/sessions/*/close', async (route) => {
    await route.fulfill({
      json: apiEnvelope({
        session_id: 701,
        projection_key: projectionKey,
        status: 'closed',
        version: 2,
        occurred_at: '2099-03-03T15:05:00Z',
        course_code: 'CSE116',
      }),
    })
  })

  await page.route('**/api/professors/PRF002/attendance/sessions/*/roster', async (route) => {
    await route.fulfill({
      json: apiEnvelope({
        session: {
          ...slotRoster.session,
          session_id: 701,
          mode: 'smart',
          status: 'closed',
          expires_at: null,
        },
        students: [
          {
            student_id: '20201239',
            student_name: 'Kim Student 06',
            final_status: 'present',
            attendance_reason: null,
            history_count: 1,
          },
        ],
        aggregate: {
          present: 1,
          late: 0,
          absent: 0,
          official: 0,
          sick: 0,
        },
      }),
    })
  })

  await page.goto('/courses/CSE116/attendance')
  await page.getByRole('button', { name: /선택$/ }).click()
  await page.getByRole('button', { name: '스마트출석' }).click()
  await page.getByRole('button', { name: '선택 차시에 적용' }).click()
  await expect(page.getByText('스마트 출석 진행')).toBeVisible()

  await page.getByRole('button', { name: '출석 종료' }).click()

  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance\/sessions\/701\/roster$/)
  await expect(page.getByText('학생 목록 · 출석 현황')).toBeVisible()
  await expect(page.locator('input[type="radio"][name="attendance-status-20201239"]').nth(0)).toBeChecked()
})

test('student attendance page shows one bundle card with one check-in action', async ({ page }) => {
  await mockStudentBundleApp(page)

  await page.goto('/courses/CSE116/attendance')

  await expect(page.getByText('스마트 출석 현황')).toBeVisible()
  await expect(page.locator('.attendance-semester-table')).toBeVisible()
  await expect(page.getByText('캡스톤 디자인 A 스마트출석')).toBeVisible()
  await expect(page.getByText('1차시 1교시 · 2차시 2교시')).toBeVisible()
  await expect(page.getByText('1개 차시 출석 가능 / 1개 확인 필요')).toBeVisible()
  await expect(page.getByText('2차시 2교시: 등록 단말이 현재 강의실 네트워크에서 관측되지 않았습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '출석하기' })).toBeVisible()

  await page.getByRole('button', { name: '출석하기' }).click()
  await expect(page.getByText('스마트 출석이 반영되었습니다.')).toBeVisible()
})

test('professor dashboard exposes per-student attendance stats table', async ({ page }) => {
  await mockProfessorApp(page)

  await page.goto('/courses/CSE116/attendance')
  await page.getByRole('button', { name: '학생별 통계' }).click()

  await expect(page.getByText('학생별 출석 누계')).toBeVisible()
  await expect(page.locator('.attendance-stats-table')).toBeVisible()
  await expect(page.getByText('20201239')).toBeVisible()
})
