import { useGameStore } from '../store/gameStore';
import { CardView } from './CardView';
import { DEBUFFS, BUFFS, Color, Card } from '../types';
import { useEffect, useState } from 'react';

export function GameScreen() {
  const { gameState, sendAction, myId, isHost, hostDispatch } = useGameStore();

  if (!gameState) return null;

  const me = gameState.players.find(p => p.id === myId);
  const myIndex = gameState.players.findIndex(p => p.id === myId);
  const opponents = [];
  for(let i=1; i<gameState.players.length; i++) {
     opponents.push(gameState.players[(myIndex + i) % gameState.players.length]);
  }
  const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentTurnPlayer?.id === myId && gameState.phase === 'playing';

  // AI execution logic
  useEffect(() => {
     if (!isHost) return;

     const activeBot = gameState.phase === 'playing' ? currentTurnPlayer 
                     : gameState.phase === 'debuff_choice' ? gameState.players.find(p => p.id === gameState.pendingDebuffPlayer)
                     : gameState.phase === 'shop' ? gameState.players.find(p => p.id === gameState.currentShopper) : null;

     if (activeBot && activeBot.isBot) {
        const timer = setTimeout(() => {
           if (gameState.phase === 'debuff_choice') {
              // bot rejects debuff if possible, else accepts
              const accept = Math.random() > 0.5;
              if (hostDispatch) hostDispatch({ type: 'AcceptDebuff', playerId: activeBot.id, payload: { accept } });
           } else if (gameState.phase === 'shop') {
              const canBuy: string[] = [];
              let total = 0;
              for (let id of gameState.shopBuffs) {
                 const b = BUFFS.find(x => x.id === id);
                 if (b && total + b.point <= activeBot.points) {
                    canBuy.push(id);
                    total += b.point;
                 }
              }
              if (hostDispatch) hostDispatch({ type: 'BuyBuffs', playerId: activeBot.id, payload: { buffIds: canBuy } });
           } else if (gameState.phase === 'playing') {
              const bot = activeBot;
              const topCard = gameState.discardPile[gameState.discardPile.length - 1];
              
              let played = false;
              for(let card of bot.hand) {
                 const hasBuffOrDebuff = (p: any, id: string) => p.buffs.includes(id) || p.debuffs.includes(id);
                 let canPlayColor = !hasBuffOrDebuff(bot, 'D01') && card.color === gameState.currentColor;
                 let canPlayType = false;
                 if (!hasBuffOrDebuff(bot, 'D06')) {
                    if (card.type === 'number' && topCard.type === 'number') {
                       if (card.value === topCard.value) canPlayType = true;
                       if (hasBuffOrDebuff(bot, 'B19') && Math.abs((card.value||0) - (topCard.value||0)) === 1) canPlayType = true;
                    } else if (card.type !== 'number' && topCard.type !== 'number') {
                       if (card.type === topCard.type) canPlayType = true;
                       if (hasBuffOrDebuff(bot, 'B15')) canPlayType = true;
                    }
                 }
                 let canPlay = canPlayColor || canPlayType;
                 
                 if (canPlay) {
                    if (hostDispatch) {
                       hostDispatch({ type: 'PlayCard', playerId: bot.id, payload: { cardId: card.id } });
                    }
                    played = true;
                    break;
                 }
              }
              if (!played) {
                 if (hostDispatch) {
                    hostDispatch({ type: 'DrawCard', playerId: bot.id, payload: {} });
                 }
              }
           }
        }, 1500);
        return () => clearTimeout(timer);
     }
  }, [gameState.currentPlayerIndex, gameState.phase, gameState.pendingDebuffPlayer, gameState.currentShopper, isHost]);

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="flex flex-col min-h-screen bg-neutral-900 text-white overflow-hidden relative">
      {/* Top: Opponents */}
      <div className="flex flex-1 justify-around items-start p-4 pt-8">
         {opponents.map(opp => (
            <div key={opp.id} className={`flex flex-col items-center bg-neutral-800 p-4 rounded-xl border-2 transition-colors ${gameState.players[gameState.currentPlayerIndex].id === opp.id ? 'border-red-500 bg-red-900/20' : 'border-transparent'}`}>
               <span className="font-bold text-lg mb-2">{opp.name} {opp.isBot && '(AI)'}</span>
               <div className="flex gap-[-20px]">
                  {Array.from({length: opp.hand.length}).map((_, i) => (
                     <div key={i} className="-ml-6 first:ml-0 w-12 h-16 bg-neutral-900 border-2 border-neutral-700 rounded-md shadow-md" />
                  ))}
               </div>
               <span className="mt-2 text-sm text-neutral-400">手牌: {opp.hand.length} | 积分: {opp.points}</span>
               <div className="flex flex-wrap gap-1 mt-2 justify-center max-w-xs">
                  {opp.debuffs.map(d => {
                     const def = DEBUFFS.find(x=>x.id===d);
                     return <span key={d} className="text-xs bg-red-900/50 text-red-300 px-2 rounded-full border border-red-700" title={def?.desc}>{d} [{def?.point}]</span>
                  })}
                  {opp.buffs.map(b => <span key={b} className="text-xs bg-blue-900/50 text-blue-300 px-2 rounded-full border border-blue-700" title={BUFFS.find(x=>x.id===b)?.desc}>{b}</span>)}
               </div>
            </div>
         ))}
      </div>

      {/* Middle: Center Pile & Deck */}
      <div className="flex-[2] flex flex-col items-center justify-center relative">
         <div className="flex items-center gap-8">
            <div className="flex flex-col items-center">
               <button 
                  onClick={() => isMyTurn && sendAction({ type: 'DrawCard', payload: {} })}
                  className={`w-24 h-36 rounded-xl border-4 bg-neutral-800 border-neutral-700 shadow-xl flex items-center justify-center transition-transform ${isMyTurn ? 'hover:-translate-y-2 cursor-pointer border-white' : 'opacity-80'}`}
               >
                  <span className="text-4xl font-black text-neutral-600">UNO</span>
               </button>
               {isMyTurn && <span className="mt-4 font-bold text-lg animate-pulse text-white">主动摸牌</span>}
            </div>
            
            <div className="flex flex-col items-center">
               {topCard && (
                  <CardView card={topCard} disabled className="shadow-2xl scale-110" />
               )}
            </div>
         </div>
         
         <div className="absolute left-8 top-0 bottom-0 w-64 p-4 overflow-y-auto bg-neutral-800/50 rounded-xl border border-neutral-700">
            <h3 className="font-bold mb-2 text-neutral-300 border-b border-neutral-700 pb-2">游戏日志</h3>
            <div className="flex flex-col gap-1 text-sm text-neutral-400 font-mono">
               {gameState.history.slice(-20).map((log, i) => (
                  <div key={i}>{log}</div>
               ))}
               <div className="h-4" /> {/* spacer */}
            </div>
         </div>
      </div>

      {/* Bottom: My Hand */}
      <div className="flex-1 flex flex-col items-center justify-end p-8 pb-12 bg-neutral-800/80 rounded-t-3xl border-t border-neutral-700">
         <div className="flex gap-8 items-center mb-6 w-full max-w-4xl px-8">
            <div className="flex-1">
               <h2 className="text-2xl font-bold">{me?.name}</h2>
               <div className="text-neutral-400 text-sm mt-1">
                  积分: <span className="font-mono text-yellow-500 font-bold">{me?.points}</span> 
                  <span className="mx-2">|</span> 
                  手牌: <span className="font-bold">{me?.hand.length}</span>
               </div>
            </div>
            {gameState.phase === 'playing' && (
               <div className={`text-xl font-bold px-6 py-2 rounded-full border-2 ${isMyTurn ? 'border-green-500 text-green-400 bg-green-900/30' : 'border-neutral-600 text-neutral-500'}`}>
                  {isMyTurn ? '你的回合' : `等待 ${currentTurnPlayer?.name}...`}
               </div>
            )}
            <div className="flex-1 flex flex-col items-end">
               <div className="flex gap-2 flex-wrap justify-end">
                  {me?.debuffs.map(d => (
                     <div key={d} className="bg-red-950 border border-red-700 text-red-300 px-3 py-1 rounded-md text-xs group relative">
                        {d} [{DEBUFFS.find(x=>x.id===d)?.point}]
                        <div className="hidden group-hover:block absolute bottom-full mb-2 right-0 w-48 bg-black p-2 rounded text-white z-50">{DEBUFFS.find(x=>x.id===d)?.desc}</div>
                     </div>
                  ))}
               </div>
               <div className="flex gap-2 flex-wrap justify-end mt-2">
                  {me?.buffs.map(b => (
                     <div key={b} className="bg-blue-950 border border-blue-700 text-blue-300 px-3 py-1 rounded-md text-xs group relative">
                        {b}
                        <div className="hidden group-hover:block absolute bottom-full mb-2 right-0 w-48 bg-black p-2 rounded text-white z-50">{BUFFS.find(x=>x.id===b)?.desc}</div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
         
         <div className="flex flex-wrap justify-center gap-2 max-w-6xl">
            {me?.hand.map(card => (
               <CardView 
                  key={card.id} 
                  card={card} 
                  disabled={!isMyTurn}
                  onClick={() => sendAction({ type: 'PlayCard', payload: { cardId: card.id } })}
               />
            ))}
         </div>
      </div>
      
      {/* Modals */}
      {gameState.phase === 'debuff_choice' && gameState.pendingDebuffPlayer === myId && (
         <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-neutral-800 border-2 border-red-900 p-8 rounded-2xl max-w-md text-center shadow-2xl">
               <h2 className="text-3xl font-bold text-red-500 mb-2">获取 Debuff</h2>
               <p className="text-neutral-400 mb-6">回合结束触发判定</p>
               
               <div className="bg-red-950 border border-red-800 p-4 rounded-xl text-red-200 mb-8 font-medium relative">
                  <span className="absolute -top-3 -right-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">+{DEBUFFS.find(d => d.id === gameState.pendingDebuff)?.point} 分</span>
                  [{gameState.pendingDebuff}] {DEBUFFS.find(d => d.id === gameState.pendingDebuff)?.desc}
               </div>
               
               <div className="flex gap-4">
                  <button 
                     onClick={() => sendAction({ type: 'AcceptDebuff', payload: { accept: true } })}
                     className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg"
                  >
                     接受
                  </button>
                  <button 
                     onClick={() => sendAction({ type: 'AcceptDebuff', payload: { accept: false } })}
                     className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white font-bold py-3 rounded-lg"
                  >
                     拒绝
                  </button>
               </div>
            </div>
         </div>
      )}

      {gameState.phase === 'shop' && gameState.currentShopper === myId && (
         <ShopModal />
      )}
      
      {gameState.phase === 'game_over' && (
         <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="text-center">
               <h1 className="text-6xl font-black mb-8 text-yellow-500 drop-shadow-xl p-4">
                  {gameState.winner === myId ? '胜利！' : (gameState.players.find(p=>p.id===gameState.winner)?.name + ' 赢了')}
               </h1>
               
               {gameState.isChallengeMode && (
                  <div className="text-2xl text-neutral-300 font-bold mb-8">
                     挑战难度: <span className="text-red-500">{gameState.difficulty}</span>
                  </div>
               )}
               
               {isHost && (
                  <button 
                     onClick={() => {
                        window.location.reload(); // Simple restart for hacky state reset since it drops peers if we leave. But actually reloading completely clears. For now this is fine.
                     }}
                     className="bg-white text-black font-bold py-4 px-12 rounded-full text-xl hover:bg-neutral-200 transition-colors shadow-2xl"
                  >
                     再来一局
                  </button>
               )}
            </div>
         </div>
      )}
    </div>
  );
}

function ShopModal() {
   const { gameState, sendAction, myId } = useGameStore();
   const [selected, setSelected] = useState<string[]>([]);
   
   if (!gameState) return null;
   const me = gameState.players.find(p => p.id === myId);
   const currentPoints = me?.points || 0;
   
   const totalCost = selected.map(id => BUFFS.find(b=>b.id===id)?.point || 0).reduce((a,b)=>a+b, 0);

   const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

   return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
         <div className="bg-neutral-800 border-2 border-blue-900 p-8 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[80vh]">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-3xl font-bold text-blue-400">Buff 商店</h2>
               <div className="text-xl text-neutral-300">
                  拥有积分: <span className="font-mono text-yellow-500 font-bold">{currentPoints}</span>
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4 place-content-start">
               {gameState.shopBuffs.map(id => {
                  const b = BUFFS.find(x => x.id === id);
                  if (!b) return null;
                  const isSel = selected.includes(id);
                  const canAfford = currentPoints >= totalCost + (isSel ? 0 : b.point);
                  
                  return (
                     <button
                        key={id}
                        onClick={() => toggle(id)}
                        disabled={!isSel && !canAfford}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${isSel ? 'bg-blue-900/50 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500'} ${(!isSel && !canAfford) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                     >
                        <div className="flex justify-between font-bold mb-2">
                           <span className={isSel ? 'text-blue-300' : 'text-neutral-300'}>{b.id}</span>
                           <span className="text-yellow-500 font-mono">{b.point} 积分</span>
                        </div>
                        <div className="text-neutral-400 text-sm">{b.desc}</div>
                     </button>
                  )
               })}
            </div>
            
            <div className="mt-6 pt-6 border-t border-neutral-700 flex justify-between items-center">
               <div className="text-lg">
                  总花费: <span className="font-mono text-yellow-500 font-bold">{totalCost}</span>
               </div>
               <div className="flex gap-4">
                  <button 
                     onClick={() => sendAction({ type: 'BuyBuffs', payload: { buffIds: [] } })}
                     className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold py-3 px-8 rounded-lg"
                  >
                     跳过购买
                  </button>
                  <button 
                     onClick={() => sendAction({ type: 'BuyBuffs', payload: { buffIds: selected } })}
                     disabled={totalCost > currentPoints}
                     className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-lg"
                  >
                     确认购买
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
}
