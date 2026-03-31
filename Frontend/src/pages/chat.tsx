import { FriendsList } from '../components/Friends/FriendsList';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { WaitingModal } from '../components/UI/WaitingModal';

export const ChatPage = () => {

return (
        <div className="flex h-full w-full overflow-hidden relative">
            
            <WaitingModal />

            {/* Left Sidebar: Friends & Requests */}
            <div className="w-80 border-r border-white/10">
                <FriendsList />
            </div>

            {/* Main Area: Chat Window */}
            <div className="flex-1 relative flex flex-col">
                <ChatWindow />
            </div>
        </div>
    );
}