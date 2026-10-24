// Optional browser regression check: install Playwright, then npm run test:ui.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.UI_ARTIFACTS||path.join(root,'artifacts/ui');
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['tools/serve.mjs','--port','4184'],{cwd:root,stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`Server exited: ${code}`)));});
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--no-zygote','--single-process','--disable-gpu']});
  // Reuse one context: the test fixtures live only on this local test origin.
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  // Capture the existing boot result only in the test response, never in shipped code.
  await page.route('**/app.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('render();bootWorld();','render();window.__qaGame=bootWorld();')});});
  const action=(name)=>page.locator(`[data-action="${name}"]`);
  const E=await import('../dist/engine.js'),fixture=E.newRun({seed:42});E.moveTo(fixture,12);
  await page.addInitScript(save=>{
    localStorage.setItem('last-word-run-v1',save);
    localStorage.setItem('last-word-settings-v1',JSON.stringify({sound:false,speech:false,hints:true}));
  },JSON.stringify(fixture));
  const seed=async()=>{
    await page.reload();await action('continue').click();
    await page.locator('#loading.hidden').waitFor({state:'attached'});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(120);
  };
  const geometry=async(label)=>{
    const info=await page.evaluate(()=>{
      const world=document.querySelector('#world'),canvas=world.querySelector('canvas'),scene=window.__qaGame.scene.getScene('world');
      const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
      const badge=document.querySelector('.player-badge'),enemy=document.querySelector('.enemy-badge'),hand=document.querySelector('.hand-dock'),intent=document.querySelector('.intent');
      const w=box(world);const errors=[];
      if(badge){
        if(box(badge).bottom>box(hand).y+1)errors.push('Player badge covers hand');
        if(box(enemy).bottom>box(hand).y+1)errors.push('Enemy badge covers hand');
        for(const sprite of [scene.heroSprite,scene.enemySprite]){
          const b=sprite.getBounds(),r={x:b.x+w.x,y:b.y+w.y,right:b.right+w.x,bottom:b.bottom+w.y};
          if(overlap(r,box(intent)))errors.push('Intent covers character');
          if(r.bottom>box(badge).y)errors.push('HP is not below character');
        }
        for(const selector of ['.combat-header','.player-badge','.enemy-badge','.intent','.hand-dock']){
          const r=box(document.querySelector(selector));if(r.x<w.x-1||r.right>w.right+1||r.y<0||r.bottom>innerHeight+1)errors.push(`${selector} outside safe stage`);
        }
      }
      return {canvas:[canvas.width,canvas.height],css:[canvas.clientWidth,canvas.clientHeight],world:[world.clientWidth,world.clientHeight],scale:[scene.scale.width,scene.scale.height],camera:[scene.cameras.main.width,scene.cameras.main.height],errors,header:!!document.querySelector('.in-battle .game-header'),footer:!!document.querySelector('.in-battle .game-nav')};
    });
    for(const field of ['canvas','css','scale','camera'])assert.deepEqual(info[field],info.world,`${label}: ${field} and stage differ`);
    assert.deepEqual(info.errors,[],label);assert.equal(info.header,false);assert.equal(info.footer,false);
    assert.deepEqual(errors,[],label);return info;
  };
  await page.goto('http://127.0.0.1:4184');
  for(const [name,width,height] of [['phone',852,393],['small-phone',667,375],['desktop',1366,768],['tv',1920,1080],['tv-4k',3840,2160],['portrait',393,852]]){
    await page.setViewportSize({width,height});await seed();
    await geometry(`${name} battle`);await page.screenshot({path:path.join(out,`${name}-battle.png`)});
    // Use real UI actions through a complete battle and reward sequence.
    for(let turn=0;turn<12 && await action('end-turn').count();turn++){
      if(await action('charge').isEnabled())await action('charge').click();
      for(let i=0;i<8;i++){
        const attack=page.locator('.card-play:not(:disabled)').filter({hasText:/STRIKE|FIRE/}).first();
        if(!await attack.count())break;await attack.click();
        if(await action('reward-select').count())break;
        await geometry(`${name} active effects`);
      }
      if(await action('reward-select').count())break;
      await action('end-turn').click();if(await action('end-turn').count())await geometry(`${name} next turn`);
    }
    await action('reward-select').first().click();await action('reward-answer').first().click();await action('reward-close').click();
    await page.waitForTimeout(150);await geometry(`${name} after battle`);
    await page.screenshot({path:path.join(out,`${name}-map.png`)});
    // Touch/click the actual marker after a scene transition; rendered and hit coordinates must agree.
    const target=await page.evaluate(()=>{const scene=window.__qaGame.scene.getScene('world'),r=document.querySelector('canvas').getBoundingClientRect(),available=[...document.querySelectorAll('.destinations [data-id]')].map(b=>Number(b.dataset.id));return scene.mapHits.filter(n=>available.includes(n.id)).map(n=>({id:n.id,x:n.x+r.left,y:n.y+r.top})).find(n=>n.y>r.top+110&&n.y<r.bottom-120&&n.x>r.left+50&&n.x<r.right-280);});
    if(target){await page.mouse.click(target.x,target.y);assert.equal(await page.locator(`.destinations [data-id="${target.id}"].active`).count(),1);}
    await action('map-zoom').filter({hasText:'＋'}).click();await geometry(`${name} zoom`);
    await page.locator('.destinations [data-id="23"]').click();await action('travel').click();await geometry(`${name} second battle`);
    console.log(`PASS ${name}: battle → reward → map, uniform canvas, safe bounds`);
  }
  // Nested screens return to their parent, and modal inspection never mutates combat.
  await page.setViewportSize({width:852,height:393});await seed();
  const savedBefore=await page.evaluate(()=>localStorage.getItem('last-word-run-v1'));
  await action('pause').click();await action('help').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[role="dialog"][aria-label="メニュー"]').count(),1);
  assert.equal(await action('help').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Escape');
  assert.equal(await action('pause').evaluate(el=>el===document.activeElement),true);
  for(const [name,zone] of [['draw-pile','draw'],['discard-pile','discard']]){
    await action(name).click();
    assert.equal(await page.locator('#ui').evaluate(el=>el.inert),true);
    assert.equal(await page.locator('#overlay .spell-card').count(),fixture.battle[zone].length);
    await page.keyboard.press('Escape');
    assert.equal(await action(name).evaluate(el=>el===document.activeElement),true);
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('last-word-run-v1')),savedBefore);
  // Focus survives a full HUD repaint (settings) and a card leaving the hand.
  await action('settings').click();await action('toggle-setting').filter({hasText:'日本語ヒント'}).click();
  assert.equal(await page.locator('[data-action="toggle-setting"][data-id="hints"]').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Escape');
  await page.locator('.card-play:not(:disabled)').first().focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.matches('.card-play:not(:disabled),[data-action="end-turn"]')),true);
  await geometry('keyboard card play');
  await page.screenshot({path:path.join(out,'phone-card-zones.png')});
  // Shutdown/start must not retain resize listeners or stale map pointers.
  await page.evaluate(()=>window.__qaGame.scene.getScene('world').scene.restart());
  await page.waitForTimeout(250);await geometry('scene restart');
  console.log('PASS modal stack, focus return, read-only piles, keyboard play and scene restart');
  // Rotate during combat, then return to landscape without reloading the scene.
  await page.setViewportSize({width:852,height:393});await seed();
  for(const [width,height] of [[393,852],[852,393],[1280,720]]){await page.setViewportSize({width,height});await page.waitForTimeout(160);await geometry(`rotation ${width}x${height}`);}
  // Simulate both orientations of a camera cutout independently of headless env() support.
  for(const [left,right] of [[59,30],[30,59]]){
    await page.addStyleTag({content:`:root{--screen-left:${left}px;--screen-right:${right}px}`});
    await page.waitForTimeout(160);await geometry(`cutout ${left}/${right}`);
  }
  console.log('PASS rotation and left/right camera safe area');
}finally{
  await browser?.close();server.kill();
}
