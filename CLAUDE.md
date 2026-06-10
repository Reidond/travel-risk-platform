# CLAUDE.md
@AGENTS.md

## Skills

### User-Invocable (use with `/skill-name`)
- `/commit-message` (task) — Generate conventional commit messages
- `/spec-driven-dev` (workflow) — Spec-driven development pipeline
- `/post-task-review` (workflow) — 8-step post-task review pipeline
- `/skill-creator` (task) — Interactive skill building guide
- `/skill-creation-workflow` (workflow) — Research-backed skill creation pipeline (research + build + structural review + content review)
- `/skill-reviewer` (review) — Audit skills and determine workflow placement
- `/learning-consolidator` (workflow) — Weekly deep-analysis of learnings with promotion to rules/skills
- `/review-prompts` (workflow) — Comprehensive prompt review from engineering + domain expert perspectives
- `/product-brief` (task) — Product brief with assumption-challenging and UX content for team task descriptions
- `/session-retrospective` (task) — Analyze Claude Code session history for patterns, feedback, and workflow improvements
- `/branch-switch` (task) — Safely stash, switch branch, and apply stash with conflict detection

### Auto-Loaded by Claude (background knowledge)
- prompt-engineering-conventions (reference) — Prompt authoring conventions (role design, few-shot, anchoring, safety nets)

### Internal Pipeline Skills (invoked by workflows, not directly)
- plan-critic (review) — Self-review spec documents before presenting
- task-learnings (task) — Extract and record project learnings
- prompt-eng-reviewer (review) — Prompt engineering analysis (structure, format, parameters)
- prompt-domain-reviewer (review) — Domain expertise analysis (methodology, calibration, enrichment)
- skill-researcher (task) — Deep domain/problem research for skill creation
- skill-content-reviewer (review) — Content quality verification against research brief
- ai-changelog (task) — Append structured entries to AI infrastructure changelog
- ai-improvement-tracker (task) — Record testable hypotheses for AI infrastructure changes
