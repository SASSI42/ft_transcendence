import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateRoom } from '../components/CreateRoom';
import { JoinRoom } from '../components/JoinRoom';
import { Header } from '../components/Header';

export function GameLobby() {
  const navigate = useNavigate();
  const [menuTab, setMenuTab] = useState<'create' | 'join'>('create');

  return (
        <div className="h-full w-full">
          <Header activeTab={menuTab} onTabChange={setMenuTab} />
          
          {menuTab === 'create' ? (
            <CreateRoom
              onCreateLocal1v1={() => {
                navigate('/game/local');
              }}
              onCreateLocalTournament={() => {
                navigate('/tournament');
              }}
              onCreateRemote1v1={() => navigate('/game/remote')}
              onCreateRemoteTournament={() => navigate('/tournament/remote?mode=create')}
            />
          ) : (
            <JoinRoom
              onJoinRemoteTournament={(code) => navigate(`/tournament/remote?code=${code}`)}
            />
          )}
        </div>
  );
}
