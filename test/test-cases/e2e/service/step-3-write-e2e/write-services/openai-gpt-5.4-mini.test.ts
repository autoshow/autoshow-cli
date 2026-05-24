import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { openaiWrite } from './cases'

defineLLMWriteTest({
  ...openaiWrite,
  models: ['gpt-5.4-mini'],
  llmService: 'openai',
  promptProfiles: { 'gpt-5.4-mini': 'shortSummary' },
})

