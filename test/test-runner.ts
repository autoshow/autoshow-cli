#!/usr/bin/env bun

process.env['AGENT'] = ''

import { runTestRunner } from './test-runner/runner'

let exitCode = 0
try {
  exitCode = await runTestRunner(process.argv)
} catch (error) {
  exitCode = 1
  console.error(error instanceof Error ? error.message : String(error))
}
process.exit(exitCode)
