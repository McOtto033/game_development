/* The frozen engine owns all rules. This adapter only observes action boundaries. */
(() => {
  const CHANNEL = "ecology-ui-comparison-c1";
  let tape = [];
  let battle = null;
  let setupAtBattle = "";
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function actionInfo(key, unit, state) {
    const ultimate = isUltimateActionKey(key);
    const definition = ultimate ? ultimateActions[sameAgActionBaseKey(key)] : actions[key];
    return {
      key, name: actionDisplayName(key, unit), text: definition?.text || "",
      formula: ultimate ? "" : actionFormulaText(state, unit, key),
      components: (definition?.components || []).map((component) => ({
        ...component, pattern: TARGET_PATTERNS[component.targetPattern],
      })),
    };
  }

  function viewState(state) {
    return {
      turn: state.turn, terrain: clone(state.terrain),
      units: state.units.map((unit) => {
        const stats = unitStats(state, unit);
        const statuses = (unit.statusEffects || []).filter((effect) => effect.expiresOnTurn >= state.turn)
          .map((effect) => ({ ...effect, name: STATUS_EFFECTS[effect.key]?.name || effect.key,
            description: STATUS_EFFECTS[effect.key]?.shortText || "", amount: STATUS_EFFECTS[effect.key]?.damage ?? null,
            remaining: effect.expiresOnTurn - state.turn + 1,
            sourceName: state.units.find((source) => source.id === effect.sourceId)?.card.name || "",
          }));
        return {
          id: unit.id, cardId: unit.cardId, name: unit.card.name, side: unit.side,
          row: unit.row, col: unit.col, general: unit.general, hp: unit.hp, maxHp: unit.maxHp,
          at: stats.at, ag: stats.ag, baseAt: unit.card.at, baseAg: unit.card.ag,
          armor: unitStats(state, unit, { kind: "incoming", damage: 0 }).armor,
          armorEffects: clone((unit.armorEffects || []).filter((effect) => effect.expiresOnTurn >= state.turn)),
          statEffects: clone((unit.statEffects || []).filter((effect) => effect.expiresOnTurn >= state.turn)),
          alphaGuarded: unit.general && !isGeneralExposed(state, unit),
          ability: unit.card.ability, generalSkill: unit.card.generalSkill,
          rarity: unit.card.rarity, classification: unit.card.classification,
          traits: unit.card.traits, statuses,
          ultimateCharge: unit.ultimateCharge || 0, ultimateTurns: unit.card.ultimate?.turns || 0,
          ultimateName: unit.card.ultimate?.name || "", ultimateReady: ultimateReady(unit),
          cost: unit.general ? alphaCardCost(unit.card) : normalCardCost(unit.card),
          action: actionInfo(actionFor(unit), unit, state),
          actions: [unit.card.front, unit.card.middle, unit.card.rear].map((key) => actionInfo(key, unit, state)),
        };
      }),
    };
  }

  function catalog() {
    return {
      presets: presets.filter((preset) => preset.kind !== "legacy").map((preset) => ({ id: preset.id, name: presetOptionLabel(preset) })),
      cards: Object.entries(cards).filter(([, card]) => isCardAvailable(card)).map(([id, card]) => ({ id, name: card.name, cost: normalCardCost(card) })),
      terrain: Object.entries(terrainTypes).map(([id, terrain]) => ({ id, name: terrain.name, cost: terrain.cost || 0 })),
      effects: Object.fromEntries(Object.entries(EFFECT_ELEMENTS).map(([id, entry]) => [id, entry.name])),
      statuses: Object.fromEntries(Object.entries(STATUS_EFFECTS).map(([id, entry]) => [id, entry.name])),
      classifications: CLASSIFICATIONS,
    };
  }

  const configurationSignature = () => JSON.stringify({ setup, cards });

  function setupPayload() {
    return {
      catalog: catalog(), state: viewState(createBattleState()),
      playerPreset: setup.playerPreset, enemyPreset: setup.enemyPreset,
      costs: { player: presetCost(currentPresetForSide("player")), enemy: presetCost(currentPresetForSide("enemy")) },
      signature: configurationSignature(), changed: Boolean(setupAtBattle && setupAtBattle !== configurationSignature()),
    };
  }

  function runObserved() {
    const warning = validateBattleCosts();
    if (warning) throw new Error(warning);
    for (const side of ["player", "enemy"]) {
      const preset = currentPresetForSide(side);
      if (!preset.units.some(([id]) => id === preset.general)) throw new Error(`${sideLabel(side)}のαを指定してください。`);
    }
    stopReplay();
    tape = [];
    let cursor = 0;
    let previous = snapshotBattleState(createBattleState());
    const originalExecute = executeActionBatch;
    const append = (segment) => {
      segment.index = tape.length;
      tape.push(segment);
      previous = segment.after;
    };
    function flush(log) {
      while (cursor < log.frames.length) {
        const frame = log.frames[cursor++];
        append({ kind: "system", title: uiText(frame.text || "状態更新"),
          before: previous, after: frame.state, actors: [], events: [frame],
          logStart: tape.length ? tape[tape.length - 1].logEnd + 1 : 0, logEnd: frame.logIndex,
        });
      }
    }
    executeActionBatch = function observedBatch(state, batch, log) {
      flush(log);
      const before = snapshotBattleState(state);
      const actors = batch.units.map((unit) => ({ id: unit.id, name: unit.card.name, side: unit.side,
        ag: unitStats(state, unit).ag, cell: sameAgCellPriorityLabel(unit), rarity: unit.card.rarity,
        action: actionInfo(battleActionFor(unit), unit, state),
      }));
      const frameStart = log.frames.length;
      const logStart = log.entries.length;
      originalExecute(state, batch, log);
      append({ kind: "action", title: actors.map((actor) => actor.action.name).join(" / "),
        simultaneous: batch.simultaneous, actors, before, after: snapshotBattleState(state),
        events: log.frames.slice(frameStart), logStart, logEnd: log.entries.length - 1,
      });
      cursor = log.frames.length;
    };
    try {
      battle = simulateBattle({ record: true });
      flush(battle.log);
      append({ kind: "finish", title: resultLabel(battle.result), actors: [], before: previous,
        after: battle.state, events: [], logStart: battle.log.entries.length, logEnd: battle.log.entries.length - 1,
      });
    } finally {
      executeActionBatch = originalExecute;
    }
    lastBattleLog = battle.log;
    setupAtBattle = configurationSignature();
    return {
      result: battle.result, turns: battle.turns, metrics: clone(battle.metrics),
      tape: tape.map((segment) => ({
        ...segment, before: viewState(segment.before), after: viewState(segment.after),
        events: segment.events.map(({ state, beforeState, ...event }) => event),
        logs: battle.log.entries.slice(segment.logStart, segment.logEnd + 1).map(uiText),
      })),
      setup: setupPayload(),
    };
  }

  function seek(index, phase) {
    const segment = tape[index];
    if (!segment || !battle) return;
    stopReplay();
    const state = phase === "before" ? segment.before : segment.after;
    const effectEvents = segment.events.filter((frame) => ["attack", "heal", "buff", "move"].includes(frame.type));
    // Legacy highlights can represent one source only, so composite batches use state + full logs.
    const event = !segment.simultaneous && effectEvents.length <= 1 ? effectEvents[0] || segment.events[0] : null;
    activeFrame = event ? { ...event, state, phase: phase === "before" ? "range" : "effect" } : null;
    lastState = state;
    renderBoards(state);
    renderCosts(state);
    renderSelectedCard(state);
    renderLog(battle.log.entries, phase === "before" ? segment.logStart - 1 : segment.logEnd);
    els.turnCount.textContent = `${state.turn}T`;
    els.phaseSummary.textContent = `${segment.simultaneous ? "同時成立: " : ""}${segment.title}`;
    els.winnerSummary.textContent = segment.kind === "finish" ? resultLabel(battle.result) : "観戦中";
  }

  function editCell(request) {
    const { side, row, col, cardId, terrainId, general } = request;
    if (!["player", "enemy"].includes(side) || ![0, 1, 2].includes(row) || ![0, 1, 2].includes(col)) throw new Error("無効な配置です。");
    const before = JSON.stringify(setup);
    if (cardId != null) {
      if (cardId !== "__empty" && !cards[cardId]) throw new Error("カードが見つかりません。");
      editCardSlot(side, row, col, cardId);
    }
    if (terrainId != null) {
      if (!terrainTypes[terrainId]) throw new Error("地形が見つかりません。");
      editTerrainSlot(side, row, col, terrainId);
    }
    if (general) {
      const unit = setup[`${side}Units`].find(([, r, c]) => r === row && c === col);
      if (!unit) throw new Error("カードがあるマスを選択してください。");
      const nextCost = costForEditedSide(side, { general: unit[0] });
      if (nextCost.total > COST_LIMIT) throw new Error(costLimitMessage(nextCost));
      setup[`${side}General`] = unit[0];
      renderSetup();
    }
    return { ...setupPayload(), notice: before === JSON.stringify(setup) ? els.editorMessage.textContent : "" };
  }

  function dispatch(request) {
    if (request.command === "setup") return setupPayload();
    if (request.command === "preset") {
      if (!["player", "enemy"].includes(request.side) || !presets.some((p) => p.id === request.id)) throw new Error("編成が見つかりません。");
      applyPresetToSide(request.side, request.id);
      renderSetup();
      return setupPayload();
    }
    if (request.command === "edit") return editCell(request);
    if (request.command === "battle") return runObserved();
    if (request.command === "seek") { seek(request.index, request.phase); return null; }
    if (request.command === "save") {
      els.deckName.value = String(request.name || "").slice(0, 24);
      setup.editSide = request.side === "enemy" ? "enemy" : "player";
      els.saveDeck.click();
      return { ...setupPayload(), notice: els.editorMessage.textContent };
    }
    throw new Error("未対応の操作です。");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.channel !== CHANNEL) return;
    const request = event.data;
    try {
      const data = dispatch(request);
      window.parent.postMessage({ channel: CHANNEL, requestId: request.requestId, data }, "*");
    } catch (error) {
      window.parent.postMessage({ channel: CHANNEL, requestId: request.requestId, error: error.message }, "*");
    }
  });
  window.comparisonObserver = { runObserved, viewState, setupPayload, seek };
  if (window.parent !== window) {
    const style = document.createElement("style");
    style.textContent = "#runBattle,#runRoundRobin,#playReplay,#resetBattle{display:none}";
    document.head.append(style);
  }
  window.parent.postMessage({ channel: CHANNEL, ready: true }, "*");
})();
