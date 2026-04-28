# Phase 6 — Web / Site Generator (sitecraft import)

> Bring the website-generation patterns from `~/Documents/Claude/sitecraft-ai-fresh` into GiveMeSpace as a skill pack. After this lands, "Build me a landing page for my freelance writing service" produces a deployable Next.js project, hosted on Vercel, in 60 seconds.

## The user-facing experience

```
USER: Build me a landing page for my dog-walking business. Hero, services,
      pricing, contact form. Make it look modern.

AGENT: → opens new "Web Project" space
       → uses `web.create_project(name, framework: "next")` tool
       → drops landing-page-template skill
       → fills hero text, services list, pricing tier cards, form
       → runs `web.preview()` → live iframe of the rendered site
       → asks if user wants to deploy
       → on yes: `web.deploy(target: "vercel")` → Vercel deploy via API

User has a live URL in 90 seconds. No code touched.
```

## What we're stealing from sitecraft-ai-fresh

The user has an existing project at `~/Documents/Claude/sitecraft-ai-fresh/` that's a website generator. Things to port:

1. **Project scaffolds** — Next.js, Astro, plain-HTML starters
2. **Component library** — hero, features, pricing, footer, FAQ, CTA blocks
3. **Theme system** — color palettes, typography presets, layout variants
4. **Asset generation** — logo placeholders, hero images, icon sets
5. **Deployment integrations** — Vercel API, Netlify API, Cloudflare Pages

Skill packs to ship inside GMS:
- `web/landing-pages` — single-page marketing sites
- `web/blog` — Markdown-driven blog with index + post pages
- `web/portfolio` — gallery + case study format
- `web/saas-marketing` — pricing tiers, testimonials, signup forms
- `web/personal-site` — about + contact + project list

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ space.web tool surface (registered alongside space.ui /         │
│ space.browser in Phase 5):                                      │
│                                                                 │
│   web.create_project(name, framework, template)                 │
│   web.add_section(section_type, content)                        │
│   web.set_theme(palette, typography)                            │
│   web.preview()                                                  │
│   web.deploy(target, credentials)                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Project storage: app/L2/<user>/web_projects/<project-id>/       │
│   - package.json, next.config.js, etc.                          │
│   - pages/, components/, public/                                │
│   - sitecraft-template-meta.yaml                                │
│   - .gms-project.yaml (binds back to GMS spaces)                │
│                                                                 │
│ Live preview: server-side npm run dev for the project, exposed  │
│ via a per-project subpath (/web/<project-id>/preview).           │
│                                                                 │
│ Deploy: Vercel API project create + git push, returns vercel.app│
│ URL inline in the chat.                                         │
└─────────────────────────────────────────────────────────────────┘
```

## What ships in Phase 6

### W1 — Skill pack import
- Migrate sitecraft-ai-fresh's templates into `app/L0/_all/mod/_core/web_generator/templates/`
- Each template is a directory with `template.json` (metadata) + the project files
- Build a "template browser" widget — agent calls `web.list_templates()` → user picks → agent populates

### W2 — Server-side project runtime
- `server/lib/web_projects/` — manages per-project subprocesses
- `npm install`/`npm run dev` per project, served via `/web/<id>/preview`
- Process pool with idle reaper (5 min idle → kill)

### W3 — Deploy integrations
- Vercel API integration (token-based, user provides via "Set Vercel token" panel)
- Netlify API alternative
- Auto-detect framework + run correct build command

### W4 — Polish + demos
- Three demo prompts:
  1. *"Build a landing page for my photography business"*
  2. *"Create a personal site with my projects and resume"*
  3. *"Make a SaaS marketing site for my todo app"*
- Each produces a deployed site in <2 minutes.

## Critical design decisions

- **Real Next.js / Astro projects, not simulated** — user can eject and continue editing in their own IDE.
- **Per-user file isolation** — projects live in L2 customware, not shared.
- **Skill-driven, not template-bloated** — fewer, better templates that the agent variably composes, vs hundreds of locked-down themes.
- **Deploy is opt-in** — user provides their own Vercel/Netlify credentials. No proxy through our infrastructure (avoids billing complexity).

## Estimated build: 2-3 weeks across 3 sessions
