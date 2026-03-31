import { Database } from 'better-sqlite3';

type PlayerRoleRow = {
  role: string;
};

export const addPlayer = (
  db: Database,
  matchId: string,
  userId: number,
  role: string
) => {
  const sql = `INSERT INTO xo_match_players (match_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`;
  const now = new Date().toISOString();
  db.prepare(sql).run([matchId, userId, role, now]);
};

export const getPlayers = (db: Database, matchId: string) => {
  const sql = `SELECT * FROM xo_match_players WHERE match_id = ?`;
  db.prepare(sql).all([matchId]);
};

export const getPlayerRole = (db: Database, matchId: string, userId: string) => {
  const sql = `SELECT role FROM xo_match_players WHERE match_id = ? AND user_id = ?`;
  const row = db.prepare(sql).get([matchId, userId]) as PlayerRoleRow | undefined;

  return row ? row.role : null;
};
