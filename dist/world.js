import {MAPS,NODE_TYPES} from './data.js';
import {radius,fogDamage} from './engine.js';

const ASSETS=['map-fire','map-ice','map-rift','hero','hero-f','wolf','plant','bird','spirit','golem','dragon','wyvern','boss','grass','volcano','snow','cave'];
let current=null,selected=null,onSelect=()=>{},sceneRef=null,ready=false;
let mapView={x:.5,y:.5,zoom:1},lastMap=null,lastNode=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
export function setWorld(s,selection,callback){
  const changed=s?.map!==lastMap||s?.node!==lastNode||(!current?.nodes.length&&s?.nodes.length);
  current=s;selected=selection;onSelect=callback;
  if(changed&&s?.nodes.length){const n=s.nodes[s.node];mapView={x:n.x,y:n.y,zoom:1};}
  lastMap=s?.map;lastNode=s?.node;if(ready)sceneRef.paint();
}
export function mapControl(action){
  if(!ready||current?.mode!=='map')return;
  if(action==='home'){const n=current.nodes[current.node];mapView={x:n.x,y:n.y,zoom:1};}
  else mapView.zoom=Phaser.Math.Clamp(mapView.zoom*(action==='in'?1.2:1/1.2),.55,2.5);
  sceneRef.paint();
}
export function effect(base,damage=0){if(ready)sceneRef.cast(base,damage);}
export function bootWorld(){
  if(!window.Phaser)throw Error('描画エンジンを読み込めませんでした。ページを再読み込みしてください。');
  class World extends Phaser.Scene{
    constructor(){super('world');}
    preload(){
      ASSETS.forEach(k=>this.load.image(k,`./assets/${k}.webp`));
      this.load.on('progress',p=>{const label=document.getElementById('load-status');if(label)label.textContent=`古地図を広げています… ${Math.round(p*100)}%`;});
      this.load.on('loaderror',file=>{document.getElementById('load-status').textContent=`素材を読み込めません：${file.key}。再読み込みしてください。`;});
    }
    create(){
      sceneRef=this;ready=true;this.layer=this.add.container();this.scale.on('resize',()=>this.paint());
      this.input.on('pointerdown',p=>{if(current?.mode==='map'&&!document.querySelector('#overlay.active'))this.dragStart={x:p.x,y:p.y,view:{...mapView}};});
      this.input.on('pointermove',p=>{
        if(!p.isDown||!this.dragStart||current?.mode!=='map')return;
        const d=this.dragStart;if(Math.hypot(p.x-d.x,p.y-d.y)<6)return;
        mapView.x=d.view.x-(p.x-d.x)/this.mapWidth;mapView.y=d.view.y-(p.y-d.y)/this.mapHeight;this.paint();
      });
      this.input.on('pointerup',p=>{
        const d=this.dragStart;this.dragStart=null;
        if(!d||current?.mode!=='map'||Math.hypot(p.x-d.x,p.y-d.y)>6)return;
        const hit=this.mapHits?.filter(n=>Math.hypot(p.x-n.x,p.y-n.y)<this.hitRadius).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];
        if(hit)onSelect(hit.id);
      });
      this.input.on('wheel',(_p,_o,_dx,dy)=>{if(!document.querySelector('#overlay.active'))mapControl(dy<0?'in':'out');});
      document.getElementById('loading').classList.add('hidden');this.paint();
    }
    cover(asset,w,h){
      const image=this.add.image(w/2,h/2,asset);image.setScale(Math.max(w/image.width,h/image.height));this.layer.add(image);return image;
    }
    paint(){
      const s=current,w=this.scale.width,h=this.scale.height;
      if(!s){this.layer.removeAll(true);this.cover('map-fire',w,h);return;}
      const battle=s.mode==='battle';
      this.tweens.killAll();this.layer.removeAll(true);this.heroSprite=null;this.enemySprite=null;
      if(battle){this.drawBattle(s,w,h);return;}
      const bg=this.cover(MAPS[s.map].asset,w,h);
      if(!s.nodes.length)return;
      // One uniform transform for the artwork, paths, fog and node positions.
      const scale=Math.max(w/bg.width,h/bg.height)*mapView.zoom,mw=bg.width*scale,mh=bg.height*scale;
      const clampCenter=(v,size,viewport)=>size<=viewport?.5:Phaser.Math.Clamp(v,viewport/(2*size),1-viewport/(2*size));
      mapView.x=clampCenter(mapView.x,mw,w);mapView.y=clampCenter(mapView.y,mh,h);
      const ox=w/2-mapView.x*mw,oy=h/2-mapView.y*mh;
      bg.setAlpha(.32);this.layer.add(this.add.image(ox+mw/2,oy+mh/2,MAPS[s.map].asset).setScale(scale));
      this.mapWidth=mw;this.mapHeight=mh;this.mapHits=[];
      const g=this.add.graphics();this.layer.add(g);
      g.fillStyle(0x171b1c,.12).fillRect(0,0,w,h);
      const point=n=>({x:ox+n.x*mw,y:oy+n.y*mh});
      // Draw only actual navigable edges; surrounding paths are part of the artwork.
      for(const n of s.nodes)for(const lid of n.links){if(lid<n.id)continue;const b=s.nodes[lid],a=point(n),p=point(b),active=n.id===s.node||b.id===s.node;
        g.lineStyle(active?2:1,active?0xffdf98:0xe0cf9f,active?.85:.28);g.lineBetween(a.x,a.y,p.x,p.y);
      }
      const safe=radius(s),cx=ox+mw*.5,cy=oy+mh*.46,rx=mw*.44*safe,ry=mh*.41*safe;
      // Annular sectors form an elliptical fog mask while keeping the safe region clear.
      for(let i=0;i<100;i++){const a=i*Math.PI/50,b=(i+1)*Math.PI/50;g.fillStyle(0x131222,.74);g.fillPoints([{x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry},{x:cx+Math.cos(b)*rx,y:cy+Math.sin(b)*ry},{x:cx+Math.cos(b)*w*3,y:cy+Math.sin(b)*h*3},{x:cx+Math.cos(a)*w*3,y:cy+Math.sin(a)*h*3}],true);}
      g.lineStyle(2,0xc5a6d5,.65);g.strokeEllipse(cx,cy,rx*2,ry*2);
      const available=s.nodes[s.node].links,markerScale=Math.max(1,Math.min(2,w/1440));
      this.hitRadius=24*markerScale;
      for(const n of s.nodes){
        const p=point(n),isHere=n.id===s.node,isSelected=n.id===selected,can=available.includes(n.id),danger=fogDamage(s,n)>0;
        const size=(n.type==='boss'?20:14)*markerScale,fill=isHere?0xe7c985:isSelected?0xdbc08a:0x1d2425;
        const outer=this.add.circle(p.x,p.y,size+5,fill,isHere||isSelected?.95:.85).setStrokeStyle(isSelected||isHere?2:1,danger?0x9e799f:can||isHere?0xf1d699:0x9f937c,can||isHere?1:.65);
        this.layer.add(outer);
        const chars={battle:'⚔',elite:'◆',cache:'✦',camp:'♨',event:'?',forge:'⚒',start:'◇',boss:'♛'};
        this.layer.add(this.add.text(p.x,p.y,chars[n.type]||'◇',{fontFamily:'Georgia,serif',fontSize:`${size+6*markerScale}px`,color:isHere||isSelected?'#24261e':danger?'#ba9ac4':n.visited?'#9a9b89':'#f6e4b9'}).setOrigin(.5));
        if(isHere){const arrow=this.add.text(p.x,p.y-size-17,'▼',{fontSize:'17px',color:'#fff0bd'}).setOrigin(.5);this.layer.add(arrow);if(!reduced)this.tweens.add({targets:arrow,y:arrow.y-4,duration:700,yoyo:true,repeat:-1});}
        this.mapHits.push({id:n.id,...p});
      }
      this.layer.add(this.add.text(w-25,h-26,'N  ↑',{fontFamily:'Georgia,serif',fontSize:'18px',color:'#e4d6b5'}).setOrigin(1,1));
    }
    drawBattle(s,w,h){
      const terrain=s.nodes[s.node].ring<2?'grass':MAPS[s.map].terrain;
      this.cover(terrain,w,h);
      const shade=this.add.graphics().fillStyle(0x061014,.31).fillRect(0,0,w,h);this.layer.add(shade);
      // DOM badges and sprites share the same anchors, including safe-area insets.
      const bounds=document.getElementById('world').getBoundingClientRect();
      const player=document.querySelector('.player-badge')?.getBoundingClientRect();
      const opponent=document.querySelector('.enemy-badge')?.getBoundingClientRect();
      const ground=player?player.top-bounds.top-7:h*.55;
      const heroX=player?player.left+player.width/2-bounds.left:w*.24;
      const enemyX=opponent?opponent.left+opponent.width/2-bounds.left:w*.76;
      const top=document.querySelector('.combat-header')?.getBoundingClientRect().bottom-bounds.top||50;
      const actorHeight=Math.max(48,Math.min(h*.43,ground-top-12));
      this.layer.add(this.add.ellipse(heroX,ground-4,w*.19,22,0x05080b,.48));this.layer.add(this.add.ellipse(enemyX,ground-4,w*.25,25,0x05080b,.5));
      const hero=this.add.image(heroX,ground,s.hero).setOrigin(.5,1),enemy=this.add.image(enemyX,ground,s.battle.enemy.key).setOrigin(.5,1);
      const heroScale=Math.min(actorHeight/hero.height,w*.27/hero.width),enemyScale=Math.min(actorHeight/enemy.height,w*.31/enemy.width);
      hero.setScale(heroScale);enemy.setScale(enemyScale);this.layer.add([hero,enemy]);this.heroSprite=hero;this.enemySprite=enemy;
      if(!reduced){this.tweens.add({targets:hero,y:ground-3,duration:1800,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});this.tweens.add({targets:enemy,y:ground-5,duration:1400,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});}
    }
    cast(base,damage){
      if(!this.enemySprite||current?.mode!=='battle')return;
      const colors={FIRE:0xffa44d,ICE:0x9fe3ff,POISON:0xc1a7ee,STRIKE:0xffedc4,HEAL:0xa4e8ba,SHIELD:0x9dcee5,DRAW:0xe6cd84};
      const offensive=damage>0,x=offensive?this.enemySprite.x:this.heroSprite.x,y=this.heroSprite.y-this.heroSprite.displayHeight*.5;
      for(let i=0;i<12;i++){const angle=i*Math.PI/6,p=this.add.circle(x,y,3+(i%3),colors[base]||0xf3d397,.9);this.layer.add(p);this.tweens.add({targets:p,x:x+Math.cos(angle)*65,y:y+Math.sin(angle)*60,alpha:0,duration:reduced?50:600,onComplete:()=>p.destroy()});}
      const text=this.add.text(x,y,offensive?`−${damage}`:base,{fontFamily:'Georgia,serif',fontSize:'32px',color:'#fff2d1',stroke:'#182025',strokeThickness:4}).setOrigin(.5);
      this.layer.add(text);this.tweens.add({targets:text,y:y-60,alpha:0,duration:reduced?100:1000,onComplete:()=>text.destroy()});
    }
  }
  const host=document.getElementById('world');
  const measure=()=>({width:Math.max(1,Math.round(host.clientWidth)),height:Math.max(1,Math.round(host.clientHeight))});
  const game=new Phaser.Game({type:Phaser.AUTO,parent:host,backgroundColor:'#152024',transparent:false,scene:World,
    // One sizing owner. RESIZE plus manual resize() races with Phaser's cached parent size.
    scale:{mode:Phaser.Scale.NONE,...measure()},render:{antialias:true},audio:{noAudio:true},banner:false});
  const syncSize=()=>{
    const {width,height}=measure();
    if(!game.isBooted)return;
    if(game.scale.width!==width||game.scale.height!==height)game.scale.resize(width,height);
    else game.scale.updateBounds();
  };
  const observer=new ResizeObserver(syncSize);observer.observe(host);
  game.events.once('ready',syncSize);
  game.events.once('destroy',()=>observer.disconnect());
  return game;
}
