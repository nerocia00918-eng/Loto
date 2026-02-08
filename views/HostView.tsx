import React, { useState, useEffect } from 'react';
import { TOTAL_NUMBERS, Board, ChatMessage, GameStatus, PlayerInfo } from '../types';
import HostBoard from '../components/HostBoard';
import LotoTicket from '../components/LotoTicket';
import ChatBox from '../components/ChatBox';
import NumberAnnouncer from '../components/NumberAnnouncer';
import { initializeGemini, getGeminiCommentary } from '../services/geminiService';
import { generatePlayerBoards, checkBoardWin } from '../utils/gameLogic';
import { readNumberToVietnamese } from '../utils/numberReader';

// Fallback phrases when Gemini is off
const LOTO_PHRASES: Record<number, string[]> = {
    1: ["Gì ra con mấy, con mấy gì ra. Trúc xinh trúc mọc đầu đình, em xinh em đứng một mình cũng xinh. Là con số 1."],
    10: ["Tròn trĩnh như quả trứng gà, là con số 10."],
    17: ["Mười bảy bẻ gãy sừng trâu. Là con 17."],
    22: ["Tuy em nó xấu nhưng mà kết cấu nó đẹp. Là con 22."],
    30: ["Ba mươi Tết đến nơi rồi, con 30."],
    40: ["Bốn mươi, bốn mươi, ai cười thì cười."],
    50: ["Năm mươi, năm mươi, nửa đời người."],
    60: ["Sáu mươi năm cuộc đời. Con 60."],
    // Generic rhyme fillers for others
    999: [
        "Cờ ra con mấy, con mấy gì ra.", 
        "Lặng lặng mà nghe, tôi kêu con cờ ra.", 
        "Gió thổi lung lay, bàn tay con số mấy."
    ]
};

const getRandomPhrase = (num: number) => {
    if (LOTO_PHRASES[num]) {
        return LOTO_PHRASES[num][Math.floor(Math.random() * LOTO_PHRASES[num].length)];
    }
    const generics = LOTO_PHRASES[999];
    return generics[Math.floor(Math.random() * generics.length)];
}

interface HostViewProps {
  onBack: () => void;
  calledNumbers: number[];
  currentNumber: number | null;
  onDrawNumber: (num: number) => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onReset: () => void;
  // Multiplayer Props
  roomId: string;
  gameStatus: GameStatus;
  connectedPlayers: PlayerInfo[];
  onStartGame: () => void;
  onWin: (name: string) => void;
}

const HostView: React.FC<HostViewProps> = ({ 
  onBack, calledNumbers, currentNumber, onDrawNumber, messages, onSendMessage, onReset,
  roomId, gameStatus, connectedPlayers, onStartGame, onWin
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingNum, setAnimatingNum] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [mcCommentary, setMcCommentary] = useState<string>('');
  const [isLoadingCommentary, setIsLoadingCommentary] = useState(false);
  
  // Host Playing State
  const [isHostPlaying, setIsHostPlaying] = useState(false);
  const [hostBoards, setHostBoards] = useState<Board[]>([]);

  // Auto Bot State
  const [isAutoMode, setIsAutoMode] = useState(false);

  // Voice State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');

  // Load voices explicitly
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      if (!selectedVoiceURI) {
        const viVoice = availableVoices.find(v => v.name.includes('Linh') && v.lang.includes('vi')) 
                     || availableVoices.find(v => v.name.includes('An') && v.lang.includes('vi'))
                     || availableVoices.find(v => v.name.includes('Google') && v.lang === 'vi-VN')
                     || availableVoices.find(v => v.lang.includes('vi'));
        
        if (viVoice) {
          setSelectedVoiceURI(viVoice.voiceURI);
        }
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceURI]);

  // Helper to speak text
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
        if (voice.name.includes('Linh') || voice.name.includes('An') || voice.name.includes('Natural')) {
            utterance.pitch = 1.0; 
        } else {
            utterance.pitch = 1.2; 
        }
      } else {
         utterance.lang = 'vi-VN';
         utterance.pitch = 1.2;
      }
      utterance.rate = 1.0; 
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSetApiKey = () => {
    if (apiKey.trim()) {
      initializeGemini(apiKey.trim());
      setApiKeySet(true);
    }
  };

  const startDraw = () => {
    if (calledNumbers.length >= TOTAL_NUMBERS) {
      setIsAutoMode(false);
      alert("Đã gọi hết số!");
      return;
    }
    if (isAnimating) return;

    setIsAnimating(true);
    setMcCommentary('');

    let count = 0;
    const interval = setInterval(() => {
      setAnimatingNum(Math.floor(Math.random() * TOTAL_NUMBERS) + 1);
      count++;
      if (count > 10) {
        clearInterval(interval);
        finalizeDraw();
      }
    }, 80); 
  };

  const finalizeDraw = async () => {
    let nextNum;
    do {
      nextNum = Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
    } while (calledNumbers.includes(nextNum));

    setAnimatingNum(null);
    onDrawNumber(nextNum);
    setIsAnimating(false);

    const numberText = readNumberToVietnamese(nextNum);
    let spokenText = "";
    
    // Logic: Nếu có API -> Dùng AI. Nếu không -> Dùng câu rao mặc định cho vui
    if (apiKeySet) {
      setIsLoadingCommentary(true);
      const comment = await getGeminiCommentary(nextNum);
      setIsLoadingCommentary(false);
      if (comment) {
        setMcCommentary(comment);
        spokenText = `${comment} Số ${numberText}.`;
      } else {
          // Fallback if AI fails
          const phrase = getRandomPhrase(nextNum);
          setMcCommentary(phrase);
          spokenText = `${phrase} Con số ${numberText}.`;
      }
    } else {
        // No API Key
        const phrase = getRandomPhrase(nextNum);
        setMcCommentary(phrase);
        spokenText = `${phrase} Con số ${numberText}.`;
    }
    
    speak(spokenText);
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isAutoMode && !isAnimating && calledNumbers.length < TOTAL_NUMBERS) {
      timer = setTimeout(() => {
        startDraw();
      }, 5000);
    } else if (isAutoMode && calledNumbers.length >= TOTAL_NUMBERS) {
        setIsAutoMode(false);
    }
    return () => clearTimeout(timer);
  }, [isAutoMode, isAnimating, calledNumbers]);

  const handleTogglePlay = () => {
    if (!isHostPlaying) {
      setHostBoards(generatePlayerBoards());
    }
    setIsHostPlaying(!isHostPlaying);
  };

  const handleHostKinh = () => {
    let hasWin = false;
    hostBoards.forEach(board => {
        if (checkBoardWin(board) !== -1) hasWin = true;
    });

    if (hasWin) {
        onSendMessage("HOST KINH RỒI BÀ CON ƠI!!! 🎉🎉🎉");
        onWin("Host (Cái)");
    } else {
        alert("Host ơi, chưa đủ điều kiện 'Kinh' đâu nhé! Kiểm tra lại vé đi.");
        onSendMessage("Host tính kinh mà dò lại bị hụt... 😅");
    }
  };

  const handleCellClick = (boardId: string, rIdx: number, cIdx: number) => {
    setHostBoards(prev => prev.map(board => {
      if (board.id !== boardId) return board;
      const newRows = [...board.rows];
      const cell = newRows[rIdx][cIdx];
      if (cell.value !== null) {
        newRows[rIdx][cIdx] = { ...cell, marked: !cell.marked };
      }
      return { ...board, rows: newRows };
    }));
  };

  // --- LOBBY VIEW ---
  if (gameStatus === GameStatus.LOBBY) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 bg-loto-cream font-sans">
         <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full border-4 border-loto-red text-center">
            <h1 className="text-3xl font-hand font-bold text-loto-red mb-2">Phòng Chờ</h1>
            <p className="text-gray-500 mb-6">Mời bạn bè nhập mã bên dưới để vào phòng</p>
            
            <div className="bg-gray-100 p-4 rounded-xl mb-6">
                <span className="block text-xs text-gray-500 uppercase tracking-widest">Mã Phòng</span>
                <span className="text-5xl font-black text-blue-600 tracking-wider">{roomId || '...'}</span>
            </div>

            <div className="mb-6">
                <h3 className="text-left text-sm font-bold text-gray-400 uppercase mb-2">Người chơi đã vào ({connectedPlayers.length})</h3>
                <div className="bg-gray-50 rounded-xl p-2 max-h-40 overflow-y-auto border border-gray-200">
                    {connectedPlayers.length === 0 ? (
                        <p className="text-gray-400 italic text-sm py-4">Đang chờ người chơi...</p>
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
                onClick={onStartGame}
                disabled={connectedPlayers.length === 0}
                className="w-full bg-loto-red text-white py-4 rounded-xl font-bold text-xl shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                BẮT ĐẦU CHƠI
            </button>
            
            <button onClick={onBack} className="mt-4 text-gray-400 hover:text-red-500 text-sm">Hủy phòng</button>
         </div>
      </div>
    );
  }

  // --- PLAYING VIEW ---
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-loto-cream font-sans">
      <NumberAnnouncer number={currentNumber} />

      {/* Header Fixed */}
      <div className="flex-none flex justify-between items-center p-3 bg-white shadow-sm z-20 border-b border-gray-200">
        <div className="flex items-center gap-2">
           <button onClick={onBack} className="text-gray-600 hover:text-loto-red font-bold flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
            <span>&larr;</span>
           </button>
           <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-hand font-bold text-loto-red leading-none">Phòng Host</h1>
              <span className="text-xs text-gray-400">Mã: {roomId} | {connectedPlayers.length} người</span>
           </div>
        </div>
        <div className="flex gap-2">
           <button onClick={onReset} className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-bold">
            Reset
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-2 sm:p-4 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
          
          {/* Left Column: Controls & History */}
          <div className={`flex flex-col gap-4 h-full overflow-hidden ${isHostPlaying ? 'lg:col-span-4' : 'lg:col-span-8'}`}>
             
             {/* Control Center */}
             <div className="bg-white p-4 rounded-2xl shadow-lg flex flex-col items-center gap-4 relative overflow-hidden flex-none border-2 border-loto-yellow/20">
                {/* Voice Selection */}
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end">
                    <select 
                      value={selectedVoiceURI} 
                      onChange={(e) => setSelectedVoiceURI(e.target.value)}
                      className="text-xs border rounded bg-gray-50 p-1 max-w-[150px] truncate"
                    >
                        <option value="">-- Chọn giọng --</option>
                        {voices.map(v => (
                            <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-center gap-6 w-full mt-4">
                  {/* Ball Display */}
                  <div className={`
                      w-28 h-28 bg-white rounded-full flex items-center justify-center 
                      border-8 border-loto-red shadow-xl flex-none relative
                      ${isAnimating ? 'animate-bounce-short' : ''}
                    `}>
                       <div className="absolute top-2 left-4 w-6 h-3 bg-white opacity-40 rounded-full rotate-45"></div>
                      <span className="text-5xl font-black text-loto-red font-hand">
                        {isAnimating ? animatingNum : (currentNumber || '--')}
                      </span>
                  </div>
                  
                  {/* Buttons */}
                  <div className="flex flex-col gap-2 w-full max-w-[180px]">
                    {!isAutoMode ? (
                      <button
                        onClick={startDraw}
                        disabled={isAnimating || calledNumbers.length >= TOTAL_NUMBERS}
                        className="bg-loto-red text-white text-lg font-bold py-3 px-4 rounded-xl shadow hover:bg-red-700 active:scale-95 disabled:opacity-50 transition-all w-full"
                      >
                        {isAnimating ? '...' : 'BỐC SỐ'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsAutoMode(false)}
                        className="bg-gray-700 text-white text-lg font-bold py-3 px-4 rounded-xl shadow hover:bg-gray-800 active:scale-95 transition-all w-full flex items-center justify-center gap-2"
                      >
                         <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"/> DỪNG
                      </button>
                    )}

                    <button
                      onClick={() => setIsAutoMode(!isAutoMode)}
                      disabled={isAnimating || calledNumbers.length >= TOTAL_NUMBERS}
                      className={`text-sm font-bold py-2 px-4 rounded-xl border-2 w-full transition-all flex items-center justify-center gap-1 ${isAutoMode ? 'hidden' : 'border-loto-yellow text-yellow-800 hover:bg-yellow-50'}`}
                    >
                      <span>🤖</span> Tự động gọi
                    </button>
                  </div>
                </div>

                {/* MC Text */}
                <div className="w-full text-center min-h-[40px] flex items-center justify-center px-4">
                   {isLoadingCommentary ? (
                     <span className="text-xs text-gray-400 italic animate-pulse">MC AI đang soạn lời...</span>
                   ) : mcCommentary ? (
                     <div className="bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200 inline-block max-w-full">
                        <p className="text-sm sm:text-base text-gray-800 font-hand italic">"{mcCommentary}"</p>
                     </div>
                   ) : (
                     <span className="text-xs text-gray-300">Sẵn sàng quay số</span>
                   )}
                </div>

                 {/* Play Toggle for Host */}
                <div className="w-full border-t border-gray-100 pt-2 flex justify-center">
                    <button 
                        onClick={handleTogglePlay}
                        className={`text-xs font-bold px-3 py-1 rounded-full transition-colors flex items-center gap-1
                        ${isHostPlaying ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                        {isHostPlaying ? '✅ Đang hiển thị vé' : '👁️ Hiển thị vé của tôi'}
                    </button>
                </div>
             </div>

             {/* History Board */}
             <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white rounded-xl shadow border border-gray-200">
               <div className="p-2 border-b bg-gray-50 font-bold text-gray-500 text-xs uppercase">Lịch sử số</div>
               <div className="overflow-y-auto p-2">
                 <HostBoard calledNumbers={calledNumbers} />
               </div>
             </div>
          </div>

          {/* Middle Column: Host Tickets */}
          {isHostPlaying && (
            <div className="lg:col-span-5 flex flex-col h-full overflow-hidden bg-white rounded-2xl border-2 border-loto-yellow/30 shadow-sm relative">
               <div className="bg-loto-yellow/20 p-2 flex justify-between items-center px-4 border-b border-loto-yellow/30">
                  <span className="font-bold text-loto-red uppercase text-sm">Vé của Host</span>
                  <button 
                    onClick={handleHostKinh}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-900 px-4 py-1 rounded-full text-sm font-black shadow hover:from-yellow-300 hover:to-yellow-400 animate-pulse-fast border border-white"
                  >
                    KINH!
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                 <div className="flex flex-col gap-4 items-center">
                   {hostBoards.map((board) => (
                      <div key={board.id} className="w-full max-w-md transform transition-all hover:scale-[1.01] bg-white rounded-lg shadow-md border border-gray-100">
                         <div className="flex justify-between items-center px-3 py-1 bg-gray-50 rounded-t-lg border-b">
                            <span className="text-xs font-bold text-gray-500">Mã vé: {board.id.slice(-4)}</span>
                            {checkBoardWin(board) !== -1 && <span className="text-green-600 text-xs font-black animate-pulse bg-green-100 px-2 rounded-full border border-green-200">THẮNG HÀNG {checkBoardWin(board) + 1}</span>}
                         </div>
                         <div className="p-1">
                            <LotoTicket board={board} onCellClick={handleCellClick} />
                         </div>
                      </div>
                   ))}
                 </div>
               </div>
            </div>
          )}

          {/* Right Column: Chat */}
          <div className={`flex flex-col h-full overflow-hidden ${isHostPlaying ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
             <div className="flex-1 min-h-0 rounded-xl shadow-lg overflow-hidden border border-gray-200">
                <ChatBox messages={messages} onSendMessage={onSendMessage} senderName="Host (Cái)" />
             </div>
             
             {!apiKeySet && (
                <div className="mt-2 bg-white p-2 rounded-lg border border-gray-200 text-xs shadow-sm">
                    <label className="block text-gray-500 mb-1">Gemini API Key (Cho MC AI):</label>
                    <div className="flex gap-1">
                        <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="flex-1 border rounded px-1" />
                        <button onClick={handleSetApiKey} className="bg-blue-600 text-white px-2 rounded">OK</button>
                    </div>
                </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default HostView;