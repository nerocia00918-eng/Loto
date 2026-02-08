import React, { useState } from 'react';
import { AppMode } from './types';
import LotoGame from './views/LotoGame';
import CardGame from './views/CardGame';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>(AppMode.MENU);

  if (appMode === AppMode.LOTO) {
    return <LotoGame onBackToMenu={() => setAppMode(AppMode.MENU)} />;
  }

  if (appMode === AppMode.CARD) {
    return <CardGame onBackToMenu={() => setAppMode(AppMode.MENU)} />;
  }

  // Main Menu
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center p-6 text-white font-sans">
       <div className="text-center mb-12">
          <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 mb-4 drop-shadow-lg">
             GAME VUI
          </h1>
          <p className="text-gray-300 text-xl">Chọn trò chơi để bắt đầu cùng bạn bè</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Loto Card */}
          <div 
            onClick={() => setAppMode(AppMode.LOTO)}
            className="group relative bg-white/10 backdrop-blur-md border-4 border-loto-red rounded-3xl p-8 cursor-pointer hover:bg-white/20 transition-all duration-300 hover:scale-105 shadow-2xl overflow-hidden"
          >
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-loto-red rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="flex flex-col items-center text-center relative z-10">
                  <div className="text-6xl mb-4 transform group-hover:rotate-12 transition-transform">🎱</div>
                  <h2 className="text-3xl font-bold mb-2 text-white">LÔ TÔ</h2>
                  <p className="text-gray-300">
                      Trò chơi dân gian kinh điển. Host gọi số (có MC AI), người chơi dò vé.
                  </p>
                  <div className="mt-6 bg-loto-red px-6 py-2 rounded-full font-bold shadow-lg">Chơi Ngay</div>
              </div>
          </div>

          {/* Card Game Card */}
          <div 
            onClick={() => setAppMode(AppMode.CARD)}
            className="group relative bg-white/10 backdrop-blur-md border-4 border-yellow-400 rounded-3xl p-8 cursor-pointer hover:bg-white/20 transition-all duration-300 hover:scale-105 shadow-2xl overflow-hidden"
          >
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-yellow-400 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="flex flex-col items-center text-center relative z-10">
                  <div className="text-6xl mb-4 transform group-hover:-rotate-12 transition-transform">🃏</div>
                  <h2 className="text-3xl font-bold mb-2 text-white">BÀI CÀO</h2>
                  <p className="text-gray-300">
                      Game 3 lá tính điểm. Chế độ Bot tự chia hoặc Host chia bài thủ công.
                  </p>
                  <div className="mt-6 bg-yellow-500 text-black px-6 py-2 rounded-full font-bold shadow-lg">Chơi Ngay</div>
              </div>
          </div>
       </div>

       <div className="mt-16 text-gray-500 text-sm">
          Kết nối P2P. Không lưu trữ dữ liệu.
       </div>
    </div>
  );
};

export default App;