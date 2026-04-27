# GitHub App Integration Planning Brief

## Ask

Create a proposal for a long-term GitHub connection model based on a GitHub App, similar in direction to Linear's GitHub integration.

The goal is not to predefine the implementation. The dev team should evaluate the product and technical tradeoffs, propose an architecture, and recommend an MVP path.

## Why This Matters

Users are complaining that the current personal access token flow repeatedly prompts for their macOS Keychain password when the app tries to use GitHub features.

The current token is only used for a small set of features:

- Updating a GitHub repo's About/homepage URL from a project `Prod URL`.
- Fetching latest GitHub Actions status.

We also want a better project-level connection flow. In `ProjectFullPage.tsx`, when a project's Host field is blank and the user selects `github`, the app should guide them into connecting that local project to a GitHub repo instead of just saving a metadata value.

## Current Context

- GitHub auth is currently a user-provided PAT stored as `github_token` in macOS Keychain.
- The app already has project fields for `host`, `repo`, `repo_owner`, `actions_status`, and `actions_run_url`.
- Workspace sync already detects GitHub remotes from local git config and extracts `owner/repo`.
- `ProjectFullPage.tsx` renders `ProjectDetailContent`, where the Host field is edited, so the eventual connection flow likely belongs in shared project-detail logic.

## What The Plan Should Cover

The dev team should decide and document:

- What "Connect GitHub" means in Project Manager.
- Whether the connection is scoped to user, workspace, org, project, or repo.
- Whether we need a backend for GitHub App private-key handling, webhook handling, and installation-token minting.
- How the desktop app communicates with that backend.
- Which GitHub App permissions are needed for the first release versus later releases.
- How to avoid repeated Keychain prompts and surprise background auth prompts.
- How to migrate or deprecate the current PAT setting.
- How existing projects with GitHub remotes are detected and upgraded into connected projects.
- How private repos, missing permissions, disconnected installations, and offline behavior should work.

## Flows To Think Through

The plan should include enough detail for these flows:

- Connecting GitHub globally from Settings or Integrations.
- Installing the GitHub App into a user/org and choosing repo access.
- Selecting `github` from a blank Host field on a project.
- Detecting an existing local GitHub remote and linking it automatically.
- Connecting a project to an existing GitHub repo when no remote exists.
- Creating a new GitHub repo from a local project.
- Disconnecting GitHub globally and per project.
- Recovering when repo access or app permissions are missing.

## Feature Scope To Evaluate

The team should recommend a staged scope. Consider these areas, but do not assume they all belong in MVP:

- Repo selection and per-project repo linking.
- GitHub Actions/check status.
- Explicit repo metadata updates, such as syncing `Prod URL` to the GitHub About URL.
- PR linking and PR state display.
- Task status automation based on PR events.
- GitHub Issues import or sync.
- Comment sync and linkbacks.
- User/account mapping for attribution.
- Preview deployment links from PRs.
- GitHub Enterprise support.

## Non-Negotiable Constraints

- Do not ship a GitHub App private key inside the Tauri desktop app.
- Avoid implicit writes to GitHub. User-visible actions should make writes clear.
- Avoid background flows that repeatedly trigger Keychain prompts.
- Use least-privilege GitHub App permissions and justify anything write-scoped.
- Preserve the current ability to detect local git remotes.
- Make the MVP smaller than Linear. We want a path toward Linear-style behavior, not all of it at once.

## Expected Output

Produce a concise plan with:

- Recommended architecture.
- MVP scope.
- Deferred scope.
- GitHub App permission proposal.
- Backend and webhook requirements.
- Frontend/project-flow changes.
- Data model changes.
- PAT migration strategy.
- Main risks and open questions.

