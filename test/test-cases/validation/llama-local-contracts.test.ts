import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import {
  evaluateLlamaServerIdentityMatch,
  parseLlamaServerIdentityFromModels,
  parseLlamaServerIdentityFromProps
} from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import type { LlamaServerIdentity, LlamaServerTarget } from '~/types'

describe('llama local contracts', () => {
  test('parses props identity and normalizes model paths', () => {
    expect(parseLlamaServerIdentityFromProps({
      model_alias: '  Qwen/Qwen3-4B  ',
      model_path: '  ./models/qwen3.gguf  '
    })).toEqual({
      source: 'props',
      modelId: 'Qwen/Qwen3-4B',
      aliases: ['Qwen/Qwen3-4B'],
      modelPath: resolve('./models/qwen3.gguf')
    })

    expect(parseLlamaServerIdentityFromProps({
      model_alias: '',
      model_path: ''
    })).toBeNull()
  })

  test('parses models identity, detects llama.cpp signature, and dedupes aliases', () => {
    expect(parseLlamaServerIdentityFromModels({
      data: [
        {
          id: '  Qwen/Qwen3-4B  ',
          owned_by: 'llamacpp',
          aliases: ['Qwen/Qwen3-4B', 'qwen3', ' qwen3 ']
        },
        {
          id: 'qwen3',
          owned_by: 'llamacpp',
          aliases: ['local-qwen3']
        }
      ]
    })).toEqual({
      source: 'models',
      modelId: 'Qwen/Qwen3-4B',
      aliases: ['Qwen/Qwen3-4B', 'qwen3', 'local-qwen3'],
      modelPath: null
    })

    expect(parseLlamaServerIdentityFromModels({
      data: [
        {
          id: 'Qwen/Qwen3-4B',
          owned_by: 'other'
        }
      ]
    })).toBeNull()
  })

  test('matches repo and path targets with stable mismatch reasons', () => {
    const pathTarget: LlamaServerTarget = {
      mode: 'path',
      requestedModel: 'ignored',
      expectedPath: '/tmp/models/qwen3.gguf',
      startupArgs: []
    }
    const pathIdentity: LlamaServerIdentity = {
      source: 'props',
      modelId: 'qwen3',
      aliases: ['qwen3'],
      modelPath: '/tmp/models/qwen3.gguf'
    }
    expect(evaluateLlamaServerIdentityMatch(pathTarget, pathIdentity)).toEqual({
      matches: true,
      reason: 'model path matches /tmp/models/qwen3.gguf'
    })

    expect(evaluateLlamaServerIdentityMatch(pathTarget, {
      ...pathIdentity,
      modelPath: null
    })).toEqual({
      matches: false,
      reason: 'llama-server did not report model_path; cannot verify expected path /tmp/models/qwen3.gguf'
    })

    const repoTarget: LlamaServerTarget = {
      mode: 'repo',
      requestedModel: 'qwen3',
      expectedRepo: 'Qwen/Qwen3-4B',
      startupArgs: []
    }
    expect(evaluateLlamaServerIdentityMatch(repoTarget, {
      source: 'models',
      modelId: 'local-qwen3',
      aliases: ['Qwen/Qwen3-4B'],
      modelPath: null
    })).toEqual({
      matches: true,
      reason: 'loaded model matches Qwen/Qwen3-4B'
    })

    expect(evaluateLlamaServerIdentityMatch(repoTarget, {
      source: 'models',
      modelId: 'Other/Model',
      aliases: ['other-alias'],
      modelPath: null
    })).toEqual({
      matches: false,
      reason: 'loaded models [Other/Model, other-alias] do not include expected repo Qwen/Qwen3-4B'
    })
  })

  test('llama server management does not inspect the process table', async () => {
    const source = await Bun.file('src/cli/commands/process-steps/step-3-write/write-local/llama/llama-server-process.ts').text()

    expect(source).not.toContain("['ps'")
    expect(source).not.toContain('pid=,command=')
    expect(source).toContain('process.kill(pid, 0)')
  })
})
