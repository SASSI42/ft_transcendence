import React, { useEffect } from "react";
import xoBg from '/src/assets/xo.jpeg'
import ppBg from '/src/assets/pingpong.gif'
import { useNavigate } from "react-router-dom";
import { useGame } from "../../components/xo/useGame";

export const Menu: React.FC = () => {
  const navigate = useNavigate();
  const game = useGame();

  useEffect( () => {
    game.socket?.emit("game:current-match", { userId: game.auth.user?.id})
  }, [])


  return (
    <div className="flex flex-col mt-12 justify-center gap-14 h-full w-full">
      <div className="flex flex-col items-center">
        <h2 className="ml-4 text-accent text-5xl font-bebas-neue">Game Menu</h2>
        <h4 className="ml-5 text-primary">Which game would you like to play?</h4>
      </div>

      <div className="flex flex-row flex-grow gap-16 justify-center ">
        <div onClick={ () => {navigate('/Game')} } style={{ backgroundImage: `url(${ppBg})`}} className={`font-bebas-neue text-4xl w-[33%] h-[75%] rounded-3xl bg-cover bg-center overflow-hidden hover:w-[35%] hover:text-accent hover:shadow-2xl hover:text-5xl transition-all duration-500 ease-in-out`}>
          <div className="flex items-center justify-center w-full h-full rounded-3xl bg-bgprimary/70 hover:bg-bgprimary/30 transition-all duration-500 ease-in-out">
            <p className="[text-shadow:0_0_5px_rgba(0,0,0,0.6)]">PING PONG</p>
          </div>
        </div>
        <div onClick={ () => {navigate('/xolobby')} } style={{ backgroundImage: `url(${xoBg})`}} className={`font-bebas-neue text-4xl w-[33%] h-[75%] rounded-3xl bg-cover bg-center overflow-hidden hover:w-[35%] hover:text-accent hover:shadow-2xl hover:text-5xl transition-all duration-500 ease-in-out`}>
          <div className="flex items-center justify-center h-full w-full rounded-3xl bg-bgprimary/70 hover:bg-bgprimary/30 transition-all duration-500 ease-in-out">
            <p className="[text-shadow:0_0_5px_rgba(0,0,0,0.6)]">TIC TAC TOE</p>
          </div>
        </div>
      </div>
    </div>
  );
};
