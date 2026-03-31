import { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../../components/User_management/toast';

interface ToastData{
  message: string,
  type?:any
}

interface chilProp {
  children:React.ReactNode
}

interface ToastContextProps{
  showToast: (message: string, type?:'success' | 'error') => void
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);


export const ToastProvider:React.FC<chilProp> = ({ children }) => {

  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((message:string, type = 'success') => {setToast({ message, type });}, []);
  const closeToast = () => setToast(null);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);