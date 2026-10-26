# YouTube Script — "Claude Can Now Reverse-Engineer ANY App (Full Setup)"

> Draft 3 — styled on your sample script. Standalone video, non-tech audience. All steps = what was actually typed in the Claude chat.
> Facts verified: Artcraft = 7 Adobe app clones by Brandon Thomas (built with Claude + Rust, open source, alpha); same developer then released WordCraft, GridCraft, DeckCraft for Microsoft Office — 13 free apps in the family total.

---

HOOK

A few weeks ago, one developer released a free alternative to the entire Adobe suite.

Not one app. All seven of Adobe's flagship apps — Photoshop, Illustrator, Premiere Pro, Lightroom, After Effects, InDesign, Acrobat — rebuilt, free, and open source. It's called Artcraft. Adobe charges around seven hundred eighty dollars a year for theirs. His costs nothing.

[SCREEN: Artcraft site / GitHub — scroll the seven apps, then headlines from Futurism, Al Jazeera, TweakTown]

And here's the part nobody's talking about. He didn't spend ten years writing this. He says he reverse-engineered Adobe's apps — using AI. Using Claude.

And this isn't a one-off. The same developer turned around and did it to Microsoft next — free versions of Word, Excel, and PowerPoint. Thirteen free apps now, from one person. And honestly, this trick is older than all of us. In the 1980s, a little company called Compaq reverse-engineered IBM's PC — that's the only reason cheap laptops exist today. The Steam Deck plays Windows games without Windows because people spent years reverse-engineering how Windows works. Reverse engineering built half the tech world you use every day.

So the question is — how are these people looking inside apps they don't have the code for?

Today, I'm giving Claude that exact power. By the end of this video, my Claude — the same Claude Code sitting on my computer — will be able to open almost any app on my machine, look inside it, and explain to me in plain English how it works. Any EXE. Any desktop app. Even apps from companies that would never show you their code.

And the best part — I didn't write a single line of code to set this up. I typed two sentences into Claude. That's the whole setup. I'll show you both of them.

Let's build it.

PART 2 — WHAT WE'RE ACTUALLY BUILDING

Before we touch anything, let me explain what reverse engineering actually is, because the phrase sounds scarier than it is.

When a company ships you an app, they give you the finished cake — but never the recipe. The recipe is the source code, and that stays locked in their office. Reverse engineering is tasting the cake and working the recipe out backwards. The app is sitting right there on your computer. Everything it does is in that file. You're just learning to read it.

[SCREEN: simple animation — cake on one side, recipe with a lock on the other, arrow going backwards]

The problem is, reading it used to take years of training. The people who do this professionally are some of the highest-paid specialists in security. That's the skill we're handing to Claude today.

The tool making this possible is called REA — it literally stands for "Reverse Engineer Anything." It's a free, open-source project on GitHub, and think of it as a forensics kit for software. Two hundred and thirteen tools in one box — tools for opening up Windows programs, Mac apps, Android apps, even the apps behind websites.

On its own, REA is just a toolbox sitting on a shelf. It comes to life when you plug it into Claude. Claude becomes the detective, REA is its forensics kit. You ask a question in plain English — "how does this app save my files?" — Claude picks the right tools, investigates, and reports back with evidence.

And two things matter here. One — everything runs on your own computer. The app you're examining never gets uploaded anywhere. Two — Claude doesn't just give you an opinion. Every answer comes back with receipts: the actual code it found, and a note about what it could and couldn't verify. For an AI tool, that's exactly the design you want.

Now — how do we bolt this onto Claude without touching any code?

PART 3 — ONE SENTENCE INSTALLS THE WHOLE THING

Now, I'm not going to do any of this setup myself. I have someone for that.

For this entire build, I'm using Claude Code. It's made by Anthropic — the company behind Claude — and the easiest way to think about it is this: it's a senior developer living inside your computer. You tell it what you want in plain English, and it does everything a senior dev would do — downloads the project, installs the pieces, writes the configuration, and when something breaks, it reads the error, figures out what went wrong, and fixes it without you touching anything. Building, debugging, troubleshooting — all of it is its job today. Our only job is typing what we want.

And if you don't have a Claude subscription, you're not locked out. There are free agents that work the same way. Freebuff is completely free — ad-supported, no credit card, you install it and start working. Google's Antigravity is free and runs on Gemini 3. Gemini CLI is Google's free terminal agent. And OpenCode is open source and lets you plug in free models. REA — the toolkit we're installing — officially connects to Antigravity, Gemini CLI, and OpenCode too, so the prompts in this video stay exactly the same. I'm using Claude Code because, for long messy technical jobs like this one, it's the strongest senior dev of the bunch.

[SCREEN: quick logo strip — Claude Code, Freebuff, Antigravity, Gemini CLI, OpenCode]

Open Claude Code in any folder, and paste this:

[PROMPT 1 — Clone the GitHub repo github.com/morluto/rea and install all the requirements and dependencies to work, along with the tools and MCP]

Press Enter. That's the entire install.

[SCREEN: Claude Code working — five thousand files downloading, dependencies installing, progress scrolling]

Now let it work, because what happens next is genuinely fun to watch. Claude downloads the REA project — over five thousand files — installs everything it needs, builds it, and then connects it to itself.

While it runs, two words on your screen that are worth understanding.

The first is MCP. In plain English: an MCP is a plug that gives Claude new abilities. Out of the box, Claude can read your files and write code. Plug in an MCP, and it learns new tricks — this one hands it those two hundred and thirteen reverse-engineering tools. Think of it like a new attachment you snap onto a drill.

The second is a skill. The skill is the instruction manual for those tools. It's the difference between handing someone a forensics kit, and handing it to someone who went to detective school. REA installs both — the tools, and the training on how to run a proper investigation with them.

[SCREEN: the health check running — "healthy: true", "213 tools", green checkmarks]

At the end, Claude runs the project's own health check — they literally call it the doctor — and you want to see it come back green: everything installed, everything connected, two hundred thirteen tools ready.

Now, a real-world moment. When I ran this, the doctor came back with one complaint — a small Windows component was missing from the download. Here's what I did about it: nothing. Claude read the warning, worked out that the missing piece ships inside the official package version of REA, pulled that piece out, dropped it in place, and ran the doctor again. Green. It diagnosed and fixed its own install while I watched.

[SCREEN: the warning appearing, Claude fixing it, doctor re-running green]

That's the pattern for this whole video. If anything looks broken, you don't troubleshoot — you paste the error into Claude and say "fix it." That's how non-coders do technical setups now.

Last step: close Claude Code completely and open it again. Claude loads its new tools when it starts up — like restarting your phone after an update. When it comes back, the detective has the kit.

And at this point, Claude can already open up a huge range of apps — anything built with web technology, which is a surprising amount of what's on your PC. Apps like Slack, Discord, Notion, VS Code — that whole family is now readable.

But the real prize is the other kind of app. And for that, we need one more piece.

PART 4 — THE ENGINE: A FREE DECOMPILER FROM THE NSA

Here's the thing about serious apps — the EXE files, the stuff written for raw speed. When a company builds those, the code gets translated into machine code: pure ones and zeros for your processor. Opening one in a text editor looks like someone shredded a book into confetti.

To turn that confetti back into readable pages, you need a special tool called a decompiler. And the best free one on Earth comes from — I'm not joking — the NSA. The National Security Agency. This is the tool their own analysts use to pick apart software, and in 2019 they open-sourced it. It's called Ghidra, and it costs nothing.

[SCREEN: Ghidra GitHub page, NSA logo, the release download]

REA is built to use Ghidra as its engine. REA won't install it for you though — deliberately, it wants you to choose your own engine. So we tell Claude to handle it. Back in the chat, paste this:

[PROMPT 2 — Set up Ghidra as REA's native analysis engine on this machine]

Press Enter, and watch it work through the whole thing.

[SCREEN: Claude working through the steps — Java check, downloads with progress, config]

Here's everything Claude did on my machine, so you know what you're watching. First, it checked my computer for Java — Ghidra is built on Java, and it needs a recent version. Mine was too old. So Claude downloaded a free, current copy and tucked it into its own folder — it didn't touch or break anything else on my system. Then it downloaded Ghidra itself from the official source — about half a gigabyte, so give it a few minutes. And before using either download, it verified their checksums. Plain English: a checksum is like the safety seal on a medicine bottle — a fingerprint that proves the file is exactly what the maker published and nobody tampered with it on the way down. Both matched. Then it wired three settings into its own configuration so REA knows where everything lives, and ran the doctor one more time.

[SCREEN: nine checks scrolling green, "ghidra available: true, version 12.1.4"]

Nine checks. Nine green. Restart Claude Code one more time, and the setup is officially done.

Two sentences typed. That's the entire build.

PART 5 — THE MOMENT OF TRUTH

Time to point this thing at a real program.

I picked an actual Windows system file — a little tool called where.exe that ships inside every copy of Windows. Compiled machine code, no source code available, exactly the kind of file that used to be unreadable. And I just asked:

[PROMPT 3 — Use REA to analyze C:\Windows\System32\where.exe with Ghidra and show me what's inside]

[SCREEN: the analysis kicking off, then the results — functions, strings, the inventory]

One honest heads-up before you try it: the first analysis of any program is slow. Behind the scenes, Ghidra boots up and reads the entire file end to end — that can take a few minutes, and it will look stuck. It's not. Go get coffee. Because after that first pass, every follow-up question about that program comes back almost instantly.

And then the results landed. A full map of the program: every function inside it, every piece of text it contains, how the parts call each other — with evidence attached to every single claim. A file that was confetti ten minutes ago, laid out like a table of contents.

So what do you actually do with this power? Here's what it unlocks, from simple to wild.

One — ask how any feature works. "Explain how this app's search feature works, and show me the evidence." Claude investigates and walks you through it like a documentary about the inside of the app.

Two — check what an app is really doing. Is this random EXE you downloaded phoning home? What does it read? What does it save? You can now ask it directly, instead of trusting a forum post.

Three — compare two versions of an app. "What changed between this version and the last one?" — the exact move security researchers use to figure out what an update quietly fixed.

Four — and this is the Artcraft play — see a feature you love in some app, and say: "Study how this works, then build a version of it for my project." Understand it, then recreate it. That's the exact loop that produced free Photoshop, and it's now sitting in your chat box.

[SCREEN: typing the "explain this feature" prompt, results rolling in]

PART 6 — THREE THINGS BEFORE YOU GO WILD

Before you point this at everything on your hard drive, three quick things to keep you out of trouble.

First — the legal line, in one sentence: study software you own or are allowed to examine, for learning, research, or building something compatible. That's the lane Compaq drove in, it's the lane Artcraft drives in, and it's protected in most places. What's not okay is copying someone's actual code into your product, or breaking licenses and protections. Understand the recipe — don't photocopy the cookbook.

Second — be careful what you analyze. If you're inspecting some shady EXE you found on the internet, treat it like a stranger's package. REA examines files without running them, which is the safe way — but keep sketchy files in a separate folder, and don't double-click them yourself.

Third — one practical note: that first-analysis slowness is per program. First look at any new file takes minutes; everything after is instant. Plan around it and it'll never annoy you.

None of this is meant to scare you. These are the same rules every professional researcher follows. Stay in the lane, and this is one of the most genuinely powerful things you can add to Claude.

PART 7 — OUTRO

So let's add up what just happened.

One developer with Claude reverse-engineered Adobe's entire suite and gave it away free. Thirteen apps and counting. And today, with two sentences typed into a chat box, you gave your own Claude that same ability — two hundred thirteen analysis tools, plus the NSA's own decompiler, running entirely on your machine, showing receipts for every claim.

The apps on your computer just stopped being black boxes.

Next video, I want to take this further — pick a real app, trace one feature I love all the way down to the code, and have Claude rebuild it from scratch. If you want to see that, subscribe so you don't miss it.

Both prompts from this video are inside my free Staying Ahead WhatsApp community — link in the description. Join, grab them, run your own investigation.

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
