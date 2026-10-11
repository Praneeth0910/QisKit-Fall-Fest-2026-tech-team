export type FAQSection = 'general' | 'technical';

export interface FAQItem {
  id: string;
  number: number;
  question: string;
  answer: string;
  category: string;
  section: FAQSection;
  isTopQuestion?: boolean;
  trackCode?: string;
  tags?: string[];
}

export const FAQ_META = {
  title: 'Qiskit Fall Fest 2026 Frequently Asked Questions (FAQ)',
  host: 'SRM University-AP',
  location: 'Amaravati, Andhra Pradesh, India',
  disclaimer:
    'Dates, fees, eligibility, activities, and certificate/prize details are based on official information provided by the organizing committee. Please refer to official SRM University-AP announcements for the latest information.',
};

export const TECHNICAL_BENCHMARK_NOTICE = {
  title: 'Phase 1 Processor A/B Benchmark & Challenge Advisory',
  subtitle: 'Official guidelines from the organizing committee',
  details: [
    'Processor A (5 Qubits): Linear graph topology with physical qubits q0–q4 (simulation-derived).',
    'Processor B (9 Qubits): Heavy-hex graph topology with physical qubits q0–q8 (all nine nodes must be utilized).',
    'Noise Parameters: Example noise parameters in starter notebooks (e.g. p=0.005 or p=0.01) are strictly illustrative. The final Challenge Kit is the source of truth.',
    'Phase 1 Boundary: The qualification benchmark is restricted to Processor A and B. Processor C and custom Processor D are reserved for Phase 2.',
  ],
  folderUrl: 'https://drive.google.com/drive/folders/1caxlXXeqjOkLmXGlimy_Etw0uPHSwyga',
};

export const GENERAL_CATEGORIES = [
  'All',
  'General & Overview',
  'Schedule & Venues',
  'Events & Competitions',
  'Prerequisites & Prep',
  'Registration & Fees',
  'Certificates & Contact',
] as const;

export const TECHNICAL_CATEGORIES = [
  'All',
  'General Rules & Phase 1',
  'Track & PS Selection',
  'Processor A/B Benchmark',
  'Repository & Submission',
  'Evaluation & AI Policy',
  'Quantum Chemistry (Track C)',
  'Quantum Optimization (Track O)',
  'Quantum Simulation (Track S)',
  'Quantum Machine Learning (Track Q)',
  'Post-Quantum Cryptography (Track P)',
] as const;

export const FAQ_CATEGORIES = [
  'All',
  'General & Overview',
  'Schedule & Venues',
  'Events & Competitions',
  'Prerequisites & Prep',
  'Registration & Fees',
  'Certificates & Contact',
  'General Rules & Phase 1',
  'Track & PS Selection',
  'Processor A/B Benchmark',
  'Repository & Submission',
  'Evaluation & AI Policy',
  'Quantum Chemistry (Track C)',
  'Quantum Optimization (Track O)',
  'Quantum Simulation (Track S)',
  'Quantum Machine Learning (Track Q)',
  'Post-Quantum Cryptography (Track P)',
] as const;

export type FAQCategory = (typeof FAQ_CATEGORIES)[number];

// =============================================================================
// GENERAL EVENT FAQS (18 Items)
// =============================================================================
export const GENERAL_FAQS: FAQItem[] = [
  {
    id: 'faq-01',
    number: 1,
    question: 'What is Qiskit Fall Fest 2026?',
    answer:
      'Qiskit Fall Fest is a global, student- and community-led quantum computing festival organized in partnership with IBM Quantum. SRM University-AP is participating as a host for the 2026 edition.',
    category: 'General & Overview',
    section: 'general',
    isTopQuestion: true,
    tags: ['Overview', 'IBM Quantum', 'SRM-AP'],
  },
  {
    id: 'faq-02',
    number: 2,
    question: 'When will Qiskit Fall Fest 2026 take place?',
    answer:
      'Online Phase: October 8–13, 2026\nOffline Phase: October 26–30, 2026 at SRM University-AP, Amaravati.',
    category: 'Schedule & Venues',
    section: 'general',
    isTopQuestion: true,
    tags: ['Dates', 'Timeline', 'Hybrid'],
  },
  {
    id: 'faq-03',
    number: 3,
    question: 'Where will the event take place?',
    answer:
      'The offline phase will be hosted at SRM University-AP, Amaravati, Andhra Pradesh, India.',
    category: 'Schedule & Venues',
    section: 'general',
    tags: ['Venue', 'Campus', 'Amaravati'],
  },
  {
    id: 'faq-04',
    number: 4,
    question: 'Who can participate in the event?',
    answer:
      'Students and individuals interested in quantum computing can participate. Register on Unstop, then message us on WhatsApp with your Gmail address to get portal access.',
    category: 'General & Overview',
    section: 'general',
    tags: ['Eligibility', 'Students', 'Unstop'],
  },
  {
    id: 'faq-05',
    number: 5,
    question: 'Do I need prior knowledge of quantum computing or Qiskit?',
    answer:
      'Not necessarily. Beginners are welcome in introductory activities such as the essay and poster competitions. The hackathon and coding challenges require basic Python, quantum computing concepts, and Qiskit SDK familiarity.',
    category: 'Prerequisites & Prep',
    section: 'general',
    tags: ['Prerequisites', 'Beginners', 'Python', 'Qiskit'],
  },
  {
    id: 'faq-06',
    number: 6,
    question: 'Can I participate in multiple events?',
    answer:
      "Yes. You may participate in the essay, poster, reels, and hackathon simultaneously, as long as you meet each event's individual deadline. For the hackathon, you can only be a member of one team.",
    category: 'Events & Competitions',
    section: 'general',
    tags: ['Multiple Events', 'Competitions', 'Hackathon'],
  },
  {
    id: 'faq-07',
    number: 7,
    question: 'What events are being conducted?',
    answer:
      'Online competitions (submit via the portal):\n• Tech Reels Competition — 45–90 sec quantum video, prize up to ₹10,000 — deadline 12 Oct\n• Digital Poster Creation — infographic on Quantum Materials or Sensing, prize up to ₹5,000 — deadline 12 Oct\n• Essay Competition — 800–1,200 words on a quantum topic, prize up to ₹5,000 — deadline 12 Oct\n• Flagship Hackathon — Phase 1 online sprint deadline: 13 October 2026\n\nOffline phase (26–30 October at SRM-AP):\n• Quantum Quiddles quiz, QTalk presentations, Guess the QTech, workshops, and the Hackathon Phase 2 finale.',
    category: 'Events & Competitions',
    section: 'general',
    isTopQuestion: true,
    tags: ['Competitions', 'Reels', 'Poster', 'Essay', 'Hackathon'],
  },
  {
    id: 'faq-08',
    number: 8,
    question: 'What should I prepare before attending the event?',
    answer:
      'For online competitions and hands-on sessions:\n• A laptop and a stable internet connection\n• A GitHub account (required for the hackathon)\n• Basic Python knowledge\n• Basic quantum computing concepts\n• Qiskit SDK familiarity (for advanced hackathon tracks)',
    category: 'Prerequisites & Prep',
    section: 'general',
    tags: ['Preparation', 'Setup', 'Laptop', 'GitHub'],
  },
  {
    id: 'faq-09',
    number: 9,
    question: 'Will participants receive certificates or prizes?',
    answer:
      'Yes. Participation certificates will be issued after the offline event concludes (post 30 October 2026).\n• Offline participants: collect in person on campus.\n• Online participants: certificates sent via email to your registered Gmail.\n\nPrizes:\n• Tech Reels: up to ₹10,000\n• Essay Competition: up to ₹5,000\n• Digital Poster: up to ₹5,000\n• Hackathon: prizes announced at the closing ceremony on 30 October 2026.',
    category: 'Certificates & Contact',
    section: 'general',
    isTopQuestion: true,
    tags: ['Certificates', 'Prizes', 'Awards'],
  },
  {
    id: 'faq-10',
    number: 10,
    question: 'Is Unstop still required after registration?',
    answer:
      'No. Unstop was only for the initial sign-up. All submissions, team formation, hackathon access, and activities now happen exclusively on the official website: https://www.qffsrmap2026.com/learning/\n\nIf the portal says “You are not in the registered whitelist,” message us on WhatsApp with your Gmail and we will add you within 30 minutes.',
    category: 'Registration & Fees',
    section: 'general',
    isTopQuestion: true,
    tags: ['Unstop', 'Portal', 'Login'],
  },
  {
    id: 'faq-11',
    number: 11,
    question: 'Whom should I contact for further information?',
    answer:
      'Join the official participant WhatsApp group for fast support:\nhttps://chat.whatsapp.com/HoLFUpcm46L0qDE6VBdboW\n\nFor whitelist or portal issues, message us there with your full name and Gmail address.',
    category: 'Certificates & Contact',
    section: 'general',
    tags: ['Contact', 'WhatsApp', 'Support'],
  },
  {
    id: 'faq-12',
    number: 12,
    question: 'I see “You are not in the registered whitelist.” What do I do?',
    answer:
      'This means your Gmail has not yet been added to the portal. Steps to fix:\n1. Send your Gmail address via the WhatsApp group.\n2. We will add you within 30 minutes during working hours.\n3. Log in at https://www.qffsrmap2026.com/learning/ once added.\n\nDo not register again — just send us your Gmail.',
    category: 'Registration & Fees',
    section: 'general',
    isTopQuestion: true,
    tags: ['Whitelist', 'Authentication', 'Troubleshooting'],
  },
  {
    id: 'faq-13',
    number: 13,
    question: 'What topics can I write about for the Essay Competition?',
    answer:
      'You may choose any of the following:\n• Prompt A: The Post-Quantum Cryptographic Migration — Balancing Vulnerability and Readiness\n• Prompt B: Quantum Machine Learning — Fundamental Advantage vs Classical Baseline Realities\n• Or any quantum computing topic of your own choice\n\nWord limit: 800–1,200 words. Deadline: 12 October 2026, 11:59 PM IST.\nSubmit a PDF/DOCX (up to 15 MB) or a public Google Docs link on the portal under Day 3: Essay Competition.',
    category: 'Events & Competitions',
    section: 'general',
    tags: ['Essay', 'Topics', 'Guidelines'],
  },
  {
    id: 'faq-14',
    number: 14,
    question: 'Where and when do I submit my Poster and Essay?',
    answer:
      'Submit on the official portal: https://www.qffsrmap2026.com/learning/\n\n• Essay — Day 3 section → upload PDF/DOCX or paste a public document link\n• Poster — Day 2 section → upload PDF/DOCX or paste a public Canva/Drive link\n• Deadline for both: 12 October 2026, 11:59 PM IST\n\nEnsure any shared links are set to “Anyone with the link can view.”',
    category: 'Events & Competitions',
    section: 'general',
    tags: ['Submission', 'Poster', 'Essay', 'Deadlines'],
  },
  {
    id: 'faq-15',
    number: 15,
    question: 'How do I form a hackathon team and what is the team size?',
    answer:
      "For general registration: teams can range from 2 to 4 members according to the Universal Challenge Framework (up to 6 accommodated during initial portal setup).\n\nSteps:\n1. Log in at https://www.qffsrmap2026.com/learning/hackathon\n2. Select your domain track and problem statement\n3. Enter your team name and add teammates by their Gmail addresses\n4. Teammates receive an invitation to accept on the portal\n\nEvery teammate's Gmail must be whitelisted first. If a teammate shows 'Not Found in Whitelist,' send us their Gmail on WhatsApp.\n\nPhase 1 deadline: 13 October 2026, 11:59 PM IST.",
    category: 'Events & Competitions',
    section: 'general',
    isTopQuestion: true,
    tags: ['Team Formation', 'Hackathon', 'Team Size'],
  },
  {
    id: 'faq-16',
    number: 16,
    question: 'Where do I download the Processor A and B files for the hackathon?',
    answer:
      'There are no pre-compiled binaries to download. Processor A (5-qubit linear topology) and Processor B (9-qubit heavy-hex topology) are defined via coupling maps and noise models in the official Challenge Kit and Starter Guides in the organizer Drive folder.\n\nRefer to the Technical FAQs below for full architectural specifications and graph topologies.',
    category: 'Events & Competitions',
    section: 'general',
    tags: ['Processor A', 'Processor B', 'Hackathon'],
  },
  {
    id: 'faq-17',
    number: 17,
    question: 'What is the registration fee?',
    answer:
      'The registration fee for Qiskit Fall Fest 2026 is ₹99 per participant, paid during initial sign-up on Unstop.',
    category: 'Registration & Fees',
    section: 'general',
    isTopQuestion: true,
    tags: ['Fee', '₹99', 'Registration'],
  },
  {
    id: 'faq-18',
    number: 18,
    question: 'What skills can I gain by participating in Qiskit Fall Fest?',
    answer:
      'Participants gain hands-on experience with quantum computing, the Qiskit SDK, algorithm design, hardware-aware circuit optimization, technical writing, and collaborative project development — all directly applicable to research and industry roles in quantum computing.',
    category: 'General & Overview',
    section: 'general',
    tags: ['Skills', 'Learning', 'Career', 'Qiskit'],
  },
];

// =============================================================================
// TECHNICAL & HACKATHON FAQS (84 Items)
// =============================================================================
export const TECHNICAL_FAQS: FAQItem[] = [
  // --- 1. General Rules & Phase 1 ---
  {
    id: 'tech-01',
    number: 1,
    question: 'What is Qiskit Fall Fest 2026 Phase 1?',
    answer:
      'Phase 1 is the online qualification stage. You choose exactly one problem statement, implement its solution, run the same controlled experiment on Processor A and Processor B, compare the results, and submit a reproducible repository.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Phase 1', 'Qualification', 'Controlled Experiment'],
  },
  {
    id: 'tech-02',
    number: 2,
    question: 'How many people can be in a hackathon team?',
    answer:
      'The Universal Challenge Framework specifies teams of 2–4 members. Phase 2 continues with the same team unless the organizers explicitly announce otherwise.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Team Size', '2-4 Members', 'Phase 2'],
  },
  {
    id: 'tech-03',
    number: 3,
    question: 'How many problem statements may we attempt in Phase 1?',
    answer:
      'Exactly one for the Phase 1 submission. Do not submit multiple problem statements. An Open-Innovation entry also counts as one problem statement and must follow the organizer-provided framework.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    tags: ['Problem Statement', 'Single Submission', 'Open Innovation'],
  },
  {
    id: 'tech-04',
    number: 4,
    question: 'What is the central objective of Phase 1?',
    answer:
      'Show not only the problem output, but how the same solution behaves on two processor architectures (Processor A and Processor B). Explain observed differences with measured evidence such as circuit depth, two-qubit gate count, SWAP overhead, qubit use, runtime, and the problem-specific metric.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Central Objective', 'A/B Comparison', 'Transpilation', 'Metrics'],
  },
  {
    id: 'tech-05',
    number: 5,
    question: 'What is the Phase 1 timeline and submission deadline?',
    answer:
      'The materials describe the kickoff/course period as Oct 5–8 and online Phase 1 work as Oct 8–13. The participant instructions state that the qualification stage begins Oct 8. The stated submission deadline is Oct 13 at midnight (11:59 PM IST); review is Oct 14–16, and finalists are announced on the night of Oct 17.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Timeline', 'Deadline', 'Oct 13', 'Finalists'],
  },
  {
    id: 'tech-06',
    number: 6,
    question: 'Where do I get the Starter Guide, and what does it contain?',
    answer:
      'Use the Starter Guide for your selected problem statement located in the official Challenge Kit drive folder. It contains the problem statement description, core algorithm/solution baseline, Processor A and Processor B configurations, quantum circuit guidance, transpilation and routing instructions, performance metrics, A/B architecture comparison guidelines, and report/submission instructions.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    tags: ['Starter Guide', 'Challenge Kit', 'Baseline'],
  },
  {
    id: 'tech-07',
    number: 7,
    question: 'Do organizers provide a repository naming convention?',
    answer:
      'Follow the repository naming convention announced by the Hackathon & Competitions Cell. If no convention has been shared directly with your team, check the latest official participant instructions before submitting rather than inventing a conflicting format. The official participant instructions point to the organizer Drive folder: https://drive.google.com/drive/folders/1caxlXXeqjOkLmXGlimy_Etw0uPHSwyga.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    tags: ['Naming Convention', 'Repository', 'Organizer Drive'],
  },
  {
    id: 'tech-08',
    number: 8,
    question: 'What should our team do first?',
    answer:
      '1. Choose one PS code.\n2. Read its Starter Guide thoroughly.\n3. Record its required inputs, baseline algorithm, expected outputs, and evaluation metrics.\n4. Implement the core quantum/classical solution.\n5. Run Processor A and Processor B simulations under consistent, controlled conditions.\n6. Compare results, generate tables/figures, and complete the repository checklist.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    tags: ['First Steps', 'Workflow', 'Execution Plan'],
  },
  {
    id: 'tech-09',
    number: 9,
    question: 'Can we change the official benchmark or problem instance?',
    answer:
      'Do not change the organizer-defined benchmark in a way that makes your results incomparable. Use the specified problem instance and constraints. Record all assumptions, parameters, and important implementation choices.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    tags: ['Benchmark', 'Problem Instance', 'Constraints'],
  },
  {
    id: 'tech-10',
    number: 10,
    question: 'Can we use a custom idea for Phase 1?',
    answer:
      'Yes, through the relevant Open-Innovation option (C-OI, O-OI, S-OI, Q-OI, P-OI), but it must be treated as your single selected PS. The Chemistry Open-Innovation track explicitly asks for a 1–2 page proposal submitted and approved; follow the relevant track Starter Guide and organizer instructions for the exact process.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    tags: ['Open Innovation', 'Custom Idea', 'Proposal'],
  },
  {
    id: 'tech-11',
    number: 11,
    question: 'Is quantum advantage required to be proven?',
    answer:
      'No. The documents frame problem statements as tasks with real-world motivation and potential for quantum advantage, but Phase 1 evaluation focuses on correctness/performance, architecture analysis, reproducibility, and evidence-based technical reasoning. Do not claim an advantage that your results do not empirically demonstrate.',
    category: 'General Rules & Phase 1',
    section: 'technical',
    tags: ['Quantum Advantage', 'Evaluation', 'Empirical Evidence'],
  },

  // --- 2. Choosing a Track & Problem Statement ---
  {
    id: 'tech-12',
    number: 12,
    question: 'What tracks are available in the hackathon?',
    answer:
      'Five specialized tracks are available:\n1. Quantum Chemistry\n2. Quantum Optimization\n3. Quantum Simulation\n4. Quantum Machine Learning\n5. Post-Quantum Cryptography',
    category: 'Track & PS Selection',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Tracks', 'Chemistry', 'Optimization', 'Simulation', 'QML', 'PQC'],
  },
  {
    id: 'tech-13',
    number: 13,
    question: 'What are the listed Problem Statement (PS) codes across tracks?',
    answer:
      '• Quantum Chemistry: C1 (H₂ Ground State), C2 (Potential Energy Surface), C3 (Hardware-Efficient Chemistry), C-OI (Open Innovation)\n• Quantum Optimization: O1 (Max-Cut QAOA), O2 (Constrained Portfolio), O3 (Knapsack Optimization), O-OI (Open Innovation)\n• Quantum Simulation: S1 (Ising Ground State), S2 (Real-Time Dynamics), S3 (Trotter Error vs Noise), S-OI (Open Innovation)\n• Quantum Machine Learning: Q1 (Biomedical Signal Classifier), Q2 (Quantum Kernel Classifier), Q3 (Noise-Resilient Variational Classifier), Q-OI (Open Innovation)\n• Post-Quantum Cryptography: P1 (Quantum-Safe Secure Channel), P2 (Crypto Inventory & Migration), P3 (PQC Benchmarking Across Platforms), P-OI (Open Innovation)',
    category: 'Track & PS Selection',
    section: 'technical',
    isTopQuestion: true,
    tags: ['PS Codes', 'C1-C3', 'O1-O3', 'S1-S3', 'Q1-Q3', 'P1-P3'],
  },
  {
    id: 'tech-14',
    number: 14,
    question: 'How do I know which task and metrics apply to me?',
    answer:
      "The selected PS determines your exact technical task, data/instances, evaluation metrics, and starter material. Use your chosen PS's specification and Starter Guide rather than applying another track's requirements.",
    category: 'Track & PS Selection',
    section: 'technical',
    tags: ['Metrics', 'Task Scope', 'Starter Guide'],
  },
  {
    id: 'tech-15',
    number: 15,
    question: 'Can we combine two PSs or submit one project across two tracks?',
    answer:
      'No. The Phase 1 instructions strictly require exactly one selected PS. Keep your selected track and PS code clearly identified in your repository and submission form.',
    category: 'Track & PS Selection',
    section: 'technical',
    tags: ['Single PS', 'Submission Rule', 'Track Selection'],
  },
  {
    id: 'tech-16',
    number: 16,
    question: 'What if our team chooses an Open Innovation problem statement?',
    answer:
      'Treat the approved proposal as your single PS. Follow the relevant track Open-Innovation description and organizer-provided framework. Do not assume approval or custom benchmark details that are not explicitly confirmed by organizers.',
    category: 'Track & PS Selection',
    section: 'technical',
    tags: ['Open Innovation', 'Proposal', 'Framework'],
  },

  // --- 3. Processor A/B Benchmark ---
  {
    id: 'tech-17',
    number: 17,
    question: 'Which processors are used in Phase 1?',
    answer:
      'Processor A and Processor B only. Processor C and the custom Processor D are reserved for Phase 2.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Processor A', 'Processor B', 'Phase 1 Hardware', 'Phase 2'],
  },
  {
    id: 'tech-18',
    number: 18,
    question: 'What is the authoritative Processor A configuration?',
    answer:
      'Processor A has 5 physical qubits: q0, q1, q2, q3, q4. This is the corrected simulation-derived configuration specified in the supplied Processor A/B Benchmark Configuration document.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['Processor A', '5 Qubits', 'Configuration'],
  },
  {
    id: 'tech-19',
    number: 19,
    question: 'What is the authoritative Processor B configuration?',
    answer:
      'Processor B has 9 physical qubits: q0 through q8. You must use all nine nodes as defined in the corrected simulation-derived benchmark configuration.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['Processor B', '9 Qubits', 'All Nodes'],
  },
  {
    id: 'tech-20',
    number: 20,
    question: 'Why do some materials show different processor counts or shapes?',
    answer:
      'The supplied materials acknowledge earlier documentation inconsistencies: one early slide deck described Processor B as 7 qubits, whereas the authoritative corrected simulation configuration specifies 9 qubits; Processor A written description also had discrepancies with its graph. For Phase 1, use the corrected simulation-derived A/B maps in the Processor A/B Benchmark Configuration document and the organizer-provided benchmark definitions.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['Discrepancy', '7 vs 9 Qubits', 'Authoritative Map'],
  },
  {
    id: 'tech-21',
    number: 21,
    question: 'What is the official noise model for Phase 1?',
    answer:
      'The final exact noise parameters are frozen separately in the official Challenge Kit. The Starter Guide sample noise code is illustrative and instructs participants to replace it with official parameters once frozen. Do not infer official noise values from examples; use the organizer-provided A/B benchmark definitions as the single source of truth.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['Noise Model', 'Challenge Kit', 'Illustrative Code'],
  },
  {
    id: 'tech-22',
    number: 22,
    question: 'Can I use the noise values shown in starter examples?',
    answer:
      'Not as official values unless the organizer-provided benchmark definition specifies them. The materials mention varying example CX-noise values (about 0.5%, p=0.005, and an illustrative p=0.01), and explicitly warn against inferring the official noise model from example code.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['CX Noise', 'Illustrative Values', 'Official Params'],
  },
  {
    id: 'tech-23',
    number: 23,
    question: 'Must the same solution be run on both Processor A and Processor B?',
    answer:
      'Yes. Run the same selected problem instance and controlled algorithmic settings on both. Record the applicable problem-specific metrics and architecture/resource metrics for each, then compare them systematically.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['A/B Testing', 'Controlled Comparison', 'Methodology'],
  },
  {
    id: 'tech-24',
    number: 24,
    question: 'What is a coupling map and why do SWAP gates matter?',
    answer:
      'The processor is represented as a directed/undirected coupling graph: vertices represent physical qubits and edges represent native two-qubit interactions. If an algorithmic two-qubit interaction is requested between non-adjacent qubits, Qiskit transpilation inserts SWAP gates (or equivalent decompositions), which increases circuit depth, two-qubit gate count, execution runtime, and susceptibility to decoherence and gate noise.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['Coupling Map', 'SWAP Gates', 'Transpilation Overhead', 'Noise'],
  },
  {
    id: 'tech-25',
    number: 25,
    question: 'What architectural metrics must be measured for Processor A and B?',
    answer:
      'At minimum, report:\n• The selected PS primary output metric(s)\n• Circuit depth (before and after transpilation)\n• Two-qubit gate count (CX/CZ)\n• SWAP/routing overhead\n• Physical qubit and ancilla utilization\n• Relevant runtime or execution shot cost\n• Noise assumptions and reproducibility seeds',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['Metrics', 'Depth', 'CX Count', 'SWAPs', 'Runtime'],
  },
  {
    id: 'tech-26',
    number: 26,
    question: 'Can we add extra experiments or physical QPU results?',
    answer:
      'Optional studies and physical IBM QPU execution results may be included as bonus analysis, but the geometry-aware challenge guidelines mandate that they must remain separate from the common required simulation benchmark.',
    category: 'Processor A/B Benchmark',
    section: 'technical',
    tags: ['Extra Experiments', 'IBM QPU', 'Hardware Execution'],
  },

  // --- 4. Repository, Results & Submission ---
  {
    id: 'tech-27',
    number: 27,
    question: 'What do we submit for Phase 1 qualification?',
    answer:
      'Submit one accessible public GitHub repository (or organizer-approved Space format). The participant instructions require the repository URL and, if applicable, an optional Hugging Face Space URL.',
    category: 'Repository & Submission',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Submission', 'GitHub', 'Hugging Face Space'],
  },
  {
    id: 'tech-28',
    number: 28,
    question: 'What files must be included in the submission repository?',
    answer:
      'At minimum, your repository must contain:\n• main.ipynb or main.py (fully executed, end-to-end runnable)\n• Processor A/B definitions/configurations (processors/ or equivalent folder)\n• results/ directory containing final figures, tables, and exported data\n• README.md with problem overview, setup, methodology, and key results\n• A detailed technical report/analysis (in the notebook or as a PDF)\n• Environment specification: requirements.txt, environment.yml, or pyproject.toml',
    category: 'Repository & Submission',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Required Files', 'README', 'main.ipynb', 'results/', 'requirements.txt'],
  },
  {
    id: 'tech-29',
    number: 29,
    question: 'What should the repository README.md contain?',
    answer:
      '• Selected problem statement and track code\n• Step-by-step setup and environment reproduction instructions\n• Clear execution commands to run the solution\n• Algorithmic methodology and architecture comparison overview\n• Summary tables of key results, conclusions, and observed A/B differences',
    category: 'Repository & Submission',
    section: 'technical',
    tags: ['README', 'Documentation', 'Reproduction'],
  },
  {
    id: 'tech-30',
    number: 30,
    question: 'What should the technical report explain?',
    answer:
      '• Problem statement context and formulation\n• Approach, ansatz design, and classical baseline comparison\n• Comprehensive results supported by clean tables and figures\n• Processor A vs Processor B architecture and resource analysis\n• Interpretation of observed hardware differences based on measured evidence (not speculation)\n• Limitations, noise impact, and conclusions',
    category: 'Repository & Submission',
    section: 'technical',
    tags: ['Technical Report', 'Analysis', 'Architecture Insights'],
  },
  {
    id: 'tech-31',
    number: 31,
    question: 'What should the results/ folder contain?',
    answer:
      'The Starter Guide strongly recommends machine-readable CSV/JSON data tables alongside generated figures so plots can be verified and regenerated. Include:\n• Coupling-map diagrams for Processor A and B\n• Logical vs transpiled circuit diagrams\n• Comparative performance plots (depth, CX gates, energy/objective vs iterations/time)',
    category: 'Repository & Submission',
    section: 'technical',
    tags: ['results/ folder', 'CSV/JSON Data', 'Plots', 'Coupling Maps'],
  },
  {
    id: 'tech-32',
    number: 32,
    question: 'Does the notebook need to run from a clean environment?',
    answer:
      'Yes. The code must be completely reproducible from a clean virtual environment using the provided environment specification (requirements.txt). The repository should execute end-to-end without unhandled errors on the specified Qiskit backends.',
    category: 'Repository & Submission',
    section: 'technical',
    tags: ['Clean Environment', 'Reproducibility', 'requirements.txt'],
  },
  {
    id: 'tech-33',
    number: 33,
    question: 'What information is needed in the submission form?',
    answer:
      'The participant instructions specify:\n1. Registered team name and participant identification\n2. Selected domain track and PS code\n3. Public GitHub repository URL\n4. Hugging Face Space URL (if applicable)\n5. Confirmation that judges can access and clone the repository\n6. Confirmation that the submitted commit is the final version to be evaluated',
    category: 'Repository & Submission',
    section: 'technical',
    tags: ['Submission Form', 'Team ID', 'GitHub Link'],
  },
  {
    id: 'tech-34',
    number: 34,
    question: 'Should we submit screenshots instead of raw result files?',
    answer:
      'No. The Starter Guide specifically recommends saving machine-readable CSV/JSON result files over static screenshots so evaluation scripts can verify and re-plot the data. Include clear figures in results/, but always retain the underlying numeric data.',
    category: 'Repository & Submission',
    section: 'technical',
    tags: ['Screenshots vs Data', 'CSV', 'Machine-Readable'],
  },
  {
    id: 'tech-35',
    number: 35,
    question: 'What happens if a required file or section is missing?',
    answer:
      'Automated evaluation scripts inspect repositories for mandatory files (main.ipynb, requirements.txt, results/, README) and execute sanity checks. Missing mandatory items incur score penalties under the Universal Challenge Framework rubric.',
    category: 'Repository & Submission',
    section: 'technical',
    tags: ['Penalties', 'Missing Files', 'Automated Sanity Checks'],
  },

  // --- 5. Evaluation, AI & Reproducibility ---
  {
    id: 'tech-36',
    number: 36,
    question: 'How is Phase 1 evaluated? What is the scoring rubric?',
    answer:
      'The Universal Challenge Framework uses a 100-point rubric:\n• 40 Points: Solution Correctness & Performance (algorithm implementation, validity of results, convergence, primary metric)\n• 30 Points: Architecture Analysis (Processor A vs B comparisons, depth, two-qubit gates, routing/SWAP overhead, noise impact)\n• 30 Points: Phase 2 Readiness & Architecture Insight (technical depth, evidence-based reasoning, code structure, report quality)\n\nVisualizations, documentation clarity, and clean organization provide critical tie-breakers.',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    isTopQuestion: true,
    tags: ['Rubric', '100 Points', '40/30/30', 'Evaluation'],
  },
  {
    id: 'tech-37',
    number: 37,
    question: 'What does solution correctness and performance mean in evaluation?',
    answer:
      'The code must execute without crashes, produce theoretically valid outputs, and be benchmarked against a known classical baseline or analytical exact reference. The primary domain metric (e.g. chemical accuracy Hartree error, approximation ratio, classification F1, or PQC throughput) must be properly calculated and reported.',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    tags: ['Correctness', 'Performance', 'Classical Baseline'],
  },
  {
    id: 'tech-38',
    number: 38,
    question: 'What does architecture analysis mean in evaluation?',
    answer:
      'Measure, quantify, and contrast hardware-level execution differences between Processor A and Processor B — including circuit depth, CX gate counts, SWAP routing costs, qubit utilization, and fidelity/variance. Explain differences using physical topology and transpilation evidence.',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    tags: ['Architecture Analysis', 'Hardware Topology', 'Routing Cost'],
  },
  {
    id: 'tech-39',
    number: 39,
    question: 'How does the automated evaluation work?',
    answer:
      'Automated evaluation scripts verify repository accessibility, inspect directory structure for required files, validate environment specifications, and may execute critical notebook cells in a sandbox to check reproducibility and expected outputs.',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    tags: ['Automated Checks', 'Sandbox Execution', 'Sanity Tests'],
  },
  {
    id: 'tech-40',
    number: 40,
    question: 'What is LLM-assisted review during evaluation?',
    answer:
      'An LLM pre-screening workflow scans submissions for completeness, structural coherence, required report sections, evidence backing claims, and potential omissions. The guidelines explicitly state that LLM review is an evaluation aid for judges, not a substitute for human technical judgment.',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    tags: ['LLM Pre-Screening', 'Judging Aid', 'Human Review'],
  },
  {
    id: 'tech-41',
    number: 41,
    question: 'What is the overall evaluation sequence after submission?',
    answer:
      '1. Repository accessibility and required-files verification.\n2. Automated reproducibility and sanity test execution.\n3. LLM-assisted review for completeness and documentation gaps.\n4. Comprehensive evaluation by domain expert judges (technical depth, empirical evidence, report quality, and finalists selection).',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    tags: ['Evaluation Pipeline', 'Review Stages', 'Judges'],
  },
  {
    id: 'tech-42',
    number: 42,
    question: 'What is the official AI/LLM-use policy?',
    answer:
      'Participants must adhere to the official AI/LLM-use policy issued by the Hackathon & Competitions Cell. Any substantial generative AI assistance must be disclosed in the repository. Using AI tools does not relieve participants of the obligation to thoroughly understand, verify, and defend every line of code and technical analysis submitted.',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    tags: ['AI Policy', 'LLM Disclosure', 'Academic Integrity'],
  },
  {
    id: 'tech-43',
    number: 43,
    question: 'What reproducibility details should be reported in the submission?',
    answer:
      'The Starter Guide instructs teams to report:\n• Exact processor coupling map definitions\n• Qiskit circuit version and transpiler optimization levels\n• Shot counts and random seeds used\n• Noise model assumptions\n• Pre- and post-transpilation depth, two-qubit gate counts, and SWAP counts\n• Qubit and ancilla mapping layout\n• Post-selection yield and statistical error bars/uncertainty where relevant',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    tags: ['Reproducibility', 'Random Seed', 'Transpiler Level', 'Error Bars'],
  },
  {
    id: 'tech-44',
    number: 44,
    question: 'How should we explain observed differences between Processor A and B?',
    answer:
      'Follow a structured 5-point analysis:\n1. State what performance metric changed between A and B.\n2. Identify the specific architectural differences (e.g. 5-qubit linear vs 9-qubit heavy-hex connectivity).\n3. Demonstrate whether Qiskit transpilation inserted SWAPs or increased circuit depth.\n4. Analyze how gate-set constraints and simulated noise contributed to fidelity or error differences.\n5. Highlight remaining uncertainties and support every single claim with a table, plot, or log.',
    category: 'Evaluation & AI Policy',
    section: 'technical',
    tags: ['A/B Analysis', 'Evidence-Based', 'Reasoning Structure'],
  },

  // --- 6. Quantum Chemistry (Track C) ---
  {
    id: 'tech-45',
    number: 45,
    question: 'What problem statements are in the Quantum Chemistry track?',
    answer:
      '• C1 — Molecular Ground-State Energy (H₂)\n• C2 — Diatomic Potential Energy Surface\n• C3 — Hardware-Efficient Chemistry (Hardware-Efficient H₂O or small molecule)\n• C-OI — Open Innovation, custom quantum chemistry problem',
    category: 'Quantum Chemistry (Track C)',
    section: 'technical',
    trackCode: 'Track C',
    tags: ['Chemistry', 'C1', 'C2', 'C3', 'C-OI', 'VQE'],
  },
  {
    id: 'tech-46',
    number: 46,
    question: 'C1: What do we implement for Molecular Ground-State Energy (H₂)?',
    answer:
      'Implement Variational Quantum Eigensolver (VQE) to compute the ground-state energy of H₂ in a minimal basis (STO-3G) at an equilibrium bond distance around 0.74 Å. Use a hardware-efficient or UCCSD ansatz, and compare your result against a known classical Full CI reference. Chemical accuracy is defined as approximately 1.6 mHartree (0.0016 Hartree).',
    category: 'Quantum Chemistry (Track C)',
    section: 'technical',
    trackCode: 'C1',
    tags: ['C1', 'H2', 'VQE', 'UCCSD', 'Chemical Accuracy'],
  },
  {
    id: 'tech-47',
    number: 47,
    question: 'C1: What specific deliverables should we report?',
    answer:
      '• Electronic Hamiltonian construction and mapping (Jordan-Wigner or Parity with two-qubit reduction)\n• Ansatz parameterization\n• Processor A and B simulator convergence curves\n• Energy and resource table comparing A vs B\n• Coupling-map diagrams with qubit placement\n• Measured energy error (Hartree), CX gate count, transpiled circuit depth, SWAP overhead, and noisy variance/fidelity',
    category: 'Quantum Chemistry (Track C)',
    section: 'technical',
    trackCode: 'C1',
    tags: ['C1', 'Deliverables', 'Convergence Plot', 'Hamiltonian'],
  },
  {
    id: 'tech-48',
    number: 48,
    question: 'C2: What is the task for Diatomic Potential Energy Surface?',
    answer:
      'Compute ground-state energies across 5–7 bond distances (e.g., 0.5–2.5 Å or a stretch interval of 0.4–2.0 Å). Plot the potential energy curve against bond distance, compare qualitatively and quantitatively against classical FCI/Hartree-Fock curves, and provide comprehensive distance vs energy_A vs energy_B tables alongside resource scaling trends.',
    category: 'Quantum Chemistry (Track C)',
    section: 'technical',
    trackCode: 'C2',
    tags: ['C2', 'PES', 'Potential Energy Surface', 'Bond Distance'],
  },
  {
    id: 'tech-49',
    number: 49,
    question: 'C3: What is the task for Hardware-Efficient Chemistry (H₂O / small molecule)?',
    answer:
      'Select a molecule requiring reduction such as H₂O, HeH⁺, or a 3-atom chain. Reduce the active electronic space Hamiltonian using methods such as frozen-core approximation, active space selection (CASCI), or symmetry-based qubit tapering to keep the required qubit count at 8 or fewer. Execute VQE at an equilibrium geometry and thoroughly document every Hamiltonian reduction step.',
    category: 'Quantum Chemistry (Track C)',
    section: 'technical',
    trackCode: 'C3',
    tags: ['C3', 'H2O', 'Qubit Tapering', 'Active Space', 'Frozen Core'],
  },
  {
    id: 'tech-50',
    number: 50,
    question: 'What is Chemistry Open Innovation (C-OI)?',
    answer:
      'Propose a custom quantum chemistry problem (e.g. a larger molecular complex, an excited-state calculation via VQD/SSVQE, or molecular dipole moments). Submit a 1–2 page proposal detailing the scientific goal, expected algorithm, dataset/molecule specification, and classical intractability, and proceed upon organizer approval.',
    category: 'Quantum Chemistry (Track C)',
    section: 'technical',
    trackCode: 'C-OI',
    tags: ['C-OI', 'Chemistry Open Innovation', 'Proposal'],
  },
  {
    id: 'tech-51',
    number: 51,
    question: 'Which chemistry metrics matter for evaluation?',
    answer:
      'The primary chemistry metric is energy error relative to exact diagonalization (Hartree error, targeting chemical accuracy < 1.6 mHartree) across bond geometries. Key architectural metrics include CX gate count, transpiled circuit depth, routing SWAPs, and qubit count efficiency on Processor A vs B.',
    category: 'Quantum Chemistry (Track C)',
    section: 'technical',
    trackCode: 'Track C',
    tags: ['Chemistry Metrics', 'Hartree Error', 'CX Count', 'Depth'],
  },

  // --- 7. Quantum Optimization (Track O) ---
  {
    id: 'tech-52',
    number: 52,
    question: 'What problem statements are in the Quantum Optimization track?',
    answer:
      '• O1 — Max-Cut on Weighted Graph\n• O2 — Constrained Portfolio Optimization\n• O3 — Knapsack Optimization\n• O-OI — Open Innovation, custom combinatorial optimization problem',
    category: 'Quantum Optimization (Track O)',
    section: 'technical',
    trackCode: 'Track O',
    tags: ['Optimization', 'O1', 'O2', 'O3', 'O-OI', 'QAOA'],
  },
  {
    id: 'tech-53',
    number: 53,
    question: 'O1: What do we implement for Max-Cut with QAOA?',
    answer:
      'Construct an Ising/QUBO cost Hamiltonian for a weighted 6-vertex graph. Run the Quantum Approximate Optimization Algorithm (QAOA) at depth p=1 or p=2 using a classical optimizer (such as COBYLA or Nelder-Mead). Report the best cut bitstring and cut weight, compare with the exact classical maximum cut, and include graph and A/B coupling-map visualizations.',
    category: 'Quantum Optimization (Track O)',
    section: 'technical',
    trackCode: 'O1',
    tags: ['O1', 'Max-Cut', 'QAOA', '6 Vertices', 'QUBO'],
  },
  {
    id: 'tech-54',
    number: 54,
    question: 'O1: What are the key evaluation metrics for Max-Cut?',
    answer:
      '• Approximation Ratio: quantum expected cut weight divided by classical optimal cut weight\n• Success Probability: probability of sampling the optimal ground-state bitstring\n• Hardware Metrics: CX gate count, circuit depth, and SWAP overhead on Processor A vs B',
    category: 'Quantum Optimization (Track O)',
    section: 'technical',
    trackCode: 'O1',
    tags: ['O1 Metrics', 'Approximation Ratio', 'Optimal Bitstring', 'SWAP Count'],
  },
  {
    id: 'tech-55',
    number: 55,
    question: 'O2: What do we implement for Constrained Portfolio Optimization?',
    answer:
      'For the provided 4-asset example, formulate the Markowitz mean-variance objective (expected return minus risk penalty) subject to a budget constraint (e.g. exactly k assets selected). Encode the constraint as a penalty term in a binary quadratic Hamiltonian and execute QAOA p=1. Compare the quantum portfolio against classical combinatorial brute-force selection.',
    category: 'Quantum Optimization (Track O)',
    section: 'technical',
    trackCode: 'O2',
    tags: ['O2', 'Portfolio Optimization', 'Markowitz', 'Budget Constraint'],
  },
  {
    id: 'tech-56',
    number: 56,
    question: 'O2: What are the key metrics for portfolio optimization?',
    answer:
      '• Selected portfolio composition and total Sharpe/objective value\n• Objective ratio relative to the classical optimum\n• Feasibility rate: percentage of sampled bitstrings satisfying the strict budget constraint\n• Processor A vs B metrics: CX count, depth, and routing SWAP penalty',
    category: 'Quantum Optimization (Track O)',
    section: 'technical',
    trackCode: 'O2',
    tags: ['O2 Metrics', 'Feasibility Rate', 'Objective Ratio', 'Sharpe'],
  },
  {
    id: 'tech-57',
    number: 57,
    question: 'O3: What do we implement for Knapsack Optimization?',
    answer:
      'Using the 5-item 0/1 knapsack problem specification, formulate an objective to maximize total item value subject to knapsack weight capacity. Map the inequality constraint using slack variables or quadratic penalty terms into a shallow QAOA p=1 ansatz. Compare sampled solutions against classical dynamic programming/brute force.',
    category: 'Quantum Optimization (Track O)',
    section: 'technical',
    trackCode: 'O3',
    tags: ['O3', 'Knapsack', 'Penalty Terms', 'Slack Variables'],
  },
  {
    id: 'tech-58',
    number: 58,
    question: 'O3: What are the key metrics for Knapsack Optimization?',
    answer:
      '• Percentage of optimal knapsack value achieved\n• Feasibility probability: ratio of sampled solutions within weight capacity\n• Hardware cost: CX gates, depth, and SWAPs on Processor A and B\n• Energy/payoff landscape: 2D contour plot over QAOA variational angles (γ, β) on one processor',
    category: 'Quantum Optimization (Track O)',
    section: 'technical',
    trackCode: 'O3',
    tags: ['O3 Metrics', 'Feasibility Probability', 'Landscape Contour', 'Gamma Beta'],
  },
  {
    id: 'tech-59',
    number: 59,
    question: 'What is Optimization Open Innovation (O-OI)?',
    answer:
      'Formulate and solve a custom real-world combinatorial optimization problem (such as vehicle routing, job shop scheduling, or graph coloring). Treat your approved proposal as your single PS, formulate its QUBO Hamiltonian, execute QAOA on Processor A and B, and benchmark against classical solvers.',
    category: 'Quantum Optimization (Track O)',
    section: 'technical',
    trackCode: 'O-OI',
    tags: ['O-OI', 'Optimization Open Innovation', 'Routing', 'Scheduling'],
  },

  // --- 8. Quantum Simulation (Track S) ---
  {
    id: 'tech-60',
    number: 60,
    question: 'What problem statements are in the Quantum Simulation track?',
    answer:
      '• S1 — Ising Model Ground State\n• S2 — Real-Time Dynamics\n• S3 — Trotter Error vs Noise\n• S-OI — Open Innovation, custom quantum simulation problem',
    category: 'Quantum Simulation (Track S)',
    section: 'technical',
    trackCode: 'Track S',
    tags: ['Simulation', 'S1', 'S2', 'S3', 'S-OI', 'TFIM', 'Trotter'],
  },
  {
    id: 'tech-61',
    number: 61,
    question: 'S1: What do we implement for Ising Model Ground State?',
    answer:
      'Estimate the ground-state energy and average magnetization of a 4-spin Transverse-Field Ising Model (TFIM) using VQE (or QPE). Compare against exact numerical diagonalization. The benchmark specifies coupling J=1 and transverse field values g = 0.5, 1.0, and 1.5 across the quantum phase transition.',
    category: 'Quantum Simulation (Track S)',
    section: 'technical',
    trackCode: 'S1',
    tags: ['S1', 'TFIM', 'Ising Model', 'Phase Transition', 'VQE'],
  },
  {
    id: 'tech-62',
    number: 62,
    question: 'S1: What should we report for S1 Ising Model?',
    answer:
      '• Ground-state energy, magnetization ⟨M_z⟩, and quantum state fidelity to exact statevector\n• Energy error and magnetization deviation across g values\n• Variational ansatz parameter count\n• Processor A vs B circuit depth, two-qubit gate counts, and SWAP overhead\n• Optional: Magnetization vs transverse field g curve',
    category: 'Quantum Simulation (Track S)',
    section: 'technical',
    trackCode: 'S1',
    tags: ['S1 Deliverables', 'State Fidelity', 'Magnetization', 'TFIM'],
  },
  {
    id: 'tech-63',
    number: 63,
    question: 'S2: What is the real-time dynamics simulation task?',
    answer:
      'Simulate the unitary time evolution of a 4-spin TFIM system using first-order Trotter-Suzuki product formulas. Initialize the system in an unentangled state (e.g. |0000⟩ or |++++⟩), evolve up to a specified time horizon, compute expectation values of observables such as ⟨σ₁ᶻ⟩ or spin correlators, and benchmark against exact statevector evolution.',
    category: 'Quantum Simulation (Track S)',
    section: 'technical',
    trackCode: 'S2',
    tags: ['S2', 'Real-Time Dynamics', 'Trotterization', 'Spin Correlators'],
  },
  {
    id: 'tech-64',
    number: 64,
    question: 'S2: What should we report for real-time dynamics?',
    answer:
      '• One-Trotter-step quantum circuit diagram\n• Step count vs time horizon analysis\n• Observable expectation value vs time plot comparing quantum simulation against exact classical evolution\n• Mean absolute error of observables over time\n• Gate count scaling per time step, transpiled depth, and SWAP penalty on Processor A vs B',
    category: 'Quantum Simulation (Track S)',
    section: 'technical',
    trackCode: 'S2',
    tags: ['S2 Deliverables', 'Trotter Step', 'Observable Error', 'Scaling'],
  },
  {
    id: 'tech-65',
    number: 65,
    question: 'S3: What is the Trotter-Error-versus-Noise task?',
    answer:
      'Building on the S2 system, analyze the trade-off between algorithmic Trotter discretization error and physical device noise. Vary the number of Trotter steps: small steps reduce Trotter error but increase circuit depth and accumulate gate errors; large steps reduce gate noise but increase Trotter error. Use the organizer-provided A/B noise models to locate the optimal fidelity window.',
    category: 'Quantum Simulation (Track S)',
    section: 'technical',
    trackCode: 'S3',
    tags: ['S3', 'Trotter vs Noise', 'Trade-off', 'Optimal Depth'],
  },
  {
    id: 'tech-66',
    number: 66,
    question: 'Can I invent my own noise settings for S3?',
    answer:
      'Alternative or custom noise studies may be included as optional supplementary analysis, but they must NOT replace the organizer-provided Processor A/B benchmark definitions. Official benchmark noise parameters are authoritative for qualification evaluation.',
    category: 'Quantum Simulation (Track S)',
    section: 'technical',
    trackCode: 'S3',
    tags: ['S3 Noise Rules', 'Official Benchmark', 'Custom Noise Restrictions'],
  },
  {
    id: 'tech-67',
    number: 67,
    question: 'What is Simulation Open Innovation (S-OI)?',
    answer:
      'Propose a custom quantum simulation scenario (e.g. Heisenberg XXZ model, Fermi-Hubbard dimer, or non-equilibrium dissipative dynamics). Follow the approved proposal framework, execute on Processor A and B, and compare with classical numerical simulation.',
    category: 'Quantum Simulation (Track S)',
    section: 'technical',
    trackCode: 'S-OI',
    tags: ['S-OI', 'Simulation Open Innovation', 'Heisenberg', 'Hubbard'],
  },

  // --- 9. Quantum Machine Learning (Track Q) ---
  {
    id: 'tech-68',
    number: 68,
    question: 'What problem statements are in the Quantum Machine Learning track?',
    answer:
      '• Q1 — Biomedical Signal Classifier\n• Q2 — Quantum Kernel Classifier\n• Q3 — Noise-Resilient Variational Classifier\n• Q-OI — Open Innovation, custom QML problem',
    category: 'Quantum Machine Learning (Track Q)',
    section: 'technical',
    trackCode: 'Track Q',
    tags: ['QML', 'Q1', 'Q2', 'Q3', 'Q-OI', 'VQC', 'Quantum Kernel'],
  },
  {
    id: 'tech-69',
    number: 69,
    question: 'Q1: What is the biomedical signal classifier task?',
    answer:
      'Extract 4–8 numeric features from short biomedical segments (ECG or EEG) and encode them into a 4–8 qubit Variational Quantum Classifier (VQC). Train parameters using a classical optimizer, execute on Processor A and B, and benchmark against a classical baseline (such as logistic regression or small MLP) using the identical feature split (200–500 samples from MIT-BIH or a similar public repository).',
    category: 'Quantum Machine Learning (Track Q)',
    section: 'technical',
    trackCode: 'Q1',
    tags: ['Q1', 'Biomedical', 'ECG/EEG', 'VQC', 'MIT-BIH'],
  },
  {
    id: 'tech-70',
    number: 70,
    question: 'Q1: What should we report for Q1 Biomedical Signal Classifier?',
    answer:
      '• Test accuracy, F1 score, and Recall (recall is designated as the primary biomedical metric)\n• Confusion matrices for classical baseline vs Processor A vs Processor B\n• Transpiled CX gate count, circuit depth, SWAP overhead, and physical layout diagrams\n• Phase 2 note: Some problem wording references Processor C design, but Phase 1 qualification is strictly evaluated on Processor A and B.',
    category: 'Quantum Machine Learning (Track Q)',
    section: 'technical',
    trackCode: 'Q1',
    tags: ['Q1 Deliverables', 'Recall', 'F1 Score', 'Confusion Matrix'],
  },
  {
    id: 'tech-71',
    number: 71,
    question: 'Q2: What is the quantum kernel classifier task?',
    answer:
      'Construct a quantum feature map (such as ZZFeatureMap with repeated entanglement layers) to map classical data into quantum Hilbert space. Compute quantum kernel gram matrices via circuit overlap transition probabilities, plug into a classical Support Vector Machine (C-SVM), and benchmark against classical RBF and polynomial SVM kernels across multiple random seeds.',
    category: 'Quantum Machine Learning (Track Q)',
    section: 'technical',
    trackCode: 'Q2',
    tags: ['Q2', 'Quantum Kernel', 'ZZFeatureMap', 'SVM', 'RBF Kernel'],
  },
  {
    id: 'tech-72',
    number: 72,
    question: 'Q2: What should we report for Q2 Quantum Kernel Classifier?',
    answer:
      '• Classification accuracy and ROC-AUC with 95% confidence intervals across repeated seeds\n• Total quantum circuit executions (O(N²) gram matrix evaluation cost)\n• Processor A vs Processor B kernel-circuit CX count, transpiled depth, and SWAP routing penalty\n• Evaluation on 2–3 datasets, including a synthetic dataset specifically structured around quantum feature map symmetries',
    category: 'Quantum Machine Learning (Track Q)',
    section: 'technical',
    trackCode: 'Q2',
    tags: ['Q2 Deliverables', 'AUC', 'Confidence Intervals', 'Gram Matrix'],
  },
  {
    id: 'tech-73',
    number: 73,
    question: 'Q3: What is the noise-resilient variational classifier task?',
    answer:
      'Train a VQC model under ideal noiseless conditions, evaluate classification degradation on noisy Processor A and B models, and apply at least two quantum error mitigation (QEM) techniques (e.g. Zero-Noise Extrapolation [ZNE] and Readout Error Mitigation [M3]). Report comparative ideal vs unmitigated-noisy vs mitigated outcomes alongside the added circuit shot overhead.',
    category: 'Quantum Machine Learning (Track Q)',
    section: 'technical',
    trackCode: 'Q3',
    tags: ['Q3', 'Error Mitigation', 'ZNE', 'Readout Mitigation', 'VQC'],
  },
  {
    id: 'tech-74',
    number: 74,
    question: 'Q3: Which processors should Phase 1 use for Q3?',
    answer:
      'The detailed Q3 problem description mentions Processor C in certain descriptive sentences, but the authoritative Phase 1 participant instructions restrict the qualification benchmark strictly to Processor A and B. Processor C is reserved exclusively for Phase 2.',
    category: 'Quantum Machine Learning (Track Q)',
    section: 'technical',
    trackCode: 'Q3',
    tags: ['Q3 Processor Rule', 'Processor A and B Only', 'Processor C Phase 2'],
  },
  {
    id: 'tech-75',
    number: 75,
    question: 'What is QML Open Innovation (Q-OI)?',
    answer:
      'Propose a custom quantum machine learning task (such as Quantum Generative Adversarial Networks [QGAN], Quantum Convolutional Neural Networks [QCNN], or reinforcement learning). Execute within the organizer benchmark framework on Processor A and B.',
    category: 'Quantum Machine Learning (Track Q)',
    section: 'technical',
    trackCode: 'Q-OI',
    tags: ['Q-OI', 'QML Open Innovation', 'QGAN', 'QCNN'],
  },

  // --- 10. Post-Quantum Cryptography (Track P) ---
  {
    id: 'tech-76',
    number: 76,
    question: 'What problem statements are in the Post-Quantum Cryptography track?',
    answer:
      '• P1 — Quantum-Safe Secure Channel\n• P2 — Crypto Inventory & Migration Planner\n• P3 — PQC Performance Benchmark Across Constrained Platforms\n• P-OI — Open Innovation, custom post-quantum cryptography problem',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'Track P',
    tags: ['PQC', 'P1', 'P2', 'P3', 'P-OI', 'ML-KEM', 'ML-DSA'],
  },
  {
    id: 'tech-77',
    number: 77,
    question: 'P1: What is the quantum-safe secure channel task?',
    answer:
      'Construct an end-to-end secure messaging/file-transfer communication demo using NIST-standardized algorithms: ML-KEM (Kyber) for key encapsulation, ML-DSA (Dilithium) for digital signature authentication, HKDF for symmetric key derivation, and AES-256-GCM for payload encryption. You must use vetted cryptographic libraries (such as liboqs or pyca/cryptography); the instructions strictly forbid writing cryptographic primitives from scratch.',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'P1',
    tags: ['P1', 'Secure Channel', 'ML-KEM', 'ML-DSA', 'AES-256-GCM', 'liboqs'],
  },
  {
    id: 'tech-78',
    number: 78,
    question: 'P1: What should we report for P1 Quantum-Safe Secure Channel?',
    answer:
      '• Successful interoperable handshake logs and protocol sequence diagram\n• Handshake establishment latency and peak memory usage per platform\n• Transmitted public key and ciphertext byte sizes\n• Throughput across payload benchmarks: 1 KB, 100 KB, and 10 MB\n• Technical security analysis of Man-in-the-Middle (MitM) resistance via signature authentication',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'P1',
    tags: ['P1 Deliverables', 'Handshake Latency', 'Payload Benchmarks', 'MitM'],
  },
  {
    id: 'tech-79',
    number: 79,
    question: 'P2: What is the crypto inventory and migration planner task?',
    answer:
      'Implement an automated static code scanning engine that analyzes an organizer-provided sample software repository for cryptographic API usage (e.g. RSA, ECC, Diffie-Hellman, SHA-1). The tool must parse ASTs, classify quantum vulnerability risk (High/Medium/Low), and generate actionable migration recommendations toward PQC replacements. Ground truth is withheld by organizers until evaluation.',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'P2',
    tags: ['P2', 'Crypto Inventory', 'Static Analysis', 'AST', 'Migration Planner'],
  },
  {
    id: 'tech-80',
    number: 80,
    question: 'P2: What should we report for P2 Crypto Inventory?',
    answer:
      '• Detection Precision, Recall, and F1 score against organizer ground truth\n• Scan execution runtime and memory footprint\n• Machine-readable exported risk report (JSON/HTML)\n• Granular analysis of false-positive and false-negative classifications',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'P2',
    tags: ['P2 Deliverables', 'Precision', 'Recall', 'Scan Time', 'F1 Score'],
  },
  {
    id: 'tech-81',
    number: 81,
    question: 'P3: What is the PQC performance benchmark task across constrained platforms?',
    answer:
      'Benchmark NIST-selected post-quantum algorithms (ML-KEM-768, ML-DSA-65, SLH-DSA-128s) against legacy classical baselines (RSA-2048, ECDH/ECDSA P-256) across the three organizer-defined target hardware platforms. Measure key generation, encapsulation/signing, and decapsulation/verification times, memory consumption, and binary code sizes using at least 100 repetitions per measurement.',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'P3',
    tags: ['P3', 'PQC Benchmarks', 'ML-KEM-768', 'ML-DSA-65', 'SLH-DSA', 'RSA-2048'],
  },
  {
    id: 'tech-82',
    number: 82,
    question: 'P3: What should we report for P3 PQC Performance Benchmark?',
    answer:
      '• Fully reproducible benchmark test scripts with fixed parameter configurations\n• Comprehensive comparison tables of runtime (μs/ms), RAM (KB), and key/signature byte sizes\n• At least three comparative charts illustrating latency and size trade-offs\n• Calculated performance degradation ratios comparing post-quantum algorithms against classical RSA/ECC baselines',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'P3',
    tags: ['P3 Deliverables', 'Degradation Ratio', 'Latency Plots', 'RAM Footprint'],
  },
  {
    id: 'tech-83',
    number: 83,
    question: 'How does Post-Quantum Cryptography differ from the other hackathon tracks?',
    answer:
      'The PQC track centers on classical software and embedded security systems migrating to quantum-resistant mathematical primitives (lattice-based and hash-based cryptography). Follow the specific platform benchmark instructions and cryptographic deliverables in your Starter Guide; do not assume your PS requires quantum Processor A/B graph simulation unless explicitly mandated.',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'Track P',
    tags: ['PQC Track Nature', 'Classical Hardware', 'Lattice Cryptography'],
  },
  {
    id: 'tech-84',
    number: 84,
    question: 'What is Post-Quantum Cryptography Open Innovation (P-OI)?',
    answer:
      'Propose an innovative post-quantum cryptographic application (e.g. quantum-safe blockchain consensus, post-quantum TLS handshake integration, or hardware-accelerated lattice operations on FPGA/microcontrollers). Follow track-specific guidelines and submit within the organizer framework.',
    category: 'Post-Quantum Cryptography (Track P)',
    section: 'technical',
    trackCode: 'P-OI',
    tags: ['P-OI', 'PQC Open Innovation', 'TLS', 'Hardware Acceleration'],
  },
];

// =============================================================================
// UNIFIED FAQS DATA EXPORT
// =============================================================================
export const FAQS_DATA: FAQItem[] = [...GENERAL_FAQS, ...TECHNICAL_FAQS];
