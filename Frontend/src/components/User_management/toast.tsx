import { useEffect, useState } from 'react';

interface ToastProps{
  message?: string;
  type?: 'success' | 'error';
  onClose?:()=>void
}

const Toast:React.FC<ToastProps> = ({ message = '', type = 'success', onClose}) => {
  const [visible, setVisible] = useState(false);

  const state = type === 'success'
    ? 'bg-green/20 text-green border-green/20'
    : 'bg-red/20 text-red border-red/20';

  useEffect(() => {
    const showTimeout = setTimeout(() => setVisible(true), 100);

    const hideTimeout = setTimeout(() => setVisible(false), 3100);

    const closeTimeout = setTimeout(() => onClose?.(), 3600);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
      clearTimeout(closeTimeout);
    };
  }, [onClose]);

  return (
    <div
      className={`
        fixed top-16 right-5 z-50
        px-5 py-3 rounded-xl
        shadow-[0_4px_20px_rgba(0,0,0,0.45)]
        backdrop-blur-lg border border-white/5
        text-sm
        transition-all duration-[1000ms] ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'}
        ${state}
      `}
    >
      <div className="flex justify-between items-center gap-2">
        <span>{message}</span>
        <button
          onClick={() => setVisible(false)}
          className="font-extrabold px-2 text-primary hover:text-red transition"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
