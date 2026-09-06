// Run with: node --test tests/botc-grimoire.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const html = fs.readFileSync(
  path.join(__dirname, "..", "BOTC-StorytellersGrimoire.html"),
  "utf8",
);
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function app() {
  const context = vm.createContext({ document: { addEventListener() {} } });
  vm.runInContext(script, context);
  return (code) => vm.runInContext(code, context);
}

test("all official characters, base scripts, night lists and jinxes resolve", () => {
  const run = app();
  assert.equal(run("DATA.characters.length"), 181);
  assert.equal(run("new Set(DATA.characters.map(r=>r.id)).size"), 181);
  assert.equal(run("SCRIPTS.tb.roles.length"), 22);
  assert.equal(run("SCRIPTS.bmr.roles.length"), 25);
  assert.equal(run("SCRIPTS.snv.roles.length"), 25);
  assert(run("Object.values(SCRIPTS).every(s=>s.roles.every(id=>role(id)))"));
  assert(
    run(
      'Object.values(DATA.night).every(ids=>ids.every(id=>role(id)||["dusk","dawn","minioninfo","demoninfo"].includes(id)))',
    ),
  );
  assert(
    run(
      'Object.keys(DATA.jinxes).every(pair=>pair.split("-").every(id=>role(id)))',
    ),
  );
  assert.equal(run('role("bureaucrat").team'), "traveller");
  assert.equal(run('role("zealot").team'), "outsider");
  assert.match(run('role("goblin").ability'), /claim to be the Goblin/);
  assert.match(run('role("tinker").ability'), /any time/);
});

test("night order protects before kills, informs afterward and keeps conditional death actions", () => {
  const run = app();
  run(
    'state.players[0].role="monk";state.players[1].role="imp";state.players[2].role="empath";state.players[3].role="ravenkeeper";state.players[3].dead=true;state.players[4].role="artist";',
  );
  const ids = JSON.parse(
    run('JSON.stringify(nightEntries("other").map(e=>e.name))'),
  );
  assert(ids.indexOf("Monk") < ids.indexOf("Imp"));
  assert(ids.indexOf("Imp") < ids.indexOf("Empath"));
  assert(ids.includes("Ravenkeeper"));
  assert(!ids.includes("Artist"));
  assert(run('nightEntries("other").find(e=>e.name==="Ravenkeeper").dead'));
  assert(!run('nightEntries("first").some(e=>e.name==="Monk")'));
});

test("shown characters have their own wake steps and Teensyville suppresses evil info", () => {
  const run = app();
  run(
    'state.players=state.players.slice(0,5);state.players[0].role="drunk";state.players[0].secondary="empath";',
  );
  assert(run('nightEntries("first").some(e=>e.name==="Empath (Drunk)")'));
  assert(!run('nightEntries("first").some(e=>e.name==="Demon information")'));
  run('state=freshState();state.players[0].role="poppygrower";');
  assert(!run('nightEntries("first").some(e=>e.name==="Minion information")'));
});

test("setup counts keep actual roles, dead players and Travellers separate", () => {
  const run = app();
  run(
    'state.players[0].role="drunk";state.players[0].secondary="monk";state.players[0].dead=true;state.players[1].role="baron";const traveller=makePlayer(9,true);traveller.role="bureaucrat";state.players.push(traveller);',
  );
  assert.deepEqual(
    JSON.parse(run("JSON.stringify(setupInfo().actual)")),
    [0, 1, 1, 0],
  );
  assert.deepEqual(
    JSON.parse(run("JSON.stringify(setupInfo().base)")),
    [5, 1, 1, 1],
  );
  assert(run('setupInfo().warnings.some(w=>w.includes("Baron"))'));
});

test("game backup round trip retains notes, statuses, votes, links, extras and scripts", () => {
  const run = app();
  run(
    'state.players[0].role="poisoner";state.players[1].role="empath";state.players[1].dead=true;state.players[1].ghostVote=false;state.players[1].notes="<script>private & safe</script>";state.reminders=[{source:1,target:2,label:"Poisoned"}];state.extras=["sentinel"];state.bluffs=["monk",null,null];state.bluffNotes=["Remember", "", ""];state.custom=parseScript(["imp","poisoner"]);state.script="custom";state.phase=4;',
  );
  assert.equal(
    run("JSON.stringify(validateGame(JSON.parse(JSON.stringify(state))))"),
    run("JSON.stringify(state)"),
  );
});

test("invalid imports reject atomically, including duplicate seats and broken reminders", () => {
  const run = app();
  for (const mutation of [
    "data.players[1].id=1",
    'data.players[0].role="unknown"',
    'data.players[0].role="constructor"',
    'data.players[0].role="bureaucrat"',
    'data.players[0].secondary="sentinel"',
    'data.reminders=[{source:1,target:100,label:"Bad"}]',
    'data.bluffs=["imp",null,null]',
    'data.extras=["imp"]',
    "data.phase=-1",
    "data.players=data.players.slice(0,4)",
    'data.script="custom"',
  ]) {
    assert.throws(
      () => run(`{const data=freshState();${mutation};validateGame(data);}`),
      mutation,
    );
  }
  assert.equal(run("state.players.length"), 8);
});

test("official script imports normalize IDs and reject unsupported homebrew", () => {
  const run = app();
  assert.deepEqual(
    JSON.parse(
      run(
        'JSON.stringify(parseScript([{id:"_meta",name:"Our script"},"fortune_teller",{id:"Devil’s Advocate"},"imp","imp"]))',
      ),
    ),
    { name: "Our script", roles: ["fortuneteller", "devilsadvocate", "imp"] },
  );
  assert.throws(() => run('parseScript(["not-a-real-role"])'));
  assert.throws(() => run('parseScript([{id:"_meta"}])'));
  assert.throws(() => run('parseScript(["constructor"])'));
});

test("assignment rules prevent evil bluffs and incorrectly placed Travellers or special rules", () => {
  const run = app();
  assert(run('canAssign("monk","bluff:0")'));
  assert(!run('canAssign("imp","bluff:0")'));
  assert(!run('canAssign("bureaucrat","player:1")'));
  assert(!run('canAssign("sentinel","player:1")'));
  assert(run('canAssign("sentinel","extra")'));
  run("state.players.push(makePlayer(9,true))");
  assert(run('canAssign("bureaucrat","player:9")'));
  assert(!run('canAssign("monk","player:9")'));
});

test("user text is escaped for both HTML attributes and text content", () => {
  const run = app();
  assert.equal(
    run(`esc('<img src=x onerror="alert(1)"> &')`),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;",
  );
});

test("character changes preserve alignment, death and notes while clearing old source reminders", () => {
  const run = app();
  run("commit = change => change(); toast = () => {};");
  run('assignRole("poisoner", "player:1");');
  assert.equal(run("state.players[0].alignment"), "evil");
  run(
    'state.players[0].dead=true;state.players[0].notes="A private note";state.reminders=[{source:1,target:2,label:"Poisoned"}];assignRole("monk", "player:1");',
  );
  assert.equal(run("state.players[0].alignment"), "evil");
  assert.equal(run("state.players[0].role"), "monk");
  assert(run("state.players[0].dead"));
  assert.equal(run("state.players[0].notes"), "A private note");
  assert.equal(run("state.reminders.length"), 0);
});
