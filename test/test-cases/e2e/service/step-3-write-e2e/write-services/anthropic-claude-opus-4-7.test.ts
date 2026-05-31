import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { anthropicWrite } from './cases'

defineLLMWriteTest({
  ...anthropicWrite,
  models: ['claude-opus-4-7'],
  llmService: 'anthropic',
  promptProfiles: { 'claude-opus-4-7': 'shortSummary' },
})

