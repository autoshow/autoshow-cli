// src/llms/llm-services.ts

import { OpenAI } from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { err } from '../utils/logging.ts'
import { env } from '../utils/node-utils.ts'
import { LLM_SERVICES_CONFIG } from '../process-steps/05-run-llm.ts'

export type ChatGPTModelValue = (typeof LLM_SERVICES_CONFIG.chatgpt.models)[number]['modelId']
export type ClaudeModelValue = (typeof LLM_SERVICES_CONFIG.claude.models)[number]['modelId']
export type GeminiModelValue = (typeof LLM_SERVICES_CONFIG.gemini.models)[number]['modelId']

export async function callChatGPT(
  prompt: string,
  transcript: string,
  modelValue: ChatGPTModelValue
) {
  if (!env['OPENAI_API_KEY']) {
    throw new Error('Missing OPENAI_API_KEY')
  }
  const openai = new OpenAI({ apiKey: env['OPENAI_API_KEY'] })
  const combinedPrompt = `${prompt}\n${transcript}`
  try {
    const response = await openai.chat.completions.create({
      model: modelValue,
      max_completion_tokens: 4000,
      messages: [{ role: 'user', content: combinedPrompt }],
    })
    const firstChoice = response.choices[0]
    if (!firstChoice?.message?.content) {
      throw new Error('No valid response from the API')
    }
    const content = firstChoice.message.content
    return {
      content,
      usage: {
        stopReason: firstChoice.finish_reason ?? 'unknown',
        input: response.usage?.prompt_tokens,
        output: response.usage?.completion_tokens,
        total: response.usage?.total_tokens
      }
    }
  } catch (error) {
    err(`Error in callChatGPT: ${(error as Error).message}`)
    throw error
  }
}

export async function callClaude(
  prompt: string,
  transcript: string,
  modelValue: ClaudeModelValue
) {
  if (!env['ANTHROPIC_API_KEY']) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable.')
  }
  const anthropic = new Anthropic({ apiKey: env['ANTHROPIC_API_KEY'] })
  const combinedPrompt = `${prompt}\n${transcript}`
  try {
    const res = await anthropic.messages.create({
      model: modelValue,
      max_tokens: 4000,
      messages: [
        { role: 'user', content: combinedPrompt }
      ]
    })
    // Anthropic messages can return blocks; we look for the first text block:
    const firstBlock = res.content?.[0]
    if (!firstBlock || firstBlock.type !== 'text') {
      throw new Error('No valid text content generated by Claude.')
    }
    return {
      content: firstBlock.text,
      usage: {
        stopReason: res.stop_reason ?? 'unknown',
        input: res.usage?.input_tokens,
        output: res.usage?.output_tokens,
        total: (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0)
      }
    }
  } catch (error) {
    err(`Error in callClaude: ${(error as Error).message}`)
    throw error
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function callGemini(
  prompt: string,
  transcript: string,
  modelValue: GeminiModelValue
) {
  if (!env['GEMINI_API_KEY']) {
    throw new Error('Missing GEMINI_API_KEY environment variable.')
  }
  const genAI = new GoogleGenerativeAI(env['GEMINI_API_KEY'])
  const geminiModel = genAI.getGenerativeModel({ model: modelValue })
  const combinedPrompt = `${prompt}\n${transcript}`
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await geminiModel.generateContent(combinedPrompt)
      const response = await result.response
      const text = response.text()
      const { usageMetadata } = response
      const {
        promptTokenCount,
        candidatesTokenCount,
        totalTokenCount
      } = usageMetadata ?? {}
      return {
        content: text,
        usage: {
          stopReason: 'complete',
          input: promptTokenCount,
          output: candidatesTokenCount,
          total: totalTokenCount
        }
      }
    } catch (error) {
      err(
        `Error in callGemini (attempt ${attempt}/${maxRetries}): ${
          (error as Error).message
        }`
      )
      if (attempt === maxRetries) {
        throw error
      }
      await delay(2 ** attempt * 1000)
    }
  }
  throw new Error('Exhausted all Gemini API call retries without success.')
}