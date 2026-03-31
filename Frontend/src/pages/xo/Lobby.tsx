import React from "react";
import { useGame } from "../../components/xo/useGame";
import { useNavigate } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";


export const Lobby: React.FC = () => {
  const { joinQueue, isSearching, leaveQueue, isConnected} = useGame();
  const navigate = useNavigate();

  return (
    <>
      {/* <div className="w-full h-full">...</div> */}
      <div className="flex flex-col items-center justify-center h-full relative">
      <div onClick={ () => {navigate('/Menu')}} className="absolute left-2 top-2 hover:text-accent text-3xl flex items-center cursor-pointer"><IoChevronBack /> <p className="text-2xl">Menu</p></div>
        <h1 className="text-5xl font-bebas-neue mb-8 text-accent">
          Tic-Tac-Toe
        </h1>

        <div className="bg-secondary p-8 rounded-xl shadow-xl text-center w-80">
          <div
            className={`mb-6 text-sm font-medium ${
              isConnected ? "text-green" : "text-red"
            }`}
            >
            {isConnected ? "● Server Connected" : "○ Disconnected"}
          </div>

          {!isSearching ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={joinQueue}
                disabled={!isConnected}
                className="w-full py-3 px-6 primary-button transition-all"
                >
                Find Match
              </button>

              {/* local game button */}
              <button
                onClick={() => navigate("/xo/local")}
                className="w-full py-3 px-6 secondary-button"
                >
                Local Match
              </button>
            </div>
          ) : (
            <div>
              <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mx-auto mb-1"></div>
              <p className="text-bgsecondary mb-5">Looking for opponent...</p>
              <button
                onClick={leaveQueue}
                className="secondary-button w-full h-10 text-sm "
                >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
