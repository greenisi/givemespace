# Phase 8 — Self-Evolving (Workflow Learning + Skill Suggestion)

> The vision: GiveMeSpace gets smarter the more you use it. The platform notices repeated patterns in how you work and proactively offers to turn them into one-click skills. After 30 days, your workspace is shaped to your specific work — not a generic tool.

## What this is NOT

Not RL. Not LLM fine-tuning. Not a research project. Those are 12-month efforts and don't move the user-experienced needle for a productivity SaaS.

## What this IS

Heuristic pattern detection on an event log + LLM-powered "make this a skill?" suggestions. ~10x cheaper to build, ~80% of the user-felt benefit.

## The user-facing experience

```
[After ~30 actions over a week]

AGENT (chip in chat composer): I noticed you've manually created a
        "Weekly review" space every Monday with the same widgets
        (week's top tasks, last week's wins, this week's goals).
        Want me to make this a one-click skill called /weekly-review
        you can summon any Monday?

        [Yes, save as skill]  [No thanks]  [Show me the pattern]

USER: Yes.

AGENT: → generates a SKILL.md at user.skills/weekly-review/
       → registers /weekly-review in the slash-command palette
       → next Monday, user types /weekly-review, agent rebuilds
         the entire space in 5 seconds
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ event_log table (in saas.db)                                    │
│   - user_id, ts, event_type, target, params (JSON)              │
│   - event_type ∈ {                                              │
│       "open_space", "create_widget", "edit_widget",             │
│       "delete_widget", "open_panel", "type_message",            │
│       "agent_action", "navigate"                                │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼ (every ~30 events / once a day)
┌─────────────────────────────────────────────────────────────────┐
│ Pattern detector (server-side, runs async):                     │
│                                                                 │
│  Sliding window:                                                │
│    - look at the last N events grouped into "sessions"          │
│    - detect repeated sub-sequences (Levenshtein-like distance)  │
│    - filter: pattern repeats ≥3 times across ≥2 days            │
│    - filter: pattern length 5-50 events (skip trivial)          │
│                                                                 │
│  Output: candidate patterns with confidence scores              │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Skill candidate composer (LLM call):                            │
│                                                                 │
│  Input: a candidate pattern (sequence of events)                │
│  Prompt: "Here's a workflow the user repeats. Write a SKILL.md  │
│           that codifies it. Suggest a slash-command name.       │
│           Note any inputs the user might want to vary."         │
│  Output: SKILL.md draft + suggested name + description          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Suggestion UI:                                                  │
│   - chip in chat composer when a candidate is ready             │
│   - click → preview SKILL.md + sample replay                    │
│   - confirm → installed at user.skills/<name>/SKILL.md          │
│   - decline → marked dismissed, won't re-suggest same pattern   │
└─────────────────────────────────────────────────────────────────┘
```

## What ships in Phase 8

### W1 — Event log
- `usage_events` table extended (or new `events` table) with workflow events
- `space.events.emit(type, target, params)` — explicit calls from existing modules
- Implicit hooks on common UI actions (widget create/edit/delete, space switch)

### W2 — Pattern detector
- `server/lib/saas/pattern_detector.js` — runs daily via cron (or every Nth event)
- Sliding-window subsequence matching with simple distance metric
- Outputs candidate patterns to `pattern_candidates` table

### W3 — Skill composer + suggestion UI
- `server/lib/saas/skill_composer.js` — LLM call to draft SKILL.md from pattern
- `_core/agent_suggestions/` module (also used in Phase 7)
- Chip + preview + accept/decline flow

### W4 — Trust + safety
- Allowlist of event types that can be auto-replayed (no destructive ops)
- User-editable SKILL.md before install (always show the YAML draft)
- "Dismissed patterns" registry — never re-suggest the same shape

## Estimated build: 3 weeks across 3 sessions

## Critical design decisions

- **No autoplay, ever** — agent only proposes skills; user always confirms. Removes the "AI did something I didn't expect" anxiety.
- **Skills live in the user's L2 dir, not shared** — your workflow doesn't pollute mine.
- **LLM call is rare** — pattern detector runs on heuristics; LLM only fires on candidate match. Cost: pennies per user per month.
- **Dismissed patterns don't re-suggest** — single decline is permanent unless the user explicitly resets dismissals. Don't be the assistant that asks "are you sure?" twelve times.

## What this gives the product

The "stickiness" most SaaS lacks. After 30 days of use, users have a personal skill library — uninstalling means losing that. Switching costs become real.

The "wow" most SaaS lacks. The first time the agent says "I noticed you do X — want a one-click for it?" the user feels seen. That's the moment they tell a friend.
