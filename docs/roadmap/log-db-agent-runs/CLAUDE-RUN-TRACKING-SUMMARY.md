# Claude run tracking: what we built, gaps, and next steps

This note summarizes work on **cost and run telemetry** in project-manager (SQLite + Tauri), comparison with the **anthropic-agent-sdk** test harness (`agent.ts` / `run-db.ts`), and **API payload coverage** relative to Agent SDK stream-json. Use it when planning follow-up enhancements.

---

## Context

- **Workspace DB:** `project-metadata.sqlite` at the configured workspace root (not committed). Holds tasks, projects, and Claude run tables.
- **Claude CLI:** Started with `stream-json`; stdout lines are JSON messages (`system`, `assistant`, `result`, `stream_event`, etc.).
- **Reference harness:** `anthropic-agent-sdk/` uses `agent-runs.sqlite` via `run-db.ts`, recording full SDK messages and `total_cost_usd` / `modelUsage` from the final `result` object.

---

## What we built out (project-manager)

### Persistence and schema

- **`claude_sessions`** — One row per run: task, model, prompt, cwd, pid, status, timestamps, `final_text`, `usage_json` (usage sub-object from the result message when present).
- **`claude_events`** — Normalized timeline per run (`kind`, `raw_type` / `raw_subtype`, `text`, **`raw_json`** for parsed stdout lines).
- **`claude_tool_calls`** — Best-effort tool name + input JSON from stream events.
- **`claude_results`** — Analytics row per completed run: tokens, costs, durations, `stop_reason`, full **`usage_json`**, plus migrated columns **`total_cost_usd`**, **`model_usage_json`**, **`duration_api_ms`**, **`terminal_reason`**.
- **`claude_run_model_usage`** — Per-model breakdown (tokens, cache, `web_search_requests`, `cost_usd`, context window, max output) from `result.modelUsage`.

### Correctness fix (root issue)

- Previously only the nested **`usage`** object was kept at completion; the SDK exposes **`total_cost_usd`** and **`modelUsage`** on the **`result` message root**.
- Runs now store the **full last `result` JSON** in memory and project **`project_sdk_result`**: API total cost, session model fallback for pricing, `modelUsage` → child table + JSON blob.

### Backfill

- On DB open, **`migrate_claude_tracking`** adds new columns/tables and runs **`backfill_claude_results_from_events`**: repairs older `claude_results` rows by re-parsing **`claude_events.raw_json`** for `kind = 'result'`.

### API surface (Tauri)

- `get_claude_session_events` — includes **`raw_json`** per event.
- `get_claude_session_result` — extended result row (new columns); orders by `ts DESC` for latest.
- `get_claude_session_model_usage` — per-model rows for a run.
- `get_claude_cost_totals_by_task` — `SUM(COALESCE(total_cost_usd, cost_usd))` per task for rollups.

### UI

- **Task detail (Claude panel):** Cost priority `total_cost_usd` → `cost_usd` → token **estimate**; labels **API total** / **API** / **Estimate**; wall vs **API** duration; **terminal** reason; **per-model usage** table.
- **Task table:** **Claude $** column fed by task-level cost totals.
- **Completed event payload** includes `total_cost_usd` and `model_usage` for live listeners.

### Reference sample in repo

- `agent-sdk-payloads.ndjson` in this folder captures example stream payloads (currently dominated by a **`system` / `init`** sample); fuller streams live in `anthropic-agent-sdk/agent-sdk-payloads.ndjson`.

---

## What we did not build out

### Init (`system` / `init`) — not promoted to columns

Only `cwd` and `model` overlap **`claude_sessions`**. The following stay **only inside `claude_events.raw_json`** (if that line was stored), not first-class fields:

- `session_id`, `tools[]`, `mcp_servers[]`, `permissionMode`, `slash_commands[]`, `apiKeySource`, `claude_code_version`, `output_style`, `agents[]`, `skills[]`, `plugins[]`, init `uuid`, `fast_mode_state`.

### `result` message — still not first-class

Recoverable from **`raw_json`** or partially from **`usage_json`** / **`model_usage_json`**, but **no dedicated columns** for:

- `subtype` (e.g. success vs error) vs app-level `status`
- `is_error`
- SDK **`duration_ms`** on the result object (vs wall-clock duration we store)
- `session_id`, result `uuid`
- `permission_denials[]`
- `fast_mode_state` on the result

Nested **`usage`** fields not split out (they remain in **`usage_json`**): e.g. `server_tool_use` (web search/fetch counts at usage level), `cache_creation` TTL breakdown (`ephemeral_5m` / `ephemeral_1h`), `service_tier`, `inference_geo`, `iterations`, `speed`.

### `assistant` messages — lossy normalization

Transcript uses **`assistant-text`** and short tool labels; we do **not** store structured:

- Message `id`, per-turn `model`, full `content` blocks (tool_use, thinking, etc.)
- Per-assistant-turn `usage`, `stop_reason` / `stop_sequence` / `stop_details`, `context_management`
- `parent_tool_use_id`, `session_id`, `uuid` as columns

### Operational / product gaps

- **Task list costs** refresh when `loadTasks` runs; navigating back from a task may not refresh totals unless the parent refetches tasks.
- **No export** of run history to NDJSON/CSV from the app.
- **No retention / pruning** policy for `raw_json` (storage growth on long runs).

---

## Possible next enhancements (for consideration)

1. **Session identity** — Add `session_id` (and optionally `claude_code_version`, `api_key_source`) to **`claude_sessions`** on first `system`/`init` parse for joins and support debugging.

2. **Result fidelity** — Columns or JSON blobs for `result.subtype`, `is_error`, `permission_denials`, SDK `duration_ms`, `fast_mode_state`, `uuid`; or a single **`result_json`** column mirroring the full last result.

3. **Usage analytics** — Extract `service_tier`, `inference_geo`, and **`server_tool_use`** counts into columns or a small **`usage_facts`** table for reporting without parsing `usage_json`.

4. **Assistant / tool archive** — Either rely on **`raw_json`** only, or add **`claude_sdk_messages(run_id, seq, payload_json)`** (like `agent-runs.sqlite` `sdk_messages`) for guaranteed full-fidelity replay.

5. **Init capabilities** — Persist `tools` / `mcp_servers` as JSON on the session row to know what a run could use without scanning events.

6. **Refresh semantics** — After `claude-run:completed`, have the app refresh task list costs (or emit a dedicated event) so **Claude $** stays in sync without a full navigation.

7. **Privacy / size** — Option to omit or truncate **`raw_json`** for non-result events, or vacuum old runs, if DB size becomes an issue.

8. **Parity checks** — Occasional compare of one run’s `claude_results` row to **`agent-runs.sqlite`** for the same prompt to validate cost/token alignment after CLI/SDK updates.

---

## Files to read when extending this

| Area | Location |
|------|-----------|
| Migrations, projection, backfill | `project-manager/src-tauri/src/commands.rs` (`migrate_claude_tracking`, `project_sdk_result`, `persist_session_completion`, `persist_claude_model_usage_breakdown`, `backfill_claude_results_from_events`) |
| Stream handling | Same file: `normalize_claude_event`, `spawn_claude_stream_threads`, `spawn_claude_wait_thread` |
| Reference DB schema | `anthropic-agent-sdk/run-db.ts` |
| Types / UI | `project-manager/src/types.ts`, `TaskFullPage.tsx`, `TaskTable.tsx` |

---

*Last updated: written as a working roadmap note; adjust as the CLI/SDK payload shape evolves.*
