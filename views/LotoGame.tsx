import React, { useState, useEffect } from 'react';
import { GameRole, ChatMessage, GameStatus, PlayerInfo, PeerMessage, ClaimData } from '../types';
import HostView from './HostView';
import PlayerView from './PlayerView';
import WinnerOverlay from '../components/WinnerOverlay';
import { peerService } from '../services/peerService';

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

interface LotoGameProps {
    initialRoomId?: string;
    onBackToMenu: () => void;
}

const LotoGame: React.FC<LotoGameProps> = ({ initialRoomId = '', onBackToMenu }) => {
  const [role, setRole] = useState<GameRole>(GameRole.NONE);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOBBY);
  
  // Host Specific
  const [roomId, setRoomId] = useState<string>('');
  const [connectedPlayers, setConnectedPlayers] = useState<PlayerInfo[]>([]);
  const [pendingClaim, setPendingClaim] = useState<ClaimData | null>(null);
  const [lanIp, setLanIp] = useState(''); // New state for LAN IP input

  // Player Specific
  const [joinRoomId, setJoinRoomId] = useState(initialRoomId);
  const [myPlayerName, setMyPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [claimRejectionCount, setClaimRejectionCount] = useState(0);

  // Common State
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [winnerName, setWinnerName] = useState<string | null>(null);

  // Localhost Detection
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  useEffect(() => {
     if (initialRoomId) setJoinRoomId(initialRoomId);
  }, [initialRoomId]);

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

  const getShareUrl = () => {
      // Determine base URL: Use LAN IP if provided, otherwise window.origin
      let baseUrl = window.location.origin;
      if (lanIp && lanIp.includes('.')) {
          baseUrl = `http://${lanIp}:5173`;
      }
      
      const fullUrl = baseUrl + window.location.pathname;
      const params = new URLSearchParams();
      params.set('game', 'loto');
      params.set('room', roomId);
      
      const stored = localStorage.getItem('loto_turn_config');
      if (stored) {
          const c = JSON.parse(stored);
          if (c.turnUrl) params.set('t_url', c.turnUrl);
          if (c.turnUser) params.set('t_u', c.turnUser);
          if (c.turnPass) params.set('t_p', c.turnPass);
      }
      return `${fullUrl}?${params.toString()}`;
  };

  const handleShareLink = async () => {
      const shareUrl = getShareUrl();
      if (navigator.share) {
          try {
              await navigator.share({
                  title: 'Mời chơi Lô tô!',
                  text: `Vào phòng ${roomId} chơi Lô tô với tớ nhé!`,
                  url: shareUrl
              });
          } catch (e) { console.log(e); }
      } else {
          navigator.clipboard.writeText(shareUrl);
          alert("Đã copy link mời! Gửi cho bạn bè nhé.");
      }
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
        conn.send({ type: 'WELCOME', gameState: gameStatus, calledNumbers: calledNumbers });
        break;
      case 'CHAT':
        setMessages(prev => [...prev.slice(-49), data.message]);
        peerService.broadcast(data); 
        break;
      case 'CLAIM_WIN':
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
        handleHostSendMessage(`Vé của ${pendingClaim.playerName} chưa hợp lệ. Tiếp tục chơi nhé!`);
        const player = connectedPlayers.find(p => p.name === pendingClaim.playerName);
        if (player) {
            peerService.sendToPlayer(player.id, { type: 'CLAIM_REJECTED' });
        }
    }
    setPendingClaim(null);
  };

  // --- PLAYER LOGIC ---
  const startPlayer = () => {
    let finalRoomId = joinRoomId.trim();
    
    // Smart Link Handling: Check if it's a full URL
    if (finalRoomId.includes('http')) {
        try {
            const url = new URL(finalRoomId);
            const r = url.searchParams.get('room');
            if (r) {
                finalRoomId = r;
                const pTUrl = url.searchParams.get('t_url');
                const pTUser = url.searchParams.get('t_u');
                const pTPass = url.searchParams.get('t_p');
                if (pTUrl && pTUser && pTPass) {
                     const newConfig = { turnUrl: pTUrl, turnUser: pTUser, turnPass: pTPass };
                     localStorage.setItem('loto_turn_config', JSON.stringify(newConfig));
                }
            }
        } catch (e) {
            console.error("Invalid link pasted");
        }
    }

    if (!myPlayerName.trim() || !finalRoomId) return alert("Nhập tên và mã phòng!");
    
    peerService.destroy();
    setIsJoining(true);

    peerService.initPlayer(
      finalRoomId,
      () => {
        setRole(GameRole.PLAYER);
        setIsJoining(false);
        peerService.sendToHost({ type: 'JOIN', name: myPlayerName });
      },
      (data) => handlePlayerData(data),
      (err) => {
        setIsJoining(false);
        alert(err);
      }
    );
  };

  const handlePlayerData = (data: PeerMessage) => {
    switch (data.type) {
      case 'WELCOME':
        setGameStatus(data.gameState);
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
    const msg = addMessage(myPlayerName, text);
    peerService.sendToHost({ type: 'CHAT', message: msg });
  };

  const handlePlayerClaim = (claim: ClaimData) => {
     peerService.sendToHost({ type: 'CLAIM_WIN', claim: claim });
  };

  const handleWin = (name: string) => {
      setWinnerName(name);
      addMessage("Hệ thống", `🏆 CHÚC MỪNG ${name} ĐÃ CHIẾN THẮNG! 🏆`, true);
      peerService.broadcast({ type: 'WIN', winnerName: name });
  }

  // --- RENDER ---
  if (role === GameRole.NONE) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-loto-cream font-sans relative overflow-hidden">
            <BgPattern />
            
            <button onClick={onBackToMenu} className="absolute top-4 left-4 text-gray-500 hover:text-red-500 font-bold z-50">
               &larr; Menu
            </button>
            <h1 className="text-6xl md:text-8xl font-hand font-bold text-loto-red mb-4 drop-shadow-md">
              LÔ TÔ
            </h1>

            <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl items-stretch">
              <div className="flex-1 bg-white border-4 border-loto-red rounded-3xl p-6 shadow-xl flex flex-col items-center">
                 <div className="text-5xl mb-4">🎱</div>
                 <h2 className="text-2xl font-bold mb-2 text-loto-red">Tạo Phòng</h2>
                 <p className="text-gray-500 text-sm mb-6 flex-1">Làm "Cái", bốc số.</p>
                 <button onClick={startHost} className="w-full bg-loto-red text-white py-3 rounded-xl font-bold hover:bg-red-700">
                    Làm Host
                 </button>
              </div>

              <div className="flex-1 bg-white border-4 border-loto-yellow rounded-3xl p-6 shadow-xl flex flex-col items-center">
                 <div className="text-5xl mb-4">🎫</div>
                 <h2 className="text-2xl font-bold mb-2 text-yellow-600">Vào Phòng</h2>
                 <p className="text-gray-500 text-sm mb-4">Nhập mã hoặc dán Link mời.</p>
                 <div className="w-full space-y-3">
                    <input 
                        type="text" placeholder="Tên của bạn" value={myPlayerName}
                        onChange={e => setMyPlayerName(e.target.value)}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-loto-yellow outline-none"
                    />
                    <input 
                        type="text" placeholder="Mã Phòng (hoặc dán Link)" value={joinRoomId}
                        onChange={e => setJoinRoomId(e.target.value)}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-loto-yellow outline-none"
                    />
                     <button onClick={startPlayer} disabled={isJoining} className="w-full bg-loto-yellow text-red-900 py-3 rounded-xl font-bold hover:bg-yellow-400 disabled:opacity-50">
                        {isJoining ? 'Đang kết nối...' : 'Tham Gia'}
                     </button>
                 </div>
              </div>
            </div>
        </div>
    );
  }

  // --- LOBBY (HOST) ---
  if (role === GameRole.HOST && gameStatus === GameStatus.LOBBY) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-loto-cream font-sans">
         <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full border-4 border-loto-red text-center relative">
            <h1 className="text-3xl font-hand font-bold text-loto-red mb-2">Phòng Chờ</h1>
            <p className="text-gray-500 mb-2 text-sm">Quét mã để vào ngay</p>
            
            {/* LAN IP Input */}
            {isLocalhost && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800 font-bold mb-1 text-left">
                        ℹ️ Để điện thoại vào được (cùng Wifi):
                    </p>
                    <div className="text-xs text-gray-600 text-left mb-2">
                        1. Xem cửa sổ đen (Terminal) dòng <span className="font-mono bg-gray-200 px-1">Network: http://xxx...</span>
                        <br/>2. Nhập số đó vào dưới đây để tạo QR đúng:
                    </div>
                    <input 
                        type="text" 
                        placeholder="VD: 192.168.1.15" 
                        className="w-full border border-blue-300 rounded px-2 py-1 text-center font-bold text-blue-900"
                        value={lanIp}
                        onChange={(e) => setLanIp(e.target.value)}
                    />
                </div>
            )}

            {/* QR CODE */}
            <div className="flex justify-center mb-4 relative">
                 <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getShareUrl())}`} 
                    alt="QR Code Invite"
                    className="border-2 border-gray-200 rounded-lg shadow-sm"
                 />
                 {isLocalhost && !lanIp && (
                     <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
                         <span className="text-sm font-bold text-red-600 bg-white px-2 py-1 border border-red-200 shadow-sm rounded">Nhập IP Wifi ở trên ☝️</span>
                     </div>
                 )}
            </div>

            <div className="bg-gray-100 p-4 rounded-xl mb-4 flex flex-col gap-1">
                <span className="text-xs text-gray-500 uppercase tracking-widest">Mã Phòng</span>
                <span className="text-5xl font-black text-blue-600 tracking-wider">{roomId || '...'}</span>
            </div>

            <button 
                onClick={handleShareLink} 
                className="mb-6 w-full py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2"
            >
                📤 Gửi Link (Zalo/Messenger)
            </button>

            <div className="mb-6">
                <h3 className="text-left text-sm font-bold text-gray-400 uppercase mb-2">Người chơi ({connectedPlayers.length})</h3>
                <div className="bg-gray-50 rounded-xl p-2 max-h-40 overflow-y-auto border border-gray-200">
                    {connectedPlayers.length === 0 ? (
                        <p className="text-gray-400 italic text-sm py-4">Chờ người quét mã hoặc nhập ID...</p>
                    ) : (
                        connectedPlayers.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 border-b last:border-0">
                                <div className="w-8 h-8 rounded-full bg-loto-yellow text-white flex items-center justify-center font-bold">
                                    {p.name.charAt(0)}
                                </div>
                                <span className="font-medium text-gray-700">{p.name}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <button 
                onClick={handleStartGameHost}
                disabled={connectedPlayers.length === 0}
                className="w-full bg-loto-red text-white py-4 rounded-xl font-bold text-xl shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                BẮT ĐẦU CHƠI
            </button>
            
            <button 
                onClick={() => {
                     if(confirm("Hủy phòng?")) {
                         peerService.destroy();
                         setRole(GameRole.NONE);
                     }
                }} 
                className="mt-4 text-gray-400 hover:text-red-500 text-sm"
            >
                Hủy phòng
            </button>
         </div>
      </div>
    );
  }

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
      
      {winnerName && (
        <WinnerOverlay winnerName={winnerName} onClose={() => setWinnerName(null)} />
      )}
    </div>
  );
};

export default LotoGame;