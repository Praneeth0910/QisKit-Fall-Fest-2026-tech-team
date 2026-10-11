"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MapPin,
  Building2,
  Calendar,
  Copy,
  Check,
  ArrowRight,
  Info,
  CheckCircle2,
  ExternalLink,
  Maximize2,
  Minimize2,
  Cpu,
  Terminal,
  Layers,
  Sparkles,
  BookOpen,
  FileCode,
  Award,
  Clock,
  ShieldCheck,
  Binary,
  Atom,
  TrendingUp,
  Network,
  Brain,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { QuantumWaveField } from '@/components/ui/QuantumWaveField';
import { Footer } from '@/components/shared/Footer';
import { StaggeredTextReveal } from '@/components/ui/StaggeredTextReveal';
import {
  FAQS_DATA,
  GENERAL_FAQS,
  TECHNICAL_FAQS,
  GENERAL_CATEGORIES,
  TECHNICAL_CATEGORIES,
  FAQ_META,
  TECHNICAL_BENCHMARK_NOTICE,
  FAQItem,
  FAQSection,
} from '@/data/faqs';
import { REGISTRATION_URL } from '@/lib/constants';

const fadeInUpVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: (customDelay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
      delay: customDelay,
    },
  }),
};

export default function FAQsPageContent() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // High-level section switcher: 'all' | 'general' | 'technical'
  const [activeSection, setActiveSection] = useState<'all' | 'general' | 'technical'>('all');

  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Accordion open states (Default first 2 general & first 2 technical open)
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'faq-01': true,
    'faq-02': true,
    'tech-01': true,
    'tech-04': true,
  });

  // Copied link toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Support direct anchor linking on page mount or hash change (#faq-01..#faq-18, #tech-01..#tech-84)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) return;

      const targetId = hash.startsWith('faq-') || hash.startsWith('tech-')
        ? hash
        : `faq-${hash.padStart(2, '0')}`;

      const found = FAQS_DATA.find((item) => item.id === targetId || `faq-${item.number}` === hash);

      if (found) {
        if (found.section === 'general' && activeSection === 'technical') {
          setActiveSection('all');
        } else if (found.section === 'technical' && activeSection === 'general') {
          setActiveSection('all');
        }
        setOpenItems((prev) => ({ ...prev, [found.id]: true }));
        setTimeout(() => {
          const el = document.getElementById(found.id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [activeSection]);

  // Handle section switch and reset category filter
  const handleSectionChange = (section: 'all' | 'general' | 'technical') => {
    setActiveSection(section);
    setSelectedCategory('All');
  };

  // Compute available categories for the active section
  const availableCategories = useMemo(() => {
    if (activeSection === 'general') return GENERAL_CATEGORIES;
    if (activeSection === 'technical') return TECHNICAL_CATEGORIES;
    return ['All', ...GENERAL_CATEGORIES.filter((c) => c !== 'All'), ...TECHNICAL_CATEGORIES.filter((c) => c !== 'All')];
  }, [activeSection]);

  // Filter FAQs based on active section, category, and search query
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return FAQS_DATA.filter((item) => {
      // 1. Section filtering
      if (activeSection !== 'all' && item.section !== activeSection) {
        return false;
      }

      // 2. Category filtering
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // 3. Search query filtering
      if (!q) return true;

      const matchesQuestion = item.question.toLowerCase().includes(q);
      const matchesAnswer = item.answer.toLowerCase().includes(q);
      const matchesCategory = item.category.toLowerCase().includes(q);
      const matchesId = item.id.toLowerCase().includes(q);
      const matchesNumber = `${item.number}` === q || `q${item.number}`.includes(q);
      const matchesTrack = item.trackCode ? item.trackCode.toLowerCase().includes(q) : false;
      const matchesTags = item.tags ? item.tags.some((t) => t.toLowerCase().includes(q)) : false;

      return (
        matchesQuestion ||
        matchesAnswer ||
        matchesCategory ||
        matchesId ||
        matchesNumber ||
        matchesTrack ||
        matchesTags
      );
    });
  }, [activeSection, selectedCategory, searchQuery]);

  // Compute cross-section search hits when searching
  const otherSectionHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { general: 0, technical: 0 };

    const genCount = GENERAL_FAQS.filter((item) =>
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    ).length;

    const techCount = TECHNICAL_FAQS.filter((item) =>
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.trackCode && item.trackCode.toLowerCase().includes(q))
    ).length;

    return { general: genCount, technical: techCount };
  }, [searchQuery]);

  // Toggle single FAQ accordion
  const toggleFaq = useCallback((id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Expand / Collapse all currently filtered FAQs
  const areAllExpanded = useMemo(() => {
    if (filteredFaqs.length === 0) return false;
    return filteredFaqs.every((item) => !!openItems[item.id]);
  }, [filteredFaqs, openItems]);

  const toggleAll = useCallback(() => {
    if (areAllExpanded) {
      setOpenItems({});
    } else {
      const newOpen: Record<string, boolean> = {};
      filteredFaqs.forEach((item) => {
        newOpen[item.id] = true;
      });
      setOpenItems((prev) => ({ ...prev, ...newOpen }));
    }
  }, [areAllExpanded, filteredFaqs]);

  // Copy Question & Answer text to clipboard cleanly
  const copyFaqContent = useCallback((item: FAQItem) => {
    if (typeof window === 'undefined') return;
    const formattedText = `Q: ${item.question}\n\nA: ${item.answer}`;
    navigator.clipboard.writeText(formattedText).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2200);
    });
  }, []);

  // Scroll smoothly to a target FAQ item & expand it
  const scrollToQuestion = (id: string, targetSection?: 'general' | 'technical') => {
    if (targetSection && activeSection !== 'all' && activeSection !== targetSection) {
      setActiveSection(targetSection);
    }
    setOpenItems((prev) => ({ ...prev, [id]: true }));
    if (typeof window === 'undefined') return;
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Helper to format text with links and bullets
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');

    return (
      <div className="space-y-2 text-sm sm:text-base leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // Check for bullet point
          if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
            const bulletText = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-1.5 sm:pl-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6C151E] dark:bg-[#F0A2B0] shrink-0 mt-2" />
                <span className="flex-1">{renderWithLinks(bulletText)}</span>
              </div>
            );
          }

          // Check for numbered list (e.g. 1. 2.)
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-1.5 sm:pl-2">
                <span className="font-mono text-xs font-bold text-[#6C151E] dark:text-[#F0A2B0] shrink-0 mt-0.5 min-w-[1.2rem]">
                  {numMatch[1]}.
                </span>
                <span className="flex-1">{renderWithLinks(numMatch[2])}</span>
              </div>
            );
          }

          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          return (
            <p key={idx} className="text-[#2A2120] dark:text-[#D5C9C8]">
              {renderWithLinks(line)}
            </p>
          );
        })}
      </div>
    );
  };

  // Convert raw URLs into clickable anchor links
  const renderWithLinks = (str: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = str.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#6C151E] dark:text-[#F0A2B0] underline underline-offset-2 hover:opacity-80 transition-opacity break-all"
          >
            <span>{part}</span>
            <ExternalLink size={13} className="shrink-0" />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="w-full flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[#6C151E] selection:text-[#F5F3F0]">
      
      {/* =========================================================================
          HERO + KEY HIGHLIGHTS VIEWPORT WRAPPER (FITS IN SINGLE INITIAL FRAME)
          ========================================================================= */}
      <div className="relative w-full h-[calc(100dvh-80px)] min-h-[500px] flex flex-col justify-between overflow-hidden">
        {/* SECTION 01: CLEAN EDITORIAL HERO SECTION */}
        <section
          id="hero"
          data-section="top"
          className="relative w-full flex-1 overflow-hidden bg-gradient-to-b from-[#FAF7F2] via-[#F4E8DC]/30 to-[#FAF7F5] dark:from-[#0B0506] dark:via-[#14080A] dark:to-[#0B0506] border-b border-[rgba(108,21,30,0.15)] dark:border-[rgba(61,20,24,0.6)] transition-colors duration-300 py-2 sm:py-3 lg:py-4 flex items-center"
        >
          {/* QUANTUM WAVE FIELD CANVAS */}
          <QuantumWaveField className="opacity-50 dark:opacity-80" />

          {/* Ambient Glow Orbs */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#6C151E]/20 via-[#A7192A]/10 to-transparent blur-3xl dark:from-[#6C151E]/30" />
            <div className="absolute top-1/4 right-0 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-[#B08D57]/20 via-[#6C151E]/10 to-transparent blur-3xl dark:from-[#F0A2B0]/20" />
          </div>

          <div className="relative z-10 mx-auto max-w-[1440px] w-full px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="max-w-3xl space-y-2 sm:space-y-2.5 pointer-events-auto">

              {/* Main Headline */}
              <motion.h1
                className="font-serif text-[clamp(2.1rem,4.2vw,3.5rem)] font-bold leading-[1.03] tracking-[-0.03em] m-0 text-[#A7192A] dark:text-[#F0A2B0]"
                initial="hidden"
                animate="visible"
                custom={0.05}
                variants={fadeInUpVariant}
              >
                <span className="block">
                  <StaggeredTextReveal text="Frequently Asked" delay={0.05} stagger={0.02} letterClassName="text-[#A7192A] dark:text-[#F0A2B0]" />
                </span>
                <span className="block mt-0.5 sm:mt-1">
                  <StaggeredTextReveal text="Questions." delay={0.2} stagger={0.025} letterClassName="font-serif italic font-semibold text-[#6C151E] dark:text-white" />
                </span>
              </motion.h1>

              {/* Description Subtext */}
              <motion.p
                className="font-sans font-normal text-[#4E4441] dark:text-[#C4B9B8] text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl"
                initial="hidden"
                animate="visible"
                custom={0.15}
                variants={fadeInUpVariant}
              >
                Explore General Event Rules, Registration &amp; Venue Details, along with complete Technical Hackathon guidelines across all 5 tracks: Quantum Chemistry, Optimization, Simulation, QML, and Post-Quantum Cryptography.
              </motion.p>

              {/* Quick Jump Directory Cards (First Page Card Structure & Sizing) */}
              <motion.div
                className="pt-1 space-y-2 max-w-3xl"
                initial="hidden"
                animate="visible"
                custom={0.25}
                variants={fadeInUpVariant}
              >
                <div className="font-sans text-xs font-bold uppercase tracking-widest text-[#A7192A] dark:text-[#F0A2B0]">
                  FAQ DIRECTORY &amp; TRACKS
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {/* Card 1: General FAQs */}
                  <button
                    type="button"
                    onClick={() => handleSectionChange('general')}
                    className={`group relative flex flex-col justify-center p-3 sm:p-3.5 rounded-xl border text-left transition-all duration-300 shadow-xs hover:shadow-lg hover:-translate-y-0.5 cursor-pointer overflow-hidden backdrop-blur-xl ${
                      activeSection === 'general'
                        ? 'border-[#6C151E] bg-[#6C151E] text-white shadow-md'
                        : 'border-[#6C151E]/20 dark:border-[#3D1418] bg-white/95 dark:bg-[#180C0E] hover:border-[#6C151E] dark:hover:border-[#F0A2B0]/50'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#6C151E] via-[#8A1522] to-[#A7192A] opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className={`font-serif font-bold text-sm sm:text-base leading-tight transition-colors duration-300 ${
                        activeSection === 'general' ? 'text-white' : 'text-[#211818] dark:text-white group-hover:text-white'
                      }`}>
                        General FAQs
                      </div>
                      <BookOpen size={16} className={`shrink-0 transition-colors duration-300 ${
                        activeSection === 'general' ? 'text-white/80' : 'text-[#6C151E] dark:text-[#F0A2B0] group-hover:text-white'
                      }`} />
                    </div>
                    <div className={`relative z-10 text-xs font-sans font-semibold mt-0.5 transition-colors duration-300 ${
                      activeSection === 'general' ? 'text-white/90' : 'text-[#6C151E] dark:text-[#F0A2B0] group-hover:text-white'
                    }`}>
                      18 Questions
                    </div>
                  </button>

                  {/* Card 2: Technical & Hackathon FAQs */}
                  <button
                    type="button"
                    onClick={() => handleSectionChange('technical')}
                    className={`group relative flex flex-col justify-center p-3 sm:p-3.5 rounded-xl border text-left transition-all duration-300 shadow-xs hover:shadow-lg hover:-translate-y-0.5 cursor-pointer overflow-hidden backdrop-blur-xl ${
                      activeSection === 'technical'
                        ? 'border-[#6C151E] bg-[#6C151E] text-white shadow-md'
                        : 'border-[#6C151E]/20 dark:border-[#3D1418] bg-white/95 dark:bg-[#180C0E] hover:border-[#6C151E] dark:hover:border-[#F0A2B0]/50'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#6C151E] via-[#8A1522] to-[#A7192A] opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className={`font-serif font-bold text-sm sm:text-base leading-tight transition-colors duration-300 ${
                        activeSection === 'technical' ? 'text-white' : 'text-[#211818] dark:text-white group-hover:text-white'
                      }`}>
                        Technical &amp; Hackathon
                      </div>
                      <Cpu size={16} className={`shrink-0 transition-colors duration-300 ${
                        activeSection === 'technical' ? 'text-white/80' : 'text-[#6C151E] dark:text-[#F0A2B0] group-hover:text-white'
                      }`} />
                    </div>
                    <div className={`relative z-10 text-xs font-sans font-semibold mt-0.5 transition-colors duration-300 ${
                      activeSection === 'technical' ? 'text-white/90' : 'text-[#6C151E] dark:text-[#F0A2B0] group-hover:text-white'
                    }`}>
                      84 Questions
                    </div>
                  </button>

                  {/* Card 3: All Questions */}
                  <button
                    type="button"
                    onClick={() => handleSectionChange('all')}
                    className={`group relative flex flex-col justify-center p-3 sm:p-3.5 rounded-xl border text-left transition-all duration-300 shadow-xs hover:shadow-lg hover:-translate-y-0.5 cursor-pointer overflow-hidden backdrop-blur-xl ${
                      activeSection === 'all'
                        ? 'border-[#6C151E] bg-[#6C151E] text-white shadow-md'
                        : 'border-[#6C151E]/20 dark:border-[#3D1418] bg-white/95 dark:bg-[#180C0E] hover:border-[#6C151E] dark:hover:border-[#F0A2B0]/50'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#6C151E] via-[#8A1522] to-[#A7192A] opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className={`font-serif font-bold text-sm sm:text-base leading-tight transition-colors duration-300 ${
                        activeSection === 'all' ? 'text-white' : 'text-[#211818] dark:text-white group-hover:text-white'
                      }`}>
                        All Questions
                      </div>
                      <Layers size={16} className={`shrink-0 transition-colors duration-300 ${
                        activeSection === 'all' ? 'text-white/80' : 'text-[#6C151E] dark:text-[#F0A2B0] group-hover:text-white'
                      }`} />
                    </div>
                    <div className={`relative z-10 text-xs font-sans font-semibold mt-0.5 transition-colors duration-300 ${
                      activeSection === 'all' ? 'text-white/90' : 'text-[#6C151E] dark:text-[#F0A2B0] group-hover:text-white'
                    }`}>
                      102 Total Directory
                    </div>
                  </button>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* SECTION 02: PURE QISKIT BURGUNDY KEY HIGHLIGHTS STRIP */}
        <section
          id="faq-stats"
          aria-label="FAQ Highlights"
          className="relative w-full shrink-0 bg-gradient-to-r from-[#500D14] via-[#6C151E] to-[#500D14] dark:from-[#200508] dark:via-[#350A0F] dark:to-[#200508] text-[#FAF7F3] border-y border-[#A7192A]/50 dark:border-[#4A151C] py-2.5 sm:py-3.5 shadow-2xl isolate overflow-hidden"
        >
          {/* Ambient Glow Orbs */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#A7192A]/25 dark:bg-[#A7192A]/15 rounded-full blur-3xl" />
            <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#8A1522]/35 dark:bg-[#F0A2B0]/15 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
              
              {/* Metric 1 */}
              <div className="group flex flex-col items-start p-3.5 sm:p-4 rounded-2xl bg-white/12 dark:bg-[#1A060A]/85 border border-white/20 dark:border-[#4A151C] hover:border-white/40 dark:hover:border-[#F0A2B0]/50 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 shadow-lg">
                <span className="font-sans text-xs font-bold tracking-widest uppercase text-[#F5DABF] dark:text-[#F0A2B0] mb-1">
                  Total Questions
                </span>
                <div className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight group-hover:text-white transition-colors">
                  102 Verified Items
                </div>
                <span className="text-xs font-sans text-[#F0E6E3] dark:text-[#C4B9B8] mt-1">
                  18 General • 84 Technical
                </span>
              </div>

              {/* Metric 2 */}
              <div className="group flex flex-col items-start p-3.5 sm:p-4 rounded-2xl bg-white/12 dark:bg-[#1A060A]/85 border border-white/20 dark:border-[#4A151C] hover:border-white/40 dark:hover:border-[#F0A2B0]/50 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 shadow-lg">
                <span className="font-sans text-xs font-bold tracking-widest uppercase text-[#F5DABF] dark:text-[#F0A2B0] mb-1">
                  Hackathon Tracks
                </span>
                <div className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight group-hover:text-white transition-colors">
                  5 Domain Tracks
                </div>
                <span className="text-xs font-sans text-[#F0E6E3] dark:text-[#C4B9B8] mt-1">
                  Chemistry • Opt • Sim • QML • PQC
                </span>
              </div>

              {/* Metric 3 */}
              <div className="group flex flex-col items-start p-3.5 sm:p-4 rounded-2xl bg-white/12 dark:bg-[#1A060A]/85 border border-white/20 dark:border-[#4A151C] hover:border-white/40 dark:hover:border-[#F0A2B0]/50 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 shadow-lg">
                <span className="font-sans text-xs font-bold tracking-widest uppercase text-[#F5DABF] dark:text-[#F0A2B0] mb-1">
                  Phase 1 Benchmarks
                </span>
                <div className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight group-hover:text-white transition-colors">
                  Processor A &amp; B
                </div>
                <span className="text-xs font-sans text-[#F0E6E3] dark:text-[#C4B9B8] mt-1">
                  5Q Linear &amp; 9Q Heavy-Hex
                </span>
              </div>

              {/* Metric 4 */}
              <div className="group flex flex-col items-start p-3.5 sm:p-4 rounded-2xl bg-white/12 dark:bg-[#1A060A]/85 border border-white/20 dark:border-[#4A151C] hover:border-white/40 dark:hover:border-[#F0A2B0]/50 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 shadow-lg">
                <span className="font-sans text-xs font-bold tracking-widest uppercase text-[#F5DABF] dark:text-[#F0A2B0] mb-1">
                  Submission Deadline
                </span>
                <div className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight group-hover:text-white transition-colors">
                  13 Oct • 11:59 PM
                </div>
                <span className="text-xs font-sans text-[#F0E6E3] dark:text-[#C4B9B8] mt-1">
                  Phase 1 Online Sprint Finale
                </span>
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* =========================================================================
          SECTION 03: CONTROL BAR (PRIMARY TABS, SEARCH, AND CATEGORY PILLS)
          ========================================================================= */}
      <section
        id="faq-controls"
        aria-label="FAQ Search & Controls"
        className="sticky top-[80px] sm:top-[84px] z-30 w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3 pointer-events-none transition-colors duration-300"
      >
        <div className="mx-auto max-w-[1440px] rounded-2xl p-3.5 sm:p-4 bg-white/95 dark:bg-[#16080B]/95 backdrop-blur-xl border border-[#3A0B10]/15 dark:border-[#3D1418] shadow-xl pointer-events-auto space-y-3">
          
          {/* Top Row: Primary Section Switcher + Search Bar + Expand Toggle */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            
            {/* Primary Mode Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FAF7F2] dark:bg-[#1C0B0E] border border-[#3A0B10]/10 dark:border-[#3D1418] shrink-0 self-start lg:self-auto overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => handleSectionChange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSection === 'all'
                    ? 'bg-[#6C151E] text-white shadow-xs'
                    : 'text-[#3A0B10]/70 dark:text-[#C4B9B8] hover:text-[#3A0B10] dark:hover:text-white'
                }`}
              >
                All FAQs ({FAQS_DATA.length})
              </button>
              <button
                type="button"
                onClick={() => handleSectionChange('general')}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSection === 'general'
                    ? 'bg-[#6C151E] text-white shadow-xs'
                    : 'text-[#3A0B10]/70 dark:text-[#C4B9B8] hover:text-[#3A0B10] dark:hover:text-white'
                }`}
              >
                General FAQs ({GENERAL_FAQS.length})
              </button>
              <button
                type="button"
                onClick={() => handleSectionChange('technical')}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSection === 'technical'
                    ? 'bg-[#6C151E] text-white shadow-xs'
                    : 'text-[#3A0B10]/70 dark:text-[#C4B9B8] hover:text-[#3A0B10] dark:hover:text-white'
                }`}
              >
                Technical &amp; Hackathon ({TECHNICAL_FAQS.length})
              </button>
            </div>

            {/* Instant Search Bar */}
            <div className="relative flex-1 min-w-[240px]">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6C151E] dark:text-[#F0A2B0]">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search FAQs (e.g. C1 H2, QAOA, Processor A/B, noise model, rubric, ₹99)..."
                aria-label="Search the FAQ"
                className="w-full pl-10 pr-10 py-2 sm:py-2.5 rounded-xl border border-[#3A0B10]/20 dark:border-[#3D1418] bg-white dark:bg-[#1C0B0E] text-sm font-sans text-[#16171B] dark:text-white placeholder-[#16171B]/45 dark:placeholder-[#9C8F8E] focus:outline-none focus:ring-2 focus:ring-[#6C151E] dark:focus:ring-[#F0A2B0] transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#16171B]/50 dark:text-[#9C8F8E] hover:text-[#3A0B10] dark:hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Right Tools: Result Counter & Expand/Collapse */}
            <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0">
              {searchQuery && (
                <span className="text-xs font-sans font-semibold text-[#16171B]/70 dark:text-[#C4B9B8] bg-white/60 dark:bg-black/40 px-2.5 py-1.5 rounded-lg border border-[#3A0B10]/10 dark:border-[#3D1418]">
                  {filteredFaqs.length} Matched
                </span>
              )}

              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-sans font-bold bg-[#6C151E] text-white dark:bg-[#2A1014] dark:text-[#F0A2B0] border border-transparent dark:border-[#4A151C] hover:bg-[#8A1B27] dark:hover:bg-[#3A141A] transition-all duration-300 shadow-sm cursor-pointer"
              >
                {areAllExpanded ? (
                  <>
                    <Minimize2 size={14} />
                    <span>Collapse All</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={14} />
                    <span>Expand All</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Row: Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            <span className="text-xs font-sans font-bold text-[#6C151E] dark:text-[#F0A2B0] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Layers size={13} />
              Filter:
            </span>
            {availableCategories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-sans font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[#6C151E] text-white shadow-xs'
                      : 'bg-white/80 dark:bg-[#180C0E] text-[#2A1014] dark:text-[#C4B9B8] border border-[#3A0B10]/10 dark:border-[#3D1418] hover:border-[#6C151E]/40 dark:hover:border-[#F0A2B0]/40'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 04: FAQ ACCORDION DIRECTORY + TECHNICAL ADVISORIES
          ========================================================================= */}
      <section
        id="faq-directory"
        aria-label="FAQ Questions Directory"
        className="w-full py-10 sm:py-14 lg:py-16 bg-[#FAF7F5] dark:bg-[#0D0506] transition-colors duration-300 flex-grow"
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6">
          
          {/* TECHNICAL BENCHMARK NOTICE BOX (Shown when viewing Technical or All FAQs) */}
          {(activeSection === 'technical' || activeSection === 'all') && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl p-5 sm:p-7 bg-gradient-to-br from-[#FAF2E8] via-white to-[#F8EFE4] dark:from-[#21090C] dark:via-[#1A080A] dark:to-[#160608] border-2 border-[#B08D57]/50 dark:border-[#B08D57]/40 shadow-md space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#B08D57]/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#6C151E]/10 dark:bg-[#B08D57]/20 text-[#6C151E] dark:text-[#B08D57] flex items-center justify-center shrink-0">
                    <Cpu size={22} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base sm:text-lg text-[#3A0B10] dark:text-white">
                      {TECHNICAL_BENCHMARK_NOTICE.title}
                    </h3>
                    <p className="text-xs font-sans text-[#6C151E] dark:text-[#F0A2B0] font-medium">
                      {TECHNICAL_BENCHMARK_NOTICE.subtitle}
                    </p>
                  </div>
                </div>

                <a
                  href={TECHNICAL_BENCHMARK_NOTICE.folderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-sans font-bold bg-[#6C151E] text-white dark:bg-[#B08D57] dark:text-[#14080A] hover:opacity-90 transition-opacity shrink-0"
                >
                  <span>Challenge Drive Folder</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {TECHNICAL_BENCHMARK_NOTICE.details.map((point, pIdx) => (
                  <div
                    key={pIdx}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-[#150709] border border-[#B08D57]/25 dark:border-[#3D1418] text-xs sm:text-sm font-sans text-[#2A1818] dark:text-[#D5C9C8]"
                  >
                    <CheckCircle2 size={16} className="text-[#886937] dark:text-[#B08D57] shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* CROSS-SECTION SEARCH HINTS */}
          {searchQuery && activeSection !== 'all' && (
            <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-[#180C0E] border border-[#6C151E]/20 dark:border-[#3D1418] text-xs sm:text-sm font-sans">
              <span className="text-[#3A0B10] dark:text-[#D5C9C8]">
                Viewing <strong>{filteredFaqs.length}</strong> results in{' '}
                <span className="capitalize font-semibold">{activeSection} FAQs</span>.
              </span>
              {activeSection === 'general' && otherSectionHits.technical > 0 && (
                <button
                  type="button"
                  onClick={() => handleSectionChange('technical')}
                  className="inline-flex items-center gap-1 font-bold text-[#6C151E] dark:text-[#F0A2B0] hover:underline cursor-pointer ml-auto"
                >
                  <span>Switch to Technical FAQs ({otherSectionHits.technical} matches)</span>
                  <ArrowRight size={14} />
                </button>
              )}
              {activeSection === 'technical' && otherSectionHits.general > 0 && (
                <button
                  type="button"
                  onClick={() => handleSectionChange('general')}
                  className="inline-flex items-center gap-1 font-bold text-[#6C151E] dark:text-[#F0A2B0] hover:underline cursor-pointer ml-auto"
                >
                  <span>Switch to General FAQs ({otherSectionHits.general} matches)</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}

          {/* Empty Search State */}
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-14 sm:py-16 rounded-2xl border border-dashed border-[#3A0B10]/20 dark:border-[#3D1418] bg-white/50 dark:bg-[#14080A] p-8 space-y-4">
              <div className="h-12 w-12 rounded-full bg-[#3A0B10]/5 dark:bg-white/5 mx-auto flex items-center justify-center text-[#6C151E] dark:text-[#F0A2B0]">
                <HelpCircle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-serif font-bold text-[#3A0B10] dark:text-white">
                  No matching questions found
                </h3>
                <p className="text-sm font-sans text-[#16171B]/70 dark:text-[#C4B9B8] max-w-md mx-auto">
                  We couldn&apos;t find any questions matching &ldquo;{searchQuery}&rdquo; in the current section filter.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-sans font-bold bg-[#6C151E] text-white hover:bg-[#8A1522] cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSectionChange('all')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-sans font-bold bg-white dark:bg-[#200A0E] text-[#3A0B10] dark:text-[#F0A2B0] border border-[#6C151E]/20 dark:border-[#3D1418] cursor-pointer"
                >
                  View All FAQs
                </button>
              </div>
            </div>
          ) : (
            /* Main FAQ Accordion List */
            <div className="space-y-4">
              {filteredFaqs.map((item) => {
                const isOpen = !!openItems[item.id];
                const headerId = `faq-btn-${item.id}`;
                const panelId = `faq-panel-${item.id}`;

                return (
                  <motion.div
                    key={item.id}
                    id={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.25 }}
                    className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isOpen
                        ? 'border-[#6C151E] dark:border-[#F0A2B0]/40 bg-white dark:bg-[#1C0A0D] shadow-md ring-1 ring-[#6C151E]/15 dark:ring-[#F0A2B0]/20'
                        : 'border-[#3A0B10]/15 dark:border-[#2D1014] bg-white/90 dark:bg-[#14080A] hover:border-[#6C151E]/40 dark:hover:border-[#4A151C]'
                    }`}
                  >
                    {/* Accordion Header Row */}
                    <div className="flex items-start justify-between p-4 sm:p-6 gap-3.5">
                      <button
                        type="button"
                        id={headerId}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggleFaq(item.id)}
                        className="flex-1 min-w-0 text-left space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C151E] rounded-xl cursor-pointer"
                      >
                        {/* Meta Tags Row */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Section Tag */}
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-sans font-bold uppercase tracking-wider border ${
                              item.section === 'general'
                                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                                : 'bg-[#6C151E]/10 text-[#6C151E] dark:text-[#F0A2B0] border-[#6C151E]/20 dark:border-[#3D1418]'
                            }`}
                          >
                            {item.section === 'general' ? 'General' : 'Technical'}
                          </span>

                          {/* Category Tag */}
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-sans font-semibold uppercase bg-[#FAF2E8] dark:bg-[#261014] text-[#6C151E] dark:text-[#F0A2B0] tracking-wider border border-transparent dark:border-[#3D1418]">
                            {item.category}
                          </span>

                          {/* Track Code Tag if available */}
                          {item.trackCode && (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#6C151E] text-white dark:bg-[#B08D57] dark:text-[#14080A]">
                              {item.trackCode}
                            </span>
                          )}

                          {/* Top Question Badge */}
                          {item.isTopQuestion && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans font-bold uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              <Sparkles size={10} />
                              Essential
                            </span>
                          )}
                        </div>
                        
                        {/* Question Headline */}
                        <h2 className="text-base sm:text-xl lg:text-2xl font-serif font-bold text-[#2A080D] dark:text-white leading-snug tracking-tight break-words">
                          {item.question}
                        </h2>
                      </button>

                      {/* Right Action Tools: Copy Q&A + Expand Chevron */}
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <AnimatePresence>
                          {isOpen && (
                            <motion.button
                              type="button"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ duration: 0.18 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyFaqContent(item);
                              }}
                              title="Copy question and answer text"
                              aria-label="Copy question text"
                              className="h-9 sm:h-10 px-3 rounded-xl border border-[#3A0B10]/15 dark:border-[#3D1418] text-xs font-sans font-semibold text-[#16171B]/70 dark:text-[#F0A2B0] hover:text-[#6C151E] dark:hover:text-white hover:bg-[#6C151E]/5 dark:hover:bg-[#240D10] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check size={14} className="text-[#6C151E] dark:text-[#F0A2B0]" />
                                  <span className="text-[#6C151E] dark:text-[#F0A2B0] font-bold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={14} />
                                  <span className="hidden sm:inline">Copy Q&amp;A</span>
                                </>
                              )}
                            </motion.button>
                          )}
                        </AnimatePresence>

                        <button
                          type="button"
                          onClick={() => toggleFaq(item.id)}
                          aria-label={isOpen ? 'Collapse answer' : 'Expand answer'}
                          className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            isOpen
                              ? 'border-[#6C151E] bg-[#6C151E] text-white dark:border-[#F0A2B0] dark:bg-[#F0A2B0] dark:text-[#14080A]'
                              : 'border-[#3A0B10]/20 dark:border-[#3D1418] text-[#3A0B10] dark:text-[#F0A2B0] hover:bg-[#3A0B10]/5 dark:hover:bg-[#240D10]'
                          }`}
                        >
                          {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* Animated Answer Panel */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={panelId}
                          role="region"
                          aria-labelledby={headerId}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 sm:px-6 pb-5 pt-1">
                            <div className="p-4 sm:p-5 rounded-xl bg-[#FAF6F0]/80 dark:bg-[#150709] border-l-4 border-[#6C151E] dark:border-[#F0A2B0] text-sm sm:text-base md:text-lg font-sans text-[#2A2120] dark:text-[#C4B9B8] leading-relaxed shadow-xs space-y-4">

                              {/* Specialized UI Card for Scoring Rubric (tech-36) */}
                              {item.id === 'tech-36' && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                  <div className="p-4 rounded-xl bg-white dark:bg-[#1A0A0D] border border-[#6C151E]/20 dark:border-[#3D1418] space-y-1">
                                    <div className="text-2xl font-serif font-bold text-[#6C151E] dark:text-[#F0A2B0]">
                                      40 Pts
                                    </div>
                                    <div className="text-xs font-sans font-bold uppercase text-[#3A0B10] dark:text-white">
                                      Solution Correctness &amp; Performance
                                    </div>
                                    <p className="text-xs text-[#554645] dark:text-[#A69796]">
                                      Correct algorithm, classical baseline comparison, convergence, and problem metric.
                                    </p>
                                  </div>
                                  <div className="p-4 rounded-xl bg-white dark:bg-[#1A0A0D] border border-[#6C151E]/20 dark:border-[#3D1418] space-y-1">
                                    <div className="text-2xl font-serif font-bold text-[#886937] dark:text-[#B08D57]">
                                      30 Pts
                                    </div>
                                    <div className="text-xs font-sans font-bold uppercase text-[#3A0B10] dark:text-white">
                                      Architecture Analysis
                                    </div>
                                    <p className="text-xs text-[#554645] dark:text-[#A69796]">
                                      Processor A vs B, circuit depth, 2-qubit gate count, SWAP overhead, and fidelity.
                                    </p>
                                  </div>
                                  <div className="p-4 rounded-xl bg-white dark:bg-[#1A0A0D] border border-[#6C151E]/20 dark:border-[#3D1418] space-y-1">
                                    <div className="text-2xl font-serif font-bold text-[#A7192A] dark:text-[#F0A2B0]">
                                      30 Pts
                                    </div>
                                    <div className="text-xs font-sans font-bold uppercase text-[#3A0B10] dark:text-white">
                                      Phase 2 Readiness &amp; Insight
                                    </div>
                                    <p className="text-xs text-[#554645] dark:text-[#A69796]">
                                      Technical depth, evidence-based reasoning, clean plots, and report organization.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Specialized UI Card for Processor Comparison (tech-18, tech-19, tech-20) */}
                              {(item.id === 'tech-18' || item.id === 'tech-19' || item.id === 'tech-20') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                  <div className="p-4 rounded-xl bg-white dark:bg-[#1A0A0D] border border-[#6C151E]/20 dark:border-[#3D1418] space-y-1">
                                    <span className="text-xs font-bold uppercase text-[#6C151E] dark:text-[#F0A2B0]">
                                      Processor A
                                    </span>
                                    <div className="text-lg font-serif font-bold text-[#3A0B10] dark:text-white">
                                      5 Physical Qubits (q0–q4)
                                    </div>
                                    <p className="text-xs text-[#554645] dark:text-[#A69796]">
                                      Linear chain topology. Transpilation to non-nearest neighbors requires SWAP insertion.
                                    </p>
                                  </div>
                                  <div className="p-4 rounded-xl bg-white dark:bg-[#1A0A0D] border border-[#6C151E]/20 dark:border-[#3D1418] space-y-1">
                                    <span className="text-xs font-bold uppercase text-[#886937] dark:text-[#B08D57]">
                                      Processor B
                                    </span>
                                    <div className="text-lg font-serif font-bold text-[#3A0B10] dark:text-white">
                                      9 Physical Qubits (q0–q8)
                                    </div>
                                    <p className="text-xs text-[#554645] dark:text-[#A69796]">
                                      Heavy-hex graph connectivity. All nine nodes must be utilized per simulation-derived spec.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Main Formatted Answer Rendering */}
                              {renderFormattedText(item.answer)}

                              {/* Tags Footer */}
                              {item.tags && item.tags.length > 0 && (
                                <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-[#3A0B10]/10 dark:border-[#3D1418]/60">
                                  <span className="text-[11px] font-sans font-semibold text-[#16171B]/50 dark:text-[#C4B9B8]/50 uppercase tracking-wider mr-1">
                                    Tags:
                                  </span>
                                  {item.tags.map((tag, tIdx) => (
                                    <button
                                      key={tIdx}
                                      type="button"
                                      onClick={() => setSearchQuery(tag)}
                                      className="text-[11px] font-sans px-2 py-0.5 rounded-md bg-white/60 dark:bg-[#1C0A0D] border border-[#3A0B10]/10 dark:border-[#3D1418] text-[#6C151E] dark:text-[#F0A2B0] hover:border-[#6C151E] transition-colors cursor-pointer"
                                    >
                                      #{tag}
                                    </button>
                                  ))}
                                </div>
                              )}

                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* =====================================================================
              SECTION 05: OFFICIAL NOTICE & DISCLAIMER BOX
              ===================================================================== */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl p-7 sm:p-9 bg-gradient-to-br from-white to-[#F5EBE1] dark:from-[#22070A] dark:to-[#180507] border-2 border-[#B08D57]/40 dark:border-[#B08D57]/30 shadow-md space-y-4"
          >
            <div className="flex items-center gap-3 text-[#886937] dark:text-[#B08D57]">
              <Info size={24} className="shrink-0" />
              <span className="font-sans text-xs sm:text-sm font-bold tracking-widest uppercase">
                Official Organizing Committee Notice
              </span>
            </div>

            <p className="text-base sm:text-lg font-sans font-medium text-[#3A0B10] dark:text-[#F5F3F0] leading-relaxed">
              <strong>Note:</strong> {FAQ_META.disclaimer}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm font-sans text-[#16171B]/75 dark:text-[#C7C8CC]/75">
              <span>Host Institution: <strong>{FAQ_META.host}</strong></span>
              <span>&bull;</span>
              <span>Location: <strong>{FAQ_META.location}</strong></span>
            </div>
          </motion.div>

          {/* =====================================================================
              SECTION 06: CONTACT & SCHEDULE CTA
              ===================================================================== */}
          <div className="rounded-2xl p-8 sm:p-12 bg-[#3A0B10] text-[#F5F3F0] dark:bg-[#150406] border border-[#6C151E]/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <span className="text-xs sm:text-sm font-sans font-bold tracking-widest uppercase text-[#B08D57]">
                Still Have Questions?
              </span>
              <h3 className="text-2xl sm:text-4xl font-serif font-bold text-white leading-tight">
                Connect with the SRMAP Organizing Committee
              </h3>
              <p className="text-sm sm:text-base font-sans text-[#E5E5E7]/80 leading-relaxed">
                Contact the SRMAP Qiskit Fall Fest 2026 organizing committee through the official participant WhatsApp channel or explore our comprehensive schedule.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <Link
                href="/schedule"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-sm font-sans font-bold bg-[#A7192A] hover:bg-[#8A1522] dark:bg-[#B08D57] dark:text-[#13090A] dark:hover:bg-[#C9A268] text-white shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0 border border-white/20 dark:border-[#B08D57]/40"
              >
                <span>Explore Schedule</span>
                <ArrowRight size={18} className="shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* GLOBAL FOOTER */}
      <Footer />
    </div>
  );
}
