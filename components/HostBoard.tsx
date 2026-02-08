import React from 'react';
import { TOTAL_NUMBERS } from '../types';

interface HostBoardProps {
  calledNumbers: number[];
}

const HostBoard: React.FC<HostBoardProps> = ({ calledNumbers }) => {
  // Create array 1..60
  const allNumbers = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);

  return (
    <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
      <h3 className="text-gray-500 text-sm font-bold mb-2 uppercase tracking-wide">Bảng số đã gọi</h3>
      <div className="grid grid-cols-10 gap-1 sm:gap-2">
        {allNumbers.map((num) => {
          const isCalled = calledNumbers.includes(num);
          return (
            <div
              key={num}
              className={`
                aspect-square flex items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-colors duration-300
                ${isCalled ? 'bg-loto-red text-white font-bold' : 'bg-gray-100 text-gray-400'}
              `}
            >
              {num}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HostBoard;