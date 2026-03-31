import { FastifyInstance } from 'fastify';
import { MessagesService } from '../services/MessagesService';

interface JWTPayload {
    sub?: number;
    id?: number;
    username: string;
}
const HistorySchema = {
    params: {
        type: 'object',
        required: ['friendId'],
        properties: {
            friendId: { type: 'integer', minimum: -1 }
        }
    }
};
export async function messagesRoutes(fastify: FastifyInstance) {

    fastify.get('/messages/history/:friendId', { schema: HistorySchema }, async (request, reply) => {
        try {
            const userToken = request.user as JWTPayload;
            const userId = Number(userToken.sub || userToken.id);
            const { friendId } = request.params as { friendId: number };
            
            const history = MessagesService.getMessageHistory(
                fastify.db,
                userId,
                friendId
            );
            return reply.code(200).send(history);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    });

    fastify.get('/messages/unread', async (request, reply) => {
        try {
            const userToken = request.user as JWTPayload;
            const userId = Number(userToken.sub || userToken.id);
            const unreadMessages = MessagesService.getUnreadMessages(fastify.db, userId);
            return reply.code(200).send(unreadMessages);
        } catch (error: any) {
            return reply.code(400).send({ error: error.message });
        }
    });


}