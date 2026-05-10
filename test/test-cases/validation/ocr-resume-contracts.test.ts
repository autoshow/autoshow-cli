import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildMissingProviders,
  buildMissingTargetsFromEntry,
  classifyOcrProviderFailure,
  parseStoredRequestedTarget
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import { resolvePrimaryOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import {
  buildPaddlePreparedImagePath,
  extractPaddleOcrJsonLine,
  isPaddleNativeCrashExitCode,
  parsePaddleImageDimensions,
  summarizePaddleFailure
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/paddle-ocr/run-paddle-ocr'
import { writeAwsTextractSyncDocumentFile } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/aws-textract/run-aws-textract'
import type { OcrProviderState, OcrTarget } from '~/types'

const requestedTargets: OcrTarget[] = [
  { service: 'tesseract', model: 'tesseract' },
  { service: 'paddle-ocr', model: 'paddle-ocr' },
  { service: 'anthropic', model: 'claude-haiku-4-5' }
]
const tesseractTarget = requestedTargets[0] as OcrTarget
const paddleTarget = requestedTargets[1] as OcrTarget
const anthropicTarget = requestedTargets[2] as OcrTarget

const providerState = (
  target: OcrTarget,
  status: OcrProviderState['status'],
  retryable?: boolean
): OcrProviderState => ({
  service: target.service,
  model: target.model,
  artifactDir: `providers/${target.service}-${target.model}`,
  status,
  attempts: status === 'succeeded' ? 1 : 2,
  ...(retryable !== undefined ? { retryable } : {}),
  ...(status === 'failed'
    ? {
        lastError: {
          message: `${target.service} failed`,
          retryable: retryable === true
        }
      }
    : {})
})

describe('OCR resume contracts', () => {
  test('only retryable failed providers remain resumable when explicit missing providers are stored', () => {
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [paddleTarget, anthropicTarget],
      providerStates: [
        providerState(tesseractTarget, 'succeeded'),
        providerState(paddleTarget, 'failed', true),
        providerState(anthropicTarget, 'failed', false)
      ]
    }

    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
      paddleTarget
    ])
  })

  test('permanent provider failures are recorded but not written as missing providers', () => {
    const states = [
      providerState(tesseractTarget, 'succeeded'),
      providerState(paddleTarget, 'failed', true),
      providerState(anthropicTarget, 'failed', false)
    ]

    expect(buildMissingProviders(states, requestedTargets)).toEqual([
      paddleTarget
    ])
  })

  test('content filter failures are classified as non-retryable', () => {
    const failure = classifyOcrProviderFailure(new Error(
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Output blocked by content filtering policy"}}'
    ))

    expect(failure.retryable).toBe(false)
    expect(failure.message).toContain('Output blocked by content filtering policy')
  })

  test('transient OCR failures are classified as retryable', () => {
    const error = Object.assign(new Error('provider timed out while reading OCR response'), {
      status: 503
    })

    expect(classifyOcrProviderFailure(error).retryable).toBe(true)
  })

  test('primary OCR service-only match succeeds when unique', () => {
    expect(resolvePrimaryOcrTarget(requestedTargets, 'paddle-ocr')).toEqual(paddleTarget)
  })

  test('primary OCR service/model exact match succeeds', () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.4' }
    ]

    expect(resolvePrimaryOcrTarget(targets, 'openai/gpt-5.4')).toEqual(targets[1])
  })

  test('primary OCR unknown or ambiguous values fail', () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.4' }
    ]

    expect(() => resolvePrimaryOcrTarget(targets, 'gemini')).toThrow('--primary-ocr gemini does not match')
    expect(() => resolvePrimaryOcrTarget(targets, 'openai')).toThrow('matches multiple')
  })

  test('stored OCR targets include AWS Textract and Google Document AI', () => {
    expect(parseStoredRequestedTarget({ service: 'aws-textract', model: 'detect-document-text' })).toEqual({
      service: 'aws-textract',
      model: 'detect-document-text'
    })
    expect(parseStoredRequestedTarget({ service: 'gcloud-docai', model: 'processor/default' })).toEqual({
      service: 'gcloud-docai',
      model: 'processor/default'
    })
  })

  test('Paddle JSON extraction ignores noisy stdout after the payload', () => {
    expect(extractPaddleOcrJsonLine([
      'Checking connectivity to the model hosters',
      '{"text":"hello","confidence":0.9}',
      'Creating model: PP-OCRv5'
    ].join('\n'))).toBe('{"text":"hello","confidence":0.9}')
  })

  test('Paddle log-only failures are ANSI-stripped without retry override', () => {
    const failure = classifyOcrProviderFailure(new Error(
      'PaddleOCR exited with code 1 for page.png.\n\u001B[31mChecking connectivity to the model hosters\u001B[0m\nCreating model: PP-OCRv5\nResized image size exceeds max_side_limit'
    ))

    expect(failure.message).not.toContain('\u001B[')
    expect(failure.retryable).toBe(false)
  })

  test('Paddle signal failures include signal context and stripped details', () => {
    const summary = summarizePaddleFailure('page.png', {
      exitCode: 138,
      stdout: '\u001B[31mCreating model: PP-OCRv5_server_det\u001B[0m',
      stderr: 'Resized image size exceeds max_side_limit'
    })

    expect(summary).toContain('SIGBUS')
    expect(summary).toContain('Resized image size exceeds max_side_limit')
    expect(summary).toContain('Creating model: PP-OCRv5_server_det')
    expect(summary).not.toContain('\u001B[')
  })

  test('Paddle retry summaries include model profile and max side attempts', () => {
    const failure = classifyOcrProviderFailure(new Error(
      'PaddleOCR failed for page.png after attempts: auto/3200px, auto/2400px, mobile/1800px.\nPaddleOCR exited with code 138 (SIGBUS) for page.png.'
    ))

    expect(failure.retryable).toBe(true)
    expect(failure.message).toContain('mobile/1800px')
  })

  test('Paddle native crash exit codes are retryable by the local runner', () => {
    expect(isPaddleNativeCrashExitCode(138)).toBe(true)
    expect(isPaddleNativeCrashExitCode(137)).toBe(true)
    expect(isPaddleNativeCrashExitCode(139)).toBe(true)
    expect(isPaddleNativeCrashExitCode(1)).toBe(false)
  })

  test('Paddle prepared image paths include the max-side attempt size', () => {
    expect(buildPaddlePreparedImagePath('/tmp/source/document.jpg', '/tmp/work', 2400)).toBe('/tmp/work/document-paddle-2400.jpg')
    expect(buildPaddlePreparedImagePath('/tmp/source/document', '/tmp/work', 1800)).toBe('/tmp/work/document-paddle-1800.jpg')
  })

  test('Paddle image dimensions parse ImageMagick identify output', () => {
    expect(parsePaddleImageDimensions('3923 4656')).toEqual({ width: 3923, height: 4656 })
    expect(parsePaddleImageDimensions('0 4656')).toBeUndefined()
    expect(parsePaddleImageDimensions('not dimensions')).toBeUndefined()
  })

  test('AWS Textract sync document payload is written through file URI', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-resume-contracts-'))
    try {
      const inputPath = join(tempDir, 'document.jpg')
      await Bun.write(inputPath, new Uint8Array([0, 1, 2, 3, 4, 5]))

      const documentArg = await writeAwsTextractSyncDocumentFile(inputPath, tempDir)
      expect(documentArg).toStartWith('file://')
      expect(documentArg).not.toContain('AAECAwQF')

      const payload = await Bun.file(documentArg.slice('file://'.length)).json() as { Bytes?: unknown }
      expect(payload.Bytes).toBe(Buffer.from([0, 1, 2, 3, 4, 5]).toString('base64'))
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
