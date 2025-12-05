/**
 * Security utilities for input validation and sanitization
 */

// HTML entities to escape
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize a string for safe storage and display
 * Removes control characters and trims whitespace
 */
export function sanitizeString(str: string, maxLength = 1000): string {
  if (typeof str !== 'string') return '';

  // Remove control characters (except newlines and tabs)
  let sanitized = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize user input for search queries
 * Removes special regex characters
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') return '';

  // Remove regex special characters
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return email.length >= 5 && email.length <= 254 && emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitize a URL (only allow http/https)
 */
export function sanitizeUrl(url: string): string | null {
  if (!isValidUrl(url)) return null;

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validate username format
 * Only alphanumeric, underscores, and hyphens
 */
export function isValidUsername(username: string): boolean {
  if (typeof username !== 'string') return false;

  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Sanitize a filename
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') return '';

  // Remove path separators and special characters
  return filename
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\.\./g, '')
    .trim()
    .substring(0, 255);
}

/**
 * Rate limiting helper - check if action is allowed
 * Uses localStorage to track actions (client-side only)
 */
export function isRateLimited(
  action: string,
  maxActions: number,
  windowMs: number
): boolean {
  if (typeof window === 'undefined') return false;

  const key = `rate_limit_${action}`;
  const now = Date.now();

  try {
    const stored = localStorage.getItem(key);
    const actions: number[] = stored ? JSON.parse(stored) : [];

    // Filter to actions within the window
    const recentActions = actions.filter((timestamp) => now - timestamp < windowMs);

    if (recentActions.length >= maxActions) {
      return true; // Rate limited
    }

    // Add current action
    recentActions.push(now);
    localStorage.setItem(key, JSON.stringify(recentActions));

    return false;
  } catch {
    return false;
  }
}

/**
 * Generate a secure random string
 */
export function generateSecureId(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Validate and sanitize workout data
 */
export function sanitizeWorkoutData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  // Whitelist of allowed fields
  const allowedFields = [
    'title', 'description', 'notes', 'type', 'duration',
    'rounds', 'reps', 'weight', 'time', 'components',
    'userId', 'gymId', 'groupIds', 'date', 'createdAt',
    'wodTitle', 'wodDescription', 'workoutType', 'scoringType',
    'timeSlots', 'hideDetails', 'recurrenceType', 'createdBy'
  ];

  for (const key of allowedFields) {
    if (key in data) {
      const value = data[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value, 2000);
      } else if (Array.isArray(value)) {
        // Sanitize array items if they're strings
        sanitized[key] = value.map((item) =>
          typeof item === 'string' ? sanitizeString(item, 500) : item
        );
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Check for potentially malicious content
 */
export function containsSuspiciousContent(str: string): boolean {
  if (typeof str !== 'string') return false;

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /expression\s*\(/i,
    /url\s*\(/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(str));
}

/**
 * Deep sanitize an object (removes __proto__ and constructor attacks)
 */
export function deepSanitize<T extends Record<string, unknown>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;

  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    // Skip prototype pollution vectors
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const value = obj[key];

    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? deepSanitize(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object') {
      sanitized[key] = deepSanitize(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Content Security Policy nonce generator
 */
export function generateCspNonce(): string {
  return generateSecureId(24);
}

/**
 * Validate that a string doesn't exceed maximum lengths
 */
export function validateStringLength(
  str: string,
  fieldName: string,
  maxLength: number
): { valid: boolean; error?: string } {
  if (typeof str !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  if (str.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be ${maxLength} characters or less`,
    };
  }

  return { valid: true };
}

/**
 * Validate numeric input is within range
 */
export function validateNumericRange(
  value: number,
  fieldName: string,
  min: number,
  max: number
): { valid: boolean; error?: string } {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  if (value < min || value > max) {
    return {
      valid: false,
      error: `${fieldName} must be between ${min} and ${max}`,
    };
  }

  return { valid: true };
}
