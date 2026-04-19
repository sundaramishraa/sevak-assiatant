# Data Collection Methodology
## SEVAK Civic Complaint System

---

## 1. Collection Approach: Curated Domain Knowledge
**Note:** This project uses Generative AI APIs (OpenAI) and does not require training custom models. Data collection focused on **prompt optimization** and **domain context gathering**.

---

## 2. Step-by-Step Data Collection Process

### Phase 1: FAQ and Intent Collection (Week 1-2)

#### 2.1 Government Portal Scraping (Ethical, Public Data)
**Sources:**
- **CPGRAMs Portal:** Downloaded 200+ resolved complaint examples
- **Municipal Corporation Websites:** Delhi, Mumbai, Bangalore, Chennai
- **Citizen Helpline Logs:** 155300 (National Grievance Number) common queries

**Data Extracted:**
- Actual complaint descriptions (anonymized)
- Resolution times provided by authorities
- Department routing decisions
- Citizen follow-up questions

**Sample Collected Queries:**
| Query | Intent | Category | Priority |
|-------|--------|----------|----------|
| "Pani nahi aa raha 2 din se" | File Complaint | Water | High |
| "Road pe gaddha hai, accident hua" | File Complaint | Roads | High |
| "Meri complaint ka status kya hai?" | Track Status | - | - |
| "Kis department ko complaint karein?" | Department Info | - | - |
| "Kitne din mein thik hoga?" | Time Estimate | - | - |

#### 2.2 Common User Intents Identified
1. **Intent: `file_complaint`** (60% of queries)
   - User describes problem → System categorizes → Confirms department
   
2. **Intent: `track_status`** (25% of queries)
   - User provides complaint ID → System fetches status
   
3. **Intent: `department_inquiry`** (10% of queries)
   - "Who handles water issues?" → Department mapping response
   
4. **Intent: `time_estimation`** (5% of queries)
   - "How long will it take?" → SLA-based response

---

### Phase 2: Response Pattern Curation (Week 3)

#### 2.3 Contextual Response Templates
Created response templates for different scenarios:

**Greeting Flow:**
- Acknowledge user
- State domain clearly (civic only)
- Offer options (file/track/learn)

**Category-Specific Follow-ups:**
- **Water:** "Is it supply issue or pipeline leakage?"
- **Roads:** "Is it pothole damage or construction debris?"
- **Electricity:** "Power outage or voltage fluctuation?"

#### 2.4 Safety and Constraint Rules
Collected "negative examples" - what the bot should NOT say:
- ❌ No political opinions or party references
- ❌ No legal advice (redirect to lawyers)
- ❌ No personal medical advice
- ❌ No private company recommendations
- ❌ No pricing/fee information (varies by city)

---

### Phase 3: Prompt Engineering (Week 4)

#### 3.1 System Prompt Construction
Composed system prompt using collected domain data:
```python
SYSTEM_PROMPT = """
Domain: Indian Civic Governance (9 categories: Roads, Water, Electricity...)
Temperature: 0.3 (Factual), Top-p: 0.8 (Balanced)
Department Mapping:
- Roads → PWD
- Water → Jal Board
- Electricity → Discom
...
Resolution Times:
- High: 24-48h
- Medium: 3-5 days
- Low: 7-10 days
Constraints: Civic only, Empathetic but factual, Max 4 sentences
"""
