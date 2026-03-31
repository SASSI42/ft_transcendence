import { randomUUID } from "crypto";
import type { Server, Socket } from "socket.io";
import { setUserStatus } from '../services/UserStatusService'; // 👈 Add this
import {
  GAME_CONFIG,
  type GameState,
  type InputCommand,
  type PlayerSide,
  applyInputCommand,
  createInitialState,
  stepGameState,
} from "./gameLogic";
import {
  deleteMatch,
  type MatchStatus,
  type StoredMatch,
  loadActiveMatch,
  pruneExpiredMatches,
  upsertMatchSnapshot,
  upsertPlayerState,
  saveMatchHistory,
} from "../game-db/matchStorage";
import { getDatabase } from "../game-db/database";

type LeaveReason = "disconnect" | "manual";

interface PlayerSession {
  socket: Socket | null;
  socketId: string;
  userId: number;
  username: string;
  side: PlayerSide;
  ready: boolean;
  connected: boolean;
  rejoinTimer?: ReturnType<typeof setTimeout> | null;
}

interface MatchReadyPayload {
  roomId: string;
  players: Array<{ side: PlayerSide; username: string }>;
  state: GameState;
}

interface JoinPayload {
  roomId: string;
  side: PlayerSide;
  opponent: { side: PlayerSide; username: string } | null;
  state: GameState;
}

type RoomCleanup = (roomId: string) => void;

export interface MatchLifecycleHooks {
  onMatchStarted?: (context: { roomId: string }) => void;
  onMatchEnded?: (context: { roomId: string; reason: "completed" | "player_left" | "forfeit"; winner?: PlayerSide }) => void;
  tournamentCode?: string;
}

export class GameRoom {
  public readonly id: string;
  private readonly io: Server;
  private readonly onCleanup: RoomCleanup;
  private readonly hooks?: MatchLifecycleHooks;
  private players: Partial<Record<PlayerSide, PlayerSession>> = {};
  private state: GameState = createInitialState();
  private loopHandle: ReturnType<typeof setInterval> | null = null;
  private lastTick = Date.now();
  private disposed = false;
  private matchClosed = false;
  private readonly rejoinTimeoutMs = 15_000; // 15 seconds timeout for reconnection
  private readonly persistIntervalMs = 200;
  private lastPersistedAt = 0;
  private activeRejoinDeadline: number | null = null;
  private matchStartTime: number | null = null;

  public constructor(io: Server, roomId: string, onCleanup: RoomCleanup, hooks?: MatchLifecycleHooks) {
    this.id = roomId;
    this.io = io;
    this.onCleanup = onCleanup;
    this.hooks = hooks;
    this.persistState("waiting", null, true);
  }

  private persistState(status: MatchStatus, rejoinDeadline: number | null = this.activeRejoinDeadline, force = false): void {
    const now = Date.now();
    if (!force && now - this.lastPersistedAt < this.persistIntervalMs) {
      return;
    }
    this.lastPersistedAt = now;
    upsertMatchSnapshot({
      matchId: this.id,
      status,
      state: this.snapshot(),
      rejoinDeadline,
    });
    this.activeRejoinDeadline = rejoinDeadline ?? null;
  }

  private persistPlayerState(session: PlayerSession): void {
    upsertPlayerState({
      matchId: this.id,
      side: session.side,
      userId: session.userId,
      username: session.username,
      ready: session.ready,
      connected: session.connected,
    });
  }

  private allPlayersConnected(): boolean {
    return Boolean(this.players.left?.connected && this.players.right?.connected);
  }

  public hydrateFromSnapshot(snapshot: StoredMatch): void {
    this.state = snapshot.state;
    this.state.status = "ready";
    this.matchClosed = snapshot.status === "completed" || snapshot.status === "player_left";
    this.activeRejoinDeadline = snapshot.rejoinDeadline ?? null;
    this.matchStartTime = snapshot.createdAt;
    this.players = {};

    for (const stored of snapshot.players) {
      const session: PlayerSession = {
        socket: null,
        socketId: "",
        userId: stored.userId,
        username: stored.username,
        side: stored.side,
        ready: stored.ready,
        connected: false,
        rejoinTimer: null,
      };
      this.players[stored.side as PlayerSide] = session;
      this.persistPlayerState(session);
    }

    if (this.activeRejoinDeadline !== null) {
      const remaining = this.activeRejoinDeadline - Date.now();
      if (remaining > 0) {
        for (const session of Object.values(this.players)) {
          if (!session) {
            continue;
          }
          session.rejoinTimer = setTimeout(() => {
            this.finalizeDeparture(session, "disconnect");
          }, remaining);
        }
      } else {
        this.activeRejoinDeadline = null;
      }
    }

    this.lastTick = Date.now();
    this.persistState("paused", this.activeRejoinDeadline, true);
  }

  public addPlayer(socket: Socket, userId: number, username: string): PlayerSession {
    const side: PlayerSide = this.players.left ? "right" : "left";
    const session: PlayerSession = {
      socket,
      socketId: socket.id,
      userId,
      username,
      side,
      ready: false,
      connected: true,
      rejoinTimer: null,
    };

    this.players[side] = session;
    socket.join(this.id);
    socket.data.side = side;
    socket.data.roomId = this.id;
    this.persistPlayerState(session);
    this.persistState(this.hasBothPlayers() ? "ready" : "waiting", this.activeRejoinDeadline, true);

    if (this.hasBothPlayers()) {
      this.state.status = "ready";
      this.broadcast("server:match-ready", this.buildMatchReadyPayload());
      this.persistState("ready", this.activeRejoinDeadline, true);
    }

    return session;
  }

  public getJoinPayload(socketId: string): JoinPayload | null {
    const session = this.getSessionBySocket(socketId);
    if (!session) {
      return null;
    }

    const opponent = this.getOpponentSession(session.side);
    return {
      roomId: this.id,
      side: session.side,
      opponent: opponent ? { side: opponent.side, username: opponent.username } : null,
      state: this.snapshot(),
    };
  }

  public markReady(socketId: string): void {
    const session = this.getSessionBySocket(socketId);
    if (!session || session.ready || !session.connected || !session.socket) {
      return;
    }

    session.ready = true;
    session.socket.to(this.id).emit("server:peer-ready", { side: session.side });
    this.persistPlayerState(session);

    if (this.hasBothPlayers() && this.allPlayersReady() && !this.loopHandle) {
      this.startLoop();
    } else {
      this.persistState("ready", this.activeRejoinDeadline, true);
    }
  }

  public applyInput(socketId: string, command: InputCommand): void {
    const session = this.getSessionBySocket(socketId);
    if (!session || this.state.status !== "playing") {
      return;
    }

    const paddle = this.state.paddles[session.side];
    applyInputCommand(paddle, command);
  }

  public handleLeave(socketId: string, reason: LeaveReason): void {
    const session = this.getSessionBySocket(socketId);
    if (!session) {
      return;
    }

    this.finalizeDeparture(session, reason, socketId);
  }

  public markDisconnected(socketId: string): void {
    const session = this.getSessionBySocket(socketId);
    if (!session || !session.connected) {
      return;
    }

    session.connected = false;
    // Store the socketId before clearing the socket reference
    const disconnectedSocketId = session.socketId;
    if (session.socket) {
      session.socket.leave(this.id);
      session.socket = null;
    }

    if (this.loopHandle) {
      this.stopLoop();
      this.state.status = "ready";
    }

    const opponent = this.getOpponentSession(session.side);
    if (opponent?.socket) {
      opponent.socket.emit("server:opponent-paused", {
        roomId: this.id,
        timeoutMs: this.rejoinTimeoutMs,
      });
    }

    if (session.rejoinTimer) {
      clearTimeout(session.rejoinTimer);
    }

    const deadline = Date.now() + this.rejoinTimeoutMs;
    this.activeRejoinDeadline = deadline;
    session.rejoinTimer = setTimeout(() => {
      session.rejoinTimer = null;
      if (!session.connected) {
        // Pass the socketId so we can notify the disconnected player
        this.finalizeDeparture(session, "disconnect", disconnectedSocketId);
      }
    }, this.rejoinTimeoutMs);
    this.persistPlayerState(session);
    this.persistState("paused", deadline, true);
  }

  public rejoinPlayer(socket: Socket, userId: number, username: string): "approved" | "unknown" | "occupied" | "expired" {
    const session = this.getSessionByUserId(userId);
    if (!session) {
      return "unknown";
    }

    if (!this.players[session.side]) {
      return "expired";
    }

    if (session.connected) {
      return "occupied";
    }

    session.socket = socket;
    session.socketId = socket.id;
    session.connected = true;
    socket.join(this.id);
    socket.data.side = session.side;
    socket.data.roomId = this.id;

    if (session.rejoinTimer) {
      clearTimeout(session.rejoinTimer);
      session.rejoinTimer = null;
    }

    this.persistPlayerState(session);

    if (this.allPlayersConnected()) {
      this.activeRejoinDeadline = null;
      this.persistState(this.loopHandle ? "playing" : "ready", null, true);
    } else {
      this.persistState("paused", this.activeRejoinDeadline, true);
    }

    const payload = this.getJoinPayload(socket.id);
    if (payload) {
      socket.emit("server:joined", payload);
    }

    if (this.state.status === "ready" || this.state.status === "waiting") {
      socket.emit("server:match-ready", this.buildMatchReadyPayload());
    }

    const opponent = this.getOpponentSession(session.side);
    if (opponent?.socket) {
      opponent.socket.emit("server:opponent-resumed", {
        roomId: this.id,
      });
    }

    this.resumeLoop();
    return "approved";
  }

  public owns(socketId: string): boolean {
    return Boolean(this.getSessionBySocket(socketId));
  }

  private startLoop(): void {
    this.state.status = "playing";
    this.lastTick = Date.now();
    this.matchStartTime = this.matchStartTime ?? Date.now();
    this.activeRejoinDeadline = null;

    this.broadcast("server:match-started", {
      roomId: this.id,
      state: this.snapshot(),
    });

    this.hooks?.onMatchStarted?.({ roomId: this.id });

    this.loopHandle = setInterval(() => this.tick(), GAME_CONFIG.loopIntervalMs);
    this.persistState("playing", null, true);
  }

  private tick(): void {
    const now = Date.now();
    const delta = now - this.lastTick;
    this.lastTick = now;

    const result = stepGameState(this.state, delta);
    this.state = result.state;

    this.broadcast("server:state", {
      roomId: this.id,
      state: this.snapshot(),
    });
    this.persistState("playing");

    if (result.winner) {
      this.broadcast("server:match-ended", {
        roomId: this.id,
        winner: result.winner,
        state: this.snapshot(),
        reason: "finished",
      });
      this.state.status = "ended";
      this.stopLoop();
      this.persistState("completed", null, true);
      this.notifyMatchEnded({ reason: "completed", winner: result.winner });
      this.cleanup();
    }
  }

  private stopLoop(): void {
    if (this.loopHandle) {
      clearInterval(this.loopHandle);
      this.loopHandle = null;
    }
  }

  private resumeLoop(): void {
    const leftConnected = this.players.left?.connected ?? false;
    const rightConnected = this.players.right?.connected ?? false;
    if (this.loopHandle || this.state.status === "ended" || !(leftConnected && rightConnected)) {
      return;
    }
    this.state.status = "playing";
    this.lastTick = Date.now();
    this.activeRejoinDeadline = null;
    this.loopHandle = setInterval(() => this.tick(), GAME_CONFIG.loopIntervalMs);
    this.broadcast("server:state", {
      roomId: this.id,
      state: this.snapshot(),
    });
    this.persistState("playing", null, true);
  }

  private notifyMatchEnded(context: { 
    reason: "completed" | "player_left" | "forfeit"; 
    winner?: PlayerSide;
    playerDataSnapshot?: { left?: PlayerSession; right?: PlayerSession };
  }): void {
    if (this.matchClosed) {
      return;
    }
    this.matchClosed = true;

    // Save match history if the match was completed or forfeited
    if (context.reason === "completed" || context.reason === "forfeit") {
      // Use snapshot if provided (for forfeits), otherwise use current players (for completed matches)
      const leftPlayer = context.playerDataSnapshot?.left ?? this.players.left;
      const rightPlayer = context.playerDataSnapshot?.right ?? this.players.right;
      const db = getDatabase();
      if (this.players.left?.userId)
        setUserStatus(db, this.io, this.players.left?.userId, 'ONLINE');
      if (this.players.right?.userId)
        setUserStatus(db, this.io, this.players.right?.userId, 'ONLINE');
      if (leftPlayer && rightPlayer && context.winner && this.matchStartTime) {
        const winnerId = context.winner === "left" ? leftPlayer.userId : rightPlayer.userId;
        const durationSeconds = Math.floor((Date.now() - this.matchStartTime) / 1000);
        
        try {
          saveMatchHistory({
            matchId: this.id,
            player1Id: leftPlayer.userId,
            player2Id: rightPlayer.userId,
            player1Score: this.state.score.left,
            player2Score: this.state.score.right,
            winnerId,
            matchType: this.hooks?.tournamentCode ? 'tournament' : '1v1',
            tournamentCode: this.hooks?.tournamentCode ?? null,
            durationSeconds,
            createdAt: this.matchStartTime,
          });
        } catch (error) {
        }
      }
    }

    this.hooks?.onMatchEnded?.({
      roomId: this.id,
      reason: context.reason,
      winner: context.winner,
    });
  }

  private cleanup(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    deleteMatch(this.id);
    this.onCleanup(this.id);
  }

  private hasBothPlayers(): boolean {
    return Boolean(this.players.left && this.players.right);
  }

  private allPlayersReady(): boolean {
    return Boolean(this.players.left?.ready && this.players.right?.ready);
  }

  private getSessionBySocket(socketId: string): PlayerSession | undefined {
    const left = this.players.left;
    if (left && left.socketId === socketId) {
      return left;
    }

    const right = this.players.right;
    if (right && right.socketId === socketId) {
      return right;
    }

    return undefined;
  }

  private getOpponentSession(side: PlayerSide): PlayerSession | undefined {
    return side === "left" ? this.players.right : this.players.left;
  }

  private getSessionByUsername(username: string): PlayerSession | undefined {
    const candidates = [this.players.left, this.players.right];
    return candidates.find((session) => session?.username === username);
  }

  private getSessionByUserId(userId: number): PlayerSession | undefined {
    const candidates = [this.players.left, this.players.right];
    return candidates.find((session) => session?.userId === userId);
  }

  private buildMatchReadyPayload(): MatchReadyPayload {
    return {
      roomId: this.id,
      players: this.serializePlayers(),
      state: this.snapshot(),
    };
  }
  
  private finalizeDeparture(session: PlayerSession, reason: LeaveReason, disconnectedSocketId?: string): void {
    if (!this.players[session.side]) {
      return;
    }
    if (this.players.left?.userId)
      setUserStatus(getDatabase(), this.io, this.players.left?.userId, 'ONLINE');
    if (this.players.right?.userId)
      setUserStatus(getDatabase(), this.io, this.players.right?.userId, 'ONLINE');
    
    if (session.rejoinTimer) {
      clearTimeout(session.rejoinTimer);
      session.rejoinTimer = null;
    }

    session.connected = false;
    this.persistPlayerState(session);
    
    // Determine if the remaining player should win by forfeit
    const opponent = this.getOpponentSession(session.side);
    let forfeitWinner: PlayerSide | null = null;
    
    if (opponent && opponent.connected && reason === "disconnect") {
      // Award forfeit win to the connected opponent
      forfeitWinner = opponent.side;
    }
    
    // Notify the disconnecting player using their socketId (they're still connected, just on another page)
    if (disconnectedSocketId) {
      this.io.to(disconnectedSocketId).emit("server:match-ended", {
        roomId: this.id,
        state: this.snapshot(),
        winner: forfeitWinner || opponent?.side || null,
        reason: forfeitWinner ? "forfeit" : "finished",
      });
    }
    
    // Save player data BEFORE deleting for match history
    const playerDataBeforeDeletion = {
      left: this.players.left,
      right: this.players.right,
    };
    
    delete this.players[session.side];
    if (session.socket) {
      session.socket.leave(this.id);
    }
    this.state.status = "ended";
    this.activeRejoinDeadline = null;

    this.stopLoop();
    
    // Notify remaining player about the outcome
    if (forfeitWinner && opponent?.socket) {
      opponent.socket.emit("server:match-ended", {
        roomId: this.id,
        state: this.snapshot(),
        winner: forfeitWinner,
        reason: "forfeit",
      });
    } else {
      this.broadcast("server:opponent-left", {
        roomId: this.id,
        reason,
      });
    }
    
    this.persistState("player_left", null, true);
    this.notifyMatchEnded({ 
      reason: forfeitWinner ? "forfeit" : "player_left", 
      winner: forfeitWinner || undefined,
      playerDataSnapshot: playerDataBeforeDeletion,
    });
    
    this.cleanup();
  }

  private serializePlayers(): Array<{ side: PlayerSide; username: string }> {
    const summary: Array<{ side: PlayerSide; username: string }> = [];
    if (this.players.left) {
      summary.push({ side: "left", username: this.players.left.username });
    }
    if (this.players.right) {
      summary.push({ side: "right", username: this.players.right.username });
    }
    return summary;
  }

  private snapshot(): GameState {
    return {
      ball: {
        position: { ...this.state.ball.position },
        velocity: { ...this.state.ball.velocity },
      },
      paddles: {
        left: { ...this.state.paddles.left },
        right: { ...this.state.paddles.right },
      },
      score: { ...this.state.score },
      status: this.state.status,
      rally: this.state.rally,
    };
  }

  private broadcast(event: string, payload: unknown): void {
    this.io.to(this.id).emit(event, payload);
  }
}

export interface PlayerTicket {
  socket: Socket;
  userId: number;
  username: string;
}

export class GameRoomManager {
  private readonly io: Server;
  private readonly rooms = new Map<string, GameRoom>();
  private readonly socketRoomMap = new Map<string, string>();

  public constructor(io: Server) {
    this.io = io;
    try {
      pruneExpiredMatches(Date.now());
    } catch (error) {
      console.error("Failed to prune expired matches on startup:", error);
    }
  }

  public createRoom(players: [PlayerTicket, PlayerTicket], hooks?: MatchLifecycleHooks): GameRoom {
    
    const roomId = randomUUID();
    const room = new GameRoom(this.io, roomId, (rid) => this.disposeRoom(rid), hooks);
    this.rooms.set(roomId, room);

    players.forEach((ticket) => {
      room.addPlayer(ticket.socket, ticket.userId, ticket.username);
      this.socketRoomMap.set(ticket.socket.id, roomId);
      const payload = room.getJoinPayload(ticket.socket.id);
      if (payload) {
        ticket.socket.emit("server:joined", payload);
      }
    });
      const db = getDatabase();
        setUserStatus(db, this.io, players[0].userId, 'IN-GAME');
        setUserStatus(db, this.io, players[1].userId, 'IN-GAME');

    return room;
  }

  public markReady(socketId: string): void {
    this.lookupRoom(socketId)?.markReady(socketId);
  }

  public applyInput(socketId: string, command: InputCommand): void {
    this.lookupRoom(socketId)?.applyInput(socketId, command);
  }

  public handleLeave(socketId: string, reason: LeaveReason): void {
    const roomId = this.socketRoomMap.get(socketId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.socketRoomMap.delete(socketId);
      return;
    }

    room.handleLeave(socketId, reason);
    this.socketRoomMap.delete(socketId);
  }

  public handleDisconnect(socketId: string): void {
    const roomId = this.socketRoomMap.get(socketId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    this.socketRoomMap.delete(socketId);
    room?.markDisconnected(socketId);
  }

  public rejoinRoom(roomId: string, socket: Socket, userId: number, username: string): "approved" | "unknown" | "occupied" | "expired" {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.restoreRoomFromStorage(roomId);
    }
    if (!room) {
      return "expired";
    }

    const result = room.rejoinPlayer(socket, userId, username);
    if (result === "approved") {
      this.socketRoomMap.set(socket.id, roomId);
    }
    return result;
  }

  /**
   * Check if a user is currently in any active Pong game room
   * @param userId - The user ID to check
   * @returns true if user is in a game, false otherwise
   */
  public isUserInGame(userId: number): boolean {
    // Check all active rooms for this user
    for (const room of this.rooms.values()) {
      const hasPlayer = (room as any).getSessionByUserId?.(userId);
      if (hasPlayer) {
        return true;
      }
    }
    return false;
  }

  private lookupRoom(socketId: string): GameRoom | undefined {
    const roomId = this.socketRoomMap.get(socketId);
    if (!roomId) {
      return undefined;
    }
    return this.rooms.get(roomId);
  }

  private restoreRoomFromStorage(roomId: string): GameRoom | undefined {
    const snapshot = loadActiveMatch(roomId, Date.now());
    if (!snapshot) {
      return undefined;
    }

    const room = new GameRoom(this.io, roomId, (rid) => this.disposeRoom(rid));
    room.hydrateFromSnapshot(snapshot);
    this.rooms.set(roomId, room);
    return room;
  }

  private disposeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    for (const [socketId, mappedRoomId] of this.socketRoomMap.entries()) {
      if (mappedRoomId === roomId) {
        this.socketRoomMap.delete(socketId);
      }
    }

    this.rooms.delete(roomId);
  }
}
