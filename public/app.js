/* QueueStorm Investigator — futuristic frontend orchestration.
 * Talks to the same Express service via relative URLs.
 * Backend is unchanged: GET /health, POST /analyze-ticket.
 */
(function () {
  "use strict";

  // --- Config ---
  const API_BASE = "";
  const HEALTH_INTERVAL_MS = 30_000;
  const ANALYZE_TIMEOUT_MS = 15_000;
  const ANALYZE_RETRIES = 1;
  const HEALTH_TIMEOUT_MS = 6_000;
  const COLD_START_HINT_MS = 3_000;

  // Pipeline stage timings (ms from "Analyze" click). Real backend is a single
  // POST, so we drive these visually with timed transitions.
  const STAGE_TIMINGS = {
    validate: 0,
    analyze: 240,
    match: 620,
    evidence: 960,
    decide: 1280,
  };
  const STAGE_NAMES = ["validate", "analyze", "match", "evidence", "decide"];

  // --- DOM helpers ---
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // --- XSS escape ---
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // --- Reduced-motion gate ---
  const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Icons ---
  function paintIcons() {
    if (!window.QSIcons) return;
    $$("[data-icon]").forEach((el) => {
      const key = el.getAttribute("data-icon");
      const svg = window.QSIcons[key];
      if (svg) el.innerHTML = svg;
    });
  }

  // --- fetchJSON: timeout + retry ---
  async function fetchJSON(url, options = {}, timeoutMs = ANALYZE_TIMEOUT_MS, retries = ANALYZE_RETRIES) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: ctl.signal });
        clearTimeout(timer);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${text ? " — " + text.slice(0, 200) : ""}`);
        }
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw lastErr || new Error("Network error");
  }

  // --- Transactions table ---
  function newTxRow(data = {}) {
    const wrap = document.createElement("div");
    wrap.className = "grid grid-cols-12 gap-2 items-center tx-row";
    wrap.innerHTML = `
      <input class="tx-id col-span-3 glass-soft rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="tx id (e.g. TX-001)" value="${esc(data.transaction_id || "")}" />
      <input class="tx-amount col-span-2 glass-soft rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" type="number" placeholder="amount" value="${data.amount ?? ""}" />
      <input class="tx-status col-span-2 glass-soft rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="status" value="${esc(data.status || "")}" />
      <input class="tx-type col-span-2 glass-soft rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="type" value="${esc(data.type || "")}" />
      <input class="tx-counterparty col-span-2 glass-soft rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="counterparty" value="${esc(data.counterparty || "")}" />
      <button type="button" class="tx-remove col-span-1 text-slate-500 hover:text-rose-400 text-xs transition flex justify-center items-center" title="Remove row"><span class="qsi-icon" data-icon="x"></span></button>
    `;
    paintIcons();
    wrap.querySelector(".tx-remove").addEventListener("click", () => {
      wrap.remove();
      if (!$("#txList .tx-row")) addTxRow();
    });
    return wrap;
  }
  function addTxRow(data) {
    const row = newTxRow(data);
    $("#txList").appendChild(row);
    return row;
  }
  function collectTransactions() {
    return $$("#txList .tx-row").map((row) => {
      const tx = {
        transaction_id: row.querySelector(".tx-id").value.trim(),
        amount: Number(row.querySelector(".tx-amount").value),
        status: row.querySelector(".tx-status").value.trim(),
        type: row.querySelector(".tx-type").value.trim(),
        counterparty: row.querySelector(".tx-counterparty").value.trim(),
      };
      const ts = row.querySelector(".tx-timestamp")?.value?.trim();
      if (ts) tx.timestamp = ts;
      return tx;
    });
  }
  function clearTransactions() { $("#txList").innerHTML = ""; }

  // --- Health pill ---
  function setPill(state, label) {
    const pill = $("#healthPill");
    const dot = pill.querySelector(".radar-dot");
    const text = $("#healthLabel");
    text.textContent = label;
    dot.classList.remove("checking", "down");
    if (state !== "ok") dot.classList.add(state === "down" ? "down" : "checking");
    pill.className =
      "text-[11px] px-3 py-1.5 rounded-full glass-soft flex items-center gap-2 transition " +
      (state === "ok"
        ? "text-emerald-300"
        : state === "down"
          ? "text-rose-300"
          : "text-slate-400");
  }
  async function checkHealth() {
    setPill("checking", "checking…");
    try {
      const data = await fetchJSON(`${API_BASE}/health`, {}, HEALTH_TIMEOUT_MS, 0);
      if (data && data.status === "ok") setPill("ok", "Online");
      else setPill("down", "Offline");
    } catch {
      setPill("down", "Offline");
    }
  }

  // --- Pipeline strip ---
  const state = { busy: false, currentStage: null, abortTypewriter: null };

  function setStage(name) {
    const order = STAGE_NAMES.indexOf(name);
    state.currentStage = name;
    const status = $("#pipelineStatus");
    if (!name) {
      $$(".pipeline-stage").forEach((el) => el.classList.remove("active", "done"));
      status.textContent = "idle";
      return;
    }
    $$(".pipeline-stage").forEach((el) => {
      const idx = STAGE_NAMES.indexOf(el.dataset.stage);
      el.classList.remove("active", "done");
      if (idx < order) el.classList.add("done");
      else if (idx === order) el.classList.add("active");
    });
    status.textContent = STAGE_NAMES.includes(name) ? `stage: ${name}` : "idle";
  }

  function runPipelineSimulation() {
    if (REDUCED_MOTION) {
      // Skip per-stage animation; jump to "decide" quickly.
      setStage("decide");
      return;
    }
    const timers = [];
    Object.entries(STAGE_TIMINGS).forEach(([name, ms]) => {
      timers.push(setTimeout(() => setStage(name), ms));
    });
    return () => timers.forEach(clearTimeout);
  }

  // --- Analyze ---
  let coldStartTimer = null;
  function setBusy(busy) {
    const btn = $("#analyze");
    const label = $("#analyzeLabel");
    const spinner = $("#analyzeSpinner");
    btn.disabled = busy;
    label.textContent = busy ? "Analyzing" : "Analyze";
    spinner.classList.toggle("hidden", !busy);
    if (coldStartTimer) { clearTimeout(coldStartTimer); coldStartTimer = null; }
  }
  function showColdStartHint() {
    $("#analyzeLabel").textContent = "Waking up backend… (cold start can take 30s)";
  }
  function validate() {
    let ok = true;
    const complaint = $("#complaint").value.trim();
    const txs = collectTransactions().filter((t) => t.transaction_id);
    const cErr = $("#complaintError");
    const tErr = $("#txError");
    if (!complaint) { cErr.textContent = "Complaint text is required."; cErr.classList.remove("hidden"); ok = false; }
    else { cErr.classList.add("hidden"); }
    if (!txs.length) { tErr.textContent = "Add at least one transaction row."; tErr.classList.remove("hidden"); ok = false; }
    else { tErr.classList.add("hidden"); }
    return ok;
  }
  async function analyze() {
    if (state.busy) return;
    if (!validate()) return;

    const payload = {
      ticket_id: $("#ticketId").value.trim() || `T-${Date.now()}`,
      complaint: $("#complaint").value.trim(),
      transactions: collectTransactions().filter((t) => t.transaction_id),
    };

    state.busy = true;
    setBusy(true);
    coldStartTimer = setTimeout(showColdStartHint, COLD_START_HINT_MS);

    const output = $("#outputContent");
    const empty = $("#outputEmpty");
    output.classList.remove("hidden");
    empty.classList.add("hidden");
    output.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-3 py-16 text-slate-300 fade-in">
        <span class="qsi-icon qsi-icon-lg text-emerald-400 animate-spin" data-icon="loader"></span>
        <span class="text-sm">Investigating ticket…</span>
        <span class="text-[11px] text-slate-500">watch the pipeline stages progress</span>
      </div>`;
    paintIcons();

    const cancelPipeline = runPipelineSimulation();

    try {
      const result = await fetchJSON(`${API_BASE}/analyze-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (cancelPipeline) cancelPipeline();
      // Brief settle on the final stage before revealing
      setStage("decide");
      if (!REDUCED_MOTION) await new Promise((r) => setTimeout(r, 220));
      renderResult(result);
    } catch (err) {
      if (cancelPipeline) cancelPipeline();
      setStage(null);
      renderError(err);
    } finally {
      state.busy = false;
      setBusy(false);
    }
  }

  // --- Renderers ---
  const SEV_PALETTE = {
    low: "chip-emerald",
    medium: "chip-amber",
    high: "chip-rose",
    critical: "chip-rose",
  };
  const VERDICT_PALETTE = {
    consistent: "chip-emerald",
    inconsistent: "chip-rose",
    insufficient_data: "chip-slate",
  };

  // Reason codes -> weight mapping (used only for the mini bar visualization).
  // These are illustrative weights that emphasize which rules drive confidence.
  const REASON_WEIGHTS = {
    AMOUNT_MATCH: 0.30,
    TYPE_MATCH: 0.18,
    STATUS_MATCH: 0.18,
    COUNTERPARTY_MATCH: 0.14,
    TIME_MATCH: 0.08,
    TIME_MISMATCH: 0.06, // small contribution even on mismatch (system did examine time)
    EVIDENCE_CONSISTENT: 0.10,
    EVIDENCE_INCONSISTENT: 0.05,
    HIGH_SEVERITY_HINTS: 0.18,
    PHISHING_SUSPECTED: 0.40,
    REVIEW_REQUIRED: 0.10,
    LOW_CONFIDENCE: 0.05,
  };

  function severityColor(sev) {
    if (sev === "high" || sev === "critical") return "#fb7185";
    if (sev === "medium") return "#fbbf24";
    return "#34d399";
  }
  function verdictColor(verdict) {
    if (verdict === "inconsistent") return "#fb7185";
    if (verdict === "consistent") return "#34d399";
    return "#94a3b8";
  }

  function renderResult(d) {
    const sev = (d.severity || "low").toLowerCase();
    const verdict = (d.evidence_verdict || "insufficient_data").toLowerCase();
    const sevChip = SEV_PALETTE[sev] || "chip-slate";
    const verdictChip = VERDICT_PALETTE[verdict] || "chip-slate";
    const confidence = Math.max(0, Math.min(1, Number(d.confidence) || 0));
    const pct = Math.round(confidence * 100);
    const ringStroke = severityColor(sev);
    // Ring geometry: r=52, circumference = 2*PI*52 ≈ 326.7
    const R = 52;
    const C = 2 * Math.PI * R;
    const offset = (C * (1 - confidence)).toFixed(2);

    const reasons = Array.isArray(d.reason_codes) ? d.reason_codes : [];

    $("#outputContent").innerHTML = `
      <div class="space-y-5 fade-in">
        <!-- Header strip: badges -->
        <div class="flex flex-wrap gap-2">
          <span class="chip ${sevChip}"><span class="qsi-icon" data-icon="alert"></span>severity · ${esc(sev)}</span>
          <span class="chip ${verdictChip}"><span class="qsi-icon" data-icon="check"></span>evidence · ${esc(verdict)}</span>
          <span class="chip chip-cyan"><span class="qsi-icon" data-icon="layers"></span>case · ${esc(d.case_type || "—")}</span>
          <span class="chip chip-slate"><span class="qsi-icon" data-icon="shield"></span>dept · ${esc(d.department || "—")}</span>
          ${d.human_review_required
            ? `<span class="chip chip-amber"><span class="qsi-icon" data-icon="alert"></span>human review required</span>`
            : ""}
        </div>

        <!-- Verdict ring + matched tx -->
        <div class="grid md:grid-cols-[168px_1fr] gap-6 items-center">
          <div class="verdict-ring" role="img" aria-label="Confidence ${pct} percent">
            <svg viewBox="0 0 120 120">
              <circle class="ring-track" cx="60" cy="60" r="${R}"></circle>
              <circle class="ring-fill" cx="60" cy="60" r="${R}"
                stroke="${ringStroke}"
                stroke-dasharray="${C.toFixed(2)}"
                stroke-dashoffset="${C.toFixed(2)}"
                data-target-offset="${offset}"></circle>
            </svg>
            <div class="ring-center">
              <div class="ring-pct">${pct}%</div>
              <div class="ring-label">Confidence</div>
            </div>
          </div>
          <div class="space-y-3">
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Matched transaction</div>
            <div class="text-base text-slate-100 font-mono">
              ${d.relevant_transaction_id
                ? `<span class="chip chip-emerald"><span class="qsi-icon" data-icon="pulse"></span>${esc(d.relevant_transaction_id)}</span>`
                : `<span class="text-slate-500 text-sm">No relevant transaction matched.</span>`}
            </div>
            <div class="grid sm:grid-cols-2 gap-3 pt-1">
              <div class="glass-soft rounded-xl p-3">
                <div class="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Agent summary</div>
                <p class="text-sm text-slate-200 leading-relaxed">${esc(d.agent_summary || "")}</p>
              </div>
              <div class="glass-soft rounded-xl p-3">
                <div class="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Recommended action</div>
                <p class="text-sm text-slate-200 leading-relaxed">${esc(d.recommended_next_action || "")}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Customer reply with typewriter -->
        <div class="glass-soft rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-[10px] uppercase tracking-[0.18em] text-slate-500">Customer reply</div>
            <button id="copyBtn" type="button"
              class="text-[10px] uppercase tracking-[0.18em] glass-soft hover:bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded transition flex items-center gap-1.5">
              <span class="qsi-icon" data-icon="copy"></span><span id="copyLabel">Copy</span>
            </button>
          </div>
          <p id="replyText" class="text-sm text-slate-100 leading-relaxed min-h-[3.5rem]"></p>
        </div>

        <!-- Evidence ribbon -->
        ${reasons.length
          ? `<details class="evidence-ribbon group">
              <summary>
                <div class="flex items-center gap-3">
                  <span class="qsi-icon text-emerald-400" data-icon="layers"></span>
                  <div>
                    <div class="text-sm text-slate-100 font-medium">Evidence breakdown</div>
                    <div class="text-[11px] text-slate-500">${reasons.length} rule${reasons.length === 1 ? "" : "s"} contributed to this verdict</div>
                  </div>
                </div>
                <span class="qsi-icon chev text-slate-400" data-icon="arrowRight"></span>
              </summary>
              <div class="body space-y-2" id="reasonList"></div>
            </details>`
          : ""}
      </div>
    `;
    paintIcons();

    // Animate ring
    requestAnimationFrame(() => {
      const fill = $(".ring-fill");
      if (fill) fill.style.strokeDashoffset = fill.dataset.targetOffset;
    });

    // Typewriter reply
    typewriter($("#replyText"), d.customer_reply || "");

    // Render reason rows
    renderReasonRows(reasons);

    // Copy-to-clipboard
    const copyBtn = $("#copyBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const text = ($("#replyText")?.textContent || "").trim();
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
          else {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          }
          const label = $("#copyLabel");
          label.textContent = "Copied";
          copyBtn.querySelector("[data-icon]")?.replaceWith(document.createElement("span"));
          copyBtn.innerHTML = `<span class="qsi-icon" data-icon="checkCircle"></span><span>Copied</span>`;
          paintIcons();
          setTimeout(() => {
            copyBtn.innerHTML = `<span class="qsi-icon" data-icon="copy"></span><span id="copyLabel">Copy</span>`;
            paintIcons();
          }, 1500);
        } catch {
          const label = $("#copyLabel");
          if (label) label.textContent = "Copy failed";
        }
      });
    }
  }

  function renderReasonRows(reasons) {
    const list = $("#reasonList");
    if (!list) return;
    list.innerHTML = "";
    reasons.forEach((code, i) => {
      const weight = REASON_WEIGHTS[code] ?? 0.10;
      const row = document.createElement("div");
      row.className = "reason-row";
      row.innerHTML = `
        <span class="label">${esc(code)}</span>
        <span class="score">${Math.round(weight * 100)}%</span>
        <span class="bar"><i></i></span>
      `;
      list.appendChild(row);
      const bar = row.querySelector(".bar > i");
      if (REDUCED_MOTION) bar.style.width = `${Math.round(weight * 100)}%`;
      else setTimeout(() => { bar.style.width = `${Math.round(weight * 100)}%`; }, 80 * i + 200);
    });
  }

  function typewriter(el, text) {
    if (!el) return;
    // Abort any in-flight typewriter
    if (state.abortTypewriter) state.abortTypewriter();
    el.innerHTML = "";
    if (REDUCED_MOTION || !text) {
      el.textContent = text || "";
      return;
    }
    const cancelled = { v: false };
    state.abortTypewriter = () => { cancelled.v = true; };
    let i = 0;
    const speed = 18; // ms/char — feels lively without dragging
    function step() {
      if (cancelled.v || i >= text.length) {
        el.querySelector(".typewriter-caret")?.remove();
        if (!cancelled.v) el.insertAdjacentHTML("beforeend", `<span class="typewriter-caret"></span>`);
        return;
      }
      const ch = text.charAt(i);
      // Insert each char as text (already safe — never innerHTML on raw user content)
      el.insertAdjacentText("beforeend", ch);
      i++;
      setTimeout(step, speed);
    }
    el.insertAdjacentHTML("beforeend", `<span class="typewriter-caret"></span>`);
    setTimeout(step, 80);
  }

  function renderError(err) {
    $("#outputContent").innerHTML = `
      <div class="glass-soft border border-rose-800/40 rounded-xl p-4 fade-in">
        <div class="flex items-center gap-2 font-semibold text-rose-300 mb-1">
          <span class="qsi-icon text-rose-300" data-icon="alert"></span>
          <span>Investigation failed</span>
        </div>
        <div class="text-sm text-rose-200/90">${esc(err.message || String(err))}</div>
        <div class="text-[11px] text-rose-300/70 mt-2">If this is the first request, Render's free tier may be waking up (up to 50s). Try again in a moment.</div>
      </div>`;
    paintIcons();
  }

  // --- Sample loader ---
  function loadSample() {
    $("#ticketId").value = "T-001";
    $("#complaint").value = "I paid 5000 BDT to ABC Store yesterday but payment failed.";
    clearTransactions();
    addTxRow({
      transaction_id: "TX-001",
      amount: 5000,
      status: "failed",
      type: "payment",
      counterparty: "ABC Store",
    });
  }

  function clearAll() {
    $("#ticketId").value = "";
    $("#complaint").value = "";
    clearTransactions();
    addTxRow();
    $("#outputContent").classList.add("hidden");
    $("#outputContent").innerHTML = "";
    $("#outputEmpty").classList.remove("hidden");
    setStage(null);
    if (state.abortTypewriter) { state.abortTypewriter(); state.abortTypewriter = null; }
  }

  // --- Wire up ---
  function init() {
    $("#backendUrl").textContent = location.origin;

    $("#addTx").addEventListener("click", () => addTxRow());
    $("#analyze").addEventListener("click", analyze);
    $("#loadSample").addEventListener("click", loadSample);
    $("#clearAll").addEventListener("click", clearAll);

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        analyze();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        // Reserved for future command palette; not hijacked now.
      }
    });

    // Initial paint
    paintIcons();
    addTxRow();
    setStage(null);
    checkHealth();
    setInterval(checkHealth, HEALTH_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();