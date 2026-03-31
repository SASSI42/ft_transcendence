import { Server } from 'socket.io';
import { Database } from 'better-sqlite3';
import { FriendsService } from './FriendsService';

export type UserStatus = 'ONLINE' | 'IN-GAME' | 'IN-QUEUE' | 'OFFLINE';

interface UserSession {
    socketId: string;
    status: UserStatus;
}

export const userSessions = new Map<number, UserSession>();

export function getSocketId(userId: number): string | undefined {
    return userSessions.get(userId)?.socketId;
}

export function setUserStatus(db: Database, io: Server, userId: number, status: UserStatus) {
    const session = userSessions.get(userId);
    if (!session) return;

    session.status = status;
    userSessions.set(userId, session);

    notifyFriendsStatus(db, io, userId, status);
}

export function notifyFriendsStatus(db: Database, io: Server, userId: number, status: UserStatus) {
    try {
        const friends = FriendsService.getFriendsToNotify(db, userId);
        friends.forEach((friend: any) => {
            const friendSocketId = getSocketId(friend.id);
            if (friendSocketId) {
                io.to(friendSocketId).emit('friend_status_change', { 
                    userId, 
                    status: status.toLowerCase() 
                });
            }
        });
    } catch (error) {
        console.error(`[Status] Failed to notify friends of ${userId}:`, error);
    }
}

export function isUserOnline(userId: number): boolean {
    return userSessions.has(userId);
}