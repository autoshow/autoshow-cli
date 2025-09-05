import { l } from '@/logging'

export async function callChatCompletion(userQuestion: string, context: string, accountId: string, apiToken: string): Promise<string> {
  const p = '[embeddings/query/chat-completion]'
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/responses`
  
  const prompt = `You are a helpful assistant. Use the provided context to answer questions accurately.

Context:
${context}

Question: ${userQuestion}`
  
  const requestBody = {
    model: '@cf/openai/gpt-oss-120b',
    input: prompt
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
      if (errorData.errors?.[0]?.message) {
        throw new Error(`Workers AI chat completion error: ${errorData.errors[0].message}`)
      }
    } catch (e) {
      l.dim(`${p} Failed to parse error response`)
    }
    throw new Error(`Workers AI chat completion API error: ${response.status} - ${errorText}`)
  }
  
  const responseText = await response.text()
  
  let json: any
  try {
    json = JSON.parse(responseText)
  } catch (e) {
    throw new Error(`Invalid JSON response from Workers AI: ${responseText.substring(0, 100)}`)
  }
  
  if (json.success === false) {
    const errorMsg = json.errors?.[0]?.message || 'Unknown error'
    throw new Error(`Workers AI chat completion failed: ${errorMsg}`)
  }
  
  let responseContent: string | undefined
  
  if (json.result) {
    responseContent = json.result.response || json.result.output || json.result.text || json.result.content
  }
  
  if (!responseContent && typeof json === 'string') {
    responseContent = json
  }
  
  if (!responseContent && json.output) {
    responseContent = json.output
  }
  
  if (!responseContent) {
    throw new Error(`No response content found in Workers AI response. Response keys: ${Object.keys(json).join(', ')}`)
  }
  
  return responseContent
}