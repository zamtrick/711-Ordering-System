// Drives headless Chrome via CDP: forces light mode, logs in, screenshots pages.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const BASE = "http://localhost:5173";
const OUT = "C:/Users/Patrick Zambrano/AppData/Local/Temp";

// read superadmin creds from server/.env
const env = readFileSync(join(process.cwd(), "server/.env"), "utf8");
const EMAIL = env.match(/SUPERADMIN_EMAIL=(.+)/)?.[1]?.trim();
const PASSWORD = env.match(/SUPERADMIN_PASSWORD=(.+)/)?.[1]?.trim();
if (!EMAIL || !PASSWORD) throw new Error("missing superadmin creds");

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--user-data-dir=" + OUT + "/cdp-profile",
  `--remote-debugging-port=${PORT}`,
  "--window-size=1440,900",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(250);
  }
  throw new Error("CDP not reachable at " + url);
}

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function connect() {
  const list = await getJson(`http://localhost:${PORT}/json/list`);
  const page = list.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
}

async function nav(url, waitMs = 2500) {
  await send("Page.navigate", { url });
  await sleep(waitMs);
}

async function shot(name) {
  const res = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(res.data, "base64"));
  console.log("shot:", name);
}

async function setInput(selector, value) {
  await send("Runtime.evaluate", {
    expression: `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
}

async function click(selector) {
  const r = await send("Runtime.evaluate", {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) { return false; } el.click(); return true; })()`,
    returnByValue: true,
  });
  return r.result?.value;
}

await connect();
await send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-color-scheme", value: "light" }],
});
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");
await send("Runtime.enable");

// remove any stored theme + login page
await nav(BASE + "/login");
await send("Runtime.evaluate", { expression: "localStorage.removeItem('theme'); location.reload();" });
await sleep(2500);
await shot("light-login");

// log in
await setInput('input[type="email"]', EMAIL);
await setInput('input[type="password"]', PASSWORD);
await click('button[type="submit"]');
await sleep(3500);
await shot("light-dashboard");

for (const page of ["branches", "admins", "activity-log", "profile"]) {
  await nav(BASE + "/" + page);
  await shot("light-" + page);
}

chrome.kill();
process.exit(0);