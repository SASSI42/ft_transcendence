export interface QueueEntry {
  userId: number;
  socketId: string;
  timestamp: number;
}

class MatchmakingQueue {
  private queue: QueueEntry[] = [];

  /** add a player to the queue */
  public addPlayer(entry: QueueEntry): void {
    this.removePlayer(entry.userId);
    this.queue.push(entry);
  }

  /** remove a player from the queue */
  public removePlayer(userId: number): void {
    this.queue = this.queue.filter((p) => p.userId !== userId);
  }

  /** get 2 players from the queue */
  public getNextPair(): [QueueEntry, QueueEntry] | null {
    if (this.queue.length >= 2) {
      const player1 = this.queue[0];
      const player2 = this.queue[1];

      this.removePlayer(player1.userId);
      this.removePlayer(player2.userId);

      return [player1, player2];
    }

    return null;
  }

  /** helper to get the queue size */
  public getSize(): number {
    return this.queue.length;
  }
}

// export a singleton instance so we share one queue across the app
export const matchmakingQueue = new MatchmakingQueue();
