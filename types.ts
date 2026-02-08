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

export enum AppMode {
  MENU = 'MENU',
  LOTO = 'LOTO',
  CARD = 'CARD' // Bài cào
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

export type ClaimData = {
  playerName: string;
  board: Board;
}

// --- CARD GAME TYPES ---
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type Card = {
  suit: Suit;
  rank: Rank;
  isHidden: boolean;
};

export type CardPlayer = PlayerInfo & {
  hand: Card[];
  isRevealed: boolean;
  score?: number; // 0-9, 10 (Ba Tây), 11 (Sáp)
  scoreText?: string;
};

// PeerJS Message Types
export type PeerMessage = 
  // Common
  | { type: 'JOIN'; name: string }
  | { type: 'PLAYER_JOINED'; player: PlayerInfo }
  | { type: 'CHAT'; message: ChatMessage }
  | { type: 'RESET' }
  // Loto
  | { type: 'WELCOME'; gameState: GameStatus; calledNumbers: number[] }
  | { type: 'START_GAME' }
  | { type: 'NUMBER_DRAWN'; number: number }
  | { type: 'CLAIM_WIN'; claim: ClaimData }
  | { type: 'CLAIM_REJECTED' }
  | { type: 'WIN'; winnerName: string }
  // Card Game
  | { type: 'CARD_WELCOME'; players: CardPlayer[]; gameState: GameStatus }
  | { type: 'CARD_DEAL'; hands: Record<string, Card[]> } // map peerId -> cards
  | { type: 'CARD_REVEAL'; peerId: string; hand: Card[] }
  | { type: 'CARD_REVEAL_ALL' } // Host force reveal
  | { type: 'CARD_RESULT'; winnerId: string }
  ;

export const TOTAL_NUMBERS = 60;
export const ROWS_PER_BOARD = 3;
export const COLS_PER_BOARD = 6;
export const NUMS_PER_ROW = 4;
export const BOARDS_PER_PLAYER = 5;

// Strict Column ranges based on user request
export const getColRange = (colIndex: number) => {
  switch (colIndex) {
    case 0: // Cột 1: 1 - 9
      return { start: 1, end: 9 };
    case 1: // Cột 2: 10 - 19
      return { start: 10, end: 19 };
    case 2: // Cột 3: 20 - 29
      return { start: 20, end: 29 };
    case 3: // Cột 4: 30 - 39
      return { start: 30, end: 39 };
    case 4: // Cột 5: 40 - 49
      return { start: 40, end: 49 };
    case 5: // Cột 6: 50 - 60
      return { start: 50, end: 60 };
    default:
      return { start: 1, end: 60 };
  }
};