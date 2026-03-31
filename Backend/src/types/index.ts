// Type definitions for various entities in the chat application

//xo_game
export type Player = {
    id: number;
    username: string;
    avatarUrl: string;
};

export type dbUser = {
  id: number;

  username: string | null;
  password: string | null;
  email: string | null;
  salt: string | null;

  twoFactorCode: string | null;
  resetCode: string | null;
  usedCode: boolean;

  token: string | null;
  Avatar: string | null;

  twoFA: boolean;
  oauth2: boolean;
};
///////////////////

export type User = {
    id: number;
    username: string;
    email: string;
    avatarUrl: string;
};

export type Friend = {
    id: number;
    userId: number;
    friendId: number;
};

export type Friendship = {
    id: string;
    userId: number;
    friendId: number;
    createdAt: Date;
};

export type Message = {
    id: string;
    senderId: number;
    receiverId: number;
    content: string;
    timestamp: Date;
};

export type GameInvite = {
    id: string;
    senderId: number;
    receiverId: number;
    gameId: string;
    timestamp: Date;
};

export type SocketEvent = {
    event: string;
    data: any;
};