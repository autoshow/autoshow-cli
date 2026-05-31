import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { grokWrite } from './cases'

defineLLMWriteTest({
  ...grokWrite,
  models: ['grok-4.20-non-reasoning'],
  llmService: 'grok',
})

