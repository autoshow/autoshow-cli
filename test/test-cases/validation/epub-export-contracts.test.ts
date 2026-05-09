import { expect, test } from 'bun:test'
import type { EpubContentReader } from '~/types'
import { inspectEpubWithReader } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/inspect-core'
import { buildEpubTextOutput } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/export'

const createReader = (files: Record<string, string>): EpubContentReader => ({
  adapterLabel: 'test',
  entries: Object.entries(files).map(([path, text]) => ({ path, size: text.length })),
  hasEntry: (entryPath: string) => Object.hasOwn(files, entryPath),
  readText: async (entryPath: string) => {
    const text = files[entryPath]
    if (typeof text !== 'string') {
      throw new Error(`Missing test EPUB entry: ${entryPath}`)
    }
    return text
  }
})

test('EPUB chapter export groups spine fragments by TOC starts', async () => {
  const inspected = await inspectEpubWithReader(createReader({
    'META-INF/container.xml': `
      <container>
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>
    `,
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="preface" href="Text/preface.xhtml" media-type="application/xhtml+xml"/>
          <item id="ch1" href="Text/CR%21-ch1.xhtml" media-type="application/xhtml+xml"/>
          <item id="ch1b" href="Text/ch1b.xhtml" media-type="application/xhtml+xml"/>
          <item id="notes" href="Text/notes.xhtml" media-type="application/xhtml+xml"/>
          <item id="ch2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="preface"/>
          <itemref idref="ch1"/>
          <itemref idref="ch1b"/>
          <itemref idref="notes"/>
          <itemref idref="ch2"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="toc-ch1" playOrder="1">
            <navLabel><text>Chapter One</text></navLabel>
            <content src="Text/CR%21-ch1.xhtml"/>
          </navPoint>
          <navPoint id="toc-ch2" playOrder="2">
            <navLabel><text>Chapter Two</text></navLabel>
            <content src="Text/ch2.xhtml"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/preface.xhtml': '<html><head><title>Generic Book</title></head><body><p>Preface text.</p></body></html>',
    'OEBPS/Text/CR!-ch1.xhtml': '<html><head><title>Generic Book</title></head><body><p>Chapter one start.</p></body></html>',
    'OEBPS/Text/ch1b.xhtml': '<html><head><title>Generic Book</title></head><body><p>Chapter one continuation.</p></body></html>',
    'OEBPS/Text/notes.xhtml': '<html><head><title>Generic Book</title></head><body><p>Footnote detail.</p></body></html>',
    'OEBPS/Text/ch2.xhtml': '<html><head><title>Generic Book</title></head><body><p>Chapter two start.</p></body></html>'
  }), 'bun')

  const tocMatchedChapter = inspected.payload.chapters.find((chapter) => chapter.path === 'OEBPS/Text/CR!-ch1.xhtml')
  expect(tocMatchedChapter?.title).toBe('Chapter One')
  expect(tocMatchedChapter?.isTocStart).toBe(true)

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('toc')
  expect(output.exportPlan?.summary.logicalChapterCount).toBe(2)
  expect(output.exportPlan?.summary.tocStartSections).toBe(2)
  expect(output.exportPlan?.summary.prefaceSectionsDropped).toBe(1)
  expect(output.exportPlan?.files.map((file) => file.relativePath)).toEqual([
    'chapters/001-chapter-one.txt',
    'chapters/002-chapter-two.txt'
  ])
  expect(output.exportPlan?.files[0]?.text).toContain('Chapter one start.')
  expect(output.exportPlan?.files[0]?.text).toContain('Chapter one continuation.')
  expect(output.exportPlan?.files[0]?.text).toContain('Footnote detail.')
  expect(output.exportPlan?.files[0]?.text).not.toContain('Preface text.')
})

test('EPUB chapter export splits multiple TOC fragments within one spine file', async () => {
  const inspected = await inspectEpubWithReader(createReader({
    'META-INF/container.xml': `
      <container>
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>
    `,
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="multi" href="Text/multi.xhtml" media-type="application/xhtml+xml"/>
          <item id="tail" href="Text/tail.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="multi"/>
          <itemref idref="tail"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="toc-contents" playOrder="1">
            <navLabel><text>Table of Contents</text></navLabel>
            <content src="Text/multi.xhtml#toc"/>
          </navPoint>
          <navPoint id="toc-intro" playOrder="2">
            <navLabel><text>Introduction</text></navLabel>
            <content src="Text/multi.xhtml#intro-page"/>
          </navPoint>
          <navPoint id="toc-one" playOrder="3">
            <navLabel><text>Chapter One</text></navLabel>
            <content src="Text/multi.xhtml#chapter-one-page"/>
          </navPoint>
          <navPoint id="toc-two" playOrder="4">
            <navLabel><text>Chapter Two</text></navLabel>
            <content src="Text/multi.xhtml#chapter-two-anchor"/>
          </navPoint>
          <navPoint id="toc-three" playOrder="5">
            <navLabel><text>Chapter Three</text></navLabel>
            <content src="Text/tail.xhtml#chapter-three-page"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/multi.xhtml': `
      <html>
        <head><title>Fragmented Book</title></head>
        <body>
          <nav id="toc">
            <h1>Table of Contents</h1>
            <ol>
              <li>Introduction</li>
              <li>Chapter One</li>
              <li>Chapter Two</li>
              <li>Chapter Three</li>
            </ol>
          </nav>
          <a id="intro-page"></a>
          <p>Page 1</p>
          <h1>Introduction</h1>
          <p>Intro body.</p>
          <a id="chapter-one-page"></a>
          <p>Page 2</p>
          <h1>Chapter One</h1>
          <p>One body.</p>
          <h1>Chapter Two</h1>
          <a id="chapter-two-anchor"></a>
          <p>Two body starts after an anchor that follows the heading.</p>
        </body>
      </html>
    `,
    'OEBPS/Text/tail.xhtml': `
      <html>
        <head><title>Fragmented Book</title></head>
        <body>
          <p>Two body continues in the next spine file before chapter three.</p>
          <a id="chapter-three-page"></a>
          <p>Page 3</p>
          <h1>Chapter Three</h1>
          <p>Three body.</p>
        </body>
      </html>
    `
  }), 'bun')

  expect(inspected.payload.toc.items.map((item) => item.fragment)).toEqual([
    'toc',
    'intro-page',
    'chapter-one-page',
    'chapter-two-anchor',
    'chapter-three-page'
  ])

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })
  const files = output.exportPlan?.files ?? []

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('toc')
  expect(output.exportPlan?.summary.logicalChapterCount).toBe(5)
  expect(output.exportPlan?.summary.tocStartSections).toBe(5)
  expect(files.map((file) => file.relativePath)).toEqual([
    'chapters/001-table-of-contents.txt',
    'chapters/002-introduction.txt',
    'chapters/003-chapter-one.txt',
    'chapters/004-chapter-two.txt',
    'chapters/005-chapter-three.txt'
  ])

  expect(files[1]?.text).toStartWith('Introduction')
  expect(files[2]?.text).toStartWith('Chapter One')
  expect(files[2]?.text).not.toContain('Chapter Two')
  expect(files[3]?.text).toStartWith('Chapter Two')
  expect(files[3]?.text).toContain('Two body continues in the next spine file before chapter three.')
  expect(files[3]?.text).not.toContain('Chapter Three')
  expect(files[4]?.text).toStartWith('Chapter Three')
  expect(files[4]?.text).not.toContain('Two body continues in the next spine file before chapter three.')
})
