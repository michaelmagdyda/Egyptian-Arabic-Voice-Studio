/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AiRecommendation, Voice } from '../types';
import { Sparkles, Copy, Check, Quote, X, Radio, Mic, FileText, Download } from 'lucide-react';
import AiTtsPreview from './AiTtsPreview';
import ReactMarkdown from 'react-markdown';

interface AiResultCardProps {
  result: AiRecommendation;
  voices: Voice[];
  onClose: () => void;
  onUpdateScript?: (newScript: string) => void;
}

const isArabicText = (str: string) => /[\u0600-\u06FF]/.test(str);

const AiResultCard: React.FC<AiResultCardProps> = ({ result, voices, onClose, onUpdateScript }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeScript, setActiveScript] = useState(result.sampleText);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync state if result.sampleText changes externally
  useEffect(() => {
    setActiveScript(result.sampleText);
  }, [result.sampleText]);

  const handleScriptChange = (newText: string) => {
    setActiveScript(newText);
    if (onUpdateScript) {
      onUpdateScript(newText);
    }
  };

  // Focus trap implementation
  useEffect(() => {
    cardRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      if (!cardRef.current) return;

      const focusableElements = cardRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Ensure markdown is properly formatted and dynamically updates the Transcript section when the user edits the script
  const formattedInstruction = useMemo(() => {
    if (!result.systemInstruction) return '';
    let text = result.systemInstruction;
    text = text.replace(/([^\n])\s*(##)/g, '$1\n\n$2');

    // Dynamically replace the Transcript content with the active edited script
    if (activeScript) {
      if (text.includes('## Transcript')) {
        const parts = text.split('## Transcript');
        text = `${parts[0]}## Transcript\n${activeScript}`;
      } else {
        text = `${text}\n\n## Transcript\n${activeScript}`;
      }
    }

    return text;
  }, [result.systemInstruction, activeScript]);

  const isArabic = isArabicText(activeScript);

  return (
    <div 
      ref={cardRef}
      tabIndex={-1}
      className="w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden relative group outline-none h-full flex flex-col rounded-2xl"
    >
      {/* Top Banner with Close Button & Title */}
      <div className="relative px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
            <Mic size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="ai-result-title" className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                {isArabic ? 'Egyptian Arabic Voice-Over Studio' : 'AI Voice-Over Studio'}
              </h2>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Production Ready
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              صوت الولد: Achird أو Charon • صوت البنت: Aoede أو Leda • Voice-over narration
            </p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
      </div>

      {/* Production Badges */}
      <div className="px-6 py-2.5 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-900/30 flex flex-wrap gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
          🇪🇬 Egyptian Arabic (اللهجة المصرية)
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
          🎙️ Voice-Over Narration (No lip-sync required)
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs">
          👦 صوت الولد: Achird / Charon
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs">
          👧 صوت البنت: Aoede / Leda
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
          🕊️ Human, Warm & Emotionally Engaging
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
          🔇 Pure Vocal Booth (No BGM / No SFX)
        </span>
      </div>
      
      {/* Main Grid: Left Blueprint / Right Player & Script */}
      <div className="p-4 sm:p-6 md:p-8 flex flex-col lg:flex-row gap-6 overflow-y-auto max-h-[85vh] flex-1">
        
        {/* Left: Director's Blueprint & Persona Spec */}
        <div className="flex-1 space-y-4 min-w-0 flex flex-col">
          <div className="bg-white dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-sm relative group/code flex-1 flex flex-col min-h-[300px] overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-700/60 bg-zinc-50/50 dark:bg-zinc-800/80 flex-shrink-0">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 tracking-wide flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-500" />
                Director's Blueprint & Character Notes
              </span>
              <button 
                onClick={() => handleCopy(result.systemInstruction, 'sys')} 
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition-all shadow-2xs"
                title="Copy Director's Blueprint"
              >
                {copiedSection === 'sys' ? (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Blueprint</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Markdown Blueprint Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-zinc-50/30 dark:bg-zinc-900/30">
              <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-zinc-100 prose-headings:font-bold prose-headings:mb-2 prose-headings:mt-4 prose-p:text-zinc-600 dark:prose-p:text-zinc-300 prose-p:leading-relaxed prose-strong:text-zinc-900 dark:prose-strong:text-white text-xs sm:text-sm">
                <ReactMarkdown>{formattedInstruction}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Spoken Script & High-Fidelity Audio Preview */}
        <div className="flex-1 flex flex-col space-y-4">
          
          {/* Spoken Arabic Script Display */}
          <div className="bg-white dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 p-4 shadow-sm relative">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-700/60">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Quote size={14} className="text-indigo-500" />
                Spoken Script (النص المقروء)
              </span>
              <button 
                onClick={() => handleCopy(activeScript, 'script')} 
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition-all shadow-2xs"
                title="Copy Script Text"
              >
                {copiedSection === 'script' ? (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            <div 
              dir={isArabic ? 'rtl' : 'ltr'} 
              className={`p-3 bg-zinc-50/60 dark:bg-zinc-900/60 rounded-xl text-zinc-800 dark:text-zinc-100 transition-all ${
                isArabic 
                  ? 'font-arabic text-base sm:text-lg leading-loose text-right' 
                  : 'font-serif text-base leading-relaxed'
              }`}
            >
              {activeScript.split('\n\n').map((paragraph, index) => (
                <p key={index} className="mb-3 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* Audio Synthesizer & Player */}
          <div className="bg-white dark:bg-zinc-800/60 rounded-2xl shadow-sm border border-zinc-200/80 dark:border-zinc-700/60 overflow-hidden">
            <AiTtsPreview 
              text={activeScript} 
              voices={voices}
              promptInstruction={formattedInstruction}
              onTextChange={handleScriptChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiResultCard;
