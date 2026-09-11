(() => {
  const $ = (selector) => document.querySelector(selector);
  const CHANNEL = "ecology-ui-comparison-c1";
  const pending = new Map();
  let requestId = 0;
  let model = null;
  let replay = null;
  let index = 0;
  let phase = "before";
  let playing = false;
  let timer = null;
  let editing = false;
  let view = "visual";
  let selected = null;
  let busy = false;
  let initialized = false;
  let effectFrameKey = "";
  let replayRevision = 0;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const signed = (value) => `${value > 0 ? "+" : ""}${value}`;
  const sideName = (side) => side === "player" ? "自分" : "相手";
  const ranks = ["前衛", "中衛", "後衛"];
  const lanes = ["左", "中", "右"];
  const icons = {
    singleAttack: "sword", areaAttack: "swords", searchAttack: "crosshair", executeBonus: "target", directAlphaAttack: "crosshair", backlineAttack: "scan-line",
    poison: "flask-conical", healBlock: "heart-off", defenseDown: "shield-minus", armor: "shield",
    heal: "heart-pulse", atBuff: "trending-up", agBuff: "wind", agDebuff: "wind", ultimateCharge: "zap",
    armorPierce: "shield-off", barrierPierce: "shield-off", damageCut: "shield-check", contactPoison: "flask-conical",
    reflectShell: "undo-2", reflect: "undo-2", counter: "undo-2", regen: "heart-pulse", paralysis: "ban", barrier: "shield",
    atDebuff: "trending-down", poisonResist: "shield-check", targetEvasion: "eye-off", groupReference: "network",
    ultimatePayoff: "zap", frontDurability: "shield-check", terrainBypass: "footprints", terrainDependency: "mountain", wait: "hourglass",
  };
  const speciesIcons = { mammal: "paw-print", reptile: "turtle", bird: "bird", fish: "fish", insect: "bug", crustacean: "shell", mollusk: "shell", plant: "sprout", fungus: "flower-2", dragon: "flame", inorganic: "gem" };
  const terrainIcons = { plain: "minus", forest: "trees", sea: "waves", highland: "mountain", nest: "hexagon", rampart: "brick-wall" };
  function icon(name, label = "") { return `<i data-lucide="${name || "circle"}"${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}></i>`; }
  function paintIcons() {
    globalThis.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
    document.querySelectorAll(".effect-hp .effect-shape svg, .effect-armor .effect-shape svg")
      .forEach((svg) => svg.setAttribute("preserveAspectRatio", "none"));
  }
  function request(command, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error("応答がありません。ページを再読み込みしてください。")); }, 30000);
      pending.set(id, { resolve, reject, timeout });
      $("#engine").contentWindow.postMessage({ channel: CHANNEL, requestId: id, command, ...payload }, "*");
    });
  }
  window.addEventListener("message", (event) => {
    if (event.source !== $("#engine").contentWindow || event.data?.channel !== CHANNEL) return;
    if (event.data.ready) { initialize(); return; }
    const call = pending.get(event.data.requestId);
    if (!call) return;
    clearTimeout(call.timeout);
    pending.delete(event.data.requestId);
    if (event.data.error) call.reject(new Error(event.data.error)); else call.resolve(event.data.data);
  });
  async function safe(work) {
    if (busy) return;
    busy = true;
    controls();
    try { await work(); } catch (error) { message(error.message, true); }
    finally { busy = false; controls(); }
  }
  function message(text = "", error = false) {
    $("#message").textContent = text;
    $("#message").classList.toggle("error", error);
  }
  async function initialize() {
    if (initialized) return;
    initialized = true;
    await safe(async () => {
      acceptSetup(await request("setup"));
      await runBattle();
    });
  }
  $("#engine").addEventListener("load", initialize);
  // A cached child can become ready before the deferred parent script runs.
  request("setup").then((data) => { if (!initialized) { initialized = true; acceptSetup(data); safe(runBattle); } }).catch(() => {});

  function acceptSetup(data, invalidate = false) {
    model = data;
    for (const side of ["player", "enemy"]) {
      $(`#${side}Preset`).innerHTML = data.catalog.presets.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
      $(`#${side}Preset`).value = data[`${side}Preset`];
    }
    if (invalidate) { replay = null; index = 0; phase = "after"; }
    message(data.notice || "");
    render();
  }
  async function runBattle() {
    stop();
    message("対戦を記録中…");
    replay = await request("battle");
    replayRevision++;
    model = replay.setup;
    acceptSetup(model);
    editing = false;
    index = Math.max(0, replay.tape.findIndex((s) => s.kind === "action"));
    phase = "before";
    selected = null;
    document.body.classList.remove("detail-open");
    render();
    syncClassic();
    message();
  }
  const segment = () => !editing && replay ? replay.tape[index] : null;
  const currentState = () => segment()?.[phase] || model?.state;
  function targetsFor(step) {
    const ids = new Set();
    for (const event of step?.events || []) {
      if (event.targetId) ids.add(event.targetId);
      for (const field of ["attackEvents", "healEvents", "buffEvents", "koEvents"]) {
        for (const target of event[field] || []) if (target.targetId) ids.add(target.targetId);
      }
    }
    return ids;
  }
  function differences(step) {
    if (!step) return [];
    return step.after.units.flatMap((unit) => {
      const before = step.before.units.find((u) => u.id === unit.id);
      if (!before) return [];
      const changes = [];
      for (const key of ["hp", "at", "ag", "armor", "ultimateCharge"]) {
        if (before[key] !== unit[key]) changes.push({ key, before: before[key], after: unit[key], delta: unit[key] - before[key] });
      }
      for (const status of unit.statuses) {
        const old = before.statuses.find((s) => s.key === status.key);
        if (!old || old.expiresOnTurn !== status.expiresOnTurn) changes.push({ key: status.key, status, added: true, refreshed: Boolean(old) });
      }
      for (const status of before.statuses) {
        if (!unit.statuses.some((s) => s.key === status.key)) changes.push({ key: status.key, status, added: false });
      }
      if (unit.alphaGuarded !== before.alphaGuarded) changes.push({ key: "alpha", exposed: !unit.alphaGuarded });
      if (unit.row !== before.row || unit.col !== before.col) changes.push({ key: "move", before: ranks[before.col], after: ranks[unit.col] });
      return changes.length ? [{ unit, changes }] : [];
    });
  }

  function render() {
    if (!model) return;
    const state = currentState();
    const step = segment();
    const frameKey = step && phase === "after" ? `${replayRevision}:${index}:${phase}` : "";
    const animateEffects = Boolean(frameKey && frameKey !== effectFrameKey);
    effectFrameKey = frameKey;
    $("#edit").setAttribute("aria-pressed", String(editing));
    document.body.classList.toggle("editing", editing);
    for (const side of ["enemy", "player"]) renderBoard(side, state, step, animateEffects);
    $("#turnBadge").textContent = `${state.turn}T`;
    $("#eventTitle").textContent = editing ? "編成編集" : step ? `${step.simultaneous ? "同時成立 / " : ""}${step.title}` : "編成確認";
    document.querySelectorAll("[data-phase]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.phase === phase));
      button.disabled = !step || step.kind !== "action";
    });
    renderQueue();
    renderDetail();
    renderChanges();
    renderLegend();
    controls();
    paintIcons();
  }

  function renderBoard(side, state, step, animateEffects) {
    const cells = [];
    const targets = targetsFor(step);
    const actors = new Set(step?.actors.map((actor) => actor.id) || []);
    const changed = differences(step);
    const rowOrder = side === "enemy" ? [2, 1, 0] : [0, 1, 2];
    const colOrder = side === "enemy" ? [2, 1, 0] : [0, 1, 2];
    for (const col of colOrder) for (const row of rowOrder) {
      const unit = state.units.find((u) => u.side === side && u.row === row && u.col === col && (u.hp > 0 || u.general || actors.has(u.id) || targets.has(u.id)));
      const terrain = state.terrain[side][row][col];
      const terrainName = model.catalog.terrain.find((item) => item.id === terrain)?.name || terrain;
      const cellSelected = !editing && selected?.id ? unit?.id === selected.id : selected?.side === side && selected.row === row && selected.col === col;
      const candidate = step?.events.some((event) => event.rangeCells?.some((cell) => cell.side === side && cell.row === row && cell.col === col));
      const classes = ["cell", unit ? "occupied" : "empty", cellSelected ? "selected" : "", actors.has(unit?.id) ? "actor" : "", targets.has(unit?.id) ? "target" : "", candidate ? "candidate" : "", unit?.hp === 0 ? "fallen" : ""];
      const numericChanges = phase === "after" ? (changed.find((item) => item.unit.id === unit?.id)?.changes || [])
        .filter((change) => ["hp", "armor", "at", "ag"].includes(change.key) && change.delta !== 0) : [];
      const delta = numericChanges.find((change) => change.key === "hp")?.delta || 0;
      if (numericChanges.length) classes.push("has-effects");
      if (animateEffects && numericChanges.length) classes.push("effects-enter", delta < 0 ? "impact-damage" : delta > 0 ? "impact-heal" : "impact-buff");
      cells.push(`<button class="${classes.join(" ")}" data-cell="${side}:${row}:${col}" aria-label="${esc(`${sideName(side)} ${ranks[col]}${lanes[row]} ${unit ? `${unit.name} HP${unit.hp}/${unit.maxHp}` : "空きマス"}`)}" aria-pressed="${cellSelected}">
        <span class="cell-top"><span>${actors.has(unit?.id) ? step.simultaneous ? "同時成立" : "行動中" : ranks[col] + lanes[row]}</span><span title="${esc(terrainName)}">${icon(terrainIcons[terrain] || "hexagon")}</span></span>
        ${unit ? `<span class="unit-heading"><span class="portrait ${side}">${icon(speciesIcons[unit.classification] || "hexagon")}</span><strong>${esc(unit.name)}</strong>${unit.general ? `<span class="alpha ${unit.alphaGuarded ? "guarded" : "exposed"}" title="${unit.alphaGuarded ? "α保護中" : "α露出"}">α${icon(unit.alphaGuarded ? "shield-check" : "shield-alert")}</span>` : ""}</span>
        <span class="health-row"><b>${unit.hp}</b><span class="hp-track"><span style="width:${100 * Math.max(0, unit.hp) / unit.maxHp}%"></span></span></span>
        <span class="unit-bottom"><span title="${esc(unit.action.name)}" class="action-mark">${actionIcons(unit.action)}<span class="action-name">${esc(unit.action.name)}</span></span><span class="ag-value" title="AG ${unit.ag}">${icon("wind")}${unit.ag}</span></span>
        <span class="status-tray">${unit.armor > 0 ? `<span class="guard-token" title="装甲 ${unit.armor}">${icon("shield")}${unit.armor}</span>` : ""}${unit.statuses.map((status) => `<span class="state-token" title="${esc(`${status.name} / ${status.expiresOnTurn}T終了まで`)}">${icon(icons[status.key])}<small>${status.remaining}T</small></span>`).join("")}${unit.at !== unit.baseAt ? `<span class="stat-token" title="AT ${unit.at} / 基礎 ${unit.baseAt}">${icon("sword")}${signed(unit.at - unit.baseAt)}</span>` : ""}${unit.ag !== unit.baseAg ? `<span class="stat-token" title="AG ${unit.ag} / 基礎 ${unit.baseAg}">${icon("wind")}${signed(unit.ag - unit.baseAg)}</span>` : ""}</span>
        <span class="ultimate ${unit.ultimateReady ? "ready" : ""}" title="${esc(`${unit.ultimateName} ${unit.ultimateCharge}/${unit.ultimateTurns}`)}">${unit.ultimateTurns ? `${icon("zap")}<span class="ult-track"><span style="width:${Math.min(100, 100 * unit.ultimateCharge / unit.ultimateTurns)}%"></span></span><small>${unit.ultimateCharge}/${unit.ultimateTurns}</small>` : ""}</span>
        ${effectMarkup(numericChanges)}` : `<span class="empty-mark">${editing ? icon("plus") : "·"}</span>`}
      </button>`);
    }
    $(`#${side}Board`).innerHTML = cells.join("");
    const living = state.units.filter((u) => u.side === side && u.hp > 0);
    const alpha = state.units.find((u) => u.side === side && u.general);
    $(`#${side}Summary`).innerHTML = `<span>${living.length}体</span><span>${model.costs[side].total}/30</span>${alpha ? `<span class="alpha-summary">α ${alpha.hp}/${alpha.maxHp} ${icon(alpha.hp === 0 ? "x" : alpha.alphaGuarded ? "shield-check" : "shield-alert")}</span>` : ""}`;
  }

  function effectMarkup(changes) {
    if (!changes.length) return "";
    const definitions = { hp: ["heart", "HP"], armor: ["shield", "装甲"], at: ["sword", "AT"], ag: ["wind", "AG"] };
    return `<span class="effect-stack" data-count="${changes.length}">${changes.map((change, order) => {
      const [glyph, label] = definitions[change.key];
      const value = signed(change.delta);
      return `<span class="effect-pop effect-${change.key} ${change.delta > 0 ? "gain" : "loss"}${value.length > 4 ? " long-value" : ""}" data-stat="${change.key}" data-delta="${change.delta}" style="--pop-order:${order}" role="img" aria-label="${label} ${value}" title="${label} ${change.before} → ${change.after}"><span class="effect-shape" aria-hidden="true">${icon(glyph)}</span><b aria-hidden="true">${value}</b></span>`;
    }).join("")}</span>`;
  }

  function actionIcons(action) {
    const types = [...new Set(action.components.flatMap((component) => component.effectElements || []))];
    return (types.length ? types : ["singleAttack"]).slice(0, 3).map((type) => icon(icons[type] || "sparkles")).join("");
  }
  function renderQueue() {
    const step = segment();
    const turn = step?.after.turn;
    const groups = replay && !editing ? replay.tape.filter((s) => s.kind === "action" && s.after.turn === turn) : [];
    $("#queue").innerHTML = groups.length ? groups.map((s) => `<button class="queue-group ${s.index === index ? "current" : s.index < index ? "past" : ""}" data-jump="${s.index}" title="${esc(s.actors.map((a) => `${a.name}: ${a.action.name} / AG${a.ag} ${a.cell} ${a.rarity}`).join(" / "))}" aria-label="${esc(s.actors.map((a) => a.name).join("・"))}${s.simultaneous ? " 同時成立" : ""}">${s.actors.map((actor) => `<span class="queue-unit ${actor.side}">${icon("hexagon")}<span>${esc(actor.name)}</span><small>${actor.ag}</small></span>`).join("")}${s.simultaneous ? '<small class="sim-label">同時</small>' : ""}</button>`).join("") : `<span class="quiet">${editing ? "編成中" : "ターン準備"}</span>`;
    $("#queue .current")?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }

  function rangeDiagram(component, unit) {
    const pattern = component.pattern || {};
    const cells = [];
    const side = pattern.side === "enemy" ? (unit.side === "player" ? "enemy" : "player") : unit.side;
    for (const col of [2, 1, 0]) for (const row of [0, 1, 2]) {
      let mark = (pattern.depthAccess || []).includes(col);
      if (pattern.side === "self") mark = row === unit.row && col === unit.col;
      if (component.targetPattern?.includes("sameLane")) mark = row === unit.row && (pattern.side === "ally" || mark);
      if (component.targetPattern === "selfAndForwardAlly") mark = row === unit.row && [unit.col, unit.col - 1].includes(col);
      if (component.targetPattern === "allyAlpha") mark = currentState().units.some((candidate) => candidate.side === side && candidate.general && candidate.row === row && candidate.col === col);
      const x = side === "player" ? 3 - col : col + 1;
      const y = side === "player" ? row + 1 : 3 - row;
      cells.push(`<span style="--dx:${x};--dy:${y};--mx:${side === "player" ? row + 1 : 3 - row};--my:${side === "player" ? col + 1 : 3 - col}" class="${mark ? "marked" : ""}"></span>`);
    }
    return `<span class="mini-board" aria-hidden="true">${cells.join("")}</span>`;
  }

  function renderDetail() {
    const state = currentState();
    const unit = selected ? state.units.find((u) => !editing && selected.id ? u.id === selected.id : u.side === selected.side && u.row === selected.row && u.col === selected.col && (u.hp > 0 || u.general)) : null;
    if (unit && !editing) selected = { id: unit.id, side: unit.side, row: unit.row, col: unit.col };
    $("#detailHeading").textContent = selected ? `${sideName(selected.side)} ${ranks[selected.col]}${lanes[selected.row]}` : "選択カード";
    if (!selected) {
      $("#detail").innerHTML = `<div class="detail-idle">${icon("scan")}<p>選択なし</p></div>`;
      return;
    }
    let html = "";
    if (editing) {
      const terrain = state.terrain[selected.side][selected.row][selected.col];
      html += `<div class="edit-form"><label>カード<select id="cellCard"><option value="__empty">空きマス</option>${model.catalog.cards.map((card) => `<option value="${esc(card.id)}" ${card.id === unit?.cardId ? "selected" : ""}>${esc(card.name)} / C${card.cost}</option>`).join("")}</select></label><label>地形<select id="cellTerrain">${model.catalog.terrain.map((item) => `<option value="${esc(item.id)}" ${item.id === terrain ? "selected" : ""}>${esc(item.name)} / ${item.cost}</option>`).join("")}</select></label><label class="alpha-toggle"><input id="cellAlpha" type="checkbox" ${unit?.general ? "checked" : ""} ${!unit || unit.general ? "disabled" : ""}>αに指定</label><label>登録名<input id="deckName" maxlength="24" placeholder="比較用編成"></label><button id="saveDeck" class="save-button">${icon("save")}編成を登録</button></div>`;
    }
    if (!unit) { $("#detail").innerHTML = html + '<p class="quiet">空きマス</p>'; return; }
    html += `<div class="detail-title"><span class="portrait ${unit.side}">${icon(speciesIcons[unit.classification] || "hexagon")}</span><h3>${esc(unit.name)}</h3></div>
      <div class="detail-stats"><span>HP<b>${unit.hp}/${unit.maxHp}</b></span><span>AT<b>${unit.at}</b></span><span>AG<b>${unit.ag}</b></span><span>装甲<b>${unit.armor}</b></span></div>
      ${unit.general ? `<p class="alpha-detail">${icon(unit.alphaGuarded ? "shield-check" : "shield-alert")}α ${unit.alphaGuarded ? "保護中" : "露出"}</p>` : ""}
      <div class="detail-statuses">${unit.statuses.map((status) => `<div>${icon(icons[status.key])}<b>${esc(status.name)}</b><span>${esc(status.description)}${status.amount != null ? ` 基準量 ${status.amount}。` : ""}<br>${status.expiresOnTurn}T終了まで${status.sourceName ? ` / ${esc(status.sourceName)}` : ""}</span></div>`).join("")}</div>
      <div class="action-list">${unit.actions.map((action, i) => `<details ${i === unit.col ? "open" : ""}><summary><span>${ranks[i]}</span>${actionIcons(action)}<b>${esc(action.name)}</b>${i === unit.col ? '<small>現在</small>' : ""}</summary><div class="action-description">${action.components.map((component) => `<div class="range-row">${rangeDiagram(component, unit)}<span>${esc(component.pattern?.name || "対象なし")}${component.pattern?.shape === "single" ? " / 1体" : ""}</span></div>`).join("")}<p>${esc(action.text)}</p><p class="formula">${esc(action.formula)}</p></div></details>`).join("")}</div>
      ${unit.ultimateTurns ? `<p class="ultimate-detail">${icon("zap")}<b>${esc(unit.ultimateName)}</b><span>${unit.ultimateCharge}/${unit.ultimateTurns}</span></p>` : ""}
      <details><summary>能力・α特性</summary><p>${esc(unit.ability)}</p><p>${esc(unit.generalSkill)}</p></details>`;
    $("#detail").innerHTML = html;
  }

  function renderChanges() {
    const step = segment();
    const changes = phase === "after" ? differences(step) : [];
    const labels = { hp: "HP", at: "AT", ag: "AG", armor: "装甲", ultimateCharge: "必殺", move: "移動" };
    $("#changes").innerHTML = changes.length ? changes.map(({ unit, changes: entries }) => `<button class="change-item" data-unit="${esc(unit.id)}"><b class="${unit.side}">${esc(unit.name)}</b><span>${entries.map((change) => change.status ? `<span>${icon(icons[change.key])}${esc(change.status.name)} ${change.added ? change.refreshed ? "更新" : "+" : "解除・失効"}</span>` : change.key === "alpha" ? `<span>α ${change.exposed ? "露出" : "保護"}</span>` : `<span>${labels[change.key]} <b>${change.before} → ${change.after}</b>${change.delta != null ? ` (${signed(change.delta)})` : ""}</span>`).join("")}</span></button>`).join("") : `<p class="quiet">${phase === "before" && step?.kind === "action" ? "対象を表示中" : "変化なし"}</p>`;
    $("#eventLog").innerHTML = phase === "after" ? (step?.logs || []).map((text) => `<li>${esc(text)}</li>`).join("") : "";
  }
  function renderLegend() {
    $("#legend").innerHTML = [["sword", "攻撃"], ["swords", "範囲攻撃"], ["shield", "装甲"], ["heart-pulse", "回復"], ["flask-conical", "毒"], ["heart-off", "回復封じ"], ["shield-minus", "防御低下"], ["undo-2", "反射"], ["wind", "AG"], ["zap", "必殺ゲージ"]].map(([name, text]) => `<span>${icon(name)}${text}</span>`).join("") + '<p>破線：範囲　塗り：実対象<br>状態のT：今のターンを含む有効期間</p>';
  }

  function controls() {
    document.body.classList.toggle("replay-playing", playing);
    document.body.style.setProperty("--effect-speed", $("#speed").value);
    const available = Boolean(replay && !editing && !busy);
    for (const id of ["first", "prev", "play", "next", "last", "turn", "scrub"]) $(`#${id}`).disabled = !available;
    if (available) {
      $("#first").disabled = $("#prev").disabled = index === 0;
      $("#next").disabled = $("#last").disabled = index === replay.tape.length - 1;
    }
    for (const id of ["run", "edit", "playerPreset", "enemyPreset"]) $(`#${id}`).disabled = busy || !model;
    const total = replay?.tape.length || 0;
    $("#scrub").max = Math.max(0, total - 1);
    $("#scrub").value = index;
    $("#position").textContent = total && !editing ? `${index + 1} / ${total}` : "0 / 0";
    const turns = [...new Set(replay?.tape.map((s) => s.after.turn) || [0])];
    $("#turn").innerHTML = turns.map((turn) => `<option value="${turn}">${turn}T</option>`).join("");
    $("#turn").value = currentState()?.turn || 0;
    $("#play").innerHTML = icon(playing ? "pause" : "play");
    $("#play").setAttribute("aria-label", playing ? "一時停止" : "再生");
    $("#play").title = playing ? "一時停止" : "再生";
    paintIcons();
  }
  function stop() { playing = false; clearTimeout(timer); timer = null; }
  function syncClassic() { if (replay && !editing) request("seek", { index, phase }).catch((error) => message(error.message, true)); }
  function go(position, nextPhase = "before") {
    if (!replay || editing || busy) return;
    stop();
    index = Math.max(0, Math.min(position, replay.tape.length - 1));
    phase = replay.tape[index].kind === "action" ? nextPhase : "after";
    render(); syncClassic();
  }
  function schedule() {
    timer = setTimeout(() => {
      if (!playing || !replay) return;
      if (phase === "before" && segment().kind === "action") phase = "after";
      else if (index < replay.tape.length - 1) { index++; phase = segment().kind === "action" ? "before" : "after"; }
      else { stop(); controls(); return; }
      render(); syncClassic(); schedule();
    }, (phase === "before" ? 700 : 1100) * Number($("#speed").value));
  }
  $("#play").addEventListener("click", () => {
    if (playing) stop();
    else { if (index === replay.tape.length - 1) go(0); playing = true; schedule(); }
    controls();
  });
  $("#first").addEventListener("click", () => go(0));
  $("#prev").addEventListener("click", () => go(index - 1, "after"));
  $("#next").addEventListener("click", () => go(index + 1));
  $("#last").addEventListener("click", () => go(replay.tape.length - 1, "after"));
  $("#scrub").addEventListener("input", (event) => go(Number(event.target.value), "after"));
  $("#turn").addEventListener("change", (event) => go(replay.tape.findIndex((s) => s.after.turn === Number(event.target.value))));
  $("#run").addEventListener("click", () => safe(runBattle));
  $("#edit").addEventListener("click", () => safe(async () => {
    stop(); editing = !editing;
    acceptSetup(await request("setup"));
    if (!editing && model.changed) replay = null;
    if (view === "classic") setView("visual");
    render();
  }));
  for (const side of ["player", "enemy"]) $(`#${side}Preset`).addEventListener("change", (event) => safe(async () => {
    stop(); acceptSetup(await request("preset", { side, id: event.target.value }), true);
  }));

  function setView(nextView) {
    view = nextView;
    $("#visualView").hidden = view !== "visual";
    $("#classicView").hidden = view !== "classic";
    document.querySelectorAll("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
  }
  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) safe(async () => {
      stop();
      const data = await request("setup");
      const changed = model?.signature !== data.signature;
      acceptSetup(data, changed);
      setView(viewButton.dataset.view);
      if (view === "classic") syncClassic();
    });
    const cell = event.target.closest("[data-cell]");
    if (cell) {
      stop();
      const [side, row, col] = cell.dataset.cell.split(":");
      const unit = currentState().units.find((u) => u.side === side && u.row === Number(row) && u.col === Number(col));
      selected = { side, row: Number(row), col: Number(col), id: unit?.id };
      document.body.classList.add("detail-open"); render();
    }
    const jump = event.target.closest("[data-jump]");
    if (jump) go(Number(jump.dataset.jump));
    const change = event.target.closest("[data-unit]");
    if (change) {
      const unit = currentState().units.find((u) => u.id === change.dataset.unit);
      if (unit) { selected = { id: unit.id, side: unit.side, row: unit.row, col: unit.col }; document.body.classList.add("detail-open"); render(); }
    }
    const phaseButton = event.target.closest("[data-phase]");
    if (phaseButton) go(index, phaseButton.dataset.phase);
    if (event.target.closest("#saveDeck")) safe(async () => {
      const name = $("#deckName").value.trim();
      if (!name) throw new Error("登録名を入力してください。");
      acceptSetup(await request("save", { name, side: selected.side }));
    });
  });
  $("#detail").addEventListener("change", (event) => {
    const keys = { cellCard: "cardId", cellTerrain: "terrainId", cellAlpha: "general" };
    const key = keys[event.target.id];
    if (key && selected) safe(async () => {
      const value = key === "general" ? event.target.checked : event.target.value;
      acceptSetup(await request("edit", { ...selected, [key]: value }), true);
    });
  });
  $("#closeDetail").addEventListener("click", () => { document.body.classList.remove("detail-open"); selected = null; render(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { document.body.classList.remove("detail-open"); stop(); controls(); }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { stop(); controls(); } });
  paintIcons();
})();
