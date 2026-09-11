const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Supply the installed Playwright module path. No package download is needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = pathToFileURL(path.resolve("prototype-comparison/index.html")).href;
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === "mobile", isMobile: name === "mobile" });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(url);
      await page.locator("#run:not([disabled])").waitFor();
      assert.deepEqual(errors, [], "Startup errors");
      assert.equal(await page.locator("#playerBoard .cell").count(), 9);
      assert.equal(await page.locator("#enemyBoard .cell").count(), 9);
      assert.ok(await page.locator("#queue .queue-group").count() > 0);
      assert.ok(await page.locator(".cell.actor").count() > 0);
      const before = await page.locator("#playerBoard").innerText();
      await page.locator('[data-phase="after"]').click();
      assert.ok(await page.locator("#changes .change-item").count() > 0);
      await page.locator('[data-phase="before"]').click();
      assert.equal(await page.locator("#playerBoard").innerText(), before);
      const cursor = await page.locator("#position").innerText();
      await page.locator("#next").click();
      assert.notEqual(await page.locator("#position").innerText(), cursor);
      await page.locator("#prev").click();
      assert.equal(await page.locator("#position").innerText(), cursor);
      await page.locator('[data-phase="before"]').click();
      await page.locator("#play").click();
      await page.waitForTimeout(2100);
      await page.locator("#play").click();
      const paused = await page.locator("#position").innerText();
      await page.waitForTimeout(1300);
      assert.equal(await page.locator("#position").innerText(), paused, "Pause must stop playback");
      await page.locator("#turn").selectOption("1");
      await page.locator(".queue-group").first().click();
      await page.locator('[data-phase="after"]').click();
      await page.locator('.cell.occupied').first().click();
      assert.ok((await page.locator("#detail").innerText()).includes("HP"));
      await page.screenshot({ path: `.autodev/comparison-${name}-detail.png`, fullPage: true });
      await page.locator("#closeDetail").click();
      await page.screenshot({ path: `.autodev/comparison-${name}.png`, fullPage: true });
      const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        cells: [...document.querySelectorAll("#visualView .cell")].filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => el.getAttribute("aria-label")),
      }));
      assert.ok(overflow.scroll <= width + 1 && overflow.width <= width + 1, JSON.stringify(overflow));
      assert.deepEqual(overflow.cells, [], "Card content must fit");
      for (const side of ["player", "enemy"]) {
        const box = await page.locator(`#${side}Preset`).boundingBox();
        assert.ok(box.width >= 120 && box.x + box.width <= width, `Preset selector collapsed: ${JSON.stringify(box)}`);
      }
      await page.locator('[data-view="classic"]').click();
      const frame = page.frames().find((item) => item.url().endsWith("baseline/index.html"));
      assert.ok(frame);
      assert.equal(await frame.locator("#playerBoard .slot").count(), 9);
      assert.equal(await frame.locator("#turnCount").innerText(), await page.locator("#turnBadge").innerText());
      await page.locator('[data-view="visual"]').click();
      await page.locator("#playerPreset").selectOption("sample-corrosion");
      await page.locator("#run:not([disabled])").waitFor();
      assert.equal(await page.locator("#position").innerText(), "0 / 0", "Changing presets invalidates the replay");
      await page.locator("#run").click();
      await page.locator("#next:not([disabled])").waitFor();
      assert.ok(await page.locator("#queue .queue-group").count() > 0);
      await page.locator("#edit").click();
      await page.locator('[data-cell="player:0:0"]').click();
      const card = await page.locator("#cellCard").inputValue();
      const cardCount = await page.locator("#playerBoard .cell.occupied").count();
      await page.locator("#cellCard").selectOption("__empty");
      await page.locator("#run:not([disabled])").waitFor();
      assert.equal(await page.locator("#playerBoard .cell.occupied").count(), cardCount - 1);
      await page.locator("#cellTerrain").selectOption("plain");
      await page.locator("#run:not([disabled])").waitFor();
      await page.locator("#deckName").fill(`比較保存-${name}`);
      await page.locator("#saveDeck").click();
      await page.waitForFunction((name) => document.querySelector("#playerPreset").textContent.includes(name), `比較保存-${name}`);
      const stored = await frame.evaluate(() => Object.keys(localStorage));
      assert.ok(stored.includes("comparison-c1-custom-decks-v1"));
      assert.ok(!stored.some((key) => key.startsWith("taisho-")), "Original storage must not be touched");
      await page.locator("#closeDetail").click();
      await page.reload();
      await page.locator("#run:not([disabled])").waitFor();
      assert.ok((await page.locator("#playerPreset").innerText()).includes(`比較保存-${name}`));
      await page.locator("#last").click();
      assert.match(await page.locator("#eventTitle").innerText(), /勝利|引き分け/);
      assert.deepEqual(errors, [], "Browser errors");
      results.push({ name, viewport: { width, height }, overflow, errors, card, saveReload: true, playback: true, classicSync: true });
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(".autodev/comparison-browser.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
