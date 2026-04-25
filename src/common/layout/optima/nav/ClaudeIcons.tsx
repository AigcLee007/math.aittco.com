import * as React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/joy';

/**
 * Claude-style Sidebar Toggle Icon
 */
export function ClaudeToggleIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ fontSize: '1.5rem', ...props.sx }}>
      <path
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm5-1v14M4 6v12M20 6v12M9 4v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="1.5" />
    </SvgIcon>
  );
}

/**
 * Claude-style New Chat (+) Icon
 */
export function ClaudeNewChatIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ fontSize: '1.25rem', ...props.sx }}>
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

/**
 * Claude-style Search Icon
 */
export function ClaudeSearchIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ fontSize: '1.25rem', ...props.sx }}>
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

/**
 * Claude-style Conversation History Icon
 */
export function ClaudeHistoryIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ fontSize: '1.25rem', ...props.sx }}>
      <path
        d="M12 5a7 7 0 1 1-4.95 2.05"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.05 7.05L4.3 7.05V4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.6V12.2L14.9 13.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

/**
 * Claude-style Image Generation Icon (Banana substitute)
 */
export function ClaudeImageIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ fontSize: '1.25rem', ...props.sx }}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path
        d="M21 15l-5-5L5 21"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

/**
 * Claude-style Settings Icon
 */
export function ClaudeSettingsIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ fontSize: '1.25rem', ...props.sx }}>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

/**
 * Claude-style Download/Updates Icon
 */
export function ClaudeDownloadIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} sx={{ fontSize: '1.25rem', ...props.sx }}>
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="6" r="3" fill="#2196f3" />
    </SvgIcon>
  );
}
