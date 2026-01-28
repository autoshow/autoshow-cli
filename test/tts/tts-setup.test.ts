import { describe, test, expect } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { exec } from 'node:child_process'

import type { ExecException } from 'node:child_process'

const CONFIG_DIR = resolve(process.cwd(), 'build/config')
const TTS_VENV = resolve(process.cwd(), 'build/pyenv/tts')
const TTS_PYTHON = resolve(TTS_VENV, 'bin/python')
const COSYVOICE_DIR = resolve(process.cwd(), 'build/cosyvoice')

function runCommand(command: string, timeoutMs = 600000): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { shell: '/bin/zsh', timeout: timeoutMs }, (
      _error: ExecException | null, stdout: string, _stderr: string
    ) => {
      resolve(stdout)
    })
  })
}

function canImportModule(moduleName: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`${TTS_PYTHON} -c "import ${moduleName}"`, { shell: '/bin/zsh' }, (error) => {
      resolve(!error)
    })
  })
}

describe('TTS Setup Tests', () => {
  
  describe('bun setup:tts', () => {
    test('setup:tts creates TTS virtual environment', async () => {
      await runCommand('bun setup:tts')
      
      expect(existsSync(TTS_VENV)).toBe(true)
      expect(existsSync(TTS_PYTHON)).toBe(true)
      
      const markerFile = resolve(CONFIG_DIR, '.tts-env-installed')
      expect(existsSync(markerFile)).toBe(true)
      
      const configFile = resolve(CONFIG_DIR, '.tts-config.json')
      expect(existsSync(configFile)).toBe(true)
      
      const hasNumpy = await canImportModule('numpy')
      expect(hasNumpy).toBe(true)
      
      const hasTorch = await canImportModule('torch')
      expect(hasTorch).toBe(true)
      
      const hasSoundfile = await canImportModule('soundfile')
      expect(hasSoundfile).toBe(true)
    })
  })
  
  describe('bun setup:tts:qwen3', () => {
    test('setup:tts:qwen3 installs qwen-tts package', async () => {
      await runCommand('bun setup:tts:qwen3')
      
      const markerFile = resolve(CONFIG_DIR, '.qwen3-installed')
      expect(existsSync(markerFile)).toBe(true)
      
      const hasQwenTts = await canImportModule('qwen_tts')
      expect(hasQwenTts).toBe(true)
    })
  })
  
  describe('bun setup:tts:chatterbox', () => {
    test('setup:tts:chatterbox installs chatterbox-tts package', async () => {
      await runCommand('bun setup:tts:chatterbox')
      
      const markerFile = resolve(CONFIG_DIR, '.chatterbox-installed')
      expect(existsSync(markerFile)).toBe(true)
      
      const hasChatterbox = await canImportModule('chatterbox')
      expect(hasChatterbox).toBe(true)
    })
  })
  
  describe('bun setup:tts:fish', () => {
    test('setup:tts:fish installs FishAudio dependencies', async () => {
      await runCommand('bun setup:tts:fish')
      
      const markerFile = resolve(CONFIG_DIR, '.fish-audio-installed')
      expect(existsSync(markerFile)).toBe(true)
      
      const hasRequests = await canImportModule('requests')
      expect(hasRequests).toBe(true)
      
    })
  })
  
  describe('bun setup:tts:cosyvoice', () => {
    test('setup:tts:cosyvoice installs CosyVoice', async () => {
      await runCommand('bun setup:tts:cosyvoice', 1200000)
      
      const markerFile = resolve(CONFIG_DIR, '.cosyvoice-installed')
      expect(existsSync(markerFile)).toBe(true)
      
      const dockerSetup = await new Promise<boolean>((resolve) => {
        exec('docker ps --format "{{.Names}}" | grep -q "cosyvoice-api"', { shell: '/bin/zsh' }, (error) => {
          resolve(!error)
        })
      })
      
      if (dockerSetup) {
        expect(dockerSetup).toBe(true)
      } else {
        expect(existsSync(COSYVOICE_DIR)).toBe(true)
        
        const modelDir = resolve(COSYVOICE_DIR, 'pretrained_models/Fun-CosyVoice3-0.5B')
        expect(existsSync(modelDir)).toBe(true)
        
        const hasDiffusers = await canImportModule('diffusers')
        expect(hasDiffusers).toBe(true)
        
        const hasTransformers = await canImportModule('transformers')
        expect(hasTransformers).toBe(true)
      }
    })
  })
})
