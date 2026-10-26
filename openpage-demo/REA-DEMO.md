# REA live demo: OpenPage

**The pitch:** REA takes a shipped app with no source, maps how it is built, traces a feature end to end and reports exactly what changed between two releases. Every claim it makes is labeled **observed**, **inferred** or **unknown**.

**The target:** OpenPage, a small word processor we wrote from scratch for this demo (Electron, about 550 lines of JS, HTML and CSS). REA analyzed only the packaged `app.asar` files and never executed them.

| Build | Artifact | SHA-256 | Size |
|---|---|---|---|
| v1 | `dist/v1/app.asar` | `2375aed779d8a0ef7d9dc064bfe588ded016cf412f81e7fb61d25c70d26b58bf` | 11.4 KB |
| v2 | `dist/v2/app.asar` | `54f43ed8440d787b6c24ee6cc50ca06aaa824a60039bb8bd42bb421ac988b8e7` | 19.4 KB |

How to read the labels:

- **Observed:** REA read it directly from the package, for example a literal value at an exact line and column.
- **Inferred:** REA connected two observed facts with a static rule, for example pairing two IPC calls that use the same channel name.
- **Unknown:** REA could not prove it, and says so instead of guessing.

---

## Step 1: The target app

OpenPage has a toolbar with New, Open and Save, Bold, Italic and Underline, a page-style editor and a live word and character count. Files are saved as `.html` through a native save dialog.

How it is built (this is what REA has to rediscover on its own):

```
renderer/index.html + app.js   (the UI, sandboxed)
        │  window.openpage.saveDocument(...)
preload.js   contextBridge → ipcRenderer.invoke('document:save')
        │  IPC
main.js      ipcMain.handle('document:save') → save dialog → fs.writeFile
```

To show the app on stage, run `npm start` (current source, v2), or run a specific build with `npx electron dist/v1/app.asar`.

---

## Step 2: Static analysis of v1

**Tool:** `analyze_javascript_application` with detail `summary`, then `inspect_analysis_view`.
**Evidence:** analysis `ev_e81fa27646dc511f37a132f06e7d6348ca12c1bf942200ddb5dca2c01d4c1e0f` · summary `ev_89c1119c2fab47287a841fb59ec0cffb4948089966848762c1070ef4f87158a7` · module page `ev_c715dcb73a98b9e0e5c1cdc3104c396b993698ed34d82fc5092c104b97605243` · Electron facts `ev_c232c61ef25e78af5471517b8cbc2a6aed4824b98abc553028c8be3cbc318ccf`

From an 11 KB package and no source, REA rebuilt the app's architecture:

| Finding | Detail | Label |
|---|---|---|
| Main entry point | `main.js`, declared in `package.json` | Inferred (high) |
| Window | One `BrowserWindow` at `main.js:8` | Observed (exact) |
| Window security settings | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `preload: "preload.js"` | Observed literal values |
| Preload script | `preload.js`, resolved from `webPreferences.preload` | Inferred (high) |
| Renderer | `renderer/index.html`, loading `renderer/app.js` | Inferred (high) |
| Bridge API | `window.openpage` exposing `openDocument` and `saveDocument` (`preload.js:3`) | Observed (exact) |
| IPC channels | `document:open` and `document:save`: renderer `invoke` in `preload.js:4–5`, main `handle` in `main.js:25` and `main.js:37` | Observed (exact) |
| IPC pairing | 2 of 2 renderer calls paired with a main handler; 0 dynamic or ambiguous channels | Inferred (unique literal match) |
| Coverage | Application graph **complete**: 5 relevant files, 3 parsed JS files, 0 parse failures | Observed |

**Talking point, a hardening gap REA surfaced:** REA reported `sender_validation_observations: 0`. Neither IPC handler checks which frame sent the message. Electron's security guidance recommends validating the sender of IPC messages, so this is worth fixing in a real app. (REA observed the zero count. Calling it a gap is our reading against Electron's checklist.)

**Unknown, and REA says so:** the semantic layer (data flow, call flow, promises) reports 248 open unknowns, and its coverage status is `unknown`. Static analysis does not claim anything about runtime behavior.

---

## Step 3: Tracing "Save document"

**Tools:** `trace_application_feature` (seed: IPC channel `document:save`), then `trace_javascript_semantics` (seed: the handler node).
**Evidence:** channel trace `ev_abbf51a0832ef48afa58a37ef03b14eb1434d76177a132609d0f87d8424e53b3` · handler-body trace `ev_e56aa7e8a24c4e58d9ce682a0d8adbeec0e5ac95398dd2fd396edf78f52478a2`
**Bounded searches that found nothing:** `showSaveDialog` API seed `ev_c3df1092f31caf778a97e6456d73307378b1a82b642a78ae934eb6b81fd79fa7` · `btn-save` string seed `ev_47ba82fe36c28ca06d9a6088279f2cdbef786266d30911559de8ce1c622cdfdd` · `btn-save` literal `ev_138fa8fbf8eee0c244994d4a3363e1432e828db351f1ea15339c388634aeb3f2` · `saveDocument` property `ev_06209e351ed1cd1d9f1f762856b489f1bf8ff9e1e9b658eaf984af5c66c90157`

| # | Hop | Where | REA's verdict |
|---|---|---|---|
| 1 | Save button → `saveDocument()` | `renderer/app.js` | **Unknown.** No graph entity matched `btn-save` |
| 2 | Renderer → `window.openpage.saveDocument(...)` | `renderer/app.js` | **Unknown.** The cross-world bridge call is not linked statically |
| 3 | Bridge exposes `openpage.saveDocument` | `preload.js:3` | **Observed** |
| 4 | Member calls `ipcRenderer.invoke('document:save')` | `preload.js:5` | **Observed** call site, path **inferred** |
| 5 | Paired with `ipcMain.handle('document:save')` | `main.js:37–51` | **Inferred** (unique literal channel) |
| 6 | Handler awaits the save dialog | `main.js:41–45` | **Observed** awaited call; callee **unknown** |
| 7 | Handler awaits the file write | `main.js:49` | **Observed** awaited call; callee **unknown** |

For hops 6 and 7, REA located both awaited calls by exact source range but did not name the functions. It reported "Unsupported MemberExpression call target". Reading our own source at those ranges shows `dialog.showSaveDialog` and `fs.writeFile`. That naming is ours, not REA's.

Trace size: 38 nodes, 52 edges, 2 terminal paths, 40 observed facts, 53 inferred facts, 0 unknown facts.

**Talking points:**

- REA proved the privileged half of Save, from the bridge across IPC into the main-process handler, and pinpointed the two awaited operations inside it.
- It refused to claim the renderer half. Its words: a no-match "is not evidence that the feature is absent." Static analysis can't see that `window.openpage` in the UI is the object the preload exposed, so REA leaves that hop open instead of guessing.
- One of the two trace paths ended at `openDocument`. That's a sibling reached through file containment, not part of Save, and REA's guide warns about exactly this. A good analyst ignores it.
- To close hops 1 and 2, the next step is REA's runtime observation (for example `capture_electron_scenario`, clicking Save in the real app). That was out of scope for this static demo.

---

## Step 4: Version diff (v1 → v2, adding Find & Replace)

**v2 change:** a Find & Replace panel (Ctrl+F / Ctrl+H) with next/previous, Match case, Replace and Replace all, in a new `renderer/find-replace.js`. Also a toolbar Find button, panel markup and styles, and version 2.0.0.
**Tools:** `analyze_javascript_application` on v2, then `compare_application_versions`.
**Evidence:** v2 analysis `ev_032a292d8362392d39b4e958925b923ebe72c415310f4050e93ab4c8e48d7cd5` · v2 summary `ev_333cb6e406dad424da8f4c5ac4534eaf521833b5dfd0bd2119f383279889d56a` · comparison `ev_f010a4ffe06dcc53b342a5754ea56fdc01ffad0d7a11f7220ab9faa5124205d7`

**Result:** 28 unchanged, 4 added, 6 changed, 1 removed, 3 unknown. Coverage was complete on both sides, with no fuzzy matching.

| What REA reported | Detail |
|---|---|
| **Added** | `renderer/find-replace.js` (archive entry, JS asset and JS module) |
| **Changed** | `package.json`: version `1.0.0` → `2.0.0` |
| **Changed** | `renderer/index.html`: content 1,490 → 2,698 bytes |
| **Changed** | Renderer relationships: v1 loads `app.js`; v2 loads `app.js` **and** `find-replace.js` |
| **Unchanged (exact byte digest)** | `main.js`, `preload.js`, `renderer/app.js` |
| **Unchanged** | Both IPC channels and handlers, the `openpage` bridge, the BrowserWindow and its preload |
| Removed + added | The archive root itself. Its identity is its digest, so a new build is a new root. This is expected. |
| Unknown (3) | The archive entries wrapping `main.js`, `preload.js` and `app.js`. Their contents are byte-identical, but their parent (the root) changed identity, so REA won't call the entries "unchanged". |

**The headline for a security reviewer:** v2 added a renderer-only feature and **did not touch the privileged surface**. Main process, preload, bridge and IPC are all byte-identical or unchanged by exact identity. You can sign off on that without reading a line of v2 code.

**Boundary:** `styles.css` also changed in v2, but REA's application graph doesn't model stylesheets, so no diff item mentions it. That's outside REA's scope, not proof that CSS was unchanged.

Growth in REA's own counters, v1 → v2: AST nodes 1,030 → 2,010; call-flow relations 40 → 123; data-flow relations 333 → 706; semantic unknowns 248 → 483.

---

## Step 5: Ledger

| Question | Status | Evidence |
|---|---|---|
| What is the app's architecture? | **Answered** (complete application coverage) | `ev_e81fa276…`, `ev_c232c61e…` |
| What crosses the renderer/main boundary? | **Answered**: 2 literal IPC channels, 1 bridge with 2 members | `ev_c232c61e…` |
| How does Save work end to end? | **Partially answered**: preload → IPC → handler → two awaited calls proven; renderer hops unknown | `ev_abbf51a0…`, `ev_e56aa7e8…` |
| What changed in v2? | **Answered**: 1 new renderer module, HTML and version changes, privileged code untouched | `ev_f010a4ff…` |

All Evidence from this session is exported to `evidence/rea-evidence-bundle.json` (15 records), so the results can be reloaded in a later REA session without re-running analysis.

---

## Presenter cheat sheet

1. `npm start`: show OpenPage working (type, bold, save, Ctrl+F).
2. "REA never sees this source. It only gets `dist/v1/app.asar`."
3. Step 2: REA lists the window, its security settings, the bridge and both IPC channels, with exact line numbers.
4. Step 3: REA follows Save across the process boundary, and clearly marks what it *can't* prove.
5. Step 4: REA diffs v1 and v2 and shows that the new feature never touched privileged code.
6. Close: every claim is labeled observed, inferred or unknown. No guessing.

To rebuild after editing: `npm run pack -- v3` (existing builds are protected; add `--force` to replace one).
