# AGENTS.md

> **Shared contract for every AI tool that touches this repo.**
> Claude Code, Codex, ChatGPT and anything added later all read this file.
> It is the source of truth for conventions. `CLAUDE.md` holds Claude-specific
> notes only and defers to this file on anything shared.

---

## Rule 0 — Review before you work

**Before proposing or starting ANY new work, do this first. Every session. No exceptions.**

```
git log --oneline -15
git status
```

Read every commit since your last session. Then state plainly:
- what changed
- which agent changed it (see the commit tag below)
- whether it affects what you are about to do

Only then propose new work. If another agent left the tree dirty or mid-refactor,
say so and stop. Do not build on top of work you have not read.

## Rule 1 — Tag every commit with who you are

```
<type>: <what changed> (<agent>)
```

Agent tag is one of: `claude-code`, `codex`, `chatgpt`, `human`.

```
feat: add sponsor tier selector (codex)
fix: correct copper hex on print stylesheet (claude-code)
chore: bump deps (codex)
```

The tag is an audit trail, not a permission system. Any agent may edit any file
the rules allow. The point is that the next agent can see who did what.

## Rule 2 — Never work directly on `main`

Branch as `codex/<slug>` or `claude/<slug>`. Never commit to `main` without a
staging review first. Two agents on `main` at once is how this breaks.

## Rule 3 — The QA gate runs in Claude Code, whoever built it

Eddie's QA gates (`stop-slop`, `513sips-qa`, `penn-state-qa`, `513sips-design-qa`)
are Claude Code skills with live-site tooling: they load the deployed page, check
for 500s and console errors, and verify payment chains. That verification is not
portable to a checklist.

**So: Codex may build, but anything client-facing gets gated in Claude Code before
it ships.** Codex agents may self-check against the criteria below, and that is
useful, but it does not replace the gate.

Gate required for: anything on a public page, any client-facing copy, any payment
or registration flow, any brand or print asset.

---

## Writing conventions (all agents, all copy)

Full detail: `Obsidian Brain/03-Resources/Eddie-Voice-Profile.md`. Read it before
writing anything in Eddie's voice.

**No em dashes.** Try in order: a period, a comma, a colon, parentheses, rewrite
the sentence. Only then an em dash, and only for a genuine interruption in thought.
More than one per page means the writing is leaning on them. Zero is a fine number.

| Instead of | Write |
|---|---|
| "It's included — we don't charge for it." | "It's included. We don't charge for it." |
| "You have the space — we bring the bar." | "You have the space. We bring the bar." |

**No Oxford comma.** "the bar, the bartenders and the experience". This does NOT
apply to a comma joining two complete sentences: "It's included, and we don't
charge for it" keeps its comma.

## 513Sips brand colors

**The accent is COPPER, not gold.** Source of truth is `513sips-tools/index.html`
`:root`. This has been documented wrong twice and leaked into the vault. Do not
reintroduce `#C9A264`.

```
Navy       #1a1a2e     Navy Dark  #12121f     Navy Light #2d2d4a
COPPER     #b87333     Copper Lt  #d4915a
Cream      #f5f2eb     Charcoal   #2d3748
```

Fonts: Cormorant Garamond (headings), Montserrat (body).

## Sources of truth

- **Supabase** for operational data (clients, invoices, expenses)
- **Obsidian Brain** for strategy, decisions, intelligence and knowledge
  (`Obsidian Brain/`, synced to private repo `Egady513/Obsidian-Brain`)
- Never duplicate a fact that already lives in one of those. Link to it.

---
## This repo: travel-planner

- Personal project. Supabase backed.
- Claude Code skills: `travel-planner-execution` for the commit workflow,
  `travel-planner-river-hayes` for trip planning and review.
- Lower stakes than the client-facing repos. Codex has more latitude here, but
  Rule 0 and the commit tag still apply.

---

## If you are unsure

Stop and ask Eddie. A question costs a minute. A wrong assumption that ships to
www.513sips.com or a registration page costs more.
