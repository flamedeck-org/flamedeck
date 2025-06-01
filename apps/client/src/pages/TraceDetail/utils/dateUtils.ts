import { format, formatDistanceToNow, isToday, isYesterday, isThisYear } from 'date-fns';

// Function to format upload date in a readable, concise way
export const formatUploadDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    const now = new Date();

    // If it's today, show relative time
    if (isToday(date)) {
        return formatDistanceToNow(date, { addSuffix: true });
    }

    // If it's yesterday, show "Yesterday"
    if (isYesterday(date)) {
        return 'Yesterday';
    }

    // If it's this year, show month and day
    if (isThisYear(date)) {
        return format(date, 'MMM d');
    }

    // If it's older, show month, day, and year
    return format(date, 'MMM d, yyyy');
};

export const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const dateOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    };
    return `${date.toLocaleDateString(undefined, dateOptions)} ${date.toLocaleTimeString(undefined, timeOptions)}`;
}; 