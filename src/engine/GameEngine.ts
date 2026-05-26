import { GameState, PlayerAction, Player, Color, CardType, Card, BUFFS, DEBUFFS, ActionParams } from '../types';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export class GameEngine {
  state: GameState;
  broadcast: (state: GameState) => void;

  constructor(roomId: string, broadcast: (state: GameState) => void) {
    this.broadcast = broadcast;
    this.state = {
      roomId,
      phase: 'lobby',
      players: [],
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [],
      currentColor: 'red',
      winner: null,
      shopBuffs: [],
      currentShopper: null,
      pendingDebuff: null,
      pendingDebuffPlayer: null,
      isChallengeMode: false,
      difficulty: 0,
      history: [],
      nextPlayerMustDraw: 0,
      skipNext: 0
    };
  }

  log(msg: string) {
    this.state.history.push(`${new Date().toLocaleTimeString()} - ${msg}`);
  }

  dispatch(action: PlayerAction) {
    try {
      this.handleAction(action);
      this.checkWinCondition();
      this.broadcast(JSON.parse(JSON.stringify(this.state)));
    } catch (e) {
      console.error(e);
    }
  }

  private handleAction(action: PlayerAction) {
    const { playerId } = action;
    
    if (action.type === 'JOIN') {
      if (this.state.phase !== 'lobby') return;
      if (!this.state.players.find(p => p.id === playerId)) {
        this.state.players.push({
          id: playerId, name: action.payload.name, isBot: false,
          hand: [], buffs: [], debuffs: [], points: 0, online: true
        });
        this.log(`${action.payload.name} 加入了房间。`);
      }
      return;
    }

    if (action.type === 'LEAVE') {
      const p = this.state.players.find(p => p.id === playerId);
      if (p) {
        if (this.state.phase === 'lobby') {
          this.state.players = this.state.players.filter(p => p.id !== playerId);
        } else {
          p.online = false;
        }
        this.log(`${p.name} 离开了房间。`);
      }
      return;
    }

    if (action.type === 'KickPlayer') {
      if (this.state.phase === 'lobby') {
         this.state.players = this.state.players.filter(p => p.id !== action.payload.playerId);
         this.log(`玩家被踢出。`);
      }
      return;
    }

    if (action.type === 'AddBot') {
      if (this.state.phase === 'lobby') {
         const num = this.state.players.filter(p => p.isBot).length + 1;
         const botName = action.payload.botName || `Bot ${num}`;
         this.state.players.push({
            id: `bot-${generateId()}`, 
            name: botName, 
            isBot: true,
            hand: [], buffs: [], debuffs: [], points: 0, online: true
         });
         this.log(`${botName} 加入了房间。`);
      }
      return;
    }

    if (action.type === 'StartGame') {
      if (this.state.phase !== 'lobby') return;
      
      this.state.isChallengeMode = action.payload.isChallenge;
      if (this.state.isChallengeMode) {
        // Add 3 bots
        this.state.players = this.state.players.filter(p => !p.isBot); // clear old bots just in case
        for (let i = 1; i <= 3; i++) {
          this.state.players.push({ id: `bot-${i}`, name: `Bot ${i}`, isBot: true, hand: [], buffs: [], debuffs: [], points: 0, online: true });
        }
        
        // Apply selected debuffs to player, buffs to bots
        const human = this.state.players.find(p => !p.isBot);
        if (human) {
           action.payload.selectedDebuffs?.forEach(d => human.debuffs.push(d));
        }
        this.state.players.filter(p => p.isBot).forEach(bot => {
           action.payload.selectedBuffs?.forEach(b => bot.buffs.push(b));
        });
        
        const humanDebuffs = human?.debuffs.map(d => DEBUFFS.find(x => x.id===d)?.point || 0).reduce((a,b)=>a+b, 0) || 0;
        const botsBuffs = action.payload.selectedBuffs?.map(b => (BUFFS.find(x => x.id===b)?.point || 1) - 1).reduce((a,b)=>a+b, 0) || 0;
        
        this.state.difficulty = humanDebuffs + botsBuffs;
      }
      
      this.state.phase = 'playing';
      // Draw 7 cards for everyone
      this.state.players.forEach(p => {
        p.hand = [];
        this.drawCards(p.id, 7, true, 'obtain');
      });
      // First card
      let firstCard = this.generateCard(this.state.players[0], true);
      while(firstCard.type !== 'number') {
         firstCard = this.generateCard(this.state.players[0], true);
      }
      this.state.discardPile = [firstCard];
      this.state.currentColor = firstCard.color;
      this.state.currentPlayerIndex = Math.floor(Math.random() * this.state.players.length);
      this.log(`游戏开始！首张牌为 ${this.getCardName(firstCard)}。初始玩家: ${this.state.players[this.state.currentPlayerIndex].name}`);
      
      this.triggerStartTurnEffects();
      return;
    }

    if (this.state.phase === 'playing' && this.state.players[this.state.currentPlayerIndex].id === playerId) {
       if (action.type === 'PlayCard') {
          this.playCard(playerId, action.payload.cardId);
       } else if (action.type === 'DrawCard') {
          this.activeDraw(playerId);
       }
    } else if (this.state.phase === 'debuff_choice' && this.state.pendingDebuffPlayer === playerId) {
       if (action.type === 'AcceptDebuff') {
          this.resolveDebuffChoice(playerId, action.payload.accept);
       }
    } else if (this.state.phase === 'shop' && this.state.currentShopper === playerId) {
       if (action.type === 'BuyBuffs') {
          this.buyBuffs(playerId, action.payload.buffIds);
       }
    }
  }

  // --- CORE GAME ACTIONS ---
  
  private activeDraw(playerId: string) {
    const p = this.getPlayer(playerId);
    if (!p) return;
    
    // Draw card then skip
    let drawAmount = 1;
    if (this.hasBuffOrDebuff(p, 'D19')) drawAmount += 1;
    this.drawCards(playerId, drawAmount, false, 'active');
    
    // Other players effect
    this.state.players.forEach(other => {
      if (other.id !== playerId && this.hasBuffOrDebuff(other, 'D17')) {
         this.drawCards(other.id, 1, false, 'extra'); // wait, extra draw for other
      }
    });
    
    this.endTurn();
  }

  private playCard(playerId: string, cardId: string) {
    const p = this.getPlayer(playerId);
    if (!p) return;
    
    const cardIndex = p.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const card = p.hand[cardIndex];
    
    if (!this.canPlay(p, card)) {
       this.log(`${p.name} 尝试打出不合法的牌。`);
       return;
    }
    
    p.hand.splice(cardIndex, 1);
    this.state.discardPile.push(card);
    this.state.currentColor = card.color;
    
    this.log(`${p.name} 打出了 ${this.getCardName(card)}`);
    
    // Apply skills & Buffs
    this.applyPlayEffects(p, card);
    
    // Check win before ending turn, handled centrally, but if p's hand == 0, they win.
    if (p.hand.length === 0) {
      // Don't process end turn if they just won
       return;
    }
    
    this.endTurn();
  }

  private getPlayer(id: string) { return this.state.players.find(p => p.id === id); }

  private getCardName(c: Card) {
     const colorMap = { red: '红', yellow: '黄', blue: '蓝', green: '绿' };
     if (c.type === 'number') return `${colorMap[c.color]}${c.value}`;
     if (c.type === 'skip') return `${colorMap[c.color]}跳过`;
     if (c.type === 'reverse') return `${colorMap[c.color]}反转`;
     if (c.type === '+2') return `${colorMap[c.color]}+2`;
     return '未知';
  }

  private hasBuffOrDebuff(player: Player, id: string) {
     return player.buffs.includes(id) || player.debuffs.includes(id);
  }

  private canPlay(player: Player, card: Card): boolean {
    const topCard = this.state.discardPile[this.state.discardPile.length - 1];
    
    let canPlayColor = !this.hasBuffOrDebuff(player, 'D01') && card.color === this.state.currentColor;
    let canPlayType = false;
    
    if (!this.hasBuffOrDebuff(player, 'D06')) {
       if (card.type === 'number' && topCard.type === 'number') {
          if (card.value === topCard.value) canPlayType = true;
          if (this.hasBuffOrDebuff(player, 'B19') && Math.abs((card.value||0) - (topCard.value||0)) === 1) canPlayType = true;
       } else if (card.type !== 'number' && topCard.type !== 'number') {
          if (card.type === topCard.type) canPlayType = true;
          if (this.hasBuffOrDebuff(player, 'B15')) canPlayType = true;
       }
    }
    
    return canPlayColor || canPlayType;
  }

  private applyPlayEffects(player: Player, card: Card) {
     let nextDrawAmount = 0;
     let nextSkipAmount = 0;
     
     if (card.type === 'skip') {
        nextSkipAmount += 1;
        if (this.hasBuffOrDebuff(player, 'D24')) this.drawCards(player.id, 2, false, 'extra');
        if (this.hasBuffOrDebuff(player, 'B17')) nextDrawAmount += 2;
     } else if (card.type === 'reverse') {
        if (this.state.players.length === 2) {
           nextSkipAmount += 1; // 2 players: reverse = skip
        } else {
           this.state.direction *= -1;
        }
        if (this.hasBuffOrDebuff(player, 'D23')) this.drawCards(player.id, 2, false, 'extra');
        if (this.hasBuffOrDebuff(player, 'B08')) nextDrawAmount += 2;
     } else if (card.type === '+2') {
        nextDrawAmount += 2;
        if (this.hasBuffOrDebuff(player, 'D22')) this.drawCards(player.id, 2, false, 'extra');
        if (this.hasBuffOrDebuff(player, 'B04')) nextDrawAmount += 2; // +4 total
     } else if (card.type === 'number') {
        if (card.value === 0 && this.hasBuffOrDebuff(player, 'B01')) nextSkipAmount += 1;
        if (card.value === 0 && this.hasBuffOrDebuff(player, 'B02')) nextDrawAmount += 4;
        if (card.value === 9 && this.hasBuffOrDebuff(player, 'B03')) nextSkipAmount += 1;
        if (card.value === 7 && this.hasBuffOrDebuff(player, 'B16')) nextDrawAmount += 4;
     }

     if (card.type !== 'number' && this.hasBuffOrDebuff(player, 'D21')) {
        this.drawCards(player.id, 1, false, 'extra');
     }

     this.state.skipNext += nextSkipAmount;
     this.state.nextPlayerMustDraw += nextDrawAmount;
  }

  private generateCard(player: Player, isPassive: boolean): Card {
    const basePool: Card[] = [];
    const colors: Color[] = ['red', 'yellow', 'blue', 'green'];
    colors.forEach(col => {
      basePool.push({ id: '', color: col, type: 'number', value: 0 }); // weight 1
      for (let i = 1; i <= 9; i++) {
        basePool.push({ id: '', color: col, type: 'number', value: i }); // weight 2 internally, handled later
      }
      basePool.push({ id: '', color: col, type: 'skip' });
      basePool.push({ id: '', color: col, type: 'reverse' });
      basePool.push({ id: '', color: col, type: '+2' });
    });

    let pool = basePool.map(c => {
       let w = 2;
       if (c.type === 'number' && c.value === 0) w = 1;
       return { ...c, weight: w };
    });

    if (this.hasBuffOrDebuff(player, 'D07')) {
       pool = pool.filter(c => c.type === 'number');
    }

    if (isPassive && this.hasBuffOrDebuff(player, 'D04')) {
       pool = pool.filter(c => c.color !== this.state.currentColor);
       if (pool.length === 0) pool = basePool.map(c => ({...c, weight: 1})); // Fallback
    }

    if (this.hasBuffOrDebuff(player, 'B09')) {
       pool.forEach(c => { if (c.type !== 'number') c.weight *= 2; });
    }
    if (this.hasBuffOrDebuff(player, 'B10')) {
       pool.forEach(c => { if (c.type === '+2') c.weight *= 2; });
    }

    const totalW = pool.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * totalW;
    for (const c of pool) {
       if (r < c.weight) {
          return { ...c, id: generateId() };
       }
       r -= c.weight;
    }
    return { ...pool[0], id: generateId() };
  }

  private drawCards(playerId: string, amount: number, isPassive: boolean, reason: 'active' | 'passive' | 'extra' | 'obtain' = 'passive') {
     const player = this.getPlayer(playerId);
     if (!player || amount <= 0) return;

     let actualAmount = amount;
     if (reason === 'active' && this.hasBuffOrDebuff(player, 'D19')) actualAmount += 1;
     if (reason === 'passive' && this.hasBuffOrDebuff(player, 'D20')) actualAmount += 2;
     
     if (reason === 'extra' && this.hasBuffOrDebuff(player, 'D15')) {
         // Prevent infinite bounce if another extra occurs, just one extra
         actualAmount += 1;  
         // Technically D15 says "你触发额外摸牌的效果时，你额外摸1张牌（该摸牌不会触发该效果）" 
         // So we just add 1 here.
     }

     for(let i=0; i<actualAmount; i++) {
        player.hand.push(this.generateCard(player, reason === 'passive'));
     }
     if (reason !== 'obtain' && reason !== 'extra') {
         this.log(`${player.name} 摸了 ${actualAmount} 张牌`);
     }
  }

  private nextPlayerIndex(i: number, skip: number) {
      const len = this.state.players.length;
      let next = i;
      const step = this.state.direction > 0 ? 1 : -1;
      for (let k = 0; k < skip + 1; k++) {
         next = (next + step + len) % len;
      }
      return next;
  }

  private endTurn() {
     const current = this.state.players[this.state.currentPlayerIndex];
     
     // Evaluate D08, D09, D10, D11, B18 before phase change
     if (this.hasBuffOrDebuff(current, 'D08') && current.debuffs.length <= 4) this.drawCards(current.id, 1, false, 'extra');
     if (this.hasBuffOrDebuff(current, 'D09') && current.debuffs.length > 4) current.debuffs = [];
     
     let minHand = Math.min(...this.state.players.map(p => p.hand.length));
     let maxHand = Math.max(...this.state.players.map(p => p.hand.length));
     const isMinHand = current.hand.length === minHand;
     
     if (this.hasBuffOrDebuff(current, 'D10') && isMinHand) this.drawCards(current.id, 1, false, 'extra');
     if (this.hasBuffOrDebuff(current, 'D11') && !isMinHand) this.drawCards(current.id, 1, false, 'extra');
     if (this.hasBuffOrDebuff(current, 'B18') && current.hand.length === maxHand) {
        this.state.players.filter(p => p.hand.length === minHand).forEach(p => this.drawCards(p.id, 1, false, 'extra'));
     }

     if (!this.state.isChallengeMode) {
        // Trigger debuff chance
        let debuffChance = 0.50;
        if (this.hasBuffOrDebuff(current, 'B13')) debuffChance += 0.25;
        
        if (Math.random() < debuffChance) {
           let clearChance = 0.20;
           if (this.hasBuffOrDebuff(current, 'B14')) clearChance += 0.20;
           
           if (Math.random() < clearChance) {
              this.triggerClear(current.id);
              return; // shop will return control
           } else {
              const unowned = DEBUFFS.filter(d => !current.debuffs.includes(d.id) && d.id !== 'D02'); // Wait, D02 can be obtained normally? Let's assume all valid.
              const validUnowned = DEBUFFS.filter(d => !current.debuffs.includes(d.id));
              if (validUnowned.length > 0) {
                 const chosen = validUnowned[Math.floor(Math.random() * validUnowned.length)];
                 this.state.pendingDebuff = chosen.id;
                 this.state.pendingDebuffPlayer = current.id;
                 this.state.phase = 'debuff_choice';
                 
                 // If has D02, auto accept
                 if (this.hasBuffOrDebuff(current, 'D02')) {
                    this.resolveDebuffChoice(current.id, true);
                 }
                 return;
              }
           }
        }
     }

     this.passToNextPlayer();
  }

  private triggerClear(playerId: string) {
     const player = this.getPlayer(playerId);
     if (!player) return;
     this.log(`${player.name} 触发了 Clear!`);
     
     // B11: clear point 1 to 2
     // Calculate points
     let pointsGained = 0;
     player.debuffs.forEach(d => {
        let definition = DEBUFFS.find(x => x.id === d);
        let pt = definition?.point || 0;
        if (pt === 1 && this.hasBuffOrDebuff(player, 'B11')) pt = 2;
        pointsGained += pt;
     });
     pointsGained += 1;
     
     if (this.hasBuffOrDebuff(player, 'D03')) {
        // Not implemented full logic for what D03 removes, assume it removes ITSELF.
        const idx = player.debuffs.indexOf('D03');
        if (idx !== -1) {
            player.debuffs.splice(idx, 1);
            player.points += DEBUFFS.find(x=>x.id==='D03')?.point || 3;
            // Does D03 skip shop? Rules say "改为仅移除该debuff并获得积分". Yes, so no shop.
            this.passToNextPlayer();
            return;
        }
     } else {
        player.points += pointsGained;
        player.debuffs = [];
     }
     
     // D13 triggers for everyone
     this.state.players.forEach(p => {
        if (p.id !== playerId && this.hasBuffOrDebuff(p, 'D13')) this.drawCards(p.id, 3, false, 'extra');
     });

     if (this.hasBuffOrDebuff(player, 'D05')) {
        this.passToNextPlayer();
     } else {
        // Open Shop
        this.state.phase = 'shop';
        this.state.currentShopper = playerId;
        const unownedBuffs = BUFFS.filter(b => !player.buffs.includes(b.id));
        const numToOffer = Math.min(unownedBuffs.length, Math.floor(Math.random() * 4) + 2); // 2-5 cards
        const shuffled = unownedBuffs.sort(() => 0.5 - Math.random());
        this.state.shopBuffs = shuffled.slice(0, numToOffer).map(b => b.id);
        
        if (this.state.shopBuffs.length === 0) {
           this.passToNextPlayer();
        }
     }
  }

  private resolveDebuffChoice(playerId: string, accept: boolean) {
     if (this.state.phase !== 'debuff_choice' || this.state.pendingDebuffPlayer !== playerId) return;
     const p = this.getPlayer(playerId);
     const debuffId = this.state.pendingDebuff;
     if (p && accept && debuffId) {
        p.debuffs.push(debuffId);
        this.log(`${p.name} 获得了 Debuff ${debuffId}`);
        // Obtain triggers
        if (debuffId === 'D14') this.drawCards(p.id, 6, false, 'obtain');
        if (debuffId === 'D16') this.drawCards(p.id, 3, false, 'obtain');
     } else if (p) {
        this.log(`${p.name} 拒绝了 Debuff`);
     }
     this.state.pendingDebuff = null;
     this.state.pendingDebuffPlayer = null;
     this.passToNextPlayer();
  }

  private buyBuffs(playerId: string, buffIds: string[]) {
     if (this.state.phase !== 'shop' || this.state.currentShopper !== playerId) return;
     const p = this.getPlayer(playerId);
     if (p) {
        let totalCost = 0;
        buffIds.forEach(id => { totalCost += BUFFS.find(b => b.id === id)?.point || 0; });
        if (p.points >= totalCost) {
           p.points -= totalCost;
           p.buffs.push(...buffIds);
           this.log(`${p.name} 购买了 ${buffIds.length} 个 Buff`);
           if (buffIds.length > 0) {
              this.state.players.forEach(other => {
                 if (this.hasBuffOrDebuff(other, 'D12')) this.drawCards(other.id, 2, false, 'extra');
              });
           }
        }
     }
     this.state.phase = 'playing';
     this.state.currentShopper = null;
     this.state.shopBuffs = [];
     this.passToNextPlayer();
  }

  private passToNextPlayer() {
     const nextPlayer = this.nextPlayerIndex(this.state.currentPlayerIndex, this.state.skipNext);
     const skippedPlayers = [];
     let step = this.state.direction > 0 ? 1 : -1;
     const len = this.state.players.length;
     for (let i = 1; i <= this.state.skipNext; i++) {
        let s = (this.state.currentPlayerIndex + i * step + len) % len;
        skippedPlayers.push(this.state.players[s]);
     }
     
     skippedPlayers.forEach(p => {
        if (this.hasBuffOrDebuff(p, 'D25')) this.drawCards(p.id, 1, false, 'extra');
        // B07: if skipped, skip next player. Since this is an endless chain theoretically, let's keep it simple.
     });
     
     this.state.skipNext = 0;
     this.state.currentPlayerIndex = nextPlayer;
     const curr = this.state.players[nextPlayer];
     
     // Resolve incoming +2s
     if (this.state.nextPlayerMustDraw > 0) {
        let drawNum = this.state.nextPlayerMustDraw;
        if (this.hasBuffOrDebuff(curr, 'B05')) drawNum = 1;
        this.drawCards(curr.id, drawNum, true, 'passive');
        
        // Notify others if B12 or B06
        if (this.hasBuffOrDebuff(curr, 'B06')) {
           // We'd need to track sender, but for now just pick previous player
           const prev = this.nextPlayerIndex(nextPlayer, 0 /* backward? no wait */); // Hard to get sender without state. skip.
        }
        if (this.hasBuffOrDebuff(curr, 'B12')) {
           this.state.players.forEach(p => { if (p.id !== curr.id) this.drawCards(p.id, 1, false, 'extra'); });
        }
        
        // Skip their turn per natural +2 rules: "下一名玩家跳过出牌并摸2张牌"
        this.log(`${curr.name} 因被+2摸了牌并跳过回合。`);
        this.state.nextPlayerMustDraw = 0;
        this.endTurn(); // pass again
     } else {
        this.state.phase = 'playing'; // ensure
        this.triggerStartTurnEffects();
     }
  }

  private triggerStartTurnEffects() {
     const p = this.state.players[this.state.currentPlayerIndex];
     
     // B20 instawin
     if (this.hasBuffOrDebuff(p, 'B20') && p.hand.length === 1) {
        this.state.winner = p.id;
        this.state.phase = 'game_over';
        return;
     }

     if (this.hasBuffOrDebuff(p, 'D26')) {
         const playable = p.hand.filter(c => this.canPlay(p, c));
         if (playable.length === 1) {
            // Apply end turn draw, for simplicity attach it to state to resolve on end Turn?
            // "则本回合结束时额外摸1张牌"
         }
     }
     
     // Trigger bot if it's bot turn
     // Since this dispatch loop handles action synchronously, we shouldn't trigger bot play directly inside.
     // But we will have a useEffect in App.tsx that checks if current player is Bot and dispatches Bot action.
  }

  private checkWinCondition() {
     if (this.state.phase === 'lobby' || this.state.phase === 'game_over') return;
     const winner = this.state.players.find(p => p.hand.length === 0);
     if (winner) {
        this.state.winner = winner.id;
        this.state.phase = 'game_over';
        this.log(`${winner.name} 赢得了游戏！`);
     }
  }
}

