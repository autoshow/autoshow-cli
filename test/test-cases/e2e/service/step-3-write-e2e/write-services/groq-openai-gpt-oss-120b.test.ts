import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { groqWrite } from './cases'

defineLLMWriteTest({
  ...groqWrite,
  models: ['openai/gpt-oss-120b'],
  llmService: 'groq',
  promptProfiles: { 'openai/gpt-oss-120b': 'shortSummary' },
})

