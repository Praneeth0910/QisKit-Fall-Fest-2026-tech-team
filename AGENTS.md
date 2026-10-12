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

2. **Masterclass Learning Track:**
   - 5 active curriculum sessions (`session-1`, `session-3`, `session-4`, `session-5`, `session-6`) with video lectures and concept check quizzes.
   - 3 creative tracks (Digital Poster, Reels, Technical Essay) submitted at `https://www.qffsrmap2026.com/learning`.

3. **Hackathon & Coding Challenges:**
   - Hackathon Phase 1 team submissions and repo registration: accessed via `https://www.qffsrmap2026.com/learning`.
   - 9 Qiskit browser-based coding challenges (P1 to P9) open until October 15, 2026.

---

## 3. Engineering Tone & Anti-Slop Rules

- **Zero Decorative Emojis** in UI buttons, status badges, headers, or git commits.
- **Clean light-theme default** (`#ffffff` / `#f8fafc`, `#e2e8f0` borders, `#0f172a` text).
- **Concise, direct tone** without AI cheerleading or filler words.
- Consult `PROJECT_LEARNINGS.md` for complete ground truths (GT-01 through GT-22).

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

