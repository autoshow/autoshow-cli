import { expect, test } from 'bun:test'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from '../../test-utils/test-helpers'
import { STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'

test('incomplete STT batches exit non-zero without being reported as usage errors', async () => {
  const inputDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-cli-'))
  const bytes = await Bun.file(STABLE_LOCAL_AUDIO_PATH).bytes()
  await Bun.write(join(inputDir, 'item-a.mp3'), bytes)
  await Bun.write(join(inputDir, 'item-b.mp3'), bytes)

  let nextFileId = 1
  let nextTranscriptId = 1
  const server = createServer((req, res) => {
    const url = req.url ?? ''
    const method = req.method ?? 'GET'

    if (url === '/v1/files' && method === 'POST') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ id: `file-${nextFileId++}` }))
      return
    }

    if (url === '/v1/transcriptions' && method === 'POST') {
      res.statusCode = 201
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ id: `tx-${nextTranscriptId++}`, status: 'queued' }))
      return
    }

    const transcriptStatusMatch = url.match(/^\/v1\/transcriptions\/([^/]+)$/)
    if (transcriptStatusMatch && method === 'GET') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ id: transcriptStatusMatch[1], status: 'completed' }))
      return
    }

    const transcriptMatch = url.match(/^\/v1\/transcriptions\/([^/]+)\/transcript$/)
    if (transcriptMatch && method === 'GET') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: transcriptMatch[1],
        text: `Recovered Soniox transcript ${transcriptMatch[1]}.`,
        tokens: [
          { text: `Recovered Soniox transcript ${transcriptMatch[1]}.`, start_ms: 0, end_ms: 1000, speaker: 0 }
        ]
      }))
      return
    }

    if (url.startsWith('/v1/transcriptions/') && method === 'DELETE') {
      res.statusCode = 204
      res.end()
      return
    }

    if (url.startsWith('/v1/files/') && method === 'DELETE') {
      res.statusCode = 204
      res.end()
      return
    }

    if (url === '/v1/audio/transcriptions' && method === 'POST') {
      res.statusCode = 401
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ detail: 'Unauthorized' }))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine test server port')
  }

  let batchDir: string | undefined
  try {
    const baseUrl = `http://127.0.0.1:${address.port}/v1`
    const result = await runCommand(
      [
        'src/cli/create-cli.ts',
        'stt',
        inputDir,
        '--batch-all',
        '--batch-concurrency', '2',
        '--soniox-stt', 'stt-async-v4',
        '--mistral-stt', 'voxtral-mini-2602',
        '--no-cache'
      ],
      {
        testName: 'incomplete STT batches exit non-zero without being reported as usage errors',
        env: {
          SONIOX_API_KEY: 'soniox-test-key',
          SONIOX_BASE_URL: baseUrl,
          MISTRAL_API_KEY: 'mistral-test-key',
          MISTRAL_BASE_URL: baseUrl
        }
      }
    )

    batchDir = result.stdout
      .split('\n')
      .find((line) => line.includes('output/'))?.match(/output\/[^\s]+/)?.[0]

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('STT batch incomplete:')
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('Usage error:')
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

    await rm(inputDir, { recursive: true, force: true }).catch(() => {})
    if (batchDir) {
      await rm(batchDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
