import React, { useEffect, useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { FriendItem } from './FriendItem';
import { useAuth } from '../User_management/authContext';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import pingoHappy from "../../assets/pingo_happy.svg"
import { SearchIcon, ChevronDownIcon, CheckIcon, CrossIcon } from '../icons';
import { IoPeople } from "react-icons/io5";

export const FriendsList: React.FC = () => {
  const { 
    friends, pendingRequests, sentRequests, 
    setFriends, setSentRequests, selectFriend, selectedFriendId, unreadCounts
  } = useChatStore();
  
  const { user: currentUser } = useAuth();
  const SYSTEM_ID = -1;
  const MAX_FRIENDS = 50;
  const systemUnread = unreadCounts[SYSTEM_ID] || 0;
  const [showBlocked, setShowBlocked] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addStatus, setAddStatus] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const fetchInitialData = async () => {
        try {
            const [friendsRes, sentRes] = await Promise.all([
                api.get(`/friends`),
                api.get(`/friends/sent`),
            ]);

            setFriends(friendsRes.data);
            setSentRequests(sentRes.data);
        } catch (error) {}
    };
    fetchInitialData();
  }, [currentUser]);

  useEffect(() => {
    const socket = socketService.socket; 
    if (!socket) return;

    const onFailure = (reason: string) => {
        setAddStatus(reason);
        setAddUsername("");
        setIsSearching(false);
        setTimeout(() => setAddStatus(""), 3000);
        
    };
    const onSuccess = (data: any) => {
        setAddStatus(`Friend request sent to ${data.username}!`);
        setAddUsername("");
        setIsSearching(false);
        setTimeout(() => setAddStatus(""), 3000);
    };

    socket.on('friend_request_sent_failure', onFailure);
    socket.on("friend_request_sent_success", onSuccess);

    return () => {
        socket.off('friend_request_sent_failure', onFailure);
        socket.off("friend_request_sent_success", onSuccess);
    };
  }, []);

  const activeFriends = friends.filter(f => !f.isBlocked && f.username.toLowerCase().includes(filterText.toLowerCase()));
  const blockedList = friends.filter(f => f.isBlocked);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSearching) return;
    setIsSearching(true);
    setAddStatus('Searching...');

    socketService.sendFriendRequest(addUsername);
  };

  const acceptRequest = (friendId: number) => {
    socketService.acceptFriendRequest(friendId);
  };

  const declineRequest = (friendId: number) => {
    socketService.declineFriendRequest(friendId);
  };

  const cancelSentRequest = (friendId: number) => {
    socketService.removeFriend(friendId);
    useChatStore.getState().removePendingRequest(friendId);
  };

  return (
    <div className="w-80 border-r border-accent/20 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-accent/20 flex justify-between items-center relative">
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent to-transparent"></div>
        <h2 className="text-xl font-bebas-neue tracking-wide text-primary flex items-center gap-2">
          <IoPeople className="w-6 h-6 text-secondary" />
          FRIENDS
        </h2>
        <button 
            onClick={() => setShowAddFriend(!showAddFriend)}
            className="disabled:opacity-30 bg-accent text-bgprimary px-3 py-1 rounded-full text-sm font-medium hover:bg-accent/90 transition-all transform hover:scale-105"
        >
            {showAddFriend ? '✕' : 'Add Friend'}
        </button>
      </div>

      {/* Add Friend */}
      {showAddFriend && (
        <div className="p-4 bg-bgprimary/50 border-b border-accent/20 animate-slideDown">
            <form onSubmit={handleAddFriend}>
                <input
                    id="add-friend-input"
                    name="addUsername"
                    type="text" 
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    maxLength={20}
                    placeholder="Enter username"
                    className="w-full px-3 py-2 bg-bgprimary border border-secondary/20 rounded-lg mb-2 text-sm text-primary placeholder-secondary focus:outline-none focus:border-accent/50 transition-colors"
                    disabled={isSearching}
                />
                <button 
                    type="submit" 
                    disabled={isSearching || friends.length + sentRequests.length >= MAX_FRIENDS}
                    title={friends.length + sentRequests.length >= MAX_FRIENDS ? "You’ve reached your friend limit" : ""} 
                    className={`disabled:opacity-30 w-full py-2 rounded-lg text-sm font-medium transition-all ${
                        isSearching ? 'bg-secondary/20 text-secondary cursor-not-allowed' : 'bg-accent text-bgprimary hover:bg-accent/90'
                    }`}
                >
                    {isSearching ? 'Processing...' : 'Send Request'}
                </button>
                {addStatus && <p className="text-xs mt-2 text-secondary">{addStatus}</p>}
            </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Pending Requests */}
        {(pendingRequests.length > 0 || sentRequests.length > 0) && (
            <div className="mb-4 border-b border-accent/10">
                <button
                    onClick={() => setShowPending(!showPending)}
                    className="w-full px-4 py-2 bg-accent/10 flex justify-between items-center transition-colors hover:bg-accent/20 group"
                >
                    <span className="text-xs font-bold text-accent uppercase tracking-wider group-hover:text-accent/80">
                        Pending Requests ({pendingRequests.length + sentRequests.length})
                    </span>
                    <ChevronDownIcon className={`w-3 h-3 text-accent transition-transform duration-200 ${showPending ? 'rotate-180' : ''}`} />
                </button>

                {showPending && (
                    <div className="max-h-64 overflow-y-auto bg-bgprimary/10">
                        {pendingRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-3 border-b border-secondary/10 hover:bg-bgprimary/30 transition-colors">
                                <span className="text-sm font-medium text-primary">{req.username}</span>
                                <div className="flex space-x-1">
                                    <button onClick={() => acceptRequest(req.id)} title={friends.length + sentRequests.length >= MAX_FRIENDS ? "You’ve reached your friend limit" : ""} disabled={friends.length + sentRequests.length >= MAX_FRIENDS} className=" disabled:opacity-30 disabled:bg-green/0 text-green hover:bg-green/20 p-2 rounded-lg transition-colors"><CheckIcon className="w-4 h-4" /></button>
                                    <button onClick={() => declineRequest(req.id)} className="text-red hover:bg-red/20 p-2 rounded-lg transition-colors"><CrossIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                        {sentRequests.map((req: any) => (
                            <div key={req.id} className="flex items-center justify-between p-3 border-b border-secondary/10 hover:bg-bgprimary/30 transition-colors">
                                <span className="text-sm font-medium text-secondary">
                                    To: <span className="text-primary">{req.username}</span>
                                </span>
                                <button onClick={() => cancelSentRequest(req.id)} className="text-red hover:bg-red/20 px-2 py-1 rounded-lg text-xs font-bold transition-colors">
                                    Cancel
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* Filter Input */}
        <div className="px-4 pb-2 mt-2">
            <div className="relative group">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary w-4 h-4" />
              <input
                id="filter-friends-input"
                name="filterFriends"
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                maxLength={20}
                placeholder="Search friends..." 
                className="w-full pl-10 pr-3 py-2 bg-bgprimary border border-secondary/20 rounded-lg text-sm text-primary placeholder-secondary focus:outline-none focus:border-accent/50"
              />
            </div>
        </div>

        {/* System Bot */}
        <div 
            onClick={() => selectFriend(SYSTEM_ID)}
            className={`flex items-center p-3 cursor-pointer hover:bg-bgprimary/50 transition-colors border-b border-secondary/10 ${
                selectedFriendId === SYSTEM_ID ? 'bg-accent/10 border-r-4 border-accent' : ''
            }`}
        >
            <img src={pingoHappy} alt="System" className="w-10 h-10 rounded-full bg-secondary/20 border-2 border-secondary" />
            <div className="ml-3 flex-1 flex justify-between items-center">
                <div>
                    <h4 className="font-bold text-primary">Pingo</h4>
                    <p className="text-xs text-secondary">System Notifications</p>
                </div>

                {systemUnread > 0 && (
                    <div className="bg-accent text-bgprimary text-[10px] font-bold h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full shadow-sm ">
                        {systemUnread > 99 ? '99+' : systemUnread}
                    </div>
                )}
            </div>
        </div>

        {/* Active Friends List*/}
        {activeFriends.length === 0 ? (
          <p className="text-center text-secondary mt-4 text-sm italic opacity-50">
             {filterText ? 'No friends found.' : 'No friends yet.'}
          </p>
        ) : (
          activeFriends.map((friend) => (
            <FriendItem key={friend.id} friend={friend} />
          ))
        )}
      </div>

      {/* Blocked List */}
      <div className="border-t border-accent/20">
        <button 
            onClick={() => setShowBlocked(!showBlocked)}
            className="w-full p-3 flex justify-between items-center text-sm text-secondary hover:text-primary hover:bg-bgprimary/50 font-medium transition-colors"
        >
            <span>Blocked Users ({blockedList.length})</span>
            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${showBlocked ? 'rotate-180' : ''}`} />
        </button>
        
        {showBlocked && (
            <div className="max-h-40 overflow-y-auto bg-black/20">
                {blockedList.map((friend) => (
                    <div key={friend.id} className="opacity-70 hover:opacity-100 transition-opacity">
                        <FriendItem friend={friend} />
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};