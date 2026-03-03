# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Office cleaning duty board (사무실 청소 당번 보드) — a web app that automates weekly cleaning assignments for a 15-person team. The PRD is in Korean (`PRD.md`).

Core concept: **2-person teams only** (never 3-person). When member count is odd, one person gets a "free pass" (프리패스) per round and is prioritized for Week 1 of the next round.

## Tech Stack (from PRD)

- **Frontend:** HTML + Tailwind CSS + Vanilla JS (no build step, static site)
- **Data:** JSON files stored in the repo (`/data/` directory)
- **Hosting:** GitHub Pages or Cloudflare Pages
- **Notifications:** Slack Incoming Webhook
- **Scheduler:** GitHub Actions cron (weekly Thursday 10:00 KST)
- **Icons:** Lucide Icons (stroke-width: 1.5px)
- **Fonts:** Inter (en) + Pretendard (kr) + JetBrains Mono (data/code)

## Design System

Dark mode only, Supabase-inspired minimal design. Key colors:
- Background: `#171717` (primary), `#1C1C1C` (cards), `#262626` (hover)
- Accent (single brand color): `#3ECF8E` (Supabase green)
- Free pass: `#A78BFA` (purple — only non-grayscale addition)
- Text: `#EDEDED` / `#A1A1A1` / `#6B6B6B` (primary/secondary/tertiary)
- No shadows — use borders for depth. No pure white (#FFF) or pure black (#000).
- Borders define depth, not shadows. Cards use `1px solid #2E2E2E`, 12px radius.
- Layout: single column, max-width 720px centered (admin: 960px). Mobile-first — Slack links often open on phones.
- Transitions: 150ms ease-out on color/background/border only. No scale/slide animations.

## Key Domain Logic

### Round Assignment Algorithm
1. Determine free pass recipient (odd count only) — lowest `freePassCount`, break ties by most recent duty
2. Build assignment list (total minus free pass = even number)
3. Fisher-Yates shuffle; previous free pass member fixed to Week 1
4. Validate: no duplicate pairings from previous round (hard rule), avoid last 3 rounds (soft rule)
5. Retry up to 100 times, then relax soft rules
6. Randomly assign pairs to weeks (Week 1 fixed)

### Free Pass Fairness Rules
- Track `freePassCount` per member; select from lowest count
- No consecutive free passes (2 rounds in a row)
- Free pass member goes to Week 1 next round
- Reset counts when everyone has had at least 1 free pass
- Preserve counts on member deactivation (may return)

### Member Changes
- New member: joins next round (not current)
- Departure mid-round: fill from free pass member or run 1-person duty
- Exempt (long leave): `isExempt: true`, excluded from next round onward

## Data Model

Six entities: `Member`, `Round`, `WeekSchedule`, `PairingHistory`, `Substitution`, `FreePassLog`. `WeekSchedule.memberIds` is always length 2. See PRD section 5 for full schemas.

## Language

UI text and user-facing content are in **Korean**. Code identifiers and comments should be in English.
