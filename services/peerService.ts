import { PeerMessage } from '../types';

// Declare PeerJS types globally since we are using CDN
declare const Peer: any;

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  }
};

export class PeerService {
  private peer: any;
  private connections: any[] = [];
  private hostConnection: any = null;
  public myId: string = '';

  constructor() {}

  // Initialize as Host
  initHost(onOpen: (id: string) => void, onData: (data: PeerMessage, conn: any) => void) {
    this.createHostPeer(onOpen, onData);
  }

  private createHostPeer(onOpen: (id: string) => void, onData: (data: PeerMessage, conn: any) => void, retryCount = 0) {
    // Generate a random 4-char ID for easier sharing
    const randomId = Math.floor(1000 + Math.random() * 9000).toString();
    const fullId = `loto-${randomId}`;

    if (this.peer) {
        this.peer.destroy();
    }

    try {
        this.peer = new Peer(fullId, PEER_CONFIG);
    } catch (e) {
        console.error("Error creating peer", e);
        if (retryCount < 3) this.createHostPeer(onOpen, onData, retryCount + 1);
        return;
    }

    this.peer.on('open', (id: string) => {
      this.myId = id;
      console.log('Host initialized with ID: ' + id);
      onOpen(randomId); // Just return the short code
    });

    this.peer.on('connection', (conn: any) => {
      console.log('New connection received');
      this.connections.push(conn);
      
      conn.on('data', (data: PeerMessage) => {
        onData(data, conn);
      });
      
      conn.on('close', () => {
        console.log('Connection closed');
        this.connections = this.connections.filter(c => c !== conn);
      });

      conn.on('error', (err: any) => {
          console.error('Connection error:', err);
      });
    });

    this.peer.on('error', (err: any) => {
      console.error('Host Peer Error:', err);
      if (err.type === 'unavailable-id') {
        // ID taken, retry
        console.log('ID taken, retrying...');
        if (retryCount < 5) {
            setTimeout(() => this.createHostPeer(onOpen, onData, retryCount + 1), 500);
        }
      } else if (err.type === 'peer-unavailable') {
         // Should not happen on host typically unless connecting to self?
      } else if (err.type === 'network') {
          alert("Lỗi mạng! Vui lòng kiểm tra kết nối Internet.");
      }
    });

    this.peer.on('disconnected', () => {
        console.log('Host disconnected from signaling server. Reconnecting...');
        // Try to reconnect to the server without destroying the peer
        if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
        }
    });
  }

  // Initialize as Player and connect to Host
  initPlayer(hostCode: string, onOpen: () => void, onData: (data: PeerMessage) => void, onError: (err: string) => void) {
    if (this.peer) {
        this.peer.destroy();
    }
    
    // Player doesn't need a specific ID
    try {
        this.peer = new Peer(undefined, PEER_CONFIG);
    } catch (e) {
        onError("Không thể khởi tạo kết nối.");
        return;
    }

    let connectionMade = false;

    this.peer.on('open', (id: string) => {
      this.myId = id;
      console.log('Player initialized with ID: ' + id);
      
      const hostId = `loto-${hostCode}`;
      console.log('Attempting to connect to Host:', hostId);
      
      const conn = this.peer.connect(hostId, {
          reliable: true
      });

      if (!conn) {
          onError("Không thể tạo kết nối tới Host.");
          return;
      }

      conn.on('open', () => {
        console.log('Connected to Host!');
        connectionMade = true;
        this.hostConnection = conn;
        onOpen();
      });

      conn.on('data', (data: PeerMessage) => {
        onData(data);
      });

      conn.on('error', (err: any) => {
        console.error('Connection level error:', err);
        if (!connectionMade) {
            onError('Lỗi kết nối tới chủ phòng.');
        }
      });

      conn.on('close', () => {
          console.log("Connection to host closed");
          if (connectionMade) {
              onError("Mất kết nối với chủ phòng.");
          }
      });
    });

    this.peer.on('error', (err: any) => {
       console.error('Player Peer Error', err);
       if (err.type === 'peer-unavailable') {
           onError(`Không tìm thấy phòng số "${hostCode}". Hãy kiểm tra lại mã phòng!`);
       } else {
           onError('Lỗi hệ thống: ' + err.type);
       }
    });
  }

  // Send data to Host (as Player)
  sendToHost(data: PeerMessage) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(data);
    } else {
        console.warn("Cannot send to host, connection not open");
    }
  }

  // Broadcast data to all Players (as Host)
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