export const WORDS = {
  STRIKE: {ja:'打つ・攻撃する',cost:1,type:'base',color:'#c4b8a0',icon:'sword',desc:'10ダメージ',damage:10,example:'Strike the enemy.',translation:'敵を攻撃する。'},
  FIRE: {ja:'火',cost:1,type:'base',color:'#ef9261',icon:'flame',desc:'8ダメージ＋火傷2',damage:8,burn:2,example:'Fire burns brightly.',translation:'火が明るく燃える。'},
  ICE: {ja:'氷',cost:1,type:'base',color:'#8fcfef',icon:'snow',desc:'7ダメージ＋敵の攻撃を2軽減',damage:7,slow:2,example:'Ice covers the lake.',translation:'氷が湖を覆っている。'},
  SHIELD: {ja:'盾',cost:1,type:'base',color:'#89b8cd',icon:'shield',desc:'9ブロック',block:9,example:'Raise your shield.',translation:'盾を構えなさい。'},
  HEAL: {ja:'回復する',cost:1,type:'base',color:'#9acaa1',icon:'leaf',desc:'HPを6回復',heal:6,example:'Heal your wounds.',translation:'傷を癒やす。'},
  POISON: {ja:'毒',cost:1,type:'base',color:'#c1b4eb',icon:'drop',desc:'4ダメージ＋毒4',damage:4,poison:4,example:'The poison spreads.',translation:'毒が広がる。'},
  DRAW: {ja:'引く',cost:1,type:'base',color:'#e7d298',icon:'book',desc:'カードを2枚引く',draw:2,example:'Draw two cards.',translation:'カードを2枚引く。'},
  DOUBLE: {ja:'2倍の・二重の',cost:2,type:'modifier',color:'#e9bd72',icon:'double',desc:'基本効果を2回発動',repeat:2,example:'Double the damage.',translation:'ダメージを2倍にする。'},
  POWER: {ja:'力',cost:1,type:'modifier',color:'#e6a07d',icon:'spark',desc:'ダメージ・ブロック・回復を＋6',power:6,example:'Knowledge is power.',translation:'知識は力である。'},
  DRAIN: {ja:'吸い取る',cost:1,type:'modifier',color:'#d8a7c7',icon:'drop',desc:'実際に与えた直接ダメージの半分を回復',drain:true,example:'Drain their energy.',translation:'相手のエネルギーを吸い取る。'},
  QUICK: {ja:'素早い',cost:1,type:'modifier',color:'#acd9c6',icon:'wind',desc:'効果発動後に1枚引く',draw:1,example:'Be quick!',translation:'急いで！'},
  FOCUS: {ja:'集中する',cost:1,type:'modifier',color:'#c6b7e5',icon:'eye',desc:'ダメージ＋4、ブロック＋4',focus:4,example:'Focus on the words.',translation:'単語に集中する。'}
};
export const MAPS = {
  fire:{name:'灰燼の王国',en:'THE ASHEN KINGDOM',subtitle:'火山の奥に、最後の言葉が眠る。',asset:'map-fire',terrain:'volcano',accent:'#e6a175'},
  ice:{name:'白銀の霊峰',en:'THE FROZEN CROWN',subtitle:'雪に埋もれた王都へ、言葉を繋ぐ。',asset:'map-ice',terrain:'snow',accent:'#a6d3e2'},
  rift:{name:'裂け目の廃都',en:'THE SUNDERED REALM',subtitle:'失われた王都は、深淵の向こうに。',asset:'map-rift',terrain:'cave',accent:'#c6b38c'}
};
export const ENEMIES = [
  {key:'wolf',name:'翡翠の牙狼',en:'JADE FANG',weak:'ICE',hp:29,attack:7},
  {key:'plant',name:'三つ首の魔草',en:'HOLLOW BLOOM',weak:'FIRE',hp:32,attack:6},
  {key:'bird',name:'紅冠の怪鳥',en:'SCARLET CREST',weak:'ICE',hp:28,attack:8},
  {key:'spirit',name:'結晶の精霊',en:'PRISM SPIRIT',weak:'STRIKE',hp:35,attack:7},
  {key:'golem',name:'黄鉄の守護者',en:'PYRITE GUARDIAN',weak:'POISON',hp:43,attack:8},
  {key:'dragon',name:'刃背の古竜',en:'BLADEBACK DRAGON',weak:'ICE',hp:46,attack:9},
  {key:'wyvern',name:'双翼の竜',en:'IVORY WYVERN',weak:'FIRE',hp:48,attack:9}
];
export const NODE_TYPES = {
  battle:{name:'魔物の棲処',icon:'sword',label:'戦闘'},elite:{name:'古き守護者',icon:'skull',label:'強敵'},
  cache:{name:'忘れられた書庫',icon:'book',label:'単語'},camp:{name:'旅人の篝火',icon:'camp',label:'休息'},
  event:{name:'刻まれた碑文',icon:'eye',label:'解読'},forge:{name:'言葉の鍛冶場',icon:'forge',label:'鍛冶'},
  start:{name:'始まりの海岸',icon:'compass',label:'出発地'},boss:{name:'沈黙の王城',icon:'crown',label:'最終決戦'}
};
export const INSCRIPTIONS = [
  {en:'Rest beneath the old tree.',ja:'古い木の下で休め。',question:'安全に休める場所は？',choices:['古い木の下','湖の中','塔の屋上'],answer:0,word:'HEAL'},
  {en:'Fire opens the sealed gate.',ja:'火が封じられた門を開く。',question:'門を開くのに必要なのは？',choices:['氷','火','盾'],answer:1,word:'FIRE'},
  {en:'Cross the bridge before sunset.',ja:'日没前に橋を渡れ。',question:'橋を渡るのはいつ？',choices:['日没の後','真夜中','日没の前'],answer:2,word:'QUICK'},
  {en:'Double your power, not your fear.',ja:'恐怖ではなく、力を倍にせよ。',question:'倍にするものは？',choices:['力','恐怖','距離'],answer:0,word:'DOUBLE'},
  {en:'The shield protects the traveler.',ja:'盾が旅人を守る。',question:'旅人を守ってくれるのは？',choices:['毒','盾','火'],answer:1,word:'SHIELD'},
  {en:'Focus on the path ahead.',ja:'前方の道に集中せよ。',question:'集中する対象は？',choices:['後ろの敵','空の雲','前方の道'],answer:2,word:'FOCUS'}
];
