import fastify, {FastifyPluginAsync, FastifyReply, FastifyRequest} from "fastify";
import fp from 'fastify-plugin'
import  Database from 'better-sqlite3';
import path from "path";
import { setDatabase } from '../game-db/database';

const DatabasePlugin:FastifyPluginAsync = async (fastify)=>{
    const dbPath = path.resolve(process.cwd(), 'DATABASE.db');
    const db = new Database(dbPath);

    // ✅ Enable foreign key constraints (CRITICAL: SQLite doesn't enforce them by default)
    db.pragma('foreign_keys = ON');

     // 1. Users Table (From User Management)
    db.prepare(`CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        password TEXT,
        email TEXT,
        salt TEXT,
        twoFactorCode TEXT,
        ResetCode TEXT,
        usedCode NUMERIC,
        token TEXT,
        Avatar TEXT,
        twoFA NUMERIC,
        oauth_name NUMIRIC,
        oauth2 NUMERIC
        )`).run();
    
    // 2. Chat & Friends Tables (From Chat Module)
    
    // Friendships
    db.prepare(`
        CREATE TABLE IF NOT EXISTS friendships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            friend_id INTEGER NOT NULL,
            status TEXT CHECK(status IN ('pending', 'accepted')) DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, friend_id)
        )
    `).run();
    // db.prepare(`
    //     CREATE TABLE IF NOT EXISTS friendships (
    //         user_id INTEGER NOT NULL,
    //         friend_id INTEGER NOT NULL,
    //         status TEXT CHECK(status IN ('pending', 'accepted')) DEFAULT 'pending',
    //         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    //         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    //         PRIMARY KEY (user_id, friend_id),
    //         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    //         FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
    //     );
    // `).run();

    // Messages
    db.prepare(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            read BOOLEAN DEFAULT 0,
            is_invite BOOLEAN DEFAULT 0,
            is_blocked BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `).run();

    // Game Invites
    db.prepare(`
        CREATE TABLE IF NOT EXISTS game_invites (
            id TEXT PRIMARY KEY,
            sender_id INTEGER,
            receiver_id INTEGER NOT NULL,
            status TEXT CHECK(status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
            game_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `).run();

    // Blocked Users
    db.prepare(`
        CREATE TABLE IF NOT EXISTS blocked_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blocker_id INTEGER NOT NULL,
            blocked_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(blocker_id, blocked_id)
        )
    `).run();

    // 3. Game Tables (From Pong Game Module)
    
    // Matches
    db.prepare(`
        CREATE TABLE IF NOT EXISTS matches (
            id TEXT PRIMARY KEY,
            status TEXT CHECK(status IN ('waiting', 'ready', 'playing', 'paused', 'completed', 'player_left')) DEFAULT 'waiting',
            state_json TEXT NOT NULL,
            rejoin_deadline INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `).run();

    // Match Players
    db.prepare(`
        CREATE TABLE IF NOT EXISTS match_players (
            match_id TEXT NOT NULL,
            side TEXT CHECK(side IN ('left', 'right')) NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            ready BOOLEAN DEFAULT 0,
            connected BOOLEAN DEFAULT 1,
            last_seen INTEGER NOT NULL,
            PRIMARY KEY (match_id, side),
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `).run();

    // Tournaments
    db.prepare(`
        CREATE TABLE IF NOT EXISTS tournaments (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            status TEXT CHECK(status IN ('registration', 'in_progress', 'completed', 'cancelled')) DEFAULT 'registration',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            state_json TEXT NOT NULL
        )
    `).run();

    // Tournament Participants (legacy table, kept for potential future use)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS tournament_participants (
            tournament_code TEXT NOT NULL,
            alias TEXT NOT NULL,
            user_id INTEGER,
            seed INTEGER,
            eliminated BOOLEAN DEFAULT 0,
            final_rank INTEGER,
            joined_at INTEGER NOT NULL,
            PRIMARY KEY (tournament_code, alias),
            FOREIGN KEY (tournament_code) REFERENCES tournaments(code) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `).run();

    // 5. Match History (for statistics)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS match_history (
            id TEXT PRIMARY KEY,
            player1_id INTEGER NOT NULL,
            player2_id INTEGER NOT NULL,
            winner_id INTEGER,
            player1_score INTEGER NOT NULL,
            player2_score INTEGER NOT NULL,
            match_type TEXT CHECK(match_type IN ('1v1', 'tournament')) NOT NULL,
            tournament_code TEXT,
            duration_seconds INTEGER,
            created_at INTEGER NOT NULL,
            completed_at INTEGER NOT NULL,
            FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (tournament_code) REFERENCES tournaments(code) ON DELETE SET NULL
        )
    `).run();

    // Tournament History (for statistics)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS tournament_history (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            winner_id INTEGER,
            winner_alias TEXT,
            total_participants INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            completed_at INTEGER NOT NULL,
            FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
    )
        `).run()
    //XO GAMES TABLES
    db.prepare(`
        CREATE TABLE IF NOT EXISTS xo_matches (
        id TEXT PRIMARY KEY,    -- the 'matchId' used in GameManager
        created_at TEXT,
        finished_at TEXT,   -- filled when status becomes 'FINISHED'
        state TEXT,    -- stores the series state: 'ONGOING', 'FINISHED', 'CANCELLED'
        winner_id INTEGER  -- the userId of the SERIES winner (first to 2 wins)/Best of 3
        );
    `).run();

    //XO PLAYERS TABLES
    db.prepare(`
        CREATE TABLE IF NOT EXISTS xo_match_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id TEXT,
        user_id INTEGER,
        score INTEGER DEFAULT 0,    -- stores round wins (0, 1, or 2)/Best of 3
        role CHAR(1),  --X or O
        joined_at TEXT,
        FOREIGN KEY(match_id) REFERENCES xo_matches(id)
        );
    `).run();

    // 4. Create Indexes
 db.exec(`
        CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
        CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
        CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
        
        CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
        CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);
        CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id);
        
        CREATE INDEX IF NOT EXISTS idx_game_invites_receiver_id ON game_invites(receiver_id);
        CREATE INDEX IF NOT EXISTS idx_game_invites_status ON game_invites(status);
        
        CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker_id);
        CREATE INDEX IF NOT EXISTS idx_blocked_pair ON blocked_users(blocker_id, blocked_id);

        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at);

        CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
        CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);
        CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
        CREATE INDEX IF NOT EXISTS idx_tournament_participants_user ON tournament_participants(user_id);

        CREATE INDEX IF NOT EXISTS idx_match_history_player1 ON match_history(player1_id);
        CREATE INDEX IF NOT EXISTS idx_match_history_player2 ON match_history(player2_id);
        CREATE INDEX IF NOT EXISTS idx_match_history_winner ON match_history(winner_id);
        CREATE INDEX IF NOT EXISTS idx_match_history_completed ON match_history(completed_at);
        CREATE INDEX IF NOT EXISTS idx_tournament_history_winner ON tournament_history(winner_id);

    `);
    // SEED SYSTEM USER
    const systemUser = db.prepare('SELECT id FROM users WHERE id = ?').get(-1);
    
    if (!systemUser) {
        db.prepare(`
            INSERT INTO users (id, username, email, password, Avatar)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            -1, 
            'Pingo', 
            'system@pong.com', 
            'system_secure_pass', // Nobody knows this
            'https://ui-avatars.com/api/?name=System&background=000&color=fff'
        );
    }

    fastify.decorate('db', db);
    
    // Set the database instance for game modules
    setDatabase(db);
    
    fastify.addHook('onClose', ()=>{db.close();})
}

export default fp(DatabasePlugin, {
    name: 'database'
})
