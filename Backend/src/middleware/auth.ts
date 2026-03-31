import { FastifyRequest, FastifyReply } from 'fastify';

declare module '@fastify/jwt' {
    interface FastifyJWT {
        user: {
            id: number;
            username: string;
        };
    }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    try {
        await request.jwtVerify();
    } catch (err) {
        reply.send(err);
    }
}