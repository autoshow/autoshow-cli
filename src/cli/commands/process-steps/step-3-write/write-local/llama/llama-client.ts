import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { LlamaResponseSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import * as l from '~/utils/logger'
import {
  LLAMA_BASE_URL,
  LLAMA_CHAT_TEMPLATE_KWARGS,
  LLAMA_EMPTY_RESPONSE_MAX_ATTEMPTS,
  LLAMA_EMPTY_RESPONSE_RETRY_DELAY_MS
} from './llama-constants'

export const requestLlamaCompletion = async (prompt: string, model: string, signal?: AbortSignal): Promise<{ responseText: string, outputTokenCount: number }> => {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false,
      temperature: 0.7,
      max_tokens: 4096,
      chat_template_kwargs: LLAMA_CHAT_TEMPLATE_KWARGS
    }),
    ...(signal ? { signal } : {})
  }

  for (let attempt = 1; attempt <= LLAMA_EMPTY_RESPONSE_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, init)

    if (!response.ok) {
      throw new Error(`llama.cpp API error: ${response.status} ${response.statusText}`)
    }

    const rawData = await response.json()
    const data = validateData(LlamaResponseSchema, rawData, 'llama.cpp API response')
    const responseText = data.choices?.[0]?.message?.content ?? ''

    if (responseText.trim().length > 0) {
      return {
        responseText,
        outputTokenCount: data.usage?.completion_tokens || countTokens(responseText)
      }
    }

    if (attempt < LLAMA_EMPTY_RESPONSE_MAX_ATTEMPTS) {
      l.debug(`llama.cpp returned an empty response; retrying (${attempt}/${LLAMA_EMPTY_RESPONSE_MAX_ATTEMPTS})`)
      await Bun.sleep(LLAMA_EMPTY_RESPONSE_RETRY_DELAY_MS)
    }
  }

  throw new Error('No response from llama.cpp model')
}
