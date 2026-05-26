export type Color = 'red' | 'yellow' | 'blue' | 'green';
export type CardType = 'number' | 'skip' | 'reverse' | '+2';

export interface Card {
  id: string;
  color: Color;
  type: CardType;
  value?: number; // 0-9
}

export interface Player {
  id: string; // peerjs id or 'bot-x'
  name: string;
  isBot: boolean;
  hand: Card[];
  debuffs: string[];
  buffs: string[];
  points: number;
  online: boolean; // For multiplayer dropping
}

export type GamePhase = 'lobby' | 'playing' | 'debuff_choice' | 'shop' | 'game_over';

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  discardPile: Card[];
  currentColor: Color;
  winner: string | null;
  
  shopBuffs: string[];
  currentShopper: string | null;
  
  pendingDebuff: string | null;
  pendingDebuffPlayer: string | null;
  
  isChallengeMode: boolean;
  difficulty: number;
  
  history: string[];
  
  nextPlayerMustDraw: number; // accumulated +2s, though in this game +2 doesn't stack per rules? Wait, UNO rules usually +2 doesn't stack unless specified. Let's assume no stacking, just next player draws.
  skipNext: number; // how many people to skip
}

export interface DebuffDef {
  id: string;
  desc: string;
  point: number;
  excludeSingle?: boolean;
}

export interface BuffDef {
  id: string;
  desc: string;
  point: number;
  excludeSingle?: boolean;
}

export const DEBUFFS: DebuffDef[] = [
  { id: 'D01', desc: '你去除“可出颜色相同的牌”的出牌规则。', point: 3 },
  { id: 'D02', desc: '你获得debuff时不能拒绝。', point: 3, excludeSingle: true },
  { id: 'D03', desc: '当你触发clear时，兑换积分的流程改为“仅移除该debuff并获得其点数积分”。', point: 3, excludeSingle: true },
  { id: 'D04', desc: '你被动摸牌时，摸到的牌颜色必定与弃牌堆顶不同。', point: 3 },
  { id: 'D05', desc: '当你触发clear时，移除“开启一次Buff商店”的流程', point: 2, excludeSingle: true },
  { id: 'D06', desc: '你去除“可出同类牌”的出牌规则。', point: 2 },
  { id: 'D07', desc: '你的所有摸牌只可能抽出数字牌。', point: 2 },
  { id: 'D08', desc: '你的回合结束时，若你的debuff数量<=4，摸1张牌。', point: 2, excludeSingle: true },
  { id: 'D09', desc: '你的回合结束时，若你的debuff数量>4，移除你的所有debuff（不获得积分）。', point: 2, excludeSingle: true },
  { id: 'D10', desc: '你的回合结束时，若手牌数为全场最少，摸1张牌。', point: 2 },
  { id: 'D11', desc: '你的回合结束时，若手牌数不为全场最少，摸1张牌。', point: 2 },
  { id: 'D12', desc: '任意玩家在Buff商店购买一张牌时，你摸2张牌。', point: 2, excludeSingle: true },
  { id: 'D13', desc: '任意玩家触发clear时，你摸3张牌。', point: 2, excludeSingle: true },
  { id: 'D14', desc: '获得时立即摸6张牌（仅触发一次）。', point: 2, excludeSingle: true },
  { id: 'D15', desc: '你触发额外摸牌的效果时，你额外摸1张牌（该摸牌不会触发该效果）。', point: 2 },
  { id: 'D16', desc: '获得时立即摸3张牌（仅触发一次）。', point: 1, excludeSingle: true },
  { id: 'D17', desc: '其他玩家主动摸牌时，你额外摸1张牌。', point: 1 },
  { id: 'D18', desc: '其他玩家被动摸牌时，你额外摸2张牌。', point: 1 },
  { id: 'D19', desc: '你主动摸牌时额外摸1张牌。', point: 1 },
  { id: 'D20', desc: '你被动摸牌时额外摸2张牌。', point: 1 },
  { id: 'D21', desc: '你打出技能牌时额外摸1张牌。', point: 1 },
  { id: 'D22', desc: '你打出【+2】时额外摸2张牌。', point: 1 },
  { id: 'D23', desc: '你打出【反转】时额外摸2张牌。', point: 1 },
  { id: 'D24', desc: '你打出【跳过】时额外摸2张牌。', point: 1 },
  { id: 'D25', desc: '你的回合被跳过时，额外摸1张牌。', point: 1 },
  { id: 'D26', desc: '你的回合开始时，若你能打出的牌恰好为1张，则本回合结束时额外摸1张牌。', point: 1 },
];

export const BUFFS: BuffDef[] = [
  { id: 'B01', desc: '你打出数字`0`时，跳过下一名玩家的回合。', point: 2 },
  { id: 'B02', desc: '你打出数字`0`时，下一名玩家摸4张牌。', point: 2 },
  { id: 'B03', desc: '你打出数字`9`时，跳过下一名玩家的回合。', point: 2 },
  { id: 'B04', desc: '你打出【+2】时，下一名玩家额外摸2张牌。', point: 2 },
  { id: 'B05', desc: '你被【+2】时，你改为只摸1张牌。', point: 2 },
  { id: 'B06', desc: '你被【+2】时，打出该牌的玩家摸2张牌。', point: 2 },
  { id: 'B07', desc: '你的回合被跳过时，你跳过下一名玩家的回合。', point: 2 },
  { id: 'B08', desc: '你打出【反转】并反转方向后，下一名玩家摸2张牌。', point: 2 },
  { id: 'B09', desc: '你摸牌时，牌堆中所有技能牌的权重翻倍。', point: 2 },
  { id: 'B10', desc: '你摸牌时，牌堆中所有【+2】牌的权重翻倍。', point: 2 },
  { id: 'B11', desc: '你触发clear时，你的所有点数为1的debuff视为点数2', point: 3, excludeSingle: true },
  { id: 'B12', desc: '你被【+2】时，除你之外的所有玩家各摸1张牌。', point: 3 },
  { id: 'B13', desc: '你的Debuff触发判定概率+25%。', point: 3, excludeSingle: true },
  { id: 'B14', desc: '你的clear判定概率+20%。', point: 3, excludeSingle: true },
  { id: 'B15', desc: '你出牌时，将所有技能牌视为同类牌。', point: 3 },
  { id: 'B16', desc: '你打出数字`7`时，下一名玩家摸4张牌。', point: 3 },
  { id: 'B17', desc: '你打出【跳过】时，下一名玩家摸2张牌。', point: 3 },
  { id: 'B18', desc: '你的回合结束时，若手牌数为全场最多，所有手牌数最少的玩家各摸1张牌。', point: 4 },
  { id: 'B19', desc: '你出牌时，将数字之差绝对值为1的数字牌视为同类牌。', point: 4 },
  { id: 'B20', desc: '当你手牌数变为1时，你立即获胜。', point: 4 },
];

export type ActionParams = {
  PlayCard: { cardId: string, choosenColor?: Color }; // e.g. for wild cards, though standard Uno here doesn't have wild cards but let's be safe. Wait, only Red/Yellow/Blue/Green in base rules.
  DrawCard: {};
  AcceptDebuff: { accept: boolean };
  BuyBuffs: { buffIds: string[] };
  StartGame: { isChallenge: boolean, selectedDebuffs?: string[], selectedBuffs?: string[] };
  KickPlayer: { playerId: string };
};

export type PlayerAction = 
  | { type: 'PlayCard', playerId: string; payload: ActionParams['PlayCard'] }
  | { type: 'DrawCard', playerId: string; payload: ActionParams['DrawCard'] }
  | { type: 'AcceptDebuff', playerId: string; payload: ActionParams['AcceptDebuff'] }
  | { type: 'BuyBuffs', playerId: string; payload: ActionParams['BuyBuffs'] }
  | { type: 'StartGame', playerId: string; payload: ActionParams['StartGame'] }
  | { type: 'KickPlayer', playerId: string; payload: ActionParams['KickPlayer'] }
  | { type: 'AddBot', playerId: string; payload: { botName: string } }
  | { type: 'JOIN', playerId: string, payload: { name: string } }
  | { type: 'LEAVE', playerId: string, payload: {} };
