import { MatchInstance, MatchState } from "./MatchInstance";

export class GameManager {
  // store all active games in memory {matchid : matchinstance}
  private matches: Map<string, MatchInstance> = new Map();

  /** called when matchmaking is done and we are ready to play. */
  public createMatch(
    matchId: string,
    player1: { userId: number; socketId: string },
    player2: { userId: number; socketId: string }
  ): MatchInstance {
    // prevent creating duplicates
    if (this.matches.has(matchId)) {
      throw new Error(`Match ${matchId} already exists`);
    }

    const match = new MatchInstance(matchId, player1, player2);
    this.matches.set(matchId, match);
    return match;
  }

  /** retrieve a match by id. */
  public getMatch(matchId: string): MatchInstance | undefined {
    return this.matches.get(matchId);
  }

  /** * Helper to find which match a user is playing in. */
  public findMatchByUserId(userId: number): MatchInstance | undefined {
    let finishedMatch: MatchInstance | undefined;

    for (const match of this.matches.values()) {
      const isParticipant =
        match.players.X.userId === userId || match.players.O.userId === userId;

      if (isParticipant) {
        // return active match
        if (match.getState().status === "ONGOING") {
          return match;
        }
        // keep finished match as a fullback
        finishedMatch = match;
      }
    }

    // return finished match if not active match is found
    return finishedMatch;
  }

  /** called by socket handler when player trying to make a move. */
  public makeMove(matchId: string, userId: number, position: number) {
    const match = this.matches.get(matchId);

    if (!match) {
      return { success: false, error: "Match not found" };
    }

    // pass the task to this match handlemove
    const result = match.handleMove(userId, position);

    return result;
  }

  public removeMatch(matchId: string): boolean {
    return this.matches.delete(matchId);
  }

  public getActiveMatchCount(): number {
    return this.matches.size;
  }

  public getPlayerCurrentMatch(userId: number): string | null {
    for (const [matchid, match] of this.matches) {
      if (match.isPlaying(userId))
        return matchid;
    }
    return null;
  }
}

// export a singleton instance so the whole app uses the same manager
export const gameManager = new GameManager();
