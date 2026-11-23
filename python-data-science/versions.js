window.QR_VERSIONS = [{"name": "2026-autumn.4", "date": "2026-11-23", "commit": "37be159"}, {"name": "2026-autumn", "date": "2026-11-22", "commit": "8e77b17"}];
(function () {
  var all = window.QR_VERSIONS || [], me = window.QR_THIS;
  var st = document.createElement("style");
  st.textContent = "#version-switch{display:none}" +
    ".qr-old{position:fixed;left:0;right:0;bottom:12px;margin:0 auto;width:fit-content;z-index:60;max-width:calc(100% - 32px);box-sizing:border-box;" +
    "background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 12px;" +
    "font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.12);display:flex;gap:10px;align-items:center}" +
    ".qr-old a{font-weight:600}.qr-old button{border:0;background:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0 2px}";
  document.head.appendChild(st);
  if (!me || !all.length || me.name === all[0].name) return;
  try { if (sessionStorage.getItem("qr-old-closed") === me.name) return; } catch (e) {}
  var newest = all[0].name, latest = new URL("../../latest/index.html", location.href).href;
  var book = location.pathname.split("/").slice(-2)[0];
  function here() {         // this page's place, as the combined page writes it (#py/D6.10)
    try { if (window.parent !== window && window.parent.location.hash) return window.parent.location.hash; } catch (e) {}
    return "#" + book + "/" + location.hash.replace(/^#\/?/, "");
  }
  var bar = document.createElement("div");
  bar.className = "qr-old";
  bar.setAttribute("role", "note");
  bar.innerHTML = "<span>This is an older version (" + me.name + ").</span> <a href=\"" + latest + "\" target=\"_top\">Open this page in the newest version</a>" +
    "<button type=\"button\" aria-label=\"Close\" title=\"Close\">×</button>";
  bar.querySelector("a").addEventListener("click", function (e) { e.preventDefault(); window.top.location.href = latest + here(); });
  bar.querySelector("button").addEventListener("click", function () {
    bar.remove();
    try { sessionStorage.setItem("qr-old-closed", me.name); } catch (e) {}
  });
  document.body.appendChild(bar);
})();
