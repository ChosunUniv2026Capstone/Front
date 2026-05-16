import { expect, test } from '@playwright/test'

const apiEnvelope = <T,>(data: T) => {
  if (data && typeof data === 'object' && 'success' in data) {
    return data
  }
  return { success: true, data, message: 'ok', meta: {} }
}

const studentSession = {
  access_token: 'dev-token:20201234',
  user: {
    id: 10,
    role: 'student' as const,
    login_id: '20201234',
    name: 'Kim Student 01',
  },
}

const professorSession = {
  access_token: 'dev-token:PRF001',
  user: {
    id: 2,
    role: 'professor' as const,
    login_id: 'PRF001',
    name: 'Lee Professor 02',
  },
}

const courses = [
  {
    id: 1,
    course_code: 'CSE116',
    title: 'Capstone Design A',
    professor_name: 'Lee Professor 02',
    classroom_code: 'B101',
  },
]

async function mockBase(page: Parameters<typeof test>[0]['page'], session: typeof studentSession | typeof professorSession) {
  await page.route('**/health', async (route) => {
    await route.fulfill({ json: { status: 'ok' } })
  })
  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({ json: apiEnvelope(session) })
  })
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: apiEnvelope(session) })
  })
  await page.route('**/api/notices/*', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })
}

test('student selected LMS screen shows grade feedback and updates Q&A/progress through envelope APIs', async ({ page }) => {
  let progressPayload: Record<string, unknown> | null = null
  let qnaPayload: Record<string, unknown> | null = null

  await mockBase(page, studentSession)
  await page.route('**/api/students/20201234/courses', async (route) => {
    await route.fulfill({ json: apiEnvelope(courses) })
  })
  await page.route('**/api/students/20201234/devices', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })
  await page.route('**/api/students/20201234/courses/CSE116/grades', async (route) => {
    await route.fulfill({
      json: apiEnvelope({
        course_code: 'CSE116',
        student_id: '20201234',
        student_name: 'Kim Student 01',
        overall_percent: 85,
        items: [
          {
            item_type: 'assignment',
            item_id: 201,
            title: '프로젝트 과제',
            score: 85,
            max_score: 100,
            percent: 85,
            feedback: '우수합니다',
            grading_status: 'graded',
            graded_at: '2026-05-16T09:00:00Z',
          },
        ],
      }),
    })
  })
  await page.route('**/api/students/20201234/courses/CSE116/qna', async (route) => {
    if (route.request().method() === 'POST') {
      qnaPayload = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        json: apiEnvelope({
          id: 302,
          title: qnaPayload.title,
          body: qnaPayload.body,
          status: 'open',
          student_id: '20201234',
          student_name: 'Kim Student 01',
          created_at: '2026-05-16T10:00:00Z',
          updated_at: '2026-05-16T10:00:00Z',
          posts: [],
        }),
      })
      return
    }

    await route.fulfill({
      json: apiEnvelope([
        {
          id: 301,
          title: '과제 기준 문의',
          body: '루브릭을 확인하고 싶습니다.',
          status: 'answered',
          student_id: '20201234',
          student_name: 'Kim Student 01',
          created_at: '2026-05-15T10:00:00Z',
          updated_at: '2026-05-15T11:00:00Z',
          posts: [
            { id: 401, post_type: 'answer', body: '강의자료의 평가표를 확인하세요.', created_at: '2026-05-15T11:00:00Z' },
          ],
        },
      ]),
    })
  })
  await page.route('**/api/students/20201234/courses/CSE116/learning-progress', async (route) => {
    await route.fulfill({
      json: apiEnvelope([
        {
          learning_item_id: 501,
          title: '1주차 영상',
          kind: 'video',
          week_label: '1주차',
          progress_percent: 40,
          status: 'in_progress',
          updated_at: '2026-05-16T08:00:00Z',
        },
      ]),
    })
  })
  await page.route('**/api/students/20201234/courses/CSE116/learning-items/501/progress', async (route) => {
    progressPayload = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      json: apiEnvelope({
        learning_item_id: 501,
        title: '1주차 영상',
        kind: 'video',
        week_label: '1주차',
        progress_percent: progressPayload.progress_percent,
        status: progressPayload.status,
        updated_at: '2026-05-16T10:10:00Z',
      }),
    })
  })

  await page.goto('/courses/CSE116/lms')

  await expect(page.getByRole('heading', { name: '성적·피드백' })).toBeVisible()
  await expect(page.getByText('프로젝트 과제')).toBeVisible()
  await expect(page.getByText('피드백: 우수합니다')).toBeVisible()
  await expect(page.getByText('85.0%').first()).toBeVisible()

  await page.getByLabel('1주차 영상 진도율').fill('100')
  await page.getByRole('button', { name: '진도 저장' }).click()
  await expect(page.getByText('학습 진도율을 저장했습니다.')).toBeVisible()
  expect(progressPayload).toMatchObject({ progress_percent: 100, status: 'completed' })

  await page.getByLabel('문의 제목').fill('새 문의')
  await page.getByLabel('문의 내용').fill('성적 반영 일정을 알고 싶습니다.')
  await page.getByRole('button', { name: '문의 등록' }).click()
  await expect(page.getByText('문의를 등록했습니다.')).toBeVisible()
  expect(qnaPayload).toMatchObject({ title: '새 문의', body: '성적 반영 일정을 알고 싶습니다.' })
})

test('professor can grade an assignment submission with score status and feedback', async ({ page }) => {
  let gradePayload: Record<string, unknown> | null = null

  await mockBase(page, professorSession)
  await page.route('**/api/professors/PRF001/courses', async (route) => {
    await route.fulfill({ json: apiEnvelope(courses) })
  })
  await page.route('**/api/professors/PRF001/courses/CSE116/assignments', async (route) => {
    await route.fulfill({
      json: apiEnvelope([
        {
          id: 201,
          title: '프로젝트 과제',
          description: '프로젝트 결과물 제출',
          opens_at: '2026-05-01T00:00:00Z',
          due_at: '2026-05-20T23:59:00Z',
          status: 'open',
          created_at: '2026-05-01T00:00:00Z',
          submission_count: 1,
          total_students: 1,
          max_score: 100,
        },
      ]),
    })
  })
  await page.route('**/api/professors/PRF001/courses/CSE116/assignments/201', async (route) => {
    await route.fulfill({
      json: apiEnvelope({
        id: 201,
        title: '프로젝트 과제',
        description: '프로젝트 결과물 제출',
        opens_at: '2026-05-01T00:00:00Z',
        due_at: '2026-05-20T23:59:00Z',
        status: 'open',
        created_at: '2026-05-01T00:00:00Z',
        submission_count: 1,
        total_students: 1,
        max_score: 100,
        submissions: [
          {
            id: 901,
            student_id: '20201234',
            student_name: 'Kim Student 01',
            submission_text: '프로젝트 제출합니다.',
            submitted_at: '2026-05-16T08:00:00Z',
            updated_at: '2026-05-16T08:00:00Z',
            attachments: [],
            score: null,
            max_score: 100,
            feedback: null,
            grading_status: 'submitted',
          },
        ],
      }),
    })
  })
  await page.route('**/api/professors/PRF001/courses/CSE116/assignments/201/submissions/901/grade', async (route) => {
    gradePayload = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      json: apiEnvelope({
        id: 901,
        student_id: '20201234',
        student_name: 'Kim Student 01',
        submission_text: '프로젝트 제출합니다.',
        submitted_at: '2026-05-16T08:00:00Z',
        updated_at: '2026-05-16T08:00:00Z',
        attachments: [],
        score: gradePayload.score,
        max_score: 100,
        feedback: gradePayload.feedback,
        grading_status: gradePayload.grading_status,
        graded_at: '2026-05-16T09:00:00Z',
      }),
    })
  })

  await page.goto('/courses/CSE116/assignments/201')

  await expect(page.getByRole('heading', { name: '과제 상세 · 프로젝트 과제' })).toBeVisible()
  await page.getByLabel(/점수/).fill('92')
  await page.getByLabel('채점 상태').selectOption('graded')
  await page.getByLabel('피드백').fill('분석과 구현이 모두 명확합니다.')
  await page.getByRole('button', { name: '채점 저장' }).click()

  await expect(page.getByText('채점 결과를 저장했습니다.')).toBeVisible()
  expect(gradePayload).toMatchObject({ score: 92, grading_status: 'graded', feedback: '분석과 구현이 모두 명확합니다.' })
})
