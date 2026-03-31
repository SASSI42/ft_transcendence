import { useState, useEffect, useCallback, useRef } from "react";
import { WebSocketClient } from "../game/network/wsclient";

export type TournamentStatus = "registering" | "in_progress" | "completed";

export interface TournamentParticipantSnapshot {
  alias: string;
  connected: boolean;
  ready: boolean;
  inMatch: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface TournamentBracketMatchSnapshot {
  id: string;
  left: string;
  right: string;
  status: "pending" | "current" | "completed" | "bye";
  winner?: string;
}

export interface TournamentBracketRoundSnapshot {
  round: number;
  matches: TournamentBracketMatchSnapshot[];
}

export interface TournamentBracketSnapshot {
  currentRound: number;
  rounds: TournamentBracketRoundSnapshot[];
  currentMatch?: {
    id: string;
    round: number;
    left: string;
    right: string;
  };
  champion?: string;
}

export interface TournamentSnapshot {
  code: string;
  name: string;
  createdAt: number;
  status: TournamentStatus;
  participants: TournamentParticipantSnapshot[];
  capacity?: number;
  bracket?: TournamentBracketSnapshot;
}

export type TournamentConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "joined"
  | "in_match"
  | "error";

export type PlayerSide = "left" | "right";
export type MatchStatus = "waiting" | "ready" | "playing" | "ended";
export type InputCommand = "up" | "down" | "stop";

export interface Vector2 {
  x: number;
  y: number;
}

export interface PaddleState {
  position: number;
  direction: -1 | 0 | 1;
}

export interface ServerGameState {
  ball: { position: Vector2; velocity: Vector2 };
  paddles: Record<PlayerSide, PaddleState>;
  score: { left: number; right: number };
  status: MatchStatus;
  rally: number;
}

export interface MatchPlayer {
  username: string;
  side: PlayerSide;
}

export interface MatchPlayers {
  left: MatchPlayer;
  right: MatchPlayer;
}

interface ServerTournamentCreatedPayload {
  code: string;
  snapshot: TournamentSnapshot;
  alias: string;
}

interface ServerTournamentJoinedPayload {
  code: string;
  snapshot: TournamentSnapshot;
  alias: string;
}

interface ServerTournamentUpdatePayload {
  code: string;
  snapshot: TournamentSnapshot;
}

interface ServerTournamentErrorPayload {
  message: string;
}

interface ServerJoinedPayload {
  roomId: string;
  side: PlayerSide;
  opponent: { side: PlayerSide; username: string } | null;
  state: ServerGameState;
}

interface ServerMatchReadyPayload {
  roomId: string;
  players: Array<{ side: PlayerSide; username: string }>;
  state: ServerGameState;
}

interface ServerStatePayload {
  roomId: string;
  state: ServerGameState;
}

interface ServerMatchEndedPayload {
  roomId: string;
  winner: PlayerSide;
  state: ServerGameState;
}

interface ServerErrorPayload {
  message: string;
}

export interface UseTournamentWebSocketReturn {
  connectionStatus: TournamentConnectionStatus;
  tournamentSnapshot: TournamentSnapshot | null;
  tournamentCode: string | null;
  alias: string | null;
  errorMessage: string | null;
  // Match state
  gameState: ServerGameState | null;
  playerSide: PlayerSide | null;
  players: MatchPlayers | null;
  roomId: string | null;
  winner: PlayerSide | null;
  // Reconnection/forfeit state
  reconnectionTimeoutMs: number | null;
  opponentDisconnected: boolean;
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  createTournament: (name: string, alias: string, capacity?: number) => void;
  joinTournament: (code: string, alias: string) => void;
  leaveTournament: () => void;
  setReady: (ready: boolean) => void;
  sendInput: (command: InputCommand) => void;
  sendReady: () => void;
}

const mapPlayers = (
  entries: Array<{ side: PlayerSide; username: string }>
): MatchPlayers =>
  entries.reduce<MatchPlayers>(
    (acc, { side, username }) => {
      acc[side] = { username, side };
      return acc;
    },
    {
      left: { username: "Player 1", side: "left" },
      right: { username: "Player 2", side: "right" },
    }
  );

export function useTournamentWebSocket(): UseTournamentWebSocketReturn {
  const [connectionStatus, setConnectionStatus] =
    useState<TournamentConnectionStatus>("disconnected");
  const [tournamentSnapshot, setTournamentSnapshot] =
    useState<TournamentSnapshot | null>(null);
  const [tournamentCode, setTournamentCode] = useState<string | null>(() => {
    // Restore tournamentCode from sessionStorage on mount
    return sessionStorage.getItem("activeTournamentCode") || null;
  });
  const [alias, setAlias] = useState<string | null>(() => {
    // Restore alias from sessionStorage on mount
    return sessionStorage.getItem("activeTournamentAlias") || null;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Match state
  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [playerSide, setPlayerSide] = useState<PlayerSide | null>(null);
  const [players, setPlayers] = useState<MatchPlayers | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [winner, setWinner] = useState<PlayerSide | null>(null);

  // Reconnection/forfeit state
  const [reconnectionTimeoutMs, setReconnectionTimeoutMs] = useState<number | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const aliasRef = useRef<string>("");
  const tournamentCodeRef = useRef<string | null>(null);
  const listenersSocketIdRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(roomId);
  
  // Keep roomIdRef in sync with roomId state
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Persist tournament data to sessionStorage
  useEffect(() => {
    if (tournamentCode) {
      sessionStorage.setItem("activeTournamentCode", tournamentCode);
    } else {
      sessionStorage.removeItem("activeTournamentCode");
    }
  }, [tournamentCode]);

  useEffect(() => {
    if (alias) {
      sessionStorage.setItem("activeTournamentAlias", alias);
    } else {
      sessionStorage.removeItem("activeTournamentAlias");
    }
  }, [alias]);

  const setupListeners = useCallback(() => {
    const client = WebSocketClient.getInstance();
    const socket = client.getSocket();
    const currentSocketId = socket?.id ?? null;
    
    // Only skip if we already have listeners on THIS socket
    if (!socket || listenersSocketIdRef.current === currentSocketId) return;

    listenersSocketIdRef.current = currentSocketId;

    socket.on("server:connected", () => {
      setConnectionStatus("connected");
    });

    // Tournament events
    socket.on(
      "server:tournament:created",
      (payload: ServerTournamentCreatedPayload) => {
        setTournamentCode(payload.code);
        tournamentCodeRef.current = payload.code;
        setTournamentSnapshot(payload.snapshot);
        setAlias(payload.alias);
        aliasRef.current = payload.alias;
        setConnectionStatus("joined");
        setErrorMessage(null);
      }
    );

    socket.on(
      "server:tournament:error",
      (payload: ServerTournamentErrorPayload) => {
        setErrorMessage(payload.message);
        if (payload.message?.includes("not found") || payload.message?.includes("full") || payload.message?.includes("already")) {
          sessionStorage.removeItem("activeTournamentCode");
          sessionStorage.removeItem("activeTournamentAlias");
          setTournamentCode(null);
          tournamentCodeRef.current = null;
          setAlias(null);
          aliasRef.current = "";
        }
      }
    );

    socket.on(
      "server:tournament:joined",
      (payload: ServerTournamentJoinedPayload) => {
        setTournamentCode(payload.code);
        tournamentCodeRef.current = payload.code;
        setTournamentSnapshot(payload.snapshot);
        setAlias(payload.alias);
        aliasRef.current = payload.alias;
        setConnectionStatus("joined");
        setErrorMessage(null);
      }
    );

    socket.on(
      "server:tournament:update",
      (payload: ServerTournamentUpdatePayload) => {
        setTournamentSnapshot(payload.snapshot);
      }
    );

    socket.on(
      "server:tournament:left",
      () => {
        setTournamentCode(null);
        tournamentCodeRef.current = null;
        setTournamentSnapshot(null);
        setAlias(null);
        aliasRef.current = "";
        setConnectionStatus("connected");
        // Clear sessionStorage
        sessionStorage.removeItem("activeTournamentCode");
        sessionStorage.removeItem("activeTournamentAlias");
      }
    );

    // Match events (for tournament matches)
    socket.on("server:joined", (payload: ServerJoinedPayload) => {
      setRoomId(payload.roomId);
      setPlayerSide(payload.side);
      setGameState(payload.state);

      if (payload.opponent) {
        const mappedPlayers = mapPlayers([
          { side: payload.side, username: aliasRef.current || "You" },
          payload.opponent,
        ]);
        setPlayers(mappedPlayers);
      }

      if (payload.state.status === "playing") {
        setConnectionStatus("in_match");
      }
    });

    socket.on("server:match-ready", (payload: ServerMatchReadyPayload) => {
      const mappedPlayers = mapPlayers(payload.players);
      setPlayers(mappedPlayers);
      setGameState(payload.state);
      setRoomId(payload.roomId);
      setConnectionStatus("in_match");
    });

    socket.on("server:match-started", (payload: ServerStatePayload) => {
      setGameState(payload.state);
      setConnectionStatus("in_match");
    });

    socket.on("server:state", (payload: ServerStatePayload) => {
      setGameState(payload.state);
      if (payload.state.status === "playing") {
        setConnectionStatus("in_match");
      }
    });

    socket.on("server:match-ended", (payload: ServerMatchEndedPayload) => {
      setGameState(payload.state);
      setWinner(payload.winner);
      // Clear match state after a brief delay to show result
      setTimeout(() => {
        setGameState(null);
        setPlayerSide(null);
        setPlayers(null);
        setRoomId(null);
        setWinner(null);
        setConnectionStatus("joined");
      }, 3000);
    });

    socket.on("server:opponent-left", () => {
      // Opponent left during match, reset match state
      setGameState(null);
      setPlayerSide(null);
      setPlayers(null);
      setRoomId(null);
      setWinner(null);
      setReconnectionTimeoutMs(null);
      setOpponentDisconnected(false);
      if (tournamentCodeRef.current) {
        setConnectionStatus("joined");
      }
    });

    socket.on("server:opponent-paused", (payload: { roomId: string; timeoutMs: number }) => {
      setOpponentDisconnected(true);
      setReconnectionTimeoutMs(payload.timeoutMs);
    });

    socket.on("server:opponent-resumed", () => {
      setOpponentDisconnected(false);
      setReconnectionTimeoutMs(null);
    });

    socket.on("server:error", (payload: ServerErrorPayload) => {
      setErrorMessage(payload.message);
      setConnectionStatus("error");
    });

    client.onDisconnect((reason) => {
      listenersSocketIdRef.current = null;
      if (connectionStatus !== "disconnected") {
        setConnectionStatus("error");
        setErrorMessage(`Disconnected: ${reason}`);
      }
    });

    client.onReconnect(() => {
      // Attempt to rejoin tournament if we had one
      if (tournamentCodeRef.current && aliasRef.current) {
        socket.emit("client:tournament:join", {
          code: tournamentCodeRef.current,
          alias: aliasRef.current,
        });
      }
    });
  }, [connectionStatus]);

  const connect = useCallback(async () => {
    setConnectionStatus("connecting");
    setErrorMessage(null);

    try {
      const client = WebSocketClient.getInstance();
      await client.connect();
      setupListeners();
      
      const storedCode = sessionStorage.getItem("activeTournamentCode");
      const storedAlias = sessionStorage.getItem("activeTournamentAlias");
      
      if (storedCode && storedAlias) {
        tournamentCodeRef.current = storedCode;
        aliasRef.current = storedAlias;
        client.emit("client:tournament:join", {
          code: storedCode,
          alias: storedAlias,
        });
      } else {
        setConnectionStatus("connected");
      }
    } catch (error) {
      setConnectionStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Connection failed"
      );
    }
  }, [setupListeners]);

  const disconnect = useCallback(() => {
    const client = WebSocketClient.getInstance();
    client.emit("client:tournament:leave");
    client.reset();
    listenersSocketIdRef.current = null;
    setConnectionStatus("disconnected");
    setTournamentSnapshot(null);
    setTournamentCode(null);
    tournamentCodeRef.current = null;
    setAlias(null);
    aliasRef.current = "";
    setGameState(null);
    setPlayerSide(null);
    setPlayers(null);
    setRoomId(null);
    setWinner(null);
    setErrorMessage(null);
    // Clear sessionStorage
    sessionStorage.removeItem("activeTournamentCode");
    sessionStorage.removeItem("activeTournamentAlias");
  }, []);

  const createTournament = useCallback(
    (name: string, playerAlias: string, capacity?: number) => {
      const client = WebSocketClient.getInstance();
      client.emit("client:tournament:create", { name, alias: playerAlias, capacity });
    },
    []
  );

  const joinTournament = useCallback((code: string, playerAlias: string) => {
    const client = WebSocketClient.getInstance();
    client.emit("client:tournament:join", { code, alias: playerAlias });
  }, []);

  const leaveTournament = useCallback(() => {
    const client = WebSocketClient.getInstance();
    client.emit("client:tournament:leave");
    setTournamentSnapshot(null);
    setTournamentCode(null);
    tournamentCodeRef.current = null;
    setAlias(null);
    aliasRef.current = "";
    setConnectionStatus("connected");
    sessionStorage.removeItem("activeTournamentCode");
    sessionStorage.removeItem("activeTournamentAlias");
  }, []);

  const setReady = useCallback((ready: boolean) => {
    const client = WebSocketClient.getInstance();
    client.emit("client:tournament:ready", { ready });
  }, []);

  const sendInput = useCallback((command: InputCommand) => {
    const client = WebSocketClient.getInstance();
    client.emit("client:input", { command });
  }, []);

  const sendReady = useCallback(() => {
    const client = WebSocketClient.getInstance();
    client.emit("client:ready", { ready: true });
  }, []);

  useEffect(() => {
    return () => {
      const client = WebSocketClient.getInstance();
      const socket = client.getSocket();
      
      const currentRoomId = roomIdRef.current;
      if (socket && currentRoomId) {
        socket.emit("pingpong_off");
      }
      
      listenersSocketIdRef.current = null;
    };
  }, []);

  return {
    connectionStatus,
    tournamentSnapshot,
    tournamentCode,
    alias,
    errorMessage,
    gameState,
    playerSide,
    players,
    roomId,
    winner,
    reconnectionTimeoutMs,
    opponentDisconnected,
    connect,
    disconnect,
    createTournament,
    joinTournament,
    leaveTournament,
    setReady,
    sendInput,
    sendReady,
  };
}
