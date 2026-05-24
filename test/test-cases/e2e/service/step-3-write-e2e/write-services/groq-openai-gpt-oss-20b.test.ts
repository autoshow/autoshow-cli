import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { groqWrite } from './cases'

defineLLMWriteTest({
  ...groqWrite,
  models: ['openai/gpt-oss-20b'],
  llmService: 'groq',
})

