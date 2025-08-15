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
      { modelName: 'GPT 4o', modelId: 'gpt-4o', inputCostPer1M: 2.50, outputCostPer1M: 10.00, inputCostPer1MCents: 250, outputCostPer1MCents: 1000 },
      { modelName: 'GPT 4o MINI', modelId: 'gpt-4o-mini', inputCostPer1M: 0.15, outputCostPer1M: 0.60, inputCostPer1MCents: 15, outputCostPer1MCents: 60 },
      { modelName: 'GPT o1 MINI', modelId: 'o1-mini', inputCostPer1M: 1.10, outputCostPer1M: 4.40, inputCostPer1MCents: 110, outputCostPer1MCents: 440 }
    ]
  },
  claude: {
    serviceName: 'Anthropic Claude',
    value: 'claude',
    label: 'Claude',
    apiKeyPropName: 'anthropicApiKey',
    models: [
      { modelName: 'Claude 3.7 Sonnet', modelId: 'claude-3-7-sonnet-latest', inputCostPer1M: 3.00, outputCostPer1M: 15.00, inputCostPer1MCents: 300, outputCostPer1MCents: 1500 },
      { modelName: 'Claude 3.5 Haiku', modelId: 'claude-3-5-haiku-latest', inputCostPer1M: 0.80, outputCostPer1M: 4.00, inputCostPer1MCents: 80, outputCostPer1MCents: 400 },
    ]
  },
  gemini: {
    serviceName: 'Google Gemini',
    value: 'gemini',
    label: 'Gemini',
    apiKeyPropName: 'geminiApiKey',
    models: [
      { modelName: 'Gemini 1.5 Pro', modelId: 'gemini-1.5-pro', inputCostPer1M: 2.50, outputCostPer1M: 10.00, inputCostPer1MCents: 250, outputCostPer1MCents: 1000 },
      { modelName: 'Gemini 1.5 Flash-8B', modelId: 'gemini-1.5-flash-8b', inputCostPer1M: 0.075, outputCostPer1M: 0.30, inputCostPer1MCents: 7.5, outputCostPer1MCents: 30 },
      { modelName: 'Gemini 1.5 Flash', modelId: 'gemini-1.5-flash', inputCostPer1M: 0.15, outputCostPer1M: 0.60, inputCostPer1MCents: 15, outputCostPer1MCents: 60 },
      { modelName: 'Gemini 2.0 Flash-Lite', modelId: 'gemini-2.0-flash-lite', inputCostPer1M: 0.075, outputCostPer1M: 0.30, inputCostPer1MCents: 7.5, outputCostPer1MCents: 30 },
      { modelName: 'Gemini 2.0 Flash', modelId: 'gemini-2.0-flash', inputCostPer1M: 0.10, outputCostPer1M: 0.40, inputCostPer1MCents: 10, outputCostPer1MCents: 40 },
    ]
  }
} as const