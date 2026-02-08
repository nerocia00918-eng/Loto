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

  // Refs for stale closure fix in PeerJS callbacks
  const playersRef = useRef<CardPlayer[]>([]);
  const gameStatusRef = useRef<GameStatus>(GameStatus.LOBBY);
  const autoTimeoutRef = useRef<number | null>(null);
  const winnerIdRef = useRef<string | null>(null);

  // Sync state to refs
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  useEffect(() => {
      winnerIdRef.current = winnerId;
  }, [winnerId]);

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
    
    // Initial Host Player
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

  const handleHostData = (data: PeerMessage, conn: any) => {
    switch (data.type) {
      case 'JOIN':
        const newPlayer: CardPlayer = { id: conn.peer, name: data.name, isReady: true, hand: [], isRevealed: false };
        
        setPlayers(prev => {
           if (prev.find(p => p.id === newPlayer.id)) return prev;
           return [...prev, newPlayer];
        });

        addMessage("Hệ thống", `${data.name} đã vào bàn!`, true);
        
        // Respond with current state
        // Need a slight delay or rely on ref to ensure we send the included player list
        setTimeout(() => {
            const currentList = playersRef.current.find(p => p.id === newPlayer.id) 
                ? playersRef.current 
                : [...playersRef.current, newPlayer];
            
            conn.send({ type: 'CARD_WELCOME', players: currentList, gameState: gameStatusRef.current });
            broadcastUpdate(currentList);
        }, 100);
        break;
      
      case 'CHAT':
        setMessages(prev => [...prev.slice(-49), data.message]);
        peerService.broadcast(data);
        break;
        
      case 'CARD_REVEAL':
        // A player revealed their hand
        setPlayers(prev => {
            const updated = prev.map(p => {
                if(p.id === data.peerId) {
                    const { score, text } = calculateScore(data.hand);
                    return { ...p, hand: data.hand, isRevealed: true, score, scoreText: text };
                }
                return p;
            });
            
            // DYNAMIC WINNER CALCULATION (King of the Hill)
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
      
      // Also broadcast winner if exists
      if (winnerIdRef.current) {
          peerService.broadcast({ type: 'CARD_RESULT', winnerId: winnerIdRef.current });
      }
  };

  const handleDeal = () => {
     if (players.length < 1) return alert("Cần ít nhất 1 người!"); 
     
     setGameStatus(GameStatus.PLAYING);
     setWinnerId(null);
     
     const deck = shuffleDeck(createDeck());
     
     // Deal 3 cards to each
     const hands: Record<string, Card[]> = {};
     const newPlayers = players.map(p => {
         // Create 3 hidden cards
         const hand = [deck.pop()!, deck.pop()!, deck.pop()!].map(c => ({...c, isHidden: true}));
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

     // Broadcast public state (everyone gets hidden cards visually)
     peerService.broadcast({ type: 'START_GAME' });
     addMessage("Dealer", isAutoMode ? "Bot đã chia bài! Đang tự động lật..." : "Đã chia bài! Mời nặn bài.", true);

     if (isAutoMode) {
         if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
         autoTimeoutRef.current = setTimeout(() => {
             handleRevealAll(newPlayers);
         }, 3000); // 3s delay for suspense
     }
  };

  const handleRevealAll = (currentPlayers = players) => {
      // Force reveal everyone
      const revealedPlayers = currentPlayers.map(p => {
           const fullHand = p.hand.map(c => ({...c, isHidden: false}));
           const { score, text } = calculateScore(fullHand);
           return { ...p, hand: fullHand, isRevealed: true, score, scoreText: text };
      });
      setPlayers(revealedPlayers);
      
      // Calculate final winner
      calculateLeader(revealedPlayers, 'ALL');
      
      broadcastUpdate(revealedPlayers);
      peerService.broadcast({ type: 'CARD_REVEAL_ALL' });
      
      if (isAutoMode) {
          if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
          autoTimeoutRef.current = setTimeout(() => {
              handleDeal(); // Loop
          }, 5000);
      }
  };

  // Logic to find who is winning *right now* among revealed players
  const calculateLeader = (currentPlayers: CardPlayer[], newlyRevealedId: string) => {
      // Get all revealed players
      const revealed = currentPlayers.filter(p => p.isRevealed && p.score !== undefined);
      
      if (revealed.length === 0) return;

      // Find max score
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

      // Simple rule: If tie, the latest one or keeping existing? 
      // Usually keeping existing leader is better for stability, unless new one is strictly higher.
      // But user wants notification when *that person* presses show.
      // So if I reveal and I match the high score, I join the winners circle.
      
      if (winners.length > 0) {
          // If the newly revealed player is among the winners, announce them specifically
          const newChampion = winners.find(w => w.id === newlyRevealedId);
          
          if (newChampion) {
               setWinnerId(newChampion.id);
               addMessage("Hệ thống", `🔥 ${newChampion.name} vừa lật bài: ${newChampion.scoreText}! (Dẫn đầu)`, true);
               peerService.broadcast({ type: 'CARD_RESULT', winnerId: newChampion.id });
          } else if (newlyRevealedId === 'ALL') {
               // Auto mode or Reveal All case
               const w = winners[0];
               setWinnerId(w.id);
               addMessage("Hệ thống", `🏆 ${w.name} thắng với ${w.scoreText}!`, true);
               peerService.broadcast({ type: 'CARD_RESULT', winnerId: w.id });
          } else {
               // Someone revealed but didn't beat the leader
               // Just keep current winnerId
               // Optional: Check if the current winnerId is still valid? Yes, logic above handles it.
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
              // Merge hands carefully. If I have a private hand, keep it.
              setPlayers(prev => {
                  return data.players.map(serverP => {
                      const localP = prev.find(local => local.id === serverP.id);
                      // If it's ME, and I have cards, keep my local 'isHidden' state unless server says revealed
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
              // My private hand (all hidden initially)
              const myHand = data.hands[peerService.myId].map(c => ({ ...c, isHidden: true }));
              setPlayers(prev => prev.map(p => p.id === peerService.myId ? { ...p, hand: myHand, isRevealed: false } : p));
              break;
          case 'CARD_REVEAL_ALL':
               // Server forced reveal. We trust the next CARD_WELCOME/Update to show cards.
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

  // --- CARD INTERACTION (FLIP) ---
  const handleCardClick = (playerIndex: number, cardIndex: number) => {
      const targetPlayer = players[playerIndex];
      const isMe = targetPlayer.id === (role === GameRole.HOST ? 'host' : peerService.myId);
      
      // Only allow clicking my own cards
      if (!isMe) return;
      if (targetPlayer.isRevealed) return; // Already fully revealed
      if (gameStatus !== GameStatus.PLAYING) return;

      // Toggle hidden state locally
      const newHand = [...targetPlayer.hand];
      const clickedCard = newHand[cardIndex];
      
      if (!clickedCard.isHidden) return; // Already open

      // Flip it open
      newHand[cardIndex] = { ...clickedCard, isHidden: false };

      // Check if all cards are now open
      const allOpen = newHand.every(c => !c.isHidden);
      
      // Update local state
      setPlayers(prev => {
          const newPlayers = [...prev];
          newPlayers[playerIndex] = { 
              ...targetPlayer, 
              hand: newHand,
              isRevealed: allOpen // Mark as revealed if all open
          };
          
          // If HOST, calculate score immediately and broadcast if all open
          if (role === GameRole.HOST && allOpen) {
              const { score, text } = calculateScore(newHand);
              newPlayers[playerIndex].score = score;
              newPlayers[playerIndex].scoreText = text;
              
              // Broadcast
              setTimeout(() => {
                  calculateLeader(newPlayers, 'host');
                  broadcastUpdate(newPlayers);
                  // Notify peers that host revealed (for specific animation triggers if needed)
                  peerService.broadcast({ type: 'CARD_REVEAL', peerId: 'host', hand: newHand });
              }, 0);
          }
          
          return newPlayers;
      });

      // If PLAYER and all open, send to Host
      if (role === GameRole.PLAYER && allOpen) {
          peerService.sendToHost({ type: 'CARD_REVEAL', peerId: peerService.myId, hand: newHand });
      }
  };

  // --- CLEANUP ---
  useEffect(() => {
      return () => {
          if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
      }
  }, []);

  // --- UI RENDER ---

  // LOBBY / SETUP (Keep existing code, just return normally)
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
                 <label className="flex items-center gap-2 mb-4 cursor-pointer select-none bg-green-900/50 p-2 rounded">
                    <input type="checkbox" checked={isAutoMode} onChange={e => setIsAutoMode(e.target.checked)} className="w-5 h-5 accent-yellow-500" />
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
                    <span className="text-xs text-gray-300 flex items-center gap-1">
                        {isAutoMode ? '🤖 Bot' : '👤 Nặn Bài'}
                        {gameStatus === GameStatus.LOBBY && <span className="text-yellow-200 animate-pulse">- Chờ chia bài...</span>}
                    </span>
                 </div>
              </div>
              
              {role === GameRole.HOST && (
                  <div className="flex gap-2">
                     <button 
                        onClick={handleDeal} 
                        disabled={isAutoMode && gameStatus === GameStatus.PLAYING}
                        className={`
                            px-4 py-2 rounded font-bold transition-all shadow-lg
                            ${(isAutoMode && gameStatus === GameStatus.PLAYING) 
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                : 'bg-yellow-500 text-black hover:bg-yellow-400 hover:scale-105 active:scale-95 animate-pulse-fast'
                            }
                        `}
                     >
                        {gameStatus === GameStatus.LOBBY ? 'BẮT ĐẦU (CHIA)' : 'CHIA VÁN MỚI'}
                     </button>
                     
                     {!isAutoMode && (
                        <button 
                             onClick={() => handleRevealAll()}
                             className="bg-blue-600 px-4 py-2 rounded font-bold hover:bg-blue-500 shadow-lg text-xs sm:text-base"
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
             
             {players.map((p, pIdx) => {
                 const isMe = p.id === (role === GameRole.HOST ? 'host' : peerService.myId);
                 const isWinner = p.id === winnerId;
                 
                 return (
                     <div key={p.id} className={`
                        relative bg-green-800/80 backdrop-blur-sm p-4 rounded-xl border-2 flex flex-col items-center gap-2 min-w-[200px] transition-all duration-500
                        ${isWinner ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] scale-110 z-10' : 'border-white/30'}
                     `}>
                        {isWinner && (
                            <div className="absolute -top-6 text-yellow-400 font-black text-sm bg-black/50 px-2 py-1 rounded-full animate-bounce">
                                👑 ĐANG DẪN ĐẦU
                            </div>
                        )}
                        
                        <div className="flex gap-1 sm:gap-2 h-24 sm:h-28">
                             {p.hand.length === 0 ? (
                                 [1,2,3].map(i => <div key={i} className="w-16 h-24 sm:w-20 sm:h-28 border-2 border-dashed border-white/20 rounded-lg bg-green-900/50"></div>)
                             ) : (
                                 p.hand.map((card, cIdx) => (
                                     <PlayingCard 
                                        key={cIdx} 
                                        card={card} 
                                        revealed={!card.isHidden} // Pass individual hidden state
                                        onClick={() => handleCardClick(pIdx, cIdx)}
                                     />
                                 ))
                             )}
                        </div>

                        <div className="text-center w-full min-h-[50px]">
                            <div className="font-bold text-lg truncate max-w-[150px] mx-auto text-yellow-50">{p.name} {isMe && '(Bạn)'}</div>
                            {p.isRevealed ? (
                                <div className="text-yellow-400 font-black text-xl animate-pulse">{p.scoreText}</div>
                            ) : (
                                <div className="text-gray-400 text-xs italic flex flex-col items-center">
                                    {isMe && gameStatus === GameStatus.PLAYING ? (
                                        <span className="text-blue-300 animate-pulse">👇 Bấm bài để lật!</span>
                                    ) : (
                                        <span>{gameStatus === GameStatus.PLAYING ? 'Đang nặn...' : '...'}</span>
                                    )}
                                </div>
                            )}
                        </div>
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