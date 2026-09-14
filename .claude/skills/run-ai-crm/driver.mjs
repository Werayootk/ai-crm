// ขับเว็บของ ai-crm ด้วย Chrome จริง (playwright-core, headless) จากสคริปต์คำสั่งทาง stdin — บรรทัดละคำสั่ง
//   node .claude/skills/run-ai-crm/driver.mjs <<'EOF'
//   login
//   goto /leads
//   ss leads
//   EOF
// env: BASE (default http://localhost:3000), OUT (default /tmp/ai-crm-shots), SEED_DEMO_PASSWORD (default อ่านจาก apps/api/.env)
// จบด้วยรายการ problems (console error, page error, HTTP 404/5xx) — มีปัญหาหรือคำสั่งล้ม = exit 1
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = process.env.OUT ?? '/tmp/ai-crm-shots';
mkdirSync(OUT, { recursive: true });

function demoPassword() {
  if (process.env.SEED_DEMO_PASSWORD) return process.env.SEED_DEMO_PASSWORD;
  const env = readFileSync(join(ROOT, 'apps/api/.env'), 'utf8');
  const value = env.match(/^SEED_DEMO_PASSWORD=(.*)$/m)?.[1]?.trim();
  if (!value) throw new Error('SEED_DEMO_PASSWORD not found in apps/api/.env');
  return value;
}

/** "selector :: value" → [selector, value] */
function split(rest) {
  const at = rest.indexOf(' :: ');
  if (at < 0) throw new Error('expected "<selector> :: <value>"');
  return [rest.slice(0, at).trim(), rest.slice(at + 4)];
}

const oneLine = (text, max = 300) => text.replace(/\s+/g, ' ').trim().slice(0, max);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 500 || r.status() === 404) problems.push(`HTTP ${r.status()} ${r.url()}`);
});

/** ตัวที่มองเห็นเท่านั้น — หน้า list render ทั้งตาราง (จอกว้าง) และการ์ดมือถือที่ถูกซ่อนด้วย CSS */
const visible = (selector) => page.locator(selector).filter({ visible: true });

const commands = {
  async login(rest) {
    const email = rest || 'sales01@demo.local';
    await page.goto(`${BASE}/login`);
    await page.fill('#email', email);
    await page.fill('#password', demoPassword());
    await page.click('button[type=submit]');
    await page.waitForURL(/\/leads/);
    return `logged in as ${email}`;
  },
  async goto(rest) {
    await page.goto(`${BASE}${rest}`);
    await page.waitForLoadState('networkidle');
    return page.url();
  },
  async click(rest) {
    await visible(rest).first().click();
    return 'ok';
  },
  async fill(rest) {
    const [selector, value] = split(rest);
    await visible(selector).first().fill(value);
    return 'ok';
  },
  async check(rest) {
    await visible(rest).first().check();
    return 'ok';
  },
  async press(rest) {
    await page.keyboard.press(rest);
    return 'ok';
  },
  async wait(rest) {
    await visible(rest).first().waitFor();
    return 'visible';
  },
  /** รอ network idle ก่อน — หลังกดปุ่ม รายการ (เช่น timeline) ยัง refetch อยู่ อ่านทันทีจะได้ข้อมูลเก่า */
  async text(rest) {
    await page.waitForLoadState('networkidle');
    return oneLine(await visible(rest).first().innerText());
  },
  async count(rest) {
    await page.waitForLoadState('networkidle');
    return String(await visible(rest).count());
  },
  /** เรียก API ผ่านหน้าเว็บ (ใช้ session cookie ของ browser): api GET /api/leads?limit=1 | api POST /api/x :: {"a":1} */
  async api(rest) {
    const [head, body] = rest.includes(' :: ') ? split(rest) : [rest, undefined];
    const [method, path] = head.split(/\s+/);
    const result = await page.evaluate(
      async ([m, p, b]) => {
        const res = await fetch(p, {
          method: m,
          headers: b === undefined ? undefined : { 'content-type': 'application/json' },
          body: b,
        });
        return { status: res.status, text: await res.text() };
      },
      [method, path, body],
    );
    return `${result.status} ${oneLine(result.text, 600)}`;
  },
  async eval(rest) {
    return JSON.stringify(await page.evaluate(rest));
  },
  async viewport(rest) {
    const [width, height] = rest.split(/\s+/).map(Number);
    await page.setViewportSize({ width, height });
    return `${width}x${height}`;
  },
  /**
   * full-page screenshot — caret: 'initial' กัน Playwright แทรก style ก่อน hydrate (React จะเตือน mismatch)
   * เลื่อนขึ้นบนสุดก่อน: header เป็น sticky ถ้าหน้าเลื่อนอยู่ ภาพจะมี header โผล่กลางภาพ
   */
  async ss(rest) {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    const file = join(OUT, `${rest || 'page'}.png`);
    await page.screenshot({ path: file, fullPage: true, caret: 'initial' });
    return file;
  },
};

const script = readFileSync(0, 'utf8').split('\n');
let failed = false;
for (const raw of script) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [name, ...parts] = line.split(' ');
  const run = commands[name];
  if (!run) {
    console.log(`✗ ${line}\n    unknown command (${Object.keys(commands).join(', ')})`);
    failed = true;
    break;
  }
  try {
    console.log(`› ${line}\n    ${await run(parts.join(' ').trim())}`);
  } catch (error) {
    console.log(`✗ ${line}\n    ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    await page.screenshot({ path: join(OUT, 'zz-failure.png'), fullPage: true }).catch(() => {});
    failed = true;
    break;
  }
}

await browser.close();
console.log(`problems: ${problems.length === 0 ? 'none' : ''}`);
for (const problem of problems) console.log(`  - ${problem}`);
process.exitCode = failed || problems.length > 0 ? 1 : 0;
