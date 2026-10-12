# AI Agent Directives & Source of Truth: Qiskit Fall Fest 2026 (SRM University-AP)

This file is automatically loaded by AI agents working in this workspace.

---

## 1. Canonical URLs & Endpoints (MANDATORY)

- **Official Learning Portal & Event Registration (Active Everywhere & On-Campus):**  
  👉 **`https://www.qffsrmap2026.com/learning`**  
  *All participants, emails, notifications, and AI instructions directing users to register, log in, take quizzes, watch lectures, or access challenges MUST use this URL. Confirmed working natively across campus Wi-Fi and external networks.*

- **Main Festival Landing Page:**  
  `https://www.qffsrmap2026.com/`  

- **Production Mirror (Internal Reference Only):**  
  `https://qis-kit-fall-fest-2026.vercel.app/` (Learning: `https://qis-kit-fall-fest-2026.vercel.app/learning`)

---

## 2. Participant Onboarding & Workflow

1. **Whitelisting & Access:**
   - 1,470 approved student emails are stored in Supabase `public.allowed_emails`.
   - Users sign in directly via Google OAuth / Magic Link on the portal at `https://www.qffsrmap2026.com/learning`.

2. **Fee Structure & Non-Misleading Copy (CRITICAL):**
   - **Festival Access & Registration is 100% FREE:** Access to all workshops, lectures, quizzes, creative competitions, and hackathon tracks requires zero payment.
   - **₹99 Fee is Exclusively for Certificates:** The nominal ₹99 charge is solely an optional administrative fee for minting a cryptographically verified completion certificate upon finishing all 5 masterclasses and quizzes.
   - **Never refer to ₹99 as a "Registration Fee" or "Online Course Fee".** Always label it as "Optional Verified Certificate Fee".
   - **FAQ #14 Integrity:** FAQ 14 is dedicated to Day 2/3 Poster & Essay submissions. Never override FAQ 14 with payment or fee blocks (fee cards belong under FAQ 17).

3. **Hackathon Team Size Standards:**
   - **Strict Team Size: 2 to 6 members** (1 Team Leader + 1 to 5 Teammates).
   - **Solo Participation is Prohibited:** Backend validation strictly rejects solo teams. Teams must have at least 1 invited teammate accept before the roster can be finalized.
   - Legacy mentions of `1–4 members` in schedules or docs are deprecated and must never be reintroduced.

4. **Masterclass Learning Track & Session Materials:**
   - 5 active curriculum sessions (`session-1`, `session-3`, `session-4`, `session-5`, `session-6`) with video lectures and concept check quizzes.
   - 3 creative tracks (Digital Poster, Reels, Technical Essay) submitted at `https://www.qffsrmap2026.com/learning`.
   - **Session Materials & Storage Scope:** Presentation decks are hosted directly via Supabase Storage bucket `media` under `session-materials/{session-id}/{filename}.pdf` (backed by RLS migration `20261012111500_allow_session_materials_uploads_in_media_bucket.sql`). Active official decks:
     - `session-4`: Dr. Gangi Reddy Salla (`media/session-materials/session-4/Quantum_Photonic_Technologies.pdf`).
     - `session-6`: Dr. Sazzad Ali Biswas (`media/session-materials/session-6/Quantum_Cybersecurity_Cryptography.pdf`).
   - **Session 6 Architecture & Sole Speaker Integrity:** Session 6 is delivered exclusively by **Dr. Sazzad Ali Biswas** as the sole speaker (`coSpeakers: []`).
   - **Don Norman Information Architecture:** Official PDF decks are surfaced as prominent hero action cards immediately beneath session descriptions on `/learning/session/{id}`, with transcript accordions collapsed by default to eliminate cognitive clutter while preserving on-demand expandability.

5. **Hackathon & Coding Challenges:**
   - Hackathon Phase 1 team submissions and repo registration: accessed via `https://www.qffsrmap2026.com/learning/hackathon`.
   - 9 Qiskit browser-based coding challenges (P1 to P9) open until October 15, 2026.

---

## 3. Engineering Tone & Anti-Slop Rules

- **Zero Decorative Emojis** in UI buttons, status badges, headers, or git commits.
- **Clean light-theme default** (`#ffffff` / `#f8fafc`, `#e2e8f0` borders, `#0f172a` text).
- **Concise, direct tone** without AI cheerleading or filler words.
- Consult `PROJECT_LEARNINGS.md` for complete ground truths (GT-01 through GT-25).

---

## 4. Active Deadlines & Don Norman UX Standards (Source of Truth)

1. **Active Online Deadlines:**
   - **Creative Competitions (Day 1 Tech Reels, Day 2 Digital Poster, Day 3 Technical Essay):** Officially extended to **Wednesday, 14 October 2026, 11:59 PM IST**.
   - **Hackathon Phase 1 Online Window:** Submissions close **14 October 2026, 11:59 PM IST**.
   - **Qiskit Coding Challenges (P1 to P9):** Browser challenges open until **15 October 2026**.

2. **Don Norman Communication Architecture (MANDATORY):**
   - **Never rely solely on ephemeral toasts** for environmental constraints or deadlines. A toast provides brief entrance feedback, but persistent environmental visibility ("knowledge in the world") is required.
   - When communicating deadline status or temporal changes, maintain:
     - Persistent in-page dashboard banners (`DeadlineExtensionBanner.tsx`).
     - Point-of-action visual signifiers (`~~12 Oct~~ → 14 Oct (Extended)`) on submission cards and guidelines.
     - Synchronized sidebar status badges (`14 Oct`).
     - Contextual alert badges on the Public Schedule (`ExploreSchedule.tsx`).
     - Global non-intrusive entrance toasts (`DeadlineToast.tsx`) with localStorage dismissal.
   - Single source of truth must remain 100% synchronized across all schedule, FAQ, curriculum, and competition data files.

