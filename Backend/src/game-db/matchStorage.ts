import type { GameState, PlayerSide } from "../game/gameLogic";
import { getDatabase } from "./database";

export type MatchStatus = "waiting" | "ready" | "playing" | "paused" | "completed" | "player_left";

export interface StoredMatchPlayer {
	matchId: string;
	side: PlayerSide;
	userId: number;
	username: string; // Keep for display purposes, but user_id is the primary identifier
	ready: boolean;
	connected: boolean;
	lastSeen: number;
}

export interface StoredMatch {
	matchId: string;
	status: MatchStatus;
	rejoinDeadline: number | null;
	createdAt: number;
	updatedAt: number;
	state: GameState;
	players: StoredMatchPlayer[];
}

const UPSERT_MATCH_SQL = `
	INSERT INTO matches (id, status, state_json, rejoin_deadline, created_at, updated_at)
	VALUES (@id, @status, @stateJson, @rejoinDeadline, @timestamp, @timestamp)
	ON CONFLICT(id) DO UPDATE SET
		status = excluded.status,
		state_json = excluded.state_json,
		rejoin_deadline = excluded.rejoin_deadline,
		updated_at = excluded.updated_at;
`;

const UPSERT_PLAYER_SQL = `
	INSERT INTO match_players (match_id, side, user_id, username, ready, connected, last_seen)
	VALUES (@matchId, @side, @userId, @username, @ready, @connected, @lastSeen)
	ON CONFLICT(match_id, side) DO UPDATE SET
		user_id = excluded.user_id,
		username = excluded.username,
		ready = excluded.ready,
		connected = excluded.connected,
		last_seen = excluded.last_seen;
`;

const DELETE_MATCH_SQL = `DELETE FROM matches WHERE id = ?;`;
const SELECT_MATCH_SQL = `SELECT id, status, state_json, rejoin_deadline, created_at, updated_at FROM matches WHERE id = ?;`;
const SELECT_PLAYERS_SQL = `
	SELECT match_id, side, user_id, username, ready, connected, last_seen
	FROM match_players
	WHERE match_id = ?;
`;
const SELECT_MATCHES_WITH_EXPIRED_DEADLINE_SQL = `
	SELECT id FROM matches
	WHERE rejoin_deadline IS NOT NULL AND rejoin_deadline <= ?;
`;

function serializeState(state: GameState): string {
	return JSON.stringify(state);
}

function deserializeState(raw: string): GameState {
	return JSON.parse(raw) as GameState;
}

export function upsertMatchSnapshot(params: {
	matchId: string;
	status: MatchStatus;
	state: GameState;
	rejoinDeadline: number | null;
}): void {
	try  {
		const db = getDatabase();
		const statement = db.prepare(UPSERT_MATCH_SQL);
		const now = Date.now();
		statement.run({
			id: params.matchId,
			status: params.status,
			stateJson: serializeState(params.state),
			rejoinDeadline: params.rejoinDeadline ?? null,
			timestamp: now,
		});
	} catch (error){}
}

export function upsertPlayerState(params: {
	matchId: string;
	side: PlayerSide;
	userId: number;
	username: string;
	ready: boolean;
	connected: boolean;
}): void {

	try  {
		
		const db = getDatabase();
		
		// First ensure the match exists to avoid foreign key constraint failure
		const matchExists = db.prepare(`SELECT 1 FROM matches WHERE id = ?`).get(params.matchId);
		if (!matchExists) {
		// Match doesn't exist, skip player state update to avoid FK constraint error
		return;
	}
		
		// Verify the user exists in the database
		const userExists = db.prepare(`SELECT 1 FROM users WHERE id = ?`).get(params.userId);
		if (!userExists) {
			return;
		}
		
		const statement = db.prepare(UPSERT_PLAYER_SQL);
		statement.run({
			matchId: params.matchId,
			side: params.side,
			userId: params.userId,
			username: params.username,
			ready: params.ready ? 1 : 0,
			connected: params.connected ? 1 : 0,
			lastSeen: Date.now(),
		});
	} catch (error){}
}

export function deleteMatch(matchId: string): void {
	
	try  {
		const db = getDatabase();
		const deleteMatchStatement = db.prepare(DELETE_MATCH_SQL);
		const deletePlayersStatement = db.prepare(`DELETE FROM match_players WHERE match_id = ?;`);
		const transaction = db.transaction((id: string) => {
			deletePlayersStatement.run(id);
			deleteMatchStatement.run(id);
		});
		transaction(matchId);
	} catch (error){}
}

export function loadMatch(matchId: string): StoredMatch | null {
	
	const db = getDatabase();
	const matchRow = db.prepare(SELECT_MATCH_SQL).get(matchId) as
		| {
			id: string;
			status: MatchStatus;
			state_json: string;
			rejoin_deadline: number | null;
			created_at: number;
			updated_at: number;
		}
		| undefined;

	if (!matchRow) {
		return null;
	}

	const playerRows = db.prepare(SELECT_PLAYERS_SQL).all(matchId) as Array<{
		match_id: string;
		side: PlayerSide;
		user_id: number;
		username: string;
		ready: number;
		connected: number;
		last_seen: number;
	}>;

	return {
		matchId: matchRow.id,
		status: matchRow.status,
		rejoinDeadline: matchRow.rejoin_deadline ?? null,
		createdAt: matchRow.created_at,
		updatedAt: matchRow.updated_at,
		state: deserializeState(matchRow.state_json),
		players: playerRows.map((row) => ({
			matchId: row.match_id,
			side: row.side,
			userId: row.user_id,
			username: row.username,
			ready: Boolean(row.ready),
			connected: Boolean(row.connected),
			lastSeen: row.last_seen,
		})),
	};
}

export function loadActiveMatch(matchId: string, now: number): StoredMatch | null {
	const snapshot = loadMatch(matchId);
	if (!snapshot) {
		return null;
	}

	if (snapshot.status === "completed" || snapshot.status === "player_left") {
		return null;
	}

	if (snapshot.rejoinDeadline !== null && snapshot.rejoinDeadline <= now) {
		deleteMatch(matchId);
		return null;
	}

	return snapshot;
}

export function pruneExpiredMatches(now: number): number {
	const db = getDatabase();
	const ids = db.prepare(SELECT_MATCHES_WITH_EXPIRED_DEADLINE_SQL).all(now) as Array<{ id: string }>;
	if (ids.length === 0) {
		return 0;
	}
	const remover = db.transaction((matchIds: Array<{ id: string }>) => {
		const deletePlayersStatement = db.prepare(`DELETE FROM match_players WHERE match_id = ?;`);
		const deleteMatchStatement = db.prepare(DELETE_MATCH_SQL);
		for (const { id } of matchIds) {
			deletePlayersStatement.run(id);
			deleteMatchStatement.run(id);
		}
	});
	remover(ids);
	return ids.length;
}

export function saveMatchHistory(params: {
	matchId: string;
	player1Id: number;
	player2Id: number;
	player1Score: number;
	player2Score: number;
	winnerId: number;
	matchType: '1v1' | 'tournament';
	tournamentCode?: string | null;
	durationSeconds: number;
	createdAt: number;
}): void {
	try  {
		const db = getDatabase();
		
		const sql = `
		INSERT INTO match_history (
			id,
			player1_id, player2_id, 
			player1_score, player2_score, 
			winner_id, 
			match_type, tournament_code, 
			duration_seconds, 
			created_at, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`;
	
	const stmt = db.prepare(sql);
	stmt.run(
		params.matchId,
		params.player1Id,
		params.player2Id,
		params.player1Score,
		params.player2Score,
		params.winnerId,
		params.matchType,
		params.tournamentCode ?? null,
		params.durationSeconds,
		params.createdAt,
		Date.now()
	);
} catch (error){}
}
