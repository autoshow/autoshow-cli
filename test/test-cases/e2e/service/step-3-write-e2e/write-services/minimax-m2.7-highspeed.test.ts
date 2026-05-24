import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { minimaxWrite } from './cases'

defineLLMWriteTest({
  ...minimaxWrite,
  models: ['MiniMax-M2.7-highspeed'],
  llmService: 'minimax',
  promptProfiles: { 'MiniMax-M2.7-highspeed': 'shortSummary' },
})

