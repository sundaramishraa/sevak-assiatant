<!-- # SEVAK — AI-Powered Civic Issue Reporting System
### सेवक | Your Civic Companion

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open browser
http://localhost:3000
```

---

## 🔐 Demo Credentials

| Role    | Email                  | Password  |
|---------|------------------------|-----------|
| Citizen | citizen@sevak.gov      | civic123  |
| Admin   | admin@sevak.gov        | admin123  |

---

## 📁 Project Structure

```
sevak/
├── server.js              # Express backend (API routes, AI proxy)
├── package.json
└── public/
    ├── login.html         # Authentication page
    ├── dashboard.html     # Citizen dashboard
    ├── admin.html         # Admin control panel
    └── js/
        └── dashboard.js   # All citizen-side JS logic
```

---

## ✨ Features

### 🔐 Authentication
- Email/password login with session stored in localStorage
- Role-based redirect (citizen → dashboard, admin → admin panel)

### 🤖 AI Chatbot (SEVAK)
- Powered by Claude (Anthropic API)
- Conversation memory within session
- Strictly civic domain (roads, water, electricity, sanitation, etc.)
- Real-time streaming responses

### ✍️ Predictive Text
- Debounced API calls (600ms delay)
- 3 contextual next-word suggestions
- Click to append suggestion

### 🧠 Smart Classification
- Auto-categorizes into: Roads, Water, Electricity, Garbage, Drainage, Streetlight, Parks, Noise, Other
- Detects urgency: Low / Medium / High
- Suggests responsible department
- Estimates resolution time

### 📍 Location
- Browser Geolocation API
- OpenStreetMap + Leaflet.js (free, no API key needed)
- Reverse geocoding via Nominatim
- Click-to-pin on map

### 📷 Media Upload
- Image preview before submission
- Base64 stored with complaint

### 🗂️ Complaint Management
- UUID-format Complaint IDs (SVK-XXXXXXXX)
- In-memory server storage + localStorage backup
- Full complaint tracking by ID

### 📄 PDF Export
- HTML report generation (opens/downloads as HTML file)
- Includes: citizen details, complaint, location, ID, timestamp

### 📊 Admin Dashboard
- View all complaints
- Filter by category, status, urgency
- Update complaint status
- Analytics: totals, category distribution, resolution rate
- Auto-refreshes every 15 seconds

---

## ⚙️ Technical Details

- **AI Model**: Claude claude-sonnet-4-20250514 (via Anthropic API)
- **Temperature**: 0.3 | **Top-p**: 0.8
- **Maps**: Leaflet.js + OpenStreetMap (no API key required)
- **Storage**: In-memory JSON (server) + localStorage (client)
- **No database required**

---

## 🔧 Configuration

The Anthropic API key is automatically injected by the Claude.ai environment. No `.env` file needed when running within the SEVAK artifact context.

For standalone deployment, add your API key in `server.js`:
```javascript
headers: {
  'Content-Type': 'application/json',
  'x-api-key': process.env.ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01'
}
```

---

*Built with ❤️ for Smart City Mission & CPGRAMS guidelines*
 -->


