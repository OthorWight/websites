#!/usr/bin/env python3
import concurrent.futures
import json
import random
import re
import socket
import threading
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

USER_AGENT = "CrosswordForge/2.0 (local personal crossword generator)"
HOST = "127.0.0.1"

HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Crossword Forge</title>
<style>
:root{--bg:#f3efe6;--paper:#fffdf8;--ink:#191816;--muted:#706b62;--line:#292724;--soft:#e6dfd2;--accent:#9b2e22;--good:#176c3a;--bad:#a0212a;--cell:38px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.38 Georgia,"Times New Roman",serif}
button,select{font:inherit}
.shell{max-width:1180px;margin:0 auto;padding:28px 20px 42px}
header{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;border-bottom:3px solid var(--ink);padding-bottom:16px}
.kicker{font:700 11px/1 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
h1{font-size:clamp(36px,6vw,72px);line-height:.9;margin:7px 0 0;letter-spacing:-.045em}
.tagline{max-width:485px;margin:0;color:var(--muted);font-size:16px}
.toolbar{display:grid;grid-template-columns:repeat(2,minmax(150px,1fr)) auto auto auto;gap:10px;margin:18px 0;padding:14px;background:var(--paper);border:1px solid #d7d0c4;box-shadow:0 8px 24px #0000000b}
.control{display:grid;gap:5px}
label{font:700 11px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
select,button{height:42px;border:1px solid #bbb2a5;background:#fff;padding:0 12px;color:var(--ink)}
button{cursor:pointer;font:700 12px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
button.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
button:hover{transform:translateY(-1px)}
button:disabled{opacity:.48;cursor:progress;transform:none}
.status{min-height:26px;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:14px;margin:0 2px 12px}
.dot{width:8px;height:8px;border-radius:50%;background:#999;display:inline-block;flex:0 0 auto}
.dot.busy{animation:pulse .9s infinite alternate;background:var(--accent)}
.dot.good{background:var(--good)}.dot.bad{background:var(--bad)}
@keyframes pulse{to{opacity:.25}}
.main{display:grid;grid-template-columns:minmax(360px,1.1fr) minmax(320px,.9fr);gap:26px;align-items:start}
.board-card,.clues-card{background:var(--paper);border:1px solid #d7d0c4;padding:18px}
.board-wrap{overflow:auto;display:flex;justify-content:center}
.grid{display:grid;border:2px solid var(--line);width:max-content;background:var(--line)}
.cell{position:relative;width:var(--cell);height:var(--cell);background:#fff;border:1px solid var(--line)}
.cell.block{background:var(--ink)}
.cell input{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;text-align:center;text-transform:uppercase;font:700 22px/1 Arial,sans-serif;outline:none;padding:8px 2px 1px}
.cell.active-word input{background:#e8edf1}
.cell.active-cell input,.cell input:focus{background:#fff0b9}
.cell.correct input{background:#e7f4eb}.cell.wrong input{background:#fde6e6}
.cell.active-word.correct input{background:#dceee2}
.cell.active-word.wrong input{background:#f7dddd}
.cell.active-cell.correct input{background:#d7f0df}
.cell.active-cell.wrong input{background:#f8d2d2}
.num{position:absolute;z-index:2;top:2px;left:3px;font:700 9px/1 Arial,sans-serif;pointer-events:none}
.board-meta{display:flex;justify-content:space-between;gap:10px;margin-top:12px;color:var(--muted);font-size:12px}
.clues-card h2{font:700 12px/1 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;border-bottom:1px solid #bdb5aa;padding-bottom:8px;margin:0 0 9px}
.clue-cols{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.clue-list{margin:0;padding:0;list-style:none;display:grid;gap:9px}
.clue{display:grid;grid-template-columns:24px 1fr;gap:4px;padding:5px 6px;margin:0 -6px;border-radius:4px;cursor:pointer}
.clue:hover{background:#f1ece3}
.clue.active{background:#e7edf1;outline:1px solid #c8d3da}
.clue.complete{opacity:.58}
.clue.complete span{text-decoration:line-through;text-decoration-thickness:1px}
.clue b{font-family:Arial,sans-serif;font-size:12px}.clue span{font-size:14px}
.source{margin-top:18px;padding-top:12px;border-top:1px solid #d8d0c4;color:var(--muted);font-size:12px}
.empty{padding:50px 18px;text-align:center;color:var(--muted)}
@media(max-width:850px){.toolbar{grid-template-columns:1fr 1fr}.toolbar button{width:100%}.main{grid-template-columns:1fr}.clue-cols{grid-template-columns:1fr 1fr}}
@media(max-width:560px){:root{--cell:32px}.shell{padding:18px 10px 30px}header{display:block}.tagline{margin-top:12px}.toolbar{grid-template-columns:1fr 1fr;padding:10px}.clue-cols{grid-template-columns:1fr}.cell input{font-size:18px}}
@media print{body{background:#fff}.shell{max-width:none;padding:0}.toolbar,.status,.source{display:none}.main{grid-template-columns:1fr 1fr;gap:18px}.board-card,.clues-card{border:0;padding:0}.cell input{color:transparent!important;background:#fff!important}header{margin-bottom:15px}.tagline{font-size:12px}h1{font-size:42px}}
</style>
</head>
<body>
<div class="shell">
<header>
<div><div class="kicker">Online-data puzzle maker</div><h1>Crossword Forge</h1></div>
<p class="tagline">Fresh word and clue pairs are fetched online, then assembled locally into a playable crossword.</p>
</header>
<section class="toolbar">
<div class="control"><label for="language">Language</label><select id="language"><option value="en">English</option><option value="es">Español</option></select></div>
<div class="control"><label for="difficulty">Difficulty</label><select id="difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></div>
<button class="primary" id="generate">New puzzle</button><button id="check">Check</button><button id="reveal">Reveal</button>
</section>
<div class="status" id="status"><span class="dot busy"></span><span>Loading online word data…</span></div>
<main class="main">
<section class="board-card"><div class="board-wrap"><div id="grid" class="empty">Building your crossword…</div></div><div class="board-meta"><span id="metaLeft"></span><span id="metaRight"></span></div></section>
<section class="clues-card"><div class="clue-cols"><div><h2>Across</h2><ol id="across" class="clue-list"></ol></div><div><h2>Down</h2><ol id="down" class="clue-list"></ol></div></div>
<div class="source" id="source">Words: Datamuse. Clues: Free Dictionary API, with Datamuse definition fallback.</div></section>
</main>
</div>
<script>
const $=s=>document.querySelector(s);
const E={lang:$("#language"),diff:$("#difficulty"),gen:$("#generate"),check:$("#check"),reveal:$("#reveal"),status:$("#status"),grid:$("#grid"),across:$("#across"),down:$("#down"),ml:$("#metaLeft"),mr:$("#metaRight"),source:$("#source")};
const SIZE=19;
let puzzle=null;
let activeWordId=null;
let activeDirection="across";
let activeCellKey=null;
const CFG={easy:{wanted:9},medium:{wanted:11},hard:{wanted:13}};

function status(t,type=""){E.status.innerHTML=`<span class="dot ${type}"></span><span>${t}</span>`}
function normalizeWord(s,lang){let x=s.toUpperCase().normalize("NFD").replace(/[\u0300-\u0308]/g,"");return (x.match(lang==="es"?/[A-ZÑ]/g:/[A-Z]/g)||[]).join("")}
function blank(){return Array.from({length:SIZE},()=>Array(SIZE).fill(null))}
function valid(g,w,r,c,d,need=true){
const dr=d==="down"?1:0,dc=d==="across"?1:0,er=r+dr*(w.length-1),ec=c+dc*(w.length-1);
if(r<0||c<0||er>=SIZE||ec>=SIZE)return null;
const br=r-dr,bc=c-dc,ar=er+dr,ac=ec+dc;
if(br>=0&&bc>=0&&br<SIZE&&bc<SIZE&&g[br][bc])return null;
if(ar>=0&&ac>=0&&ar<SIZE&&ac<SIZE&&g[ar][ac])return null;
let crosses=0;
for(let i=0;i<w.length;i++){
const rr=r+dr*i,cc=c+dc*i,cell=g[rr][cc];
if(cell){if(cell.letter!==w[i])return null;crosses++}
else if(d==="across"){if((rr>0&&g[rr-1][cc])||(rr<SIZE-1&&g[rr+1][cc]))return null}
else{if((cc>0&&g[rr][cc-1])||(cc<SIZE-1&&g[rr][cc+1]))return null}
}
if(need&&crosses===0)return null;
return {crosses};
}
function place(g,item,r,c,d,id){
const dr=d==="down"?1:0,dc=d==="across"?1:0;
for(let i=0;i<item.answer.length;i++){const rr=r+dr*i,cc=c+dc*i;if(!g[rr][cc])g[rr][cc]={letter:item.answer[i]};}
return {...item,row:r,col:c,dir:d,id};
}
function options(g,item,placed){
const out=[];
for(const p of placed)for(let i=0;i<item.answer.length;i++)for(let j=0;j<p.answer.length;j++){
if(item.answer[i]!==p.answer[j])continue;
const d=p.dir==="across"?"down":"across";
const r=d==="down"?p.row-j:p.row+j-i,c=d==="across"?p.col-j:p.col+j-i;
const v=valid(g,item.answer,r,c,d,true);
if(v)out.push({row:r,col:c,dir:d,score:v.crosses*100-(Math.abs(r-SIZE/2)+Math.abs(c-SIZE/2))});
}
return out.sort((a,b)=>b.score-a.score);
}
function shuffled(a){return [...a].sort(()=>Math.random()-.5)}
function buildOnce(items,wanted){
const g=blank(),placed=[],words=[...items].sort((a,b)=>b.answer.length-a.answer.length);
if(!words.length)return {grid:g,placed};
const first=words.shift(),r=Math.floor(SIZE/2),c=Math.floor((SIZE-first.answer.length)/2);
placed.push(place(g,first,r,c,"across","w0"));
let pool=words,go=true;
while(go&&placed.length<wanted){
go=false;let best=null;
for(const item of pool){const o=options(g,item,placed);if(o.length&&(!best||o[0].score>best.opt.score))best={item,opt:o[0]}}
if(best){placed.push(place(g,best.item,best.opt.row,best.opt.col,best.opt.dir,`w${placed.length}`));pool=pool.filter(x=>x!==best.item);go=true}
}
return {grid:g,placed};
}
function build(items,wanted){
let best={placed:[]};
for(let i=0;i<65;i++){const a=buildOnce(shuffled(items).slice(0,40),wanted);if(a.placed.length>best.placed.length)best=a;if(best.placed.length>=wanted)break}
return best;
}
function crop(raw){
let minR=SIZE,maxR=0,minC=SIZE,maxC=0;
for(const p of raw.placed){const er=p.row+(p.dir==="down"?p.answer.length-1:0),ec=p.col+(p.dir==="across"?p.answer.length-1:0);minR=Math.min(minR,p.row);maxR=Math.max(maxR,er);minC=Math.min(minC,p.col);maxC=Math.max(maxC,ec)}
const h=maxR-minR+1,w=maxC-minC+1;
return {grid:Array.from({length:h},(_,r)=>Array.from({length:w},(_,c)=>raw.grid[r+minR][c+minC])),placed:raw.placed.map(p=>({...p,row:p.row-minR,col:p.col-minC})),h,w};
}
function number(p){
const starts=new Set(p.placed.map(x=>`${x.row},${x.col}`)),nums=new Map();let n=1;
for(let r=0;r<p.h;r++)for(let c=0;c<p.w;c++)if(starts.has(`${r},${c}`))nums.set(`${r},${c}`,n++);
for(const w of p.placed)w.number=nums.get(`${w.row},${w.col}`);
p.placed.sort((a,b)=>a.number-b.number||(a.dir>b.dir?1:-1));return p;
}

function wordCells(word){
const dr=word.dir==="down"?1:0,dc=word.dir==="across"?1:0;
return Array.from({length:word.answer.length},(_,i)=>({r:word.row+dr*i,c:word.col+dc*i}));
}
function wordContains(word,r,c){return wordCells(word).some(x=>x.r===r&&x.c===c)}
function wordsAt(r,c){return puzzle?puzzle.placed.filter(w=>wordContains(w,r,c)):[]}
function activeWord(){return puzzle?.placed.find(w=>w.id===activeWordId)||null}
function inputAt(r,c){return E.grid.querySelector(`input[data-r="${r}"][data-c="${c}"]`)}
function cellAt(r,c){return inputAt(r,c)?.parentElement||null}
function clueOrder(){
if(!puzzle)return [];
return [...puzzle.placed.filter(w=>w.dir==="across"),...puzzle.placed.filter(w=>w.dir==="down")];
}
function isWordComplete(word){return wordCells(word).every(({r,c})=>!!inputAt(r,c)?.value)}
function updateProgress(){
if(!puzzle)return;
for(const w of puzzle.placed){
const clue=document.querySelector(`.clue[data-word-id="${w.id}"]`);
if(clue)clue.classList.toggle("complete",isWordComplete(w));
}
const total=[...E.grid.querySelectorAll("input")].length;
const filled=[...E.grid.querySelectorAll("input")].filter(i=>i.value).length;
const base=`${puzzle.placed.length} answers · ${puzzle.w}×${puzzle.h} grid`;
E.ml.textContent=filled?`${base} · ${filled}/${total} filled`:base;
}
function paintSelection(r=null,c=null,scrollClue=false){
E.grid.querySelectorAll(".cell").forEach(x=>x.classList.remove("active-word","active-cell"));
document.querySelectorAll(".clue").forEach(x=>x.classList.remove("active"));
const word=activeWord();
if(word){
for(const pos of wordCells(word))cellAt(pos.r,pos.c)?.classList.add("active-word");
const clue=document.querySelector(`.clue[data-word-id="${word.id}"]`);
if(clue){clue.classList.add("active");if(scrollClue)clue.scrollIntoView({block:"nearest",behavior:"smooth"})}
}
if(r!==null&&c!==null){cellAt(r,c)?.classList.add("active-cell");activeCellKey=`${r},${c}`}
}
function focusWord(word,preferBlank=true,scrollClue=false,index=null){
if(!word)return;
activeWordId=word.id;activeDirection=word.dir;
const coords=wordCells(word);
let target=null;
if(index!==null)target=coords[Math.max(0,Math.min(coords.length-1,index))];
if(!target&&preferBlank)target=coords.find(({r,c})=>!inputAt(r,c)?.value);
if(!target)target=coords[0];
paintSelection(target.r,target.c,scrollClue);
const input=inputAt(target.r,target.c);
if(input){input.focus();input.select()}
}
function selectCell(r,c,toggleIntersection=false){
const candidates=wordsAt(r,c);
if(!candidates.length)return;
let chosen=null;
const current=activeWord();
if(candidates.length===1)chosen=candidates[0];
else if(toggleIntersection&&current&&wordContains(current,r,c))chosen=candidates.find(w=>w.id!==current.id)||current;
else chosen=candidates.find(w=>w.dir===activeDirection)||candidates[0];
activeWordId=chosen.id;activeDirection=chosen.dir;
paintSelection(r,c,true);
const input=inputAt(r,c);if(input){input.focus();input.select()}
}
function cycleClue(delta){
const order=clueOrder();if(!order.length)return;
let i=order.findIndex(w=>w.id===activeWordId);if(i<0)i=delta>0?-1:0;
i=(i+delta+order.length)%order.length;
focusWord(order[i],true,true);
}
function moveWithinWord(delta,clearDestination=false){
const word=activeWord();if(!word)return false;
const coords=wordCells(word);
let i=coords.findIndex(({r,c})=>`${r},${c}`===activeCellKey);
if(i<0){const ae=document.activeElement;i=coords.findIndex(({r,c})=>ae===inputAt(r,c))}
const ni=i+delta;
if(ni<0||ni>=coords.length)return false;
const t=coords[ni],input=inputAt(t.r,t.c);
if(clearDestination&&input)input.value="";
paintSelection(t.r,t.c,false);if(input){input.focus();input.select()}
return true;
}
function movePhysical(r,c,dr,dc,dir){
const here=wordsAt(r,c).find(w=>w.dir===dir);
if(here){activeWordId=here.id;activeDirection=dir}
let rr=r+dr,cc=c+dc;
while(rr>=0&&cc>=0&&rr<puzzle.h&&cc<puzzle.w){
const input=inputAt(rr,cc);
if(input){
const candidates=wordsAt(rr,cc),preferred=candidates.find(w=>w.dir===dir)||candidates[0];
if(preferred){activeWordId=preferred.id;activeDirection=preferred.dir}
paintSelection(rr,cc,true);input.focus();input.select();return;
}
rr+=dr;cc+=dc;
}
paintSelection(r,c,true);
}
function toggleDirectionAt(r,c){
const candidates=wordsAt(r,c);
if(candidates.length<2)return false;
const current=activeWord();
const next=candidates.find(w=>w.id!==current?.id)||candidates[0];
activeWordId=next.id;activeDirection=next.dir;paintSelection(r,c,true);
inputAt(r,c)?.focus();return true;
}

function render(p,lang,diff){
activeWordId=null;activeDirection="across";activeCellKey=null;
E.grid.className="grid";E.grid.innerHTML="";E.grid.style.gridTemplateColumns=`repeat(${p.w},var(--cell))`;
for(let r=0;r<p.h;r++)for(let c=0;c<p.w;c++){
const el=document.createElement("div");
if(!p.grid[r][c]){el.className="cell block";E.grid.appendChild(el);continue}
el.className="cell";const start=p.placed.find(w=>w.row===r&&w.col===c);
if(start){const s=document.createElement("span");s.className="num";s.textContent=start.number;el.appendChild(s)}
const input=document.createElement("input");
input.maxLength=1;input.autocomplete="off";input.spellcheck=false;input.dataset.r=r;input.dataset.c=c;
input.setAttribute("aria-label",`Row ${r+1}, column ${c+1}`);
input.addEventListener("click",()=>selectCell(r,c,true));
input.addEventListener("focus",()=>{
if(!activeWordId||!activeWord()||!wordContains(activeWord(),r,c))selectCell(r,c,false);
else paintSelection(r,c,false);
});
input.addEventListener("input",e=>{
const value=normalizeWord(e.target.value,lang).slice(-1);
e.target.value=value;e.target.parentElement.classList.remove("correct","wrong");
paintSelection(r,c,false);updateProgress();
if(value){
const word=activeWord();
if(word){
const coords=wordCells(word),i=coords.findIndex(x=>x.r===r&&x.c===c);
if(i===coords.length-1)cycleClue(1);else moveWithinWord(1);
}
}
});
input.addEventListener("keydown",e=>handleKey(e,r,c));
el.appendChild(input);E.grid.appendChild(el);
}
renderClues(p);
E.mr.textContent=`${E.lang.options[E.lang.selectedIndex].text} · ${diff[0].toUpperCase()+diff.slice(1)}`;
updateProgress();
const first=clueOrder()[0];if(first)focusWord(first,true,false);
}
function renderClues(p){
E.across.innerHTML="";E.down.innerHTML="";
for(const d of ["across","down"]){
const list=d==="across"?E.across:E.down;
for(const w of p.placed.filter(x=>x.dir===d)){
const li=document.createElement("li");li.className="clue";li.dataset.wordId=w.id;li.title="Click to jump to this answer";
const b=document.createElement("b"),s=document.createElement("span");b.textContent=w.number;s.textContent=w.clue;li.append(b,s);
li.addEventListener("click",()=>focusWord(w,true,true));
list.appendChild(li);
}
}
}
function handleKey(e,r,c){
if(e.key==="Tab"){e.preventDefault();cycleClue(e.shiftKey?-1:1);return}
if(e.key==="Enter"||e.key===" "){e.preventDefault();if(!toggleDirectionAt(r,c)&&e.key==="Enter")cycleClue(e.shiftKey?-1:1);return}
if(e.key==="ArrowLeft"){e.preventDefault();movePhysical(r,c,0,-1,"across");return}
if(e.key==="ArrowRight"){e.preventDefault();movePhysical(r,c,0,1,"across");return}
if(e.key==="ArrowUp"){e.preventDefault();movePhysical(r,c,-1,0,"down");return}
if(e.key==="ArrowDown"){e.preventDefault();movePhysical(r,c,1,0,"down");return}
if(e.key==="Home"){e.preventDefault();focusWord(activeWord(),false,false,0);return}
if(e.key==="End"){e.preventDefault();const w=activeWord();if(w)focusWord(w,false,false,w.answer.length-1);return}
if(e.key==="Backspace"){
e.preventDefault();
const input=inputAt(r,c);
if(input?.value){input.value="";input.parentElement.classList.remove("correct","wrong");updateProgress();paintSelection(r,c,false)}
else{moveWithinWord(-1,true);updateProgress()}
return;
}
if(e.key==="Delete"){
e.preventDefault();const input=inputAt(r,c);if(input){input.value="";input.parentElement.classList.remove("correct","wrong");updateProgress()}return;
}
if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
const ch=normalizeWord(e.key,E.lang.value);
if(ch){
e.preventDefault();const input=inputAt(r,c);input.value=ch.slice(-1);input.parentElement.classList.remove("correct","wrong");updateProgress();
const word=activeWord(),coords=wordCells(word),i=coords.findIndex(x=>x.r===r&&x.c===c);
if(i===coords.length-1)cycleClue(1);else moveWithinWord(1);
}
}
}
function check(reveal=false){
if(!puzzle)return;let wrong=0,empty=0;
for(const input of E.grid.querySelectorAll("input")){
const r=+input.dataset.r,c=+input.dataset.c,a=puzzle.grid[r][c].letter;input.parentElement.classList.remove("correct","wrong");
if(reveal){input.value=a;input.parentElement.classList.add("correct")}
else if(!input.value)empty++;
else if(input.value===a)input.parentElement.classList.add("correct");
else{input.parentElement.classList.add("wrong");wrong++}
}
updateProgress();
const ae=document.activeElement;if(ae?.matches?.(".cell input"))paintSelection(+ae.dataset.r,+ae.dataset.c,false);
if(reveal)status(E.lang.value==="es"?"Crucigrama revelado.":"Puzzle revealed.","good");
else if(!wrong&&!empty)status(E.lang.value==="es"?"Perfecto: todo está correcto.":"Perfect — every square is correct.","good");
else if(wrong)status(`${wrong} ${E.lang.value==="es"?"casilla(s) incorrecta(s)":"incorrect square(s)"}${empty?` · ${empty} ${E.lang.value==="es"?"vacías":"blank"}`:""}`,"bad");
else status(`${E.lang.value==="es"?"Todo lo escrito está correcto":"Everything filled so far is correct"} · ${empty} ${E.lang.value==="es"?"restantes":"left"}`,"good");
}
async function generate(){
E.gen.disabled=E.check.disabled=E.reveal.disabled=true;const lang=E.lang.value,diff=E.diff.value;
status(lang==="es"?"Buscando palabras y definiciones en línea…":"Fetching words and definitions online…","busy");
try{
const res=await fetch(`/api/pairs?lang=${lang}&difficulty=${diff}&_=${Date.now()}`);const data=await res.json();
if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
const items=data.pairs.map(x=>({...x,answer:normalizeWord(x.word,lang)})).filter(x=>x.answer.length>=3);
const raw=build(items,CFG[diff].wanted);if(raw.placed.length<6)throw new Error(lang==="es"?"No se pudieron entrelazar suficientes palabras. Pulsa «New puzzle» otra vez.":"Not enough fetched words could interlock. Try New puzzle again.");
puzzle=number(crop(raw));render(puzzle,lang,diff);
E.source.textContent=`Words: Datamuse · Clues: ${data.sources.join(" + ")} · ${data.pairs.length} usable online pairs fetched`;
status(lang==="es"?`Listo: ${puzzle.placed.length} respuestas. Tab cambia de pista; Espacio/Enter cambia dirección.`:`Ready: ${puzzle.placed.length} answers. Tab changes clue; Space/Enter changes direction.`,"good");
}catch(err){console.error(err);status(`${lang==="es"?"No se pudo crear el crucigrama":"Could not build the puzzle"}: ${err.message}`,"bad")}
finally{E.gen.disabled=E.check.disabled=E.reveal.disabled=false}
}
E.gen.addEventListener("click",generate);
E.check.addEventListener("click",()=>check(false));
E.reveal.addEventListener("click",()=>check(true));
generate();
</script>
</body>
</html>"""

DIFFICULTY = {
    "easy": {"min": 4, "max": 8, "rank_start": 0, "rank_end": 90, "need": 34},
    "medium": {"min": 5, "max": 10, "rank_start": 20, "rank_end": 150, "need": 42},
    "hard": {"min": 6, "max": 13, "rank_start": 70, "rank_end": 240, "need": 48},
}

PREFIXES = {
    "en": list("abcdefghijklmnoprstuw"),
    "es": list("abcdefghijklmnoprstuv"),
}

def get_json(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def datamuse_candidates(lang, difficulty):
    cfg = DIFFICULTY[difficulty]
    letters = random.sample(PREFIXES[lang], 7)
    all_words = []
    seen = set()
    vocab = "&v=es" if lang == "es" else ""
    for letter in letters:
        url = f"https://api.datamuse.com/words?sp={letter}%2A&max=260{vocab}"
        try:
            rows = get_json(url)
        except Exception:
            continue
        segment = rows[cfg["rank_start"]:cfg["rank_end"]]
        for row in segment:
            w = (row.get("word") or "").strip()
            if not w or w in seen:
                continue
            if not (cfg["min"] <= len(w) <= cfg["max"]):
                continue
            if lang == "en":
                if not re.fullmatch(r"[a-z]+", w):
                    continue
            else:
                if not re.fullmatch(r"[a-záéíóúüñ]+", w, re.I):
                    continue
            if w.lower() != w:
                continue
            seen.add(w)
            all_words.append(w)
    random.shuffle(all_words)
    return all_words

def strip_answer(clue, word):
    if not clue:
        return ""
    rx = re.compile(rf"\b{re.escape(word)}\b", re.I)
    clue = rx.sub("_____", clue)
    clue = re.sub(r"\s+", " ", clue).strip(" ;,.")
    return clue

def dictionary_clue(word, lang):
    url = f"https://api.dictionaryapi.dev/api/v2/entries/{lang}/{urllib.parse.quote(word)}"
    data = get_json(url, timeout=7)
    if not isinstance(data, list):
        return None
    defs = []
    for entry in data:
        for meaning in entry.get("meanings", []):
            pos = meaning.get("partOfSpeech", "")
            for d in meaning.get("definitions", []):
                text = (d.get("definition") or "").strip()
                if 20 <= len(text) <= 230:
                    defs.append((pos, text))
    if not defs:
        return None
    random.shuffle(defs)
    pos, text = defs[0]
    clue = strip_answer(text, word)
    if len(clue) < 16 or "_____" == clue:
        return None
    return clue

def datamuse_fallback(word, lang):
    vocab = "&v=es" if lang == "es" else ""
    url = f"https://api.datamuse.com/words?sp={urllib.parse.quote(word)}&qe=sp&md=d&max=1{vocab}"
    rows = get_json(url, timeout=7)
    if not rows:
        return None
    defs = rows[0].get("defs") or []
    if not defs:
        return None
    raw = random.choice(defs)
    text = raw.split("\t", 1)[-1].strip()
    clue = strip_answer(text, word)
    return clue if len(clue) >= 16 else None

def fetch_pair(word, lang):
    try:
        clue = dictionary_clue(word, lang)
        if clue:
            return {"word": word, "clue": clue, "source": "Free Dictionary API"}
    except Exception:
        pass
    try:
        clue = datamuse_fallback(word, lang)
        if clue:
            return {"word": word, "clue": clue, "source": "Datamuse definitions"}
    except Exception:
        pass
    return None

def build_pairs(lang, difficulty):
    cfg = DIFFICULTY[difficulty]
    words = datamuse_candidates(lang, difficulty)
    if not words:
        raise RuntimeError("Datamuse returned no candidate words.")
    pairs = []
    sources = set()
    # Work in batches so we stop once there are enough usable pairs.
    for start in range(0, min(len(words), 110), 24):
        batch = words[start:start+24]
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            for pair in ex.map(lambda w: fetch_pair(w, lang), batch):
                if pair:
                    pairs.append({"word": pair["word"], "clue": pair["clue"]})
                    sources.add(pair["source"])
        if len(pairs) >= cfg["need"]:
            break
    if len(pairs) < 12:
        raise RuntimeError(f"Only {len(pairs)} usable word/clue pairs were found online.")
    random.shuffle(pairs)
    return pairs[:max(cfg["need"], 36)], sorted(sources)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_bytes(self, body, content_type="text/plain; charset=utf-8", status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self.send_bytes(HTML.encode("utf-8"), "text/html; charset=utf-8")
            return
        if parsed.path == "/api/pairs":
            q = urllib.parse.parse_qs(parsed.query)
            lang = q.get("lang", ["en"])[0]
            difficulty = q.get("difficulty", ["medium"])[0]
            if lang not in ("en", "es") or difficulty not in DIFFICULTY:
                self.send_bytes(json.dumps({"error": "Invalid settings"}).encode(), "application/json", 400)
                return
            try:
                pairs, sources = build_pairs(lang, difficulty)
                payload = json.dumps({"pairs": pairs, "sources": sources}, ensure_ascii=False).encode("utf-8")
                self.send_bytes(payload, "application/json; charset=utf-8")
            except Exception as e:
                payload = json.dumps({"error": str(e)}, ensure_ascii=False).encode("utf-8")
                self.send_bytes(payload, "application/json; charset=utf-8", 502)
            return
        self.send_bytes(b"Not found", status=404)

def main():
    server = ThreadingHTTPServer((HOST, 0), Handler)
    port = server.server_address[1]
    url = f"http://{HOST}:{port}/"
    print("Crossword Forge is running.")
    print(f"Open: {url}")
    print("Press Ctrl+C in this window to stop it.")
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Crossword Forge.")
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
