/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Loader2, 
  Volume2, 
  VolumeX, 
  AlertCircle, 
  ChevronDown, 
  Download, 
  Sparkles, 
  Check, 
  Edit3, 
  Undo2 
} from 'lucide-react';
import { Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';

interface AiTtsPreviewProps {
  text: string;
  voices: Voice[];
  promptInstruction?: string;
  onTextChange?: (newText: string) => void;
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function pcmToWavBlob(pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, pcmData.length, true);

  return new Blob([header, pcmData], { type: 'audio/wav' });
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const isArabicText = (str: string) => /[\u0600-\u06FF]/.test(str);

const AiTtsPreview: React.FC<AiTtsPreviewProps> = ({ 
  text: initialText, 
  voices, 
  promptInstruction,
  onTextChange 
}) => {
  const [selectedVoiceName, setSelectedVoiceName] = useState(voices[0]?.name || '');
  const [currentText, setCurrentText] = useState(initialText);
  const [draftText, setDraftText] = useState(initialText);
  const [isEditingText, setIsEditingText] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [generatedVoiceKey, setGeneratedVoiceKey] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);

  // Sync initial text prop
  useEffect(() => {
    setCurrentText(initialText);
    setDraftText(initialText);
  }, [initialText]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (voices.length > 0 && !voices.find(v => v.name === selectedVoiceName)) {
      setSelectedVoiceName(voices[0].name);
    }
  }, [voices, selectedVoiceName]);

  // Handle Audio element updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsPlaying(false);
      setError("Playback error. Please try generating again.");
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  const generateAudio = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      // Build style-aware delivery prompt tailored for boy or girl narrator
      let genderInstruction = "Natural Egyptian Arabic voice, warm and realistic, authentic Egyptian pronunciation.";
      if (selectedVoiceName === 'Achird' || selectedVoiceName === 'Charon') {
        genderInstruction = "Natural Egyptian Arabic male voice (young man, 25–30), warm, reflective, brotherly and authentic Egyptian pronunciation.";
      } else if (selectedVoiceName === 'Aoede' || selectedVoiceName === 'Leda') {
        genderInstruction = "Natural Egyptian Arabic female voice (young woman), gentle, reflective, sincere, sisterly and authentic Egyptian pronunciation.";
      }

      let formattedPrompt = currentText;
      if (promptInstruction) {
        formattedPrompt = `Voice-over performance guidance:
${genderInstruction} The delivery should sound human, calm and emotionally engaging—not robotic or theatrical. No background music, no singing, no ambient sound effects.

Spoken text:
${currentText}`;
      } else {
        formattedPrompt = `Read warmly, calmly, and naturally in authentic Egyptian Arabic (${genderInstruction}):
${currentText}`;
      }

      // Generate speech using gemini-3.1-flash-tts-preview
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: formattedPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoiceName },
            },
          },
        },
      });

      if (!isMountedRef.current) return;

      const base64Data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Data) {
        throw new Error("No audio data returned from Gemini TTS.");
      }

      const rawBytes = decodeBase64(base64Data);
      const wavBlob = pcmToWavBlob(rawBytes, 24000, 1);
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      const newUrl = URL.createObjectURL(wavBlob);
      setAudioBlob(wavBlob);
      setAudioUrl(newUrl);
      setGeneratedVoiceKey(`${selectedVoiceName}_${currentText}`);
      
      // Auto play once generated
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      }, 100);

    } catch (err: any) {
      console.error("Gemini TTS Error:", err);
      if (isMountedRef.current) {
        setError(err.message || "Failed to generate speech. Please check connection.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const commitDraft = () => {
    setCurrentText(draftText);
    setIsEditingText(false);
    if (onTextChange) {
      onTextChange(draftText);
    }
  };

  const handleToggleEdit = () => {
    if (isEditingText) {
      // User clicked "Done Editing" - commit changes
      commitDraft();
    } else {
      // User entered editing mode - ensure draft reflects currentText
      setDraftText(currentText);
      setIsEditingText(true);
    }
  };

  const handleCancelEdit = () => {
    setDraftText(currentText);
    setIsEditingText(false);
  };

  const handleTogglePlay = async () => {
    // If user was editing and clicks play, commit draft first
    if (isEditingText) {
      commitDraft();
    }

    const currentKey = `${selectedVoiceName}_${isEditingText ? draftText : currentText}`;
    
    // If not yet generated or text/voice changed, generate first
    if (!audioUrl || generatedVoiceKey !== currentKey) {
      await generateAudio();
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("Playback error:", err);
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  };

  const handleToggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      if (newVol === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
      }
    }
  };

  const handleDownload = () => {
    if (!audioBlob) return;
    const downloadUrl = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `voiceover-${selectedVoiceName}-egyptian-arabic.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
  };

  const isArabic = isArabicText(currentText);
  const isStale = audioUrl && generatedVoiceKey !== `${selectedVoiceName}_${currentText}`;

  return (
    <div className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 shadow-sm overflow-hidden flex flex-col">
      {/* Hidden audio element */}
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="auto"
        />
      )}

      {/* Top Controls Bar */}
      <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-800/80 border-b border-zinc-100 dark:border-zinc-700/60">
        
        {/* Voice Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="voice-select" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
            Narrator:
          </label>
          <div className="relative group">
            <select
              id="voice-select"
              value={selectedVoiceName}
              onChange={(e) => setSelectedVoiceName(e.target.value)}
              disabled={isLoading}
              className="appearance-none bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 py-1.5 pl-3 pr-8 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
            >
              {voices.map(voice => {
                let roleTag = '';
                if (voice.name === 'Achird' || voice.name === 'Charon') {
                  roleTag = ' [صوت الولد]';
                } else if (voice.name === 'Aoede' || voice.name === 'Leda') {
                  roleTag = ' [صوت البنت]';
                }
                return (
                  <option key={voice.name} value={voice.name}>
                    {voice.name}{roleTag} ({voice.analysis.gender} • {voice.pitch})
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
              <ChevronDown size={14} />
            </div>
          </div>

          {(selectedVoiceName === 'Achird' || selectedVoiceName === 'Charon') && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
              👦 صوت الولد
            </span>
          )}

          {(selectedVoiceName === 'Aoede' || selectedVoiceName === 'Leda') && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-700">
              👧 صوت البنت
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Edit Script Toggle */}
          <button
            onClick={handleToggleEdit}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isEditingText 
                ? 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 shadow-sm' 
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
            }`}
            title={isEditingText ? "Apply and save changes to script" : "Edit script text"}
          >
            {isEditingText ? (
              <>
                <Check size={13} />
                <span>Done Editing (تطبيق التعديل)</span>
              </>
            ) : (
              <>
                <Edit3 size={13} />
                <span className="hidden sm:inline">Edit Script</span>
              </>
            )}
          </button>

          {/* Download Button */}
          {audioBlob && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-medium transition-all"
              title="Download high-quality WAV audio file"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export WAV</span>
            </button>
          )}

          {/* Play / Generate Button */}
          <button
            onClick={handleTogglePlay}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 shadow-sm active:scale-95 ${
              isLoading
                ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 cursor-not-allowed'
                : isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : isStale || !audioUrl
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause size={15} className="fill-current" />
                <span>Pause</span>
              </>
            ) : isStale || !audioUrl ? (
              <>
                <Sparkles size={15} />
                <span>Generate Audio</span>
              </>
            ) : (
              <>
                <Play size={15} className="fill-current" />
                <span>Play Voice-Over</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Script Text Editor Area */}
      {isEditingText && (
        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-800/50">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Edit3 size={13} className="text-amber-600 dark:text-amber-400" />
                تحرير النص المقروء (Spoken Script)
              </span>
              <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 hidden sm:inline">
                • التعديل يطبق فقط عند الضغط على "Done Editing"
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDraftText(initialText)}
                className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1 px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/60 transition-colors"
                title="Reset editor to original scene text"
              >
                <Undo2 size={11} /> Reset
              </button>

              <button
                onClick={handleCancelEdit}
                className="text-[11px] text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 transition-colors"
                title="Cancel changes without applying"
              >
                إلغاء (Cancel)
              </button>

              <button
                onClick={commitDraft}
                className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-lg flex items-center gap-1 shadow-xs transition-colors"
                title="Apply changes and update Spoken Script and Voice-Over player"
              >
                <Check size={13} />
                Done Editing (حفظ وتطبيق)
              </button>
            </div>
          </div>

          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
              }
            }}
            dir={isArabicText(draftText) ? 'rtl' : 'ltr'}
            rows={4}
            className={`w-full p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-amber-300 dark:border-amber-700 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner ${
              isArabicText(draftText) ? 'font-arabic leading-loose text-right' : 'font-sans'
            }`}
            placeholder="اكتب أو الصق نص السرد هنا..."
          />
          <div className="flex justify-between items-center mt-1 px-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
            <span>اضغط <b>Ctrl + Enter</b> للحفظ السريع</span>
            <span>{draftText.length} حرف</span>
          </div>
        </div>
      )}

      {/* Waveform Visualizer & Status */}
      <div 
        className={`h-24 sm:h-28 relative flex items-center justify-center bg-zinc-900 dark:bg-black/90 overflow-hidden cursor-pointer group`}
        onClick={handleTogglePlay}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTogglePlay(); }}
        aria-label={isPlaying ? "Pause voice-over" : "Play voice-over"}
      >
        {/* Visualizer Canvas */}
        <div className="w-full h-full absolute inset-0 flex items-center justify-center pointer-events-none">
          <AudioVisualizer isPlaying={isPlaying} color="#818cf8" />
        </div>

        {/* Center Prompt / Status Overlay */}
        {!isPlaying && !isLoading && (
          <div className="z-10 flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-700/60 text-zinc-200 group-hover:scale-105 transition-transform shadow-xl">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-100">
              <Play size={14} className="fill-current text-indigo-400" />
              <span>{audioUrl ? 'Click to Listen' : 'Click to Generate Egyptian Voice-Over'}</span>
            </div>
            <span className="text-[10px] text-zinc-400">
              Gemini 3.1 Flash TTS • {selectedVoiceName} {
                selectedVoiceName === 'Achird' || selectedVoiceName === 'Charon' 
                  ? '(صوت الولد • Male)' 
                  : selectedVoiceName === 'Aoede' || selectedVoiceName === 'Leda'
                  ? '(صوت البنت • Female)'
                  : ''
              } • Egyptian Arabic Voice-Over
            </span>
          </div>
        )}

        {isLoading && (
          <div className="z-10 flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-700/60 text-indigo-300">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs font-semibold">Generating natural Egyptian voice-over...</span>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="absolute inset-0 bg-red-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-red-200 gap-1.5 p-4 z-20 text-center">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle size={16} />
              <span>Synthesis Failed</span>
            </div>
            <p className="text-xs text-red-300 max-w-md">{error}</p>
            <button
              onClick={(e) => { e.stopPropagation(); generateAudio(); }}
              className="mt-1 px-3 py-1 bg-red-800 hover:bg-red-700 rounded-lg text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Playback Controls & Progress Bar */}
      <div className="p-3 bg-white dark:bg-zinc-800/90 border-t border-zinc-100 dark:border-zinc-700/60 flex flex-col gap-2">
        {/* Scrubber */}
        <div className="flex items-center gap-3 w-full">
          <span className="text-[11px] font-mono text-zinc-400 w-9 text-right tabular-nums">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioUrl || isLoading}
            className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
          />
          <span className="text-[11px] font-mono text-zinc-400 w-9 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* Bottom Bar: Replay, Volume, Status */}
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={handleRestart}
              disabled={!audioUrl}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 disabled:opacity-30"
              title="Replay from start"
            >
              <RotateCcw size={14} />
            </button>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleToggleMute} 
                className="hover:text-zinc-900 dark:hover:text-white"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              24 kHz Studio Mono
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiTtsPreview;
