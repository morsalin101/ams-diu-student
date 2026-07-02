'use client';

import { useEffect } from 'react';

// Blocks the right-click context menu across the student app so examinees
// can't use it to tinker (inspect, save, browser settings, etc.).
export function DisableContextMenu() {
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, []);

  return null;
}
