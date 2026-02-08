import { Board, CellData, COLS_PER_BOARD, ROWS_PER_BOARD, NUMS_PER_ROW, getColRange, BOARDS_PER_PLAYER } from '../types';

// Helper to get random integer inclusive
const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generate a single Loto Board
const generateBoard = (id: string): Board => {
  const rows: CellData[][] = [];
  
  // Track used numbers per column to ensure uniqueness across the board logic if needed,
  // strictly speaking for this game variant, we just need row integrity. 
  // However, usually in Loto, a number doesn't repeat on a ticket.
  const usedNumbers = new Set<number>();

  for (let r = 0; r < ROWS_PER_BOARD; r++) {
    const row: CellData[] = Array(COLS_PER_BOARD).fill(null).map(() => ({ value: null, marked: false }));
    
    // Pick 4 unique column indices for this row
    const availableCols = [0, 1, 2, 3, 4, 5];
    const chosenCols: number[] = [];
    
    while (chosenCols.length < NUMS_PER_ROW) {
      const randomIndex = Math.floor(Math.random() * availableCols.length);
      chosenCols.push(availableCols[randomIndex]);
      availableCols.splice(randomIndex, 1);
    }

    // Fill chosen columns
    for (const colIdx of chosenCols) {
      const { start, end } = getColRange(colIdx);
      let num = getRandomInt(start, end);
      
      // Simple collision avoidance for the board
      let attempts = 0;
      while (usedNumbers.has(num) && attempts < 100) {
        num = getRandomInt(start, end);
        attempts++;
      }
      
      usedNumbers.add(num);
      row[colIdx] = { value: num, marked: false };
    }
    
    rows.push(row);
  }

  return { id, rows };
};

export const generatePlayerBoards = (): Board[] => {
  const boards: Board[] = [];
  for (let i = 0; i < BOARDS_PER_PLAYER; i++) {
    boards.push(generateBoard(`board-${Date.now()}-${i}`));
  }
  return boards;
};

export const checkRowWin = (row: CellData[]): boolean => {
  // A row is won if all non-null cells are marked
  const numbers = row.filter(c => c.value !== null);
  if (numbers.length === 0) return false; // Should not happen based on logic
  return numbers.every(c => c.marked);
};

export const checkBoardWin = (board: Board): number => {
  // Returns index of winning row, or -1 if no win
  for (let i = 0; i < board.rows.length; i++) {
    if (checkRowWin(board.rows[i])) {
      return i;
    }
  }
  return -1;
};