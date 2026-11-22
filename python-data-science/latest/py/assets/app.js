/* Programming with Python: Quick Reference – browsing app (no dependencies, works from file://) */
(function () {
  "use strict";
  const T = window.TEXTBOOK;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plain = (s) => String(s || "").replace(/`/g, "");                       // a title without its inline-code backticks
  const et = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");             // a title as HTML: `name` shows as code
  const slug = (t) => t.replace(/[^a-zA-Z0-9_-]+/g, "-");

  const SMALL = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "on", "by", "for", "with", "vs", "versus", "then", "as", "at", "from"]);
  const KEEP = new Set(["if", "elif", "else", "while", "for", "in", "not", "and", "or"]);
  function titleCase(s) {                       // sentence case: only the first letter is a capital (STYLE_GUIDE §23)
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  // ---- state ------------------------------------------------------------
  const state = { q: "", tags: new Set(), hideNon: false, deep: false, showCmd: true, route: { kind: "home" }, open: new Set() };
  const ORDER = [];
  T.parts.forEach((p) => p.sheets.forEach((c) => T.sheets[c].sections.forEach((s) => s.examples.forEach((id) => ORDER.push(id)))));
  const SID = {};
  ORDER.forEach((id) => { const s = T.examples[id].sid; if (s) SID[s.toUpperCase()] = id; });
  const SHEETS = T.parts.flatMap((p) => p.sheets);
  // one linear order of pages: Home, then each sheet's overview page followed by its examples
  const PAGES = [{ kind: "home", href: "#/", label: "Home" }];
  SHEETS.forEach((code) => {
    const sh = T.sheets[code];
    PAGES.push({ kind: "sheet", code, href: "#/sheet/" + code, label: `${code} ${sh.short || sh.title}` });
    sh.sections.forEach((sec) => sec.examples.forEach((id) => PAGES.push({ kind: "ex", id, href: "#/ex/" + id, label: plain(T.examples[id].title) })));
  });
  const PAGES_SEC = [{ kind: "home", href: "#/", label: "Home" }];
  SHEETS.forEach((code) => {
    const sh = T.sheets[code];
    PAGES_SEC.push({ kind: "sheet", code, href: "#/sheet/" + code, label: `${code} ${sh.short || sh.title}` });
    sh.sections.forEach((sec, i) => PAGES_SEC.push({ kind: "sec", code, i, href: `#/sec/${code}/${i}`, label: sec.title }));
  });
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  state.hideNon = store.get("tb-hidenon", "0") === "1";
  state.view = store.get("tb-view", "one") === "section" ? "section" : "one";
  state.showCmd = store.get("tb-showcmd", "1") === "1";

  // ---- filtering --------------------------------------------------------
  // small words are ignored when matching ("remove a column" matches on remove + column)
  const STOP = new Set("a an the to of in on for with from by and or is are do i my how what me it its this that".split(" "));
  // deep search (a toggle under the search box): words are cut back to their stems ("changed" finds "change")
  // and a result needs all but one of the words instead of every word
  const stem = (w) => { const b = w.replace(/(ing|ed|es|s)$/, ""); return b.length >= 3 ? b : w; };
  function searchWords(q) {
    const all = q.toLowerCase().split(/\s+/).filter(Boolean);
    const kept = all.filter((w) => !STOP.has(w));
    const words = kept.length ? kept : all;
    return state.deep ? words.map(stem) : words;
  }
  const wordsNeeded = (n) => (state.deep ? Math.max(1, n - 1) : n);
  function isActive() { return !!(state.q || state.tags.size); }
  function matches(ex) {
    if (state.hideNon && !ex.examinable) return false;
    for (const t of state.tags) if (!ex.tags.includes(t)) return false;
    if (state.q) {
      const ws = searchWords(state.q);
      if (ws.filter((w) => ex.search.includes(w)).length < wordsNeeded(ws.length)) return false;
    }
    return true;
  }
  const filteredIds = () => ORDER.filter((id) => matches(T.examples[id]));

  // ---- tags -------------------------------------------------------------
  function tagClass(t) { return "tag-" + slug(t); }
  function chip(t, opts) {
    opts = opts || {};
    const info = T.tags[t] || { group: "topic" };
    const on = state.tags.has(t) ? " on" : "";
    const label = t === "non-examinable" ? "not examined" : t;
    return `<button class="chip ${tagClass(t)} g-${info.group}${on}" data-tag="${esc(t)}" title="Filter by ${esc(t)}">${esc(label)}${opts.count ? `<i>${info.count}</i>` : ""}</button>`;
  }
  function renderTagPanel() {
    const all = Object.keys(T.tags);
    const libs = T.libs.filter((t) => T.tags[t]);
    const status = all.filter((t) => T.tags[t].group === "status");
    const topics = all.filter((t) => T.tags[t].group === "topic").sort((a, b) => T.tags[b].count - T.tags[a].count || a.localeCompare(b));
    $("#tag-chips").innerHTML =
      `<div class="chip-row">${[...libs, ...status].map((t) => chip(t, { count: 1 })).join("")}</div>` +
      `<div class="chip-row">${topics.map((t) => chip(t, { count: 1 })).join("")}</div>`;
    $("#tag-count").textContent = state.tags.size ? `(${state.tags.size} selected)` : "";
    const fs = $("#filter-state");
    if (isActive()) {
      const n = filteredIds().length;
      fs.innerHTML = `<span><b>${n}</b> example${n === 1 ? "" : "s"} match</span> <button class="linkish" id="clear-filters">Clear</button>`;
    } else fs.innerHTML = "";
  }

  // ---- sidebar tree -----------------------------------------------------
  function renderTree() {
    const active = isActive() || state.hideNon;
    const cur = state.route.kind === "ex" ? T.examples[state.route.id] : null;
    let html = "";
    for (const part of T.parts) {
      let partHtml = "", partCount = 0;
      for (const code of part.sheets) {
        const sh = T.sheets[code];
        let shHtml = "", shCount = 0;
        sh.sections.forEach((sec, si) => {
          const ids = sec.examples.filter((id) => matches(T.examples[id]));
          if (!ids.length) return;
          shCount += ids.length;
          const openSec = isActive() || state.open.has(code + ":" + si);
          shHtml += `<details class="sec" data-key="${code}:${si}" ${openSec ? "open" : ""}>
            <summary><a href="#/sec/${code}/${si}" class="sec-link">${et(sec.title)}</a><span class="n">${ids.length}</span></summary>
            <ul>${ids.map((id) => navItem(T.examples[id], cur)).join("")}</ul></details>`;
        });
        if (!shCount) continue;
        partCount += shCount;
        const openSheet = isActive() || state.open.has(code);
        const nonex = !sh.examinable ? '<span class="badge small non">not examined</span>' : "";
        partHtml += `<details class="sheet" data-key="${code}" ${openSheet ? "open" : ""}>
          <summary><a href="#/sheet/${code}"><b>${code}</b> ${et(sh.title)}</a>${nonex}<span class="n">${shCount}</span></summary>${shHtml}</details>`;
      }
      if (partCount) html += `<div class="part"><div class="part-title">Part ${part.id} · ${et(part.title)}</div>${partHtml}</div>`;
    }
    if (!html) html = `<p class="empty">No examples match. <button class="linkish" id="clear-filters2">Clear filters</button></p>`;
    const tree = $("#tree");
    const keepScroll = tree.scrollTop;
    tree.innerHTML = `<a class="nav-home" href="#/">⌂ Home: all sheets</a><a class="nav-home" href="#/index">A–Z index</a>` + html;
    tree.classList.toggle("hide-cmd", !state.showCmd);
    tree.scrollTop = keepScroll;
    const curEl = $(".nav-ex.current", tree);
    if (curEl) {
      const r = curEl.getBoundingClientRect(), tr = tree.getBoundingClientRect();
      if (r.top < tr.top || r.bottom > tr.bottom) curEl.scrollIntoView({ block: "center" });
    }
  }
  function navItem(ex, cur) {
    const tags = ex.tags.map(tagClass).join(" ");
    return `<li><a class="nav-ex ${tags} ${ex.examinable ? "" : "non-examinable"} ${cur && cur.id === ex.id ? "current" : ""}" href="#/ex/${ex.id}">
      <span class="t">${et(ex.title)} <i class="sid-n">${esc(ex.sid)}</i></span>${ex.cmd ? `<code class="c">${esc(ex.cmd)}</code>` : ""}</a></li>`;
  }

  const PIN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`;
  const BACK_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>`;
  const HOME_ICON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>`;
  const HOME = `<a class="home" href="#/" title="Home" aria-label="Home"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg></a>`;
  const sheetLabel = (code) => `${code} ${esc(titleCase(T.sheets[code].short))}`;
  const sheetLink = (code) => `<a href="#/sheet/${code}">${sheetLabel(code)}</a>`;
  const head = (l1, l2) => `${l1 ? `<div class="crumbs top">${l1}</div>` : ""}<h1 class="ex-title">${l2}</h1>`;

  // ---- example rendering ------------------------------------------------
  function renderOutput(o) {
    switch (o.kind) {
      case "stream": return `<pre class="out stream ${o.name}">${esc(o.text)}</pre>`;
      case "text": return `<pre class="out">${esc(o.text)}</pre>`;
      case "html": return `<div class="out table-wrap">${o.html}</div>`;
      case "image": return `<div class="out img"><img src="${o.src}" alt="Plot output" loading="lazy"${o.width ? ` width="${o.width}" height="${o.height}"` : ""}></div>`;
      case "error": {
        const last = o.value ? `${esc(o.name)}: ${esc(o.value)}` : esc(o.name);
        return `<div class="out error"><div class="err-line">${last}</div><details${o.full ? " open" : ""}><summary>Full traceback</summary><pre>${esc(o.text)}</pre></details></div>`;
      }
    }
    return "";
  }
  let nbOk = false;     // the script/notebook switch applies to this example (set in renderExample)
  const SHOW = /^plt\.show\(\)[ \t]*$/m;
  const noShow = (s) => s.split("\n").filter((l) => !/^plt\.show\(\)\s*$/.test(l)).join("\n").replace(/\n+$/, "");
  function cmHost(src, marks) { return `<div class="cm-host" data-src="${esc(src)}"${nbOk && SHOW.test(src) ? ` data-nb="${esc(noShow(src))}"` : ""}${marks && marks.length ? ` data-marks="${esc(JSON.stringify(marks))}"` : ""}></div>`; }
  function styleCtl(dim) {
    const o = dim === "plot" ? [["plt", "plt."], ["ax", "ax."]] : dim === "mode" ? [["script", "script"], ["notebook", "notebook"]] : [["chain", "chained"], ["steps", "step by step"]];
    const label = dim === "plot" ? "Drawing with" : dim === "mode" ? "Running as a" : "Command style";
    const tip = {
      plot: "plt. style: functions such as plt.plot() draw on the current figure, which is quickest for one plot. ax. style: fig, ax = plt.subplots() makes the figure and its axes, and ax.plot() draws on them, which is clearer with several plots. Both draw the same picture.",
      mode: "script: code saved in a .py file and run as a program, where plt.show() is needed to open the figure. notebook: code in a Jupyter cell, where the figure appears under the cell when it ends, so plt.show() is not needed.",
      chain: "chained: several steps in one line. step by step: one step per line, with a name for each result."
    }[dim];
    return `<div class="seg ctl inblock" data-dim="${dim}"><span>${label}</span>${o.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join("")}<span class="q" tabindex="0" role="note" aria-label="${esc(tip)}" data-tip="${esc(tip)}">?</span></div>`;
  }
  function renderBlock(b) {
    if (b.type === "md") return `<div class="prose">${b.html}</div>`;
    if (b.type === "code" && (b.file || b.terminal || b.norun || b.notebook || b.script)) return renderProgBlock(b);
    if (b.type === "code" && b.figure) {
      const imgs = b.outputs.map(renderOutput).join("");
      return `<figure class="figure">${imgs}<details class="fig-code"><summary>Show the code that draws this figure</summary><div class="codeblock"><button class="copy-btn" title="Copy code">Copy</button>${cmHost(b.src)}</div></details></figure>`;
    }
    if (b.type === "note") return `<div class="box assume"><div class="box-h">${esc(b.label)}</div>${b.html}</div>`;
    if (b.type === "summary") return `<div class="box summary"><div class="box-h">Interpretation</div>${b.html}</div>`;
    if (b.type === "hint") return `<div class="box hint"><div class="box-h">Watch out</div>${b.html}</div>`;
    const outBox = (outs) => { const o = outs.map(renderOutput).join(""); return o ? `<div class="outputs"><div class="out-label">Output</div>${o}</div>` : ""; };
    const variant = (src, outs) => `${cmHost(src)}${outBox(outs)}`;
    let dim = null, alt = null;
    if (b.ax) { dim = "plot"; alt = b.ax; } else if (b.alts && b.alts.length) { dim = "chain"; alt = b.alts[0]; }
    const main = dim
      ? `<div class="dim dim-${dim}"><div class="v-0">${variant(b.src, b.outputs)}</div><div class="v-1">${variant(alt.src, alt.outputs)}</div></div>`
      : variant(b.src, b.outputs);
    const plain = !dim && /\bplt\.(?!rcParams|show|savefig)\w+\(/.test(b.src);
    return `<div class="codeblock${b.input ? " is-input" : ""}${dim ? " has-variants" : ""}">
      <div class="blk-label${b.input ? "" : " is-code"}">${b.input ? "Input" : "Code"}</div><button class="copy-btn" title="Copy code">Copy</button>${plain ? '<div class="nv nv-plot">no separate ax. version of this cell</div>' : ""}
      ${main}</div>`;
  }
  // Programming blocks: scripts, file tabs, terminals, notebook cells and keyboard input
  function renderProgBlock(b) {
    const outs = b.outputs.map(renderOutput).join("");
    const copy = '<button class="copy-btn" title="Copy code">Copy</button>';
    if (b.terminal) {
      const lines = esc(b.transcript).split("\n").map((l) => l.startsWith("$ ") ? `<span class="t-cmd"><span class="t-ps">$ </span>${l.slice(2)}</span>` : l).join("\n");
      return `<div class="codeblock term-block"><div class="blk-label is-term">Terminal${b.transcript && !b.ran ? "" : ""}</div><pre class="terminal">${lines}</pre></div>`;
    }
    if (b.file) {
      return `<div class="codeblock file-block"><div class="file-tab">${b.data ? "📄" : "🐍"} ${esc(b.file)}</div>${copy}${b.data ? `<pre class="datafile">${esc(b.src)}</pre>` : cmHost(b.src)}</div>`;
    }
    if (b.ax) {
      const v = (src, o, mk) => `${cmHost(src, mk)}${o ? `<div class="outputs"><div class="out-label">Output</div>${o}</div>` : ""}`;
      return `<div class="codeblock has-variants"><div class="blk-label is-code">Code</div>${copy}<div class="dim dim-plot"><div class="v-0">${v(b.src, outs, b.marks)}</div><div class="v-1">${v(b.ax.src, b.ax.outputs.map(renderOutput).join(""), b.ax.marks)}</div></div></div>`;
    }
    if (b.cells && b.cells.length) {
      const cells = b.cells.map((c) => { const o = c.outputs.map(renderOutput).join(""); return `<div class="codeblock nb-cell split-cell"><div class="blk-label is-code">Cell</div>${copy}${cmHost(c.src, b.marks)}${o ? `<div class="outputs"><div class="out-label">Out</div>${o}</div>` : ""}</div>`; }).join("");
      return `<div class="cell-group">${cells}</div>`;
    }
    const label = b.notebook ? "Notebook cell" : b.diagram ? "Diagram" : b.norun && b.lang === "text" ? "Text" : b.norun ? "Example (not run)" : (b.script && b.script !== "example.py" ? esc(b.script) : "Code");
    if (b.norun && (b.diagram || b.lang === "text")) return `<div class="codeblock plain-block"><div class="blk-label">${label}</div><pre class="textblock">${esc(b.src)}</pre></div>`;
    const stdin = b.stdin ? `<div class="stdin"><span class="stdin-h">Typed at the keyboard:</span> ${b.stdin.split("\n").map((v) => `<kbd>${esc(v)}</kbd>`).join(" ⏎ ")} ⏎</div>` : "";
    const outBox = outs ? `<div class="outputs"><div class="out-label">${b.notebook ? "Out" : "Output"}</div>${outs}</div>` : (b.norun || b.notebook ? "" : '<div class="outputs empty"><div class="out-label">Output</div><pre class="out none">(nothing is printed)</pre></div>');
    return `<div class="codeblock${b.notebook ? " nb-cell" : ""}"><div class="blk-label is-code">${label}</div>${copy}${cmHost(b.src, b.marks)}${stdin}${outBox}</div>`;
  }
  function aboutBoxes(ex) {
    const a = ex.about;
    if (!a) return "";
    const altLinks = (ex.alt || []).map((id) => { const o = T.examples[id]; return `<a class="see ${o.examinable ? "" : "non-examinable"}" href="#/ex/${id}"><span class="t">${et(o.title)}</span><span class="w">${o.sheet}</span></a>`; }).join("");
    const altHtml = (a.alts || "") + (altLinks ? `<div class="sa-list">${altLinks}</div>` : "");
    const box = (cls, h, html) => (html ? `<div class="box ${cls}"><div class="box-h">${h}</div>${html}</div>` : "");
    return `<div class="boxes">${a.overview ? `<div class="box overview">${a.overview}</div>` : ""}<div class="box-row">${box("uses", "Useful when", a.uses)}${box("alts", "Alternatives", altHtml)}</div></div>`;
  }
  // explanation first, then the Setup, then the code: Setup sits straight above the first code cell
  function bodyBlocks(ex, sh) {
    const k = ex.blocks.findIndex((b) => b.type === "code");
    const split = k < 0 ? ex.blocks.length : k;
    // one switch for the whole example (it applies to every cell that has the other style)
    const dims = [ex.blocks.some((b) => b.ax) ? "plot" : null, nbOk && ex.blocks.some((b) => b.type === "code" && SHOW.test(b.src || "")) ? "mode" : null, ex.blocks.some((b) => b.alts && b.alts.length) ? "chain" : null].filter(Boolean);
    const ctl = dims.length ? `<div class="ctl-row">${dims.map(styleCtl).join("")}<span class="ctl-note">applies to every cell below</span></div>` : "";
    return ex.blocks.slice(0, split).map(renderBlock).join("") + setupBlock(ex, sh) + ctl + ex.blocks.slice(split).map(renderBlock).join("");
  }
  function setupBlock(ex, sh) {
    if (!sh.setup && !ex.setup.length) return "";
    const own = ex.setup.length ? `<div class="setup-label"># Extra setup for this example</div>${cmHost(ex.setup.join("\n\n"))}` : "";
    return `<details class="setup"><summary>Setup (imports and data) <span class="hint">– runs first; open to see or copy it</span></summary>
      <div class="codeblock"><div class="setup-label"># Imports and data used throughout ${esc(ex.sheet)}</div>${cmHost(sh.setup)}${own}</div></details>`;
  }
  // cross links to another quick reference: off by default (Settings); the address of the other book is a setting
  const xroot = (m) => (store.get("tb-xroot-" + m, "") || (T.xrefs && T.xrefs[m] ? T.xrefs[m].root : "")).replace(/#.*$/, "");
  const xhref = (r) => xroot(r.m) + (r.id.includes(".") ? "#/" + r.id : "#/sheet/" + r.id);
  function xrefBox(list) {
    if (!list || !list.length || !T.xrefs) return "";
    const by = {};
    list.forEach((r) => (by[r.m] = by[r.m] || []).push(r));
    return Object.keys(by).map((m) => `<div class="xref-box box links"><div class="box-h">Also in ${esc(T.xrefs[m].name)}</div><div class="sa-list">${by[m].map((r) => `<a class="see xref" data-m="${esc(r.m)}" data-id="${esc(r.id)}" href="${esc(xhref(r))}" target="_blank" rel="noopener"><span class="t">${et(r.title)}</span><span class="w">${esc(r.id)}</span></a>`).join("")}</div></div>`).join("");
  }
  function seeAlso(ex) {
    const link = (id) => { const o = T.examples[id]; return `<a class="see ${o.examinable ? "" : "non-examinable"}" href="#/ex/${id}"><span class="t">${et(o.title)}</span><span class="w">${o.sheet}</span></a>`; };
    let h = "";
    if (ex.see.length) h += `<div class="seealso box links"><div class="box-h">See also</div><div class="sa-list">${ex.see.map(link).join("")}</div></div>`;
    h += xrefBox(ex.xref);
    if (false) h += `<div class="seealso rel"><div class="sa-label">Related</div><div class="sa-list">${ex.related.map(link).join("")}</div></div>`;
    return h;
  }
  function renderExample(ex, opts) {
    opts = opts || {};
    const sh = T.sheets[ex.sheet];
    nbOk = ex.sheet !== "K4";
    const cls = ex.tags.map(tagClass).join(" ") + (ex.examinable ? " examinable" : " non-examinable");
    const KINDS = { command: "Command", application: "Application", concept: "Concept", pattern: "Pattern", pitfall: "Pitfall", error: "Error message", guide: "Guide" };
    const kindTip = { command: "Teaches a command or function", application: "Applies general commands to a particular problem", concept: "An idea or rule, shown in code", pattern: "A reusable way of structuring code", pitfall: "A common mistake that gives no error message", error: "An error message: what it means and how to fix it", guide: "A guide: steps, a table or an explanation, with no command to run" };
    const sidChip = ex.sid ? `<button class="sid" type="button" data-sid="${esc(ex.sid)}" title="Short code. Click to copy a link to this example">${esc(ex.sid)}</button>` : "";
    const status = sidChip + `<span class="kind k-${ex.etype}" title="${kindTip[ex.etype]}">${KINDS[ex.etype]}</span>` + (ex.examinable ? "" : '<span class="badge non">Not examined</span>');
    const secLink = `<a href="#/sec/${ex.sheet}/${ex.section_index}">${esc(titleCase(ex.section))}</a>`;
    const heading = opts.heading ? et(titleCase(ex.title)) : `${secLink} › ${et(titleCase(ex.title))}`;
    return `<article class="example ${cls}${ex.blocks.some((b) => b.ax) ? " has-ax" : ""}" id="ex-${ex.id}">
      ${opts.heading ? "" : `<div class="crumbs top">${sheetLink(ex.sheet)}</div>`}
      <div class="ex-head">${opts.heading ? `<h2 class="sec-ex">${heading}</h2>` : `<h1 class="ex-title">${heading}</h1>`}${status}</div>
      ${ex.cmd && ex.etype !== "concept" ? `<div class="cmd"><code>${esc(ex.cmd)}</code></div>` : ""}
      <div class="tags">${ex.tags.filter((t) => t !== "non-examinable").map((t) => chip(t)).join("")}</div>
      ${aboutBoxes(ex)}
      ${ex.book ? `<div class="bookref">📖 <b>Textbook:</b> ${esc(bookLabel(ex.book))}</div>` : ex.reading ? `<div class="bookref">🔗 <b>Further reading:</b> ${esc(ex.reading)}</div>` : ""}
      ${ex.context ? `<div class="box context"><div class="box-h">Context</div>${ex.context}</div>` : ""}
      ${bodyBlocks(ex, sh)}
      ${seeAlso(ex)}
    </article>`;
  }

  function bookLabel(b) {
    const one = (x) => { const m = x.trim().match(/^Ch(\d+)\s*(.*)$/); return m ? `Chapter ${m[1]}${m[2] ? ", " + m[2] : ""}` : x.trim(); };
    const parts = b.split(";").map(one);
    return "Python Crash Course, " + parts.join("; ");
  }
  // ---- views ------------------------------------------------------------
  function viewHome() {
    let html = `<div class="home"><h1 class="ex-title home-title">Quick Reference: Programming with Python</h1><p class="lead">Worked examples for every topic in the module, grouped by topic. Every example is a complete program: the output shown is what it prints when it is run.</p>`;
    for (const part of T.parts) {
      html += `<h2>Part ${part.id} · ${et(part.title)}</h2><div class="cards">`;
      for (const code of part.sheets) {
        const sh = T.sheets[code];
        const cnt = Object.values(T.examples).filter((e) => e.sheet === code).length;
        html += `<a class="card" href="#/sheet/${code}"><div class="card-code">${code}</div><div class="card-title">${et(sh.title)}</div>
          <div class="card-blurb">${esc(sh.blurb)}</div><div class="card-meta">${cnt} examples${sh.weeks ? " · week " + esc(sh.weeks) : ""}${sh.examinable ? "" : " · not examined"}</div></a>`;
      }
      html += "</div>";
    }
    if (T.weeks && T.weeks.length) {
      html += `<h2>Route by week</h2><p class="lead">The sheets used in each week of the module.</p><div class="weeks">`;
      for (const w of T.weeks) {
        html += `<div class="week-row"><div class="week-n">Week ${w.week}</div><div class="week-body"><b>${esc(w.topic)}</b>
          <div class="week-sheets">${w.sheets.map((c) => `<a class="chip" href="#/sheet/${c}" title="${esc(T.sheets[c].title)}">${c} ${esc(T.sheets[c].short || T.sheets[c].title)}</a>`).join("")}</div>
          <div class="week-note">${esc(w.note)}</div></div></div>`;
      }
      html += "</div>";
    }
    return html + `<p class="version-note"><a href="#/acknowledgements">Acknowledgements</a>: the textbook, data and software these examples build on.</p>` + versionNote() + "</div>";
  }
  function viewAck() {
    return `<div class="home ack"><h1 class="ex-title home-title">Acknowledgements</h1>
    <h2>The textbook</h2>
    <p>The Programming with Python module follows <b><i>Python Crash Course</i>, 3rd edition</b>, by Eric Matthes (No Starch Press, 2023). The sheets cover its topics in the same order, and a 📖 on a sheet gives the matching chapter.</p>
    <p>The examples here are original: they use their own settings and data, and nothing is copied from the book. The book teaches each topic in order, with explanations and exercises, so read it to learn a topic; use this reference to look a command up once it has been met.</p>
    <ul><li>The book: <a href="https://nostarch.com/python-crash-course-3rd-edition" target="_blank" rel="noopener">nostarch.com/python-crash-course-3rd-edition</a></li>
    <li>The author's online resources for the book (code, cheat sheets, updates): <a href="https://ehmatthes.github.io/pcc_3e/" target="_blank" rel="noopener">ehmatthes.github.io/pcc_3e</a></li></ul>
    <h2>Software</h2>
    <p>The examples run on <a href="https://www.python.org" target="_blank" rel="noopener">Python</a>, and the testing examples use <a href="https://pytest.org" target="_blank" rel="noopener">pytest</a>. The code on these pages is shown with <a href="https://codemirror.net/5/" target="_blank" rel="noopener">CodeMirror</a> (MIT licence).</p>
    <h2>Author</h2>
    <p>Written and maintained by Philip Lewis. © 2026 Philip Lewis.</p>
    <h2>Licence</h2>
    <p>The content (the examples, explanations, outputs, plots and notebooks) is licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>: it may be shared and adapted for any purpose, with credit to Philip Lewis and a link to the licence. The code that builds and runs the site is licensed under the <a href="https://opensource.org/license/mit" target="_blank" rel="noopener">MIT licence</a>. CodeMirror keeps its own MIT licence.</p>
    <h2>Made with Claude</h2>
    <p>The examples and the site were developed with the help of <a href="https://www.anthropic.com/claude" target="_blank" rel="noopener">Claude</a>, an AI model made by Anthropic. Every example is run when the site is built, so the output shown is what the code really prints.</p>
    <h2>Comments and corrections</h2>
    <p>Found a mistake, or have a suggestion? Open an issue on GitHub: <a href="https://github.com/quickrefs/quickrefs.github.io/issues/new" target="_blank" rel="noopener">github.com/quickrefs/quickrefs.github.io/issues</a>. This needs a free GitHub account. Give the example number (for example D6.10, shown next to each title) and the version (at the bottom of the home page), and say what looks wrong or what would help.</p>
    <p><a href="#/">Back to the contents</a></p></div>`;
  }
  function versionNote() {
    const me = window.QR_THIS, all = window.QR_VERSIONS;
    if (!me || !all || !all.length) return "";
    const newest = all[0].name;
    const links = all.map((v) => v.name === me.name ? `<b>${esc(v.name)}</b>` : `<a href="#" data-version="${esc(v.name)}">${esc(v.name)}</a>`).join(" · ");
    return `<p class="version-note">${me.name === newest ? "This is the newest version" : `This is an older version; the newest is <a href="#" data-version="${esc(newest)}">${esc(newest)}</a>`} (version ${esc(me.name)}, released ${esc(me.date)}). Every version stays available: ${links}</p>`;
  }
  function viewSheet(code) {
    const sh = T.sheets[code];
    if (!sh) return notFound();
    let html = `<div class="sheet-head">${head("", sheetLabel(code))}<p class="lead">${esc(sh.blurb)}</p>
      <div class="meta">${sh.weeks ? `<span>Week ${esc(sh.weeks)}</span>` : ""}${sh.examinable ? "" : '<span class="badge non">Whole sheet not examined</span>'}
      ${sh.book ? `<span>📖 ${esc(sh.book.split(",").map((c) => c.trim().replace(/^Ch/, "Chapter ")).join(", "))}</span>` : ""}
      ${sh.notebook ? `<a class="dl" href="${sh.notebook}" download>⬇ Download this sheet as a notebook</a>` : ""}</div></div>
      ${xrefBox(sh.xref)}
      ${sh.setup ? `<details class="setup"><summary>Setup code for this sheet</summary><div class="codeblock">${cmHost(sh.setup)}</div></details>` : ""}`;
    sh.sections.forEach((sec, si) => {
      const ids = sec.examples.filter((id) => matches(T.examples[id]));
      if (!ids.length) return;
      html += `<h2 class="sec-h"><a href="#/sec/${code}/${si}">${et(sec.title)}</a></h2><div class="ex-list">`;
      for (const id of ids) {
        const e = T.examples[id];
        html += `<a class="ex-card ${e.tags.map(tagClass).join(" ")} ${e.examinable ? "" : "non-examinable"}" href="#/ex/${id}"><span class="t">${et(e.title)}</span>${e.cmd ? `<code>${esc(e.cmd)}</code>` : ""}</a>`;
      }
      html += "</div>";
    });
    return html;
  }
  function viewSection(code, i) {
    const sh = T.sheets[code];
    if (!sh || !sh.sections[i]) return notFound();
    const sec = sh.sections[i];
    const ids = sec.examples.filter((id) => matches(T.examples[id]));
    return `${head(sheetLink(code), et(titleCase(sec.title)))}
      <p class="lead small">${ids.length} example${ids.length === 1 ? "" : "s"} in this section.</p>
      ${ids.map((id) => renderExample(T.examples[id], { heading: "h2", noCrumbs: true })).join("")}`;
  }
  function viewExample(id) {
    const ex = T.examples[id];
    if (!ex) return notFound();
    const nb = neighbours();
    const card = (cls, p, label) => p ? `<a class="pn ${cls}" href="${p.href}"><small>${label}</small><span>${esc(p.label)}</span></a>` : `<span class="pn ${cls} off"></span>`;
    return renderExample(ex) + `<div class="prevnext">${card("prev", nb.prev, "← Previous")}${card("next", nb.next, "Next →")}</div>`;
  }
  function termKey(t) {
    return t.replace(/^[^a-zA-Z0-9]+/, "").replace(/^(np|pd|plt|sns|stats|sm|smf|norm|df|dt|str|ax|fig|model|math|binom|mdates)\./i, "").replace(/^[^a-zA-Z0-9]+/, "").toLowerCase();
  }
  function viewIndex() {
    const map = new Map();
    ORDER.forEach((id) => {
      const e = T.examples[id];
      if (state.hideNon && !e.examinable) return;
      (e.terms.length ? e.terms : [e.title]).forEach((t) => { if (!map.has(t)) map.set(t, []); map.get(t).push(e); });
    });
    const terms = [...map.keys()].sort((a, b) => termKey(a).localeCompare(termKey(b)) || a.localeCompare(b));
    const groups = {};
    terms.forEach((t) => { const k = termKey(t); const L = /^[a-z]/.test(k) ? k[0].toUpperCase() : "#"; (groups[L] = groups[L] || []).push(t); });
    const letters = Object.keys(groups).sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b));
    const bar = letters.map((L) => `<a href="#" class="letter" data-letter="${L}">${L === "#" ? "0–9, symbols" : L}</a>`).join("");
    const body = letters.map((L) => `<h2 class="idx-letter" id="idx-${L === "#" ? "sym" : L}">${L === "#" ? "Symbols and numbers" : L}</h2><ul class="idx-list">${groups[L].map((t) =>
      `<li class="idx-term"><span class="term">${esc(t)}</span><span class="targets">${map.get(t).map((e) =>
        `<a class="idx-target ${e.examinable ? "" : "non-examinable"}" href="#/ex/${e.id}" title="${esc(e.cmd || "")}">${et(e.title)} <span class="w">${esc(e.sid)}</span></a>`).join("")}</span></li>`).join("")}</ul>`).join("");
    return `${head("", "A–Z Index")}
      <p class="lead small">${terms.length} commands, keywords and keyphrases, each linking to its example(s).</p>
      <div class="letters">${bar}</div>${body}`;
  }
  function notFound() { return `<h1>Not found</h1><p><a href="#/">Back to the start</a></p>`; }

  // ---- CodeMirror (read-only, consistent highlighting) ----------------------
  // Highlight with CodeMirror's Python mode but render plain <pre> text: no editor, so the page scrolls normally.
  const PYMODE = CodeMirror.getMode({ indentUnit: 4 }, "python");
  function highlight(src, target) {
    const state = CodeMirror.startState(PYMODE);
    const frag = document.createDocumentFragment();
    src.replace(/\s+$/, "").split("\n").forEach((line, i) => {
      if (i) frag.appendChild(document.createTextNode("\n"));
      if (!line) { if (PYMODE.blankLine) PYMODE.blankLine(state); return; }
      const stream = new CodeMirror.StringStream(line, 4);
      while (!stream.eol()) {
        const style = PYMODE.token(stream, state);
        const text = stream.current();
        stream.start = stream.pos;
        if (style) { const sp = document.createElement("span"); sp.className = "cm-" + style.split(" ").join(" cm-"); sp.textContent = text; frag.appendChild(sp); }
        else frag.appendChild(document.createTextNode(text));
      }
    });
    target.appendChild(frag);
  }
  // wrap the key part of the code (a piece of text, or a whole line given by its number) in <mark class="key">
  // Is the end of this line (text before a word) ordinary code, rather than inside a string or a comment?
  // Handles f-strings: the {...} fields of an f-string are code.
  function inCode(line) {
    const st = [{ t: "code" }];
    for (let i = 0; i < line.length; i++) {
      const top = st[st.length - 1], ch = line[i];
      if (top.t === "code") {
        if (ch === "#") return false;
        if (ch === '"' || ch === "'") { const pre = line.slice(Math.max(0, i - 2), i); st.push({ t: "str", q: ch, f: /[fF]/.test(pre) && !/\w[fF]$/.test(line.slice(Math.max(0, i - 3), i)) }); }
        else if (top.field && ch === "{") top.depth++;
        else if (top.field && ch === "}" && --top.depth === 0) st.pop();
      } else {
        if (ch === "\\") i++;
        else if (ch === top.q) st.pop();
        else if (top.f && ch === "{") { if (line[i + 1] === "{") i++; else st.push({ t: "code", field: true, depth: 1 }); }
      }
    }
    return st[st.length - 1].t === "code";
  }
  function markKey(pre, marks) {
    const text = pre.textContent, ranges = [];
    marks.forEach((m) => {
      if (/^\d+$/.test(m)) {
        const lines = text.split("\n"); let at = 0;
        for (let i = 0; i < lines.length; i++) { if (i + 1 === +m) { ranges.push([at, at + lines[i].length]); break; } at += lines[i].length + 1; }
      } else if (m.startsWith("w:")) {                // a keyword: every whole-word occurrence
        const re = new RegExp("\\b(?:set_)?" + m.slice(2) + "\\b", "g"); let r;
        while ((r = re.exec(text))) {            // keywords inside a string or a comment are left alone
          const line = text.slice(text.lastIndexOf("\n", r.index - 1) + 1, r.index);
          if (inCode(line)) ranges.push([r.index, r.index + r[0].length]);
        }
      } else if (/^[\w.]+\(\)$/.test(m)) {        // "max()": the function name only, wherever it is called
        const re = new RegExp("(?<!\\w)" + m.slice(0, -2).replace(/\./g, "\\.") + "(?=\\()", "g"); let r;
        while ((r = re.exec(text))) ranges.push([r.index, r.index + m.length - 2]);
      } else { const i = text.indexOf(m); if (i >= 0) ranges.push([i, i + m.length]); }
    });
    if (!ranges.length) return;
    const nodes = []; const walk = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let at = 0; while (walk.nextNode()) { const n = walk.currentNode; nodes.push([n, at, at + n.length]); at += n.length; }
    nodes.forEach(([n, s, e]) => {
      const cuts = ranges.map(([a, b]) => [Math.max(a, s), Math.min(b, e)]).filter(([a, b]) => a < b).sort((x, y) => y[0] - x[0]);
      cuts.forEach(([a, b]) => {
        const r = document.createRange(); r.setStart(n, a - s); r.setEnd(n, b - s);
        const mk = document.createElement("mark"); mk.className = "key"; r.surroundContents(mk);
      });
    });
  }
  function initCM(root) {
    root.querySelectorAll(".cm-host:not(.ready)").forEach((h) => {
      h.classList.add("ready");
      const pre = document.createElement("pre");
      pre.className = "cm-s-tb cm-static";
      highlight(h.dataset.src, pre);
      h.appendChild(pre);
      if (h.dataset.marks) markKey(pre, JSON.parse(h.dataset.marks));
      if (h.dataset.nb !== undefined) {           // a second copy of the code without plt.show(), for the notebook view
        pre.classList.add("nb-script");
        const p2 = document.createElement("pre");
        p2.className = "cm-s-tb cm-static nb-notebook";
        highlight(h.dataset.nb, p2);
        h.appendChild(p2);
      }
    });
  }
  // ---- routing ----------------------------------------------------------
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const p = h.split("/");
    if (/^[A-Za-z]\d\.\d+$/.test(p[0]) && SID[p[0].toUpperCase()]) return { kind: "ex", id: SID[p[0].toUpperCase()] };
    if (p[0] === "ex" && p[1]) return { kind: "ex", id: decodeURIComponent(p[1]) };
    if (p[0] === "index") return { kind: "index", mode: p[1] === "cmd" ? "cmd" : "title" };
    if (p[0] === "acknowledgements") return { kind: "ack" };
    if (p[0] === "sheet" && p[1]) return { kind: "sheet", code: p[1] };
    if (p[0] === "sec" && p[1]) return { kind: "sec", code: p[1], i: +p[2] || 0 };
    return { kind: "home" };
  }
  function setView(v, navigate) {
    state.view = v; store.set("tb-view", v);
    if (navigate === false) return;
    const r = state.route;
    if (v === "one" && r.kind === "sec") {
      const ids = T.sheets[r.code].sections[r.i].examples;
      location.hash = "#/ex/" + (r.focus || (ids.includes(state.lastEx) ? state.lastEx : ids[0]));
      if (state.route.kind === "sec") onRoute();
    } else if (v === "section" && r.kind === "ex") {
      const e = T.examples[r.id];
      state.route = { kind: "sec", code: e.sheet, i: e.section_index, focus: e.id };
      renderMain(); refresh({ keepMain: true });
      const el = document.getElementById("ex-" + e.id); if (el) el.scrollIntoView({ block: "start" });
    } else renderMain();
  }
  function setPin(on) {
    document.body.classList.toggle("pin-nav", on);
    store.set("tb-pin", on ? "1" : "0");
    document.querySelectorAll(".pb-pin").forEach((b) => b.setAttribute("aria-pressed", on ? "true" : "false"));
  }
  setPin(store.get("tb-pin", "1") === "1");
  // ---- page content: which extras appear on a page (tags are off by default) ----
  const CONTENT = { tags: "0", kind: "1", uses: "1", links: "1", context: "1" };
  function applyContent() {
    Object.keys(CONTENT).forEach((k) => {
      const on = store.get("tb-show-" + k, CONTENT[k]) === "1";
      document.body.classList.toggle("no-" + k, !on);
      const cb = document.querySelector(`input[data-content="${k}"]`);
      if (cb) cb.checked = on;
    });
    const states = Object.keys(CONTENT).map((k) => store.get("tb-show-" + k, CONTENT[k]) === "1");
    document.querySelectorAll("#preset-seg button").forEach((b) => b.classList.toggle("on",
      b.dataset.preset === "simple" ? states.every((s) => !s) : states.every((s) => s)));
  }
  document.addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-content]");
    if (cb) { store.set("tb-show-" + cb.dataset.content, cb.checked ? "1" : "0"); applyContent(); }
  });
  document.addEventListener("click", (e) => {
    const pb = e.target.closest("#preset-seg button");
    if (!pb) return;
    const on = pb.dataset.preset === "full" ? "1" : "0";
    Object.keys(CONTENT).forEach((k) => store.set("tb-show-" + k, on));
    applyContent();
  });
  applyContent();
  // ---- links to other modules: off by default, and the address of the other book is editable ----
  function applyXlinks() {
    const on = store.get("tb-xlinks", window.parent !== window ? "1" : "0") === "1";
    document.body.classList.toggle("xlinks-on", on);
    const cb = $("#xlinks"); if (cb) cb.checked = on;
    const inp = $("#xroot-ds"); if (inp && T.xrefs && T.xrefs.ds) inp.value = store.get("tb-xroot-ds", "") || T.xrefs.ds.root;
    const row = $("#xlinks-root-row"); if (row) row.hidden = !on;
  }
  document.addEventListener("change", (e) => {
    if (e.target.id === "xlinks") { store.set("tb-xlinks", e.target.checked ? "1" : "0"); applyXlinks(); }
    if (e.target.id === "xroot-ds") { store.set("tb-xroot-ds", e.target.value.trim()); refresh({ keepMain: state.route.kind === "ex" }); }
  });
  applyXlinks();
  // ---- page bar: Home, Back, Prev, Next in the same place on every page -----
  function neighbours() {
    const r = state.route;
    if (state.view === "section" && (r.kind === "home" || r.kind === "sheet" || r.kind === "sec")) {
      const i = PAGES_SEC.findIndex((p) => (r.kind === "home" ? p.kind === "home" : r.kind === "sheet" ? p.kind === "sheet" && p.code === r.code : p.kind === "sec" && p.code === r.code && p.i === r.i));
      return { prev: i > 0 ? PAGES_SEC[i - 1] : null, next: i >= 0 && i < PAGES_SEC.length - 1 ? PAGES_SEC[i + 1] : null };
    }
    let pages = PAGES;
    if (isActive() && r.kind === "ex") pages = PAGES.filter((p) => p.kind === "ex" && matches(T.examples[p.id]));
    let i = -1, j = -1;
    if (r.kind === "home") i = j = 0;
    else if (r.kind === "sheet") i = j = PAGES.findIndex((p) => p.kind === "sheet" && p.code === r.code);
    else if (r.kind === "ex") i = j = pages.findIndex((p) => p.kind === "ex" && p.id === r.id);
    else if (r.kind === "sec") {
      const ids = (T.sheets[r.code] && T.sheets[r.code].sections[r.i]) ? T.sheets[r.code].sections[r.i].examples : [];
      i = ids.length ? PAGES.findIndex((p) => p.kind === "ex" && p.id === ids[0]) : -1;
      j = ids.length ? PAGES.findIndex((p) => p.kind === "ex" && p.id === ids[ids.length - 1]) : -1;
    }
    return { prev: i > 0 ? pages[i - 1] : null, next: j >= 0 && j < pages.length - 1 ? pages[j + 1] : null };
  }
  function pagebarHtml() {
    const r = state.route, nb = neighbours();
    const btn = (cls, p, label, tip) => p ? `<a class="pb ${cls}" href="${p.href}" title="${esc(tip)}: ${esc(p.label)}">${label}</a>` : `<span class="pb ${cls} off">${label}</span>`;
    let where = "", toggle = "";
    const viewSwitch = () => `<span class="viewsw" role="group" aria-label="How many examples to show on a page"><span class="vs-label">View</span><button type="button" data-view="one" class="${state.view === "one" ? "on" : ""}" title="One example per page">One</button><button type="button" data-view="section" class="${state.view === "section" ? "on" : ""}" title="Every example of the section on one page">Section</button></span>`;
    if (r.kind === "ex" && T.examples[r.id]) {
      const e = T.examples[r.id], sec = T.sheets[e.sheet].sections[e.section_index];
      where = `${esc(T.sheets[e.sheet].short || "")} · ${sec.examples.indexOf(r.id) + 1} of ${sec.examples.length}`;
      toggle = viewSwitch();
    } else if (r.kind === "sec" && T.sheets[r.code] && T.sheets[r.code].sections[r.i]) {
      const sec = T.sheets[r.code].sections[r.i];
      where = `${esc(T.sheets[r.code].short || "")} · ${et(sec.title)} · ${sec.examples.length} examples`;
      toggle = viewSwitch();
    } else if (r.kind === "sheet" && T.sheets[r.code]) where = `Sheet ${SHEETS.indexOf(r.code) + 1} of ${SHEETS.length}`;
    else if (r.kind === "index") where = "A–Z index";
    return `<nav id="pagebar" aria-label="Page navigation"><a class="pb pb-home${r.kind === "home" ? " here" : ""}" href="#/" title="Home">${HOME_ICON}<span>Home</span></a>
      <button class="pb pb-back" type="button" title="Back to the previous page you viewed" ${history.length > 1 ? "" : "disabled"}>${BACK_ICON}<span>Back</span></button>
      ${btn("pb-prev", nb.prev, "‹ <span>Prev</span>", "Previous (←)")}${btn("pb-next", nb.next, "<span>Next</span> ›", "Next (→)")}
      <span class="pb-where"><span class="pb-text">${where}</span>${toggle}</span><span class="pb-spacer"></span><button class="pb pb-pin" type="button" aria-pressed="${document.body.classList.contains("pin-nav")}" title="Pin these buttons in place while the page scrolls underneath (click again to let them scroll with the page)">${PIN_ICON}</button></nav>`;
  }
  // the pinned copy of the nav row must line up exactly with the page holder
  function syncPageVars() {
    const pg = $("#main > .page");
    if (!pg) return;
    const rc = pg.getBoundingClientRect();
    document.documentElement.style.setProperty("--pg-left", rc.left + "px");
    document.documentElement.style.setProperty("--pg-w", rc.width + "px");
  }
  window.addEventListener("resize", syncPageVars);
  function renderMain() {
    const r = state.route;
    const main = $("#main");
    const view = r.kind === "ex" ? viewExample(r.id) : r.kind === "ack" ? viewAck() : r.kind === "index" ? viewIndex() : r.kind === "sheet" ? viewSheet(r.code) : r.kind === "sec" ? viewSection(r.code, r.i) : viewHome();
    const bar = pagebarHtml();
    main.innerHTML = `<div class="page page-${r.kind}">${bar}${view}</div>${bar.replace('id="pagebar"', 'id="pagebar-fix" aria-hidden="true"')}`;
    syncPageVars();   // every page sits in the same white page holder
    initCM(main);
    Object.keys(PREFS).forEach((d) => setPref(d, document.body.dataset[d]));
    document.title = (r.kind === "ex" && T.examples[r.id] ? plain(T.examples[r.id].title) + " · " : r.kind === "sheet" && T.sheets[r.code] ? T.sheets[r.code].title + " · " : "") + "Quick Reference: Programming with Python";
  }
  function refresh(opts) {
    opts = opts || {};
    renderTagPanel();
    renderTree();
    if (!opts.keepMain) renderMain();
  }
  function pathKeys(r) {
    const s = new Set();
    if (r.kind === "ex" && T.examples[r.id]) { const e = T.examples[r.id]; s.add(e.sheet); s.add(e.sheet + ":" + e.section_index); }
    else if (r.kind === "sheet") s.add(r.code);
    else if (r.kind === "sec") { s.add(r.code); s.add(r.code + ":" + r.i); }
    return s;
  }
  function onRoute() {
    state.route = parseHash();
    if (state.route.kind === "ex") state.lastEx = state.route.id;
    if (state.view === "section" && state.route.kind === "ex" && T.examples[state.route.id]) {
      const e = T.examples[state.route.id];
      state.route = { kind: "sec", code: e.sheet, i: e.section_index, focus: e.id };   // show the whole section, scrolled to this example
    }
    state.open = pathKeys(state.route);          // everything collapsed except the current pathway
    if (["ex", "home", "index"].includes(state.route.kind)) { document.body.classList.remove("nav-open"); $("#nav-handle .chev").textContent = "›"; }   // stay open while browsing sheets
    refresh();
    $("#main").scrollTop = 0;
    window.scrollTo(0, 0);
    if (state.route.focus) { const el = document.getElementById("ex-" + state.route.focus); if (el) el.scrollIntoView({ block: "start" }); }
  }

  // ---- events -----------------------------------------------------------
  // ---- search suggestions (autocomplete dropdown) ------------------------
  const sug = { items: [], i: -1 };
  function scoreExample(e, words, q) {
    if (state.hideNon && !e.examinable) return -1;
    const title = plain(e.title).toLowerCase(), terms = e.terms.map((t) => t.toLowerCase()), cmd = (e.cmd || "").toLowerCase();
    const tasks = (e.task || []).map((t) => t.toLowerCase()), taskText = tasks.join(" ; ");
    const all = words; words = words.filter((w) => e.search.includes(w));
    if (words.length < wordsNeeded(all.length)) return -1;
    const partial = words.length < all.length;
    let sc = 1;
    if (e.sid.toLowerCase() === q) sc = 200;
    if (terms.some((t) => t === q)) sc = Math.max(sc, 100);
    if (terms.some((t) => t.startsWith(q))) sc = Math.max(sc, 92);
    if (title.startsWith(q)) sc = Math.max(sc, 96);
    if (terms.some((t) => t.includes(q))) sc = Math.max(sc, 80);
    if (title.includes(q)) sc = Math.max(sc, 70);
    if (cmd.includes(q)) sc = Math.max(sc, 60);
    if (e.tags.includes(q)) sc = Math.max(sc, 40);
    // an everyday phrase (task:) that holds the whole query, or all the words inside one phrase
    if (tasks.some((t) => t === q)) sc = Math.max(sc, 110);
    else if (tasks.some((t) => t.includes(q))) sc = Math.max(sc, 90);
    else if (tasks.some((t) => words.every((w) => t.includes(w)))) sc = Math.max(sc, 75);
    // otherwise rank by where each word is found: title and task phrases above commands, tags and body text
    let part = 1;
    for (const w of words) {
      if (title.includes(w)) part += 12;
      if (taskText.includes(w)) part += 10;
      if (terms.some((t) => t.includes(w))) part += 8;
      if (cmd.includes(w)) part += 5;
      if (e.tags.includes(w)) part += 3;
    }
    const r = Math.max(sc, Math.min(part, 69));
    return partial ? Math.max(1, Math.round(Math.min(r, 69) * words.length / all.length)) : r;
  }
  function hl(text, q) {
    const i = text.toLowerCase().indexOf(q);
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  }
  // ---- combined version: which book this is, and the other book's search index (combined/site/search_index.js)
  const EMBED = window.parent !== window;
  const BOOKS = [["py", "Programming with Python"], ["ds", "Data Science with Python"]], SELF = "py";
  const OTHER = SELF === "py" ? "ds" : "py", OTHER_NAME = BOOKS.find((b) => b[0] === OTHER)[1];
  if (EMBED) { const sc = document.createElement("script"); sc.src = "../search_index.js"; sc.onerror = () => {}; document.head.appendChild(sc); }
  function otherHits(words, q) {
    const idx = EMBED && window.QR_INDEX && window.QR_INDEX[OTHER];
    if (!idx) return [];
    return idx.map((e) => [scoreExample(e, words, q), e]).filter((x) => x[0] > 0)
      .sort((a, b) => b[0] - a[0] || plain(a[1].title).localeCompare(plain(b[1].title))).slice(0, 4).map((x) => x[1]);
  }
  function showSuggestions(q) {
    const box = $("#suggest");
    q = q.trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; sug.items = []; return; }
    const words = searchWords(q);
    const hits = ORDER.map((id) => T.examples[id]).map((e) => [scoreExample(e, words, q), e]).filter((x) => x[0] > 0)
      .sort((a, b) => b[0] - a[0] || plain(a[1].title).localeCompare(plain(b[1].title)));
    sug.items = hits.slice(0, 8).map((x) => x[1]);
    sug.total = hits.length; sug.i = -1;
    const deepBtn = `<button class="sg-deep" type="button">${state.deep ? "Deep search is on: turn it off" : "Not finding it? Try deep search"}</button>`;
    const xs = otherHits(words, q);
    const xHtml = xs.length ? `<div class="sg-xhead">In ${esc(OTHER_NAME)}</div>` + xs.map((e) => `<a class="sg-item sg-x" role="option" href="#" data-book="${OTHER}" data-id="${esc(e.sid)}"><span class="sg-main"><span class="sg-title">${hl(plain(e.title), q)}</span>${e.cmd ? `<code class="sg-cmd">${esc(e.cmd)}</code>` : ""}</span><span class="sg-where">${esc(e.sid)}</span></a>`).join("") : "";
    if (!hits.length) { box.innerHTML = '<div class="sg-empty">No matches in this book</div>' + xHtml + deepBtn; box.hidden = false; return; }
    box.innerHTML = sug.items.map((e, k) => {
      const t = e.terms.find((x) => x.toLowerCase().includes(q));
      return `<a class="sg-item" role="option" data-i="${k}" href="#/ex/${e.id}"><span class="sg-main"><span class="sg-title">${hl(plain(e.title), q)}</span>${t && !plain(e.title).toLowerCase().includes(q) ? `<span class="sg-term">${hl(t, q)}</span>` : (e.cmd ? `<code class="sg-cmd">${esc(e.cmd)}</code>` : "")}</span><span class="sg-where">${esc(e.sid)}${e.examinable ? "" : " ✱"}</span></a>`;
    }).join("") + (hits.length > 8 ? `<button class="sg-all" type="button">Show all ${hits.length} matches in the contents</button>` : "") + xHtml + deepBtn;
    box.hidden = false;
  }
  function moveSuggestion(d) {
    const els = [...document.querySelectorAll("#suggest .sg-item")];
    if (!els.length) return;
    sug.i = (sug.i + d + els.length) % els.length;
    els.forEach((el, k) => el.classList.toggle("on", k === sug.i));
    els[sug.i].scrollIntoView({ block: "nearest" });
  }
  function closeSuggestions() { $("#suggest").hidden = true; sug.i = -1; }
  $("#search").addEventListener("input", (e) => showSuggestions(e.target.value));
  $("#search").addEventListener("focus", (e) => showSuggestions(e.target.value));
  $("#search").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSuggestion(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSuggestion(-1); }
    else if (e.key === "Enter") {
      const els = [...document.querySelectorAll("#suggest .sg-item")];
      const pick = els[sug.i >= 0 ? sug.i : 0];
      if (pick && pick.classList.contains("sg-x")) { e.preventDefault(); window.parent.postMessage({ qr: "open", book: pick.dataset.book, id: pick.dataset.id }, "*"); closeSuggestions(); return; }
      if (pick) { e.preventDefault(); setView("one", false); location.hash = pick.getAttribute("href"); closeSuggestions(); e.target.blur(); }
    } else if (e.key === "Escape") { closeSuggestions(); }
  });
  document.addEventListener("click", (e) => {
    const xa = e.target.closest("#suggest .sg-x");
    if (xa) { e.preventDefault(); window.parent.postMessage({ qr: "open", book: xa.dataset.book, id: xa.dataset.id }, "*"); closeSuggestions(); return; }
    if (e.target.closest(".sg-deep")) {
      state.deep = !state.deep; showSuggestions($("#search").value);
      if (state.q) refresh({ keepMain: state.route.kind === "ex" });
      return;
    }
    if (e.target.closest(".sg-all")) {
      state.q = $("#search").value.trim(); closeSuggestions();
      document.body.classList.add("nav-open"); $("#nav-handle .chev").textContent = "‹";
      refresh({ keepMain: state.route.kind === "ex" }); return;
    }
    if (e.target.closest("#suggest .sg-item")) { setView("one", false); closeSuggestions(); $("#search").blur(); return; }
    if (!e.target.closest(".search")) closeSuggestions();
  });
  let timer;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = e.target.value.trim(); refresh({ keepMain: state.route.kind === "ex" }); }, 120);
  });
  // Style preferences (remembered): plot style plt./ax. and command style chained/step by step
  const PREFS = { plot: ["plt", "ax"], mode: ["script", "notebook"], chain: ["chain", "steps"] };
  function setPref(dim, v) {
    if (!PREFS[dim].includes(v)) v = PREFS[dim][0];
    document.body.dataset[dim] = v; store.set("tb-" + dim, v);
    document.querySelectorAll(`.seg.ctl[data-dim="${dim}"] button`).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".seg.ctl button");
    if (b) setPref(b.closest(".seg").dataset.dim, b.dataset.v);
  });
  Object.keys(PREFS).forEach((d) => setPref(d, store.get("tb-" + d, PREFS[d][0])));
  $("#hide-nonexam").checked = state.hideNon;
  $("#hide-nonexam").addEventListener("change", (e) => { state.hideNon = e.target.checked; store.set("tb-hidenon", state.hideNon ? "1" : "0"); refresh({ keepMain: state.route.kind === "ex" }); });
  $("#show-cmd").checked = state.showCmd;
  $("#show-cmd").addEventListener("change", (e) => { state.showCmd = e.target.checked; store.set("tb-showcmd", state.showCmd ? "1" : "0"); renderTree(); });
  $("#theme-btn").addEventListener("click", () => {
    const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t); store.set("tb-theme", t);
  });
  const settings = $("#settings"), setBtn = $("#settings-btn");
  function toggleSettings(force) {
    const open = force !== undefined ? force : !settings.classList.contains("open");
    settings.classList.toggle("open", open); setBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  const helpPanel = $("#help"), helpBtn = $("#help-btn");
  function toggleHelp(force) {
    const open = force !== undefined ? force : !helpPanel.classList.contains("open");
    helpPanel.classList.toggle("open", open); helpBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) toggleSettings(false);
  }
  helpBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleHelp(); });
  setBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleHelp(false); toggleSettings(); });
  document.addEventListener("click", (e) => { if (!e.target.closest("#settings") && !e.target.closest("#settings-btn")) toggleSettings(false); if (!e.target.closest("#help") && !e.target.closest("#help-btn")) toggleHelp(false); });
  $("#nav-handle").addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    $("#nav-handle .chev").textContent = open ? "‹" : "›";
  });
  $("#scrim").addEventListener("click", () => { document.body.classList.remove("nav-open"); $("#nav-handle .chev").textContent = "›"; });

  function clearFilters() { state.q = ""; state.tags.clear(); $("#search").value = ""; refresh({ keepMain: state.route.kind === "ex" }); }
  document.addEventListener("click", (e) => {
    const chipEl = e.target.closest(".chip");
    if (chipEl) {
      const t = chipEl.dataset.tag;
      state.tags.has(t) ? state.tags.delete(t) : state.tags.add(t);
      const inMain = !!chipEl.closest("#main");
      if (inMain) $("#tag-panel").open = true;
      refresh({ keepMain: state.route.kind === "ex" });
      if (inMain) $("#main").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", state.tags.has(c.dataset.tag)));
      return;
    }
    if (e.target.closest(".pb-back")) { history.back(); return; }
    const vb = e.target.closest(".viewsw button");
    if (vb) { if (vb.dataset.view !== state.view) setView(vb.dataset.view); return; }
    const pn = e.target.closest(".pb-pin");
    if (pn) { setPin(!document.body.classList.contains("pin-nav")); return; }
    const sd = e.target.closest("button.sid");
    if (sd) {
      const link = location.href.split("#")[0] + "#/" + sd.dataset.sid;
      const done = () => { const o = sd.textContent; sd.textContent = "link copied"; setTimeout(() => (sd.textContent = o), 1300); };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, done); else done();
      return;
    }
    const lt = e.target.closest(".letter");
    if (lt) { e.preventDefault(); const t = document.getElementById("idx-" + (lt.dataset.letter === "#" ? "sym" : lt.dataset.letter)); if (t) t.scrollIntoView({ block: "start" }); return; }
    if (e.target.id === "clear-filters" || e.target.id === "clear-filters2") return clearFilters();
    const cp = e.target.closest(".copy-btn");
    if (cp) {
      const vis = [...cp.parentElement.querySelectorAll(".cm-host")].find((h) => h.offsetParent !== null) || cp.parentElement.querySelector(".cm-host");
      const code = document.body.dataset.mode === "notebook" && vis.dataset.nb !== undefined ? vis.dataset.nb : vis.dataset.src;
      const done = () => { cp.textContent = "Copied ✓"; setTimeout(() => (cp.textContent = "Copy"), 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, done); else done();
      return;
    }
  }, true);
  // remember sheets/sections the reader opens by hand (until they navigate elsewhere)
  $("#tree").addEventListener("toggle", (e) => {
    const d = e.target;
    if (isActive() || !d.dataset || !d.dataset.key) return;
    d.open ? state.open.add(d.dataset.key) : state.open.delete(d.dataset.key);
  }, true);
  // links inside <summary> should navigate (and open the group), not just toggle it
  $("#tree").addEventListener("click", (e) => {
    const a = e.target.closest("summary a");
    if (a) { const d = a.closest("details"); if (!d.open) d.open = true; e.preventDefault(); location.hash = a.getAttribute("href"); }
  });
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) { e.preventDefault(); $("#search").focus(); }
    else if (e.key === "Escape" && (settings.classList.contains("open") || helpPanel.classList.contains("open"))) { toggleSettings(false); toggleHelp(false); }
    else if (e.key === "Escape" && document.body.classList.contains("nav-open")) document.body.classList.remove("nav-open");
    else if (e.key === "Escape" && typing) document.activeElement.blur();
    else if (!typing && ["ex", "sheet", "home", "sec"].includes(state.route.kind) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const el = $(e.key === "ArrowLeft" ? ".pb-prev:not(.off)" : ".pb-next:not(.off)");
      if (el) location.hash = el.getAttribute("href");
    }
  });
  window.addEventListener("hashchange", onRoute);

  // ---- combined version ---------------------------------------------------
  // When this book runs inside the combined page (an iframe), the title becomes a book switcher and links to
  // the other book switch the page instead of opening a new tab. On its own the book is unchanged.
  if (EMBED) {
    const brand = document.querySelector(".brand");
    if (brand) {
      brand.outerHTML = `<span class="brand brand-switch"><a href="#/"><b>Quick Reference:</b></a> <select id="book-switch" aria-label="Choose a quick reference">${BOOKS.map(([k, n]) => `<option value="${k}"${k === SELF ? " selected" : ""}>${n}</option>`).join("")}</select></span>`;
      document.getElementById("book-switch").addEventListener("change", (e) => window.parent.postMessage({ qr: "switch", book: e.target.value }, "*"));
    }
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a.xref");
      if (!a) return;
      e.preventDefault();
      window.parent.postMessage({ qr: "open", book: a.dataset.m, id: a.dataset.id }, "*");
    });
    // A released copy (published/<name>/) has ../version.js (this release) and ../../versions.js (every release):
    // the header gets a version picker and the home page a version note. Other copies show neither.
    const load = (src, done) => { const s = document.createElement("script"); s.src = src; s.onload = done; s.onerror = () => {}; document.head.appendChild(s); };
    load("../version.js", () => load("../../versions.js", () => {
      const me = window.QR_THIS, all = window.QR_VERSIONS;
      if (!me || !all || !all.length) return;
      const sw = document.querySelector(".brand-switch");
      if (sw) {
        sw.insertAdjacentHTML("beforeend", ` <select id="version-switch" aria-label="Choose a version">${all.map((v, i) => `<option value="${esc(v.name)}"${v.name === me.name ? " selected" : ""}>Version ${esc(v.name)}${i === 0 ? " (newest)" : ""}</option>`).join("")}</select>`);
        document.getElementById("version-switch").addEventListener("change", (e) => window.parent.postMessage({ qr: "version", v: e.target.value }, "*"));
      }
      if (!location.hash.replace(/^#\/?/, "")) onRoute();     // home page: add the version note
    }));
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-version]");
      if (!a) return;
      e.preventDefault();
      window.parent.postMessage({ qr: "version", v: a.dataset.version }, "*");
    });
    const report = () => window.parent.postMessage({ qr: "route", book: SELF, hash: location.hash }, "*");
    window.addEventListener("hashchange", report);
    report();
  }
  onRoute();
})();
