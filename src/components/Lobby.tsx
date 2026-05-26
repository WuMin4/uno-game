import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { generateRoomId } from '../lib/utils';
import { GameEngine } from '../engine/GameEngine';
import { DEBUFFS, BUFFS } from '../types';

export function Lobby() {
  const { initHost, initLocal, joinRoom, setHostDispatch, broadcastState, isHost, gameState, sendAction } = useGameStore();

  const [entryMode, setEntryMode] = useState<'select' | 'multi-setup' | 'single-setup'>('select');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  
  // Single player selections
  const [selectedDebuffs, setSelectedDebuffs] = useState<string[]>([]);
  const [selectedBuffs, setSelectedBuffs] = useState<string[]>([]);

  const handleCreate = async () => {
    if (!name) return;
    const roomId = generateRoomId();
    await initHost(roomId, name);
    const engine = new GameEngine(roomId, broadcastState);
    setHostDispatch((action) => engine.dispatch(action));
    engine.dispatch({ type: 'JOIN', playerId: name, payload: { name } } as any);
  };

  const handleJoin = async () => {
    if (!name || joinCode.length < 6) return;
    await joinRoom(joinCode, name);
  };
  
  const handleStartSingle = () => {
    if (!name) return;
    initLocal(name);
    const engine = new GameEngine('单人挑战', broadcastState);
    setHostDispatch((action) => engine.dispatch(action));
    engine.dispatch({ type: 'JOIN', playerId: name, payload: { name } } as any);
    
    // Add 3 AI Bots for single player challenge
    engine.dispatch({ type: 'AddBot', playerId: name, payload: { botName: 'AI - 铁卫' } } as any);
    engine.dispatch({ type: 'AddBot', playerId: name, payload: { botName: 'AI - 术士' } } as any);
    engine.dispatch({ type: 'AddBot', playerId: name, payload: { botName: 'AI - 重装' } } as any);

    engine.dispatch({
       type: 'StartGame',
       playerId: name,
       payload: { 
          isChallenge: true,
          selectedDebuffs,
          selectedBuffs 
       }
    } as any);
  };

  const handleStartMulti = () => {
     sendAction({
        type: 'StartGame',
        payload: { 
           isChallenge: false,
        }
     });
  };

  const difficulty = selectedDebuffs.map(id => DEBUFFS.find(d=>d.id===id)?.point||0).reduce((a,b)=>a+b,0)
                   + selectedBuffs.map(id => (BUFFS.find(b=>b.id===id)?.point||1)-1).reduce((a,b)=>a+b,0);

  const toggleDebuff = (id: string) => setSelectedDebuffs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleBuff = (id: string) => setSelectedBuffs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white p-4">
        <h1 className="text-5xl font-black mb-12 tracking-tighter drop-shadow-lg text-white">UNO · <span className="text-red-500">危机合约</span></h1>
        
        {entryMode === 'select' && (
           <div className="flex flex-col gap-6 w-full max-w-sm">
              <button 
                 onClick={() => setEntryMode('single-setup')}
                 className="bg-neutral-800 hover:bg-neutral-700 border-2 border-red-900/50 hover:border-red-500 transition-colors py-6 rounded-2xl shadow-xl flex flex-col items-center"
              >
                 <span className="text-2xl font-bold mb-2">单人挑战</span>
                 <span className="text-neutral-400 text-sm">选择词条，应对 AI</span>
              </button>
              
              <button 
                 onClick={() => setEntryMode('multi-setup')}
                 className="bg-neutral-800 hover:bg-neutral-700 border-2 border-blue-900/50 hover:border-blue-500 transition-colors py-6 rounded-2xl shadow-xl flex flex-col items-center"
              >
                 <span className="text-2xl font-bold mb-2">多人对战</span>
                 <span className="text-neutral-400 text-sm">局域网联机对抗 (2-4人)</span>
              </button>
           </div>
        )}

        {entryMode === 'single-setup' && (
           <div className="bg-neutral-800 p-8 rounded-2xl w-full max-w-2xl space-y-6 shadow-2xl relative">
              <button onClick={() => setEntryMode('select')} className="absolute top-4 left-4 text-neutral-400 hover:text-white">← 返回</button>
              <h2 className="text-3xl font-bold text-center mt-2 mb-6 text-red-400">配置挑战</h2>
              <div>
                 <label className="block text-sm font-medium mb-2 text-neutral-400">你的名字</label>
                 <input 
                   value={name} onChange={e => setName(e.target.value)} 
                   className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 outline-none focus:border-red-500 transition-colors"
                   placeholder="输入你的昵称..."
                 />
              </div>
              <div className="bg-neutral-900 p-4 rounded-lg flex flex-col gap-4 max-h-96 overflow-y-auto">
                 <div>
                    <h4 className="font-bold text-red-500 mb-2 border-b border-red-900/50 pb-2">你的 Debuff (难度 +点数)</h4>
                    {DEBUFFS.filter(d => !d.excludeSingle).map(d => (
                       <label key={d.id} className="flex items-start gap-3 text-sm text-neutral-300 py-2 hover:text-white cursor-pointer hover:bg-white/5 px-2 rounded-lg transition-colors">
                          <input type="checkbox" className="mt-1 flex-shrink-0" checked={selectedDebuffs.includes(d.id)} onChange={() => toggleDebuff(d.id)} />
                          <span className="font-mono text-yellow-500 w-8 flex-shrink-0">[{d.point}]</span> 
                          <span>{d.desc}</span>
                       </label>
                    ))}
                 </div>
                 <div>
                    <h4 className="font-bold text-blue-500 mb-2 border-b border-blue-900/50 pb-2">AI 的 Buff (难度 +点数-1)</h4>
                    {BUFFS.filter(b => !b.excludeSingle).map(b => (
                       <label key={b.id} className="flex items-start gap-3 text-sm text-neutral-300 py-2 hover:text-white cursor-pointer hover:bg-white/5 px-2 rounded-lg transition-colors">
                          <input type="checkbox" className="mt-1 flex-shrink-0" checked={selectedBuffs.includes(b.id)} onChange={() => toggleBuff(b.id)} />
                          <span className="font-mono text-yellow-500 w-8 flex-shrink-0">[{b.point-1}]</span>
                          <span>{b.desc}</span>
                       </label>
                    ))}
                 </div>
              </div>
              <div className="flex justify-between items-center bg-neutral-950 p-4 rounded-xl border border-neutral-700">
                 <div className="font-bold">
                    综合难度评级: <span className="text-3xl text-red-500 font-black tracking-wider ml-2">{difficulty}</span>
                 </div>
                 <button 
                    onClick={handleStartSingle} disabled={!name}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-lg shadow-lg"
                 >
                    开始战斗
                 </button>
              </div>
           </div>
        )}

        {entryMode === 'multi-setup' && (
           <div className="bg-neutral-800 p-8 rounded-2xl w-full max-w-md space-y-6 shadow-2xl relative">
              <button onClick={() => setEntryMode('select')} className="absolute top-4 left-4 text-neutral-400 hover:text-white">← 返回</button>
              <h2 className="text-3xl font-bold text-center mt-2 mb-6 text-blue-400">多人联机</h2>
              <div>
                 <label className="block text-sm font-medium mb-2 text-neutral-400">你的名字</label>
                 <input 
                   value={name} onChange={e => setName(e.target.value)} 
                   className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 outline-none focus:border-blue-500 transition-colors"
                   placeholder="输入随机昵称"
                 />
              </div>
              <div className="pt-4 border-t border-neutral-700">
                 <button 
                   onClick={handleCreate} disabled={!name}
                   className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg mb-4"
                 >
                   创建房间
                 </button>
                 <div className="flex gap-2 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-800 px-2 text-xs text-neutral-500">或者</div>
                 </div>
                 <div className="flex gap-2 mt-4">
                   <input 
                     value={joinCode} onChange={e => setJoinCode(e.target.value)}
                     className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg p-3 outline-none focus:border-green-500 text-center tracking-widest font-mono"
                     placeholder="6位房间号"
                     maxLength={6}
                   />
                   <button 
                     onClick={handleJoin} disabled={!name || joinCode.length < 6}
                     className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-6 rounded-lg"
                   >
                     加入
                   </button>
                 </div>
              </div>
           </div>
        )}
      </div>
    );
  }

  // Inside Multiplayer Lobby room
  return (
    <div className="flex flex-col items-center min-h-screen bg-neutral-900 text-white p-8">
       <div className="w-full max-w-2xl bg-neutral-800 p-8 rounded-2xl shadow-2xl">
          <div className="flex justify-between items-center mb-8 border-b border-neutral-700 pb-4">
             <div>
                <h2 className="text-3xl font-bold">房间号: <span className="text-blue-500 tracking-widest">{gameState.roomId}</span></h2>
                <div className="text-sm text-neutral-400 mt-1">其他人可通过此房间号加入</div>
             </div>
             <div className="text-xl font-bold text-neutral-300 bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-700">
                玩家: {gameState.players.length}/4
             </div>
          </div>
          
          <div className="mb-8">
             <div className="flex justify-between items-end mb-4">
                <h3 className="text-xl font-bold text-neutral-300">玩家列表</h3>
                {isHost && gameState.players.length < 4 && (
                   <button 
                      onClick={() => sendAction({ type: 'AddBot', payload: { botName: `人机 ${gameState.players.length + 1}` } })}
                      className="text-sm bg-neutral-700 hover:bg-neutral-600 px-3 py-1 rounded text-white"
                   >
                      + 添加人机
                   </button>
                )}
             </div>
             <div className="space-y-2">
                {gameState.players.map(p => (
                   <div key={p.id} className="bg-neutral-900 p-4 rounded-lg flex justify-between items-center border border-neutral-700">
                      <span className="font-medium flex items-center gap-2">
                         {p.name} 
                         {p.id === useGameStore.getState().myId && <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">你</span>}
                         {p.isBot && <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded">AI</span>}
                         {p.id === gameState.players[0].id && <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded">房主</span>}
                      </span>
                      {isHost && p.id !== useGameStore.getState().myId && (
                         <button 
                            onClick={() => sendAction({ type: 'KickPlayer', payload: { playerId: p.id } })}
                            className="text-red-500 hover:text-red-400 text-sm"
                         >
                            踢出
                         </button>
                      )}
                   </div>
                ))}
                {Array.from({length: 4 - gameState.players.length}).map((_, i) => (
                   <div key={i} className="bg-neutral-900/50 border border-neutral-700/50 p-4 rounded-lg flex justify-between items-center border-dashed">
                      <span className="text-neutral-500">等待加入...</span>
                   </div>
                ))}
             </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t border-neutral-700">
             {isHost ? (
                <button 
                   onClick={handleStartMulti}
                   disabled={gameState.players.length < 2}
                   className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg"
                >
                   {gameState.players.length < 2 ? '至少需要两名玩家' : '开始游戏'}
                </button>
             ) : (
                <div className="flex items-center justify-center text-neutral-400 bg-neutral-900 px-6 py-3 rounded-lg border border-neutral-700">
                   等待房主开始游戏...
                </div>
             )}
          </div>
       </div>
    </div>
  );
}
