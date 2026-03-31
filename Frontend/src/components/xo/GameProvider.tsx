import React, {
  useEffect,
  useState,
  useCallback,
} from "react";
import { GameContext } from "./GameContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../components/User_management/authContext";
import { socketService } from "../../services/socket";
import type { Player, MatchState, PlayerSymbol, MatchFoundPayload, DisconnectState } from "../../types/index";
import { z } from 'zod';

const PlayerSymbolSchema = z.enum(["X", "O"]);
const NullablePlayerSymbolSchema = PlayerSymbolSchema.nullable();

const PlayerSchema = z.object({
  id: z.number().positive(),
  username: z.string(),
  avatarUrl: z.string(),
})

const MatchFoundPayloadSchema = z.object({
  matchId: z.uuid(),
  opponent: PlayerSchema,
  role: PlayerSymbolSchema
})

const ScoresSchema = z.object({
  X: z.number().int().min(0).max(2),
  O: z.number().int().min(0).max(2),
});

const RoundStateSchema = z.object({
  board: z.array(NullablePlayerSymbolSchema).length(9),
  turn: PlayerSymbolSchema,
  moveCount: z.number().int().min(0).max(9),
  status: z.enum(["IN_PROGRESS", "X_WIN", "O_WIN", "DRAW"]),
  winningLine: z.array(z.number().int()).length(3).nullable(),
})

const DisconnectStateValueSchema = z.object({
  timeout: z.any().nullable(),
  expiresAt: z.number().nullable(),
});

const DisconnectStateMapSchema: z.ZodType<Map<string, DisconnectState> | null> =
  z
    .record(z.string(), DisconnectStateValueSchema)
    .nullable()
    .transform((state) => {
      if (!state) return null;

      return new Map(
        Object.entries(state).map(([userId, value]) => [
          userId,
          { timeout: null, expiresAt: value.expiresAt ?? null },
        ])
      );
    });

const MatchstateSchema: z.ZodType<MatchState> = z.object({
  matchId: z.string().uuid(),
  scores: ScoresSchema,
  roundNumber: z.number().int().min(1).max(3),
  status: z.enum(["ONGOING", "FINISHED", "CANCELLED"]),
  winner: z.number().nullable(),
  winReason: z.enum(["NORMAL", "FORFEIT"]).nullable(),
  disconnectState: DisconnectStateMapSchema,
  roundState: RoundStateSchema,
});

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();

  const auth = useAuth();
  const isConnected = auth.isLoggedIn;
  const [opponent, setOpponent] = useState<Player | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentExpiresAt, setOpponentExpiresAt] = useState<number | null>(
    null
  );

  const [gameError, setGameError] = useState<string | null>(null);
  const socket = socketService.socket;
  
  useEffect(() => {
    if (socket === null) return;
    const onMatchFound = (rawData: MatchFoundPayload) => {
      const result = MatchFoundPayloadSchema.safeParse(rawData);
      if (!result.success) return;

      const data = result.data;
      localStorage.setItem("xo_opponent", JSON.stringify(data.opponent));
      setOpponent(data.opponent);
      setIsSearching(false);
      setPlayerSymbol(data.role);
      setOpponentDisconnected(false);
      setOpponentExpiresAt(null);
      setGameError(null);
      navigate(`/match/${data.matchId}`);
    };

    const onMatchState = (rawState: MatchState) => {
      const result = MatchstateSchema.safeParse(rawState);
      if (!result.success) return;

      const state = result.data;
      setMatchState(state);

      const opponentId = opponent ? String(opponent.id) : null;
      const opponentState = opponentId
        ? state.disconnectState?.get(opponentId) ?? null
        : null;

      if (opponentState?.expiresAt) {
        setOpponentDisconnected(true);
        setOpponentExpiresAt(opponentState.expiresAt);
      } else {
        setOpponentExpiresAt(null);
        setOpponentDisconnected(false);
      }
    };

    const onGameRole = (data: { role: PlayerSymbol }) =>
      setPlayerSymbol(data.role);

    const onOpponentDisconnected = (data?: { expiresAt: number }) => {
      setOpponentDisconnected(true);
      if (data) setOpponentExpiresAt(data.expiresAt);
    };
    const onOpponentReconnected = ({ user }: { user: number }) => {
      if (user != auth.user?.id)
      {
        setOpponentDisconnected(false);
        setOpponentExpiresAt(null);
      }
    };

    const onError = (err: { message: string }) => {
      console.error("Game Error:", err.message);
      setGameError(err.message);
    };
    socket.on("matchmaking:queued", () => setIsSearching(true));
    socket.on("game:rejoin", onRejoin);
    socket.on("matchmaking:found", onMatchFound);
    socket.on("match:state", onMatchState);
    socket.on("game:role", onGameRole);
    socket.on("opponent:disconnected", onOpponentDisconnected);
    socket.on("opponent:reconnected", onOpponentReconnected);
    socket.on("game:error", onError);

    return () => {
      socket.off("matchmaking:queued");
      socket.off("matchmaking:found");
      socket.off("game:rejoin");
      socket.off("match:state");
      socket.off("game:role");
      socket.off("opponent:disconnected");
      socket.off("opponent:reconnected");
      socket.off("game:error");
    };
  }, [navigate, socket, opponent?.id, auth.user?.id]);

  const joinQueue = useCallback(() => socket!.emit("matchmaking:join"), [socket]);

  const leaveQueue = useCallback(() => {
    socket!.emit("matchmaking:leave");
    setIsSearching(false);
  }, [socket]);

  const makeMove = useCallback(
    (position: number) => {
      if (!matchState) return;
      socket!.emit("game:move", { matchId: matchState.matchId, position });
    },
    [matchState, socket]
  );

  const forfeit = useCallback(() => {
    if (!matchState) return;
    socket!.emit("game:forfeit", { matchId: matchState.matchId });
  }, [matchState, socket]);

  const onRejoin = useCallback(({ matchId }: { matchId: string }) => {
    if (!matchId) return;
    navigate(`/match/${matchId}`)
  }, [socket]);

  const joinMatch = useCallback((matchId: string) => {
    const data_opponent = localStorage.getItem("xo_opponent");
    if (data_opponent === null)
      return setGameError("Opponent Data not found!");
    setOpponent(JSON.parse(data_opponent));
    socket!.emit("game:join", { matchId });
  }, [socket]);

  const resetGame = useCallback(() => {
    setMatchState(null);
    setGameError(null);
    setPlayerSymbol(null);
    setOpponentDisconnected(false);
    setOpponentExpiresAt(null);
  }, [socket]);

  return (
    <GameContext.Provider
      value={{
        socket,
        auth,
        isConnected,
        isSearching,
        matchState,
        playerSymbol,
        opponentDisconnected,
        opponentExpiresAt,
        gameError,
        joinQueue,
        leaveQueue,
        makeMove,
        forfeit,
        joinMatch,
        resetGame,
        opponent,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};