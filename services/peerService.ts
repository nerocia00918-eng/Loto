import { PeerMessage } from '../types';
import { Peer } from 'peerjs';

// Expanded Public STUN List to maximize direct connection chances
const DEFAULT_ICE_SERVERS = [
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
];

const CONNECTION_CONFIG = {
    reliable: true,
    serialization: 'json' as const,
};

export class PeerService {
  private peer: Peer | null = null;
  private connections: any[] = [];
  private hostConnection: any = null;
  public myId: string = '';
  private heartbeatInterval: any = null;

  constructor() {}

  // Helper to get config mixing default STUN + Custom TURN
  private getPeerConfig() {
    let iceServers: any[] = [...DEFAULT_ICE_SERVERS];
    
    try {
        const stored = localStorage.getItem('loto_turn_config');
        if (stored) {
            const custom = JSON.parse(stored);
            if (custom.turnUrl && custom.turnUser && custom.turnPass) {
                console.log("Using Custom TURN Server");
                iceServers.unshift({
                    urls: custom.turnUrl,
                    username: custom.turnUser,
                    credential: custom.turnPass
                });
            }
        }
    } catch (e) {
        console.error("Error loading TURN config", e);
    }

    return {
      debug: 1, // 0: None, 1: Errors, 2: Warnings, 3: All
      config: {
        iceServers: iceServers,
        iceCandidatePoolSize: 10,
      }
    };
  }

  // --- HEARTBEAT SYSTEM (CRITICAL FOR MOBILE) ---
  private startHeartbeat() {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      
      // Ping every 3 seconds to keep NAT open on 4G/Mobile
      this.heartbeatInterval = setInterval(() => {
          const pingMsg = { type: 'PING' };
          
          if (this.hostConnection && this.hostConnection.open) {
              this.hostConnection.send(pingMsg);
          }
          
          this.connections.forEach(conn => {
              if (conn.open) conn.send(pingMsg);
          });
      }, 3000); 
  }

  private stopHeartbeat() {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
  }

  // Initialize as Host
  initHost(onOpen: (id: string) => void, onData: (data: PeerMessage, conn: any) => void) {
    this.createHostPeer(onOpen, onData);
  }

  private createHostPeer(onOpen: (id: string) => void, onData: (data: PeerMessage, conn: any) => void, retryCount = 0) {
    const randomId = Math.floor(1000 + Math.random() * 9000).toString();
    const fullId = `loto-${randomId}`;

    if (this.peer) this.peer.destroy();

    try {
        // @ts-ignore
        this.peer = new Peer(fullId, this.getPeerConfig());
    } catch (e) {
        console.error("Error creating peer", e);
        if (retryCount < 3) setTimeout(() => this.createHostPeer(onOpen, onData, retryCount + 1), 1000);
        return;
    }

    this.peer.on('open', (id: string) => {
      this.myId = id;
      console.log('Host initialized: ' + id);
      this.startHeartbeat();
      onOpen(randomId);
    });

    this.peer.on('connection', (conn: any) => {
      this.connections.push(conn);
      
      conn.on('data', (data: any) => {
        if (data.type === 'PING') return; // Ignore pings
        onData(data, conn);
      });
      
      conn.on('close', () => {
        this.connections = this.connections.filter(c => c !== conn);
      });
      
      conn.on('error', (err: any) => console.error("Conn Error:", err));
    });

    this.peer.on('error', (err: any) => {
      console.error('Host Error:', err);
      if (err.type === 'unavailable-id' && retryCount < 5) {
            setTimeout(() => this.createHostPeer(onOpen, onData, retryCount + 1), 500);
      }
    });
  }

  // Initialize as Player
  initPlayer(hostCode: string, onOpen: () => void, onData: (data: PeerMessage) => void, onError: (err: string) => void) {
    if (this.peer) this.peer.destroy();
    
    try {
        // @ts-ignore
        this.peer = new Peer(undefined, this.getPeerConfig());
    } catch (e) {
        onError("Lỗi khởi tạo mạng.");
        return;
    }

    let connectionMade = false;
    let connectTimeout: any = null;

    this.peer.on('open', (id: string) => {
      this.myId = id;
      const hostId = `loto-${hostCode}`;
      
      const conn = this.peer!.connect(hostId, CONNECTION_CONFIG);

      if (!conn) {
          onError("Lỗi kết nối.");
          return;
      }

      // 15s Timeout for Mobile
      connectTimeout = setTimeout(() => {
          if (!connectionMade) {
               conn.close();
               onError("Kết nối quá lâu. Hãy dùng QR Code hoặc Link mời (có chứa cấu hình mạng).");
          }
      }, 15000);

      conn.on('open', () => {
        clearTimeout(connectTimeout);
        connectionMade = true;
        this.hostConnection = conn;
        this.startHeartbeat();
        console.log("Connected to Host");
        onOpen();
      });

      conn.on('data', (data: any) => {
        if (data.type === 'PING') return;
        onData(data);
      });

      conn.on('close', () => {
          if (connectionMade) onError("Mất kết nối với Host.");
      });
    });

    this.peer.on('error', (err: any) => {
       console.error('Player Error', err);
       clearTimeout(connectTimeout);
       if (err.type === 'peer-unavailable') {
           onError(`Không tìm thấy phòng "${hostCode}".`);
       } else if (err.type === 'network' || err.type === 'disconnected') {
           onError('Lỗi mạng/Tường lửa. Hãy dùng Link/QR Code của Host để tự động cấu hình.');
       } else {
           onError(`Lỗi: ${err.type}`);
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
    if (conn && conn.open) conn.send(data);
  }

  broadcast(data: PeerMessage) {
    this.connections.forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }

  destroy() {
    this.stopHeartbeat();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections = [];
    this.hostConnection = null;
  }
}

export const peerService = new PeerService();