import { expect, test } from '@playwright/test'

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
    await route.fulfill({ json: professorSession })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: professorSession })
  })

  await page.route('**/api/professors/PRF002/courses', async (route) => {
    await route.fulfill({ json: professorCourses })
  })

  await page.route('**/api/notices/PRF002', async (route) => {
    await route.fulfill({ json: [] })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/timeline', async (route) => {
    await route.fulfill({ json: attendanceTimeline })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/slot-roster?projection_key=*', async (route) => {
    await route.fulfill({ json: slotRoster })
  })
}

async function mockProfessorFlowApp(page: Parameters<typeof test>[0]['page'], options?: {
  initialSlot?: Partial<(typeof attendanceTimeline.weeks)[number]['slots'][number]>
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
    students: slotRoster.students,
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
    await route.fulfill({ json: professorSession })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: professorSession })
  })

  await page.route('**/api/professors/PRF002/courses', async (route) => {
    await route.fulfill({ json: professorCourses })
  })

  await page.route('**/api/notices/PRF002', async (route) => {
    await route.fulfill({ json: [] })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/timeline', async (route) => {
    await route.fulfill({ json: timelineResponse() })
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
      json: {
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
      },
    })
  })

  await page.route('**/api/professors/PRF002/attendance/sessions/*/close', async (route) => {
    slotState.session_status = 'closed'
    slotState.expires_at = null
    rosterState.session.status = 'closed'
    rosterState.session.expires_at = null
    await route.fulfill({
      json: {
        session_id: slotState.session_id,
        projection_key: projectionKey,
        status: 'closed',
        version: 2,
        occurred_at: '2099-03-03T15:05:00Z',
        course_code: 'CSE116',
      },
    })
  })

  await page.route('**/api/professors/PRF002/attendance/sessions/*/roster', async (route) => {
    await route.fulfill({ json: rosterState })
  })

  await page.route('**/api/professors/PRF002/courses/CSE116/attendance/slot-roster?projection_key=*', async (route) => {
    await route.fulfill({ json: rosterState })
  })
}

test('refresh on nested professor attendance roster route restores same page', async ({ page }) => {
  await mockProfessorApp(page)

  const rosterPath = `/courses/CSE116/attendance/slots/${encodeURIComponent(projectionKey)}/roster`
  await page.goto(rosterPath)

  await expect(page.getByText('차시 상세 · 출석 명단')).toBeVisible()
  await expect(page.getByText('Kim Student 06 (20201239)')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${rosterPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))

  await page.reload()

  await expect(page.getByText('차시 상세 · 출석 명단')).toBeVisible()
  await expect(page.getByText('Kim Student 06 (20201239)')).toBeVisible()
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
  await expect(page.getByText('차시 상세 · 출석 명단')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/courses\/CSE116\/attendance$/)
  await expect(page.getByText('학기별 출석 타임라인')).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`${rosterPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await expect(page.getByText('차시 상세 · 출석 명단')).toBeVisible()
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

  await expect(page).toHaveURL(new RegExp(`/courses/CSE116/attendance/slots/${encodeURIComponent(projectionKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/roster$`))
  await expect(page.getByText('차시 상세 · 출석 명단')).toBeVisible()
  await expect(page.getByText('이름(학번)')).toBeVisible()
  await expect(page.getByText('출석인정사유')).toBeVisible()
  await expect(page.getByText('Kim Student 06 (20201239)')).toBeVisible()
})

test('smart attendance selection routes to timer and session stop returns to roster', async ({ page }) => {
  await mockProfessorFlowApp(page)

  await page.goto('/courses/CSE116/attendance')
  await page.getByRole('button', { name: /선택$/ }).click()
  await page.getByRole('button', { name: '스마트출석' }).click()
  await page.getByRole('button', { name: '선택 차시에 적용' }).click()

  await expect(page.getByText('스마트 출석 진행')).toBeVisible()
  await expect(page.getByText('남은 시간')).toBeVisible()

  await page.getByRole('button', { name: '세션 종료' }).click()
  await expect(page).toHaveURL(new RegExp(`/courses/CSE116/attendance/slots/${encodeURIComponent(projectionKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/roster$`))
  await expect(page.getByText('차시 상세 · 출석 명단')).toBeVisible()
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

  const timerPath = `/courses/CSE116/attendance/slots/${encodeURIComponent(projectionKey)}/timer`
  await page.goto(timerPath)

  await expect(page).toHaveURL(new RegExp(`/courses/CSE116/attendance/slots/${encodeURIComponent(projectionKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/roster$`))
  await expect(page.getByText('차시 상세 · 출석 명단')).toBeVisible()
})
