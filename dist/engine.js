import {WORDS,ENEMIES,INSCRIPTIONS} from './data.js';

export const VERSION=1;
export const MAX_TICKS=150;
export const MAX_DECK=12;
export function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function shuffle(s,a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
export function cardSpec(tokens){
  if(!Array.isArray(tokens)||tokens.length<1||tokens.length>4||tokens.some(w=>!WORDS[w]))throw Error('単語は1〜4個選んでください。');
  if(new Set(tokens).size!==tokens.length)throw Error('同じ単語は1枚に1個までです。');
  const bases=tokens.filter(w=>WORDS[w].type==='base');
  if(bases.length!==1)throw Error('基本語を1個、追加語を0〜3個選んでください。');
  const base=WORDS[bases[0]];
  if(tokens.includes('DRAIN')&&!base.damage)throw Error('DRAINは攻撃の基本語に組み合わせます。');
  if(tokens.includes('POWER')&&!base.damage&&!base.block&&!base.heal)throw Error('POWERは攻撃・盾・回復を強化します。');
  if(tokens.includes('FOCUS')&&!base.damage&&!base.block)throw Error('FOCUSは攻撃または盾に組み合わせます。');
  const power=tokens.includes('POWER')?6:0, focus=tokens.includes('FOCUS')?4:0;
  return {tokens:[...tokens],base:bases[0],name:[...tokens.filter(w=>WORDS[w].type==='modifier'),bases[0]].join(' '),cost:tokens.reduce((a,w)=>a+WORDS[w].cost,0),
    damage:base.damage?base.damage+power+focus:0,block:base.block?base.block+power+focus:0,heal:base.heal?base.heal+power:0,
    burn:base.burn||0,poison:base.poison||0,slow:base.slow||0,draw:(base.draw||0)+(tokens.includes('QUICK')?1:0),repeat:tokens.includes('DOUBLE')?2:1,drain:tokens.includes('DRAIN')};
}
export function describe(c){return [c.damage&&`${c.damage}ダメージ`,c.block&&`${c.block}ブロック`,c.heal&&`HPを${c.heal}回復`,c.burn&&`火傷${c.burn}`,c.poison&&`毒${c.poison}`,c.slow&&`攻撃を${c.slow}軽減`,c.draw&&`${c.draw}枚ドロー`,c.drain&&'与ダメージの半分を回復'].filter(Boolean).join(' / ')+(c.repeat===2?'［効果を2回発動］':'');}
function makeCard(s,tokens){return {...cardSpec(tokens),id:`c${s.nextId++}`};}
export function radius(s){return Math.max(.12,1.06-s.tick*.0064);}
export function fogDamage(s,node=s.nodes[s.node]){return node.r>radius(s)?Math.ceil(4+(node.r-radius(s))*16):0;}
function log(s,text){s.log.push(text);s.log=s.log.slice(-7);}
export function advance(s,ticks){
  s.tick+=ticks;
  if(s.tick>=MAX_TICKS){s.hp=0;s.mode='lost';s.reason='制限時間に到達';return;}
  const damage=fogDamage(s);
  if(damage){s.hp=Math.max(0,s.hp-damage);log(s,`霧の侵食：${damage}ダメージ。中央へ急ごう。`);}
  if(s.hp<=0){s.mode='lost';s.reason='霧ダメージでHP0';}
}
function generateNodes(s){
  const nodes=[],counts=[12,10,8,6],rs=[.86,.65,.44,.24];
  counts.forEach((n,ring)=>{for(let i=0;i<n;i++){
    const angle=i/n*Math.PI*2+Math.PI/2+(ring%2?.1:0),r=rs[ring];
    const types=['battle','cache','battle','event','camp','battle','forge','elite'];
    const type=types[Math.floor(random(s)*types.length)];
    nodes.push({id:nodes.length,ring,r,angle,x:.5+Math.cos(angle)*r*.44,y:.46+Math.sin(angle)*r*.41,type,visited:false,links:[]});
  }});
  const center={id:nodes.length,ring:4,r:0,angle:0,x:.5,y:.46,type:'boss',visited:false,links:[]};nodes.push(center);
  const connect=(a,b)=>{if(!a.links.includes(b.id))a.links.push(b.id);if(!b.links.includes(a.id))b.links.push(a.id);};
  for(let ring=0;ring<4;ring++){
    const row=nodes.filter(n=>n.ring===ring),inside=nodes.filter(n=>n.ring===ring+1);
    row.forEach((n,i)=>{connect(n,row[(i+1)%row.length]);const near=[...inside].sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y));connect(n,near[0]);if(ring<3&&i%2===0)connect(n,near[1]);});
  }
  nodes[0].type='start';nodes[0].visited=true;
  // First expedition offers an immediate word reward and a fair first fight.
  nodes[1].type='cache';nodes[11].type='camp';nodes[12].type='battle';
  return nodes;
}
export function newRun({seed=Date.now(),map='fire',hero='hero',knowledge={}}={}){
  const s={version:VERSION,seed:seed>>>0,rng:seed>>>0,map,hero,mode:'map',node:0,tick:0,hp:80,maxHp:80,level:1,xp:0,nextId:0,
    inventory:{FIRE:2,SHIELD:1,HEAL:1,DOUBLE:1,ICE:1,POWER:1},deck:[],nodes:[],battle:null,reward:null,event:null,
    gold:15,knowledge:structuredClone(knowledge),stats:{battles:0,crafted:0,correct:0,wrong:0},log:['目標：中央ボス撃破']};
  s.nodes=generateNodes(s);
  s.deck=[['STRIKE'],['STRIKE'],['FIRE'],['FIRE'],['SHIELD'],['SHIELD'],['HEAL']].map(t=>makeCard(s,t));
  return s;
}
function requireMode(s,m){if(s.mode!==m)throw Error('この操作は今は使えません。');}
export function learn(s,word,correct=null){const k=s.knowledge[word]||{seen:0,correct:0,wrong:0};k.seen++;if(correct===true){k.correct++;s.stats.correct++;}if(correct===false){k.wrong++;s.stats.wrong++;}s.knowledge[word]=k;}
function addWord(s,w,n=1){s.inventory[w]=(s.inventory[w]||0)+n;learn(s,w);}
function rewardWords(s){
  const weighted=Object.keys(WORDS).flatMap(w=>Array((s.knowledge[w]?.wrong||0)>(s.knowledge[w]?.correct||0)?3:1).fill(w));
  return [...new Set(shuffle(s,weighted))].slice(0,3);
}
function setReward(s,elite=false){s.mode='reward';s.reward={words:rewardWords(s),elite,selected:null,answers:null,answered:false};}
export function moveTo(s,id){
  requireMode(s,'map');const from=s.nodes[s.node],to=s.nodes[id];
  if(!to||!from.links.includes(id))throw Error('道で繋がった隣の地点を選んでください。');
  s.node=id;advance(s,3);if(s.mode==='lost')return;
  if(to.visited){log(s,'訪問済み / 報酬なし');return;}
  to.visited=true;
  if(['battle','elite','boss'].includes(to.type)){startBattle(s,to.type);return;}
  if(to.type==='cache'){log(s,'書庫 / 単語報酬');setReward(s);return;}
  if(to.type==='event'){s.mode='event';s.event={...INSCRIPTIONS[Math.floor(random(s)*INSCRIPTIONS.length)],answered:false};return;}
  if(to.type==='camp'){s.mode='camp';return;}
  if(to.type==='forge'){s.mode='forge';s.gold+=10;log(s,'鍛冶場で10金を入手。単語を組み合わせよう。');return;}
}
export function startBattle(s,type='battle'){
  const ring=s.nodes[s.node].ring,elite=type==='elite',boss=type==='boss';
  const source=boss?{key:'boss',name:'言葉喰らいの王',en:'THE WORD EATER',weak:'FIRE',hp:145,attack:15}:ENEMIES[Math.min(ENEMIES.length-1,Math.floor(random(s)*3)+ring)];
  const hp=source.hp+(boss?0:ring*9+(elite?18:0));
  s.mode='battle';s.battle={enemy:{...source,hp,maxHp:hp,attack:source.attack+(boss?0:ring*2+(elite?2:0)),burn:0,poison:0,slow:0,block:0},
    turn:1,energy:3,block:0,charged:false,read:false,draw:shuffle(s,s.deck.map(c=>c.id)),hand:[],discard:[],type,intent:null};
  drawCards(s,5);setIntent(s);log(s,`${source.name}が現れた。`);
}
export function drawCards(s,n){const b=s.battle;for(let i=0;i<n&&b.hand.length<8;i++){if(!b.draw.length){b.draw=shuffle(s,b.discard);b.discard=[];}if(!b.draw.length)break;b.hand.push(b.draw.pop());}}
function setIntent(s){
  const b=s.battle,t=b.turn%3,e=b.enemy;
  b.intent=t===1?{kind:'attack',en:'It will attack.',ja:'攻撃してくる',damage:e.attack,hits:1}:
    t===2?{kind:'double',en:'It will strike twice.',ja:'2回攻撃してくる',damage:Math.ceil(e.attack*.65),hits:2}:
    {kind:'guard',en:'It will raise its shield.',ja:'盾を構える',damage:0,hits:0};
}
export function intentChoices(){return ['攻撃してくる','2回攻撃してくる','盾を構える'];}
export function readIntent(s,answer){requireMode(s,'battle');const b=s.battle;if(b.read)throw Error('このターンの予測は確認済みです。');b.read=true;
  const correct=intentChoices()[answer]===b.intent.ja;learn(s,b.intent.kind==='double'?'DOUBLE':b.intent.kind==='guard'?'SHIELD':'STRIKE',correct);
  if(correct){b.block+=3;log(s,'行動予測を解読：3ブロック獲得。');}else log(s,`行動予測：${b.intent.ja}。次に活かそう。`);return correct;
}
export function charge(s){requireMode(s,'battle');if(s.battle.charged)throw Error('集中は1ターンに1回です。');s.battle.charged=true;s.battle.energy+=2;log(s,'集中：エナジー＋2、霧が1進む。');advance(s,1);}
function victory(s){
  s.stats.battles++;s.gold+=s.battle.type==='elite'?20:10;
  const boss=s.battle.type==='boss',elite=s.battle.type==='elite';
  s.xp+=elite?2:1;
  if(s.xp>=3){s.xp-=3;s.level++;s.maxHp+=6;s.hp=Math.min(s.maxHp,s.hp+12);log(s,`レベル${s.level}：最大HP＋6、HP12回復。`);}
  s.battle=null;
  if(boss){s.mode='won';s.reason='中央ボス撃破';return;}
  log(s,'戦闘勝利 / 単語報酬');setReward(s,elite);
}
export function playCard(s,id){
  requireMode(s,'battle');const b=s.battle,c=s.deck.find(c=>c.id===id);
  if(!c||!b.hand.includes(id))throw Error('手札にないカードです。');
  if(c.cost>b.energy)throw Error('エナジーが足りません。「集中」で＋2できます。');
  b.energy-=c.cost;b.hand.splice(b.hand.indexOf(id),1);b.discard.push(id);
  let total=0;
  for(let i=0;i<c.repeat;i++){
    const raw=c.damage+(c.damage&&b.enemy.weak===c.base?4:0);
    const blocked=Math.min(b.enemy.block,raw);b.enemy.block-=blocked;
    const damage=Math.min(b.enemy.hp,Math.max(0,raw-blocked));b.enemy.hp-=damage;total+=damage;
    b.block+=c.block;s.hp=Math.min(s.maxHp,s.hp+c.heal+(c.drain?Math.floor(damage/2):0));
    b.enemy.burn+=c.burn;b.enemy.poison+=c.poison;b.enemy.slow+=c.slow;drawCards(s,c.draw);
  }
  c.tokens.forEach(w=>learn(s,w));log(s,`${c.name}${total?`：${total}ダメージ`:'を使用'}。`);
  if(b.enemy.hp<=0)victory(s);
  return {damage:total,base:c.base};
}
export function endTurn(s){
  requireMode(s,'battle');const b=s.battle,e=b.enemy;
  // Fog advances even during a stalled battle: healing cannot farm indefinitely.
  advance(s,1);if(s.mode==='lost')return;
  e.hp=Math.max(0,e.hp-e.burn-e.poison);e.burn=Math.max(0,e.burn-1);
  if(e.hp<=0){victory(s);return;}
  e.block=0;
  if(b.intent.kind==='guard'){e.block=10+b.turn;log(s,'敵は盾を構えた。');}
  else{let total=0;for(let i=0;i<b.intent.hits;i++){
    const damage=Math.max(0,b.intent.damage-e.slow),absorb=Math.min(damage,b.block);b.block-=absorb;total+=damage-absorb;
  }s.hp=Math.max(0,s.hp-total);log(s,`敵の攻撃：${total}ダメージ。`);}
  e.slow=0;
  if(s.hp<=0){s.mode='lost';s.reason='戦闘でHP0';return;}
  b.discard.push(...b.hand);b.hand=[];b.turn++;b.energy=3+Math.min(2,Math.floor((s.level-1)/2));b.block=0;b.charged=false;b.read=false;drawCards(s,5);setIntent(s);
}
export function craft(s,tokens){
  if(!['map','forge','camp'].includes(s.mode))throw Error('カード合成は探索中に行えます。');
  const spec=cardSpec(tokens);
  if(s.deck.length>=MAX_DECK)throw Error('デッキは12枚まで。先に1枚手放してください。');
  if(tokens.some(w=>(s.inventory[w]||0)<1))throw Error('必要な単語が足りません。');
  tokens.forEach(w=>{s.inventory[w]--;learn(s,w);});const c={...spec,id:`c${s.nextId++}`};s.deck.push(c);s.stats.crafted++;log(s,`${c.name}を合成。使用コスト${c.cost}。`);advance(s,2);return c;
}
export function removeCard(s,id){if(!['map','forge','camp'].includes(s.mode))throw Error('探索中に整理できます。');if(s.deck.length<=5)throw Error('デッキは最低5枚必要です。');const i=s.deck.findIndex(c=>c.id===id);if(i<0)throw Error('カードが見つかりません。');s.deck.splice(i,1);log(s,'カードを手放した。単語は戻りません。');}
export function chooseReward(s,word){
  requireMode(s,'reward');const r=s.reward;if(r.selected||!r.words.includes(word))throw Error('この報酬は選択できません。');
  r.selected=word;const distractors=shuffle(s,Object.keys(WORDS).filter(w=>WORDS[w].ja!==WORDS[word].ja)).slice(0,2);
  r.answers=shuffle(s,[word,...distractors]);
}
export function claimReward(s,index){
  requireMode(s,'reward');const r=s.reward;if(!r.selected||r.answered||!r.answers[index])throw Error('言葉の意味を選んでください。');
  const correct=r.answers[index]===r.selected;r.answered=true;r.correct=correct;
  addWord(s,r.selected,r.elite?2:1);learn(s,r.selected,correct);s.gold+=correct?5:0;
  if(!correct)advance(s,2);
  log(s,`${r.selected}＝${WORDS[r.selected].ja}。単語を${r.elite?2:1}個獲得${correct?'、解読ボーナス5金':''}。`);return correct;
}
export function closeReward(s){requireMode(s,'reward');if(!s.reward.answered)throw Error('報酬を受け取ってください。');s.reward=null;s.mode='map';}
export function answerEvent(s,index){
  requireMode(s,'event');const e=s.event;if(e.answered||!e.choices[index])throw Error('回答済みです。');e.answered=true;e.correct=index===e.answer;learn(s,e.word,e.correct);addWord(s,e.word);
  if(e.correct){s.hp=Math.min(s.maxHp,s.hp+8);s.gold+=5;log(s,'碑文：正解 / 単語＋1・HP＋8・金＋5');}else{advance(s,3);log(s,'碑文：不正解 / 単語＋1・時間＋3');}
}
export function leaveLocation(s){if(s.mode==='event'&&!s.event.answered)throw Error('碑文を解読してください。');if(!['camp','forge','event'].includes(s.mode))throw Error('今は移動できません。');s.mode='map';s.event=null;}
export function rest(s){requireMode(s,'camp');s.hp=Math.min(s.maxHp,s.hp+24);log(s,'篝火でHP24回復。霧が4進んだ。');s.mode='map';advance(s,4);}
export function buyWord(s,word){requireMode(s,'forge');if(!WORDS[word]||s.gold<12)throw Error('単語の購入には12金必要です。');s.gold-=12;addWord(s,word);advance(s,1);}
export function validateSave(s){
  if(!s||s.version!==VERSION||!['fire','ice','rift'].includes(s.map)||!Array.isArray(s.nodes)||s.nodes.length!==37||!s.nodes[s.node]||!Array.isArray(s.deck)||!s.deck.length||!Number.isFinite(s.tick)||!Number.isFinite(s.hp))return false;
  try{s.deck.forEach(c=>cardSpec(c.tokens));return ['map','battle','reward','event','camp','forge','won','lost'].includes(s.mode);}catch{return false;}
}
