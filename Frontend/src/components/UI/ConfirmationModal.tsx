import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    isDangerous?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, onClose, onConfirm, title, message, confirmText, isDangerous = false 
}) => {
    if (!isOpen) return null;

    return (
        // Backdrop
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            {/* Modal Content */}
            <div className="bg-bgsecondary border border-white/10 p-6 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all scale-100 animate-fadeIn">
                <h3 className="text-xl font-bebas-neue text-primary mb-2 tracking-wide flex items-center gap-2">
                    {isDangerous && <span className="text-red">⚠️</span>}
                    {title}
                </h3>
                
                <p className="text-sm text-secondary mb-6 leading-relaxed">
                    {message}
                </p>
                
                <div className="flex space-x-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-primary bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all transform hover:scale-105 ${
                            isDangerous 
                            ? 'bg-red/80 text-white hover:bg-red' 
                            : 'bg-accent text-bgprimary hover:bg-accent/90'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};