import { create } from 'zustand';
import { Peer, DataConnection } from 'peerjs';
import type { GameState, PlayerAction } from '../types';

interface StoreState {
  peer: Peer | null;
  connections: DataConnection[];
  connection: DataConnection | null; // For client
  isHost: boolean;
  myId: string;
  myName: string;
  roomId: string;
  gameState: GameState | null;
  
  initHost: (roomId: string, name: string) => Promise<void>;
  initLocal: (name: string) => void;
  joinRoom: (roomId: string, name: string) => Promise<void>;
  leaveRoom: () => void;
  sendAction: (action: Omit<PlayerAction, 'playerId'>) => void;
  
  // Host-only game engine hook
  hostDispatch?: (action: PlayerAction) => void;
  setHostDispatch: (fn: (action: PlayerAction) => void) => void;
  broadcastState: (state: GameState) => void;
}

export const useGameStore = create<StoreState>((set, get) => ({
  peer: null,
  connections: [],
  connection: null,
  isHost: false,
  myId: '',
  myName: '',
  roomId: '',
  gameState: null,

  initHost: async (roomId, name) => {
    return new Promise((resolve, reject) => {
      const peer = new Peer(`uno-crisis-${roomId}`);
      peer.on('open', (id) => {
        set({ peer, isHost: true, myId: name, myName: name, roomId });
        
        peer.on('connection', (conn) => {
          conn.on('data', (data: any) => {
            if (data.type === 'ACTION') {
              const { hostDispatch } = get();
              if (hostDispatch) {
                hostDispatch(data.action as PlayerAction);
              }
            } else if (data.type === 'JOIN') {
               const { hostDispatch, gameState } = get();
               if(hostDispatch) {
                  // We simulate a JOIN logic in GameEngine but we can just add them via host directly?
                  // Better let hostGame engine handle join via an action, wait, we don't have a JOIN action in PlayerAction.
                  // Let's add it.
                  hostDispatch({ type: 'JOIN' as any, playerId: data.name, payload: { name: data.name } });
               }
               set(state => ({ connections: [...state.connections, conn] }));
               
               // Send the initial or current state to the client immediately
               if (gameState) {
                  conn.send({ type: 'STATE_UPDATE', state: gameState });
               }
            }
          });
          
          conn.on('close', () => {
             set(state => ({ connections: state.connections.filter(c => c !== conn) }));
             const { hostDispatch } = get();
             if (hostDispatch) {
                // Drop player
                hostDispatch({ type: 'LEAVE' as any, playerId: conn.metadata?.name });
             }
          });
        });
        
        peer.on('disconnected', () => {
           peer.reconnect();
        });

        resolve();
      });
      peer.on('error', (err) => {
        reject(err);
      });
    });
  },

  initLocal: (name) => {
    set({ isHost: true, myId: name, myName: name, roomId: '单人挑战' });
  },

  joinRoom: async (roomId, name) => {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      peer.on('open', (id) => {
        set({ peer, isHost: false, myId: name, myName: name, roomId });
        
        const conn = peer.connect(`uno-crisis-${roomId}`, { metadata: { name } });
        conn.on('open', () => {
          set({ connection: conn });
          conn.send({ type: 'JOIN', name });
          resolve();
        });
        
        conn.on('data', (data: any) => {
          if (data.type === 'STATE_UPDATE') {
            set({ gameState: data.state });
          }
        });
        
        conn.on('close', () => {
           set({ connection: null });
        });
        
        peer.on('disconnected', () => {
           peer.reconnect();
        });
        
        peer.on('error', reject);
      });
      peer.on('error', reject);
    });
  },

  leaveRoom: () => {
    const { peer, connections, connection } = get();
    connections.forEach(c => c.close());
    if (connection) connection.close();
    if (peer) peer.destroy();
    set({ peer: null, connections: [], connection: null, isHost: false, gameState: null });
  },

  sendAction: (action) => {
    const { isHost, myId, connection, hostDispatch } = get();
    const fullAction = { ...action, playerId: myId } as PlayerAction;
    
    if (isHost && hostDispatch) {
      hostDispatch(fullAction);
    } else if (connection) {
      connection.send({ type: 'ACTION', action: fullAction });
    }
  },

  setHostDispatch: (fn) => set({ hostDispatch: fn }),
  
  broadcastState: (state) => {
    const { connections } = get();
    set({ gameState: state });
    connections.forEach(c => c.send({ type: 'STATE_UPDATE', state }));
  }
}));
