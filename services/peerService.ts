import { PeerMessage } from '../types';
import { Peer } from 'peerjs';

// Minimal STUN List for Mobile Stability
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
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

  private getPeerConfig() {
    let iceServers: any[] = [...DEFAULT_ICE_SERVERS];
    
    try {
        const stored = localStorage.getItem('loto_turn_config');
        if (stored) {
            const custom = JSON.parse(stored);
            if (custom.turnUrl && custom.turnUser && custom.turnPass) {
                console.log("Using Custom TURN Server");
                iceServers = [{
                    urls: custom.turnUrl,
                    username: custom.turnUser,
                    credential: custom.turnPass
                }, ...iceServers]; // Prioritize TURN
            }
        }
    } catch (e) {
        console.error("Error loading TURN config", e);
    }

    return {
      debug: 1, 
      config: {
        iceServers: iceServers,
        // CRITICAL FOR MOBILE: Reduce this to 1. 
        iceCandidatePoolSize: 1, 
      }
    };
  }

  // --- HEARTBEAT SYSTEM ---
  private startHeartbeat() {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(() => {
          const pingMsg = { type: 'PING' };
          if (this.hostConnection && this.hostConnection.open) {
              this.hostConnection.send(pingMsg);
          }
          this.connections.forEach(conn => {
              if (conn.open) conn.send(pingMsg);
          });
      }, 2000); // Faster heartbeat (2s) to keep NAT open
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
    // Short ID for easier typing if needed, but robust enough
    const randomId = Math.floor(1000 + Math.random() * 9000).toString();
    const fullId = `loto-${randomId}`;

    if (this.peer) this.peer.destroy();

    try {
        // @ts-ignore
        this.peer = new Peer(fullId, this.getPeerConfig());
    } catch (e) {
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
        if (data.type === 'PING') return;
        onData(data, conn);
      });
      conn.on('close', () => {
        this.connections = this.connections.filter(c => c !== conn);
      });
      conn.on('error', (err: any) => console.error("Conn Error:", err));
    });

    this.peer.on('error', (err: any) => {
      console.error('Host Error:', err);
      // Auto retry if ID taken
      if (err.type === 'unavailable-id') {
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
        onError("Lỗi khởi tạo mạng. Vui lòng tải lại trang.");
        return;
    }

    let connectTimeout: any = null;
    let hasConnected = false;

    this.peer.on('open', (id: string) => {
      this.myId = id;
      const hostId = `loto-${hostCode}`;
      console.log(`My Peer ID: ${id}. Connecting to ${hostId}...`);
      
      const conn = this.peer!.connect(hostId, CONNECTION_CONFIG);

      if (!conn) {
          onError("Không thể tạo kết nối.");
          return;
      }

      // Hard timeout for connection attempt (10s)
      connectTimeout = setTimeout(() => {
          if (!hasConnected) {
               conn.close();
               onError("Kết nối quá lâu (Timeout). Hãy thử lại hoặc dùng Wifi khác.");
          }
      }, 10000);

      conn.on('open', () => {
        clearTimeout(connectTimeout);
        hasConnected = true;
        this.hostConnection = conn;
        this.startHeartbeat();
        console.log("Connected to Host successfully");
        onOpen();
      });

      conn.on('data', (data: any) => {
        if (data.type === 'PING') return;
        onData(data);
      });

      conn.on('close', () => {
          if (hasConnected) onError("Đã mất kết nối với Host.");
      });
      
      // Explicitly handle ICE failures (common on mobile)
      // @ts-ignore
      conn.on('iceStateChanged', (state) => {
          if (state === 'disconnected' || state === 'failed' || state === 'closed') {
              console.log("ICE State:", state);
          }
      });
    });

    this.peer.on('error', (err: any) => {
       console.error('Player Error', err);
       clearTimeout(connectTimeout);
       
       if (err.type === 'peer-unavailable') {
           onError(`Không tìm thấy phòng "${hostCode}". Host có đang mở không?`);
       } else if (err.type === 'network' || err.type === 'disconnected' || err.type === 'webrtc') {
           onError('Lỗi mạng/Tường lửa (WebRTC). Hãy dùng 4G hoặc Wifi khác.');
       } else if (err.type === 'browser-incompatible') {
           onError('Trình duyệt không hỗ trợ. Hãy dùng Chrome hoặc Safari mới nhất.');
       } else {
           onError(`Lỗi kết nối: ${err.type}`);
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