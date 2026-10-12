# Qiskit Fall Fest 2026 — SRM University-AP (Amaravati)
### Official Digital Web Platform

**Live Platform (Primary Domain):** [https://www.qffsrmap2026.com/](https://www.qffsrmap2026.com/)  
**Official Learning & Registration Hub:** [https://www.qffsrmap2026.com/learning](https://www.qffsrmap2026.com/learning)  
**Verified Production Mirror (Campus Direct / Fallback URL):** [https://qis-kit-fall-fest-2026.vercel.app/](https://qis-kit-fall-fest-2026.vercel.app/) (Learning: [https://qis-kit-fall-fest-2026.vercel.app/learning](https://qis-kit-fall-fest-2026.vercel.app/learning))  
**Host Category:** Partner Plus Host  
**Milestone Theme:** A Decade of Quantum on Cloud (Celebrating 10 Years of Cloud Quantum Computing)  
**Event Timeline:** Online Phase: 5–13 October 2026 | Offline Phase: 26–30 October 2026  
**Companion Planning Repository:** [sahgyan9/Qiskit-Fall-Fest-SRMAP-2026](https://github.com/sahgyan9/Qiskit-Fall-Fest-SRMAP-2026)  

---

## Overview

This repository contains the production source code for the official website of **Qiskit Fall Fest 2026 at SRM University-AP (Amaravati)**.

Built to international quantum symposium standards as part of IBM Quantum's global network of 200+ host institutions, the platform powers SRM University-AP's flagship festival edition—delivering interactive schedules, campus wayfinding, event catalogues, and speaker registries across 59 curated events.

### Production Endpoints & Campus Access

* **Primary Custom Domain (`qffsrmap2026.com`):** Serves all public traffic, student registrations, and on-campus users. Verified fully operational across SRM University-AP campus Wi-Fi, dorms, and laboratories.
* **Official Learning & Registration Hub:** `https://www.qffsrmap2026.com/learning`
* **Production Mirror (Internal Reference):** `https://qis-kit-fall-fest-2026.vercel.app/` (Learning: `https://qis-kit-fall-fest-2026.vercel.app/learning`)

---

## Tech Stack & Architecture

* **Framework:** Next.js 15 (App Router)
* **Library:** React 19
* **Language:** TypeScript
* **Styling:** Tailwind CSS (Utility-first, responsive, accessible contrast)
* **Backend & Cloud Database:** Supabase (PostgreSQL 17, Storage CDN, Row Level Security)
* **Hosting & Edge Delivery:** Vercel (Edge Network, Automated Deployments)
* **Icons:** Semantic SVG Icons (Lucide Icons)
* **Code Quality:** ESLint, Prettier, PostCSS
* **Infrastructure Reference:** [docs/INFRASTRUCTURE_VERCEL_SUPABASE.md](docs/INFRASTRUCTURE_VERCEL_SUPABASE.md)

### Route Structure
```
app/
├── page.tsx                  # Home: Hero, Decade of Quantum, Highlights, Ecosystem, Partners
├── about/page.tsx            # About: Host institution background, IBM partnership, pillars
├── experience/page.tsx       # Experience: Categorized browser of all 59 festival events
├── schedule/page.tsx         # Schedule: Split-view online (5–9 Oct) and offline (26–30 Oct)
├── venues/page.tsx           # Venues: Interactive campus atlas and room locations
├── team/
│   ├── page.tsx              # Team Landing: Advisory, mentors, and student leads
│   ├── website/page.tsx      # Website Team: Engineering, design, and infra contributors
│   └── organizing/page.tsx   # Organizing Committee: Cell hierarchy and leadership structure
└── faqs/page.tsx             # FAQs: Searchable accordion for eligibility and participation
```

---

## Getting Started

### Prerequisites
* Node.js (v18.18 or higher recommended)
* npm, pnpm, or yarn

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/qiskitfallfest-srmap/QisKit-Fall-Fest-2026.git
   cd QisKit-Fall-Fest-2026
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
```bash
npm run build
npm run start
```

---

## AI Agent & Developer Operating Protocol

All contributors and AI agents working on this platform must follow the guidelines codified in [PROJECT_LEARNINGS.md](PROJECT_LEARNINGS.md):

1. **The Caution Principle:** Never assume dates, venues, or rules. Verify against the companion Planning Repository or consult organizers.
2. **Anti-Slop Standards:** Strictly zero decorative emojis in UI, code, or commits. Clean, modern light theme by default (`#ffffff` / `#f8fafc`, subtle `#e2e8f0` borders, `#0f172a` text).
3. **External Registration CTA:** All registration CTAs point exclusively to the official Unstop portal once live. Internal `/register` or `/join` routes are strictly prohibited.
4. **Data Centralization:** Event data, schedules, and locations reside in `data/`. Do not hardcode static event data inside UI render components.
5. **Continuous Logging:** Record all significant updates in the Chronological Agent Log in `PROJECT_LEARNINGS.md`. 

---

## Companion Repositories & Links

* **Live Web Platform:** [https://www.qffsrmap2026.com/](https://www.qffsrmap2026.com/)
* **Academic & Hackathon Planning Repository:** [https://github.com/sahgyan9/Qiskit-Fall-Fest-SRMAP-2026](https://github.com/sahgyan9/Qiskit-Fall-Fest-SRMAP-2026)
* **IBM Quantum Ecosystem:** [https://www.ibm.com/quantum/qiskit](https://www.ibm.com/quantum/qiskit)
* **Qiskit Documentation:** [https://quantum.cloud.ibm.com/docs](https://quantum.cloud.ibm.com/docs)
