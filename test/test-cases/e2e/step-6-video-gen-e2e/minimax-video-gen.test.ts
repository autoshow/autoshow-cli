import { defineVideoServiceTest } from '../../../test-utils/define-video-service-test'

defineVideoServiceTest({
  models: ['MiniMax-Hailuo-2.3', 'T2V-01', 'MiniMax-Hailuo-02', 'T2V-01-Director'],
  cliFlag: '--minimax-video',
})
