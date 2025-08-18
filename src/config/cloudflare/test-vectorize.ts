import { l } from '@/logging'

export async function testVectorizeCapabilities(accountId: string, apiToken: string): Promise<{ working: boolean; details: Record<string, string> }> {
  const p = '[config/cloudflare/test-cloudflare-credentials]'
  const details: Record<string, string> = {}
  
  try {
    const indexListResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (indexListResponse.ok) {
      const indexData = await indexListResponse.json()
      const indexCount = indexData.result?.length || 0
      details['vectorizeIndexes'] = indexCount.toString()
      return { working: true, details }
    } else if (indexListResponse.status === 403) {
      details['vectorizeAccess'] = 'denied'
      l.warn(`${p} Vectorize API access denied - insufficient permissions`)
      return { working: false, details }
    } else {
      details['vectorizeError'] = `HTTP ${indexListResponse.status}`
      l.warn(`${p} Vectorize API test failed with status: ${indexListResponse.status}`)
      return { working: false, details }
    }
  } catch (error) {
    details['vectorizeError'] = (error as Error).message
    l.warn(`${p} Vectorize API test error: ${(error as Error).message}`)
    return { working: false, details }
  }
}