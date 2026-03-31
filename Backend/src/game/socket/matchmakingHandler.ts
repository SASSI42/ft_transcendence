import { Server, Socket } from "socket.io";
import { matchmakingQueue } from "../matchmaking/MatchmakingQueue";
import { handleMatchmaking } from "../matchmaking/MatchmakingManager";
import { Database } from "better-sqlite3";
import { setUserStatus, userSessions} from "../../services/UserStatusService";

export default (db: Database, io: Server, socket: Socket) => {
  socket.on("matchmaking:join", () => {
    // get user id from the auth middleware (secure)
    const userId = socket.data.user?.id;
 
    // validation
    if (!userId) {
      return socket.emit("exception", { message: "Unauthorized" });
    }
    if (userSessions.get(userId)?.status != 'ONLINE') return;
  
    // add player to the queue
    matchmakingQueue.addPlayer({
      userId: userId,
      socketId: socket.id,
      timestamp: Date.now(),
    });

    setUserStatus(db, io, Number(userId), 'IN-QUEUE');

    // send confirmation
    socket.emit("matchmaking:queued", { message: "Looking for opponent..." });

    // trigger the matchmaker
    handleMatchmaking(db, io);
  });

  // leave queue (manual cancel)
  socket.on("matchmaking:leave", () => {
    const userId = socket.data.user?.id;
    if (userId) {
      matchmakingQueue.removePlayer(userId);
      setUserStatus(db, io, Number(userId), 'ONLINE');
    }
  });

  // disconnect (auto-cancel)
  socket.on("disconnect", () => {
    const userId = socket.data.user?.id;
    if (userId) {
      matchmakingQueue.removePlayer(userId);
    }
  });
};
