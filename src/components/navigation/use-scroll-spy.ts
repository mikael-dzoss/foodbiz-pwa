"use client";

import { useEffect, useState } from "react";

export interface UseScrollSpyOptions {
  rootMargin?: string;
  threshold?: number | number[];
  getElement?: (id: string) => HTMLElement | null;
}

export interface UseScrollSpyResult {
  activeId: string | null;
  setActiveId: (id: string) => void;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Observes section elements via IntersectionObserver and tracks the currently active section ID.
 */
export function useScrollSpy(
  sectionIds: readonly string[],
  options?: UseScrollSpyOptions,
): UseScrollSpyResult {
  const rootMargin = options?.rootMargin ?? "-112px 0px -60% 0px";
  const threshold = options?.threshold ?? 0;
  const getElement = options?.getElement;

  const [selectedId, setSelectedId] = useState<string | null>(sectionIds[0] ?? null);

  const activeId =
    selectedId && sectionIds.includes(selectedId) ? selectedId : (sectionIds[0] ?? null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || sectionIds.length === 0) {
      return;
    }

    const resolveElement =
      getElement ??
      ((id: string) =>
        document.getElementById(`category-section-${id}`) ?? document.getElementById(id));

    const elementToId = new Map<Element, string>();
    const visibleIds = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = elementToId.get(entry.target);
          if (!id) continue;
          if (entry.isIntersecting) {
            visibleIds.add(id);
          } else {
            visibleIds.delete(id);
          }
        }

        const firstVisible = sectionIds.find((id) => visibleIds.has(id));
        if (firstVisible) {
          setSelectedId(firstVisible);
        }
      },
      { rootMargin, threshold },
    );

    for (const id of sectionIds) {
      const el = resolveElement(id);
      if (el) {
        elementToId.set(el, id);
        observer.observe(el);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [sectionIds, rootMargin, threshold, getElement]);

  return {
    activeId,
    setActiveId: setSelectedId,
  };
}

/**
 * Tracks whether a sentinel element (e.g. first category heading) has scrolled past the sticky header.
 */
export function useScrollPastSentinel(
  enabled = true,
  rootMargin = "-56px 0px 0px 0px",
): { sentinelRef: (node: HTMLElement | null) => void; isPast: boolean } {
  const [sentinelNode, setSentinelNode] = useState<HTMLElement | null>(null);
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    if (!enabled || !sentinelNode || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (!entry.isIntersecting) {
          const top = entry.boundingClientRect?.top;
          if (top === undefined || top <= 56) {
            setIsPast(true);
          }
        } else {
          setIsPast(false);
        }
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(sentinelNode);
    return () => {
      observer.disconnect();
    };
  }, [enabled, sentinelNode, rootMargin]);

  return {
    sentinelRef: setSentinelNode,
    isPast: enabled ? isPast : false,
  };
}
