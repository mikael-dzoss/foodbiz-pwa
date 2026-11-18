export interface SkipLinkProps {
  /** Localized label ("Skip to content"). */
  label: string;
  /** Id of the `<main tabIndex={-1}>` it jumps to. */
  targetId?: string;
}

/**
 * First focusable element of a shell: hidden until it takes keyboard focus, then jumps past the
 * navigation to the page's main landmark.
 */
export function SkipLink({ label, targetId = "main-content" }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      data-testid="skip-link"
      className="bg-background text-foreground focus-visible:ring-ring sr-only z-100 rounded-lg text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
    </a>
  );
}
