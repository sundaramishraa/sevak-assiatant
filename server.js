const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'sevak_secret_key_2025';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════════
// MODEL CONFIG
// Current available Gemini models (2024-2026):
//   gemini-2.5-flash → fastest, best quality (if available)
//   gemini-1.5-flash → alternative if 2.5-flash unavailable
//   gemini-1.5-pro   → more capable but higher costs
//   gemini-1.0-pro   → legacy model, still available
// ═══════════════════════════════════════════════════════════════════
const GEMINI_MODEL       = 'gemini-2.5-flash';          // for chat & prediction
const GEMINI_VISION_MODEL = 'gemini-2.5-flash';         // for image analysis (supports vision)

const AI_CONFIG = {
  temperature: 0.3,
  top_p: 0.8,
  max_tokens: 500
};

// Initialize SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING');
const getModel = (name) => genAI.getGenerativeModel({ model: name });

// ═══════════════════════════════════════════════════════════════════
// STARTUP CHECKS
// ═══════════════════════════════════════════════════════════════════
console.log('✅ SEVAK Server starting...');
console.log('PORT       :', process.env.PORT || 3000);
console.log('MONGO_URI  :', process.env.MONGO_URI  ? '✅ Found' : '❌ MISSING');
console.log('GEMINI_KEY :', process.env.GEMINI_API_KEY ? '✅ Found' : '❌ MISSING');
console.log('MODEL      :', GEMINI_MODEL);

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is required. Add it to your .env or Render/Vercel environment variables.');
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY missing — AI features will use fallback responses.');
}

// ═══════════════════════════════════════════════════════════════════
// MONGODB
// ═══════════════════════════════════════════════════════════════════
mongoose.connect(process.env.MONGO_URI)
  .then(() => { console.log('✅ MongoDB Connected'); seedAdmin(); })
  .catch(err => { console.error('❌ MongoDB failed:', err.message); process.exit(1); });

// ─── Schemas ──────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  username:  { type: String, required: true },
  email:     { type: String, unique: true, required: true, lowercase: true },
  password:  { type: String, required: true },
  name:      String,
  role:      { type: String, enum: ['user', 'admin'], default: 'user' },
  phone:     String,
  createdAt: { type: Date, default: Date.now }
});

const complaintSchema = new mongoose.Schema({
  id:          { type: String, unique: true, required: true },
  username:    String,
  userEmail:   String,
  name:        String,
  phone:       String,
  description: String,
  location:    String,
  lat:         Number,
  lng:         Number,
  category:    String,
  urgency:     { type: String, enum: ['Low','Medium','High'], default: 'Medium' },
  department:  String,
  resolution:  String,
  summary:     String,
  image:       String,
  aiAnalysis: {
    detectedCategory: String,
    severity:         String,
    estimatedDays:    Number,
    confidence:       Number,
    description:      String,
    department:       String
  },
  status:    { type: String, enum: ['Pending','In Progress','Resolved','Closed'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

const User      = mongoose.model('User', userSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);

async function seedAdmin() {
  try {
    const exists = await User.findOne({ email: 'admin@sevak.gov' });
    if (!exists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin', email: 'admin@sevak.gov',
        password: hashedPassword, name: 'Administrator', role: 'admin'
      });
      console.log('✅ Admin created → admin@sevak.gov / admin123 (hashed)');
    }
  } catch (err) { console.error('Seed error:', err.message); }
}

// ═══════════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════════
app.get('/health', (req, res) => res.json({
  status: 'ok', message: 'SEVAK running 🚀',
  mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  model: GEMINI_MODEL,
  gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
}));

// ═══════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ error: 'Email is already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username, email: email.toLowerCase(),
      password: hashedPassword, name: username, role: 'user'
    });
    res.json({ success: true, message: 'Account created! Please login.',
      user: { username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { email: user.email, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, token,
      username: user.username, email: user.email,
      name: user.name || user.username, role: user.role, phone: user.phone || ''
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) { res.status(401).json({ error: 'Invalid or expired token.' }); }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  next();
};

// ═══════════════════════════════════════════════════════════════════
// CHAT — gemini-2.5-flash
// ═══════════════════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'No messages provided' });

    const userMessage = messages[messages.length - 1]?.content;
    if (!userMessage || typeof userMessage !== 'string')
      return res.status(400).json({ error: 'Invalid message format' });

    const lower = userMessage.toLowerCase();

    // Domain guard
    const NON_CIVIC = ['prime minister','modi','rahul','election','vote',
      'parliament','minister','congress','bjp','president of','chief minister',
      'cricket','ipl','bollywood','movie','actor','actress','sports',
      'football','hockey','recipe','joke','weather forecast','stock market',
      'share price','dating','relationship'];

    if (NON_CIVIC.some(kw => lower.includes(kw))) {
      return res.json({
        reply: "I'm SEVAK — your civic complaint assistant. I only help with municipal issues like roads, water, electricity, garbage, drainage, streetlights, parks, and noise. How can I help you with a civic complaint?",
        blocked: true
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ reply: "I can help you file civic complaints about roads, water, electricity, garbage, and more. What issue are you facing?", fallback: true });
    }

    const SYSTEM = `You are SEVAK (सेवक), an AI assistant EXCLUSIVELY for Indian municipal/civic complaints.
RULES:
1. ONLY discuss: Roads, Water, Electricity, Garbage, Drainage, Streetlights, Parks, Noise
2. Refuse any non-civic topic politely
3. Max 3 sentences. Be empathetic.
4. Detect category from user message, suggest filing a complaint`;

    const model = getModel(GEMINI_MODEL);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: SYSTEM + "\n\nUser: " + userMessage }] }],
      generationConfig: { temperature: AI_CONFIG.temperature, topP: AI_CONFIG.top_p, maxOutputTokens: AI_CONFIG.max_tokens }
    });

    const reply = result.response.text() || "I'm here to help with civic complaints. What issue are you facing?";
    res.json({ reply, model: GEMINI_MODEL });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.json({ reply: "I can help with civic complaints — roads, water, electricity, garbage, and more. What problem are you facing?", fallback: true });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// PREDICT — 3 word chips + 3 next sentences (continuous)
// Returns: { phrases:[...], sentences:[s1,s2,s3] }
// ═══════════════════════════════════════════════════════════════════
app.post('/api/predict', async (req, res) => {
  try {
    const { text = '', category = 'Other' } = req.body;
    if (!text || text.trim().length < 3) return res.json({ phrases: [], sentences: [] });

    if (process.env.GEMINI_API_KEY) {
      const prompt = `You are an AI writing assistant for an Indian civic complaint form.
Category: ${category}
Current text: "${text}"

Return ONLY valid JSON, no markdown:
{
  "phrases": ["2-4 word chip 1","2-4 word chip 2","2-4 word chip 3"],
  "sentences": [
    "Complete next sentence 1 (10-18 words, naturally continues current text)",
    "Complete next sentence 2 (10-18 words, different angle or detail)",
    "Complete next sentence 3 (10-18 words, adds urgency or impact)"
  ]
}
Rules:
- phrases: 3 short options, 2-4 words each, civic topic only
- sentences: 3 DIFFERENT complete sentences, each adding new detail
- sentences must continue from EXACTLY where current text ends
- do NOT repeat what is already in current text
- civic/municipal topics only: roads, water, electricity, garbage, drainage, noise, parks`;

      try {
        const model = getModel(GEMINI_MODEL);
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, topP: 0.92, maxOutputTokens: 300 }
        });
        
        const raw = result.response.text() || '{}';
        const clean  = raw.replace(/```json|```/g,'').trim();
        const parsed = JSON.parse(clean);
        if (parsed.phrases && parsed.sentences) {
          return res.json({
            phrases:   parsed.phrases.slice(0, 3),
            sentences: parsed.sentences.slice(0, 3),
            source: 'gemini'
          });
        }
      } catch(e) { console.warn('predict parse fail, using fallback'); }
    }

    // Rule-based fallback
    const BANKS = {
      Water:{
        phrases:['for 3 days','leaking badly','supply cut off','dirty water','health hazard','pipeline burst','since yesterday','very low pressure','not repaired','causing flooding'],
        sentences:[
          'The water supply has been completely cut off for the past 3 days causing severe inconvenience to residents.',
          'Dirty and contaminated water is flowing from the taps which is a serious health risk for children and elderly.',
          'We request immediate inspection and repair of the pipeline so that normal supply can be restored urgently.',
          'The pipeline burst is causing flooding on the road and damage to nearby houses and vehicles.',
          'Despite lodging multiple complaints earlier no action has been taken by the water supply department.',
          'The situation is becoming critical as people are forced to buy water at high cost from private vendors.'
        ]
      },
      Roads:{
        phrases:['causing accidents','needs urgent repair','potholes deep','blocked traffic','very dangerous','vehicles damaged','road dug up','not fixed yet','unsafe at night','residents affected'],
        sentences:[
          'The road has multiple deep potholes that have already caused several accidents and injured two-wheeler riders.',
          'Vehicles are getting severely damaged and residents are unable to use this road during rainy season.',
          'This road was dug up for drainage work months ago but has never been properly repaired or filled.',
          'We request the PWD to take immediate action and repair the road surface before more accidents occur.',
          'The broken road is causing huge traffic jams and even emergency vehicles are facing difficulty passing.',
          'Children going to school and senior citizens face extreme difficulty due to the terrible road condition.'
        ]
      },
      Electricity:{
        phrases:['since yesterday','power outage','wires sparking','pole damaged','no supply','damaging appliances','transformer fault','fluctuating badly','children at risk','urgent action'],
        sentences:[
          'There has been a complete power outage in our area since yesterday evening without any prior notice.',
          'The electrical wires are hanging dangerously low and sparking near the junction box creating a fire hazard.',
          'Continuous voltage fluctuation has already damaged refrigerators, televisions and other household appliances.',
          'We request the electricity department to restore power immediately and inspect the damaged transformer.',
          'Children and elderly residents are suffering due to extreme heat without fans or air conditioning at night.',
          'The broken electric pole is leaning dangerously and may fall on vehicles or pedestrians at any time.'
        ]
      },
      Garbage:{
        phrases:['not collected','overflowing bin','foul smell','illegal dumping','stray animals','health hazard','for 5 days','mosquito breeding','disease risk','residents suffering'],
        sentences:[
          'The garbage collection vehicle has not visited our area for the past 5 days creating a serious health hazard.',
          'The overflowing dustbin is spreading a foul smell throughout the locality making it difficult to breathe.',
          'Stray dogs and animals are scattering the garbage on the road which is extremely unhygienic.',
          'Standing water near the garbage dump is creating a breeding ground for mosquitoes causing dengue risk.',
          'Residents including small children and elderly people are suffering from the unbearable smell and flies.',
          'We request the sanitation department to immediately clear this garbage and resume daily collection service.'
        ]
      },
      Drainage:{
        phrases:['completely blocked','overflowing','sewage backup','manhole open','flooding road','foul smell','mosquito breeding','health hazard','dirty water','urgent repair'],
        sentences:[
          'The main drain is completely blocked and dirty sewage water is overflowing onto the road and footpath.',
          'Ground floor houses are getting flooded with dirty water which is causing severe damage to property.',
          'The open manhole cover is missing and is extremely dangerous for pedestrians especially children at night.',
          'Stagnant sewage water has been accumulating for over a week creating a mosquito breeding ground.',
          'We request the drainage department to immediately clear the blockage and restore proper water flow.',
          'The foul smell from the blocked drain is making it impossible for residents to open windows or doors.'
        ]
      },
      Streetlight:{
        phrases:['not working','dark area','flickering','bent pole','safety risk','women unsafe','accident spot','urgent repair','no lighting','since last week'],
        sentences:[
          'The streetlight in our lane has not been functioning for over a week making the entire area pitch dark.',
          'Women and elderly residents feel extremely unsafe walking through this area after sunset every day.',
          'Two accidents have already occurred at this spot due to poor visibility caused by non-functional lights.',
          'We request the electricity department to repair or replace the streetlight on an urgent priority basis.',
          'The area near the school and park is particularly dangerous without streetlighting in the evenings.',
          'The damaged light pole is also leaning dangerously and could fall on passing vehicles at any time.'
        ]
      },
      Parks:{
        phrases:['no maintenance','broken equipment','encroached','unsafe at night','full of garbage','fence broken','weeds growing','no lighting','needs cleaning','anti-social activity'],
        sentences:[
          'The park has not been cleaned or maintained for several months and is now overgrown with weeds.',
          'Playground equipment is broken and damaged posing a serious injury risk to children using the park.',
          'Anti-social elements gather in the park at night due to lack of lighting and security.',
          'Vendors have encroached upon the park entrance blocking access to the walking path for regular visitors.',
          'We request the parks department to immediately clean and maintain this public space for all residents.',
          'Children are unable to play safely as the swings and slides are damaged and the area is unhygienic.'
        ]
      },
      Noise:{
        phrases:['till midnight','above legal limit','sleep disturbed','health issues','children affected','DJ party','loudspeaker','construction noise','factory noise','daily problem'],
        sentences:[
          'The loud music from the nearby venue continues till well past midnight disturbing the sleep of residents.',
          'Children are unable to study and elderly residents are experiencing severe stress due to continuous noise.',
          'The noise levels are far above the legally permissible decibel limits as per noise pollution regulations.',
          'We request the police department to take strict action against this noise pollution on an immediate basis.',
          'Construction work starts at 5am daily which is a clear violation of the permitted working hours.',
          'This noise disturbance has been going on for weeks and all informal requests have been completely ignored.'
        ]
      },
      Other:{
        phrases:['urgent action needed','no response yet','residents affected','daily problem','please help','authorities ignoring','inconvenience','immediate repair','health risk','safety concern'],
        sentences:[
          'This issue has been causing severe daily inconvenience to all residents in our locality for several weeks.',
          'Despite multiple verbal complaints to the ward office no action has been taken by the concerned department.',
          'We request the authorities to immediately inspect this issue and take appropriate action for public safety.',
          'The situation is worsening every day and may lead to a serious accident or health emergency if ignored.',
          'All residents of our area have collectively signed this complaint requesting urgent resolution of this problem.',
          'We expect a prompt response and resolution within 48 hours as this matter directly affects public safety.'
        ]
      }
    };

    const bank  = BANKS[category] || BANKS['Other'];
    const lower = text.toLowerCase();
    const phrases   = bank.phrases.filter(w => !lower.includes(w.toLowerCase())).slice(0, 3);
    const sentences = bank.sentences.filter(s => !lower.includes(s.substring(0,15).toLowerCase())).slice(0, 3);

    res.json({ phrases, sentences, source: 'fallback' });

  } catch (err) {
    console.error('Predict error:', err.message);
    res.json({ phrases: [], sentences: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════
// IMPROVE DESCRIPTION — rewrites the complaint text professionally
// ═══════════════════════════════════════════════════════════════════
app.post('/api/improve', async (req, res) => {
  try {
    const { text = '', category = 'Other' } = req.body;
    if (!text || text.trim().length < 10)
      return res.status(400).json({ error: 'Text too short to improve' });

    if (process.env.GEMINI_API_KEY) {
      const prompt = `You are an expert at writing formal civic complaints for Indian government portals.

Original complaint description written by a citizen:
"${text}"

Category: ${category}

Rewrite this as a clear, professional, formal complaint description.
Rules:
- Keep all the facts and details from the original
- Fix grammar, spelling and sentence structure
- Make it formal and suitable for a government complaint portal
- Add urgency where appropriate
- Keep it between 3-5 sentences
- Do NOT add new facts that were not in the original
- Return ONLY the improved text, nothing else, no quotes, no labels`;

      try {
        const model = getModel(GEMINI_MODEL);
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, topP: 0.8, maxOutputTokens: 300 }
        });
        const improved = result.response.text()?.trim();
        if (improved) return res.json({ improved, source: 'gemini' });
      } catch(e) { console.warn('Improve failed:', e.message); }
    }

    // Fallback — return original with note
    res.json({ improved: text, source: 'fallback', note: 'AI unavailable — original text returned' });

  } catch (err) {
    console.error('Improve error:', err.message);
    res.status(500).json({ error: 'Improve failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// AI IMAGE ANALYSIS — gemini-2.5-flash vision
// ═══════════════════════════════════════════════════════════════════
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { imageBase64, filename = '' } = req.body;

    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

    // ── Try Gemini Vision first ───────────────────────────────────
    if (process.env.GEMINI_API_KEY) {
      try {
        const mimeMatch = imageBase64.match(/^data:(image\/[\w+]+);base64,/);
        if (!mimeMatch) throw new Error('Invalid base64 format');

        const mimeType  = mimeMatch[1];
        const base64Raw = imageBase64.replace(/^data:image\/[\w+]+;base64,/, '');

        const prompt = `Analyze this image uploaded for an Indian civic complaint system.
Identify the specific civic/municipal issue shown in the image.

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "detectedCategory": "one of: Roads, Water, Electricity, Garbage, Drainage, Streetlight, Parks, Noise, Other",
  "severity": "one of: Low, Medium, High",
  "estimatedDays": 3,
  "confidence": 0.92,
  "description": "Clear 1-sentence description of the exact issue visible in the image",
  "department": "Responsible government department name"
}`;

        const model = getModel(GEMINI_VISION_MODEL);
        const result = await model.generateContent([
          prompt,
          { inlineData: { mimeType, data: base64Raw } }
        ]);

        const raw    = result.response.text() || '';
        const clean  = raw.replace(/```json|```/g, '').trim();
        const analysis = JSON.parse(clean);

        console.log('✅ Gemini Vision analysis:', analysis.detectedCategory, analysis.severity);
        return res.json({ ...analysis, source: 'gemini-vision' });

      } catch (visionErr) {
        console.warn('Gemini Vision failed, using filename fallback:', visionErr.message);
      }
    }

    // ── Filename-based fallback ───────────────────────────────────
    const name = filename.toLowerCase();
    let result = { detectedCategory:'Other', severity:'Medium', estimatedDays:5,
      confidence:0.60, description:'Civic issue detected', department:'Municipal Corporation' };

    if (name.match(/road|pothole|street|crack|highway|tarmac/))
      result = { detectedCategory:'Roads', severity:'High', estimatedDays:3, confidence:0.82,
        description:'Road damage or pothole visible in image', department:'Public Works Department (PWD)' };
    else if (name.match(/water|leak|tap|pipe|flood|pipeline/))
      result = { detectedCategory:'Water', severity:'High', estimatedDays:1, confidence:0.85,
        description:'Water leakage or pipeline issue visible', department:'Jal Board / Water Supply Dept' };
    else if (name.match(/garbage|trash|waste|dump|litter|rubbish/))
      result = { detectedCategory:'Garbage', severity:'Medium', estimatedDays:2, confidence:0.80,
        description:'Garbage accumulation visible in image', department:'Sanitation Department' };
    else if (name.match(/electric|wire|pole|transformer|spark|cable/))
      result = { detectedCategory:'Electricity', severity:'High', estimatedDays:1, confidence:0.83,
        description:'Electrical hazard visible in image', department:'Electricity Board / DISCOM' };
    else if (name.match(/light|lamp|streetlight|dark/))
      result = { detectedCategory:'Streetlight', severity:'Low', estimatedDays:7, confidence:0.78,
        description:'Non-functional streetlight visible', department:'Electricity Department' };
    else if (name.match(/drain|sewer|manhole|clog/))
      result = { detectedCategory:'Drainage', severity:'High', estimatedDays:2, confidence:0.81,
        description:'Drainage blockage or sewage issue visible', department:'Drainage Dept / City Engineer' };
    else if (name.match(/park|garden|tree|bench|playground/))
      result = { detectedCategory:'Parks', severity:'Low', estimatedDays:10, confidence:0.75,
        description:'Park maintenance issue visible', department:'Parks & Recreation Department' };

    res.json({ ...result, source: 'filename-fallback' });

  } catch (err) {
    console.error('Image analysis error:', err.message);
    res.status(500).json({ error: 'Image analysis failed. Please describe the issue manually.' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// CLASSIFY
// ═══════════════════════════════════════════════════════════════════
app.post('/api/classify', (req, res) => {
  try {
    const { complaint = '' } = req.body;
    const text = complaint.toLowerCase();
    let category = 'Other', urgency = 'Medium', department = 'Municipal Corporation';

    if (text.match(/water|tap|supply|leak|pipeline|jal|flood/)) {
      category = 'Water'; department = 'Jal Board / Water Supply Dept';
      if (text.match(/leak|burst|flood|no supply|cut/)) urgency = 'High';
    } else if (text.match(/road|pothole|street|highway|damage|crack/)) {
      category = 'Roads'; department = 'Public Works Department (PWD)';
      if (text.match(/accident|danger|broken/)) urgency = 'High';
    } else if (text.match(/electric|power|current|voltage|wire|pole|transformer/)) {
      category = 'Electricity'; department = 'Electricity Board / DISCOM';
      if (text.match(/spark|fire|danger|outage|no power/)) urgency = 'High';
    } else if (text.match(/garbage|trash|waste|smell|dustbin|dump/)) {
      category = 'Garbage'; department = 'Sanitation Department';
      if (text.match(/smell|health|hazard/)) urgency = 'High';
    } else if (text.match(/drain|sewage|clog|block|overflow|manhole|sewer/)) {
      category = 'Drainage'; department = 'Drainage Department / City Engineer';
      if (text.match(/overflow|flood|backing/)) urgency = 'High';
    } else if (text.match(/streetlight|street light|lamp post|dark road/)) {
      category = 'Streetlight'; department = 'Electricity Department'; urgency = 'Low';
    } else if (text.match(/park|garden|tree|bench|playground/)) {
      category = 'Parks'; department = 'Parks & Recreation Department'; urgency = 'Low';
    } else if (text.match(/noise|loud|sound|music|dj|speaker/)) {
      category = 'Noise'; department = 'Police Department (Environment Wing)';
    }

    const resMap = { High:'24-48 hours', Medium:'3-5 days', Low:'7-10 days' };
    res.json({ category, urgency, department, resolution: resMap[urgency],
      summary: complaint.substring(0, 100) + (complaint.length > 100 ? '...' : ''), confidence: 0.92 });
  } catch (err) {
    res.status(500).json({ error: 'Classification failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// COMPLAINTS CRUD
// ═══════════════════════════════════════════════════════════════════
app.post('/api/complaints', async (req, res) => {
  try {
    const id = 'SVK-' + uuidv4().slice(0, 8).toUpperCase();
    const complaint = await Complaint.create({ id, ...req.body, createdAt: new Date() });
    res.json({ success: true, id, complaint });
  } catch (err) {
    console.error('Create complaint error:', err.message);
    res.status(500).json({ error: 'Failed to save complaint.' });
  }
});

app.get('/api/complaints', async (req, res) => {
  try {
    const { email, username } = req.query;
    const query = {};
    if (email)    query.userEmail = email;
    if (username) query.username  = username;
    const complaints = await Complaint.find(query).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

app.get('/api/complaints/:id', async (req, res) => {
  try {
    const c = await Complaint.findOne({ id: req.params.id.toUpperCase() });
    if (!c) return res.status(404).json({ error: 'Complaint not found' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
});

app.patch('/api/complaints/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const updated = await Complaint.findOneAndUpdate(
      { id: req.params.id.toUpperCase() }, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Complaint not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// STATIC
// ═══════════════════════════════════════════════════════════════════
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/'))
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  else
    res.status(404).json({ error: 'API route not found' });
});

// ═══════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SEVAK running → http://localhost:${PORT}`);
  console.log(`🤖 Model: ${GEMINI_MODEL} | temp: ${AI_CONFIG.temperature}`);
});
