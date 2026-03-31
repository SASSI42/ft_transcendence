import { createContext } from "react";
import type { Player, MatchState, PlayerSymbol } from "../../types/index";
import type { Socket } from 'socket.io-client';
import type { AuthContextType } from "../User_management/authContext";

interface GameContextType {
  socket: Socket | null;
  auth: AuthContextType;
  isConnected: boolean;
  isSearching: boolean;
  matchState: MatchState | null;
  playerSymbol: PlayerSymbol | null;
  opponentDisconnected: boolean;
  opponentExpiresAt: number | null;
  opponent: Player | null;

  gameError: string | null;
  joinQueue: () => void;
  leaveQueue: () => void;
  makeMove: (position: number) => void;
  forfeit: () => void;
  joinMatch: (matchId: string) => void;
  resetGame: () => void;
}

export const GameContext = createContext<GameContextType | undefined>(undefined);
