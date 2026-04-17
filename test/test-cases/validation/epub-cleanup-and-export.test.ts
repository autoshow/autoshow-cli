import { describe, expect, test } from 'bun:test'
import { buildEpubTextOutput } from '~/cli/commands/process-steps/step-2-ocr/epub/export'
import { cleanEpubHtmlToText } from '~/cli/commands/process-steps/step-2-ocr/epub/cleanup'
import type { EpubChapter } from '~/types'

const buildChapter = (overrides: Partial<EpubChapter>): EpubChapter => ({
  index: 1,
  idref: 'section-1',
  href: 'text/section-1.xhtml',
  path: 'text/section-1.xhtml',
  title: 'Section 1',
  text: 'Body text',
  wordCount: 2,
  characterCount: 9,
  ...overrides
})

describe('EPUB cleanup', () => {
  test('preserves block breaks and removes footnote references/containers', () => {
    const html = `
      <html>
        <body>
          <section>
            <h2>Introduction<br/>Overview<sup>1</sup></h2>
            <p>The subtitle &amp; scope.</p>
            <aside id="footnotes">
              <p>1. This note should be removed.</p>
            </aside>
          </section>
        </body>
      </html>
    `

    expect(cleanEpubHtmlToText(html)).toBe('Introduction\nOverview\n\nThe subtitle & scope.')
  })
})

describe('EPUB export planning', () => {
  test('merges standalone part divider sections into the following section in chapter mode', () => {
    const output = buildEpubTextOutput('sample-book', [
      buildChapter({
        index: 9,
        idref: 'part01',
        href: 'text/part01.xhtml',
        title: 'PART I THE RISE OF THE WITCH-HUNT NARRATIVE',
        text: 'PART I\n\nTHE RISE OF THE WITCH-HUNT NARRATIVE'
      }),
      buildChapter({
        index: 10,
        idref: 'ch01',
        href: 'text/ch01.xhtml',
        title: '1 Introduction',
        text: 'Introduction\n\nBody text'
      })
    ], {
      chapterFiles: true
    })

    expect(output.pages.map((page) => page.pageNumber)).toEqual([10])
    expect(output.pages[0]?.text).toBe('PART I\n\nTHE RISE OF THE WITCH-HUNT NARRATIVE\n\nIntroduction\n\nBody text')
    expect(output.exportPlan?.summary.dividerSectionsMerged).toBe(1)
    expect(output.exportPlan?.files.map((file) => file.relativePath)).toEqual(['chapters/010-1-introduction.txt'])
  })

  test('creates hard-limited chunk files in chunk mode', () => {
    const output = buildEpubTextOutput('sample-book', [
      buildChapter({
        index: 1,
        title: 'Chapter 1',
        text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'
      }),
      buildChapter({
        index: 2,
        idref: 'chapter-2',
        href: 'text/chapter-2.xhtml',
        title: 'Chapter 2',
        text: 'nu xi omicron pi rho sigma tau upsilon phi chi psi omega'
      })
    ], {
      chunkLimitChars: 30
    })

    expect(output.exportPlan?.summary.mode).toBe('chunks')
    expect(output.exportPlan?.files.length).toBeGreaterThan(1)
    for (const file of output.exportPlan?.files ?? []) {
      expect(file.relativePath.startsWith('chunks/sample-book-')).toBe(true)
      expect(file.text.length).toBeLessThanOrEqual(30)
    }
  })
})
