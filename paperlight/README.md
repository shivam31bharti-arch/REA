# Paperlight

A free, local office suite written from scratch. Nothing needs an account or a network connection, and every file stays on your computer.

| App | Does the job of | Status |
|---|---|---|
| **Prose** | A word processor | Ready |
| **Cells** | A spreadsheet | Ready |
| **Deck** | Presentations | Ready |
| **Jotbook** | A notebook | Ready |

## Run it

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` opens the desktop app with live reload while you edit the code.

```bash
npm start
```

`npm start` makes a production build and opens the desktop app from it.

`npm run dev:web` runs only the interface in a browser. File dialogs are replaced by downloads and file pickers there, so use the desktop app for real work.

## Install it

```bash
npm run dist
```

`npm run dist` builds `release/Paperlight-Setup-0.1.0.exe`. Run it to install Paperlight for your Windows account (no administrator rights needed): it asks where to install, adds **Paperlight** to the Start menu, and can be removed from Settings > Apps like any other program. Your documents, notebooks and decks are kept when you uninstall.

The installer is not code-signed, so Windows may show "Windows protected your PC" the first time. Choose **More info**, then **Run anyway**.

## Dashboard

All four apps on one screen. Open it from the button under the P in the left rail, or with "Open Dashboard" in Ctrl K.

- The last thing you worked on fills the stage, drawn for real: the slide and the shape of the talk, the document page, the sheet, or the note. Continue opens it where you left off.
- The other three apps stand beside it, each with its newest work and a New button. Older work is listed under "Also recent".
- Rest the pointer on anything (or tab to it) and it takes the stage; click to open it in its app. Back to latest returns.
- Files you only opened from disk (.docx, .xlsx) show as a file card, and are read again when you open them.
- It reads only what is on this computer: Prose and Cells drafts, recent files, decks and Jotbook pages.

## Prose

- Headings, bold, italic, underline, strikethrough, highlight, links, bulleted, numbered and check lists, quotes, code blocks, dividers, tables and images (insert, paste or drag in).
- Opens and saves standard `.docx` files, and exports PDF on A4.
- A numbered outline of your sections, each with a bar showing its length. Click a section to jump to it.
- Type `/` on any line to add a block, select text for the formatting bar, or press `Ctrl K` to search every command.
- Find and replace, word and character counts, reading time, page guides, zoom, and spell check with suggestions on right-click.
- Focus mode dims everything except the paragraph you are writing.
- Light and dark themes. The theme follows Windows unless you pick one.
- Unsaved work is kept as a draft on this computer and shows up on Home.

### Shortcuts

| Action | Keys |
|---|---|
| Command palette | `Ctrl K` |
| Save as .docx | `Ctrl S` |
| Save as… | `Ctrl Shift S` |
| Export PDF | `Ctrl P` |
| Open | `Ctrl O` |
| New document | `Ctrl N` |
| Find / Find and replace | `Ctrl F` / `Ctrl H` |
| Focus mode | `Ctrl Shift F` |
| Zoom in / out / reset | `Ctrl =` / `Ctrl -` / `Ctrl 0` |
| Open a link | `Ctrl` + click |

## Cells

- A fast grid: type numbers, text, dates (`2026-07-02`), percentages (`12%`) and money (`$4.50`) straight into cells, or start with `=` for a formula.
- About 95 functions, including `SUM`, `AVERAGE`, `COUNT`, `MIN`, `MAX`, `IF`, `IFS`, `IFERROR`, `VLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`, `SUMIF(S)`, `COUNTIF(S)`, `ROUND`, `TEXT`, `DATE`, `TODAY` and `PMT`. While you type a formula, Cells suggests functions and shows their arguments, and you can click or drag across cells to put their address in.
- Cell formatting: number formats (currency, percent, dates, time), bold, italic, underline, fill and text colour, and alignment.
- Sort a table by any column (headings and total rows stay put), and filter rows by the values in a column.
- Several sheets per workbook, numbered down the left with a bar for how many rows each holds. Formulas can use other sheets, such as `=Sponsors!D7`.
- Column, bar, line and pie charts from a selection. They update as the numbers change, and you can drag and resize them.
- Copy and paste (also with other programs), fill handle and `Ctrl D` / `Ctrl R`, insert and delete rows and columns without breaking formulas, and undo for every change.
- Opens and saves standard `.xlsx` files and opens and exports `.csv`. Starter templates: Channel numbers, Monthly budget and Invoice.

Not there yet: merged cells (they open as separate cells), borders, conditional formatting, freeze panes and pivot tables. Charts open in Excel as pictures, and come back as live charts when you reopen the file in Cells. To type into a cell with an input method editor, press `F2` first.

### Shortcuts

| Action | Keys |
|---|---|
| Save as .xlsx / Save as… | `Ctrl S` / `Ctrl Shift S` |
| Open / New workbook | `Ctrl O` / `Ctrl N` |
| Edit the cell | `F2` or double-click |
| Finish and move down / right | `Enter` / `Tab` |
| Put the same entry in every selected cell | `Ctrl Enter` |
| Sum the numbers above | `Alt =` |
| Jump to the edge of the data | `Ctrl` + arrow keys |
| Extend the selection | `Shift` + arrow keys or click |
| Fill down / right | `Ctrl D` / `Ctrl R` |
| Filter on or off | `Ctrl Shift L` |
| Undo / Redo | `Ctrl Z` / `Ctrl Y` |
| Command palette | `Ctrl K` |

## Deck

- The talk is a timeline: every slide is a numbered block under the canvas, as wide as the time you plan to spend on it. Drag blocks to reorder them, and change a slide's planned time beside its speaker notes. Deck also estimates how long the notes take to say.
- Slides hold text boxes (bold, italic, underline, bullet lists, sizes, colours, alignment), rectangles, ellipses, lines, arrows and pictures (insert, paste or drag in). Drag to move and use the handles to resize. Objects snap to the margins, the twelve columns, the centre lines and each other, with guides while you drag. Hold `Alt` to place freely, `Shift` to keep proportions.
- Seven layouts (Title, Title and points, Two columns, Section, Picture and caption, Statement, Blank) and five original themes (Paper, Ink, Sun, Cobalt, Grid). Changing a layout keeps your text.
- The sorter shows every slide at once for reordering.
- Present full screen from the start (`F5`) or from the current slide (`Shift F5`). A thin band along the bottom runs the timeline with an elapsed-time cursor, and `P` switches to a presenter view with your notes, a clock, how far ahead or behind you are, and the next slide.
- Export a PowerPoint file (`.pptx`) with your text, shapes, pictures and speaker notes, or a PDF with one slide per page.
- Decks save themselves on this computer as you work, and the latest ones show on Home. Starter decks: Launch talk and Sponsor pitch.

Not there yet: opening `.pptx` files, animations (slides cross-fade when presenting), charts and tables on slides, and more than one font size inside one text box. The `.pptx` names the Geist font, so on a computer without Geist the text falls back to that computer's default font.

### Shortcuts

| Action | Keys |
|---|---|
| Present from the start / from this slide | `F5` / `Shift F5` |
| Next and previous slide while presenting | Arrow keys, `Space`, `Page Up` / `Page Down`, or click |
| Presenter view while presenting | `P` |
| New slide | `Ctrl M` |
| Previous / next slide while editing (nothing selected) | Arrow keys or `Page Up` / `Page Down` |
| Duplicate / delete the selected objects | `Ctrl D` / `Delete` |
| Nudge the selected objects | Arrow keys (`Shift` for 10) |
| Undo / Redo | `Ctrl Z` / `Ctrl Y` |
| Command palette | `Ctrl K` |

## Jotbook

- Notebooks hold sections, and sections hold pages. Switch notebook and section from the bar at the top.
- The section's pages are numbered down the left. The current page's number turns green.
- Notes have the same tools as Prose: `/` blocks, the selection bar, checklists, tables, links, and images you can paste or drag in.
- Everything saves as you type, and the stamp shows when it last saved.
- `Ctrl F` searches the titles and text of every notebook at once and highlights the match when you open it.
- Rename or delete notebooks and sections from their menus; deleting always asks first.

### Shortcuts

| Action | Keys |
|---|---|
| New page | `Ctrl N` |
| New section | `Ctrl Shift N` |
| Search every notebook | `Ctrl F` |
| Find and replace in the page | `Ctrl H` |
| Command palette | `Ctrl K` |

## Where things are stored

- Your documents: wherever you save them.
- The recent files list: `%APPDATA%\Paperlight\recent.json`.
- Unsaved Prose and Cells drafts: the app's local storage, until you save them to a file.
- Jotbook notebooks and Deck decks: the app's own database (IndexedDB) in `%APPDATA%\Paperlight`. Nothing is sent anywhere.

## How it is built

Electron, React, TypeScript and Vite. The window runs sandboxed with context isolation, and the interface can only reach files through a small typed bridge (`electron/preload.cjs`). The main process (`electron/main.cjs`) checks that every request comes from Paperlight's own page, and it only reads or overwrites files you picked in a dialog.

Open-source libraries: TipTap (MIT) for editing, docx (MIT) to write `.docx`, mammoth (BSD-2-Clause) to read it, ExcelJS (MIT) to read and write `.xlsx`, Chart.js (MIT) for charts, PptxGenJS (MIT) to write `.pptx`, Lucide (ISC) for icons, and the Geist typefaces (SIL Open Font License, see `src/assets/fonts/OFL-Geist.txt`). The formula engine is Paperlight's own. JSZip, which ExcelJS uses, is dual-licensed and is used under its MIT licence. The installer is made with electron-builder (MIT), a build tool only, and runs on NSIS (zlib licence).
