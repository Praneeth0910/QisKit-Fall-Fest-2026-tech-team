'use client';
/* eslint-disable @next/next/no-img-element */

import * as React from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  User,
  ArrowRight,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HeroCarouselItem {
  id?: string | number;
  title: string;
  image: string;
  credit?: string;
  meta?: string[];
  accent?: string;
  description?: string;
  registrationUrl?: string;
  registrationLabel?: string;
  category?: string;
}

export interface HeroCarouselProps {
  items?: HeroCarouselItem[];
  events?: any[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  brand?: React.ReactNode;
  activeCategory?: 'learn' | 'build' | 'connect';
  onCategoryChange?: (category: 'learn' | 'build' | 'connect') => void;
  onBack?: () => void;
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  onMenu?: () => void;
  onBoundaryReached?: (direction: 'down' | 'up') => void;
  autoplay?: boolean;
  autoplayDelay?: number;
  className?: string;
  hideTopBar?: boolean;
  hideHeadline?: boolean;
  hideRail?: boolean;
}

/* Subtle editorial film grain */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Robust extractor for Track, Date, Time, Venue, and Host across all 60 events.
 */
function parseEventDetails(item?: HeroCarouselItem) {
  if (!item) {
    return {
      track: 'QUANTUM SESSION',
      date: '26 – 30 OCT 2026',
      time: '10:00 AM – 05:00 PM IST',
      venue: 'Main Auditorium, SRM University-AP',
      hostedBy: 'IBM Quantum & SRMUAP Faculty',
    };
  }

  const meta = item.meta || [];
  const credit = item.credit || '';
  const track = credit || meta[0] || 'QUANTUM SESSION';

  // 1. DATE FORMATTING
  const rawDate = meta[1] || '26–30 Oct 2026';
  const cleanDate = rawDate
    .toUpperCase()
    .replace(/(\d+)(ST|ND|RD|TH)/g, '$1')
    .replace(/\s*[–-]\s*/g, ' – ')
    .trim();

  // 2. VENUE & TIME FORMATTING
  const locTm = meta[2] || '';
  let venue = 'SRM University-AP Campus';
  let time = '10:00 AM – 05:00 PM IST';

  if (locTm.includes('·')) {
    const parts = locTm.split('·').map((p) => p.trim());
    const vRaw = parts[0];
    const tRaw = parts.slice(1).join(' · ');

    if (/online/i.test(vRaw)) {
      venue = 'Online / Virtual Quantum Portal';
      if (/deadline/i.test(tRaw)) {
        time = tRaw;
      } else if (/tracks|simulation|python|modeling|gate|sensor/i.test(tRaw)) {
        time = 'Online Competition Window';
      } else {
        time = tRaw;
      }
    } else {
      venue = vRaw;
      time = tRaw;
    }
  } else if (/online/i.test(locTm)) {
    venue = 'Online / Virtual Quantum Portal';
    time = 'Online / Flexible Schedule';
  } else if (locTm) {
    venue = locTm;
    if (rawDate.includes('26') && rawDate.includes('30')) {
      time = 'Festival Schedule · 26–30 Oct';
    } else {
      time = '10:00 AM – 05:00 PM IST';
    }
  }

  // Ensure venue mentions SRM University-AP if physical campus venue
  if (!/online/i.test(venue) && !venue.includes('SRM University-AP')) {
    venue = `${venue}, SRM University-AP`;
  }

  // Specific event custom overrides for high-profile events
  if (item.id === 'build-01-hackathon-phase-1') {
    venue = 'Online / Virtual Quantum Portal';
    time = 'Launch: 10 Oct 5:00 PM · Close: 14 Oct 11:59 PM';
  } else if (item.id === 'build-05-hackathon-phase-2-flagship') {
    venue = 'Lab Blocks A & B, SRM University-AP';
    time = '7:30 PM – 7:30 AM IST (24-Hour Overnight)';
  }

  // 3. HOSTED BY / ORGANIZER
  let hostedBy = 'IBM Quantum & SRMUAP Faculty';
  const lowerCredit = credit.toLowerCase();
  const lowerTitle = item.title.toLowerCase();

  if (lowerCredit.includes('keynote') || lowerTitle.includes('keynote')) {
    hostedBy = 'Distinguished Keynote Speakers';
  } else if (lowerCredit.includes('hackathon') || lowerTitle.includes('hackathon')) {
    hostedBy = 'IBM Mentors & SRMUAP Quantum Club';
  } else if (
    lowerCredit.includes('workshop') ||
    lowerCredit.includes('circuit') ||
    lowerCredit.includes('transmon') ||
    lowerCredit.includes('pulse') ||
    lowerCredit.includes('lab') ||
    lowerTitle.includes('workshop')
  ) {
    hostedBy = 'IBM Quantum Systems Engineers & Faculty';
  } else if (
    lowerCredit.includes('conclave') ||
    lowerCredit.includes('debate') ||
    lowerCredit.includes('panel') ||
    lowerTitle.includes('conclave') ||
    lowerTitle.includes('debate')
  ) {
    hostedBy = 'Academic Fellows & Industry Panelists';
  } else if (
    lowerCredit.includes('creative') ||
    lowerCredit.includes('art') ||
    lowerCredit.includes('drama') ||
    lowerCredit.includes('theatre') ||
    lowerCredit.includes('poster') ||
    lowerCredit.includes('reel') ||
    lowerCredit.includes('essay') ||
    lowerTitle.includes('drama') ||
    lowerTitle.includes('artwork') ||
    lowerTitle.includes('reels')
  ) {
    hostedBy = 'Creative Arts & Quantum Media Guild';
  } else if (
    lowerCredit.includes('game') ||
    lowerCredit.includes('chess') ||
    lowerCredit.includes('checkers') ||
    lowerCredit.includes('solitaire') ||
    lowerCredit.includes('casino') ||
    lowerCredit.includes('esports') ||
    lowerCredit.includes('qgames') ||
    lowerCredit.includes('quiz') ||
    lowerCredit.includes('puzzles') ||
    lowerCredit.includes('skribble') ||
    lowerCredit.includes('charades') ||
    lowerCredit.includes('race') ||
    lowerCredit.includes('play') ||
    lowerTitle.includes('gaming') ||
    lowerTitle.includes('chess') ||
    lowerTitle.includes('quiz') ||
    lowerTitle.includes('puzzles') ||
    lowerTitle.includes('skribble') ||
    lowerTitle.includes('casino')
  ) {
    hostedBy = 'QGames Initiative & Student Council';
  } else if (credit) {
    hostedBy = 'IBM Quantum Advocates & Faculty';
  }

  return { track, date: cleanDate, time, venue, hostedBy };
}

export function HeroCarousel({
  items: rawItems,
  events,
  activeIndex,
  onActiveIndexChange,
  index: controlledProp,
  defaultIndex = 0,
  onIndexChange: onIndexChangeProp,
  brand,
  activeCategory,
  onCategoryChange,
  onBack,
  backLabel,
  onNext,
  nextLabel,
  onBoundaryReached,
  autoplay = false,
  autoplayDelay = 4500,
  className,
  hideTopBar = false,
  hideHeadline = false,
  hideRail = false,
}: HeroCarouselProps) {
  // Normalize items whether passed via items or legacy events prop
  const items: HeroCarouselItem[] = React.useMemo(() => {
    if (rawItems && rawItems.length > 0) return rawItems;
    if (events && events.length > 0) {
      return events.map((e) => ({
        id: e.id,
        title: e.title,
        image: e.image,
        credit: e.credit,
        meta: e.meta,
        accent: e.accent,
        description: e.description,
        registrationUrl: e.registrationUrl,
        registrationLabel: e.registrationLabel,
        category: e.category,
      }));
    }
    return [];
  }, [rawItems, events]);

  const controlled = controlledProp !== undefined ? controlledProp : activeIndex;
  const onIndexChange = onIndexChangeProp || onActiveIndexChange;

  const [uncontrolled, setUncontrolled] = React.useState(defaultIndex);
  const [paused, setPaused] = React.useState(false);
  const railRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const last = Math.max(0, items.length - 1);
  const index = clamp(controlled ?? uncontrolled, 0, last);

  const go = React.useCallback(
    (next: number) => {
      const clamped = clamp(next, 0, Math.max(0, last));
      if (controlled === undefined) setUncontrolled(clamped);
      if (clamped !== index) onIndexChange?.(clamped);
    },
    [controlled, index, last, onIndexChange]
  );

  // Auto-scroll the active thumbnail into view smoothly WITHOUT shifting the parent window
  React.useEffect(() => {
    if (!railRef.current) return;
    const container = railRef.current;
    const activeThumb = container.children[index] as HTMLElement;
    if (activeThumb) {
      const thumbLeft = activeThumb.offsetLeft;
      const thumbWidth = activeThumb.offsetWidth;
      const containerWidth = container.offsetWidth;
      const targetScrollLeft = thumbLeft - containerWidth / 2 + thumbWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth',
      });
    }
  }, [index, activeCategory]);

  // Autoplay handler if enabled
  React.useEffect(() => {
    if (!autoplay || paused || items.length <= 1) return;
    const timer = setInterval(() => {
      go(index >= last ? 0 : index + 1);
    }, autoplayDelay);
    return () => clearInterval(timer);
  }, [autoplay, paused, index, last, items.length, autoplayDelay, go]);

  const active = items[index] || items[0] || {
    title: 'Quantum Event',
    image: '/images/events/world-class-workshops-dark.webp',
  };

  const parsed = React.useMemo(() => parseEventDetails(active), [active]);
  const lines = React.useMemo(
    () => active.title.split('\n'),
    [active.title]
  );

  // Identify active chapter ('learn', 'build', 'connect')
  const activeChapter = React.useMemo<'learn' | 'build' | 'connect'>(() => {
    if (activeCategory) return activeCategory;
    const brandStr = typeof brand === 'string' ? brand.toLowerCase() : '';
    if (brandStr.includes('01') || brandStr.includes('learn') || active.category === 'learn') return 'learn';
    if (brandStr.includes('02') || brandStr.includes('build') || active.category === 'build') return 'build';
    if (brandStr.includes('03') || brandStr.includes('connect') || active.category === 'connect') return 'connect';
    return 'learn';
  }, [activeCategory, brand, active.category]);

  const handleCategoryClick = React.useCallback(
    (targetCategory: 'learn' | 'build' | 'connect') => {
      if (targetCategory === activeChapter) return;
      if (onCategoryChange) {
        onCategoryChange(targetCategory);
      } else {
        const map = {
          learn: 'section-01-learn-container',
          build: 'section-02-build-container',
          connect: 'section-03-connect-container',
        };
        const el = document.getElementById(map[targetCategory]) || document.getElementById(targetCategory);
        if (el) {
          const navbarHeight =
            window.innerWidth >= 1280 ? 90 : window.innerWidth >= 640 ? 84 : 78;
          const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }
    },
    [activeChapter, onCategoryChange]
  );

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Event Experience Carousel"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          go(index + 1);
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          go(index - 1);
        }
      }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className={cn(
        'relative h-full w-full overflow-hidden bg-[#0C0D10] text-[#F5F3F0] select-none flex flex-col justify-between',
        'outline-none focus-visible:ring-1 focus-visible:ring-white/40',
        className
      )}
    >
      {/* ── Background: Active Event Photography with Cinematic Depth Gradients ── */}
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="absolute inset-0 z-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <motion.img
            src={active.image}
            alt={active.title.replace(/\n/g, ' ')}
            draggable={false}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover object-center"
            initial={{ scale: reduced ? 1.02 : 1.08 }}
            animate={{ scale: 1.02 }}
            transition={reduced ? { duration: 0 } : { duration: 6, ease: 'linear' }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Cinematic scrims: left shadow for title legibility, bottom shadow for thumbnails */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#0C0D10]/95 via-[#0C0D10]/80 sm:via-[#0C0D10]/70 to-[#0C0D10]/35 pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#0C0D10] via-[#0C0D10]/65 to-transparent pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#0C0D10]/70 via-transparent to-transparent pointer-events-none" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: '180px 180px' }}
      />

      {/* ── 1. Top Sub-Navigation Bar: Back & Chapter Switcher (01 Learn, 02 Build, 03 Connect) ── */}
      {!hideTopBar && (
        <div className="relative z-20 w-full flex items-center justify-between px-3 sm:px-8 md:px-12 pt-3 sm:pt-4 pb-2 border-b border-white/[0.08] gap-2">
          {/* Back button */}
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-[#D1D5DB] hover:text-white transition-colors cursor-pointer font-mono text-xs sm:text-[13px] uppercase tracking-wider flex items-center gap-1 shrink-0"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span className="hidden min-[420px]:inline">{backLabel || 'Back'}</span>
              <span className="inline min-[420px]:hidden">Back</span>
            </button>
          ) : (
            <div className="hidden sm:block w-16" />
          )}

          {/* Chapter Tabs: 01 Learn, 02 Build, 03 Connect */}
          <div className="flex items-center gap-2.5 sm:gap-8 overflow-x-auto scrollbar-none no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => handleCategoryClick('learn')}
              className={cn(
                'font-mono text-[11px] sm:text-[13px] tracking-tight sm:tracking-wider transition-all pb-1.5 cursor-pointer whitespace-nowrap shrink-0',
                activeChapter === 'learn'
                  ? 'text-white font-bold border-b-2 border-[#E57373]'
                  : 'text-white/50 hover:text-white/80 font-normal'
              )}
            >
              01 Learn
            </button>
            <button
              type="button"
              onClick={() => handleCategoryClick('build')}
              className={cn(
                'font-mono text-[11px] sm:text-[13px] tracking-tight sm:tracking-wider transition-all pb-1.5 cursor-pointer whitespace-nowrap shrink-0',
                activeChapter === 'build'
                  ? 'text-white font-bold border-b-2 border-[#E57373]'
                  : 'text-white/50 hover:text-white/80 font-normal'
              )}
            >
              02 Build
            </button>
            <button
              type="button"
              onClick={() => handleCategoryClick('connect')}
              className={cn(
                'font-mono text-[11px] sm:text-[13px] tracking-tight sm:tracking-wider transition-all pb-1.5 cursor-pointer whitespace-nowrap shrink-0',
                activeChapter === 'connect'
                  ? 'text-white font-bold border-b-2 border-[#E57373]'
                  : 'text-white/50 hover:text-white/80 font-normal'
              )}
            >
              03 Connect
            </button>
          </div>

          <div className="hidden sm:block w-16" />
        </div>
      )}

      {/* ── 2. Middle Hero Stage: Left Details + Right Floating Glassmorphic Card + Filmstrip Cards ── */}
      {!hideHeadline && (
        <div className="relative z-10 w-full flex-1 min-h-0 overflow-y-auto scrollbar-none flex flex-col justify-start pt-2 sm:pt-3 pb-2 px-3 sm:px-8 md:px-10 lg:px-12">
          {/* Main Content: Left Eyebrow/Title/Buttons + Right Glass Card */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4 md:gap-6 lg:gap-8 xl:gap-10">
            {/* Left Column: Eyebrow, Title, Description, Buttons */}
            <div className="flex-1 max-w-xl lg:max-w-2xl text-left">
              {/* Category Eyebrow with Red Dot */}
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <span className="w-2 h-2 rounded-full bg-[#E57373] shadow-[0_0_8px_#E57373]" />
                <span className="font-mono text-xs sm:text-[13px] uppercase tracking-[0.2em] text-[#E57373] font-semibold">
                  {parsed.track}
                </span>
              </div>

              {/* Serif Headline */}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.h2
                  key={index}
                  className="font-serif font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-[#F5F3F0] leading-[1.08] tracking-[-0.02em] drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  {lines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </motion.h2>
              </AnimatePresence>

              {/* Description */}
              {active.description && (
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={`desc-${index}`}
                    className="font-sans text-xs sm:text-sm md:text-base text-[#D1D5DB]/90 leading-relaxed mt-2 sm:mt-2.5 max-w-xl line-clamp-2 sm:line-clamp-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.08 }}
                  >
                    {active.description}
                  </motion.p>
                </AnimatePresence>
              )}

              {/* Action Buttons: Primary + Secondary */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 mt-3 sm:mt-3.5">
                <a
                  href={active.registrationUrl || 'https://qiskit.org/fallfest'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-[#F5F3F0] text-[#16171B] font-semibold text-xs sm:text-sm hover:bg-white transition-all shadow-[0_4px_14px_rgba(245,243,240,0.25)] active:scale-95"
                >
                  <span>{active.registrationLabel || 'Register for Event'}</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </a>

                <a
                  href="/schedule"
                  className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full border border-white/20 bg-white/[0.05] hover:bg-white/10 text-white/95 font-medium text-xs sm:text-sm transition-all"
                >
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-white/60 flex items-center justify-center">
                    <Play className="w-2 h-2 sm:w-2.5 sm:h-2.5 fill-white text-white ml-0.5" />
                  </div>
                  <span>Watch Overview</span>
                </a>
              </div>
            </div>

            {/* Right Column: Floating Glassmorphic Event Card */}
            <div className="flex flex-col gap-2 sm:gap-2.5 rounded-2xl border border-white/15 bg-black/55 backdrop-blur-md p-3 sm:p-3.5 lg:p-4 shadow-2xl w-full sm:w-[270px] md:w-[280px] lg:w-[310px] xl:w-[330px] shrink-0 text-left">
              {/* DATES */}
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="mt-0.5 text-[#E57373] p-1 sm:p-1.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <div className="font-mono text-[9.5px] sm:text-[10px] uppercase tracking-widest text-[#A6A8B0]">DATES</div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-0.5 tracking-wide">{parsed.date}</div>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />

              {/* TIME */}
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="mt-0.5 text-[#E57373] p-1 sm:p-1.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <div className="font-mono text-[9.5px] sm:text-[10px] uppercase tracking-widest text-[#A6A8B0]">TIME</div>
                  <div className="text-xs sm:text-sm font-semibold text-white/95 mt-0.5">{parsed.time}</div>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />

              {/* VENUE */}
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="mt-0.5 text-[#E57373] p-1 sm:p-1.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <div className="font-mono text-[9.5px] sm:text-[10px] uppercase tracking-widest text-[#A6A8B0]">VENUE</div>
                  <div className="text-xs sm:text-sm font-medium text-white/90 mt-0.5 leading-snug">{parsed.venue}</div>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />

              {/* HOSTED BY */}
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="mt-0.5 text-[#E57373] p-1 sm:p-1.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <div className="font-mono text-[9.5px] sm:text-[10px] uppercase tracking-widest text-[#A6A8B0]">HOSTED BY</div>
                  <div className="text-xs sm:text-sm font-medium text-white/90 mt-0.5 leading-snug">{parsed.hostedBy}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. Filmstrip Carousel: IMMEDIATELY after HOSTED BY with exact 1-line spacing (mt-4 / 16px) ── */}
          {!hideRail && (
            <div className="relative z-20 w-full mt-4 sm:mt-4 py-1 shrink-0 overflow-hidden">
              <div className="relative flex items-center">
                {/* Left Nav Arrow Button */}
                <button
                  type="button"
                  aria-label="Previous event"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                  className={cn(
                    'absolute left-0 sm:left-1 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-white/20 bg-black/75 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer shadow-lg',
                    index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 hover:scale-105 active:scale-95'
                  )}
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Thumbnail Cards Row */}
                <div
                  ref={railRef}
                  className="flex items-center gap-2.5 sm:gap-4 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1 px-7 sm:px-11 w-full scroll-smooth"
                >
                  {items.map((item, i) => {
                    const isActive = i === index;
                    const itemDetails = parseEventDetails(item);
                    return (
                      <button
                        key={item.id || i}
                        type="button"
                        onClick={() => go(i)}
                        className={cn(
                          'relative shrink-0 rounded-xl overflow-hidden transition-all duration-300 text-left cursor-pointer group',
                          'w-44 sm:w-56 md:w-64 lg:w-72 h-24 sm:h-28 md:h-32 lg:h-34',
                          isActive
                            ? 'ring-2 ring-[#E57373] shadow-[0_0_20px_rgba(229,115,115,0.45)] scale-[1.02]'
                            : 'border border-white/10 opacity-70 hover:opacity-100 hover:border-white/30'
                        )}
                      >
                        <img
                          src={item.image}
                          alt={item.title.replace(/\n/g, ' ')}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20" />

                        <div className="relative z-10 h-full flex flex-col justify-between p-2.5 sm:p-3 md:p-3.5">
                          {/* Top-Left Date Badge */}
                          <div className="font-mono font-bold text-[10px] sm:text-[11.5px] text-white/95 uppercase tracking-wider">
                            {itemDetails.date}
                          </div>

                          {/* Bottom Title & Track */}
                          <div>
                            <div className="font-serif font-bold text-xs sm:text-[14px] md:text-base text-white line-clamp-1 leading-snug">
                              {item.title.replace(/\n/g, ' ')}
                            </div>
                            <div className="font-sans text-[10px] sm:text-[11.5px] text-[#A6A8B0] truncate mt-0.5">
                              {itemDetails.track}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right Nav Arrow Button */}
                <button
                  type="button"
                  aria-label="Next event"
                  onClick={() => go(index + 1)}
                  disabled={index === last}
                  className={cn(
                    'absolute right-0 sm:right-1 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-white/20 bg-black/75 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer shadow-lg',
                    index === last ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 hover:scale-105 active:scale-95'
                  )}
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Bottom Status Row: 03 / 18 Counter & Progress Bar (Left), View Full Schedule (Right) ── */}
      <div className="relative z-20 w-full flex items-center justify-between px-4 sm:px-8 md:px-12 py-1.5 sm:py-2.5 border-t border-white/[0.08] bg-black/50 backdrop-blur-md shrink-0">
        {/* Left: Numerical Counter & Progress Bar (with left clearance for Next.js dev badge) */}
        <div className="flex flex-col items-start gap-1 pl-14 sm:pl-16">
          <div className="font-mono text-xs sm:text-[13px] text-white font-bold tracking-wider">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span className="text-white/40 font-normal"> / {String(items.length).padStart(2, '0')}</span>
          </div>
          <div className="w-24 sm:w-32 h-[2px] bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E57373] transition-all duration-300 rounded-full"
              style={{ width: `${((index + 1) / items.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Right: View Full Schedule Link */}
        <a
          href="/schedule"
          className="font-mono text-xs sm:text-[13px] text-white/80 hover:text-white flex items-center gap-1.5 transition-colors group cursor-pointer"
        >
          <span>View Full Schedule</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
}

export default HeroCarousel;
