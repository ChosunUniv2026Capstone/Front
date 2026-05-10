import { expect, test } from '@playwright/test'

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

async function mockStudentAssignmentApp(page: Parameters<typeof test>[0]['page']) {
  let submissionMultipartBody = ''

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
    await route.fulfill({ json: studentSession })
  })
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: studentSession })
  })
  await page.route('**/api/students/20201234/courses', async (route) => {
    await route.fulfill({ json: studentCourses })
  })
  await page.route('**/api/notices/20201234', async (route) => {
    await route.fulfill({ json: [] })
  })
  await page.route('**/api/students/20201234/courses/CSE116/assignments', async (route) => {
    await route.fulfill({ json: [upcomingAssignment, openAssignment] })
  })
  await page.route('**/api/students/20201234/courses/CSE116/assignments/101', async (route) => {
    await route.fulfill({ json: { ...upcomingAssignment, submission: null } })
  })
  await page.route('**/api/students/20201234/courses/CSE116/assignments/102', async (route) => {
    await route.fulfill({ json: { ...openAssignment, submission: null } })
  })
  await page.route('**/api/students/20201234/courses/CSE116/assignments/102/submission', async (route) => {
    submissionMultipartBody = route.request().postData() ?? ''
    await route.fulfill({
      json: {
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
      },
    })
  })

  return {
    getSubmissionMultipartBody: () => submissionMultipartBody,
  }
}

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
