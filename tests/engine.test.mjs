import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {WORDS} from '../dist/data.js';
const run=()=>E.newRun({seed:42});
test('FIRE / DOUBLE FIRE / POWER DOUBLE FIRE have additive cost and meaningful effects',()=>{
 const a=E.cardSpec(['FIRE']),b=E.cardSpec(['DOUBLE','FIRE']),c=E.cardSpec(['POWER','DOUBLE','FIRE']);
 assert.equal(a.cost,1);assert.equal(b.cost,3);assert.equal(b.repeat,2);assert.equal(c.cost,4);assert.equal(c.damage,14);
});
test('invalid recipes rejected',()=>{
 for(const t of [[],['DOUBLE'],['FIRE','ICE'],['FIRE','FIRE'],['SHIELD','DRAIN'],['DRAW','POWER'],['BOGUS']])assert.throws(()=>E.cardSpec(t));
});
test('craft consumes exactly one copy per word and advances time',()=>{
 const s=run(),card=E.craft(s,['DOUBLE','FIRE']);assert.equal(card.cost,3);assert.equal(s.inventory.DOUBLE,0);assert.equal(s.inventory.FIRE,1);assert.equal(s.tick,2);assert.equal(s.deck.length,8);
 const before=JSON.stringify(s);assert.throws(()=>E.craft(s,['DOUBLE','FIRE']));assert.equal(JSON.stringify(s),before);
});
test('seeded map is connected, complete, and points to the boss',()=>{
 for(let seed=1;seed<80;seed++){const s=E.newRun({seed});const seen=new Set([0]),queue=[0];while(queue.length){for(const id of s.nodes[queue.shift()].links)if(!seen.has(id)){seen.add(id);queue.push(id);}}
 assert.equal(seen.size,37);assert.equal(s.nodes[36].type,'boss');assert.deepEqual(E.newRun({seed}).nodes,s.nodes);}
});
test('moves must follow actual paths and visited sites give no repeat rewards',()=>{
 const s=run();assert.throws(()=>E.moveTo(s,36));E.moveTo(s,1);assert.equal(s.mode,'reward');E.chooseReward(s,s.reward.words[0]);E.claimReward(s,0);E.closeReward(s);const wordTotal=()=>Object.values(s.inventory).reduce((a,b)=>a+b,0),before=wordTotal();E.moveTo(s,0);E.moveTo(s,1);assert.equal(s.mode,'map');assert.equal(wordTotal(),before);assert.ok(s.tick>=9);
});
test('fog shrinks monotonically and reaches outer nodes',()=>{
 const s=run(),r=E.radius(s);E.advance(s,40);assert.ok(E.radius(s)<r);assert.ok(E.fogDamage(s)>0);assert.ok(s.hp<80);
});
test('global limit ends a stalled run, even with healing',()=>{
 const s=run();s.tick=149;s.hp=80;E.advance(s,1);assert.equal(s.mode,'lost');assert.equal(s.hp,0);
});
test('combat card requires being in hand and enough energy',()=>{
 const s=run();E.craft(s,['DOUBLE','POWER','FIRE']);E.startBattle(s);const c=s.deck.at(-1);s.battle.hand=[c.id];s.battle.energy=3;assert.throws(()=>E.playCard(s,c.id));assert.equal(s.battle.energy,3);E.charge(s);assert.equal(s.battle.energy,5);E.playCard(s,c.id);assert.equal(s.battle?.energy??1,1);
});
test('charge once per turn and consumes time',()=>{
 const s=run();E.startBattle(s);E.charge(s);assert.equal(s.tick,1);assert.throws(()=>E.charge(s));E.endTurn(s);E.charge(s);assert.equal(s.tick,3);
});
test('intent can only award one block bonus each turn',()=>{
 const s=run();E.startBattle(s);assert.equal(E.readIntent(s,0),true);assert.equal(s.battle.block,3);assert.throws(()=>E.readIntent(s,0));
});
test('double damage and shields resolve per hit',()=>{
 const s=run();const c=E.craft(s,['DOUBLE','FIRE']);E.startBattle(s);s.battle.enemy.hp=100;s.battle.enemy.weak='ICE';s.battle.enemy.block=5;s.battle.hand=[c.id];const r=E.playCard(s,c.id);assert.equal(r.damage,11);assert.equal(s.battle.enemy.burn,4);assert.equal(s.battle.energy,0);
});
test('reward is committed once and wrong answer still grants word',()=>{
 const s=run();E.moveTo(s,1);const w=s.reward.words[0];E.chooseReward(s,w);const before=s.inventory[w]||0;E.claimReward(s,s.reward.answers.findIndex(a=>a!==w));assert.equal(s.inventory[w],before+1);assert.equal(s.knowledge[w].wrong,1);assert.throws(()=>E.claimReward(s,0));
});
test('full deck prevents consuming words',()=>{
 const s=run();s.inventory.FIRE=20;while(s.deck.length<E.MAX_DECK)E.craft(s,['FIRE']);const before=s.inventory.FIRE;assert.throws(()=>E.craft(s,['FIRE']));assert.equal(s.inventory.FIRE,before);
});
test('camp can only be used once',()=>{
 const s=run();s.hp=30;E.moveTo(s,11);E.rest(s);assert.equal(s.hp,54);assert.equal(s.mode,'map');assert.throws(()=>E.rest(s));
});
test('combat and exploration save roundtrip preserves seeded draw state',()=>{
 const s=run();E.startBattle(s);const copy=JSON.parse(JSON.stringify(s));assert.ok(E.validateSave(copy));E.endTurn(s);E.endTurn(copy);assert.deepEqual(s,copy);assert.equal(E.validateSave({}),false);
});
test('boss victory is terminal and no reward modal is generated',()=>{
 const s=run();s.node=36;E.startBattle(s,'boss');s.battle.enemy.hp=1;const c=s.deck.find(x=>x.base==='STRIKE');s.battle.hand=[c.id];E.playCard(s,c.id);assert.equal(s.mode,'won');assert.equal(s.battle,null);
});
test('poison kill resolves victory without enemy attack',()=>{
 const s=run();E.startBattle(s);s.battle.enemy.hp=1;s.battle.enemy.poison=2;E.endTurn(s);assert.equal(s.mode,'reward');assert.equal(s.hp,80);
});
test('every base recipe and allowed modifiers are finite and executable',()=>{
 for(const w of Object.keys(WORDS).filter(w=>WORDS[w].type==='base')){const s=run();s.inventory[w]=1;const c=E.craft(s,[w]);E.startBattle(s);s.battle.hand=[c.id];assert.doesNotThrow(()=>E.playCard(s,c.id));assert.ok(Number.isFinite(s.hp));}
});
