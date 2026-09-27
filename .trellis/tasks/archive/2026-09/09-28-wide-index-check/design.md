# Design: one rule, every directory

```typescript
for (const directory of readdirSync(specRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
	const indexPath = join(specRoot, directory.name, "index.md");
	if (!existsSync(indexPath)) { missing.push(directory.name); continue; }
	const index = readFileSync(indexPath, "utf8");
	const files = readdirSync(join(specRoot, directory.name)).filter((name) => name.endsWith(".md") && name !== "index.md");
	const mentioned = new Set(index.match(/[A-Za-z0-9._-]+\.md/g) ?? []);
	const unlisted = files.filter((name) => !mentioned.has(name));
	const broken = [...mentioned].filter((name) => !existsSync(join(specRoot, directory.name, name)));
}
```

**Why the name comparison rather than the link syntax**: the backend index lists files as links and the guides index does too, but the
rule being checked is "this index mentions every file in its directory", and matching a name is what that says. A link parser would
check something narrower.

**A directory with no index is a failure, not a skip.** The backend drift was three specifications missing from a table; a directory
that grows an index-less second one would be the same problem with no table at all.
