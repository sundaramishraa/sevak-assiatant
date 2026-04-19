# AI Model Configuration Documentation
## SEVAK - Civic Complaint Management System

---

### Model Parameters Configuration

#### 1. Temperature: 0.3
**Definition:** Controls randomness and creativity in AI responses. Range: 0.0 to 2.0.

**Why 0.3?**
- **Low value chosen** because civic governance requires **factual accuracy**, not creative storytelling
- Citizens need deterministic information about:
  - Correct department names (PWD, Jal Board, Electricity Board)
  - Accurate resolution timeframes (24-48 hours for urgent)
  - Proper municipal procedures
- Higher values (0.7+) risk "hallucinating" incorrect department names or unrealistic timelines

**Testing Process:**
| Temperature | Observation | Result |
|-------------|-------------|---------|
| 0.1 | Too robotic, lacked empathy | ❌ Rejected |
| 0.3 | Factual yet empathetic, accurate departments | ✅ **Selected** |
| 0.7 | Creative but invented wrong department names | ❌ Rejected |
| 1.0 | Overly verbose, inconsistent information | ❌ Rejected |

**Domain Justification:**
Civic complaints are sensitive - wrong information wastes citizen time and government resources. Low temperature ensures consistency.

---

#### 2. Top-p (Nucleus Sampling): 0.8
**Definition:** Controls probability mass of token selection. Range: 0.0 to 1.0.

**Why 0.8?**
- **Balanced approach**: Not too restrictive (0.5 misses context), not too broad (0.95 risks off-topic)
- Allows natural language variety while maintaining **domain safety**
- Ensures responses stay within civic/municipal topics only

**Comparison:**
- **Top-p 0.5**: Too safe, repetitive responses, misses nuance in complaint descriptions
- **Top-p 0.8**: ✅ **Optimal** - Natural language, comprehensive responses, stays on-topic
- **Top-p 0.95**: Risk of suggesting unrelated topics (politics, private companies)

---

### API Configuration Details

```javascript
{
  model: "gpt-3.5-turbo",
  temperature: 0.3,        // Low for factual accuracy
  top_p: 0.8,             // Balanced creativity vs safety
  max_tokens: 500,        // Sufficient for detailed complaint descriptions
  presence_penalty: 0.0,  // No bias toward specific topics
  frequency_penalty: 0.0  // Allow repetition of important terms
}
