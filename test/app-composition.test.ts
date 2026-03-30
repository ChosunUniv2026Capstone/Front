/// <reference types="vite/client" />

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const compiledTestDir = fileURLToPath(new URL('.', import.meta.url))
const frontRoot = join(compiledTestDir, '..', '..')
const appSource = readFileSync(join(frontRoot, 'src/App.tsx'), 'utf8')

test('App composes focused role surfaces instead of inline dashboard/profile/course branches', () => {
  assert.match(appSource, /import\s+\{\s*DashboardView\s*\}\s+from\s+'\.\/features\/dashboard\/DashboardView'/)
  assert.match(appSource, /import\s+\{\s*ProfileView\s*\}\s+from\s+'\.\/features\/profile\/ProfileView'/)
  assert.match(appSource, /import\s+\{\s*CourseView\s*\}\s+from\s+'\.\/features\/course\/CourseView'/)

  assert.doesNotMatch(appSource, /function renderDashboard\(/)
  assert.doesNotMatch(appSource, /function renderProfile\(/)
  assert.doesNotMatch(appSource, /function renderCoursePage\(/)

  assert.match(appSource, /<DashboardView[\s\S]*\/>/)
  assert.match(appSource, /<ProfileView[\s\S]*\/>/)
  assert.match(appSource, /<CourseView[\s\S]*\/>/)
})

test('focused role surface modules exist in the feature tree', () => {
  const files = [
    'src/features/dashboard/DashboardView.tsx',
    'src/features/profile/ProfileView.tsx',
    'src/features/course/CourseView.tsx',
  ]

  for (const relativePath of files) {
    const source = readFileSync(join(frontRoot, relativePath), 'utf8')
    assert.ok(source.length > 0, `${relativePath} should not be empty`)
  }
})
