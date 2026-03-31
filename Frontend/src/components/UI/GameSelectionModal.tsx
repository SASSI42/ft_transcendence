export const GameSelectionModal = ({ isOpen, onClose, onSelect }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-bgsecondary border border-accent/20 rounded-2xl p-6 w-80 shadow-2xl transform transition-all scale-100">
                <h3 className="text-xl font-bold text-primary text-center mb-6">Choose Game</h3>
                <div className="space-y-3">
                    <button 
                        onClick={() => onSelect('PONG')}
                        className="w-full p-4 bg-bgprimary hover:bg-accent hover:text-bgprimary border border-secondary/20 rounded-xl transition-all flex items-center justify-between group"
                    >
                        <span className="text-2xl">🏓</span>
                        <span className="font-bold">Ping Pong</span>
                    </button>
                    <button 
                        onClick={() => onSelect('TICTACTOE')}
                        className="w-full p-4 bg-bgprimary hover:bg-accent hover:text-bgprimary border border-secondary/20 rounded-xl transition-all flex items-center justify-between group"
                    >
                        <span className="text-2xl">❌⭕</span>
                        <span className="font-bold">Tic Tac Toe</span>
                    </button>
                </div>
                <button onClick={onClose} className="mt-4 text-xs text-secondary hover:text-primary w-full text-center">Cancel</button>
            </div>
        </div>
    );
};