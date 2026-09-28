/**
 * **What the release digest covers.** Every root the product is made of: the code, the installer, the Pi extension, the launcher and
 * the package manifests - **and `modes`**, which is product content the runtime reads (`work-mode.ts` loads `modes/<id>/MODE.md`, and
 * the code-audit capability reads a catalog under it).
 *
 * **A digest that ignored the mode definitions would describe a release whose modes could have been changed**, and the modes are the
 * part of the tree that decides what the running agent is permitted to do - `modes/trading` declares `order.submit` and `modes/pentest`
 * holds the authority rules. This was found by reading the list rather than by a failing release: the builder walked these roots and
 * nothing else, so a mode change left the digest identical.
 *
 * **In its own module so a test can read it**: the builder writes a file when it runs, so importing it to inspect the list is not
 * possible, and a test that read the script as text would be checking a pattern rather than a value.
 */
export const RELEASE_SOURCE_ROOTS = [
	"bin",
	"src",
	"installer",
	".pi",
	"modes",
	"scripts/build-release-manifest.mts",
	// **The list itself is part of the release**, because it decides what the digest covers: a change to which roots are walked
	// must change the digest, or the claim can be edited without the artifact noticing. It lives in its own module so a test can
	// read it, and that module has to be covered for the same reason the builder is.
	"scripts/release-roots.mts",
	"dove_pi.py",
	"package.json",
	"package-lock.json",
] as const;
