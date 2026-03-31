import type { Server, Socket } from "socket.io";
import type { TournamentSnapshot, TournamentStatus } from "./types";
import { SingleEliminationBracket, type SerializedBracketState } from "./bracket";
import type { GameRoomManager } from "../game/gameRoom";
import {
	deleteTournament as deleteTournamentRecord,
	saveTournamentState,
	saveTournamentHistory,
	type StoredTournamentActiveMatch,
	type StoredTournamentParticipant,
	type StoredTournamentState,
} from "../game-db/tournamentStorage";
import { getDatabase } from "../game-db/database"; 
import { MessagesService } from "../services/MessagesService";

interface TournamentParticipant {
	userId: number;
	alias: string;
	socketId: string;
	joinedAt: number;
	lastSeenAt: number;
	ready: boolean;
	connected: boolean;
	inMatch: boolean;
}

export class Tournament {
	public readonly createdAt: number;
	public status: TournamentStatus = "registration";

	private readonly roomName: string;
	private readonly participants = new Map<string, TournamentParticipant>();
	private readonly socketAliasMap = new Map<string, string>();
	private readonly aliasLookup = new Map<string, string>();
	private bracket: SingleEliminationBracket | null = null;
	private readonly activeMatches = new Map<string, { aliases: [string, string]; roomId: string }>();
	private readonly notifiedMatches = new Set<string>();

	public constructor(
		private readonly io: Server,
		private readonly roomManager: GameRoomManager,
		public readonly code: string,
		public readonly name: string,
		private readonly maxParticipants: number = 8,
		createdAt?: number,
	) {
		this.createdAt = createdAt ?? Date.now();
		this.roomName = `tournament:${this.code}`;
	}

	public static fromStored(io: Server, roomManager: GameRoomManager, stored: StoredTournamentState): Tournament {
		const tournament = new Tournament(io, roomManager, stored.code, stored.name, stored.capacity, stored.createdAt);
		tournament.status = stored.status;
		tournament.restoreParticipants(stored.participants);
		tournament.restoreBracket(stored.bracket);
		tournament.restoreActiveMatches(stored.activeMatches);
		return tournament;
	}

	public register(alias: string, socket: Socket, userId: number): "joined" | "reconnected" {
		const now = Date.now();
		const normalizedAlias = this.normalizeAlias(alias);
		const canonicalAlias = this.aliasLookup.get(normalizedAlias) ?? alias;
		const existing = this.participants.get(canonicalAlias);

		if (existing) {
			if (existing.socketId !== socket.id && existing.connected) {
				throw new Error("Alias already in use");
			}

			this.socketAliasMap.delete(existing.socketId);
			existing.socketId = socket.id;
			existing.connected = true;
			existing.lastSeenAt = now;
			existing.ready = false;
			const canonical = existing.alias;
			const activeMatch = this.findActiveMatchForAlias(canonical);
			existing.inMatch = Boolean(activeMatch);
			this.aliasLookup.set(normalizedAlias, canonical);
			this.socketAliasMap.set(socket.id, canonical);
			socket.join(this.roomName);
			if (activeMatch) {
				const result = this.roomManager.rejoinRoom(activeMatch.roomId, socket, existing.userId, canonical);
				switch (result) {
					case "approved":
						existing.inMatch = true;
						break;
					case "expired":
					case "unknown":
						this.handleExpiredActiveMatch(activeMatch.matchId, activeMatch.aliases);
						existing.inMatch = false;
						break;
					case "occupied":
						existing.inMatch = true;
						break;
				}
			}
			this.persistState();
			return "reconnected";
		}

		if (this.status !== "registration") {
			throw new Error("Tournament already in progress");
		}
		if (this.participants.size >= this.maxParticipants) {
			throw new Error(`Tournament is full (${this.maxParticipants} players).`);
		}

		const participant: TournamentParticipant = {
			userId,
			alias,
			socketId: socket.id,
			joinedAt: now,
			lastSeenAt: now,
			ready: false,
			connected: true,
			inMatch: false,
		};
		this.participants.set(alias, participant);
		this.aliasLookup.set(normalizedAlias, alias);
		this.socketAliasMap.set(socket.id, alias);
		socket.join(this.roomName);
		this.persistState();
		return "joined";
	}

	public markDisconnected(socketId: string): void {
		const alias = this.socketAliasMap.get(socketId);
		if (!alias) {
			return;
		}

		this.socketAliasMap.delete(socketId);
		const participant = this.participants.get(alias);
		if (!participant) {
			return;
		}

		participant.connected = false;
		participant.ready = false;
		participant.inMatch = false;
		participant.lastSeenAt = Date.now();
		this.persistState();
	}

	public remove(alias: string): void {
		const canonical = this.resolveAlias(alias);
		if (!canonical) {
			return;
		}
		const participant = this.participants.get(canonical);
		if (!participant) {
			return;
		}
		this.socketAliasMap.delete(participant.socketId);
		if (this.status === "registration") {
			this.participants.delete(canonical);
			this.aliasLookup.delete(this.normalizeAlias(canonical));
			this.persistState();
			return;
		}
		participant.connected = false;
		participant.ready = false;
		participant.inMatch = false;
		this.persistState();
	}

	public removeBySocket(socketId: string): void {
		const alias = this.socketAliasMap.get(socketId);
		if (!alias) {
			return;
		}
		this.remove(alias);
	}

	public setReady(alias: string, ready: boolean): void {
		const participant = this.participants.get(alias);
		if (!participant) {
			return;
		}
		participant.ready = ready;
		participant.lastSeenAt = Date.now();
		this.persistState();
	}

	public claimReadyMatch(): { matchId: string; aliases: [string, string] } | null {
		this.ensureBracket();
		if (!this.bracket) {
			return null;
		}
		for (const match of this.bracket.getPendingMatches()) {
			if (this.activeMatches.has(match.id)) {
				continue;
			}
			const left = this.participants.get(match.left.alias);
			const right = this.participants.get(match.right.alias);
			if (!left || !right) {
				continue;
			}
			const leftReady = left.connected && left.ready && !left.inMatch;
			const rightReady = right.connected && right.ready && !right.inMatch;
			if (!leftReady || !rightReady) {
				continue;
			}
			try {
				this.bracket.markMatchActive(match.id);
				return { matchId: match.id, aliases: [left.alias, right.alias] };
			} catch (error) {
				console.error("Failed to mark tournament match as active:", {
					code: this.code,
					matchId: match.id,
					error,
				});
			}
		}
		return null;
	}


	public sendMatchReadyNotification(leftAlias: string, rightAlias: string) {
		const p1 = this.participants.get(leftAlias);
		const p2 = this.participants.get(rightAlias);
		
		if (!p1 || !p2) {
			console.error("Cannot send notification: participant not found", { leftAlias, rightAlias });
			return;
		}

        try {
            const db = getDatabase();
    
            const msg1 = `SYSTEM::MATCH_READY::${p2.alias}`;
            const msg2 = `SYSTEM::MATCH_READY::${p1.alias}`;

            const m1 = MessagesService.sendSystemMessage(db, p1.userId, msg1);
            const m2 = MessagesService.sendSystemMessage(db, p2.userId, msg2);

            this.emitToAlias(p1.alias, 'new_message', m1);
            this.emitToAlias(p2.alias, 'new_message', m2);
            
        } catch (error) {
            console.error("Failed to send tournament system messages:", error);
        }
	}

	/**
	 * Send match notifications to all players in pending matches
	 * This notifies players of their assigned opponents before they click ready
	 */
	public notifyPendingMatches(): void {
		if (!this.bracket?.isStarted()) {
			return;
		}

		const pendingMatches = this.bracket.getPendingMatches();
		for (const match of pendingMatches) {
			// Skip if we already notified this match
			if (this.notifiedMatches.has(match.id)) {
				continue;
			}

			const leftAlias = match.left.alias;
			const rightAlias = match.right.alias;
			
			// Only notify if both participants exist
			const leftParticipant = this.participants.get(leftAlias);
			const rightParticipant = this.participants.get(rightAlias);
			
			if (leftParticipant && rightParticipant) {
				this.sendMatchReadyNotification(leftAlias, rightAlias);
				// Mark this match as notified
				this.notifiedMatches.add(match.id);
			}
		}
	}

	public markMatchReserved(matchId: string, aliases: [string, string], roomId: string): void {
		this.activeMatches.set(matchId, { aliases: [aliases[0], aliases[1]], roomId });
		const now = Date.now();
		for (const alias of aliases) {
			const participant = this.participants.get(alias);
			if (participant) {
				participant.inMatch = true;
				participant.ready = false;
				participant.lastSeenAt = now;
			}
		}
		if (this.status === "registration") {
			this.status = "in_progress";
		}
		this.persistState();
	}

	public markMatchFinished(matchId: string, aliases: [string, string], winnerAlias?: string | null): void {
		const now = Date.now();
		for (const alias of aliases) {
			const participant = this.participants.get(alias);
			if (participant) {
				participant.inMatch = false;
				participant.ready = false;
				participant.lastSeenAt = now;
			}
		}
		this.activeMatches.delete(matchId);
		if (!this.bracket || !this.bracket.isStarted()) {
			this.persistState();
			return;
		}
		if (winnerAlias) {
			try {
				this.bracket.recordResult(matchId, winnerAlias);
				if (this.bracket.isComplete()) {
					this.status = "completed";
					// Save tournament history
					this.saveTournamentToHistory();
				} else {
					// Tournament continues - notify players of new matches
					this.notifyPendingMatches();
				}
			} catch (error) {
				console.error("Failed to record tournament match result:", {
					code: this.code,
					matchId,
					error,
				});
			}
		} else {
			this.bracket.resetMatchToPending(matchId);
		}
		this.persistState();
	}

	public releaseActiveMatch(matchId: string, aliases?: [string, string]): void {
		this.activeMatches.delete(matchId);
		if (this.bracket?.isStarted()) {
			this.bracket.resetMatchToPending(matchId);
		}
		if (aliases) {
			for (const alias of aliases) {
				const participant = this.participants.get(alias);
				if (participant) {
					participant.inMatch = false;
				}
			}
		}
		this.persistState();
	}

	public hasAlias(alias: string): boolean {
		const canonical = this.resolveAlias(alias);
		return canonical ? this.participants.has(canonical) : false;
	}

	public aliasForSocket(socketId: string): string | undefined {
		return this.socketAliasMap.get(socketId);
	}

	public getUserId(alias: string): number | undefined {
		const participant = this.participants.get(alias);
		return participant?.userId;
	}

	public activeCount(): number {
		let count = 0;
		for (const participant of this.participants.values()) {
			if (participant.connected) {
				count += 1;
			}
		}
		return count;
	}

	public totalCount(): number {
		return this.participants.size;
	}

	public getSnapshot(): TournamentSnapshot {
		const participants = [...this.participants.values()]
			.sort((a, b) => a.joinedAt - b.joinedAt)
			.map((participant) => ({
				alias: participant.alias,
				connected: participant.connected,
				ready: participant.ready,
				inMatch: participant.inMatch,
				joinedAt: participant.joinedAt,
				lastSeenAt: participant.lastSeenAt,
			}));

		return {
			code: this.code,
			name: this.name,
			createdAt: this.createdAt,
			status: this.status,
			participants,
			capacity: this.maxParticipants,
			bracket: this.bracket?.isStarted() ? this.bracket.getSnapshot() : undefined,
		};
	}

	private toStoredState(): StoredTournamentState {
		const participants: StoredTournamentParticipant[] = [...this.participants.values()]
			.sort((a, b) => a.joinedAt - b.joinedAt)
			.map((participant) => ({
				userId: participant.userId,
				alias: participant.alias,
				joinedAt: participant.joinedAt,
				lastSeenAt: participant.lastSeenAt,
				ready: participant.ready,
				inMatch: participant.inMatch,
			}));

	const activeMatches: StoredTournamentActiveMatch[] = [...this.activeMatches.entries()].map(([matchId, record]) => ({
		matchId,
		aliases: [record.aliases[0], record.aliases[1]],
		roomId: record.roomId,
	}));

	return {
		code: this.code,
		name: this.name,
		status: this.status,
		capacity: this.maxParticipants,
		createdAt: this.createdAt,
		updatedAt: Date.now(),
		participants,
		activeMatches,
		bracket: this.bracket ? this.bracket.serialize() : null,
	};
	}

	private persistState(): void {
		try {
			saveTournamentState(this.toStoredState());
		} catch (error) {
			console.error("Failed to persist tournament state:", { code: this.code, error });
		}
	}

	private saveTournamentToHistory(): void {
		if (!this.bracket) {
			return;
		}
		
		const bracketState = this.bracket.serialize();
		const champion = bracketState.champion;
		
		if (!champion) {
			console.error('Attempted to save tournament history without a champion', { code: this.code });
			return;
		}
		
		try {
			saveTournamentHistory({
				code: this.code,
				name: this.name,
				capacity: this.maxParticipants,
				winnerId: champion.id,
				winnerAlias: champion.alias,
				totalParticipants: this.participants.size,
				createdAt: this.createdAt,
			});
		} catch (error) {
			console.error('Failed to save tournament history:', { code: this.code, error });
		}
	}

	private restoreParticipants(records: StoredTournamentParticipant[]): void {
		this.participants.clear();
		this.socketAliasMap.clear();
		this.aliasLookup.clear();
		for (const record of records) {
			const participant: TournamentParticipant = {
				userId: record.userId,
				alias: record.alias,
				socketId: "",
				joinedAt: record.joinedAt,
				lastSeenAt: record.lastSeenAt,
				ready: false,
				connected: false,
				inMatch: record.inMatch,
			};
			this.participants.set(record.alias, participant);
			this.aliasLookup.set(this.normalizeAlias(record.alias), record.alias);
		}
	}

	private restoreBracket(state: SerializedBracketState | null): void {
		if (!state) {
			this.bracket = null;
			return;
		}
		if (!this.bracket) {
			this.bracket = new SingleEliminationBracket();
		}
		this.bracket.hydrate(state);
	}

	private restoreActiveMatches(records: StoredTournamentActiveMatch[]): void {
		this.activeMatches.clear();
		for (const participant of this.participants.values()) {
			participant.inMatch = false;
		}

		for (const { matchId, aliases, roomId } of records) {
			if (!roomId) {
				continue;
			}
			this.activeMatches.set(matchId, { aliases: [aliases[0], aliases[1]], roomId });
			for (const alias of aliases) {
				const participant = this.participants.get(alias);
				if (participant) {
					participant.inMatch = true;
				}
			}
		}
	}

	private isAliasInActiveMatch(alias: string): boolean {
		for (const record of this.activeMatches.values()) {
			if (record.aliases[0] === alias || record.aliases[1] === alias) {
				return true;
			}
		}
		return false;
	}

	private findActiveMatchForAlias(alias: string): { matchId: string; roomId: string; aliases: [string, string] } | null {
		for (const [matchId, record] of this.activeMatches.entries()) {
			if (record.aliases[0] === alias || record.aliases[1] === alias) {
				return { matchId, roomId: record.roomId, aliases: [record.aliases[0], record.aliases[1]] };
			}
		}
		return null;
	}

	private handleExpiredActiveMatch(matchId: string, aliases: [string, string]): void {
		this.activeMatches.delete(matchId);
		for (const alias of aliases) {
			const participant = this.participants.get(alias);
			if (participant) {
				participant.inMatch = false;
				participant.ready = false;
			}
		}
		if (this.bracket?.isStarted()) {
			this.bracket.resetMatchToPending(matchId);
		}
		this.persistState();
		this.broadcastUpdate();
	}

	private ensureBracket(): void {
		const alreadyStarted = this.bracket?.isStarted() ?? false;
		if (alreadyStarted) {
			return;
		}
		const aliases = [...this.participants.values()]
			.sort((a, b) => a.joinedAt - b.joinedAt)
			.map((participant) => participant.alias);
		if (aliases.length !== this.maxParticipants) {
			return;
		}
		if (!this.bracket) {
			this.bracket = new SingleEliminationBracket();
		}
		this.bracket.buildFromAliases(aliases);
		if (this.bracket.hasEnoughPlayers()) {
			this.bracket.start();
			if (!alreadyStarted && this.bracket.isStarted()) {
				this.persistState();
				// Notify all players of their initial matches
				this.notifyPendingMatches();
			}
		}
	}

	public broadcastUpdate(): void {
		this.io.to(this.roomName).emit("server:tournament:update", {
			code: this.code,
			snapshot: this.getSnapshot(),
		});
	}

	public emitToAlias(alias: string, event: string, payload: unknown): void {
		const participant = this.participants.get(alias);
		if (!participant) {
			return;
		}
		const socket = this.io.sockets.sockets.get(participant.socketId);
		if (!socket) {
			return;
		}
		socket.emit(event, payload);
	}

	public getSocket(alias: string): Socket | undefined {
		const participant = this.participants.get(alias);
		if (!participant) {
			return undefined;
		}
		return this.io.sockets.sockets.get(participant.socketId);
	}

	public leaveRoom(socket: Socket): void {
		socket.leave(this.roomName);
	}

	public destroy(): void {
		for (const participant of this.participants.values()) {
			const socket = this.io.sockets.sockets.get(participant.socketId);
			if (socket) {
				socket.leave(this.roomName);
			}
		}
		this.participants.clear();
		this.socketAliasMap.clear();
		this.aliasLookup.clear();
		this.activeMatches.clear();
		try {
			deleteTournamentRecord(this.code);
		} catch (error) {
			console.error("Failed to delete tournament record:", { code: this.code, error });
		}
	}

	private normalizeAlias(alias: string): string {
		return alias.toLowerCase();
	}

	private resolveAlias(alias: string): string | null {
		const normalized = this.normalizeAlias(alias);
		const canonical = this.aliasLookup.get(normalized);
		if (canonical) {
			return canonical;
		}
		if (this.participants.has(alias)) {
			return alias;
		}
		return null;
	}
}
