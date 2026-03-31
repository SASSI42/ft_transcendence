import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/useChatStore';
import type { Message, GameInvite } from '../types';
import getBackendUrl from '../api/getUrl';

class SocketService {
    socket: Socket | null = null;
    userId: number | null = null;
    private navigateFunction: ((path: string, options?: any) => void) | null = null;

    setNavigateFunction(navigate: (path: string) => void) {
        this.navigateFunction = navigate;
    }

    connect(userId: number) {
        if (this.socket?.connected) return;
    
        this.userId = userId;
        const SOCKET_URL = `${getBackendUrl()}:3000`;

        this.socket = io(SOCKET_URL, { 
            transports: ['websocket'], 
            withCredentials: true
        });

        this.setupListeners();
    }

    private setupListeners() {
        if (!this.socket) return;
        

        this.socket.on('connect_error', (err) => {
            console.error("Socket Connection Error:", err.message); 
        });
        this.socket.on('connect', () => {
        });


        const currentUserId = this.userId;
        if (currentUserId === null) return;

        this.socket.on('new_message', (msg: Message) => useChatStore.getState().addMessage(msg, currentUserId));
        this.socket.on('message_sent', (msg: Message) => useChatStore.getState().addMessage(msg, currentUserId));
        this.socket.on('message_updated', (msg: Message) => useChatStore.getState().updateMessage(msg));

        this.socket.on('friend_status_change', (data) => useChatStore.getState().setUserStatus(data.userId, data.status));

        this.socket.on('game_invite_received', (invite: GameInvite) => useChatStore.getState().setIncomingInvite(invite));
        this.socket.on('game_invite_sent', (invite: GameInvite) => useChatStore.getState().setOutgoingInvite(invite));
        
        this.socket.on('game_invite_accepted', (gameId) => {
            useChatStore.getState().setIncomingInvite(null);
            useChatStore.getState().setOutgoingInvite(null);

            if (gameId === 'PONG' && this.navigateFunction) {
                this.navigateFunction('/game/remote', { 
                    state: { fromInvite: true } 
                });
            }
        });

        this.socket.on('game_invite_declined', () => {
            useChatStore.getState().setOutgoingInvite(null);
        });

        this.socket.on('game_invite_cancelled', (data: { inviteId: string }) => {
            const { incomingInvite, outgoingInvite, setIncomingInvite, setOutgoingInvite } = useChatStore.getState();
            if (incomingInvite?.id === data.inviteId) setIncomingInvite(null);
            if (outgoingInvite?.id === data.inviteId) setOutgoingInvite(null);
        });

        this.socket.on('game_invite_expired', (data: { inviteId: string }) => {
            const { incomingInvite, outgoingInvite, setIncomingInvite, setOutgoingInvite } = useChatStore.getState();
            if (incomingInvite?.id === data.inviteId) {
                setIncomingInvite(null);
            }
            if (outgoingInvite?.id === data.inviteId) {
                setOutgoingInvite(null);
            }
        });
        this.socket.on('error', (err: {message: string}) => alert(err.message));
        
        
        this.socket.on('friend_request_received', (req) => {
            useChatStore.getState().addPendingRequest(req);
        });

        this.socket.on('friend_request_sent_success', (req) => {
            useChatStore.getState().addSentRequest(req);
        });

        this.socket.on('new_friend', (friend) => {
            const friendWithStatus = {
                ...friend,
                status: friend.status ? friend.status.toLowerCase() : 'offline'
            };
            useChatStore.getState().addFriend(friendWithStatus);
            useChatStore.getState().removePendingRequest(friend.id); 
        });

        this.socket.on('friend_request_removed', (data: { friendId: number }) => {
            useChatStore.getState().removePendingRequest(data.friendId);
        });

        this.socket.on('friend_blocked', (data: { userId: number }) => {
            useChatStore.getState().blockUser(data.userId);
        });

        this.socket.on('friend_unblocked', (data: { userId: number }) => {
            useChatStore.getState().unblockUser(data.userId);
        });

        this.socket.on('friend_removed', (data: { friendId: number }) => {
            useChatStore.getState().removeFriendState(data.friendId);
            useChatStore.getState().removePendingRequest(data.friendId); 
        });

    }


    

    removeFriend(friendId: number) { this.socket?.emit('remove_friend', { friendId }); }
    disconnect() { this.socket?.disconnect(); this.socket = null; }
    sendMessage(receiverId: number, content: string) { this.socket?.emit('send_message', { receiverId, content }); }
    sendGameInvite(receiverId: number, gameId: 'PONG' | 'TICTACTOE' = 'PONG') { this.socket?.emit('send_game_invite', { receiverId, gameId}); }
    acceptGameInvite(inviteId: string) { this.socket?.emit('accept_game_invite', { inviteId }); }
    declineGameInvite(inviteId: string) { this.socket?.emit('decline_game_invite', { inviteId }); }
    cancelGameInvite(inviteId: string) { this.socket?.emit('cancel_game_invite', { inviteId }); }

    sendFriendRequest(username: string) { this.socket?.emit('send_friend_request', { username }); }
    acceptFriendRequest(friendId: number) { this.socket?.emit('accept_friend_request', { friendId }); }
    declineFriendRequest(friendId: number) { this.socket?.emit('decline_friend_request', { friendId }); }
    blockUser(blockedUserId: number) { this.socket?.emit('block_user', { blockedUserId }); }
    unblockUser(blockedUserId: number) { this.socket?.emit('unblock_user', { blockedUserId }); }
    markAllRead(senderId: number) { this.socket?.emit('mark_all_read', { senderId }); }
}

export const socketService = new SocketService();