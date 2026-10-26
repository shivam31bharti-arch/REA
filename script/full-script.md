# ~~YouTube Script — "Claude Can Now Reverse-Engineer ANY App (Full Setup)"~~ **YouTube Script — "I Gave Claude the Power to Reverse-Engineer Anything. Then It Built Me a Free Office."**

~~> Draft 3 — styled on your sample script. Standalone video, non-tech audience. All steps = what was actually typed in the Claude chat.~~
**> Plain = original setup script. Bold = added. ~~Strikethrough~~ = removed. Target: about 15 minutes.**
> Facts verified: Artcraft = 7 Adobe app clones by Brandon Thomas (built with Claude + Rust, open source, alpha); same developer then released WordCraft, GridCraft, DeckCraft for Microsoft Office — 13 free apps in the family total.

---

HOOK

A few weeks ago, one developer released a free alternative to the entire Adobe suite.

Not one app. All seven of Adobe's flagship apps — Photoshop, Illustrator, Premiere Pro, Lightroom, After Effects, InDesign, Acrobat — rebuilt, free, and open source. It's called Artcraft. Adobe charges around seven hundred eighty dollars a year for theirs. His costs nothing.

[SCREEN: Artcraft site / GitHub — scroll the seven apps, then headlines from Futurism, Al Jazeera, TweakTown]

And here's the part nobody's talking about. He didn't spend ten years writing this. He says he reverse-engineered Adobe's apps — using AI. Using Claude.

And this isn't a one-off. The same developer turned around and did it to Microsoft next — free versions of Word, Excel, and PowerPoint. Thirteen free apps now, from one person. And honestly, this trick is older than all of us. In the 1980s, a little company called Compaq reverse-engineered IBM's PC — that's the only reason cheap laptops exist today. ~~The Steam Deck plays Windows games without Windows because people spent years reverse-engineering how Windows works.~~ Reverse engineering built half the tech world you use every day.

So the question is — how are these people looking inside apps they don't have the code for?

**So I asked Claude straight out:**

**[PROMPT — "Let's recreate the exact copy of Microsoft Office, name it Free Office. Let's start creating the exact replica."]**

**And Claude said no — not to the idea, to the copy. Microsoft's code, icons and name belong to Microsoft, and copying them isn't legal, even for free. But it said yes to the legal version: learn how apps work, then build our own from scratch — free, working with Word, Excel and PowerPoint files, and never leaving your computer. So in this video: first the setup, then the build.**

Today, I'm giving Claude that exact power. By the end of this video, my Claude — the same Claude Code sitting on my computer — will be able to open almost any app on my machine, look inside it, and explain to me in plain English how it works. Any EXE. Any desktop app. Even apps from companies that would never show you their code. **And then it builds me four apps, a dashboard, and a real installer.**

And the best part — I didn't write a single line of code to set this up. ~~I typed two sentences into Claude.~~ **I sent Claude two messages.** That's the whole setup. I'll show you both of them.

Let's build it.

PART 2 — WHAT WE'RE ACTUALLY BUILDING

~~Before we touch anything, let me explain what reverse engineering actually is, because the phrase sounds scarier than it is.~~

When a company ships you an app, they give you the finished cake — but never the recipe. The recipe is the source code, and that stays locked in their office. Reverse engineering is tasting the cake and working the recipe out backwards. The app is sitting right there on your computer. Everything it does is in that file. You're just learning to read it.

[SCREEN: simple animation — cake on one side, recipe with a lock on the other, arrow going backwards]

~~The problem is, reading it used to take years of training. The people who do this professionally are some of the highest-paid specialists in security. That's the skill we're handing to Claude today.~~

The tool making this possible is called REA — it literally stands for "Reverse Engineer Anything." It's a free, open-source project on GitHub, and think of it as a forensics kit for software. Two hundred and thirteen tools in one box — tools for opening up Windows programs, Mac apps, Android apps, even the apps behind websites.

On its own, REA is just a toolbox sitting on a shelf. It comes to life when you plug it into Claude. Claude becomes the detective, REA is its forensics kit. You ask a question in plain English — "how does this app save my files?" — Claude picks the right tools, investigates, and reports back with evidence.

~~And two things matter here. One — everything runs on your own computer. The app you're examining never gets uploaded anywhere. Two — Claude doesn't just give you an opinion. Every answer comes back with receipts: the actual code it found, and a note about what it could and couldn't verify. For an AI tool, that's exactly the design you want.~~

~~Now — how do we bolt this onto Claude without touching any code?~~

PART 3 — ONE SENTENCE INSTALLS THE WHOLE THING

Now, I'm not going to do any of this setup myself. I have someone for that.

For this entire build, I'm using Claude Code. It's made by Anthropic — the company behind Claude — and the easiest way to think about it is this: it's a senior developer living inside your computer. You tell it what you want in plain English, and it does everything a senior dev would do ~~— downloads the project, installs the pieces, writes the configuration, and when something breaks, it reads the error, figures out what went wrong, and fixes it without you touching anything. Building, debugging, troubleshooting — all of it is its job today.~~ **— builds, tests, and when something breaks, fixes it itself.** Our only job is typing what we want.

And if you don't have a Claude subscription, you're not locked out. There are free agents that work the same way. Freebuff is completely free — ad-supported, no credit card, you install it and start working. Google's Antigravity is free and runs on Gemini 3. ~~Gemini CLI is Google's free terminal agent. And OpenCode is open source and lets you plug in free models. REA — the toolkit we're installing — officially connects to Antigravity, Gemini CLI, and OpenCode too, so the prompts in this video stay exactly the same. I'm using Claude Code because, for long messy technical jobs like this one, it's the strongest senior dev of the bunch.~~ **REA works with Antigravity too, so the prompts in this video stay the same. I'm using Claude Code because, for long jobs like this one, it's the strongest senior dev of the bunch.**

~~[SCREEN: quick logo strip — Claude Code, Freebuff, Antigravity, Gemini CLI, OpenCode]~~ **[SCREEN: quick logo strip — Claude Code, Freebuff, Antigravity]**

Open Claude Code in any folder, and paste this:

[PROMPT 1 — Clone the GitHub repo github.com/morluto/rea and install all the requirements and dependencies to work, along with the tools and MCP]

Press Enter. That's the entire install.

[SCREEN: Claude Code working — five thousand files downloading, dependencies installing, progress scrolling]

~~Now let it work, because what happens next is genuinely fun to watch. Claude downloads the REA project — over five thousand files — installs everything it needs, builds it, and then connects it to itself.~~

~~While it runs, two words on your screen that are worth understanding.~~

~~The first is MCP. In plain English: an MCP is a plug that gives Claude new abilities. Out of the box, Claude can read your files and write code. Plug in an MCP, and it learns new tricks — this one hands it those two hundred and thirteen reverse-engineering tools. Think of it like a new attachment you snap onto a drill.~~

~~The second is a skill. The skill is the instruction manual for those tools. It's the difference between handing someone a forensics kit, and handing it to someone who went to detective school. REA installs both — the tools, and the training on how to run a proper investigation with them.~~

**You'll see the word MCP on screen. All it means is a plug: it plugs REA's tools straight into Claude, along with a manual on how to use them. A new attachment snapped onto the drill.**

[SCREEN: the health check running — "healthy: true", "213 tools", green checkmarks]

At the end, Claude runs the project's own health check — they literally call it the doctor — and you want to see it come back green: everything installed, everything connected, two hundred thirteen tools ready.

Now, a real-world moment. When I ran this, the doctor came back with one complaint ~~— a small Windows component was missing from the download~~. Here's what I did about it: nothing. Claude read the warning, ~~worked out that the missing piece ships inside the official package version of REA, pulled that piece out, dropped it in place,~~ **found the missing piece, put it in place,** and ran the doctor again. Green. It diagnosed and fixed its own install while I watched.

[SCREEN: the warning appearing, Claude fixing it, doctor re-running green]

That's the pattern for this whole video. If anything looks broken, you don't troubleshoot — you paste the error into Claude and say "fix it." That's how non-coders do technical setups now.

Last step: close Claude Code completely and open it again. Claude loads its new tools when it starts up — like restarting your phone after an update. When it comes back, the detective has the kit.

~~And at this point, Claude can already open up a huge range of apps — anything built with web technology, which is a surprising amount of what's on your PC. Apps like Slack, Discord, Notion, VS Code — that whole family is now readable.~~

But the real prize is the other kind of app. And for that, we need one more piece.

PART 4 — THE ENGINE: A FREE DECOMPILER FROM THE NSA

Here's the thing about serious apps — the EXE files, the stuff written for raw speed. When a company builds those, the code gets translated into machine code: pure ones and zeros for your processor. Opening one in a text editor looks like someone shredded a book into confetti.

To turn that confetti back into readable pages, you need a special tool called a decompiler. And the best free one on Earth comes from — I'm not joking — the NSA. The National Security Agency. This is the tool their own analysts use to pick apart software, and in 2019 they open-sourced it. It's called Ghidra, and it costs nothing.

[SCREEN: Ghidra GitHub page, NSA logo, the release download]

~~REA is built to use Ghidra as its engine.~~ **REA can use Ghidra as its engine — and on Windows, it's the one to use.** ~~REA won't install it for you though — deliberately, it wants you to choose your own engine.~~ ~~So we tell Claude to handle it. Back in the chat, paste this:~~ **So Claude offered to set it up, and I said yes:**

~~[PROMPT 2 — Set up Ghidra as REA's native analysis engine on this machine]~~ **[PROMPT 2 — Yes, set up Ghidra as REA's native analysis engine on this machine.]**

Press Enter, and watch it work through the whole thing.

[SCREEN: Claude working through the steps — Java check, downloads with progress, config]

~~Here's everything Claude did on my machine, so you know what you're watching. First, it checked my computer for Java — Ghidra is built on Java, and it needs a recent version. Mine was too old. So Claude downloaded a free, current copy and tucked it into its own folder — it didn't touch or break anything else on my system. Then it downloaded Ghidra itself from the official source — about half a gigabyte, so give it a few minutes. And before using either download, it verified their checksums. Plain English: a checksum is like the safety seal on a medicine bottle — a fingerprint that proves the file is exactly what the maker published and nobody tampered with it on the way down. Both matched. Then it wired three settings into its own configuration so REA knows where everything lives, and ran the doctor one more time.~~

**Claude checked what my computer was missing, downloaded the free pieces from their official sources — about three-quarters of a gigabyte, so give it a few minutes — made sure nothing had been tampered with on the way, connected Ghidra to REA, and ran the doctor one more time.**

[SCREEN: nine checks scrolling green, "ghidra available: true, version 12.1.4"]

Nine checks. Nine green. Restart Claude Code one more time, and the setup is officially done.

~~Two sentences typed.~~ **Two messages.** That's the entire ~~build~~ **setup**.

**So, the engines under the hood, in plain English:**
**- REA — the forensics kit, two hundred thirteen tools that look inside software.**
**- Ghidra — the decoder ring: turns those ones and zeros back into readable code.**
**- REA's app reader — reads apps built with web technology, like Slack or VS Code, with no extra engine.**
**- REA's website engine — the X-ray. It opens a website in a Chrome browser, scans the layout, the code and what the page loads, and takes screenshots.**

PART 5 — THE MOMENT OF TRUTH

~~Time to point this thing at a real program.~~

~~I picked~~ **To make sure everything worked, Claude tested it internally, on its own. It picked** an actual Windows system file — a little tool called where.exe that ships inside every copy of Windows. Compiled machine code, no source code available, exactly the kind of file that used to be unreadable. ~~And I just asked:~~

~~[PROMPT 3 — Use REA to analyze C:\Windows\System32\where.exe with Ghidra and show me what's inside]~~

[SCREEN: the analysis kicking off, then the results — functions, strings, the inventory]

~~One honest heads-up before you try it: the first analysis of any program is slow. Behind the scenes, Ghidra boots up and reads the entire file end to end — that can take a few minutes, and it will look stuck. It's not. Go get coffee. Because after that first pass, every follow-up question about that program comes back almost instantly.~~

And then the results landed. ~~A full map of the program: every function inside it, every piece of text it contains, how the parts call each other — with evidence attached to every single claim.~~ **An inventory of what's inside the program, with evidence attached.** A file that was confetti ten minutes ago, laid out like a table of contents.

So what do you actually do with this power? ~~Here's what it unlocks, from simple to wild.~~

~~One — ask how any feature works. "Explain how this app's search feature works, and show me the evidence." Claude investigates and walks you through it like a documentary about the inside of the app.~~

~~Two — check what an app is really doing. Is this random EXE you downloaded phoning home? What does it read? What does it save? You can now ask it directly, instead of trusting a forum post.~~

~~Three — compare two versions of an app. "What changed between this version and the last one?" — the exact move security researchers use to figure out what an update quietly fixed.~~

~~Four — and this is the Artcraft play —~~ **The Artcraft play:** see a feature you love in some app, and say: "Study how this works, then build a version of it for my project." Understand it, then recreate it. That's the exact loop that produced free Photoshop, and it's now sitting in your chat box.

**And if you're thinking about cloning a website — REA's website engine X-rays it. It opens the page, scans the layout, the code and what the page loads, takes screenshots, and Claude rebuilds the template from that. But for legal reasons, it only copies the template — the layout and structure. Not the images, not the videos, not the logo. Those belong to the site's owner, so you drop in your own.**

~~[SCREEN: typing the "explain this feature" prompt, results rolling in]~~

**PART 6 — FIRST TEST: TAKING APART OUR OWN APP**

**Claude wouldn't point REA at Office itself, because that's the copying problem again. So to show what REA can do, it built a tiny word processor of our own called OpenPage, packed it like a real app, and let REA take it apart.**

**[PROMPT 3 — "Load the reverse-engineer-anything (REA) skill. I want a short live demo of REA's capabilities, using a small original app we build ourselves as the target." The rest of it asks for a tiny word processor called OpenPage, then REA to map it, trace "Save document", and compare version one with version two.]**

**Working only from the packaged app file, REA mapped how the app is built, followed Save into the part that opens the save window and writes the file, and spotted that the app never checks which window is asking it to save or open a file — a weak spot worth fixing. We added Find and Replace as version two, and REA listed what changed. And where it couldn't prove something — like the button click itself — it said so. Receipts, not opinions.**

**[SCREEN: OpenPage window, REA's map of the app, the Save trace, the version comparison]**

**PART 7 — BUILDING OUR OWN FREE OFFICE**

**Now the big one. I asked Claude how close we could honestly get: about 70 to 85 percent of what most people do every day — but only around 10 percent of Office's full feature list, because Office has thirty years of features. I liked that it didn't oversell it.**

**We named the apps Prose for documents, Cells for spreadsheets, Deck for presentations and Jotbook for notes — the suite is Paperlight — and I gave Claude one big brief. The lines that matter:**

**[PROMPT 4 — "Build Paperlight, a free, local office suite written from scratch." Four apps and a home screen. "Richer and calmer than Office, never cluttered." "No Microsoft code, icons, templates, fonts (no Calibri or Aptos) or branding. Office file formats are fine." "Local only: no accounts, network calls or telemetry." And: "For each app… test the main flows (including opening and saving its Office file format), fix what breaks, and tell me plainly what works and what doesn't."]**

**That last line matters most: Claude can't just say "done", it has to prove it.**

**For design, I gave it a skill called Impeccable — like hiring a design director. Before each app it showed me a few layout options and I picked one: a clean Swiss Grid style for the whole suite, "focus sheet" for Jotbook, "sheet strip" for Cells, "talk timeline" for Deck. One line each:**

**[PROMPTS — "Build Cells with the sheet strip layout." "Build Deck with the talk timeline layout."]**

**[SCREEN: the layout page with the options, clicking one]**

**After every app, a second AI reviewer checked the screens and sent back a list of fixes, and Claude fixed them.**

**And Claude tested everything itself: opened each app, typed, clicked, saved real Word and Excel files and opened them again, and checked the PowerPoint files it saved. When pasting into Cells didn't work, it caught that and fixed it. I mostly watched and picked layouts.**

**The engines inside, in plain English: Electron makes it a real desktop program — same as VS Code and Slack. TipTap is the typing engine. The formula engine in Cells, Claude wrote from scratch — about a hundred functions like SUM and VLOOKUP. Free libraries do the file work: ExcelJS for Excel, docx and mammoth for Word, PptxGenJS to save PowerPoint, and Chart.js draws the charts. All free, all open source, none of it Microsoft's.**

**What we ended up with: documents, spreadsheets with formulas and charts, presentations with a timeline of your talk, and notebooks that save themselves — opening and saving real Word and Excel files, and saving PowerPoint files.**

**[SCREEN: quick tour, one shot per app]**

**PART 8 — ALL FOUR APPS IN ONE PLACE**

**Then I wanted all four apps in one place. One line:**

**[PROMPT 5 — "now make a dashboard and put all the 4 apps in one space."]**

**Claude showed me three layouts and I picked "Continue stage": the last thing you worked on takes the big stage — the real slide, page or spreadsheet — with a Continue button, and the other three apps sit beside it with their newest work and a New button.**

**[SCREEN: Dashboard, hovering items, the stage changing]**

**PART 9 — A REAL DESKTOP APP**

**Then I asked: is it a desktop app? Claude said yes — its own window, works offline, files stay on your computer — but it still had to be started from the terminal. So Claude offered to make a real installer, and I said yes:**

**[PROMPT 6 — "Package Paperlight as a Windows installer (.exe) with a Start menu entry."]**

**Claude designed an icon — a white P with the four app colours — and built a real installer. Double-click, pick a folder, and Paperlight is in your Start menu, with an uninstaller like any other program. I had Claude run it on my PC, and it opened straight from the Start menu.**

**The installer isn't signed — that needs a paid certificate — so Windows may warn you. Click More info, then Run anyway.**

**[SCREEN: installer running, searching "Paperlight" in the Start menu, the app opening]**

**What doesn't work yet: Deck can't open PowerPoint files, only save them, and very complex Word files lose some formatting. That's about what Claude estimated at the start — and for a free suite built in about a day, I'll take it.**

~~PART 6~~ **PART 10** — ~~THREE~~ **TWO** THINGS BEFORE YOU GO WILD

~~Before you point this at everything on your hard drive, three quick things to keep you out of trouble.~~

First — the legal line, in one sentence: study software you own or are allowed to examine, for learning, research, or building something compatible. That's the lane Compaq drove in, it's the lane Artcraft drives in, and it's protected in most places. What's not okay is copying someone's actual code into your product, or breaking licenses and protections. Understand the recipe — don't photocopy the cookbook. **That's exactly why Paperlight is built from scratch instead of copied.**

~~Second — be careful what you analyze. If you're inspecting some shady EXE you found on the internet, treat it like a stranger's package. REA examines files without running them, which is the safe way — but keep sketchy files in a separate folder, and don't double-click them yourself.~~

~~Third~~ **Second** — one practical note: ~~that first-analysis slowness is per program.~~ **the first look at any new program is slow — Ghidra reads the whole file, and it can look stuck for a few minutes. It's not.** ~~First look at any new file takes minutes; everything after is instant. Plan around it and it'll never annoy you.~~ **After that, follow-up questions about that program come back almost instantly.**

~~None of this is meant to scare you. These are the same rules every professional researcher follows. Stay in the lane, and this is one of the most genuinely powerful things you can add to Claude.~~

~~PART 7~~ **PART 11** — OUTRO

So let's add up what just happened.

One developer with Claude reverse-engineered Adobe's entire suite and gave it away free. Thirteen apps and counting. And today, with ~~two sentences typed into a chat box~~ **two messages in a chat box**, you gave your own Claude that same ability — two hundred thirteen analysis tools, plus the NSA's own decompiler, running entirely on your machine, showing receipts for every claim. **Then, with one big brief and a few one-line picks, it built us our own free office suite — four apps, a dashboard and a real installer.**

The apps on your computer just stopped being black boxes.

~~Next video, I want to take this further — pick a real app, trace one feature I love all the way down to the code, and have Claude rebuild it from scratch. If you want to see that, subscribe so you don't miss it.~~ **If you want to see where this goes next, subscribe so you don't miss it.**

~~Both prompts~~ **All the prompts** from this video are inside my free Staying Ahead WhatsApp community — link in the description. Join, grab them, run your own investigation.

And tell me in the comments — what app should I point this at first?

Catch you in the next one.

---

## FACT NOTES (internal — delete before recording)

- Artcraft: Brandon Thomas, Oct 2026. 7 Adobe clones (PhotoCraft, VectorCraft, FilmCraft, LightCraft, EffectCraft, DesignCraft, PrintCraft), open source MIT/Apache, alpha quality. He stated he reverse-engineered using Claude (Opus) + Rust. Then WordCraft / GridCraft / DeckCraft for Office — family of 13 "Crafting Apps". Say "he says he reverse-engineered" (attributed) — one outlet disputes the label.
- Adobe pricing: ~$779.99/yr upfront (Creative Cloud All Apps). Say "around 780 dollars".
- Compaq reverse-engineered IBM's PC BIOS (1982–83) → the PC-clone industry.
- Steam Deck: Proton (built on Wine) — Windows re-implemented through years of reverse engineering.
- Ghidra: NSA, open-sourced 2019, version used here 12.1.4 (~543 MB). Java JDK 21 was auto-installed user-scoped.
- Session facts: 5,075 files cloned, 213 tools, 9/9 doctor checks, test target where.exe, first analysis minutes / repeats ~instant, total downloads ~750 MB.
- Prompts are near-verbatim from the actual chat (prompt 1 and 2 are what was really typed).
- Free alternatives (verified): Freebuff — free ad-supported agent from the Codebuff team (YC F24), open models (DeepSeek etc.), no card; Google Antigravity — free, Gemini 3; Gemini CLI — free tier; OpenCode — open source, bring-your-own/free models. Antigravity, Gemini CLI and OpenCode are officially supported REA setup clients; Freebuff is pitched as the free builder-agent option (REA auto-setup not confirmed for it — it does the building/debugging role).
- **Every [PROMPT] in this script is one the user typed or picked when Claude offered a choice: Free Office, REA install, "Yes, set up Ghidra", the OpenPage prompt (pasted), the Paperlight brief (pasted), the layout picks, the dashboard line and the installer line. The where.exe analysis was Claude's own internal test during the Ghidra setup (21 Oct ~15:01), so it is told as that, not as a prompt.**
- **The "Free Office" prompt is near-verbatim (the real one also said "Load the REA skill"). Claude declined an exact replica (copyright) and suggested building our own from scratch.**
- **X-ray: REA has no tool literally named "X-ray". Its website engine works through a Chrome-family browser and reads page structure, scripts, network requests and screenshots. "Only the template" is the legal rule (images, videos and logos belong to the owner), not a technical limit of REA.**
- **OpenPage: REA ran on the packaged app only (11 KB, 7 files). It found the window's safety settings, the bridge and both save/open channels with line numbers, traced Save into the file write, flagged that the save handlers don't check the sender, and diffed v1→v2 (Find & Replace added). It stated what it could not prove (the button-click side).**
- **Coverage numbers are Claude's own estimate before the build: ~70–85% of everyday use, ~10% of Office's full feature list.**
- **Paperlight build: 21 Oct ~15:50 to 22 Oct ~12:40. Layouts the user picked: Swiss Grid (Prose, whole suite), focus sheet (Jotbook), sheet strip (Cells), talk timeline (Deck), Continue stage (Dashboard). Cells: the function table holds 109 functions (the README says about 95), so the script says "about a hundred"; 91 engine tests.**
- **Order: REA and Ghidra were installed first (21 Oct 14:47–15:03); the Free Office ask came after (15:08). The hook asks Claude without claiming it came first, and says the video shows the setup first.**
- **Downloads during the Ghidra setup: JDK 21 196 MB + Ghidra 543 MB, about 740 MB ("three-quarters of a gigabyte").**
- **Prompt 5 is condensed from the real build brief; quoted lines are word for word.**
- **Installer: Paperlight-Setup-0.1.0.exe, ~113 MB, per-user install (no admin), Start menu entry, uninstall from Settings > Apps, not code-signed.**
- **Known limits: no .pptx import, no tables/charts on slides, one text size per text box, complex .docx simplified on import, deck preview on the Dashboard shows slide 1.**
