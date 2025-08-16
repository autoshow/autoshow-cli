import { Command } from 'commander'
import { promises as fs } from 'fs'
import { dirname } from 'path'

const p = '[parse]'

interface FileData {
  path: string
  content: string
}

function extractFilePath(headerLine: string): string | null {
  if (!headerLine.startsWith('## ')) return null
  
  const headerContent = headerLine.substring(3).trim()
  console.log(`${p} Processing header: ${headerContent}`)
  
  const patterns = [
    /^File:\s*(.+)$/,
    /^New file:\s*(.+)$/i,
    /^Modified file:\s*(.+)$/i
  ]
  
  const matchedPattern = patterns.find(pattern => pattern.test(headerContent))
  if (matchedPattern) {
    const match = headerContent.match(matchedPattern)
    const extractedPath = match?.[1]?.trim()
    console.log(`${p} Extracted path from pattern: ${extractedPath}`)
    return extractedPath || null
  }
  
  console.log(`${p} Using direct path format: ${headerContent}`)
  return headerContent
}

async function parseMarkdown(content: string): Promise<FileData[]> {
  console.log(`${p} Starting markdown parsing`)
  
  const lines = content.split('\n')
  const files: FileData[] = []
  let currentFile: FileData | null = null
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    
    if (line.startsWith('## ') && !inCodeBlock) {
      if (currentFile && codeBlockContent.length > 0) {
        currentFile.content = codeBlockContent.join('\n').trim()
        files.push(currentFile)
      }
      
      const filePath = extractFilePath(line)
      if (filePath) {
        console.log(`${p} Found file path: ${filePath}`)
        currentFile = { path: filePath, content: '' }
        codeBlockContent = []
      } else {
        console.log(`${p} Could not extract file path from: ${line}`)
        currentFile = null
      }
    } else if (line.startsWith('```') && currentFile) {
      if (!inCodeBlock) {
        inCodeBlock = true
        console.log(`${p} Entering code block for ${currentFile.path}`)
      } else {
        inCodeBlock = false
        console.log(`${p} Exiting code block for ${currentFile.path}`)
      }
    } else if (inCodeBlock && currentFile) {
      codeBlockContent.push(line)
    }
  }
  
  if (currentFile && codeBlockContent.length > 0) {
    currentFile.content = codeBlockContent.join('\n').trim()
    files.push(currentFile)
  }
  
  console.log(`${p} Parsed ${files.length} files from markdown`)
  return files
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function ensureDirectory(filePath: string): Promise<void> {
  const dir = dirname(filePath)
  try {
    await fs.mkdir(dir, { recursive: true })
    console.log(`${p} Ensured directory exists: ${dir}`)
  } catch (error) {
    console.error(`${p} Error creating directory ${dir}:`, error)
    throw error
  }
}

async function deleteFile(filePath: string): Promise<void> {
  try {
    if (await fileExists(filePath)) {
      await fs.unlink(filePath)
      console.log(`${p} Deleted existing file: ${filePath}`)
    } else {
      console.log(`${p} File doesn't exist, skipping deletion: ${filePath}`)
    }
  } catch (error) {
    console.error(`${p} Error deleting file ${filePath}:`, error)
    throw error
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await ensureDirectory(filePath)
    await fs.writeFile(filePath, content, 'utf8')
    console.log(`${p} Wrote file: ${filePath}`)
  } catch (error) {
    console.error(`${p} Error writing file ${filePath}:`, error)
    throw error
  }
}

async function processFiles(files: FileData[]): Promise<void> {
  console.log(`${p} Processing ${files.length} files`)
  
  const deletePromises = files.map(file => deleteFile(file.path))
  await Promise.all(deletePromises)
  console.log(`${p} Completed deletion phase`)
  
  const writePromises = files.map(file => writeFile(file.path, file.content))
  await Promise.all(writePromises)
  console.log(`${p} Completed write phase`)
}

async function main(): Promise<void> {
  const program = new Command()
  
  program
    .name('parse')
    .description('Parse markdown file and update project files')
    .version('1.0.0')
    .argument('<markdown-file>', 'path to markdown file containing file definitions')
    .option('-d, --dry-run', 'show what would be done without making changes')
    .action(async (markdownFile, options) => {
      try {
        console.log(`${p} Reading markdown file: ${markdownFile}`)
        
        const exists = await fileExists(markdownFile)
        if (!exists) {
          console.error(`${p} Error: Markdown file not found: ${markdownFile}`)
          process.exit(1)
        }
        
        const content = await fs.readFile(markdownFile, 'utf8')
        console.log(`${p} Successfully read markdown file`)
        
        const files = await parseMarkdown(content)
        
        if (files.length === 0) {
          console.log(`${p} No files found in markdown`)
          return
        }
        
        if (options.dryRun) {
          console.log(`${p} Dry run mode - no changes will be made`)
          console.log(`${p} Files that would be processed:`)
          files.forEach(file => {
            console.log(`  - ${file.path} (${file.content.length} characters)`)
          })
          return
        }
        
        await processFiles(files)
        console.log(`${p} Successfully updated all files`)
        
      } catch (error) {
        console.error(`${p} Fatal error:`, error)
        process.exit(1)
      }
    })
  
  await program.parseAsync(process.argv)
}

main().catch(error => {
  console.error(`${p} Unhandled error:`, error)
  process.exit(1)
})