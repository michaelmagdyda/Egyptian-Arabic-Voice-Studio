/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect } from 'react';
import { VOICE_DATA } from './constants';
import Carousel3D from './components/Carousel3D';
import GridView from './components/GridView';
import FilterBar from './components/FilterBar';
import VoiceFinder from './components/VoiceFinder';
import AiResultCard from './components/AiResultCard';
import { FilterState, AiRecommendation } from './types';
import { Info, Sparkles, Volume2, ArrowRight, RotateCcw } from 'lucide-react';

const DEFAULT_EGYPTIAN_SCENE: AiRecommendation = {
  voiceNames: ['Achird', 'Charon', 'Aoede', 'Leda', 'Fenrir', 'Orus'],
  systemInstruction: `## Audio Profile
**Voice Casting**:
- **صوت الولد (Male Narrator)**: **Achird** أو **Charon** (نبرة شابة دافئة، هادئة وإنسانية، ٢٥–٣٠ سنة).
- **صوت البنت (Female Narrator)**: **Aoede** أو **Leda** (نبرة مشرقة، هادئة، متأملة وصادقة).
**Archetype**: Warm, sincere, reflective narrator and storyteller.
**Tone**: Calming, emotionally engaging, authentic, and deeply human—strictly not robotic or theatrical.
**Pacing**: Thoughtful and deliberate, taking natural micro-pauses at commas and ellipsis moments (...). Authentic Egyptian phrasing, natural cadence, and clear articulation.

## Scene & Production Setup
**Context**: Reflective narration, personal story, or documentary voice-over.
**Setup**: Voice-over only (dry studio booth). No visible speaker and no lip-sync constraints.
**Acoustics**: Clean studio vocal presence with subtle warmth and zero room reverb.
**Audio Restrictions**: Strictly pure narration. No background music (BGM), no singing, no ambient dialogue, and no sound effects (SFX).

## Director's Notes (General Guidance)
- **Accent & Dialect**: Authentic, natural Egyptian Arabic (اللهجة المصرية اليومية الراقية) with natural pronunciation and effortless flow.
- **Delivery & Tone**: Speak directly from the heart with warm sincerity, honest vulnerability, and gentle conviction—avoid over-dramatization, commercial enthusiasm, or news-anchor stiffness.
- **Pacing & Breathing**: Maintain an unhurried, reflective rhythm. Allow words to breathe with natural pauses between thought units.
- **Character Consistency**: Preserve the exact vocal identity, emotional depth, and audio booth characteristics across all segments.
- **Adaptability**: Follow the emotional arc of whatever script is loaded—starting intimate and grounded, building genuine warmth, and concluding with thoughtful resonance.

## Transcript
إهلا بيك فى الصوت العامى المصرى اللى من خلالة تقدر تختار الصوت اللى تحبة و تحول النص إلى صوت`,
  sampleText: `إهلا بيك فى الصوت العامى المصرى اللى من خلالة تقدر تختار الصوت اللى تحبة و تحول النص إلى صوت`
};

const App: React.FC = () => {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiRecommendation | null>(DEFAULT_EGYPTIAN_SCENE);
  const [isAiCardVisible, setIsAiCardVisible] = useState(true);
  const [filterToRecommended, setFilterToRecommended] = useState(true);
  const [showVoiceFinder, setShowVoiceFinder] = useState(false);
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Carousel state
  const [activeIndex, setActiveIndex] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    gender: 'All',
    pitch: 'All',
    search: '',
  });

  // Theme Management
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const uniqueGenders = useMemo(() => Array.from(new Set(VOICE_DATA.map(v => v.analysis.gender))).sort(), []);
  const uniquePitches = useMemo(() => Array.from(new Set(VOICE_DATA.map(v => v.analysis.pitch))).sort(), []);

  const recommendedVoicesList = useMemo(() => {
    if (!aiResult) return [];
    return aiResult.voiceNames
      .map(name => VOICE_DATA.find(v => v.name === name))
      .filter((v): v is typeof VOICE_DATA[0] => !!v);
  }, [aiResult]);

  const filteredVoices = useMemo(() => {
    let baseData = VOICE_DATA;
    if (aiResult && filterToRecommended) {
      const recommended = aiResult.voiceNames
        .map(name => VOICE_DATA.find(v => v.name === name))
        .filter((v): v is typeof VOICE_DATA[0] => !!v);
      baseData = recommended.length > 0 ? recommended : baseData;
    }

    return baseData.filter(voice => {
      const matchGender = filters.gender === 'All' || voice.analysis.gender === filters.gender;
      const matchPitch = filters.pitch === 'All' || voice.analysis.pitch === filters.pitch;
      
      const searchLower = filters.search.toLowerCase();
      const matchSearch = filters.search === '' || 
        voice.name.toLowerCase().includes(searchLower) || 
        voice.characteristics.some(c => c.toLowerCase().includes(searchLower)) ||
        voice.analysis.characteristics.some(c => c.toLowerCase().includes(searchLower)) ||
        voice.analysis.gender.toLowerCase().startsWith(searchLower) ||
        voice.pitch.toLowerCase().includes(searchLower) ||
        voice.analysis.pitch.toLowerCase().includes(searchLower);

      return matchGender && matchPitch && matchSearch;
    });
  }, [filters, aiResult, filterToRecommended]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredVoices.length]);

  const handlePlayToggle = (voiceName: string) => {
    setPlayingVoice(current => current === voiceName ? null : voiceName);
  };

  const isModalOpen = showVoiceFinder || (aiResult && isAiCardVisible);

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden flex flex-col relative transition-colors duration-300">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-60"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-50 dark:bg-indigo-900/20 blur-3xl opacity-50"></div>
      </div>

      {/* Main App Content */}
      <div 
        className="flex flex-col flex-1 overflow-hidden" 
        aria-hidden={isModalOpen}
        // @ts-ignore
        inert={isModalOpen ? '' : undefined}
        style={isModalOpen ? { pointerEvents: 'none' } : {}}
      >
        <FilterBar 
          filters={filters}
          onFilterChange={setFilters}
          uniqueGenders={uniqueGenders}
          uniquePitches={uniquePitches}
          onOpenAiCasting={() => setShowVoiceFinder(true)}
          onOpenVoiceoverStudio={() => setIsAiCardVisible(true)}
          hasActiveVoiceover={!!aiResult}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
        />

        {/* Active Scene Context Banner (when Studio modal is closed) */}
        {aiResult && !isAiCardVisible && (
          <div className="bg-indigo-50/90 dark:bg-indigo-950/40 border-b border-indigo-200/60 dark:border-indigo-800/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-30 transition-all">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                Egyptian Arabic Voice-Over:
              </span>
              <span className="text-zinc-600 dark:text-zinc-300">
                استوديو السرد الصوتي
              </span>
              <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                • صوت الولد: Achird / Charon • صوت البنت: Aoede / Leda
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterToRecommended(!filterToRecommended)}
                className="px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-white dark:hover:bg-zinc-800 font-medium transition-colors"
              >
                {filterToRecommended ? 'Show All 30 Voices' : `Filter to Cast Voices (${recommendedVoicesList.length})`}
              </button>

              <button
                onClick={() => setIsAiCardVisible(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-xs transition-all"
              >
                <span>Open Voice-Over Studio</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 relative flex flex-col overflow-hidden">
          {filteredVoices.length > 0 ? (
            viewMode === 'carousel' ? (
              <div className="w-full flex-1 flex items-center justify-center pb-8 min-h-0">
                <Carousel3D 
                  voices={filteredVoices}
                  activeIndex={activeIndex}
                  onChange={setActiveIndex}
                  playingVoice={playingVoice}
                  onPlayToggle={handlePlayToggle}
                  disabled={isModalOpen}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <GridView 
                  voices={filteredVoices}
                  playingVoice={playingVoice}
                  onPlayToggle={handlePlayToggle}
                />
              </div>
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center pb-24">
              <div className="text-center animate-fade-in">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-6 shadow-sm">
                  <Info size={32} className="text-zinc-300 dark:text-zinc-500" />
                </div>
                <h3 className="text-xl font-serif text-zinc-900 dark:text-white mb-2">No voices found</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-6">Try adjusting your filters or open the Voice-Over Studio.</p>
                <div className="flex justify-center gap-3">
                  <button 
                    onClick={() => { setFilterToRecommended(false); setFilters({ gender: 'All', pitch: 'All', search: '' }); }}
                    className="px-4 py-2 bg-zinc-900 dark:bg-zinc-700 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors"
                  >
                    Reset Filters
                  </button>
                  <button 
                    onClick={() => setIsAiCardVisible(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-500 transition-colors"
                  >
                    Open Studio
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {filteredVoices.length > 0 && viewMode === 'carousel' && (
            <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-widest uppercase bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm inline-block px-3 py-1 rounded-full border border-white/50 dark:border-zinc-800">
                {activeIndex + 1} / {filteredVoices.length}
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Voice Finder (AI Casting modal) */}
      {showVoiceFinder && (
        <VoiceFinder 
          voices={VOICE_DATA}
          onRecommendation={(rec) => {
            if (rec) {
              setAiResult(rec);
              setIsAiCardVisible(true);
              setFilterToRecommended(true);
              setFilters(prev => ({ ...prev, search: '' })); 
            }
            setShowVoiceFinder(false);
          }}
          onClose={() => setShowVoiceFinder(false)}
        />
      )}

      {/* Egyptian Arabic Voice-Over Studio & Player modal */}
      {aiResult && isAiCardVisible && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-result-title"
        >
          <div className="absolute inset-0" onClick={() => setIsAiCardVisible(false)}></div>
          <div className="relative w-full max-w-5xl animate-slide-up max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl">
            <AiResultCard 
              result={aiResult} 
              voices={recommendedVoicesList.length > 0 ? recommendedVoicesList : VOICE_DATA.slice(0, 5)} 
              onClose={() => setIsAiCardVisible(false)} 
              onUpdateScript={(newScript) => {
                setAiResult(prev => prev ? { ...prev, sampleText: newScript } : null);
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
