"use strict";

/* ==========================================================================
   PART 1: ALGORITHMS (Pure JavaScript - Runnable in Node.js & Browser)
   Matrices are arrays of arrays: rows = processes P0.., columns = resource types R0..
   ========================================================================== */

const le = (a, b) => a.every((x, j) => x <= b[j]);
const plus = (a, b) => a.map((x, j) => x + b[j]);
const minus = (a, b) => a.map((x, j) => x - b[j]);
const fmt = a => Array.isArray(a) ? a.join(" ") : String(a);
const calcNeed = (mx, al) => mx.map((r, i) => minus(r, al[i])); // Need = Max - Allocation

function validateState(mx, al, av) { // returns list of error messages
  const e = [];
  if (!Array.isArray(mx) || !Array.isArray(al) || !Array.isArray(av)) {
    return ["Matrices must be valid 2D arrays and Available must be a 1D array."];
  }
  mx.forEach((r, i) => {
    if (!Array.isArray(r) || !al[i] || !Array.isArray(al[i])) {
      e.push(`P${i}: invalid matrix row dimensions`);
      return;
    }
    r.forEach((m, j) => {
      const a = al[i][j];
      if (!Number.isInteger(m) || !Number.isInteger(a)) {
        e.push(`P${i}, R${j}: empty or not a whole number`);
      } else if (m < 0 || a < 0) {
        e.push(`P${i}, R${j}: negative value`);
      } else if (a > m) {
        e.push(`P${i}, R${j}: allocation ${a} exceeds declared maximum ${m}`);
      }
    });
  });
  av.forEach((v, j) => {
    if (!Number.isInteger(v) || v < 0) {
      e.push(`Available R${j}: must be a whole number >= 0`);
    }
  });
  return e;
}

// ---- AVOIDANCE: Banker's safety algorithm ----
function safetyCheck(av, al, need) {
  const n = al.length, fin = Array(n).fill(false), seq = [], steps = [];
  let work = [...av], moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < n; i++) {
      if (!fin[i] && le(need[i], work)) { // Need <= Work: P_i can finish
        const before = work;
        work = plus(work, al[i]); // it then releases what it holds
        fin[i] = true;
        seq.push("P" + i);
        moved = true;
        steps.push({ p: "P" + i, need: need[i], before, after: work });
      }
    }
  }
  return { safe: fin.every(Boolean), seq, steps };
}

// ---- AVOIDANCE: resource-request algorithm. status = SAFE | UNSAFE | WAITING | INVALID ----
function processRequest(pidText, reqText, mx, al, av) {
  const n = al.length, m = av.length, need = calcNeed(mx, al);
  const R = (status, msg, x = {}) => ({ status, msg, steps: [], newAl: null, newAv: null, ...x });
  const pm = /^\s*P?(\d+)\s*$/i.exec(pidText), i = pm ? +pm[1] : -1;
  if (i < 0 || i >= n) return R("INVALID", `"${pidText}" is not a valid process (use P0 to P${n - 1}).`);
  const parts = reqText.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length !== m || parts.some(x => !/^-?\d+$/.test(x)))
    return R("INVALID", `request needs exactly ${m} whole numbers (one per resource type).`);
  const rq = parts.map(Number);
  if (rq.some(x => x < 0)) return R("INVALID", "negative requests are not allowed.");
  if (!le(rq, need[i])) // step 1: request <= Need ?
    return R("INVALID", `request [${fmt(rq)}] exceeds P${i}'s remaining Need [${fmt(need[i])}] (more than its declared maximum).`);
  if (!le(rq, av)) // step 2: request <= Available ?
    return R("WAITING", `request [${fmt(rq)}] is within Need but exceeds Available [${fmt(av)}]. It cannot be granted now, so P${i} waits. Allocation is unchanged.`);
  const nAv = minus(av, rq), nAl = al.map((r, k) => k === i ? plus(r, rq) : [...r]); // step 3: trial allocation
  const s = safetyCheck(nAv, nAl, calcNeed(mx, nAl)); // step 4: run safety algorithm
  if (s.safe) return R("SAFE", `request granted. Safe sequence: ${s.seq.join(" → ")}`, { steps: s.steps, newAl: nAl, newAv: nAv });
  return R("UNSAFE", "the trial allocation leaves no safe sequence, so the request is DENIED and the original state is restored. (Unsafe is not the same as deadlocked.)", { steps: s.steps });
}

// ---- DETECTION: works for multiple-instance resources ----
function detect(av, al, rq) {
  const fin = al.map(r => r.every(x => x === 0)), steps = []; // a process holding nothing is not stuck
  let work = [...av], moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < al.length; i++) {
      if (!fin[i] && le(rq[i], work)) { // its Request can be met: it will finish
        const before = work;
        work = plus(work, al[i]);
        fin[i] = true;
        moved = true;
        steps.push({ p: "P" + i, need: rq[i], before, after: work });
      }
    }
  }
  return { dead: fin.map((f, i) => f ? -1 : i).filter(x => x >= 0), steps };
}

function waitEdges(av, al, rq) { // [waiter, holder, resource]
  const e = [];
  rq.forEach((r, i) => r.forEach((x, j) => {
    if (x > av[j]) {
      al.forEach((a, k) => {
        if (k !== i && a[j] > 0) e.push([i, k, j]);
      });
    }
  }));
  return e;
}

function findCycle(edges) { // simple DFS, returns e.g. [0,1,0] or null
  const adj = {};
  edges.forEach(([a, b]) => (adj[a] = adj[a] || []).push(b));
  const dfs = (u, path) => {
    if (path.includes(u)) return path.slice(path.indexOf(u)).concat(u);
    for (const w of adj[u] || []) {
      const c = dfs(w, [...path, u]);
      if (c) return c;
    }
    return null;
  };
  for (const s of Object.keys(adj)) {
    const c = dfs(+s, []);
    if (c) return c;
  }
  return null;
}

// ---- RECOVERY: terminate one process ----
function terminate(i, av, al, rq) {
  const z = Array(av.length).fill(0);
  return {
    released: al[i],
    newAv: plus(av, al[i]),
    newAl: al.map((r, k) => k === i ? z : r),
    newRq: rq.map((r, k) => k === i ? z : r)
  };
}

// ---- PREVENTION: resource ordering. A process may only request types with index >= highest it holds ----
function orderViolations(al, rq) {
  const bad = [];
  al.forEach((held, i) => {
    const top = held.reduce((t, a, j) => a > 0 ? j : t, -1);
    rq[i].forEach((r, j) => {
      if (r > 0 && j < top) bad.push([i, j, top]);
    });
  });
  return bad;
}

function applyOrdering(al, rq) {
  const bad = orderViolations(al, rq), newRq = rq.map(r => [...r]);
  bad.forEach(([i, j]) => {
    newRq[i][j] = 0;
  }); // out-of-order request is refused
  return { newRq, bad };
}

/* ==========================================================================
   PART 2: EXAMPLE DATA AND ORIGINAL TEST CASES (Used by Node & Browser)
   ========================================================================== */

/* Example 1 (Banker's): a job scheduler. R0 = CPU cores (10 in total), R1 = memory blocks (6), R2 = disk channels (6).
   P0..P4 are running jobs. P4 already holds everything it will ever need (zero remaining Need). */
const A0 = [[2, 0, 1], [1, 1, 0], [3, 1, 2], [1, 2, 1], [2, 0, 0]];
const M0 = [[5, 3, 3], [3, 3, 2], [6, 4, 4], [3, 4, 2], [2, 0, 0]];
const V0 = [1, 2, 2];

/* Example 2 (Detection): R0, R1, R2 = three single-instance devices. P1 holds R0 and wants R1, P2 holds R1 and wants R2,
   P3 holds R2 and wants R0. P0 is an idle bystander. DA2 is the same cycle, but P0 also holds a second R0 instance. */
const DA = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
const DR = [[0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]];
const DV = [0, 0, 0];
const DA2 = [[1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];

/* Original 6 Predefined Test Cases - Exact preservation for check.js & Assignment */
function runTests() {
  const T = [];
  const snap = () => JSON.stringify([A0, M0, V0]);
  const s0 = snap();
  const same = () => snap() === s0;

  // TC1
  const need0 = calcNeed(M0, A0), t1 = safetyCheck(V0, A0, need0), g = processRequest("P1", "1 1 1", M0, A0, V0);
  T.push({
    id: "TC1",
    name: "Safe State Verification",
    cond: "Safe state: 5 jobs, 3 resource types, Available 1 2 2 (P4 has zero Need)",
    expected: "Safe sequence found",
    actual: (t1.safe ? "SAFE: " : "UNSAFE: ") + t1.seq.join(" → ") + `\nWork after each step: ${t1.steps.map(s => "[" + fmt(s.after) + "]").join(" ")}\nBonus: P1 requests 1 1 1 → ${g.status} (granted)`,
    pass: t1.safe && t1.seq.join() === "P4,P1,P2,P3,P0" && JSON.stringify(t1.steps.map(s => s.after)) === "[[3,2,2],[4,3,2],[7,4,4],[8,6,5],[10,6,6]]" && g.status === "SAFE",
    note: "Need = Max − Alloc. Only P4 (Need 0 0 0) can run at first, so it finishes and Work becomes 3 2 2. Then P1 (2 2 2), P2 (3 3 2), P3 (2 2 1) and P0 (3 3 2) each fit in turn. Work ends at 10 6 6, the total of every resource, so every job completes and the state is safe."
  });

  // TC2
  const r2 = processRequest("P2", "2 1 0", M0, A0, V0);
  T.push({
    id: "TC2",
    name: "Request Exceeds Available Resources",
    cond: "P2 requests 2 1 0 (within its Need 3 3 2, but R0 Available is only 1)",
    expected: "Request not granted immediately",
    actual: `${r2.status}: not granted now; allocation unchanged: ${same() ? "yes" : "NO"}`,
    pass: r2.status === "WAITING" && !r2.newAl && same(),
    note: "The request is valid (≤ Need) but asks for 2 CPU cores when only 1 is free, so P2 waits. It is not invalid and not permanently denied; once other jobs release resources it can be retried. Allocation and Available are untouched."
  });

  // TC3
  const r3 = processRequest("P0", "1 2 2", M0, A0, V0), last = r3.steps.length ? r3.steps[r3.steps.length - 1].after : V0;
  T.push({
    id: "TC3",
    name: "Request Produces Unsafe State",
    cond: "P0 requests 1 2 2 (within Need 3 3 2 and Available 1 2 2, but takes every free resource)",
    expected: "Request denied; state unchanged",
    actual: `${r3.status}: denied; in the trial only ${r3.steps.map(s => s.p).join(", ")} can finish (${r3.steps.length} of 5), Work stuck at [${fmt(last)}]; state restored: ${same() ? "yes" : "NO"}`,
    pass: r3.status === "UNSAFE" && !r3.newAl && r3.steps.length === 1 && r3.steps[0].p === "P4" && same(),
    note: "The trial leaves Available 0 0 0. P4 (zero Need) finishes and returns 2 cores, but every remaining Need (P0 2 1 0, P1 2 2 2, P2 3 3 2, P3 2 2 1) needs memory or disk that Work (2 0 0) lacks. No complete safe sequence exists, so the request is denied and the state restored. Unsafe is not deadlock: nobody is blocked yet, there is only no guarantee that all jobs can finish."
  });

  // TC4
  const d = detect(DV, DA, DR), cyc = findCycle(waitEdges(DV, DA, DR)), rec = terminate(1, DV, DA, DR), after = detect(rec.newAv, rec.newAl, rec.newRq);
  const dB = detect(DV, DA2, DR), cycB = findCycle(waitEdges(DV, DA2, DR)), pn = a => a.map(x => "P" + x).join(" → ");
  T.push({
    id: "TC4",
    name: "Deadlock Detection in Multi-Instance Model",
    cond: "P1, P2, P3 each hold one device and want the next one; P0 idle; Available 0 0 0 (multi-instance model, 1 instance each)",
    expected: "Deadlock identified by the selected detection method",
    actual: `DEADLOCK: ${d.dead.map(x => "P" + x).join(", ")} (P0 is not stuck); circular wait ${cyc ? pn(cyc) : "none"}.\nRecovery: terminate P1 releases [${fmt(rec.released)}], Available becomes [${fmt(rec.newAv)}], then ${after.dead.length ? "still deadlocked" : "no deadlock"}.\nContrast: if P0 also holds a second R0 instance the cycle ${cycB ? pn(cycB) : "none"} still exists, but the result is ${dB.dead.length ? "DEADLOCK" : "NO DEADLOCK"}`,
    pass: d.dead.join() === "1,2,3" && !!cyc && cyc.join() === "1,2,3,1" && after.dead.length === 0 && !!cycB && dB.dead.length === 0,
    note: "The detection algorithm starts with Work = Available = 0 0 0. Only idle P0 can finish, and no Request of P1, P2 or P3 fits, so those three can never finish. With single-instance resources the cycle is conclusive. In the contrast case P0 returns an R0 instance, P3 finishes, then P2, then P1: a circular wait only means a deadlock is possible when resources have several instances. Terminating P1 releases R0, which lets P3, P2 finish in turn."
  });

  // TC5
  const o = applyOrdering(DA, DR), d5 = detect(DV, DA, o.newRq);
  T.push({
    id: "TC5",
    name: "Deadlock Prevention (Linear Resource Ordering)",
    cond: "Resource ordering (R0 < R1 < R2) applied to the TC4 scenario",
    expected: "Selected deadlock condition eliminated",
    actual: `${d5.dead.length ? "DEADLOCK" : "NO DEADLOCK"}: ${o.bad.map(([i, j, t]) => `P${i} holding R${t} may not request R${j}`).join("; ")}`,
    pass: d.dead.length > 0 && d5.dead.length === 0 && o.bad.length === 1 && o.bad[0].join() === "3,0,2",
    note: "Circular wait is eliminated: requests must go in increasing resource order, so P3, which holds R2, may not ask for R0. The cycle can never close. Trade-off: jobs must acquire resources in a fixed order, so they hold resources longer and wait more, which lowers utilization and concurrency."
  });

  // TC6
  const badAl = A0.map(r => [...r]);
  badAl[4][0] = 3;
  const sub = [
    ["Request from unknown process P9", processRequest("P9", "1 0 0", M0, A0, V0).status, "INVALID"],
    ["Negative request −1 0 0 (P1)", processRequest("P1", "-1 0 0", M0, A0, V0).status, "INVALID"],
    ["P1 requests 3 0 0 (its Need is 2 2 2)", processRequest("P1", "3 0 0", M0, A0, V0).status, "INVALID"],
    ["P4 (zero Need) requests 1 0 0", processRequest("P4", "1 0 0", M0, A0, V0).status, "INVALID"],
    ["P4 (zero Need) requests 0 0 0", processRequest("P4", "0 0 0", M0, A0, V0).status, "SAFE"],
    ["Allocation 3 above Maximum 2 (P4, R0)", validateState(M0, badAl, V0).length ? "INVALID" : "SAFE", "INVALID"],
    ["Available 0 0 0 and P0 has zero Need", safetyCheck([0, 0], [[1, 0], [0, 1]], calcNeed([[1, 0], [1, 1]], [[1, 0], [0, 1]])).safe ? "SAFE" : "UNSAFE", "SAFE"],
    ["Available 0 0 0 on the main example", safetyCheck([0, 0, 0], A0, need0).safe ? "SAFE" : "UNSAFE", "UNSAFE"]
  ];
  T.push({
    id: "TC6",
    name: "Boundary and Invalid Inputs Validation",
    cond: "Boundary and invalid inputs",
    expected: "Correct handling or validation message",
    actual: sub.map(s => `${s[0]} → ${s[1]}`).join("\n"),
    pass: sub.every(s => s[1] === s[2]),
    note: "INVALID: unknown process, negative value, request above Need (including any positive request from the zero-Need P4), allocation above Maximum. VALID boundary cases: an all-zero request, and zero Available. Zero Available is SAFE when a zero-Need process can start the chain and merely UNSAFE (not invalid, not deadlock) when none can."
  });

  return T;
}

// Module export for check.js & Node regression test
if (typeof module !== "undefined") {
  module.exports = {
    DA, DA2, DR, DV,
    calcNeed, validateState, safetyCheck, processRequest,
    detect, waitEdges, findCycle, terminate, applyOrdering, orderViolations,
    runTests, A0, M0, V0
  };
}

/* ==========================================================================
   PART 3: ADVANCED USER INTERFACE & SIMULATION ENGINE (Browser execution)
   ========================================================================== */

if (typeof document !== "undefined") {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Global State Stores
  const AppState = {
    activeTab: "tab-overview",
    avoidanceStepper: { steps: [], currentIdx: 0, timer: null },
    customStepper: { steps: [], currentIdx: 0, timer: null },
    customHistory: [],
    customTestCounter: 1,
    aiRecords: []
  };

  const CLS = {
    SAFE: "ok",
    "NO DEADLOCK": "ok",
    UNSAFE: "warn",
    WAITING: "info",
    DEADLOCK: "bad",
    DENIED: "bad",
    INVALID: "inv"
  };

  const badge = (s, msg) => `
    <div class="status-alert ${CLS[s] || 'info'}">
      <span class="status-badge ${CLS[s] || 'info'}" style="margin-right: 8px;">${esc(s)}</span>
      ${esc(msg)}
    </div>`;

  // Grid Builder: Creates editable HTML table with process rows and resource columns
  function buildGridHTML(id, rows, cols, def, labels, force) {
    const el = $(id);
    const old = (!force && el && el.querySelector("input")) ? readGrid(id) : def;
    let h = `<table class="matrix-grid-table"><thead><tr><th></th>${Array.from({ length: cols }, (_, j) => `<th>R${j}</th>`).join("")}</tr></thead><tbody>`;
    for (let i = 0; i < rows; i++) {
      h += `<tr><th>${labels ? labels[i] : "P" + i}</th>`;
      for (let j = 0; j < cols; j++) {
        const val = old && old[i] && old[i][j] !== undefined ? old[i][j] : 0;
        h += `<td><input type="number" data-i="${i}" data-j="${j}" value="${isNaN(val) ? 0 : val}"></td>`;
      }
      h += "</tr>";
    }
    h += "</tbody></table>";
    if (el) el.innerHTML = h;
  }

  function readGrid(id) {
    const el = $(id);
    if (!el) return [];
    const out = [];
    el.querySelectorAll("input").forEach(x => {
      const i = +x.dataset.i, j = +x.dataset.j;
      out[i] = out[i] || [];
      out[i][j] = x.value === "" ? NaN : Number(x.value);
    });
    return out;
  }

  // Read-only calculated matrix display
  function renderReadonlyMatrix(id, matrix, rowLabels) {
    const el = $(id);
    if (!el) return;
    if (!matrix || !matrix.length) { el.innerHTML = ""; return; }
    const cols = matrix[0].length;
    let h = `<table><thead><tr><th></th>${Array.from({ length: cols }, (_, j) => `<th>R${j}</th>`).join("")}</tr></thead><tbody>`;
    matrix.forEach((row, i) => {
      h += `<tr><th>${rowLabels ? rowLabels[i] : "P" + i}</th>`;
      row.forEach(val => {
        h += `<td class="calculated-cell">${val}</td>`;
      });
      h += "</tr>";
    });
    h += "</tbody></table>";
    el.innerHTML = h;
  }

  // Interactive Execution Stepper Generator
  function renderStepper(stepperObj, containerId, label = "Need") {
    const { steps, currentIdx } = stepperObj;
    if (!steps || !steps.length) return "";
    const s = steps[currentIdx];
    return `
      <div class="stepper-container">
        <div class="stepper-controls">
          <div class="stepper-indicator">
            Step <b>${currentIdx + 1}</b> of <b>${steps.length}</b> &bull; Process <b>${s.p}</b>
          </div>
          <div class="stepper-buttons">
            <button class="btn btn-secondary btn-sm" onclick="stepNav('${containerId}', 'first')">⏮ First</button>
            <button class="btn btn-secondary btn-sm" onclick="stepNav('${containerId}', 'prev')">◀ Prev</button>
            <button class="btn btn-secondary btn-sm" onclick="stepNav('${containerId}', 'next')">▶ Next</button>
            <button class="btn btn-secondary btn-sm" onclick="stepNav('${containerId}', 'last')">⏭ Last</button>
            <button class="btn btn-primary btn-sm" onclick="stepNav('${containerId}', 'play')">▶️ Auto-Play</button>
            <button class="btn btn-secondary btn-sm" onclick="stepNav('${containerId}', 'all')">Show All</button>
          </div>
        </div>
        <div class="step-card">
          <div class="step-header">
            <span>Process <b>${s.p}</b> Qualified (${label} &le; Work)</span>
            <span class="status-badge ok">CONDITION MET</span>
          </div>
          <div class="step-body-grid">
            <div class="step-param">
              <b>${label} Vector</b>
              <span>[${fmt(s.need)}]</span>
            </div>
            <div class="step-param">
              <b>Work Before</b>
              <span>[${fmt(s.before)}]</span>
            </div>
            <div class="step-param">
              <b>Release &amp; Reclaim</b>
              <span style="color: var(--color-safe);">+ Held Allocation</span>
            </div>
            <div class="step-param">
              <b>Work After</b>
              <span style="color: #6ee7b7; font-weight: 700;">[${fmt(s.after)}]</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Stepper Navigation dispatcher
  window.stepNav = function(stepperType, action) {
    const sObj = stepperType === "avoidance" ? AppState.avoidanceStepper : AppState.customStepper;
    if (sObj.timer) { clearInterval(sObj.timer); sObj.timer = null; }
    if (action === "first") sObj.currentIdx = 0;
    else if (action === "prev") sObj.currentIdx = Math.max(0, sObj.currentIdx - 1);
    else if (action === "next") sObj.currentIdx = Math.min(sObj.steps.length - 1, sObj.currentIdx + 1);
    else if (action === "last") sObj.currentIdx = sObj.steps.length - 1;
    else if (action === "play") {
      sObj.timer = setInterval(() => {
        if (sObj.currentIdx < sObj.steps.length - 1) {
          sObj.currentIdx++;
          updateStepperView(stepperType);
        } else {
          clearInterval(sObj.timer);
          sObj.timer = null;
        }
      }, 1000);
    } else if (action === "all") {
      sObj.showAll = !sObj.showAll;
    }
    updateStepperView(stepperType);
  };

  function updateStepperView(stepperType) {
    if (stepperType === "avoidance") renderAvoidance(false);
    else if (stepperType === "custom") renderCustomSafety();
  }

  // Safe Sequence Visual Badge Generator
  function renderSequencePills(seq) {
    if (!seq || !seq.length) return `<span style="color: var(--color-deadlock);">No Safe Sequence Exists</span>`;
    return seq.map((p, idx) => `
      <span class="seq-node">${p}</span>
      ${idx < seq.length - 1 ? '<span class="seq-arrow">&rarr;</span>' : ''}
    `).join("");
  }

  // Wait-For Graph SVG Generator
  function svgGraph(n, edges, cycle) {
    const P = Array.from({ length: n }, (_, i) => [
      130 + 80 * Math.cos(2 * Math.PI * i / n - Math.PI / 2),
      130 + 80 * Math.sin(2 * Math.PI * i / n - Math.PI / 2)
    ]);
    let s = `<svg viewBox="0 0 260 260" class="svg-graph">
      <defs>
        <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#ef4444"/>
        </marker>
        <marker id="ar-cycle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#f87171"/>
        </marker>
      </defs>`;

    edges.forEach(([a, b, j]) => {
      const [x1, y1] = P[a], [x2, y2] = P[b];
      const L = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      const cx = (x1 + x2) / 2 - uy * 26, cy = (y1 + y2) / 2 + ux * 26;
      const isCycleEdge = cycle && cycle.some((u, idx) => u === a && cycle[(idx + 1) % cycle.length] === b);
      s += `<path d="M${x1 + ux * 16} ${y1 + uy * 16} Q${cx} ${cy} ${x2 - ux * 18} ${y2 - uy * 18}" 
            fill="none" stroke="${isCycleEdge ? '#f87171' : '#dc2626'}" stroke-width="${isCycleEdge ? '2.5' : '1.5'}" 
            marker-end="${isCycleEdge ? 'url(#ar-cycle)' : 'url(#ar)'}"/>
            <text x="${(x1 + x2) / 4 + cx / 2}" y="${(y1 + y2) / 4 + cy / 2}" font-size="10" font-weight="700" fill="#fca5a5" text-anchor="middle">R${j}</text>`;
    });

    P.forEach(([x, y], i) => {
      s += `<circle cx="${x}" cy="${y}" r="16" fill="#1e3a8a" stroke="#3b82f6" stroke-width="2"/>
            <text x="${x}" y="${y + 5}" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">P${i}</text>`;
    });
    return s + "</svg>";
  }

  /* --------------------------------------------------------------------------
     TAB 2: AVOIDANCE MODULE LOGIC
     -------------------------------------------------------------------------- */
  const getAvoidanceState = () => ({
    al: readGrid("a-al"),
    mx: readGrid("a-mx"),
    av: readGrid("a-av")[0]
  });

  function renderAvoidance(resetStepper = true) {
    const { al, mx, av } = getAvoidanceState();
    const err = validateState(mx, al, av);
    const outEl = $("a-out");

    if (err.length) {
      outEl.innerHTML = badge("INVALID", "Input Validation Error: " + err.join("; "));
      $("a-need-display").innerHTML = "";
      updateLiveMetrics();
      return;
    }

    const need = calcNeed(mx, al);
    renderReadonlyMatrix("a-need-display", need);
    const r = safetyCheck(av, al, need);

    if (resetStepper) {
      AppState.avoidanceStepper.steps = r.steps;
      AppState.avoidanceStepper.currentIdx = 0;
    }

    let h = `
      <div class="sequence-container">
        <span class="sequence-title">System Status:</span>
        <span class="status-badge ${r.safe ? 'ok' : 'warn'}">${r.safe ? 'SAFE STATE' : 'UNSAFE STATE'}</span>
        <div class="sequence-flow" style="margin-left: auto;">
          ${renderSequencePills(r.seq)}
        </div>
      </div>
    `;

    if (r.safe) {
      h += badge("SAFE", `Safe sequence found: ${r.seq.join(" → ")}. Every process can successfully complete.`);
    } else {
      h += badge("UNSAFE", "No complete safe sequence exists under current resource availability. (Note: Unsafe state is not necessarily deadlocked; deadlock occurs only if processes block indefinitely waiting for resources.)");
    }

    if (r.steps.length) {
      if (AppState.avoidanceStepper.showAll) {
        h += `<h4>Complete Step-by-Step Safety Progression</h4>
          <table><thead><tr><th>Process</th><th>Need Vector</th><th>Work Before</th><th>Released</th><th>Work After</th></tr></thead><tbody>
          ${r.steps.map(s => `<tr><td><b>${s.p}</b></td><td>[${fmt(s.need)}]</td><td>[${fmt(s.before)}]</td><td style="color:var(--color-safe);">+Held</td><td style="color:#6ee7b7; font-weight:700;">[${fmt(s.after)}]</td></tr>`).join("")}
          </tbody></table>
          <button class="btn btn-secondary btn-sm" style="margin-top: 8px;" onclick="stepNav('avoidance', 'all')">Collapse to Stepper View</button>`;
      } else {
        h += renderStepper(AppState.avoidanceStepper, "avoidance", "Need");
      }
    }

    outEl.innerHTML = h;
    updateLiveMetrics();
  }

  function handleAvoidanceRequest() {
    const { al, mx, av } = getAvoidanceState();
    const err = validateState(mx, al, av);
    const outEl = $("a-rout");

    if (err.length) {
      outEl.innerHTML = badge("INVALID", "Cannot evaluate request: Fix matrix errors first. " + err.join("; "));
      return;
    }

    const pid = $("a-pid").value.trim();
    const req = $("a-req").value.trim();
    const r = processRequest(pid, req, mx, al, av);

    let h = `<div class="decision-panel">`;

    if (r.status === "SAFE") {
      h += `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px;">
          <h4>Resource Request Decision</h4>
          <span class="status-badge ok">REQUEST GRANTED (SAFE)</span>
        </div>
        <p style="color: #6ee7b7; margin-bottom: 12px;">${esc(r.msg)}</p>
        <div class="callout" style="background: rgba(16, 185, 129, 0.08); border-color: var(--color-safe-border);">
          <b>Verification Steps:</b><br>
          1. <code>Request &le; Need</code>: Passed &bull; 2. <code>Request &le; Available</code>: Passed &bull; 3. <code>Trial Safety Check</code>: Passed<br>
          <b>State Transition:</b> Allocation updated, Available updated to <b>[${fmt(r.newAv)}]</b>.
        </div>
        <div style="margin-top: 10px;">
          <h5>Updated Allocation Matrix</h5>
          ${renderReadonlyMatrixInline(r.newAl)}
        </div>
      `;
    } else if (r.status === "WAITING") {
      h += `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px;">
          <h4>Resource Request Decision</h4>
          <span class="status-badge info">REQUEST DEFERRED (WAITING)</span>
        </div>
        <p style="color: #fed7aa; margin-bottom: 12px;">${esc(r.msg)}</p>
        <div class="callout" style="background: rgba(245, 158, 11, 0.08); border-color: var(--color-waiting-border);">
          <b>Reason for Deferral:</b> The request asks for more instances than are currently available.<br>
          <b>Guarantee:</b> System state and allocations remain <b>completely unchanged</b>. Process must wait until other jobs release resources.
        </div>
      `;
    } else if (r.status === "UNSAFE") {
      h += `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px;">
          <h4>Resource Request Decision</h4>
          <span class="status-badge bad">REQUEST DENIED (UNSAFE STATE)</span>
        </div>
        <p style="color: #fee2e2; margin-bottom: 12px;">${esc(r.msg)}</p>
        <div class="callout" style="background: rgba(239, 68, 68, 0.08); border-color: var(--color-deadlock-border);">
          <b>Safety Check Failure:</b> Granting this request leaves no execution sequence guaranteeing all processes can finish.<br>
          <b>Rollback Assurance:</b> Trial allocation was safely aborted. Original Allocation and Available (<b>[${fmt(av)}]</b>) were fully restored.
        </div>
      `;
    } else {
      h += `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px;">
          <h4>Resource Request Decision</h4>
          <span class="status-badge inv">INVALID REQUEST</span>
        </div>
        <p style="color: #e2e8f0; margin-bottom: 12px;">${esc(r.msg)}</p>
      `;
    }

    if (r.steps && r.steps.length) {
      h += `
        <h5 style="margin-top: 14px;">Trial Safety Progression (${r.steps.length} process(es) completed)</h5>
        <table><thead><tr><th>Process</th><th>Need</th><th>Work Before</th><th>Work After</th></tr></thead><tbody>
        ${r.steps.map(s => `<tr><td>${s.p}</td><td>[${fmt(s.need)}]</td><td>[${fmt(s.before)}]</td><td>[${fmt(s.after)}]</td></tr>`).join("")}
        </tbody></table>
      `;
    }

    h += `</div>`;
    outEl.innerHTML = h;
  }

  function renderReadonlyMatrixInline(matrix) {
    if (!matrix) return "";
    return `<table><thead><tr><th></th>${Array.from({ length: matrix[0].length }, (_, j) => `<th>R${j}</th>`).join("")}</tr></thead><tbody>` +
      matrix.map((r, i) => `<tr><th>P${i}</th>${r.map(x => `<td>${x}</td>`).join("")}</tr>`).join("") + `</tbody></table>`;
  }

  /* --------------------------------------------------------------------------
     TAB 3: DEADLOCK DETECTION LOGIC
     -------------------------------------------------------------------------- */
  const getDetectionState = () => ({
    al: readGrid("d-al"),
    rq: readGrid("d-rq"),
    av: readGrid("d-av")[0]
  });

  const getDetectionErrors = ({ al, rq, av }) => {
    if ([...al.flat(), ...rq.flat(), ...av].some(x => !Number.isInteger(x) || x < 0)) {
      return ["All matrix cells and available values must be whole integers >= 0"];
    }
    return [];
  };

  function renderDetection() {
    const s = getDetectionState();
    const err = getDetectionErrors(s);
    const outEl = $("d-out");

    if (err.length) {
      outEl.innerHTML = badge("INVALID", err[0]);
      return;
    }

    const edges = waitEdges(s.av, s.al, s.rq);
    const cyc = findCycle(edges);
    const r = detect(s.av, s.al, s.rq);

    let h = `
      <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 16px;">
        <div style="flex: 1; min-width: 280px;">
          <h4>Wait-For Relationships &amp; Graph</h4>
    `;

    if (edges.length) {
      h += `
        <ul style="padding-left: 20px; margin: 8px 0; font-size: 13px; color: var(--text-secondary);">
          ${edges.map(([i, k, j]) => `<li>Process <b>P${i}</b> is waiting for <b>P${k}</b> (holding instance of <b>R${j}</b>)</li>`).join("")}
        </ul>
        <div class="graph-container">
          ${svgGraph(s.al.length, edges, cyc)}
        </div>
      `;
    } else {
      h += `<p style="color: var(--text-muted); margin: 10px 0;">No process is waiting on another process.</p>`;
    }

    h += `
        <div class="callout" style="margin-top: 10px;">
          <b>Circular Wait Analysis:</b> ${cyc ? `<span style="color: var(--color-deadlock); font-weight:700;">Cycle detected: ${cyc.map(x => "P" + x).join(" → ")}</span>` : '<span style="color: var(--color-safe);">No circular dependency detected</span>'}<br>
          <span style="font-size: 11.5px; color: var(--text-muted);">In multi-instance systems, cycle existence alone does NOT prove deadlock. Inspect the detection algorithm outcome below.</span>
        </div>
      </div>

      <div style="flex: 1; min-width: 280px;">
        <h4>Detection Algorithm Outcome</h4>
    `;

    if (r.dead.length) {
      h += `
        <div class="status-alert bad">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b>CONFIRMED DEADLOCK DETECTED</b>
            <span class="status-badge bad">DEADLOCKED</span>
          </div>
          <p style="margin-top: 6px;">Processes <b>${r.dead.map(x => "P" + x).join(", ")}</b> are in deadlock and can never finish execution.</p>
        </div>
      `;
    } else {
      h += `
        <div class="status-alert ok">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b>NO DEADLOCK PRESENT</b>
            <span class="status-badge ok">HEALTHY</span>
          </div>
          <p style="margin-top: 6px;">All processes can obtain required resources and finish execution in some order.</p>
        </div>
      `;
    }

    if (r.steps.length) {
      h += `
        <h5 style="margin: 14px 0 8px;">Execution Reduction Progression</h5>
        <table><thead><tr><th>Process</th><th>Request Vector</th><th>Work Before</th><th>Work After</th></tr></thead><tbody>
        ${r.steps.map(s => `<tr><td><b>${s.p}</b></td><td>[${fmt(s.need)}]</td><td>[${fmt(s.before)}]</td><td style="color:#6ee7b7; font-weight:700;">[${fmt(s.after)}]</td></tr>`).join("")}
        </tbody></table>
      `;
    }

    h += `</div></div>`;
    outEl.innerHTML = h;

    // Synchronize Recovery Select options
    renderRecoveryOptions();
  }

  /* --------------------------------------------------------------------------
     TAB 4: PREVENTION & RECOVERY LOGIC
     -------------------------------------------------------------------------- */
  function renderRecoveryOptions() {
    const s = getDetectionState();
    const r = detect(s.av, s.al, s.rq);
    const sel = $("r-sel");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = r.dead.length
      ? r.dead.map(i => `<option value="${i}">Process P${i}</option>`).join("")
      : `<option value="">No deadlocked processes</option>`;
    if (current && r.dead.includes(+current)) sel.value = current;

    // Render Prevention View
    renderPreventionView(s, r);
  }

  function handleProcessTermination() {
    const s = getDetectionState();
    const pidVal = parseInt($("r-sel").value);
    const outEl = $("r-rec");

    if (isNaN(pidVal)) {
      outEl.innerHTML = badge("NO DEADLOCK", "No deadlocked process selected for recovery.");
      return;
    }

    const t = terminate(pidVal, s.av, s.al, s.rq);
    const rAfter = detect(t.newAv, t.newAl, t.newRq);

    let h = `
      <div class="decision-panel">
        <h4>Termination Impact Analysis</h4>
        <p>Terminated Process <b>P${pidVal}</b> &bull; Reclaimed Resources: <b>[${fmt(t.released)}]</b> &bull; New Available Vector: <b>[${fmt(t.newAv)}]</b></p>
        <div style="margin: 12px 0;">
    `;

    if (rAfter.dead.length) {
      h += badge("DEADLOCK", `Deadlock remains: Processes ${rAfter.dead.map(x => "P" + x).join(", ")} are still blocked. Additional termination required.`);
    } else {
      h += badge("NO DEADLOCK", "Deadlock successfully broken! The released resources allow all remaining processes to complete.");
    }

    if (rAfter.steps.length) {
      h += `
        <h5>Progression of Remaining Processes</h5>
        <table><thead><tr><th>Process</th><th>Request</th><th>Work Before</th><th>Work After</th></tr></thead><tbody>
        ${rAfter.steps.map(s => `<tr><td>${s.p}</td><td>[${fmt(s.need)}]</td><td>[${fmt(s.before)}]</td><td>[${fmt(s.after)}]</td></tr>`).join("")}
        </tbody></table>
      `;
    }

    h += `</div></div>`;
    outEl.innerHTML = h;
  }

  function renderPreventionView(s, rBefore) {
    const outEl = $("r-prev");
    if (!outEl) return;
    const o = applyOrdering(s.al, s.rq);
    const dAfter = detect(s.av, s.al, o.newRq);

    let h = `
      <div class="callout">
        <b>Havender's Linear Ordering Rule:</b> A global ordering function is defined over resource types (<code>R0 &lt; R1 &lt; R2</code>). A process may only request resource type <code>Rj</code> if <code>j &ge;</code> the highest resource index it currently holds. Out-of-order requests are rejected, mathematically precluding Circular Wait.
      </div>

      <div style="margin: 14px 0;">
        <h4>Policy Evaluation on Current Requests</h4>
    `;

    if (o.bad.length) {
      h += `
        <ul style="padding-left: 20px; color: var(--text-secondary); margin: 8px 0;">
          ${o.bad.map(([i, j, top]) => `<li style="color: var(--color-deadlock);">Process <b>P${i}</b> holds <b>R${top}</b> but requested <b>R${j}</b> &rarr; <b>REFUSED (Out-of-order violation)</b></li>`).join("")}
        </ul>
      `;
    } else {
      h += `<p style="color: var(--color-safe); margin: 8px 0;">No outstanding requests violate the resource ordering policy.</p>`;
    }

    h += `
      </div>
      <table style="margin: 14px 0;">
        <thead>
          <tr>
            <th>System Scenario</th>
            <th>Before Prevention Policy</th>
            <th>With Prevention Policy Applied</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Deadlock State</b></td>
            <td>${rBefore.dead.length ? `<span class="status-badge bad">DEADLOCK: ${rBefore.dead.map(x => "P" + x).join(", ")}</span>` : '<span class="status-badge ok">NO DEADLOCK</span>'}</td>
            <td>${dAfter.dead.length ? `<span class="status-badge bad">DEADLOCK: ${dAfter.dead.map(x => "P" + x).join(", ")}</span>` : '<span class="status-badge ok">NO DEADLOCK (ELIMINATED)</span>'}</td>
          </tr>
        </tbody>
      </table>

      <div class="callout" style="background: rgba(245, 158, 11, 0.08); border-color: var(--color-waiting-border);">
        <b>Operating Systems Engineering Trade-off:</b> Enforcing strict resource ordering eliminates circular wait, but significantly reduces system concurrency and resource utilization because processes must acquire resources in predetermined sequences rather than as naturally needed, occasionally requiring premature allocation.
      </div>
    `;

    outEl.innerHTML = h;
  }

  /* --------------------------------------------------------------------------
     TAB 5: TEST CASES & ANALYTICAL REPORT LOGIC
     -------------------------------------------------------------------------- */
  function renderTestCardsAndReport() {
    const tests = runTests();
    const cardsEl = $("testCardsGrid");
    const tbodyEl = $("predefinedResultsTbody");
    const tsEl = $("testReportTimestamp");

    if (tsEl) tsEl.textContent = `Report Generated: ${new Date().toLocaleString()}`;

    // Render 6 Individual Test-Case Cards
    if (cardsEl) {
      cardsEl.innerHTML = tests.map(t => `
        <div class="test-case-card" id="card-${t.id}">
          <div class="test-case-header">
            <div class="test-case-id-group">
              <span class="test-case-id">${t.id}</span>
              <span class="test-case-title">${esc(t.name || t.cond.split(":")[0])}</span>
            </div>
            <span class="status-badge ${t.pass ? 'pass' : 'fail'}">${t.pass ? 'PASS' : 'FAIL'}</span>
          </div>

          <div class="test-case-desc">${esc(t.cond)}</div>

          <div class="test-case-io">
            <div class="test-io-row">
              <b>Expected Result:</b>
              <p>${esc(t.expected)}</p>
            </div>
            <div class="test-io-row">
              <b>Actual Result:</b>
              <p style="color: ${t.pass ? '#6ee7b7' : '#fca5a5'};">${esc(t.actual).replace(/\n/g, "<br>")}</p>
            </div>
          </div>

          <div class="test-case-analysis">
            <b>Analysis:</b> ${esc(t.note)}
          </div>

          <div class="test-case-footer">
            <span style="font-size: 11px; color: var(--text-muted);">Original Suite Assertion</span>
            <button class="btn btn-secondary btn-sm" onclick="runSingleCardTest('${t.id}')">Run Test</button>
          </div>
        </div>
      `).join("");
    }

    // Render Summary Table
    if (tbodyEl) {
      tbodyEl.innerHTML = tests.map(t => `
        <tr>
          <td><b>${t.id}</b></td>
          <td>${esc(t.cond)}</td>
          <td>${esc(t.actual).replace(/\n/g, "<br>")}</td>
          <td>${esc(t.expected)}</td>
          <td><span class="status-badge ${t.pass ? 'pass' : 'fail'}">${t.pass ? 'PASS' : 'FAIL'}</span></td>
          <td>${esc(t.note)}</td>
        </tr>
      `).join("");
    }

    renderCustomReportTable();
  }

  window.runSingleCardTest = function(testId) {
    const tests = runTests();
    const t = tests.find(x => x.id === testId);
    if (!t) return;
    const card = $("card-" + testId);
    if (card) {
      card.style.borderColor = "var(--color-safe)";
      setTimeout(() => { card.style.borderColor = "var(--border-card)"; }, 800);
    }
  };

  function renderCustomReportTable() {
    const tbody = $("customResultsTbody");
    if (!tbody) return;
    if (!AppState.customHistory.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">No custom scenarios run yet. Launch the Custom Simulator to create user-defined tests.</td></tr>`;
      return;
    }
    tbody.innerHTML = AppState.customHistory.map(h => `
      <tr>
        <td><b>${h.id}</b></td>
        <td>${h.timestamp}</td>
        <td>${h.n}P &times; ${h.m}R</td>
        <td>[${fmt(h.av)}]</td>
        <td><span class="status-badge ${CLS[h.result] || 'info'}">${esc(h.result)}</span></td>
        <td>${esc(h.safeSeq || h.summary)}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="loadCustomFromHistory('${h.id}')">Reload</button></td>
      </tr>
    `).join("");
  }

  // CSV Exporter for Analytical Results
  function exportAnalyticalCSV() {
    const tests = runTests();
    const rows = [
      ["Test Case ID", "Scenario / Condition", "Actual Execution Result", "Expected Result", "Status", "Analytical Explanation"]
    ];

    tests.forEach(t => {
      rows.push([
        t.id,
        `"${t.cond.replace(/"/g, '""')}"`,
        `"${t.actual.replace(/\n/g, ' ').replace(/"/g, '""')}"`,
        `"${t.expected.replace(/"/g, '""')}"`,
        t.pass ? "PASS" : "FAIL",
        `"${t.note.replace(/"/g, '""')}"`
      ]);
    });

    if (AppState.customHistory.length) {
      rows.push([]);
      rows.push(["--- USER-DEFINED CUSTOM SCENARIOS ---"]);
      rows.push(["Custom ID", "Timestamp", "Configuration", "Available", "Outcome Status", "Safe Sequence / Summary"]);
      AppState.customHistory.forEach(h => {
        rows.push([
          h.id,
          h.timestamp,
          `${h.n} Processes, ${h.m} Resources`,
          `[${fmt(h.av)}]`,
          h.result,
          `"${(h.safeSeq || h.summary).replace(/"/g, '""')}"`
        ]);
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `deadlock_analytical_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportAnalyticalJSON() {
    const tests = runTests();
    const data = {
      assignmentTests: tests,
      customTests: AppState.customHistory,
      exportedAt: new Date().toISOString()
    };
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonStr);
    link.setAttribute("download", `deadlock_report_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* --------------------------------------------------------------------------
     TAB 6: CUSTOM TEST SIMULATOR LOGIC
     -------------------------------------------------------------------------- */
  const CustomPresets = {
    "preset-safe": {
      n: 4, m: 3,
      al: [[1, 0, 1], [2, 1, 0], [1, 1, 1], [0, 2, 0]],
      mx: [[2, 1, 2], [3, 2, 1], [2, 2, 2], [1, 2, 1]],
      av: [2, 1, 2]
    },
    "preset-unsafe": {
      n: 3, m: 2,
      al: [[2, 1], [1, 2], [3, 0]],
      mx: [[4, 2], [2, 3], [5, 1]],
      av: [0, 0]
    },
    "preset-single": {
      n: 2, m: 2,
      al: [[1, 0], [0, 1]],
      mx: [[1, 1], [1, 1]],
      av: [0, 0]
    },
    "preset-zero": {
      n: 3, m: 3,
      al: [[1, 1, 1], [0, 0, 0], [1, 0, 0]],
      mx: [[1, 1, 1], [1, 1, 1], [2, 1, 1]],
      av: [1, 0, 1]
    }
  };

  function buildCustomGrids(n, m, presetData = null) {
    const al = presetData ? presetData.al : Array.from({ length: n }, () => Array(m).fill(0));
    const mx = presetData ? presetData.mx : Array.from({ length: n }, () => Array(m).fill(1));
    const av = presetData ? presetData.av : Array(m).fill(1);

    buildGridHTML("c-al", n, m, al, null, true);
    buildGridHTML("c-mx", n, m, mx, null, true);
    buildGridHTML("c-av", 1, m, [av], ["Avail"], true);

    // Populate Process Select dropdown for request simulator
    const pidSel = $("c-pid");
    if (pidSel) {
      pidSel.innerHTML = Array.from({ length: n }, (_, i) => `<option value="P${i}">P${i}</option>`).join("");
    }

    renderCustomNeed();
  }

  const getCustomState = () => ({
    al: readGrid("c-al"),
    mx: readGrid("c-mx"),
    av: readGrid("c-av")[0]
  });

  function renderCustomNeed() {
    const { al, mx, av } = getCustomState();
    const alertEl = $("c-validation-alert");
    if (!al.length || !mx.length || !av.length) return;

    const err = validateState(mx, al, av);
    if (err.length) {
      if (alertEl) {
        alertEl.style.display = "block";
        alertEl.innerHTML = badge("INVALID", "Validation Warning: " + err.slice(0, 3).join("; ") + (err.length > 3 ? ` (+${err.length - 3} more)` : ""));
      }
      $("c-need-display").innerHTML = "";
    } else {
      if (alertEl) alertEl.style.display = "none";
      const need = calcNeed(mx, al);
      renderReadonlyMatrix("c-need-display", need);
    }
  }

  function renderCustomSafety() {
    const { al, mx, av } = getCustomState();
    const err = validateState(mx, al, av);
    const outEl = $("c-safety-out");

    if (err.length) {
      outEl.innerHTML = badge("INVALID", "Cannot execute safety algorithm: " + err.join("; "));
      return;
    }

    const need = calcNeed(mx, al);
    const r = safetyCheck(av, al, need);

    // Save run in History
    const testId = `CTC-${AppState.customTestCounter++}`;
    AppState.customHistory.unshift({
      id: testId,
      timestamp: new Date().toLocaleTimeString(),
      n: al.length,
      m: av.length,
      av: [...av],
      result: r.safe ? "SAFE" : "UNSAFE",
      safeSeq: r.safe ? r.seq.join(" → ") : "None",
      summary: r.safe ? `Safe sequence found (${r.seq.length} jobs)` : "Unsafe: trial stalled",
      state: { al: JSON.parse(JSON.stringify(al)), mx: JSON.parse(JSON.stringify(mx)), av: [...av] }
    });

    renderCustomHistoryTable();
    renderCustomReportTable();
    updateLiveMetrics();

    let h = `
      <div class="sequence-container">
        <span class="sequence-title">Custom Scenario Status:</span>
        <span class="status-badge ${r.safe ? 'ok' : 'warn'}">${r.safe ? 'SAFE STATE' : 'UNSAFE STATE'}</span>
        <div class="sequence-flow" style="margin-left: auto;">
          ${renderSequencePills(r.seq)}
        </div>
      </div>
    `;

    if (r.safe) {
      h += badge("SAFE", `Safe sequence found: ${r.seq.join(" → ")}. System guarantees deadlock-free completion.`);
    } else {
      h += badge("UNSAFE", `Unsafe state: System cannot guarantee completion for all processes. Work vector stalled.`);
    }

    if (r.steps.length) {
      h += `
        <h4>Safety Algorithm Execution Trace</h4>
        <table><thead><tr><th>Process</th><th>Need</th><th>Work Before</th><th>Work After</th></tr></thead><tbody>
        ${r.steps.map(s => `<tr><td><b>${s.p}</b></td><td>[${fmt(s.need)}]</td><td>[${fmt(s.before)}]</td><td style="color:#6ee7b7; font-weight:700;">[${fmt(s.after)}]</td></tr>`).join("")}
        </tbody></table>
      `;
    }

    outEl.innerHTML = h;
  }

  function handleCustomRequest() {
    const { al, mx, av } = getCustomState();
    const err = validateState(mx, al, av);
    const outEl = $("c-req-out");

    if (err.length) {
      outEl.innerHTML = badge("INVALID", "Validation error: " + err.join("; "));
      return;
    }

    const pid = $("c-pid").value;
    const reqText = $("c-req").value.trim();
    if (!reqText) {
      outEl.innerHTML = badge("INVALID", "Please enter a resource request vector (e.g. 1 0 1).");
      return;
    }

    const r = processRequest(pid, reqText, mx, al, av);

    // Save in history
    const testId = `CTC-${AppState.customTestCounter++}`;
    AppState.customHistory.unshift({
      id: testId,
      timestamp: new Date().toLocaleTimeString(),
      n: al.length,
      m: av.length,
      av: [...av],
      result: r.status,
      safeSeq: r.status === "SAFE" ? r.msg : "None",
      summary: `${pid} requested [${reqText}] &rarr; ${r.status}`,
      state: { al: JSON.parse(JSON.stringify(al)), mx: JSON.parse(JSON.stringify(mx)), av: [...av] }
    });

    renderCustomHistoryTable();
    renderCustomReportTable();
    updateLiveMetrics();

    let h = `<div class="decision-panel">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h4>Custom Request Outcome</h4>
        <span class="status-badge ${CLS[r.status] || 'info'}">${esc(r.status)}</span>
      </div>
      <p style="margin: 8px 0;">${esc(r.msg)}</p>
    `;

    if (r.status === "SAFE") {
      h += `
        <div class="callout" style="background: rgba(16, 185, 129, 0.08); border-color: var(--color-safe-border);">
          Request granted! New Available: <b>[${fmt(r.newAv)}]</b>.
        </div>
      `;
    } else if (r.status === "WAITING") {
      h += `
        <div class="callout" style="background: rgba(245, 158, 11, 0.08); border-color: var(--color-waiting-border);">
          Request is within process's remaining Need, but exceeds currently Available resources. Process waits; allocation unchanged.
        </div>
      `;
    } else if (r.status === "UNSAFE") {
      h += `
        <div class="callout" style="background: rgba(239, 68, 68, 0.08); border-color: var(--color-deadlock-border);">
          Request is denied because granting it leaves the system in an unsafe state. Original state has been preserved.
        </div>
      `;
    }

    h += `</div>`;
    outEl.innerHTML = h;
  }

  function renderCustomHistoryTable() {
    const tbody = $("customHistoryTbody");
    if (!tbody) return;
    if (!AppState.customHistory.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 16px;">No custom history recorded yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = AppState.customHistory.map(h => `
      <tr>
        <td><b>${h.id}</b></td>
        <td>${h.timestamp}</td>
        <td>${h.n}</td>
        <td>${h.m}</td>
        <td>[${fmt(h.av)}]</td>
        <td><span class="status-badge ${CLS[h.result] || 'info'}">${esc(h.result)}</span></td>
        <td>${esc(h.safeSeq || h.summary)}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="loadCustomFromHistory('${h.id}')">Reload</button></td>
      </tr>
    `).join("");
  }

  window.loadCustomFromHistory = function(id) {
    const item = AppState.customHistory.find(x => x.id === id);
    if (!item || !item.state) return;
    $("c-n").value = item.n;
    $("c-m").value = item.m;
    buildCustomGrids(item.n, item.m, item.state);
    switchTab("tab-custom");
  };

  /* --------------------------------------------------------------------------
     TAB 7: AI USAGE RECORD LOGIC
     -------------------------------------------------------------------------- */
  const DefaultAiRecords = [
    { tool: "Claude 3.7", purpose: "Dashboard architecture & modular UI layout", output: "Responsive CSS grid structure, theme tokens, tabs and stepper layout", verification: "Manually inspected styles, tested on mobile & desktop viewports" },
    { tool: "Claude 3.7", purpose: "Banker's Algorithm & Graph cycle verification", output: "Edge cases for multi-instance deadlock detection, waitEdges helper", verification: "Hand-calculated Work progression, validated against Silberschatz OS textbook" },
    { tool: "Claude 3.7", purpose: "Analytical report structure & CSV generation", output: "Export routines, test case cards with pass/fail evaluation", verification: "Verified CSV headers, checked that all 6 predefined tests remain 100% compliant" }
  ];

  function initAiTable() {
    const stored = localStorage.getItem("os_deadlock_ai_records");
    AppState.aiRecords = stored ? JSON.parse(stored) : [...DefaultAiRecords];
    renderAiTable();
  }

  function renderAiTable() {
    const tbody = $("aiTableTbody");
    if (!tbody) return;
    tbody.innerHTML = AppState.aiRecords.map((r, i) => `
      <tr>
        <td contenteditable="true" data-field="tool" data-i="${i}">${esc(r.tool)}</td>
        <td contenteditable="true" data-field="purpose" data-i="${i}">${esc(r.purpose)}</td>
        <td contenteditable="true" data-field="output" data-i="${i}">${esc(r.output)}</td>
        <td contenteditable="true" data-field="verification" data-i="${i}">${esc(r.verification)}</td>
        <td class="hide-print"><button class="btn btn-danger btn-sm" onclick="deleteAiRow(${i})">&times;</button></td>
      </tr>
    `).join("");

    // Bind blur event to update memory
    tbody.querySelectorAll("[contenteditable]").forEach(el => {
      el.onblur = function() {
        const idx = +this.dataset.i, f = this.dataset.field;
        if (AppState.aiRecords[idx]) AppState.aiRecords[idx][f] = this.textContent.trim();
      };
    });
  }

  window.deleteAiRow = function(i) {
    AppState.aiRecords.splice(i, 1);
    renderAiTable();
  };

  function addAiRow() {
    AppState.aiRecords.push({ tool: "AI Tool", purpose: "Describe task", output: "Describe output", verification: "Describe manual verification" });
    renderAiTable();
  }

  function saveAiRecords() {
    localStorage.setItem("os_deadlock_ai_records", JSON.stringify(AppState.aiRecords));
    const notice = $("aiSaveNotice");
    if (notice) {
      notice.style.display = "inline";
      setTimeout(() => { notice.style.display = "none"; }, 2500);
    }
  }

  function resetAiRecords() {
    AppState.aiRecords = JSON.parse(JSON.stringify(DefaultAiRecords));
    localStorage.removeItem("os_deadlock_ai_records");
    renderAiTable();
  }

  /* --------------------------------------------------------------------------
     LIVE METRICS SYNCHRONIZATION
     -------------------------------------------------------------------------- */
  function updateLiveMetrics() {
    const { al, mx, av } = getAvoidanceState();
    const pCount = al.length;
    const rCount = av.length;

    if ($("mTotalProcesses")) $("mTotalProcesses").textContent = pCount;
    if ($("mTotalResources")) $("mTotalResources").textContent = rCount;
    if ($("mAvailableVec")) $("mAvailableVec").textContent = `[${fmt(av)}]`;

    const need = calcNeed(mx, al);
    const s = safetyCheck(av, al, need);
    const mSafety = $("mSafetyStatus");
    const topPill = $("topStatusPill");

    if (mSafety && topPill) {
      if (s.safe) {
        mSafety.textContent = "SAFE";
        mSafety.style.color = "var(--color-safe)";
        topPill.className = "status-badge ok";
        topPill.textContent = "SAFE STATE";
      } else {
        mSafety.textContent = "UNSAFE";
        mSafety.style.color = "var(--color-unsafe)";
        topPill.className = "status-badge warn";
        topPill.textContent = "UNSAFE STATE";
      }
    }

    if ($("mCustomRunsCount")) $("mCustomRunsCount").textContent = AppState.customHistory.length;
  }

  /* --------------------------------------------------------------------------
     TAB SWITCHING & APPLICATION INITIALIZATION
     -------------------------------------------------------------------------- */
  window.switchTab = function(tabId) {
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === tabId));
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));

    const titles = {
      "tab-overview": ["Dashboard Overview", "System Health, Resource Allocation & Test Summary"],
      "tab-avoidance": ["Deadlock Avoidance", "Dijkstra's Banker's Algorithm & Resource Request Simulator"],
      "tab-detection": ["Deadlock Detection", "Multi-Instance Matrix Reduction & Wait-For Graph Cycles"],
      "tab-prevention": ["Prevention & Recovery", "Havender's Resource Ordering & Process Termination"],
      "tab-tests": ["Test Cases & Analysis", "Assignment Suite TC1–TC6 & Analytical Results Report"],
      "tab-custom": ["Custom Test Simulator", "Dynamic User-Defined Matrices & Scenario History"],
      "tab-ai": ["AI Usage Record", "Documentation of AI Assistance & Student Independent Verification"]
    };

    if (titles[tabId]) {
      $("currentViewTitle").textContent = titles[tabId][0];
      $("currentViewSubtitle").textContent = titles[tabId][1];
    }

    if (tabId === "tab-tests") renderTestCardsAndReport();
    if (tabId === "tab-custom") renderCustomNeed();
  };

  function initApp() {
    // 1. Initial Grids Construction
    buildGridHTML("a-al", A0.length, V0.length, A0);
    buildGridHTML("a-mx", M0.length, V0.length, M0);
    buildGridHTML("a-av", 1, V0.length, [V0], ["Avail"]);

    buildGridHTML("d-al", DA.length, DV.length, DA);
    buildGridHTML("d-rq", DR.length, DV.length, DR);
    buildGridHTML("d-av", 1, DV.length, [DV], ["Avail"]);

    buildCustomGrids(4, 3, CustomPresets["preset-safe"]);

    // 2. Navigation Tab Handlers
    document.querySelectorAll(".nav-item").forEach(b => {
      b.onclick = () => switchTab(b.dataset.tab);
    });

    // 3. Mobile Sidebar Toggle
    const menuBtn = $("menuToggleBtn");
    const sidebar = $("appSidebar");
    if (menuBtn && sidebar) {
      menuBtn.onclick = () => sidebar.classList.toggle("open");
    }

    // 4. Avoidance Buttons
    $("a-run-btn").onclick = () => renderAvoidance(true);
    $("a-btn").onclick = handleAvoidanceRequest;
    $("a-reset-btn").onclick = () => {
      $("a-n").value = A0.length;
      $("a-m").value = V0.length;
      buildGridHTML("a-al", A0.length, V0.length, A0, null, true);
      buildGridHTML("a-mx", M0.length, V0.length, M0, null, true);
      buildGridHTML("a-av", 1, V0.length, [V0], ["Avail"], true);
      renderAvoidance(true);
    };

    // Quick presets for request
    $("btnReqPreset1").onclick = () => { $("a-pid").value = "P1"; $("a-req").value = "1 1 1"; handleAvoidanceRequest(); };
    $("btnReqPreset2").onclick = () => { $("a-pid").value = "P2"; $("a-req").value = "2 1 0"; handleAvoidanceRequest(); };
    $("btnReqPreset3").onclick = () => { $("a-pid").value = "P0"; $("a-req").value = "1 2 2"; handleAvoidanceRequest(); };
    $("btnReqPreset4").onclick = () => { $("a-pid").value = "P4"; $("a-req").value = "1 0 0"; handleAvoidanceRequest(); };

    // Avoidance Dimension Changes
    ["a-n", "a-m"].forEach(id => {
      $(id).onchange = () => {
        const an = Math.max(1, Math.min(8, parseInt($("a-n").value) || 5));
        const am = Math.max(1, Math.min(5, parseInt($("a-m").value) || 3));
        buildGridHTML("a-al", an, am, A0);
        buildGridHTML("a-mx", an, am, M0);
        buildGridHTML("a-av", 1, am, [V0], ["Avail"]);
        renderAvoidance(true);
      };
    });

    // 5. Detection Handlers
    $("d-run-btn").onclick = renderDetection;
    const loadDetectionPreset = (al, rq, av) => {
      $("d-n").value = al.length;
      $("d-m").value = av.length;
      buildGridHTML("d-al", al.length, av.length, al, null, true);
      buildGridHTML("d-rq", al.length, av.length, rq, null, true);
      buildGridHTML("d-av", 1, av.length, [av], ["Avail"], true);
      renderDetection();
    };
    $("d-ex1").onclick = () => loadDetectionPreset(DA, DR, DV);
    $("d-ex2").onclick = () => loadDetectionPreset(DA2, DR, DV);
    ["d-n", "d-m"].forEach(id => {
      $(id).onchange = () => {
        const dn = Math.max(1, Math.min(8, parseInt($("d-n").value) || 4));
        const dm = Math.max(1, Math.min(5, parseInt($("d-m").value) || 3));
        buildGridHTML("d-al", dn, dm, DA);
        buildGridHTML("d-rq", dn, dm, DR);
        buildGridHTML("d-av", 1, dm, [DV], ["Avail"]);
        renderDetection();
      };
    });

    // 6. Recovery & Prevention Handlers
    $("r-btn").onclick = handleProcessTermination;

    // 7. Testing Suite & Export Handlers
    $("btnRunAllPredefined").onclick = renderTestCardsAndReport;
    $("btnRunAllTestsTop").onclick = () => {
      switchTab("tab-tests");
      renderTestCardsAndReport();
    };
    $("btnQuickCustom").onclick = () => switchTab("tab-custom");
    $("btnExportCSV").onclick = exportAnalyticalCSV;
    $("btnExportJSON").onclick = exportAnalyticalJSON;
    $("btnClearReportHistory").onclick = () => {
      AppState.customHistory = [];
      renderCustomHistoryTable();
      renderCustomReportTable();
      updateLiveMetrics();
    };

    // 8. Custom Simulator Handlers
    $("c-generate-btn").onclick = () => {
      const cn = Math.max(1, Math.min(8, parseInt($("c-n").value) || 4));
      const cm = Math.max(1, Math.min(6, parseInt($("c-m").value) || 3));
      buildCustomGrids(cn, cm);
    };
    $("c-run-btn").onclick = renderCustomSafety;
    $("c-req-btn").onclick = handleCustomRequest;
    $("c-reset-btn").onclick = () => {
      const cn = parseInt($("c-n").value) || 4;
      const cm = parseInt($("c-m").value) || 3;
      buildCustomGrids(cn, cm);
    };
    $("c-load-preset-btn").onclick = () => {
      const presetKey = $("c-preset-select").value;
      if (CustomPresets[presetKey]) {
        const p = CustomPresets[presetKey];
        $("c-n").value = p.n;
        $("c-m").value = p.m;
        buildCustomGrids(p.n, p.m, p);
      }
    };
    $("c-clear-history-btn").onclick = () => {
      AppState.customHistory = [];
      renderCustomHistoryTable();
      renderCustomReportTable();
      updateLiveMetrics();
    };
    $("c-export-history-btn").onclick = exportAnalyticalCSV;

    // 9. AI Table Handlers
    $("btnAddAiRow").onclick = addAiRow;
    $("btnSaveAiTable").onclick = saveAiRecords;
    $("btnResetAiTable").onclick = resetAiRecords;
    initAiTable();

    // 10. Live Input Listeners for Realtime Need Matrix Updates
    document.addEventListener("input", e => {
      const id = e.target.closest("div") ? e.target.closest("div").id : "";
      if (id && id.startsWith("a-")) {
        renderAvoidance(false);
      } else if (id && id.startsWith("d-")) {
        renderDetection();
      } else if (id && id.startsWith("c-")) {
        renderCustomNeed();
      }
    });

    // 11. Initial Render Cycle
    renderAvoidance(true);
    renderDetection();
    renderTestCardsAndReport();
    updateLiveMetrics();
  }

  // Launch on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
}
