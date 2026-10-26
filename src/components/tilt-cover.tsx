"use client";

import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { type ReactNode, useState } from "react";

/** Wrap a cover inside its link; keyboard navigation keeps the cover still. */
export function TiltCover({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const spring = { stiffness: 260, damping: 24 };
  const rotateX = useSpring(0, spring);
  const rotateY = useSpring(0, spring);
  const glareX = useSpring(50, spring);
  const glareY = useSpring(50, spring);
  const glare = useSpring(0, spring);
  const background = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgb(255 255 255 / 0.4), transparent 70%)`;

  function reset() {
    setPressed(false);
    rotateX.set(0);
    rotateY.set(0);
    glare.set(0);
  }

  return (
    <motion.span
      data-tilt-cover
      data-pressed={pressed}
      className="tilt-cover relative block shrink-0 rounded"
      style={reduced ? undefined : { rotateX, rotateY }}
      onPointerDown={(event) => {
        if (
          !reduced &&
          (event.pointerType === "touch" ||
            window.matchMedia("(pointer: coarse)").matches)
        ) {
          rotateX.jump(0);
          rotateY.jump(0);
          glare.jump(0);
          event.currentTarget.setPointerCapture(event.pointerId);
          setPressed(true);
        }
      }}
      onPointerUp={reset}
      onLostPointerCapture={reset}
      onPointerMove={(event) => {
        if (
          reduced ||
          event.pointerType === "touch" ||
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(1, (event.clientX - bounds.left) / bounds.width),
        );
        const y = Math.max(
          0,
          Math.min(1, (event.clientY - bounds.top) / bounds.height),
        );
        rotateX.set((0.5 - y) * 16);
        rotateY.set((x - 0.5) * 16);
        glareX.set(x * 100);
        glareY.set(y * 100);
        glare.set(1);
      }}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onBlur={reset}
    >
      {children}
      <motion.span
        data-cover-glare
        aria-hidden
        className="cover-glare pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background, opacity: reduced ? 0 : glare }}
      />
    </motion.span>
  );
}
