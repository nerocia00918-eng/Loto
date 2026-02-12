import React, { useState, useEffect } from 'react';
import { AppMode } from './types';
import LotoGame from './views/LotoGame';
import CardGame from './views/CardGame';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>(AppMode.MENU);
  const [showSettings, setShowSettings] = useState(false);

  // Settings State
  const [turnUrl, setTurnUrl] = useState('');
  const [turnUser, setTurnUser] = useState('');
  const [turnPass, setTurnPass] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('loto_turn_config');
    if (stored) {
        const config = JSON.parse(stored);
        setTurnUrl(config.turnUrl || '');
        setTurnUser(config.turnUser || '');
        setTurnPass(config.turnPass || '');
    }
  }, []);

  const saveSettings = () => {
      const config = { turnUrl, turnUser, turnPass };
      localStorage.setItem('loto_turn_config', JSON.stringify(config));
      setShowSettings(false);
      alert("Đã lưu cấu hình mạng! Vui lòng tải lại trang (F5) để áp dụng.");
      window.location.reload();
  };

  const clearSettings = () => {
      localStorage.removeItem('loto_turn_config');
      setTurnUrl('');
      setTurnUser('');
      setTurnPass('');
      alert("Đã xóa cấu hình riêng. Sẽ dùng máy chủ mặc định (Google STUN).");
  };

  if (appMode === AppMode.LOTO) {
    return <LotoGame onBackToMenu={() => setAppMode(AppMode.MENU)} />;
  }

  if (appMode === AppMode.CARD) {
    return <CardGame onBackToMenu={() => setAppMode(AppMode.MENU)} />;
  }

  // Main Menu
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center p-6 text-white font-sans relative">
       
       {/* SETTINGS BUTTON */}
       <button 
         onClick={() => setShowSettings(true)}
         className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-sm transition-colors text-sm flex items-center gap-2 px-4 border border-white/20"
       >
         <span>⚙️</span> Cài đặt Mạng
       </button>

       {/* SETTINGS MODAL */}
       {showSettings && (
           <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white text-gray-800 p-6 rounded-2xl max-w-md w-full shadow-2xl border-4 border-indigo-500">
                   <h2 className="text-2xl font-bold mb-4 text-indigo-700">Cấu hình Máy chủ TURN</h2>
                   <p className="text-sm text-gray-500 mb-4">
                       Dùng khi bị lỗi "Đang kết nối" do khác mạng (4G vs Wifi). 
                       <br/>Bạn có thể tạo tài khoản miễn phí tại <a href="https://www.metered.ca/tools/openrelay/" target="_blank" className="text-blue-600 underline">Metered.ca</a> để lấy thông tin.
                   </p>
                   
                   <div className="space-y-3">
                       <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase">TURN URL</label>
                           <input 
                                className="w-full border rounded p-2 text-sm" 
                                placeholder="turn:global.turn.metered.ca:80"
                                value={turnUrl}
                                onChange={e => setTurnUrl(e.target.value)}
                           />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase">Username</label>
                           <input 
                                className="w-full border rounded p-2 text-sm" 
                                placeholder="User..."
                                value={turnUser}
                                onChange={e => setTurnUser(e.target.value)}
                           />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase">Password</label>
                           <input 
                                className="w-full border rounded p-2 text-sm" 
                                type="password"
                                placeholder="Pass..."
                                value={turnPass}
                                onChange={e => setTurnPass(e.target.value)}
                           />
                       </div>
                   </div>

                   <div className="flex gap-3 mt-6">
                       <button onClick={clearSettings} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded text-sm font-bold">Xóa/Mặc định</button>
                       <div className="flex-1 flex gap-2 justify-end">
                            <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Hủy</button>
                            <button onClick={saveSettings} className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold shadow">Lưu & Tải lại</button>
                       </div>
                   </div>
               </div>
           </div>
       )}

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
          Kết nối P2P. Cấu hình TURN nếu chơi khác mạng.
       </div>
    </div>
  );
};

export default App;