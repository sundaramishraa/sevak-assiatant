// ═════════════════════════════════════════════════════════════════════════════
// SEVAK Dashboard — Guided Flow Version
// Features: Step-by-step complaint, AI word suggestions, Chat guidance
// ═════════════════════════════════════════════════════════════════════════════

const CAT_ICONS = {
  Roads:'🛣️', Water:'💧', Electricity:'⚡', Garbage:'🗑️',
  Drainage:'🚿', Streetlight:'💡', Parks:'🌳', Noise:'📢', Other:'📋'
};

// ─── Context DB for smart predictions ─────────────────────────────────────
const CONTEXT_DB = {
  Water: {
    triggers: ['water','tap','supply','pipeline','leak','pressure','tank','flow','jal'],
    completions: [
      ' is not coming for the past 3 days in our area',
      ' is leaking continuously from the pipeline near the main road',
      ' pressure is very low — tanks cannot fill during morning hours',
      ' has bad smell and colour, indicating contamination',
      ' pipeline has burst causing flooding on the street',
      ' connection is completely cut off without prior notice',
      ' supply is only for 2 hours daily which is insufficient'
    ],
    words: ['pipeline','leaking','no supply','contaminated','burst','low pressure','waterlogged']
  },
  Roads: {
    triggers: ['road','street','pothole','highway','damage','broken','crack','construction'],
    completions: [
      ' has multiple large potholes causing accidents daily',
      ' needs immediate repair — vehicles are getting damaged',
      ' is completely unmotorable after last rain',
      ' has dangerous cracks and uneven surface causing falls',
      ' was dug up for work but has not been repaired for months',
      ' is causing accidents especially at night with no lighting'
    ],
    words: ['potholes','accident','unmotorable','cracks','needs repair','dangerous','blocked']
  },
  Electricity: {
    triggers: ['power','current','voltage','pole','wire','transformer','light','outage','electric'],
    completions: [
      ' outage for past 4 hours without any prior notice',
      ' is fluctuating continuously and damaging home appliances',
      ' pole is dangerously leaning and may fall on houses',
      ' wires are hanging low — safety hazard for children',
      ' is completely cut since yesterday evening',
      ' transformer is making loud noise and smells burnt'
    ],
    words: ['power cut','fluctuation','transformer','sparking','no supply','dangerous wire']
  },
  Garbage: {
    triggers: ['garbage','trash','waste','dustbin','smell','dump','collection','sweeper','litter'],
    completions: [
      ' has not been collected for 5 days causing health hazard',
      ' is dumped illegally on the street corner blocking footpath',
      ' bin is overflowing and spreading foul smell everywhere',
      ' is attracting stray animals and mosquito breeding',
      ' collection vehicle has not come for over a week',
      ' is being burnt causing severe air pollution'
    ],
    words: ['not collected','overflowing bin','foul smell','illegal dumping','stray animals','burning waste']
  },
  Drainage: {
    triggers: ['drain','sewage','clog','block','overflow','manhole','sewer'],
    completions: [
      ' is clogged and dirty water is backing up into houses',
      ' is overflowing on the street causing serious health hazard',
      ' chamber cover is broken and spreading foul smell',
      ' is blocked due to garbage dumping by residents',
      ' is stagnant for a week causing mosquito breeding',
      ' line damaged during construction and still not repaired'
    ],
    words: ['clogged','overflowing','stagnant water','blocked drain','manhole open','sewage backup']
  },
  Streetlight: {
    triggers: ['streetlight','lamp','bulb','dark','light'],
    completions: [
      ' has been non-functional for 1 week making area unsafe at night',
      ' is flickering continuously and likely to fail soon',
      ' pole is damaged and leaning dangerously over the road',
      ' absence is making area unsafe for women late at night',
      ' is needed urgently at the turn — accidents are happening',
      ' stopped working suddenly last night'
    ],
    words: ['not working','dark area','flickering','pole damaged','safety risk','no street light']
  },
  Parks: {
    triggers: ['park','garden','tree','bench','swing','playground','fence'],
    completions: [
      ' is not maintained — full of weeds and garbage',
      ' equipment is broken and dangerous for children',
      ' is being used for illegal activities at night',
      ' is locked and not accessible to public for months',
      ' lights are non-functional making it unsafe in the evening',
      ' is encroached by vendors blocking walking paths'
    ],
    words: ['not maintained','broken equipment','encroached','unsafe','weeds','no lighting']
  },
  Noise: {
    triggers: ['noise','loud','sound','music','dj','construction','factory','speaker'],
    completions: [
      ' disturbance at night is affecting sleep of all residents',
      ' from factory is harming health of children and elderly',
      ' level is above permissible limits throughout the day',
      ' from events continues past midnight violating local rules',
      ' from construction work starts at 5am daily'
    ],
    words: ['loudspeaker','late night','above limit','construction noise','factory noise','DJ disturbance']
  },
  Other: {
    triggers: [],
    completions: [
      ' needs urgent attention from the authorities',
      ' is causing inconvenience to residents in our locality',
      ' has been pending for many days without any action',
      ' requires immediate repair by the concerned department'
    ],
    words: ['urgent','needs action','repair needed','inconvenience','pending','no response']
  }
};

// Civic keyword guard for chat
const NON_CIVIC_KEYWORDS = [
  'cricket','bollywood','movie','joke','recipe','stock','prime minister',
  'modi','election','vote','party','weather','ipl','song','actor','actress',
  'politics','dating','relationship','food','restaurant','shopping'
];

const CIVIC_KEYWORDS = [
  'water','road','pothole','electricity','garbage','drain','light','park',
  'sewage','noise','complaint','municipal','civic','infrastructure','pwm',
  'jal board','leak','pipeline','streetlight','waste','sanitation','sewer'
];

// ─── State ─────────────────────────────────────────────────────────────────
let user = null;
try {
  user = JSON.parse(localStorage.getItem('sevak_user') || 'null');
  if (!user) throw new Error('no user');
} catch (e) { window.location.href = '/'; }

let currentStep = 1;
let formMap = null;
let formMarker = null;
let currentLat = null;
let currentLng = null;
let analyzedImageData = null;
let imageAnalysisResults = null;
let currentComplaintData = null;
let selectedCategory = '';
let predictionDebounce = null;
let currentPrediction = '';

// ─── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const name = user.username || user.name || 'User';
  document.getElementById('userNameDisplay').textContent = `Welcome, ${name}`;
  document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('formName').value = name;
  initChat();
});

// ═════════════════════════════════════════════════════════════════════════════
// CHAT
// ═════════════════════════════════════════════════════════════════════════════

window.initChat = function() {
  const name = user.username || user.name || 'User';
  addBotMessage(
    `Namaskar ${name}! 🙏\n\nI'm **SEVAK**, your AI civic assistant. I only handle municipal issues like roads, water, electricity, sanitation, and more.\n\nHow can I help you today?`,
    [
      { text: '📸 File a Complaint', action: 'showFile' },
      { text: '🔍 Track Complaint', action: 'showTrack' },
      { text: '📑 My History', action: 'showList' }
    ]
  );
};

window.sendMessage = async function() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  document.getElementById('chatWordSuggestions').innerHTML = '';
  addUserMessage(text);
  await processMessage(text);
};

window.processMessage = async function(text) {
  const lower = text.toLowerCase();

  // Reject non-civic
  if (NON_CIVIC_KEYWORDS.some(k => lower.includes(k))) {
    addBotMessage(
      "I'm SEVAK, specialized only in **civic issues** — roads, water, electricity, garbage, drainage, streetlights, and parks.\n\nI can't help with entertainment, politics, or personal topics. Would you like to file a civic complaint?",
      [{ text: '📸 File Complaint', action: 'showFile' }]
    );
    return;
  }

  // Greetings
  if (lower.match(/^(hi|hello|hey|namaste|namaskar|good morning|good afternoon|good evening)[\s!.]*$/)) {
    addBotMessage(
      `Hello! 👋 I'm SEVAK, your civic complaint assistant.\n\nWhat would you like to do?`,
      [
        { text: '📸 File a Complaint', action: 'showFile' },
        { text: '🔍 Track Complaint', action: 'showTrack' },
        { text: '📑 My History', action: 'showList' }
      ]
    );
    return;
  }

  // File complaint
  if (lower.match(/file|new|report|register|submit|raise/)) {
    addBotMessage(
      "I'll guide you through a **step-by-step** complaint form:\n\n**Step 1** → Upload photo (AI analyzes it)\n**Step 2** → Describe issue (AI suggests words)\n**Step 3** → Pin location on map\n**Step 4** → Add your contact\n**Step 5** → Review & submit\n\nReady?",
      [{ text: '📸 Start Filing', action: 'showFile' }]
    );
    return;
  }

  // Track
  if (lower.match(/track|status|check|follow/)) {
    addBotMessage("Enter your **SVK-** complaint ID to check the current status.", [{ text: '🔍 Open Tracker', action: 'showTrack' }]);
    return;
  }

  // History
  if (lower.match(/history|my complaint|previous|past|list/)) {
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

  // Civic keyword → guide to file
  if (CIVIC_KEYWORDS.some(k => lower.includes(k))) {
    const category = detectCategory(lower);
    addBotMessage(
      `It sounds like you have a **${category}** issue. Let me guide you to file a complaint with all details.\n\nI'll help you fill in the description using AI word suggestions! 🤖`,
      [{ text: `📸 File ${category} Complaint`, action: 'showFile' }]
    );
    if (category !== 'Other') setTimeout(() => { selectedCategory = category; }, 200);
    return;
  }

  // General civic fallback — call AI
  showTyping();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }] })
    });
    const data = await res.json();
    hideTyping();
    addBotMessage(data.reply || "I can help with civic complaints — roads, water, electricity, garbage, drainage, etc.", [
      { text: '📸 File Complaint', action: 'showFile' }
    ]);
  } catch {
    hideTyping();
    addBotMessage("I'm having trouble connecting. Would you like to file a complaint manually?", [
      { text: '📸 File Complaint', action: 'showFile' }
    ]);
  }
};

function detectCategory(text) {
  if (text.match(/water|leak|tap|pipeline|jal/)) return 'Water';
  if (text.match(/road|pothole|street|highway/)) return 'Roads';
  if (text.match(/electricity|power|current|transformer|wire/)) return 'Electricity';
  if (text.match(/garbage|trash|waste|dustbin/)) return 'Garbage';
  if (text.match(/drain|sewage|manhole/)) return 'Drainage';
  if (text.match(/light|lamp|dark/)) return 'Streetlight';
  if (text.match(/park|garden|tree|bench/)) return 'Parks';
  if (text.match(/noise|loud|sound|music/)) return 'Noise';
  return 'Other';
}

// Word suggestions while typing in chat
window.handleChatTyping = function(input) {
  const text = input.value.toLowerCase();
  const container = document.getElementById('chatWordSuggestions');
  if (!text || text.length < 3) { container.innerHTML = ''; return; }

  const cat = detectCategory(text);
  const db = CONTEXT_DB[cat];
  if (!db) return;

  const words = db.words.filter(w => !text.includes(w.toLowerCase())).slice(0, 3);
  container.innerHTML = words.map(w =>
    `<span class="word-chip" onclick="appendToChat('${w}')">${w}</span>`
  ).join('');
};

window.appendToChat = function(word) {
  const input = document.getElementById('chatInput');
  input.value = input.value.trimEnd() + ' ' + word;
  input.focus();
  handleChatTyping(input);
};

// ─── Chat message helpers ──────────────────────────────────────────────────
window.addUserMessage = function(text) {
  const c = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `
    <div class="msg-avatar">${(user.username||'U')[0].toUpperCase()}</div>
    <div class="msg-content"><div class="msg-bubble">${escapeHtml(text)}</div></div>
  `;
  c.appendChild(div); c.scrollTop = c.scrollHeight;
};

window.addBotMessage = function(text, actions = null) {
  const c = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FF6B00">$1</strong>')
    .replace(/\n/g, '<br>');
  let actionsHtml = '';
  if (actions) {
    actionsHtml = `<div class="chat-actions">${
      actions.map(a => `<button class="chat-action-btn" onclick="handleAction('${a.action}')">${a.text}</button>`).join('')
    }</div>`;
  }
  div.innerHTML = `
    <div class="msg-avatar">🏛️</div>
    <div class="msg-content">
      <div class="msg-bubble">${formatted}</div>
      ${actionsHtml}
    </div>
  `;
  c.appendChild(div); c.scrollTop = c.scrollHeight;
};

window.showTyping = function() {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'msg bot'; d.id = 'typingIndicator';
  d.innerHTML = `<div class="msg-avatar">🏛️</div><div class="msg-content"><div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div></div>`;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
};
window.hideTyping = () => document.getElementById('typingIndicator')?.remove();

window.handleAction = function(action) {
  if (action === 'showFile') { showPanel('file'); setTimeout(initFormMap, 200); }
  else if (action === 'showTrack') showPanel('track');
  else if (action === 'showList') { showPanel('list'); loadMyComplaints(); }
};

// ═════════════════════════════════════════════════════════════════════════════
// PANELS
// ═════════════════════════════════════════════════════════════════════════════

window.showPanel = function(name) {
  document.getElementById('chatSection').classList.toggle('hidden', name !== 'chat');
  ['file','track','list'].forEach(p => {
    document.getElementById(p+'Panel').classList.toggle('active', p === name);
  });
};

window.backToChat = function() {
  showPanel('chat');
  dismissPrediction();
};

// ═════════════════════════════════════════════════════════════════════════════
// STEP-BY-STEP COMPLAINT FLOW
// ═════════════════════════════════════════════════════════════════════════════

window.goToStep = function(n) {
  // Update step UI
  for (let i = 1; i <= 5; i++) {
    const si = document.getElementById('si-' + i);
    const sc = document.getElementById('sc-' + i);
    si.classList.remove('active','done');
    if (i < n) { si.classList.add('done'); sc.textContent = '✓'; }
    else if (i === n) { si.classList.add('active'); sc.textContent = i; }
    else { sc.textContent = i; }

    if (i < 5) {
      document.getElementById('sd-' + i).classList.toggle('done', i < n);
    }

    document.getElementById('step-' + i).classList.toggle('active', i === n);
  }
  currentStep = n;

  // Initialise map on step 3
  if (n === 3) setTimeout(initFormMap, 100);

  // Populate summary on step 5
  if (n === 5) populateSummary();

  // Pre-select category if detected from chat
  if (n === 2 && selectedCategory) {
    setTimeout(() => selectCategory(selectedCategory), 100);
  }
};

window.nextStep = function(current) {
  // Validation
  if (current === 2) {
    if (!selectedCategory) { showToast('⚠️ Please select a category'); return; }
    const desc = document.getElementById('formDescription').value.trim();
    if (desc.length < 20) { showToast('⚠️ Please describe the issue (min 20 characters)'); return; }
  }
  if (current === 3) {
    if (!document.getElementById('formLocation').value.trim()) {
      showToast('⚠️ Please pin a location on the map or use GPS');
      return;
    }
  }
  if (current === 4) {
    if (!document.getElementById('formName').value.trim()) {
      showToast('⚠️ Please enter your name');
      return;
    }
  }
  goToStep(current + 1);
};

window.prevStep = function(current) { goToStep(current - 1); };

// ─── Category Selection ────────────────────────────────────────────────────
window.selectCategory = function(cat) {
  selectedCategory = cat;
  document.querySelectorAll('.cat-tag').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.cat-tag').forEach(el => {
    if (el.textContent.trim().includes(cat)) el.classList.add('selected');
  });
  // Update word suggestions
  updateWordSuggestions(document.getElementById('formDescription').value, cat);
};

// ═════════════════════════════════════════════════════════════════════════════
// AI TEXT PREDICTION (3 word chips + sentence completion)
// ═════════════════════════════════════════════════════════════════════════════

window.smartPredict = function(textarea) {
  const text = textarea.value;
  const cat = selectedCategory || detectCategory(text.toLowerCase());
  clearTimeout(predictionDebounce);
  predictionDebounce = setTimeout(() => {
    generatePrediction(text, cat);
    updateWordSuggestions(text, cat);
  }, 400);
};

function generatePrediction(text, cat) {
  if (text.length < 5) { dismissPrediction(); return; }
  if (text.trim().match(/[.!?]$/)) { dismissPrediction(); return; }

  const db = CONTEXT_DB[cat] || CONTEXT_DB['Other'];
  const lastWord = text.split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g,'');

  // Score completions by overlap
  const scored = db.completions.map(c => {
    let score = 0;
    c.toLowerCase().split(' ').forEach(w => { if (text.toLowerCase().includes(w)) score++; });
    return { text: c, score };
  }).sort((a,b) => b.score - a.score);

  const prediction = scored[0]?.text || db.completions[0];
  if (!prediction || text.toLowerCase().includes(prediction.toLowerCase().trim())) {
    dismissPrediction(); return;
  }

  currentPrediction = prediction;
  const box = document.getElementById('aiPredictionBox');
  const el = document.getElementById('predictionText');
  if (!box || !el) return;
  el.innerHTML = `<span class="typed">${escapeHtml(text)}</span><span class="suggestion">${escapeHtml(prediction)}</span>`;
  box.style.display = 'block';
}

function updateWordSuggestions(text, cat) {
  const db = CONTEXT_DB[cat] || CONTEXT_DB['Other'];
  const container = document.getElementById('wordSuggestions');
  if (!container) return;
  const chips = db.words.filter(w => !text.toLowerCase().includes(w.toLowerCase())).slice(0, 3);
  container.innerHTML = chips.map(w =>
    `<span class="word-chip" onclick="appendWord('${w}')">${w}</span>`
  ).join('');
}

window.appendWord = function(word) {
  const ta = document.getElementById('formDescription');
  const cur = ta.value;
  ta.value = cur + (cur.endsWith(' ') || !cur ? '' : ' ') + word + ' ';
  ta.focus();
  smartPredict(ta);
};

window.acceptPrediction = function() {
  const ta = document.getElementById('formDescription');
  if (!ta || !currentPrediction) return;
  ta.value = ta.value + (ta.value.endsWith(' ') ? '' : ' ') + currentPrediction;
  dismissPrediction();
  setTimeout(() => smartPredict(ta), 100);
  ta.focus();
};

window.dismissPrediction = function() {
  const box = document.getElementById('aiPredictionBox');
  if (box) box.style.display = 'none';
  currentPrediction = '';
};

window.handlePredictionKey = function(e) {
  if (e.key === 'Tab' && currentPrediction) { e.preventDefault(); acceptPrediction(); }
  else if (e.key === 'Escape') dismissPrediction();
  else if (e.key === 'ArrowRight' && currentPrediction) {
    const ta = e.target;
    if (ta.selectionStart === ta.value.length) { e.preventDefault(); acceptPrediction(); }
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// IMAGE ANALYSIS
// ═════════════════════════════════════════════════════════════════════════════

window.analyzeImage = async function(input) {
  if (!input.files?.[0]) return;
  const file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast('❌ Image too large (max 5MB)'); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    analyzedImageData = base64;

    // Show preview
    document.getElementById('uploadedImage').src = base64;
    document.getElementById('imagePreviewContainer').style.display = 'block';
    document.getElementById('uploadZone').style.display = 'none';

    showToast('🔍 AI analyzing image…');

    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, filename: file.name })
      });
      const analysis = await res.json();
      imageAnalysisResults = analysis;

      document.getElementById('ai-cat').textContent = `${CAT_ICONS[analysis.detectedCategory]||''} ${analysis.detectedCategory}`;
      document.getElementById('ai-sev').textContent = analysis.severity;
      document.getElementById('ai-days').textContent = `${analysis.estimatedDays}d`;
      document.getElementById('aiImageResults').style.display = 'block';

      // Pre-fill category and description
      if (analysis.detectedCategory && analysis.detectedCategory !== 'Other') {
        selectedCategory = analysis.detectedCategory;
      }
      const desc = `${analysis.description || 'Issue'} detected. Severity: ${analysis.severity}. Estimated resolution: ${analysis.estimatedDays} days. Requires attention from ${analysis.department || 'concerned department'}.`;
      document.getElementById('formDescription').value = desc;

      showToast(`✅ AI Detected: ${analysis.detectedCategory} (${analysis.severity} severity)`);
    } catch {
      showToast('⚠️ Image analysis failed — please describe manually');
    }
  };
  reader.readAsDataURL(file);
};

window.removeImage = function() {
  analyzedImageData = null;
  imageAnalysisResults = null;
  document.getElementById('imagePreviewContainer').style.display = 'none';
  document.getElementById('uploadZone').style.display = 'block';
  document.getElementById('aiImageResults').style.display = 'none';
  document.getElementById('imageInput').value = '';
};

// ═════════════════════════════════════════════════════════════════════════════
// MAP
// ═════════════════════════════════════════════════════════════════════════════

window.initFormMap = function() {
  if (formMap) { formMap.invalidateSize(); return; }
  formMap = L.map('formMap').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(formMap);
  formMap.on('click', e => setFormLocation(e.latlng.lat, e.latlng.lng));
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
      setFormLocation(p.coords.latitude, p.coords.longitude);
      formMap.setView([p.coords.latitude, p.coords.longitude], 15);
    }, () => {});
  }
};

window.setFormLocation = async function(lat, lng) {
  currentLat = lat; currentLng = lng;
  if (formMarker) formMap.removeLayer(formMarker);
  formMarker = L.marker([lat, lng]).addTo(formMap);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    const d = await r.json();
    document.getElementById('formLocation').value = d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch { document.getElementById('formLocation').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
};

window.getFormLocation = function() {
  if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(p => {
    setFormLocation(p.coords.latitude, p.coords.longitude);
    formMap?.setView([p.coords.latitude, p.coords.longitude], 15);
    showToast('✅ Location captured!');
  }, () => showToast('❌ Unable to get location'));
};

// ═════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

function populateSummary() {
  const img = analyzedImageData;
  const sumPhoto = document.getElementById('sum-photo');
  if (img) {
    sumPhoto.innerHTML = `<img src="${img}" class="summary-image">`;
  } else {
    sumPhoto.textContent = 'No photo uploaded (optional)';
    sumPhoto.style.color = 'var(--text-secondary)';
  }

  document.getElementById('sum-cat').textContent = selectedCategory ? `${CAT_ICONS[selectedCategory]||''} ${selectedCategory}` : '—';
  document.getElementById('sum-desc').textContent = document.getElementById('formDescription').value.trim() || '—';
  document.getElementById('sum-loc').textContent = document.getElementById('formLocation').value.trim() || '—';
  document.getElementById('sum-name').textContent = document.getElementById('formName').value.trim() || '—';
  document.getElementById('sum-phone').textContent = document.getElementById('formPhone').value.trim() || 'Not provided';
}

// ═════════════════════════════════════════════════════════════════════════════
// SUBMIT
// ═════════════════════════════════════════════════════════════════════════════

window.submitFormComplaint = async function() {
  const name   = document.getElementById('formName').value.trim();
  const phone  = document.getElementById('formPhone').value.trim();
  const desc   = document.getElementById('formDescription').value.trim();
  const loc    = document.getElementById('formLocation').value.trim();

  if (!name) { showToast('⚠️ Name required'); return; }
  if (!desc || desc.length < 10) { showToast('⚠️ Description too short'); return; }
  if (!loc) { showToast('⚠️ Location required'); return; }

  // Classify
  let category = selectedCategory;
  let urgency = 'Medium', dept = 'Municipal Corporation', resolution = '3-5 days';
  if (!category) {
    const r = await fetch('/api/classify', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ complaint: desc })
    });
    const d = await r.json();
    category = d.category || 'Other';
    urgency = d.urgency || 'Medium';
    dept = d.department || dept;
  } else {
    const urgMap = { Water:'High', Roads:'Medium', Electricity:'High', Garbage:'Medium', Drainage:'Medium', Streetlight:'Low', Parks:'Low', Noise:'Medium', Other:'Medium' };
    const deptMap = { Water:'Jal Board', Roads:'PWD', Electricity:'DISCOM', Garbage:'Sanitation Dept', Drainage:'City Engineer', Streetlight:'Electricity Board', Parks:'Parks Dept', Noise:'Police Dept', Other:'Municipal Corp' };
    const resMap = { High:'24-48 hours', Medium:'3-5 days', Low:'7-10 days' };
    urgency = urgMap[category] || 'Medium';
    dept = deptMap[category] || dept;
    resolution = resMap[urgency];
  }

  const now = new Date();
  const payload = {
    username: user.username, userEmail: user.email, name, phone,
    description: desc, location: loc, lat: currentLat, lng: currentLng,
    category, urgency, department: dept, resolution,
    summary: desc.substring(0, 60) + '…',
    image: analyzedImageData,
    aiAnalysis: imageAnalysisResults,
    status: 'Pending', createdAt: now.toISOString()
  };

  try {
    const res = await fetch('/api/complaints', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const { id } = await res.json();

    currentComplaintData = { ...payload, id, dateStr: now.toLocaleString('en-IN') };

    const mine = JSON.parse(localStorage.getItem('my_complaints') || '[]');
    mine.unshift(currentComplaintData);
    localStorage.setItem('my_complaints', JSON.stringify(mine));

    showSuccessModal(id);

    // Reset form
    document.getElementById('formDescription').value = '';
    document.getElementById('formLocation').value = '';
    selectedCategory = '';
    analyzedImageData = null; imageAnalysisResults = null;
    currentLat = null; currentLng = null;
    if (formMarker) { formMap.removeLayer(formMarker); formMarker = null; }
    document.querySelectorAll('.cat-tag').forEach(el => el.classList.remove('selected'));
    removeImage();
    goToStep(1);

  } catch { showToast('❌ Failed to submit — please try again'); }
};

// ═════════════════════════════════════════════════════════════════════════════
// SUCCESS MODAL
// ═════════════════════════════════════════════════════════════════════════════

window.showSuccessModal = function(id) {
  document.getElementById('modalComplaintId').textContent = id;
  document.getElementById('successModal').classList.add('show');
};
window.closeSuccessModal = function() {
  document.getElementById('successModal').classList.remove('show');
};
window.copyComplaintId = function() {
  const id = document.getElementById('modalComplaintId').textContent;
  navigator.clipboard.writeText(id).then(() => showToast('✅ ID copied!'));
};
window.downloadCurrentReport = function() {
  if (currentComplaintData) generateAndDownloadReport(currentComplaintData);
};
window.viewMyComplaints = function() {
  closeSuccessModal();
  showPanel('list');
  loadMyComplaints();
};

// ═════════════════════════════════════════════════════════════════════════════
// TRACK
// ═════════════════════════════════════════════════════════════════════════════

window.submitTrack = function() {
  const id = document.getElementById('trackIdInput').value.trim().toUpperCase();
  if (id) trackComplaint(id);
};

window.trackComplaint = async function(id) {
  showPanel('track');
  document.getElementById('trackIdInput').value = id;
  const container = document.getElementById('trackResultContainer');
  container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-secondary)">Loading…</div>`;

  try {
    const res = await fetch('/api/complaints/' + id);
    if (!res.ok) throw new Error('Not found');
    const c = await res.json();
    currentComplaintData = c;

    const statusClass = c.status === 'Resolved' ? 'badge-resolved' : c.status === 'In Progress' ? 'badge-progress' : 'badge-pending';
    const urgClass = c.urgency === 'High' ? 'badge-high' : c.urgency === 'Medium' ? 'badge-medium' : 'badge-low';

    container.innerHTML = `
      <div class="card" style="margin-top:20px">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
          <div>
            <div style="font-size:12px; color:var(--saffron); font-weight:700; letter-spacing:1px; margin-bottom:6px;">COMPLAINT ID</div>
            <div style="font-size:24px; font-weight:700; color:white; font-family:'JetBrains Mono',monospace; letter-spacing:2px;">${c.id}</div>
          </div>
          <span class="badge ${statusClass}">${c.status || 'Pending'}</span>
        </div>

        <div style="font-size:18px; font-weight:600; color:white; margin-bottom:16px;">${CAT_ICONS[c.category]||''} ${c.category}</div>
        <div style="color:var(--text-secondary); line-height:1.7; margin-bottom:20px; font-size:14px;">${c.description}</div>

        <div style="background:rgba(255,255,255,0.04); border-radius:14px; padding:16px; margin-bottom:20px;">
          <div class="info-row">
            <span class="info-key">Priority</span>
            <span class="info-val"><span class="badge ${urgClass}">${c.urgency}</span></span>
          </div>
          <div class="info-row">
            <span class="info-key">Department</span>
            <span class="info-val">${c.department}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Est. Resolution</span>
            <span class="info-val" style="color:var(--saffron)">${c.resolution || 'TBD'}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Location</span>
            <span class="info-val" style="max-width:200px; word-break:break-word; text-align:right;">${c.location || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Filed On</span>
            <span class="info-val">${new Date(c.createdAt).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</span>
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button onclick="navigator.clipboard.writeText('${c.id}').then(()=>showToast('✅ ID copied!'))" class="btn-secondary" style="flex:1">📋 Copy ID</button>
          <button onclick="downloadTrackReport()" class="btn-primary" style="flex:1; padding:14px;">⬇️ Download</button>
        </div>
      </div>
    `;
  } catch {
    container.innerHTML = `
      <div class="card" style="margin-top:20px; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.06); text-align:center; padding:40px;">
        <div style="font-size:40px; margin-bottom:14px;">🔍</div>
        <div style="color:white; font-size:18px; font-weight:600; margin-bottom:8px;">Not Found</div>
        <div style="color:var(--text-secondary); font-size:14px;">Complaint ID "<strong style="color:white">${id}</strong>" was not found. Please check and try again.</div>
      </div>
    `;
  }
};

window.downloadTrackReport = function() {
  if (currentComplaintData) generateAndDownloadReport(currentComplaintData);
};

// ═════════════════════════════════════════════════════════════════════════════
// HISTORY
// ═════════════════════════════════════════════════════════════════════════════

window.loadMyComplaints = async function() {
  const container = document.getElementById('complaintsListContainer');
  container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-secondary)">Loading…</div>`;

  try {
    const res = await fetch(`/api/complaints?email=${user.email}`);
    let complaints = res.ok ? await res.json() : [];
    if (!complaints.length) {
      const local = JSON.parse(localStorage.getItem('my_complaints') || '[]');
      complaints = local.filter(c => c.userEmail === user.email);
    }

    if (!complaints.length) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:60px;">
          <div style="font-size:56px; margin-bottom:18px;">📋</div>
          <div style="color:white; font-size:18px; font-weight:600; margin-bottom:8px;">No complaints yet</div>
          <div style="color:var(--text-secondary); font-size:14px; margin-bottom:24px;">You haven't filed any complaints. Start now!</div>
          <button class="btn-primary" style="width:auto; padding:14px 28px;" onclick="showPanel('file'); setTimeout(initFormMap,200)">📸 File First Complaint</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="color:var(--text-secondary); font-size:13px; margin-bottom:16px; text-align:center;">
        Showing <strong style="color:var(--saffron)">${complaints.length}</strong> complaint${complaints.length !== 1 ? 's' : ''}
      </div>
      ${complaints.map(c => {
        const statusClass = c.status === 'Resolved' ? 'badge-resolved' : c.status === 'In Progress' ? 'badge-progress' : 'badge-pending';
        return `
          <div class="complaint-card" onclick="trackComplaint('${c.id}')">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
              <div>
                <div style="font-size:12px; color:var(--saffron); font-weight:700; letter-spacing:1px; margin-bottom:4px;">${c.id}</div>
                <div style="font-size:17px; font-weight:600; color:white;">${CAT_ICONS[c.category]||''} ${c.category}</div>
              </div>
              <span class="badge ${statusClass}">${c.status || 'Pending'}</span>
            </div>
            <div style="color:var(--text-secondary); font-size:13px; margin-bottom:12px; line-height:1.6;">${(c.description||'').substring(0,100)}…</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; color:var(--text-secondary)">📅 ${new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
              <div style="display:flex; gap:8px; align-items:center;">
                ${c.image ? '<span style="font-size:12px; color:#60a5fa">📷 Photo</span>' : ''}
                <button onclick="event.stopPropagation(); generateAndDownloadReport(${JSON.stringify(JSON.stringify(c)).slice(1,-1)})" style="padding:5px 12px; border-radius:10px; background:var(--glass-bg); border:1px solid var(--glass-border); color:var(--text-secondary); font-size:12px; cursor:pointer; font-family:'Sora',sans-serif;">⬇️ Report</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    `;
  } catch {
    container.innerHTML = `<div style="color:var(--error); text-align:center; padding:40px;">Failed to load complaints</div>`;
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═════════════════════════════════════════════════════════════════════════════

window.generateAndDownloadReport = function(data) {
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
  const img = data.image ? `<img src="${data.image}" style="max-width:100%;max-height:350px;object-fit:cover;border-radius:12px;border:1px solid rgba(255,255,255,0.1)">` : '<span style="color:rgba(255,255,255,0.5)">No photo uploaded</span>';
  const ai = data.aiAnalysis ? `<p>AI detected: ${data.aiAnalysis.detectedCategory}, severity: ${data.aiAnalysis.severity}, confidence: ${Math.round((data.aiAnalysis.confidence||0)*100)}%</p>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SEVAK Report ${data.id}</title>
<style>body{font-family:'Segoe UI',sans-serif;max-width:720px;margin:40px auto;padding:32px;background:#090d22;color:rgba(255,255,255,0.9)}.head{background:linear-gradient(135deg,#FF6B00,#ff8c35);padding:32px;border-radius:16px;text-align:center;margin-bottom:28px}.logo{font-size:36px;font-weight:800;letter-spacing:2px;color:white}.id-box{background:rgba(255,107,0,0.1);border:1px solid rgba(255,107,0,0.3);border-radius:14px;padding:24px;text-align:center;margin-bottom:24px}.id-val{font-size:32px;font-weight:700;color:#FF6B00;font-family:monospace;letter-spacing:3px}.sec{background:rgba(255,255,255,0.06);border-radius:14px;padding:24px;margin-bottom:18px;border:1px solid rgba(255,255,255,0.1)}.sec-title{color:#64b5f6;font-size:14px;font-weight:700;letter-spacing:1px;margin-bottom:16px;text-transform:uppercase}.row{display:flex;gap:12px;margin-bottom:12px}.lbl{min-width:140px;color:rgba(255,255,255,0.6);font-size:13px}.val{color:white;font-size:13px;font-weight:500}.footer{text-align:center;margin-top:36px;color:rgba(255,255,255,0.5);font-size:12px}</style>
</head><body>
<div class="head"><div class="logo">सेवक SEVAK</div><div style="color:rgba(255,255,255,0.85);margin-top:6px">Official Civic Complaint Report</div></div>
<div style="text-align:right;color:rgba(255,255,255,0.5);font-size:12px;margin-bottom:18px">Generated: ${data.dateStr || new Date().toLocaleString('en-IN')}</div>
<div class="id-box"><div style="font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:2px;margin-bottom:8px">COMPLAINT REFERENCE</div><div class="id-val">${data.id}</div></div>
<div class="sec"><div class="sec-title">Complainant</div>
<div class="row"><span class="lbl">Name</span><span class="val">${data.name||'—'}</span></div>
<div class="row"><span class="lbl">Email</span><span class="val">${data.userEmail||'—'}</span></div>
<div class="row"><span class="lbl">Phone</span><span class="val">${data.phone||'Not provided'}</span></div>
</div>
<div class="sec"><div class="sec-title">Complaint Details</div>
<div class="row"><span class="lbl">Category</span><span class="val">${CAT_ICONS[data.category]||''} ${data.category}</span></div>
<div class="row"><span class="lbl">Status</span><span class="val">${data.status}</span></div>
<div class="row"><span class="lbl">Priority</span><span class="val">${data.urgency}</span></div>
<div class="row"><span class="lbl">Department</span><span class="val">${data.department}</span></div>
<div class="row"><span class="lbl">Est. Resolution</span><span class="val">${data.resolution||'TBD'}</span></div>
<div class="row"><span class="lbl">Location</span><span class="val">${data.location||'—'}</span></div>
</div>
<div class="sec"><div class="sec-title">Description</div><div style="color:rgba(255,255,255,0.9);font-size:14px;line-height:1.8">${data.description}</div></div>
${ai ? `<div class="sec"><div class="sec-title">AI Analysis</div><div style="color:rgba(255,255,255,0.8);font-size:13px">${ai}</div></div>` : ''}
<div class="sec"><div class="sec-title">Photo Evidence</div>${img}</div>
<div class="footer"><strong style="color:#FF6B00">SEVAK — AI-Powered Civic Portal</strong><br>Computer-generated document. Valid without signature.</div>
</body></html>`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], {type:'text/html'}));
  a.download = `SEVAK_Report_${data.id}.html`;
  a.click();
  showToast('✅ Report downloaded!');
};

// ═════════════════════════════════════════════════════════════════════════════
// UTILS
// ═════════════════════════════════════════════════════════════════════════════

window.showToast = function(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};

window.logout = function() {
  localStorage.removeItem('sevak_user');
  window.location.href = '/';
};

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

console.log('✅ SEVAK Dashboard v5 (Guided Flow) loaded');