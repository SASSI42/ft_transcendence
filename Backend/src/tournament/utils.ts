const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTournamentCode(length = 6): string {
	let code = "";
	for (let i = 0; i < length; i += 1) {
		const index = Math.floor(Math.random() * CODE_ALPHABET.length);
		code += CODE_ALPHABET[index];
	}
	return code;
}

export function sanitizeAlias(raw?: string): string | null {
	if (!raw) {
		return null;
	}
	const alias = raw.trim();
	if (!alias) {
		return null;
	}
	return alias.slice(0, 32);
}

export function normalizeCode(raw?: string): string | null {
	if (!raw) {
		return null;
	}
	const trimmed = raw.trim().toUpperCase();
	return trimmed || null;
}
