# Product Brief — Calibration Examples

## Task Description Tone

### GOOD (spartan)

```markdown
## Problem

Users who submit incomplete travel itineraries get risk assessments with
missing data. No validation flow exists — the assessment runs and returns
partial results.

## Behavior

### When the user submits an itinerary with missing required fields:

1. User clicks "Assess Risk."
2. Modal appears with two paths.
3. **"Complete Itinerary"** — form highlights missing fields. User stays on
   the page with existing data preserved.
4. **"Assess Anyway"** — warning chips appear. Assessment runs with
   `PARTIAL_DATA` flag set.
```

Why it works: States facts. No motivation padding. Direct address ("Modal appears",
not "A modal should be displayed"). Numbers for sequences, bullets for rules.

### BAD (fluffy)

```markdown
## Problem

We believe that providing risk assessments for incomplete itineraries may not
deliver sufficient value to justify the associated computational costs.
Currently, when a user decides to submit an itinerary with missing information,
the system does not provide any meaningful guidance or alternative options,
which can lead to a suboptimal user experience.

## Proposed Behavior

### Incomplete Itinerary Scenario

When a user attempts to submit an itinerary that is missing required fields,
we would like to present them with a helpful modal dialog that explains the
situation and offers them some choices about how they would like to proceed.
```

Why it fails: "We believe", "may not deliver sufficient value", "suboptimal user
experience" — empty calories. "We would like to present" — who cares what we'd like?
State what happens.

---

## UX Content

### GOOD (modal copy)

```
Header: "Some required fields are missing"

Body: We need destination dates and traveler count to produce a reliable
risk assessment. Want to fill them in? Your current entries are saved.
```

Why it works: Honest about the constraint. Frames completion as the easy path.
No apology, no corporate-speak. "Your current entries are saved" reduces anxiety.

### BAD (modal copy)

```
Header: "Oops! It looks like some information is missing"

Body: We're sorry, but unfortunately we are unable to generate a complete
risk assessment for itineraries that are missing required fields. We
apologize for any inconvenience this may cause. Please consider completing
all fields to get the most out of our platform.
```

Why it fails: "Oops!" is patronizing. "Unfortunately we are unable" is passive
corporate deflection. "We apologize for any inconvenience" is a non-apology
that signals the opposite of empathy. "Get the most out of our platform" is
marketing filler in a frustration context.

### GOOD (reason chips)

| Chip | Why it works |
|------|-------------|
| Still planning | Neutral, no judgment. Validates exploration. |
| Data unavailable | Actionable for the team. Clear category. |
| Wrong destination | Points to a specific UX gap upstream. |
| Not ready yet | Acknowledges emotion without labeling it. |

### BAD (reason chips)

| Chip | Why it fails |
|------|-------------|
| The form was too hard | Leading — presumes a problem the user may not have. |
| I didn't like the options | Invites complaint without actionable signal. |
| Other (please specify) | Free text at a frustration point = noise. |
| I'll come back later | Wishful thinking, not a reason. |

---

## Button Labels

### GOOD

| Label | Why |
|-------|-----|
| Complete Itinerary | Verb-first, 2 words, clear action. |
| Assess Anyway | Verb-first, 2 words, honest about trade-off. |
| View Results | Verb-first, describes the outcome. |

### BAD

| Label | Why |
|-------|-----|
| OK | Meaningless — OK to what? |
| Click here to continue | "Click here" is redundant on a button. |
| I'd like to proceed | First person on a button is awkward. |
| Continue | Ambiguous — continue editing or continue to assessment? |
