export const LLM_SERVICES_CONFIG = {
  skip: {
    serviceName: 'Skip LLM Processing',
    value: null,
    label: 'Skip LLM Processing',
    models: []
  },
  chatgpt: {
    serviceName: 'OpenAI ChatGPT',
    value: 'chatgpt',
    label: 'ChatGPT',
    apiKeyPropName: 'openaiApiKey',
    models: [
      { modelName: 'GPT 5.2', modelId: 'gpt-5.2', inputCostPer1M: 2.00, outputCostPer1M: 10.00, inputCostPer1MCents: 200, outputCostPer1MCents: 1000 },
      { modelName: 'GPT 5.2 Pro', modelId: 'gpt-5.2-pro', inputCostPer1M: 4.00, outputCostPer1M: 18.00, inputCostPer1MCents: 400, outputCostPer1MCents: 1800 },
      { modelName: 'GPT 5.1', modelId: 'gpt-5.1', inputCostPer1M: 1.50, outputCostPer1M: 8.00, inputCostPer1MCents: 150, outputCostPer1MCents: 800 }
    ]
  },
  claude: {
    serviceName: 'Anthropic Claude',
    value: 'claude',
    label: 'Claude',
    apiKeyPropName: 'anthropicApiKey',
    models: [
      { modelName: 'Claude Opus 4.5', modelId: 'claude-opus-4-5-20251101', inputCostPer1M: 5.00, outputCostPer1M: 25.00, inputCostPer1MCents: 500, outputCostPer1MCents: 2500 },
      { modelName: 'Claude Sonnet 4.5', modelId: 'claude-sonnet-4-5-20250929', inputCostPer1M: 3.00, outputCostPer1M: 15.00, inputCostPer1MCents: 300, outputCostPer1MCents: 1500 },
      { modelName: 'Claude Haiku 4.5', modelId: 'claude-haiku-4-5-20251001', inputCostPer1M: 1.00, outputCostPer1M: 5.00, inputCostPer1MCents: 100, outputCostPer1MCents: 500 }
    ]
  },
  gemini: {
    serviceName: 'Google Gemini',
    value: 'gemini',
    label: 'Gemini',
    apiKeyPropName: 'geminiApiKey',
    models: [
      { modelName: 'Gemini 3 Pro', modelId: 'gemini-3-pro-preview', inputCostPer1M: 2.00, outputCostPer1M: 12.00, inputCostPer1MCents: 200, outputCostPer1MCents: 1200 },
      { modelName: 'Gemini 3 Flash', modelId: 'gemini-3-flash-preview', inputCostPer1M: 0.50, outputCostPer1M: 3.00, inputCostPer1MCents: 50, outputCostPer1MCents: 300 }
    ]
  }
} as const