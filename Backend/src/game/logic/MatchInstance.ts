import { RoundEngine, RoundState, PlayerSymbol } from "./RoundEngine";

export interface Player {
  userId: number;
  socketId: string;
}

type DisconnectState = {
  timeout: ReturnType<typeof setTimeout> | null;
  expiresAt: number | null;
};

export interface MatchState {
  matchId: string;
  scores: { X: number; O: number };
  roundNumber: number;
  status: "ONGOING" | "FINISHED" | "CANCELLED";
  winner: number | null;
  winReason: "NORMAL" | "FORFEIT" | null;
  disconnectState: Map<number, DisconnectState> | null;
  roundState: RoundState;
}

export class MatchInstance {
  public readonly matchId: string;
  public readonly players: { X: Player; O: Player };
  private scores: { X: number; O: number };
  private currentRound: RoundEngine;
  private roundIndex: number;
  private status: "ONGOING" | "FINISHED" | "CANCELLED";
  private winnerId: number | null = null;
  private winReason: "NORMAL" | "FORFEIT" | null = null;

  //timer reference
  public disconnectState = new Map<number, DisconnectState>;

  constructor(matchId: string, playerX: Player, playerO: Player) {
    this.matchId = matchId;
    this.players = { X: playerX, O: playerO };
    this.scores = { X: 0, O: 0 };
    this.roundIndex = 0;
    this.disconnectState = new Map();
    this.status = "ONGOING";

    this.currentRound = new RoundEngine("X");
  }

  //start timer
  public startDisconnectTimer(callback: () => void, userId: number, ms: number = 15000) {
    this.clearDisconnectTimer(userId); // clear existing if any

    const userState = this.disconnectState.get(userId);
    if (userState) {
      userState.expiresAt = Date.now() + ms;
      userState.timeout = setTimeout(() => {
        if (this.disconnectState && userState)
        {
          userState.timeout = null;
          callback();
        }
      }, ms);
    }
  }

  //cancel timer
  public clearDisconnectTimer(userId: number) {
    const userState = this.disconnectState.get(userId);
    if (userState) {
      if (userState.timeout) clearTimeout(userState.timeout);
      userState.timeout = null;
      userState.expiresAt = null;
    } else {
      const DState: DisconnectState = {timeout: null, expiresAt: null}
      this.disconnectState.set(userId, DState)
    }
  }

  public getState(): MatchState {
    return {
      matchId: this.matchId,
      scores: { ...this.scores },
      roundNumber: this.roundIndex + 1,
      status: this.status,
      winner: this.winnerId,
      winReason: this.winReason,
      disconnectState: this.disconnectState,
      roundState: this.currentRound.getState(),
    };
  }

  public handleMove(
    userId: number,
    position: number
  ): { success: boolean; error?: string; state: MatchState } {
    if (this.status !== "ONGOING") {
      return {
        success: false,
        error: "Match is finished",
        state: this.getState(),
      };
    }

    let symbol: PlayerSymbol;
    if (userId === this.players.X.userId) symbol = "X";
    else if (userId === this.players.O.userId) symbol = "O";
    else
      return {
        success: false,
        error: "User is not in this match",
        state: this.getState(),
      };

    const result = this.currentRound.applyMove(position, symbol);

    if (!result.success) {
      return { success: false, error: result.error, state: this.getState() };
    }

    const roundState = this.currentRound.getState();
    if (roundState.status !== "IN_PROGRESS") {
      this.handleRoundEnd(roundState.status);
    }

    return { success: true, state: this.getState() };
  }

  private handleRoundEnd(roundStatus: "X_WIN" | "O_WIN" | "DRAW") {
    if (roundStatus === "X_WIN") this.scores.X++;
    if (roundStatus === "O_WIN") this.scores.O++;

    if (this.scores.X >= 2) {
      this.finishMatch(this.players.X.userId);
    } else if (this.scores.O >= 2) {
      this.finishMatch(this.players.O.userId);
    } else if (this.roundIndex >= 2) {
      if (this.scores.X > this.scores.O)
        this.finishMatch(this.players.X.userId);
      else if (this.scores.O > this.scores.X)
        this.finishMatch(this.players.O.userId);
      else this.finishMatch(null);
    } else {
      this.roundIndex++;
      const startSymbol = this.roundIndex % 2 === 0 ? "X" : "O";
      this.currentRound = new RoundEngine(startSymbol);
    }
  }

  public updateSocketId(userId: number, newSocketId: string) {
    if (userId === this.players.X.userId) this.players.X.socketId = newSocketId;
    if (userId === this.players.O.userId) this.players.O.socketId = newSocketId;
  }

  public forfeit(losingUserId: number) {
    if (this.status !== "ONGOING") return;

    this.clearDisconnectTimer(this.players.O.userId);
    this.clearDisconnectTimer(this.players.X.userId);

    this.winReason = "FORFEIT";
    this.status = "FINISHED";
    this.winnerId =
      losingUserId === this.players.X.userId
        ? this.players.O.userId
        : this.players.X.userId;
  }

  private finishMatch(winnerId: number | null) {
    this.clearDisconnectTimer(this.players.X.userId);
    this.clearDisconnectTimer(this.players.O.userId);

    this.winReason = "NORMAL";
    this.status = "FINISHED";
    this.winnerId = winnerId;
  }

  public isPlaying(userId: number): boolean {
    if (this.status === "ONGOING" && (userId == this.players.X.userId || userId == this.players.O.userId)) {
      return true;
    }
    return false;
  }
}
