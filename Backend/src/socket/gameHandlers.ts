import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { MatchmakingService } from "../game/matchmaking";
import { GameRoomManager } from "../game/gameRoom";
import type { InputCommand } from "../game/gameLogic";
import { TournamentRegistry } from "../tournament/registry";
import { normalizeCode, sanitizeAlias as sanitizeTournamentAlias } from "../tournament/utils";
import { getDatabase } from "../game-db/database";
import { setUserStatus, userSessions} from '../services/UserStatusService'; 
import { gameManager } from '../game/logic/GameManager';


// Zod validation schemas for Pong game socket events
const JoinPayloadSchema = z.object({
	username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional()
}).strict();

const InputPayloadSchema = z.object({
	command: z.enum(["up", "down", "stop"])
}).strict();

const ReadyPayloadSchema = z.object({
	ready: z.boolean().optional()
}).strict();

const TournamentCreatePayloadSchema = z.object({
	name: z.string().min(1).max(64).trim().optional(),
	alias: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/),
	capacity: z.union([z.literal(4), z.literal(8)]).optional()
}).strict();

const TournamentJoinPayloadSchema = z.object({
	code: z.string().min(4).max(10).trim(),
	alias: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/)
}).strict();

const TournamentReadyPayloadSchema = z.object({
	ready: z.boolean().optional()
}).strict();

const RejoinPayloadSchema = z.object({
	roomId: z.string().min(1).max(100),
	username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional()
}).strict();

type JoinPayload = z.infer<typeof JoinPayloadSchema>;
type InputPayload = z.infer<typeof InputPayloadSchema>;
type ReadyPayload = z.infer<typeof ReadyPayloadSchema>;
type TournamentCreatePayload = z.infer<typeof TournamentCreatePayloadSchema>;
type TournamentJoinPayload = z.infer<typeof TournamentJoinPayloadSchema>;
type TournamentReadyPayload = z.infer<typeof TournamentReadyPayloadSchema>;
type RejoinPayload = z.infer<typeof RejoinPayloadSchema>;

const VALID_INPUTS: ReadonlyArray<InputCommand> = ["up", "down", "stop"];

// Export the game services so they can be used in the main socket handler
export function createGameServices(io: Server) {
	const matchmaking = new MatchmakingService();
	const roomManager = new GameRoomManager(io);
	const tournamentRegistry = new TournamentRegistry(io, roomManager);
	tournamentRegistry.hydrateFromStorage();

	return { matchmaking, roomManager, tournamentRegistry };
}

/**
 * Check if a user is currently in a Pong game (1v1 remote or tournament)
 * @param userId - The user ID to check
 * @param roomManager - The GameRoomManager instance
 * @param tournamentRegistry - The TournamentRegistry instance
 * @returns true if user is in a Pong game or tournament, false otherwise
 */
export function isUserInPongGame(
	userId: number,
	roomManager: GameRoomManager,
	tournamentRegistry: TournamentRegistry
): boolean {
	// Check if user is in a 1v1 remote game
	const inRemoteGame = roomManager.isUserInGame(userId);
	if (inRemoteGame) {
		return true;
	}

	// Check if user is in a tournament
	// const inTournament = tournamentRegistry.isUserInTournament(userId);
	// if (inTournament) {
	// 	return true;
	// }

	return false;
}

export function registerGameSocketHandlers(
	io: Server,
	socket: Socket,
	matchmaking: MatchmakingService,
	roomManager: GameRoomManager,
	tournamentRegistry: TournamentRegistry
): void {
		// Game-related socket handlers
		const leaveTournament = (removeAlias: boolean) => {
			const code = socket.data?.tournamentCode as string | undefined;
			const alias = socket.data?.tournamentAlias as string | undefined;
			if (!code) {
				return;
			}
			const tournament = tournamentRegistry.get(code);
			if (!tournament) {
				socket.data.tournamentCode = undefined;
				socket.data.tournamentAlias = undefined;
				return;
			}

			if (removeAlias && alias) {
				tournament.remove(alias);
			} else {
				tournament.markDisconnected(socket.id);
			}
			tournament.leaveRoom(socket);
			socket.data.tournamentCode = undefined;
			socket.data.tournamentAlias = undefined;
			tournament.broadcastUpdate();
			tournamentRegistry.cleanupIfEmpty(code);
		};

		socket.on("client:join", (payload: unknown) => {

			const validationResult = JoinPayloadSchema.safeParse(payload);
			if (!validationResult.success) {
				socket.emit("server:error", { message: "Invalid request format." });
				return;
			}

			
			// Get userId from authenticated socket
			const userId = socket.data.user?.id;
			
			if (!userId) {
				socket.emit("server:error", { message: "Authentication required to join a match." });
				return;
			}
			if (userSessions.get(userId)?.status !== 'ONLINE')
				return;

			//  Verify user exists in database before allowing them to join
			let db;
			let username: string;
			try {
				db = getDatabase();
				const userExists = db.prepare(`SELECT username FROM users WHERE id = ?`).get(userId) as { username: string } | undefined;
				if (!userExists) {
					socket.emit("server:error", { message: "User account not found. Please log in again." });
					return;
				}
				username = userExists.username;
				
			} catch (error) {
				
				socket.emit("server:error", { message: "Database error. Please try again." });
				return;
			}
			socket.data.matchUsername = username;
			setUserStatus(db, io, userId, 'IN-QUEUE');
			const pairing = matchmaking.enqueue(socket, userId, username);
			if (!pairing) {
				return;
			}

			const room = roomManager.createRoom(pairing);
			for (const player of pairing) {
				
				player.socket.emit("server:queue", {
					status: "matched",
					roomId: room.id,
				});
			}
		});

		socket.on("client:tournament:create", (payload: unknown) => {
			const validationResult = TournamentCreatePayloadSchema.safeParse(payload);
			if (!validationResult.success) {
				return;
			}

			const validatedPayload = validationResult.data;
			const userId = socket.data.user?.id;
			
			if (!userId) {
				socket.emit("server:tournament:error", { message: "Authentication required to create a tournament." });
				return;
			}

			leaveTournament(true);

			const name = (validatedPayload.name?.trim() || "Remote Cup").slice(0, 64);
			const capacity = validatedPayload.capacity || 8;
			const alias = validatedPayload.alias;

			const tournament = tournamentRegistry.create(name, capacity);
			try {
				tournament.register(alias, socket, userId);
			} catch (error) {
				const reason = error instanceof Error ? error.message : "Unable to join tournament.";
				socket.emit("server:tournament:error", { message: reason });
				tournamentRegistry.cleanupIfEmpty(tournament.code);
				return;
			}

			socket.data.tournamentCode = tournament.code;
			socket.data.tournamentAlias = alias;
			socket.emit("server:tournament:created", {
				code: tournament.code,
				snapshot: tournament.getSnapshot(),
				alias,
			});
			tournament.broadcastUpdate();
		});

		socket.on("client:tournament:join", (payload: unknown) => {
			const validationResult = TournamentJoinPayloadSchema.safeParse(payload);
			if (!validationResult.success) {
				socket.emit("server:tournament:error", { message: "Invalid request format." });
				return;
			}

			const validatedPayload = validationResult.data;
			const userId = socket.data.user?.id;
			const code = validatedPayload.code.trim().toUpperCase();
			const joinAlias = validatedPayload.alias;
			
			if (!userId) {
				socket.emit("server:tournament:error", { message: "Authentication required to join." });
				return;
			}

			const tournament = tournamentRegistry.get(code);
			if (!tournament) {
				socket.emit("server:tournament:error", { message: "Tournament not found." });
				return;
			}

			const existingCode = socket.data?.tournamentCode as string | undefined;
			if (existingCode && existingCode !== tournament.code) {
				leaveTournament(true);
			}

			try {
				tournament.register(joinAlias, socket, userId);
			} catch (error) {
				const reason = error instanceof Error ? error.message : "Unable to join tournament.";
				socket.emit("server:tournament:error", { message: reason });
				return;
			}

			socket.data.tournamentCode = tournament.code;
			socket.data.tournamentAlias = joinAlias;
			socket.emit("server:tournament:joined", {
				code: tournament.code,
				snapshot: tournament.getSnapshot(),
				alias: joinAlias,
			});
			tournament.broadcastUpdate();
		});

		socket.on("client:tournament:leave", () => {
			const code = socket.data?.tournamentCode as string | undefined;
			if (!code) {
				return;
			}
			const alias = socket.data?.tournamentAlias as string | undefined;
			const tournament = tournamentRegistry.get(code);
			if (!tournament) {
				socket.data.tournamentCode = undefined;
				socket.data.tournamentAlias = undefined;
				return;
			}

			if (alias) {
				tournament.remove(alias);
			}
			tournament.leaveRoom(socket);
			socket.data.tournamentCode = undefined;
			socket.data.tournamentAlias = undefined;
			tournament.broadcastUpdate();
			tournamentRegistry.cleanupIfEmpty(code);
			socket.emit("server:tournament:left", { code });
		});

		socket.on("client:tournament:ready", (payload: unknown) => {
			const validationResult = TournamentReadyPayloadSchema.safeParse(payload);
			if (!validationResult.success) {
				socket.emit("server:tournament:error", { message: "Invalid request format." });
				return;
			}

			const validatedPayload = validationResult.data;
			const code = socket.data?.tournamentCode as string | undefined;
			if (!code) {
				socket.emit("server:tournament:error", { message: "Join a tournament before readying up." });
				return;
			}

			const tournament = tournamentRegistry.get(code);
			if (!tournament) {
				socket.emit("server:tournament:error", { message: "Tournament not found." });
				return;
			}

			const alias = socket.data?.tournamentAlias as string | undefined;
			if (!alias || !tournament.hasAlias(alias)) {
				socket.emit("server:tournament:error", { message: "You are not registered in this tournament." });
				return;
			}

			const ready = Boolean(validatedPayload.ready);
			tournament.setReady(alias, ready);
			const startedMatch = tournamentRegistry.tryStartMatches(code);
			if (!startedMatch) {
				tournament.broadcastUpdate();
			}
		});

		socket.on("client:heartbeat", (ack?: (payload: { now: number }) => void) => {
			try {
				if (typeof ack === "function") {
					ack({ now: Date.now() });
				}
			} catch (error) {
				console.error("Heartbeat error:", error);
			}
		});

		socket.on("client:ready", (payload: unknown) => {

			const validationResult = ReadyPayloadSchema.safeParse(payload);
			if (!validationResult.success) {
				return;
			}
			
			roomManager.markReady(socket.id);
		});

		socket.on("client:input", (payload: unknown) => {

			const validationResult = InputPayloadSchema.safeParse(payload);
			if (!validationResult.success) {
				return;
			}

			const validatedPayload = validationResult.data;
			roomManager.applyInput(socket.id, validatedPayload.command);
		});

		socket.on("client:leave", () => {
			matchmaking.remove(socket.id);
			if (socket.data.user?.id) {
           		setUserStatus(getDatabase(), io, socket.data.user.id, 'ONLINE'); // 👈 Pass io here
      		 }
			roomManager.handleLeave(socket.id, "manual");
			socket.emit("server:left");
		});

		socket.on("client:rejoin", (payload: unknown) => {

			const validationResult = RejoinPayloadSchema.safeParse(payload);
			if (!validationResult.success) {
				
				socket.emit("rejoin-response", { status: "error", message: "Invalid request format." });
				return;
			}

			const validatedPayload = validationResult.data;
			const providedRoomId = validatedPayload.roomId.trim();
			const userId = socket.data.user?.id;
			
			if (!providedRoomId || !userId) {
				socket.emit("rejoin-response", { status: "error", message: "Missing room, username, or authentication." });
				return;
			}
			let db;
			let username: string;
			try {
				db = getDatabase();
				const userExists = db.prepare(`SELECT username FROM users WHERE id = ?`).get(userId) as { username: string } | undefined;
				if (!userExists) {
					socket.emit("server:error", { message: "User account not found. Please log in again." });
					return;
				}
				username = userExists.username;
				
			} catch (error) {
				
				socket.emit("server:error", { message: "Database error. Please try again." });
				return;
			}
			const result = roomManager.rejoinRoom(providedRoomId, socket, userId, username);
			switch (result) {
				case "approved":
					socket.data.matchUsername = username;
					socket.emit("rejoin-response", { status: "approved" });
					break;
				case "unknown":
					socket.emit("rejoin-response", { status: "rejected", message: "Player session not found." });
					break;
				case "occupied":
					socket.emit("rejoin-response", { status: "rejected", message: "Seat already taken." });
					break;
				case "expired":
					socket.emit("rejoin-response", { status: "rejected", message: "Match is no longer available." });
					break;
			}
		});

		// Handle "soft disconnect" when component unmounts but socket stays alive
		socket.on("pingpong_off", () => {
			// Trigger disconnect behavior without actually disconnecting the socket
			matchmaking.remove(socket.id);
			roomManager.handleDisconnect(socket.id);
			leaveTournament(false);
		});

		socket.on("disconnect", () => {
			matchmaking.remove(socket.id);
			roomManager.handleDisconnect(socket.id);
			leaveTournament(false);
		});
}
