import { expect, test } from '@playwright/test'

const adminSnapshot = (overlayActive: boolean) => ({
  cacheHit: false,
  overlayActive,
  classroomCode: 'B101',
  observedAt: '2026-04-07T15:05:00+09:00',
  collectionMode: 'dummy-openwrt',
  classroomNetworks: [
    {
      id: 1,
      classroom_code: 'B101',
      ap_id: 'phy3-ap0',
      ssid: 'CU-B101-2G-2',
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
      apId: 'phy3-ap0',
      ssid: 'CU-B101-2G-2',
      sourceCommand: 'iw dev phy3-ap0 station dump',
      stations: [
        {
          macAddress: '52:54:00:12:34:56',
          associated: overlayActive,
          authenticated: true,
          authorized: true,
          signalDbm: -47,
          connectedSeconds: 95,
          rxBytes: 120101,
          txBytes: 94310,
          deviceLabel: 'Choi Phone',
          ownerName: 'Kim Student 06',
          ownerLoginId: '20201239',
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
      json: {
        access_token: `dev-token:${body.login_id}`,
        user: {
          id: isAdmin ? 900 : 901,
          role: isAdmin ? 'admin' : 'student',
          login_id: body.login_id,
          name: isAdmin ? 'Choi Admin 01' : 'Kim Student 06',
        },
      },
    })
  })

  await page.route('**/api/admin/users', async (route) => {
    await route.fulfill({
      json: [
        { id: 1, role: 'student', login_id: '20201239', name: 'Kim Student 06' },
        { id: 2, role: 'professor', login_id: 'PRF002', name: 'Lee Professor 02' },
        { id: 3, role: 'admin', login_id: 'ADM001', name: 'Choi Admin 01' },
      ],
    })
  })

  await page.route('**/api/admin/classrooms', async (route) => {
    await route.fulfill({
      json: [
        { id: 1, classroom_code: 'B101', name: 'Capstone Lab', building: 'Main', floor_label: '1F' },
      ],
    })
  })

  await page.route('**/api/admin/classroom-networks', async (route) => {
    await route.fulfill({
      json: [
        { id: 1, classroom_code: 'B101', ap_id: 'phy3-ap0', ssid: 'CU-B101-2G-2', gateway_host: 'gw', collection_mode: 'dummy' },
      ],
    })
  })
  await page.route('**/api/admin/classroom-networks/1', async (route) => {
    await route.fulfill({
      json: { id: 1, classroom_code: 'B101', ap_id: 'phy3-ap0', ssid: 'CU-B101-2G-2', gateway_host: 'gw', signal_threshold_dbm: -65, collection_mode: 'dummy' },
    })
  })

  await page.route('**/api/admin/presence/classrooms/B101/snapshot', async (route) => {
    await route.fulfill({ json: adminSnapshot(overlayApplied) })
  })

  await page.route('**/api/admin/presence/classrooms/B101/dummy-controls', async (route) => {
    overlayApplied = true
    await route.fulfill({ json: adminSnapshot(true) })
  })

  await page.route('**/api/admin/presence/classrooms/B101/dummy-controls/reset', async (route) => {
    overlayApplied = false
    await route.fulfill({ json: adminSnapshot(false) })
  })

  await page.route('**/api/students/20201239/courses', async (route) => {
    await route.fulfill({
      json: [
        { id: 1, course_code: 'CSE116', title: 'Capstone Design A', professor_name: 'Lee Professor 02', classroom_code: 'B101' },
      ],
    })
  })
  await page.route('**/api/notices/20201239', async (route) => {
    await route.fulfill({ json: [] })
  })
  await page.route('**/api/students/20201239/devices', async (route) => {
    await route.fulfill({ json: [{ id: 1, label: 'Choi Phone', mac_address: '52:54:00:12:34:56', status: 'active' }] })
  })
  await page.route('**/api/attendance/eligibility', async (route) => {
    await route.fulfill({
      json: overlayApplied
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
          },
    })
  })

  await page.goto('/')
  await page.getByLabel('아이디').fill('ADM001')
  await page.getByLabel('비밀번호').fill('devpass123')
  await page.getByRole('button', { name: '로그인' }).click()

  await page.getByRole('button', { name: '재실 시연 제어 (demo)' }).click()
  await expect(page.getByRole('combobox').nth(1)).toContainText('20201239 / Kim Student 06 / Choi Phone / 52:54:00:12:34:56')
  await page.getByRole('button', { name: '재실 상태 적용' }).click()
  await page.getByRole('button', { name: '강의실 및 네트워크 현황' }).click()
  await expect(page.getByText('phy3-ap0').first()).toBeVisible()

  await page.getByRole('button', { name: '로그아웃' }).click()
  await page.getByLabel('아이디').fill('20201239')
  await page.getByLabel('비밀번호').fill('devpass123')
  await page.getByRole('button', { name: '로그인' }).click()
  await page.getByRole('button', { name: '바로가기' }).click()
  await page.getByRole('button', { name: '출석 확인' }).click()
  await page.getByRole('button', { name: '재실 가능 여부 확인' }).click()
  await expect(page.getByText('이용 가능')).toBeVisible()
  await expect(page.getByText('reason_code: OK')).toBeVisible()
})
