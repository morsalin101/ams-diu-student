'use client';

import { timeUtils } from '@/lib/utils';

interface CircularTimerProps {
  /** Remaining time in seconds. */
  timeLeft: number;
  /** Total exam duration in seconds (used to compute the ring progress). */
  totalTime: number;
  /** Optional pixel size of the ring. */
  size?: number;
}

// ponytail: fixed tick count — readable at this size; expose a prop only if a
// very different `size` ever needs it.
const TICKS = 48;

export function CircularTimer({
  timeLeft,
  totalTime,
  size = 84,
}: CircularTimerProps) {
  const c = size / 2;

  const safeTotal = totalTime > 0 ? totalTime : 1;
  const fraction = Math.max(0, Math.min(1, timeLeft / safeTotal));

  // Color shifts as time runs low so the student notices.
  const isCritical = timeLeft <= 60;
  const isWarning = !isCritical && timeLeft <= 300;
  const progressColor = isCritical
    ? '#dc2626' // red-600
    : isWarning
      ? '#f59e0b' // amber-500
      : '#2E3094'; // brand navy

  // Two concentric layers: an outer ring of radial ticks that deplete, and a
  // thinner inner solid arc that shrinks in sync.
  const outerR = c - 1;
  const tickLen = size * 0.09;
  const innerTickR = outerR - tickLen;
  const arcStroke = 4;
  const gap = 4;
  const arcR = innerTickR - gap - arcStroke / 2;
  const arcCircumference = 2 * Math.PI * arcR;

  const activeTicks = Math.round(fraction * TICKS);
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    // i = 0 at top (−90°), going clockwise; lit ticks represent remaining time.
    const a = (i / TICKS) * 2 * Math.PI - Math.PI / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return (
      <line
        key={i}
        x1={c + outerR * cos}
        y1={c + outerR * sin}
        x2={c + innerTickR * cos}
        y2={c + innerTickR * sin}
        stroke={i < activeTicks ? progressColor : '#e5e7eb'}
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  });

  const label = timeUtils.formatTime(timeLeft);

  // Fit the text inside the inner arc: the longer the string (HH:MM:SS vs
  // MM:SS), the smaller the font, scaled to the arc size.
  const innerWidth = 2 * arcR - 6;
  // Monospace glyphs are ~0.6em wide; size font so the whole label fits.
  const fittedFontPx = Math.min(size * 0.24, innerWidth / (label.length * 0.6));

  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Time left ${label}`}
      title="Time left"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ticked ring */}
        {ticks}

        {/* Inner arc: faint track + progress */}
        <circle
          cx={c}
          cy={c}
          r={arcR}
          fill="none"
          stroke="#eef0f2"
          strokeWidth={arcStroke}
        />
        <circle
          cx={c}
          cy={c}
          r={arcR}
          fill="none"
          stroke={progressColor}
          strokeWidth={arcStroke}
          strokeLinecap="round"
          strokeDasharray={arcCircumference}
          strokeDashoffset={arcCircumference * (1 - fraction)}
          transform={`rotate(-90 ${c} ${c})`}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-mono font-bold leading-none tracking-tight tabular-nums"
          style={{
            color: progressColor,
            fontSize: `${fittedFontPx}px`,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export default CircularTimer;
