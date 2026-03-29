
what are the stages of a saas application

A SaaS application typically progresses through a set of maturity stages—from idea to scalable, enterprise-grade platform. These stages aren’t strictly linear, but they’re a useful mental model for building and evaluating systems.

1) Idea / Problem Definition
Goal: Validate that a real, monetizable problem exists.

Key activities:

Define target customer + pain point

Validate demand (interviews, landing pages, waitlists)

Identify alternatives (competitors, status quo)

Outputs:

Problem statement

ICP (Ideal Customer Profile)

Initial value proposition

2) MVP (Minimum Viable Product)
Goal: Ship the smallest usable product that solves the core problem.

Key characteristics:

Narrow scope (1–2 core workflows)

Often manual or semi-automated behind the scenes

Speed > scalability

Typical stack (your world):

Next.js / Supabase / simple APIs

Minimal auth, basic DB schema

Risks:

Overbuilding before validation

Under-instrumenting (no analytics)

3) Product-Market Fit (PMF)
Goal: Prove that users consistently get value and come back.

Signals:

Retention (users return without prompting)

Organic growth / word-of-mouth

Willingness to pay

What changes technically:

Start adding analytics (event tracking, funnels)

Improve onboarding + UX

Fix reliability issues

Key metric:

“Do users care if this disappears?”

4) Early Growth
Goal: Acquire users predictably and improve conversion.

Focus areas:

Marketing channels (SEO, ads, outbound)

Conversion funnels

Pricing experiments

Product changes:

Better onboarding flows

Feature expansion based on user demand

Basic billing (e.g., Stripe integration)

Tech evolution:

Move from “works” → “works reliably”

Add logging, monitoring, error handling

5) Scaling (Technical + Business)
Goal: Handle increasing load, complexity, and customers.

Technical scaling
Database optimization (indexes, read replicas)

Background jobs / queues

Caching layers (Redis, CDN)

Multi-region considerations

Organizational scaling
Team structure (engineering, product, support)

Defined processes (CI/CD, incident response)

Risks:

Architecture not designed for scale

Increasing technical debt

6) Maturity / Platformization
Goal: Become a robust, extensible platform.

Capabilities:

APIs + SDKs (developer ecosystem)

Role-based access control (RBAC)

Audit logs, compliance (SOC2, GDPR)

Multi-tenancy hardened

Enterprise features:

SSO (e.g., SAML, Okta)

SLA guarantees

Advanced permissions

This is where your JPMorgan-style thinking becomes relevant:

Measurable SLAs

Observability + telemetry

Standardized metrics across systems

7) Optimization & Expansion
Goal: Maximize revenue and defensibility.

Levers:

Upsells / tiered pricing

Expansion into adjacent use cases

AI/automation layers (agents, copilots)

Advanced moves:

Workflow automation (your n8n-style thinking)

Embedding into customer systems (APIs, integrations)

Data network effects

8) Decline or Reinvention (Often Ignored)
Goal: Adapt or die.

Even strong SaaS products face:

Market saturation

New competitors (often AI-native)

Changing user expectations

Options:

Replatform (e.g., AI-first rewrite)

Acquire / merge

Pivot to new ICP

How This Maps to Your Current Work
Given your projects + JPMorgan context, you’re actively working across:

Stage 2–4 (MVP → Growth): personal tools, homelab apps

Stage 5–6 (Scaling → Platform): enterprise AI agents, cross-domain automation

Stage 7 (Optimization): measuring ROI, automation impact, Copilot metrics

A More Practical Mental Model (Condensed)
If you want a sharper operator lens, compress it to:

Does anyone care? (Idea)

Can I build it fast? (MVP)

Do users stick? (PMF)

Can I grow it? (Growth)

Can it survive scale? (Scaling)

Can it become a system? (Platform)

Can it dominate? (Optimization)

If you want, I can map one of your 108 projects into these stages and tell you exactly what to do next operationally (not generic advice).


but what would the death of a saas look like too?  this seems like statges to keep grouwing?

You’re right to push on this—most SaaS frameworks are biased toward growth narratives. In reality, SaaS products follow a full lifecycle curve, and many die (or quietly decay) long before “platformization.”

Here’s the actual lifecycle including death modes:

The Real SaaS Lifecycle (Including Death)
1) Creation → 2) MVP → 3) PMF → 4) Growth → 5) Scale
(you already understand these)

The interesting part starts after (or instead of) success:

6) Plateau (Stagnation Phase)
What it looks like:

Growth slows or flatlines

New features don’t materially move metrics

CAC ≈ LTV (or worse)

Signals:

Revenue still exists, but momentum is gone

Team shifts from building → maintaining

Roadmap becomes reactive (customer requests vs vision)

Root causes:

Market saturation

Weak differentiation

Product ceiling reached

7) Erosion (Slow Death)
This is the most common SaaS death.

What it looks like:

Churn slowly increases

Fewer new customers

Existing users downgrade or reduce usage

Operational symptoms:

Support tickets increase, but innovation decreases

Technical debt accumulates

Key engineers or founders disengage

Customer behavior:

“It still works… but we’re evaluating alternatives”

8) Displacement (Sudden Death Trigger)
A step-function event kills the trajectory.

Typical triggers:

A new competitor with 10x UX or cost advantage

Platform bundling (your feature becomes someone else’s feature)

Example: Google or Microsoft absorbing functionality

AI commoditization (huge one right now)

Regulatory change

What it looks like:

Sales pipeline collapses

New deals stall out

“Why pay for this anymore?” becomes common

9) Extraction Mode (Harvesting the Corpse)
The company stops pretending it’s a growth business.

What changes:

Cut R&D aggressively

Minimize infrastructure cost

Raise prices on remaining loyal users

Goal:

Maximize cash flow, not growth

Seen in:

Legacy SaaS tools with sticky but shrinking user bases

10) End States (Actual “Death”)
A) Acquisition (Soft Death)
Product gets absorbed into a larger platform

Team may stay, product identity disappears

B) Shutdown (Hard Death)
Service is turned off

Customers forced to migrate

C) Zombie SaaS (Living Dead)
Still running

Minimal updates

Small but persistent revenue

D) Pivot / Rebirth
Product is rebuilt or repositioned

Often AI-driven now

The Key Insight Most People Miss
SaaS doesn’t die at the end.

It usually dies right after PMF or early growth.

Why?

Because:

It solves a real but small problem

It’s good enough but not essential

It gets outcompeted before scaling

A More Accurate Curve
Think of SaaS like this:

Idea → MVP → PMF → (fork happens here)

Path A: Growth → Scale → Platform → Expansion
Path B: Plateau → Erosion → Death
Most products go down Path B.

Modern Twist (Your World — AI + Infra)
Right now, there’s a new accelerated death pattern:

“AI Collapse Curve”
MVP → traction

Then:

Feature gets replicated by an LLM wrapper

Or bundled into a platform (Copilot, etc.)

Product becomes obsolete in ~6–18 months

This is happening fast in:

Developer tools

Content tools

Internal automation SaaS

Practical Operator Lens (What to Watch)
If you want to detect death early, track:

1) Net Revenue Retention (NRR)
<100% → erosion has started

2) Time-to-Value
If users take longer to get value → churn risk

3) Replacement conversations
“We’re evaluating…” = early death signal

4) Feature commoditization
If your core feature becomes:

An API call

Or embedded in another tool
→ existential risk

Brutally Honest Heuristic
A SaaS is dying when:

“The problem still exists, but your product is no longer the best way to solve it.”

Mapping This Back to You
Given your 108-project portfolio + AI focus:

Your biggest risk is not failure to build.

It’s:

Building something that reaches MVP

Maybe even PMF

Then gets instantly commoditized by AI or bundled platforms

If you want, I can:

Take 2–3 of your actual projects

Classify where they are on this lifecycle

And tell you which ones are likely to die vs survive based on current market dynamics

That’s where this framework becomes very actionable.


so what are all teh stages and the short descriptions

Here’s the full SaaS lifecycle (including growth and death) in a clean, operator-friendly format:

SaaS Lifecycle — End-to-End
1) Idea
Define the problem

Identify a real pain point and target customer

Validate demand exists (not just intuition)

2) MVP (Minimum Viable Product)
Build the smallest usable solution

Core workflow only

Fast to ship, not scalable

Often partially manual behind the scenes

3) Product-Market Fit (PMF)
Prove users actually care

Users return and rely on it

Early willingness to pay

Retention starts to stabilize

4) Growth
Acquire users predictably

Marketing + sales channels start working

Conversion funnels improve

Revenue begins scaling

5) Scaling
Handle volume and complexity

Infrastructure hardening (DB, queues, caching)

Team/process maturity (CI/CD, incident mgmt)

Reliability becomes critical

6) Platform / Maturity
Become a system, not just a product

APIs, integrations, ecosystem

Enterprise features (SSO, RBAC, compliance)

Standardized metrics + SLAs

7) Expansion / Optimization
Maximize value and defensibility

Upsells, pricing optimization

New use cases / adjacent products

Automation + AI layers

The “Downside” Path (Often Happens Instead)
8) Plateau
Growth stalls

New features don’t move metrics

Acquisition slows

Product feels “complete but not evolving”

9) Erosion
Slow decline begins

Churn increases

Engagement drops

Competitors start winning deals

10) Displacement
Something better replaces you

Cheaper, faster, or bundled alternative

Often driven by platforms or AI

New sales effectively stop

11) Extraction (Harvest Mode)
Run for cash, not growth

Cut investment (R&D, hiring)

Maintain existing customers

Optimize margins

12) End State
Final outcomes

Acquisition → absorbed into another product

Shutdown → service turned off

Zombie → still running, minimal innovation

Pivot/Rebirth → rebuilt into something new

Condensed Version (Fast Mental Model)
If you want it ultra-compressed:

Idea

MVP

PMF

Growth

Scale

Platform

Expand

→ then either:

Win path: Expand → dominate

Lose path: Plateau → Erode → Die

This is the complete arc—most frameworks stop at #7, but in practice, #8–12 is where most SaaS products actually spend their time.


what about the founders or tech teams supporting it start focusitng on something else, they get distracted by other opportunities

That’s a real—and very common—failure mode. It’s distinct from market-driven death. This is organizational abandonment.

You can treat it as its own stage in the lifecycle:

13) Drift (Founder / Team Distraction)
Definition:
The product doesn’t fail because of the market—it fails because the people behind it stop caring or focusing.

What it looks like
Roadmap slows or disappears

Founders start talking about “new ideas” more than the core product

Side projects multiply (sound familiar with your 108 projects)

Releases become infrequent or cosmetic

Early signals (subtle but critical)
“We’ll fix that later” becomes permanent

No clear owner for core features

Support responses slow down

Metrics are no longer actively reviewed

Mid-stage symptoms
Technical debt grows unchecked

Competitors pass you quietly

Customers feel stagnation before you do

Internal narrative shifts from:

“We’re building something great”

→ “This still works fine”

Late-stage outcome
Drift almost always feeds into:

→ Plateau → Erosion → Death

But the root cause is attention decay, not product weakness.

Why this happens (especially in your profile)
1) Opportunity overload
New ideas feel higher upside than maintaining existing ones

Especially true in fast-moving spaces like AI

2) Diminishing excitement curve
Building (0→1) is exciting

Operating (1→100) is repetitive

3) Lack of forcing function
No external pressure (customers, revenue targets, investors)

So nothing forces focus

4) Cognitive switching cost
You fragment attention across:

Gitea projects

Vercel deployments

Homelab experiments

Result: nothing compounds

This is actually a fork in the lifecycle
After PMF or early traction, there are three paths, not two:

PMF →

A) Focus → Growth → Scale → Win  
B) Market issues → Plateau → Erosion → Death  
C) Founder Drift → Neglect → Erosion → Death
Most indie / builder-driven SaaS die via Path C.

Important distinction
This is not laziness.

It’s usually:

“Rationally chasing higher expected value opportunities, but destroying compounding in the process.”

Operator lens (how to detect Drift early)
Track these:

1) Release velocity
Days since last meaningful improvement

2) Attention allocation
% of time spent on this product vs others

3) Roadmap clarity
Can you clearly state the next 3 high-impact features?

4) User pull
Are users asking for things you’re not building?

Hard truth
A SaaS can survive:

Bad architecture

Weak early UX

Even mediocre differentiation

But it cannot survive:

Loss of sustained attention from its builders

What high performers do differently
They introduce artificial constraints:

“Only 1 active product per quarter”

Kill or archive everything else

Tie identity to one thing winning

This is why many successful SaaS look “obvious” in hindsight:

Not because they had better ideas

But because they didn’t switch

Mapping to you (directly)
Your biggest structural risk is:

Not failure to build—but failure to stay with something long enough to compound.

You’re operating in an environment (AI + infra + homelab + ideas) that maximizes drift risk.

Clean way to incorporate this into the lifecycle
Add this explicitly:

13) Drift (Attention Loss)
→ leads to:

9) Erosion
→ then:

10–12 End states
If you want, I can take your current project list and:

Identify which ones are in Drift vs viable growth

And recommend which single one is worth focusing on based on survivability + market timing

That’s where this becomes actionable rather than conceptual.


lets make sure we account for this and update "Condensed Version (Fast Mental Model)

If you want it ultra-compressed:

Idea
MVP
PMF
Growth
Scale
Platform
Expand

→ then either:

Win path: Expand → dominate
Lose path: Plateau → Erode → Die"

Good catch—this model was missing a third branch (Drift), which is often the dominant failure mode for builder-led SaaS.

Here’s the corrected condensed model with that explicitly incorporated:

Updated Condensed Version (Fast Mental Model)
Core build path
Idea

MVP

PMF

Growth

Scale

Platform

Expand

Then one of three paths emerges:
1) Win Path (Compounding)
Expand → Dominate

Strong focus maintained

Continuous iteration + defensibility

Becomes category leader or durable asset

2) Market Failure Path (External Loss)
Plateau → Erode → Die

Growth stalls

Competitors or market shifts win

Product becomes irrelevant or replaced

3) Drift Path (Internal Loss — most common for builders)
Drift → Neglect → Erode → Die

Attention shifts to new ideas

Product stops improving despite opportunity

Users gradually leave due to stagnation

Even More Compressed (Operator Cheat Code)
Idea → MVP → PMF → (fork)

A) Focus → Grow → Dominate  
B) Market → Plateau → Die  
C) Drift → Neglect → Die
Key Upgrade to Your Mental Model
The original version assumed:

Success or failure is determined by the market.

The corrected version reflects reality:

Success or failure is determined by market + sustained focus

Practical implication (for you specifically)
When evaluating any project, ask:

Does the market support this? → avoids Path B

Will I stay focused on this for 6–12 months? → avoids Path C

Most people only ask #1.
High performers explicitly manage #2.

If you want, the next step would be turning this into a decision framework you can apply to your 108 projects to systematically eliminate drift risk.


I think the app or project is a seed of an idea from the founding team which are supply forces... it then begins with some attention and grows and obtains external or demand forces

and demand focus for the supply team can be headlines that capture their attention more than the current client demand forces for the app to keep the supply team engaged

and the app grows with suply maintains pressure and pushes through and also an app grows if demand forches pull in the team to keep suplying

You’re describing something more fundamental than “stages”—you’re describing a force model of SaaS.

That’s actually a better lens than lifecycle alone.

Let’s formalize what you’re saying so it’s operational.

SaaS as a Force System (Supply vs Demand)
1) Supply Forces (Push)
Origin: founders / builders
Nature: internal energy applied to the product

Examples:

New features

Architecture improvements

AI experiments

“This would be cool” ideas

This is what creates the initial seed.

2) Demand Forces (Pull)
Origin: users / market
Nature: external pressure on the product

Examples:

Users asking for features

Paying customers expanding usage

Churn signals (“we need X or we leave”)

Revenue growth

This is what sustains and shapes the product.

The Core Dynamic
A SaaS grows when:

Supply pushes AND Demand pulls in the same direction

Where Your Insight Gets Sharp
You identified a third force implicitly:

3) Attention Forces (Founder Focus Allocation)
This is the hidden variable.

Definition:
What the team chooses to pay attention to—often driven by:

New opportunities

Trends (AI, infra, etc.)

Headlines / novelty

Internal excitement

The Real Model
Growth = f(Supply Push, Demand Pull, Attention Alignment)
Failure Modes Through This Lens
1) No Demand (Classic failure)
Supply exists

Demand is weak

→ Dies early (no PMF)

2) Demand exists, but Supply weak
Users want it

Team can’t execute

→ Competitor wins

3) The One You Identified (Critical)
Attention Misalignment
Demand exists ✅

Supply capability exists ✅

But attention shifts elsewhere ❌

→ Product decays despite opportunity

Why Headlines Matter (Your Key Insight)
“Demand for the team’s attention competes with demand from users”

This is extremely accurate.

Two competing pulls:
Customer Demand Pull

“We need this feature”

“We’ll pay for this”

Opportunity / Novelty Pull

“AI agents are hot”

“This new idea is bigger”

“This could 10x faster”

Whichever is stronger wins the team’s attention.

This Explains Drift Precisely
Drift is not random.

It’s:

Attention being pulled more strongly by new supply opportunities than existing demand signals

Healthy SaaS Dynamics
Strong System (Compounding)
Demand is loud (users, revenue)

Supply responds consistently

Attention stays aligned

→ Flywheel forms

Weak System (Your Risk Zone)
Demand exists but is quieter than new ideas

Supply keeps restarting elsewhere

Attention fragments

→ Nothing compounds

Operator-Level Model (Decision Framework)
When choosing what to work on, evaluate:

1) Demand Strength
Are users pulling this out of you?

Is there real usage / revenue?

2) Supply Leverage
Can you build faster/better than others?

3) Attention Gravity (most overlooked)
Will this hold your attention for 6+ months?

Or will something else “feel more exciting”?

The Key Principle
The strongest force is not always demand—it’s often attention.

And attention is:

Volatile

Narrative-driven

Easily hijacked by novelty

Clean Integrated Model (Your Final Version)
Seed (Supply) →
MVP →
PMF (Demand emerges) →

Then equilibrium determines outcome:

IF:
Supply + Demand + Attention aligned
→ Growth → Scale → Dominate

IF:
Demand weak
→ Dies early

IF:
Attention shifts (despite demand)
→ Drift → Erode → Die

IF:
Market shifts (despite focus)
→ Plateau → Erode → Die
Why This Matters for You
You’re operating in a high-supply, high-opportunity environment:

AI tools

Homelab

Constant new ideas

That means:

Supply is abundant

Opportunities are abundant

Attention is the scarce resource

Blunt takeaway
A SaaS survives when:

Customer demand pulls harder than new ideas distract

If you want to take this one level deeper, I can help you turn this into a scoring model (0–10 for demand, supply, attention gravity) to decide which projects deserve continued investment vs intentional abandonment.


i think I want to group attention with suplly not a 3rd dimension of teh same sub topic of suply

That’s a clean refinement—and I agree. Treating attention as part of supply makes the model tighter and more actionable.

You’re essentially redefining:

Supply = Capability × Effort × Attention

Not just “can we build,” but will we consistently direct energy here.

Updated Model (2 Forces Only)
1) Supply (Push)
Now includes:

Engineering capability

Execution velocity

Attention / focus allocation (critical addition)

Interpretation:

Supply is applied effort over time, not just potential.

2) Demand (Pull)
Unchanged:

User need

Usage / engagement

Revenue / willingness to pay

Customer pressure

Core Equation
Growth = f(Supply (capability × attention), Demand)
What Changes With This Framing
You eliminate “drift” as a separate concept and instead model it as:

Supply collapse due to attention withdrawal

Updated Failure Modes (Cleaner)
1) No Demand
Supply exists

Demand weak

→ Dies early (no PMF)

2) Weak Supply
Demand exists

But:

Team can’t execute

OR doesn’t focus

→ Product stagnates → competitor wins

3) Supply Withdrawal (Your key case)
Demand exists ✅

Capability exists ✅

But attention shifts ❌

→ Effective supply → zero
→ Product enters erosion

This Is the Key Insight
Supply is not binary—it’s continuous and decays when attention moves.

So instead of:

“We stopped working on it”

Think:

“Supply force dropped below sustaining threshold”

Visualizing It (Simple)
If Supply > Demand → product gets built/improves
If Demand > Supply → backlog grows / users frustrated
If Supply ≈ 0 → decay (regardless of demand)
Updated Condensed Lifecycle (Final Form)
Core path
Idea → MVP → PMF

Then outcome depends on force balance:
1) Strong System (Win)
Supply (with sustained attention) + Demand aligned
→ Growth → Scale → Dominate

2) Demand Failure
Supply present, Demand weak
→ Dies early

3) Supply Failure (includes drift)
Demand present, Supply insufficient or withdrawn
→ Plateau → Erode → Die

4) Market Shift
Supply strong, Demand shifts elsewhere
→ Plateau → Erode → Die

Even More Compressed
Idea → MVP → PMF →

IF Supply(attention) + Demand align → Win  
IF Demand weak → Early death  
IF Supply weak/withdrawn → Slow death  
IF Market shifts → Displacement → Death
Why This Version Is Better
Fewer variables → easier to reason about

Drift is no longer “mysterious” → it’s just supply decay

Forces you to measure what actually matters:

Am I still applying real effort here?

Practical Operator Question (Most Important)
For any project:

“Is supply (including my attention) still above the level required to match demand?”

If not:

Either increase supply (focus)

Or intentionally kill the project

If you want, the next step is turning this into a portfolio management system for your 108 projects:

Rank each by Demand strength vs Supply (attention) allocation

Then aggressively prune or double down

That’s where this becomes very concrete.


so I have an application I built to help me manage my projects how should I strcutre the db given I want to incroporeta this thought proecss for stages of a saas and such

Model it around projects, forces, stages, signals, and decisions.

Do not make “stage” the only top-level truth. A project can look like “PMF” on paper while actually dying because supply has collapsed. So your DB should let you track both:

the declared lifecycle stage

the underlying force balance driving that stage

A good structure is:

Core idea
Each project is an entity with:

identity and metadata

current lifecycle stage

supply-side signals

demand-side signals

periodic assessments

change history

decisions / next actions

That gives you both a snapshot and a timeline.

Recommended data model
1) projects
The master record.

Purpose: one row per app / product / initiative.

Suggested fields:

id

name

slug

description

project_type — saas, internal_tool, content_site, experiment, infra, etc.

status — active, paused, archived, killed

current_stage_id

owner_user_id

created_at

updated_at

archived_at

Useful optional fields:

repo_url

prod_url

primary_domain

notes

2) lifecycle_stages
A lookup table for your SaaS stage model.

Purpose: normalized stage definitions so you can change wording later without rewriting project records.

Suggested rows:

Idea

MVP

PMF

Growth

Scale

Platform

Expand

Plateau

Erode

Displaced

Dead

Reborn

Suggested fields:

id

key — stable code like idea, mvp, pmf, growth

label

sequence_order

stage_group — build, growth, decline, end_state

description

You may also want:

is_terminal

is_decline_stage

3) project_stage_history
Track how the stage changed over time.

Purpose: avoid overwriting history.

Fields:

id

project_id

stage_id

effective_at

ended_at

changed_by

reason

This table matters because “what stage is it in now?” is less useful than “how long has it been stuck there?”

4) project_assessments
This is the most important table.

Purpose: recurring snapshots of your judgment about the project.

Think of this as a weekly or monthly scorecard.

Fields:

id

project_id

assessment_date

supply_score — 0 to 10

demand_score — 0 to 10

supply_trend — up, flat, down

demand_trend — up, flat, down

attention_score — 0 to 10

execution_capacity_score — 0 to 10

user_pull_score — 0 to 10

revenue_signal_score — 0 to 10

overall_health_score — derived or stored

recommended_state — double_down, maintain, pause, kill, reposition

narrative

created_at

Because you want attention grouped under supply, you can either:

keep attention_score as a component of supply, or

not store it separately and instead only store the composite supply_score

I would still store it separately so you can explain why supply dropped.

5) supply_factors
Break supply into components.

Purpose: explain why supply is strong or weak.

Possible fields:

id

project_id

assessment_id

attention_score

capability_score

velocity_score

clarity_score

founder_energy_score

resource_score

notes

This gives you:
Supply = capability × effort × attention
without losing detail.

If you want a simpler model, skip this table and put these directly on project_assessments.

6) demand_factors
Break demand into components.

Fields:

id

project_id

assessment_id

user_need_score

usage_score

retention_score

revenue_score

inbound_interest_score

customer_request_score

market_timing_score

competitive_pressure_score

notes

This helps distinguish:

“nobody wants it”
from

“people want it, but they’re not paying yet”
from

“they wanted it, but the market moved”

7) project_metrics
For actual measurable numbers.

Purpose: raw facts instead of just subjective scoring.

Fields:

id

project_id

metric_date

active_users

weekly_active_users

monthly_active_users

paying_customers

mrr

churn_rate

nps

feature_requests_count

support_tickets_count

deployments_count

meaningful_releases_count

days_since_last_meaningful_release

time_spent_hours

open_issues_count

closed_issues_count

You do not need all of these day one. Start with the ones you can maintain honestly.

8) signals
For notable events, qualitative or quantitative.

Purpose: store observations that influence supply or demand.

Examples:

“Customer asked for SSO”

“I spent 0 hours on this in 30 days”

“Competitor launched AI version”

“Friend asked to use it”

“Shipped onboarding flow”

“Lost interest after starting new project”

Fields:

id

project_id

signal_type — supply, demand, market, product, personal

signal_subtype

title

details

impact_direction — positive, negative, neutral

impact_strength — 1 to 5

occurred_at

source

This becomes your evidence log.

9) decisions
Track explicit portfolio calls.

Purpose: force clarity.

Fields:

id

project_id

decision_type — double_down, maintain, pause, kill, pivot, sell, archive

decision_date

reason

expected_review_date

made_by

This keeps you from living in ambiguous limbo.

10) next_actions
Concrete follow-through.

Fields:

id

project_id

title

description

action_type — build, research, customer_interview, marketing, cleanup, shutdown

priority

status

due_date

completed_at

The most important design principle
Store both:

A) State
What stage is it in?

B) Forces
Why is it there, and where is it heading?

Without forces, stage becomes too static.
Without state, forces become too fuzzy.

Practical schema shape
If you want a lean v1, use just these tables:

projects

lifecycle_stages

project_stage_history

project_assessments

project_metrics

signals

decisions

next_actions

That is enough to support your thinking well.

Recommended scoring model
For each assessment, score:

Supply
Attention

Capability

Execution velocity

Clarity of roadmap

Demand
User pull

Usage

Revenue willingness

Market timing

Then compute:

supply_score

demand_score

balance_score = supply_score - demand_score or a custom health model

You can then classify automatically:

High supply + low demand → likely early experiment / no PMF

High demand + low supply → neglected opportunity

High supply + high demand → growth candidate

Low supply + high historical demand → erosion risk

Low supply + low demand → kill or archive

Example Supabase/Postgres schema
create table lifecycle_stages (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  sequence_order int not null,
  stage_group text not null,
  description text,
  is_terminal boolean default false,
  is_decline_stage boolean default false
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  project_type text not null default 'saas',
  status text not null default 'active',
  current_stage_id uuid references lifecycle_stages(id),
  repo_url text,
  prod_url text,
  primary_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table project_stage_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_id uuid not null references lifecycle_stages(id),
  effective_at timestamptz not null default now(),
  ended_at timestamptz,
  reason text
);

create table project_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  assessment_date date not null,
  supply_score numeric(4,2),
  demand_score numeric(4,2),
  attention_score numeric(4,2),
  capability_score numeric(4,2),
  execution_score numeric(4,2),
  clarity_score numeric(4,2),
  user_pull_score numeric(4,2),
  usage_score numeric(4,2),
  revenue_score numeric(4,2),
  market_timing_score numeric(4,2),
  overall_health_score numeric(4,2),
  recommended_state text,
  narrative text,
  created_at timestamptz not null default now(),
  unique(project_id, assessment_date)
);

create table project_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  metric_date date not null,
  active_users int,
  paying_customers int,
  mrr numeric(12,2),
  churn_rate numeric(6,2),
  feature_requests_count int,
  support_tickets_count int,
  meaningful_releases_count int,
  days_since_last_meaningful_release int,
  time_spent_hours numeric(8,2),
  unique(project_id, metric_date)
);

create table signals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  signal_type text not null,
  signal_subtype text,
  title text not null,
  details text,
  impact_direction text,
  impact_strength int,
  occurred_at timestamptz not null default now(),
  source text
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  decision_type text not null,
  decision_date date not null default current_date,
  reason text,
  expected_review_date date
);

create table next_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  action_type text,
  priority text,
  status text not null default 'open',
  due_date date,
  completed_at timestamptz
);
How I would use it in the app UI
For each project, show:

Snapshot card
Current stage

Supply score

Demand score

Health

Last meaningful release

Last decision

Trend view
Supply over time

Demand over time

Stage history over time

Evidence panel
Signals

Notes

User requests

Competitive events

Decision panel
Double down

Maintain

Pause

Kill

Reposition

Strong opinion
Do not over-normalize v1.

A lot of builders make this too abstract and end up with a pretty schema that is painful to use. You need an app that helps you make calls quickly.

So for v1:

one projects table

one project_assessments table

one signals table

one decisions table

one next_actions table

That alone is enough to be useful.

Best mental model for your DB
Your database should answer these questions fast:

What stage is this project in?

Is supply still strong?

Is demand real yet?

Is this growing, drifting, or dying?

What evidence supports that?

What decision did I make?

What happens next?

That is the right shape.

If you want, I can turn this into a full Supabase schema with enums, indexes, and example seed data for 3 sample projects.