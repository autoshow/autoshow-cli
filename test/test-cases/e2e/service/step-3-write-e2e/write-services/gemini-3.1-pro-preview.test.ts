import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { geminiWrite } from './cases'

defineLLMWriteTest({
  ...geminiWrite,
  models: ['gemini-3.1-pro-preview'],
  llmService: 'gemini',
  promptProfiles: { 'gemini-3.1-pro-preview': 'shortSummary' },
})

