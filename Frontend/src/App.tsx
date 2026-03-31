import { Routes, Route } from 'react-router-dom';
import LoginPage1 from './pages/login_page1';
import LoginPage2 from './pages/login_page2';
import UserProfile from './pages/user_profile';

import Signin from './components/User_management/signin';
import Signup from './components/User_management/signup';
import Update_password from './components/User_management/update_password';
import Update_email from './components/User_management/update_email';
import Update_username from './components/User_management/update_username';
import DashboardPage from './pages/dashboard';
import PasswordLost from './components/User_management/password-lost';
import PasswordReset from './components/User_management/reset-pasword';
import { ToastProvider } from './components/User_management/toastContext';
import NotFoundPage from './components/User_management/NotFoundPage';
import TwoFactor from './components/User_management/twoFactor';
import Update_avatar from './components/User_management/update_avatar';
import ProtectRoutes2 from './utils/ProtectRoutes2';
import ProtectRoutes1 from './utils/ProtectRoutes1';
import { Settings } from './components/User_management/settings';


import { ChatPage } from "./pages/chat";

// Game imports
import { GameLobby } from './pages/GameLobby';
import { LocalGame } from './components/LocalGame';
import { RemoteGame } from './components/RemoteGame';
import { Tournament } from './components/Tournament';
import { RemoteTournament } from './components/RemoteTournament';
//charlie
import { Menu } from './pages/xo/Menu'
import { Layout } from './components/Layout/Layout'
import { GameProvider } from "./components/xo/GameProvider";
import { Lobby } from "./pages/xo/Lobby";
import { MatchPage } from "./pages/xo/MatchPage";
import { LocalMatchPage } from "./pages/xo/LocalMatchPage"

function App() {
  return (
        <ToastProvider>
          <GameProvider>
            <Routes>
              <Route element={<ProtectRoutes1/>}>
                <Route path="/signin" element={<LoginPage1 page={'sign_in'}><Signin/></LoginPage1>}/>
                <Route path="/signup" element={<LoginPage1 page={'sign_up'}><Signup/></LoginPage1>}/>
                <Route path="/forgot-password" element={<LoginPage1 page="password_lost"> <PasswordLost /> </LoginPage1>}/>
                <Route path="/twoFactor" element={<LoginPage1 page="two_factor"> <TwoFactor /> </LoginPage1>}/>
                <Route path="/reset-password" element={<LoginPage1 page="password_reset"> <PasswordReset /> </LoginPage1>}/>
              </Route>
              
              <Route element={<ProtectRoutes2/>}>
                <Route element={<Layout />}>
                  <Route path="/user_profile/:id" element={<UserProfile/>}/>

                  <Route path="*" element={<LoginPage2 page="not_found_page"> <NotFoundPage/> </LoginPage2>}/>
                  <Route path="/signup" element={<LoginPage2 page="sign_up"> <Signup /> </LoginPage2>}/>
                  <Route path="/update_email" element={<LoginPage2 page="update_email"> <Update_email /> </LoginPage2>}/>
                  <Route path="/update_password" element={<LoginPage2 page="update_password"> <Update_password /> </LoginPage2>}/>
                  <Route path="/update_username" element={<LoginPage2 page="update_username"> <Update_username /> </LoginPage2> }/>
                  <Route path="/update_avatar" element={<LoginPage2 page="update_avatar"> <Update_avatar /></LoginPage2>}/>
                  <Route path="/dashboard" element={<DashboardPage />}/>
                  <Route path="/" element={<DashboardPage />}/>
                  <Route path="/user_profile" element={<UserProfile/>}/>
                  <Route path='/settings' element={<LoginPage2 page={'settings'}><Settings/></LoginPage2>}/>

                {/* Chat Routes */}
                <Route path="/chat" element={<ChatPage />} />
                
                {/* Game Routes */}
                <Route path="/game" element={<GameLobby />} />
                <Route path="/game/local" element={<LocalGame />} />
                <Route path="/game/remote" element={<RemoteGame />} />
                <Route path="/tournament" element={<Tournament />} />
                <Route path="/tournament/remote" element={<RemoteTournament />} />
                  {/* XO Game Routes */}
                <Route path="/menu" element={<Menu />} />
                <Route path="/xolobby" element={<Lobby />} />
                <Route path="/match/:matchId" element={<MatchPage />} />
                <Route path="/xo/local" element={<LocalMatchPage />} />
                </Route>
              </Route>
            </Routes>
          </GameProvider>
        </ToastProvider>
  );
}

export default App;
