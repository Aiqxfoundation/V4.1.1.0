import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format hashpower with appropriate unit (KH/s, MH/s, GH/s, TH/s, PH/s, EH/s, ZH/s)
// Accepts server hashPower values where 0.1 = 100 KH/s
export function formatHashPower(serverHashPower: number): string {
  if (serverHashPower === 0) return '0 KH/s';
  
  // Convert server hashPower to KH/s (server stores 0.1 as 100 KH/s)
  const khPerSecond = serverHashPower * 1000;
  
  // Convert to different units
  const mhPerSecond = khPerSecond / 1000; // 1 MH/s = 1,000 KH/s
  const ghPerSecond = khPerSecond / 1000000; // 1 GH/s = 1,000,000 KH/s
  const thPerSecond = khPerSecond / 1000000000; // 1 TH/s = 1,000,000,000 KH/s
  const phPerSecond = khPerSecond / 1000000000000; // 1 PH/s = 1,000,000,000,000 KH/s
  const ehPerSecond = khPerSecond / 1000000000000000; // 1 EH/s = 1,000,000,000,000,000 KH/s
  const zhPerSecond = khPerSecond / 1000000000000000000; // 1 ZH/s = 1,000,000,000,000,000,000 KH/s
  
  // Choose the appropriate unit based on the value
  if (zhPerSecond >= 1) {
    return `${zhPerSecond.toFixed(2)} ZH/s`;
  } else if (ehPerSecond >= 1) {
    return `${ehPerSecond.toFixed(2)} EH/s`;
  } else if (phPerSecond >= 1) {
    return `${phPerSecond.toFixed(2)} PH/s`;
  } else if (thPerSecond >= 1) {
    return `${thPerSecond.toFixed(2)} TH/s`;
  } else if (ghPerSecond >= 1) {
    return `${ghPerSecond.toFixed(2)} GH/s`;
  } else if (mhPerSecond >= 1) {
    return `${mhPerSecond.toFixed(2)} MH/s`;
  } else {
    return `${khPerSecond.toFixed(2)} KH/s`;
  }
}
