import React from 'react';

interface WinnerOverlayProps {
  winnerName: string;
  onClose: () => void;
}

const WinnerOverlay: React.FC<WinnerOverlayProps> = ({ winnerName, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white border-8 border-loto-yellow rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl transform animate-bounce-short">
        {/* Confetti decorations */}
        <div className="absolute -top-4 -left-4 text-4xl animate-spin">🎉</div>
        <div className="absolute -top-4 -right-4 text-4xl animate-spin">✨</div>
        <div className="absolute -bottom-4 -left-4 text-4xl animate-pulse">🎈</div>
        <div className="absolute -bottom-4 -right-4 text-4xl animate-pulse">🏆</div>

        <h2 className="text-6xl font-hand font-black text-loto-red mb-2 drop-shadow-md">KINH RỒI!</h2>
        <div className="my-6">
            <p className="text-gray-500 text-lg uppercase tracking-widest font-bold">Người chiến thắng</p>
            <p className="text-4xl font-bold text-blue-800 mt-2">{winnerName}</p>
        </div>
        
        <p className="text-gray-600 italic mb-8">
            "Mau mau kiểm tra vé, trao thưởng đi nào!"
        </p>

        <button 
          onClick={onClose}
          className="bg-loto-red text-white text-xl font-bold py-3 px-8 rounded-full shadow-lg hover:bg-red-700 transition-transform active:scale-95"
        >
          Đóng thông báo
        </button>
      </div>
    </div>
  );
};

export default WinnerOverlay;