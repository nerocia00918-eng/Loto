export type CellData = {
  value: number | null; // null if the cell is empty (blocked)
  marked: boolean;
};

export type Row = CellData[];
export type Board = {
  id: string;
  rows: Row[];
};

export enum GameRole {
  NONE = 'NONE',
  HOST = 'HOST',
  PLAYER = 'PLAYER',
}

export enum GameStatus {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  ENDED = 'ENDED'
}

export type PlayerInfo = {
  id: string;
  name: string;
  isReady: boolean;
}

export type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  isSystem?: boolean; // For announcements like "Kinh!"
  timestamp: number;
};

// PeerJS Message Types
export type PeerMessage = 
  | { type: 'JOIN'; name: string }
  | { type: 'WELCOME'; gameState: GameStatus; calledNumbers: number[] }
  | { type: 'PLAYER_JOINED'; player: PlayerInfo }
  | { type: 'START_GAME' }
  | { type: 'NUMBER_DRAWN'; number: number }
  | { type: 'CHAT'; message: ChatMessage }
  | { type: 'WIN'; winnerName: string }
  | { type: 'RESET' };

export const TOTAL_NUMBERS = 60;
export const ROWS_PER_BOARD = 3;
export const COLS_PER_BOARD = 6;
export const NUMS_PER_ROW = 4;
export const BOARDS_PER_PLAYER = 5;

// Column ranges: Col 0 (1-10), Col 1 (11-20), etc.
export const getColRange = (colIndex: number) => {
  const start = colIndex * 10 + 1;
  const end = start + 9;
  return { start, end };
};