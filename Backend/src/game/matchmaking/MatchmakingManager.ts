import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import { matchmakingQueue, QueueEntry } from "./MatchmakingQueue";
import * as MatchService from "../services/matchService";
import * as PlayerService from "../services/playerService";
import { gameManager } from "../logic/GameManager";
import { Database } from "better-sqlite3";
import { setUserStatus } from '../../services/UserStatusService';

import { dbUser, Player } from "../../types";

const getUserInfo = (db: Database, userId: number): Player => {
  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as dbUser | undefined;

  if (!user) {
    throw new Error("User not found");
  }

  const player: Player = {
    id: user.id,
    username: user.username ?? "",
    avatarUrl: user.Avatar ?? "",
  };

  return player;
};

export const initiateMatch = (db: Database, io: Server, p1:QueueEntry, p2:QueueEntry) => {
  const matchId = randomUUID();

  try {
    //create match in database
    MatchService.createMatch(db, matchId);

    const isP1_X = Math.random() < 0.5;
    const role1 = isP1_X ? "X" : "O";
    const role2 = isP1_X ? "O" : "X";

    PlayerService.addPlayer(db, matchId, p1.userId, role1);
    PlayerService.addPlayer(db, matchId, p2.userId, role2);

    // create match in memory (gamemanager)
    const playerX = isP1_X ? p1 : p2;
    const playerO = isP1_X ? p2 : p1;

    gameManager.createMatch(
      matchId,
      { userId: playerX.userId, socketId: playerX.socketId },
      { userId: playerO.userId, socketId: playerO.socketId }
    );

    //notify players
    const roomName = `match:${matchId}`;

    const socket1 = io.sockets.sockets.get(p1.socketId);
    const socket2 = io.sockets.sockets.get(p2.socketId);

    if (socket1 && socket2) {
      socket1.join(roomName);
      socket2.join(roomName);

      const user1: Player = getUserInfo(db, p1.userId);
      const user2: Player = getUserInfo(db, p2.userId);

      io.to(p1.socketId).emit("matchmaking:found", {
        matchId,
        opponent: user2,
        role: role1,
      });

      io.to(p2.socketId).emit("matchmaking:found", {
        matchId,
        opponent: user1,
        role: role2,
      });

    } else {
      console.error(
        "[MatchmakingManager] One of the sockets disconnected during matching."
      );
      gameManager.removeMatch(matchId);
    }
  } catch (err) {
    console.error("[MatchmakingManager] DB Error:", err);
  }
  setUserStatus(db, io, Number(p1.userId), 'IN-GAME');
  setUserStatus(db, io, Number(p2.userId), 'IN-GAME');
}
/** get 2 players from the queue and join them in a match */
export const handleMatchmaking = async (db: Database, io: Server) => {
  const pair = matchmakingQueue.getNextPair();

  if (!pair) return; // not enough players yet

  const [p1, p2] = pair;
  initiateMatch(db, io, p1, p2)
};
