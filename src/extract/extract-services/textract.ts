import { l, err } from '@/logging'
import { fs, path, execSync, ensureDir } from '@/node-utils'
import type { ExtractOptions } from '@/extract/extract-types'

const p = '[extract/extract-services/textract]'

const processTextractResponse = async (
  response: any,
  _pageNum: number,
  _requestId: string
): Promise<string> => {
  const lines: string[] = []
  
  if (response.Blocks) {
    response.Blocks.forEach((block: any) => {
      if (block.BlockType === 'LINE' && block.Text) {
        lines.push(block.Text)
      }
    })
  }
  
  return lines.join('\n')
}

export const extractWithTextract = async (
  pdfPath: string,
  _options: ExtractOptions,
  requestId: string,
  pageNumber?: number
): Promise<{ text: string, totalCost?: number }> => {
  const pageInfo = pageNumber ? ` (page ${pageNumber})` : ''
  
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID']
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY']
  const region = process.env['AWS_REGION'] || 'us-east-1'
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required for Textract')
  }
  
  try {
    const { TextractClient, DetectDocumentTextCommand } = await import('@aws-sdk/client-textract')
    
    const textractClient = new TextractClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })
    
    try {
      execSync('gm version', { stdio: 'ignore' })
    } catch (error) {
      throw new Error('GraphicsMagick is not installed. Please install it to use Textract with PDF files.')
    }
    
    const tempDir = path.join('output', 'temp', requestId, 'textract')
    await ensureDir(tempDir)
    
    try {
      const pngPath = path.join(tempDir, `page_${pageNumber || 1}.png`)
      const convertCommand = `gm convert -density 300 "${pdfPath}" "${pngPath}"`
      execSync(convertCommand, { stdio: 'ignore' })
      
      const imageBuffer = await fs.readFile(pngPath)
      const imageSizeMB = imageBuffer.length / (1024 * 1024)
      
      let finalBuffer = imageBuffer
      
      if (imageBuffer.length > 5 * 1024 * 1024) {
        l.warn(`${p}[${requestId}] Image${pageInfo} exceeds 5MB (${imageSizeMB.toFixed(2)} MB), resizing`)
        const resizedPath = path.join(tempDir, `resized_page_${pageNumber || 1}.png`)
        execSync(`gm convert "${pngPath}" -resize 2000x2000> "${resizedPath}"`, { stdio: 'ignore' })
        finalBuffer = await fs.readFile(resizedPath)
      }
      
      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: finalBuffer
        }
      })
      
      const response = await textractClient.send(command)
      const text = await processTextractResponse(response, pageNumber || 1, requestId)
      
      const totalCost = 0.0015
      l.opts(`${p}[${requestId}] Cost${pageInfo}: $${totalCost.toFixed(4)}`)
      
      await fs.rm(tempDir, { recursive: true, force: true })
      
      return { text, totalCost }
    } catch (error: any) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      
      if (error.name === 'UnsupportedDocumentException') {
        throw new Error('Document format not supported by Textract. Image may be corrupted.')
      }
      if (error.name === 'InvalidParameterException') {
        throw new Error('Invalid document provided to Textract. Ensure the image is valid.')
      }
      if (error.name === 'DocumentTooLargeException') {
        throw new Error('Document too large for processing. Try reducing image resolution.')
      }
      throw error
    }
  } catch (error) {
    err(`${p}[${requestId}] Textract error${pageInfo}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}