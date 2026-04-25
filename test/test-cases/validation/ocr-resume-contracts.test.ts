import { describe, expect, test } from 'bun:test'
import {
  buildMissingProviders,
  buildMissingTargetsFromEntry,
  classifyOcrProviderFailure
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
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

  test('legacy Paddle log-only failures remain resumable', () => {
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [paddleTarget, anthropicTarget],
      providerStates: [
        providerState(tesseractTarget, 'succeeded'),
        {
          ...providerState(paddleTarget, 'failed', false),
          lastError: {
            message: 'Checking connectivity to the model hosters\nCreating model: PP-OCRv5\nResized image size exceeds max_side_limit',
            retryable: false
          }
        },
        providerState(anthropicTarget, 'failed', false)
      ]
    }

    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
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
})
