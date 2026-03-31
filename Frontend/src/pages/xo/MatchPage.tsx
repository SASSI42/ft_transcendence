import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../../components/xo/useGame";
import { GameBoard } from "../../components/xo/GameBoard";
import { socketService } from "../../services/socket";
import Happy from "../../assets/pingo_happy.svg";
import Sad from "../../assets/pingo_sad.svg";
import getBackendUrl from "../../api/getUrl";
import { useAuth } from "../../components/User_management/authContext";
import { IoChevronBack } from "react-icons/io5";
import default_avatar from '../../assets/default_avatar.png'

export const MatchPage: React.FC = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const {
    joinMatch,
    matchState,
    playerSymbol,
    forfeit,
    opponent,
    opponentDisconnected,
    opponentExpiresAt,
    gameError,
    resetGame,
  } = useGame();

  const [timeLeft, setTimeLeft] = useState(15);

  const userId = socketService.userId;
  const auth = useAuth();
  useEffect(() => {
    if (socketService.socket === null) return;
    if (matchId) joinMatch(matchId);

    return () => {
      socketService.socket!.emit("offgame");
    };
  }, [matchId, joinMatch, socketService.socket]);

  //countdown logic

  useEffect(() => {
    if (!opponentDisconnected || !opponentExpiresAt) return;
    const interval = setInterval(() => {
      const secondsRemaining = Math.ceil(
        (opponentExpiresAt - Date.now()) / 1000
      );
      setTimeLeft(Math.max(0, secondsRemaining));
    }, 1000);
    return () => clearInterval(interval);
  }, [opponentDisconnected]);

  const handleBackToLobby = () => {
    resetGame();
    navigate("/xolobby");
  };
  const fallbackImage = "https://ui-avatars.com/api/?name=User";


  if (gameError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="bg-secondary p-8 rounded-xl shadow-xl text-center w-[50%] max-w-80">
          <img className="w-20 mx-auto mb-4"
          crossOrigin='anonymous' 
          referrerPolicy='no-referrer' 
          onError={(e) => { e.currentTarget.src = fallbackImage }}
          src={Sad} />
          <h2 className="text-2xl font-bold text-bgprimary mb-1">Oops!</h2>
          <p className="text-bgsecondary mb-4">{gameError}</p>
          <button
            onClick={handleBackToLobby}
            className="w-full py-3 px-6 bg-bgsecondary hover:bg-bgprimary text-primary rounded-md font-bold transition-all"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!matchState || !playerSymbol) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bgprimary">
        <div className="text-xl font-semibold text-secondary animate-pulse">
          Connecting to Match...
        </div>
      </div>
    );
  }

  const { scores, roundState, roundNumber, status, winner, winReason } =
    matchState;
  const isMyTurn = roundState.turn === playerSymbol;

  // dynamic ui calculations

  const opponentSymbol = playerSymbol === "X" ? "O" : "X";
  const myScore = scores[playerSymbol];
  const opponentScore = scores[opponentSymbol];

  return (
    <div className="flex flex-col items-center h-full w-full py-10 relative">
      {status === "ONGOING" && (
      <div onClick={forfeit} className="absolute left-2 top-2 hover:text-red transition-colors text-3xl flex items-center cursor-pointer">
        <IoChevronBack />
        <p className="text-2xl">forfeit</p>
      </div> )}
      {/* result modal */}
      {status === "FINISHED" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bgprimary/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-secondary rounded-xl shadow-2xl p-8 max-w-sm w-full text-center transform transition-all scale-100">
            {winner === userId ? (
              <>
                <img className="w-20 mx-auto mb-4"
                crossOrigin='anonymous' 
                referrerPolicy='no-referrer' 
                onError={(e) => { e.currentTarget.src = fallbackImage }}
                 src={Happy} />
                <h2 className="text-3xl font-bebas-neue text-green mb-2">
                  VICTORY!
                </h2>
                <p className="text-bgsecondary mb-3">
                  {winReason === "FORFEIT"
                    ? "Opponent gave up (or timed out)."
                    : "You won the series!"}
                </p>
              </>
            ) : winner === null ? (
              <>
                <img className="w-20 mx-auto mb-4" 
                crossOrigin='anonymous' 
                referrerPolicy='no-referrer' 
                onError={(e) => { e.currentTarget.src = fallbackImage }}
                src={Happy} />
                <h2 className="text-3xl font-bebas-neue text-bgsecondary mb-2">
                  DRAW
                </h2>
                <p className="text-bgsecondary mb-3">
                  The series ended in a tie.
                </p>
              </>
            ) : (
              <>
                <img className="w-20 mx-auto mb-4"
                crossOrigin='anonymous' 
                referrerPolicy='no-referrer' 
                onError={(e) => { e.currentTarget.src = fallbackImage }}
                src={Sad} />
                <h2 className="text-3xl font-bebas-neue text-red mb-2">
                  DEFEAT
                </h2>
                <p className="text-bgsecondary mb-3">
                  {winReason === "FORFEIT"
                    ? "You gave up."
                    : "Better luck next time."}
                </p>
              </>
            )}
            <div className="text-2xl font-bold font-bebas-neue mb-5 text-bgsecondary bg-primary py-2 rounded-md">
              {scores.X} - {scores.O}
            </div>
            <button
              onClick={handleBackToLobby}
              className="w-full py-3 px-6 bg-bgsecondary hover:bg-bgprimary text-primary rounded-lg font-bold shadow-lg hover:shadow-xl transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* disconnect banner */}
      {opponentDisconnected && status !== "FINISHED" && (
        <div className="w-full max-w-md bg-red text-primary px-4 py-3 rounded-md mb-6 text-center font-bold shadow-md animate-pulse">
          Opponent Disconnected! Auto-win in {timeLeft}s...
        </div>
      )}

      {/* scoreboard */}
      <div className="w-full max-w-lg flex justify-between items-center mb-8 px-3 bg-secondary py-3 rounded-full shadow-sm">
        {/* left: you (always blue) */}
        <div className="flex flex-row gap-1">
          <div>
            <img
              className="border-3 border-blue rounded-full w-16 h-16 shrink-0 object-cover"
              crossOrigin='anonymous' 
              referrerPolicy='no-referrer' 
              onError={(e) => { e.currentTarget.src = fallbackImage }}
              src={(auth.user?.avatar) ? (auth.user?.avatar[0] === '/' ? `${getBackendUrl()}:3000${auth.user?.avatar}` : auth.user?.avatar) : default_avatar}
            />
          </div>
          <div className="w-24 text-center font-bold">
            <div className="truncate text-sm uppercase text-blue tracking-wider">
              {auth.user?.username} ({playerSymbol})
            </div>
            <div className="text-4xl text-bgsecondary font-bebas-neue">
              {myScore}
            </div>
          </div>
        </div>

        {/* center: round info */}
        <div className="text-center text-bgsecondary px-4">
          <div className="text-xs font-bold uppercase tracking-widest">
            Round
          </div>
          <div className="text-2xl font-black ">{roundNumber}</div>
        </div>

        {/* right: opponent (always red) */}
        <div className="flex flex-row-reverse gap-1">
          <div>
            <img
              className="border-3 border-red rounded-full w-16 h-16 shrink-0 object-cover"
              crossOrigin='anonymous' 
              referrerPolicy='no-referrer' 
              onError={(e) => { e.currentTarget.src = fallbackImage }}
              src={(opponent?.avatarUrl) ? (opponent?.avatarUrl[0] === '/' ? `${getBackendUrl()}:3000${opponent?.avatarUrl}` : opponent?.avatarUrl) : default_avatar}
            />
          </div>
          <div className="w-24 text-center font-bold">
            <div className="truncate text-sm uppercase text-red tracking-wider">
              {opponent?.username} ({opponentSymbol})
            </div>
            <div className="text-4xl text-bgsecondary font-bebas-neue">
              {opponentScore}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        {roundState.status === "IN_PROGRESS" ? (
          <div
            className={`px-6 py-2 text-primary rounded-full font-bold text-sm tracking-wide shadow-sm transition-colors ${
              isMyTurn ? "bg-blue" : "bg-red border border-red"
            }`}
          >
            {isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
          </div>
        ) : (
          <div className="px-6 py-2 rounded-full bg-accent text-bgsecondary font-bold text-sm shadow-sm">
            {roundState.status === "DRAW"
              ? "ROUND DRAW!"
              : `${roundState.status.replace("_WIN", "")} WINS ROUND!`}
          </div>
        )}
      </div>

      <GameBoard />
    </div>
  );
};
