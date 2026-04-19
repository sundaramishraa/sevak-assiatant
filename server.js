const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (IMPORTANT)
app.use(express.static(path.join(__dirname, 'public')));

// AI CONFIG
const AI_CONFIG = {
  temperature: 0.3,
  top_p: 0.8,
  max_tokens: 500,
  model: 'gemini-3-flash-preview'
};

// Gemini Init
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Logs
const PORT = process.env.PORT || 3000;
console.log('✅ Environment loaded:');
console.log('PORT:', PORT);
console.log('MONGO:', process.env.MONGO_URI ? 'Connected' : '❌ Missing');
console.log('GEMINI:', process.env.GEMINI_API_KEY ? 'Key present' : '❌ Missing');

// ✅ ROOT ROUTE (ONLY ONE)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// MongoDB (IMPORTANT: use Atlas in production)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  name: String,
  role: { type: String, default: 'user' },
  phone: String,
  createdAt: { type: Date, default: Date.now }
});

const complaintSchema = new mongoose.Schema({
  id: String,
  username: String,
  userEmail: String,
  description: String,
  category: String,
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);

// Seed admin
(async () => {
  const admin = await User.findOne({ email: 'admin@sevak.gov' });
  if (!admin) {
    await User.create({
      username: 'admin',
      email: 'admin@sevak.gov',
      password: 'admin123',
      role: 'admin'
    });
    console.log('✅ Admin created');
  }
})();

// AUTH
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields required' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ error: 'Email exists' });

    const user = await User.create({ username, email, password });
    res.json({ success: true, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Unable to create account' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, password });
    if (!user)
      return res.status(401).json({ error: 'Invalid credentials' });

    res.json(user);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Unable to log in' });
  }
});

// AI CHAT
app.post('/api/chat', async (req, res) => {
  if (!genAI) {
    return res.status(503).json({ error: 'AI service unavailable', reply: 'AI not responding' });
  }

  const userMessage = Array.isArray(req.body.messages)
    ? req.body.messages.slice(-1)[0]?.content
    : req.body.message || req.body.text || '';

  if (!userMessage || !userMessage.trim()) {
    return res.status(400).json({ error: 'No chat message provided' });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: AI_CONFIG.model,
      temperature: AI_CONFIG.temperature,
      top_p: AI_CONFIG.top_p,
      maxOutputTokens: AI_CONFIG.max_tokens
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ]
    });

    const text = result?.response?.text?.() || 'AI not responding';
    res.json({ reply: text });
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ error: 'AI request failed', reply: 'AI not responding' });
  }
});

// COMPLAINT
app.post('/api/complaints', async (req, res) => {
  try {
    const id = 'SVK-' + uuidv4().slice(0, 6);

    const complaint = await Complaint.create({
      id,
      ...req.body
    });

    res.json({ success: true, complaint });
  } catch (err) {
    console.error('Complaint creation error:', err);
    res.status(500).json({ error: 'Unable to save complaint' });
  }
});

app.get('/api/complaints', async (req, res) => {
  try {
    const data = await Complaint.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error('Complaint fetch error:', err);
    res.status(500).json({ error: 'Unable to load complaints' });
  }
});

// ✅ FALLBACK (VERY IMPORTANT FOR RENDER)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// SERVER
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});