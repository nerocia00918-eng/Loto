import { Card, Rank, Suit } from "../types";

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, isHidden: true });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

// Điểm số: 0-9 (Bù -> 9 nút). 
// 10: Ba Tây (3 lá J,Q,K bất kỳ). 
// 11: Sáp (3 lá giống nhau).
export const calculateScore = (hand: Card[]): { score: number, text: string } => {
  if (hand.length !== 3) return { score: 0, text: '?' };

  const ranks = hand.map(c => c.rank);
  
  // Check Sáp (3 of a kind)
  if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
     // Sáp A là to nhất, Sáp 2 nhỏ nhất (tuỳ luật, ở đây để chung là Sáp)
     return { score: 11, text: `SÁP ${ranks[0]}` };
  }

  // Check Ba Tây (3 Face cards: J, Q, K)
  const isFace = (r: Rank) => ['J', 'Q', 'K'].includes(r);
  if (hand.every(c => isFace(c.rank))) {
      return { score: 10, text: 'BA TÂY' };
  }

  // Calculate Points
  let total = 0;
  for (const card of hand) {
      if (['J', 'Q', 'K', '10'].includes(card.rank)) {
          total += 0; // or 10, mod 10 is 0
      } else if (card.rank === 'A') {
          total += 1;
      } else {
          total += parseInt(card.rank);
      }
  }
  
  const finalScore = total % 10;
  const scoreText = finalScore === 0 ? 'BÙ' : `${finalScore} NÚT`;
  
  return { score: finalScore, text: scoreText };
};