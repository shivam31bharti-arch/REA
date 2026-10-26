# YouTube Script — "I Gave Claude the Power to Reverse-Engineer Anything. Then It Built Me a Free Office."

---

HOOK

A few weeks ago, one developer released a free alternative to the entire Adobe suite.

Not one app. All seven of Adobe's flagship apps — Photoshop, Illustrator, Premiere Pro, Lightroom, After Effects, InDesign, Acrobat — rebuilt, free, and open source. It's called Artcraft. Adobe charges around seven hundred eighty dollars a year for theirs. His costs nothing.

[SCREEN: Artcraft site / GitHub — scroll the seven apps, then headlines from Futurism, Al Jazeera, TweakTown]

And here's the part nobody's talking about. He didn't spend ten years writing this. He says he reverse-engineered Adobe's apps — using AI. Using Claude.

And this isn't a one-off. The same developer turned around and did it to Microsoft next — free versions of Word, Excel, and PowerPoint. Thirteen free apps now, from one person. And honestly, this trick is older than all of us. In the 1980s, a little company called Compaq reverse-engineered IBM's PC — that's the only reason cheap laptops exist today. Reverse engineering built half the tech world you use every day.

So the question is — how are these people looking inside apps they don't have the code for?

So I asked Claude straight out:

[PROMPT — "Let's recreate the exact copy of Microsoft Office, name it Free Office. Let's start creating the exact replica."]

And Claude said no — not to the idea, to the copy. Microsoft's code, icons and name belong to Microsoft, and copying them isn't legal, even for free. But it said yes to the legal version: learn how apps work, then build our own from scratch — free, working with Word, Excel and PowerPoint files, and never leaving your computer. So in this video: first the setup, then the build.

Today, I'm giving Claude that exact power. By the end of this video, my Claude — the same Claude Code sitting on my computer — will be able to open almost any app on my machine, look inside it, and explain to me in plain English how it works. Any EXE. Any desktop app. Even apps from companies that would never show you their code. And then it builds me four apps, a dashboard, and a real installer.

And the best part — I didn't write a single line of code to set this up. I sent Claude two messages. That's the whole setup. I'll show you both of them.

Let's build it.

PART 2 — WHAT WE'RE ACTUALLY BUILDING

When a company ships you an app, they give you the finished cake — but never the recipe. The recipe is the source code, and that stays locked in their office. Reverse engineering is tasting the cake and working the recipe out backwards. The app is sitting right there on your computer. Everything it does is in that file. You're just learning to read it.

[SCREEN: simple animation — cake on one side, recipe with a lock on the other, arrow going backwards]

The tool making this possible is called REA — it literally stands for "Reverse Engineer Anything." It's a free, open-source project on GitHub, and think of it as a forensics kit for software. Two hundred and thirteen tools in one box — tools for opening up Windows programs, Mac apps, Android apps, even the apps behind websites.

On its own, REA is just a toolbox sitting on a shelf. It comes to life when you plug it into Claude. Claude becomes the detective, REA is its forensics kit. You ask a question in plain English — "how does this app save my files?" — Claude picks the right tools, investigates, and reports back with evidence.

PART 3 — ONE SENTENCE INSTALLS THE WHOLE THING

Now, I'm not going to do any of this setup myself. I have someone for that.

For this entire build, I'm using Claude Code. It's made by Anthropic — the company behind Claude — and the easiest way to think about it is this: it's a senior developer living inside your computer. You tell it what you want in plain English, and it does everything a senior dev would do — builds, tests, and when something breaks, fixes it itself. Our only job is typing what we want.

And if you don't have a Claude subscription, you're not locked out. There are free agents that work the same way. Freebuff is completely free — ad-supported, no credit card, you install it and start working. Google's Antigravity is free and runs on Gemini 3. REA works with Antigravity too, so the prompts in this video stay the same. I'm using Claude Code because, for long jobs like this one, it's the strongest senior dev of the bunch.

[SCREEN: quick logo strip — Claude Code, Freebuff, Antigravity]

Open Claude Code in any folder, and paste this:

[PROMPT 1 — Clone the GitHub repo github.com/morluto/rea and install all the requirements and dependencies to work, along with the tools and MCP]

Press Enter. That's the entire install.

[SCREEN: Claude Code working — five thousand files downloading, dependencies installing, progress scrolling]

You'll see the word MCP on screen. All it means is a plug: it plugs REA's tools straight into Claude, along with a manual on how to use them. A new attachment snapped onto the drill.

[SCREEN: the health check running — "healthy: true", "213 tools", green checkmarks]

At the end, Claude runs the project's own health check — they literally call it the doctor — and you want to see it come back green: everything installed, everything connected, two hundred thirteen tools ready.

Now, a real-world moment. When I ran this, the doctor came back with one complaint. Here's what I did about it: nothing. Claude read the warning, found the missing piece, put it in place, and ran the doctor again. Green. It diagnosed and fixed its own install while I watched.

[SCREEN: the warning appearing, Claude fixing it, doctor re-running green]

That's the pattern for this whole video. If anything looks broken, you don't troubleshoot — you paste the error into Claude and say "fix it." That's how non-coders do technical setups now.

Last step: close Claude Code completely and open it again. Claude loads its new tools when it starts up — like restarting your phone after an update. When it comes back, the detective has the kit.

But the real prize is the other kind of app. And for that, we need one more piece.

PART 4 — THE ENGINE: A FREE DECOMPILER FROM THE NSA

Here's the thing about serious apps — the EXE files, the stuff written for raw speed. When a company builds those, the code gets translated into machine code: pure ones and zeros for your processor. Opening one in a text editor looks like someone shredded a book into confetti.

To turn that confetti back into readable pages, you need a special tool called a decompiler. And the best free one on Earth comes from — I'm not joking — the NSA. The National Security Agency. This is the tool their own analysts use to pick apart software, and in 2019 they open-sourced it. It's called Ghidra, and it costs nothing.

[SCREEN: Ghidra GitHub page, NSA logo, the release download]

REA can use Ghidra as its engine — and on Windows, it's the one to use. So Claude offered to set it up, and I said yes:

[PROMPT 2 — Yes, set up Ghidra as REA's native analysis engine on this machine.]

Press Enter, and watch it work through the whole thing.

[SCREEN: Claude working through the steps — Java check, downloads with progress, config]

Claude checked what my computer was missing, downloaded the free pieces from their official sources — about three-quarters of a gigabyte, so give it a few minutes — made sure nothing had been tampered with on the way, connected Ghidra to REA, and ran the doctor one more time.

[SCREEN: nine checks scrolling green, "ghidra available: true, version 12.1.4"]

Nine checks. Nine green. Restart Claude Code one more time, and the setup is officially done.

Two messages. That's the entire setup.

So, the engines under the hood, in plain English:
- REA — the forensics kit, two hundred thirteen tools that look inside software.
- Ghidra — the decoder ring: turns those ones and zeros back into readable code.
- REA's app reader — reads apps built with web technology, like Slack or VS Code, with no extra engine.
- REA's website engine — the X-ray. It opens a website in a Chrome browser, scans the layout, the code and what the page loads, and takes screenshots.

PART 5 — THE MOMENT OF TRUTH

To make sure everything worked, Claude tested it internally, on its own. It picked an actual Windows system file — a little tool called where.exe that ships inside every copy of Windows. Compiled machine code, no source code available, exactly the kind of file that used to be unreadable.

[SCREEN: the analysis kicking off, then the results — functions, strings, the inventory]

And then the results landed. An inventory of what's inside the program, with evidence attached. A file that was confetti ten minutes ago, laid out like a table of contents.

So what do you actually do with this power?

The Artcraft play: see a feature you love in some app, and say: "Study how this works, then build a version of it for my project." Understand it, then recreate it. That's the exact loop that produced free Photoshop, and it's now sitting in your chat box.

And if you're thinking about cloning a website — REA's website engine X-rays it. It opens the page, scans the layout, the code and what the page loads, takes screenshots, and Claude rebuilds the template from that. But for legal reasons, it only copies the template — the layout and structure. Not the images, not the videos, not the logo. Those belong to the site's owner, so you drop in your own.

PART 6 — FIRST TEST: TAKING APART OUR OWN APP

Claude wouldn't point REA at Office itself, because that's the copying problem again. So to show what REA can do, it built a tiny word processor of our own called OpenPage, packed it like a real app, and let REA take it apart.

[PROMPT 3 — "Load the reverse-engineer-anything (REA) skill. I want a short live demo of REA's capabilities, using a small original app we build ourselves as the target." The rest of it asks for a tiny word processor called OpenPage, then REA to map it, trace "Save document", and compare version one with version two.]

Working only from the packaged app file, REA mapped how the app is built, followed Save into the part that opens the save window and writes the file, and spotted that the app never checks which window is asking it to save or open a file — a weak spot worth fixing. We added Find and Replace as version two, and REA listed what changed. And where it couldn't prove something — like the button click itself — it said so. Receipts, not opinions.

[SCREEN: OpenPage window, REA's map of the app, the Save trace, the version comparison]

PART 7 — BUILDING OUR OWN FREE OFFICE

Now the big one. I asked Claude how close we could honestly get: about 70 to 85 percent of what most people do every day — but only around 10 percent of Office's full feature list, because Office has thirty years of features. I liked that it didn't oversell it.

We named the apps Prose for documents, Cells for spreadsheets, Deck for presentations and Jotbook for notes — the suite is Paperlight — and I gave Claude one big brief. The lines that matter:

[PROMPT 4 — "Build Paperlight, a free, local office suite written from scratch." Four apps and a home screen. "Richer and calmer than Office, never cluttered." "No Microsoft code, icons, templates, fonts (no Calibri or Aptos) or branding. Office file formats are fine." "Local only: no accounts, network calls or telemetry." And: "For each app… test the main flows (including opening and saving its Office file format), fix what breaks, and tell me plainly what works and what doesn't."]

That last line matters most: Claude can't just say "done", it has to prove it.

For design, I gave it a skill called Impeccable — like hiring a design director. Before each app it showed me a few layout options and I picked one: a clean Swiss Grid style for the whole suite, "focus sheet" for Jotbook, "sheet strip" for Cells, "talk timeline" for Deck. One line each:

[PROMPTS — "Build Cells with the sheet strip layout." "Build Deck with the talk timeline layout."]

[SCREEN: the layout page with the options, clicking one]

After every app, a second AI reviewer checked the screens and sent back a list of fixes, and Claude fixed them.

And Claude tested everything itself: opened each app, typed, clicked, saved real Word and Excel files and opened them again, and checked the PowerPoint files it saved. When pasting into Cells didn't work, it caught that and fixed it. I mostly watched and picked layouts.

The engines inside, in plain English: Electron makes it a real desktop program — same as VS Code and Slack. TipTap is the typing engine. The formula engine in Cells, Claude wrote from scratch — about a hundred functions like SUM and VLOOKUP. Free libraries do the file work: ExcelJS for Excel, docx and mammoth for Word, PptxGenJS to save PowerPoint, and Chart.js draws the charts. All free, all open source, none of it Microsoft's.

What we ended up with: documents, spreadsheets with formulas and charts, presentations with a timeline of your talk, and notebooks that save themselves — opening and saving real Word and Excel files, and saving PowerPoint files.

[SCREEN: quick tour, one shot per app]

PART 8 — ALL FOUR APPS IN ONE PLACE

Then I wanted all four apps in one place. One line:

[PROMPT 5 — "now make a dashboard and put all the 4 apps in one space."]

Claude showed me three layouts and I picked "Continue stage": the last thing you worked on takes the big stage — the real slide, page or spreadsheet — with a Continue button, and the other three apps sit beside it with their newest work and a New button.

[SCREEN: Dashboard, hovering items, the stage changing]

PART 9 — A REAL DESKTOP APP

Then I asked: is it a desktop app? Claude said yes — its own window, works offline, files stay on your computer — but it still had to be started from the terminal. So Claude offered to make a real installer, and I said yes:

[PROMPT 6 — "Package Paperlight as a Windows installer (.exe) with a Start menu entry."]

Claude designed an icon — a white P with the four app colours — and built a real installer. Double-click, pick a folder, and Paperlight is in your Start menu, with an uninstaller like any other program. I had Claude run it on my PC, and it opened straight from the Start menu.

The installer isn't signed — that needs a paid certificate — so Windows may warn you. Click More info, then Run anyway.

[SCREEN: installer running, searching "Paperlight" in the Start menu, the app opening]

What doesn't work yet: Deck can't open PowerPoint files, only save them, and very complex Word files lose some formatting. That's about what Claude estimated at the start — and for a free suite built in about a day, I'll take it.

PART 10 — TWO THINGS BEFORE YOU GO WILD

First — the legal line, in one sentence: study software you own or are allowed to examine, for learning, research, or building something compatible. That's the lane Compaq drove in, it's the lane Artcraft drives in, and it's protected in most places. What's not okay is copying someone's actual code into your product, or breaking licenses and protections. Understand the recipe — don't photocopy the cookbook. That's exactly why Paperlight is built from scratch instead of copied.

Second — one practical note: the first look at any new program is slow — Ghidra reads the whole file, and it can look stuck for a few minutes. It's not. After that, follow-up questions about that program come back almost instantly.

PART 11 — OUTRO

So let's add up what just happened.

One developer with Claude reverse-engineered Adobe's entire suite and gave it away free. Thirteen apps and counting. And today, with two messages in a chat box, you gave your own Claude that same ability — two hundred thirteen analysis tools, plus the NSA's own decompiler, running entirely on your machine, showing receipts for every claim. Then, with one big brief and a few one-line picks, it built us our own free office suite — four apps, a dashboard and a real installer.

The apps on your computer just stopped being black boxes.

If you want to see where this goes next, subscribe so you don't miss it.

All the prompts from this video are inside my free Staying Ahead WhatsApp community — link in the description. Join, grab them, run your own investigation.

And tell me in the comments — what app should I point this at first?

Catch you in the next one.
