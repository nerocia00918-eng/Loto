import React from 'react';
import { Card } from '../types';

interface PlayingCardProps {
  card: Card;
  onClick?: () => void;
  revealed?: boolean;
}

const PlayingCard: React.FC<PlayingCardProps> = ({ card, onClick, revealed = false }) => {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  
  const getSuitSymbol = (suit: string) => {
    switch(suit) {
      case 'hearts': return '♥';
      case 'diamonds': return '♦';
      case 'clubs': return '♣';
      case 'spades': return '♠';
      default: return '';
    }
  };

  if (card.isHidden && !revealed) {
    return (
      <div 
        onClick={onClick}
        className="w-16 h-24 sm:w-20 sm:h-28 bg-blue-800 rounded-lg border-2 border-white shadow-md flex items-center justify-center cursor-pointer transform transition-transform hover:-translate-y-1 relative"
      >
        <div className="w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>
        <div className="absolute w-8 h-8 rounded-full border-2 border-yellow-400 flex items-center justify-center">
            <span className="text-yellow-400 font-bold text-xs">GAME</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`
        w-16 h-24 sm:w-20 sm:h-28 bg-white rounded-lg border border-gray-300 shadow-md flex flex-col justify-between p-1 select-none cursor-pointer
        transform transition-all duration-300 hover:scale-105 hover:z-10 relative
        ${isRed ? 'text-red-600' : 'text-black'}
      `}
    >
      <div className="text-sm font-bold leading-none">{card.rank}</div>
      <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-100">
        {getSuitSymbol(card.suit)}
      </div>
      <div className="text-sm font-bold leading-none self-end transform rotate-180">{card.rank}</div>
    </div>
  );
};

export default PlayingCard;