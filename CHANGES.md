# Responsive Design & Dark Theme Update

This document summarizes the changes made to introduce full responsive design for mobile devices and a neutral dark theme toggle to the ClipYard application.

## Overview

The application previously relied on hardcoded hex colors and rigid desktop-first grid layouts. This update refactors the styling to use CSS custom properties (variables) for theming and CSS media queries for responsive breakpoints, while preserving the existing inline-style architecture where possible.

## Key Features

1. **Dark/Light Theme Toggle**
   - Implemented a `<ThemeProvider>` to manage theme state (`light` or `dark`).
   - Added a `<ThemeToggle>` component (Sun/Moon icon) to the header on both the home and room pages.
   - Theme preference persists in `localStorage` and falls back to the user's system preference (`prefers-color-scheme`).
   - An inline script in `layout.tsx` prevents FOUC (Flash of Unstyled Content) during page load.

2. **Mobile Responsiveness**
   - **Tablet Breakpoint (1024px):** 12-column grids transition to a single-column layout. The room sidebar drops below the editor, and the "How it works" sidebars stack vertically.
   - **Mobile Breakpoint (640px):** Adjusted padding, wrapping headers, and vertical stacking for footers and navigation links to ensure a comfortable fit on small screens.
   - **Textarea:** Replaced fixed 600px height with a responsive height (`min-height: 300px`, `max-height: 80vh`).

## File Modifications

### New Components
- **`components/ThemeProvider.tsx`**: Context provider managing theme state and applying the `light`/`dark` class to the HTML root.
- **`components/ThemeToggle.tsx`**: A purely decorative and interactive toggle button utilizing `lucide-react` icons.

### Refactored Files
- **`app/globals.css`**:
  - Defined comprehensive `--cy-*` CSS custom properties for both `html.light` and `html.dark`.
  - The dark theme uses a clean, neutral dark gray palette (e.g., `#111111`, `#1c1c1c`) with green accents.
  - Added responsive utility classes (e.g., `.cy-room-grid`, `.cy-features-grid`) and smooth transitions for background/color swapping.
- **`app/layout.tsx`**: 
  - Wrapped the application in `<ThemeProvider>`.
  - Added `<meta name="viewport" ...>` for proper mobile scaling.
- **`app/page.tsx` (Home)**: 
  - Replaced hardcoded hex codes with `var(--cy-*)` tokens.
  - Applied the new responsive CSS classes to the grid structures.
- **`app/room/[roomId]/page.tsx` (Room)**: 
  - Updated the `S` style object to consume `var(--cy-*)` variables.
  - Extracted the QR code rendering into a sub-component so it could access the theme context and dynamically change its background to match the dark mode surface.
