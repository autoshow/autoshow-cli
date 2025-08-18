import { l } from '@/logging'

export async function callChatCompletion(userQuestion: string, context: string, accountId: string, apiToken: string): Promise<string> {
  const p = '[text/embeddings/chat-completion]'
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/responses`
  
  const prompt = `You are a helpful assistant. Use the provided context to answer questions accurately.

Context:
${context}

Question: ${userQuestion}`
  
  l.dim(`${p} Calling gpt-oss-120b via /ai/v1/responses endpoint`)
  l.dim(`${p} Prompt length: ${prompt.length} characters`)
  
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
  
  l.dim(`${p} Chat completion API response status: ${response.status}`)
  
  if (!response.ok) {
    const errorText = await response.text()
    l.dim(`${p} Error response: ${errorText}`)
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
  l.dim(`${p} Raw response received, length: ${responseText.length}`)
  
  let json: any
  try {
    json = JSON.parse(responseText)
    l.dim(`${p} Response JSON parsed successfully`)
  } catch (e) {
    l.dim(`${p} Failed to parse JSON response: ${responseText.substring(0, 200)}...`)
    throw new Error(`Invalid JSON response from Workers AI: ${responseText.substring(0, 100)}`)
  }
  
  l.dim(`${p} Response structure: ${JSON.stringify(Object.keys(json), null, 2)}`)
  
  if (json.success === false) {
    const errorMsg = json.errors?.[0]?.message || 'Unknown error'
    throw new Error(`Workers AI chat completion failed: ${errorMsg}`)
  }
  
  let responseContent: string | undefined
  
  if (json.result) {
    l.dim(`${p} Found result object, keys: ${JSON.stringify(Object.keys(json.result), null, 2)}`)
    responseContent = json.result.response || json.result.output || json.result.text || json.result.content
  }
  
  if (!responseContent && typeof json === 'string') {
    l.dim(`${p} Response appears to be a direct string`)
    responseContent = json
  }
  
  if (!responseContent && json.output) {
    l.dim(`${p} Found output field at root level`)
    responseContent = json.output
  }
  
  if (!responseContent) {
    l.dim(`${p} Could not extract response content. Full response: ${JSON.stringify(json, null, 2)}`)
    throw new Error(`No response content found in Workers AI response. Response keys: ${Object.keys(json).join(', ')}`)
  }
  
  l.dim(`${p} Successfully extracted response content, length: ${responseContent.length}`)
  return responseContent
}