import { PeerMessage } from '../types';
import { Peer } from 'peerjs';

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  }
};

export class PeerService {
  private peer: Peer | null = null;
  private connections: any[] = [];
  private hostConnection: any = null;
  public myId: string = '';

  constructor() {}

  // Initialize as Host
  initHost(onOpen: (id: string) => void, onData: (data: PeerMessage, conn: any) => void) {
    this.createHostPeer(onOpen, onData);
  }

  private createHostPeer(onOpen: (id: string) => void, onData: (data: PeerMessage, conn: any) => void, retryCount = 0) {
    const randomId = Math.floor(1000 + Math.random() * 9000).toString();
    const fullId = `loto-${randomId}`;

    if (this.peer) {
        this.peer.destroy();
    }

    try {
        // @ts-ignore - PeerJS typing issues with imports sometimes
        this.peer = new Peer(fullId, PEER_CONFIG);
    } catch (e) {
        console.error("Error creating peer", e);
        if (retryCount < 3) setTimeout(() => this.createHostPeer(onOpen, onData, retryCount + 1), 1000);
        return;
    }

    this.peer.on('open', (id: string) => {
      this.myId = id;
      console.log('Host initialized with ID: ' + id);
      onOpen(randomId);
    });

    this.peer.on('connection', (conn: any) => {
      console.log('New connection received');
      this.connections.push(conn);
      
      conn.on('data', (data: PeerMessage) => {
        onData(data, conn);
      });
      
      conn.on('close', () => {
        this.connections = this.connections.filter(c => c !== conn);
      });
    });

    this.peer.on('error', (err: any) => {
      console.error('Host Peer Error:', err);
      if (err.type === 'unavailable-id') {
        if (retryCount < 5) {
            setTimeout(() => this.createHostPeer(onOpen, onData, retryCount + 1), 500);
        }
      }
    });
  }

  // Initialize as Player
  initPlayer(hostCode: string, onOpen: () => void, onData: (data: PeerMessage) => void, onError: (err: string) => void) {
    if (this.peer) {
        this.peer.destroy();
    }
    
    try {
        // @ts-ignore
        this.peer = new Peer(undefined, PEER_CONFIG);
    } catch (e) {
        onError("Không thể khởi tạo kết nối.");
        return;
    }

    let connectionMade = false;

    this.peer.on('open', (id: string) => {
      this.myId = id;
      const hostId = `loto-${hostCode}`;
      
      const conn = this.peer!.connect(hostId);

      if (!conn) {
          onError("Lỗi tạo kết nối.");
          return;
      }

      conn.on('open', () => {
        connectionMade = true;
        this.hostConnection = conn;
        onOpen();
      });

      conn.on('data', (data: PeerMessage) => {
        onData(data);
      });

      conn.on('close', () => {
          if (connectionMade) onError("Mất kết nối với chủ phòng.");
      });
      
      // Safety timeout
      setTimeout(() => {
          if (!connectionMade) {
               // Don't close aggressively, but warn?
               // PeerJS sometimes takes time.
          }
      }, 5000);
    });

    this.peer.on('error', (err: any) => {
       console.error('Player Peer Error', err);
       if (err.type === 'peer-unavailable') {
           onError(`Không tìm thấy phòng "${hostCode}".`);
       } else {
           onError('Lỗi: ' + err.type);
       }
    });
  }

  sendToHost(data: PeerMessage) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(data);
    }
  }

  sendToPlayer(peerId: string, data: PeerMessage) {
    const conn = this.connections.find(c => c.peer === peerId);
    if (conn && conn.open) {
      conn.send(data);
    } else {
        console.warn(`Could not send to player ${peerId}, connection not found or closed.`);
    }
  }

  broadcast(data: PeerMessage) {
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections = [];
    this.hostConnection = null;
  }
}

export const peerService = new PeerService();