import { FastifyInstance } from 'fastify';
import { Socket } from 'socket.io';
import * as cookie from 'cookie';

export interface AuthenticatedSocket extends Socket {
    data: {
        user: {
            id: number;
            username: string;
        };
    };
}
export const socketAuthMiddleware = (fastify: FastifyInstance) => {

    return (socket: Socket, next: (err?: Error) => void) => {
        try {
            let token = socket.handshake.auth.token ;
            if (!token && socket.handshake.headers.cookie) {
                const cookies = cookie.parse(socket.handshake.headers.cookie);
                token = cookies.access_token;
            }

            if (!token) return next(new Error('Authentication error: No token found'));

            const decoded: any = fastify.jwt.verify(token);
            socket.data.user = {
                id: decoded.sub || decoded.id,
                username: decoded.name || decoded.username
            };
            next();
        } catch (err) {
            console.error("Socket Auth Failed:", err);
            next(new Error('Authentication error: Invalid token'));
        }
    };
};