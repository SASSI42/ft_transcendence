import type { Socket } from "socket.io";
import type { PlayerTicket } from "./gameRoom";

interface WaitingPlayer {
	socket: Socket;
	userId: number;
	username: string;
	joinedAt: number;
}

export class MatchmakingService {
	private readonly queue: WaitingPlayer[] = [];

	public enqueue(socket: Socket, userId: number, username: string): [PlayerTicket, PlayerTicket] | null {
		// Remove any previous entries for this user (prevents self-matching on reconnect)
		this.removeByUserId(userId);

		// Find first waiting player who is connected AND is a different user
		let existing = this.queue.shift();
		while (existing && (!existing.socket.connected || existing.userId === userId)) {
			// Skip disconnected sockets or same user (self-matching prevention)
			existing = this.queue.shift();
		}

		if (!existing) {
			// No valid opponent found, add to queue
			this.queue.push({ socket, userId, username, joinedAt: Date.now() });
			return null;
		}

		// Found a valid opponent (different user, connected)
		return [
			{ socket: existing.socket, userId: existing.userId, username: existing.username },
			{ socket, userId, username },
		];
	}

	public remove(socketId: string): void {
		const index = this.queue.findIndex((entry) => entry.socket.id === socketId);
		if (index >= 0) {
			this.queue.splice(index, 1);
		}
	}

	private removeByUserId(userId: number): void {
		// Remove all entries for this user (handles reconnection case)
		let index = this.queue.findIndex((entry) => entry.userId === userId);
		while (index >= 0) {
			this.queue.splice(index, 1);
			index = this.queue.findIndex((entry) => entry.userId === userId);
		}
	}

	public pendingCount(): number {
		return this.queue.length;
	}
}
