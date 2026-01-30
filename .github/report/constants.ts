/**
 * Configuration constants for the Report CLI
 */

import type { TestConfig } from './types.ts'

export const BUILD_DIR = 'build'
export const REPORTS_DIR = 'reports'
export const WATCH_DIRS = ['build/bin', 'build/models', 'build/config', 'build/pyenv', 'build/src']
export const CONFIG_DIR = 'build/config'

// Marker file patterns for different setup commands
export const MARKER_PATTERNS: Record<string, string[]> = {
  'setup:tts:qwen3': ['.qwen3-installed', '.tts-env-installed'],
  'setup:tts:chatterbox': ['.chatterbox-installed', '.tts-env-installed'],
  'setup:tts:fish': ['.fish-audio-installed', '.tts-env-installed'],
  'setup:tts:cosyvoice': ['.cosyvoice-installed', '.tts-env-installed'],
  'setup:tts': ['.tts-env-installed'],
  'setup:transcription': ['.whisper-installed', '.models-downloaded'],
  'setup:text': ['.whisper-installed', '.models-downloaded'],
}

// Test command configuration: maps setup commands to test commands
export const TEST_CONFIGS: Record<string, TestConfig> = {
  'setup:tts:qwen3': {
    type: 'tts',
    inputFile: 'input/sample.md',
    commandArgs: ['tts', 'input/sample.md', '--qwen3'],
  },
  'setup:tts:chatterbox': {
    type: 'tts',
    inputFile: 'input/sample.md',
    commandArgs: ['tts', 'input/sample.md', '--chatterbox'],
  },
  'setup:tts:fish': {
    type: 'tts',
    inputFile: 'input/sample.md',
    commandArgs: ['tts', 'input/sample.md', '--fish-audio'],
  },
  'setup:tts:cosyvoice': {
    type: 'tts',
    inputFile: 'input/sample.md',
    commandArgs: ['tts', 'input/sample.md', '--cosyvoice'],
  },
  'setup:transcription': {
    type: 'transcription',
    inputFile: 'input/audio.mp3',
    commandArgs: ['text', '--file', 'input/audio.mp3', '--whisper', 'base'],
  },
  'setup:text': {
    type: 'transcription',
    inputFile: 'input/audio.mp3',
    commandArgs: ['text', '--file', 'input/audio.mp3', '--whisper', 'base'],
  },
}

// Patterns to detect phases from log output
export const PHASE_PATTERNS = [
  { pattern: /\[[\d:\.]+\]\s*(.+?)(\.{3}|…)?\s*$/, extract: 1 },
  { pattern: /^(Installing|Cloning|Downloading|Building|Compiling|Creating|Setting up|Updating)\s+(.+)/i, extract: 0 },
  { pattern: /^(#+\s*)?(.+?)\s*(completed|done|finished|success|failed|error)/i, extract: 2 },
]

// Patterns to detect downloads
export const DOWNLOAD_PATTERNS = [
  /(?:wget|curl)\s+.*?(https?:\/\/[^\s'"]+)/gi,
  /git\s+clone\s+.*?(https?:\/\/[^\s'"]+|git@[^\s'"]+)/gi,
  /(?:huggingface|hf).*?(https?:\/\/huggingface\.co[^\s'"]*)/gi,
  /modelscope.*?(https?:\/\/[^\s'"]+)/gi,
  /pip\s+install\s+(?!-)[^\s]+/gi,
  /Downloading\s+(https?:\/\/[^\s]+)/gi,
]

// Available setup commands for help display
export const AVAILABLE_SETUP_COMMANDS = [
  'setup:tts:qwen3',
  'setup:tts:chatterbox',
  'setup:tts:fish',
  'setup:tts:cosyvoice',
  'setup:transcription',
  'setup:tts',
]
