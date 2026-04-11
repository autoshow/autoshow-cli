import { expect, test } from 'bun:test'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { rm } from 'node:fs/promises'
import { runCommand } from '../../test-utils/test-helpers'

test('download direct document URL derives step1 slug from the original URL filename', async () => {
  const pdfBytes = await Bun.file('input/examples/document/1-document.pdf').bytes()
  const server = createServer((req, res) => {
    if (req.url === '/Quarterly%20Report.v1.pdf') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/pdf')
      res.end(Buffer.from(pdfBytes))
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

  const url = `http://127.0.0.1:${address.port}/Quarterly%20Report.v1.pdf`
  let outputDir: string | null = null

  try {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'download', url],
      { testName: 'download direct document URL derives step1 slug from the original URL filename' }
    )

    expect(result.exitCode).toBe(0)
    outputDir = result.outputDir
    expect(outputDir).not.toBeNull()
    if (!outputDir) {
      return
    }

    const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as { step1?: Record<string, unknown> }
    expect(metadata.step1?.['slug']).toBe('Quarterly Report.v1')
    expect(metadata.step1?.['slug']).not.toBe('document')
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

    if (outputDir) {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
