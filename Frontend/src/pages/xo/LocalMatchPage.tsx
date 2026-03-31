import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Cell } from "../../components/xo/Cell";
import type { PlayerSymbol } from "../../types/index";
import Happy from "../../assets/pingo_happy.svg";
import Neutral from "../../assets/pingo_sad.svg";
import { IoChevronBack } from "react-icons/io5";

type Winner = "X" | "O" | "DRAW" | null;

export const LocalMatchPage: React.FC = () => {
  const navigate = useNavigate();

  // game state

  const [board, setBoard] = useState<(PlayerSymbol | null)[]>(
    Array(9).fill(null)
  );
  const [turn, setTurn] = useState<PlayerSymbol>("X");
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [roundNumber, setRoundNumber] = useState(1);
  const [winner, setWinner] = useState<Winner>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [seriesWinner, setSeriesWinner] = useState<"X" | "O" | "DRAW" | null>(
    null
  );

  // check for win/draw

  useEffect(() => {
    checkWin();
  }, [board]);

  const checkWin = () => {
    const winningCombinations = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const combo of winningCombinations) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        setWinner(board[a] as Winner);
        setWinningLine(combo);
        updateScore(board[a] as PlayerSymbol);
        return;
      }
    }

    if (!board.includes(null) && !winner) {
      setWinner("DRAW");

      if (roundNumber >= 3) {
        if (scores.X > scores.O) {
          setTimeout(() => setSeriesWinner("X"), 500);
        } else if (scores.O > scores.X) {
          setTimeout(() => setSeriesWinner("O"), 500);
        } else {
          setTimeout(() => setSeriesWinner("DRAW"), 500);
        }
      }
    }
  };

  const updateScore = (roundWinner: PlayerSymbol) => {
    const newScores = { ...scores, [roundWinner]: scores[roundWinner] + 1 };
    setScores(newScores);

    // check best of 3 (first to 2 wins)

    if (newScores[roundWinner] >= 2) {
      setTimeout(() => setSeriesWinner(roundWinner), 500);
    } else if (roundNumber >= 3 && newScores.X === newScores.O) {
      setTimeout(() => setSeriesWinner("DRAW"), 500);
    }
  };

  const handleMove = (index: number) => {
    if (board[index] || winner || seriesWinner) return;

    const newBoard = [...board];
    newBoard[index] = turn;
    setBoard(newBoard);
    setTurn(turn === "X" ? "O" : "X");
  };

  const nextRound = () => {
    if (seriesWinner) return; // don't start next round if series ended

    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setRoundNumber((prev) => prev + 1);
    // alternate starting player

    setTurn((roundNumber + 1) % 2 !== 0 ? "X" : "O");
  };

  const handleQuit = () => {
    navigate("/xolobby");
  };
  const fallbackImage = "https://ui-avatars.com/api/?name=User";

  return (
    <div className="flex flex-col items-center w-full h-ful py-10 relative">
      <div onClick={handleQuit} className="absolute left-2 top-2 hover:text-red transition-colors text-3xl flex items-center cursor-pointer">
        <IoChevronBack />
        <p className="text-2xl">Lobby</p>
      </div>
      {/* series result modal */}
      {seriesWinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bgprimary/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-secondary rounded-xl shadow-2xl p-8 max-w-sm w-full text-center">
            <img
              className="w-20 mx-auto mb-4"
              crossOrigin='anonymous' 
              referrerPolicy='no-referrer' 
              onError={(e) => { e.currentTarget.src = fallbackImage }}
              src={seriesWinner === "DRAW" ? Neutral : Happy}
            />
            <h2 className="text-3xl font-bebas-neue text-bgsecondary mb-2">
              {seriesWinner === "DRAW"
                ? "SERIES DRAW"
                : `PLAYER ${seriesWinner} WINS!`}
            </h2>
            <div className="text-2xl text-bgsecondary font-bold font-bebas-neue mb-5 bg-primary py-2 rounded-md">
              {scores.X} - {scores.O}
            </div>
            <button
              onClick={handleQuit}
              className="w-full py-3 bg-bgsecondary hover:bg-bgprimary text-primary rounded-lg font-bold shadow-lg transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* scoreboard */}
      <div className="w-full max-w-md flex justify-between items-center mb-8 px-6 bg-secondary py-4 rounded-lg shadow-sm">
        <div className="text-center font-bold">
          <div className="text-sm uppercase text-blue tracking-wider">
            Player X
          </div>
          <div className="text-4xl font-bebas-neue text-bgsecondary">
            {scores.X}
          </div>
        </div>
        <div className="text-center px-4">
          <div className="text-xs font-bold text-bgsecondary uppercase tracking-widest">
            Round
          </div>
          <div className="text-2xl font-black text-bgsecondary">
            {roundNumber}
          </div>
        </div>
        <div className="text-center font-bold">
          <div className="text-sm uppercase text-red tracking-wider">
            Player O
          </div>
          <div className="text-4xl text-bgsecondary font-bebas-neue">
            {scores.O}
          </div>
        </div>
      </div>

      {/* turn indicator / round result */}
      <div className="mb-8">
        {!winner ? (
          <div
            className={`px-6 py-2 rounded-full font-bold text-sm tracking-wide shadow-sm transition-colors ${
              turn === "X" ? "bg-blue text-primary" : "bg-red text-primary"
            }`}
          >
            PLAYER {turn}'S TURN
          </div>
        ) : (
          <button
            onClick={nextRound}
            className="px-6 py-2 rounded-full bg-accent hover:bg-accent/80 text-bgprimary font-bold text-sm shadow-sm cursor-pointer"
          >
            NEXT ROUND
          </button>
        )}
      </div>

      {/* board */}
      <div className="grid grid-cols-3 gap-2 bg-secondary p-3 rounded-lg">
        {board.map((cell, index) => (
          <Cell
            key={index}
            value={cell}
            onClick={() => handleMove(index)}
            disabled={cell !== null || winner !== null}
            isWinning={winningLine?.includes(index) ?? false}
            isUserPiece={cell === "X"} // keeps x as blue, o as red
          />
        ))}
      </div>
    </div>
  );
};
