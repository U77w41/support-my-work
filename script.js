/* ==========================================================================
   Support My Work: UPI tip page
   Plain JavaScript, no build step. Runs as-is on GitHub Pages.
   ========================================================================== */
(function () {
  "use strict";

  // ---------- Configuration ----------
  var CONFIG = {
    vpa: "ujjwal.chowdhury@federal",
    payeeName: "Ujjwal Chowdhury",
    note: "support",
    currency: "INR",
    defaultAmount: 30,
    minAmount: 1,
    maxAmount: 100000 // standard UPI per-transaction cap
  };

  // Same key and values as the Stack theme on u77w41.github.io ("light" | "dark" | "auto"),
  // so the theme choice is shared between the main site and this page.
  var THEME_KEY = "StackColorScheme";

  // Backup copy of the QR library if cdnjs is unreachable.
  var QR_FALLBACK = {
    src: "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js",
    integrity: "sha512-6WOG76AXc8rlgtGYLGhDg7lIzZG2Cc+VrSamvgpeBYgxauGuoMua6uKll4OsZ0JvVSt12lRX/9uCmXzkt3/wfg=="
  };

  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    themeToggle: $("theme-toggle"),
    themeColor: document.querySelector('meta[name="theme-color"]'),
    amount: $("amount"),
    amountField: $("amount-field"),
    amountHelp: $("amount-help"),
    presets: Array.prototype.slice.call(document.querySelectorAll(".preset")),
    payButton: $("pay-button"),
    payLabel: $("pay-label"),
    payHint: $("pay-hint"),
    copyButton: $("copy-button"),
    copyLabel: document.querySelector("#copy-button .copy-label"),
    copyStatus: $("copy-status"),
    upiId: $("upi-id"),
    qrBox: $("qr-box"),
    qrCode: $("qr-code"),
    qrPlaceholder: $("qr-placeholder"),
    qrPlaceholderText: $("qr-placeholder-text"),
    qrAmount: $("qr-amount"),
    downloadButton: $("download-button"),
    toast: $("toast"),
    year: $("year")
  };

  var state = {
    amount: CONFIG.defaultAmount,
    valid: true,
    qrReady: typeof window.qrcode === "function",
    qrFailed: false,
    qr: null,
    lastQrText: ""
  };

  var isMobile = (function () {
    var ua = navigator.userAgent || "";
    var iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua) || iPadOS;
  })();

  // ==========================================================================
  // Theme
  // ==========================================================================
  var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function readSavedScheme() {
    try {
      var value = localStorage.getItem(THEME_KEY);
      return value === "light" || value === "dark" || value === "auto" ? value : "auto";
    } catch (e) {
      return "auto";
    }
  }

  function saveScheme(value) {
    try { localStorage.setItem(THEME_KEY, value); } catch (e) { /* storage blocked: theme still works for this visit */ }
  }

  function systemScheme() {
    return darkQuery && darkQuery.matches ? "dark" : "light";
  }

  var scheme = readSavedScheme();

  function isDark() {
    return scheme === "dark" || (scheme === "auto" && systemScheme() === "dark");
  }

  function applyTheme() {
    var dark = isDark();
    root.setAttribute("data-scheme", dark ? "dark" : "light");
    var label = dark ? "Switch to light mode" : "Switch to dark mode";
    els.themeToggle.setAttribute("aria-label", label);
    els.themeToggle.setAttribute("title", label);
    if (els.themeColor) els.themeColor.setAttribute("content", dark ? "#303030" : "#f5f5fa");
  }

  function toggleTheme() {
    scheme = isDark() ? "light" : "dark";
    applyTheme();
    // Mirror the main site: if the pick matches the OS setting, store "auto".
    if (scheme === systemScheme()) scheme = "auto";
    saveScheme(scheme);
  }

  function initTheme() {
    applyTheme();
    els.themeToggle.addEventListener("click", toggleTheme);

    if (darkQuery) {
      var onSystemChange = function () { applyTheme(); };
      if (darkQuery.addEventListener) darkQuery.addEventListener("change", onSystemChange);
      else if (darkQuery.addListener) darkQuery.addListener(onSystemChange);
    }

    // Keep other open tabs (including the main site) in sync.
    window.addEventListener("storage", function (e) {
      if (e.key === THEME_KEY) {
        scheme = readSavedScheme();
        applyTheme();
      }
    });

    // Turn on colour transitions only after the first paint.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add("theme-ready"); });
    });
  }

  // ==========================================================================
  // Amount parsing and formatting
  // ==========================================================================
  function parseAmount(raw) {
    var s = String(raw == null ? "" : raw).trim().replace(/^₹/, "").replace(/[,\s]/g, "");

    if (s === "") return { ok: false, message: "Enter an amount to continue. The minimum is ₹1." };
    if (s.charAt(0) === "-") return { ok: false, message: "The amount can't be negative." };
    if (!/^\d*\.?\d*$/.test(s) || s === ".") return { ok: false, message: "Use numbers only, like 30 or 99.50." };

    var decimals = s.split(".")[1];
    if (decimals && decimals.length > 2) return { ok: false, message: "Use at most two decimal places." };

    var value = Number(s);
    if (!isFinite(value)) return { ok: false, message: "Use numbers only, like 30 or 99.50." };
    if (value < CONFIG.minAmount) {
      return { ok: false, message: value === 0 ? "The amount can't be zero. The minimum is ₹1." : "The minimum amount is ₹1." };
    }
    if (value > CONFIG.maxAmount) return { ok: false, message: "UPI allows up to ₹1,00,000 in a single payment." };

    return { ok: true, value: Math.round(value * 100) / 100 };
  }

  function formatINR(value) {
    var hasPaise = Math.round(value * 100) % 100 !== 0;
    return "₹" + value.toLocaleString("en-IN", {
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  // upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>
  function buildUpiUri(amount) {
    var params = [
      "pa=" + encodeURIComponent(CONFIG.vpa).replace(/%40/g, "@"),
      "pn=" + encodeURIComponent(CONFIG.payeeName),
      "am=" + amount.toFixed(2),
      "cu=" + CONFIG.currency,
      "tn=" + encodeURIComponent(CONFIG.note)
    ];
    return "upi://pay?" + params.join("&");
  }

  // ==========================================================================
  // QR code
  // ==========================================================================
  function makeQr(text) {
    var qr = window.qrcode(0, "M"); // auto version, ~15% error correction
    qr.addData(text);
    qr.make();
    return qr;
  }

  function qrToSvg(qr) {
    var count = qr.getModuleCount();
    var path = "";

    // Merge horizontal runs of dark modules into single rectangles to keep the SVG small.
    for (var row = 0; row < count; row++) {
      var col = 0;
      while (col < count) {
        if (!qr.isDark(row, col)) { col++; continue; }
        var start = col;
        while (col < count && qr.isDark(row, col)) col++;
        path += "M" + start + " " + row + "h" + (col - start) + "v1h-" + (col - start) + "z";
      }
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + count + " " + count +
      '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
      '<rect width="' + count + '" height="' + count + '" fill="#ffffff"/>' +
      '<path d="' + path + '" fill="#000000"/></svg>';
  }

  // Size the QR so every module is a whole number of device pixels and at least
  // 4 modules of white quiet zone remain around it. Uneven, fractional modules are
  // the most common reason on-screen QR codes scan slowly.
  function fitQr() {
    var svg = els.qrCode.querySelector("svg");
    if (!svg || !state.qr) return;
    var count = state.qr.getModuleCount();
    var inner = Math.min(els.qrBox.clientWidth, els.qrBox.clientHeight);
    if (!inner) return;
    var dpr = window.devicePixelRatio || 1;
    var moduleDevicePx = Math.max(1, Math.floor((inner * dpr) / (count + 8)));
    var sizeCss = (moduleDevicePx * count) / dpr;
    svg.style.width = sizeCss + "px";
    svg.style.height = sizeCss + "px";
  }

  function renderQr(text) {
    if (!state.qrReady) return;
    if (text === state.lastQrText && state.qr) return;
    try {
      state.qr = makeQr(text);
      els.qrCode.innerHTML = qrToSvg(state.qr);
      state.lastQrText = text;
      fitQr();
    } catch (err) {
      state.qr = null;
      state.lastQrText = "";
      showQrPlaceholder("Couldn't draw the QR code. Use the button or the UPI ID instead.");
    }
  }

  function showQrPlaceholder(message) {
    els.qrBox.classList.add("is-disabled");
    els.qrPlaceholderText.textContent = message;
    els.qrPlaceholder.hidden = false;
  }

  function hideQrPlaceholder() {
    els.qrBox.classList.remove("is-disabled");
    els.qrPlaceholder.hidden = true;
  }

  function loadQrLibrary() {
    return new Promise(function (resolve, reject) {
      if (typeof window.qrcode === "function") return resolve();
      var script = document.createElement("script");
      script.src = QR_FALLBACK.src;
      script.integrity = QR_FALLBACK.integrity;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = function () {
        typeof window.qrcode === "function" ? resolve() : reject(new Error("QR library missing"));
      };
      script.onerror = function () { reject(new Error("QR library failed to load")); };
      document.head.appendChild(script);
    });
  }

  // Save the current QR as a PNG (handy on phones: open a UPI app and scan from the gallery).
  function downloadQr() {
    if (!state.valid || !state.qr) return;

    var qr = state.qr;
    var count = qr.getModuleCount();
    var quiet = 4;
    var scale = Math.max(8, Math.ceil(560 / (count + quiet * 2)));
    var qrPx = (count + quiet * 2) * scale;
    var footer = Math.round(scale * 9);

    var canvas = document.createElement("canvas");
    canvas.width = qrPx;
    canvas.height = qrPx + footer;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#111418";
    ctx.font = "700 " + Math.round(scale * 2.6) + "px Lato, -apple-system, 'Segoe UI', Arial, sans-serif";
    ctx.fillText(formatINR(state.amount) + " to " + CONFIG.payeeName, qrPx / 2, qrPx + scale * 2.2);
    ctx.fillStyle = "#4f5660";
    ctx.font = Math.round(scale * 2) + "px Menlo, Consolas, 'Courier New', monospace";
    ctx.fillText("UPI ID: " + CONFIG.vpa, qrPx / 2, qrPx + scale * 5.4);

    var fileName = "upi-support-ujjwal-" + String(state.amount).replace(".", "_") + ".png";

    var trigger = function (href, revoke) {
      var link = document.createElement("a");
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (revoke) setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
    };

    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (blob) trigger(URL.createObjectURL(blob), true);
        else trigger(canvas.toDataURL("image/png"), false);
      }, "image/png");
    } else {
      trigger(canvas.toDataURL("image/png"), false);
    }
  }

  // ==========================================================================
  // UI updates
  // ==========================================================================
  function setPayEnabled(enabled, uri, label) {
    if (enabled) {
      els.payButton.setAttribute("href", uri);
      els.payButton.removeAttribute("aria-disabled");
      els.payButton.removeAttribute("tabindex");
    } else {
      els.payButton.removeAttribute("href");
      els.payButton.setAttribute("aria-disabled", "true");
      els.payButton.setAttribute("tabindex", "-1");
    }
    els.payLabel.textContent = label;
  }

  function update() {
    var result = parseAmount(els.amount.value);
    state.valid = result.ok;

    els.amountField.classList.toggle("is-invalid", !result.ok);
    els.amount.setAttribute("aria-invalid", String(!result.ok));
    els.amountHelp.textContent = result.ok ? "" : result.message;

    els.presets.forEach(function (btn) {
      var pressed = result.ok && Number(btn.getAttribute("data-amount")) === result.value;
      btn.setAttribute("aria-pressed", String(pressed));
    });

    if (!result.ok) {
      setPayEnabled(false, null, "Pay via UPI App");
      els.qrAmount.textContent = "—";
      els.downloadButton.disabled = true;
      if (!state.qrFailed) showQrPlaceholder("Enter a valid amount to see the QR code");
      return;
    }

    state.amount = result.value;
    var pretty = formatINR(result.value);
    var uri = buildUpiUri(result.value);

    setPayEnabled(true, uri, "Pay " + pretty + " via UPI App");
    els.qrAmount.textContent = pretty;
    els.qrCode.setAttribute("aria-label", "UPI QR code to pay " + pretty + " to " + CONFIG.vpa);

    if (state.qrFailed) return;
    if (state.qrReady) {
      renderQr(uri);
      if (state.qr) {
        hideQrPlaceholder();
        els.downloadButton.disabled = false;
      }
    } else {
      els.downloadButton.disabled = true;
      showQrPlaceholder("Loading QR code…");
    }
  }

  // ==========================================================================
  // Copy UPI ID
  // ==========================================================================
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      area.remove();
      ok ? resolve() : reject(new Error("copy failed"));
    });
  }

  function selectUpiText() {
    var range = document.createRange();
    range.selectNodeContents(els.upiId);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  var copyTimer = null;
  function onCopy() {
    copyToClipboard(CONFIG.vpa).then(function () {
      els.copyButton.classList.add("is-copied");
      els.copyLabel.textContent = "Copied!";
      els.copyStatus.textContent = "UPI ID copied to clipboard";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () {
        els.copyButton.classList.remove("is-copied");
        els.copyLabel.textContent = "Copy UPI ID";
        els.copyStatus.textContent = "";
      }, 2000);
    }).catch(function () {
      selectUpiText();
      showToast("Couldn't copy automatically. The UPI ID is selected, so copy it with Ctrl+C or a long-press.");
    });
  }

  // ==========================================================================
  // Toast + deep-link fallback hint
  // ==========================================================================
  var toastTimer = null;
  function showToast(message, ms) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, ms || 5000);
  }

  // If nothing takes over the page shortly after tapping Pay, no UPI app handled the link.
  function onPayClick(event) {
    if (!state.valid) {
      event.preventDefault();
      els.amount.focus();
      return;
    }

    var leftPage = false;
    var mark = function () { leftPage = true; };
    window.addEventListener("blur", mark);
    window.addEventListener("pagehide", mark);
    document.addEventListener("visibilitychange", mark);

    setTimeout(function () {
      window.removeEventListener("blur", mark);
      window.removeEventListener("pagehide", mark);
      document.removeEventListener("visibilitychange", mark);
      if (leftPage || document.visibilityState !== "visible") return;
      showToast(isMobile
        ? "No UPI app opened? Copy the UPI ID, or save the QR image and scan it from your gallery."
        : "UPI apps live on phones. Scan the QR code with your phone to pay.", 6000);
    }, 1600);
  }

  // ==========================================================================
  // Init
  // ==========================================================================
  function initAmountFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromUrl = params.get("amount") || params.get("am");
      if (fromUrl && parseAmount(fromUrl).ok) {
        els.amount.value = String(parseAmount(fromUrl).value);
        return;
      }
    } catch (e) { /* ignore and keep the default */ }
    els.amount.value = String(CONFIG.defaultAmount);
  }

  function init() {
    initTheme();

    if (els.year) {
      els.year.textContent = String(Math.max(new Date().getFullYear(), 2026));
    }

    els.payHint.textContent = isMobile
      ? "Opens your UPI app with the amount and note already filled in."
      : "This button opens a UPI app on phones. On a computer, scan the QR code with your phone instead.";
    root.classList.toggle("is-mobile", isMobile);

    initAmountFromUrl();

    els.amount.addEventListener("input", update);
    els.amount.addEventListener("keydown", function (e) {
      if (e.key === "Enter") els.amount.blur();
    });
    els.amount.addEventListener("blur", function () {
      var result = parseAmount(els.amount.value);
      if (result.ok) els.amount.value = String(result.value); // tidy "030" or "30." into "30"
    });

    els.presets.forEach(function (btn) {
      btn.addEventListener("click", function () {
        els.amount.value = btn.getAttribute("data-amount");
        update();
      });
    });

    els.payButton.addEventListener("click", onPayClick);
    els.copyButton.addEventListener("click", onCopy);
    els.downloadButton.addEventListener("click", downloadQr);

    var resizeFrame = null;
    window.addEventListener("resize", function () {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(fitQr);
    });

    update();

    if (!state.qrReady) {
      loadQrLibrary().then(function () {
        state.qrReady = true;
        update();
      }).catch(function () {
        state.qrFailed = true;
        els.downloadButton.disabled = true;
        showQrPlaceholder("Couldn't load the QR code. Use the Pay button or the UPI ID instead.");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
