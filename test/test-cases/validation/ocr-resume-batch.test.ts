import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runCommand } from '../../test-utils/test-helpers'
import { readBatchItems, readRunMetadata } from '../../test-utils/manifest-helpers'

const cleanupPaths = new Set<string>()
const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const parseBatchDir = (output: string): string => {
  const clean = stripAnsi(output)
  const tableMatches = Array.from(clean.matchAll(/Locations[\s\S]*?│\s*batchManifest\s*│\s*([^\n\r│]+\/batch\.json)\s*│/g))
  const tablePath = tableMatches.at(-1)?.[1]?.trim()
  if (tablePath) {
    return resolve(tablePath.slice(0, -'/batch.json'.length))
  }

  const plainMatches = Array.from(clean.matchAll(/Batch manifest:\s*([^\n\r]+\/batch\.json)/g))
  const plainPath = plainMatches.at(-1)?.[1]?.trim()
  if (plainPath) {
    return resolve(plainPath.slice(0, -'/batch.json'.length))
  }

  throw new Error(`Could not find batch manifest location in command output:\n${output}`)
}

afterEach(async () => {
  for (const path of cleanupPaths) {
    await rm(path, { recursive: true, force: true }).catch(() => {})
  }
  cleanupPaths.clear()
})

const startOcrResumeServer = async () => {
  const pdfBytes = await Bun.file('input/examples/document/1-document.pdf').bytes()
  const state = {
    glmFailuresRemaining: 1,
    mistralCalls: 0,
    glmCalls: 0,
    reportRequests: 0
  }

  const server = createServer((req, res) => {
    const url = req.url ?? ''
    const method = req.method ?? 'GET'

    if (url === '/report') {
      state.reportRequests += 1
      res.statusCode = 200
      res.setHeader('content-type', 'application/pdf')
      if (method === 'HEAD') {
        res.end()
        return
      }
      res.end(Buffer.from(pdfBytes))
      return
    }

    if (url === '/v1/ocr' && method === 'POST') {
      state.mistralCalls += 1
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        pages: [
          {
            index: 0,
            markdown: 'Existing Mistral extract.',
            images: [],
            dimensions: null
          }
        ],
        model: 'mistral-ocr-2512',
        usage_info: {
          pages_processed: 1,
          doc_size_bytes: pdfBytes.length
        }
      }))
      return
    }

    if (url === '/api/paas/v4/layout_parsing' && method === 'POST') {
      state.glmCalls += 1
      if (state.glmFailuresRemaining > 0) {
        state.glmFailuresRemaining -= 1
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ message: 'temporary glm failure' }))
        return
      }

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: 'glm-ocr-1',
        model: 'glm-ocr',
        md_results: 'Recovered GLM extract.',
        layout_details: [
          [
            {
              index: 1,
              label: 'text',
              content: 'Recovered GLM extract.'
            }
          ]
        ],
        data_info: {
          num_pages: 1
        },
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      }))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine OCR resume test server port')
  }

  return {
    server,
    state,
    baseUrl: `http://127.0.0.1:${address.port}`
  }
}

const stopServer = async (server: ReturnType<typeof createServer>): Promise<void> => {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error)
        return
      }
      resolveClose()
    })
  })
}

test('ocr batch resume autodiscovers the newest incomplete local-file batch and reruns only missing providers', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-resume-local-'))
  cleanupPaths.add(tempDir)

  const pdfPath = resolve('input/examples/document/1-document.pdf')
  const inputListPath = join(tempDir, 'inputs.md')
  await writeFile(inputListPath, `${pdfPath}\n`)

  const { server, baseUrl } = await startOcrResumeServer()
  try {
    const env = {
      MISTRAL_API_KEY: 'mistral-test-key',
      MISTRAL_BASE_URL: baseUrl,
      GLM_API_KEY: 'glm-test-key',
      ZAI_BASE_URL: baseUrl
    }

    const initial = await runCommand([
      'src/cli/create-cli.ts',
      'ocr',
      inputListPath,
      '--batch-all',
      '--mistral-ocr',
      'mistral-ocr-2512',
      '--glm-ocr',
      'glm-ocr'
    ], {
      testName: 'ocr resume local initial batch',
      env
    })

    expect(initial.exitCode).toBe(0)
    const batchDir = parseBatchDir(`${initial.stdout}\n${initial.stderr}`)
    cleanupPaths.add(batchDir)

    const initialInfo = await readBatchItems(batchDir)
    const initialEntry = initialInfo[0] as Record<string, unknown>
    expect(initialEntry['completionStatus']).toBe('incomplete')
    expect(initialEntry['source']).toEqual({ filePath: pdfPath })
    expect(initialEntry['requestedProviders']).toEqual([
      { service: 'mistral', model: 'mistral-ocr-2512' },
      { service: 'glm', model: 'glm-ocr' }
    ])
    expect(initialEntry['missingProviders']).toEqual([
      { service: 'glm', model: 'glm-ocr' }
    ])

    const itemOutputDir = String(initialEntry['outputDir'])
    const initialExtraction = await Bun.file(join(itemOutputDir, 'extraction.txt')).text()
    expect(initialExtraction).toContain('Existing Mistral extract.')

    const resumed = await runCommand([
      'src/cli/create-cli.ts',
      'resume',
      '--glm-ocr',
      'glm-ocr'
    ], {
      testName: 'ocr resume local autodiscovery',
      env
    })

    expect(resumed.exitCode).toBe(0)
    expect(`${resumed.stdout}\n${resumed.stderr}`).toContain('Auto-discovered resumable OCR batch')
    expect(`${resumed.stdout}\n${resumed.stderr}`).toContain('resumeBatch')

    const updatedInfo = await readBatchItems(batchDir)
    const updatedEntry = updatedInfo[0] as Record<string, unknown>
    expect(updatedEntry['completionStatus']).toBe('full')
    expect(updatedEntry['missingProviders']).toEqual([])
    expect(Array.isArray(updatedEntry['step2'])).toBe(true)
    expect((updatedEntry['step2'] as unknown[])).toHaveLength(2)

    const updatedExtraction = await Bun.file(join(itemOutputDir, 'extraction.txt')).text()
    expect(updatedExtraction).toContain('Existing Mistral extract.')
    expect(await Bun.file(join(itemOutputDir, 'providers', 'glm-glm-ocr', 'extraction.txt')).text()).toContain('Recovered GLM extract.')
  } finally {
    await stopServer(server)
  }
})

test('ocr batch resume re-downloads direct-document URLs when resuming from an explicit batch directory', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-resume-url-'))
  cleanupPaths.add(tempDir)

  const { server, state, baseUrl } = await startOcrResumeServer()
  try {
    const reportUrl = `${baseUrl}/report`
    const inputListPath = join(tempDir, 'inputs.md')
    await writeFile(inputListPath, `${reportUrl}\n`)

    const env = {
      MISTRAL_API_KEY: 'mistral-test-key',
      MISTRAL_BASE_URL: baseUrl,
      GLM_API_KEY: 'glm-test-key',
      ZAI_BASE_URL: baseUrl
    }

    const initial = await runCommand([
      'src/cli/create-cli.ts',
      'ocr',
      inputListPath,
      '--batch-all',
      '--mistral-ocr',
      'mistral-ocr-2512',
      '--glm-ocr',
      'glm-ocr'
    ], {
      testName: 'ocr resume url initial batch',
      env
    })

    expect(initial.exitCode).toBe(0)
    const batchDir = parseBatchDir(`${initial.stdout}\n${initial.stderr}`)
    cleanupPaths.add(batchDir)

    const info = await readBatchItems(batchDir)
    const entry = info[0] as Record<string, unknown>
    expect(entry['completionStatus']).toBe('incomplete')
    expect(entry['source']).toEqual({ url: reportUrl })

    const reportRequestsAfterInitial = state.reportRequests

    const resumed = await runCommand([
      'src/cli/create-cli.ts',
      'resume',
      batchDir,
      '--glm-ocr',
      'glm-ocr'
    ], {
      testName: 'ocr resume url explicit batch dir',
      env
    })

    expect(resumed.exitCode).toBe(0)
    expect(state.reportRequests).toBeGreaterThan(reportRequestsAfterInitial)

    const updatedInfo = await readBatchItems(batchDir)
    const updatedEntry = updatedInfo[0] as Record<string, unknown>
    expect(updatedEntry['completionStatus']).toBe('full')
    expect(updatedEntry['missingProviders']).toEqual([])

    const itemOutputDir = String(updatedEntry['outputDir'])
    const rootExtraction = await Bun.file(join(itemOutputDir, 'extraction.txt')).text()
    expect(rootExtraction).toContain('Existing Mistral extract.')
    expect(await Bun.file(join(itemOutputDir, 'providers', 'glm-glm-ocr', 'extraction.txt')).text()).toContain('Recovered GLM extract.')
  } finally {
    await stopServer(server)
  }
})

test('resume accepts an explicit single OCR output directory and updates only that run in place', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-resume-single-'))
  cleanupPaths.add(tempDir)

  const pdfPath = resolve('input/examples/document/1-document.pdf')
  const cliEntry = resolve('src/cli/create-cli.ts')

  const { server, baseUrl } = await startOcrResumeServer()
  try {
    const env = {
      MISTRAL_API_KEY: 'mistral-test-key',
      MISTRAL_BASE_URL: baseUrl,
      GLM_API_KEY: 'glm-test-key',
      ZAI_BASE_URL: baseUrl
    }

    const initial = await runCommand([
      cliEntry,
      'ocr',
      pdfPath,
      '--mistral-ocr',
      'mistral-ocr-2512',
      '--glm-ocr',
      'glm-ocr'
    ], {
      testName: 'ocr resume single initial run',
      env,
      cwd: tempDir
    })

    expect(initial.exitCode).toBe(0)
    const outputDir = typeof initial.outputDir === 'string'
      ? resolve(tempDir, initial.outputDir)
      : null
    expect(typeof outputDir).toBe('string')

    const beforeMetadata = await readRunMetadata(outputDir as string)
    expect(beforeMetadata['completionStatus']).toBe('incomplete')

    const resumed = await runCommand([
      cliEntry,
      'resume',
      outputDir as string,
      '--glm-ocr',
      'glm-ocr'
    ], {
      testName: 'ocr resume explicit single output dir',
      env,
      cwd: tempDir
    })

    expect(resumed.exitCode).toBe(0)

    const afterMetadata = await readRunMetadata(outputDir as string)
    expect(afterMetadata['completionStatus']).toBe('full')
    expect(afterMetadata['missingProviders']).toEqual([])
    expect(Array.isArray(afterMetadata['step2'])).toBe(true)
    expect((afterMetadata['step2'] as unknown[])).toHaveLength(2)
    expect(await Bun.file(join(outputDir as string, 'providers', 'glm-glm-ocr', 'extraction.txt')).text()).toContain('Recovered GLM extract.')
  } finally {
    await stopServer(server)
  }
})
