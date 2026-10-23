const cropInfo = {
  wheat: { name: "Wheat", emoji: "🌾", sell: 12, growth: 2 },
  carrot: { name: "Carrot", emoji: "🥕", sell: 18, growth: 3 },
  berry: { name: "Berry", emoji: "🫐", sell: 24, growth: 4 },
};

const state = {
  day: 1,
  coins: 120,
  wood: 20,
  stone: 12,
  energy: 10,
  rep: 0,
  wildFood: 0,
  weaponLevel: 0,
  marketLevel: 1,
  bankLevel: 1,
  stockValue: 12,
  stockOwned: 0,
  moonwellLevel: 1,
  lampCount: 0,
  tables: 0,
  ovens: 0,
  stoves: 0,
  bakeryOvens: 0,
  bakeryDisplays: 0,
  inventory: {
    wheat: 0,
    carrot: 0,
    berry: 0,
    flour: 5,
    eggs: 3,
    magicDust: 0,
  },
  foodShelf: {
    bread: 0,
    pastry: 0,
    soup: 0,
    meal: 0,
  },
  bakeryGoods: {
    bread: 0,
    pastry: 0,
  },
  plotSeeds: { wheat: 7, carrot: 4, berry: 2 },
  plots: Array.from({ length: 6 }, () => ({
    planted: null,
    growth: 0,
    watered: false,
  })),
};

const logPanel = document.getElementById("logPanel");
const farmGrid = document.getElementById("farmGrid");
const goalsList = document.getElementById("goalsList");
const marketList = document.getElementById("marketList");

const bannerText = document.getElementById("bannerText");

function log(msg) {
  const item = document.createElement("div");
  item.textContent = msg;
  logPanel.prepend(item);
  bannerText.textContent = msg;
}

function updateStats() {
  document.getElementById("day").textContent = state.day;
  document.getElementById("coins").textContent = state.coins;
  document.getElementById("wood").textContent = state.wood;
  document.getElementById("stone").textContent = state.stone;
  document.getElementById("energy").textContent = state.energy;
  document.getElementById("rep").textContent = state.rep;
  document.getElementById("weaponName").textContent = currentWeaponName();
  updateForge();

  document.getElementById("ovenCount").textContent = state.bakeryOvens;
  document.getElementById("displayCount").textContent = state.bakeryDisplays;
  document.getElementById("tableCount").textContent = state.tables;
  document.getElementById("stoveCount").textContent = state.stoves;
  document.getElementById("stockLevel").textContent = state.marketLevel;
  document.getElementById("bankLevel").textContent = state.bankLevel;
  document.getElementById("moonwellLevel").textContent = state.moonwellLevel;
  document.getElementById("lampCount").textContent = state.lampCount;
}

function renderFarm() {
  farmGrid.innerHTML = "";

  state.plots.forEach((plot, idx) => {
    const el = document.createElement("div");
    el.className = "plot";

    const tag = document.createElement("div");
    tag.className = "tag";
    tag.textContent = plot.planted ? cropInfo[plot.planted].name : "Empty";
    el.appendChild(tag);

    if (plot.planted) {
      const emoji = document.createElement("div");
      emoji.className = "crop-emoji";
      emoji.textContent = cropInfo[plot.planted].emoji;
      el.appendChild(emoji);

      const status = document.createElement("div");
      status.className = "status";
      const ready = plot.growth >= cropInfo[plot.planted].growth;
      status.textContent = ready ? "Ready" : plot.watered ? "Watered" : "Dry";
      el.appendChild(status);
    } else {
      const emoji = document.createElement("div");
      emoji.className = "crop-emoji";
      emoji.textContent = "🌱";
      el.appendChild(emoji);

      const status = document.createElement("div");
      status.className = "status";
      status.textContent = "Empty";
      el.appendChild(status);
    }

    el.addEventListener("click", () => plantOrHarvest(idx));
    farmGrid.appendChild(el);
  });
}

function renderInventory() {
  const bakeryDiv = document.getElementById("bakeryInventory");
  bakeryDiv.innerHTML = "";

  const bakeryItems = [
    ["Bread", state.bakeryGoods.bread],
    ["Pastry", state.bakeryGoods.pastry],
  ];

  bakeryItems.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "itemchip";
    item.textContent = `${label}: ${value}`;
    bakeryDiv.appendChild(item);
  });

  const foodDiv = document.getElementById("foodShelfInventory");
  foodDiv.innerHTML = "";

  const foodItems = [
    ["Bread", state.foodShelf.bread],
    ["Pastry", state.foodShelf.pastry],
    ["Soup", state.foodShelf.soup],
    ["Meal", state.foodShelf.meal],
  ];

  foodItems.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "itemchip";
    item.textContent = `${label}: ${value}`;
    foodDiv.appendChild(item);
  });

  const magicDiv = document.getElementById("magicInventory");
  magicDiv.innerHTML = "";

  const magicItems = [
    ["Flour", state.inventory.flour],
    ["Eggs", state.inventory.eggs],
    ["Magic Dust", state.inventory.magicDust],
    ["Moonwell", state.moonwellLevel],
    ["Wild Food", state.wildFood],
    ["Wood", state.wood],
    ["Stone", state.stone],
    ["Weapon", currentWeaponName()],
  ];

  magicItems.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "itemchip";
    item.textContent = `${label}: ${value}`;
    magicDiv.appendChild(item);
  });
}

function renderGoals() {
  const goals = [
    { text: "Harvest 12 crops", goal: 12, progress: countAllHarvest() },
    { text: "Build 4 village upgrades", goal: 4, progress: countUpgrades() },
    {
      text: "Sell 50 bakery goods",
      goal: 50,
      progress: state.rep + state.bakeryGoods.bread + state.bakeryGoods.pastry,
    },
  ];

  goalsList.innerHTML = "";

  goals.forEach((goal) => {
    const pct = Math.min(100, Math.round((goal.progress / goal.goal) * 100));
    const item = document.createElement("div");
    item.className = "goal";

    item.innerHTML = `
      <div><strong>${goal.text}</strong></div>
      <div>${Math.min(goal.progress, goal.goal)} / ${goal.goal}</div>
      <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
    `;
    goalsList.appendChild(item);
  });
}

function countAllHarvest() {
  return (
    state.inventory.wheat +
    state.inventory.carrot +
    state.inventory.berry +
    state.foodShelf.bread +
    state.foodShelf.pastry +
    state.foodShelf.meal
  );
}

function countUpgrades() {
  return (
    state.marketLevel +
    state.bankLevel +
    state.moonwellLevel +
    state.lampCount +
    state.tables +
    state.stoves +
    state.bakeryOvens +
    state.bakeryDisplays
  );
}

function renderMarket() {
  const symbols = [
    { name: "Wheat", price: 12, trend: 0 },
    { name: "Berry", price: 18, trend: 0 },
    { name: "Bakery", price: 30, trend: 0 },
    { name: "Magic", price: 42, trend: 0 },
  ];

  marketList.innerHTML = "";
  symbols.forEach((item) => {
    const row = document.createElement("div");
    row.className = "market-row";

    const left = document.createElement("div");
    left.innerHTML = `<strong>${item.name}</strong><br><small>Price: ${item.price} coins</small>`;
    row.appendChild(left);

    const button = document.createElement("button");
    button.textContent = "Buy";
    button.onclick = () => buyMarketShare(item.name, item.price);
    row.appendChild(button);

    marketList.appendChild(row);
  });
}

function buyMarketShare(name, price) {
  const cost = price;
  if (state.coins < cost) {
    log("Not enough coins for market investment.");
    return;
  }
  state.coins -= cost;

  state.stockOwned += 1;
  const gain = Math.round(Math.random() * 8 + 4);
  state.coins += gain;
  log(`Invested in ${name}. Gain +${gain} coins from market activity.`);
  updateStats();
  renderGoals();
}

function setMarketPrices() {
  const list = marketList.children;
  const prices = [12, 18, 30, 42];
  Array.from(list).forEach((row, idx) => {
    const val = row.querySelector("small");
    if (val) {
      const next = prices[idx] + (Math.random() > 0.5 ? 3 : -2);
      val.innerHTML = `Price: ${Math.max(8, next)} coins`;
    }
  });
}

const WEAPONS = [
  "Bare hands",
  "Wooden Club",
  "Stone Axe",
  "Stone Sword",
  "Star Blade",
];

function currentWeaponName() {
  return WEAPONS[state.weaponLevel];
}

function forgeCost() {
  const tier = state.weaponLevel + 1;
  return { wood: 10 * tier, stone: 5 * tier };
}

function updateForge() {
  const next = WEAPONS[state.weaponLevel + 1];
  const nameEl = document.getElementById("forgeNext");
  const costEl = document.getElementById("forgeCost");
  const btn = document.getElementById("forgeBtn");
  if (!next) {
    nameEl.textContent = "Fully upgraded";
    costEl.textContent = "";
    btn.disabled = true;
    return;
  }
  const cost = forgeCost();
  nameEl.textContent = next;
  costEl.textContent = `${cost.wood} 🪵 + ${cost.stone} 🪨`;
  btn.disabled = false;
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function forage() {
  if (state.energy < 1) {
    log("Too tired to forage. Eat some food or press Next Day.");
    return;
  }
  state.energy -= 1;
  const found = randInt(1, 3);
  state.wildFood += found;
  log(`Foraged ${found} food from the wilderness.`);
  updateStats();
  renderInventory();
}

function gatherMaterials() {
  if (state.energy < 1) {
    log("Too tired to gather. Eat some food or press Next Day.");
    return;
  }
  state.energy -= 1;
  const wood = randInt(1, 3);
  const stone = randInt(0, 2);
  state.wood += wood;
  state.stone += stone;
  log(`Gathered ${wood} wood and ${stone} stone.`);
  updateStats();
  renderInventory();
}

function eatFood() {
  if (state.wildFood < 1) {
    log("No food to eat. Try foraging.");
    return;
  }
  if (state.energy >= 12) {
    log("Energy is already full.");
    return;
  }
  state.wildFood -= 1;
  state.energy = Math.min(12, state.energy + 2);
  log("Ate some food. +2 energy.");
  updateStats();
  renderInventory();
}

function forgeWeapon() {
  if (!WEAPONS[state.weaponLevel + 1]) return;
  const cost = forgeCost();
  if (state.wood < cost.wood || state.stone < cost.stone) {
    log(`Need ${cost.wood} wood and ${cost.stone} stone to craft that.`);
    return;
  }
  state.wood -= cost.wood;
  state.stone -= cost.stone;
  state.weaponLevel += 1;
  log(`Crafted a ${currentWeaponName()}!`);
  updateStats();
  renderInventory();
}

function haveSeed(seedType) {
  return state.plotSeeds[seedType] > 0;
}

function plantOrHarvest(index) {
  const plot = state.plots[index];

  if (!plot.planted) {
    const seedOptions = ["wheat", "carrot", "berry"];
    let chosen = null;
    for (const type of seedOptions) {
      if (haveSeed(type)) {
        chosen = type;
        break;
      }
    }

    if (!chosen) {
      log("No seeds available. Buy more from the market.");
      return;
    }

    state.plotSeeds[chosen] -= 1;
    plot.planted = chosen;
    plot.growth = 0;
    plot.watered = false;

    log(`Planted ${cropInfo[chosen].name} in plot ${index + 1}.`);
  } else {
    if (plot.growth >= cropInfo[plot.planted].growth) {
      state.inventory[plot.planted] += 1;
      log(`Harvested ${cropInfo[plot.planted].name} from plot ${index + 1}.`);
      plot.planted = null;
      plot.growth = 0;
      plot.watered = false;
    } else {
      log("Crop not ready yet. Water it and wait for more growth.");
    }
  }

  renderFarm();
  renderGoals();
}

function nextDay() {
  state.day += 1;
  state.energy = Math.min(12, state.energy + 1);
  let magicBonus = 0;

  if (state.moonwellLevel >= 2) magicBonus += 1;
  if (state.lampCount > 0) magicBonus += 1;

  state.plots.forEach((plot) => {
    if (plot.planted) {
      const growthGain = plot.watered ? 1 + magicBonus : 0;
      plot.growth += growthGain;
      plot.watered = false;
    }
  });

  // Bakery production
  if (state.bakeryOvens > 0) {
    const breadMade = state.bakeryOvens + state.bakeryDisplays;
    state.bakeryGoods.bread += breadMade;
    if (state.bakeryDisplays > 0)
      state.bakeryGoods.pastry += Math.max(1, state.bakeryDisplays - 1);
  }

  // market value fluctuation
  state.stockValue += Math.random() > 0.5 ? 2 : -1;
  renderMarket();
  log(`Day ${state.day}: growth and bakery output processed.`);
  updateStats();
  renderInventory();
  renderGoals();
  renderFarm();
}

function waterAll() {
  if (state.energy === 0) {
    log("Not enough energy.");
    return;
  }
  state.energy -= 1;
  state.plots.forEach((plot) => {
    if (plot.planted) plot.watered = true;
  });
  log("All crops watered.");
  updateStats();
  renderFarm();
}

function harvestReady() {
  let count = 0;
  state.plots.forEach((plot) => {
    if (plot.planted && plot.growth >= cropInfo[plot.planted].growth) {
      state.inventory[plot.planted] += 1;
      count++;
      plot.planted = null;
      plot.growth = 0;
      plot.watered = false;
    }
  });

  if (count === 0) {
    log("No ready crops.");
  } else {
    log(`Harvested ${count} ready crop(s).`);
  }

  renderFarm();
  renderGoals();
  renderInventory();
}

function sellHarvest() {
  let total = 0;

  ["wheat", "carrot", "berry"].forEach((type) => {
    const amount = state.inventory[type];
    if (amount > 0) {
      total += amount * cropInfo[type].sell;
      state.inventory[type] = 0;
    }
  });

  if (total === 0) {
    log("Nothing to sell.");
    return;
  }

  state.coins += total;
  state.rep += Math.floor(total / 25);
  log(`Sold harvest for ${total} coins.`);
  updateStats();
  renderInventory();
  renderGoals();
}

function buySeed(type) {
  const cost = { wheat: 8, carrot: 10, berry: 14 }[type];
  if (state.coins < cost) {
    log("Not enough coins.");
    return;
  }
  state.coins -= cost;
  state.plotSeeds[type] += 1;
  log(`Bought one ${type} seed.`);
  updateStats();
  renderGoals();
}

function buyFlour() {
  if (state.coins < 8) {
    log("Not enough coins.");
    return;
  }
  state.coins -= 8;
  state.inventory.flour += 1;
  log("Bought flour.");
  renderInventory();
  updateStats();
}

function buyEggs() {
  if (state.coins < 12) {
    log("Not enough coins.");
    return;
  }
  state.coins -= 12;
  state.inventory.eggs += 1;
  log("Bought eggs.");
  renderInventory();
  updateStats();
}

function buyMagicDust() {
  if (state.coins < 20) {
    log("Not enough coins.");
    return;
  }
  state.coins -= 20;
  state.inventory.magicDust += 1;
  log("Bought magic dust.");
  renderInventory();
  updateStats();
}

function bakeBread() {
  if (state.inventory.flour < 2 || state.inventory.eggs < 1) {
    log("Need flour and eggs to bake bread.");
    return;
  }

  state.inventory.flour -= 2;
  state.inventory.eggs -= 1;
  state.bakeryGoods.bread += 1 + state.bakeryOvens;
  log("Baked fresh bread.");
  renderInventory();
  renderGoals();
}

function sellBakeryGoods() {
  const total = state.bakeryGoods.bread * 18 + state.bakeryGoods.pastry * 24;
  if (total <= 0) {
    log("No bakery goods to sell.");
    return;
  }

  state.coins += total;
  state.rep += Math.floor(total / 20);
  state.bakeryGoods.bread = 0;
  state.bakeryGoods.pastry = 0;
  log(`Sold bakery goods for ${total} coins.`);
  renderInventory();
  updateStats();
  renderGoals();
}

function serveMeals() {
  const mealIncome =
    state.tables * 16 + state.stoves * 10 + state.foodShelf.meal * 8;
  if (mealIncome <= 0) {
    log("Restaurant is not ready to serve meals.");
    return;
  }

  state.coins += mealIncome;
  state.foodShelf.meal = 0;
  state.foodShelf.bread = 0;
  state.foodShelf.pastry = 0;
  state.foodShelf.soup = 0;
  log(`Served meals and earned ${mealIncome} coins.`);
  updateStats();
  renderInventory();
  renderGoals();
}

function buyUpgrade(kind) {
  const costs = {
    buyOven: 60,
    buyDisplay: 75,
    buyTable: 40,
    buyStove: 55,
    buyStockMarket: 80,
    buyBank: 90,
    upgradeMoonwell: 70,
    buyLamp: 65,
  };

  if (state.coins < costs[kind]) {
    log("Not enough coins.");
    return;
  }

  state.coins -= costs[kind];

  switch (kind) {
    case "buyOven":
      state.bakeryOvens += 1;
      log("Bakery oven purchased.");
      break;
    case "buyDisplay":
      state.bakeryDisplays += 1;
      log("Bakery display upgraded.");
      break;
    case "buyTable":
      state.tables += 1;
      log("Restaurant table added.");
      break;
    case "buyStove":
      state.stoves += 1;
      log("Restaurant stove added.");
      break;
    case "buyStockMarket":
      state.marketLevel += 1;
      state.rep += 3;
      log("Stock market upgraded.");
      break;
    case "buyBank":
      state.bankLevel += 1;
      state.coins += state.bankLevel * 10;
      log("Bank upgraded; savings improved.");
      break;
    case "upgradeMoonwell":
      state.moonwellLevel += 1;
      log("Moonwell upgraded.");
      break;
    case "buyLamp":
      state.lampCount += 1;
      log("Magical lamp added.");
      break;
  }

  updateStats();
  renderInventory();
  renderGoals();
}

function bindButtons() {
  document.getElementById("forageBtn").addEventListener("click", forage);
  document.getElementById("gatherBtn").addEventListener("click", gatherMaterials);
  document.getElementById("eatBtn").addEventListener("click", eatFood);
  document.getElementById("forgeBtn").addEventListener("click", forgeWeapon);
  document.getElementById("nextDayBtn").addEventListener("click", nextDay);
  document.getElementById("waterBtn").addEventListener("click", waterAll);
  document.getElementById("harvestBtn").addEventListener("click", harvestReady);
  document.getElementById("sellBtn").addEventListener("click", sellHarvest);
  document.getElementById("bakeBreadBtn").addEventListener("click", bakeBread);
  document
    .getElementById("sellBakeryBtn")
    .addEventListener("click", sellBakeryGoods);
  document
    .getElementById("serveMealsBtn")
    .addEventListener("click", serveMeals);
  document
    .getElementById("stockMarketTradeBtn")
    .addEventListener("click", () => {
      const price = Math.max(8, state.stockValue);
      if (state.coins < price) {
        log("Not enough coins to trade shares.");
        return;
      }
      state.coins -= price;
      state.stockOwned += 1;
      state.coins += Math.round(price * 0.4);
      log(`Trade executed on stock market. Value ${price}.`);
      updateStats();
    });

  document.querySelectorAll("[data-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.dataset.role;

      if (role === "buySeed") {
        buySeed(btn.dataset.seed);
        return;
      }

      if (role === "buyFlour") {
        buyFlour();
        return;
      }

      if (role === "buyEggs") {
        buyEggs();
        return;
      }

      if (role === "buyMagicDust") {
        buyMagicDust();
        return;
      }

      buyUpgrade(role);
    });
  });
}

const HELP_HTML = `
  <ul>
    <li>🌱 <b>Actions:</b> tap a plot to plant or harvest, water your crops, then press Next Day.</li>
    <li>🎒 <b>Inventory:</b> see what you've harvested and baked.</li>
    <li>🍞 <b>Craft:</b> bake bread and run your restaurant.</li>
    <li>🗺️ <b>Map:</b> track village goals and buy seeds and supplies.</li>
    <li>✨ <b>Camp:</b> magic upgrades, bank and stock market.</li>
  </ul>`;

function showModal(title, bodyHtml) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modal").hidden = false;
}

function bindShell() {
  const startScreen = document.getElementById("startScreen");
  const gameScreen = document.getElementById("gameScreen");

  document.getElementById("playBtn").addEventListener("click", () => {
    startScreen.hidden = true;
    gameScreen.hidden = false;
  });

  document
    .getElementById("startHelpBtn")
    .addEventListener("click", () => showModal("How to Play", HELP_HTML));
  document
    .getElementById("helpBtn")
    .addEventListener("click", () => showModal("How to Play", HELP_HTML));

  document.getElementById("menuBtn").addEventListener("click", () => {
    showModal(
      "Menu",
      "<p>Saving and settings are coming soon.</p>" +
        '<button id="quitBtn">Back to Title</button>',
    );
    document.getElementById("quitBtn").addEventListener("click", () => {
      document.getElementById("modal").hidden = true;
      gameScreen.hidden = true;
      startScreen.hidden = false;
    });
  });

  document.getElementById("modalClose").addEventListener("click", () => {
    document.getElementById("modal").hidden = true;
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.toggle("active", b === btn));
      document
        .querySelectorAll(".tab")
        .forEach((t) =>
          t.classList.toggle("active", t.id === `tab-${btn.dataset.tab}`),
        );
      document.querySelector(".content").scrollTop = 0;
    });
  });
}

function init() {
  log(
    "Welcome to Stardust Homestead! Your magical bakery and restaurant dream begins.",
  );
  bannerText.textContent = "⬇ Forage for food or Gather materials below";
  updateStats();
  renderFarm();
  renderInventory();
  renderGoals();
  renderMarket();
  bindButtons();
  bindShell();
}

init();
