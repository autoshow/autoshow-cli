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
      { modelName: 'GPT 5', modelId: 'gpt-5', inputCostPer1M: 1.25, outputCostPer1M: 10.00, inputCostPer1MCents: 125, outputCostPer1MCents: 1000 },
      { modelName: 'GPT 5 Mini', modelId: 'gpt-5-mini', inputCostPer1M: 0.25, outputCostPer1M: 2.00, inputCostPer1MCents: 25, outputCostPer1MCents: 200 },
      { modelName: 'GPT 5 Nano', modelId: 'gpt-5-nano', inputCostPer1M: 0.05, outputCostPer1M: 0.40, inputCostPer1MCents: 5, outputCostPer1MCents: 40 }
    ]
  },
  claude: {
    serviceName: 'Anthropic Claude',
    value: 'claude',
    label: 'Claude',
    apiKeyPropName: 'anthropicApiKey',
    models: [
      { modelName: 'Claude Opus 4', modelId: 'claude-opus-4-20250514', inputCostPer1M: 15.00, outputCostPer1M: 75.00, inputCostPer1MCents: 1500, outputCostPer1MCents: 7500 },
      { modelName: 'Claude Sonnet 4', modelId: 'claude-sonnet-4-20250514', inputCostPer1M: 3.00, outputCostPer1M: 15.00, inputCostPer1MCents: 300, outputCostPer1MCents: 1500 },
      { modelName: 'Claude Opus 4.1', modelId: 'claude-opus-4-1-20250805', inputCostPer1M: 15.00, outputCostPer1M: 75.00, inputCostPer1MCents: 1500, outputCostPer1MCents: 7500 }
    ]
  },
  gemini: {
    serviceName: 'Google Gemini',
    value: 'gemini',
    label: 'Gemini',
    apiKeyPropName: 'geminiApiKey',
    models: [
      { modelName: 'Gemini 2.5 Pro', modelId: 'gemini-2.5-pro', inputCostPer1M: 1.25, outputCostPer1M: 10.00, inputCostPer1MCents: 125, outputCostPer1MCents: 1000 },
      { modelName: 'Gemini 2.5 Flash', modelId: 'gemini-2.5-flash', inputCostPer1M: 0.30, outputCostPer1M: 2.50, inputCostPer1MCents: 30, outputCostPer1MCents: 250 },
      { modelName: 'Gemini 2.5 Flash Lite Preview', modelId: 'gemini-2.5-flash-lite-preview-06-17', inputCostPer1M: 0.10, outputCostPer1M: 0.40, inputCostPer1MCents: 10, outputCostPer1MCents: 40 }
    ]
  }
} as const