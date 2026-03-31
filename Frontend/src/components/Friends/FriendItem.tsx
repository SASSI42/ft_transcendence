import React from 'react';
import type { Friend } from '../../types';
import { useChatStore } from '../../store/useChatStore';
import getBackendUrl from '../../api/getUrl';

interface Props {
  friend: Friend;
}

export const FriendItem: React.FC<Props> = ({ friend }) => {
  const selectFriend = useChatStore((state) => state.selectFriend);
  const selectedFriendId = useChatStore((state) => state.selectedFriendId);
  const unreadCount = useChatStore((state) => state.unreadCounts[friend.id] || 0);

  const isSelected = selectedFriendId === friend.id;

  const avatarSrc = (friend.avatarUrl?.startsWith('http')) 
    ? friend.avatarUrl 
    : `${getBackendUrl()}:3000${friend.avatarUrl}`;

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'online': return 'bg-online';
          case 'in-game': return 'bg-purple-500';
          case 'in-queue': return 'bg-blue';
          default: return 'bg-gray-400';
      }
  };

  const getStatusText = (status: string) => {
      switch (status) {
          case 'online': return 'Online';
          case 'in-game': return 'in-game';
          case 'in-queue': return 'in-queue';
          default: return 'Offline';
      }
  };
  const fallbackImage = "https://ui-avatars.com/api/?name=User";

  return (
    <div
      onClick={() => selectFriend(friend.id)}
      className={`flex items-center p-3 cursor-pointer hover:bg-bgprimary/50 transition-colors border-b border-secondary/10 relative group ${
        isSelected ? 'bg-accent/10 border-r-4 border-accent' : ''
      }`}
    >
      {/* Avatar & Status */}
      <div className="relative flex-shrink-0">
        <img
          src={avatarSrc}
          crossOrigin='anonymous' 
          referrerPolicy='no-referrer' 
          onError={(e) => { e.currentTarget.src = fallbackImage }}
          alt={friend.username}
          className="w-10 h-10 rounded-full bg-secondary/20 object-cover border-2 border-secondary"
        />
        
        {/* Status Dot */}
            <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-bgsecondary ${getStatusColor(friend.status)}`}
            >
            </span>
      </div>

      {/* Info */}
      <div className="ml-3 flex-1 overflow-hidden min-w-0">
        <h4 className="font-medium text-primary truncate">{friend.username}</h4>
        <p className="text-xs text-secondary truncate">
          {getStatusText(friend.status)}
        </p>
      </div>

      {/* Notifications */}
      <div className="flex items-center space-x-2">
        {unreadCount > 0 && (
          <span className="bg-accent text-bgprimary text-xs font-bold px-2 py-0.5 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>
    </div>
  );
};