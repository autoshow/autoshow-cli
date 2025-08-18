import { l, err } from '@/logging'
import { fs, path, execSync, ensureDir } from '@/node-utils'
import type { ExtractOptions } from '@/types'

const p = '[extract/extract-services/textract]'

const processTextractResponse = async (
  response: any,
  pageNum: number,
  requestId: string
): Promise<string> => {
  const lines: string[] = []
  
  if (response.Blocks) {
    response.Blocks.forEach((block: any) => {
      if (block.BlockType === 'LINE' && block.Text) {
        lines.push(block.Text)
      }
    })
  }
  
  const pageText = lines.join('\n')
  l.dim(`${p}[${requestId}] Page ${pageNum} extracted ${lines.length} lines, ${pageText.length} characters`)
  
  return pageText
}

export const extractWithTextract = async (
  pdfPath: string,
  _options: ExtractOptions,
  requestId: string,
  pageNumber?: number
): Promise<{ text: string, totalCost?: number }> => {
  const pageInfo = pageNumber ? ` (page ${pageNumber})` : ''
  l.dim(`${p}[${requestId}] Using AWS Textract service for extraction${pageInfo}`)
  
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID']
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY']
  const region = process.env['AWS_REGION'] || 'us-east-1'
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required for Textract')
  }
  
  if (pageNumber === 1) {
    l.dim(`${p}[${requestId}] Initializing Textract client for region: ${region}`)
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
    
    l.dim(`${p}[${requestId}] Checking for GraphicsMagick installation`)
    try {
      execSync('gm version', { stdio: 'ignore' })
    } catch (error) {
      throw new Error('GraphicsMagick is not installed. Please install it to use Textract with PDF files.')
    }
    
    const tempDir = path.join('output', 'temp', requestId, 'textract')
    await ensureDir(tempDir)
    
    try {
      l.dim(`${p}[${requestId}] Converting PDF${pageInfo} to PNG image`)
      const pngPath = path.join(tempDir, `page_${pageNumber || 1}.png`)
      const convertCommand = `gm convert -density 300 "${pdfPath}" "${pngPath}"`
      execSync(convertCommand, { stdio: 'ignore' })
      l.dim(`${p}[${requestId}] PDF${pageInfo} converted to PNG`)
      
      const imageBuffer = await fs.readFile(pngPath)
      const imageSizeMB = imageBuffer.length / (1024 * 1024)
      l.dim(`${p}[${requestId}] Image${pageInfo} size: ${imageSizeMB.toFixed(2)} MB`)
      
      let finalBuffer = imageBuffer
      
      if (imageBuffer.length > 5 * 1024 * 1024) {
        l.dim(`${p}[${requestId}] Warning: Image${pageInfo} exceeds 5MB, resizing`)
        const resizedPath = path.join(tempDir, `resized_page_${pageNumber || 1}.png`)
        execSync(`gm convert "${pngPath}" -resize 2000x2000> "${resizedPath}"`, { stdio: 'ignore' })
        finalBuffer = await fs.readFile(resizedPath)
        l.dim(`${p}[${requestId}] Resized${pageInfo} to ${(finalBuffer.length / (1024 * 1024)).toFixed(2)} MB`)
      }
      
      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: finalBuffer
        }
      })
      
      const response = await textractClient.send(command)
      const text = await processTextractResponse(response, pageNumber || 1, requestId)
      
      const totalCost = 0.0015
      l.dim(`${p}[${requestId}] Cost${pageInfo}: $${totalCost.toFixed(4)}`)
      
      l.dim(`${p}[${requestId}] Total text extracted${pageInfo}: ${text.length} characters`)
      
      await fs.rm(tempDir, { recursive: true, force: true })
      
      return { text, totalCost }
    } catch (error: any) {
      l.dim(`${p}[${requestId}] Error occurred${pageInfo}, cleaning up temp directory`)
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