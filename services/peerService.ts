import { PeerMessage } from '../types';
import { Peer } from 'peerjs';

const PEER_CONFIG = {
  debug: 1,
  pingInterval: 5000,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.ekiga.net' },
      { urls: 'stun:stun.ideasip.com' },
      { urls: 'stun:stun.schlund.de' },
      { urls: 'stun:stun.voiparound.com' },
      { urls: 'stun:stun.voipbuster.com' },
      { urls: 'stun:stun.voipstunt.com' },
      { urls: 'stun:stun.voxgratia.org' }
    ],
    iceCandidatePoolSize: 10, // Pre-fetch candidates to speed up connection
  }
};

const CONNECTION_CONFIG = {
    reliable: true,
    serialization: 'json' as const,
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
        // @ts-ignore
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
        console.log("Connection closed");
        this.connections = this.connections.filter(c => c !== conn);
      });
      
      conn.on('error', (err: any) => {
          console.error("Connection error:", err);
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
        onError("Không thể khởi tạo kết nối mạng.");
        return;
    }

    let connectionMade = false;
    let connectTimeout: any = null;

    this.peer.on('open', (id: string) => {
      this.myId = id;
      const hostId = `loto-${hostCode}`;
      
      console.log(`My ID: ${id}. Connecting to Host: ${hostId}`);

      // Attempt connection
      const conn = this.peer!.connect(hostId, CONNECTION_CONFIG);

      if (!conn) {
          onError("Lỗi tạo kết nối.");
          return;
      }

      // Set a generous timeout for mobile networks (15s)
      connectTimeout = setTimeout(() => {
          if (!connectionMade) {
               console.warn("Connection timed out");
               conn.close();
               onError("Không thể kết nối. Hãy thử dùng chung Wifi với Host hoặc tắt/bật lại mạng.");
          }
      }, 15000);

      conn.on('open', () => {
        clearTimeout(connectTimeout);
        connectionMade = true;
        this.hostConnection = conn;
        console.log("Connected to Host!");
        onOpen();
      });

      conn.on('data', (data: PeerMessage) => {
        onData(data);
      });

      conn.on('close', () => {
          if (connectionMade) onError("Mất kết nối với chủ phòng.");
      });
      
      conn.on('error', (err: any) => {
          console.error("Connection level error:", err);
      });
    });

    this.peer.on('error', (err: any) => {
       console.error('Player Peer Error', err);
       clearTimeout(connectTimeout);
       if (err.type === 'peer-unavailable') {
           onError(`Không tìm thấy phòng "${hostCode}". Hãy kiểm tra lại mã hoặc bảo Host tạo lại phòng.`);
       } else if (err.type === 'disconnected') {
           onError('Mất kết nối mạng.');
       } else if (err.type === 'network') {
           onError('Lỗi mạng hoặc tường lửa chặn. Hãy thử dùng chung Wifi.');
       } else {
           onError(`Lỗi kết nối (${err.type}). Thử lại nhé.`);
       }
    });
  }

  sendToHost(data: PeerMessage) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(data);
    } else {
        console.warn("Cannot send to host: Connection not open");
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