import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { geminiWrite } from './cases'

defineLLMWriteTest({
  ...geminiWrite,
  models: ['gemini-3.1-flash-lite'],
  llmService: 'gemini',
})
