import { FastifyInstance} from 'fastify';
import { FriendsService } from '../services/FriendsService';
import { userSessions } from '../services/UserStatusService';

interface UserRow {
    id: number;
    username: string;
    Avatar: string;
}

interface JWTPayload {
    sub?: number;
    id?: number;
    username: string;
}

const FindUserSchema = {
    params: {
        type: 'object',
        required: ['username'],
        properties: {
            username: { type: 'string', minLength: 3, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$' }
        }
    }
};

export async function friendsRoutes(fastify: FastifyInstance) {

    fastify.get('/friends', async (request, reply) => {
        try {
            const userToken = request.user as JWTPayload;
            const userId = Number(userToken.sub || userToken.id);
            
            const friends = FriendsService.getUnifiedFriendList(fastify.db, userId);

            const friendsWithStatus = friends.map((friend: any) => {
                const session = userSessions.get(friend.id);
                return {
                    ...friend,
                    status: session ? session.status.toLowerCase() : 'offline'
                };
            });

            return reply.code(200).send(friendsWithStatus);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    });

    fastify.get('/friends/find/:username', { schema: FindUserSchema },async (request, reply) => {
        try {
            const { username } = request.params as { username: string };

            const userToken = request.user as JWTPayload;
            const currentUserId = Number(userToken.sub || userToken.id);

            const user = fastify.db.prepare('SELECT id, username, Avatar FROM users WHERE username = ?').get(username) as UserRow | undefined;
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }
            const friendship = fastify.db.prepare(`
                SELECT user_id, status FROM friendships 
                WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
            `).get(currentUserId, user.id, user.id, currentUserId) as any;

            let relation = 'none';
            if (friendship) {
                if (friendship.status === 'accepted') {
                    relation = 'friends';
                } else if (friendship.status === 'pending') {
                    relation = (friendship.user_id === currentUserId) ? 'pending_sent' : 'pending_received';
                }
            }

            return reply.code(200).send({ ...user, relation });

        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    });

    fastify.get('/friends/pending', async (request, reply) => {
        try {
            const userToken = request.user as JWTPayload;
            const userId = Number(userToken.sub || userToken.id);
    
            const requests = FriendsService.getPendingRequests(fastify.db, userId);
            return reply.code(200).send(requests);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    });

    fastify.get('/friends/sent', async (request, reply) => {
        try {
            const userToken = request.user as JWTPayload;
            const userId = Number(userToken.sub || userToken.id);
    
            const requests = FriendsService.getSentRequests(fastify.db, userId);
            return reply.code(200).send(requests);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    });
}