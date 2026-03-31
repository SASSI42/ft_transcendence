import React from 'react';
import { useState } from 'react';
import type { Message } from '../../types';
import { useAuth } from '../User_management/authContext';
import { useChatStore } from '../../store/useChatStore';
import { format } from 'date-fns';
import { socketService } from '../../services/socket';
import getBackendUrl from '../../api/getUrl';
import PingoHappy from '../../assets/pingo_happy.svg';
import { useNavigate } from 'react-router-dom';

interface Props {
  message: Message;
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  const { friends } = useChatStore();
  const isSystem = message.senderId === -1;
  const isMine = !isSystem && message.senderId === currentUser?.id;

  const sender = !isMine && !isSystem
    ? friends.find(f => f.id === message.senderId)
    : null;

  const isInvite = !!message.isInvite; 

  let isSystemMatch = false;
  let opponentName = '';
  
  if (isSystem && message.content.startsWith('SYSTEM::MATCH_READY::')) {
      isSystemMatch = true;
      opponentName = message.content.split('::')[2];
  }
  
  const parts = message.content.split('::');
  const inviteId = isInvite && parts.length > 1 ? parts[1] : null;
  const status = isInvite && parts.length > 2 ? parts[2] : 'PENDING';
  const gameType = isInvite && parts.length > 3 ? parts[3] : 'PONG';

  const GameIcon = gameType === 'TICTACTOE' ? '❌⭕' : '🏓';
  const GameName = gameType === 'TICTACTOE' ? 'Tic Tac Toe' : 'Ping Pong';
  
  const [acceptClicked, setAcceptClicked] = useState(false);
  const [declineClicked, setDeclineClicked] = useState(false);

  const handleAccept = () => {  setAcceptClicked(!acceptClicked); if (inviteId) socketService.acceptGameInvite(inviteId);};
  const handleDecline = () => {   setDeclineClicked(!declineClicked); if (inviteId) socketService.declineGameInvite(inviteId);};

  let avatarSrc = '';
  if (isSystem) {
      avatarSrc = PingoHappy; 
  } else if (sender) {
      avatarSrc = (sender.avatarUrl.startsWith('http')) ? sender.avatarUrl : `${getBackendUrl()}:3000${sender.avatarUrl}`;
  }

  const fallbackImage = "https://ui-avatars.com/api/?name=User";

return (
    <div className={`flex w-full mb-4 ${isMine ? 'justify-end' : 'justify-start items-end'}`}>
      {/* Avatar for received messages */}
      {!isMine && (sender || isSystem )&& (
        <img
          src={avatarSrc}
          crossOrigin='anonymous' 
          referrerPolicy='no-referrer' 
          onError={(e) => { e.currentTarget.src = fallbackImage }}
          alt={isSystem ? "Pingo" : sender?.username}
          className="w-8 h-8 rounded-full mr-2 flex-shrink-0 object-cover"
        />
      )}
      
      <div
        className={`max-w-[70%] px-4 py-2 rounded-2xl ${
          isMine 
            ? 'bg-primary text-bgprimary rounded-br-sm' 
            : 'bg-bgprimary/50 text-primary rounded-bl-sm border border-secondary/20'
        }`}
      >
        {isInvite ? (
          /*  RENDER INVITE UI */
          <div className="flex flex-col items-center p-2 w-48">
            <div className="text-4xl mb-2 tracking-widest">{GameIcon}</div>
            <p className="font-bold mb-0 text-center text-sm">{GameName}</p>
            <p className="text-[10px] text-secondary/70 mb-2 uppercase tracking-wide">Invite</p>
            
            {status !== 'PENDING' ? (
                <p className="text-sm uppercase font-bold opacity-70 tracking-wide">
                    {status}
                </p>
            ) : (
                <>
                    {!isMine ? (
                    <div className="flex space-x-2 w-full mt-2">
                        <button onClick={handleDecline} disabled={declineClicked} className={`flex-1 px-2 py-1 rounded text-xs disabled:opacity-30 hover:opacity-80 transition ${isMine ? 'bg-bgprimary/20 text-bgprimary' : 'bg-secondary/20 text-primary'}`}>Decline</button>
                        <button onClick={handleAccept} disabled={acceptClicked} className={`flex-1 px-2 py-1 rounded text-xs disabled:opacity-30 hover:opacity-80 transition font-bold ${isMine ? 'bg-accent/20 text-bgprimary' : 'bg-accent text-bgprimary'}`}>Accept</button>
                    </div>
                    ) : (
                    <p className="text-xs opacity-75 italic mt-1">Waiting...</p>
                    )}
                </>
            )}
          </div>
          ) : isSystemMatch ? (
            /*  TOURNAMENT NOTIFICATION UI */
            <div className="flex flex-col gap-2 min-w-[200px]">
                <p className="font-bold text-sm flex items-center gap-2">
                    🏆 Match Ready
                </p>
                <p className="text-xs opacity-90">
                    Your tournament match against <span className="font-bold text-lg block mt-1">{opponentName}</span> is starting!
                </p>
                <button 
                    onClick={() => navigate('/tournament/remote')}
                    className="mt-2 w-full bg-accent text-bgprimary py-2 px-3 rounded font-bold hover:brightness-110 transition flex items-center justify-center gap-2 shadow-sm text-xs"
                >
                    <span>⚔️</span> Join Arena
                </button>
            </div>
        ) : (
            /*  RENDER PLAIN TEXT*/
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-all">{message.content}</p>
        )}

        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMine ? 'text-bgprimary/60' : 'text-secondary'}`}>
          <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
        </div>
      </div>
    </div>
  );
}
