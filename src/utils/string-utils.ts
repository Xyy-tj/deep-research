/**
 * Utility functions for string manipulation
 */

/**
 * Generate a random code of specified length
 * @param length Length of the code to generate
 * @returns Random code
 */
export function generateRandomCode(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

/**
 * Truncate a string to a specified length and add ellipsis if needed
 * @param str String to truncate
 * @param maxLength Maximum length of the string
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number): string {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    
    return str.substring(0, maxLength) + '...';
}

/**
 * Sanitize a string for use in HTML
 * @param str String to sanitize
 * @returns Sanitized string
 */
export function sanitizeHtml(str: string): string {
    if (!str) return '';
    
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Convert a string to title case
 * @param str String to convert
 * @returns Title case string
 */
export function toTitleCase(str: string): string {
    if (!str) return '';
    
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
}

/**
 * Generate a slug from a string
 * @param str String to convert to slug
 * @returns Slug
 */
export function slugify(str: string): string {
    if (!str) return '';
    
    return str
        .toLowerCase()
        .replace(/[^\w ]+/g, '')
        .replace(/ +/g, '-');
}

/**
 * Check if a string is a valid email address
 * @param email Email address to validate
 * @returns True if valid email, false otherwise
 */
export function isValidEmail(email: string): boolean {
    if (!email) return false;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Check if a string is a valid URL
 * @param url URL to validate
 * @returns True if valid URL, false otherwise
 */
export function isValidUrl(url: string): boolean {
    if (!url) return false;
    
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}
