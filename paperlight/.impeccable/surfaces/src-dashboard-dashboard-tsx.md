---
version: 1
slug: "src-dashboard-dashboard-tsx"
primary_target: "src/dashboard/Dashboard.tsx"
related_targets: ["src/dashboard/dashboard.css"]
---

## Scope

The Dashboard: a new screen in the rail (beside Home, which stays as it is) that puts Prose, Jotbook, Cells and Deck in one space. Visitor mode: Operate. Recorded on video and used daily.

## Audience and job

The creator, between tasks: see what was made in all four apps, get back into the last piece of work in one click, and start something new in any app. Data is read only from this computer (recent files, Prose and Cells drafts, decks, Jotbook pages). The user chose "an overview of all work" and "a new screen in the rail".

## Direction contract

THESIS: The last thing you touched, rendered for real at a readable size, with the other three apps standing beside it; refuses the category's grid of same-size tiles and stat cards.

OWN-WORLD: Paperlight's Swiss Grid unchanged: white and ink on the 12-column ruled Canvas, square planes with 1px Seam edges, the four flat app fields (Vermilion, Viridian, Cobalt, Sun) as the only colour, Geist 800 display and numerals, mono only for standalone figures, suite-ink rail.

STORY: The visitor sees the work they were doing, knows which app it lives in from its field, reads its figures, and presses Continue; or points at any other item to put it on the stage, or presses New in an app's field.

FIRST VIEWPORT: Top bar "Dashboard" with the search pill. Columns 1 to 8: the title at 42px/800 with the app, figures and time in a 12px line under it and the ink "Continue in {app}" button at the right, over a Page frame with a 10px field band on its left edge holding the live preview (slide via SlideView with the talk band under it, the document page, the sheet grid, or the note), and a figures row beneath. Columns 9 to 12: the other three apps as field strips (a 110px field with name and New, then their three newest items). Below: "Also recent" in four columns.

FORM: Continue stage, third on the ordered list (1 four field columns, 2 measured bands, 3 continue stage, 4 quadrants, 5 one stream, 6 big figures, 7 week grid); dealt as option two of the hand. seed:8733ba0baa676731. Signature move: dwell on any item (300ms, or keyboard focus) and it takes the stage, cross-fading at 200ms; click opens it in its app.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

Local only; no network. No shadows, no rounded corners, no kicker above headings, no coloured left borders on list items. Files that are only in the recent list (.docx, .xlsx not open as drafts) have no preview; they show as a file card on the stage.
