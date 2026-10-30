"use strict";

/* ============================================================
   Village of Roots
   A cooperative small-farm barter game. This is a client-only
   prototype: the other Coop members are simulated villagers and
   progress is saved in the browser (localStorage).
   ============================================================ */

const DAILY_AP = 6;
const MAX_AP = 10;
const SAVE_PREFIX = "vor:v1:";
const LAST_KEY = "vor:last";

/* ---------- Game data ---------- */

const ITEMS = {
  wheat_seed: { n: "Wheat Seed", e: "🌱", v: 6, kind: "seed", crop: "wheat" },
  carrot_seed: { n: "Carrot Seed", e: "🌱", v: 8, kind: "seed", crop: "carrot" },
  pumpkin_seed: { n: "Pumpkin Seed", e: "🌱", v: 12, kind: "seed", crop: "pumpkin" },
  wheat: { n: "Wheat", e: "🌾", v: 5, kind: "good" },
  carrot: { n: "Carrot", e: "🥕", v: 7, kind: "good" },
  pumpkin: { n: "Pumpkin", e: "🎃", v: 11, kind: "good" },
  fish: { n: "Fish", e: "🐟", v: 8, kind: "good" },
  meat: { n: "Game Meat", e: "🥩", v: 10, kind: "good" },
  flour: { n: "Flour", e: "🥣", v: 6, kind: "good" },
  salt: { n: "Salt", e: "🧂", v: 4, kind: "good" },
  bread: { n: "Bread", e: "🍞", v: 16, kind: "food", ap: 1 },
  stew: { n: "Veggie Stew", e: "🍲", v: 26, kind: "food", ap: 2 },
  pie: { n: "Fish Pie", e: "🥧", v: 30, kind: "food", ap: 3 },
  roast: { n: "Roast", e: "🍗", v: 32, kind: "food", ap: 3 },
};

const CROPS = {
  wheat: { seed: "wheat_seed", days: 2, yield: 2 },
  carrot: { seed: "carrot_seed", days: 3, yield: 2 },
  pumpkin: { seed: "pumpkin_seed", days: 4, yield: 2 },
};

const SEEDS = Object.keys(ITEMS).filter((k) => ITEMS[k].kind === "seed");
const ALL_ITEMS = Object.keys(ITEMS);
const NPC_WANTS = ALL_ITEMS.filter((k) => ITEMS[k].kind !== "seed");
const STORE_STOCK = ["wheat_seed", "carrot_seed", "pumpkin_seed", "flour", "salt"];

const RECIPES = [
  { id: "bread", out: ["bread", 2], inp: { flour: 1, wheat: 1 } },
  { id: "stew", out: ["stew", 2], inp: { carrot: 1, pumpkin: 1, salt: 1 } },
  { id: "pie", out: ["pie", 1], inp: { fish: 1, flour: 1, salt: 1 } },
  { id: "roast", out: ["roast", 1], inp: { meat: 1, carrot: 1, salt: 1 } },
];

const GOALS = [
  { name: "Harvest Feast", need: { bread: 4 }, reward: 30 },
  { name: "Winter Stores", need: { stew: 3, pie: 2 }, reward: 50 },
  { name: "Village Banquet", need: { roast: 4, bread: 4, stew: 2 }, reward: 80 },
];

const NPCS = [
  { name: "Ash", role: "Farmer", makes: ["wheat", "carrot", "pumpkin"] },
  { name: "Birch", role: "Hunter", makes: ["meat", "fish", "salt"] },
  { name: "Clover", role: "Cook", makes: ["bread", "stew", "flour", "pie"] },
];

/* ---------- State ---------- */

let S = null;
const ui = {
  tab: "home",
  seed: "wheat_seed",
  msg: "",
  offer: { giveItem: "", giveQty: 1, wantItem: "wheat", wantQty: 1 },
};

function newGame(user, coopId) {
  const contrib = { [user]: 0 };
  NPCS.forEach((n) => (contrib[n.name] = 0));
  return {
    v: 1,
    user,
    coopId,
    day: 1,
    ap: DAILY_AP,
    coins: 40,
    rep: 0,
    inv: { wheat_seed: 3, carrot_seed: 2, flour: 2, salt: 2 },
    plots: Array.from({ length: 6 }, () => ({ crop: null, growth: 0, watered: false })),
    coop: {
      treasury: {},
      goalIndex: 0,
      contrib,
      offers: [],
      nextId: 1,
      log: [],
    },
  };
}

function saveKey(user, coopId) {
  return `${SAVE_PREFIX}${coopId.toLowerCase()}:${user.toLowerCase()}`;
}

function save() {
  try {
    localStorage.setItem(saveKey(S.user, S.coopId), JSON.stringify(S));
    localStorage.setItem(LAST_KEY, JSON.stringify({ user: S.user, coop: S.coopId }));
  } catch (e) {
    /* storage unavailable: the game still runs, it just won't persist */
  }
}

function load(user, coopId) {
  try {
    const raw = localStorage.getItem(saveKey(user, coopId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/* ---------- Helpers ---------- */

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const have = (item) => S.inv[item] || 0;
const add = (item, n) => (S.inv[item] = have(item) + n);
const label = (item) => `${ITEMS[item].e} ${ITEMS[item].n}`;
const fmt = (x) => `${x.qty}× ${ITEMS[x.item].n}`;
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function take(item, n) {
  if (have(item) < n) return false;
  S.inv[item] = have(item) - n;
  return true;
}

function say(msg) {
  ui.msg = msg;
  S.coop.log.unshift({ day: S.day, msg });
  S.coop.log.length = Math.min(S.coop.log.length, 40);
}

function spendAp(n = 1) {
  if (S.ap < n) {
    say("Out of actions today. Eat something or press Sleep.");
    return false;
  }
  S.ap -= n;
  return true;
}

function commit() {
  save();
  render();
}

const isReady = (p) => p.crop && p.growth >= CROPS[p.crop].days;
const currentGoal = () => GOALS[S.coop.goalIndex] || null;

/* ---------- Homestead actions ---------- */

function tapPlot(i) {
  const p = S.plots[i];
  if (!p.crop) {
    if (have(ui.seed) < 1) {
      say("Pick a seed you own above, or buy some at the Market.");
      return commit();
    }
    if (!spendAp()) return commit();
    take(ui.seed, 1);
    p.crop = ITEMS[ui.seed].crop;
    p.growth = 0;
    p.watered = false;
    say(`Planted ${ITEMS[p.crop].n.toLowerCase()} in plot ${i + 1}.`);
  } else if (isReady(p)) {
    if (!spendAp()) return commit();
    const n = CROPS[p.crop].yield;
    add(p.crop, n);
    say(`Harvested ${n} ${ITEMS[p.crop].n.toLowerCase()}.`);
    p.crop = null;
    p.growth = 0;
    p.watered = false;
  } else if (!p.watered) {
    if (!spendAp()) return commit();
    p.watered = true;
    say(`Watered the ${ITEMS[p.crop].n.toLowerCase()}. It grows overnight.`);
  } else {
    say("Already watered. Sleep to let it grow.");
  }
  commit();
}

function fish() {
  if (!spendAp()) return commit();
  if (Math.random() < 0.2) {
    say("You fished all morning and caught nothing.");
  } else {
    const n = Math.random() < 0.3 ? 2 : 1;
    add("fish", n);
    say(`Caught ${n} fish.`);
  }
  commit();
}

function hunt() {
  if (!spendAp()) return commit();
  if (Math.random() < 0.45) {
    say("The game got away. Better luck next time.");
  } else {
    const n = Math.random() < 0.25 ? 2 : 1;
    add("meat", n);
    say(`Brought home ${n} game meat.`);
  }
  commit();
}

function nextDay() {
  S.day += 1;
  S.ap = DAILY_AP;
  S.plots.forEach((p) => {
    if (p.crop && p.watered) p.growth += 1;
    p.watered = false;
  });
  say(`Day ${S.day} begins.`);
  npcDay();
  commit();
}

/* ---------- Pack / Craft / Market ---------- */

function eat(item) {
  if (have(item) < 1) return;
  if (S.ap >= MAX_AP) {
    say("You're already full of energy.");
    return commit();
  }
  take(item, 1);
  S.ap = Math.min(MAX_AP, S.ap + ITEMS[item].ap);
  say(`Ate ${ITEMS[item].n.toLowerCase()}: +${ITEMS[item].ap} actions.`);
  commit();
}

function craft(id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!Object.entries(r.inp).every(([k, n]) => have(k) >= n)) {
    say("Missing ingredients for that recipe.");
    return commit();
  }
  if (!spendAp()) return commit();
  Object.entries(r.inp).forEach(([k, n]) => take(k, n));
  add(r.out[0], r.out[1]);
  say(`Cooked ${r.out[1]}× ${ITEMS[r.out[0]].n.toLowerCase()}.`);
  commit();
}

function buy(item) {
  const price = ITEMS[item].v;
  if (S.coins < price) {
    say(`Not enough coins for ${ITEMS[item].n.toLowerCase()}.`);
    return commit();
  }
  S.coins -= price;
  add(item, 1);
  say(`Bought 1 ${ITEMS[item].n.toLowerCase()} for ${price} coins.`);
  commit();
}

function sell(item) {
  if (!take(item, 1)) return;
  const price = Math.floor(ITEMS[item].v / 2);
  S.coins += price;
  say(`Sold 1 ${ITEMS[item].n.toLowerCase()} for ${price} coins. Bartering pays more!`);
  commit();
}

/* ---------- Barter offers (items held in escrow) ---------- */

function postOffer() {
  const o = ui.offer;
  const giveQty = Math.max(1, parseInt(o.giveQty, 10) || 1);
  const wantQty = Math.max(1, parseInt(o.wantQty, 10) || 1);
  if (!o.giveItem || !o.wantItem) {
    say("Choose what you give and what you want.");
    return commit();
  }
  if (o.giveItem === o.wantItem) {
    say("Offer something different from what you want.");
    return commit();
  }
  if (!take(o.giveItem, giveQty)) {
    say(`You don't have ${giveQty}× ${ITEMS[o.giveItem].n.toLowerCase()} to offer.`);
    return commit();
  }
  const c = S.coop;
  c.offers.push({
    id: c.nextId++,
    by: S.user,
    npc: false,
    give: { item: o.giveItem, qty: giveQty },
    want: { item: o.wantItem, qty: wantQty },
    status: "open",
    day: S.day,
  });
  say(`Posted offer: ${giveQty}× ${ITEMS[o.giveItem].n} for ${wantQty}× ${ITEMS[o.wantItem].n}. Your goods are held in escrow.`);
  commit();
}

function acceptOffer(id) {
  const o = S.coop.offers.find((x) => x.id === id);
  if (!o || o.status !== "open" || o.by === S.user) return;
  if (have(o.want.item) < o.want.qty) {
    say(`You need ${fmt(o.want)} to take that offer.`);
    return commit();
  }
  take(o.want.item, o.want.qty);
  add(o.give.item, o.give.qty);
  o.status = "done";
  o.takenBy = S.user;
  say(`Trade done with ${o.by}: you gave ${fmt(o.want)} and got ${fmt(o.give)}.`);
  commit();
}

function cancelOffer(id) {
  const o = S.coop.offers.find((x) => x.id === id);
  if (!o || o.status !== "open" || o.by !== S.user) return;
  add(o.give.item, o.give.qty);
  o.status = "cancelled";
  say(`Offer cancelled. ${fmt(o.give)} returned from escrow.`);
  commit();
}

/* ---------- Coop treasury & goals ---------- */

function donate(item) {
  const goal = currentGoal();
  const c = S.coop;
  if (!goal || !goal.need[item]) return;
  if ((c.treasury[item] || 0) >= goal.need[item]) {
    say("The treasury already has enough of that.");
    return commit();
  }
  if (!take(item, 1)) return;
  c.treasury[item] = (c.treasury[item] || 0) + 1;
  c.contrib[S.user] = (c.contrib[S.user] || 0) + 1;
  say(`You added 1 ${ITEMS[item].n.toLowerCase()} to the treasury.`);
  checkGoal();
  commit();
}

function checkGoal() {
  const goal = currentGoal();
  if (!goal) return;
  const c = S.coop;
  if (!Object.entries(goal.need).every(([k, n]) => (c.treasury[k] || 0) >= n)) return;
  Object.entries(goal.need).forEach(([k, n]) => (c.treasury[k] -= n));
  c.goalIndex += 1;
  S.coins += goal.reward;
  S.rep += 5;
  say(`🎉 The Coop finished "${goal.name}"! Everyone earns ${goal.reward} coins.`);
}

/* ---------- Simulated villagers ---------- */

function makeNpcOffer(npc) {
  const give = pick(npc.makes);
  const want = pick(NPC_WANTS.filter((k) => k !== give));
  const qg = 1 + Math.floor(Math.random() * 3);
  const ratio = 0.85 + Math.random() * 0.3;
  const qw = Math.min(6, Math.max(1, Math.round((ITEMS[give].v * qg * ratio) / ITEMS[want].v)));
  return {
    id: S.coop.nextId++,
    by: npc.name,
    npc: true,
    give: { item: give, qty: qg },
    want: { item: want, qty: qw },
    status: "open",
    day: S.day,
  };
}

function npcDay() {
  const c = S.coop;

  c.offers.forEach((o) => {
    if (o.status === "open" && o.npc && S.day - o.day >= 3) o.status = "expired";
  });

  c.offers
    .filter((o) => o.status === "open" && !o.npc)
    .forEach((o) => {
      const gv = ITEMS[o.give.item].v * o.give.qty;
      const wv = ITEMS[o.want.item].v * o.want.qty;
      if (gv >= wv * 0.8 && Math.random() < 0.5) {
        const npc = pick(NPCS).name;
        o.status = "done";
        o.takenBy = npc;
        add(o.want.item, o.want.qty);
        say(`${npc} took your offer: you received ${fmt(o.want)} for ${fmt(o.give)}.`);
      }
    });

  NPCS.forEach((n) => {
    const open = c.offers.filter((o) => o.status === "open" && o.by === n.name).length;
    if (open < 2 && Math.random() < 0.7) c.offers.push(makeNpcOffer(n));

    const goal = currentGoal();
    if (goal && Math.random() < 0.4) {
      const missing = Object.keys(goal.need).filter((k) => (c.treasury[k] || 0) < goal.need[k]);
      if (missing.length) {
        const k = pick(missing);
        c.treasury[k] = (c.treasury[k] || 0) + 1;
        c.contrib[n.name] = (c.contrib[n.name] || 0) + 1;
        say(`${n.name} added 1 ${ITEMS[k].n.toLowerCase()} to the treasury.`);
      }
    }
  });

  checkGoal();

  const closed = c.offers.filter((o) => o.status !== "open");
  if (closed.length > 20) {
    const drop = new Set(closed.slice(0, closed.length - 20).map((o) => o.id));
    c.offers = c.offers.filter((o) => !drop.has(o.id));
  }
}

/* ---------- Rendering ---------- */

function hint() {
  const empty = S.plots.some((p) => !p.crop);
  const anySeed = SEEDS.some((s) => have(s) > 0);
  if (S.ap <= 0) return "Out of actions. Eat a meal or tap Sleep ⬇";
  if (S.plots.some(isReady)) return "⬇ Tap a ready crop to harvest it";
  if (empty && anySeed) return "⬇ Tap an empty plot to plant a seed";
  if (S.plots.some((p) => p.crop && !p.watered)) return "⬇ Tap a dry crop to water it";
  if (empty && !anySeed) return "Buy seeds in the Market 🛒";
  return "Fish 🐟 or hunt 🥩, then Sleep to grow your crops";
}

function renderHeader() {
  $("coopTitle").textContent = S.coopId;
  $("coins").textContent = S.coins;
  $("hintText").textContent = hint();
  $("msgText").textContent = ui.msg;
  $("stats").innerHTML = `
    <div class="stat">☀️ Day ${S.day}</div>
    <div class="stat">⚡ ${S.ap}/${MAX_AP}</div>
    <div class="stat">⭐ ${S.rep}</div>
    <div class="stat">👤 ${esc(S.user)}</div>`;
}

function renderHome() {
  const seeds = SEEDS.map(
    (s) => `<button class="chip ${ui.seed === s ? "sel" : ""}" data-act="seed" data-id="${s}">
      ${ITEMS[s].e} ${ITEMS[s].n.replace(" Seed", "")} <b>${have(s)}</b></button>`,
  ).join("");

  const plots = S.plots
    .map((p, i) => {
      let ico = "🟫";
      let tag = "Empty";
      let status = "Tap to plant";
      if (p.crop) {
        const c = CROPS[p.crop];
        tag = ITEMS[p.crop].n;
        if (isReady(p)) {
          ico = ITEMS[p.crop].e;
          status = "Ready!";
        } else {
          ico = "🌱";
          status = `${p.watered ? "Watered" : "Dry"} ${p.growth}/${c.days}`;
        }
      }
      return `<div class="plot ${isReady(p) ? "ready" : ""}" data-act="plot" data-id="${i}">
        <div class="tag">${tag}</div><div class="crop-emoji">${ico}</div><div class="status">${status}</div></div>`;
    })
    .join("");

  $("tab-home").innerHTML = `
    <h3 class="title">Wilderness</h3>
    <div class="tile-row">
      <button class="tile" data-act="fish"><span class="tile-ico">🎣</span><span class="tile-label">Fish</span><small>1 ⚡ · reliable</small></button>
      <button class="tile" data-act="hunt"><span class="tile-ico">🏹</span><span class="tile-label">Hunt</span><small>1 ⚡ · risky</small></button>
    </div>
    <h3 class="title spaced">Homestead</h3>
    <div class="chip-row">${seeds}</div>
    <div class="farm-grid">${plots}</div>
    <div class="actions one"><button class="rare" data-act="sleep">🌙 Sleep → Day ${S.day + 1}</button></div>`;
}

function renderPack() {
  const items = ALL_ITEMS.filter((k) => have(k) > 0);
  const rows = items.length
    ? items
        .map((k) => {
          const it = ITEMS[k];
          const eatBtn =
            it.kind === "food"
              ? `<button class="mini" data-act="eat" data-id="${k}">Eat +${it.ap} ⚡</button>`
              : "";
          return `<div class="market-row"><div>${label(k)}<br><small>Worth ${it.v} coins</small></div>
            <div class="row-right"><b>×${have(k)}</b>${eatBtn}</div></div>`;
        })
        .join("")
    : `<p class="muted">Your pack is empty. Fish, hunt, or harvest something!</p>`;
  $("tab-pack").innerHTML = `
    <h3 class="title">Pack</h3>
    <p class="muted">Food restores actions (max ${MAX_AP}). Everything else is for crafting, trading and the Coop.</p>
    <div class="market-list">${rows}</div>`;
}

function renderCraft() {
  const cards = RECIPES.map((r) => {
    const ok = Object.entries(r.inp).every(([k, n]) => have(k) >= n);
    const needs = Object.entries(r.inp)
      .map(([k, n]) => `<span class="${have(k) >= n ? "ok" : "no"}">${ITEMS[k].e}${have(k)}/${n}</span>`)
      .join(" ");
    return `<div class="card"><div class="top"><strong>${label(r.out[0])} ×${r.out[1]}</strong><span>1 ⚡</span></div>
      <div class="needs">${needs}</div>
      <button class="rare" data-act="craft" data-id="${r.id}" ${ok ? "" : "disabled"}>Cook</button></div>`;
  }).join("");
  $("tab-craft").innerHTML = `
    <h3 class="title">Kitchen</h3>
    <p class="muted">Cooked food restores actions and fills the Coop treasury.</p>
    <div class="recipe-grid">${cards}</div>`;
}

function offerRow(o, mine) {
  const canTake = !mine && have(o.want.item) >= o.want.qty;
  const btn = mine
    ? `<button class="mini" data-act="cancel" data-id="${o.id}">Cancel</button>`
    : `<button class="mini" data-act="accept" data-id="${o.id}" ${canTake ? "" : "disabled"}>Trade</button>`;
  return `<div class="offer">
    <div><b>${esc(o.by)}</b> gives <b>${ITEMS[o.give.item].e} ${o.give.qty}</b><br>
    wants <b>${ITEMS[o.want.item].e} ${o.want.qty}</b> <small>(day ${o.day})</small></div>${btn}</div>`;
}

function renderMarket() {
  const buyRows = STORE_STOCK.map(
    (k) => `<div class="market-row"><div>${label(k)}<br><small>${ITEMS[k].v} coins</small></div>
      <button class="mini" data-act="buy" data-id="${k}" ${S.coins >= ITEMS[k].v ? "" : "disabled"}>Buy</button></div>`,
  ).join("");

  const sellRows =
    ALL_ITEMS.filter((k) => have(k) > 0)
      .map(
        (k) => `<div class="market-row"><div>${label(k)} ×${have(k)}<br><small>Store pays ${Math.floor(ITEMS[k].v / 2)}</small></div>
      <button class="mini" data-act="sell" data-id="${k}">Sell 1</button></div>`,
      )
      .join("") || `<p class="muted">Nothing to sell yet.</p>`;

  const open = S.coop.offers.filter((o) => o.status === "open");
  const board = open.filter((o) => o.by !== S.user).map((o) => offerRow(o, false)).join("") ||
    `<p class="muted">No offers right now. Sleep to see what the villagers post.</p>`;
  const mine = open.filter((o) => o.by === S.user).map((o) => offerRow(o, true)).join("");

  const o = ui.offer;
  const giveOpts = ALL_ITEMS.filter((k) => have(k) > 0)
    .map((k) => `<option value="${k}" ${o.giveItem === k ? "selected" : ""}>${label(k)} (${have(k)})</option>`)
    .join("");
  const wantOpts = ALL_ITEMS.map(
    (k) => `<option value="${k}" ${o.wantItem === k ? "selected" : ""}>${label(k)}</option>`,
  ).join("");

  $("tab-market").innerHTML = `
    <h3 class="title">Barter Board</h3>
    <p class="muted">Trading beats the store. Offers you post are held in escrow until someone takes them or you cancel.</p>
    <div class="market-list">${board}</div>
    ${mine ? `<h4 class="sub">Your open offers (in escrow)</h4><div class="market-list">${mine}</div>` : ""}
    <h4 class="sub">Post an offer</h4>
    <div class="form">
      <div class="form-row"><span>I give</span>
        <input type="number" min="1" id="giveQty" value="${o.giveQty}" />
        <select id="giveItem"><option value="">Choose…</option>${giveOpts}</select></div>
      <div class="form-row"><span>I want</span>
        <input type="number" min="1" id="wantQty" value="${o.wantQty}" />
        <select id="wantItem">${wantOpts}</select></div>
      <button class="rare wide" data-act="post">Post offer</button>
    </div>
    <h3 class="title spaced">Village Store</h3>
    <div class="market-list">${buyRows}</div>
    <h4 class="sub">Sell to the store</h4>
    <div class="market-list">${sellRows}</div>`;
}

function renderCoop() {
  const c = S.coop;
  const goal = currentGoal();
  let goalHtml;
  if (goal) {
    const rows = Object.entries(goal.need)
      .map(([k, n]) => {
        const got = c.treasury[k] || 0;
        const pct = Math.min(100, Math.round((got / n) * 100));
        const can = have(k) > 0 && got < n;
        return `<div class="goal"><div class="top"><strong>${label(k)}</strong><span>${got} / ${n}</span></div>
          <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
          <button class="mini wide" data-act="donate" data-id="${k}" ${can ? "" : "disabled"}>Give 1 (you have ${have(k)})</button></div>`;
      })
      .join("");
    goalHtml = `<div class="goal-head"><strong>${goal.name}</strong><span>Reward: ${goal.reward} 🪙 each</span></div>${rows}`;
  } else {
    goalHtml = `<p class="muted">🎉 Every Coop goal is complete. More are on the way!</p>`;
  }

  const escrow = {};
  c.offers
    .filter((o) => o.status === "open" && !o.npc)
    .forEach((o) => (escrow[o.give.item] = (escrow[o.give.item] || 0) + o.give.qty));
  const escrowTxt =
    Object.keys(escrow).map((k) => `${ITEMS[k].e}${escrow[k]}`).join(" ") || "nothing";

  const members = [{ name: S.user, role: "You" }, ...NPCS]
    .map(
      (m) => `<div class="market-row"><div><b>${esc(m.name)}</b><br><small>${m.role === "You" ? "You" : m.role + " · simulated"}</small></div>
      <span>${c.contrib[m.name] || 0} given</span></div>`,
    )
    .join("");

  const log = c.log.slice(0, 15).map((l) => `<div>Day ${l.day}: ${esc(l.msg)}</div>`).join("");

  $("tab-coop").innerHTML = `
    <h3 class="title">Coop Goal</h3>
    ${goalHtml}
    <p class="muted">Escrow currently holding: ${escrowTxt}</p>
    <h3 class="title spaced">Members</h3>
    <div class="market-list">${members}</div>
    <h3 class="title spaced">Village Log</h3>
    <div class="log">${log}</div>`;
}

function render() {
  if (!S) return;
  renderHeader();
  renderHome();
  renderPack();
  renderCraft();
  renderMarket();
  renderCoop();
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === `tab-${ui.tab}`));
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === ui.tab));
}

/* ---------- Modal ---------- */

const HELP_HTML = `
  <ul>
    <li>🌱 <b>Homestead:</b> pick a seed, tap a plot to plant, tap again to water, and again to harvest. Fish and hunt in the wilderness.</li>
    <li>⚡ Every action costs 1 energy. You get ${DAILY_AP} a day. Tap <b>Sleep</b> to start a new day.</li>
    <li>🍳 <b>Craft:</b> cook food. Eating restores energy.</li>
    <li>🛒 <b>Market:</b> barter with villagers or use the store. Trades beat store prices.</li>
    <li>🏘️ <b>Coop:</b> add food to the shared treasury to finish village goals together.</li>
  </ul>`;

function showModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modal").hidden = false;
}

function showMenu() {
  showModal(
    "Menu",
    `<p>Playing as <b>${esc(S.user)}</b> in Coop <b>${esc(S.coopId)}</b>.<br>Your progress saves automatically.</p>
     <div class="menu-btns"><button data-act="title">Back to Title</button>
     <button class="danger" data-act="reset">Reset this village</button></div>`,
  );
}

/* ---------- Events ---------- */

function startGame(user, coopId) {
  S = load(user, coopId) || newGame(user, coopId);
  ui.msg = S.day === 1 && !S.coop.log.length ? "Welcome to the village!" : "Welcome back!";
  ui.tab = "home";
  ui.seed = "wheat_seed";
  ui.offer = { giveItem: "", giveQty: 1, wantItem: "wheat", wantQty: 1 };
  $("startScreen").hidden = true;
  $("gameScreen").hidden = false;
  save();
  render();
}

const ACTIONS = {
  plot: (id) => tapPlot(+id),
  seed: (id) => {
    ui.seed = id;
    render();
  },
  fish,
  hunt,
  sleep: nextDay,
  eat: (id) => eat(id),
  craft: (id) => craft(id),
  buy: (id) => buy(id),
  sell: (id) => sell(id),
  post: postOffer,
  accept: (id) => acceptOffer(+id),
  cancel: (id) => cancelOffer(+id),
  donate: (id) => donate(id),
  title: () => {
    $("modal").hidden = true;
    $("gameScreen").hidden = true;
    $("startScreen").hidden = false;
    S = null;
  },
  reset: (_id, btn) => {
    if (!btn.dataset.armed) {
      btn.dataset.armed = "1";
      btn.textContent = "Tap again to confirm";
      return;
    }
    try {
      localStorage.removeItem(saveKey(S.user, S.coopId));
    } catch (e) {
      /* ignore */
    }
    const { user, coopId } = S;
    $("modal").hidden = true;
    S = null;
    startGame(user, coopId);
  },
};

function init() {
  try {
    const last = JSON.parse(localStorage.getItem(LAST_KEY) || "null");
    if (last) {
      $("userInput").value = last.user;
      $("coopInput").value = last.coop;
    }
  } catch (e) {
    /* ignore */
  }

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = $("userInput").value.trim();
    const coop = $("coopInput").value.trim().toLowerCase().replace(/\s+/g, "-");
    if (user && coop) startGame(user, coop);
  });

  $("startHelpBtn").addEventListener("click", () => showModal("How to Play", HELP_HTML));
  $("helpBtn").addEventListener("click", () => showModal("How to Play", HELP_HTML));
  $("menuBtn").addEventListener("click", showMenu);
  $("modalClose").addEventListener("click", () => ($("modal").hidden = true));

  $("tabbar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    ui.tab = btn.dataset.tab;
    render();
    $("content").scrollTop = 0;
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled || !ACTIONS[el.dataset.act]) return;
    ACTIONS[el.dataset.act](el.dataset.id, el);
  });

  $("tab-market").addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "giveItem") ui.offer.giveItem = t.value;
    if (t.id === "wantItem") ui.offer.wantItem = t.value;
    if (t.id === "giveQty") ui.offer.giveQty = t.value;
    if (t.id === "wantQty") ui.offer.wantQty = t.value;
  });
}

init();
