/* QueueStorm Investigator — frontend logic
 * Talks to the same Express service via relative URLs.
 * Backend is unchanged: GET /health, POST /analyze-ticket.
 */
(function () {
  "use strict";

  // --- Config ---
  // Same-origin fetch works because the static files are served by the same
  // Express app. CORS is open anyway, so cross-origin also works.
  const API_BASE = "";
  const HEALTH_INTERVAL_MS = 30_000;
  const ANALYZE_TIMEOUT_MS = 15_000;
  const ANALYZE_RETRIES = 1;
  const HEALTH_TIMEOUT_MS = 6_000;
  const COLD_START_HINT_MS = 3_000;

  // --- Tiny DOM helpers ---
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // --- XSS escape ---
  // Backend echoes user-controlled strings (ticket_id, customer_reply, etc.).
  // Always escape before inserting into innerHTML.
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    throw lastErr || new Error("Network error");
  }

  // --- Transactions table ---
  function newTxRow(data = {}) {
    const wrap = document.createElement("div");
    wrap.className = "grid grid-cols-12 gap-2 items-center tx-row";
    wrap.innerHTML = `
      <input class="tx-id col-span-3 bg-slate-800/80 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="tx id (e.g. TX-001)" value="${esc(data.transaction_id || "")}" />
      <input class="tx-amount col-span-2 bg-slate-800/80 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40" type="number" placeholder="amount" value="${data.amount ?? ""}" />
      <input class="tx-status col-span-2 bg-slate-800/80 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="status" value="${esc(data.status || "")}" />
      <input class="tx-type col-span-2 bg-slate-800/80 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="type" value="${esc(data.type || "")}" />
      <input class="tx-counterparty col-span-2 bg-slate-800/80 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="counterparty" value="${esc(data.counterparty || "")}" />
      <button type="button" class="tx-remove col-span-1 text-slate-500 hover:text-rose-400 text-xs transition" title="Remove row">✕</button>
    `;
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

  function clearTransactions() {
    $("#txList").innerHTML = "";
  }

  // --- Health pill ---
  function setPill(state, label) {
    const pill = $("#healthPill");
    const dot = pill.querySelector("span:first-child");
    const text = $("#healthLabel");
    pill.className =
      "text-xs px-3 py-1 rounded-full flex items-center gap-2 transition " +
      (state === "ok"
        ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800/60"
        : state === "down"
          ? "bg-rose-900/40 text-rose-300 border border-rose-800/60"
          : "bg-slate-800 text-slate-300 border border-slate-700");
    dot.className =
      "inline-block w-2 h-2 rounded-full " +
      (state === "ok" ? "bg-emerald-400" : state === "down" ? "bg-rose-400" : "bg-slate-500");
    text.textContent = label;
  }

  async function checkHealth() {
    setPill("checking", "checking…");
    try {
      const data = await fetchJSON(`${API_BASE}/health`, {}, HEALTH_TIMEOUT_MS, 0);
      if (data && data.status === "ok") setPill("ok", "● Online");
      else setPill("down", "● Offline");
    } catch {
      setPill("down", "● Offline");
    }
  }

  // --- Analyze ---
  let coldStartTimer = null;

  function setBusy(busy) {
    const btn = $("#analyze");
    const label = $("#analyzeLabel");
    const spinner = $("#analyzeSpinner");
    btn.disabled = busy;
    label.textContent = busy ? "Analyzing…" : "Analyze ▶";
    spinner.classList.toggle("hidden", !busy);
    if (coldStartTimer) {
      clearTimeout(coldStartTimer);
      coldStartTimer = null;
    }
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

    if (!complaint) {
      cErr.textContent = "Complaint text is required.";
      cErr.classList.remove("hidden");
      ok = false;
    } else {
      cErr.classList.add("hidden");
    }
    if (!txs.length) {
      tErr.textContent = "Add at least one transaction row.";
      tErr.classList.remove("hidden");
      ok = false;
    } else {
      tErr.classList.add("hidden");
    }
    return ok;
  }

  async function analyze() {
    if (!validate()) return;

    const payload = {
      ticket_id: $("#ticketId").value.trim() || `T-${Date.now()}`,
      complaint: $("#complaint").value.trim(),
      transactions: collectTransactions().filter((t) => t.transaction_id),
    };

    setBusy(true);
    coldStartTimer = setTimeout(showColdStartHint, COLD_START_HINT_MS);

    const output = $("#outputContent");
    const empty = $("#outputEmpty");
    output.classList.remove("hidden");
    empty.classList.add("hidden");
    output.innerHTML = `<div class="flex items-center gap-3 text-slate-400 text-sm py-8 justify-center">
      <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <span>Investigating ticket…</span>
    </div>`;

    try {
      const result = await fetchJSON(`${API_BASE}/analyze-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      renderResult(result);
    } catch (err) {
      renderError(err);
    } finally {
      setBusy(false);
    }
  }

  // --- Renderers ---
  const SEV_PALETTE = {
    low: "emerald",
    medium: "amber",
    high: "rose",
    critical: "rose",
  };
  const VERDICT_PALETTE = {
    consistent: "emerald",
    inconsistent: "rose",
    insufficient_data: "slate",
  };

  function renderResult(d) {
    const sev = (d.severity || "low").toLowerCase();
    const verdict = (d.evidence_verdict || "insufficient_data").toLowerCase();
    const sevColor = SEV_PALETTE[sev] || "slate";
    const verdictColor = VERDICT_PALETTE[verdict] || "slate";
    const confidence = Math.max(0, Math.min(1, Number(d.confidence) || 0));
    const pct = Math.round(confidence * 100);

    const reasons = Array.isArray(d.reason_codes) ? d.reason_codes : [];

    $("#outputContent").innerHTML = `
      <div class="space-y-4 fade-in">
        <!-- Header badges -->
        <div class="flex flex-wrap gap-2">
          <span class="px-2.5 py-1 rounded-md text-xs font-medium bg-${sevColor}-900/40 text-${sevColor}-300 border border-${sevColor}-800/60">
            severity: ${esc(sev)}
          </span>
          <span class="px-2.5 py-1 rounded-md text-xs font-medium bg-${verdictColor}-900/40 text-${verdictColor}-300 border border-${verdictColor}-800/60">
            evidence: ${esc(verdict)}
          </span>
          <span class="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            case: ${esc(d.case_type || "—")}
          </span>
          <span class="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            dept: ${esc(d.department || "—")}
          </span>
          ${d.human_review_required
            ? `<span class="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-800/60">
                ⚠ human review required
              </span>`
            : ""
          }
        </div>

        <!-- Matched tx -->
        <div class="text-xs text-slate-400">
          ${d.relevant_transaction_id
            ? `Matched transaction: <code class="text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded">${esc(d.relevant_transaction_id)}</code>`
            : "No relevant transaction matched."}
        </div>

        <!-- Confidence bar -->
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Confidence</span><span>${pct}%</span>
          </div>
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="confidence-fill h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700" style="width:0%"></div>
          </div>
        </div>

        <!-- Cards -->
        <div class="grid sm:grid-cols-2 gap-3">
          <div class="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Agent summary</div>
            <p class="text-sm text-slate-200 leading-relaxed">${esc(d.agent_summary || "")}</p>
          </div>
          <div class="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Recommended action</div>
            <p class="text-sm text-slate-200 leading-relaxed">${esc(d.recommended_next_action || "")}</p>
          </div>
        </div>

        <div class="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <div class="flex items-center justify-between mb-1">
            <div class="text-[10px] uppercase tracking-wider text-slate-500">Customer reply</div>
            <button id="copyBtn" type="button"
              class="text-[10px] uppercase tracking-wider bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition">
              Copy
            </button>
          </div>
          <p id="replyText" class="text-sm text-slate-200 leading-relaxed">${esc(d.customer_reply || "")}</p>
        </div>

        <!-- Reason chips -->
        ${reasons.length
          ? `<div>
              <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Reason codes</div>
              <div class="flex flex-wrap gap-1.5">
                ${reasons
                  .map(
                    (c) =>
                      `<span class="text-[11px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">${esc(c)}</span>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
        }
      </div>
    `;

    // Animate the confidence bar to its target width after insertion.
    requestAnimationFrame(() => {
      const fill = $(".confidence-fill");
      if (fill) fill.style.width = pct + "%";
    });

    // Copy-to-clipboard (modern API with execCommand fallback)
    const copyBtn = $("#copyBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const text = $("#replyText")?.textContent || "";
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          }
          copyBtn.textContent = "Copied ✓";
          setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
        } catch {
          copyBtn.textContent = "Copy failed";
        }
      });
    }
  }

  function renderError(err) {
    $("#outputContent").innerHTML = `
      <div class="bg-rose-900/30 border border-rose-800/60 rounded-xl p-4 text-sm fade-in">
        <div class="font-semibold text-rose-300 mb-1">Investigation failed</div>
        <div class="text-rose-200/80">${esc(err.message || String(err))}</div>
        <div class="text-xs text-rose-300/70 mt-2">
          If this is the first request, Render's free tier may be waking up (up to 50s). Try again in a moment.
        </div>
      </div>
    `;
  }

  // --- Sample loader ---
  function loadSample() {
    $("#ticketId").value = "T-001";
    $("#complaint").value =
      "I paid 5000 BDT to ABC Store yesterday but payment failed.";
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
  }

  // --- Wire up ---
  function init() {
    // Show backend URL in footer (same-origin)
    $("#backendUrl").textContent = location.origin;

    $("#addTx").addEventListener("click", () => addTxRow());
    $("#analyze").addEventListener("click", analyze);
    $("#loadSample").addEventListener("click", loadSample);
    $("#clearAll").addEventListener("click", clearAll);

    // Ctrl/Cmd + Enter to analyze from anywhere
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        analyze();
      }
    });

    // Initial state
    addTxRow();
    checkHealth();
    setInterval(checkHealth, HEALTH_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();