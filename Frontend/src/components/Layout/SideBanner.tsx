import { IoGameController, IoChatbubbleEllipses, IoPodium, IoGrid } from "react-icons/io5";
import { NavLink, useNavigate } from "react-router-dom";
import { useChatStore } from '../../store/useChatStore';
import { useLocation } from "react-router-dom";

export const SideBanner = ({classes = ""}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const gamesPaths = ["/menu", "/xolobby", "/local", "/match", "/tournament", "/game", "/xo"];
  
  const { unreadCounts, pendingRequests } = useChatStore();
  
  const unreadMsgTotal = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  const totalNotifications = unreadMsgTotal + pendingRequests.length;

  const gameActive = gamesPaths.some(route => pathname.toLowerCase().startsWith(route)) ? true : false;
  const handleGameClick = (e: React.MouseEvent) => {
    const activeRoomId = sessionStorage.getItem("activeGameRoomId");
    const activeTournamentCode = sessionStorage.getItem("activeTournamentCode");

    
    if (activeTournamentCode) {
      e.preventDefault();
      navigate("/tournament/remote");
    } else if (activeRoomId) {
      e.preventDefault();
      navigate("/game/remote");
    } else {
      navigate("/Menu");
    }
  };

  return (
      <nav className={` ${classes} flex flex-col gap-16 items-center justify-center px-7 py-10 rounded-r-3xl bg-secondaryGradient text-secondary`}>
        
        
        <NavLink to="/user_profile" className={({ isActive }: { isActive : boolean}) => isActive ? "text-accent" : "text-secondary"}><IoGrid className="w-9 h-9 hover:text-accent/50"/></NavLink>
        
        <button onClick={handleGameClick} className="text-secondary hover:text-accent/50">
          <IoGameController className={`w-9 ${gameActive ? "text-accent" : "text-secondary"} h-9`} />
        </button>
        
        <NavLink to="/chat" className={({ isActive }: { isActive : boolean}) => `relative ${isActive ? "text-accent" : "text-secondary"}`}>
            
            <IoChatbubbleEllipses className="w-9 h-9 hover:text-accent/50"/>
            
            {totalNotifications > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-bgprimary shadow-sm px-1">
                    {totalNotifications > 99 ? '99+' : totalNotifications}
                </div>
            )}
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }: { isActive : boolean}) => isActive ? "text-accent" : "text-secondary"}><IoPodium className="w-9 h-9 hover:text-accent/50"/></NavLink>
      </nav>
  );
};