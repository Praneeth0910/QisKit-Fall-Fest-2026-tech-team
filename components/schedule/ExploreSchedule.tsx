'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  Play,
  Search,
  Users,
  BookOpen,
  Award,
  X,
} from 'lucide-react';
import { Day, SchedulePhase, Session, Track } from '@/data/schedule.types';
import { getPhaseDays, getPhaseInfo, filterSessions, getSessionAction } from '@/data/schedule.utils';
import { PhaseSelector } from './PhaseSelector';
import { StaggeredTextReveal } from '@/components/ui/StaggeredTextReveal';

const posterImage = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%233A0B10"/><stop offset="50%" stop-color="%236C151E"/><stop offset="100%" stop-color="%23120506"/></linearGradient></defs><rect width="600" height="300" fill="url(%23g)"/><g opacity="0.3" stroke="%23F5DABF" stroke-width="1.5" fill="none"><polygon points="300,40 420,95 420,205 300,260 180,205 180,95"/><line x1="300" y1="40" x2="300" y2="150"/><line x1="420" y1="95" x2="300" y2="150"/><line x1="180" y1="95" x2="300" y2="150"/><line x1="300" y1="150" x2="300" y2="260"/><line x1="420" y1="205" x2="300" y2="150"/><line x1="180" y1="205" x2="300" y2="150"/></g></svg>';

const tracks = ['All', 'Workshop', 'Talk', 'Hackathon', 'Networking', 'Community'] as const;

interface ExploreScheduleProps {
  currentPhase: SchedulePhase;
  onPhaseChange: (phase: SchedulePhase) => void;
  targetDayIndex?: number;
}

export function ExploreSchedule({ currentPhase, onPhaseChange, targetDayIndex }: ExploreScheduleProps) {
  const [dayIndex, setDayIndex] = useState(0);
  const [activeTrack, setActiveTrack] = useState<(typeof tracks)[number]>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const phaseInfo = getPhaseInfo(currentPhase);
  const currentDays = getPhaseDays(currentPhase);

  // Reset or sync day index & session selection when phase or external targetDayIndex changes
  useEffect(() => {
    setDayIndex(typeof targetDayIndex === 'number' && targetDayIndex >= 0 ? targetDayIndex : 0);
    setSelectedId(null);
    setSearch('');
    setActiveTrack('All');
  }, [currentPhase, targetDayIndex]);

  const activeDay: Day = currentDays[dayIndex] || currentDays[0];

  const visibleSessions = useMemo(() => {
    let list = activeDay ? activeDay.sessions : [];
    return filterSessions(list, activeTrack, search);
  }, [activeDay, activeTrack, search]);

  // Return null when no session is clicked so timeline expands full width
  const selectedSession = useMemo(() => {
    if (selectedId && activeDay) {
      const found = activeDay.sessions.find((s) => s.id === selectedId);
      if (found) return found;
    }
    return null;
  }, [selectedId, activeDay]);

  const [activePanelSession, setActivePanelSession] = useState<Session | null>(null);

  useEffect(() => {
    if (selectedSession) {
      setActivePanelSession(selectedSession);
    }
  }, [selectedSession]);

  const selectDay = (index: number) => {
    setDayIndex(index);
    setSelectedId(null);
  };

  const renderDetailContent = (session: Session) => {
    const action = getSessionAction(session, currentPhase);

    return (
      <aside className="rounded-3xl border border-[#D9D0CB] dark:border-[rgba(108,21,30,0.4)] bg-white dark:bg-[#1C0709] p-5 sm:p-6 shadow-2xl space-y-5 transition-colors">
      
      {/* Header Track & Day Badge with Close (X) Button */}
      <div className="flex items-center justify-between border-b border-[#D9D0CB]/60 dark:border-white/10 pb-3 text-xs font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <span className="font-mono rounded-full bg-[#6C151E] px-3 py-1 text-white">
            {session.track}
          </span>
          <span className="font-mono text-[#6C151E] dark:text-[#E45464]">
            {activeDay?.label} &middot; {activeDay?.date} 2026
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-[#6C151E] hover:text-white transition-colors text-[#665B57] dark:text-[#BEB5B4]"
          title="Close detail panel"
          aria-label="Close session details"
        >
          <X size={15} />
        </button>
      </div>

      {/* Session Title & Description */}
      <div>
        <h3 className="font-serif text-2xl sm:text-3xl font-bold leading-tight text-[#13090A] dark:text-[#F6F2F1]">
          {session.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#665B57] dark:text-[#BEB5B4]">
          {session.description}
        </p>
      </div>

      {/* Poster Visual Card */}
      <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-[#D9D0CB] dark:border-white/10 bg-gradient-to-br from-[#3A0B10] to-[#120506]">
        {posterImage && (
          <Image
            src={posterImage}
            alt="Quantum visual"
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover opacity-80"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#13090A] via-transparent to-transparent opacity-80" />
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded backdrop-blur-sm">
            QISKIT MASTERCLASS
          </span>
          <span className="text-xs font-semibold text-[#F5DABF]">
            {session.duration}
          </span>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-medium text-[#261F1D] dark:text-[#E8E0DE]">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F4F0EE] dark:bg-white/5">
          <Clock3 size={15} className="text-[#6C151E] dark:text-[#E45464]" />
          <span>{session.time} &ndash; {session.end}</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F4F0EE] dark:bg-white/5">
          <MapPin size={15} className="text-[#6C151E] dark:text-[#E45464]" />
          <span className="truncate">{session.location}</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F4F0EE] dark:bg-white/5">
          <Users size={15} className="text-[#6C151E] dark:text-[#E45464]" />
          <span>{session.level} Level</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F4F0EE] dark:bg-white/5">
          <Award size={15} className="text-[#6C151E] dark:text-[#E45464]" />
          <span>IST Timezone</span>
        </div>
      </div>

      {/* Speaker & Host Info */}
      {session.speaker && (
        <div className="border-t border-[#D9D0CB]/60 dark:border-white/10 pt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#665B57] dark:text-[#BEB5B4] mb-2">
            Instructor / Lead
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6C151E] text-sm font-bold text-white shadow-inner">
              {session.initials}
            </div>
            <div>
              <div className="text-sm font-bold text-[#13090A] dark:text-[#F6F2F1]">
                {session.speaker}
              </div>
              <div className="text-xs text-[#665B57] dark:text-[#BEB5B4]">
                {session.speakerRole}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learning Objectives */}
      {session.learn && session.learn.length > 0 && (
        <div className="border-t border-[#D9D0CB]/60 dark:border-white/10 pt-4 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#665B57] dark:text-[#BEB5B4] flex items-center gap-1.5">
            <BookOpen size={13} className="text-[#6C151E] dark:text-[#E45464]" />
            What You Will Learn:
          </div>
          <ul className="space-y-1.5 pl-1">
            {session.learn.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-[#261F1D] dark:text-[#E8E0DE]">
                <Check size={14} className="mt-0.5 shrink-0 text-[#6C151E] dark:text-[#E45464]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2">
        {action.isExternal ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex w-full items-center justify-between overflow-hidden rounded-xl border border-[rgba(193,46,63,0.85)] bg-[#6C151E] text-white py-3.5 px-6 text-xs font-bold transition-all duration-300 shadow-md active:scale-[0.98]"
          >
            {/* Expanding Circle Background Fill */}
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#3A0B10] rounded-full opacity-0 pointer-events-none group-hover:w-[600px] group-hover:h-[600px] group-hover:opacity-100 transition-all duration-[1200ms] ease-[cubic-bezier(0.25,1,0.35,1)]" />

            {/* Text */}
            <span className="relative z-[1] tracking-wide">{action.detailLabel}</span>

            {/* Arrow */}
            <ArrowRight
              size={16}
              className="relative z-[1] transition-transform duration-300 ease-out group-hover:translate-x-1.5"
            />
          </a>
        ) : (
          <Link
            href={action.href}
            className="group relative flex w-full items-center justify-between overflow-hidden rounded-xl border border-[rgba(193,46,63,0.85)] bg-[#6C151E] text-white py-3.5 px-6 text-xs font-bold transition-all duration-300 shadow-md active:scale-[0.98]"
          >
            {/* Expanding Circle Background Fill */}
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#3A0B10] rounded-full opacity-0 pointer-events-none group-hover:w-[600px] group-hover:h-[600px] group-hover:opacity-100 transition-all duration-[1200ms] ease-[cubic-bezier(0.25,1,0.35,1)]" />

            {/* Text */}
            <span className="relative z-[1] tracking-wide">{action.detailLabel}</span>

            {/* Arrow */}
            <ArrowRight
              size={16}
              className="relative z-[1] transition-transform duration-300 ease-out group-hover:translate-x-1.5"
            />
          </Link>
        )}
      </div>

    </aside>
  );
};

  return (
    <section 
      id="explore-schedule" 
      className="w-full snap-start scroll-mt-[80px] md:scroll-mt-[100px] bg-[#F4F0EE] dark:bg-[#120506] pt-4 sm:pt-8 pb-8 sm:pb-16 text-[#261F1D] dark:text-[#E8E0DE]"
    >
      <div className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8 xl:px-12">
        
        {/* TOP BAR / CONTROL HEADER */}
        <div 
          id="explore-schedule-card"
          className="scroll-mt-0 sm:scroll-mt-0 xl:scroll-mt-[5px] rounded-[20px] sm:rounded-[28px] border border-[#D9D0CB] dark:border-[rgba(108,21,30,0.35)] bg-white/40 dark:bg-black/30 backdrop-blur-md p-3.5 sm:p-6 lg:p-8 shadow-sm mb-4 sm:mb-8"
        >
          
          <header className="mb-4 sm:mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-[#D9D0CB]/70 dark:border-white/10">
            <div>
              <div className="font-bold uppercase tracking-[0.14em] sm:tracking-[0.28em] text-[11px] sm:text-xs text-[#A7192A] dark:text-[#EF7885] inline-flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                <span className="block h-px w-4 sm:w-5 bg-[#A7192A] dark:bg-[#EF7885] shrink-0" />
                <span>{phaseInfo.title}</span>
                <span>&middot;</span>
                <span className="whitespace-nowrap">{phaseInfo.dateRange}</span>
              </div>

              <h2 className="mt-2 font-serif text-[clamp(2rem,3.5vw,3.5rem)] font-bold leading-[0.96] tracking-[-0.04em] text-[#A7192A] dark:text-[#EA8793]">
                <StaggeredTextReveal text="Explore the" delay={0.1} stagger={0.02} letterClassName="text-[#A7192A] dark:text-[#EA8793]" />{' '}
                <StaggeredTextReveal text="schedule." delay={0.25} stagger={0.025} letterClassName="font-serif italic font-semibold text-[#6C151E] dark:text-[#F5DABF]" />
              </h2>

              <p className="mt-3 max-w-[720px] font-sans font-normal text-sm sm:text-base leading-relaxed text-[#4E4441] dark:text-[#D6CDCA]">
                Browse sessions, filter by track, and plan your Fall Fest experience across Online and Offline phases.
              </p>

              {currentPhase === 'online' && (
                <div className="mt-3.5 inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs">
                  <span className="font-mono font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-300">
                    Deadline Extended
                  </span>
                  <span>
                    Creative competitions (Tech Reels, Digital Poster, Technical Essay) are open until 14 Oct, 11:59 PM IST.
                  </span>
                </div>
              )}
            </div>

            {/* Phase Selector */}
            <div className="flex items-center">
              <PhaseSelector currentPhase={currentPhase} onPhaseChange={onPhaseChange} variant="segmented" />
            </div>
          </header>

          {/* DAY NAVIGATION TABS & TRACK FILTERS */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* Day Selector Tabs */}
            <div className="flex overflow-x-auto rounded-[20px] border border-[#D9D0CB] dark:border-white/10 bg-white/30 dark:bg-white/5 p-1 scrollbar-none">
              {currentDays.map((item, index) => {
                const isActive = index === dayIndex;
                return (
                  <button
                    key={item.id}
                    id={item.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => selectDay(index)}
                    className={`group relative flex min-w-[100px] sm:min-w-[120px] flex-col items-center justify-center overflow-hidden rounded-[16px] px-4 py-2.5 text-center transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-b from-[#6C151E] to-[#4A0D14] text-white shadow-md scale-[1.02]'
                        : 'text-[#665B57] dark:text-[#BEB5B4] hover:text-white'
                    }`}
                  >
                    {/* Fluid expanding hover circle */}
                    {!isActive && (
                      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#6C151E] dark:bg-[#A7192A] rounded-full opacity-0 pointer-events-none transition-all duration-[2400ms] ease-[cubic-bezier(0.25,1,0.35,1)] group-hover:w-[300px] group-hover:h-[300px] group-hover:opacity-100" />
                    )}
                    <span className="relative z-[1] text-[10px] font-extrabold uppercase tracking-[0.14em] opacity-90 transition-transform duration-300 group-hover:scale-105">
                      {item.label}
                    </span>
                    <span className="relative z-[1] text-xs sm:text-sm font-bold mt-0.5">{item.date}</span>
                    <span className="relative z-[1] text-[10px] opacity-75">{item.weekday}</span>
                  </button>
                );
              })}
            </div>

            {/* Track Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#665B57] dark:text-[#BEB5B4] mr-1">
                <Filter size={13} />
                Tracks:
              </div>

              {tracks.map((item) => {
                const isActive = activeTrack === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveTrack(item)}
                    className={`group relative overflow-hidden rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer active:scale-[0.95] ${
                      isActive
                        ? 'border-[#6C151E] bg-[#6C151E] text-white shadow-md'
                        : 'border-[#D9D0CB] dark:border-white/15 bg-white/40 dark:bg-white/5 text-[#261F1D] dark:text-[#E8E0DE] hover:border-[#6C151E] hover:text-white'
                    }`}
                  >
                    {/* Fluid expanding hover circle */}
                    {!isActive && (
                      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#6C151E] dark:bg-[#A7192A] rounded-full opacity-0 pointer-events-none transition-all duration-[2400ms] ease-[cubic-bezier(0.25,1,0.35,1)] group-hover:w-[260px] group-hover:h-[260px] group-hover:opacity-100" />
                    )}
                    <span className="relative z-[1] transition-transform duration-300 group-hover:scale-105">{item}</span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* SEARCH INPUT BAR */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#D9D0CB] dark:border-white/15 bg-white/70 dark:bg-white/10 px-4 py-3 text-[#665B57] shadow-inner focus-within:border-[#6C151E]">
            <Search size={18} className="text-[#6C151E] dark:text-[#E45464]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions, topics, speakers, rooms, level..."
              aria-label="Search sessions"
              className="w-full bg-transparent text-sm font-medium text-[#261F1D] dark:text-white outline-none placeholder:text-[#8D857F] dark:placeholder:text-[#998F8C]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs font-bold uppercase tracking-wider text-[#6C151E] hover:underline"
              >
                Clear
              </button>
            )}
          </div>

        </div>

        {/* MAIN TWO-COLUMN TIMELINE & DETAIL VIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT TIMELINE COLUMN (12 cols when collapsed, 7 cols when session selected on desktop) */}
          <div 
            className={`transition-[grid-column,width,max-width] duration-300 ease-in-out flex flex-col space-y-4 ${
              activePanelSession ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pb-2 border-b border-[#D9D0CB] dark:border-white/10">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3
                  id={activeDay ? `heading-${activeDay.id}` : undefined}
                  className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#13090A] dark:text-[#F6F2F1] scroll-mt-24 sm:scroll-mt-28"
                >
                  {activeDay?.weekday}, {activeDay?.date} 2026
                </h3>
                <span className="text-xs sm:text-sm font-sans font-normal text-[#665B57] dark:text-[#BEB5B4] whitespace-nowrap">
                  ({visibleSessions.length} session{visibleSessions.length === 1 ? '' : 's'})
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {!selectedSession && visibleSessions.length > 0 && (
                  <span className="hidden sm:inline-block text-[11px] font-mono font-medium text-[#6C151E]/80 dark:text-[#E45464]/80">
                    &bull; Click any card to expand full session details
                  </span>
                )}
                <span className="font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[#6C151E] dark:text-[#E45464] whitespace-nowrap shrink-0">
                  ALL TIMES IST
                </span>
              </div>
            </div>

            {/* SESSION TIMELINE CARDS LIST */}
            {visibleSessions.length > 0 ? (
              <div className="space-y-3">
                {visibleSessions.map((session) => {
                  const isSelected = selectedSession?.id === session.id;
                  const action = getSessionAction(session, currentPhase);

                  return (
                    <React.Fragment key={session.id}>
                      <div
                        id={session.id}
                        onClick={() => setSelectedId(isSelected ? null : session.id)}
                        className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-2xl border p-4 sm:p-5 transition-all duration-200 ease-in-out cursor-pointer scroll-mt-28 ${
                          isSelected
                            ? 'border-[#6C151E] bg-white dark:bg-white/10 shadow-lg ring-2 ring-[#6C151E]'
                            : 'border-[#D9D0CB] dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-md'
                        }`}
                      >
                        {/* Left: Time & Details */}
                        <div className="flex flex-col sm:flex-row items-start gap-4 w-full">
                          
                          {/* Time Column */}
                          <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center min-w-[100px] text-left border-b sm:border-b-0 sm:border-r border-[#D9D0CB]/60 dark:border-white/10 pb-2 sm:pb-0 sm:pr-4 w-full sm:w-auto">
                            <span className="font-mono text-sm font-semibold text-[#6C151E] dark:text-[#E45464]">
                              {session.time}
                            </span>
                            {session.end && (
                              <span className="font-mono text-xs text-[#665B57] dark:text-[#BEB5B4]">
                                &mdash; {session.end}
                              </span>
                            )}
                          </div>

                          {/* Session Content */}
                          <div className="flex flex-col space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono rounded-full bg-[#6C151E]/10 dark:bg-[#E45464]/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6C151E] dark:text-[#E45464]">
                                {session.track}
                              </span>
                              <span className="font-mono rounded-full bg-[#D9D0CB]/50 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#665B57] dark:text-[#BEB5B4]">
                                {session.level}
                              </span>
                              <span className="font-mono text-[11px] font-semibold text-[#8D857F] dark:text-[#998F8C]">
                                {session.duration}
                              </span>
                            </div>

                            <h4 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#13090A] dark:text-[#F6F2F1] group-hover:text-[#6C151E] dark:group-hover:text-[#E45464] transition-colors leading-snug">
                              {action.isExternal ? (
                                <a
                                  href={action.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:underline"
                                >
                                  {session.title}
                                </a>
                              ) : (
                                <Link
                                  href={action.href}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:underline"
                                >
                                  {session.title}
                                </Link>
                              )}
                            </h4>

                            <p className="font-sans font-normal text-xs sm:text-sm leading-relaxed text-[#665B57] dark:text-[#BEB5B4] line-clamp-2">
                              {session.description}
                            </p>
                          </div>

                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 mt-3 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#D9D0CB]/40 dark:border-white/10 w-full sm:w-auto justify-end shrink-0">
                          {action.isExternal ? (
                            <a
                              href={action.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-[#6C151E] hover:bg-[#8F2632] text-white text-xs font-bold shadow-xs transition-all active:scale-95 shrink-0"
                            >
                              <span>{action.cardLabel}</span>
                              <ArrowRight size={13} />
                            </a>
                          ) : (
                            <Link
                              href={action.href}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-[#6C151E] hover:bg-[#8F2632] text-white text-xs font-bold shadow-xs transition-all active:scale-95 shrink-0"
                            >
                              <span>{action.cardLabel}</span>
                              <ArrowRight size={13} />
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(isSelected ? null : session.id);
                            }}
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors shrink-0 ${
                              isSelected
                                ? 'bg-[#6C151E] text-white'
                                : 'bg-[#6C151E]/10 text-[#6C151E] dark:bg-white/10 dark:text-white hover:bg-[#6C151E] hover:text-white'
                            }`}
                            title={isSelected ? "Close details" : "View session details"}
                            aria-label={isSelected ? "Close session details" : "View session details"}
                          >
                            <ArrowRight size={15} className={`transition-transform duration-200 ${isSelected ? 'rotate-90' : ''}`} />
                          </button>
                        </div>

                      </div>

                      {/* MOBILE INLINE ACCORDION DETAIL DRAWER (Renders directly under the selected card on mobile/tablet) */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="lg:hidden overflow-hidden w-full"
                          >
                            {renderDetailContent(session)}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#D9D0CB] dark:border-white/15 p-12 text-center text-[#665B57] dark:text-[#BEB5B4]">
                <CalendarDays size={36} className="mx-auto mb-3 text-[#6C151E] opacity-50" />
                <h4 className="font-serif text-lg font-bold text-[#13090A] dark:text-white">No sessions found</h4>
                <p className="mt-1 text-sm">
                  Try adjusting your search query or track filters.
                </p>
              </div>
            )}

          </div>

          {/* RIGHT SELECTED SESSION DETAIL PANEL (5 cols desktop, slides in cleanly when session clicked) */}
          <div className={`hidden lg:block transition-all duration-300 ease-in-out ${activePanelSession ? 'lg:col-span-5 sticky top-24' : 'hidden'}`}>
            <AnimatePresence 
              mode="wait"
              onExitComplete={() => {
                if (!selectedSession) {
                  setActivePanelSession(null);
                }
              }}
            >
              {selectedSession && (
                <motion.div 
                  key={selectedSession.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {renderDetailContent(selectedSession)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </section>
  );
}
