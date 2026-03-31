import { useState, useEffect, useCallback, useRef } from "react";
import { WebSocketClient } from "../game/network/wsclient";

export type PlayerSide = "left" | "right";
export type MatchStatus = "waiting" | "ready" | "playing" | "ended";
export type QueueStatus = "waiting" | "matched";
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

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "queued"
  | "matched"
  | "playing"
  | "ended"
  | "error"
  | "opponent_disconnected";

interface ServerQueuePayload {
  status: QueueStatus;
  position?: number;
  roomId?: string;
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
  reason?: "finished" | "forfeit" | "tie";
}

interface ServerErrorPayload {
  message: string;
}

export interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  gameState: ServerGameState | null;
  playerSide: PlayerSide | null;
  players: MatchPlayers | null;
  roomId: string | null;
  winner: PlayerSide | null;
  errorMessage: string | null;
  reconnectionTimeoutMs: number | null;
  matchEndReason: "finished" | "forfeit" | "tie" | null;
  connect: (username: string, isInvite?: boolean) => Promise<void>;
  disconnect: () => void;
  sendInput: (command: InputCommand) => void;
  sendReady: () => void;
  rejoin: (roomId: string, username: string) => void;
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

export function useWebSocket(): UseWebSocketReturn {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [playerSide, setPlayerSide] = useState<PlayerSide | null>(null);
  const [players, setPlayers] = useState<MatchPlayers | null>(null);
  const [roomId, setRoomId] = useState<string | null>(() => {
    return sessionStorage.getItem("activeGameRoomId") || null;
  });
  const [winner, setWinner] = useState<PlayerSide | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconnectionTimeoutMs, setReconnectionTimeoutMs] = useState<number | null>(null);
  const [matchEndReason, setMatchEndReason] = useState<"finished" | "forfeit" | "tie" | null>(null);

  const usernameRef = useRef<string>("");
  const listenersSetupRef = useRef(false);
  const roomIdRef = useRef<string | null>(roomId);
  
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  
  useEffect(() => {
    if (roomId) {
      sessionStorage.setItem("activeGameRoomId", roomId);
    } else {
      sessionStorage.removeItem("activeGameRoomId");
    }
  }, [roomId]);

  const setupListeners = useCallback(() => {
    const client = WebSocketClient.getInstance();
    const socket = client.getSocket();
    if (!socket) return;

    socket.removeAllListeners("server:connected");
    socket.removeAllListeners("server:queue");
    socket.removeAllListeners("server:joined");
    socket.removeAllListeners("server:match-ready");
    socket.removeAllListeners("server:match-started");
    socket.removeAllListeners("server:state");
    socket.removeAllListeners("server:match-ended");
    socket.removeAllListeners("server:opponent-left");
    socket.removeAllListeners("server:opponent-paused");
    socket.removeAllListeners("server:opponent-resumed");
    socket.removeAllListeners("server:error");
    socket.removeAllListeners("rejoin-response");

    listenersSetupRef.current = true;

    socket.on("server:connected", () => {
      setConnectionStatus("connected");
    });
    
    socket.on("rejoin-response", (payload: { status: string; message?: string }) => {
      if (payload.status !== "approved") {
        sessionStorage.removeItem("activeGameRoomId");
        setRoomId(null);
        setErrorMessage(payload.message || "Could not rejoin match");
        if (usernameRef.current) {
          const client = WebSocketClient.getInstance();
          client.emit("client:join", { username: usernameRef.current });
        }
      }
    });

    socket.on("server:queue", (payload: ServerQueuePayload) => {
      if (payload.status === "waiting") {
        setConnectionStatus("queued");
      } else if (payload.status === "matched") {
        setConnectionStatus("matched");
        if (payload.roomId) {
          setRoomId(payload.roomId);
        }
      }
    });

    socket.on("server:joined", (payload: ServerJoinedPayload) => {
      setRoomId(payload.roomId);
      setPlayerSide(payload.side);
      setGameState(payload.state);

      if (payload.opponent) {
        const mappedPlayers = mapPlayers([
          { side: payload.side, username: usernameRef.current || "You" },
          payload.opponent,
        ]);
        setPlayers(mappedPlayers);
      }

      if (payload.state.status === "playing") {
        setConnectionStatus("playing");
      } else {
        setConnectionStatus("matched");
      }
    });

    socket.on("server:match-ready", (payload: ServerMatchReadyPayload) => {
      const mappedPlayers = mapPlayers(payload.players);
      setPlayers(mappedPlayers);
      setGameState(payload.state);
      setRoomId(payload.roomId);
      setConnectionStatus("matched");
    });

    socket.on("server:match-started", (payload: ServerStatePayload) => {
      setGameState(payload.state);
      setConnectionStatus("playing");
    });

    socket.on("server:state", (payload: ServerStatePayload) => {
      setGameState(payload.state);
      if (payload.state.status === "playing") {
        setConnectionStatus("playing");
      }
    });

    socket.on("server:match-ended", (payload: ServerMatchEndedPayload) => {
      setGameState(payload.state);
      setWinner(payload.winner);
      setMatchEndReason(payload.reason || "finished");
      setConnectionStatus("ended");
      setRoomId(null);
      sessionStorage.removeItem("activeGameRoomId");
    });

    socket.on("server:opponent-left", () => {
      setConnectionStatus("opponent_disconnected");
      setReconnectionTimeoutMs(null);
      setRoomId(null);
      sessionStorage.removeItem("activeGameRoomId");
    });

    socket.on("server:opponent-paused", (payload: { roomId: string; timeoutMs: number }) => {
      setConnectionStatus("opponent_disconnected");
      setReconnectionTimeoutMs(payload.timeoutMs);
    });

    socket.on("server:opponent-resumed", () => {
      setReconnectionTimeoutMs(null);
      if (gameState?.status === "playing") {
        setConnectionStatus("playing");
      } else {
        setConnectionStatus("matched");
      }
    });

    socket.on("server:error", (payload: ServerErrorPayload) => {
      setErrorMessage(payload.message);
      setConnectionStatus("error");
    });

    client.onDisconnect((reason) => {
      listenersSetupRef.current = false;
      if (connectionStatus !== "disconnected") {
        setConnectionStatus("error");
        setErrorMessage(`Disconnected: ${reason}`);
      }
    });

    client.onReconnect(() => {
      if (roomId && usernameRef.current) {
        socket.emit("client:rejoin", {
          roomId,
          username: usernameRef.current,
        });
      }
    });
  }, [connectionStatus, gameState?.status, roomId]);

  const connect = useCallback(
    async (username: string, isInvite: boolean = false) => {
      usernameRef.current = username;
      setConnectionStatus("connecting");
      setErrorMessage(null);
      setWinner(null);

      try {
        const client = WebSocketClient.getInstance();
        await client.connect();
        setupListeners();
        
        const storedRoomId = sessionStorage.getItem("activeGameRoomId");
        if (storedRoomId) {
          client.emit("client:rejoin", { roomId: storedRoomId, username });
        } else if (!isInvite) {
          client.emit("client:join", { username });
        }
      } catch (error) {
        setConnectionStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Connection failed"
        );
      }
    },
    [setupListeners]
  );

  const disconnect = useCallback(() => {
    const client = WebSocketClient.getInstance();
    client.emit("client:leave");
    client.reset();
    listenersSetupRef.current = false;
    setConnectionStatus("disconnected");
    setGameState(null);
    setPlayerSide(null);
    setPlayers(null);
    setRoomId(null);
    setWinner(null);
    setErrorMessage(null);
  }, []);

  const sendInput = useCallback((command: InputCommand) => {
    const client = WebSocketClient.getInstance();
    client.emit("client:input", { command });
  }, []);

  const sendReady = useCallback(() => {
    const client = WebSocketClient.getInstance();
    client.emit("client:ready", { ready: true });
  }, []);

  const rejoin = useCallback((roomId: string, username: string) => {
    usernameRef.current = username;
    const client = WebSocketClient.getInstance();
    client.emit("client:rejoin", { roomId, username });
  }, []);

  useEffect(() => {
    return () => {
      const client = WebSocketClient.getInstance();
      const socket = client.getSocket();
      
      const currentRoomId = roomIdRef.current;
      if (socket && currentRoomId) {
        socket.emit("pingpong_off");
      }
      
      listenersSetupRef.current = false;
    };
  }, []);

  return {
    connectionStatus,
    gameState,
    playerSide,
    players,
    roomId,
    winner,
    errorMessage,
    reconnectionTimeoutMs,
    matchEndReason,
    connect,
    disconnect,
    sendInput,
    sendReady,
    rejoin,
  };
}
