import { Header } from "./Header";
import { SideBanner } from "./SideBanner";
import { Main } from "./Main";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socketService } from "../../services/socket";
import { useAuth } from "../User_management/authContext";
import { useChatStore } from "../../store/useChatStore";
import { api } from '../../services/api';

export const Layout = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const setUnreadCounts = useChatStore((state) => state.setUnreadCounts);
  const setPendingRequests = useChatStore((state) => state.setPendingRequests);

  useEffect(() => {
    socketService.setNavigateFunction(navigate);
  }, [navigate]);

  useEffect(() => {
    const syncNotifications = async () => {
      if (!isLoggedIn) return;

      try {
        const [unreadRes, pendingRes] = await Promise.all([
          api.get("/messages/unread"),
          api.get("/friends/pending")
        ]);

        setUnreadCounts(unreadRes.data);
        setPendingRequests(pendingRes.data);
  
      } catch (err) {
      }
    };

    syncNotifications();
  }, [isLoggedIn, setUnreadCounts, setPendingRequests]);

  return (
    <div className="flex flex-col gap-20 overflow-hidden bg-primaryGradient h-screen w-screen">
      <Header classes="" />
      <div className="flex flex-row flex-1 content-between items-center w-full min-h-0" >
        <SideBanner classes="flex-none w-22 h-120" />
        <div className="flex-1 flex justify-center h-full">
          <Main classes="flex flex-col w-full h-full overflow-hidden max-w-screen-2xl mx-20 bg-secondaryGradient p-5 rounded-3xl" > <Outlet/> </Main>
        </div>
      </div>
      <div className="h-10"></div>
    </div>
  );
};