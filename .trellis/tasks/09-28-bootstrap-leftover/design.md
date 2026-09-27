# Design: remove an instruction that is false here

## What goes, and what stays

```text
goes:   ## How to Fill These Guidelines  +  its four numbered items  +  the sentence about YOUR project
        (and the Overview line that says to fill in each file)
stays:  the title, the one-line purpose, the Guidelines Index table, the language line
```

**The test is what makes removing it safe.** The indexes are load-bearing - a newcomer finds the specifications through them - and a
hand-edited table is exactly the kind of thing that drifts. That is why the removal is one half of a change whose other half is the
check from the previous round: the table is kept true by a test, so the prose around it can go.

## Why the skill line matters more than the text

The skill says an index must match its final file set. This repository had a test asserting that before anyone noticed the skill
said it - which is worth writing down in the check, because a rule that comes from the tool is not a matter of taste and should not be
argued with.
