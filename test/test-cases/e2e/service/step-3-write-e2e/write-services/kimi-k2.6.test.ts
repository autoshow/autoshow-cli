import { defineLLMWriteTest } from '../../../../../test-utils/define-llm-write-test'
import { kimiWrite } from './cases'

defineLLMWriteTest({
  ...kimiWrite,
  models: ['kimi-k2.6'],
  llmService: 'kimi',
})

