import { getDatabase } from "../game-db/database";

export interface MatchStats {
	matchesPlayed: number;
	matchesWon: number;
	matchesLost: number;
	winRate: number;
}

export interface TournamentStats {
	tournamentsPlayed: number;
	tournamentsWon: number;
}

export interface PlayerStats {
	userId: number;
	matches: MatchStats;
	tournaments: TournamentStats;
}

export class StatsService {
	public pp_getUserStats(userId: number): PlayerStats {
		const db = getDatabase();
	
		// Query match history
		const matchesAsPlayer1 = db.prepare(`
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins
			FROM match_history
			WHERE player1_id = ?
		`).get(userId, userId) as { total: number; wins: number };
		
		const matchesAsPlayer2 = db.prepare(`
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins
			FROM match_history
			WHERE player2_id = ?
		`).get(userId, userId) as { total: number; wins: number };
		
		const totalMatches = matchesAsPlayer1.total + matchesAsPlayer2.total;
		const totalWins = matchesAsPlayer1.wins + matchesAsPlayer2.wins;
		const totalLosses = totalMatches - totalWins;
		const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;
		
		// Query tournament history
		const tournaments = db.prepare(`
			SELECT 
				COUNT(*) as participated
			FROM tournament_history th
			WHERE EXISTS (
				SELECT 1 FROM match_history mh
				WHERE mh.tournament_code = th.code
				AND (mh.player1_id = ? OR mh.player2_id = ?)
			)
		`).get(userId, userId) as { participated: number };
		
		const tournamentsWon = db.prepare(`
			SELECT COUNT(*) as won
			FROM tournament_history
			WHERE winner_id = ?
		`).get(userId) as { won: number };
		
		return {
			userId,
			matches: {
				matchesPlayed: totalMatches,
				matchesWon: totalWins,
				matchesLost: totalLosses,
				winRate: Math.round(winRate * 100) / 100,
			},
			tournaments: {
				tournamentsPlayed: tournaments.participated,
				tournamentsWon: tournamentsWon.won,
			},
		};
	}

	public xo_getUserStats(userId: number): PlayerStats {
		const db = getDatabase();
		
		// Query match history
		const player = db.prepare(`SELECT
			COUNT(DISTINCT p.match_id) AS matches_played,

			SUM(
			CASE
				WHEN m.state = 'FINISHED' AND m.winner_id = ?
				THEN 1 ELSE 0
			END
			) AS matches_won,

			SUM(
			CASE
				WHEN m.state = 'FINISHED'
				AND m.winner_id != ?
				AND m.winner_id IS NOT NULL
				THEN 1 ELSE 0
			END
			) AS matches_lost

		FROM xo_match_players p
		LEFT JOIN xo_matches m
			ON m.id = p.match_id
		WHERE p.user_id = ?
		`).get(userId, userId, userId) as {
		matches_played: number;
		matches_won: number;
		matches_lost: number;
		};


		const winRate = player.matches_played > 0 ? (player.matches_won / player.matches_played) * 100 : 0;
		
		return {
			userId,
			matches: {
				matchesPlayed: player.matches_played,
				matchesWon: player.matches_won,
				matchesLost: player.matches_lost,
				winRate: Math.round(winRate * 100) / 100,
			},
			tournaments: {
				tournamentsPlayed: -1,
				tournamentsWon: -1,
			},
		};
	}
	
	public pp_getRecentMatches(userId: number, limit: number = 10): Array<{
		player1Id: number;
		player2Id: number;
		player1Score: number;
		player2Score: number;
		winnerId: number;
		matchType: string;
		completedAt: number;
	}> {
		const db = getDatabase();
		
		const sql = `
			SELECT 
				player1_id, player2_id, 
				player1_score, player2_score,
				winner_id, match_type, completed_at
			FROM match_history
			WHERE player1_id = ? OR player2_id = ?
			ORDER BY completed_at DESC
			LIMIT ?
		`;
		
		const rows = db.prepare(sql).all(userId, limit) as Array<{
			player1_id: number;
			player2_id: number;
			player1_score: number;
			player2_score: number;
			winner_id: number;
			match_type: string;
			completed_at: number;
		}>;
		
		return rows.map(row => ({
			player1Id: row.player1_id,
			player2Id: row.player2_id,
			player1Score: row.player1_score,
			player2Score: row.player2_score,
			winnerId: row.winner_id,
			matchType: row.match_type,
			completedAt: row.completed_at,
		}));
	}

	public xo_getRecentMatches(userId: number, limit: number = 10): Array<{
		player1Id: number;
		player2Id: number;
		player1Score: number;
		player2Score: number;
		winnerId: number;
		matchType: string;
		completedAt: number;
	}> {
		const db = getDatabase();
		
		const sql = `SELECT
			m.finished_at AS finished_at,

			p.user_id AS player_Id
			p.score AS player_score,

			opp.user_id AS opponent_id,
			opp.score   AS opponent_score,

			m.winner_id AS match_winner

			FROM xo_match_players p

			JOIN xo_matches m
				ON m.id = p.match_id

			JOIN xo_match_players opp
				ON opp.match_id = p.match_id
			AND opp.user_id != p.user_id

			WHERE p.user_id = ?
			AND m.state = 'FINISHED'

			ORDER BY m.finished_at DESC
			LIMIT ?;
		`;
		
		const rows = db.prepare(sql).all(userId, limit) as Array<{
			finished_at: number;
			player_Id: number;
			player_score: number;
			opponent_id: number;
			opponent_score: number;
			match_winner: number;
		}>;
		
		return rows.map(row => ({
			player1Id: row.player_Id,
			player2Id: row.opponent_id,
			player1Score: row.player_score,
			player2Score: row.opponent_score,
			winnerId: row.match_winner,
			matchType: "",
			completedAt: row.finished_at,
		}));
	}
	
	public getRecentTournaments(userId: number, limit: number = 10): Array<{
		code: string;
		name: string;
		capacity: number;
		winnerId: number;
		winnerAlias: string;
		totalParticipants: number;
		createdAt: number;
		completedAt: number;
		userWon: boolean;
	}> {
		const db = getDatabase();
		
		const sql = `
			SELECT DISTINCT
				th.code, th.name, th.capacity,
				th.winner_id, th.winner_alias,
				th.total_participants, th.created_at, th.completed_at
			FROM tournament_history th
			INNER JOIN match_history mh ON mh.tournament_code = th.code
			WHERE mh.player1_id = ? OR mh.player2_id = ?
			ORDER BY th.completed_at DESC
			LIMIT ?
		`;
		
		const rows = db.prepare(sql).all(userId, userId, limit) as Array<{
			code: string;
			name: string;
			capacity: number;
			winner_id: number;
			winner_alias: string;
			total_participants: number;
			created_at: number;
			completed_at: number;
		}>;
		
		return rows.map(row => ({
			code: row.code,
			name: row.name,
			capacity: row.capacity,
			winnerId: row.winner_id,
			winnerAlias: row.winner_alias,
			totalParticipants: row.total_participants,
			createdAt: row.created_at,
			completedAt: row.completed_at,
			userWon: row.winner_id === userId,
		}));
	}
}
