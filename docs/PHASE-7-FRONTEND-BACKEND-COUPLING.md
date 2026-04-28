# Phase 7 — Frontend + Backend Coupling (Shared Data, Cross-Project Suggestions)

> The vision: if a user builds a website, the AI proactively offers a back-office dashboard that reads/writes the same data. One mental model — "my project" — covers both the public site and the operator dashboard, sharing a database transparently.

## The user-facing experience

```
[15 minutes after building the dog-walking landing page from Phase 6]

AGENT: I noticed your contact form on dogwalker.vercel.app saves to a
       customers table in your project. Want me to set up a dashboard
       so you can see new leads, mark them as contacted, and track
       which ones convert? It'll share the same database — no extra
       setup needed.

       [Yes, build it]  [Not now]

USER:  Yes.

AGENT: → creates a new "Operator Dashboard" space inside the same project
       → wires it to the project's customers + bookings tables
       → drops in a "New leads (last 7 days)" stat card
       → drops in a customers table with quick-status edit
       → drops in a "Bookings calendar" widget
       → 90 seconds, full operator dashboard, live data from the same
         backend the public site writes to.
```

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ Per-project shared backend                                          │
│                                                                     │
│   Database options (auto-selected per user tier):                  │
│     - Spark/Starter: SQLite per project (file in L2/<user>/projs/) │
│     - Pro/Studio:    Supabase project provisioned via their API    │
│                                                                     │
│   Schema discovery: agent reads the project's schema.sql, exposes  │
│   tables/columns to space.data.* tools.                            │
│                                                                     │
│   Auth: project-level row-level security; operator dashboard runs  │
│   as the project owner, public site uses the project's anon key.   │
└────────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌──────────────┐ ┌──────────┐ ┌──────────────────┐
      │ Public site  │ │ Operator │ │ Mobile app       │
      │ (Phase 6)    │ │ dashboard│ │ (future Phase 9) │
      │              │ │ (Phase 7)│ │                  │
      │ uses anon key│ │ uses     │ │ same db, same    │
      │ writes form  │ │ owner key│ │ schema           │
      │ submissions  │ │ reads &  │ │                  │
      │              │ │ updates  │ │                  │
      └──────────────┘ └──────────┘ └──────────────────┘
```

## space.data tool surface

```typescript
space.data = {
  // List tables in the current project's database
  list_tables(): Promise<{ tables: Array<{name, columns}> }>,
  
  // Run a SQL query (read-only by default, write requires explicit
  // write: true flag and triggers a confirmation)
  query(sql: string, params?: any[], opts?: { write?: boolean }): Promise<rows[]>,
  
  // CRUD helpers — agent prefers these over raw SQL
  insert(table: string, row: object): Promise<{id}>,
  update(table: string, id: string, patch: object): Promise<{ok}>,
  delete(table: string, id: string): Promise<{ok}>,
  
  // Subscribe a widget to live changes (uses Supabase realtime or
  // SQLite polling 5s for free tier)
  subscribe(table: string, callback): Unsubscribe
};
```

## Cross-project suggestion engine

After Phase 8's event log (workflow learning) is in place, this becomes:

```javascript
// pseudo
on user_event:
  if user.recently_built === "landing-page" 
     and project.has_form_submissions === true
     and project.has_no_dashboard === true:
       agent.suggest({
         text: "Want a dashboard for the leads from your form?",
         confirm_action: () => agent.run_skill("dashboard-from-schema", project)
       });
```

The suggestion engine runs as a low-priority background loop, surfaces in a small chip in the chat composer, and never blocks the user. Default: dismissible, persisted preference per pattern type.

## What ships in Phase 7

### W1 — Shared DB infrastructure
- `server/lib/projects/` — project lifecycle (create, read schema, query)
- SQLite-per-project for free/starter, Supabase provisioning for pro/studio
- `space.data.*` tool surface registered on the agent

### W2 — Dashboard skill pack
- `dashboard/operator-baseline.SKILL.md` — agent template for "given a schema, build an operator dashboard"
- Pre-built widgets: stat cards, table-with-edit, charts, calendar, filtered lists
- Skill auto-binds widgets to the right tables via schema introspection

### W3 — Cross-project suggestion engine
- `_core/agent_suggestions/` module
- Consumes Phase 8 event log + project state
- Surfaces suggestions inline (small chip near chat composer)
- A/B test: dismissed × accepted ratios per suggestion type → tune

## Estimated build: 3-4 weeks across 4 sessions

## Critical design decisions

- **One DB per project, not one global DB** — user's mental model is "my dog-walking project," not "my data warehouse." Supabase per project keeps schemas clean and lets users hand off to engineers later.
- **Suggestions are non-modal** — never a popup. Always a chip the user can ignore.
- **Schema introspection over hardcoded** — the dashboard skill works on ANY schema, not just sitecraft-generated ones.
- **Owner / anon key split mirrors industry standard** — easy to explain and easy to expand to mobile / external API access later.
