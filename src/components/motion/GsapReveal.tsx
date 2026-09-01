"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, registerGsap, ScrollTrigger } from "@/lib/gsap-client";
import { cn } from "@/lib/utils";

interface GsapRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
  once?: boolean;
}

export function GsapReveal({
  children,
  className,
  delay = 0,
  y = 36,
  duration = 0.85,
  once = true,
}: GsapRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerGsap();
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(el, { opacity: 0, y });

    const tween = gsap.to(el, {
      opacity: 1,
      y: 0,
      duration,
      delay,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: once ? "play none none none" : "play reverse play reverse",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay, duration, once, y]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}

interface GsapStaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  selector?: string;
}

export function GsapStagger({
  children,
  className,
  stagger = 0.08,
  selector = ":scope > *",
}: GsapStaggerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerGsap();
    const el = ref.current;
    if (!el) return;

    const items = el.querySelectorAll(selector);
    if (!items.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(items, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(items, { opacity: 0, y: 28 });

    const tween = gsap.to(items, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      stagger,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [selector, stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

interface GsapHeroEntranceProps {
  children: ReactNode;
  className?: string;
}

/** Immediate on-load hero animation (no scroll trigger) */
export function GsapHeroEntrance({ children, className }: GsapHeroEntranceProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerGsap();
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const copy = el.querySelector("[data-hero-copy]");
    const visual = el.querySelector("[data-hero-visual]");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (copy) {
      tl.fromTo(copy, { opacity: 0, x: -32 }, { opacity: 1, x: 0, duration: 0.9 }, 0);
    }
    if (visual) {
      tl.fromTo(visual, { opacity: 0, scale: 0.92, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 1 }, 0.15);
    }

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
