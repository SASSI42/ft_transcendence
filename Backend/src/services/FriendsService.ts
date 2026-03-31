import { Database } from 'better-sqlite3';

export class FriendsService {

    private static readonly MAX_SLOTS = 50; // Friends + Sent Requests
    private static readonly MAX_RECEIVED = 20; // Pending Incoming Requests

    private static getSlotCounts(db: Database, userId: number) {
   
        const friendsCount = db.prepare(`
            SELECT COUNT(*) as count FROM friendships 
            WHERE (user_id = ? OR friend_id = ?) 
            AND status = 'accepted'
        `).get(userId, userId) as { count: number };

        const sentCount = db.prepare(`
            SELECT COUNT(*) as count FROM friendships 
            WHERE user_id = ? AND status = 'pending'
        `).get(userId) as { count: number };

        const receivedCount = db.prepare(`
            SELECT COUNT(*) as count FROM friendships 
            WHERE friend_id = ? AND status = 'pending'
        `).get(userId) as { count: number };

        return {
            friends: friendsCount.count,
            sent: sentCount.count,
            received: receivedCount.count,
            totalUsedSlots: friendsCount.count + sentCount.count
        };
    }

    static sendFriendRequest(db: Database, userId: number, username: string) {

        const myCounts = this.getSlotCounts(db, userId);
        if (myCounts.totalUsedSlots >= this.MAX_SLOTS) {
            return { operation: 'failure', reason: 'You have reached your friend limit'};
        }

        const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as {id: number} | undefined;
        if (!user) {
            return { operation: 'failure', reason: 'User not found.'};
        }

        const friendId = user.id;
        if (userId == friendId)
            return { operation: 'failure', reason: 'You cannot add yourself.'};

        
        const existing = db.prepare(`
            SELECT * FROM friendships 
            WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
            `).get(userId, friendId, friendId, userId);
            
            
        const incomingRequest = db.prepare(`
            SELECT * FROM friendships 
            WHERE user_id = ? AND friend_id = ? AND status = 'pending'
            `).get(friendId, userId) as any;
            
        if (incomingRequest) {
            db.prepare(`UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?`).run(friendId, userId);
            return { operation: 'success', friendId, status: 'accepted' };
        }
        
        if (existing) {
            return { operation: 'failure', reason: 'Relationship already exists'};
        }
        
        const theirCounts = this.getSlotCounts(db, friendId);
        if (theirCounts.received >= this.MAX_RECEIVED) {
            return { operation: 'failure', reason: 'This user has too many pending friend requests.'};
        }

        const stmt = db.prepare(`
            INSERT INTO friendships (user_id, friend_id, status)
            VALUES (?, ?, 'pending')
        `);

        stmt.run(userId, friendId);

        return { operation: 'success', friendId, status: 'pending' };
    }

    static acceptFriendRequest(db: Database, userId: number, friendId: number) {
        const myCounts = this.getSlotCounts(db, userId);
        

        if (myCounts.totalUsedSlots >= this.MAX_SLOTS) {
            return { success: false };
        }

        const senderCounts = this.getSlotCounts(db, friendId);

        if (senderCounts.friends >= this.MAX_SLOTS) {
            return { success: false };
        }

        const stmt = db.prepare(`
            UPDATE friendships 
            SET status = 'accepted'
            WHERE user_id = ? AND friend_id = ? AND status = 'pending'
        `);

        const result = stmt.run(friendId, userId);
        if (result.changes === 0) {
            throw new Error('Friend request not found');
        }

        return { success: true };
    }

    static declineFriendRequest(db: Database, userId: number, friendId: number) {
        const request = db.prepare(`SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending'`).get(friendId, userId) as any;
        
        if (!request) {
            throw new Error('Friend request not found');
        }
        
        const stmt = db.prepare(`
            DELETE FROM friendships 
            WHERE user_id = ? AND friend_id = ? AND status = 'pending'
        `);

        const result = stmt.run(friendId, userId);
        if (result.changes === 0) {
            throw new Error('Friend request not found');
        }

        return { 
            id: request.id, 
            userId: request.user_id,
            friendId: request.friend_id
        };
    }

    static removeFriend(db: Database, userId: number, friendId: number) {

        db.prepare(`DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`).run(userId, friendId, friendId, userId);

        db.prepare(`DELETE FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`).run(userId, friendId, friendId, userId);

        return { success: true };
    }

    static blockUser(db: Database, userId: number, blockedUserId: number) {

        const existing = db.prepare('SELECT id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').get(userId, blockedUserId);
        if (existing) return { success: true };

        db.prepare('INSERT INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)')
          .run(userId, blockedUserId);

        return { success: true };
    }

    static unblockUser(db: Database, userId: number, blockedUserId: number) {
        db.prepare('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?')
          .run(userId, blockedUserId);
        return { success: true };
    }


    static getUnifiedFriendList(db: Database, userId: number) {
        const stmt = db.prepare(`
            SELECT 
                u.id, 
                u.username, 
                u.Avatar as avatarUrl,
                u.email,
                CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END as isBlocked,
                
                (
                    SELECT created_at 
                    FROM messages 
                    WHERE (sender_id = u.id AND receiver_id = ?) 
                       OR (sender_id = ? AND receiver_id = u.id)
                    ORDER BY created_at DESC 
                    LIMIT 1
                ) as lastMessageTime

            FROM friendships f
            INNER JOIN users u 
                ON (u.id = f.user_id OR u.id = f.friend_id)
                AND u.id != ?
            LEFT JOIN blocked_users b 
                ON b.blocker_id = ? AND b.blocked_id = u.id
            WHERE 
                (f.user_id = ? OR f.friend_id = ?) 
                AND f.status = 'accepted'
            ORDER BY lastMessageTime DESC NULLS LAST
        `);

        const rows = stmt.all(userId, userId, userId, userId, userId, userId);
        
        return rows.map((row: any) => ({
            ...row,
            isBlocked: Boolean(row.isBlocked)
        }));
    }

    static getFriendsToNotify(db: Database, userId: number) {
        const stmt = db.prepare(`
            SELECT 
                CASE 
                    WHEN f.user_id = ? THEN f.friend_id 
                    ELSE f.user_id 
                END as id
            FROM friendships f
            WHERE 
                (f.user_id = ? OR f.friend_id = ?) 
                AND f.status = 'accepted'
        `);
        return stmt.all(userId, userId, userId);
    }

    static getPendingRequests(db: Database, userId: number) {
        const stmt = db.prepare(`
            SELECT 
                u.id, 
                u.username
            FROM friendships f
            JOIN users u ON u.id = f.user_id
            WHERE f.friend_id = ? AND f.status = 'pending'
        `);
        return stmt.all(userId);
    }

    static getSentRequests(db: Database, userId: number) {
        const stmt = db.prepare(`
            SELECT 
                u.id,        
                u.username
            FROM friendships f
            JOIN users u ON f.friend_id = u.id -- Join with the Receiver
            WHERE f.user_id = ? AND f.status = 'pending'
        `);
        return stmt.all(userId);
    }

    static areFriends(db: Database, userId1: number, userId2: number) {
        const stmt = db.prepare(`
            SELECT id FROM friendships 
            WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
            AND status = 'accepted'
            LIMIT 1
        `);
        return !!stmt.get(userId1, userId2, userId2, userId1);
    }

    static isBlocked(db: Database, userId: number, potentialBlockerId: number) {
        const stmt = db.prepare(`
            SELECT id FROM blocked_users 
            WHERE blocker_id = ? AND blocked_id = ?
            LIMIT 1
        `);
        return !!stmt.get(potentialBlockerId, userId);
    }
}