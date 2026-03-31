import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useAuth } from '../User_management/authContext';
import { socketService } from '../../services/socket';
import { MessageBubble } from './MessageBubble';
import { api } from '../../services/api';
import { ChallengeIcon, RemoveFriendIcon, BlockUserIcon, SendIcon } from '../icons';
import { ConfirmationModal } from '../UI/ConfirmationModal';
import { GameSelectionModal } from '../UI/GameSelectionModal';
import PingoHappy from '../../assets/pingo_happy.svg';
import getBackendUrl from '../../api/getUrl';
import { useNavigate } from "react-router-dom";


const MAX_MESSAGE_LENGTH = 2000;
const SYSTEM_ID = -1;

const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const ChatWindow: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [showGameSelector, setShowGameSelector] = useState(false);
  const [modalConfig, setModalConfig] = useState({
      isOpen: false, title: '', message: '', confirmText: '', isDangerous: false, onConfirm: () => {}
  });
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { friends, selectedFriendId, messages, setMessages, removeFriendState } = useChatStore();
  const { user: currentUser } = useAuth();

  const isSystem = selectedFriendId === SYSTEM_ID;
  let selectedFriend: any = null;
  
  if (isSystem) {
      selectedFriend = { id: SYSTEM_ID, username: 'System', avatarUrl: 'https://ui-avatars.com/api/?name=System&background=000&color=fff' };
  } else {
      selectedFriend = friends.find((f) => f.id === selectedFriendId);
  }

  const currentStatus = !isSystem && selectedFriend ? (selectedFriend.status || 'offline') : 'offline';
  
  const isBlocked = !isSystem && selectedFriend?.isBlocked;

  const isOnline = !isSystem && currentStatus === 'online';

  const getStatusConfig = (status: string) => {
      switch (status) {
          case 'online': return { color: 'text-online', dot: 'bg-online', text: 'Online' };
          case 'in-game': return { color: 'text-purple-500', dot: 'bg-purple-500', text: 'in-game' };
          case 'in-queue': return { color: 'text-blue', dot: 'bg-blue', text: 'in-queue' };
          default: return { color: 'text-gray-400', dot: 'bg-gray-400', text: 'Offline' };
      }
  };
  const statusUI = getStatusConfig(currentStatus);
  const currentMessages = selectedFriendId ? (messages[selectedFriendId] || []) : [];

  useEffect(() => {
    return () => {
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/chat')) {
         useChatStore.setState({ selectedFriendId: null });
      }
    };
  }, []);

  useEffect(() => { 
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [currentMessages]);

  useEffect(() => {
    if (selectedFriendId && currentUser) {
            api.get(`/messages/history/${selectedFriendId}`)
            .then(res => setMessages(selectedFriendId, res.data))
            .catch();
        }
       }, [selectedFriendId, currentUser]); 


  useEffect(() => {
    if (selectedFriendId && currentUser) {
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg && lastMsg.senderId !== currentUser.id && !lastMsg.read) {
             socketService.markAllRead(selectedFriendId);
        }
    }
  }, [currentMessages, selectedFriendId, currentUser]);

  useEffect(() => { setInputText(''); }, [selectedFriendId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedFriendId || !currentUser) return;
    socketService.sendMessage(selectedFriendId, inputText);
    setInputText('');
  };
  
  const handleInvite = () => {
    if (selectedFriendId && isOnline) setShowGameSelector(true);
  };

  const handleGameSelect = (type: 'PONG' | 'TICTACTOE') => {
      if (selectedFriendId) {
          socketService.sendGameInvite(selectedFriendId, type);
          setShowGameSelector(false);
      }
  };

  const handleBlockAction = () => {
    if (!selectedFriendId || !currentUser) return;
    
    const actionType = isBlocked ? 'unblock' : 'block';

    setModalConfig({
        isOpen: true,
        title: actionType === 'block' ? `Block ${selectedFriend.username}?` : `Unblock ${selectedFriend.username}?`,
        message: actionType === 'block' 
            ? "They can still send you messages and game invites, but you will not receive them."
            : "You will be able to receive their messages and game invites again.",
        confirmText: actionType === 'block' ? 'Block User' : 'Unblock',
        isDangerous: actionType === 'block',
        onConfirm: () => {
            if (actionType === 'block') {
                socketService.blockUser(selectedFriendId);
                useChatStore.setState({ selectedFriendId: null });
            } else {
                socketService.unblockUser(selectedFriendId);
            }
        }
    });
  };

  const handleRemove = () => {
    if (!selectedFriendId || !currentUser) return;
    setModalConfig({
        isOpen: true,
        title: `Remove ${selectedFriend.username}?`,
        message: "Are you sure you want to remove this friend?",
        confirmText: 'Remove Friend',
        isDangerous: true,
        onConfirm: () => { 
            socketService.removeFriend(selectedFriendId);
            removeFriendState(selectedFriendId);
        }
    });
  };

  if (!selectedFriendId || !selectedFriend) {
    return (
      <div className="flex-1 flex items-center justify-center text-secondary">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-lg">Select a friend to start chatting</p>
        </div>
      </div>
    );
  }

  const avatarSrc = (selectedFriend.avatarUrl?.startsWith('http')) 
      ? selectedFriend.avatarUrl 
      : `${getBackendUrl()}:3000${selectedFriend.avatarUrl}`;
      
      const fallbackImage = "https://ui-avatars.com/api/?name=User";

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <GameSelectionModal 
          isOpen={showGameSelector} 
          onClose={() => setShowGameSelector(false)} 
          onSelect={handleGameSelect} 
      />
      <ConfirmationModal
          {...modalConfig} 
          onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} 
      />
      
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-accent/20 flex justify-between items-center relative">
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent to-transparent"></div>
        
        {isSystem ? (
            <div className="flex items-center p-2 -ml-2">
                <img src={PingoHappy} alt="System" className="w-10 h-10 rounded-full bg-secondary/20 object-cover mr-3 border-2 border-secondary"/>
                <div><h3 className="font-bold text-primary">Pingo</h3><p className="text-xs text-secondary">System Notifications</p></div>
            </div>
        ) : (
            <div 
              className="flex items-center cursor-pointer hover:bg-bgprimary/50 p-2 -ml-2 rounded-lg transition-colors group min-w-0"
              onClick={() => navigate(`/user_profile/${selectedFriend.id}`)}
            >
                <div className="relative flex-shrink-0">
                  <img 
                  className="w-10 h-10 rounded-full bg-secondary/20 object-cover mr-3 border-2 border-secondary group-hover:border-accent transition-colors"
                  src={avatarSrc} 
                  crossOrigin='anonymous' 
                  referrerPolicy='no-referrer' 
                  onError={(e) => { e.currentTarget.src = fallbackImage }}
                  alt={selectedFriend.username} 
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-primary group-hover:text-accent transition-colors truncate">
                    {selectedFriend.username}
                  </h3>
                  <p className={`text-xs flex items-center ${statusUI.color}`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${statusUI.dot}`}></span>
                    {statusUI.text}
                  </p>
                </div>
            </div>
        )}
        
        {!isSystem && (
            <div className="flex space-x-2">
                <button onClick={handleRemove} className="p-2 text-secondary hover:text-red hover:bg-red/10 rounded-lg transition-colors" title="Remove Friend">
                  <RemoveFriendIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleBlockAction} 
                  className={`p-2 rounded-lg transition-colors ${isBlocked ? 'text-accent hover:bg-accent/10' : 'text-secondary hover:text-red hover:bg-red/10'}`}
                  title={isBlocked ? 'Unblock User' : 'Block User'}
                >
                  <BlockUserIcon className="w-5 h-5" />
                </button>
            </div>
        )}
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-6 bg-bgprimary/30">
        {currentMessages.map((msg, index) => {
            const showDateSeparator = index === 0 || 
                new Date(msg.createdAt).toDateString() !== new Date(currentMessages[index - 1].createdAt).toDateString();

            return (
                <React.Fragment key={msg.id || index}>
                    {showDateSeparator && (
                        <div className="flex justify-center my-6">
                            <span className="backdrop-blur-md text-secondary text-[10px] font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-sm border border-white/5">
                                {formatDateSeparator(msg.createdAt)}
                            </span>
                        </div>
                    )}
                    <MessageBubble message={msg} />
                </React.Fragment>
            );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      {!isBlocked && !isSystem ? (
        <div className="p-4 border-t border-accent/20">
            <form onSubmit={handleSend} className="flex items-center space-x-3">
              <button
                type="button" 
                onClick={handleInvite} 
                disabled={!isOnline} 
                className={`p-3 rounded-full transition-all ${isOnline ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'bg-secondary/10 text-secondary/50 cursor-not-allowed'}`}
                title="Send Game Invite"
              >
                <ChallengeIcon className="w-5 h-5" />
              </button>
              <input
                id="chat-message-input" 
                name="messageInput" 
                type="text" 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                className="flex-1 px-4 py-3 bg-bgprimary border border-secondary/20 rounded-full text-primary placeholder-secondary focus:outline-none focus:border-accent/50 transition-colors" 
                placeholder="Type a message..."
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <button type="submit" className="bg-accent text-bgprimary p-3 rounded-full hover:bg-accent/90 transition-all transform hover:scale-105">
                <SendIcon className="w-5 h-5" />
              </button>
              <div className={`text-xs text-right ${
                        inputText.length >= MAX_MESSAGE_LENGTH ? 'text-red' : 'text-secondary'
                    }`}>
                        {inputText.length} / {MAX_MESSAGE_LENGTH}
            </div>
            </form>
        </div>
      ) : (
        <div className="p-4 border-t border-accent/20 text-center">
            <p className="text-secondary text-sm italic">
                {isSystem ? 'You cannot reply to system messages.' : 'You have blocked this user.'}
            </p>
        </div>
      )}
    </div>
  );
};