---
name: frontend-ui-engineering
description: Builds production-quality, accessible, responsive user-facing UIs tailored for Mobile PWAs. Use when building or modifying interfaces and pages, creating components, implementing layouts, meeting WCAG accessibility requirements, managing state, or enforcing mobile ergonomics (safe areas, touch targets, touch feedback).
---

# Frontend UI Engineering (Mobile PWA & Next.js 16)

## Overview

Build production-quality Mobile PWA user interfaces that are accessible, performant, and visually polished. The goal is a mobile-first experience that feels native: respecting device safe areas, providing immediate touch feedback, and avoiding common web-on-mobile friction. 

**Stack Context:** Next.js 16 (App Router, Server Components), React 19, and Tailwind CSS v4.

## 1. Mobile PWA Ergonomics (CRITICAL)

To prevent UI drift and ensure the app feels native on iOS/Android, every UI component must adhere to these mobile ergonomics:

### Touch Targets & Hit Areas
- Minimum touch target is **32x32px** (project rule, above WCAG 2.2 AA 2.5.8's 24px; see DESIGN_SYSTEM.md). Larger is fine where the design already has room; never enlarge a compliant control at the cost of a polished layout.
- In Tailwind: `min-h-8 min-w-8` or sufficient padding (e.g., `p-2`).
- For icons alone, add padding so the visual icon is small but the clickable area is large.

### Safe Area Insets (Notches & Home Indicators)
When running as a standalone PWA, the browser chrome disappears. You must pad the top and bottom of the app to avoid content flowing under the iOS notch or the Android gesture bar.
- Top navigation/headers: `pt-[env(safe-area-inset-top)]`
- Bottom navigation/FABs: `pb-[env(safe-area-inset-bottom)]`
- Placed in global layout or fixed layout containers.

### Touch Feedback & Interaction
Hover states don't exist on mobile. Use `active:` states to provide immediate tactile feedback when a user taps.
```tsx
// Good: Provides instant feedback on tap
<button className="bg-primary text-white active:bg-primary/80 transition-colors ...">

// Good: Disable default web tap highlight, use your own
<div className="[WebkitTapHighlightColor:transparent] active:opacity-70 ...">
```

### Gestures & Overscroll
- Prevent pull-to-refresh conflicts in fixed areas (like sidebars or bottom sheets) using `overscroll-behavior-y: none` (`overscroll-none` in Tailwind).
- Use `touch-action: manipulation` on buttons to remove the 300ms tap delay.

### Virtual Keyboard Avoidance
Form inputs should never be hidden by the soft keyboard. 
- The Next.js Viewport export should include `interactive-widget=resizes-content` to ensure the viewport shrinks when the keyboard opens.
- Avoid fixing critical submit buttons strictly to the `bottom-0` if they can be overlaid by the keyboard; prefer scrolling forms.

## 2. Component Architecture (Next.js 16 RSC)

**Server Components by Default:**
Fetch data on the server. Pass serializable data down to leaf components.
```tsx
// src/features/tasks/TaskListPage.tsx (Server Component)
export default async function TaskListPage() {
  const tasks = await getTasks(); // Direct DB or Service call
  return <TaskList tasks={tasks} />;
}
```

**Client Components at the Leaves:**
Use `'use client'` only where interactivity, browser APIs, or React state (`useState`, `useOptimistic`) are required.

## 3. State Management & Mutations

**Do NOT use generic SPA caching (React Query / SWR).** 
Use React 19 features natively integrated with Next.js Server Actions:

```tsx
'use client';
import { useOptimistic, useTransition } from 'react';
import { toggleTaskStatus } from './actions';

export function TaskItem({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticTask, setOptimisticTask] = useOptimistic(
    task,
    (state, newStatus: boolean) => ({ ...state, done: newStatus })
  );

  return (
    <button 
      className={`min-h-8 min-w-8 p-2 flex items-center ${isPending ? 'opacity-50' : ''}`}
      onClick={() => {
        startTransition(async () => {
          setOptimisticTask(!task.done);
          await toggleTaskStatus(task.id);
        });
      }}
    >
      {/* ... */}
    </button>
  );
}
```

## 4. Accessibility (WCAG 2.2 AA)

- **Semantic HTML:** Prefer `<button>` and `<a>` over `<div onClick="...">`. 
- **ARIA Labels:** Interactive elements lacking text must have `aria-label`.
- **Screen Readers:** Test mentally against VoiceOver/TalkBack. Use `sr-only` classes to provide spoken context without visual clutter.
- **Focus Management:** Manage focus in modals and bottom sheets. Trap focus while open, return focus when closed.

## 5. Design System Adherence

### Avoid the "AI Aesthetic"
- **Colors:** Rely purely on Tailwind tokens defined in `src/app/globals.css`. No raw hex codes (`#8B5CF6`) or arbitrary generic purple/indigo default palettes.
- **Shadows:** Avoid excessive layered shadows which drop frame rates on low-end mobile devices. Use subtle borders or flat design tokens.
- **Layout:** Use purpose-driven layouts. Avoid generic card grids for everything. Think mobile-first: stack items vertically by default, expand conditionally for larger viewports (`sm:flex-row`).

## 6. Verification
Before concluding a UI task, verify:
- [ ] Tap targets are >= 32x32px.
- [ ] Safe area insets are respected for fixed elements.
- [ ] Interactive elements have `active:` states.
- [ ] Component is a Server Component unless hooks/browser-APIs force `'use client'`.
- [ ] Data mutation is handled via Server Actions + `useOptimistic` (no React Query).
