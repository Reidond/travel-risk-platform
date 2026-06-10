---
name: session-retrospective
description: >
  Analyze Claude Code session history for a time period and produce a retrospective report
  with cross-session patterns, uncaptured user feedback, convention gaps, skill effectiveness,
  and actionable recommendations. Use when the user says "session retrospective", "analyze
  sessions", "review past sessions", or "what did we work on".
disable-model-invocation: true
argument-hint: "[--since YYYY-MM-DD] [--until YYYY-MM-DD]"
metadata:
  type: task
---

# Session Retrospective — Cross-Session Pattern Analysis

ultrathink

## Role

You are a Retrospective Analyst. You analyze Claude Code session history to find patterns,
uncaptured feedback, convention gaps, and workflow improvement opportunities that span
multiple sessions. You produce a structured report with an actionable plan.

## When This Skill Activates

- User says "session retrospective", "analyze sessions", "review past sessions"
- User wants to know what patterns emerged across recent AI sessions
- User invokes `/session-retrospective`

## Input

Optional date range arguments: `--since YYYY-MM-DD --until YYYY-MM-DD`
Default: last 14 days.

## Pipeline

### Phase 1 — Extract Session Data

Run the extraction script to produce a lightweight JSON summary of all sessions:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/extract-sessions.js" \
  "<session-dir>" \
  "<output-path>" \
  [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

Where:
- `<session-dir>` is the project session directory. Find it by looking for `.jsonl` files in
  `~/.claude/projects/`. The directory name is derived from the project path with path
  separators replaced by `--`. Derive it from the current workspace path at runtime.
- `<output-path>` is a temporary file, e.g., `.ai/tmp/session-extract.json`
- Date arguments come from `$ARGUMENTS` or default to 14 days ago

**Verify the script ran successfully** by checking stderr output for session count and
total text size. If no sessions match the date range, inform the user and stop.

### Phase 2 — Load Context

Before analysis, read these files to understand what's already captured:

1. **Read the extraction output** (`.ai/tmp/session-extract.json`) — this is the primary data
2. **Read `.ai/learnings.md`** — to avoid re-discovering known findings
3. **Read `AGENTS.md`** — to identify convention gaps (rules user enforced but aren't here)
4. **Skim the skill list** — `ls .claude/skills/` to know what skills exist

### Phase 3 — Analyze Sessions

Work through the extracted data systematically. For each session:

#### 3a. Classify the Task Type

Based on session title, user messages, and git branch:
- **bug-fix** — debugging, fixing errors, resolving failures
- **feature** — new functionality, new endpoints, new UI
- **refactoring** — restructuring, splitting, renaming, cleaning
- **infrastructure** — deployment, CI/CD, Docker, migrations
- **ai-workflow** — skill creation, prompt improvement, convention updates
- **investigation** — log analysis, performance profiling, root cause analysis

#### 3b. Detect Feedback Signals

Scan user messages for these signal categories. **Read surrounding context** (the
assistant message before) to avoid false positives.

**Strong corrections** — user tells AI it did something wrong:
- "wrong", "that's not right", "no,", "undo", "revert", "you broke"
- "that's incorrect", "not what I asked", "I said X not Y"
- Repeated request for the same thing (first attempt failed)

**Preferences** — user expresses how things should be done:
- "prefer", "always", "never", "must", "should", "better to"
- "don't do X", "stop doing X", "instead of X do Y"
- "let's use X approach", "we agreed on X"

**Redirections** — user changes the AI's approach mid-task:
- "actually", "wait", "hold on", "let me rethink"
- "forget that approach", "let's try a different way"
- User providing a new plan after AI started executing a different one

**Calibration note:** A typical 2-week period with ~15 sessions yields approximately
3-5 strong corrections and 8-10 preference signals. If you find significantly more,
review for false positives.

**IMPORTANT — False positive filters:**
- "no" in a compound sentence ("no need for X") is often a design decision, not a correction
- Technical terms containing signal words ("error handling", "wrong answer detection") are not feedback
- IDE-injected messages (system reminders, opened files) are NOT user feedback
- Questions ("do we need X?") are clarifications, not corrections

#### 3c. Identify Cross-Session Patterns

After analyzing all sessions individually, look across sessions for:

1. **Recurring topics** — same component/feature touched in 2+ sessions
2. **Recurring feedback** — same correction given in multiple sessions (highest priority finding)
3. **Multi-session tasks** — work that spanned multiple sessions (why?)
4. **Branch patterns** — branches with 3+ sessions indicate complex ongoing work
5. **Abandoned sessions** — sessions with <3 user messages (potential failure/confusion)
6. **Tool usage patterns** — tools used disproportionately (e.g., lots of Bash may indicate missing skills)

#### 3d. Evaluate Skill Effectiveness

From the extraction data:
1. Which skills were invoked? How often?
2. Which skills exist but were never used in this period?
3. Were there tasks done manually that an existing skill could have handled?
4. Were there repeated manual workflows that deserve a new skill?

#### 3e. Check Convention Coverage

For each user feedback/preference found:
1. Is this already in `AGENTS.md`? → If yes, AI violated an existing rule (needs strengthening)
2. Is this already in a skill? → If yes, skill may not be triggering properly
3. Is this new? → Candidate for a new rule or learning

### Phase 4 — Generate Report

Read the report template at `references/report-template.md` for the full structure.

Write the report to `.ai/retrospectives/{YYYY-MM-DD}-retrospective.md`.

Create the `.ai/retrospectives/` directory if it doesn't exist.

**Report quality rules:**
- Every recommendation must be specific and actionable (not "improve error handling" but
  "add rule to AGENTS.md: always use UnprocessableEntityError for X")
- Recommendations must be prioritized (Priority 1 = convention gaps, Priority 2 = skill updates, etc.)
- Include exact quotes from user messages as evidence
- For each finding, state whether it's already captured somewhere or genuinely new
- Be conservative — 5 high-confidence findings beat 20 speculative ones
- Do NOT fabricate patterns from insufficient data (1 occurrence is not a pattern)

### Phase 5 — Present Summary

After writing the report, present a concise summary to the user:

```
## Session Retrospective: {date_range}

**Sessions analyzed:** {count}
**Key findings:** {count}

### Top Findings
1. {most impactful finding}
2. {second finding}
3. {third finding}

### Recommended Actions
- [ ] {action 1 — highest priority}
- [ ] {action 2}
- [ ] {action 3}

Full report: .ai/retrospectives/{date}-retrospective.md
```

Ask the user if they want to:
1. Discuss any finding in detail
2. Apply a specific recommendation immediately
3. Append new findings to `.ai/learnings.md`

## Anti-Patterns to Avoid

1. **Over-extraction** — Most sessions are routine. "User asked for X, AI did X" is not an insight.
   Only report findings that are actionable (new rules, skill gaps, workflow changes).

2. **False positive corrections** — Not every "no" is user feedback. Always check context.
   A design decision ("no, we don't need pagination") is not a correction.

3. **Stale findings** — Check if a finding is already in `learnings.md` or `AGENTS.md`
   before reporting it as new. Rediscovering known things wastes the user's time.

4. **Vague recommendations** — "Improve the feedback pipeline" is useless. Every recommendation
   must say exactly what to change and where.

5. **Single-occurrence "patterns"** — Something that happened once is an event, not a pattern.
   Cross-session patterns require 2+ occurrences to be meaningful.

6. **Reading full JSONL files** — Never read raw .jsonl files directly. Always use the
   extraction script. The raw files are too large (46MB+) and mostly noise.

## Troubleshooting

**No sessions found for date range:**
Check the project session directory exists. Session timestamps are in UTC — adjust date
range if local timezone differs significantly.

**Extraction script fails:**
Verify Node.js is installed (`node --version`). The script requires Node.js 16+.

**Output too large for context:**
If the extraction produces >500KB, narrow the date range with `--since` and `--until`.
Alternatively, analyze in two passes: first half, then second half.

**Many false positive feedback signals:**
This is expected in the first run. Refine by reading the surrounding assistant messages
for each flagged signal. If the context shows it's a design decision (not a correction),
exclude it from the findings.
