//xo game
export type PlayerSymbol = "X" | "O";
export type MatchStatus = "ONGOING" | "FINISHED" | "CANCELLED";
export type RoundStatus = "IN_PROGRESS" | "X_WIN" | "O_WIN" | "DRAW";

export interface Player {
    id: number;
    username: string;
    avatarUrl: string;
};

export interface RoundState {
  board: (PlayerSymbol | null)[];
  turn: PlayerSymbol;
  moveCount: number;
  status: RoundStatus;
  winningLine: number[] | null;
}

export type DisconnectState = {
  timeout: ReturnType<typeof setTimeout> | null;
  expiresAt: number | null;
};

export interface MatchState {
  matchId: string;
  scores: { X: number; O: number };
  roundNumber: number;
  status: MatchStatus;
  winner: number | null;
  winReason: "NORMAL" | "FORFEIT" | null;
  disconnectState: Map<string, DisconnectState> | null;
  roundState: RoundState;
}

export interface MatchFoundPayload {
  matchId: string;
  opponent: Player;
  role: PlayerSymbol;
}

export interface User {
    id: number;
    username: string;
    email: string;
    avatarUrl: string;
    status: 'online' | 'offline' | 'in-game' | 'in-queue';
}

export interface Message {
    id: string;
    senderId: number;
    receiverId: number;
    content: string;
    read: boolean;
    isInvite?: boolean;
    createdAt: string;
}

export interface GameInvite {
    id: string;
    senderId: number;
    receiverId: number;
    gameId?: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    createdAt: string;
    expiresAt: string;
    senderUsername?: string;
    senderAvatar: string;
}

export interface Friend extends User {
    lastMessageTime?: string;
    isBlocked: boolean;
}