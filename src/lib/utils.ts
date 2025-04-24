import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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
