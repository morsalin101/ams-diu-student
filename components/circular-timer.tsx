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
  size = 72,
}: CircularTimerProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeTotal = totalTime > 0 ? totalTime : 1;
  const fraction = Math.max(0, Math.min(1, timeLeft / safeTotal));
  const dashOffset = circumference * (1 - fraction);

  // Color shifts as time runs low.
  const isCritical = timeLeft <= 60;
  const isWarning = !isCritical && timeLeft <= 300;
  const progressColor = isCritical
    ? '#dc2626' // red-600
    : isWarning
      ? '#f59e0b' // amber-500
      : '#2E3094'; // brand navy

  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Time left ${timeUtils.formatTime(timeLeft)}`}
      title="Time left"
    >
      <svg width={size} height={size} className="-rotate-90">
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-bold leading-none"
          style={{
            color: progressColor,
            fontSize: size <= 64 ? '0.75rem' : '0.875rem',
          }}
        >
          {timeUtils.formatTime(timeLeft)}
        </span>
      </div>
    </div>
  );
}

export default CircularTimer;
