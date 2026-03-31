import React from "react";
import { Cell } from "./Cell";
import { useGame } from "./useGame";

export const GameBoard: React.FC = () => {
  const { matchState, playerSymbol, makeMove } = useGame();

  if (!matchState) return null;

  const { board, turn, winningLine, status } = matchState.roundState;
  const isMyTurn = turn === playerSymbol;
  const isRoundActive = status === "IN_PROGRESS";

  return (
    <div className="grid grid-cols-3 gap-2 bg-secondary p-3 rounded-lg">
      {board.map((cell, index) => (
        <Cell
          key={index}
          value={cell}

          isUserPiece={cell === playerSymbol}
          isWinning={winningLine?.includes(index) ?? false}
          disabled={!isMyTurn || !isRoundActive || cell !== null}
          onClick={() => makeMove(index)}
        />
      ))}
    </div>
  );
};
