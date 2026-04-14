"use client";

import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  /** Full URL or relative path to the MP3. The API route at /api/audio/[date] redirects to a signed Supabase Storage URL. */
  src: string;
  /** Total duration in seconds. Used for the progress bar and the displayed time. */
  durationSeconds?: number | null;
  /** Date label displayed above the player (e.g. "Tuesday, April 14"). */
  dateLabel?: string;
}

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;

/**
 * Minimal client-side audio player for the BTC Today Pro morning brief.
 * Designed for a commute use case: big play button, progress, playback
 * speed selector, no clutter. Auto-play on mount is attempted but browsers
 * may block it; the user taps the button once and it plays.
 */
export function AudioPlayer({ src, durationSeconds, dateLabel }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);

  // Attempt autoplay on mount (browsers may silently block)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch(() => { /* user gesture required, they will tap */ });
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => { /* ignore */ });
    } else {
      audio.pause();
    }
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!isNaN(audio.duration) && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }

  function handleSpeedChange(newSpeed: (typeof PLAYBACK_SPEEDS)[number]) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = newSpeed;
    setSpeed(newSpeed);
  }

  const displayDuration = duration || durationSeconds || 0;
  const progress = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;

  return (
    <div className="w-full max-w-lg mx-auto">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        preload="metadata"
      />

      {dateLabel && (
        <p className="text-center font-[family-name:var(--font-heading)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-4">
          {dateLabel}
        </p>
      )}

      {/* Big play/pause button */}
      <div className="flex justify-center mb-8">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="group flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow-[0_8px_24px_-8px_rgba(247,147,26,0.5)] hover:scale-105 active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
        >
          {isPlaying ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v13.72a1 1 0 001.5.87l11.14-6.86a1 1 0 000-1.74L9.5 4.27A1 1 0 008 5.14z" />
            </svg>
          )}
        </button>
      </div>

      {/* Progress bar + times */}
      <div className="px-2">
        <input
          type="range"
          min={0}
          max={displayDuration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Audio progress"
          className="w-full h-1.5 appearance-none cursor-pointer rounded-full bg-[var(--color-border)] accent-[var(--color-accent)]"
          style={{
            background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${progress}%, var(--color-border) ${progress}%, var(--color-border) 100%)`,
          }}
        />
        <div className="mt-2 flex justify-between font-[family-name:var(--font-heading)] text-xs tabular-nums text-[var(--color-text-muted)]">
          <span>{formatTimeCode(currentTime)}</span>
          <span>{formatTimeCode(displayDuration)}</span>
        </div>
      </div>

      {/* Playback speed selector */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {PLAYBACK_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSpeedChange(s)}
            className={`rounded-md border px-3 py-1 font-[family-name:var(--font-heading)] text-xs font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              speed === s
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-text-primary)]"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTimeCode(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
