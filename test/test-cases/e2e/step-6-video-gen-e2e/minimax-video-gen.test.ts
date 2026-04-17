import { defineVideoServiceTest } from '../../../test-utils/define-video-service-test'

defineVideoServiceTest({
  models: [
    { model: 'MiniMax-Hailuo-2.3', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'MiniMax-Hailuo-02', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
    { model: 'T2V-01-Director', extraArgs: ['--video-duration', '6'], expectedDuration: 6 },
  ],
  cliFlag: '--minimax-video',
  videoService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax video generation',
})
