import { create } from 'zustand';
import type { Message, Friend, GameInvite } from '../types';

interface PendingRequest { id: number; username: string; avatarUrl: string}
type UserStatus = 'online' | 'offline' | 'in-game' | 'in-queue';

interface ChatState {

    friends: Friend[];
    pendingRequests: PendingRequest[];
    sentRequests: any[];
    
    messages: Record<number, Message[]>;
    selectedFriendId: number | null;
    unreadCounts: Record<number, number>;
    incomingInvite: GameInvite | null;
    outgoingInvite: GameInvite | null;

    setFriends: (friends: Friend[]) => void;
    setPendingRequests: (reqs: PendingRequest[]) => void;
    setSentRequests: (reqs: any[]) => void;
    
    setUserStatus: (userId: number, status: UserStatus) => void; 
    
    setUnreadCounts: (data: any[]) => void;

    addFriend: (friend: Friend) => void;
    removeFriendState: (friendId: number) => void;
    
    addPendingRequest: (req: PendingRequest) => void;
    removePendingRequest: (friendId: number) => void;
    addSentRequest: (req: any) => void;

    blockUser: (userId: number) => void;
    unblockUser: (userId: number) => void;

    selectFriend: (friendId: number) => void;
    
    addMessage: (message: Message, currentUserId: number) => void;
    updateMessage: (message: Message) => void;

    setMessages: (friendId: number, messages: Message[]) => void;
    setIncomingInvite: (invite: GameInvite | null) => void;
    setOutgoingInvite: (invite: GameInvite | null) => void;

    updateFriend: (userId: number, updates: Partial<Friend>) => void;
}

export const useChatStore = create<ChatState>((set) => ({

    friends: [], 
    pendingRequests: [], 
    sentRequests: [], 
    messages: {}, 
    selectedFriendId: null, 
    unreadCounts: {},
    incomingInvite: null, 
    outgoingInvite: null,

    setFriends: (friends) => set({ friends }),
    setPendingRequests: (reqs) => set({ pendingRequests: reqs }),
    setSentRequests: (reqs) => set({ sentRequests: reqs }),

    setUserStatus: (userId, status) => set((state) => ({
        friends: state.friends.map(f => 
            f.id === userId ? { ...f, status } : f
        )
    })),

    setUnreadCounts: (data) => set((state) => {
        const newCounts: Record<number, number> = {};
        data.forEach((item: any) => {
            if (item.senderId === state.selectedFriendId) {
                newCounts[item.senderId] = 0;
            } else {
                newCounts[item.senderId] = item.unreadCount;
            }
        });
        return { unreadCounts: newCounts };
    }),

    addFriend: (friend) => set((state) => ({
        friends: [friend, ...state.friends],
        pendingRequests: state.pendingRequests.filter(req => req.username !== friend.username),
        sentRequests: state.sentRequests.filter(req => req.friend_id !== friend.id)
    })),

    removeFriendState: (friendId) => set((state) => ({ 
        friends: state.friends.filter(f => f.id !== friendId),
        selectedFriendId: state.selectedFriendId === friendId ? null : state.selectedFriendId
    })),

    addPendingRequest: (req) => set((state) => ({ 
        pendingRequests: [req, ...state.pendingRequests] 
    })),

    removePendingRequest: (friendId) => set((state) => ({ 
        pendingRequests: state.pendingRequests.filter(req => req.id !== friendId),
        sentRequests: state.sentRequests.filter(req => req.id !== friendId)
    })),

    addSentRequest: (req) => set((state) => ({
        sentRequests: [req, ...state.sentRequests]
    })),

    blockUser: (userId) => set((state) => ({
        friends: state.friends.map(f => 
            f.id === userId ? { ...f, isBlocked: true } : f
        )
    })),

    unblockUser: (userId) => set((state) => ({
        friends: state.friends.map(f => 
            f.id === userId ? { ...f, isBlocked: false } : f
        )
    })),

    updateFriend: (userId, updates) => set((state) => ({
        friends: state.friends.map(f => 
            f.id === userId ? { ...f, ...updates } : f
        )
    })),

    selectFriend: (friendId) => {
        set({ selectedFriendId: friendId });
        set((state) => ({ unreadCounts: { ...state.unreadCounts, [friendId]: 0 } }));
    },

    addMessage: (message, currentUserId) => set((state) => {
        const otherId = message.senderId === currentUserId ? message.receiverId : message.senderId;
        
        const newMessages = { 
            ...state.messages, 
            [otherId]: [...(state.messages[otherId] || []), message] 
        };
        
        const isUnread = (message.senderId !== currentUserId) && (message.senderId !== state.selectedFriendId);
        const newUnread = isUnread 
            ? { ...state.unreadCounts, [message.senderId]: (state.unreadCounts[message.senderId] || 0) + 1 } 
            : state.unreadCounts;

        const friendIndex = state.friends.findIndex(f => f.id === otherId);
        let newFriends = [...state.friends];

        if (friendIndex !== -1) {
            const [friend] = newFriends.splice(friendIndex, 1);
            friend.lastMessageTime = new Date().toISOString(); 
            newFriends.unshift(friend);
        }

        return {
            messages: newMessages,
            unreadCounts: newUnread,
            friends: newFriends
        };
    }),

    updateMessage: (updatedMsg) => set((state) => {
        const newMessages = { ...state.messages };
        const updateArray = (list: Message[]) => list.map(m => m.id === updatedMsg.id ? updatedMsg : m);

        if (newMessages[updatedMsg.senderId]) newMessages[updatedMsg.senderId] = updateArray(newMessages[updatedMsg.senderId]);
        if (newMessages[updatedMsg.receiverId]) newMessages[updatedMsg.receiverId] = updateArray(newMessages[updatedMsg.receiverId]);
        
        return { messages: newMessages };
    }),

    setMessages: (friendId, history) => set((state) => ({ messages: { ...state.messages, [friendId]: history } })),
    setIncomingInvite: (invite) => set({ incomingInvite: invite }),
    setOutgoingInvite: (invite) => set({ outgoingInvite: invite }),
}));