
import { v4 as uuidv4 } from 'uuid';
import { FriendsService } from './FriendsService';
import { MessagesService } from './MessagesService';
import { Database } from 'better-sqlite3';

interface GameInviteRow {
    id: string;
    sender_id: string;
    receiver_id: string;
    game_id: string | null;
    status: string;
    created_at: string;
    expires_at: string;
    senderUsername: string;
    receiverUsername: string;
}

export class GameInvitesService {
    static sendGameInvite(db: Database, senderId: number, receiverId: number, gameId?: string) {
        if (!FriendsService.areFriends(db, senderId, receiverId)) throw new Error('Can only send game invites to friends');
        if (FriendsService.isBlocked(db, receiverId, senderId)) throw new Error('You have blocked this user');
        
        const existing = db.prepare(`SELECT * FROM game_invites WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'`).get(senderId, receiverId);
        if (existing) throw new Error('A pending game invite already exists');
        
        const id = uuidv4();
        const type = gameId || 'PONG';

        db.prepare(`
            INSERT INTO game_invites (id, sender_id, receiver_id, game_id, expires_at) 
            VALUES (?, ?, ?, ?, datetime('now', '+30 seconds'))
        `).run(id, senderId, receiverId, type);

        let inviteMessage = null;
        try {
            inviteMessage = MessagesService.sendMessage(db, senderId, receiverId, `INVITE::${id}::PENDING::${type}`, true);
        } catch (err) {
            console.error("Failed to create invite message", err);
        }

        const row = db.prepare('SELECT * FROM game_invites WHERE id = ?').get(id) as GameInviteRow;

        return {
            invite: this.mapRow(row),
            message: inviteMessage,
            isBlocked: inviteMessage?.isBlocked || false
        };
    }

    static acceptGameInvite(db: Database, inviteId: string, userId: number) {
        const invite = db.prepare(`SELECT * FROM game_invites WHERE id = ? AND receiver_id = ? AND status = 'pending'`).get(inviteId, userId) as GameInviteRow | undefined;
        
        if (!invite) throw new Error('Game invite not found or expired');
        
        const expiryDate = new Date(invite.expires_at.replace(' ', 'T') + 'Z');
        if (expiryDate < new Date()) {
            this.expireInvite(db, inviteId);
            throw new Error('Game invite has expired');
        }

        db.prepare(`UPDATE game_invites SET status = 'accepted' WHERE id = ?`).run(inviteId);
        const fullInvite = db.prepare(`
            SELECT 
                gi.*,
                s.username as senderUsername,
                s.Avatar as sender_avatar,
                r.username as receiverUsername,
                r.Avatar as receiver_avatar
            FROM game_invites gi
            JOIN users s ON gi.sender_id = s.id
            JOIN users r ON gi.receiver_id = r.id
            WHERE gi.id = ?
        `).get(inviteId)  as GameInviteRow;;
        return { ...this.mapRow(fullInvite), status: 'accepted' };
    }

    static declineGameInvite(db: Database, inviteId: string, userId: number) {
        const res = db.prepare(`UPDATE game_invites SET status = 'declined' WHERE id = ? AND receiver_id = ? AND status = 'pending'`).run(inviteId, userId);
        if (res.changes === 0) throw new Error('Game invite not found');
        return { success: true };
    }

    static cancelGameInvite(db: Database, inviteId: string, senderId: number) {
        const invite = db.prepare(`SELECT * FROM game_invites WHERE id = ? AND sender_id = ? AND status = 'pending'`).get(inviteId, senderId) as GameInviteRow | undefined;
        
        if (!invite) throw new Error('Game invite not found');

        db.prepare(`DELETE FROM game_invites WHERE id = ? AND sender_id = ? AND status = 'pending'`).run(inviteId, senderId);
        
        return { ...this.mapRow(invite), status: 'cancelled' };
    }

    static cancelInvitesFromSender(db: Database, senderId: number) {
        const invites = db.prepare(`SELECT * FROM game_invites WHERE sender_id = ? AND status = 'pending'`).all(senderId) as GameInviteRow[];
        if (invites.length > 0) {
            db.prepare(`DELETE FROM game_invites WHERE sender_id = ? AND status = 'pending'`).run(senderId);
        }
        return invites.map(row => this.mapRow(row));
    }

    static cancelInvitesBetween(db: Database, userId1: number, userId2: number) {
        const invites = db.prepare(`
            SELECT * FROM game_invites 
            WHERE status = 'pending' 
            AND (
                (sender_id = ? AND receiver_id = ?) OR 
                (sender_id = ? AND receiver_id = ?)
            )
        `).all(userId1, userId2, userId2, userId1) as any[];

        if (invites.length === 0) return [];

        db.prepare(`
            DELETE FROM game_invites 
            WHERE status = 'pending' 
            AND (
                (sender_id = ? AND receiver_id = ?) OR 
                (sender_id = ? AND receiver_id = ?)
            )
        `).run(userId1, userId2, userId2, userId1);

        return invites.map(row => this.mapRow(row));
    }

    static getInviteById(db: Database, inviteId: string) {
        const row = db.prepare(`SELECT * FROM game_invites WHERE id = ?`).get(inviteId) as any;
        if (!row) return undefined;
        return this.mapRow(row);
    }

    static expireInvite(db: Database, inviteId: string) {
        db.prepare(`UPDATE game_invites SET status = 'expired' WHERE id = ?`).run(inviteId);
        return { success: true };
    }

    private static mapRow(row: any) {
        return {
            id: row.id,
            senderId: row.sender_id|| 'SYSTEM',
            receiverId: row.receiver_id,
            gameId: row.game_id,
            status: row.status,
            createdAt: row.created_at.replace(' ', 'T') + 'Z',
            expiresAt: row.expires_at.replace(' ', 'T') + 'Z',
            senderUsername: row.senderUsername,
            senderAvatar: row.sender_avatar,
            receiverUsername: row.receiverUsername,
            receiverAvatar: row.receiver_avatar
        };
    }
}