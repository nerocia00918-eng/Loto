import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  senderName: string;
}

const EMOJIS = ["😂", "😡", "🎉", "😱", "😭", "👍", "🍀", "🙏"];

const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, senderName }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleEmoji = (emoji: string) => {
    onSendMessage(emoji);
  };

  return (
    <div className="flex flex-col h-96 min-h-[450px] bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden">
      {/* Header */}
      <div className="bg-loto-red text-white px-3 py-2 font-bold text-sm flex justify-between items-center">
        <span>Phòng Chat 💬</span>
        <span className="text-xs font-normal opacity-80">Online</span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50">
        {messages.map((msg) => {
          const isMe = msg.sender === senderName;
          if (msg.isSystem) {
             return (
                 <div key={msg.id} className="text-center text-xs text-gray-500 italic my-1">
                    {msg.text}
                 </div>
             )
          }
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-gray-500 px-1">{msg.sender}</span>
              <div className={`
                max-w-[85%] px-3 py-1.5 rounded-lg text-sm shadow-sm
                ${isMe ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}
              `}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Bar */}
      <div className="bg-gray-100 px-2 py-1 flex gap-1 overflow-x-auto scrollbar-hide">
        {EMOJIS.map(e => (
          <button 
            key={e} 
            onClick={() => handleEmoji(e)}
            className="hover:bg-gray-200 rounded p-1 text-lg transition-colors"
          >
            {e}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-gray-200 flex gap-2">
        <input
          type="text"
          className="flex-1 border rounded px-2 py-1 text-sm outline-none focus:border-loto-red"
          placeholder="Nói gì đi..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button 
          onClick={handleSend}
          className="bg-loto-red text-white px-3 py-1 rounded text-sm font-bold hover:bg-red-700"
        >
          Gửi
        </button>
      </div>
    </div>
  );
};

export default ChatBox;