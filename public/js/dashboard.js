// ═════════════════════════════════════════════════════════════════════════════
// SEVAK Dashboard — Production Version
// Step-by-step complaint | AI word suggestions | Guided chat
// ═════════════════════════════════════════════════════════════════════════════

const CAT_ICONS = {
  Roads:'🛣️', Water:'💧', Electricity:'⚡', Garbage:'🗑️',
  Drainage:'🚿', Streetlight:'💡', Parks:'🌳', Noise:'📢', Other:'📋'
};

// ─── Smart prediction database ────────────────────────────────────────────────
const CONTEXT_DB = {
  Water: {
    triggers: ['water','tap','supply','pipeline','leak','pressure','tank','flow','jal'],
    completions: [
      ' is not coming for the past 3 days in our area',
      ' is leaking continuously from the main pipeline near the road',
      ' pressure is very low — overhead tanks cannot fill in the morning',
      ' has bad smell and discolouration, indicating contamination',
      ' pipeline has burst and is causing flooding on the street',
      ' connection is completely cut off without any prior notice',
      ' supply is limited to only 2 hours daily which is insufficient'
    ],
    words: ['pipeline leaking','no supply','contaminated','burst pipe','low pressure','waterlogged','tap not working']
  },
  Roads: {
    triggers: ['road','street','pothole','highway','damage','broken','crack','construction'],
    completions: [
      ' has multiple large potholes that are causing accidents daily',
      ' needs immediate repair as vehicles are getting damaged frequently',
      ' is completely unmotorable after the last heavy rain',
      ' has dangerous cracks and an uneven surface causing people to fall',
      ' was dug up for pipeline work but has not been repaired for months',
      ' is causing serious accidents especially at night due to no lighting'
    ],
    words: ['deep potholes','accident prone','unmotorable','dangerous cracks','needs repair','road dug up','no streetlight']
  },
  Electricity: {
    triggers: ['power','current','voltage','pole','wire','transformer','outage','electric'],
    completions: [
      ' outage has been going on for 4 hours without any prior notice',
      ' is fluctuating continuously and damaging household appliances',
      ' pole is dangerously tilted and may fall on nearby houses',
      ' wires are hanging very low and are a safety hazard for children',
      ' has been completely cut since yesterday evening without notice',
      ' transformer is making a loud noise and emits a burning smell'
    ],
    words: ['power cut','voltage fluctuation','sparking wire','no electricity','transformer fault','dangerous pole','appliances damaged']
  },
  Garbage: {
    triggers: ['garbage','trash','waste','dustbin','smell','dump','collection','sweeper','litter'],
    completions: [
      ' has not been collected for 5 days, creating a serious health hazard',
      ' is being dumped illegally at the street corner, blocking the footpath',
      ' bin is completely overflowing and spreading a foul smell everywhere',
      ' is attracting stray animals and creating a mosquito breeding ground',
      ' collection vehicle has not visited our area for over a week',
      ' is being openly burnt nearby, causing severe air pollution'
    ],
    words: ['not collected','overflowing bin','foul smell','illegal dumping','stray animals','burning garbage','health hazard']
  },
  Drainage: {
    triggers: ['drain','sewage','clog','block','overflow','manhole','sewer'],
    completions: [
      ' is completely clogged and dirty water is backing up into houses',
      ' is overflowing onto the street causing a serious health hazard',
      ' chamber cover is broken or missing, spreading foul smell in the area',
      ' is blocked due to garbage dumping and is not flowing at all',
      ' has been stagnant for over a week causing heavy mosquito breeding',
      ' was damaged during road construction and has still not been repaired'
    ],
    words: ['completely clogged','overflowing','stagnant water','manhole uncovered','sewage backup','drain blocked','flooding road']
  },
  Streetlight: {
    triggers: ['streetlight','street light','lamp','bulb','dark'],
    completions: [
      ' has not been working for 1 week making the area unsafe at night',
      ' is flickering continuously and is likely to stop working any day',
      ' pole is bent and leaning dangerously over the road',
      ' is absent making the area very unsafe for women returning late',
      ' is urgently needed at the turn ahead where accidents are happening',
      ' suddenly stopped working last night without any prior fault'
    ],
    words: ['not working','dark area','flickering light','bent pole','safety risk','women safety','accident spot']
  },
  Parks: {
    triggers: ['park','garden','tree','bench','swing','playground','fence'],
    completions: [
      ' is not maintained at all and is full of weeds and garbage',
      ' equipment is broken and poses a danger to children using it',
      ' is being misused for illegal activities during the night',
      ' has been locked and inaccessible to the public for several months',
      ' lighting is non-functional making it completely unsafe in the evening',
      ' is being encroached by vendors who are blocking walking paths'
    ],
    words: ['no maintenance','broken equipment','encroached','unsafe at night','weeds and garbage','locked park','no lighting']
  },
  Noise: {
    triggers: ['noise','loud','sound','music','dj','construction','factory','speaker'],
    completions: [
      ' disturbance at night is severely affecting the sleep of residents',
      ' from the nearby factory is harming the health of children and the elderly',
      ' level is well above the permissible limits throughout the day',
      ' from the event continues well past midnight, violating local rules',
      ' from the construction site starts as early as 5am every single day'
    ],
    words: ['late night noise','above legal limit','loudspeaker nuisance','factory noise','construction disturbance','DJ till midnight','sleep disrupted']
  },
  Other: {
    triggers: [],
    completions: [
      ' needs urgent attention from the concerned authorities immediately',
      ' is causing daily inconvenience to all residents in our locality',
      ' has been pending for many days without any action from the department',
      ' requires immediate inspection and repair by the concerned department'
    ],
    words: ['urgent action needed','no response','pending for days','causing inconvenience','immediate repair','authorities ignoring']
  }
};

// Chat domain guards
const NON_CIVIC_KEYWORDS = [
  'cricket','ipl','bollywood','movie','film','actor','actress','song',
  'recipe','food','restaurant','joke','funny','weather','stock market',
  'share price','prime minister','modi','rahul','election','vote','party',
  'congress','bjp','politics','dating','relationship','shopping','amazon',
  'flipkart','sports','football','tennis','hockey','news'
];

const CIVIC_KEYWORDS = [
  'water','road','pothole','electricity','power','garbage','trash','drain',
  'light','streetlight','park','sewage','noise','complaint','municipal',
  'civic','infrastructure','jal board','leak','pipeline','waste','sanitation',
  'sewer','manhole','maintenance','repair','broken','damage','smell'
];

// ═════════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════════
let user = null;
try {
  user = JSON.parse(localStorage.getItem('sevak_user') || 'null');
  if (!user || !user.email) throw new Error('invalid');
} catch (e) {
  window.location.href = '/';
}

// Helper for authorized API calls
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${user?.token || ''}`
});

let currentStep       = 1;
let formMap           = null;
let formMarker        = null;
let currentLat        = null;
let currentLng        = null;
let analyzedImageData = null;
let imageAnalysis     = null;
let currentComplaint  = null;
let selectedCategory  = '';
let predictionTimer   = null;
let currentPrediction = '';

// ═════════════════════════════════════════════════════════════════════════════
// INIT
// ═════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const name = user.username || user.name || 'User';
  document.getElementById('userNameDisplay').textContent = `Welcome, ${name}`;
  document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('formName').value = name;
  initChat();
  console.log('SEVAK Dashboard loaded | user:', user.email);
});

// ═════════════════════════════════════════════════════════════════════════════
// CHAT
// ═════════════════════════════════════════════════════════════════════════════
window.initChat = function () {
  const name = user.username || user.name || 'User';
  addBotMessage(
    `Namaskar ${name}! 🙏\n\nI'm **SEVAK**, your AI civic assistant.\n\nI handle only **municipal issues** — roads, water, electricity, garbage, drainage, streetlights, parks, and noise.\n\nHow can I help you today?`,
    [
      { text: '📸 File a Complaint', action: 'showFile'  },
      { text: '🔍 Track Complaint',  action: 'showTrack' },
      { text: '📑 My History',       action: 'showList'  }
    ]
  );
};

window.sendMessage = async function () {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  clearChatSuggestions();
  addUserMessage(text);
  await processMessage(text);
};

async function processMessage(text) {
  const lower = text.toLowerCase();

  // Block non-civic
  if (NON_CIVIC_KEYWORDS.some(kw => lower.includes(kw))) {
    addBotMessage(
      "I'm **SEVAK** — I only handle civic/municipal complaints like roads, water, electricity, and garbage.\n\nI cannot help with politics, entertainment, or personal topics. Would you like to file a civic complaint?",
      [{ text: '📸 File Complaint', action: 'showFile' }]
    );
    return;
  }

  // Greeting
  if (lower.match(/^(hi|hello|hey|namaste|namaskar|good morning|good afternoon|good evening|hii|helo)[\s!.,]*$/)) {
    addBotMessage(
      `Hello! 👋 I'm **SEVAK**, your civic assistant.\n\nWhat would you like to do?`,
      [
        { text: '📸 File a Complaint', action: 'showFile'  },
        { text: '🔍 Track Complaint',  action: 'showTrack' },
        { text: '📑 My History',       action: 'showList'  }
      ]
    );
    return;
  }

  // File complaint intent
  if (lower.match(/\b(file|new|report|register|submit|raise|lodge|add)\b/)) {
    addBotMessage(
      "I'll guide you through our **5-step complaint form**:\n\n📷 **Step 1** — Upload photo (AI analyzes)\n✍️ **Step 2** — Describe issue (AI suggests words)\n📍 **Step 3** — Pin your location\n👤 **Step 4** — Your contact details\n✅ **Step 5** — Review and submit\n\nReady?",
      [{ text: '📸 Start Filing', action: 'showFile' }]
    );
    return;
  }

  // Track intent
  if (lower.match(/\b(track|status|check|follow up|update|where is my)\b/)) {
    addBotMessage(
      "Sure! Enter your **SVK-XXXXXXXX** complaint ID to check the current status.",
      [{ text: '🔍 Open Tracker', action: 'showTrack' }]
    );
    return;
  }

  // History intent
  if (lower.match(/\b(history|my complaint|previous|past|list|all complaint)\b/)) {
    showPanel('list');
    loadMyComplaints();
    return;
  }

  // Direct ID lookup
  const idMatch = text.match(/SVK-[A-F0-9]{8}/i);
  if (idMatch) {
    trackComplaint(idMatch[0].toUpperCase());
    return;
  }

  // Civic keyword detected → guide to form
  if (CIVIC_KEYWORDS.some(kw => lower.includes(kw))) {
    const detected = detectCategory(lower);
    selectedCategory = detected;
    addBotMessage(
      `It sounds like you have a **${detected}** issue. Let me open the complaint form for you.\n\nI'll pre-select the category and use AI to help you write the description! 🤖`,
      [{ text: `📸 File ${detected} Complaint`, action: 'showFile' }]
    );
    return;
  }

  // AI fallback via Gemini
  showTyping();
  try {
    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: getHeaders(),
      body:    JSON.stringify({ messages: [{ role: 'user', content: text }] })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    hideTyping();
    addBotMessage(
      data.reply || "I can help with civic complaints — roads, water, electricity, garbage, and more. What issue are you facing?",
      [{ text: '📸 File Complaint', action: 'showFile' }]
    );
  } catch (err) {
    console.error('Chat API error:', err);
    hideTyping();
    addBotMessage(
      "I'm having trouble connecting right now. Would you like to file a complaint manually?",
      [{ text: '📸 File Complaint', action: 'showFile' }]
    );
  }
}

function detectCategory(text) {
  if (text.match(/water|tap|supply|pipeline|leak|jal|flood/)) return 'Water';
  if (text.match(/road|pothole|street|highway|crack/))          return 'Roads';
  if (text.match(/electricity|power|current|transformer|wire/)) return 'Electricity';
  if (text.match(/garbage|trash|waste|dustbin|dump/))           return 'Garbage';
  if (text.match(/drain|sewage|manhole|sewer|clog/))            return 'Drainage';
  if (text.match(/streetlight|street light|lamp|dark road/))    return 'Streetlight';
  if (text.match(/park|garden|tree|bench|playground/))          return 'Parks';
  if (text.match(/noise|loud|sound|music|dj|speaker/))          return 'Noise';
  return 'Other';
}

// Word suggestions in chat input
window.handleChatTyping = function (input) {
  const text = input.value.toLowerCase();
  if (text.length < 3) { clearChatSuggestions(); return; }
  const cat   = detectCategory(text);
  const db    = CONTEXT_DB[cat] || CONTEXT_DB['Other'];
  const chips = (db.words || []).filter(w => !text.includes(w.toLowerCase())).slice(0, 3);
  const c     = document.getElementById('chatWordSuggestions');
  if (c) c.innerHTML = chips.map(w =>
    `<span class="word-chip" onclick="appendToChat('${w.replace(/'/g,"\\'")}')">+ ${w}</span>`
  ).join('');
};

window.appendToChat = function (word) {
  const input = document.getElementById('chatInput');
  input.value = input.value.trimEnd() + ' ' + word;
  input.focus();
  handleChatTyping(input);
};

function clearChatSuggestions() {
  const c = document.getElementById('chatWordSuggestions');
  if (c) c.innerHTML = '';
}

// Message helpers
window.addUserMessage = function (text) {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'msg user';
  d.innerHTML = `
    <div class="msg-avatar">${(user.username || 'U')[0].toUpperCase()}</div>
    <div class="msg-content"><div class="msg-bubble">${escHtml(text)}</div></div>`;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
};

window.addBotMessage = function (text, actions = null) {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'msg bot';
  const fmt = text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FF6B00">$1</strong>')
    .replace(/\n/g, '<br>');
  const acts = actions
    ? `<div class="chat-actions">${actions.map(a =>
        `<button class="chat-action-btn" onclick="handleAction('${a.action}')">${a.text}</button>`
      ).join('')}</div>`
    : '';
  d.innerHTML = `
    <div class="msg-avatar">🏛️</div>
    <div class="msg-content"><div class="msg-bubble">${fmt}</div>${acts}</div>`;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
};

window.showTyping = function () {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'msg bot'; d.id = 'typingIndicator';
  d.innerHTML = `<div class="msg-avatar">🏛️</div>
    <div class="msg-content"><div class="msg-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div></div></div>`;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
};
window.hideTyping = () => document.getElementById('typingIndicator')?.remove();

window.handleAction = function (action) {
  if      (action === 'showFile')  { showPanel('file'); setTimeout(initFormMap, 200); }
  else if (action === 'showTrack') showPanel('track');
  else if (action === 'showList')  { showPanel('list'); loadMyComplaints(); }
};

// ═════════════════════════════════════════════════════════════════════════════
// PANELS
// ═════════════════════════════════════════════════════════════════════════════
window.showPanel = function (name) {
  document.getElementById('chatSection').classList.toggle('hidden', name !== 'chat');
  ['file','track','list'].forEach(p =>
    document.getElementById(p + 'Panel').classList.toggle('active', p === name)
  );
};

window.backToChat = function () {
  showPanel('chat');
  dismissPrediction();
};

// ═════════════════════════════════════════════════════════════════════════════
// STEP FLOW
// ═════════════════════════════════════════════════════════════════════════════
window.goToStep = function (n) {
  for (let i = 1; i <= 5; i++) {
    const si = document.getElementById('si-' + i);
    const sc = document.getElementById('sc-' + i);
    si.classList.remove('active','done');
    if      (i < n)  { si.classList.add('done');   sc.textContent = '✓'; }
    else if (i === n){ si.classList.add('active'); sc.textContent = i; }
    else              { sc.textContent = i; }
    if (i < 5) document.getElementById('sd-' + i).classList.toggle('done', i < n);
    document.getElementById('step-' + i).classList.toggle('active', i === n);
  }
  currentStep = n;
  if (n === 3) setTimeout(initFormMap, 150);
  if (n === 5) populateSummary();
  if (n === 2 && selectedCategory) setTimeout(() => selectCategory(selectedCategory), 100);
};

window.nextStep = function (current) {
  if (current === 2) {
    if (!selectedCategory) { showToast('⚠️ Please select a category'); return; }
    if (document.getElementById('formDescription').value.trim().length < 15) {
      showToast('⚠️ Please describe the issue (min 15 characters)'); return;
    }
  }
  if (current === 3 && !document.getElementById('formLocation').value.trim()) {
    showToast('⚠️ Please pin a location or use GPS'); return;
  }
  if (current === 4 && !document.getElementById('formName').value.trim()) {
    showToast('⚠️ Please enter your name'); return;
  }
  goToStep(current + 1);
};

window.prevStep = function (current) { goToStep(current - 1); };

window.selectCategory = function (cat) {
  selectedCategory = cat;
  document.querySelectorAll('.cat-tag').forEach(el =>
    el.classList.toggle('selected', el.textContent.trim().includes(cat))
  );
  updateWordChips(document.getElementById('formDescription')?.value || '', cat);
};

// ═════════════════════════════════════════════════════════════════════════════
// AI PREDICTION SYSTEM
// Shows BOTH:
//   1) 3 word chips  — short 2-4 word options, click to append, refreshes forever
//   2) 1 full sentence — complete next sentence suggestion, click to append
// Both refresh every time user types more OR clicks a chip/sentence
// ═════════════════════════════════════════════════════════════════════════════

let predictionAbortCtrl = null;

// Called on every keystroke in the textarea
window.smartPredict = function (textarea) {
  const text = textarea.value;
  const cat  = selectedCategory || detectCategory(text.toLowerCase());

  clearTimeout(predictionTimer);

  if (text.trim().length < 4) {
    hidePredictionBox();
    return;
  }

  // Show loading immediately so user sees AI is working
  showPredictionLoading();

  // Debounce — wait 400ms after user stops typing
  predictionTimer = setTimeout(() => {
    runPrediction(text, cat);
  }, 400);
};

// Main prediction — 3 chips + 3 sentences, refreshes on every keystroke/click
async function runPrediction(text, cat) {
  if (predictionAbortCtrl) predictionAbortCtrl.abort();
  predictionAbortCtrl = new AbortController();
  try {
    const res = await fetch('/api/predict', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ text: text.trim(), category: cat }),
      signal: predictionAbortCtrl.signal
    });
    if (!res.ok) throw new Error('predict failed');
    const data = await res.json();
    renderPredictions(data.phrases || [], data.sentences || []);
  } catch (err) {
    if (err.name === 'AbortError') return;
    const db = CONTEXT_DB[cat] || CONTEXT_DB['Other'];
    const lower = text.toLowerCase();
    const phrases   = (db.words || []).filter(w => !lower.includes(w.toLowerCase())).slice(0, 3);
    const sentences = (db.completions || []).filter(s => !lower.includes(s.substring(0,12).toLowerCase())).slice(0, 3);
    renderPredictions(phrases, sentences);
  }
}

// Render 3 word chips + 3 sentence suggestions
function renderPredictions(phrases, sentences) {
  const box     = document.getElementById('aiPredictionBox');
  const chipsEl = document.getElementById('predictionChips');
  const sentsEl = document.getElementById('predictionSentences');
  if (!box) return;

  // 3 word chips
  if (chipsEl) {
    chipsEl.innerHTML = phrases.length
      ? phrases.map((p, i) =>
          '<button class="pred-chip" data-phrase="' + escHtml(p) + '" onclick="acceptChip(this.dataset.phrase)">' +
          '<span class="pred-chip-num">' + (i+1) + '</span>' +
          '<span class="pred-chip-text">' + escHtml(p) + '</span></button>'
        ).join('')
      : '';
    chipsEl.style.display = phrases.length ? 'flex' : 'none';
  }

  // 3 full sentence suggestions
  if (sentsEl) {
    if (sentences.length > 0) {
      sentsEl.innerHTML =
        '<div class="pred-sents-label">📝 Click any sentence to add:</div>' +
        '<div class="pred-sents-list">' +
        sentences.map((s, i) =>
          '<div class="pred-sent-item" onclick="acceptSentenceEl(this)" data-sent="' + s.replace(/"/g, '&quot;') + '">' +
          '<span class="pred-sent-num">' + (i+1) + '</span>' +
          '<span class="pred-sent-text">' + escHtml(s) + '</span>' +
          '</div>'
        ).join('') +
        '</div>';
      sentsEl.style.display = 'block';
    } else {
      sentsEl.style.display = 'none';
    }
  }

  box.style.display = 'flex';
}

// Loading dots
function showPredictionLoading() {
  const box     = document.getElementById('aiPredictionBox');
  const chipsEl = document.getElementById('predictionChips');
  const sentsEl = document.getElementById('predictionSentences');
  if (!box) return;
  if (chipsEl) {
    chipsEl.innerHTML = '<span class="pred-loading"><span class="pred-dot"></span><span class="pred-dot"></span><span class="pred-dot"></span></span>';
    chipsEl.style.display = 'flex';
  }
  if (sentsEl) sentsEl.style.display = 'none';
  box.style.display = 'flex';
}

function hidePredictionBox() {
  const box = document.getElementById('aiPredictionBox');
  if (box) box.style.display = 'none';
  if (predictionAbortCtrl) predictionAbortCtrl.abort();
}

// Accept a word chip → append → fetch new predictions
window.acceptChip = function (phrase) {
  const ta = document.getElementById('formDescription');
  if (!ta) return;
  const cur = ta.value;
  ta.value = cur + (cur && !cur.endsWith(' ') ? ' ' : '') + phrase + ' ';
  ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length;
  const cat = selectedCategory || detectCategory(ta.value.toLowerCase());
  showPredictionLoading(); clearTimeout(predictionTimer);
  predictionTimer = setTimeout(() => runPrediction(ta.value, cat), 200);
};

// Accept full sentence from click on sentence element
window.acceptSentenceEl = function (el) {
  acceptSentence(el.dataset.sent || el.querySelector('.pred-sent-text').textContent);
};

// Accept full sentence string → append → fetch new predictions
window.acceptSentence = function (sentence) {
  const ta = document.getElementById('formDescription');
  if (!ta || !sentence) return;
  const cur = ta.value.trimEnd();
  const sep = cur.length > 0 && !cur.match(/[.!?,]$/) ? '. ' : ' ';
  ta.value = cur + sep + sentence.trim() + ' ';
  ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length;
  const cat = selectedCategory || detectCategory(ta.value.toLowerCase());
  showPredictionLoading(); clearTimeout(predictionTimer);
  predictionTimer = setTimeout(() => runPrediction(ta.value, cat), 200);
};

// Improve button — rewrites description professionally using AI
window.improveDescription = async function () {
  const ta  = document.getElementById('formDescription');
  const btn = document.getElementById('improveBtn');
  if (!ta || !ta.value.trim()) { showToast('⚠️ Write something first'); return; }

  const original = ta.value.trim();
  const cat = selectedCategory || detectCategory(original.toLowerCase());

  if (btn) { btn.textContent = '⏳ Improving...'; btn.disabled = true; }
  showToast('🤖 AI improving your description...');

  try {
    const res = await fetch('/api/improve', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ text: original, category: cat })
    });
    if (!res.ok) throw new Error('improve failed');
    const data = await res.json();

    if (data.improved && data.improved !== original) {
      // Store original for undo
      ta.dataset.original = original;
      ta.value = data.improved;
      showToast('✅ Description improved!');
      // Show undo option
      if (btn) {
        btn.textContent = '↩️ Undo';
        btn.disabled = false;
        btn.onclick = function() {
          ta.value = ta.dataset.original || original;
          btn.textContent = '✨ Improve';
          btn.onclick = window.improveDescription;
          showToast('↩️ Restored original');
          smartPredict(ta);
        };
      }
      smartPredict(ta);
    } else {
      showToast('ℹ️ Already looks good!');
      if (btn) { btn.textContent = '✨ Improve'; btn.disabled = false; }
    }
  } catch(err) {
    console.error('Improve error:', err);
    showToast('❌ Improve failed — check your connection');
    if (btn) { btn.textContent = '✨ Improve'; btn.disabled = false; }
  }
};

// Legacy
window.acceptPrediction  = () => hidePredictionBox();
window.acceptWordChip    = window.acceptChip;
window.dismissPrediction = () => hidePredictionBox();
window.handlePredictionKey = (e) => { if (e.key === 'Escape') hidePredictionBox(); };


// ═════════════════════════════════════════════════════════════════════════════
// IMAGE ANALYSIS
// ═════════════════════════════════════════════════════════════════════════════
window.analyzeImage = async function (input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('❌ Image too large — max 5MB'); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    analyzedImageData = base64;
    document.getElementById('uploadedImage').src = base64;
    document.getElementById('imagePreviewContainer').style.display = 'block';
    document.getElementById('uploadZone').style.display = 'none';
    showToast('🔍 AI analyzing image…');

    try {
      const res = await fetch('/api/analyze-image', {
        method:  'POST',
        headers: getHeaders(),
        body:    JSON.stringify({ filename: file.name, imageBase64: base64 })
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      imageAnalysis = data;

      document.getElementById('ai-cat').textContent  = `${CAT_ICONS[data.detectedCategory]||''} ${data.detectedCategory}`;
      document.getElementById('ai-sev').textContent  = data.severity;
      document.getElementById('ai-days').textContent = `${data.estimatedDays}d`;
      document.getElementById('aiImageResults').style.display = 'block';

      if (data.detectedCategory && data.detectedCategory !== 'Other') selectedCategory = data.detectedCategory;

      document.getElementById('formDescription').value =
        `${data.description}. Severity: ${data.severity}. Requires attention from ${data.department}. Est. resolution: ${data.estimatedDays} days.`;

      showToast(`✅ AI Detected: ${data.detectedCategory} — ${data.severity} severity`);
    } catch (err) {
      console.error('Image analysis error:', err);
      showToast('⚠️ Analysis failed — please describe manually');
    }
  };
  reader.readAsDataURL(file);
};

window.removeImage = function () {
  analyzedImageData = null; imageAnalysis = null;
  document.getElementById('imagePreviewContainer').style.display = 'none';
  document.getElementById('uploadZone').style.display = 'block';
  document.getElementById('aiImageResults').style.display = 'none';
  document.getElementById('imageInput').value = '';
};

// ═════════════════════════════════════════════════════════════════════════════
// MAP
// ═════════════════════════════════════════════════════════════════════════════
window.initFormMap = function () {
  if (formMap) { formMap.invalidateSize(); return; }
  formMap = L.map('formMap').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(formMap);
  formMap.on('click', e => setFormLocation(e.latlng.lat, e.latlng.lng));
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      p => { setFormLocation(p.coords.latitude, p.coords.longitude); formMap.setView([p.coords.latitude, p.coords.longitude], 15); },
      () => {}
    );
  }
};

window.setFormLocation = async function (lat, lng) {
  currentLat = lat; currentLng = lng;
  if (formMarker) formMap.removeLayer(formMarker);
  formMarker = L.marker([lat, lng]).addTo(formMap);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    const d = await r.json();
    document.getElementById('formLocation').value = d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    document.getElementById('formLocation').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

window.getFormLocation = function () {
  if (!navigator.geolocation) { showToast('❌ Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(
    p => { setFormLocation(p.coords.latitude, p.coords.longitude); formMap?.setView([p.coords.latitude, p.coords.longitude], 15); showToast('✅ Location captured!'); },
    () => showToast('❌ Unable to get location — please click the map')
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════════════════
function populateSummary() {
  const photoEl = document.getElementById('sum-photo');
  if (analyzedImageData) {
    photoEl.innerHTML = `<img src="${analyzedImageData}" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-top:8px">`;
  } else {
    photoEl.textContent = 'No photo uploaded (optional)';
    photoEl.style.color = 'var(--text-secondary)';
  }
  document.getElementById('sum-cat').textContent   = selectedCategory ? `${CAT_ICONS[selectedCategory]||''} ${selectedCategory}` : '—';
  document.getElementById('sum-desc').textContent  = document.getElementById('formDescription').value.trim() || '—';
  document.getElementById('sum-loc').textContent   = document.getElementById('formLocation').value.trim() || '—';
  document.getElementById('sum-name').textContent  = document.getElementById('formName').value.trim() || '—';
  document.getElementById('sum-phone').textContent = document.getElementById('formPhone').value.trim() || 'Not provided';
}

// ═════════════════════════════════════════════════════════════════════════════
// SUBMIT COMPLAINT
// ═════════════════════════════════════════════════════════════════════════════
window.submitFormComplaint = async function () {
  const name  = document.getElementById('formName').value.trim();
  const phone = document.getElementById('formPhone').value.trim();
  const desc  = document.getElementById('formDescription').value.trim();
  const loc   = document.getElementById('formLocation').value.trim();

  if (!name)                { showToast('⚠️ Name is required');                         return; }
  if (!desc || desc.length < 10) { showToast('⚠️ Description is too short');             return; }
  if (!loc)                 { showToast('⚠️ Location is required');                      return; }
  if (!selectedCategory)    { showToast('⚠️ Please select a category');                  return; }

  showToast('⏳ Submitting…');

  const urgMap  = { Water:'High', Roads:'Medium', Electricity:'High', Garbage:'Medium', Drainage:'Medium', Streetlight:'Low', Parks:'Low', Noise:'Medium', Other:'Medium' };
  const deptMap = { Water:'Jal Board / Water Supply Dept', Roads:'Public Works Department (PWD)', Electricity:'Electricity Board / DISCOM', Garbage:'Sanitation Department', Drainage:'Drainage Dept / City Engineer', Streetlight:'Electricity Department', Parks:'Parks & Recreation Dept', Noise:'Police Dept (Environment Wing)', Other:'Municipal Corporation' };
  const resMap  = { High:'24-48 hours', Medium:'3-5 days', Low:'7-10 days' };

  const urgency    = urgMap[selectedCategory]  || 'Medium';
  const department = deptMap[selectedCategory] || 'Municipal Corporation';
  const resolution = resMap[urgency];
  const now        = new Date();

  const payload = {
    username: user.username, userEmail: user.email, name, phone,
    description: desc, location: loc, lat: currentLat, lng: currentLng,
    category: selectedCategory, urgency, department, resolution,
    summary: desc.substring(0, 80) + (desc.length > 80 ? '…' : ''),
    image:     analyzedImageData || null,
    aiAnalysis: imageAnalysis    || null,
    status:    'Pending', createdAt: now.toISOString()
  };

  try {
    const res = await fetch('/api/complaints', {
      method:  'POST',
      headers: getHeaders(),
      body:    JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const { id } = await res.json();
    currentComplaint = { ...payload, id, dateStr: now.toLocaleString('en-IN') };

    // localStorage backup
    const mine = JSON.parse(localStorage.getItem('my_complaints') || '[]');
    mine.unshift(currentComplaint);
    localStorage.setItem('my_complaints', JSON.stringify(mine.slice(0, 50)));

    showSuccessModal(id);
    resetForm();

  } catch (err) {
    console.error('Submit error:', err);
    showToast('❌ ' + err.message);
  }
};

function resetForm() {
  document.getElementById('formDescription').value = '';
  document.getElementById('formLocation').value    = '';
  document.getElementById('formPhone').value       = '';
  selectedCategory = ''; analyzedImageData = null; imageAnalysis = null;
  currentLat = null; currentLng = null;
  if (formMarker && formMap) { formMap.removeLayer(formMarker); formMarker = null; }
  document.querySelectorAll('.cat-tag').forEach(el => el.classList.remove('selected'));
  removeImage(); dismissPrediction(); goToStep(1);
}

// ═════════════════════════════════════════════════════════════════════════════
// SUCCESS MODAL
// ═════════════════════════════════════════════════════════════════════════════
window.showSuccessModal = id => {
  document.getElementById('modalComplaintId').textContent = id;
  document.getElementById('successModal').classList.add('show');
};
window.closeSuccessModal = () => document.getElementById('successModal').classList.remove('show');
window.copyComplaintId = () => {
  navigator.clipboard.writeText(document.getElementById('modalComplaintId').textContent)
    .then(() => showToast('✅ Complaint ID copied!'));
};
window.downloadCurrentReport = () => { if (currentComplaint) generateAndDownloadReport(currentComplaint); };
window.viewMyComplaints = () => { closeSuccessModal(); showPanel('list'); loadMyComplaints(); };

// ═════════════════════════════════════════════════════════════════════════════
// TRACK
// ═════════════════════════════════════════════════════════════════════════════
window.submitTrack = function () {
  const id = document.getElementById('trackIdInput').value.trim().toUpperCase();
  if (!id) { showToast('⚠️ Please enter a complaint ID'); return; }
  trackComplaint(id);
};

window.trackComplaint = async function (id) {
  showPanel('track');
  document.getElementById('trackIdInput').value = id;
  const container = document.getElementById('trackResultContainer');
  container.innerHTML = `<div style="text-align:center;padding:50px;color:var(--text-secondary)">🔍 Looking up…</div>`;

  try {
    const res = await fetch(`/api/complaints/${id}`, {
      headers: { 'Authorization': `Bearer ${user?.token || ''}` }
    });
    if (!res.ok) throw new Error('Not found');
    const c = await res.json();
    currentComplaint = c;

    const sClass = c.status === 'Resolved' ? 'badge-resolved' : c.status === 'In Progress' ? 'badge-progress' : 'badge-pending';
    const uClass = c.urgency === 'High' ? 'badge-high' : c.urgency === 'Low' ? 'badge-low' : 'badge-medium';

    container.innerHTML = `
      <div class="card" style="margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <div style="font-size:11px;color:var(--saffron);font-weight:700;letter-spacing:1px;margin-bottom:6px;">COMPLAINT ID</div>
            <div style="font-size:22px;font-weight:700;color:white;font-family:'JetBrains Mono',monospace;letter-spacing:2px;">${c.id}</div>
          </div>
          <span class="badge ${sClass}">${c.status || 'Pending'}</span>
        </div>
        <div style="font-size:17px;font-weight:600;color:white;margin-bottom:14px;">${CAT_ICONS[c.category]||''} ${c.category}</div>
        <div style="color:var(--text-secondary);font-size:13px;line-height:1.7;margin-bottom:20px;">${escHtml(c.description||'')}</div>
        <div style="background:rgba(255,255,255,0.04);border-radius:14px;padding:16px;margin-bottom:20px;">
          <div class="info-row"><span class="info-key">Priority</span>      <span class="info-val"><span class="badge ${uClass}">${c.urgency}</span></span></div>
          <div class="info-row"><span class="info-key">Department</span>    <span class="info-val">${c.department||'—'}</span></div>
          <div class="info-row"><span class="info-key">Est. Resolution</span><span class="info-val" style="color:var(--saffron)">${c.resolution||'TBD'}</span></div>
          <div class="info-row"><span class="info-key">Location</span>      <span class="info-val" style="max-width:200px;text-align:right;word-break:break-word">${c.location||'—'}</span></div>
          <div class="info-row"><span class="info-key">Filed On</span>      <span class="info-val">${new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn-secondary" style="flex:1"
            onclick="navigator.clipboard.writeText('${c.id}').then(()=>showToast('✅ ID copied!'))">📋 Copy ID</button>
          <button class="btn-primary" style="flex:1;padding:14px" onclick="downloadTrackReport()">⬇️ Download</button>
        </div>
      </div>`;
  } catch {
    container.innerHTML = `
      <div class="card" style="margin-top:20px;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);text-align:center;padding:50px;">
        <div style="font-size:44px;margin-bottom:14px;">🔍</div>
        <div style="color:white;font-size:18px;font-weight:600;margin-bottom:8px;">Not Found</div>
        <div style="color:var(--text-secondary);font-size:13px;">ID <strong style="color:white">"${id}"</strong> was not found. Please check and try again.</div>
      </div>`;
  }
};
window.downloadTrackReport = () => { if (currentComplaint) generateAndDownloadReport(currentComplaint); };

// ═════════════════════════════════════════════════════════════════════════════
// HISTORY
// ═════════════════════════════════════════════════════════════════════════════
window.loadMyComplaints = async function () {
  const container = document.getElementById('complaintsListContainer');
  container.innerHTML = `<div style="text-align:center;padding:50px;color:var(--text-secondary)">Loading…</div>`;

  try {
    const res = await fetch(`/api/complaints?email=${encodeURIComponent(user.email)}`, {
      headers: { 'Authorization': `Bearer ${user?.token || ''}` }
    });
    let complaints = res.ok ? await res.json() : [];
    if (!complaints.length) {
      const local = JSON.parse(localStorage.getItem('my_complaints') || '[]');
      complaints = local.filter(c => c.userEmail === user.email);
    }

    if (!complaints.length) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:60px;">
          <div style="font-size:56px;margin-bottom:18px;">📋</div>
          <div style="color:white;font-size:18px;font-weight:600;margin-bottom:8px;">No complaints yet</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-bottom:24px;">You haven't filed any complaints yet.</div>
          <button class="btn-primary" style="width:auto;padding:14px 28px;"
            onclick="showPanel('file');setTimeout(initFormMap,200)">📸 File First Complaint</button>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;text-align:center;">
        <strong style="color:var(--saffron)">${complaints.length}</strong> complaint${complaints.length !== 1 ? 's' : ''}
      </div>
      ${complaints.map(c => {
        const sC = c.status === 'Resolved' ? 'badge-resolved' : c.status === 'In Progress' ? 'badge-progress' : 'badge-pending';
        const uC = c.urgency === 'High' ? 'badge-high' : c.urgency === 'Low' ? 'badge-low' : 'badge-medium';
        return `
          <div class="complaint-card" onclick="trackComplaint('${c.id}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
              <div>
                <div style="font-size:11px;color:var(--saffron);font-weight:700;letter-spacing:1px;margin-bottom:4px;">${c.id}</div>
                <div style="font-size:16px;font-weight:600;color:white;">${CAT_ICONS[c.category]||''} ${c.category}</div>
              </div>
              <span class="badge ${sC}">${c.status || 'Pending'}</span>
            </div>
            <div style="color:var(--text-secondary);font-size:13px;margin-bottom:14px;line-height:1.6;">
              ${escHtml((c.description||'').substring(0,120))}${(c.description||'').length > 120 ? '…' : ''}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:12px;color:var(--text-secondary)">📅 ${new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                <span class="badge ${uC}" style="font-size:11px">${c.urgency}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                ${c.image ? '<span style="font-size:11px;color:#60a5fa">📷</span>' : ''}
                <button onclick="event.stopPropagation();downloadReportById('${c.id}')"
                  style="padding:5px 12px;border-radius:10px;background:var(--glass-bg);border:1px solid var(--glass-border);color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:'Sora',sans-serif;">
                  ⬇️ Report
                </button>
              </div>
            </div>
          </div>`;
      }).join('')}`;
  } catch (err) {
    console.error('Load complaints error:', err);
    container.innerHTML = `<div style="color:var(--error);text-align:center;padding:40px;">Failed to load. Please try again.</div>`;
  }
};

window.downloadReportById = async function (id) {
  try {
    const res = await fetch(`/api/complaints/${id}`, {
      headers: { 'Authorization': `Bearer ${user?.token || ''}` }
    });
    if (!res.ok) throw new Error('Not found');
    const c = await res.json();
    generateAndDownloadReport({ ...c, dateStr: new Date(c.createdAt).toLocaleString('en-IN') });
  } catch { showToast('❌ Could not download report'); }
};

// ═════════════════════════════════════════════════════════════════════════════
// REPORT
// ═════════════════════════════════════════════════════════════════════════════
window.generateAndDownloadReport = function (data) {
  const img = data.image
    ? `<img src="${data.image}" style="max-width:100%;max-height:350px;object-fit:cover;border-radius:12px">`
    : '<span style="color:rgba(255,255,255,0.5)">No photo uploaded</span>';
  const ai = data.aiAnalysis
    ? `<div class="row"><span class="lbl">AI Detected</span><span class="val">${data.aiAnalysis.detectedCategory||'—'}</span></div>
       <div class="row"><span class="lbl">Severity</span><span class="val">${data.aiAnalysis.severity||'—'}</span></div>
       <div class="row"><span class="lbl">Confidence</span><span class="val">${Math.round((data.aiAnalysis.confidence||0)*100)}%</span></div>` : '';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>SEVAK Report ${data.id}</title>
<style>body{font-family:'Segoe UI',sans-serif;max-width:720px;margin:40px auto;padding:32px;background:#090d22;color:rgba(255,255,255,0.9)}.head{background:linear-gradient(135deg,#FF6B00,#ff8c35);padding:32px;border-radius:16px;text-align:center;margin-bottom:28px}.logo{font-size:34px;font-weight:800;letter-spacing:2px;color:white}.id-box{background:rgba(255,107,0,0.1);border:1px solid rgba(255,107,0,0.3);border-radius:14px;padding:24px;text-align:center;margin-bottom:24px}.id-label{font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:2px;margin-bottom:8px}.id-val{font-size:30px;font-weight:700;color:#FF6B00;font-family:monospace;letter-spacing:3px}.sec{background:rgba(255,255,255,0.06);border-radius:14px;padding:24px;margin-bottom:18px;border:1px solid rgba(255,255,255,0.1)}.sec-title{color:#64b5f6;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:16px;text-transform:uppercase}.row{display:flex;gap:12px;margin-bottom:10px}.lbl{min-width:150px;color:rgba(255,255,255,0.6);font-size:13px;flex-shrink:0}.val{color:white;font-size:13px;font-weight:500}.footer{text-align:center;margin-top:36px;color:rgba(255,255,255,0.5);font-size:12px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1)}</style>
</head><body>
<div class="head"><div class="logo">सेवक SEVAK</div><div style="color:rgba(255,255,255,0.85);margin-top:6px">Official Civic Complaint Report</div></div>
<div style="text-align:right;color:rgba(255,255,255,0.5);font-size:12px;margin-bottom:18px">Generated: ${data.dateStr||new Date().toLocaleString('en-IN')}</div>
<div class="id-box"><div class="id-label">COMPLAINT REFERENCE NUMBER</div><div class="id-val">${data.id}</div></div>
<div class="sec"><div class="sec-title">Complainant</div>
  <div class="row"><span class="lbl">Name</span><span class="val">${data.name||'—'}</span></div>
  <div class="row"><span class="lbl">Email</span><span class="val">${data.userEmail||'—'}</span></div>
  <div class="row"><span class="lbl">Phone</span><span class="val">${data.phone||'Not provided'}</span></div>
</div>
<div class="sec"><div class="sec-title">Complaint Details</div>
  <div class="row"><span class="lbl">Category</span><span class="val">${CAT_ICONS[data.category]||''} ${data.category}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="val">${data.status}</span></div>
  <div class="row"><span class="lbl">Priority</span><span class="val">${data.urgency}</span></div>
  <div class="row"><span class="lbl">Department</span><span class="val">${data.department||'—'}</span></div>
  <div class="row"><span class="lbl">Est. Resolution</span><span class="val">${data.resolution||'TBD'}</span></div>
  <div class="row"><span class="lbl">Location</span><span class="val">${data.location||'—'}</span></div>
  <div class="row"><span class="lbl">Filed On</span><span class="val">${data.dateStr||new Date(data.createdAt).toLocaleString('en-IN')}</span></div>
</div>
<div class="sec"><div class="sec-title">Description</div>
  <div style="color:rgba(255,255,255,0.9);font-size:14px;line-height:1.8">${data.description||'—'}</div>
</div>
${ai ? `<div class="sec"><div class="sec-title">AI Analysis</div>${ai}</div>` : ''}
<div class="sec"><div class="sec-title">Photo Evidence</div><div style="margin-top:8px">${img}</div></div>
<div class="footer"><strong style="color:#FF6B00;font-size:14px">SEVAK — AI-Powered Civic Portal</strong><br>Computer-generated document. Valid without physical signature.</div>
</body></html>`;

  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `SEVAK_Report_${data.id}.html`;
  a.click();
  showToast('✅ Report downloaded!');
};

// ═════════════════════════════════════════════════════════════════════════════
// UTILS
// ═════════════════════════════════════════════════════════════════════════════
window.showToast = function (msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};

window.logout = function () {
  localStorage.removeItem('sevak_user');
  window.location.href = '/';
};

function escHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
