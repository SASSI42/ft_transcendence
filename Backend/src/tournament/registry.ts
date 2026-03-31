import type { Server } from "socket.io";
import { GameRoomManager, type MatchLifecycleHooks, type PlayerTicket } from "../game/gameRoom";
import { Tournament } from "./tournament";
import { generateTournamentCode } from "./utils";
import { loadAllTournaments, deleteTournament as deleteTournamentRecord } from "../game-db/tournamentStorage";

export class TournamentRegistry {
	private readonly tournaments = new Map<string, Tournament>();

	public constructor(private readonly io: Server, private readonly roomManager: GameRoomManager) {}

	public hydrateFromStorage(): void {
		const storedTournaments = loadAllTournaments();
		for (const stored of storedTournaments) {
			if (this.tournaments.has(stored.code)) {
				continue;
			}
			if (stored.status === "completed" && stored.participants.length === 0) {
				deleteTournamentRecord(stored.code);
				continue;
			}
			const tournament = Tournament.fromStored(this.io, this.roomManager, stored);
			this.tournaments.set(stored.code, tournament);
		}
	}

	public create(name: string, capacity = 8): Tournament {
		let code: string;
		do {
			code = generateTournamentCode();
		} while (this.tournaments.has(code));

		const tournament = new Tournament(this.io, this.roomManager, code, name, capacity);
		this.tournaments.set(code, tournament);
		return tournament;
	}

	public get(code: string): Tournament | undefined {
		return this.tournaments.get(code);
	}

	public remove(code: string): void {
		const tournament = this.tournaments.get(code);
		if (!tournament) {
			return;
		}
		tournament.destroy();
		this.tournaments.delete(code);
	}

	public tryStartMatches(code: string): boolean {
		const tournament = this.tournaments.get(code);
		if (!tournament) {
			return false;
		}

		let started = false;
		let needsUpdate = false;
		while (true) {
			const claim = tournament.claimReadyMatch();
			if (!claim) {
				break;
			}

			const { matchId, aliases } = claim;
			const [leftAlias, rightAlias] = aliases;
			const leftSocket = tournament.getSocket(leftAlias);
			const rightSocket = tournament.getSocket(rightAlias);
			if (!leftSocket || !rightSocket) {
				needsUpdate = true;
				tournament.releaseActiveMatch(matchId, aliases);
				continue;
			}

			const leftUserId = tournament.getUserId(leftAlias);
			const rightUserId = tournament.getUserId(rightAlias);
			if (leftUserId === undefined || rightUserId === undefined) {
				needsUpdate = true;
				tournament.releaseActiveMatch(matchId, aliases);
				continue;
			}

			const players: [PlayerTicket, PlayerTicket] = [
				{ socket: leftSocket, userId: leftUserId, username: leftAlias },
				{ socket: rightSocket, userId: rightUserId, username: rightAlias },
			];
			const hooks = this.buildMatchHooks(code, matchId, aliases);
			const room = this.roomManager.createRoom(players, hooks);
			tournament.markMatchReserved(matchId, aliases, room.id);
			tournament.broadcastUpdate();
			started = true;
		}

		if (needsUpdate) {
			tournament.broadcastUpdate();
		}

		return started;
	}

	private buildMatchHooks(code: string, matchId: string, aliases: [string, string]): MatchLifecycleHooks {
		return {
			tournamentCode: code,
			onMatchEnded: ({ winner }) => {
				const tournament = this.tournaments.get(code);
				if (!tournament) {
					return;
				}
				const winnerAlias = winner === "left" ? aliases[0] : winner === "right" ? aliases[1] : null;
				tournament.markMatchFinished(matchId, aliases, winnerAlias);
				tournament.broadcastUpdate();
			},
		};
	}

	public cleanupIfEmpty(code: string): void {
		const tournament = this.tournaments.get(code);
		if (!tournament) {
			return;
		}
		if (tournament.totalCount() === 0) {
			this.remove(code);
		}
	}

	/**
	 * Check if a user is currently participating in any active tournament
	 * @param userId - The user ID to check
	 * @returns true if user is in an active (not completed) tournament, false otherwise
	 */
	// public isUserInTournament(userId: number): boolean {
	// 	for (const tournament of this.tournaments.values()) {
	// 		if (tournament.status === "completed") {
	// 			continue;
	// 		}

	// 		// Check if user is a participant in this tournament
	// 		const hasUser = (tournament as any).participants?.size > 0;
	// 		if (hasUser) {
	// 			for (const participant of (tournament as any).participants.values()) {
	// 				if (participant.userId === userId) {
	// 					return true;
	// 				}
	// 			}
	// 		}
	// 	}
	// 	return false;
	// }

	public all(): Tournament[] {
		return [...this.tournaments.values()];
	}
}
