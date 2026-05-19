# AutoShow Script Formatting Rules

Apply these rules only as formatting cleanup. Do not copyedit, rewrite jokes, change punctuation for style, or alter story meaning.

## Episode Shell

- Start each script with `# Episode N: Title`.
- Put `**USS ACAMPO**` after the episode title.
- Put `---` after `**USS ACAMPO**`.
- Put a `## ...` scene heading after the separator.
- Put a bold location or staging line after the scene heading when the scene has an explicit location or staging slug.
- Report missing or ambiguous shell fields. Do not invent episode numbers, titles, scene headings, locations, or staging lines.

## Line Rules

- Use LF line endings.
- Remove leading and trailing whitespace from every line.
- End each file with exactly one final newline.
- Do not leave a blank line between a speaker label and its delivery parenthetical or dialogue.

## Delivery Parentheticals

- Put delivery parentheticals on their own line as plain text: `(like this)`.
- Split `(delivery) dialogue` into two lines:

```markdown
(delivery)
dialogue
```

- Convert italic or bold parenthetical-only delivery lines to plain parentheticals:
  - `*(quietly)*` becomes `(quietly)`.
  - `**(beat)**` becomes `(beat)`.

## Tables And Outlines

- Preserve outline tables.
- Keep tables inside the normal episode and scene shell.
- Use `###` subsections for outline sections under a scene heading.

## Speaker And Staging Ambiguity

- Treat lowercase text after a bold character label as character staging or narration, not dialogue.
- Treat only standalone bold uppercase labels such as `**DUCO**`, `**PADDY**`, or `**IRONHANDS #1**` as speaker labels.
