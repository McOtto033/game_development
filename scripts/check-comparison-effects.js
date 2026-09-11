const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === "mobile", isMobile: name === "mobile" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve("prototype-comparison/index.html")).href);
      await page.locator("#run:not([disabled])").waitFor();
      await page.locator("#playerPreset").selectOption("generated-focusBreakthrough-2");
      await page.locator("#run:not([disabled])").waitFor();
      await page.locator("#run").click();
      await page.locator("#next:not([disabled])").waitFor();
      const frame = page.frames().find((item) => item.url().endsWith("baseline/index.html"));
      const cases = await frame.evaluate(() => {
        const { tape } = window.comparisonObserver.runObserved();
        const found = {};
        for (const step of tape) {
          for (const after of step.after.units) {
            const before = step.before.units.find((unit) => unit.id === after.id);
            const changes = ["hp", "armor", "at", "ag"].filter((stat) => before && after[stat] !== before[stat]);
            for (const stat of changes) {
              const key = stat === "hp" ? after.hp > before.hp ? "heal" : "damage" : stat;
              if (!found[key]) found[key] = { index: step.index, stat, delta: after[stat] - before[stat], cell: `${after.side}:${after.row}:${after.col}` };
            }
            if (changes.length > 1 && !found.multiple) found.multiple = { index: step.index, cell: `${after.side}:${after.row}:${after.col}`, count: changes.length };
          }
        }
        return found;
      });
      async function seek(index) {
        await page.locator("#scrub").fill(String(index));
        await page.waitForTimeout(350);
      }
      for (const key of ["damage", "heal", "armor", "at", "ag", "multiple"]) {
        const entry = cases[key];
        assert.ok(entry, `Missing real battle fixture: ${key}`);
        await seek(entry.index);
        const cell = page.locator(`[data-cell="${entry.cell}"]`);
        const pop = entry.stat ? cell.locator(`.effect-pop[data-stat="${entry.stat}"]`) : cell.locator(".effect-pop").first();
        await pop.scrollIntoViewIfNeeded();
        assert.equal(await pop.count(), 1);
        if (entry.delta) assert.equal(await pop.getAttribute("data-delta"), String(entry.delta));
        if (entry.count) assert.equal(await cell.locator(".effect-pop").count(), entry.count);
        assert.ok(await pop.locator(".effect-shape svg").count());
        await page.screenshot({ path: `.autodev/effects-${name}-${key}.png`, fullPage: true });
        const geometry = await cell.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const pops = [...el.querySelectorAll(".effect-pop")].map((item) => item.getBoundingClientRect());
          return { fits: pops.every((p) => p.left >= rect.left && p.right <= rect.right && p.top >= rect.top && p.bottom <= rect.bottom),
            overlaps: pops.some((p, i) => pops.slice(i + 1).some((q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom)),
            textFits: [...el.querySelectorAll(".effect-pop b")].every((b) => b.getBoundingClientRect().width <= b.parentElement.clientWidth),
            shapesFit: [...el.querySelectorAll(".effect-pop svg")].every((svg) => svg.getBoundingClientRect().height <= svg.closest(".effect-pop").clientHeight),
          };
        });
        assert.deepEqual(geometry, { fits: true, overlaps: false, textFits: true, shapesFit: true }, `${name}/${key}`);
      }
      await page.waitForTimeout(1300);
      assert.equal(await page.locator(".effect-stack").first().evaluate((el) => getComputedStyle(el).opacity), "1", "Paused effects remain readable");
      const pausedIndex = await page.locator("#position").innerText();
      await page.locator("#prev").click();
      await page.locator("#next").click();
      assert.equal(await page.locator("#position").innerText(), pausedIndex);
      assert.equal(await page.locator(".effect-pop").count(), 0, "Before phase must not show result pops");
      await page.locator('[data-phase="after"]').click();
      assert.ok(await page.locator(".effects-enter .effect-pop").count() > 0);
      await page.locator("#play").click();
      await page.waitForTimeout(120);
      assert.ok(await page.locator("body.replay-playing").count());
      await page.locator("#play").click();
      assert.equal(await page.locator(".effect-stack").first().evaluate((el) => getComputedStyle(el).opacity), "1");
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(await page.locator(".effect-pop").first().evaluate((el) => getComputedStyle(el).animationName), "none");
      assert.deepEqual(errors, []);
      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(pageWidth <= width);
      results.push({ name, cases, geometry: "PASS", pause: "PASS", navigation: "PASS", reducedMotion: "PASS", errors });
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(".autodev/comparison-effects.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
