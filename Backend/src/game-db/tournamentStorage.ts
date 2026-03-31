import type { TournamentStatus } from "../tournament/types";
import type { SerializedBracketState } from "../tournament/bracket";
import { getDatabase } from "./database";

export interface StoredTournamentParticipant {
	userId: number;
	alias: string;
	joinedAt: number;
	lastSeenAt: number;
	ready: boolean;
	inMatch: boolean;
}

export interface StoredTournamentActiveMatch {
	matchId: string;
	aliases: [string, string];
	roomId: string;
}

export interface StoredTournamentState {
	code: string;
	name: string;
	status: TournamentStatus;
	capacity: number;
	createdAt: number;
	updatedAt: number;
	participants: StoredTournamentParticipant[];
	activeMatches: StoredTournamentActiveMatch[];
	bracket: SerializedBracketState | null;
}

const UPSERT_SQL = `
	INSERT INTO tournaments (code, name, status, capacity, created_at, updated_at, state_json)
	VALUES (@code, @name, @status, @capacity, @createdAt, @updatedAt, @stateJson)
	ON CONFLICT(code) DO UPDATE SET
		name = excluded.name,
		status = excluded.status,
		capacity = excluded.capacity,
		updated_at = excluded.updated_at,
		state_json = excluded.state_json;
`;

const DELETE_SQL = `DELETE FROM tournaments WHERE code = ?;`;
const SELECT_SQL = `SELECT code, name, status, capacity, created_at, updated_at, state_json FROM tournaments WHERE code = ?;`;
const SELECT_ALL_SQL = `SELECT code, name, status, capacity, created_at, updated_at, state_json FROM tournaments;`;

type PersistedPayload = {
	participants: StoredTournamentParticipant[];
	activeMatches: StoredTournamentActiveMatch[];
	bracket: SerializedBracketState | null;
	updatedAt: number;
};

function toPayload(state: StoredTournamentState): PersistedPayload {
	return {
		participants: state.participants,
		activeMatches: state.activeMatches,
		bracket: state.bracket,
		updatedAt: state.updatedAt,
	};
}

function fromRow(row: {
	code: string;
	name: string;
	status: TournamentStatus;
	capacity: number;
	created_at: number;
	updated_at: number;
	state_json: string;
}): StoredTournamentState {
	let parsed: PersistedPayload | null = null;
	try {
		parsed = JSON.parse(row.state_json) as PersistedPayload;
	} catch (error) {
		console.error("Failed to parse tournament state JSON:", { code: row.code, error });
	}

	return {
		code: row.code,
		name: row.name,
		status: row.status,
		capacity: row.capacity,
		createdAt: row.created_at,
		updatedAt: parsed?.updatedAt ?? row.updated_at,
		participants: parsed?.participants ?? [],
		activeMatches: parsed?.activeMatches ?? [],
		bracket: parsed?.bracket ?? null,
	};
}

export function saveTournamentState(state: StoredTournamentState): void {
	const db = getDatabase();
	const statement = db.prepare(UPSERT_SQL);
	const updatedAt = Date.now();
	statement.run({
		code: state.code,
		name: state.name,
		status: state.status,
		capacity: state.capacity,
		createdAt: state.createdAt,
		updatedAt,
		stateJson: JSON.stringify(toPayload({ ...state, updatedAt })),
	});
}

export function loadTournament(code: string): StoredTournamentState | null {
	const db = getDatabase();
	const row = db.prepare(SELECT_SQL).get(code) as
		| {
			code: string;
			name: string;
			status: TournamentStatus;
			capacity: number;
			created_at: number;
			updated_at: number;
			state_json: string;
		}
		| undefined;
	if (!row) {
		return null;
	}
	return fromRow(row);
}

export function loadAllTournaments(): StoredTournamentState[] {
	const db = getDatabase();
	const rows = db.prepare(SELECT_ALL_SQL).all() as Array<{
		code: string;
		name: string;
		status: TournamentStatus;
		capacity: number;
		created_at: number;
		updated_at: number;
		state_json: string;
	}>;
	return rows.map(fromRow);
}

export function deleteTournament(code: string): void {
	const db = getDatabase();
	const statement = db.prepare(DELETE_SQL);
	statement.run(code);
}

export function saveTournamentHistory(params: {
	code: string;
	name: string;
	capacity: number;
	winnerId: number;
	winnerAlias: string;
	totalParticipants: number;
	createdAt: number;
}): void {
	const db = getDatabase();
	
	const sql = `
		INSERT INTO tournament_history (
			code, name, capacity,
			winner_id, winner_alias,
			total_participants,
			created_at, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`;
	
	const stmt = db.prepare(sql);
	stmt.run(
		params.code,
		params.name,
		params.capacity,
		params.winnerId,
		params.winnerAlias,
		params.totalParticipants,
		params.createdAt,
		Date.now()
	);
}
