/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';

export default function App() {
  const { gameState } = useGameStore();

  return (
    <div className="min-h-screen bg-black">
      {(!gameState || gameState.phase === 'lobby') ? <Lobby /> : <GameScreen />}
    </div>
  );
}
