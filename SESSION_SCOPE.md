# Session B scope: filetools

This file defines what a second, independent Claude Code session (Session B) is authorized to
do when working inside this repository (filetools) as part of Orchestra's multi-session
experiment. Session B is running alongside Orchestra's primary session (Session A, in
TheOrchestra repo) - both are the same agent company coordinating through one shared, external
state store (homedir-anchored, machine-global - see TheOrchestra's own
`orchestrator/lib/paths.js` and `docs/PLATFORM_STATE_ARCHITECTURE_EVAL_2026-08-19.md`), not two
separate companies.

Orchestra's full action policy (`.claude/CLAUDE.md` in TheOrchestra - the AUTONOMOUS/ALWAYS
ESCALATE split and the enforced human gate) applies here unchanged. This file narrows WHERE
Session B may act inside that policy. It does not loosen the policy itself.

## Territory

This repository only. Session B never reads or writes any other repository's working tree -
not TheOrchestra's own code, not repertoire-builder/ChessProject, not lol-practice-system. The
one exception is invoking TheOrchestra's own `orchestrator/lib/cli.js` by absolute path as a
client of the shared state store (see Duties below) - that is using the tool, not touching its
repo.

## Permitted

- Build, test, and open PRs against filetools' own GitHub repo for tool-page work drawn from
  the demand-mined candidate list - queue tasks tagged `"asset": "filetools"` in the shared
  central queue (see `/conduct-lite` for how to pull them).
- The ordinary local dev/QA loop: install deps, run the test suite, run visual-qa, run
  Lighthouse, read/edit/write any file inside this repo.
- Everything TheOrchestra's `.claude/rules/qa.md` self-QA checklist and
  `.claude/rules/design-standards.md` already require of any builder task - both apply here in
  full, unchanged. Read them from TheOrchestra's checkout since this repo has no local copy.

## Forbidden

- **Orchestrator state and protocol.** Never hand-edit any file under `orchestrator/` in
  TheOrchestra's checkout, never edit `orchestrator/config.json`, never touch the external
  state root's files directly. Only ever go through the shared CLI's own verbs (claim,
  heartbeat, checkpoint, complete, usage, add, propose-decision) exactly as any other Orchestra
  agent does.
- **Distribution.** No drafting, posting, publishing, or scheduling anything outbound - that
  stays `growth`'s and Session A's job, gated by `.claude/rules/distribution.md` unchanged.
- **Money, accounts, ToS.** Same ALWAYS ESCALATE list as everywhere else in Orchestra - no
  spend, no new accounts or API keys, no agreeing to any terms of service.
- **Other repos.** See Territory above.

## Duties

- **Log usage to the central store.** Every task completion logs real spend through the shared
  CLI's `usage`/`complete` path, exactly like any other Orchestra agent - Session B's spend is
  Orchestra's spend, not a separate budget.
- **Heartbeat the central store as a distinct, stable session** - not as an anonymous
  task-scoped agent that changes name every run. See `/conduct-lite` for the exact command.
  This is what lets the tier governor account for two concurrently active sessions when
  computing real burn headroom.
- **File cross-scope needs to the central queue, never act on them.** If Session B's own work
  surfaces something outside this scope (a distribution idea, a real spend need, a defect in
  another repo, anything on the ALWAYS ESCALATE list), `add` it to the shared queue tagged for
  the right asset/department, or `propose-decision` if it is a real escalation - then leave it
  and move to the next in-scope task. Never widen scope to "just handle it."
- **Never block on the human.** If a specific filetools task needs a human answer, log it as a
  human-ask (`human-ask-open`) and move to the next claimable filetools task rather than
  sitting idle - the same standing rule Session A already follows.

## Invoking the shared coordination CLI from this repo

This repo has no local copy of `orchestrator/lib/`. Invoke it by absolute path from
TheOrchestra's checkout:

```
node "C:\Users\dylan\Dev\TheOrchestra\orchestrator\lib\cli.js" <verb> ...
```

The state root it resolves to is machine-global (homedir-anchored, not tied to which repo the
command is run from) - see `paths.js`'s own header comment in that checkout. This works
correctly from any working directory, including this one.
