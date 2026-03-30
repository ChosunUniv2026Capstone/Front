import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canManageDevices,
  getDefaultCourseTab,
  getDefaultView,
  getVisibleCourseTabs,
  isEligibilityVisible,
} from '../src/app/model.js'

test("getDefaultView('student') returns dashboard", () => {
  assert.equal(getDefaultView('student'), 'dashboard')
})

test("getDefaultView('professor') returns dashboard", () => {
  assert.equal(getDefaultView('professor'), 'dashboard')
})

test("getDefaultView('admin') returns dashboard", () => {
  assert.equal(getDefaultView('admin'), 'dashboard')
})

test("getVisibleCourseTabs('student') returns notices and eligibility", () => {
  assert.deepEqual(getVisibleCourseTabs('student'), ['notices', 'eligibility'])
})

test("getVisibleCourseTabs('professor') returns notices only", () => {
  assert.deepEqual(getVisibleCourseTabs('professor'), ['notices'])
})

test("getVisibleCourseTabs('admin') returns notices only", () => {
  assert.deepEqual(getVisibleCourseTabs('admin'), ['notices'])
})

test('getDefaultCourseTab returns notices for null', () => {
  assert.equal(getDefaultCourseTab(null), 'notices')
})

test("getDefaultCourseTab('student') returns notices", () => {
  assert.equal(getDefaultCourseTab('student'), 'notices')
})

test("getDefaultCourseTab('professor') returns notices", () => {
  assert.equal(getDefaultCourseTab('professor'), 'notices')
})

test("getDefaultCourseTab('admin') returns notices", () => {
  assert.equal(getDefaultCourseTab('admin'), 'notices')
})

test('canManageDevices returns true only for student', () => {
  assert.equal(canManageDevices('student'), true)
  assert.equal(canManageDevices('professor'), false)
  assert.equal(canManageDevices('admin'), false)
})

test('isEligibilityVisible returns true only for student', () => {
  assert.equal(isEligibilityVisible('student'), true)
  assert.equal(isEligibilityVisible('professor'), false)
  assert.equal(isEligibilityVisible('admin'), false)
})
