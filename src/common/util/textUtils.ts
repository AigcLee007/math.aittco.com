export function capitalizeFirstLetter(string: string) {
  return string?.length ? (string.charAt(0).toUpperCase() + string.slice(1)) : string;
}

/**
 * Capitalizes model labels robustly.
 * 1. Strips extraneous suffixes like '-preview' or ' (Preview)'
 * 2. Replaces spaces, slashes, and colons with hyphens
 * 3. Enforces hyphens for dots ONLY in Claude models (Claude 4.6 -> Claude-4-6)
 * 4. Preserves dots for other models (Gemini 3.1 -> Gemini-3.1)
 */
export function modelLabelTitleCase(label: string): string {
  if (!label) return label;

  // 1. Remove preview suffixes (case-insensitive)
  let cleaned = label.replace(/[ ]*([-.( ]*preview[)]*)/gi, '');

  // 2. Special case for Claude: convert dots to hyphens
  if (cleaned.toLowerCase().includes('claude')) {
    cleaned = cleaned.replace(/\./g, '-');
  }

  // 3. Replace spaces, slashes, and colons with hyphens
  const parts = cleaned.split(/[- /:]+/);
  return parts
    .filter(part => !!part)
    .map(part => {
      // Capitalize each dot-separated segment if dots were preserved
      if (part.includes('.')) {
        return part.split('.').map(sub => capitalizeFirstLetter(sub.toLowerCase())).join('.');
      }
      return capitalizeFirstLetter(part.toLowerCase());
    })
    .join('-');
}


export function countWords(text: string) {
  const trimmedText = text.trim();
  if (!trimmedText) return 0;
  return trimmedText.split(/\s+/).length;
}

export function countLines(text?: string) {
  if (!text) return 0;
  return text.split('\n').length;
}

/**
 * Convert a string (e.g., a web URL or file name) to a human-readable hyphenated format.
 * This function:
 * - Optionally removes URL schemas (http://, https://, ftp://, etc.)
 * - Handles query parameters by replacing '=' with '-' and '&' with '--'
 * - Replaces non-alphanumeric characters with hyphens
 * - Removes redundant hyphens
 * - Trims leading and trailing hyphens
 * - Converts the result to lowercase
 */
export function humanReadableHyphenated(text: string, removeSchema: boolean = false): string {
  // Trim the input and optionally remove URL schema
  let processed = text.trim();
  if (removeSchema)
    processed = processed.replace(/^(https?|file):\/\//, '');

  // Handle query parameters
  processed = processed.replace(/\?/g, '-')  // Replace '?' with '-'
    .replace(/=/g, '-')   // Replace '=' with '-'
    .replace(/&/g, '--'); // Replace '&' with '--'

  return processed
    .replace(/[^a-zA-Z0-9]+/g, '-') // Replace non-alphanumeric characters (including spaces) with hyphens
    .replace(/-{2,}/g, '-') // Remove redundant hyphens
    .replace(/^-+|-+$/g, '') // Remove leading and trailing hyphens
    .toLowerCase();
}

export function humanReadableBytes(bytes: number): string {
  if (bytes < 0) return 'N/A';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ellipsizeFront(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  return '…' + text.slice(-(maxLength - 1));
}

export function ellipsizeMiddle(text: string, maxLength: number, ellipsis: string = '…'): string {
  if (text.length <= maxLength)
    return text;
  if (maxLength <= ellipsis.length)
    return ellipsis.slice(0, maxLength);

  const sideLength = (maxLength - ellipsis.length) / 2;
  const frontLength = Math.ceil(sideLength);
  const backLength = Math.floor(sideLength);

  return text.slice(0, frontLength) + ellipsis + text.slice(-backLength);
}

export function ellipsizeEnd(text: string, maxLength: number, maxLines?: number) {
  let wasTruncated = false;

  // Handle maxLines if specified
  if (maxLines !== undefined && maxLines > 0) {
    const lines = text.split('\n');
    if (lines.length > maxLines) {
      text = lines.slice(0, maxLines).join('\n');
      wasTruncated = true;
    }
  }

  // Check if text exceeds maxLength and truncate if necessary
  if (text.length > maxLength) {
    text = text.slice(0, maxLength - 1) + '…';
    // wasTruncated = true; // not useful here
  } else if (wasTruncated) {
    // If text was truncated by lines but not by length, add ellipsis if possible
    if (text.length + 1 <= maxLength) {
      text += '…';
    } else if (maxLength > 0) {
      // Truncate one character to add ellipsis without exceeding maxLength
      text = text.slice(0, maxLength - 1) + '…';
    }
  }

  return text;
}


export function textEscapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


export function textIsSingleEmoji(text: string): boolean {
  if (!Intl.Segmenter)
    throw new Error('Intl.Segmenter is not supported');

  // create segmenter instance with default locale
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const segments = Array.from(segmenter.segment(text));
  return segments.length === 1;
}


/**
 * Simple hash generation for a string - used in the Frontend! For backend see `sdbmHash` in `backend.router.ts`.
 */
export function frontendHashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'h-' + hash.toString(16);
}
