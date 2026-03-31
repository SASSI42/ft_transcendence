export type PlayerSymbol = "X" | "O";
export type CellState = PlayerSymbol | null;
export type RoundStatus = "IN_PROGRESS" | "X_WIN" | "O_WIN" | "DRAW";

export interface RoundState {
  board: CellState[];
  turn: PlayerSymbol;
  moveCount: number;
  status: RoundStatus;
  winningLine: number[] | null;
}

export class RoundEngine {
  private board: CellState[];
  private turn: PlayerSymbol;
  private moveCount: number;
  private status: RoundStatus;
  private winningLine: number[] | null;

  constructor(startingSymbol: PlayerSymbol = "X") {
    this.board = Array(9).fill(null);
    this.turn = startingSymbol;
    this.moveCount = 0;
    this.status = "IN_PROGRESS";
    this.winningLine = null;
  }

  /** return the current immutable state of the round. */
  public getState(): RoundState {
    return {
      board: [...this.board], // return copy to prevent external mutation

      turn: this.turn,
      moveCount: this.moveCount,
      status: this.status,
      winningLine: this.winningLine ? [...this.winningLine] : null,
    };
  }

  /** check if a move is valid. */
  public isLegalMove(position: number): boolean {
    if (position < 0 || position > 8) return false;
    if (this.board[position] !== null) return false;
    if (this.status !== "IN_PROGRESS") return false;

    return true;
  }

  /** attempt to apply a move for a specific symbol. */
  public applyMove(
    position: number,
    symbol: PlayerSymbol
  ): { success: boolean; error?: string; newState?: RoundState } {
    if (symbol !== this.turn) {
      return {
        success: false,
        error: `It is ${this.turn}'s turn, not ${symbol}'s.`,
      };
    }

    if (!this.isLegalMove(position)) {
      return {
        success: false,
        error: "Illegal move: Invalid position or cell occupied.",
      };
    }

    this.board[position] = symbol;
    this.moveCount++;

    this.updateStatus();

    if (this.status === "IN_PROGRESS") {
      this.turn = this.turn === "X" ? "O" : "X";
    }

    return { success: true, newState: this.getState() };
  }

  /** internal logic to check for win conditions or draw. */
  private updateStatus(): void {
    const winningCombinations = [
      // rows
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      // cols
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      // diagonals
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const combo of winningCombinations) {
      const [a, b, c] = combo;
      if (
        this.board[a] &&
        this.board[a] === this.board[b] &&
        this.board[a] === this.board[c]
      ) {
        this.status = this.board[a] === "X" ? "X_WIN" : "O_WIN";
        this.winningLine = combo;
        return;
      }
    }

    if (this.moveCount === 9) {
      this.status = "DRAW";
    }
  }
}
