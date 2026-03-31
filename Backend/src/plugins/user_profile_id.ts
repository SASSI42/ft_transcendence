import { FastifyInstance, FastifyPluginOptions, FastifyRequest} from "fastify"
import fp from 'fastify-plugin'

interface userType{
    id: number | string;
    username: string;
    Avatar: string
}

interface pongStatsType{
    total:number;
    wins: number;
}

interface xoStatsType{
    total:number;
    wins: number;
    user_id: number | string
}

interface pongStatsType{
    total:number;
    wins: number;
}

interface History_type{
    match_id:number | string;
    p1_score: number;
    p2_score: number;
    joined_at: string;
    p1_id: number | string;
    p1_username: string;
    p1_avatar: string | null;
    p2_id: number | string;
    p2_username: string;
    p2_avatar: string | null;
}

interface leaders_type{
    id: number | string
    username: string
    Avatar: string
    score: number
}

async function user_profile(fastify: FastifyInstance, opts: FastifyPluginOptions) {
    fastify.get('/api/user/user_profile/:id', async (request:FastifyRequest<{Params:{id:number}}>, reply) => {
        
        const Token = request.cookies.access_token;
        if (!Token){
            return reply.code(401).send({
                success:false,
                message: 'Unauthorized: Access token missing.'
            })
        }
        try {
            let decoded = null
            try{
                decoded = await fastify.jwt.verify(Token) as any;
            }catch(error)
            {
                request.log.error(error);
                return reply.code(400).send({
                    success: false,
                    message: "The token is expired"
                })
            }
            const {id} = request.params;
            if (!id || id < 1)
            return(reply.code(401).send({
                        success:false,
                        message : "invalid id"
                }))
            const user = fastify.db.prepare("SELECT id, username, email, Avatar FROM users WHERE id = ?").get(id) as userType | undefined;
            if (!user)
                return reply.status(404).send({ error: "User not found" });

            const pongStats = fastify.db.prepare(`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(
                        SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END), 0
                    ) AS wins
                FROM match_history 
                WHERE player1_id = ? OR player2_id = ?
            `).get(user.id, user.id, user.id) as pongStatsType;


            const xoHistory = fastify.db.prepare(`
                                SELECT p1.match_id, CAST(p1.score AS INTEGER) as p1_score, CAST(p2.score AS INTEGER) as p2_score,p1.joined_at,
                                    u1.username as p1_username, u1.Avatar as p1_avatar, u1.id as p1_id,
                                    u2.username as p2_username, u2.Avatar as p2_avatar, u2.id as p2_id
                                FROM xo_match_players p1
                                JOIN xo_match_players p2 ON p1.match_id = p2.match_id AND p1.user_id != p2.user_id
                                JOIN users u1 ON p1.user_id = u1.id
                                JOIN users u2 ON p2.user_id = u2.id
                                WHERE p1.user_id = ?
                                ORDER BY p1.joined_at DESC LIMIT 80
                            `).all(user.id) as History_type[];


            const xoStats = fastify.db.prepare(`
                            SELECT
                                u.id AS user_id,
                                COUNT(DISTINCT p.match_id) AS total,
                                COALESCE(
                                    SUM(CASE WHEN m.winner_id = u.id THEN 1 ELSE 0 END),
                                    0
                                ) AS wins
                            FROM users u
                            LEFT JOIN xo_match_players p
                                ON p.user_id = u.id
                            LEFT JOIN xo_matches m
                                ON m.id = p.match_id
                            WHERE u.id = ?
                            GROUP BY u.id
                            `).get(user.id) as xoStatsType;

            const tournamentStats = fastify.db.prepare(`
                                    SELECT
                                        (
                                        SELECT COUNT(DISTINCT m.tournament_code)
                                        FROM match_history m
                                        WHERE m.match_type = 'tournament'
                                            AND m.tournament_code IS NOT NULL
                                            AND (m.player1_id = ? OR m.player2_id = ?)
                                        ) AS total_played,

                                        (
                                        SELECT COUNT(*)
                                        FROM tournament_history th
                                        WHERE th.winner_id = ?
                                        ) AS total_won;
                                    `).get(user.id, user.id, user.id);



            const pongHistory = fastify.db.prepare(`
                                SELECT 
                                    m.id AS match_id,
                                    m.player1_score AS p1_score,
                                    m.player2_score AS p2_score,
                                    m.created_at,
                                    -- Player 1 Data
                                    u1.username AS p1_username, 
                                    u1.Avatar AS p1_avatar, 
                                    u1.id AS p1_id,
                                    -- Player 2 Data
                                    u2.username AS p2_username, 
                                    u2.Avatar AS p2_avatar, 
                                    u2.id AS p2_id
                                FROM match_history m
                                JOIN users u1 ON m.player1_id = u1.id
                                JOIN users u2 ON m.player2_id = u2.id
                                WHERE m.player1_id = ? OR m.player2_id = ?
                                ORDER BY m.created_at DESC LIMIT 80
                            `).all(user.id, user.id) as History_type[];

                const xoLeaderboard = fastify.db.prepare(`
                                        SELECT
                                            u.id, u.username, u.Avatar, xo.wins AS score
                                        FROM users u
                                        JOIN (
                                            SELECT
                                            p.user_id,
                                            SUM(
                                                CASE 
                                                WHEN m.winner_id = p.user_id THEN 1 
                                                ELSE 0 
                                                END
                                            ) AS wins
                                            FROM (
                                            SELECT DISTINCT user_id, match_id
                                            FROM xo_match_players
                                            ) p
                                            JOIN xo_matches m ON m.id = p.match_id
                                            GROUP BY p.user_id
                                        ) xo ON xo.user_id = u.id
                                        ORDER BY score DESC
                                        LIMIT 20;
                                        `).all() as leaders_type[];

            const pingPongLeaderboard = fastify.db.prepare(`
                                SELECT 
                                    u.id, 
                                    u.username, 
                                    u.Avatar,
                                    pong.wins AS score
                                FROM users u
                                JOIN (
                                    -- Calculate total wins per user from the Pong match history
                                    SELECT winner_id, COUNT(*) as wins 
                                    FROM match_history 
                                    WHERE winner_id IS NOT NULL
                                    GROUP BY winner_id
                                ) pong ON u.id = pong.winner_id
                                ORDER BY score DESC
                                LIMIT 20
                            `).all() as leaders_type[];

            const get_user = fastify.db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as userType | undefined;

            if (!get_user)
            {
                return reply.code(400).send({
                    success: false,
                    message: "User account not found."
                })
            }

            reply.code(200).send({
                success: true,
                user_data: get_user,
                pong:{
                    stats: pongStats,
                    history: pongHistory,
                    leaders: pingPongLeaderboard,
                    tournaments: tournamentStats
                },
                xo:{
                    stats: xoStats,
                    history: xoHistory,
                    leaders: xoLeaderboard
                },
            })
                
        } catch (error) {
            return reply.code(404).send({
                success: false,
                message: 'Error serving file',
            });
        }
    });
}

export default fp(user_profile, {
    name: 'serve-uploads'
})