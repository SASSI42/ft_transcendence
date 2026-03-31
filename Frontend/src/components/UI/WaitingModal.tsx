import React from 'react';
import { useChatStore } from '../../store/useChatStore';
import { socketService } from '../../services/socket';

export const WaitingModal: React.FC = () => {
  const outgoingInvite = useChatStore((state) => state.outgoingInvite);
  const setOutgoingInvite = useChatStore((state) => state.setOutgoingInvite);
  const friends = useChatStore((state) => state.friends);
  
  if (!outgoingInvite) return null;

  const receiverName = friends.find(f => f.id === outgoingInvite.receiverId)?.username 
                    || 'Opponent';

  const handleCancel = () => {
    socketService.cancelGameInvite(outgoingInvite.id);
    setOutgoingInvite(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-bgprimary/95 backdrop-blur-md flex flex-col items-center justify-center text-primary">
      <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-accent mb-6"></div>
      
      <h2 className="text-3xl font-bebas-neue mb-2 tracking-wide">WAITING FOR {receiverName.toUpperCase()}...</h2>
      <p className="text-secondary mb-8">The game will start as soon as they accept.</p>
      
      <button 
        onClick={handleCancel}
        className="px-8 py-3 bg-red hover:bg-red/90 text-primary rounded-full font-bold transition-all transform hover:scale-105 shadow-xl"
      >
        Cancel Invite
      </button>
    </div>
  );
};