---
description: Session B's lightweight conduct pass, scoped to filetools only. Re-orients from this repo's own rolling plan and the shared demand-mined task list, then builds.
---

Wear the `builder` hat for this session, inside the boundaries in `SESSION_SCOPE.md` at this
repo's root - read it in full before anything else if this is the first run this session.

1. **Re-orient.** Read `SESSION_SCOPE.md` (territory/permitted/forbidden/duties) and
   `ROLLING_PLAN.md` in this repo. If `ROLLING_PLAN.md` doesn't exist yet, create it from the
   skeleton at the bottom of this file - it is this repo's own equivalent of TheOrchestra's
   `docs/ROLLING_PLAN.md`, scoped to filetools only.
2. **Heartbeat as a distinct, stable session** - not a bare task agent:
   ```
   node "C:\Users\dylan\Dev\TheOrchestra\orchestrator\lib\cli.js" heartbeat session-b --role chief_of_staff
   ```
   `session-b` is the fixed agent name for this session - keep it stable across every run so
   the tier governor recognizes it as one ongoing session, not a new one each pass.
3. **Pull this session's task list**, filtered to this repo's own scope:
   ```
   node "C:\Users\dylan\Dev\TheOrchestra\orchestrator\lib\cli.js" frontier --role builder --full
   ```
   then keep only entries whose `"asset"` field is `"filetools"`. These are the demand-mined
   tool-page candidates (and any other filetools work) queued in the shared central store.
4. **Claim and build** the next one, using `session-b` as your claim agent name:
   ```
   node "C:\Users\dylan\Dev\TheOrchestra\orchestrator\lib\cli.js" claim <taskId> --agent session-b
   ```
   Build it per that task's own description. TheOrchestra's `.claude/rules/qa.md` self-QA
   checklist and `.claude/rules/design-standards.md` apply in full - read them from
   TheOrchestra's checkout since this repo has no local copy.
5. **Complete/checkpoint through the same shared CLI**, same as any other Orchestra builder
   task - `complete`/`checkpoint-with-full-result`, with the four mandatory `--digest-*`
   fields. `push-branch`/PR conventions for this repo are unchanged by any of this.
6. **If you hit anything outside `SESSION_SCOPE.md`'s Permitted list** - money, accounts,
   distribution, another repo, orchestrator state itself - stop that thread, file it per
   `SESSION_SCOPE.md`'s Duties (`add`/`propose-decision` to the shared queue), and move to the
   next claimable filetools task. Never block on the human and never widen scope to "just
   handle it."
7. **Update this repo's own `ROLLING_PLAN.md`** with a short handoff note before ending the
   session - same convention as TheOrchestra's own `/conduct`.
8. **Loop back**, same as `/conduct`: once dispatched work in this pass completes, re-enter
   from step 1 rather than stopping after one task, while real claimable filetools work remains
   in the shared queue.

## `ROLLING_PLAN.md` skeleton (create if missing)

```markdown
# filetools rolling plan (Session B)

Session B's own living state, scoped to this repo only. Full protocol: `SESSION_SCOPE.md` in
this repo's root; shared queue/decision mechanics:
`C:\Users\dylan\Dev\TheOrchestra\.claude\rules\protocol.md`.

## Session state
_As of <timestamp>:_ (fill in at every session close - what shipped, what's in flight, next
claimable task)

## Standing notes
- Heartbeat/claim agent name: `session-b`
- Central state root: resolved automatically by the shared CLI (homedir-anchored,
  machine-global) - no local setup needed.
```
