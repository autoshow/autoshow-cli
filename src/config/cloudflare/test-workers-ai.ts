import { l } from '@/logging'

export async function testWorkersAICapabilities(accountId: string, apiToken: string): Promise<{ working: boolean; details: Record<string, string> }> {
  const p = '[config/cloudflare/test-cloudflare-credentials]'
  const details: Record<string, string> = {}
  
  try {
    const aiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'test embedding'
        })
      }
    )
    
    if (aiResponse.ok) {
      const aiData = await aiResponse.json()
      if (aiData.success && aiData.result?.data?.[0]) {
        details['workersAI'] = 'working'
        details['embeddingModel'] = '@cf/baai/bge-m3'
        return { working: true, details }
      } else {
        details['workersAI'] = 'invalid_response'
        l.warn(`${p} Workers AI returned unsuccessful response`)
        return { working: false, details }
      }
    } else if (aiResponse.status === 403) {
      details['workersAI'] = 'access_denied'
      l.warn(`${p} Workers AI access denied - insufficient permissions`)
      return { working: false, details }
    } else {
      details['workersAIError'] = `HTTP ${aiResponse.status}`
      l.warn(`${p} Workers AI test failed with status: ${aiResponse.status}`)
      return { working: false, details }
    }
  } catch (error) {
    details['workersAIError'] = (error as Error).message
    l.warn(`${p} Workers AI test error: ${(error as Error).message}`)
    return { working: false, details }
  }
}