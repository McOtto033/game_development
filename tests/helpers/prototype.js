const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

// This DOM double checks startup wiring only; it does not emulate browser layout.
class Element {
  constructor() {
    this.children = [];
    this.value = "";
    this.textContent = "";
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {} };
    this.listeners = new Map();
  }
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html || ""; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  click() {
    for (const listener of this.listeners.get("click") || []) listener({ target: this });
  }
}

function loadPrototype() {
  const html = fs.readFileSync(path.join(root, "prototype/index.html"), "utf8");
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], new Element()]));
  const storage = new Map();
  const context = vm.createContext({
    console,
    document: {
      querySelector(selector) {
        if (!selector.startsWith("#")) throw new Error(`Unsupported selector: ${selector}`);
        return elements.get(selector.slice(1)) || null;
      },
      createElement() { return new Element(); },
    },
    Option: function Option(text, value) { return { text, value }; },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    clearTimeout() {},
    setTimeout() { throw new Error("Replay timing requires a real browser test."); },
  });
  const source = fs.readFileSync(path.join(root, "prototype/app.js"), "utf8");
  new vm.Script(source, { filename: "prototype/app.js" }).runInContext(context, { timeout: 15000 });
  return {
    elements,
    evaluate(source, timeout = 15000) {
      return vm.runInContext(source, context, { timeout });
    },
  };
}

module.exports = { loadPrototype };

