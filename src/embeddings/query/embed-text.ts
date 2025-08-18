import { l } from '@/logging'

export async function embedText(text: string, accountId: string, apiToken: string): Promise<number[]> {
  const p = '[embeddings/query/embed-text]'
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
      if (errorData.errors?.[0]?.message) {
        throw new Error(`Workers AI embedding error: ${errorData.errors[0].message}`)
      }
    } catch (e) {
      l.dim(`${p} Failed to parse error response`)
    }
    throw new Error(`Workers AI embedding API error: ${response.status} - ${errorText}`)
  }
  
  const json = await response.json() as { 
    result?: { 
      data?: number[][],
      shape?: number[] 
    },
    success?: boolean,
    errors?: Array<{ message: string }>
  }
  
  if (!json.success || !json.result?.data?.[0]) {
    const errorMsg = json.errors?.[0]?.message || 'Unknown embedding error'
    throw new Error(`Workers AI embedding failed: ${errorMsg}`)
  }
  
  return json.result.data[0]
}