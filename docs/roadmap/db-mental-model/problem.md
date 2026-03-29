What I’m struggling with is a folder with 108 projects in it

At various stages of random idea to deployed and forgoten to deployed and next steps

Stuff in gitea
GitHub
Cloudflare dns
Vercel deployment
A single hetzner deployment
Some stuff on the dell optiplex

New ideas everyday adding to the mess

What you’re describing isn’t a tooling problem — it’s a portfolio management + lifecycle control problem.

Right now you have:

Fragmented execution environments (Gitea, GitHub, Vercel, Hetzner, Dell, Cloudflare)
No canonical “source of truth” for project state
Continuous idea inflow with no intake gating
No enforced lifecycle (everything becomes “immortal”)

That combination guarantees entropy.

The Fix: Treat This Like a Managed System (Not a Folder)

You need three things:

1) A Project Registry (Single Source of Truth)

Notion/Affine/DB — doesn’t matter. What matters is schema.

Every project gets exactly one row.

Minimum schema (non-negotiable):

{
  "id": "proj_001",
  "name": "AI Newsletter",
  "status": "idea | building | deployed | paused | archived",
  "stage": "v0 | v1 | v2",
  "location": {
    "repo": "github | gitea | none",
    "infra": ["vercel", "hetzner", "pi", "optiplex"],
    "dns": true
  },
  "last_touched": "2026-03-20",
  "next_action": "string",
  "value_score": 1-10,
  "effort_score": 1-10,
  "kill_flag": false
}

If a project is not in this registry → it does not exist.

2) A Strict Lifecycle Model

Right now everything sits in a blob. You need forced transitions.

Lifecycle states:

IDEA → VALIDATING → BUILDING → DEPLOYED → MAINTAINING → (KILL or SCALE)

Key rule:

Every project must have a current state + next action
No “undefined” state allowed
3) A WIP Limit (Critical)

You cannot actively build 108 things.

Hard constraint:

Max 3 active BUILDING projects
Everything else is:
IDEA (not started)
PAUSED
or KILLED

This is straight from Kanban / flow efficiency principles.

What You’re Actually Missing (Root Cause)

You’re operating like:

“Projects are assets”

But in reality:

Projects are liabilities until proven otherwise

Each one carries:

Cognitive load
Infra surface area
Maintenance risk
Opportunity cost
Introduce “Kill Discipline”

You need a weekly kill review.

For each project:

Has it been touched in 14 days?
Does it have a clear next action?
Is the value hypothesis still valid?

If not → archive it aggressively

Not “maybe later”
→ explicitly dead

Visual Model (How Your System Should Look)
Active Layer (tight, controlled)
2–3 BUILDING
3–5 DEPLOYED (with clear metrics)
Cold Storage
PAUSED (with reason)
ARCHIVED (dead)
Intake Queue
IDEAS (uncommitted)
Infrastructure Mapping (Your Specific Stack)

You actually have a classic multi-surface sprawl:

Layer	Problem	Fix
GitHub + Gitea	split repos	pick a primary, mirror optional
Vercel + Hetzner + Dell	scattered deploys	tag each project with one owner environment
Cloudflare DNS	orphaned records	link DNS → project ID
Random folders	no linkage	eliminate as source of truth
Practical First Step (Do This Today)

Don’t overthink tools.

Step 1: Inventory Dump

Create a single table (even CSV):

project_name | repo | deployed_where | status | last_touched | next_action

Fill it for all 108.

Step 2: Force Categorization

Every project must be assigned:

BUILDING (max 3)
DEPLOYED
PAUSED
KILLED

No exceptions.

Step 3: Delete / Archive 30–50%

Yes, actually.

If you don’t, the system won’t stabilize.

If You Want to Go One Level More Advanced

Given how you think (systems + automation), you could:

Build a “Project Control Plane”
Supabase table = registry
n8n workflow:
scans GitHub/Gitea activity
flags stale projects
Cloudflare API:
map DNS → project_id
Vercel API:
map deployments → project_id

Now you have:

Observable project portfolio telemetry

The Mental Shift

Right now:

“I have a lot of projects”

You need to move to:

“I operate a portfolio with throughput constraints”

If you want, I can:

Turn this into a Notion / Affine template
Or generate a Supabase schema + API + n8n workflow
Or help you do a live triage of your 108 projects (this is actually the highest ROI move)