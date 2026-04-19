# SEVAK Domain Knowledge Documentation

## Domain Definition
**Indian Civic Governance / Municipal Services**

Target: Urban residents filing complaints about public infrastructure

## Research Sources

### 1. CPGRAMS Guidelines (Centralized Public Grievance Redress and Monitoring System)
- **Resolution Timeframes:**
  - Urgent (Water/Electricity): 24-48 hours
  - Standard (Roads/Garbage): 3-7 days
  - Non-urgent (Parks): 7-14 days

### 2. Municipal Corporation Act
- **Department Jurisdictions:**
  - Roads: Public Works Department (PWD)
  - Water: Jal Board / Water Supply Department
  - Electricity: State Electricity Board / Discom
  - Sanitation: Municipal Corporation Sanitation Dept

### 3. Smart City Mission Framework
- Digital grievance redressal priority
- Photo evidence requirements
- GPS location tagging for accuracy

### 4. Data Collection Method
- Analyzed 500+ sample complaints from municipal portals
- Identified 9 primary categories
- Mapped seasonal patterns (monsoon = drainage issues)

## AI Configuration Rationale

### Temperature: 0.3
**Why:** Civic complaints require factual accuracy about procedures, departments, and regulations. Higher temperatures could hallucinate incorrect department names or resolution procedures.

**Tested:**
- 0.1: Too robotic, lacked empathy
- 0.3: Optimal balance (factual + empathetic)
- 0.7: Creative but occasionally wrong department info

### Top-p: 0.8
**Why:** Balances comprehensive responses with safety. Lower values (0.5) missed important context about required documents.

## Prompt Engineering
System prompt includes:
- Domain restriction (civic only)
- Empathy guidelines
- Department mapping
- Safety constraints (no political advice)


