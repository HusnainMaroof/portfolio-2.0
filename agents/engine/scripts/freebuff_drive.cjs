// Drives the Freebuff TUI through a Windows ConPTY (node-pty): Freebuff has no non-interactive mode.
// Ported from the old supervisor's driver (.e2e-tmp/freebuff/drive.js), which ran real tasks.
//
//   node scripts/freebuff_drive.cjs probe --cwd <dir>                 start, wait, print the screen
//   node scripts/freebuff_drive.cjs run --cwd <dir> --prompt-file <f> --max-min <n> [--model "<picker name>"] [--report <file>]
//
// The run is done when the report file has been stable for 60 s or the screen has been quiet for 90 s.
// The last stdout line is JSON in the shape the engine's claude-json parser reads ({result, is_error, usage}).
// Paid usage ("hours from your wallet") is never confirmed unless FREEBUFF_ALLOW_PAID=1.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const args = process.argv.slice(2);
const mode = args[0] || "probe";
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i > 0 && i + 1 < args.length ? args[i + 1] : def;
};
const cwd = path.resolve(opt("cwd", process.cwd()));
const promptFile = opt("prompt-file");
const maxMin = opt("max-sec") ? Number(opt("max-sec")) / 60 : Number(opt("max-min", "20"));
const model = opt("model", process.env.FREEBUFF_MODEL || "");
const reportFile = opt("report", path.join(cwd, ".orch-report.md"));
const logFile = opt("log", path.join(os.tmpdir(), `freebuff-${mode}-${Date.now()}.raw.log`));

const BIN = process.env.FREEBUFF_BIN || path.join(os.homedir(), ".config", "manicode", process.platform === "win32" ? "freebuff.exe" : "freebuff");

function loadPty() {
  const tries = [process.env.ORCH_NODE_PTY, "node-pty", path.join(os.homedir(), ".orch", "node-pty", "node_modules", "node-pty")];
  if (process.env.APPDATA) tries.push(path.join(process.env.APPDATA, "npm", "node_modules", "@openchamber", "web", "node_modules", "node-pty"));
  for (const t of tries.filter(Boolean)) {
    try {
      return require(t);
    } catch {}
  }
  return null;
}

const finish = (result, isError) => {
  console.log(JSON.stringify({ result, is_error: isError, total_cost_usd: 0, usage: {} }));
};

const pty = loadPty();
if (!pty) {
  console.log("error: crash: node-pty not found (npm i node-pty --prefix ~/.orch/node-pty, or set ORCH_NODE_PTY)");
  finish("", true);
  process.exit(1);
}
if (!fs.existsSync(BIN)) {
  console.log(`error: crash: Freebuff binary not found at ${BIN} (run freebuff once, or set FREEBUFF_BIN)`);
  finish("", true);
  process.exit(1);
}

// Strip ANSI/OSC sequences and collapse redraw noise into readable text.
const plain = (s) =>
  s
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?<>=$ ]*[A-Za-z@`~]/g, "\n")
    .replace(/\x1b[()][A-Z0-9]/g, "")
    .replace(/\x1b[=>78DEHMc]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i, a) => l.trim() && l !== a[i - 1])
    .join("\n");

// Freebuff writes its own .freebuff/project-id into the workspace; the engine would see that as the
// agent's change (scope violation in a read-only task), so a folder this session created is removed.
const freebuffDir = path.join(cwd, ".freebuff");
const hadFreebuffDir = fs.existsSync(freebuffDir);
const term = pty.spawn(BIN, ["--cwd", cwd], {
  name: "xterm-256color",
  cols: 160,
  rows: 48,
  cwd,
  env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
});
let raw = "";
let lastOut = Date.now();
term.onData((d) => {
  raw += d;
  if (raw.length > 6_000_000) raw = raw.slice(-3_000_000);
  lastOut = Date.now();
  fs.appendFileSync(logFile, d);
  // answer terminal capability probes so the TUI does not wait on them
  if (d.includes("\x1b[6n")) term.write("\x1b[1;1R");
  if (d.includes("\x1b[c") || d.includes("\x1b[>0q")) term.write("\x1b[?62;22c");
  if (d.includes("\x1b[14t")) term.write("\x1b[4;960;1280t");
  if (d.includes("\x1b]10;?")) term.write("\x1b]10;rgb:ffff/ffff/ffff\x07");
  if (d.includes("\x1b]11;?")) term.write("\x1b]11;rgb:0000/0000/0000\x07");
});
let exited = false;
term.onExit(() => {
  exited = true;
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitIdle = async (idleMs, maxMs) => {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (Date.now() - lastOut > idleMs) return true;
    await sleep(500);
  }
  return false;
};
const typeText = async (text) => {
  for (const ch of text) {
    term.write(ch === "\n" ? "\r" : ch);
    await sleep(4);
  }
};
const stop = async () => {
  term.write("\x03");
  await sleep(800);
  term.write("\x03");
  await sleep(1500);
  try {
    term.kill();
  } catch {}
};

// Replays raw PTY output onto a grid, so a line the TUI draws in pieces (cursor moves) reads back
// as one line (from the old driver's screen.js). With a marker, renders the frame of its last use.
function render(text, marker) {
  if (marker) {
    const at = text.lastIndexOf(marker);
    if (at >= 0) {
      const clear = Math.max(text.lastIndexOf("\x1b[2J", at), text.lastIndexOf("\x1bc", at));
      if (clear >= 0) text = text.slice(clear);
    }
  }
  const rows = new Map();
  let row = 0;
  let col = 0;
  const line = (r) => {
    if (!rows.has(r)) rows.set(r, []);
    return rows.get(r);
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\x1b") {
      const next = text[i + 1];
      if (next === "[") {
        let j = i + 2;
        while (j < text.length && !/[A-Za-z@`~]/.test(text[j])) j++;
        const nums = text.slice(i + 2, j).replace(/^[?>=]/, "").split(";").map((n) => parseInt(n, 10));
        const n = Number.isFinite(nums[0]) ? nums[0] : 1;
        const cmd = text[j];
        if (cmd === "H" || cmd === "f") {
          row = (Number.isFinite(nums[0]) ? nums[0] : 1) - 1;
          col = (Number.isFinite(nums[1]) ? nums[1] : 1) - 1;
        } else if (cmd === "A") row = Math.max(0, row - n);
        else if (cmd === "B") row += n;
        else if (cmd === "C") col += n;
        else if (cmd === "D") col = Math.max(0, col - n);
        else if (cmd === "G") col = n - 1;
        else if (cmd === "d") row = n - 1;
        else if (cmd === "K") {
          const l = line(row);
          const m = Number.isFinite(nums[0]) ? nums[0] : 0;
          if (m === 0) l.length = Math.min(l.length, col);
          else if (m === 2) l.length = 0;
        } else if (cmd === "J" && nums[0] === 2) rows.clear();
        i = j;
        continue;
      }
      if (next === "]") {
        let j = i + 2;
        while (j < text.length && text[j] !== "\x07" && !(text[j] === "\x1b" && text[j + 1] === "\\")) j++;
        i = text[j] === "\x07" ? j : j + 1;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === "\r") { col = 0; continue; }
    if (ch === "\n") { row += 1; continue; }
    if (ch < " ") continue;
    const l = line(row);
    while (l.length < col) l.push(" ");
    l[col] = ch;
    col += 1;
  }
  return [...rows.keys()].sort((a, b) => a - b).map((k) => rows.get(k).join("").replace(/\s+$/, "")).join("\n");
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Picks a model in the /model picker by its exact display name. The picker does not filter by typing:
// go to the top, press Down until the highlighted row ("›") of the CURRENT frame is that name, Enter,
// then confirm in the status bar. A loose check once picked Gemini 4 Argon (20 hours) for Nemotron.
async function chooseModel(name) {
  // The name is the text before the first "•"/"·" (a release tag like "10/17" dropped). The renderer
  // sometimes loses a character ("N motron"), so allow 2 edits; real names differ far more, and
  // "GLM 5.3 Flash Fast" is 4 edits from "GLM 5.3 Flash".
  const squash = (s) => s.replace(/\s+/g, "");
  const exact = {
    test: (text) => {
      const shown = text.split(/[•·]/)[0].replace(/\s\d+\/\d+\s*$/, "").trim();
      return Boolean(shown) && editDistance(squash(shown), squash(name)) <= 2;
    },
  };
  const highlighted = () => {
    const row = render(raw, "›").split("\n").find((l) => l.includes("›")) ?? "";
    return row.slice(row.indexOf("›") + 1);
  };
  await typeText("/model");
  await sleep(1200);
  term.write("\r");
  await sleep(2500);
  for (let i = 0; i < 60; i++) {
    term.write("\x1b[A");
    await sleep(30);
  }
  await sleep(800);
  let found = exact.test(highlighted());
  for (let i = 0; i < 60 && !found; i++) {
    term.write("\x1b[B");
    await sleep(300);
    found = exact.test(highlighted());
  }
  if (!found) {
    term.write("\x1b");
    return false;
  }
  term.write("\r");
  await sleep(2500);
  const status = render(raw, "/model to change").split("\n").filter((l) => l.includes("/model to change")).pop() ?? "";
  return exact.test(status.replace(/^[\s│]+/, ""));
}

(async () => {
  await waitIdle(4000, 60000);
  if (mode === "probe") {
    console.log(plain(raw).split("\n").slice(-60).join("\n"));
    await stop();
    process.exit(0);
  }
  if (mode === "pick") {
    // debug the picker without sending a prompt
    const ok = await chooseModel(model);
    console.log(ok ? `picked: ${model}` : `NOT picked: ${model}`);
    const statusRow = render(raw, "/model to change").split("\n").filter((l) => l.includes("/model to change")).pop() ?? "";
    console.log(`status bar: ${statusRow.replace(/^[\s│]+/, "").slice(0, 160)}`);
    await stop();
    process.exit(0);
  }
  if (mode === "models") {
    // the picker rows read "<name> • <note>" or "<name> · <note>"
    await typeText("/model");
    await sleep(1200);
    term.write("\r");
    await sleep(3000);
    const mark = raw.length;
    for (let i = 0; i < 40; i++) {
      term.write("\x1b[B");
      await sleep(150);
    }
    // section headings (UNLIMITED, STARTER, ...) and rows, in picker order, without redraw repeats
    const seen = new Set();
    for (const l of plain(raw.slice(Math.max(0, mark - 20000))).split("\n")) {
      const row = l.replace(/^[›\s│]+/, "").trim();
      if (!row || seen.has(row) || /model to change/.test(row)) continue;
      if (/^[A-Z][A-Z ]{3,}$/.test(row) || /^[A-Z][\w.\- ]+?\s+[•·]\s/.test(row)) {
        seen.add(row);
        console.log(row);
      }
    }
    term.write("\x1b");
    await stop();
    process.exit(0);
  }
  if (!promptFile || !fs.existsSync(promptFile)) {
    console.log(`error: crash: prompt file missing: ${promptFile}`);
    finish("", true);
    await stop();
    process.exit(1);
  }
  // the picker sometimes misses while the screen is still settling: one retry
  if (model && !(await chooseModel(model)) && !(await chooseModel(model))) {
    console.log(`error: model not found: ${model} is not in the Freebuff picker`);
    finish("", true);
    await stop();
    process.exit(1);
  }
  if (model) console.log(`[freebuff] model selected: ${model}`);
  // single line: a newline would submit early
  // The report file is how the driver knows the work is done (ads keep the screen busy), and the engine
  // reads and deletes it before verifying, so it is fine even for a read-only task.
  const reportRule =
    " FINAL STEP (overrides any rule about not creating files, for this one file only): when you are completely done, " +
    `save your whole final report to the file ${path.basename(reportFile)} in the workspace root; the orchestrator removes it.`;
  const prompt = (fs.readFileSync(promptFile, "utf8") + reportRule).replace(/\s*\n\s*/g, " ").trim();
  const promptAt = raw.length;
  await typeText(prompt);
  await sleep(500);
  term.write("\r");
  const sentAt = Date.now();
  console.log(`[freebuff] prompt sent (${prompt.length} chars) in ${cwd}`);

  let continues = 0;
  let answers = 0;
  let paidBlocked = false;
  const answerText =
    "Answer to your question: yes, proceed. The REPORT file is always allowed. " +
    "Do not ask more questions: when something is unclear, pick the safest option that follows the rules and note it in the report.";
  // React only to text drawn after our last action: the TUI redraws the same screen many times, and
  // counting every redraw made the old driver answer one pause again and again (each answer is a new turn).
  let mark = raw.length;
  const fresh = (re) => re.test(plain(raw.slice(mark)));
  const helper = setInterval(() => {
    // a question menu would wait forever: close it and answer in plain text
    if (answers < 5 && fresh(/Some questions for you/)) {
      answers++;
      mark = raw.length;
      console.log("[freebuff] auto-answer: closed a question menu");
      term.write("\x1b");
      setTimeout(() => typeText(answerText).then(() => setTimeout(() => term.write("\r"), 400)), 800);
    }
    // long runs pause with "...like me to continue..."
    if (continues < 10 && fresh(/like me to continue/)) {
      continues++;
      mark = raw.length;
      console.log("[freebuff] answered a continue prompt");
      typeText("continue").then(() => setTimeout(() => term.write("\r"), 400));
    }
    // paid usage needs the owner's yes; without it, back out and report a limit
    if (!paidBlocked && /Enter: confirm and send/.test(plain(raw.slice(-20000)))) {
      if (process.env.FREEBUFF_ALLOW_PAID === "1") term.write("\r");
      else {
        paidBlocked = true;
        term.write("\x1b");
      }
    }
  }, 5000);
  // Every 30 s: the new text the agent drew (no ads, tickers or box lines), so the engine's check-in
  // can tell progress from a loop; "[heartbeat]" lines keep the idle timer quiet but never count as progress.
  let shownAt = raw.length;
  const shown = new Set();
  const heartbeat = setInterval(() => {
    const fresh = plain(raw.slice(shownAt))
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 8 && !/^(Thinking|█|•|⎘|△▽)$|in the queue|is answering now|Ad \[Report|hours remaining|^[│╭╰└┌]/.test(l) && !shown.has(l));
    shownAt = raw.length;
    for (const l of fresh.slice(0, 15)) {
      shown.add(l);
      console.log(`[screen] ${l.slice(0, 200)}`);
    }
    console.log(`[heartbeat] freebuff session open, ${Math.round((Date.now() - sentAt) / 60000)} min`);
  }, 30000);

  // The daily hours ran out much faster than one per session in a real run (19 -> 15 in 9 minutes on a
  // looping task): stop once this session has used more than FREEBUFF_MAX_HOURS of the counter.
  const maxHours = Number(process.env.FREEBUFF_MAX_HOURS || "1");
  const hoursLeft = () => {
    const all = [...plain(raw).matchAll(/(\d+)\/\d+ hours (?:remaining|daily)/g)].map((m) => Number(m[1]));
    return all.length ? { first: all[0], last: all[all.length - 1] } : null;
  };
  const reportStable = () => fs.existsSync(reportFile) && Date.now() - fs.statSync(reportFile).mtimeMs > 30000;
  // A finished answer gets a footer with the elapsed time and feedback buttons ("⎘ • 7m 12s • △▽");
  // while working the screen says "Thinking". The footer without a report means: answer only on screen.
  let doneAt = 0;
  let footerAt = 0;
  const started = Date.now();
  let outcome = "timeout";
  while (true) {
    await sleep(5000);
    if (exited) { outcome = "exited"; break; }
    if (paidBlocked) { outcome = "paid"; break; }
    const h = hoursLeft();
    if (h && h.first - h.last > maxHours) { outcome = "hours"; break; }
    if (reportStable()) { outcome = "report"; break; }
    // every message gets that footer, also "Let me start by exploring...": only a footer with no
    // "Thinking" after it for 45 s means the agent stopped
    if (!doneAt && /△▽/.test(plain(raw.slice(Math.max(promptAt, mark))))) {
      doneAt = Date.now();
      footerAt = raw.length;
      console.log("[freebuff] a message finished; waiting to see if the agent goes on");
    }
    if (doneAt && /Thinking/.test(plain(raw.slice(footerAt)))) {
      doneAt = 0;
      mark = raw.length;
    }
    if (doneAt && Date.now() - doneAt > 45000) { outcome = "answered"; break; }
    if (Date.now() - lastOut > 90000) { outcome = "idle"; break; }
    if (Date.now() - started > maxMin * 60000) break;
  }
  clearInterval(helper);
  clearInterval(heartbeat);
  // the answer as drawn after the prompt, without the "Thinking" ticker, queue notes and ad boxes
  const screen = plain(raw.slice(promptAt))
    .split("\n")
    .filter((l) => !/^(Thinking|█|•|⎘|△▽)$|in the queue|is answering now|Ad \[Report|^[│╭╰]/.test(l.trim()))
    .slice(-200)
    .join("\n");
  console.log(`[freebuff] stopped: ${outcome}`);
  if (!exited) await stop();
  if (!hadFreebuffDir) fs.rmSync(freebuffDir, { recursive: true, force: true });
  if (outcome === "paid") {
    console.log("error: rate limit: Freebuff asked for paid hours (free sessions used up); set FREEBUFF_ALLOW_PAID=1 to allow");
    finish("", true);
    process.exit(1);
  }
  if (outcome === "hours") {
    const h = hoursLeft();
    console.log(`error: rate limit: this session used ${h.first - h.last} Freebuff hours (limit FREEBUFF_MAX_HOURS=${maxHours}); ${h.last} left today`);
    finish("", true);
    process.exit(1);
  }
  const report = fs.existsSync(reportFile) ? fs.readFileSync(reportFile, "utf8") : "";
  finish(report || screen, outcome === "timeout" && !report);
  process.exit(0);
})();
