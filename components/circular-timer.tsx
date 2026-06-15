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

export function CircularTimer({
  timeLeft,
  totalTime,
  size = 84,
}: CircularTimerProps) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeTotal = totalTime > 0 ? totalTime : 1;
  const fraction = Math.max(0, Math.min(1, timeLeft / safeTotal));
  const dashOffset = circumference * (1 - fraction);

  // Color shifts as time runs low so the student notices.
  const isCritical = timeLeft <= 60;
  const isWarning = !isCritical && timeLeft <= 300;
  const progressColor = isCritical
    ? '#dc2626' // red-600
    : isWarning
      ? '#f59e0b' // amber-500
      : '#2E3094'; // brand navy

  const label = timeUtils.formatTime(timeLeft);

  // Fit the text inside the ring: the longer the string (HH:MM:SS vs MM:SS),
  // the smaller the font, scaled to the ring size.
  const innerWidth = size - strokeWidth * 2 - 6;
  // Monospace glyphs are ~0.6em wide; size font so the whole label fits.
  const fittedFontPx = Math.min(
    size * 0.26,
    innerWidth / (label.length * 0.6)
  );

  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Time left ${label}`}
      title="Time left"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
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
