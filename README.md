# Todo Agent Loop

Todo Agent Loop is a small Todo List application: an Express + TypeScript API, SQLite persistence via `better-sqlite3`, and a framework-free static frontend. The repository also contains the workflow and MCP pieces used to exercise an agent-driven development loop.

## Run locally

```bash
cd app
npm ci
npm run dev
```

Open <http://localhost:3000>. The database is stored at `app/data/todos.sqlite` and is ignored by Git. To run tests and the build:

```bash
npm test
npm run build
```

## The end-to-end loop

1. **Ticket creation** — The Linear MCP connection created the `Todo Agent Loop` project and nine backlog tickets, including HAM-11 for nonexistent-ID handling.
2. **Ticket fetch + development** — HAM-11 was fetched, moved to In Progress, and implemented on `fix/todo-404`. The route now returns a clear 404 JSON body for unknown PATCH and DELETE IDs, with a regression test.
3. **Status updates** — HAM-11 moved from Backlog to In Progress and then In Review through Linear. It is linked to PR #1, but has not reached Done.
4. **CI** — `.github/workflows/ci.yml` runs on pull requests: checkout, Node setup, `npm ci` in `app/`, tests, and build. The same commands pass locally.
5. **PR review** — `.github/workflows/pr-review.yml` fetches a PR diff, sends it to OpenAI using `OPENAI_API_KEY`, validates an `approve` or `request_changes` JSON verdict, and comments on the PR.
6. **Auto-merge** — `.github/workflows/auto-merge.yml` requires successful CI and an approved review marker before squash-merging into `main`. It cannot invoke this chat’s Linear MCP connection from GitHub Actions, so automatic Linear completion is not currently implemented.
7. **Discovery** — The manually triggered discovery workflow scans `app/` for unused exports, untested routes, TODO/FIXME comments, and missing error handling, then asks OpenAI for prioritization and commits `automation/discovery-report.md`. The local report found missing explicit error handling in `app/src/routes/todos.ts`; no local API key was available, so prioritization used the static fallback.
8. **MCP server** — `mcp-server/` exposes `list_routes`, `get_file`, `explain_symbol`, `get_db_schema`, and read-only `query_todos` over stdio using `@modelcontextprotocol/sdk`.

## Agents and MCP servers

The Codex coding agent performed the implementation and verification; no separate sub-agents were used. The Linear MCP server was used for project/ticket creation and status changes. GitHub tooling was used to publish the public repository and create PR #1. The custom Todo MCP server is the repository’s own local inspection server.

## Connect the custom MCP server

Build it from the repository root:

```bash
npm ci --prefix mcp-server
npm run build --prefix mcp-server
```

For Claude Code, merge `mcp-config/claude-code.mcp.json` into the MCP configuration. For Codex, add `mcp-config/codex.toml.snippet` to its TOML configuration. Both launch exactly:

```text
node mcp-server/dist/index.js
```

Run the server with the repository root as the working directory so it can find `app/src` and `app/data/todos.sqlite`.

## Limitations and next steps

The repository is public at https://github.com/HammadAli08/tic-tac-toe and PR #1 exists. CI passed for PR #1, but the AI review failed because `OPENAI_API_KEY` is not configured, so no review comment or auto-merge occurred and HAM-11 remains In Review. The discovery workflow has only been run locally with its static fallback; Codex and Claude Code client sessions have not been independently captured. `query_todos` intentionally permits only a single `SELECT ... FROM todos` statement, and the route/error analysis is heuristic rather than a full TypeScript data-flow analysis.

Next, I would configure the remote and secrets, push the branch, validate the workflows on a real PR, replace the auto-merge workflow’s MCP limitation with an explicitly authorized Linear API integration, and add stronger parser-based route/symbol analysis and error middleware.
