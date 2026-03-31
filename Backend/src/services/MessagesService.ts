import { Database } from 'better-sqlite3';
import { FriendsService } from './FriendsService';

export class MessagesService {

    static sendMessage(db: Database, senderId: number, receiverId: number, content: string, isInvite: boolean = false) {
        if (FriendsService.isBlocked(db, receiverId, senderId)) throw new Error('You have blocked this user');
        
        if (!FriendsService.areFriends(db, senderId, receiverId)) throw new Error('Can only send messages to friends');
        
        const isBlockedByReceiver = FriendsService.isBlocked(db, senderId, receiverId);
        
        if (content.length > 2000) {
            content = content.slice(0, 2000);
        }

        const result = db.prepare(`INSERT INTO messages (sender_id, receiver_id, content, is_invite, is_blocked) VALUES (?, ?, ?, ?, ?)`).run(senderId, receiverId, content, isInvite ? 1 : 0, isBlockedByReceiver ? 1 : 0);
        const messageId = result.lastInsertRowid as number;
        return { id: messageId, senderId, receiverId, content, read: false, isInvite, isBlocked: isBlockedByReceiver, createdAt: new Date() };
    }

    static sendSystemMessage(db: Database, receiverId: number, content: string) {
        const result = db.prepare(`
            INSERT INTO messages (sender_id, receiver_id, content, is_invite, is_blocked) 
            VALUES (?, ?, ?, 0, 0)
        `).run(-1, receiverId, content);
        
        return { 
            id: result.lastInsertRowid as number, 
            senderId: -1, 
            receiverId, 
            content, 
            read: false,
            isInvite: false,
            isBlocked: false,
            createdAt: new Date()
        };
    }

    static updateInviteMessage(db: Database, inviteId: string, status: string) {
        const msg = db.prepare(`SELECT * FROM messages WHERE content LIKE ?`).get(`INVITE::${inviteId}%`) as any;

        
        if (msg) {
            const parts = msg.content.split('::');
            const gameType = parts.length > 3 ? parts[3] : '';
            let newContent = `INVITE::${inviteId}::${status}`;
            if (gameType) newContent += `::${gameType}`;
            db.prepare(`UPDATE messages SET content = ? WHERE id = ?`).run(newContent, msg.id);

            return {
                id: msg.id,
                senderId: msg.sender_id,
                receiverId: msg.receiver_id,
                content: newContent,
                read: !!msg.read,
                isInvite: !!msg.is_invite,
                isBlocked: !!msg.is_blocked,
                createdAt: new Date(msg.created_at + 'Z').toISOString()
            };
        }
        return null;
    }

    static getMessageHistory(db: Database, userId1: number, userId2: number, limit: number = 100, offset: number = 0) {
        const stmt = db.prepare(`
            SELECT * FROM (
                SELECT m.id, m.sender_id, m.receiver_id, m.content, m.read, m.is_invite, m.is_blocked, m.created_at, 
                       sender.username as sender_username, sender.Avatar as sender_avatar
                FROM messages m
                JOIN users sender ON sender.id = m.sender_id
                WHERE 
                    ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))

                    AND (m.is_blocked = 0 OR m.sender_id = ?)
                
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            ) 
            ORDER BY created_at ASC
        `);

        return stmt.all(userId1, userId2, userId2, userId1, userId1, limit, offset).map((msg: any) => ({
            id: msg.id,
            senderId: msg.sender_id || 'SYSTEM',
            receiverId: msg.receiver_id,
            content: msg.content,
            read: !!msg.read,
            isInvite: !!msg.is_invite,
            isBlocked: !!msg.is_blocked,
            createdAt: msg.created_at.replace(' ', 'T') + 'Z',
            senderUsername: msg.sender_username || 'System',
            senderAvatar: msg.sender_avatar
        }));
    }

    static markAllAsRead(db: Database, userId: number, senderId: number) {
        const res = db.prepare(`UPDATE messages SET read = 1 WHERE receiver_id = ? AND sender_id = ? AND read = 0`).run(userId, senderId);
        return { count: res.changes };
    }

    static getUnreadMessages(db: Database, userId: number) {
        const stmt = db.prepare(`
            SELECT m.sender_id, u.username, u.Avatar, COUNT(*) as unread_count, MAX(m.created_at) as last_message_time
            FROM messages m JOIN users u ON u.id = m.sender_id
            WHERE m.receiver_id = ? AND m.read = 0 AND m.is_blocked = 0
            GROUP BY m.sender_id ORDER BY last_message_time DESC
        `);
        return stmt.all(userId).map((row: any) => ({
            senderId: row.sender_id,
            username: row.username,
            avatarUrl: row.Avatar,
            unreadCount: row.unread_count,
            lastMessageTime: row.last_message_time ? row.last_message_time.replace(' ', 'T') + 'Z' : null
        }));
    }

}