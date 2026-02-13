import React from 'react';
import { Board, CellData } from '../types';
import { checkRowWin } from '../utils/gameLogic';

interface LotoTicketProps {
  board: Board;
  onCellClick: (boardId: string, rowIndex: number, colIndex: number) => void;
  readOnly?: boolean;
}

const LotoTicket: React.FC<LotoTicketProps> = ({ board, onCellClick, readOnly = false }) => {
  return (
    <div className="bg-white border-4 border-loto-red rounded-lg p-2 shadow-lg w-full max-w-md relative overflow-hidden">
        {/* Decorative Header within Ticket */}
        <div className="absolute top-0 left-0 w-full h-1 bg-loto-yellow opacity-50"></div>
        
      <div className="flex flex-col gap-1">
        {board.rows.map((row, rIdx) => {
          const isRowWon = checkRowWin(row);
          return (
            <div key={rIdx} className={`grid grid-cols-6 gap-1 p-1 rounded ${isRowWon ? 'bg-green-100 ring-2 ring-green-500 transition-all duration-500' : ''}`}>
              {row.map((cell, cIdx) => (
                <Cell 
                  key={cIdx} 
                  cell={cell} 
                  onClick={() => !readOnly && onCellClick(board.id, rIdx, cIdx)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface CellProps {
  cell: CellData;
  onClick: () => void;
  readOnly: boolean;
}

const Cell: React.FC<CellProps> = ({ cell, onClick, readOnly }) => {
  if (cell.value === null) {
    // Empty cell placeholder
    return <div className="w-full h-10 sm:h-12 bg-gray-50 rounded border border-gray-100/50" />;
  }

  return (
    <button
      onClick={onClick}
      disabled={readOnly}
      className={`
        w-full h-10 sm:h-12 flex items-center justify-center rounded font-bold text-lg sm:text-xl
        transition-all duration-200 border-2 shadow-sm
        ${cell.marked 
          ? 'bg-loto-red text-white border-loto-red transform scale-105 z-10' 
          : 'bg-white text-gray-800 border-gray-200 hover:border-loto-red'}
      `}
    >
      {cell.value}
    </button>
  );
};

export default LotoTicket;