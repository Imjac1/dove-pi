const SENSITIVE_BASENAME = /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519)$/i;
const SENSITIVE_NAME_PART = /(?:^|[._-])(?:credentials?|secrets?|tokens?|api[._-]?keys?|password|passwd|private[._-]?keys?)(?:[._-]|$)/i;
const SENSITIVE_EXTENSION = /\.(?:pem|key|p12|pfx|jks|keystore|crt|cer|der|p7b|p7c)$/i;

/**
 * Evidence references may be file paths or opaque URIs. Drop references whose
 * path-like segments identify common credential material; callers must opt in
 * through a future policy boundary rather than leaking them by default.
 */
export function isSensitiveEvidenceReference(reference: string): boolean {
	const normalized = reference.trim().replace(/^file:\/\//i, "").split(/[?#]/, 1)[0];
	if (!normalized) return false;
	if (SENSITIVE_EXTENSION.test(normalized)) return true;
	return normalized.split(/[\\/]+/).some((segment) => SENSITIVE_BASENAME.test(segment) || SENSITIVE_NAME_PART.test(segment));
}

export function sanitizeEvidenceReferences(references: readonly string[]): readonly string[] {
	return [...new Set(references.map((reference) => reference.trim()).filter((reference) => reference && !isSensitiveEvidenceReference(reference)))];
}
