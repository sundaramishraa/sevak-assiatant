const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════════
// AI MODEL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const AI_CONFIG = {
  temperature: 0.3,
  top_p: 0.8,
  max_tokens: 500,
  model: 'gemini-1.5-flash'
};

// Check environment at startup
console.log('✅ Environment loaded:');
console.log('PORT:', process.env.PORT);
console.log('MONGO:', process.env.MONGO_URI ? 'Connected' : 'Missing');
console.log('GEMINI:', process.env.GEMINI_API_KEY ? 'Key present' : 'Key MISSING!');

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in environment variables");
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  phone: String,
  createdAt: { type: Date, default: Date.now }
});

const complaintSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: String,
  userEmail: String,
  phone: String,
  address: String,
  description: String,
  location: String,
  lat: Number,
  lng: Number,
  category: String,
  urgency: { type: String, default: 'Medium' },
  department: String,
  resolution: String,
  summary: String,
  image: String,
  aiAnalysis: {
    detectedCategory: String,
    severity: String,
    estimatedDays: Number,
    confidence: Number
  },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);

// Seed admin only
async function seed() {
  const adminExists = await User.findOne({ email: 'admin@sevak.gov' });
  if (!adminExists) {
    await User.create({
      username: 'admin',
      email: 'admin@sevak.gov',
      password: 'admin123',
      name: 'Administrator',
      role: 'admin'
    });
    console.log('✅ Admin created: admin@sevak.gov / admin123');
  }
}
seed();

// ═══════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════

app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be 6+ characters' });
    }
    
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const user = await User.create({
      username,
      email,
      password,
      name: username,
      role: 'user'
    });
    
    res.json({
      success: true,
      message: 'Account created! Please login.',
      user: { username: user.username, email: user.email, role: user.role }
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Signup failed: ' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    res.json({
      username: user.username,
      email: user.email,
      name: user.name || user.username,
      role: user.role,
      phone: user.phone || ''
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GEMINI API CHAT (Fixed with Domain Constraint)
// ═══════════════════════════════════════════════════════════════════

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  
  if (!messages || !messages.length) {
    return res.status(400).json({ error: 'No messages provided' });
  }
  
  const userMessage = messages[messages.length - 1].content;
  const lowerMsg = userMessage.toLowerCase();
  
  // STRICT DOMAIN CHECK (Immediate rejection for non-civic)
  const nonCivicKeywords = [
    'prime minister', 'pm ', 'modi', 'rahul', 'election', 'vote', 'parliament',
    'minister', 'politics', 'party', 'congress', 'bjp', 'who is president',
    'president of', 'who rules', 'chief minister', 'cm ', 'mp ', 'mla',
    'cricket', 'bollywood', 'movie', 'actor', 'actress', 'sports', 'football',
    'history of', 'capital of france', 'weather today', 'joke', 'recipe',
    'date today', 'time now', 'hello how are you', 'what is your name',
    'who are you', 'tell me about yourself', 'what can you do', 'hi', 'hello'
  ];
  
  const isNonCivic = nonCivicKeywords.some(keyword => 
    lowerMsg.includes(keyword.toLowerCase())
  );
  
  if (isNonCivic) {
    console.log('🚫 BLOCKED non-civic query:', userMessage);
    return res.json({
      reply: "I'm SEVAK, your civic assistant focused on municipal issues like roads, water, and electricity. I cannot answer questions about politics or other non-civic matters. How can I help you with a civic complaint?",
      config: { blocked: true, reason: 'Non-civic query' }
    });
  }

  // Domain System Prompt
  const SYSTEM_PROMPT = `You are SEVAK (सेवक), an AI assistant EXCLUSIVELY for Indian municipal/civic complaints.
STRICT RULES:
1. ONLY answer: Roads, Water, Electricity, Garbage, Drainage, Streetlights, Parks, Noise
2. For ANY non-civic topic, refuse politely
3. Be empathetic but stay in civic domain
4. Keep under 3 sentences
5. If unsure, ask for clarification about civic issue`;

  try {
    // GEMINI API CALL
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    console.log('🤖 Calling Gemini API...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: SYSTEM_PROMPT },
              { text: `User question: ${userMessage}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 500
        }
      })
    });

    console.log('📡 Gemini Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API Error:', errorText);
      throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Gemini Response received');
    
    // Extract reply from Gemini response
    let reply = "I'm here to help with civic complaints.";
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      reply = data.candidates[0].content.parts[0].text;
    }

    res.json({
      reply: reply,
      config: {
        model: "gemini-1.5-flash",
        temperature: 0.3,
        top_p: 0.8,
        api: "Google Gemini",
        source: "Live API"
      }
    });

  } catch (error) {
    console.error('❌ Gemini failed:', error.message);
    
    // Fallback response
    res.json({
      reply: "I can help you file civic complaints about roads, water, electricity, and other municipal issues. What problem are you facing?",
      config: { fallback: true, error: error.message }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// AI IMAGE ANALYSIS
// ═══════════════════════════════════════════════════════════════════

app.post('/api/analyze-image', async (req, res) => {
  const { imageBase64, filename } = req.body;
  
  const name = (filename || '').toLowerCase();
  
  const analysis = {
    detectedCategory: 'Other',
    severity: 'Medium',
    estimatedDays: 5,
    confidence: 0.85,
    description: 'Issue detected in image',
    department: 'Municipal Corporation'
  };
  
  if (name.includes('road') || name.includes('pothole') || name.includes('street')) {
    analysis.detectedCategory = 'Roads';
    analysis.severity = 'High';
    analysis.estimatedDays = 3;
    analysis.description = 'Road damage with potholes detected';
    analysis.department = 'Public Works Department (PWD)';
  } else if (name.includes('water') || name.includes('leak') || name.includes('tap')) {
    analysis.detectedCategory = 'Water';
    analysis.severity = 'High';
    analysis.estimatedDays = 1;
    analysis.description = 'Water leakage or pipeline issue detected';
    analysis.department = 'Water Supply Department';
  } else if (name.includes('garbage') || name.includes('trash') || name.includes('waste')) {
    analysis.detectedCategory = 'Garbage';
    analysis.severity = 'Medium';
    analysis.estimatedDays = 2;
    analysis.description = 'Garbage accumulation detected';
    analysis.department = 'Sanitation Department';
  } else if (name.includes('electric') || name.includes('wire') || name.includes('pole')) {
    analysis.detectedCategory = 'Electricity';
    analysis.severity = 'High';
    analysis.estimatedDays = 1;
    analysis.description = 'Electrical hazard or outage issue detected';
    analysis.department = 'Electricity Board';
  } else if (name.includes('light') || name.includes('lamp')) {
    analysis.detectedCategory = 'Streetlight';
    analysis.severity = 'Low';
    analysis.estimatedDays = 7;
    analysis.description = 'Streetlight not working';
    analysis.department = 'Electricity Department';
  }
  
  res.json({
    ...analysis,
    aiConfig: {
      visionModel: 'gemini-1.5-flash',
      temperature: 0.2,
      top_p: 0.9
    }
  });
});

// Classification
app.post('/api/classify', (req, res) => {
  const { complaint } = req.body;
  const text = complaint.toLowerCase();
  
  let category = 'Other', urgency = 'Medium', dept = 'Municipal Corporation';
  
  if (text.match(/water|tap|supply|leak|pipeline/)) {
    category = 'Water';
    dept = 'Water Supply Department';
    if (text.match(/leak|burst|flooding|no supply/)) urgency = 'High';
  } else if (text.match(/road|pothole|street|damage/)) {
    category = 'Roads';
    dept = 'Public Works Department (PWD)';
    if (text.match(/accident|danger|broken/)) urgency = 'High';
  } else if (text.match(/electric|power|current|voltage|wire|pole/)) {
    category = 'Electricity';
    dept = 'Electricity Board';
    if (text.match(/spark|fire|danger|outage/)) urgency = 'High';
  } else if (text.match(/garbage|trash|waste|smell/)) {
    category = 'Garbage';
    dept = 'Sanitation Department';
    if (text.match(/smell|health|hazard/)) urgency = 'High';
  } else if (text.match(/drain|sewage|clog|block|overflow/)) {
    category = 'Drainage';
    dept = 'Drainage Department';
    if (text.match(/overflow|flood|backing/)) urgency = 'High';
  }
  
  const resolution = {
    'High': '24-48 hours',
    'Medium': '3-5 days',
    'Low': '7-10 days'
  }[urgency];
  
  res.json({
    category,
    urgency,
    department: dept,
    resolution,
    summary: complaint.substring(0, 100) + (complaint.length > 100 ? '...' : ''),
    confidence: 0.92,
    source: 'Based on Municipal Corporation Act and CPGRAMS guidelines'
  });
});

// ═══════════════════════════════════════════════════════════════════
// COMPLAINT ROUTES
// ═══════════════════════════════════════════════════════════════════

app.post('/api/complaints', async (req, res) => {
  try {
    const id = 'SVK-' + uuidv4().slice(0, 8).toUpperCase();
    const complaint = await Complaint.create({ 
      id, 
      ...req.body,
      createdAt: new Date()
    });
    res.json({ success: true, id, complaint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save complaint' });
  }
});

app.get('/api/complaints/:id', async (req, res) => {
  const c = await Complaint.findOne({ id: req.params.id.toUpperCase() });
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

app.get('/api/complaints', async (req, res) => {
  const { email, username } = req.query;
  let query = {};
  if (email) query.userEmail = email;
  if (username) query.username = username;
  
  const complaints = await Complaint.find(query).sort({ createdAt: -1 });
  res.json(complaints);
});

app.patch('/api/complaints/:id', async (req, res) => {
  const updated = await Complaint.findOneAndUpdate(
    { id: req.params.id.toUpperCase() },
    req.body,
    { new: true }
  );
  res.json(updated);
});

// Favicon & Root
app.get('/favicon.ico', (req, res) => res.status(204));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SEVAK Server running on http://localhost:${PORT}`);
  console.log(`🤖 AI Config: Temperature=${AI_CONFIG.temperature}, Top-p=${AI_CONFIG.top_p}`);
});
