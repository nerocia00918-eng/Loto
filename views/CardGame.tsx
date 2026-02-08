import React, { useState, useEffect, useRef } from 'react';
import { GameRole, GameStatus, PlayerInfo, PeerMessage, CardPlayer, Card, ChatMessage } from '../types';
import { peerService } from '../services/peerService';
import { createDeck, shuffleDeck, calculateScore } from '../utils/cardLogic';
import PlayingCard from '../components/PlayingCard';
import ChatBox from '../components/ChatBox';

interface CardGameProps {
  onBackToMenu: () => void;
}

const CardGame: React.FC<CardGameProps> = ({ onBackToMenu }) => {
  const [role, setRole] = useState<GameRole>(GameRole.NONE);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOBBY);
  
  // Host
  const [roomId, setRoomId] = useState<string>('');
  const [isAutoMode, setIsAutoMode] = useState(false);
  
  // Common
  const [myName, setMyName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [players, setPlayers] = useState<CardPlayer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  // Auto Bot Refs
  const autoTimeoutRef = useRef<number | null>(null);

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
    if(!myName) return alert("Nhập tên Host!");
    setRole(GameRole.HOST);
    // Add host as first player
    const hostPlayer: CardPlayer = { id: 'host', name: myName, isReady: true, hand: [], isRevealed: false };
    setPlayers([hostPlayer]);
    
    peerService.initHost(
      (id) => {
        setRoomId(id);
        setGameStatus(GameStatus.LOBBY);
        // Important: Update host peerId in service for consistency if needed, but 'host' id is local
      },
      (data, conn) => {
         handleHostData(data, conn);
      }
    );
  };

  const handleHostData = (data: PeerMessage, conn: any) => {
    switch (data.type) {
      case 'JOIN':
        const newPlayer: CardPlayer = { id: conn.peer, name: data.name, isReady: true, hand: [], isRevealed: false };
        setPlayers(prev => {
           if (prev.find(p => p.id === newPlayer.id)) return prev;
           const updated = [...prev, newPlayer];
           // Broadcast updated list to everyone
           broadcastUpdate(updated);
           return updated;
        });
        addMessage("Hệ thống", `${data.name} đã vào bàn!`, true);
        
        conn.send({ type: 'CARD_WELCOME', players: players, gameState: gameStatus }); // Send current state
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
            broadcastUpdate(updated);
            checkAllRevealed(updated);
            return updated;
        });
        break;
    }
  };

  const broadcastUpdate = (currentPlayers: CardPlayer[], status?: GameStatus) => {
      // Filter out private card data for other players? 
      // For simplicity in this demo, we send hidden:true for others, but let's just trust clients or mask data.
      // Ideally: Send sanitized data.
      // Here we broadcast everything but clients render Card back if not theirs. 
      // Wait, 'hand' in CardPlayer is full data. We should mask it before broadcast if we want security.
      // But for "Friend Mode", full trust is okay-ish. Let's stick to simple broadcast.
      
      const msg: any = { 
          type: 'CARD_WELCOME', 
          players: currentPlayers, 
          gameState: status || gameStatus 
      };
      peerService.broadcast(msg);
  };

  const handleDeal = () => {
     if (players.length < 2) return alert("Cần ít nhất 2 người!");
     setGameStatus(GameStatus.PLAYING);
     setWinnerId(null);
     
     const deck = shuffleDeck(createDeck());
     
     // Deal 3 cards to each
     const hands: Record<string, Card[]> = {};
     const newPlayers = players.map(p => {
         const hand = [deck.pop()!, deck.pop()!, deck.pop()!];
         hands[p.id] = hand;
         return { ...p, hand, isRevealed: false, score: undefined, scoreText: undefined };
     });
     
     setPlayers(newPlayers);
     
     // Send private hands to peers
     newPlayers.forEach(p => {
         if (p.id !== 'host') {
             peerService.sendToPlayer(p.id, { type: 'CARD_DEAL', hands: { [p.id]: hands[p.id] } });
         }
     });

     // Broadcast public state (masked hands logically)
     peerService.broadcast({ type: 'START_GAME' });
     addMessage("Dealer", "Đã chia bài! Mở bài đi nào.", true);

     if (isAutoMode) {
         // Auto reveal after 5 seconds
         autoTimeoutRef.current = setTimeout(() => {
             handleRevealAll(newPlayers);
         }, 5000);
     }
  };

  const handleRevealAll = (currentPlayers = players) => {
      const revealedPlayers = currentPlayers.map(p => {
           const { score, text } = calculateScore(p.hand);
           return { ...p, isRevealed: true, score, scoreText: text };
      });
      setPlayers(revealedPlayers);
      broadcastUpdate(revealedPlayers);
      peerService.broadcast({ type: 'CARD_REVEAL_ALL' });
      determineWinner(revealedPlayers);
  };

  const determineWinner = (currentPlayers: CardPlayer[]) => {
      let maxScore = -1;
      let winners: CardPlayer[] = [];

      currentPlayers.forEach(p => {
          const s = p.score ?? 0;
          if (s > maxScore) {
              maxScore = s;
              winners = [p];
          } else if (s === maxScore) {
              winners.push(p);
          }
      });

      if (winners.length > 0) {
          // If tie, first one (simple rule) or both. Let's pick first.
          const w = winners[0];
          setWinnerId(w.id);
          addMessage("Hệ thống", `🏆 ${w.name} thắng với ${w.scoreText}!`, true);
          peerService.broadcast({ type: 'CARD_RESULT', winnerId: w.id });
      }

      if (isAutoMode) {
          autoTimeoutRef.current = setTimeout(() => {
              handleDeal(); // Next round
          }, 4000);
      }
  };

  const checkAllRevealed = (currentPlayers: CardPlayer[]) => {
      if (currentPlayers.every(p => p.isRevealed)) {
          determineWinner(currentPlayers);
      }
  };
  
  const handleHostRevealSelf = () => {
      // Reveal host hand
      setPlayers(prev => {
          const updated = prev.map(p => {
              if (p.id === 'host') {
                  const { score, text } = calculateScore(p.hand);
                  return { ...p, isRevealed: true, score, scoreText: text };
              }
              return p;
          });
          broadcastUpdate(updated);
          checkAllRevealed(updated);
          return updated;
      });
  };

  // --- PLAYER LOGIC ---
  const startPlayer = () => {
    if(!myName || !joinRoomId) return alert("Nhập đủ thông tin!");
    setRole(GameRole.PLAYER);
    
    peerService.initPlayer(
        joinRoomId.trim(),
        () => {
            peerService.sendToHost({ type: 'JOIN', name: myName });
        },
        (data) => handlePlayerData(data),
        (err) => { alert(err); setRole(GameRole.NONE); }
    );
  };

  const handlePlayerData = (data: PeerMessage) => {
      switch (data.type) {
          case 'CARD_WELCOME':
              setPlayers(data.players);
              setGameStatus(data.gameState);
              break;
          case 'START_GAME':
              setGameStatus(GameStatus.PLAYING);
              setWinnerId(null);
              break;
          case 'CARD_DEAL':
              // My private hand
              const myHand = data.hands[peerService.myId];
              if (myHand) {
                  setPlayers(prev => prev.map(p => p.id === peerService.myId ? { ...p, hand: myHand, isRevealed: false } : p));
              }
              break;
          case 'CARD_REVEAL_ALL':
               // Update all to revealed (data usually comes with CARD_WELCOME sync or logic)
               // But here we might just trust the list update from WELCOME/Sync that follows usually.
               // Actually, Host broadcasts the list via WELCOME/Update message usually.
               // Let's rely on CARD_WELCOME for state sync mostly.
               break;
          case 'CARD_RESULT':
              setWinnerId(data.winnerId);
              break;
          case 'CHAT':
               setMessages(prev => [...prev.slice(-49), data.message]);
               break;
      }
  };

  const handlePlayerReveal = () => {
      const me = players.find(p => p.id === peerService.myId);
      if (me && !me.isRevealed) {
          const { score, text } = calculateScore(me.hand);
          // Optimistic
          setPlayers(prev => prev.map(p => p.id === me.id ? { ...p, isRevealed: true, score, scoreText: text } : p));
          // Notify Host
          peerService.sendToHost({ type: 'CARD_REVEAL', peerId: me.id, hand: me.hand });
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

  // --- CLEANUP ---
  useEffect(() => {
      return () => {
          if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
      }
  }, []);

  // --- UI RENDER ---

  // LOBBY / SETUP
  if (role === GameRole.NONE) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-green-900 text-white font-sans relative">
           <button onClick={onBackToMenu} className="absolute top-4 left-4 text-gray-300 hover:text-white font-bold">&larr; Menu</button>
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
                 <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input type="checkbox" checked={isAutoMode} onChange={e => setIsAutoMode(e.target.checked)} className="w-5 h-5" />
                    <span>Chế độ Bot tự chia & lật</span>
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
                    placeholder="Mã Phòng" 
                    value={joinRoomId} 
                    onChange={e => setJoinRoomId(e.target.value)}
                 />
                 <button onClick={startPlayer} className="w-full bg-white text-green-900 font-bold py-3 rounded hover:bg-gray-200">
                    Tham Gia
                 </button>
              </div>
           </div>
        </div>
      );
  }

  // GAME BOARD
  return (
      <div className="min-h-screen bg-green-900 text-white overflow-hidden flex flex-col relative">
          {/* Header */}
          <div className="p-3 bg-green-950 flex justify-between items-center shadow-md z-20">
              <div className="flex items-center gap-4">
                 <button onClick={() => { if(confirm('Thoát?')) { peerService.destroy(); setRole(GameRole.NONE); }}} className="bg-red-600 px-3 py-1 rounded text-sm font-bold">Thoát</button>
                 <div className="flex flex-col">
                    <span className="font-bold text-yellow-400">Phòng: {roomId}</span>
                    <span className="text-xs text-gray-300">{isAutoMode ? '🤖 Bot Mode' : '👤 Manual Mode'}</span>
                 </div>
              </div>
              {role === GameRole.HOST && (
                  <div className="flex gap-2">
                     <button 
                        onClick={handleDeal} 
                        disabled={isAutoMode && gameStatus === GameStatus.PLAYING}
                        className="bg-yellow-500 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400 disabled:opacity-50"
                     >
                        CHIA BÀI
                     </button>
                     {!isAutoMode && (
                        <button 
                             onClick={() => handleRevealAll()}
                             className="bg-blue-600 px-4 py-2 rounded font-bold hover:bg-blue-500"
                        >
                             LẬT HẾT
                        </button>
                     )}
                  </div>
              )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-wrap content-center justify-center gap-6 relative">
             <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                 <span className="text-9xl font-black text-white">♠♥♣♦</span>
             </div>
             
             {players.map(p => {
                 const isMe = p.id === (role === GameRole.HOST ? 'host' : peerService.myId);
                 const isWinner = p.id === winnerId;
                 
                 return (
                     <div key={p.id} className={`
                        relative bg-green-800/80 backdrop-blur-sm p-4 rounded-xl border-2 flex flex-col items-center gap-2 min-w-[200px] transition-all duration-500
                        ${isWinner ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] scale-110 z-10' : 'border-white/30'}
                     `}>
                        {isWinner && <div className="absolute -top-4 text-3xl animate-bounce">👑</div>}
                        
                        <div className="flex gap-1 sm:gap-2 h-24 sm:h-28">
                             {p.hand.length === 0 ? (
                                 // Empty slots
                                 [1,2,3].map(i => <div key={i} className="w-16 h-24 sm:w-20 sm:h-28 border-2 border-dashed border-white/20 rounded-lg"></div>)
                             ) : (
                                 p.hand.map((card, idx) => (
                                     <PlayingCard 
                                        key={idx} 
                                        card={card} 
                                        revealed={p.isRevealed} 
                                        onClick={() => {
                                            if (isMe && !p.isRevealed) handlePlayerReveal();
                                            if (role === GameRole.HOST && p.id === 'host' && !p.isRevealed) handleHostRevealSelf();
                                        }}
                                     />
                                 ))
                             )}
                        </div>

                        <div className="text-center w-full">
                            <div className="font-bold text-lg truncate max-w-[150px] mx-auto">{p.name} {isMe && '(Bạn)'}</div>
                            {p.isRevealed ? (
                                <div className="text-yellow-400 font-black text-xl animate-pulse">{p.scoreText}</div>
                            ) : (
                                <div className="text-gray-400 text-sm italic h-7">{gameStatus === GameStatus.PLAYING && p.hand.length > 0 ? 'Đang xem bài...' : 'Chờ chia...'}</div>
                            )}
                        </div>

                        {isMe && !p.isRevealed && p.hand.length > 0 && (
                            <button 
                                onClick={role === GameRole.HOST ? handleHostRevealSelf : handlePlayerReveal}
                                className="mt-1 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold animate-bounce"
                            >
                                LẬT BÀI
                            </button>
                        )}
                     </div>
                 )
             })}
          </div>

          {/* Chat */}
          <div className="h-48 sm:h-64 bg-white text-black border-t-2 border-green-700">
             <ChatBox messages={messages} onSendMessage={handleSendMessage} senderName={myName} />
          </div>
      </div>
  );
};

export default CardGame;