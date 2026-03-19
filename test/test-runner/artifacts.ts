import { appendFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { TestRunArtifacts } from '../../src/types/tests-dir-types'
import { formatTimestampForDir } from './utils'

export const createRunArtifacts = async (): Promise<TestRunArtifacts> => {
  const started = new Date()
  const startedAtMs = started.getTime()
  const startedAtIso = started.toISOString()
  const rootDir = resolve(process.cwd(), 'test-output')
  await mkdir(rootDir, { recursive: true })

  const base = `${formatTimestampForDir(started)}_test-run`
  let runId = base
  let runDir = resolve(rootDir, runId)

  for (let i = 1; i < 1000; i++) {
    try {
      await mkdir(runDir, { recursive: false })
      break
    } catch {
      runId = `${base}_${i}`
      runDir = resolve(rootDir, runId)
    }
  }

  const runnerLogPath = resolve(runDir, 'runner.log')
  const commandLogPath = resolve(runDir, 'commands.log')
  const metricsLogPath = resolve(runDir, 'metrics.ndjson')
  const metadataDirPath = resolve(runDir, 'metadata')
  await Bun.write(runnerLogPath, '')
  await Bun.write(commandLogPath, '')
  await Bun.write(metricsLogPath, '')
  await mkdir(metadataDirPath, { recursive: true })

  return {
    rootDir,
    runId,
    runDir,
    runnerLogPath,
    commandLogPath,
    metricsLogPath,
    junitPath: resolve(runDir, 'junit.xml'),
    reportJsonPath: resolve(runDir, 'report.json'),
    metadataDirPath,
    startedAtMs,
    startedAtIso,
  }
}

export const appendRunnerLog = async (artifacts: TestRunArtifacts, text: string): Promise<void> => {
  await appendFile(artifacts.runnerLogPath, text)
}

export const appendCommandLog = async (artifacts: TestRunArtifacts, text: string): Promise<void> => {
  await appendFile(artifacts.commandLogPath, text)
}

export const writeReportJson = async (
  artifacts: TestRunArtifacts,
  json: Record<string, unknown>
): Promise<void> => {
  await Bun.write(artifacts.reportJsonPath, JSON.stringify(json, null, 2))
}
