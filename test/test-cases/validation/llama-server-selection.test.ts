import { afterEach, describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import {
  evaluateLlamaServerIdentityMatch,
  findLlamaServerPidsFromPsOutput,
  parseLlamaServerIdentityFromModels,
  parseLlamaServerIdentityFromProps,
  resolveLlamaServerTarget,
} from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'

const originalModelPath = process.env['LLAMA_MODEL_PATH']
const originalModelRepo = process.env['LLAMA_MODEL_REPO']

afterEach(() => {
  if (originalModelPath === undefined) {
    delete process.env['LLAMA_MODEL_PATH']
  } else {
    process.env['LLAMA_MODEL_PATH'] = originalModelPath
  }

  if (originalModelRepo === undefined) {
    delete process.env['LLAMA_MODEL_REPO']
  } else {
    process.env['LLAMA_MODEL_REPO'] = originalModelRepo
  }
})

describe('llama server selection helpers', () => {
  test('parses /props identity with normalized model path', () => {
    const identity = parseLlamaServerIdentityFromProps({
      model_alias: 'unsloth/Qwen3.5-2B-GGUF',
      model_path: './runtime/models/llama/qwen35.gguf'
    })

    expect(identity).not.toBeNull()
    expect(identity?.modelId).toBe('unsloth/Qwen3.5-2B-GGUF')
    expect(identity?.aliases).toEqual(['unsloth/Qwen3.5-2B-GGUF'])
    expect(identity?.modelPath).toBe(resolve(process.cwd(), 'runtime/models/llama/qwen35.gguf'))
  })

  test('parses llama.cpp /v1/models responses and ignores non-llama servers', () => {
    const llamaIdentity = parseLlamaServerIdentityFromModels({
      object: 'list',
      data: [{
        id: 'ggml-org/Qwen3-0.6B-GGUF',
        aliases: ['ggml-org/Qwen3-0.6B-GGUF'],
        owned_by: 'llamacpp'
      }],
      models: [{
        model: 'ggml-org/Qwen3-0.6B-GGUF'
      }]
    })

    expect(llamaIdentity).not.toBeNull()
    expect(llamaIdentity?.modelId).toBe('ggml-org/Qwen3-0.6B-GGUF')
    expect(llamaIdentity?.aliases).toEqual(['ggml-org/Qwen3-0.6B-GGUF'])

    const genericOpenAiIdentity = parseLlamaServerIdentityFromModels({
      object: 'list',
      data: [{
        id: 'gpt-4o-mini',
        owned_by: 'openai'
      }]
    })

    expect(genericOpenAiIdentity).toBeNull()
  })

  test('matches repo targets against reported model ids and aliases', () => {
    delete process.env['LLAMA_MODEL_PATH']
    delete process.env['LLAMA_MODEL_REPO']

    const target = resolveLlamaServerTarget('ggml-org/Qwen3-0.6B-GGUF')
    const match = evaluateLlamaServerIdentityMatch(target, {
      source: 'models',
      modelId: 'ggml-org/Qwen3-0.6B-GGUF',
      aliases: ['ggml-org/Qwen3-0.6B-GGUF'],
      modelPath: null
    })
    const mismatch = evaluateLlamaServerIdentityMatch(target, {
      source: 'models',
      modelId: 'ggml-org/gemma-3-270m-it-GGUF',
      aliases: ['ggml-org/gemma-3-270m-it-GGUF'],
      modelPath: null
    })

    expect(match.matches).toBe(true)
    expect(mismatch.matches).toBe(false)
    expect(mismatch.reason).toContain('expected repo ggml-org/Qwen3-0.6B-GGUF')
  })

  test('matches LLAMA_MODEL_PATH targets using normalized model_path', () => {
    process.env['LLAMA_MODEL_PATH'] = './runtime/models/llama/custom.gguf'
    delete process.env['LLAMA_MODEL_REPO']

    const target = resolveLlamaServerTarget('ignored-by-path-mode')
    const match = evaluateLlamaServerIdentityMatch(target, {
      source: 'props',
      modelId: 'custom-model',
      aliases: ['custom-model'],
      modelPath: resolve(process.cwd(), 'runtime/models/llama/custom.gguf')
    })
    const missingPath = evaluateLlamaServerIdentityMatch(target, {
      source: 'models',
      modelId: 'custom-model',
      aliases: ['custom-model'],
      modelPath: null
    })

    expect(match.matches).toBe(true)
    expect(missingPath.matches).toBe(false)
    expect(missingPath.reason).toContain('did not report model_path')
  })

  test('finds only llama-server processes that target port 8080', () => {
    const pids = findLlamaServerPidsFromPsOutput(`
      100 /opt/homebrew/bin/llama-server -hf ggml-org/gemma-3-270m-it-GGUF --host 127.0.0.1 --port 8080 --jinja
      101 /opt/homebrew/bin/llama-server -hf ggml-org/Qwen3-0.6B-GGUF --host 127.0.0.1 --port 9000 --jinja
      102 /usr/bin/python fake-server.py --port 8080
      103 llama-server --port=8080 -m /tmp/model.gguf
    `)

    expect(pids).toEqual([100, 103])
  })
})
