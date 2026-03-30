import assert from 'node:assert/strict'
import test from 'node:test'

import { getPrimaryNavigation } from '../src/features/navigation/navigation.js'

test("getPrimaryNavigation('student') returns the exact workspace labels and ids", () => {
  assert.deepEqual(getPrimaryNavigation('student'), [
    { id: 'dashboard', label: '워크스페이스' },
    { id: 'profile', label: '프로필' },
    { id: 'course', label: '강의' },
  ])
})

test("getPrimaryNavigation('admin') returns the exact admin labels and ids", () => {
  assert.deepEqual(getPrimaryNavigation('admin'), [
    { id: 'dashboard', label: '운영 현황' },
    { id: 'profile', label: '계정' },
  ])
})

test("getPrimaryNavigation('professor') matches the student labels and ids for now", () => {
  assert.deepEqual(getPrimaryNavigation('professor'), [
    { id: 'dashboard', label: '워크스페이스' },
    { id: 'profile', label: '프로필' },
    { id: 'course', label: '강의' },
  ])
})

test("getPrimaryNavigation('student') returns isolated data on each call", () => {
  const first = getPrimaryNavigation('student')
  const second = getPrimaryNavigation('student')

  first[0].label = '변경됨'
  first.push({ id: 'dashboard', label: '추가됨' })

  assert.deepEqual(second, [
    { id: 'dashboard', label: '워크스페이스' },
    { id: 'profile', label: '프로필' },
    { id: 'course', label: '강의' },
  ])
})
