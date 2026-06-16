/* =========================
   ずらししりとり用 50音順（公式）
   ========================= */

const KANA_LIST =
  "アイウエオ" +
  "カキクケコ" +
  "ガギグゲゴ" +
  "サシスセソ" +
  "ザジズゼゾ" +
  "タチツテト" +
  "ダヂヅデド" +
  "ナニヌネノ" +
  "ハヒフヘホ" +
  "バビブベボ" +
  "パピプペポ" +
  "マミムメモ" +
  "ヤユヨ" +
  "ラリルレロ" +
  "ワン";

/* =========================
   小文字・濁点・半濁点
   ========================= */

const SMALL_TO_LARGE = {
  "ァ": "ア", "ィ": "イ", "ゥ": "ウ", "ェ": "エ", "ォ": "オ",
  "ッ": "ツ", "ャ": "ヤ", "ュ": "ユ", "ョ": "ヨ", "ヮ": "ワ"
};

const DAKU_MAP = {
  "カ": "ガ", "キ": "ギ", "ク": "グ", "ケ": "ゲ", "コ": "ゴ",
  "サ": "ザ", "シ": "ジ", "ス": "ズ", "セ": "ゼ", "ソ": "ゾ",
  "タ": "ダ", "チ": "ヂ", "ツ": "ヅ", "テ": "デ", "ト": "ド",
  "ハ": "バ", "ヒ": "ビ", "フ": "ブ", "ヘ": "ベ", "ホ": "ボ"
};

const HANDAKU_MAP = {
  "ハ": "パ", "ヒ": "ピ", "フ": "プ", "ヘ": "ペ", "ホ": "ポ"
};

const REV_DAKU = {};
for (const k in DAKU_MAP) REV_DAKU[DAKU_MAP[k]] = k;

const REV_HANDAKU = {};
for (const k in HANDAKU_MAP) REV_HANDAKU[HANDAKU_MAP[k]] = k;

/* =========================
   基本ユーティリティ
   ========================= */

function toKatakana(text) {
  if (!text) return "";
  return text.replace(/[ぁ-ん]/g, c =>
    String.fromCharCode(c.charCodeAt(0) + 0x60)
  );
}

function getBaseChar(c, unifySmall, unifyDaku, unifyHandaku) {
  let res = unifySmall ? (SMALL_TO_LARGE[c] || c) : c;
  if (unifyDaku) res = REV_DAKU[res] || res;
  if (unifyHandaku) res = REV_HANDAKU[res] || res;
  return res;
}

function getCleanChar(w, pos, offset, unifySmall, unifyDaku, unifyHandaku) {
  const text = w.replace(/ー/g, "");
  if (!text) return "";
  try {
    const idx = pos === "head" ? offset : text.length - 1 - offset;
    const c = text[idx];
    return getBaseChar(c, unifySmall, unifyDaku, unifyHandaku);
  } catch {
    return "";
  }
}

/* =========================
   ずらし処理
   ========================= */

function shiftKana(c, n) {
  const idx = KANA_LIST.indexOf(c);
  if (idx === -1) return c;
  return KANA_LIST[(idx + n + KANA_LIST.length) % KANA_LIST.length];
}

/* =========================
   探索エンジン本体（DFS）
   ========================= */

function searchRoutes(d) {
  const maxLen = parseInt(d.max_len || 5, 10);

  const posShift = parseInt(d.pos_shift || 0, 10);
  const useShift = !!d.use_shift;
  const ksAbs = parseInt(d.ks_abs || 1, 10);

  const unifySmall = !!d.unify_small;
  const allowDaku = !!d.allow_daku;
  const allowHandaku = !!d.allow_handaku;

  const unifyScope = d.unify_scope || "all";
  const lenMode = d.len_mode || "free";
  const sortMode = d.sort_mode || "default";

  let targetTotalLen = d.ttl;
  if (!targetTotalLen || targetTotalLen === "0") targetTotalLen = null;
  else targetTotalLen = parseInt(targetTotalLen, 10);

  const timeoutEnabled = !!d.timeout_enabled;
  const timeoutSec = parseFloat(d.timeout_sec || 15);

  const limitEnabled = !!d.limit_enabled;
  const limit = d.limit && d.limit !== "0" ? parseInt(d.limit, 10) : 0;

  const excludeConjugate = !!d.exclude_conjugate;

  const connS = unifySmall && (unifyScope === "all" || unifyScope === "conn");
  const connD = allowDaku && (unifyScope === "all" || unifyScope === "conn");
  const connH = allowHandaku && (unifyScope === "all" || unifyScope === "conn");

  const filtS = unifySmall && (unifyScope === "all" || unifyScope === "filter");
  const filtD = allowDaku && (unifyScope === "all" || unifyScope === "filter");
  const filtH = allowHandaku && (unifyScope === "all" || unifyScope === "filter");

  const startWord = toKatakana(d.start_word || "").trim();

  const startChar = getCleanChar(toKatakana(d.start_char || ""), "head", 0, filtS, filtD, filtH);
  const endChar   = getCleanChar(toKatakana(d.end_char   || ""), "head", 0, filtS, filtD, filtH);

  const asc = (toKatakana(d.all_start_char || "").split(/[,、]/)
    .map(s => s.trim()).filter(Boolean)
    .map(c => getCleanChar(c, "head", 0, filtS, filtD, filtH)));

  const aec = (toKatakana(d.all_end_char || "").split(/[,、]/)
    .map(s => s.trim()).filter(Boolean)
    .map(c => getCleanChar(c, "head", 0, filtS, filtD, filtH)));

  const validCharsRaw = toKatakana(d.valid_chars || "").replace(/[、,]/g, "");
  const validChars = validCharsRaw ? new Set(validCharsRaw.split("")) : null;

  const excludeChars = toKatakana(d.exclude_chars || "").split(/[,、]/)
    .map(s => s.trim()).filter(Boolean)
    .map(c => getBaseChar(c, filtS, filtD, filtH));

  const banStartChars = toKatakana(d.ban_start_chars || "").split(/[,、]/)
    .map(s => s.trim()).filter(Boolean)
    .map(c => getBaseChar(c, filtS, filtD, filtH));

  const categories = d.categories || [];
  const redWords = new Set(d.red_words || []);
  const blueWords = new Set(d.blue_words || []);

  // 辞書収集
  let words = [];
  categories.forEach(c => {
    const arr = (window.DICTIONARY_MASTER && DICTIONARY_MASTER[c]) || [];
    words = words.concat(arr);
  });
  words = Array.from(new Set(words)).map(w => toKatakana(w));

  // 赤ワード除外
  words = words.filter(w => !redWords.has(w));

  // 単語ごとの情報
  const entries = [];
  for (const w of words) {
    const clean = w.replace(/ー/g, "");
    if (!clean) continue;

    // validChars 制約
    if (validChars) {
      let ok = true;
      for (const ch of clean) {
        if (!validChars.has(getBaseChar(ch, filtS, filtD, filtH))) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }

    // excludeChars 制約
    if (excludeChars.length > 0) {
      let bad = false;
      for (const ch of clean) {
        const b = getBaseChar(ch, filtS, filtD, filtH);
        if (excludeChars.includes(b)) {
          bad = true;
          break;
        }
      }
      if (bad) continue;
    }

    // 文字重複禁止
    if (d.char_limit_mode) {
      const seen = new Set();
      let dup = false;
      for (const ch of clean) {
        const b = getBaseChar(ch, filtS, filtD, filtH);
        if (seen.has(b)) {
          dup = true;
          break;
        }
        seen.add(b);
      }
      if (dup) continue;
    }

    /* =========================
       ★ must_char（必須文字）フィルタ
       ========================= */
    if (d.must_char) {
      const mustList = toKatakana(d.must_char)
        .split(/[,、]/)
        .map(s => s.trim())
        .filter(Boolean);

      let ok = true;
      for (const m of mustList) {
        if (!clean.includes(m)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }

    const head = getCleanChar(clean, "head", Math.max(0, posShift), connS, connD, connH);
    const tail = getCleanChar(clean, "tail", 0, connS, connD, connH);
    if (!head || !tail) continue;

    if (asc.length > 0 && !asc.includes(head)) continue;
    if (aec.length > 0 && !aec.includes(tail)) continue;

    if (banStartChars.length > 0) {
      const baseHead = getBaseChar(head, filtS, filtD, filtH);
      if (banStartChars.includes(baseHead)) continue;
    }

    entries.push({
      word: w,
      clean,
      head,
      tail,
      len: clean.length
    });
  }
    entries.push({
      word: w,
      clean,
      head,
      tail,
      len: clean.length
    });
  }

  // 50音ずらし適用（接続側）
  function shiftedTail(entry) {
    if (!useShift) return entry.tail;
    return shiftKana(entry.tail, ksAbs);
  }

  // インデックス
  const byHead = new Map();
  entries.forEach((e, idx) => {
    if (!byHead.has(e.head)) byHead.set(e.head, []);
    byHead.get(e.head).push(idx);
  });

  // 開始候補
  const startIndices = [];
  if (startWord) {
    const sw = toKatakana(startWord);
    entries.forEach((e, idx) => {
      if (e.word === sw) startIndices.push(idx);
    });
  } else if (startChar) {
    entries.forEach((e, idx) => {
      if (e.head === startChar) startIndices.push(idx);
    });
  } else {
    for (let i = 0; i < entries.length; i++) startIndices.push(i);
  }

  const routes = [];
  const used = new Array(entries.length).fill(false);
  const startTime = performance.now();
  const timeoutMs = timeoutSec * 1000;

  function dfs(idx, path, totalLen) {
    if (timeoutEnabled && performance.now() - startTime > timeoutMs) {
      return "timeout";
    }
    if (limitEnabled && limit > 0 && routes.length >= limit) {
      return "limit";
    }

    const e = entries[idx];
    const newPath = path.concat(e.word);
    const newLen = totalLen + e.len;

    if (lenMode === "fixed" && newPath.length > maxLen) return;
    if (targetTotalLen && newLen > targetTotalLen) return;

    const tailChar = shiftedTail(e);

    let okEnd = true;
    if (endChar && tailChar !== endChar) okEnd = false;
    if (lenMode === "fixed" && newPath.length !== maxLen) okEnd = false;
    if (targetTotalLen && newLen !== targetTotalLen) okEnd = false;

    if (okEnd) {
      routes.push(newPath.slice());
      if (limitEnabled && limit > 0 && routes.length >= limit) {
        return "limit";
      }
    }

    const nextList = byHead.get(tailChar) || [];
    for (const ni of nextList) {
      if (used[ni]) continue;
      if (excludeConjugate) {
        if (newPath.includes(entries[ni].word)) continue;
      }
      used[ni] = true;
      const r = dfs(ni, newPath, newLen);
      used[ni] = false;
      if (r === "timeout" || r === "limit") return r;
    }
  }

  for (const si of startIndices) {
    used[si] = true;
    const r = dfs(si, [], 0);
    used[si] = false;
    if (r === "timeout" || r === "limit") break;
  }

  if (sortMode === "kana") {
    routes.sort((a, b) => a.join("").localeCompare(b.join("")));
  } else if (sortMode === "len_asc") {
    routes.sort((a, b) => a.join("").length - b.join("").length);
  } else if (sortMode === "len_desc") {
    routes.sort((a, b) => b.join("").length - a.join("").length);
  } else if (sortMode === "random") {
    routes.sort(() => Math.random() - 0.5);
  }

  return { routes };
}

/* =========================
   辞書ボタンの色
   ========================= */

function getWordStyle(state) {
  if (state === 'red') return "background-color:#f43f5e;color:white;border-color:#e11d48;";
  if (state === 'blue') return "background-color:#2563eb;color:white;border-color:#1d4ed8;";
  return "";
}

/* =========================
   グローバル状態
   ========================= */

let currentRoutes = [];
let wordStates = {};

/* =========================
   初期化
   ========================= */

function init() {
  if (localStorage.ultraSettings) {
    const s = JSON.parse(localStorage.ultraSettings);

    const fields = [
      'sw','sc','asc','mc','ec','aec','exc','bsc','ml','ps','ks_abs','ttl',
      'sort_mode','unify_scope','copy_limit','valid_chars','len_mode',
      'timeout_sec','limit'
    ];
    fields.forEach(f => {
      if (s[f] !== undefined && document.getElementById(f))
        document.getElementById(f).value = s[f];
    });

    const checks = [
      'allow_daku','allow_handaku','char_limit_mode','auto_recovery','unify_small',
      'rt','use_shift','exclude_conjugate','timeout_enabled','limit_enabled',
      'realtime_enabled'
    ];
    checks.forEach(f => {
      if (s[f] !== undefined && document.getElementById(f))
        document.getElementById(f).checked = s[f];
    });

    if (s.dark_mode) document.documentElement.classList.add('dark');
    if (s.wordStates) wordStates = s.wordStates;
  }

  loadDictionaryUI();
}

/* =========================
   辞書 UI
   ========================= */

function loadDictionaryUI() {
  const cats = Array.from(document.querySelectorAll('input[name="cat"]:checked')).map(c => c.value);

  let words = [];
  cats.forEach(c => {
    words = words.concat((window.DICTIONARY_MASTER && DICTIONARY_MASTER[c]) || []);
  });
  words = Array.from(new Set(words)).sort();

  const list = document.getElementById('dict-list');
  if (!list) return;

  list.innerHTML = words.map(w => {
    const s = wordStates[w] || 'white';
    return `<button onclick="toggleWordState(this,'${w}')"
            class="p-2 rounded-lg border text-[10px] font-bold"
            style="${getWordStyle(s)}">${w}</button>`;
  }).join('');
}

function toggleWordState(btn, word) {
  const states = { white:'red', red:'blue', blue:'white' };
  wordStates[word] = states[wordStates[word] || 'white'];
  saveSettings();
  loadDictionaryUI();
}

function bulkSet(state) {
  const cats = Array.from(document.querySelectorAll('input[name="cat"]:checked')).map(c => c.value);
  cats.forEach(c => {
    ((window.DICTIONARY_MASTER && DICTIONARY_MASTER[c]) || []).forEach(w => { wordStates[w] = state; });
  });
  saveSettings();
  loadDictionaryUI();
}

/* =========================
   設定保存
   ========================= */

function saveSettings() {
  localStorage.ultraSettings = JSON.stringify({
    sw: sw.value, sc: sc.value, asc: asc.value, mc: mc.value, ec: ec.value,
    aec: aec.value, exc: exc.value, bsc: bsc.value, ml: ml.value,
    ps: ps.value, ks_abs: ks_abs.value, ttl: ttl.value,
    sort_mode: sort_mode.value, unify_scope: unify_scope.value,
    copy_limit: copy_limit.value, valid_chars: valid_chars.value,
    len_mode: (window.len_mode?.value || "free"),
    timeout_sec: timeout_sec.value, limit: limit.value,

    allow_daku: allow_daku.checked, allow_handaku: allow_handaku.checked,
    char_limit_mode: char_limit_mode.checked, auto_recovery: auto_recovery.checked,
    unify_small: unify_small.checked, rt: rt.checked, use_shift: use_shift.checked,
    exclude_conjugate: exclude_conjugate.checked,
    timeout_enabled: timeout_enabled.checked,
    limit_enabled: limit_enabled.checked,
    realtime_enabled: realtime_enabled.checked,

    dark_mode: document.documentElement.classList.contains('dark'),
    wordStates: wordStates
  });
}

function resetSettings() {
  localStorage.removeItem('ultraSettings');
  location.reload();
}

/* =========================
   実行
   ========================= */

function run() {
  const btn = document.getElementById('btn');
  btn.innerText = "EXPLORING...";
  btn.disabled = true;

  try {
    const body = {
      start_word: sw.value,
      start_char: sc.value,
      all_start_char: asc.value,
      must_char: mc.value,
      end_char: ec.value,
      all_end_char: aec.value,
      exclude_chars: exc.value,
      ban_start_chars: bsc.value,
      valid_chars: valid_chars.value,
      len_mode: (window.len_mode?.value || "free"),
      max_len: ml.value,
      pos_shift: parseInt(ps.value || 0),
      use_shift: use_shift.checked,
      ks_abs: parseInt(ks_abs.value),
      shift_mode: "abs",

      allow_daku: allow_daku.checked,
      allow_handaku: allow_handaku.checked,
      auto_recovery: auto_recovery.checked,
      char_limit_mode: char_limit_mode.checked,
      unify_small: unify_small.checked,
      round_trip: rt.checked,
      exclude_conjugate: exclude_conjugate.checked,

      timeout_enabled: timeout_enabled.checked,
      timeout_sec: parseFloat(timeout_sec.value),
      limit_enabled: limit_enabled.checked,
      limit: parseInt(limit.value),

      categories: Array.from(document.querySelectorAll('input[name="cat"]:checked')).map(c => c.value),
      red_words: Object.keys(wordStates).filter(k => wordStates[k] === 'red'),
      blue_words: Object.keys(wordStates).filter(k => wordStates[k] === 'blue'),

      ttl: ttl.value
    };

    const d = searchRoutes(body);
    currentRoutes = d.routes || [];
    display();

  } finally {
    btn.innerText = "Explore";
    btn.disabled = false;
  }
}

/* =========================
   結果表示
   ========================= */

function display() {
  const resEl = document.getElementById('res');
  if (!resEl) return;

  resEl.innerHTML = currentRoutes.map((rt, i) => `
    <div class="glass p-4 rounded-2xl">
      <div class="flex justify-between text-[10px] font-black text-slate-400">
        <span>#${i+1}</span>
        <button onclick="copyOne(${i})" class="text-blue-600">Copy</button>
      </div>
      <div class="font-bold text-sm">${rt.join(' → ')}</div>
      <div class="text-[9px] font-black text-blue-500">${rt.join('').length} letters</div>
    </div>
  `).join('');

  const statsEl = document.getElementById('stats');
  if (!statsEl) return;

  if (realtime_enabled.checked) {
    statsEl.innerText = `${currentRoutes.length} ROUTES FOUND`;
    statsEl.classList.remove('hidden');
  } else {
    statsEl.classList.add('hidden');
  }
}

/* =========================
   コピー
   ========================= */

function copyOne(i) {
  if (!currentRoutes[i]) return;
  navigator.clipboard.writeText(currentRoutes[i].join(' → '));
}

function copyTopN() {
  const n = parseInt(copy_limit.value);
  navigator.clipboard.writeText(
    currentRoutes.slice(0, n).map(rt => rt.join(' → ')).join('\n')
  );
}

/* =========================
   UI ユーティリティ
   ========================= */

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
  saveSettings();
}

function adjustVal(id, diff) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = parseInt(el.value || "0", 10);
  el.value = v + diff;
  saveSettings();
}

/* =========================
   起動
   ========================= */

window.onload = init;
