# Design: two checks on an arrangement, and how each is proved

## The marker rule

```typescript
const start = agents.indexOf("<!-- TRELLIS:START -->");
const end = agents.indexOf("<!-- TRELLIS:END -->");
// The managed region is between the markers; everything after END is ours and is preserved by the block own footer.
const ours = agents.slice(end + "<!-- TRELLIS:END -->".length);
assert.ok(ours.includes("Where this harness is documented"), "our section is outside the managed block");
```

**Seeded to fail**: a file with our section placed *before* the end marker must fail, or the check is a comment with a syntax.

## The ownership rule

```typescript
if (existsSync(templateHashes)) {
	const tracked = Object.keys(JSON.parse(readFileSync(templateHashes, "utf8")).hashes ?? {});
	assert.deepEqual(tracked.filter((path) => path.startsWith(".trellis/spec/")), [], "a tool update tracks a specification now");
}
```

**Vacuous on a fresh clone, and it says so**: the bookkeeping file is management state, and a check that failed because it is absent
would be a check that punishes a clean checkout.

## Why these two and not a table in a document

A table of what an update may overwrite would be a fourth copy of something the tool already records, and it would drift. These two
checks are the parts a reader cannot see: that our content is on the safe side of the markers, and that the specifications are not
tracked. The rest is the tool business.
