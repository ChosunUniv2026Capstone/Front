import assert from 'node:assert/strict'
import test from 'node:test'

import { presentEligibility } from '../src/features/eligibility/presenter.js'

test('DEVICE_NOT_REGISTERED is presented as a warning with device guidance copy', () => {
  assert.deepEqual(presentEligibility({ eligible: false, reasonCode: 'DEVICE_NOT_REGISTERED' }), {
    tone: 'warning',
    badgeLabel: '주의',
    title: '등록된 단말이 필요합니다.',
    body: '프로필에서 단말을 등록한 뒤 다시 확인하세요.',
  })
})

test('OK is presented as a success-style message', () => {
  assert.deepEqual(presentEligibility({ eligible: true, reasonCode: 'OK' }), {
    tone: 'success',
    badgeLabel: '확인됨',
    title: '출석 또는 시험 접근이 가능합니다.',
    body: '현재 단말과 강의실 조건이 확인되었습니다.',
  })
})

test('NETWORK_NOT_ELIGIBLE is presented as a danger-style message', () => {
  assert.deepEqual(presentEligibility({ eligible: false, reasonCode: 'NETWORK_NOT_ELIGIBLE' }), {
    tone: 'danger',
    badgeLabel: '제한됨',
    title: '현재 네트워크에서는 확인할 수 없습니다.',
    body: '수업 강의실 네트워크 연결 상태를 점검하세요.',
  })
})

test('unknown reason codes fall back to a warning message', () => {
  assert.deepEqual(presentEligibility({ eligible: false, reasonCode: 'UNEXPECTED_REASON' }), {
    tone: 'warning',
    badgeLabel: '주의',
    title: '추가 확인이 필요합니다.',
    body: '아래 reason code 와 evidence 를 확인하세요.',
  })
})
