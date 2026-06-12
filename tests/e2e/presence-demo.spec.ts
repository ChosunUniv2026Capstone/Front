import { expect, test } from '@playwright/test'

const apiEnvelope = <T,>(data: T) => {
  if (data && typeof data === 'object' && 'success' in data) {
    return data
  }
  return { success: true, data, message: 'ok', meta: {} }
}

type AdminSnapshotSource = 'live' | 'demo'

const adminSnapshot = (overlayActive: boolean, source: AdminSnapshotSource) => ({
  cacheHit: false,
  overlayActive,
  classroomCode: 'B101',
  observedAt: '2026-04-07T15:05:00+09:00',
  collectionMode: 'dummy-openwrt',
  classroomNetworks: [
    {
      id: 1,
      classroom_code: 'B101',
      ap_id: source === 'demo' ? 'phy3-ap0' : 'phy1-ap0',
      ssid: source === 'demo' ? 'CU-B101-DEMO' : 'CU-B101-REAL',
      gateway_host: 'gw',
      signal_threshold_dbm: -65,
      collection_mode: 'dummy',
    },
  ],
  deviceOptions: [
    {
      studentLoginId: '20201239',
      studentName: 'Kim Student 06',
      deviceLabel: 'Choi Phone',
      macAddress: '52:54:00:12:34:56',
      observed: overlayActive,
    },
  ],
  aps: [
    {
      apId: source === 'demo' ? 'phy3-ap0' : 'phy1-ap0',
      ssid: source === 'demo' ? 'CU-B101-DEMO' : 'CU-B101-REAL',
      sourceCommand: source === 'demo' ? 'iw dev phy3-ap0 station dump' : 'iw dev phy1-ap0 station dump',
      stations: [
        {
          macAddress: source === 'demo' ? '52:54:00:12:34:56' : '52:54:00:AA:BB:CC',
          associated: overlayActive,
          authenticated: true,
          authorized: true,
          signalDbm: source === 'demo' ? -47 : -51,
          connectedSeconds: 95,
          rxBytes: 120101,
          txBytes: 94310,
          deviceLabel: source === 'demo' ? 'Choi Phone' : 'Real Phone',
          ownerName: source === 'demo' ? 'Kim Student 06' : 'Real Student 01',
          ownerLoginId: source === 'demo' ? '20201239' : '20209999',
        },
      ],
    },
  ],
})

test('admin overlay controls and student eligibility change are visible', async ({ page }) => {
  let overlayApplied = false

  await page.route('**/health', async (route) => {
    await route.fulfill({ json: { status: 'ok' } })
  })

  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { login_id: string }
    const isAdmin = body.login_id === 'ADM001'
    await route.fulfill({
      json: apiEnvelope({
        access_token: `dev-token:${body.login_id}`,
        user: {
          id: isAdmin ? 900 : 901,
          role: isAdmin ? 'admin' : 'student',
          login_id: body.login_id,
          name: isAdmin ? 'Choi Admin 01' : 'Kim Student 06',
        },
      }),
    })
  })

  await page.route('**/api/admin/users', async (route) => {
    await route.fulfill({
      json: apiEnvelope([
        { id: 1, role: 'student', login_id: '20201239', name: 'Kim Student 06' },
        { id: 2, role: 'professor', login_id: 'PRF002', name: 'Lee Professor 02' },
        { id: 3, role: 'admin', login_id: 'ADM001', name: 'Choi Admin 01' },
      ]),
    })
  })

  await page.route('**/api/admin/classrooms', async (route) => {
    await route.fulfill({
      json: apiEnvelope([
        { id: 1, classroom_code: 'B101', name: 'Capstone Lab', building: 'Main', floor_label: '1F' },
      ]),
    })
  })

  await page.route('**/api/admin/classroom-networks', async (route) => {
    await route.fulfill({
      json: apiEnvelope([
        { id: 1, classroom_code: 'B101', ap_id: 'phy3-ap0', ssid: 'CU-B101-2G-2', gateway_host: 'gw', collection_mode: 'dummy' },
      ]),
    })
  })
  await page.route('**/api/admin/classroom-networks/1', async (route) => {
    await route.fulfill({
      json: apiEnvelope({ id: 1, classroom_code: 'B101', ap_id: 'phy3-ap0', ssid: 'CU-B101-2G-2', gateway_host: 'gw', signal_threshold_dbm: -65, collection_mode: 'dummy' }),
    })
  })

  await page.route('**/api/admin/presence/classrooms/B101/snapshot**', async (route) => {
    const url = new URL(route.request().url())
    const source = url.searchParams.get('source') === 'demo' ? 'demo' : 'live'
    await route.fulfill({ json: apiEnvelope(adminSnapshot(source === 'demo' ? overlayApplied : true, source)) })
  })

  await page.route('**/api/admin/presence/classrooms/B101/dummy-controls', async (route) => {
    overlayApplied = true
    await route.fulfill({ json: apiEnvelope(adminSnapshot(true, 'demo')) })
  })

  await page.route('**/api/admin/presence/classrooms/B101/dummy-controls/reset', async (route) => {
    overlayApplied = false
    await route.fulfill({ json: apiEnvelope(adminSnapshot(false, 'demo')) })
  })

  await page.route('**/api/students/20201239/courses', async (route) => {
    await route.fulfill({
      json: apiEnvelope([
        { id: 1, course_code: 'CSE116', title: 'Capstone Design A', professor_name: 'Lee Professor 02', classroom_code: 'B101' },
      ]),
    })
  })
  await page.route('**/api/notices/20201239', async (route) => {
    await route.fulfill({ json: apiEnvelope([]) })
  })
  await page.route('**/api/students/20201239/devices', async (route) => {
    await route.fulfill({ json: apiEnvelope([{ id: 1, label: 'Choi Phone', mac_address: '52:54:00:12:34:56', status: 'active' }]) })
  })
  await page.route('**/api/students/20201239/courses/CSE116/attendance/active-sessions', async (route) => {
    await route.fulfill({
      json: apiEnvelope({ course_code: 'CSE116', student_id: '20201239', sessions: [] }),
    })
  })
  await page.route('**/api/students/20201239/courses/CSE116/attendance/semester-matrix', async (route) => {
    await route.fulfill({
      json: apiEnvelope({ course_code: 'CSE116', course_title: 'Capstone Design A', student_id: '20201239', student_name: 'Kim Student 06', weeks: [] }),
    })
  })
  await page.route('**/api/attendance/eligibility', async (route) => {
    await route.fulfill({
      json: apiEnvelope(overlayApplied
        ? {
            eligible: true,
            reason_code: 'OK',
            matched_device_mac: '52:54:00:12:34:56',
            observed_at: '2026-04-07T15:05:00+09:00',
            snapshot_age_seconds: 2,
            evidence: { classroomId: 'B101', matchedApIds: ['phy3-ap0'] },
          }
        : {
            eligible: false,
            reason_code: 'NETWORK_NOT_ELIGIBLE',
            matched_device_mac: '52:54:00:12:34:56',
            observed_at: '2026-04-07T15:05:00+09:00',
            snapshot_age_seconds: 2,
            evidence: { classroomId: 'B101', matchedApIds: ['phy3-ap0'] },
          }),
    })
  })

  await page.goto('/')
  await page.getByLabel('아이디').fill('ADM001')
  await page.getByLabel('비밀번호').fill('devpass123')
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page.getByText('관리 기능 범위')).toBeVisible()
  await expect(page.getByText('조회/데모 MVP')).toBeVisible()
  await page.getByRole('button', { name: '재실 시연 제어 (demo)' }).click()
  await expect(page.getByRole('combobox').nth(1)).toContainText('20201239 / Kim Student 06 / Choi Phone / 52:54:00:12:34:56')
  await page.getByRole('button', { name: '재실 상태 적용' }).click()
  await page.getByRole('button', { name: '강의실 및 네트워크 현황' }).click()
  await expect(page.getByText('데모 AP 모니터링')).toHaveCount(0)
  await page.getByRole('button', { name: /B101/ }).first().click()
  const networkCard = page.locator('.admin-card', { hasText: 'B101' }).first()
  await expect(networkCard.getByText('실제 AP · phy1-ap0')).toBeVisible()
  await expect(networkCard.getByText('Real Student 01')).toBeVisible()
  await expect(networkCard.getByText('Demo AP · phy3-ap0')).toBeVisible()
  await expect(networkCard.getByText('Kim Student 06')).toBeVisible()
  await expect(page.getByText('10초 자동 켜기')).toBeVisible()
  await expect(page.getByRole('button', { name: /데모 AP 전체/ })).toBeVisible()

  await page.getByRole('button', { name: '로그아웃' }).click()
  await page.getByLabel('아이디').fill('20201239')
  await page.getByLabel('비밀번호').fill('devpass123')
  await page.getByRole('button', { name: '로그인' }).click()
  await page.getByRole('button', { name: '바로가기' }).click()
  await page.getByRole('button', { name: '출석 상태: 수업시간 아님' }).click()
  await page.getByRole('button', { name: '인접성 확인' }).click()
  await expect(page.getByText('강의실 인접 확인됨')).toBeVisible()
  await expect(page.getByText('reason_code: OK')).toHaveCount(0)
})
