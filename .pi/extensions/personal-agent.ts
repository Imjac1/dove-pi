import { fileURLToPath } from "node:url";
import extension from "../../src/pi-adapter/extension.ts";
import { shouldSuppressDoveWrapper } from "../../src/core/extension-identity.ts";

/**
 * The managed launcher loads the release copy explicitly. Pi still discovers
 * this project wrapper automatically. Suppress only a discovered copy whose
 * physical path differs from the launcher's selected entry. Suppressing every
 * wrapper under the managed guard also disables the authoritative -e copy.
 */
const configuredEntry = process.env.DOVE_PI_EXTENSION_ENTRY?.trim();
const isDiscoveredDuplicate = shouldSuppressDoveWrapper({
	guardEnabled: process.env.DOVE_PI_EXTENSION_GUARD === "1",
	currentEntry: fileURLToPath(import.meta.url),
	configuredEntry,
});

export default isDiscoveredDuplicate
	? () => {}
	: extension;
