import { type Socket } from "socket.io-client";
import { socketService } from "../../services/socket";

type EventHandler = (...args: unknown[]) => void;
type OnceHandler = (...args: unknown[]) => void;

export class WebSocketClient {
  private static instance: WebSocketClient;
  private activeListeners: Map<string, Set<EventHandler>> = new Map();
  private reconnectCallbacks = new Set<() => void>();
  private disconnectCallbacks = new Set<(reason: string) => void>();

  private constructor() {
    this.setupGlobalListeners();
  }

  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  private setupGlobalListeners() {
    const socket = socketService.socket;
    if (!socket) return;

    socket.on("disconnect", (reason: string) => {
      this.runHandlers(this.disconnectCallbacks, [reason]);
    });

    socket.on("connect", () => {
      this.runHandlers(this.reconnectCallbacks, [] as []);
    });
  }

  public async connect(): Promise<Socket> {
    const socket = socketService.socket;

    if (!socket) {
      return Promise.reject(new Error("Main socket not initialized"));
    }

    if (socket.connected) {
      return Promise.resolve(socket);
    }

    if (!socket.connected) {
      return new Promise((resolve) => {
        socket.once("connect", () => resolve(socket));
      });
    }

    return Promise.resolve(socket);
  }

  public emit = (event: string, payload?: unknown): void => {
    const socket = socketService.socket;
    if (socket && socket.connected) {
      socket.emit(event, payload);
    }
  };

  public on = (event: string, handler: EventHandler): void => {
    const socket = socketService.socket;
    if (!socket) return;

    socket.on(event, handler);

    if (!this.activeListeners.has(event)) {
      this.activeListeners.set(event, new Set());
    }
    this.activeListeners.get(event)!.add(handler);
  };

  public once = (event: string, handler: OnceHandler): void => {
    const socket = socketService.socket;
    if (!socket) return;
    socket.once(event, handler);
  };

  public off = (event: string, handler: EventHandler): void => {
    const socket = socketService.socket;
    if (!socket) return;

    socket.off(event, handler);

    const handlers = this.activeListeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.activeListeners.delete(event);
      }
    }
  };

  public getSocket(): Socket | null {
    return socketService.socket;
  }

  public isConnected(): boolean {
    return socketService.socket?.connected ?? false;
  }

  public disconnect(): void {
    this.reset();
  }

  public reset(): void {
    const socket = socketService.socket;
    if (!socket) return;

    this.activeListeners.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        socket.off(event, handler);
      });
    });

    this.activeListeners.clear();
  }

  public onDisconnect(handler: (reason: string) => void): () => void {
    this.disconnectCallbacks.add(handler);
    return () => this.disconnectCallbacks.delete(handler);
  }

  public onReconnect(handler: () => void): () => void {
    this.reconnectCallbacks.add(handler);
    return () => this.reconnectCallbacks.delete(handler);
  }

  private runHandlers<Args extends unknown[]>(
    handlers: Set<(...args: Args) => void>,
    args: Args
  ): void {
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (error) {
        console.error("WebSocket event handler error:", error);
      }
    }
  }
}