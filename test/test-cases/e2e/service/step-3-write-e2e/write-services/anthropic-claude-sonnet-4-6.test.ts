import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { anthropicWrite } from './cases'

defineLLMWriteTest({
  ...anthropicWrite,
  models: ['claude-sonnet-4-6'],
  llmService: 'anthropic',
  promptProfiles: { 'claude-sonnet-4-6': 'shortSummary' },
})

