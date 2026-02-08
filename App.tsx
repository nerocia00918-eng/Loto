import React, { useState, useEffect } from 'react';
import { GameRole, ChatMessage, GameStatus, PlayerInfo, PeerMessage, ClaimData } from './types';
import HostView from './views/HostView';
import PlayerView from './views/PlayerView';
import WinnerOverlay from './components/WinnerOverlay';
import { peerService } from './services/peerService';

// Background pattern SVG
const BgPattern = () => (
  <div className="fixed inset-0 z-[-1] opacity-10 pointer-events-none">
     <svg width="100%" height="100%">
        <pattern id="pattern-circles" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="2" className="text-loto-red fill-current" />
        </pattern>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-circles)" />
     </svg>
  </div>
);

const App: React.FC = () => {
  const [role, setRole] = useState<GameRole>(GameRole.NONE);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOBBY);
  
  // Host Specific
  const [roomId, setRoomId] = useState<string>('');
  const [connectedPlayers, setConnectedPlayers] = useState<PlayerInfo[]>([]);
  const [pendingClaim, setPendingClaim] = useState<ClaimData | null>(null);

  // Player Specific
  const [joinRoomId, setJoinRoomId] = useState('');
  const [myPlayerName, setMyPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [claimRejectionCount, setClaimRejectionCount] = useState(0); // Counter to trigger effects

  // Common State
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [winnerName, setWinnerName] = useState<string | null>(null);

  const addMessage = (sender: string, text: string, isSystem = false) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString() + Math.random(),
      sender,
      text,
      isSystem,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev.slice(-49), newMessage]);
    return newMessage;
  };

  // --- HOST LOGIC ---
  const startHost = () => {
    setRole(GameRole.HOST);
    peerService.initHost(
      (id) => {
        setRoomId(id);
        setGameStatus(GameStatus.LOBBY);
      },
      (data, conn) => {
        handleHostData(data, conn);
      }
    );
  };

  const handleHostData = (data: PeerMessage, conn: any) => {
    switch (data.type) {
      case 'JOIN':
        const newPlayer: PlayerInfo = { id: conn.peer, name: data.name, isReady: true };
        setConnectedPlayers(prev => {
           const exists = prev.find(p => p.id === newPlayer.id);
           if (exists) return prev;
           return [...prev, newPlayer];
        });
        addMessage("Hệ thống", `${data.name} đã vào phòng!`, true);
        
        // Send welcome back to player
        conn.send({ 
          type: 'WELCOME', 
          gameState: gameStatus, 
          calledNumbers: calledNumbers 
        });
        break;
      case 'CHAT':
        setMessages(prev => [...prev.slice(-49), data.message]);
        peerService.broadcast(data); // Relay to others
        break;
      case 'CLAIM_WIN':
        // Player claims win, Host needs to verify
        setPendingClaim(data.claim);
        addMessage("Hệ thống", `🔔 ${data.claim.playerName} ĐANG KINH! CHỜ KIỂM TRA...`, true);
        peerService.broadcast({ type: 'CHAT', message: {
             id: Date.now().toString(), sender: 'Hệ thống', text: `🔔 ${data.claim.playerName} đang Kinh! Host đang kiểm tra vé...`, isSystem: true, timestamp: Date.now()
        }});
        break;
    }
  };

  const handleStartGameHost = () => {
    setGameStatus(GameStatus.PLAYING);
    addMessage("Hệ thống", "🔔 Host đã bắt đầu ván chơi!", true);
    const msg: PeerMessage = { type: 'START_GAME' };
    peerService.broadcast(msg);
  };

  const handleHostDrawNumber = (num: number) => {
    setCurrentNumber(num);
    setCalledNumbers(prev => [num, ...prev]);
    
    // Broadcast to players
    const msg: PeerMessage = { type: 'NUMBER_DRAWN', number: num };
    peerService.broadcast(msg);
  };

  const handleHostSendMessage = (text: string) => {
    const msg = addMessage("Host (Cái)", text);
    peerService.broadcast({ type: 'CHAT', message: msg });
  };

  const handleHostReset = () => {
    if(confirm("Làm mới ván chơi?")) {
        setCalledNumbers([]);
        setCurrentNumber(null);
        setMessages([]);
        setWinnerName(null);
        setPendingClaim(null);
        setGameStatus(GameStatus.PLAYING); 
        addMessage("System", "🔔 Ván chơi mới đã bắt đầu!", true);
        peerService.broadcast({ type: 'RESET' });
    }
  };

  const resolveClaim = (valid: boolean) => {
    if (!pendingClaim) return;
    
    if (valid) {
        handleWin(pendingClaim.playerName);
    } else {
        // Resume
        handleHostSendMessage(`Vé của ${pendingClaim.playerName} chưa hợp lệ. Tiếp tục chơi nhé!`);
        
        // Find player peer ID to send rejection
        const player = connectedPlayers.find(p => p.name === pendingClaim.playerName);
        if (player) {
            peerService.sendToPlayer(player.id, { type: 'CLAIM_REJECTED' });
        }
    }
    setPendingClaim(null);
  };

  // --- PLAYER LOGIC ---
  const startPlayer = () => {
    if (!myPlayerName.trim() || !joinRoomId.trim()) return alert("Nhập tên và mã phòng!");
    setIsJoining(true);

    peerService.initPlayer(
      joinRoomId.trim(),
      () => {
        // On Open
        setRole(GameRole.PLAYER);
        setIsJoining(false);
        peerService.sendToHost({ type: 'JOIN', name: myPlayerName });
      },
      (data) => {
        handlePlayerData(data);
      },
      (err) => {
        setIsJoining(false);
        alert(err);
      }
    );
  };

  const handlePlayerData = (data: PeerMessage) => {
    switch (data.type) {
      case 'WELCOME':
        setGameStatus(data.gameState); // Likely LOBBY or PLAYING
        setCalledNumbers(data.calledNumbers);
        break;
      case 'START_GAME':
        setGameStatus(GameStatus.PLAYING);
        addMessage("Hệ thống", "Ván chơi bắt đầu! Chúc may mắn!", true);
        break;
      case 'NUMBER_DRAWN':
        setCurrentNumber(data.number);
        setCalledNumbers(prev => [data.number, ...prev]);
        break;
      case 'CHAT':
        setMessages(prev => [...prev.slice(-49), data.message]);
        break;
      case 'WIN':
        setWinnerName(data.winnerName);
        addMessage("Hệ thống", `🏆 ${data.winnerName} ĐÃ CHIẾN THẮNG! 🏆`, true);
        break;
      case 'CLAIM_REJECTED':
        setClaimRejectionCount(prev => prev + 1);
        addMessage("Hệ thống", "⚠️ Host xác nhận vé chưa Kinh. Bạn có thể tiếp tục!", true);
        break;
      case 'RESET':
        setCalledNumbers([]);
        setCurrentNumber(null);
        setMessages([]);
        setWinnerName(null);
        addMessage("System", "🔔 Ván chơi mới đã bắt đầu!", true);
        break;
    }
  };

  const handlePlayerSendMessage = (text: string) => {
    // Optimistic update
    const msg = addMessage(myPlayerName, text);
    // Send to host (Host will broadcast)
    peerService.sendToHost({ type: 'CHAT', message: msg });
  };

  const handlePlayerClaim = (claim: ClaimData) => {
     // Send claim to host
     peerService.sendToHost({ type: 'CLAIM_WIN', claim: claim });
  };

  const handleWin = (name: string) => {
      setWinnerName(name);
      addMessage("Hệ thống", `🏆 CHÚC MỪNG ${name} ĐÃ CHIẾN THẮNG! 🏆`, true);
      // If host called this locally (for themselves), or confirmed a player claim
      peerService.broadcast({ type: 'WIN', winnerName: name });
  }

  // --- RENDER ---

  // Join Screen
  if (role === GameRole.NONE) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-loto-cream font-sans relative overflow-hidden">
            <BgPattern />
            <h1 className="text-6xl md:text-8xl font-hand font-bold text-loto-red mb-4 drop-shadow-md animate-bounce-short">
              LÔ TÔ VUI
            </h1>
            <p className="text-gray-600 text-xl mb-12 max-w-lg">
              Game dân gian Việt Nam. Chơi cùng bạn bè online!
            </p>

            <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl items-stretch">
              
              {/* Host Card */}
              <div className="flex-1 bg-white border-4 border-loto-red rounded-3xl p-6 shadow-xl flex flex-col items-center hover:scale-105 transition-transform">
                 <div className="text-5xl mb-4">🎤</div>
                 <h2 className="text-2xl font-bold mb-2 text-loto-red">Tạo Phòng</h2>
                 <p className="text-gray-500 text-sm mb-6 flex-1">Làm "Cái", bốc số và điều khiển ván chơi.</p>
                 <button
                    onClick={startHost}
                    className="w-full bg-loto-red text-white py-3 rounded-xl font-bold hover:bg-red-700"
                 >
                    Làm Host
                 </button>
              </div>

              {/* Player Card */}
              <div className="flex-1 bg-white border-4 border-loto-yellow rounded-3xl p-6 shadow-xl flex flex-col items-center hover:scale-105 transition-transform">
                 <div className="text-5xl mb-4">🎫</div>
                 <h2 className="text-2xl font-bold mb-2 text-yellow-600">Vào Phòng</h2>
                 <p className="text-gray-500 text-sm mb-4">Nhập mã phòng từ bạn bè để tham gia.</p>
                 
                 <div className="w-full space-y-3">
                    <input 
                        type="text" 
                        placeholder="Tên của bạn" 
                        value={myPlayerName}
                        onChange={e => setMyPlayerName(e.target.value)}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-loto-yellow outline-none"
                    />
                    <input 
                        type="number" 
                        placeholder="Mã Phòng (VD: 1234)" 
                        value={joinRoomId}
                        onChange={e => setJoinRoomId(e.target.value)}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-loto-yellow outline-none"
                    />
                     <button
                        onClick={startPlayer}
                        disabled={isJoining}
                        className="w-full bg-loto-yellow text-red-900 py-3 rounded-xl font-bold hover:bg-yellow-400 disabled:opacity-50"
                     >
                        {isJoining ? 'Đang kết nối...' : 'Tham Gia'}
                     </button>
                 </div>
              </div>
            </div>
             <div className="mt-16 text-gray-400 text-xs">
                Sử dụng PeerJS để kết nối P2P.
            </div>
        </div>
    );
  }

  // Content Switching
  return (
    <div className="min-h-screen bg-loto-cream text-gray-800 overflow-hidden font-sans">
      <BgPattern />
      
      {role === GameRole.HOST && (
        <HostView 
          onBack={() => {
              if(confirm("Rời phòng sẽ ngắt kết nối mọi người?")) {
                  peerService.destroy();
                  setRole(GameRole.NONE);
              }
          }} 
          calledNumbers={calledNumbers}
          currentNumber={currentNumber}
          onDrawNumber={handleHostDrawNumber}
          messages={messages}
          onSendMessage={handleHostSendMessage}
          onReset={handleHostReset}
          roomId={roomId}
          gameStatus={gameStatus}
          connectedPlayers={connectedPlayers}
          onStartGame={handleStartGameHost}
          onWin={(name) => handleWin(name)}
          pendingClaim={pendingClaim}
          onResolveClaim={resolveClaim}
        />
      )}

      {role === GameRole.PLAYER && (
        <PlayerView 
          playerName={myPlayerName}
          onBack={() => {
              if(confirm("Thoát phòng?")) {
                  peerService.destroy();
                  setRole(GameRole.NONE);
              }
          }}
          calledNumbers={calledNumbers}
          currentNumber={currentNumber}
          messages={messages}
          onSendMessage={handlePlayerSendMessage}
          onClaimWin={handlePlayerClaim}
          gameStatus={gameStatus}
          claimRejectionCount={claimRejectionCount}
        />
      )}
      
      {/* Global Winner Overlay */}
      {winnerName && (
        <WinnerOverlay winnerName={winnerName} onClose={() => setWinnerName(null)} />
      )}
    </div>
  );
};

export default App;