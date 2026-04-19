const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Added SDK
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
  model: 'gemini-3-flash-preview' // Updated for 2026 compatibility
};

// Initialize Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Check environment at startup
console.log('✅ Environment loaded:');
console.log('PORT:', process.env.PORT || 3000);
console.log('MONGO:', process.env.MONGO_URI ? 'Connected' : 'Using Local/Default');
console.log('GEMINI:', process.env.GEMINI_API_KEY ? 'Key present' : 'Key MISSING!');

app.get('/', (req, res) => {
  res.send('SEVAK backend is running 🚀');
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
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
  try {
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
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  }
}
seed();

// ═══════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════

app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ characters' });
    
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });
    
    const user = await User.create({ username, email, password, name: username, role: 'user' });
    res.json({ success: true, message: 'Account created!', user: { username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ username: user.username, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GEMINI API CHAT (Optimized with SDK)
// ═══════════════════════════════════════════════════════════════════

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !messages.length) return res.status(400).json({ error: 'No messages' });

  const userMessage = messages[messages.length - 1].content;
  const lowerMsg = userMessage.toLowerCase();

  // Strict Domain keywords
  const nonCivicKeywords = [
    'prime minister', 'modi', 'rahul', 'election', 'vote', 'politics', 'party', 
    'cricket', 'bollywood', 'movie', 'joke', 'recipe', 'weather'
  ];

  if (nonCivicKeywords.some(k => lowerMsg.includes(k))) {
    return res.json({
      reply: "I am SEVAK, specialized in municipal issues (Roads, Water, etc.). I cannot discuss politics or general entertainment.",
      config: { blocked: true }
    });
  }

  const SYSTEM_PROMPT = `You are SEVAK, an AI assistant for Indian municipal complaints. 
  Answer ONLY about: Roads, Water, Electricity, Garbage, Drainage, Streetlights. 
  Max 3 sentences. Be polite.`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: AI_CONFIG.model,
      generationConfig: {
        temperature: AI_CONFIG.temperature,
        topP: AI_CONFIG.top_p,
        maxOutputTokens: AI_CONFIG.max_tokens,
      }
    });

    console.log('🤖 Calling Gemini AI...');
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nUser: ${userMessage}`);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text, config: { source: "Gemini SDK", model: AI_CONFIG.model } });
  } catch (error) {
    console.error('❌ AI Error:', error.message);
    res.json({ reply: "I'm having trouble connecting to the AI. How can I help with your complaint manually?" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// AI IMAGE ANALYSIS & CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════

app.post('/api/analyze-image', async (req, res) => {
  const { filename } = req.body;
  const name = (filename || '').toLowerCase();
  
  const analysis = {
    detectedCategory: 'Other', severity: 'Medium', estimatedDays: 5,
    description: 'Issue detected', department: 'Municipal Corporation'
  };
  
  if (name.includes('road') || name.includes('pothole')) {
    Object.assign(analysis, { detectedCategory: 'Roads', severity: 'High', estimatedDays: 3, department: 'PWD' });
  } else if (name.includes('water') || name.includes('leak')) {
    Object.assign(analysis, { detectedCategory: 'Water', severity: 'High', estimatedDays: 1, department: 'Water Dept' });
  }

  res.json({ ...analysis, aiConfig: { model: AI_CONFIG.model } });
});

app.post('/api/classify', (req, res) => {
  const { complaint } = req.body;
  const text = complaint.toLowerCase();
  let category = 'Other', urgency = 'Medium', dept = 'Municipal Corp';

  if (text.match(/water|leak/)) { category = 'Water'; dept = 'Water Dept'; urgency = 'High'; }
  else if (text.match(/road|pothole/)) { category = 'Roads'; dept = 'PWD'; }

  res.json({ category, urgency, department: dept, summary: complaint.substring(0, 50) + '...' });
});

// ═══════════════════════════════════════════════════════════════════
// COMPLAINT ROUTES
// ═══════════════════════════════════════════════════════════════════

app.post('/api/complaints', async (req, res) => {
  try {
    const id = 'SVK-' + uuidv4().slice(0, 8).toUpperCase();
    const complaint = await Complaint.create({ id, ...req.body });
    res.json({ success: true, id, complaint });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

app.get('/api/complaints', async (req, res) => {
  const { email } = req.query;
  const complaints = await Complaint.find(email ? { userEmail: email } : {}).sort({ createdAt: -1 });
  res.json(complaints);
});

app.get('/api/complaints/:id', async (req, res) => {
  const c = await Complaint.findOne({ id: req.params.id.toUpperCase() });
  c ? res.json(c) : res.status(404).json({ error: 'Not found' });
});

// Root & Server
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SEVAK Server running on http://localhost:${PORT}`);
});

