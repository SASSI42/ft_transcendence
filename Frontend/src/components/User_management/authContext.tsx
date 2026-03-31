import { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import { socketService } from '../../services/socket'; 
import getBackendUrl from '../../api/getUrl';

export interface User {
    id: number;
    username: string;
    avatar: string;
    email?: string;
}

export interface AuthContextType {
    isLoggedIn: boolean;
    user: User | null;
    login: (userData: User) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
    isLoading: boolean;
    serverError: boolean; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [serverError, setServerError] = useState(false);

    const initializeSession = (userData: User) => {
        const safeUser = { 
            ...userData, 
            id: Number(userData.id) 
        };
        setUser(safeUser);
        setIsLoggedIn(true);
        setServerError(false);
        socketService.connect(safeUser.id);
    };

    const checkAuth = async () => {
        try {
            let res = await fetch(`${getBackendUrl()}:3000/api/user/login`, {
                credentials: 'include'
            });

            if (res.status === 401) {

                 const refreshRes = await fetch(`${getBackendUrl()}:3000/api/user/refresh`, {
                     method: 'POST',
                     credentials: 'include'
                 });
                 
                 if (refreshRes.ok) {

                     res = await fetch(`${getBackendUrl()}:3000/api/user/login`, {
                        credentials: 'include'
                    });
                 }
            }

            if (res.ok) {
                const data = await res.json();
                if (data.user) initializeSession(data.user);
            } else {
                setUser(null);
                setIsLoggedIn(false);
                setServerError(false);
                socketService.disconnect();
            }
        } catch (error) {
            setUser(null);
            setIsLoggedIn(false);
            setServerError(true); 
            socketService.disconnect();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = (userData: User) => {
        const User = { 
        ...userData, 
        id: Number(userData.id) 
    };
        initializeSession(User);
    };

    const logout = async () => {
        try {
            await fetch(`${getBackendUrl()}:3000/api/user/logout`, { 
                method: 'POST',
                credentials: 'include' 
            });
        } catch (e) { console.error("Logout failed", e); }

        setUser(null);
        setIsLoggedIn(false);
        setServerError(false);
        socketService.disconnect();
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, login, logout, checkAuth, isLoading, serverError }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
