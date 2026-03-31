import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { MessagesService } from '../services/MessagesService';
import { GameInvitesService } from '../services/GameInvitesService';
import { FriendsService } from '../services/FriendsService';
import { AuthenticatedSocket } from '../middleware/socketAuth';
import { Database } from 'better-sqlite3';

import matchmakingHandler from '../game/socket/matchmakingHandler';
import { gameHandler } from '../game/socket/gameHandler';
import { initiateMatch } from '../game/matchmaking/MatchmakingManager';
import { QueueEntry } from '../game/matchmaking/MatchmakingQueue';
import { createGameServices, registerGameSocketHandlers, isUserInPongGame } from './gameHandlers';
import { userSessions, notifyFriendsStatus, UserStatus, setUserStatus } from '../services/UserStatusService';
import { PlayerTicket } from '../game/gameRoom';
import { gameManager } from '../game/logic/GameManager';

const SendMessageSchema = z.object({
    receiverId: z.number().int().positive(),
    content: z.string().min(1).max(2000)
});

const MarkReadSchema = z.object({
    senderId: z.number().int().min(-1)
});

const GameInviteSchema = z.object({
    receiverId: z.number().int().positive(),
    gameId: z.enum(['PONG', 'TICTACTOE'])
});

const InviteIdSchema = z.object({
    inviteId: z.uuid().or(z.string().min(1).max(2000))
});

const FriendIdSchema = z.object({
    friendId: z.number().int().positive()
});

const FriendUsernameSchema = z.object({
    username: z.string().min(4).max(20).regex(/^[a-zA-Z0-9_]+$/)
});

const BlockUserSchema = z.object({
    blockedUserId: z.number().int().positive()
});

export function setupSocketHandlers(db: Database, io: Server) {

    const { matchmaking, roomManager, tournamentRegistry } = createGameServices(io);

    io.on('connection', (rawSocket: Socket) => {
        const socket = rawSocket as AuthenticatedSocket;
        const userId = socket.data.user.id;

        if (userId) {
            const oldSession = userSessions.get(userId);
            if (oldSession && oldSession.socketId !== socket.id) {
                const oldSocket = io.sockets.sockets.get(oldSession.socketId);
                if (oldSocket) oldSocket.disconnect(true);
            }
            
            registerGameSocketHandlers(io, socket, matchmaking, roomManager, tournamentRegistry);
            matchmakingHandler(db, io, socket);
            gameHandler(db, io, socket);
            let status: UserStatus = "ONLINE";
            const matchId = gameManager.getPlayerCurrentMatch(userId)
            if (matchId || isUserInPongGame(userId, roomManager, tournamentRegistry)) status = "IN-GAME";
            userSessions.set(userId, { socketId: socket.id, status: status });
            notifyFriendsStatus(db, io, userId, status);
        }

        const updateInviteStatus = (inviteId: string, status: string) => {
            const updatedMsg = MessagesService.updateInviteMessage(db, inviteId, status);
            if (updatedMsg) {
                const senderSocket = userSessions.get(updatedMsg.senderId)?.socketId;
                const receiverSocket = userSessions.get(updatedMsg.receiverId)?.socketId;
                
                if (senderSocket) io.to(senderSocket).emit('message_updated', updatedMsg);
                if (receiverSocket && !updatedMsg.isBlocked) io.to(receiverSocket).emit('message_updated', updatedMsg);
            }
        };

        socket.on('send_message', async (rawData) => {
            const validation = SendMessageSchema.safeParse(rawData);
            if (!validation.success) return socket.emit('error', { message: 'Invalid message data' });
            
            const data = validation.data;
            try {
                if (!userId || data.receiverId == userId) return;
                const message = MessagesService.sendMessage(db, userId, data.receiverId, data.content);
                socket.emit('message_sent', message);
                
                if (!message.isBlocked) {
                    const receiverSocketId = userSessions.get(data.receiverId)?.socketId;
                    if (receiverSocketId) io.to(receiverSocketId).emit('new_message', message);
                }
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('mark_all_read', async (rawData) => { 
            const validation = MarkReadSchema.safeParse(rawData);
            if (!validation.success) return;

            try {
                if (!userId) return;
                const result = MessagesService.markAllAsRead(db, userId, validation.data.senderId);
                socket.emit('all_messages_marked_read', result);
            } catch (error: any) { socket.emit('error', { message: error.message }); }
        });

        socket.on('send_game_invite', async (rawData) => {
            const validation = GameInviteSchema.safeParse(rawData);
            if (!validation.success) return socket.emit('error', { message: 'Invalid invite data' });
            const data = validation.data;

            try {
                if (!userId || FriendsService.isBlocked(db, data.receiverId, userId) || userId === data.receiverId) return;
                if (userSessions.get(data.receiverId)?.status != 'ONLINE') return;
                if (userSessions.get(userId)?.status != 'ONLINE') return;

                const { invite, message, isBlocked } = GameInvitesService.sendGameInvite(db, userId, data.receiverId, data.gameId);
                setUserStatus(db, io, userId, "IN-QUEUE");
                socket.emit('game_invite_sent', invite);
                if (message) socket.emit('message_sent', message);

                if (!isBlocked) {
                    const receiverSocketId = userSessions.get(data.receiverId)?.socketId;
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit('game_invite_received', invite);
                        if (message) io.to(receiverSocketId).emit('new_message', message);
                    }

                    setTimeout(() => {
                        const currentInvite = GameInvitesService.getInviteById(db, invite.id);
                        if (currentInvite && currentInvite.status === 'pending') {
                            setUserStatus(db, io, userId, "ONLINE");
                            GameInvitesService.expireInvite(db, invite.id);
                            
                            const s1 = userSessions.get(invite.senderId)?.socketId;
                            const s2 = userSessions.get(invite.receiverId)?.socketId;
                            if (s1) io.to(s1).emit('game_invite_expired', { inviteId: invite.id });
                            if (s2) io.to(s2).emit('game_invite_expired', { inviteId: invite.id });

                            updateInviteStatus(invite.id, 'EXPIRED');
                        }
                    }, 30 * 1000);
                } else {
                    setTimeout(() => {
                        const currentInvite = GameInvitesService.getInviteById(db, invite.id);
                        if (currentInvite && currentInvite.status === 'pending') {
                            setUserStatus(db, io, userId, "ONLINE");
                            GameInvitesService.expireInvite(db, invite.id);
                            const s1 = userSessions.get(invite.senderId)?.socketId;
                            if (s1) io.to(s1).emit('game_invite_expired', { inviteId: invite.id });
                            updateInviteStatus(invite.id, 'EXPIRED');
                        }
                    }, 30 * 1000);
                }

            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('accept_game_invite', async (rawData) => {
            const validation = InviteIdSchema.safeParse(rawData);
            if (!validation.success) return socket.emit('error', { message: 'Invalid invite ID' });
            const data = validation.data;

            try {
                if (!userId) return;
                const get_invite = GameInvitesService.getInviteById(db, data.inviteId);
                if (get_invite && (FriendsService.isBlocked(db, get_invite.senderId, userId) || userSessions.get(userId)?.status !== 'ONLINE')) return;
            
                const invite = GameInvitesService.acceptGameInvite(db, data.inviteId, userId);
                
                socket.emit('game_invite_accepted', invite.gameId);
                const senderSocketId = userSessions.get(invite.senderId)?.socketId;
                    setUserStatus(db, io, invite.senderId, "ONLINE");
                if (senderSocketId) io.to(senderSocketId).emit('game_invite_accepted', invite.gameId);
                
                updateInviteStatus(invite.id, 'ACCEPTED');
                
                const p1: QueueEntry = { userId: invite.senderId, socketId: senderSocketId!, timestamp: 0 };
                const p2: QueueEntry = { userId: invite.receiverId, socketId: userSessions.get(invite.receiverId)?.socketId!, timestamp: 0 };

                if (invite.gameId === 'TICTACTOE') {
                    initiateMatch(db, io, p1, p2);
                }
                else if (invite.gameId === 'PONG') {
                    const senderSocketId = userSessions.get(invite.senderId)?.socketId;
                    const receiverSocketId = userSessions.get(invite.receiverId)?.socketId;
                    
                    if (!senderSocketId || !receiverSocketId) return socket.emit('error', { message: 'Player socket not available' });
                    
                    const senderSocket = io.sockets.sockets.get(senderSocketId);
                    const receiverSocket = io.sockets.sockets.get(receiverSocketId);
                    
                    if (!senderSocket || !receiverSocket) return socket.emit('error', { message: 'Player socket connection lost' });
                    
                    const player1: PlayerTicket = { socket: senderSocket, userId: invite.senderId, username: invite.senderUsername || 'Player1' };
                    const player2: PlayerTicket = { socket: receiverSocket, userId: invite.receiverId, username: invite.receiverUsername || 'Player2' };
                    
                    setTimeout(() => {
                        const room = roomManager.createRoom([player1, player2]);
                    }, 300);
                }
            } catch (error: any) {
                if (error.message.includes('expired')) socket.emit('game_invite_expired', { inviteId: data.inviteId });
                socket.emit('error', { message: error.message });
            }
        });

        socket.on('decline_game_invite', async (rawData) => {
            const validation = InviteIdSchema.safeParse(rawData);
            if (!validation.success) return; 
            const data = validation.data;

            try {
                if (!userId) return;
                const invite = GameInvitesService.getInviteById(db, data.inviteId);
                if (invite && FriendsService.isBlocked(db, invite.senderId, userId)) return;
                GameInvitesService.declineGameInvite(db, data.inviteId, userId);
                if (invite) {
                    setUserStatus(db, io, invite.senderId, "ONLINE");
                    const senderSocketId = userSessions.get(invite.senderId)?.socketId;
                    if (senderSocketId) io.to(senderSocketId).emit('game_invite_declined', { inviteId: data.inviteId });
                    updateInviteStatus(invite.id, 'DECLINED');
                }
            } catch (error: any) {
                socket.emit('game_invite_cancelled', { inviteId: data.inviteId });
            }
        });

        socket.on('cancel_game_invite', async (rawData) => {
            const validation = InviteIdSchema.safeParse(rawData);
            if (!validation.success) return;
            const data = validation.data;

            try {
                if (!userId) return;
                const invite = GameInvitesService.cancelGameInvite(db, data.inviteId, userId);
                setUserStatus(db, io, userId, "ONLINE");
                socket.emit('game_invite_cancelled', { inviteId: data.inviteId });
                const receiverSocketId = userSessions.get(invite.receiverId)?.socketId;
                if (receiverSocketId && !FriendsService.isBlocked(db, userId, invite.receiverId)) io.to(receiverSocketId).emit('game_invite_cancelled', { inviteId: data.inviteId });

                updateInviteStatus(invite.id, 'CANCELLED');
            } catch (error: any) {
                socket.emit('game_invite_cancelled', { inviteId: data.inviteId });
                updateInviteStatus(data.inviteId, 'CANCELLED');
            }
        });

        socket.on('remove_friend', (rawData) => {
            const validation = FriendIdSchema.safeParse(rawData);
            if (!validation.success) return socket.emit('error', { message: 'Invalid friend ID' });
            const data = validation.data;

            if (!userId) return;
            
            try {
                FriendsService.removeFriend(db, userId, data.friendId);
                const cancelledInvites = GameInvitesService.cancelInvitesBetween(db, userId, data.friendId);

                cancelledInvites.forEach(invite => {
                    const s1 = userSessions.get(invite.senderId)?.socketId;
                    const s2 = userSessions.get(invite.receiverId)?.socketId;
                    if (s1) io.to(s1).emit('game_invite_cancelled', { inviteId: invite.id });
                    if (s2) io.to(s2).emit('game_invite_cancelled', { inviteId: invite.id });
                    
                    const updatedMsg = MessagesService.updateInviteMessage(db, invite.id, 'CANCELLED');
                    if (updatedMsg) {
                        if (s1) io.to(s1).emit('message_updated', updatedMsg);
                        if (s2) io.to(s2).emit('message_updated', updatedMsg);
                    }
                });

                const friendSocket = userSessions.get(data.friendId)?.socketId;
                if (friendSocket) io.to(friendSocket).emit('friend_removed', { friendId: userId });

            } catch (error) {
                socket.emit('error', { message: 'Failed to remove friend' });
            }
        });
    
        socket.on('send_friend_request', (rawData) => {
            const validation = FriendUsernameSchema.safeParse(rawData);
            if (!validation.success) return socket.emit('friend_request_sent_failure', 'Only letters, numbers, and _ allowed (4–20 characters)');
            const data = validation.data;

            if (!userId ) return;
            try {
                const result = FriendsService.sendFriendRequest(db, userId, data.username);
                if (result.operation !== 'success')
                {
                    socket.emit('friend_request_sent_failure', result.reason);
                    return ;
                }
                const sender = db.prepare('SELECT id, username, Avatar as avatarUrl FROM users WHERE id = ?').get(userId) as any;
                const friendId = result.friendId!;
                if (result.status === 'accepted') {
                    const receiverSocketId = userSessions.get(friendId)?.socketId;
                    const receiver = db.prepare('SELECT id, username, Avatar as avatarUrl FROM users WHERE id = ?').get(friendId) as any;
                    const myStatus = userSessions.get(userId)?.status;
                    const theirStatus = userSessions.get(friendId)?.status;
                    
                    socket.emit('new_friend', { ...receiver, status: theirStatus });
                    if (receiverSocketId) io.to(receiverSocketId).emit('new_friend', { ...sender, status: myStatus });
                }
                else {
                    const receiverSocketId = userSessions.get(friendId)?.socketId;
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit('friend_request_received', {
                            id: sender.id,
                            username: sender.username,
                            avatarUrl: sender.avatarUrl
                        });
                    }
                    socket.emit('friend_request_sent_success', { 
                        id: friendId,
                        friend_id: friendId,
                        username: data.username || 'Unknown', 
                        status: 'pending' 
                    });
                }
            } catch (error: any) { socket.emit('error', { message: error.message }); }
        });

        socket.on('accept_friend_request', (rawData) => {
            const validation = FriendIdSchema.safeParse(rawData);
            if (!validation.success) return socket.emit('error', { message: 'Invalid friend ID' });
            const data = validation.data;

            if (!userId) return;
            try {
                const result = FriendsService.acceptFriendRequest(db, userId, data.friendId);
                if (result.success === false)
                    return ;
        
                const me = db.prepare('SELECT id, username, Avatar as avatarUrl FROM users WHERE id = ?').get(userId) as any;
                const them = db.prepare('SELECT id, username, Avatar as avatarUrl FROM users WHERE id = ?').get(data.friendId) as any;
                const myStatus = userSessions.get(userId)?.status;
                const theirStatus = userSessions.get(data.friendId)?.status;
            
                socket.emit('new_friend', { ...them, status: theirStatus });
                const receiverSocketId = userSessions.get(data.friendId)?.socketId;
                if (receiverSocketId) io.to(receiverSocketId).emit('new_friend', { ...me, status: myStatus });

            } catch (error: any) { socket.emit('error', { message: error.message }); }
        });

        socket.on('decline_friend_request', (rawData) => {
            const validation = FriendIdSchema.safeParse(rawData);
            if (!validation.success) return; 
            const data = validation.data;

            if (!userId) return;
            try {
                FriendsService.declineFriendRequest(db, userId, data.friendId);
                socket.emit('friend_request_removed', { friendId: data.friendId });
                const senderSocketId = userSessions.get(data.friendId)?.socketId;
                if (senderSocketId) io.to(senderSocketId).emit('friend_request_removed', { friendId: userId });
            } catch (error: any) { socket.emit('error', { message: error.message }); }
        });

        socket.on('block_user', (rawData) => {
            const validation = BlockUserSchema.safeParse(rawData);
            if (!validation.success) return;
            const data = validation.data;

            if (!userId || data.blockedUserId === userId) return;
            try {
                const cancelledInvites = GameInvitesService.cancelInvitesBetween(db, userId, data.blockedUserId);
                cancelledInvites.forEach(invite => {
                    const s1 = userSessions.get(invite.senderId)?.socketId;
                    const s2 = userSessions.get(invite.receiverId)?.socketId;
                    if (s1) io.to(s1).emit('game_invite_cancelled', { inviteId: invite.id });
                    if (s2) io.to(s2).emit('game_invite_cancelled', { inviteId: invite.id });
                    setUserStatus(db, io, invite.senderId, "ONLINE");
                    
                    const updatedMsg = MessagesService.updateInviteMessage(db, invite.id, 'CANCELLED');
                    if (updatedMsg) {
                        if (s1) io.to(s1).emit('message_updated', updatedMsg);
                        if (s2) io.to(s2).emit('message_updated', updatedMsg);
                    }
                });

                FriendsService.blockUser(db, userId, data.blockedUserId);
                socket.emit('friend_blocked', {userId: data.blockedUserId});
                
            } catch (error: any) { socket.emit('error', { message: error.message }); }
        });

        socket.on('unblock_user', (rawData) => {
            const validation = BlockUserSchema.safeParse(rawData);
            if (!validation.success) return;
            const data = validation.data;

            if (!userId) return;
            try {
                FriendsService.unblockUser(db, userId, data.blockedUserId);
                socket.emit('friend_unblocked', { userId: data.blockedUserId });
            } catch (error: any) { socket.emit('error', { message: error.message }); }
        });

        socket.on('disconnect', () => {
            if (userId) {
                userSessions.delete(userId);;
                notifyFriendsStatus(db, io, userId, 'OFFLINE');
                const cancelledInvites = GameInvitesService.cancelInvitesFromSender(db, userId);
                cancelledInvites.forEach(invite => {
                    const receiverSocket = userSessions.get(invite.receiverId)?.socketId;
                    if (receiverSocket) {
                        io.to(receiverSocket).emit('game_invite_cancelled', { inviteId: invite.id });
                    }
                    updateInviteStatus(invite.id, 'CANCELLED');
                });
            }
        });
    });
}