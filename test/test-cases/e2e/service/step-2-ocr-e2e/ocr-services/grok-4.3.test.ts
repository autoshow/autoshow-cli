import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { grokOcr } from './cases'

defineOCRServiceTest({
  ...grokOcr,
  models: ['grok-4.3'],
  expectedService: 'grok',
})

