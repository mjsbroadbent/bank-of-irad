/* Bank of Irad · bank.iradgov.org
   Draws the header, menu and footer, switches language (en / ir / ru) and renders the data-driven parts.
   The only outside request is a GET of the shared daily numbers file (official rates). */
(function () {
  "use strict";
  var I = window.BOI_I18N;
  var LANGS = ["en", "ir", "ru"];
  var RATE_FEED = "https://iradone.com/data/today.json";
  var PEG = 8.4;
  var GOV = "https://iradgov.org/";

  var LANG = "en";
  try { var saved = localStorage.getItem("boi_lang"); if (LANGS.indexOf(saved) >= 0) LANG = saved; } catch (e) {}
  var qs = new URLSearchParams(location.search);
  if (LANGS.indexOf(qs.get("lang")) >= 0) LANG = qs.get("lang");

  var PAGE = document.body.getAttribute("data-page") || "";
  var cache = {};
  var origHTML = new WeakMap();

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); }
  function t(k, v) { var d = I.ui[LANG] || {}; var s = d[k] != null ? d[k] : I.ui.en[k]; return s == null ? k : (v ? fill(s, v) : s); }
  function has(k) { return (I.ui[LANG] && I.ui[LANG][k] != null) || I.ui.en[k] != null; }
  function tri(o) { if (o == null) return ""; if (typeof o === "string") return o; return o[LANG] || o.en || ""; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(s) { var p = String(s).split("-"); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function fmtDate(s) {
    var p = ymd(s), M = I.ui[LANG].months;
    if (LANG === "ir") return p.y + "-jıldın " + p.d + "-" + M[p.m - 1];
    if (LANG === "ru") return p.d + " " + I.ui.ru.monthsGen[p.m - 1] + " " + p.y + " г.";
    return p.d + " " + M[p.m - 1] + " " + p.y;
  }
  function numDate(s) { var p = ymd(s); return pad(p.d) + "-" + pad(p.m) + "-" + p.y; }
  function iradNow() { var n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + 6 * 3600000); }
  function iradToday() { var d = iradNow(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmtNum(x, dp) {
    var s = Number(x).toFixed(dp == null ? 2 : dp);
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, LANG === "en" ? "," : " ");
    return parts.join(LANG === "en" ? "." : ",");
  }
  function getJSON(url) {
    if (!cache[url]) cache[url] = fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache[url];
  }
  function failBox(el) { if (el) el.innerHTML = '<p class="loading">' + esc(t("loadFail")) + "</p>"; }
  function sortByDate(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }

  /* ---------- official rates (shared daily numbers file) ---------- */
  var ratePromise;
  function getRates() {
    if (ratePromise) return ratePromise;
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    ratePromise = fetch(RATE_FEED, { cache: "no-cache", credentials: "omit", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        var R = d && d.rates; if (!R) throw new Error("no rates");
        var rows = Array.isArray(R.official) ? R.official : (R.official && Array.isArray(R.official.rows) ? R.official.rows : null);
        if (!rows || !rows.length) throw new Error("no rows");
        rows = rows.filter(function (r) { return r && typeof r.code === "string" && typeof r.som === "number" && r.som > 0; })
          .map(function (r) { return { code: r.code.toUpperCase(), units: +r.units || 1, som: r.som }; });
        var usd = rows.filter(function (r) { return r.code === "USD"; })[0];
        if (!usd) rows.unshift({ code: "USD", units: 1, som: typeof R.peg === "number" ? R.peg : PEG });
        return { live: true, date: typeof d.date === "string" ? d.date : null, rows: rows };
      })
      .catch(function () { clearTimeout(timer); return { live: false, date: null, rows: [{ code: "USD", units: 1, som: PEG }] }; });
    return ratePromise;
  }
  function curName(code) { var k = "cur_" + code; return has(k) ? t(k) : code; }
  function rateTable(R, compact) {
    var rows = R.rows.slice().sort(function (a, b) { return a.code === "USD" ? -1 : b.code === "USD" ? 1 : 0; });
    var h = '<table class="rates"><thead><tr><th>' + esc(t("rCur")) + '</th><th class="r">' + esc(t("rUnits")) + '</th><th class="r">' + esc(t("rSom")) + "</th></tr></thead><tbody>";
    h += rows.map(function (r) {
      return '<tr class="' + (r.code === "USD" ? "usd" : "") + '"><td><span class="code">' + esc(r.code) + "</span> <span class=\"muted small\">" + esc(curName(r.code)) + "</span></td>" +
        '<td class="r num">' + esc(fmtNum(r.units, 0)) + '</td><td class="r som">' + esc(fmtNum(r.som, r.som < 1 ? 4 : 2)) + "</td></tr>";
    }).join("");
    h += "</tbody></table>";
    if (R.live && R.date) h += '<p class="src">' + esc(t("rAsOf", { d: fmtDate(R.date) })) + "</p>";
    else h += '<p class="unavail">' + esc(t("rUnavail")) + "</p>" + '<p class="src">' + esc(t("rPegNote")) + "</p>";
    return h;
  }
  function rateWidget(el, compact) {
    if (!el) return;
    var head = '<div class="kicker">' + esc(t("rKicker")) + '</div><h2>' + esc(t("rH")) + "</h2>";
    el.innerHTML = head + '<p class="loading">…</p>';
    getRates().then(function (R) {
      el.innerHTML = head + (R.live && R.date ? '<div class="for">' + esc(t("rFor", { d: fmtDate(R.date) })) + "</div>" : "") + rateTable(R, compact) +
        (compact ? '<p class="small" style="margin:10px 0 0"><a href="/rates.html">' + esc(t("rAll")) + "</a> ›</p>" : "");
    });
  }

  /* ---------- chrome ---------- */
  var NAV = [["home", "/"], ["rates", "/rates.html"], ["board", "/currency-board.html"], ["som", "/som.html"], ["notices", "/notices.html"], ["banks", "/banks.html"], ["pubs", "/publications.html"], ["about", "/about.html"]];
  var NAVPAGE = { notice: "notices" };
  function logoSrc(white) {
    var b = LANG === "ru" ? "bankofirad-logo-cyrillic" : LANG === "ir" ? "bankofirad-logo-iradi" : "bankofirad-logo";
    if (white) b = LANG === "ru" ? "bankofirad-logo-cyrillic-white" : "bankofirad-logo-white";
    return "/assets/" + b + ".svg";
  }
  function chrome() {
    var top = $("#top"), bottom = $("#bottom"), cur = NAVPAGE[PAGE] || PAGE;
    if (top) {
      top.innerHTML =
        '<a class="skip" href="#main">' + esc(t("skip")) + "</a>" +
        '<div class="util"><div class="wrap"><a class="gov" href="' + GOV + '"><img src="/assets/state-emblem-160.png" alt="" width="20" height="20"><span class="full">' + esc(t("utilGov")) + '</span><span class="dot">&nbsp;·&nbsp;</span><span>iradgov.org</span></a>' +
        '<div class="right"><span class="clock" id="clock"></span><div class="langs" role="group" aria-label="' + esc(t("langLabel")) + '">' +
        LANGS.map(function (l) { return '<button type="button" data-lang="' + l + '" aria-pressed="' + (l === LANG) + '" lang="' + I.htmlLang[l] + '">' + esc(I.langs[l]) + "</button>"; }).join("") +
        "</div></div></div></div>" +
        '<div class="mast"><div class="wrap"><a class="logo" href="/"><img src="' + logoSrc(false) + '" alt="' + esc(t("siteName")) + '" width="279" height="62"></a>' +
        '<a class="peg" href="/rates.html" id="mastPeg"><span>' + esc(t("mastPegK")) + "</span><b>IS " + esc(fmtNum(PEG)) + " = US$1</b></a></div></div>" +
        '<nav class="nav" aria-label="' + esc(t("navLabel")) + '"><div class="wrap"><button class="burger" type="button" aria-expanded="false"><span class="bars"></span>' + esc(t("menu")) + '</button><ul class="menu">' +
        NAV.map(function (n) { return '<li><a href="' + n[1] + '"' + (n[0] === cur ? ' aria-current="page"' : "") + ">" + esc(t("nav_" + n[0])) + "</a></li>"; }).join("") +
        '</ul></div></nav><div class="horns" aria-hidden="true"></div>';
      $(".burger", top).addEventListener("click", function () {
        var nav = $(".nav", top), open = !nav.classList.contains("open");
        nav.classList.toggle("open", open); this.setAttribute("aria-expanded", open);
      });
      $$("[data-lang]", top).forEach(function (b) { b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); }); });
      tick();
      getRates().then(function (R) {
        var u = R.rows.filter(function (r) { return r.code === "USD"; })[0];
        var el = $("#mastPeg b"); if (el && u) el.textContent = "IS " + fmtNum(u.som) + " = US$1";
      });
    }
    if (bottom) {
      bottom.innerHTML =
        '<footer class="foot"><div class="wrap"><div class="cols">' +
        '<div><img class="flogo" src="' + logoSrc(true) + '" alt="' + esc(t("siteName")) + '" width="207" height="46"><address>' + t("footAddr") + "</address>" + '<a class="tulpar-ch" href="https://tulparapp.com/app/#sub=bankofirad" rel="noopener"><img src="/assets/tulpar.svg" alt="" width="22" height="22"><span>' + esc(t("footTulpar")) + "<small>@bankofirad</small></span></a></div>" +
        "<div><h4>" + esc(t("footBank")) + "</h4><ul>" +
        ["rates", "board", "som", "notices", "banks", "pubs", "about"].map(function (k) { return '<li><a href="' + navHref(k) + '">' + esc(t("nav_" + k)) + "</a></li>"; }).join("") +
        "</ul></div>" +
        "<div><h4>" + esc(t("footGov")) + '</h4><ul><li><a href="' + GOV + '">' + esc(t("footGovPortal")) + '</a></li><li><a href="https://e-irad.org/">' + esc(t("footServices")) + '</a></li><li><a href="/about.html#contact">' + esc(t("footContact")) + "</a></li></ul>" +
        '<p class="small" style="margin-top:14px;color:#a9bbb0">' + esc(t("footDirective")) + "</p></div></div>" +
        '<div class="fine"><span class="govline"><img src="/assets/state-emblem-160.png" alt="" width="22" height="22">' + esc(t("footCopy", { y: iradNow().getFullYear() })) + "</span><span>" + esc(t("footTime")) + "</span></div></div></footer>";
    }
  }
  function navHref(k) { for (var i = 0; i < NAV.length; i++) if (NAV[i][0] === k) return NAV[i][1]; return "/"; }
  var tickTimer;
  function tick() {
    var el = $("#clock"); if (!el) return;
    var d = iradNow();
    el.textContent = t("clock", { d: fmtDate(iradToday()), t: pad(d.getHours()) + ":" + pad(d.getMinutes()) });
    clearTimeout(tickTimer); tickTimer = setTimeout(tick, 30000);
  }

  /* ---------- static text ---------- */
  function staticText() {
    var P = (I.pages && I.pages[LANG]) || {};
    $$("[data-i18n]").forEach(function (el) {
      if (!origHTML.has(el)) origHTML.set(el, el.innerHTML);
      var k = el.getAttribute("data-i18n");
      el.innerHTML = LANG === "en" || P[k] == null ? origHTML.get(el) : P[k];
    });
    document.documentElement.lang = I.htmlLang[LANG];
    var tk = document.body.getAttribute("data-title");
    var name = t("siteName");
    if (tk != null) document.title = (tk && has("title_" + tk) && t("title_" + tk) ? t("title_" + tk) + " | " : "") + name;
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0 || l === LANG) return;
    LANG = l;
    try { localStorage.setItem("boi_lang", l); } catch (e) {}
    var u = new URL(location.href);
    if (u.searchParams.has("lang")) { u.searchParams.delete("lang"); history.replaceState(null, "", u.pathname + (u.search || "") + u.hash); }
    render();
  }

  /* ---------- notices ---------- */
  function noticeItem(n) {
    return '<li><div class="d">' + esc(numDate(n.date)) + '</div><div><div class="k">' + esc(tri(n.number)) + '</div><a class="t" href="/notice.html?id=' + encodeURIComponent(n.id) + '">' + esc(tri(n.title)) + "</a><p>" + esc(tri(n.summary)) + "</p></div></li>";
  }

  /* ---------- pages ---------- */
  var pages = {};

  pages.home = function () {
    rateWidget($("#rates"), true);
    getRates().then(function (R) {
      var u = R.rows.filter(function (r) { return r.code === "USD"; })[0];
      var el = $("#pegV"); if (el && u) el.textContent = fmtNum(u.som);
    });
    getJSON("/data/notices.json").then(function (d) {
      var el = $("#notices"); if (!el) return;
      var items = (d.notices || []).filter(function (x) { return x.home; }).sort(sortByDate).slice(0, 4);
      el.innerHTML = '<ul class="nlist">' + items.map(noticeItem).join("") + "</ul>";
    }).catch(function () { failBox($("#notices")); });
  };

  pages.rates = function () {
    var el = $("#ratesFull");
    if (el) {
      el.innerHTML = '<p class="loading">…</p>';
      getRates().then(function (R) {
        el.innerHTML = (R.live && R.date ? '<div class="for">' + esc(t("rFor", { d: fmtDate(R.date) })) + "</div>" : "") + rateTable(R, false);
        converter(R);
      });
    }
  };
  var convState = { amt: "100", from: "USD", to: "SOM" };
  function converter(R) {
    var box = $("#conv"); if (!box) return;
    var map = { SOM: { units: 1, som: 1 } };
    R.rows.forEach(function (r) { map[r.code] = r; });
    var codes = ["SOM"].concat(R.rows.map(function (r) { return r.code; }));
    if (!map[convState.from]) convState.from = "USD";
    if (!map[convState.to]) convState.to = "SOM";
    function opt(sel) { return codes.map(function (c) { return '<option value="' + c + '"' + (c === sel ? " selected" : "") + ">" + c + " · " + esc(c === "SOM" ? t("cur_SOM") : curName(c)) + "</option>"; }).join(""); }
    box.innerHTML =
      '<div class="conv"><div><label for="cvA">' + esc(t("cvAmt")) + '</label><input id="cvA" inputmode="decimal" value="' + esc(convState.amt) + '"></div><div></div><div></div>' +
      '<div><label for="cvF">' + esc(t("cvFrom")) + '</label><select id="cvF">' + opt(convState.from) + '</select></div><button type="button" class="swap" id="cvS" aria-label="' + esc(t("cvSwap")) + '">⇄</button>' +
      '<div><label for="cvT">' + esc(t("cvTo")) + '</label><select id="cvT">' + opt(convState.to) + "</select></div></div>" +
      '<div class="conv-out" id="cvO"></div><p class="small muted" style="margin:0">' + esc(t(R.live ? "cvNote" : "cvNoteOff")) + "</p>";
    function calc() {
      convState.amt = $("#cvA").value; convState.from = $("#cvF").value; convState.to = $("#cvT").value;
      var a = parseFloat(String(convState.amt).replace(/\s/g, "").replace(",", "."));
      var f = map[convState.from], g = map[convState.to], out = $("#cvO");
      if (!isFinite(a) || a < 0) { out.textContent = "—"; return; }
      var som = a * f.som / f.units, res = som / g.som * g.units;
      out.textContent = fmtNum(a, a % 1 ? 2 : 0) + " " + convState.from + " = " + fmtNum(res, res < 1 && res > 0 ? 4 : 2) + " " + convState.to;
    }
    $("#cvA").addEventListener("input", calc);
    $("#cvF").addEventListener("change", calc);
    $("#cvT").addEventListener("change", calc);
    $("#cvS").addEventListener("click", function () { var f = $("#cvF").value; $("#cvF").value = $("#cvT").value; $("#cvT").value = f; calc(); });
    calc();
  }

  pages.notices = function () {
    var el = $("#nlist"), fb = $("#nfilters"); if (!el) return;
    var kind = (location.hash || "").replace("#", "");
    if (["notice", "statement", "press"].indexOf(kind) < 0) kind = "all";
    getJSON("/data/notices.json").then(function (d) {
      var all = (d.notices || []).slice().sort(sortByDate);
      function draw() {
        fb.innerHTML = ["all", "notice", "statement", "press"].map(function (k) { return '<button type="button" data-k="' + k + '" aria-pressed="' + (k === kind) + '">' + esc(t("kind_" + k)) + "</button>"; }).join("");
        $$("button", fb).forEach(function (b) { b.addEventListener("click", function () { kind = b.getAttribute("data-k"); history.replaceState(null, "", kind === "all" ? location.pathname : "#" + kind); draw(); }); });
        var list = all.filter(function (n) { return kind === "all" || n.kind === kind; });
        el.innerHTML = list.length ? '<ul class="nlist">' + list.map(noticeItem).join("") + "</ul>" : '<p class="loading">' + esc(t("none")) + "</p>";
      }
      draw();
    }).catch(function () { failBox(el); });
  };

  pages.notice = function () {
    var el = $("#doc"); if (!el) return;
    var id = qs.get("id");
    getJSON("/data/notices.json").then(function (d) {
      var all = (d.notices || []).slice().sort(sortByDate);
      var n = all.filter(function (x) { return x.id === id; })[0];
      if (!n) {
        el.innerHTML = "<h1>" + esc(t("docMissingH")) + "</h1><p>" + esc(t("docMissing")) + '</p><p><a href="/notices.html">' + esc(t("backNotices")) + "</a></p>";
        document.title = t("docMissingH") + " | " + t("siteName");
        return;
      }
      var body = n.text && (n.text[LANG] || n.text.en) || [];
      var note = n.text && !n.text[LANG] ? '<div class="trnote">' + esc(t("trNote")) + "</div>" : "";
      var html = body.map(function (p) { return /^\s*<(ol|ul)/.test(p) ? p : "<p>" + p + "</p>"; }).join("");
      var i = all.indexOf(n), newer = all[i - 1], older = all[i + 1];
      el.innerHTML = '<img class="seal" src="/assets/bankofirad-mark.svg" alt="">' +
        '<div class="no">' + esc(tri(n.number)) + "</div><h1>" + esc(tri(n.title)) + '</h1><div class="meta"><span>' + esc(fmtDate(n.date)) + "</span><span>" + esc(t("kind1_" + n.kind)) + "</span>" +
        (n.status ? '<span class="status">' + esc(tri(n.status)) + "</span>" : "") + "</div>" + note +
        '<div class="body">' + html + "</div>" + (n.signed ? '<div class="sig">' + esc(tri(n.signed)) + "</div>" : "") + '<div class="horn-rule"></div>' +
        '<p class="small muted" style="margin-top:14px">' + esc(t("docPub")) + "</p>";
      $("#pager").innerHTML = '<span>' + (older ? '‹ <a href="/notice.html?id=' + encodeURIComponent(older.id) + '">' + esc(tri(older.title)) + "</a>" : "") + "</span><span>" +
        (newer ? '<a href="/notice.html?id=' + encodeURIComponent(newer.id) + '">' + esc(tri(newer.title)) + "</a> ›" : "") + "</span>";
      document.title = tri(n.title) + " | " + t("siteName");
    }).catch(function () { failBox(el); });
  };

  pages.banks = function () {
    var el = $("#register"); if (!el) return;
    getJSON("/data/banks.json").then(function (d) {
      var upd = $("#regUpd"); if (upd && d.updated) upd.textContent = t("regUpd", { d: fmtDate(d.updated) });
      el.innerHTML = (d.institutions || []).map(function (b) {
        var logo = b.logo ? '<img src="' + esc(tri(b.logo)) + '" alt="' + esc(tri(b.name)) + '">' : '<div class="txt">' + esc(tri(b.name)) + "</div>";
        var rows = [];
        rows.push([t("regClass"), t("class_" + b.class) + ' <span class="lic">' + esc(t("regLic")) + " " + esc(b.licence) + "</span>"]);
        if (b.established) rows.push([t("regEst"), esc(b.established)]);
        if (b.head_office) rows.push([t("regHO"), esc(tri(b.head_office))]);
        if (b.chairman) rows.push([t("regChair"), esc(tri(b.chairman))]);
        if (b.branches) rows.push([t("regBr"), esc(t("regBrV", { n: b.branches.total, t: b.branches.talas, nz: b.branches.nurzhan, i: b.branches.iyik }))]);
        if (b.offices) rows.push([t("regOff"), esc(tri(b.offices))]);
        rows.push([t("regClr"), esc(t(b.clearing ? "yes" : "no"))]);
        return '<div class="bank" id="' + esc(b.id) + '"><div class="lg">' + logo + "</div><div><h3>" + esc(tri(b.name)) + "</h3>" +
          '<div class="alt">' + esc(tri(b.note)) + '</div><dl class="kv">' + rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl></div></div>";
      }).join("");
    }).catch(function () { failBox(el); });
  };

  /* banknotes (specimen images, turn over on tap, larger view) */
  var NOTES = [];
  function noteSide(n, side) { return side === "back" ? n.back : n.front; }
  function noteAlt(n, side) { return t(side === "back" ? "noteAltBack" : "noteAltFront", { v: n.value, s: tri(noteSide(n, side)) }); }
  function noteCard(n, i) {
    var w = n.size[0], h = n.size[1];
    var cap = "<b>" + esc(t("noteCap", { v: n.value })) + "</b> " +
      '<span class="nsize">' + esc(t("noteSize", { w: w, h: h })) + "</span> · " + esc(t("noteColour", { c: tri(n.colour) })) +
      '<span class="nsub">' + esc(t("noteFront", { s: tri(n.front) })) + "</span>" +
      '<span class="nsub">' + esc(t("noteBack", { s: tri(n.back) })) + "</span>";
    if (n.portrait) cap += '<span class="nsub">' + esc(t("notePortrait")) + "</span>";
    if (n.added) cap += '<span class="nsub">' + esc(t("noteAdded")) + "</span>";
    cap += '<button type="button" class="nzoom" data-i="' + i + '">' + esc(t("noteZoom")) + "</button>";
    return '<figure class="note"><div class="nscale" style="width:' + (w / 150 * 100).toFixed(1) + '%">' +
      '<button type="button" class="nflip" data-i="' + i + '" aria-pressed="false" aria-label="' + esc(t("noteFlip", { v: n.value })) + '" style="aspect-ratio:' + w + " / " + h + '">' +
      '<span class="nflip-in">' +
      '<img class="nface nfront" src="' + esc(n.img.frontThumb) + '" alt="' + esc(noteAlt(n, "front")) + '" width="' + Math.round(w * 4.5) + '" height="' + Math.round(h * 4.5) + '" loading="lazy" decoding="async">' +
      '<img class="nface nback" src="' + esc(n.img.backThumb) + '" alt="' + esc(noteAlt(n, "back")) + '" width="' + Math.round(w * 4.5) + '" height="' + Math.round(h * 4.5) + '" loading="lazy" decoding="async">' +
      "</span></button></div><figcaption>" + cap + "</figcaption></figure>";
  }
  var lb = { i: 0, side: "front", set: "notes" };
  function lbList() { return lb.set === "coins" ? COINS : NOTES; }
  function lightbox() {
    var d = $("#noteLb");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "noteLb";
      d.className = "lb";
      document.body.appendChild(d);
      d.addEventListener("click", function (e) {
        if (e.target === d) { d.close(); return; }
        var b = e.target.closest("button[data-act]"); if (!b) return;
        var a = b.getAttribute("data-act");
        if (a === "close") d.close();
        else if (a === "prev") lbGo(-1);
        else if (a === "next") lbGo(1);
        else lbOpen(lb.i, a);
      });
      d.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); lbGo(-1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); lbGo(1); }
      });
    }
    return d;
  }
  function lbGo(step) { var L = lbList(); lbOpen((lb.i + L.length + step) % L.length, lb.side); }
  function lbOpen(i, side) { if (lb.set === "coins") coinLb(i, side); else lbShow(i, side); }
  function lbShow(i, side) {
    var d = lightbox(), n = NOTES[i]; if (!n) return;
    lb.i = i; lb.side = side; lb.set = "notes";
    d.innerHTML = '<div class="lb-box"><div class="lb-top"><b>' + esc(t("noteCap", { v: n.value })) + "</b> <span>" + esc(t("noteSize", { w: n.size[0], h: n.size[1] })) + " · " + esc(t("noteColour", { c: tri(n.colour) })) + "</span>" +
      '<button type="button" class="lb-x" data-act="close" aria-label="' + esc(t("lbClose")) + '">×</button></div>' +
      '<div class="lb-img"><img src="' + esc(n.img[side]) + '" alt="' + esc(noteAlt(n, side)) + '" width="' + Math.round(n.size[0] * 12) + '" height="' + Math.round(n.size[1] * 12) + '"></div>' +
      '<div class="lb-bar"><button type="button" data-act="prev" aria-label="' + esc(t("lbPrev")) + '">‹</button>' +
      '<span class="lb-sides"><button type="button" data-act="front" aria-pressed="' + (side === "front") + '">' + esc(t("lbFront")) + "</button>" +
      '<button type="button" data-act="back" aria-pressed="' + (side === "back") + '">' + esc(t("lbBack")) + "</button></span>" +
      '<button type="button" data-act="next" aria-label="' + esc(t("lbNext")) + '">›</button></div>' +
      '<p class="lb-cap">' + esc(t(side === "back" ? "noteBack" : "noteFront", { s: tri(noteSide(n, side)) })) + "</p></div>";
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
    var f = $('[data-act="' + side + '"]', d); if (f) f.focus();
  }
  /* coins: photographs of struck coins (obverse, reverse, edge), shown at relative size, turn over on tap */
  var COINS = [], COIN_MAX = 24.5;
  function dec(x) { return fmtNum(x, x % 1 === 0 ? 0 : (Math.round(x * 10) === x * 10 ? 1 : 2)); }
  function coinName(c) { return c.value + " " + t(c.unit === "som" ? "unitSom" : "unitTyiyn"); }
  function coinSub(c, side) { return side === "reverse" ? tri(c.reverse) : tri(c.obverse); }
  function coinAlt(c, side) { return t(side === "reverse" ? "coinAltRev" : side === "edge" ? "coinAltEdge" : "coinAltObv", { c: coinName(c), s: coinSub(c, side) }); }
  function coinSpec(c) { return t("coinSpec", { d: dec(c.d), t: dec(c.t), g: dec(c.g) }); }
  function coinMeta(c, up) { var s = t("coinMeta", { m: tri(c.alloy), e: t("edge_" + c.edge), y: c.year }); return up ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function coinCard(c, i) {
    var sizes = "(max-width: 680px) 45vw, 230px";
    function face(side, cls) {
      return '<img class="nface ' + cls + '" src="' + esc(c.img[side + "Thumb"]) + '" srcset="' + esc(c.img[side + "Thumb"]) + " 300w, " + esc(c.img[side]) + ' 900w" sizes="' + sizes + '" alt="' + esc(coinAlt(c, side)) + '" width="300" height="300" loading="lazy" decoding="async">';
    }
    var cap = "<b>" + esc(t("coinCap", { c: coinName(c) })) + "</b> " + '<span class="nsize">' + esc(coinSpec(c)) + "</span>" +
      '<span class="nsub">' + esc(coinMeta(c, true)) + "</span>" +
      '<span class="nsub">' + esc(t("coinObv", { s: tri(c.obverse) })) + "</span>" +
      '<span class="nsub">' + esc(t("coinRev", { s: tri(c.reverse) })) + "</span>" +
      '<button type="button" class="nzoom" data-c="' + i + '">' + esc(t("coinZoom")) + "</button>";
    return '<figure class="coin"><div class="cbox"><div class="cscale" style="width:' + (c.d / COIN_MAX * 100).toFixed(1) + '%">' +
      '<button type="button" class="nflip cflip" data-c="' + i + '" aria-pressed="false" aria-label="' + esc(t("coinFlip", { c: coinName(c) })) + '" style="aspect-ratio:1 / 1">' +
      '<span class="nflip-in">' + face("obverse", "nfront") + face("reverse", "nback") + "</span></button></div></div>" +
      "<figcaption>" + cap + "</figcaption></figure>";
  }
  function coinLb(i, side) {
    var d = lightbox(), c = COINS[i]; if (!c) return;
    lb.i = i; lb.side = side; lb.set = "coins";
    var sides = ["obverse", "reverse", "edge"], lab = { obverse: "lbObverse", reverse: "lbReverse", edge: "lbEdge" };
    d.innerHTML = '<div class="lb-box lb-coin"><div class="lb-top"><b>' + esc(t("coinCap", { c: coinName(c) })) + "</b> <span>" + esc(coinSpec(c)) + " · " + esc(coinMeta(c)) + "</span>" +
      '<button type="button" class="lb-x" data-act="close" aria-label="' + esc(t("lbClose")) + '">×</button></div>' +
      '<div class="lb-img"><img src="' + esc(c.img[side]) + '" alt="' + esc(coinAlt(c, side)) + '"></div>' +
      '<div class="lb-bar"><button type="button" data-act="prev" aria-label="' + esc(t("lbPrevCoin")) + '">‹</button>' +
      '<span class="lb-sides">' + sides.map(function (s) { return '<button type="button" data-act="' + s + '" aria-pressed="' + (side === s) + '">' + esc(t(lab[s])) + "</button>"; }).join("") + "</span>" +
      '<button type="button" data-act="next" aria-label="' + esc(t("lbNextCoin")) + '">›</button></div>' +
      '<p class="lb-cap">' + esc(side === "edge" ? t("coinEdgeCap", { e: t("edge_" + c.edge) }) : t(side === "reverse" ? "coinRev" : "coinObv", { s: coinSub(c, side) })) + "</p></div>";
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
    var f = $('[data-act="' + side + '"]', d); if (f) f.focus();
  }
  pages.som = function () {
    getJSON("/data/currency.json").then(function (d) {
      NOTES = d.banknotes;
      var el = $("#notes");
      if (el) {
        el.innerHTML = NOTES.map(noteCard).join("");
        el.onclick = function (e) {
          var f = e.target.closest(".nflip");
          if (f) { var on = !f.classList.contains("flipped"); f.classList.toggle("flipped", on); f.setAttribute("aria-pressed", String(on)); return; }
          var z = e.target.closest(".nzoom");
          if (z) { var i = +z.getAttribute("data-i"), card = $('.nflip[data-i="' + i + '"]', el); lbShow(i, card && card.classList.contains("flipped") ? "back" : "front"); }
        };
      }
      COINS = d.coins;
      var co = $("#coins");
      if (co) {
        co.innerHTML = COINS.map(coinCard).join("");
        co.onclick = function (e) {
          var f = e.target.closest(".cflip");
          if (f) { var on = !f.classList.contains("flipped"); f.classList.toggle("flipped", on); f.setAttribute("aria-pressed", String(on)); return; }
          var z = e.target.closest(".nzoom");
          if (z) { var i = +z.getAttribute("data-c"), card = $('.cflip[data-c="' + i + '"]', co); coinLb(i, card && card.classList.contains("flipped") ? "reverse" : "obverse"); }
        };
      }
      var lbd = $("#noteLb"); if (lbd && lbd.open) lbOpen(lb.i, lb.side);
    }).catch(function () { failBox($("#notes")); });
  };

  /* fixed-rate chart (one series, step line) */
  pages.board = function () {
    var el = $("#rateChart"); if (!el) return;
    var W = 760, H = 280, L = 48, R = 20, T = 20, B = 38;
    var x0 = 1993, x1 = 2027, y1 = 10;
    function X(y) { return L + (y - x0) / (x1 - x0) * (W - L - R); }
    function Y(v) { return T + (1 - v / y1) * (H - T - B); }
    var start = 1993.85, reset = 2008 + 75 / 365, now = 2026 + 295 / 365;
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("chAlt")) + '">';
    for (var v = 0; v <= 10; v += 2) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e4dcc4" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    [1993, 1998, 2003, 2008, 2013, 2018, 2023].forEach(function (y) { s += '<text x="' + X(y) + '" y="' + (H - 14) + '" text-anchor="middle">' + y + "</text>"; });
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#9aa59f"/>';
    s += '<line x1="' + X(reset) + '" x2="' + X(reset) + '" y1="' + T + '" y2="' + Y(0) + '" stroke="#B8902F" stroke-dasharray="3 4"/>';
    s += '<path d="M' + X(start) + " " + Y(5) + " H" + X(reset) + " V" + Y(8.4) + " H" + X(now) + '" fill="none" stroke="#0E4D3A" stroke-width="2.5" stroke-linejoin="round"/>';
    s += '<circle class="dot" cx="' + X(now) + '" cy="' + Y(8.4) + '" r="4.5" fill="#0E4D3A" stroke="#fffdf7" stroke-width="2"/>';
    s += '<text class="lab" x="' + (X(start) + 6) + '" y="' + (Y(5) - 9) + '">' + esc(fmtNum(5)) + " · 1993–2008</text>";
    s += '<text class="lab" x="' + (X(reset) + 8) + '" y="' + (Y(8.4) - 9) + '">' + esc(fmtNum(8.4)) + " · " + esc(t("chSince")) + "</text>";
    s += '<text x="' + (X(reset) - 6) + '" y="' + (T + 12) + '" text-anchor="end">' + esc(t("chReset")) + "</text>";
    s += '<rect class="hit" id="chHit" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '"/>';
    s += "</svg>";
    el.innerHTML = s + '<div class="tip" id="chTip"></div>';
    el.style.position = "relative";
    var svg = $("svg", el), tip = $("#chTip"), hit = $("#chHit");
    hit.addEventListener("mousemove", function (e) {
      var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      var yr = x0 + (px - L) / (W - L - R) * (x1 - x0);
      if (yr < start || yr > now) { tip.style.display = "none"; return; }
      var val = yr < reset ? 5 : 8.4;
      tip.textContent = Math.floor(yr) + ": " + fmtNum(val) + " " + t("chUnit");
      tip.style.display = "block";
      tip.style.left = Math.min(e.clientX - r.left + 12, r.width - 150) + "px";
      tip.style.top = (e.clientY - r.top - 34) + "px";
    });
    hit.addEventListener("mouseleave", function () { tip.style.display = "none"; });
  };

  pages.pubs = function () {
    $$(".pubs button[data-msg]").forEach(function (b) {
      b.onclick = function () { var m = document.getElementById(b.getAttribute("data-msg")); if (m) m.classList.toggle("on"); };
    });
  };

  function render() {
    chrome();
    staticText();
    if (pages[PAGE]) pages[PAGE]();
  }
  render();
})();
