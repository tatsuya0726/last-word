import {WORDS,MAPS,NODE_TYPES} from './data.js';
import * as E from './engine.js';
import {bootWorld,setWorld,effect} from './world.js';

const $=s=>document.querySelector(s),ui=$('#ui'),overlay=$('#overlay');
const SAVE='last-word-run-v1',MEMORY='last-word-memory-v1',SETTINGS='last-word-settings-v1';
let state=null,selection=null,modal=null,forgeTokens=[],titleMap='fire',titleHero='hero',toastTimer,notice='';
let settings=readLocal(SETTINGS,{sound:true,speech:false,hints:true}),memory=readLocal(MEMORY,{}),saved=readLocal(SAVE,null);
if(!E.validateSave(saved))saved=null;
const paths={
 book:'M3 5h6l3 3 3-3h6v14h-6l-3 3-3-3H3z M12 8v14',
 sword:'M15 3h6v6L8 22l-4-4L17 5 M3 13l8 8',
 flame:'M13 2c1 7 8 8 7 14a8 8 0 0 1-16 0C4 10 10 9 10 5c2 2 2 4 2 5 3-3 1-8 1-8z',
 shield:'M12 2l9 4v7c0 5-9 9-9 9s-9-4-9-9V6z M8 12l3 3 5-6',
 snow:'M12 2v20 M3 7l18 10 M3 17L21 7 M8 4l4 4 4-4 M8 20l4-4 4 4',
 leaf:'M21 3C4 1 1 10 7 16c7 7 15-2 14-13z M3 22L17 8',
 double:'M5 5l7 7-7 7 M12 5l7 7-7 7',
 spark:'M12 2l2 7 8 3-8 2-2 8-3-8-7-2 7-3z',
 drop:'M12 2C10 7 4 11 4 16a8 8 0 0 0 16 0c0-5-6-9-8-14z',
 wind:'M2 8h14a3 3 0 1 0-3-3 M2 12h18 M2 16h12a3 3 0 1 1-3 3',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 compass:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M16 8l-3 6-5 2 2-5z',
 crown:'M3 5l5 5 4-7 4 7 5-5-2 14H5z M5 22h14',
 forge:'M5 4h11l5 5h-7v5H7V9H3z M4 21h15 M9 14v7',
 camp:'M3 21L12 3l9 18z M8 21l4-8 4 8',
 skull:'M7 17C0 12 4 2 12 2s12 10 5 15v5H7z M7 10h2 M15 10h2 M10 19v3 M14 19v3',
 close:'M5 5l14 14 M19 5L5 19',
 sound:'M3 9h4l5-5v16l-5-5H3z M16 7q7 5 0 10 M16 10q2 2 0 4',
 heart:'M12 21L3 12C-2 4 8-1 12 6c4-7 14-2 9 6z',
 gear:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
 arrow:'M3 12h18 M14 5l7 7-7 7'
};
function icon(name,cls=''){return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;}
function esc(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function persist(){try{if(state){localStorage.setItem(SAVE,JSON.stringify(state));memory=state.knowledge;localStorage.setItem(MEMORY,JSON.stringify(memory));saved=state;}localStorage.setItem(SETTINGS,JSON.stringify(settings));}catch{toast('保存容量が足りません。この端末に途中経過を保存できません。');}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
let audioContext;
function chime(kind='tap'){if(!settings.sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(kind==='forge'?440:kind==='hit'?120:330,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(kind==='forge'?880:180,audioContext.currentTime+.15);g.gain.setValueAtTime(.055,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.3);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+.3);}catch{}}
function speak(text){if(!('speechSynthesis'in window)){toast('このブラウザは読み上げに対応していません。');return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.82;const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(v)u.voice=v;speechSynthesis.speak(u);}
function wordHint(w){return settings.hints?WORDS[w].ja:'タップで意味を確認';}
function cardHtml(c,{play=false,remove=false,preview=false}={}){
  const word=WORDS[c.base],unusable=play&&state.battle.energy<c.cost;
  return `<article class="spell-card ${play?'playable':''} ${unusable?'unaffordable':''}" style="--card-color:${word.color}">
    ${play?`<button class="card-play" data-action="play" data-id="${c.id}" ${unusable?'disabled':''} aria-label="${c.name}を使う コスト${c.cost}">`:''}
    <div class="card-top"><span class="energy-gem">${c.cost}</span><span>${c.repeat===2?'COMBINED SPELL':'WORD SPELL'}</span></div>
    <div class="card-art">${icon(word.icon)}${c.repeat===2?`<span class="echo-icon">${icon('double')}</span>`:''}</div>
    <h3>${c.name}</h3><p class="card-ja">${settings.hints?c.tokens.map(w=>WORDS[w].ja.split('・')[0]).join(' × '):' '}</p>
    <div class="card-rule"></div><p class="card-effect">${E.describe(c)}</p>
    ${play?'</button>':''}
    ${!play&&!preview?`<button class="card-audio" data-action="speak" data-text="${c.tokens.join(' ')}" aria-label="${c.name}の発音">${icon('sound')}</button>`:''}
    ${remove?`<button class="card-remove" data-action="remove" data-id="${c.id}">手放す</button>`:''}
  </article>`;
}
function title(){
  ui.className='title-screen';$('#world').className='title-world';
  ui.innerHTML=`<div class="title-shade"></div><div class="title-top"><span class="small-brand">${icon('book')} A WORDCRAFT ROGUELIKE</span><button class="icon-button" data-action="settings" aria-label="設定">${icon('gear')}</button></div>
  <section class="title-copy"><div class="title-emblem">${icon('book')}</div><p class="eyebrow">英語 × カード合成 × ローグライク</p><h1>LAST<br><span>WORD</span></h1><div class="title-line"></div><div class="title-feature-icons"><span>${icon('book')} 単語収集</span><span>${icon('forge')} カード合成</span><span>${icon('wind')} エリア縮小</span></div>
  <div class="title-actions"><button class="primary" data-action="start">${icon('compass')} スタート ${icon('arrow')}</button>${saved&&!['won','lost'].includes(saved.mode)?'<button class="secondary" data-action="continue">つづきから</button>':''}</div>
  <button class="text-button" data-action="help">操作・ルール</button></section>
  <aside class="realm-picker"><p class="eyebrow">CHOOSE YOUR REALM</p><h2>マップ選択</h2><div class="realm-options">${Object.entries(MAPS).map(([key,m],i)=>`<button data-action="map-select" data-id="${key}" class="realm ${titleMap===key?'active':''}" style="--realm:url('./assets/${m.asset}.webp')"><span class="realm-number">0${i+1}</span><span><strong>${m.name}</strong><small>${m.en}</small></span><span class="realm-check">${titleMap===key?'◆':'◇'}</span></button>`).join('')}</div>
  <div class="hero-select"><span>キャラ</span><button class="${titleHero==='hero'?'active':''}" data-action="hero-select" data-id="hero">青の旅人</button><button class="${titleHero==='hero-f'?'active':''}" data-action="hero-select" data-id="hero-f">緑の旅人</button></div></aside>
  <footer class="title-footer"><span>SINGLE PLAYER · ENGLISH × EXPLORATION</span><span>v0.1 · 記録はこのブラウザに自動保存</span></footer>`;
  setWorld({map:titleMap,nodes:[],node:0,mode:'title',tick:0},null,()=>{});
}
function header(){
  const r=E.radius(state),until=Math.max(0,E.MAX_TICKS-state.tick);
  return `<header class="game-header"><button class="brand" data-action="pause" aria-label="旅のメニュー">${icon('book')}<span>LAST WORD<small>${MAPS[state.map].name}</small></span></button>
    <div class="vitals"><span class="level">Lv.${state.level}</span><div><span class="hp-text">${icon('heart')} ${state.hp}<small> / ${state.maxHp}</small></span><div class="hp-track"><i style="width:${state.hp/state.maxHp*100}%"></i></div></div></div>
    <div class="fog-hud"><span>${icon('wind')} 忘却の霧 <b>${Math.round(Math.max(0,Math.min(100,(1-r)*100)))}%</b></span><div class="fog-track"><i style="width:${Math.min(100,state.tick/E.MAX_TICKS*100)}%"></i></div><small>行動時間 ${state.tick} / ${E.MAX_TICKS}<em>終焉まで ${until}</em></small></div>
    <div class="gold">◈ <strong>${state.gold}</strong></div><button class="icon-button" data-action="settings" aria-label="設定">${icon('gear')}</button></header>`;
}
function nav(){return `<nav class="game-nav"><span class="nav-note">${icon('compass')} ${state.nodes[state.node].ring===4?'王城':`第${state.nodes[state.node].ring+1}領域`}<small>${state.stats.battles} 勝利</small></span><button data-action="forge">${icon('forge')}<span>合成</span><b>${Object.values(state.inventory).reduce((a,b)=>a+b,0)}</b></button><button data-action="deck">${icon('book')}<span>デッキ</span><b>${state.deck.length}</b></button><button data-action="dictionary">${icon('eye')}<span>単語帳</span></button><button data-action="help" class="nav-help" aria-label="操作・ルール">?</button></nav>`;}
function nodePanel(){
  const n=state.nodes[selection??state.node],t=NODE_TYPES[n.type],can=state.nodes[state.node].links.includes(n.id),here=n.id===state.node,danger=E.fogDamage(state,n);
  return `<aside class="node-panel"><p class="eyebrow">${here?'現在地':`第${n.ring+1}領域`}</p><h2>${icon(t.icon)} ${t.name}</h2><p class="node-rewards">${n.visited?'✓ 探索済み / 報酬なし':{boss:'♛ 最終ボス',battle:'✦ 単語 ×1　◈ 金＋10　EXP＋1',elite:'✦ 単語 ×2　◈ 金＋20　EXP＋2',cache:'✦ 単語 ×1',camp:'♥ HP＋24　◷ 時間＋4',forge:'✦ 単語購入　⚒ 合成　◈ 金＋10',event:'✦ 単語 ×1　正解：♥＋8'}[n.type]||'出発地点'}</p>
  ${danger?`<div class="danger-note">霧の中：行動ごとに約${danger}ダメージ</div>`:''}
  ${can?`<button class="primary" data-action="travel" data-id="${n.id}">移動 ${icon('arrow')}<small>時間＋3</small></button>`:here?'<span class="muted">進路を選択</span>':'<span class="muted">隣接地点から移動可能</span>'}</aside>`;
}
function destinations(){return `<div class="destinations"><span>進路</span>${state.nodes[state.node].links.map(id=>{const n=state.nodes[id];return `<button data-action="select-node" data-id="${id}" class="${selection===id?'active':''} ${E.fogDamage(state,n)?'danger':''}">${icon(NODE_TYPES[n.type].icon)} ${NODE_TYPES[n.type].label}${n.visited?' ✓':''}</button>`;}).join('')}</div>`;}
function battleUI(){
  const b=state.battle,e=b.enemy;
  return `<div class="battle-top"><section class="player-badge"><p class="eyebrow">THE WORDKEEPER</p><h2>プレイヤー</h2><span>${icon('shield')} ${b.block} ブロック</span></section><section class="enemy-badge"><p class="eyebrow">${e.en}</p><h2>${e.name}</h2><div class="enemy-health"><i style="width:${e.hp/e.maxHp*100}%"></i><span>${e.hp} / ${e.maxHp}</span></div><p>Weak to <b style="color:${WORDS[e.weak].color}">${e.weak}</b> <small>${settings.hints?`弱点：${WORDS[e.weak].ja.split('・')[0]} / ＋4ダメージ`:''}</small></p><div class="status-tags">${e.burn?`<span>火傷 ${e.burn}</span>`:''}${e.poison?`<span>毒 ${e.poison}</span>`:''}${e.slow?`<span>攻撃低下 ${e.slow}</span>`:''}${e.block?`<span>盾 ${e.block}</span>`:''}</div></section></div>
  <div class="intent"><div><small>ENEMY INTENT · TURN ${b.turn}</small><strong>${esc(b.intent.en)}</strong><span>${b.intent.hits?`${Math.max(0,b.intent.damage-e.slow)} × ${b.intent.hits} ダメージ`:'ブロックを獲得'}</span></div><button class="icon-button" data-action="speak" data-text="${b.intent.en}" aria-label="敵の行動予測を聞く">${icon('sound')}</button>${!b.read?'<button class="decode-button" data-action="decode">意味を読む<small>正解で盾＋3</small></button>':`<span class="decoded">${b.intent.ja}</span>`}</div>
  <section class="hand-dock"><div class="combat-resource"><span class="energy-orb">${b.energy}</span><small>ENERGY</small><button data-action="charge" ${b.charged?'disabled':''}>集中 ＋2<small>霧＋1 / 1回</small></button></div><div class="hand">${b.hand.map(id=>cardHtml(state.deck.find(c=>c.id===id),{play:true})).join('')||'<div class="empty-hand">手札がありません。ターンを終了してください。</div>'}</div><div class="turn-controls"><span>山札 ${b.draw.length} / 捨札 ${b.discard.length}</span><button class="primary" data-action="end-turn">ターン終了 ${icon('arrow')}</button><button class="text-button" data-action="deck">デッキを見る</button></div></section>`;
}
function render(){
  if(!state){title();renderModal();return;}
  const battle=state.mode==='battle';ui.className=`game-screen ${battle?'in-battle':''}`;$('#world').className=battle?'battle-world':'map-world';
  ui.innerHTML=header()+(battle?battleUI():`<div class="map-heading"><p class="eyebrow">${icon('crown')} 目標：中央のボスを撃破</p><h1>${MAPS[state.map].name}</h1></div>${state.mode==='map'?nodePanel()+destinations():''}`)+`<div class="journey-log" aria-live="polite">${esc(state.log.at(-1)||'')}</div>`+nav();
  setWorld(state,selection,id=>{if(state.mode!=='map'||modal)return;selection=id;render();});renderModal();
}
function dialog(title,eyebrow,body,cls='',close=true){return `<div class="modal-backdrop"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${title}"><header><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${close?`<button class="icon-button" data-action="close-modal" aria-label="閉じる">${icon('close')}</button>`:''}</header>${body}</section></div>`;}
function forgeView(){
  let spec=null,error='基本語を1つ選んでください。';try{spec=E.cardSpec(forgeTokens);}catch(e){error=e.message;}
  const inv=state.inventory;
  return dialog('カード合成','WORDFORGE',`<div class="recipe-strip"><span>基本語 ×1</span><b>＋</b><span>追加語 ×0〜3</span><b>→</b><span>カード ×1</span></div>
  <div class="forge-layout"><div class="word-inventory">${['base','modifier'].map(type=>`<h3>${type==='base'?'01　基本語':'02　追加語'}</h3><div class="word-grid">${Object.entries(WORDS).filter(([w,v])=>v.type===type).map(([w,v])=>`<button class="word-token ${forgeTokens.includes(w)?'selected':''}" style="--word-color:${v.color}" data-action="forge-token" data-id="${w}" ${!inv[w]?'disabled':''}><span class="token-icon">${icon(v.icon)}</span><span><b>${w}</b><small>${v.ja}</small></span><span class="token-stock">×${inv[w]||0}<small>＋${v.cost}</small></span></button>`).join('')}</div>`).join('')}</div>
  <aside class="forge-preview"><p class="eyebrow">完成カード</p>${spec?cardHtml(spec,{preview:true}):`<div class="empty-card">${icon('forge')}<span>${error}</span></div>`}<div class="formula">${forgeTokens.length?forgeTokens.map(w=>`<span>${w}<b>${WORDS[w].cost}</b></span>`).join('<i>＋</i>'):'基本語を選択'}</div><button class="primary" data-action="craft" ${!spec||state.deck.length>=E.MAX_DECK?'disabled':''}>${icon('spark')} 合成</button><small class="muted">素材消費 / 時間＋2<br>デッキ ${state.deck.length} / ${E.MAX_DECK}</small>${state.deck.length>=E.MAX_DECK?'<button class="text-button" data-action="deck">デッキ整理</button>':''}</aside></div>`, 'forge-modal');
}
function rewardView(){
  const r=state.reward;
  if(!r.selected)return dialog(`単語を選択 ×${r.elite?2:1}`,'報酬',`<div class="reward-words">${r.words.map(w=>`<button class="reward-word" style="--word-color:${WORDS[w].color}" data-action="reward-select" data-id="${w}">${icon(WORDS[w].icon)}<b>${w}</b><span>${WORDS[w].type==='base'?'基本語':'追加語'} · コスト＋${WORDS[w].cost}</span><small>${WORDS[w].desc}</small></button>`).join('')}</div>`, '',false);
  const w=r.selected;
  return dialog(r.answered?'単語獲得':'意味を選択','DECIPHER THE WORD',`<div class="learn-word" style="--word-color:${WORDS[w].color}">${icon(WORDS[w].icon)}<h3>${w}</h3><button class="icon-button" data-action="speak" data-text="${w}" aria-label="発音を聞く">${icon('sound')}</button></div>${!r.answered?`<div class="answers">${r.answers.map((a,i)=>`<button data-action="reward-answer" data-index="${i}">${i+1}<span>${WORDS[a].ja}</span>${icon('arrow')}</button>`).join('')}</div><p class="footnote">正解：単語＋${r.elite?2:1}・金＋5 ／ 不正解：単語＋${r.elite?2:1}・霧＋2</p>`:`<div class="answer-result ${r.correct?'correct':''}"><strong>${r.correct?'解読成功':'正しい意味'}</strong><h3>${WORDS[w].ja}</h3><p>${WORDS[w].example}<br>${WORDS[w].translation}</p><p>${w} ×${r.elite?2:1}を獲得${r.correct?' ＋5金':' / 霧＋2'}</p></div><button class="primary wide" data-action="reward-close">次へ ${icon('arrow')}</button>`}`, 'learn-modal',false);
}
function renderModal(){
  let html='';
  if(modal==='forge'&&state)html=forgeView();
  else if(modal==='deck'&&state)html=dialog('デッキ','DECK',`<p class="modal-intro">${state.deck.length} / ${E.MAX_DECK}枚 / 下限5枚 / 破棄：素材返却なし</p><div class="deck-grid">${state.deck.map(c=>cardHtml(c,{remove:['map','forge','camp'].includes(state.mode)})).join('')}</div>`,'deck-modal');
  else if(modal==='dictionary')html=dialog('単語帳','DICTIONARY',`<p class="modal-intro">学習記録：自動保存</p><div class="dictionary">${Object.entries(WORDS).map(([w,v])=>{const k=(state?.knowledge||memory)[w];return `<div class="dictionary-row ${k?'learned':''}"><div class="dict-symbol" style="color:${v.color}">${icon(v.icon)}</div><div><b>${w}</b><span>${v.ja}</span><small>${v.example} <em>${v.translation}</em></small></div><div class="dict-stats">${k?`遭遇 ${k.seen}<small>正解 ${k.correct} / 復習 ${k.wrong}</small>`:'未発見'}</div><button class="icon-button" data-action="speak" data-text="${w}. ${v.example}" aria-label="${w}の発音">${icon('sound')}</button></div>`;}).join('')}</div>`,'dictionary-modal');
  else if(modal==='decode'&&state?.battle)html=dialog('行動予測','READ THE ENEMY',`<blockquote>${state.battle.intent.en}</blockquote><div class="answers">${E.intentChoices().map((a,i)=>`<button data-action="intent-answer" data-index="${i}">${i+1}<span>${a}</span></button>`).join('')}</div><p class="footnote">正解：盾＋3 ／ 不正解：追加効果なし</p>`);
  else if(modal==='settings')html=dialog('設定','SETTINGS',`<div class="settings-list">${[['sound','効果音','合成・操作時に音を鳴らす'],['speech','単語の自動読み上げ','カード使用時に英語を読む'],['hints','日本語ヒント','単語と弱点の補助を表示']].map(([k,t,d])=>`<button data-action="toggle-setting" data-id="${k}" class="setting-row"><span><strong>${t}</strong><small>${d}</small></span><span class="toggle ${settings[k]?'on':''}">${settings[k]?'ON':'OFF'}</span></button>`).join('')}</div><p class="footnote"></p>`);
  else if(modal==='pause')html=dialog('メニュー','MENU',`<p class="modal-intro">✓ 自動保存済み / 待機中は時間停止</p><div class="stack"><button class="primary" data-action="close-modal">戻る</button><button class="secondary" data-action="title">タイトルへ</button><button class="text-button" data-action="help">遊び方</button></div>`);
  else if(modal==='new-confirm')html=dialog('データを上書きしますか？','A NEW BEGINNING',`<p class="modal-intro">プレイ中の進行：リセット / 単語帳：保持</p><div class="stack"><button class="primary" data-action="start-confirm">スタート</button><button class="secondary" data-action="close-modal">戻る</button></div>`);
  else if(modal==='help')html=dialog('操作・ルール','HOW TO PLAY',`<div class="rules-grid"><div><h3>探索</h3><p>地点を選択 → 移動 → 報酬</p></div><div><h3>合成</h3><p>基本語 ×1 ＋ 追加語 ×0〜3</p><p>FIRE ① → DOUBLE FIRE ③</p></div><div><h3>戦闘</h3><p>手札5枚 / エナジー3</p><p>集中：＋2エナジー・時間＋1 / 毎ターン1回</p><p>予測解読：正解で盾＋3</p></div><div><h3>時間消費</h3><p>移動＋3 / ターン終了＋1</p><p>合成＋2 / 休息＋4</p></div><div><h3>終了条件</h3><p>クリア：中央ボス撃破</p><p>敗北：HP0 または 時間150</p><p>訪問済み報酬：復活なし</p></div><div><h3>保存</h3><p>進行・単語帳：ブラウザに自動保存</p><p>再プレイ：単語帳のみ引継ぎ</p></div></div><button class="primary wide" data-action="close-modal">閉じる</button>`,'help-modal');
  else if(state?.mode==='reward')html=rewardView();
  else if(state?.mode==='event'){const e=state.event;html=dialog('古い碑文','AN INSCRIPTION IN THE WILD',`<blockquote>${e.en}</blockquote><button class="text-button" data-action="speak" data-text="${e.en}">${icon('sound')} 碑文を聞く</button>${e.answered?`<div class="answer-result"><h3>${e.correct?'解読成功':'碑文の意味'}</h3><p>${e.ja}</p><p>${e.word}＝${WORDS[e.word].ja} を獲得${e.correct?' / HP＋8':' / 霧＋3'}</p></div><button class="primary wide" data-action="leave">次へ</button>`:`<p>${e.question}</p><div class="answers">${e.choices.map((c,i)=>`<button data-action="event-answer" data-index="${i}">${i+1}<span>${c}</span></button>`).join('')}</div>`}`,'',false);}
  else if(state?.mode==='camp')html=dialog('休息','A MOMENT OF REST',`<div class="location-symbol">${icon('camp')}</div><p class="modal-intro">♥ ${state.hp} / ${state.maxHp} → ${Math.min(state.maxHp,state.hp+24)} / ${state.maxHp}</p><div class="stack"><button class="primary" data-action="rest">休息する <small>HP＋24 / 時間＋4</small></button><button class="secondary" data-action="forge">合成</button><button class="text-button" data-action="leave">スキップ</button></div>`,'',false);
  else if(state?.mode==='forge')html=dialog('言葉の鍛冶場','THE KEEPER OF LOST WORDS',`<div class="smith-layout"><img src="./assets/smith.webp" alt="言葉の鍛冶師"><div><strong>所持金：${state.gold} ◈</strong></div></div><div class="shop-words">${['FIRE','ICE','SHIELD','HEAL','DOUBLE','POWER'].map(w=>`<button data-action="buy" data-id="${w}" ${state.gold<12?'disabled':''}><b>${w}</b><small>${WORDS[w].ja}</small><span>12金 / 霧＋1</span></button>`).join('')}</div><div class="stack"><button class="primary" data-action="forge">合成</button><button class="text-button" data-action="leave">鍛冶場を出る</button></div>`,'',false);
  else if(state&&['won','lost'].includes(state.mode)){const won=state.mode==='won';html=dialog(won?'CLEAR':'GAME OVER','RESULT',`<div class="ending-symbol">${icon(won?'crown':'book')}</div><p class="ending-copy">${state.reason}</p><div class="run-stats"><div><b>${state.stats.battles}</b><span>戦闘勝利</span></div><div><b>${state.stats.crafted}</b><span>合成したカード</span></div><div><b>${state.stats.correct}</b><span>英語の解読成功</span></div></div><p class="footnote">✓ 単語帳を保存</p><button class="primary wide" data-action="title">タイトルへ ${icon('arrow')}</button>`,'ending-modal',false);}
  const changed=overlay.innerHTML!==html;overlay.innerHTML=html;overlay.classList.toggle('active',!!html);
  if(changed&&html)requestAnimationFrame(()=>overlay.querySelector('button:not([disabled])')?.focus({preventScroll:true}));
}
function begin(){state=E.newRun({map:titleMap,hero:titleHero,knowledge:memory});selection=state.nodes[0].links.find(id=>state.nodes[id].type==='cache')??1;modal=null;forgeTokens=[];persist();render();toast(`単語素材 ${Object.values(state.inventory).reduce((a,b)=>a+b,0)} / デッキ ${state.deck.length}`);}
function act(fn){try{fn();if(state&&['won','lost'].includes(state.mode))modal=null;persist();render();}catch(e){toast(e.message);}}
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,id=b.dataset.id,index=Number(b.dataset.index);chime();
  if(a==='speak'){speak(b.dataset.text);return;}
  if(a==='map-select'){titleMap=id;title();return;}if(a==='hero-select'){titleHero=id;title();return;}
  if(a==='start'){if(saved&&!['won','lost'].includes(saved.mode)){modal='new-confirm';renderModal();}else begin();return;}
  if(a==='start-confirm'){begin();return;}
  if(a==='continue'){state=structuredClone(saved);selection=state.node;modal=null;render();return;}
  if(a==='title'){persist();state=null;modal=null;render();return;}
  if(['settings','help','dictionary','pause','deck'].includes(a)){modal=a;renderModal();return;}
  if(a==='close-modal'){modal=null;renderModal();return;}
  if(a==='toggle-setting'){settings[id]=!settings[id];persist();render();return;}
  if(a==='forge'){if(!['map','forge','camp'].includes(state?.mode)){toast('単語合成は探索中に行えます。');return;}forgeTokens=[];modal='forge';renderModal();return;}
  if(a==='forge-token'){if(forgeTokens.includes(id))forgeTokens=forgeTokens.filter(w=>w!==id);else{if(WORDS[id].type==='base')forgeTokens=forgeTokens.filter(w=>WORDS[w].type!=='base');if(forgeTokens.length>=4){toast('単語は4個までです。');return;}forgeTokens.push(id);}renderModal();return;}
  if(a==='select-node'){selection=Number(id);render();return;}
  if(a==='decode'){modal='decode';renderModal();return;}
  act(()=>{
    if(a==='travel'){E.moveTo(state,Number(id));selection=state.node;}
    else if(a==='craft'){const c=E.craft(state,forgeTokens);forgeTokens=[];chime('forge');toast(`${c.name}を作りました。`);}
    else if(a==='remove'){E.removeCard(state,id);}
    else if(a==='play'){const card=state.deck.find(c=>c.id===id);const r=E.playCard(state,id);if(settings.speech)speak(card.tokens.join(' '));chime('hit');requestAnimationFrame(()=>effect(r.base,r.damage));}
    else if(a==='end-turn')E.endTurn(state);
    else if(a==='charge')E.charge(state);
    else if(a==='intent-answer'){const correct=E.readIntent(state,index);modal=null;toast(correct?'解読成功。3ブロック獲得！':state.battle.intent.ja);}
    else if(a==='reward-select'){E.chooseReward(state,id);if(settings.speech)speak(id);}
    else if(a==='reward-answer')E.claimReward(state,index);
    else if(a==='reward-close')E.closeReward(state);
    else if(a==='event-answer')E.answerEvent(state,index);
    else if(a==='rest')E.rest(state);
    else if(a==='leave')E.leaveLocation(state);
    else if(a==='buy'){E.buyWord(state,id);toast(`${id}を購入しました。`);}
  });
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){ev.preventDefault();modal=modal?null:'pause';renderModal();}
  if(ev.key==='Tab'&&overlay.classList.contains('active')){const bs=[...overlay.querySelectorAll('button:not([disabled]),a[href],input')];if(bs.length){const first=bs[0],last=bs.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}}
});
window.addEventListener('pagehide',persist);
window.addEventListener('error',e=>{if(e.message)toast('読み込みエラー：再読み込みして保存した旅を再開してください。');});
try{render();bootWorld();}catch(e){$('#load-status').textContent=e.message;}
