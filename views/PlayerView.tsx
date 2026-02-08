import React, { useState, useEffect } from 'react';
import { Board, ChatMessage, GameStatus, ClaimData } from '../types';
import { generatePlayerBoards, checkBoardWin } from '../utils/gameLogic';
import LotoTicket from '../components/LotoTicket';
import ChatBox from '../components/ChatBox';
import NumberAnnouncer from '../components/NumberAnnouncer';

interface PlayerViewProps {
  playerName: string;
  onBack: () => void;
  currentNumber: number | null;
  calledNumbers: number[];
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClaimWin: (claim: ClaimData) => void;
  gameStatus: GameStatus;
}

const PlayerView: React.FC<PlayerViewProps> = ({ 
  playerName, onBack, currentNumber, calledNumbers, messages, onSendMessage, onClaimWin, gameStatus 
}) => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [hasClaimed, setHasClaimed] = useState(false);

  // Generate boards once on mount
  useEffect(() => {
    if (boards.length === 0) {
      setBoards(generatePlayerBoards());
    }
  }, []);

  // Reset claim status if game resets (calledNumbers cleared)
  useEffect(() => {
      if (calledNumbers.length === 0) {
          setHasClaimed(false);
      }
  }, [calledNumbers]);

  const handleCellClick = (boardId: string, rIdx: number, cIdx: number) => {
    setBoards(prevBoards => prevBoards.map(board => {
      if (board.id !== boardId) return board;
      
      const newRows = [...board.rows];
      const cell = newRows[rIdx][cIdx];
      
      if (cell.value !== null) {
        newRows[rIdx][cIdx] = { ...cell, marked: !cell.marked };
      }
      
      return { ...board, rows: newRows };
    }));
  };
  
  const handleKinh = () => {
    let winningBoard: Board | null = null;
    
    // Find the board that triggered the win
    for (const board of boards) {
        if (checkBoardWin(board) !== -1) {
            winningBoard = board;
            break;
        }
    }

    if (winningBoard) {
        setHasClaimed(true);
        onSendMessage("KINH RỒI BÀ CON ƠI!!! 🎉🎉🎉");
        // Send claim to Host
        onClaimWin({
            playerName,
            board: winningBoard
        });
        alert("Đã gửi yêu cầu 'Kinh'! Chờ Host kiểm tra vé nhé.");
    } else {
        alert("Chưa đủ điều kiện 'Kinh' đâu nhé! Kiểm tra lại đi.");
        onSendMessage("Huhu tính kinh mà dò lại bị hụt... 😭");
    }
  };

  const resetPlayer = () => {
    if(confirm("Bạn muốn đổi vé mới?")) {
        setBoards(generatePlayerBoards());
    }
  }

  // --- WAITING ROOM ---
  if (gameStatus === GameStatus.LOBBY) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 bg-loto-cream">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border-4 border-loto-yellow text-center animate-pulse-fast">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Đang chờ Host bắt đầu...</h2>
            <p className="text-gray-500">Bạn đã vào phòng thành công.</p>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-400">Người chơi</p>
                <p className="text-xl font-bold text-loto-red">{playerName}</p>
            </div>
            <button onClick={onBack} className="mt-8 text-gray-400 hover:text-red-500 underline text-sm">
                Rời phòng
            </button>
        </div>
      </div>
    );
  }

  // --- PLAYING VIEW ---
  return (
    <div className="flex flex-col h-full relative max-w-7xl mx-auto font-sans">
      <NumberAnnouncer number={currentNumber} />

      {/* Top Bar */}
      <div className="bg-white shadow-sm p-3 flex justify-between items-center sticky top-0 z-10 mx-2 rounded-b-xl border-b border-gray-100">
        <div className="flex items-center gap-3">
            <div className="bg-loto-red text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
                {playerName.charAt(0).toUpperCase()}
            </div>
            <div>
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">{playerName}</h2>
                <div className="flex gap-2 text-xs items-center">
                    <span className="text-gray-500">Số vừa gọi:</span>
                    <span className="text-loto-red font-black text-xl bg-gray-100 px-2 rounded">{currentNumber || '--'}</span>
                </div>
            </div>
        </div>
        
        <div className="flex gap-2 items-center">
            <button 
                onClick={() => setLayoutMode(prev => prev === 'grid' ? 'list' : 'grid')}
                className="bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 hidden sm:block border border-blue-200"
                title="Đổi kiểu xem"
            >
                {layoutMode === 'grid' ? 'xếp Dọc' : 'xếp Lưới'}
            </button>

             <button onClick={resetPlayer} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 hidden sm:block">
                Đổi Vé
            </button>
            <button 
                onClick={handleKinh}
                disabled={hasClaimed}
                className={`
                    px-6 py-2 rounded-full text-lg font-black shadow-lg border-2 border-white ring-2 ring-red-500
                    ${hasClaimed 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-900 hover:from-yellow-300 hover:to-yellow-400 animate-pulse-fast'
                    }
                `}
            >
                {hasClaimed ? 'ĐÃ KINH' : 'KINH!'}
            </button>
            <button onClick={onBack} className="text-xs text-gray-400 underline ml-2 hover:text-red-500">Thoát</button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 p-2 sm:p-4 flex-1 overflow-hidden">
        {/* Tickets Area */}
        <div className="flex-1 overflow-y-auto pb-24 lg:pb-0 scrollbar-thin">
            <div className={
                layoutMode === 'grid' 
                ? "grid grid-cols-1 xl:grid-cols-2 gap-4 justify-items-center pb-8 content-start"
                : "flex flex-col gap-4 items-center pb-8"
            }>
                {boards.map((board, idx) => (
                    <div key={board.id} className="w-full max-w-md bg-white p-2 rounded-xl shadow-md border border-gray-100">
                        <div className="flex justify-between items-end mb-2 px-2 border-b border-gray-100 pb-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vé số {idx + 1}</span>
                            {checkBoardWin(board) !== -1 && <span className="text-green-600 font-bold text-xs bg-green-100 px-2 rounded-full animate-bounce">ĐÃ THẮNG!</span>}
                        </div>
                        <LotoTicket board={board} onCellClick={handleCellClick} />
                    </div>
                ))}
            </div>
        </div>

        {/* Chat Area - Sidebar on desktop */}
        <div className="lg:w-80 w-full flex-none h-64 lg:h-auto rounded-xl overflow-hidden shadow-lg border border-gray-200 bg-white">
             <ChatBox messages={messages} onSendMessage={onSendMessage} senderName={playerName} />
        </div>
      </div>
    </div>
  );
};

export default PlayerView;