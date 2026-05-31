import { expect, test } from '@playwright/test'

const apiEnvelope = <T,>(data: T) => {
  if (data && typeof data === 'object' && 'success' in data) {
    return data
  }
  return { success: true, data, message: 'ok', meta: {} }
}

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

const upcomingAssignment = {
  id: 101,
  title: '예정 과제',
  description: '아직 공개되지 않은 과제입니다.',
  opens_at: '2099-03-03T15:00:00Z',
  due_at: '2099-03-10T15:00:00Z',
  status: 'upcoming' as const,
  created_at: '2099-03-01T00:00:00Z',
  submitted: false,
  submitted_at: null,
  attachment_count: 0,
}

const openAssignment = {
  id: 102,
  title: '진행 과제',
  description: '제출 가능한 과제입니다.',
  opens_at: '2026-03-03T15:00:00Z',
  due_at: '2099-03-10T15:00:00Z',
  status: 'open' as const,
  created_at: '2026-03-01T00:00:00Z',
  submitted: false,
  submitted_at: null,
  attachment_count: 0,
}

type StudentAssignmentDetailFixture = typeof openAssignment & {
  submitted: boolean
  submitted_at: string | null
  attachment_count: number
  submission: {
    id: number
    submission_text: string | null
    submitted_at: string
    updated_at: string
    attachments: Array<{
      id: number
      original_filename: string
      mime_type: string
      file_size_bytes: number
      uploaded_at: string
    }>
  } | null
}

const defaultSubmittedAssignmentDetail = {
  ...openAssignment,
  submitted: true,
  submitted_at: '2026-03-03T15:30:00Z',
  attachment_count: 1,
  submission: {
    id: 9001,
    submission_text: '과제 제출 본문',
    submitted_at: '2026-03-03T15:30:00Z',
    updated_at: '2026-03-03T15:30:00Z',
    attachments: [
      {
        id: 7001,
        original_filename: 'report.txt',
        mime_type: 'text/plain',
        file_size_bytes: 11,
        uploaded_at: '2026-03-03T15:30:00Z',
      },
    ],
  },
} satisfies StudentAssignmentDetailFixture

async function mockStudentAssignmentApp(
  page: Parameters<typeof test>[0]['page'],
  options?: {
    initialAssignment102Detail?: StudentAssignmentDetailFixture
    submitResponse?: StudentAssignmentDetailFixture
  },
) {
  let submissionMultipartBody = ''
  let assignment102Detail: StudentAssignmentDetailFixture = options?.initialAssignment102Detail ?? {
    ...openAssignment,
    submission: null,
  }

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
  await page.route('**/api/students/20201234/courses/CSE116/assignments', async (route) => {
    await route.fulfill({
      json: apiEnvelope([
        upcomingAssignment,
        {
          ...openAssignment,
          submitted: assignment102Detail.submitted,
          submitted_at: assignment102Detail.submitted_at,
          attachment_count: assignment102Detail.attachment_count,
        },
      ]),
    })
  })
  await page.route('**/api/students/20201234/courses/CSE116/assignments/101', async (route) => {
    await route.fulfill({ json: apiEnvelope({ ...upcomingAssignment, submission: null }) })
  })
  await page.route('**/api/students/20201234/courses/CSE116/assignments/102', async (route) => {
    await route.fulfill({ json: apiEnvelope(assignment102Detail) })
  })
  await page.route('**/api/students/20201234/courses/CSE116/assignments/102/submission', async (route) => {
    submissionMultipartBody = route.request().postData() ?? ''
    assignment102Detail = options?.submitResponse ?? defaultSubmittedAssignmentDetail
    await route.fulfill({
      json: apiEnvelope(assignment102Detail),
    })
  })

  return {
    getSubmissionMultipartBody: () => submissionMultipartBody,
  }
}

function getLocalDateKey() {
  const today = new Date()
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

test('dashboard assignment calendar keeps loaded courses visible when another course fails', async ({ page }) => {
  const todayDueAt = `${getLocalDateKey()}T23:59:00`

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
    await route.fulfill({
      json: apiEnvelope([
        studentCourses[0],
        {
          id: 2,
          course_code: 'CSE220',
          title: 'Data Structures',
          professor_name: 'Park Professor',
          classroom_code: 'B201',
        },
      ]),
    })
  })
  await page.route('**/api/notices/20201234', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })
  await page.route('**/api/students/20201234/devices', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })
  await page.route('**/api/students/20201234/courses/CSE116/assignments', async (route) => {
    await route.fulfill({
      json: apiEnvelope([
        {
          ...openAssignment,
          id: 301,
          title: 'Dashboard Visible Assignment',
          due_at: todayDueAt,
        },
      ]),
    })
  })
  await page.route('**/api/students/20201234/courses/CSE220/assignments', async (route) => {
    await route.fulfill({ status: 503, json: apiEnvelope({ message: 'temporarily unavailable' }) })
  })

  await page.goto('/dashboard')

  await expect(page.getByText(/과제 마감 1건/)).toBeVisible()
  await expect(page.getByText(/일부 강의.*과제 일정/)).toBeVisible()
  await expect(page.getByText('Dashboard Visible Assignment')).toBeVisible()
})

test('student assignment UI blocks upcoming submissions and posts files under the backend contract field', async ({ page }) => {
  const assignmentApp = await mockStudentAssignmentApp(page)

  await page.goto('/courses/CSE116/assignments/101')

  await expect(page.getByRole('heading', { name: '과제 목록' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '과제 상세 · 예정 과제' })).toBeVisible()
  await expect(page.getByRole('button', { name: '과제 제출' })).toBeDisabled()
  await expect(page.getByText('진행 중인 과제만 제출하거나 수정할 수 있습니다.')).toBeVisible()

  await page.goto('/courses/CSE116/assignments/102')
  await expect(page.getByRole('heading', { name: '과제 상세 · 진행 과제' })).toBeVisible()
  await page.getByLabel('제출 내용').fill('과제 제출 본문')
  await page.getByLabel('파일 첨부').setInputFiles({
    name: 'report.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello world'),
  })
  await page.getByRole('button', { name: '과제 제출' }).click()

  await expect(page.getByText('과제를 제출했습니다.')).toBeVisible()
  expect(assignmentApp.getSubmissionMultipartBody()).toContain('name="files"')
  expect(assignmentApp.getSubmissionMultipartBody()).not.toContain('name="files[]"')
})

test('student assignment edit posts removed attachment ids and preserves retained files', async ({ page }) => {
  const initialDetail = {
    ...openAssignment,
    submitted: true,
    submitted_at: '2026-03-03T15:30:00Z',
    attachment_count: 2,
    submission: {
      id: 9001,
      submission_text: '기존 제출 본문',
      submitted_at: '2026-03-03T15:30:00Z',
      updated_at: '2026-03-03T15:30:00Z',
      attachments: [
        {
          id: 7001,
          original_filename: 'keep.txt',
          mime_type: 'text/plain',
          file_size_bytes: 4,
          uploaded_at: '2026-03-03T15:30:00Z',
        },
        {
          id: 7002,
          original_filename: 'remove.txt',
          mime_type: 'text/plain',
          file_size_bytes: 6,
          uploaded_at: '2026-03-03T15:30:00Z',
        },
      ],
    },
  } satisfies StudentAssignmentDetailFixture
  const updatedDetail = {
    ...initialDetail,
    attachment_count: 1,
    submission: {
      ...initialDetail.submission,
      submission_text: '수정된 제출 본문',
      updated_at: '2026-03-03T15:45:00Z',
      attachments: [initialDetail.submission.attachments[0]],
    },
  } satisfies StudentAssignmentDetailFixture
  const assignmentApp = await mockStudentAssignmentApp(page, {
    initialAssignment102Detail: initialDetail,
    submitResponse: updatedDetail,
  })

  await page.goto('/courses/CSE116/assignments/102')

  await expect(page.getByText('기존 제출 본문')).toBeVisible()
  await page.getByRole('button', { name: '수정' }).click()
  await expect(page.getByText('keep.txt').first()).toBeVisible()
  await expect(page.getByText('remove.txt').first()).toBeVisible()
  await page.getByRole('button', { name: 'remove.txt 삭제' }).click()
  await page.getByLabel('제출 내용').fill('수정된 제출 본문')
  await page.getByRole('button', { name: '저장' }).click()

  await expect(page.getByText('과제를 수정했습니다.')).toBeVisible()
  expect(assignmentApp.getSubmissionMultipartBody()).toContain('name="remove_attachment_ids"')
  expect(assignmentApp.getSubmissionMultipartBody()).toContain('7002')
  expect(assignmentApp.getSubmissionMultipartBody()).not.toContain('7001')
})
