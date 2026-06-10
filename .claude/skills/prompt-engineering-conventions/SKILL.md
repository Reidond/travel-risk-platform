---
name: prompt-engineering-conventions
description: >
  Project-specific prompt engineering conventions for writing effective AI prompts.
  Covers role definition, few-shot design, anchoring bias mitigation, structural symmetry,
  safety net normalization, and cross-reference sweeps. Auto-loaded as background knowledge
  when writing or reviewing prompt templates.
metadata:
  type: reference
---

# Prompt Engineering Conventions

## Role

Background knowledge for writing and reviewing AI prompt templates in this project.
These conventions are derived from production incidents, post-task reviews, and iterative
prompt improvements across AI-powered features.

## When This Skill Activates

- Writing or modifying prompt templates under `prompts/`
- Reviewing AI prompt quality (via `/review-prompts` or manual review)
- Designing new AI-powered features that require system prompts
- Debugging unexpected AI behavior in AI-powered features

---

## 1. Role Definition: Reasoning Patterns Over Knowledge Lists

Define *how the agent reasons* before *what it knows*. Contract-style role prompts
anchored to reasoning patterns produce more consistent behavior than credential-based ones.

```
# GOOD
You are an AI Platform Architect.
How you reason: adversarially, verification-first, pipeline-aware.

# BAD
You are a Senior Staff Engineer who knows voice pipelines, LLM integration,
WebSocket protocols, and real-time audio processing.
```

Keep role definitions under ~100 words with critical stance first.

## 2. Chain-of-Verification (CoVe) Over Bare Checklists

Bare checklists invite mindless ticking. Verification questions require evidence-backed
answers and reduce hallucination in self-review.

```
# GOOD — forces evidence anchoring
Answer with evidence from the document:
- "Yes (evidence)" | "No" | "Unknown"
Any "No" or "Unknown" becomes a finding.

# BAD — allows mindless completion
- [ ] Security considered
- [ ] Error handling present
- [ ] Tests written
```

## 3. Adversarial Scenario Generation Must Be Protocol-Driven

Happy-path bias is the default. Adversarial coverage does not happen spontaneously.
Embed the 5-question protocol as a required, named step — not a tip:

1. What if the actor is not authorized?
2. What if the input is malformed or empty?
3. What if the AI model is unavailable or slow?
4. What if a concurrent request hits the same resource?
5. What if the connection drops mid-operation?

## 4. Structural Symmetry Between Opening and Closing

LLMs allocate attention proportionally to instruction density. If the opening protocol
has 15+ lines with samples and anti-patterns, give the closing protocol equivalent weight.

A 3-bullet closing against a 15-line opening consistently produces weak endings.
Both ends must have: named steps, sample sequences, and prohibited patterns.

## 5. Prohibited Phrases Must Include Explanations

A bare prohibition ("NEVER use X") stops the exact phrase but not semantic equivalents.
Adding an explanation teaches the underlying constraint:

```
# GOOD
"Ok, that's what I needed" (ambiguous — does not signal the interview is over)
"for now" (implies more later — contradicts interview completion)

# BAD
NEVER say "Ok, that's what I needed"
NEVER say "for now"
```

## 6. Primacy and Recency: Multi-Position Enforcement

In long prompts, middle content receives less attention. Critical constraints must appear
at both primacy (position 1-2) AND recency (last section) positions.

A single mention in the middle of a 12-section prompt is unreliable.

## 7. Few-Shot Examples Must Include Counter-Examples

Using only negative cases causes over-triggering on borderline inputs. Every few-shot set
must include:
- Clear negative cases
- A counter-example of correct positive behavior
- A boundary/ambiguous case

5 examples is optimal; fewer than 3 is usually insufficient.

## 8. Anchoring Bias: Examples Outweigh Instructions

LLMs weight few-shot examples MORE heavily than natural-language instructions (~100x by
token ratio). When mixing instructions with examples:

1. Add explicit `FORMAT REFERENCE ONLY` disclaimers on generic examples
2. Add prohibition patterns ("DO NOT copy content from examples")
3. Add a CoT extraction step before generation
4. Audit token weight ratios: a 20-token instruction cannot override 2000 tokens of examples

## 9. Structured Output Field Ordering

OpenAI structured outputs generate JSON fields in schema declaration order. Once a field
is written, it cannot be revised. Order Pydantic AI response model fields as:

1. Classification/gate checks (first — influences reasoning)
2. Reasoning/assessment (second — informed by gate)
3. Score/rating (third — derived from reasoning)
4. Evidence/examples (last — supports the score)

Document phase ordering with inline comments to prevent regressions.

## 10. Safety Net Normalization for Hard Constraints

Even with explicit hard rules, LLMs occasionally fail to comply. Every constraint mapping
one field to a ceiling on another needs three layers:

1. **Prompt instruction** at primacy + recency positions
2. **Python normalization** in the post-processing pipeline (e.g., `_normalize_interview_analysis()`)
3. **Validator check** in the response validator

## 11. Prompt-Only CoT Extraction for Context Processing

When AI misuses structured data (JSON resume, vacancy), try a CoT extraction step in the
prompt before reaching for Python code changes:

```
Before generating, mentally identify from the candidate context:
1. Key technologies used
2. Domain/industry
3. Company type and scale
4. Scope of responsibility
```

Prefer prompt-level fixes over code changes for shared base class methods.

## 12. Conditional Checklist Items for Optional Context

Any checklist item that depends on optional context (resume, vacancy, interview type)
must have an explicit conditional qualifier:

```
# GOOD
(If candidate context provided) Strong example uses technologies from the candidate's resume

# BAD
Strong example uses technologies from the candidate's resume
```

Without the conditional, the AI's self-evaluation gate malfunctions on the edge case.

## 13. Cross-Reference Sweep When Removing Prompt Features

When removing a behavioral feature from a prompt, grep the entire prompt AND all
injected partials/persona files for every phrase that implies or enables the feature.

A missing reference in a single downstream file is enough for the model to revert to
the old behavior. The most dangerous stale references are in error handling and fallback
sections — they are rarely reviewed during feature removal.

## 14. Prompt-Introduced Phrases Must Cross-Check Prohibited Lists

After writing any new sample phrase, script, or example in a prompt, cross-check it
against the prompt's Prohibited Language and Variety sections before finalizing.

Internal contradictions (a new example using a banned word) are resolved unpredictably
by the model.

## 15. Context References Must Be Tied to Functional Actions

Resume/context references should anchor a question or frame a topic — not float as
standalone observations:

```
# GOOD (Turn 3, anchored to walkthrough transition)
"I noticed your work with [technology]. Walk me through your background."

# BAD (Turn 1, before audio confirmed)
"I see you worked with Redis."  — no conversational function
```

## 16. Interview-Type Conditional Examples in Shared Prompts

When a shared prompt template (`default.txt`) serves multiple interview types (technical,
behavioral), every framework section (DIVE, Evidence Quality, Question Generation) must
provide type-conditional examples:

```
For technical interviews:
- "What metrics improved?" / "Which tools did you use?"

For behavioral interviews:
- "What was your specific role?" / "How did others respond?"
```

A single set of examples creates a hidden mode bias where behavioral interviews sound
technical (or vice versa).

## 17. Per-Response Override Templates Must Be Self-Contained

OpenAI Realtime `response.create` `instructions` **override** (not append to) the session
system prompt for that single response — *"they will override the Session's configuration
for this Response only"* (verified against the SDK source). The session-level agenda,
persona, difficulty, and frameworks are NOT active during the overridden response. Only the
conversation history (prior items) survives.

Therefore a per-response override template (e.g. `ask_differently_instructions`,
`skip_question_instructions`):

- MUST NOT reference "your main instructions", "the interview agenda", persona, or any
  session-prompt content — those are inactive for this response.
- MUST anchor any behavior on what survives the override: the conversation history.

```
# GOOD (self-contained — content lives in conversation history)
Rephrase your previous question using simpler wording.
Review the conversation so far and choose a competency you have NOT yet asked about.
Match the difficulty and tone you have used earlier in this conversation.

# BAD (references the displaced session prompt)
Follow the interview agenda defined in your main instructions.
Use the persona configured for this interview.
```

Templates that only **transform existing content** (rephrase the last question) are
naturally safe. Templates that **select new content** (pick the next, different question)
are the risk — without the agenda they may invent off-agenda questions, repeat covered
topics, or drift in difficulty. If selection genuinely needs session state, inject that
state into the override text at build time rather than pointing at the inactive prompt.
