import { Server, Socket } from "socket.io";
import { gameManager } from "../logic/GameManager";
import * as matchService from "../services/matchService";
import { Database } from 'better-sqlite3';

import { setUserStatus } from '../../services/UserStatusService';

interface MovePayload {
  matchId: string;
  position: number;
}

interface JoinPayload {
  matchId: string;
}

export function gameHandler(db: Database, io: Server, socket: Socket) {
  const handleForfeit = async (matchId: string, losingUserId: number) => {
    const match = gameManager.getMatch(matchId);
    if (!match) return;

    match.forfeit(losingUserId);
    const { winner, scores } = match.getState();

    io.to(`match:${matchId}`).emit("match:state", match.getState());
    io.to(`match:${matchId}`).emit("game:series:ended", {
      winnerId: winner,
      reason: "FORFEIT",
    });

    try {
      matchService.finishMatch(db, matchId, "FINISHED", winner!);
      matchService.updatePlayerScore(
        db,
        matchId,
        match.players.X.userId,
        scores.X
      );
      matchService.updatePlayerScore(
        db,
        matchId,
        match.players.O.userId,
        scores.O
      );
    } catch (e) {
      console.error(e);
    }

    setTimeout(() => gameManager.removeMatch(matchId), 60000);
    setUserStatus(db, io, Number(match.players.X.userId), 'ONLINE');
    setUserStatus(db, io, Number(match.players.O.userId), 'ONLINE');
  };

  socket.on("game:join", ({ matchId }: JoinPayload) => {
    const match = gameManager.getMatch(matchId);
    if (!match)
      return socket.emit("game:error", { message: "Match not found" });

    const userId = socket.data.user?.id;
    if (!userId) return socket.emit("game:error", { message: "Unauthorized" });

    const isPlayerX = match.players.X.userId === userId;
    const isPlayerO = match.players.O.userId === userId;
    if (!isPlayerX && !isPlayerO)
      return socket.emit("game:error", { message: "Not in match" });

    const roomName = `match:${matchId}`;
    socket.join(roomName);

    match.updateSocketId(userId, socket.id);

    const role = isPlayerX ? "X" : "O";
    socket.emit("game:role", { role });
    socket.emit("match:state", match.getState());
    
    // stop disconnecting timer
    match.clearDisconnectTimer(userId);
    const opponent = isPlayerX ? match.players.O : match.players.X;
    const opponentExpiresAt = match.disconnectState.get(opponent.userId)?.expiresAt;
    if (opponentExpiresAt) {
      //send timestamp to opponent
      socket.emit("opponent:disconnected", {
        expiresAt: opponentExpiresAt,
      });
      
      //start disconnecting timer
      match.startDisconnectTimer(async () => {
        handleForfeit(match.matchId, opponent.userId);
      }, opponent.userId, Math.max(0, opponentExpiresAt - Date.now()));
    } else {
      io.to(roomName).emit("opponent:reconnected", {
        user: userId,
      });
    }
  });

  socket.on("game:current-match", ({ userId }: { userId: number }) => {
    const matchId = gameManager.getPlayerCurrentMatch(userId)
    if (matchId)
      socket.emit("game:rejoin", {matchId: matchId})
  });

  socket.on("game:move", async ({ matchId, position }: MovePayload) => {
    const match = gameManager.getMatch(matchId);
    if (!match)
      return socket.emit("game:error", { message: "Match not found" });

    const userId = socket.data.user?.id;
    const roomName = `match:${matchId}`;

    if (!socket.rooms.has(roomName)) socket.join(roomName);

    const result = match.handleMove(userId, position);
    if (!result.success)
      return socket.emit("game:error", { message: result.error });

    io.to(roomName).emit("game:move:accepted", {
      position,
      playerSymbol: match.getState().roundState.board[position],
      turn: match.getState().roundState.turn,
    });
    io.to(roomName).emit("match:state", result.state);

    if (result.state.roundState.status !== "IN_PROGRESS") {
      io.to(roomName).emit("game:round:ended", {
        roundResult: result.state.roundState.status,
        scores: result.state.scores,
      });
    }

    if (result.state.status === "FINISHED") {
      const { winner, scores } = result.state;
      io.to(roomName).emit("game:series:ended", {
        winnerId: winner,
        score: `${scores.X}-${scores.O}`,
      });

      try {
         matchService.finishMatch(db, matchId, "FINISHED", winner!);
         matchService.updatePlayerScore(
          db,
          matchId,
          match.players.X.userId,
          scores.X
        );
         matchService.updatePlayerScore(
          db,
          matchId,
          match.players.O.userId,
          scores.O
        );
      } catch (e) {
        console.error(e);
      }

      setTimeout(() => gameManager.removeMatch(matchId), 60000);
      setUserStatus(db, io, Number(match.players.X.userId), 'ONLINE');
      setUserStatus(db, io, Number(match.players.O.userId), 'ONLINE');

    }
  });

  socket.on("game:forfeit", async ({ matchId }: JoinPayload) => {
    const userId = socket.data.user?.id;
    if (userId)  handleForfeit(matchId, userId);
  });

  const disconnectHandler = (socket: Socket) => {
      const userId = socket.data.user?.id;
    if (!userId) return;

    const match = gameManager.findMatchByUserId(userId);
    if (match && match.getState().status === "ONGOING") {
      const isPlayerX = match.players.X.userId === userId;
      const currentSocketId = isPlayerX
        ? match.players.X.socketId
        : match.players.O.socketId;

      if (socket.id !== currentSocketId) return; // ignore ghost socket

      //start disconnecting timer
      match.startDisconnectTimer(async () => {
         handleForfeit(match.matchId, userId);
      }, userId, 15000);

      //send timestamp to opponent
      io.to(`match:${match.matchId}`).emit("opponent:disconnected", {
        expiresAt: match.disconnectState.get(userId)?.expiresAt,
      });
    }
  }
  socket.on("disconnect", () => {
    disconnectHandler(socket);
  });

  socket.on("offgame", () => {
    disconnectHandler(socket);
  });
}
