---
version: 1
slug: "src-apps-prose-prose-tsx"
primary_target: "src/apps/prose/Prose.tsx"
related_targets: ["src/home/Home.tsx","src/shell/Shell.tsx"]
---

## Scope

Paperlight suite shell, home screen and Prose (word processor). Mode: Operate. The same world must later carry Cells, Deck and Jotbook.

Audience: the creator writing scripts and documents daily on Windows, and viewers watching screen recordings. Task: write, structure, format, then save `.docx` or export PDF. Constraint: original look, local only, readable when a recording is compressed.

## Direction contract

THESIS: Documents set on a visible modular grid, with structure carried by scale and flat colour fields. Refuses the category default of an icon ribbon above a white page floating on grey.

OWN-WORLD: White ground and #111 ink; 1px ink hairlines instead of shadows; square corners. Each app owns a flat full-height rail colour: Prose vermilion #E8432C, Cells cobalt #2448D8, Deck yellow #F2C230, Jotbook viridian #0F8A7A. Geist grotesk with Geist Mono figures, oversized section numerals, black contextual toolbar. Dark theme is graphite #121212 with the same fields.
- Raised by Ticket Wallet: document state is stamped, never hidden (Saved, Unsaved, Exported, with time).
- Raised by Developer Console: hairline seams, and Delete or Discard always isolated by space.
- Raised by Title Card Wall: Focus mode lifts the current paragraph and dims the rest.
- Raised by Dance Score: outline numerals carry a bar sized by that section's word count.
- Raised by Type Specimen: the style picker previews each style at true size.

STORY: The viewer sees a calm tool that knows its own structure. The writer finds every command through selection, "/" or Ctrl+K, writes without clutter, watches state stamped, and leaves with a real `.docx` or PDF.

FIRST VIEWPORT: 64px colour rail at left (suite mark, four app switches). 56px command bar (app kicker and title, style picker, B/I/U, Insert, Ctrl K search, save stamp, Export as the one filled control). 264px outline column of oversized numerals with length bars. A 794px page on a 72px column-grid canvas. 32px status bar. Home: the same rail, then a poster grid of four app fields, recent files and templates.

FORM: Swiss Grid (International Typographic Style), #5 on the ordered list. seed: 35d788a8db6f7f3f. Signature interaction: the live numeral outline. Motion moves on one axis, 160–200ms, ease-out, no bounce.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Cells, Deck and Jotbook screens are later surfaces in this same world.
