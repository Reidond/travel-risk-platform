# Session Retrospective Report Template

Use this structure for the final retrospective report.

---

```markdown
# Session Retrospective: {date_range}

Generated: {current_date}
Sessions analyzed: {count}
Period: {from_date} to {to_date}

## Executive Summary

{3-5 bullet points with the most impactful findings}

## Session Inventory

| # | Date | Title | Branch | Type | Messages | Duration | Outcome |
|---|------|-------|--------|------|----------|----------|---------|
{one row per session}

**Task Type Legend:** bug-fix | feature | refactoring | infrastructure | ai-workflow | investigation | log-analysis

**Outcome Legend:** completed | continued | abandoned

## Cross-Session Patterns

### Recurring Topics
{Topics that appeared in 2+ sessions — indicates ongoing work or recurring issues}

### Multi-Session Tasks
{Tasks that required more than one session to complete — why? was the scope too large?}

### Branch Activity
{Which branches had the most sessions — indicates focus areas}

## User Feedback Analysis

### Corrections (user told AI it was wrong)
| Session | Quote | Category | Captured in Rules? |
|---------|-------|----------|-------------------|
{each correction found}

### Preferences (user expressed how things should be done)
| Session | Quote | Category | Captured in Rules? |
|---------|-------|----------|-------------------|
{each preference found}

### Redirections (user changed AI's approach mid-task)
| Session | What AI was doing | What user wanted instead |
|---------|-------------------|------------------------|
{each redirection found}

## Convention Gap Analysis

### Rules Enforced by User but Not in AGENTS.md
{Conventions the user stated that aren't captured in project rules}

### Rules in AGENTS.md That AI Violated
{Cases where the AI broke existing rules — suggests the rule needs strengthening or examples}

## Skill Effectiveness

### Skills Used
| Skill | Times Invoked | Sessions | Effective? |
|-------|--------------|----------|------------|
{from extraction data}

### Skills Never Used
{Skills that exist but were never invoked during the period}

### Missing Skills (Repeated Manual Work)
{Tasks done manually 2+ times that could be a skill}

## Workflow Observations

### What Worked Well
{Patterns or approaches that succeeded without corrections}

### What Caused Friction
{Repeated issues, confusing interactions, abandoned approaches}

### Abandoned Sessions
{Very short sessions (<3 user messages) — what caused early exit?}

## Recommendations

### Priority 1: New Rules for AGENTS.md
{Specific rules to add, with exact wording suggestion}

### Priority 2: Skill Updates
{Existing skills that need modification, with specific changes}

### Priority 3: New Skill Candidates
{Repeated manual tasks that warrant a new skill}

### Priority 4: New Learnings
{Findings to append to .ai/learnings.md}

### Priority 5: Workflow Changes
{Changes to the overall AI development workflow}
```
