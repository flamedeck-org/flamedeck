import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatRelativeDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'Unknown date';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting relative date:", error);
    return 'Invalid date';
  }
}

/**
 * Generates initials from a name string.
 * Tries to take the first letter of the first two words.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return '?';
  
  const firstInitial = words[0][0] || '?';
  const secondInitial = words.length > 1 ? (words[1][0] || '') : '';
  
  return (firstInitial + secondInitial).toUpperCase();
}

/**
 * Formats a duration in milliseconds to a readable string (e.g., "120ms", "1.23s").
 */
export const formatDuration = (ms: number | undefined): string => {
  if (ms === undefined) return "Unknown";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};
