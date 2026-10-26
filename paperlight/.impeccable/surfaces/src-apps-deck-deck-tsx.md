---
version: 1
slug: "src-apps-deck-deck-tsx"
primary_target: "src/apps/deck/Deck.tsx"
related_targets: []
---

## Scope

Deck, the presentation app: a slide canvas with text, shapes and images, slide layouts and themes, a slide sorter, speaker notes, full-screen presenting, and export to .pptx and PDF. Decks save themselves on this computer. Mode: Operate. A whole surface inside the established Paperlight world (DESIGN.md); the world is fixed and only the composition was chosen.

Audience: the creator building talks and video pitches, presenting on camera, and handing decks to people who use PowerPoint; viewers of the recording. Task: lay out slides quickly, write what to say, plan how long each slide takes, present, and export a file others can open. Constraint: nothing leaves the computer, and the screen must read clearly in a compressed recording.

## Direction contract

THESIS: The talk is a timeline. Slides run as numbered blocks under the canvas, each as wide as the time planned for it, so the shape of the talk is visible while you build it. It refuses the category default of a column of tiny thumbnails beside a canvas with notes hidden below.

OWN-WORLD: Inherited unchanged from DESIGN.md. Sun #F2C230 fills the rail with ink on it; as text Deck uses a dark ochre that clears 4.5:1 on white and a light sun on graphite. The current slide's numeral is in that text colour and its block carries a pale sun tint with an ink edge. White ground, #111 ink, 1px hairlines, square corners, no shadows, Geist with Geist Mono only for times, slide counts and the stamp. Slide themes are original and flat: paper, ink, sun, cobalt, grid.

STORY: The viewer sees one slide at full size with its notes beside it and the whole talk laid out as a timeline underneath. The user picks a layout and theme, types into placeholders, adds text, shapes and images, writes notes and a planned time, drags blocks to reorder, opens the sorter to see every slide, presents full screen with the timeline running as a thin progress band, and exports .pptx or PDF. The stamp shows Saved with the time.

FIRST VIEWPORT: 64px sun rail. 56px command bar: "Deck /" and a deck picker, Layout and Theme menus, Text, Shape, Image, Sorter, then, when something is selected, that object's tools; the Ctrl K pill, the stamp, an outline Export menu and a filled "Present". The slide at the largest 16:9 size that fits, centred on the 72px-ruled canvas. A 320px notes column: "Speaker notes", the planned time, the notes. A 176px timeline: "Talk timeline" with the slide count and total time, then blocks with 42px/800 numerals, titles and mono times, sized by planned seconds, and an add block. A 32px status bar.

FORM: Talk timeline, #7 on the ordered structural list for this surface. seed: 1a77d3ada518145f. Signature interaction: the timeline, live: blocks resize as you change a slide's planned time, reorder by drag, and the current block lights; when presenting, the same timeline runs as a thin band with an elapsed-time cursor. Motion moves on one axis, 160 to 200ms, ease-out; slides cross-fade in 200ms when presenting.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Opening .pptx files, animations and transitions beyond a cross-fade, charts and tables on slides, and mixed fonts within one text box are later additions.
