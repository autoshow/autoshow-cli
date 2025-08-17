# parse

Parse markdown files containing code blocks and automatically update project files.

## Usage

```bash
npm run parse new-llm-1.md
```

### Options

- `-d, --dry-run` - Preview changes without making modifications
- `-h, --help` - Display help information
- `-V, --version` - Display version number

## Markdown Format

File paths as H2 headers followed by content in code blocks:

```markdown
## src/types.ts

\`\`\`typescript
export interface User {
  id: string
  name: string
}
\`\`\`

## src/utils/helpers.ts

\`\`\`typescript
export function formatName(name: string): string {
  return name.trim().toLowerCase()
}
\`\`\`

## package.json

\`\`\`json
{
  "name": "my-app",
  "version": "1.0.0"
}
\`\`\`
```

## Examples

### Basic Usage
```bash
npm run parse changes.md
```

### Dry Run
```bash
npm run parse changes.md -- --dry-run
```