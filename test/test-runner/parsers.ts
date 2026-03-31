import { readFile } from 'node:fs/promises'
import type {
  ParsedCommandMetric,
  ParsedJunitCase,
  TestStatus
} from '../../src/types/tests-dir-types'
import { decodeXml, normalizeRepoPath, parseXmlAttributes, getFiniteNumber } from './utils'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const readMetrics = async (path: string): Promise<ParsedCommandMetric[]> => {
  try {
    const text = await readFile(path, 'utf8')
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
    const out: ParsedCommandMetric[] = []

    for (const line of lines) {
      let parsedRaw: unknown
      try {
        parsedRaw = JSON.parse(line)
      } catch {
        continue
      }

      if (!isRecord(parsedRaw)) {
        continue
      }

      const source = typeof parsedRaw['source'] === 'string' ? parsedRaw['source'] : 'unknown'
      const command = typeof parsedRaw['command'] === 'string' ? parsedRaw['command'] : ''
      const args = Array.isArray(parsedRaw['args'])
        ? parsedRaw['args'].filter((value): value is string => typeof value === 'string')
        : []
      const exitCode = typeof parsedRaw['exitCode'] === 'number' ? parsedRaw['exitCode'] : Number.NaN
      const durationMs = typeof parsedRaw['durationMs'] === 'number' ? parsedRaw['durationMs'] : Number.NaN

      if (!Number.isFinite(exitCode) || !Number.isFinite(durationMs)) {
        continue
      }

      const callerFile = normalizeRepoPath(typeof parsedRaw['callerFile'] === 'string' ? parsedRaw['callerFile'] : null)
      const callerLine = getFiniteNumber(parsedRaw['callerLine'])
      const callerColumn = getFiniteNumber(parsedRaw['callerColumn'])
      const outputDir = typeof parsedRaw['outputDir'] === 'string' && parsedRaw['outputDir'].length > 0 ? parsedRaw['outputDir'] : null
      const at = typeof parsedRaw['at'] === 'string' ? parsedRaw['at'] : null
      const testName = typeof parsedRaw['testName'] === 'string' ? parsedRaw['testName'] : null
      const estimatedCostCents = getFiniteNumber(parsedRaw['estimatedCostCents'])
      const actualCostCents = getFiniteNumber(parsedRaw['actualCostCents'])
      const estimatedProcessingTimeMs = getFiniteNumber(parsedRaw['estimatedProcessingTimeMs'])
      const actualProcessingTimeMs = getFiniteNumber(parsedRaw['actualProcessingTimeMs'])

      out.push({
        source,
        command,
        args,
        exitCode,
        durationMs,
        outputDir,
        callerFile,
        callerLine,
        callerColumn,
        at,
        testName,
        estimatedCostCents,
        actualCostCents,
        estimatedProcessingTimeMs,
        actualProcessingTimeMs,
      })
    }

    return out
  } catch {
    return []
  }
}

export const parseJunit = async (junitPath: string): Promise<ParsedJunitCase[]> => {
  let xml = ''
  try {
    xml = await readFile(junitPath, 'utf8')
  } catch {
    return []
  }

  const tests: ParsedJunitCase[] = []
  const suiteRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g

  for (const suiteMatch of xml.matchAll(suiteRe)) {
    const suiteAttrsRaw = suiteMatch[1] ?? ''
    const suiteBody = suiteMatch[2] ?? ''
    const suiteAttrs = parseXmlAttributes(suiteAttrsRaw)
    const suiteFile = normalizeRepoPath(suiteAttrs['file']) ?? ''

    const testcaseRe = /<testcase\b([^>]*)\/>|<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g
    for (const tcMatch of suiteBody.matchAll(testcaseRe)) {
      const attrsRaw = tcMatch[1] ?? tcMatch[2] ?? ''
      const body = tcMatch[3] ?? ''
      const attrs = parseXmlAttributes(attrsRaw)

      const name = attrs['name'] || 'unnamed'
      const file = normalizeRepoPath(attrs['file']) ?? suiteFile
      const lineRaw = attrs['line']
      const line = lineRaw ? Number.parseInt(lineRaw, 10) : Number.NaN
      const lineNumber = Number.isFinite(line) ? line : null
      const seconds = Number.parseFloat(attrs['time'] || '0')
      const durationMs = Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0

      let status: TestStatus = 'passed'
      let failureMessage: string | null = null

      const failureTag = body.match(/<failure\b([^>]*)>([\s\S]*?)<\/failure>|<failure\b([^>]*)\/>/)
      const errorTag = body.match(/<error\b([^>]*)>([\s\S]*?)<\/error>|<error\b([^>]*)\/>/)
      const skippedTag = body.match(/<skipped\b([^>]*)\/?>(?:[\s\S]*?<\/skipped>)?/)

      if (failureTag || errorTag) {
        status = 'failed'
        const failureAttrs = parseXmlAttributes(
          failureTag?.[1] ?? failureTag?.[3] ?? errorTag?.[1] ?? errorTag?.[3] ?? ''
        )
        const msgFromAttr = failureAttrs['message']?.trim()
        const bodyText = decodeXml((failureTag?.[2] ?? errorTag?.[2] ?? '').trim())
        failureMessage = msgFromAttr && msgFromAttr.length > 0
          ? msgFromAttr
          : bodyText.length > 0
            ? bodyText
            : 'Test failed'
      } else if (skippedTag) {
        status = 'skipped'
      }

      const id = `${file || 'unknown-file'}::${name}`
      tests.push({
        id,
        file: file || 'unknown-file',
        name,
        line: lineNumber,
        durationMs,
        status,
        failureMessage,
      })
    }
  }

  return tests
}
