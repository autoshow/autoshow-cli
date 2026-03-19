import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { parseJunit } from '../../test-runner/parsers'

describe('test runner junit parsing', () => {
  test('marks self-closing failure tags as failed tests', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'autoshow-cli-bun-junit-'))
    const junitPath = join(rootDir, 'junit.xml')

    try {
      await writeFile(junitPath, `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="suite" file="test/test-cases/e2e/example.test.ts">
    <testcase name="example failure" file="test/test-cases/e2e/example.test.ts" line="12" time="1.25">
      <failure type="AssertionError" />
    </testcase>
  </testsuite>
</testsuites>`)

      const cases = await parseJunit(junitPath)
      expect(cases).toEqual([
        {
          id: 'test/test-cases/e2e/example.test.ts::example failure',
          file: 'test/test-cases/e2e/example.test.ts',
          name: 'example failure',
          line: 12,
          durationMs: 1250,
          status: 'failed',
          failureMessage: 'Test failed',
        }
      ])
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
