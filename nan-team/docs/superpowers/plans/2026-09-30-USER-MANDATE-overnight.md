# USER MANDATE — overnight run (given 2026-09-30 ~23:40, valid until 2026-10-01 03:00)

READ THIS FIRST AFTER ANY CONTEXT COMPACTION. This is the user's standing instruction.

## What the user said (paraphrased faithfully)
- User is away (leaving the machine). Claude (root, Opus 5.5 medium) is fully in charge
  and decides everything on the user's behalf. Work until **03:00 on 2026-10-01**.
- Goal: finish the **video agent** (idea→video and source-video edit) so it runs
  **smoothly**, tests pass smoothly, then **optimize speed**. Final result must be a
  smooth, optimal system for **image and video creation**. Do it thoroughly.
- If AGY is too slow: use **multi-agent AGY** (parallel AGY jobs) to speed up image and
  video creation where possible.
- Working style: **every task is delegated to sub-agents** (multi-agent, efficient);
  root coordinates instead of doing everything alone. Sub-agents: Opus 4.6 high
  (Agent tool model "opus"); root: Opus 5.5 medium.
- Combine **Claude + Codex + AGY** for the best result.
- **Codex**: two accounts get quota back around **01:45 on 2026-10-01**:
  `tuananh161224@gmail.com`, `chinhanxt2005@gmail.com`. If the task is not finished by
  then, activate them via the user's **separate per-account profiles** (already set up by
  the user, under ~/.codex_profiles/) using model **"Astra 6" medium** reasoning.
- **AGYXT** at port **8899** is another AI source for chores (e.g. finding test source
  videos on the web).
- User answered the two open decisions: "choose what's best for the system":
  1. Caption reference transcript → ROOT DECISION: accept turbo + constrained AGY repair
     as the production path; caption acceptance = render faithfulness (0 diff) +
     independent cross-check by a second recognizer/AI (AGYXT or AGY listening pass)
     on a sample, recorded as machine-verified (not human-verified).
  2. Punch-in → ROOT DECISION: keep AGY-planned punch-in (content-aware, no double zoom);
     do NOT enable upstream audio-beat auto punch-in by default; expose it as opt-in
     (`PUNCH_IN=1`) only if cheap.
- When the user returns they expect the best possible result + a clear handoff summary.

## Standing constraints (from earlier in the session)
- Don't freeze the machine: heavy jobs sequential, nice -n 19, frontend dev unit only when
  needed (4 GiB cap), watch RAM (OOM happened at 22:09).
- Engine fingerprint guard: do not edit packages/openshorts-engine/{core,src} while a live
  source-video job is between analysis and render; update source-manifest.json after edits.
- Never overwrite FAIL receipts; new report names for new runs.
- Team context & history: 2026-09-30-video-e2e-team-context.md (same folder).
- Acceptance matrix: reports/openshorts-integration/acceptance-matrix-final.{md,json}.
- Demo videos for the user: ~/Videos/NaN-demo-20260930/.

## Handoff deliverable at 03:00
- Update acceptance-matrix-final, demo folder, and a HANDOFF section at the end of the
  team-context file: what's done, what's verified live, speed numbers before/after,
  remaining limits, how to run.

## EXTENSION — given 2026-10-01 ~03:00, valid until 05:00
- Re-run LIVE tests for the 4 fixes made at 02:50 (audio narration probe, landscape screencast crop, no chat replay, approval race; + RAM reservation).
- User re-logged Codex tuananh161224 (acc1). Use Claude sub-agents (model "opus" = Claude 4.8 class) + Codex "Astra 6" (gpt-6-astra medium; acc1/acc3/acc4) + AGY.
- Verify the FRONTEND lets the user self-test all video-agent features (idea→video, source edit, revisions, attach to composer) smoothly; fix blockers.
- Continue optimizing time of image/video agent tasks; goal: smooth, fast, reliable. Work until 05:00, then hand off (update HANDOFF + acceptance + demo folder, leave machine idle).
- 03:25 USER: Codex = acc3 (tuananh161224, profile [3]) + acc4 (chinhanxt2005, profile [4]) only; AGY only for small chores (quick but not deep) — keep AGY as the product's AI, but use Claude/Codex for engineering work.
- 03:33 USER: speed up; >10 agents allowed if useful; full authority to make the project best; research Laya carefully before safe opt-in integration.
- 03:56 USER: Laya removed. ≥5 agents at all times. When Astra (Codex) quota runs out, Claude takes over everything.
- 03:57 USER: DEADLINE 06:00 — everything finished and system smooth. Checkpoints: 04:37 integration (apply patches, rebuild, final live wave), 05:43 final wrap-up/handoff.
- 04:12 USER: whenever an agent finishes, immediately hand another task to keep ≥5 agents busy (more if there is much work).
- 04:20 USER: compact context and run /simplify when needed → after 04:37 integration run a simplify pass (via agent/skill) over tonight's changed files before the final live wave; context auto-compacts, mandate+context docs are the memory.
- 2026-10-01 06:44 USER: 'tiếp tục đi, chia nhiều agent làm khẩn trương lên' → round 3: fix HANDOFF-2 known issues in parallel (≥5 agents), root integrates (one rebuild) + live verify.
- 2026-10-01 07:53 Máy treo ~07:00 (tests song song + render) → reboot. Quy tắc mới: mọi lệnh nặng qua /tmp/nan-heavy.sh (flock /tmp/nan-heavy.lock, MemoryMax 2.5G, MemAvailable≥3G), swappiness=10, stack tắt trong lúc code; 8 agent (A,B,C,D,E,F,H,J) tiếp tục; root tích hợp 1 lần + nghiệm thu live tuần tự.
