import React, { useState, useEffect, useRef } from 'react';
import { GameRole, GameStatus, PeerMessage, CardPlayer, Card, ChatMessage } from '../types';
import { peerService } from '../services/peerService';
import { createDeck, shuffleDeck, calculateScore } from '../utils/cardLogic';
import PlayingCard from '../components/PlayingCard';
import ChatBox from '../components/ChatBox';

interface CardGameProps {
  initialRoomId?: string;
  onBackToMenu: () => void;
}

const CardGame: React.FC<CardGameProps> = ({ initialRoomId = '', onBackToMenu }) => {
  const [role, setRole] = useState<GameRole>(GameRole.NONE);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOBBY);
  
  // Host
  const [roomId, setRoomId] = useState<string>('');
  const [isAutoMode, setIsAutoMode] = useState(false);
  
  // Common
  const [myName, setMyName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState(initialRoomId);
  const [players, setPlayers] = useState<CardPlayer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  
  // Joining State
  const [isJoining, setIsJoining] = useState(false);

  // Refs
  const playersRef = useRef<CardPlayer[]>([]);
  const gameStatusRef = useRef<GameStatus>(GameStatus.LOBBY);
  const autoTimeoutRef = useRef<number | null>(null);
  const winnerIdRef = useRef<string | null>(null);

  // Localhost Detection
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
  useEffect(() => { winnerIdRef.current = winnerId; }, [winnerId]);
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

  // --- EXIT LOGIC ---
  const handleExit = () => {
      if (confirm('Bạn muốn thoát phòng?')) {
          try {
              peerService.destroy();
          } catch (e) {
              console.error(e);
          }
          setRole(GameRole.NONE);
          setPlayers([]);
          setMessages([]);
          setGameStatus(GameStatus.LOBBY);
          setWinnerId(null);
          setIsJoining(false);
      }
  };

  // --- HOST LOGIC ---
  const startHost = () => {
    if(!myName) return alert("Nhập tên Host!");
    setRole(GameRole.HOST);
    
    const hostPlayer: CardPlayer = { id: 'host', name: myName, isReady: true, hand: [], isRevealed: false };
    setPlayers([hostPlayer]);
    playersRef.current = [hostPlayer]; 

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
      const baseUrl = window.location.origin + window.location.pathname;
      const params = new URLSearchParams();
      params.set('game', 'card');
      params.set('room', roomId);
      
      const stored = localStorage.getItem('loto_turn_config');
      if (stored) {
          const c = JSON.parse(stored);
          if (c.turnUrl) params.set('t_url', c.turnUrl);
          if (c.turnUser) params.set('t_u', c.turnUser);
          if (c.turnPass) params.set('t_p', c.turnPass);
      }
      return `${baseUrl}?${params.toString()}`;
  };

  const handleShareLink = async () => {
      const shareUrl = getShareUrl();

      if (navigator.share) {
          try {
              await navigator.share({
                  title: 'Mời chơi Bài Cào!',
                  text: `Vào phòng ${roomId} chơi Bài Cào nhé!`,
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
        // Check Limit 20
        if (playersRef.current.length >= 20) {
            conn.send({ type: 'CHAT', message: { id: 'sys', sender: 'System', text: 'Phòng đã đầy (20/20)!', isSystem: true, timestamp: Date.now() } });
            // Optional: conn.close(); but PeerJS cleanup is tricky
            return;
        }

        const newPlayer: CardPlayer = { id: conn.peer, name: data.name, isReady: true, hand: [], isRevealed: false };
        
        setPlayers(prev => {
           // Prevent duplicates strictly
           if (prev.some(p => p.id === newPlayer.id)) return prev;
           return [...prev, newPlayer];
        });

        addMessage("Hệ thống", `${data.name} đã vào bàn!`, true);
        
        // Sync with new player
        setTimeout(() => {
            const currentList = playersRef.current.some(p => p.id === newPlayer.id) 
                ? playersRef.current 
                : [...playersRef.current, newPlayer];
            
            conn.send({ type: 'CARD_WELCOME', players: currentList, gameState: gameStatusRef.current });
            broadcastUpdate(currentList);
        }, 200);
        break;
      
      case 'CHAT':
        setMessages(prev => [...prev.slice(-49), data.message]);
        peerService.broadcast(data);
        break;
        
      case 'CARD_REVEAL':
        setPlayers(prev => {
            const updated = prev.map(p => {
                if(p.id === data.peerId) {
                    const { score, text } = calculateScore(data.hand);
                    return { ...p, hand: data.hand, isRevealed: true, score, scoreText: text };
                }
                return p;
            });
            
            setTimeout(() => {
                calculateLeader(updated, data.peerId);
                broadcastUpdate(updated);
            }, 0);
            return updated;
        });
        break;
    }
  };

  const broadcastUpdate = (currentPlayers: CardPlayer[], status?: GameStatus) => {
      const msg: any = { 
          type: 'CARD_WELCOME', 
          players: currentPlayers, 
          gameState: status || gameStatusRef.current 
      };
      peerService.broadcast(msg);
      
      if (winnerIdRef.current) {
          peerService.broadcast({ type: 'CARD_RESULT', winnerId: winnerIdRef.current });
      }
  };

  const handleDeal = () => {
     // Allow single player for testing
     if (players.length < 1) return alert("Cần ít nhất 1 người!"); 
     
     setGameStatus(GameStatus.PLAYING);
     setWinnerId(null);
     
     const deck = shuffleDeck(createDeck());
     
     // Deal 3 cards to each
     const hands: Record<string, Card[]> = {};
     const newPlayers = players.map(p => {
         // Check if deck has enough cards (52 cards max ~17 players properly, but we reuse deck logic if needed or wrap around)
         // Standard deck 52 cards. 20 players * 3 = 60 cards. We need 2 decks or refill.
         // Logic fix: if deck empty, refill.
         
         const cardsForPlayer = [];
         for(let i=0; i<3; i++) {
             if(deck.length === 0) {
                 const newDeck = shuffleDeck(createDeck());
                 deck.push(...newDeck);
             }
             cardsForPlayer.push(deck.pop()!);
         }
         
         const hand = cardsForPlayer.map(c => ({...c, isHidden: true}));
         hands[p.id] = hand;
         return { ...p, hand, isRevealed: false, score: undefined, scoreText: undefined };
     });
     
     setPlayers(newPlayers);
     
     // Send private hands
     newPlayers.forEach(p => {
         if (p.id !== 'host') {
             peerService.sendToPlayer(p.id, { type: 'CARD_DEAL', hands: { [p.id]: hands[p.id] } });
         }
     });

     peerService.broadcast({ type: 'START_GAME' });
     addMessage("Dealer", isAutoMode ? "Bot đã chia bài! Đang tự động lật..." : "Đã chia bài! Mời nặn bài.", true);

     if (isAutoMode) {
         if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
         autoTimeoutRef.current = setTimeout(() => {
             handleRevealAll(newPlayers);
         }, 3000);
     }
  };

  const handleRevealAll = (currentPlayers = players) => {
      const revealedPlayers = currentPlayers.map(p => {
           const fullHand = p.hand.map(c => ({...c, isHidden: false}));
           const { score, text } = calculateScore(fullHand);
           return { ...p, hand: fullHand, isRevealed: true, score, scoreText: text };
      });
      setPlayers(revealedPlayers);
      calculateLeader(revealedPlayers, 'ALL');
      broadcastUpdate(revealedPlayers);
      peerService.broadcast({ type: 'CARD_REVEAL_ALL' });
      
      if (isAutoMode) {
          if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
          autoTimeoutRef.current = setTimeout(() => {
              handleDeal();
          }, 5000);
      }
  };

  const calculateLeader = (currentPlayers: CardPlayer[], newlyRevealedId: string) => {
      const revealed = currentPlayers.filter(p => p.isRevealed && p.score !== undefined);
      if (revealed.length === 0) return;

      let maxScore = -1;
      let winners: CardPlayer[] = [];

      revealed.forEach(p => {
          const s = p.score ?? -1;
          if (s > maxScore) {
              maxScore = s;
              winners = [p];
          } else if (s === maxScore) {
              winners.push(p);
          }
      });

      if (winners.length > 0) {
          const newChampion = winners.find(w => w.id === newlyRevealedId);
          if (newChampion) {
               setWinnerId(newChampion.id);
               addMessage("Hệ thống", `🔥 ${newChampion.name} vừa lật bài: ${newChampion.scoreText}! (Dẫn đầu)`, true);
               peerService.broadcast({ type: 'CARD_RESULT', winnerId: newChampion.id });
          } else if (newlyRevealedId === 'ALL') {
               const w = winners[0];
               setWinnerId(w.id);
               addMessage("Hệ thống", `🏆 ${w.name} thắng với ${w.scoreText}!`, true);
               peerService.broadcast({ type: 'CARD_RESULT', winnerId: w.id });
          } else {
               const currentLeader = winners[0];
               if (currentLeader.id !== winnerIdRef.current) {
                   setWinnerId(currentLeader.id);
                   peerService.broadcast({ type: 'CARD_RESULT', winnerId: currentLeader.id });
               }
          }
      }
  };
  
  // --- PLAYER LOGIC ---
  const startPlayer = () => {
    // Smart Input Logic
    let finalRoomId = joinRoomId.trim();
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
        } catch (e) {}
    }

    if(!myName || !finalRoomId) return alert("Nhập đủ thông tin!");
    setIsJoining(true);
    
    peerService.initPlayer(
        finalRoomId,
        () => {
            setRole(GameRole.PLAYER);
            setIsJoining(false);
            peerService.sendToHost({ type: 'JOIN', name: myName });
        },
        (data) => handlePlayerData(data),
        (err) => { 
            alert(err); 
            setIsJoining(false);
            setRole(GameRole.NONE); 
        }
    );
  };

  const handlePlayerData = (data: PeerMessage) => {
      switch (data.type) {
          case 'CARD_WELCOME':
              setPlayers(prev => {
                  return data.players.map(serverP => {
                      const localP = prev.find(local => local.id === serverP.id);
                      if (serverP.id === peerService.myId && localP?.hand?.length && !serverP.isRevealed) {
                          return { ...serverP, hand: localP.hand }; 
                      }
                      return serverP;
                  });
              });
              setGameStatus(data.gameState);
              break;
          case 'START_GAME':
              setGameStatus(GameStatus.PLAYING);
              setWinnerId(null);
              break;
          case 'CARD_DEAL':
              const myHand = data.hands[peerService.myId].map(c => ({ ...c, isHidden: true }));
              setPlayers(prev => prev.map(p => p.id === peerService.myId ? { ...p, hand: myHand, isRevealed: false } : p));
              break;
          case 'CARD_RESULT':
              setWinnerId(data.winnerId);
              break;
          case 'CHAT':
               setMessages(prev => [...prev.slice(-49), data.message]);
               break;
      }
  };

  const handleSendMessage = (text: string) => {
      const msg = addMessage(myName, text);
      if (role === GameRole.HOST) {
          peerService.broadcast({ type: 'CHAT', message: msg });
      } else {
          peerService.sendToHost({ type: 'CHAT', message: msg });
      }
  };

  const handleCardClick = (playerIndex: number, cardIndex: number) => {
      const targetPlayer = players[playerIndex];
      const isMe = targetPlayer.id === (role === GameRole.HOST ? 'host' : peerService.myId);
      
      if (!isMe) return;
      if (targetPlayer.isRevealed) return;
      if (gameStatus !== GameStatus.PLAYING) return;

      const newHand = [...targetPlayer.hand];
      const clickedCard = newHand[cardIndex];
      if (!clickedCard.isHidden) return;

      newHand[cardIndex] = { ...clickedCard, isHidden: false };
      const allOpen = newHand.every(c => !c.isHidden);
      
      setPlayers(prev => {
          const newPlayers = [...prev];
          newPlayers[playerIndex] = { 
              ...targetPlayer, 
              hand: newHand,
              isRevealed: allOpen
          };
          
          if (role === GameRole.HOST && allOpen) {
              const { score, text } = calculateScore(newHand);
              newPlayers[playerIndex].score = score;
              newPlayers[playerIndex].scoreText = text;
              
              setTimeout(() => {
                  calculateLeader(newPlayers, 'host');
                  broadcastUpdate(newPlayers);
                  peerService.broadcast({ type: 'CARD_REVEAL', peerId: 'host', hand: newHand });
              }, 0);
          }
          return newPlayers;
      });

      if (role === GameRole.PLAYER && allOpen) {
          peerService.sendToHost({ type: 'CARD_REVEAL', peerId: peerService.myId, hand: newHand });
      }
  };

  // --- UI RENDER ---

  // LOBBY SETUP
  if (role === GameRole.NONE) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-green-900 text-white font-sans relative">
           <button onClick={onBackToMenu} className="absolute top-4 left-4 text-gray-300 hover:text-white font-bold flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full">
                <span>&larr;</span> Menu
           </button>
           <h1 className="text-6xl font-black text-yellow-400 mb-8 drop-shadow-md">BÀI CÀO</h1>
           
           <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
              {/* Host */}
              <div className="flex-1 bg-green-800 border-4 border-yellow-500 rounded-2xl p-6 shadow-xl flex flex-col items-center">
                 <h2 className="text-2xl font-bold mb-4">Tạo Bàn</h2>
                 <input 
                    className="w-full p-2 rounded text-black mb-2" 
                    placeholder="Tên của bạn (Chủ bàn)" 
                    value={myName} 
                    onChange={e => setMyName(e.target.value)}
                 />
                 <label className="flex items-center gap-2 mb-4 cursor-pointer select-none bg-green-900/50 p-2 rounded w-full justify-center hover:bg-green-900/80 transition-colors">
                    <input type="checkbox" checked={isAutoMode} onChange={e => setIsAutoMode(e.target.checked)} className="w-5 h-5 accent-yellow-500" />
                    <span>Bot tự chia & lật</span>
                 </label>
                 <button onClick={startHost} className="w-full bg-yellow-500 text-black font-bold py-3 rounded hover:bg-yellow-400">
                    Làm Cái
                 </button>
              </div>

              {/* Player */}
              <div className="flex-1 bg-green-800 border-4 border-white rounded-2xl p-6 shadow-xl flex flex-col items-center">
                 <h2 className="text-2xl font-bold mb-4">Vào Bàn</h2>
                 <input 
                    className="w-full p-2 rounded text-black mb-2" 
                    placeholder="Tên của bạn" 
                    value={myName} 
                    onChange={e => setMyName(e.target.value)}
                 />
                 <input 
                    className="w-full p-2 rounded text-black mb-4" 
                    placeholder="Mã Phòng (hoặc dán Link)" 
                    value={joinRoomId} 
                    onChange={e => setJoinRoomId(e.target.value)}
                 />
                 <button onClick={startPlayer} disabled={isJoining} className="w-full bg-white text-green-900 font-bold py-3 rounded hover:bg-gray-200 disabled:opacity-50">
                    {isJoining ? 'Đang kết nối...' : 'Tham Gia'}
                 </button>
                 <p className="mt-4 text-xs text-center text-gray-300 bg-black/20 p-2 rounded">
                    ⚠️ <b>Lưu ý:</b> Nếu bị lỗi "Đang kết nối", vui lòng dùng chung Wifi với chủ phòng hoặc tắt 4G.
                 </p>
              </div>
           </div>
        </div>
      );
  }

  // HOST LOBBY
  if (role === GameRole.HOST && gameStatus === GameStatus.LOBBY) {
      return (
         <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-green-900 text-white font-sans">
            <div className="bg-green-800 border-4 border-yellow-500 rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl relative">
                 <h2 className="text-3xl font-black text-yellow-400 mb-2">PHÒNG CHỜ</h2>
                 <p className="text-gray-300 mb-4">Quét QR hoặc nhập mã để vào</p>
                 
                 {/* QR Code */}
                 <div className="flex justify-center mb-4 relative">
                     <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getShareUrl())}`} 
                        alt="QR Code"
                        className={`border-4 border-white rounded-lg shadow-md ${isLocalhost ? 'opacity-25' : ''}`}
                     />
                     {isLocalhost && (
                        <div className="absolute inset-0 flex items-center justify-center">
                             <span className="text-4xl">⚠️</span>
                        </div>
                     )}
                 </div>

                 {isLocalhost && (
                    <div className="bg-red-500/20 border border-red-500 text-white p-2 rounded mb-4 text-xs font-bold text-left">
                        ⚠️ Lỗi 502/Connection: 
                        <br/>1. Đảm bảo game (npm run dev) đang chạy.
                        <br/>2. Dùng lệnh này thay cho Serveo:
                        <br/><code className="bg-black/50 px-1 border select-all cursor-pointer text-yellow-300 block mt-1 p-1 text-center">ssh -R 80:localhost:5173 nokey@localhost.run</code>
                    </div>
                )}

                 <div className="bg-green-900 p-4 rounded-xl mb-4 border border-green-700">
                     <span className="text-xs text-gray-400 uppercase font-bold">Mã Phòng</span>
                     <div className="text-5xl font-black text-white">{roomId}</div>
                 </div>

                 <button 
                    onClick={handleShareLink} 
                    className="mb-6 w-full py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 flex items-center justify-center gap-2 shadow-lg"
                 >
                    📤 Gửi Link Mời
                 </button>

                 <div className="mb-6 bg-black/20 p-4 rounded-xl">
                    <h3 className="text-left text-sm font-bold text-gray-400 uppercase mb-2">Người chơi ({players.length})</h3>
                    <div className="max-h-40 overflow-y-auto">
                        {players.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 py-1 border-b border-white/10 last:border-0">
                                <span className="text-xl">👤</span>
                                <span className="font-bold">{p.name} {p.id === 'host' && '(Host)'}</span>
                            </div>
                        ))}
                    </div>
                 </div>

                 <button onClick={handleDeal} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-blue-500 shadow-xl mb-3">
                    BẮT ĐẦU CHƠI
                 </button>

                 <button 
                    onClick={() => {
                        if(confirm("Hủy phòng?")) {
                            peerService.destroy();
                            setRole(GameRole.NONE);
                        }
                    }}
                    className="text-gray-400 hover:text-white text-sm"
                 >
                    Hủy phòng
                 </button>
            </div>
         </div>
      )
  }

  // PLAYING SCREEN - GRID LAYOUT
  const isHost = role === GameRole.HOST;

  return (
      <div className={`fixed inset-0 w-full h-[100dvh] bg-green-900 text-white grid ${isHost ? 'grid-rows-[auto_auto_1fr_auto]' : 'grid-rows-[auto_1fr_auto]'} overflow-hidden`}>
          
          {/* EMERGENCY EXIT BUTTON - Always Top Right z-60 */}
          <button 
              onClick={handleExit}
              className="fixed top-2 right-2 z-[60] bg-red-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xl border-2 border-white hover:bg-red-500"
              title="Force Exit"
          >
              ✕
          </button>

          {/* 1. HEADER (Row 1) */}
          <div className="bg-green-950 flex items-center justify-between px-3 h-14 shadow-md z-50 border-b border-green-800">
              <div className="flex items-center gap-3">
                 <button 
                    onClick={handleExit} 
                    className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold text-xs shadow border border-red-400"
                 >
                    THOÁT
                 </button>
                 <div className="flex flex-col">
                    <span className="font-bold text-yellow-400 text-sm leading-tight">Phòng: {roomId}</span>
                    <span className="text-[10px] text-gray-400 leading-tight">
                        {gameStatus === GameStatus.LOBBY ? 'Đang chờ...' : 'Đang chơi'} {isAutoMode && '(Bot)'}
                    </span>
                 </div>
              </div>
              <div className="text-sm font-bold bg-green-800/50 px-3 py-1 rounded-full mr-8">
                  👤 {players.length}/20
              </div>
          </div>

          {/* 2. HOST CONTROLS (Row 2 - ONLY FOR HOST) */}
          {isHost && (
              <div className="bg-black/20 py-2 flex justify-center gap-3 z-40 backdrop-blur-sm border-b border-white/5">
                  <button 
                    onClick={handleDeal} 
                    disabled={isAutoMode && gameStatus === GameStatus.PLAYING}
                    className={`
                        h-9 px-6 rounded-full font-bold text-sm shadow-lg transition-transform active:scale-95 flex items-center gap-2
                        ${(isAutoMode && gameStatus === GameStatus.PLAYING) 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                            : 'bg-yellow-500 text-black hover:bg-yellow-400 border-2 border-yellow-300'
                        }
                    `}
                  >
                    <span>🎰</span> {gameStatus === GameStatus.LOBBY ? 'BẮT ĐẦU' : 'VÁN MỚI'}
                  </button>
                  
                  {!isAutoMode && (
                    <button 
                            onClick={() => handleRevealAll()}
                            className="h-9 bg-blue-600 px-4 rounded-full font-bold text-sm hover:bg-blue-500 shadow-lg border-2 border-blue-400"
                    >
                            👀 LẬT HẾT
                    </button>
                  )}
              </div>
          )}

          {/* 3. GAME TABLE (Next Row - Expands) */}
          <div className="relative overflow-y-auto bg-green-900/50 scrollbar-thin p-4">
               <div className="flex flex-wrap justify-center gap-4 sm:gap-6 pb-4 min-h-full content-center">
                     {/* Background Icon */}
                     <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none z-0">
                         <span className="text-9xl">♣️</span>
                     </div>

                     {/* Players */}
                     {players.map((p, pIdx) => {
                         const isMe = p.id === (role === GameRole.HOST ? 'host' : peerService.myId);
                         const isWinner = p.id === winnerId;
                         
                         return (
                             <div key={p.id} className={`
                                relative bg-green-800/90 backdrop-blur-md p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all duration-300 z-10
                                ${isWinner ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-105 ring-2 ring-yellow-500' : 'border-white/20'}
                                min-w-[140px] sm:min-w-[160px]
                             `}>
                                {isWinner && (
                                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-full z-30 animate-bounce whitespace-nowrap shadow-md">
                                        👑 THẮNG
                                    </div>
                                )}
                                
                                {/* Cards */}
                                <div className="flex justify-center h-16 sm:h-20 perspective-1000 -space-x-2">
                                     {p.hand.length === 0 ? (
                                         [1,2,3].map(i => <div key={i} className="w-10 h-16 sm:w-14 sm:h-20 bg-green-950/40 border border-white/10 rounded-lg mx-0.5"></div>)
                                     ) : (
                                         p.hand.map((card, cIdx) => (
                                             <div key={cIdx} className="mx-0.5 transform transition-transform hover:-translate-y-2">
                                                 <PlayingCard 
                                                    card={card} 
                                                    revealed={!card.isHidden}
                                                    onClick={() => handleCardClick(pIdx, cIdx)}
                                                 />
                                             </div>
                                         ))
                                     )}
                                </div>

                                {/* Info */}
                                <div className="text-center w-full mt-1">
                                    <div className={`font-bold text-xs truncate max-w-[120px] mx-auto ${isMe ? 'text-yellow-300' : 'text-white'}`}>
                                        {p.name} {isMe && '(Tôi)'}
                                    </div>
                                    
                                    <div className="h-5 flex items-center justify-center">
                                        {p.isRevealed ? (
                                            <span className="text-yellow-400 font-black text-sm drop-shadow-md animate-pulse">{p.scoreText}</span>
                                        ) : (
                                            <span className="text-gray-400 text-[10px] italic">
                                                {gameStatus === GameStatus.PLAYING 
                                                    ? (isMe ? '👇 Bấm bài!' : 'Đang nặn...') 
                                                    : '...'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                             </div>
                         )
                     })}
                 </div>
          </div>

          {/* 4. CHAT BOX (Last Row - Fixed) */}
          <div className="h-48 z-30 bg-white border-t-4 border-green-800 shrink-0">
             <ChatBox messages={messages} onSendMessage={handleSendMessage} senderName={myName} />
          </div>
      </div>
  );
};

export default CardGame;