import { PlusCircle, Search } from 'lucide-react';
import { IoChevronBack } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  activeTab: 'create' | 'join';
  onTabChange: (tab: 'create' | 'join') => void;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="bg-border-b border-gray-600/30">
      <div className="px-2 py-2">
        <div className="flex items-start justify-between">
          <div className='flex flex-row'>
            <div onClick={ () => {navigate('/Menu')} } className="hover:text-accent text-4xl pr-5 pt-1"><IoChevronBack /></div>
            <div>
              <h1 className="text-white font-oswald font-bold text-3xl uppercase" style={{ textShadow: '0 0 20px rgba(102, 232, 250, 0.3)' }}>
                PONG GAME
              </h1>
              <p className="text-white/60 font-roboto">
                Choose your game mode and start playing
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => onTabChange('create')}
              className={`flex items-center gap-2 px-4 py-2 rounded-[12px] font-oswald font-bold uppercase transition-all ${
                activeTab === 'create'
                  ? 'bg-accent text-bgprimary'
                  : 'bg-bgprimary text-white hover:bg-bgprimary/70'
              }`}
              style={activeTab === 'create' ? { boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' } : {}}
            >
              <PlusCircle className="w-5 h-5" />
              CREATE
            </button>
            <button
              onClick={() => onTabChange('join')}
              className={`flex items-center gap-2 px-6 py-3 rounded-[12px] font-oswald font-bold uppercase transition-all ${
                activeTab === 'join'
                  ? 'bg-accent text-bgprimary'
                  : 'bg-bgprimary text-white hover:bg-bgprimary/70'
              }`}
              style={activeTab === 'join' ? { boxShadow: '0 0 15px rgba(102, 232, 250, 0.5)' } : {}}
            >
              <Search className="w-5 h-5" />
              JOIN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
