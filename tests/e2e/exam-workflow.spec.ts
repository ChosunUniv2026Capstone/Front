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

const baseExam = {
  id: 101,
  title: '자료구조 중간고사',
  description: '연결 리스트와 트리 기본 개념을 점검합니다.',
  exam_type: 'midterm' as const,
  status: 'open' as const,
  starts_at: '2099-03-03T15:00:00Z',
  ends_at: '2099-03-03T16:00:00Z',
  duration_minutes: 60,
  requires_presence: true,
  late_entry_allowed: false,
  auto_submit_enabled: true,
  shuffle_questions: false,
  shuffle_options: false,
  max_attempts: 1,
}

const examQuestions = [
  {
    id: 1001,
    question_order: 1,
    question_type: 'multiple_choice' as const,
    prompt: '연결 리스트에서 임의 위치 삽입 시 필요한 것은 무엇인가요?',
    points: 5,
    explanation: null,
    is_required: true,
    selected_option_id: null,
    options: [
      { id: 2001, option_order: 1, option_text: '이전 노드 포인터', is_correct: true },
      { id: 2002, option_order: 2, option_text: '배열 인덱스', is_correct: false },
      { id: 2003, option_order: 3, option_text: '해시 버킷', is_correct: false },
      { id: 2004, option_order: 4, option_text: '정렬 키', is_correct: false },
    ],
  },
  {
    id: 1002,
    question_order: 2,
    question_type: 'multiple_choice' as const,
    prompt: '트리 순회 중 루트를 마지막에 방문하는 방식은 무엇인가요?',
    points: 5,
    explanation: null,
    is_required: true,
    selected_option_id: null,
    options: [
      { id: 2101, option_order: 1, option_text: '전위 순회', is_correct: false },
      { id: 2102, option_order: 2, option_text: '중위 순회', is_correct: false },
      { id: 2103, option_order: 3, option_text: '후위 순회', is_correct: true },
      { id: 2104, option_order: 4, option_text: '레벨 순회', is_correct: false },
    ],
  },
]

async function mockStudentExamApp(
  page: Parameters<typeof test>[0]['page'],
  options?: {
    startErrorEnvelope?: { status: number; body: Record<string, unknown> }
  },
) {
  let started = false
  let submitted = false
  let submitRequestUrl: string | null = null
  const selectedOptionIds = new Map<number, number | null>()

  const buildExamSummary = () => ({
    ...baseExam,
    attempts_used: started ? 1 : 0,
    availability: {
      code: submitted ? 'closed' : started ? 'in_progress' : 'available',
      label: submitted ? '제출 완료' : started ? '응시 중' : '응시 가능',
      can_start: !submitted,
      can_submit: started && !submitted,
    },
    attempt: started
      ? {
          id: 5001,
          attempt_no: 1,
          status: submitted ? 'submitted' : 'in_progress',
          started_at: '2099-03-03T15:00:00Z',
          submitted_at: submitted ? '2099-03-03T15:25:00Z' : null,
          expires_at: '2099-03-03T16:00:00Z',
          score: submitted ? 10 : null,
          total_count: examQuestions.length,
          answered_count: Array.from(selectedOptionIds.values()).filter((value) => value != null).length,
        }
      : null,
  })

  const buildExamDetail = () => ({
    ...buildExamSummary(),
    questions: started
      ? examQuestions.map((question) => ({
          ...question,
          selected_option_id: selectedOptionIds.get(question.id) ?? null,
        }))
      : [],
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

  await page.route('**/api/students/20201234/courses/CSE116/exams', async (route) => {
    await route.fulfill({ json: [buildExamSummary()] })
  })

  await page.route('**/api/students/20201234/courses/CSE116/exams/101', async (route) => {
    await route.fulfill({ json: buildExamDetail() })
  })

  await page.route('**/api/students/20201234/courses/CSE116/exams/101/start', async (route) => {
    if (options?.startErrorEnvelope) {
      await route.fulfill({
        status: options.startErrorEnvelope.status,
        json: options.startErrorEnvelope.body,
      })
      return
    }

    started = true
    await route.fulfill({
      json: {
        submission_id: 5001,
        attempt_no: 1,
        status: 'in_progress',
        started_at: '2099-03-03T15:00:00Z',
        expires_at: '2099-03-03T16:00:00Z',
        idempotent: false,
      },
    })
  })

  await page.route('**/api/students/20201234/courses/CSE116/exams/101/submissions/5001/answers/*', async (route) => {
    const questionId = Number(route.request().url().split('/').pop())
    const body = route.request().postDataJSON() as { selected_option_id: number | null }
    selectedOptionIds.set(questionId, body.selected_option_id)
    await route.fulfill({
      json: {
        submission_id: 5001,
        question_id: questionId,
        selected_option_id: body.selected_option_id,
        answer_text: null,
        answered_at: '2099-03-03T15:05:00Z',
      },
    })
  })

  await page.route('**/api/students/20201234/courses/CSE116/exams/101/submit', async (route) => {
    submitRequestUrl = route.request().url()
    submitted = true
    await route.fulfill({
      json: {
        exam_id: 101,
        attempt: buildExamSummary().attempt,
        score: 10,
        total_count: examQuestions.length,
        answered_count: examQuestions.length,
      },
    })
  })

  return {
    getSubmitRequestUrl: () => submitRequestUrl,
  }
}

test('student exam flow enters take route, warns on unanswered questions, and submits through the current frontend route', async ({ page }) => {
  const examApp = await mockStudentExamApp(page)

  await page.goto('/courses/CSE116/exams')

  await expect(page.getByRole('heading', { name: '응시 가능한 시험' })).toBeVisible()
  await expect(page.getByText('자료구조 중간고사')).toBeVisible()

  await page.getByRole('button', { name: '응시 시작' }).click()

  await expect(page).toHaveURL(/\/courses\/CSE116\/exams\/101\/take$/)
  await expect(page.getByText('시험 응시 중')).toBeVisible()
  await expect(page.getByText('1번 문항')).toBeVisible()

  await page.getByRole('button', { name: '다음 문항' }).click()
  await page.getByRole('button', { name: '답안 제출' }).click()

  await expect(page.getByText('아직 답하지 않은 문제가 있어요.')).toBeVisible()
  await expect(page.getByText('미응답 문항: 1번, 2번')).toBeVisible()
  await page.getByRole('button', { name: '확인' }).click()

  await page.getByRole('button', { name: '다음 문항' }).click()
  await page.getByRole('radio').nth(2).check()
  await page.getByRole('button', { name: '이전 문항' }).click()
  await page.getByRole('radio').nth(0).check()
  await page.getByRole('button', { name: '다음 문항' }).click()
  await page.getByRole('button', { name: '답안 제출' }).click()

  await expect(page).toHaveURL(/\/courses\/CSE116\/exams$/)
  expect(examApp.getSubmitRequestUrl()).toContain('/api/students/20201234/courses/CSE116/exams/101/submit')
})

test('student exam start shows the localized registered-device guidance when backend returns PRESENCE_INELIGIBLE', async ({ page }) => {
  await mockStudentExamApp(page, {
    startErrorEnvelope: {
      status: 403,
      body: {
        success: false,
        error: {
          code: 'PRESENCE_INELIGIBLE',
          message: 'attendance is not allowed',
          details: {
            reason_code: 'DEVICE_NOT_REGISTERED',
          },
        },
      },
    },
  })

  await page.goto('/courses/CSE116/exams')
  await page.getByRole('button', { name: '응시 시작' }).click()

  await expect(page.getByText('등록된 단말이 아닙니다. 단말기기를 등록해주세요.')).toBeVisible()
  await expect(page).toHaveURL(/\/courses\/CSE116\/exams$/)
})
