import { Database } from 'better-sqlite3';

export const createMatch = (db: Database, matchId: string) => {
  const sql = `INSERT INTO xo_matches (id, created_at, state) VALUES (?, ?, ?)`;
  const now = new Date().toISOString();
  db.prepare(sql).run([matchId, now, "ONGOING"])
};

export const getMatch = (db: Database, matchId: string) => {
  const sql = `SELECT * FROM xo_matches WHERE id = ?`;
  return db.prepare(sql).get([matchId])
};

export const finishMatch = (db: Database, matchId: string, state: string, winnerId: number) => {
  const sql = `UPDATE xo_matches SET finished_at = ?, state = ?, winner_id = ? WHERE id = ?`;
  const now = new Date().toISOString();
  db.prepare(sql).run([now, state, winnerId, matchId])
};

export const updatePlayerScore = (db: Database, matchId: string, userId: number, score: number) => {
  const sql = `UPDATE xo_match_players SET score = ? WHERE match_id = ? AND user_id = ?`;
  db.prepare(sql).run(score, matchId, userId)
};