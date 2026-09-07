// Dependency-free engine regression tests: node --test tests/polyrogue.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'..','PolyRogue.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace('    init();\n    initExpeditionUI();','');
function app(seed=1) {
 const elements=new Map(),timers=new Map(),storage=new Map();let timerId=0;
 const context2d=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(t,k)=>t[k]||(()=>{})});
 function element(){return {style:{},children:[],classList:{toggle(){}},open:false,innerHTML:'',getContext:()=>context2d,addEventListener(){},setAttribute(){},appendChild(e){this.children.push(e);},prepend(e){this.children.unshift(e);},removeChild(){this.children.pop();},replaceChildren(){this.children=[];},showModal(){this.open=true;},close(){this.open=false;}};}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener(){},querySelectorAll(){return [];}};
 const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const context=vm.createContext({document,Math:math,performance:{now:()=>1000},requestAnimationFrame(){},setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},console,window:{addEventListener(){}},innerWidth:1440,innerHeight:900});
 vm.runInContext(script,context);const run=code=>vm.runInContext(code,context);
 run('gameSettings.audio=false; drawBoard=()=>{}; triggerAnimation=()=>{}; startExpedition();');
 return {run,timers,storage,elements};
}
function arena(run) {run(`stopAutomation();enemies=[];floorItems=[];mapData=Array.from({length:GRID_W},(_,x)=>Array.from({length:GRID_H},(_,y)=>({isWall:x===0||y===0||x===GRID_W-1||y===GRID_H-1,isExplored:true,isVisible:false})));player.x=20;player.y=20;visibleTiles=[];updateLOS();`);}

test('all five floors stay connected with safe spawns and reachable objectives across 40 seeds',()=>{
 for(let seed=1;seed<=40;seed++) {
  const {run}=app(seed);
  for(let floor=1;floor<=5;floor++) {
   run(`generateLevel(${floor});`);
   const result=JSON.parse(run(`JSON.stringify((()=>{
    const seen=new Set([player.x+','+player.y]),queue=[{x:player.x,y:player.y}];
    for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {const x=queue[i].x+dx,y=queue[i].y+dy;if(mapData[x]?.[y]&&!mapData[x][y].isWall&&!seen.has(x+','+y)){seen.add(x+','+y);queue.push({x,y});}}
    return {connected:seen.size===mapData.flat().filter(t=>!t.isWall).length,up:mapData.flat().filter(t=>t.isStairsUp).length,down:mapData.flat().filter(t=>t.isStairsDown).length,relic:mapData.flat().filter(t=>t.isRelic).length,safe:enemies.every(e=>Math.hypot(e.x-player.x,e.y-player.y)>8),unique:new Set(enemies.map(e=>e.x+','+e.y)).size===enemies.length,guardians:enemies.filter(e=>e.guardian).length};})())`));
   assert.equal(result.connected,true,`seed ${seed}, floor ${floor}`);assert.equal(result.safe,true);assert.equal(result.unique,true);assert.equal(result.up,1);assert.equal(result.down,floor===5?0:1);assert.equal(result.relic,floor===5?1:0);assert.equal(result.guardians,floor===5?1:0);
  }
 }
});
test('origins have distinct loadouts and a fresh expedition clears progression',()=>{
 const {run}=app();
 assert.equal(run('player.maxHp'),28);assert.equal(run('getPlayerDefense()'),1);
 run(`chosenOrigin='Delver';startExpedition();`);assert.equal(run('equipment.weapon.name'),'Sling');assert.equal(run('getPlayerStealth()'),2);assert.equal(run('inventory.find(i=>i.name=== "Pebble").count'),40);
 run(`player.level=9;chosenOrigin='Arcanist';startExpedition();`);assert.equal(run('player.level'),1);assert.equal(run('player.maxHp'),20);
});
test('walls, sealed diagonal corners and modal input do not advance turns',()=>{
 const {run}=app();arena(run);
 run('mapData[21][20].isWall=true;processTurn(1,0);');assert.equal(run('player.turns'),0);
 run('mapData[20][21].isWall=true;processTurn(1,1);');assert.equal(run('player.turns'),0);
 run('showGuide();processTurn(-1,0);');assert.equal(run('player.turns'),0);
 run('dialog.close();processTurn(-1,0);');assert.equal(run('player.turns'),1);
});
test('sniper damage resolves synchronously and death cancels pending saves',()=>{
 const {run,timers}=app();arena(run);
 run(`enemies=[{...enemyTemplates.Sniper,x:23,y:20,dx:-1,dy:0,hearing:2,hp:10,damageMin:4,damageMax:4}];updateLOS();processTurn(0,0);`);
 assert.equal(run('player.hp'),25);assert.equal(run('player.turns'),1);
 run('player.hp=1;processTurn(0,0);');assert.equal(run('player.finished'),'fallen');assert.equal(run('player.turns'),2);assert.equal(run('saveGame(true)'),false);assert.equal(run('readSave()'),null);
 for(const callback of [...timers.values()])callback();assert.equal(run('readSave()'),null);
});
test('accuracy bonuses improve hit chance and melee kills grant experience',()=>{
 const {run}=app();arena(run);
 run(`Math.random=()=>0;enemies=[{...enemyTemplates.Sentry,x:21,y:20,hp:1,dx:1,dy:0,hearing:0}];equipment.weapon.accuracy=0;processTurn(1,0);`);
 assert.equal(run('enemies.length'),1);
 run('equipment.weapon.accuracy=6;enemies[0].x=21;enemies[0].y=20;processTurn(1,0);');assert.equal(run('enemies.length'),0);assert.equal(run('player.kills'),1);assert.equal(run('player.xp'),3);
});
test('ranged and pulse actions advance turns, cooldowns and curse duration',()=>{
 const {run}=app();arena(run);
 run(`equipment.weapon=plainItem('Sling');equipment.weapon.accuracy=20;inventory.push(plainItem('Pebble',5));equipment.head={...plainItem('Leather Helm'),rarity:'cursed',curseTurns:3};enemies=[{...enemyTemplates.Sentry,x:22,y:20,hp:100,dx:1,dy:0,hearing:0}];updateLOS();player.pulseCooldown=3;executeRangedAttack(22,20);`);
 assert.equal(run('player.turns'),1);assert.equal(run('player.pulseCooldown'),2);assert.equal(run('equipment.head.curseTurns'),2);assert.equal(run('inventory.find(i=>i.name==="Pebble").count'),4);
 run('player.pulseCooldown=0;pulse();');assert.equal(run('player.turns'),2);assert.equal(run('player.pulseCooldown'),12);assert.equal(run('equipment.head.curseTurns'),1);
});
test('level choices pause action and persist across save and load',()=>{
 const {run,elements}=app();arena(run);
 run(`rewardKill({type:'Brute',guardian:true});finishTurn();`);assert.equal(run('dialog.open'),true);assert.equal(run('player.pendingTalents'),1);
 const turn=run('player.turns');run('processTurn(1,0);');assert.equal(run('player.turns'),turn);
 run('saveGame(true);dialog.close();player.power=99;loadGame();');assert.equal(run('player.pendingTalents'),1);assert.equal(run('player.power'),0);
 run('showTalents();');elements.get('dialog-actions').children[0].onclick();assert.equal(run('player.power'),1);assert.equal(run('player.pendingTalents'),0);assert.equal(run('dialog.open'),false);
});
test('save round trips retain floors and reject invalid data without replacing the run',()=>{
 const {run,storage}=app();run('saveGame(true);');const before=run('player.x');
 assert.equal(run('validSave(JSON.parse(readSave()))'),true);run('player.x=1;loadGame();');assert.equal(run('player.x'),before);
 const saved=JSON.parse(storage.get('polyRogueExpeditionV2'));saved.levels[1].mapData=[];storage.set('polyRogueExpeditionV2',JSON.stringify(saved));
 assert.equal(run('loadGame()'),false);assert.equal(run('player.x'),before);
});
test('stair round trip preserves cleared floors and clears stale visibility',()=>{
 const {run}=app();run('enemies=[];goToFloor(2,0,"down");');assert.equal(run('currentFloorNum'),2);assert.equal(run('mapData[player.x][player.y].isStairsUp'),true);
 run('goToFloor(1,0,"up");');assert.equal(run('enemies.length'),0);assert.equal(run('mapData[player.x][player.y].isStairsDown'),true);
 assert.equal(run('mapData.flat().filter(t=>t.isVisible).length'),run('visibleTiles.length'));
});
test('the guardian gates the Heart and victory requires returning to the surface',()=>{
 const {run}=app();run(`goToFloor(5,0,'down');for(let x=0;x<GRID_W;x++)for(let y=0;y<GRID_H;y++)if(mapData[x][y].isRelic){player.x=x;player.y=y;}interact();`);
 assert.equal(run('player.relic'),false);run('enemies=[];interact();');assert.equal(run('player.relic'),true);assert.equal(run('mapData[player.x][player.y].isRelic'),false);
 run(`goToFloor(1,null,null);enemies=[];for(let x=0;x<GRID_W;x++)for(let y=0;y<GRID_H;y++)if(mapData[x][y].isStairsUp){player.x=x;player.y=y;}interact();`);
 assert.equal(run('player.finished'),'escaped');assert.equal(run('readSave()'),null);
});
test('rest and exploration stop before danger, and cancelled callbacks stay cancelled',()=>{
 const {run,timers}=app();arena(run);
 run(`player.hp=10;enemies=[{...enemyTemplates.Sentry,x:21,y:20,hp:10,dx:-1,dy:0,hearing:2}];updateLOS();rest();triggerAutoExplore();`);
 assert.equal(run('player.turns'),0);assert.equal(run('isResting'),false);assert.equal(run('isAutoRunning'),false);
 run('enemies=[];updateLOS();rest();');assert.equal(run('player.turns'),1);
 const callbacks=[...timers.values()];run('stopAutomation();');for(const callback of callbacks)callback();assert.equal(run('player.turns'),1);
});
test('pathfinding does not reveal routes through unexplored tiles',()=>{
 const {run}=app();arena(run);run('mapData[21][20].isExplored=false;');assert.equal(run('findPath(20,20,21,20)'),null);assert.equal(run('findPath(20,20,19,20).length'),1);
});

test('the Ascent populates every floor once, with safe distinct seal wardens',()=>{
 for(let seed=1;seed<=12;seed++) {
  const {run}=app(seed);run('player.relic=true;');
  for(let floor=5;floor>=1;floor--) {
   run(`goToFloor(${floor},null,null);`);
   assert.equal(run('enemies.filter(e=>e.sealWarden).length'),2);
   assert.equal(run('enemies.filter(e=>e.sealWarden||e.pursuer).every(e=>Math.hypot(e.x-player.x,e.y-player.y)>=6)'),true);
   assert.equal(run('new Set(enemies.map(e=>e.x+","+e.y)).size===enemies.length'),true);
   const count=run('enemies.length');run('awakenFloor();');assert.equal(run('enemies.length'),count);
  }
 }
});
test('seal wardens block ascent, reward kills, and remain dead after a floor round trip',()=>{
 const {run}=app();run('player.relic=true;goToFloor(2,0,"down");');
 const turn=run('player.turns');run('interact("up");');assert.equal(run('currentFloorNum'),2);assert.equal(run('player.turns'),turn);
 run('player.hp=10;player.pulseCooldown=8;for(const e of enemies.filter(e=>e.sealWarden)){enemies.splice(enemies.indexOf(e),1);rewardKill(e);}player.pendingTalents=0;enemies=[];interact("up");');
 assert.equal(run('currentFloorNum'),1);assert(run('player.hp')>=18);assert.equal(run('player.pulseCooldown'),1);
 run('goToFloor(2,0,"down");');assert.equal(run('enemies.some(e=>e.sealWarden)'),false);assert.equal(run('escapeState.turns'),1);
});
test('rifts give three full turns of warning, stop rest, and have a finite two-wave budget',()=>{
 const {run}=app();arena(run);run('player.relic=true;awakenFloor();for(let i=0;i<12;i++)advanceEscape();');
 assert.equal(run('escapeState.rifts.length'),2);assert.equal(run('escapeState.rifts[0].turns'),3);
 const count=run('enemies.length');run('player.hp=10;rest();');assert.equal(run('isResting'),false);
 run('advanceEscape();advanceEscape();');assert.equal(run('enemies.length'),count);assert.equal(run('escapeState.rifts[0].turns'),1);
 run('advanceEscape();');assert.equal(run('enemies.length'),count+2);assert.equal(run('escapeState.rifts.length'),0);
 run('for(let i=0;i<100;i++)advanceEscape();');assert.equal(run('escapeState.waves'),2);assert.equal(run('enemies.length'),count+4);
});
test('rift arrival relocates away from the player and occupied tiles',()=>{
 const {run}=app();arena(run);run(`player.relic=true;escapeState={turns:0,waves:2,rifts:[{x:20,y:20,turns:1,type:'Seeker'}]};advanceEscape();`);
 assert.equal(run('enemies.length'),1);assert.equal(run('Math.hypot(enemies[0].x-player.x,enemies[0].y-player.y)>=4'),true);
});
test('escape progress survives saving and old Heart saves acquire an Ascent only once',()=>{
 const {run}=app();run('player.relic=true;awakenFloor();escapeState.turns=12;escapeState.waves=1;escapeState.rifts=[{x:player.x,y:player.y,turns:2,type:"Seeker"}];saveGame(true);loadGame();');
 assert.equal(run('escapeState.waves'),1);assert.equal(run('escapeState.rifts[0].turns'),2);assert.equal(run('enemies.filter(e=>e.sealWarden).length'),2);
 run('escapeState=null;enemies=[];saveGame(true);loadGame();');assert.equal(run('enemies.filter(e=>e.sealWarden).length'),2);
 run('saveGame(true);loadGame();');assert.equal(run('enemies.filter(e=>e.sealWarden).length'),2);
});
test('recovery fonts preserve their charge until needed, cost a turn, and cannot be reused',()=>{
 const {run}=app();arena(run);run('mapData[20][20].isFont=true;interact();');assert.equal(run('player.turns'),0);assert.equal(run('!!mapData[20][20].fontUsed'),false);
 run('player.hp=5;player.pulseCooldown=8;interact();');assert.equal(run('player.hp'),17);assert.equal(run('player.pulseCooldown'),0);assert.equal(run('player.turns'),1);
 run('interact();');assert.equal(run('player.hp'),17);assert.equal(run('player.turns'),1);
});
test('guardian shatter grants two escape turns and only damages its marked area',()=>{
 const {run}=app();arena(run);run('enemies=[{...enemyTemplates.Brute,x:23,y:20,hp:28,guardian:true,hearing:0,dx:-1,dy:0}];processTurn(0,0);');
 assert.equal(run('enemies[0].slam.turns'),2);run('processTurn(-1,0);');assert.equal(run('enemies[0].slam.turns'),1);assert.equal(run('player.hp'),28);
 run('processTurn(-1,0);');assert.equal(run('enemies[0].slam'),null);assert.equal(run('player.hp'),28);
 run('player.x=20;enemies[0].slamCooldown=0;processTurn(0,0);processTurn(0,0);processTurn(0,0);');assert.equal(run('player.hp'),19);
});
test('biome and actor rendering never consumes the gameplay random stream',()=>{
 const {run}=app();arena(run);run('Math.random=()=>{throw Error("Rendering consumed gameplay RNG");};');
 for(let floor=1;floor<=5;floor++)run(`currentFloorNum=${floor};drawDungeonTile(20,20,mapData[20][20]);drawDungeonTile(0,0,mapData[0][0]);drawActors();`);
});
test('stairs routing follows explored tiles and refuses danger or an undiscovered exit',()=>{
 const {run}=app();arena(run);run('mapData[24][20].isStairsDown=true;mapData[24][20].isExplored=false;runAction("stairs");');assert.equal(run('player.turns'),0);
 run('mapData[24][20].isExplored=true;runAction("stairs");');assert.equal(run('player.turns'),1);assert.equal(run('player.x'),21);
 run('stopAutomation();escapeState={turns:0,waves:0,rifts:[{x:25,y:20,turns:3,type:"Seeker"}]};runAction("stairs");');assert.equal(run('player.turns'),1);
});
