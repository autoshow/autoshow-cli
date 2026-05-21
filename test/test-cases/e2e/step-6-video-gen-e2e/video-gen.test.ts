import { test, expect } from 'bun:test'
import { defineVideoServiceTest } from '../../../test-utils/define-video-service-test'
import {
  runCommand
} from '../../../test-utils/test-helpers'

defineVideoServiceTest({
  models: [
    { model: 'veo-3.1-fast-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
    { model: 'veo-3.1-generate-preview', extraArgs: ['--video-duration', '4'], expectedDuration: 4 },
  ],
  cliFlag: '--gemini',
  videoService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'MiniMax-Hailuo-2.3', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'MiniMax-Hailuo-2.3-Fast', extraArgs: ['--video-mode', 'image-to-video', '--video-input-image', 'input/examples/document/1-document.jpg', '--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01-Director', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
  ],
  cliFlag: '--minimax',
  videoService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'cogvideox-3', extraArgs: ['--video-duration', '5'], expectedDuration: 5 },
    { model: 'viduq1-text', extraArgs: ['--video-duration', '5'], expectedDuration: 5 },
  ],
  cliFlag: '--glm',
  videoService: 'glm',
  envVarKey: 'GLM_API_KEY',
  envVarDescription: 'GLM video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'grok-imagine-video', extraArgs: ['--video-duration', '1', '--video-resolution', '480p'] },
  ],
  cliFlag: '--grok',
  videoService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'Grok video generation',
})

defineVideoServiceTest({
  models: [
    { model: 'gen4.5', extraArgs: ['--video-duration', '5'], expectedDuration: 5, prompt: 'A serene mountain landscape at sunrise with mist rolling through the valleys' },
  ],
  cliFlag: '--runway',
  videoService: 'runway',
  envVarKey: 'RUNWAYML_API_SECRET',
  envVarDescription: 'Runway video generation',
})

test('requires a provider flag', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise'],
  )
  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Specify a video generation provider')
})
