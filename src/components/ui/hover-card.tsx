"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "cn";
import { useCallback, useRef, useState } from "react";

/**
 * Open state for a hover card used as a disclosure. Base UI's Preview Card ignores touch, so a tap
 * toggles it, as does keyboard activation; a mouse click only opens, or it would close the card that
 * hover just opened. Escape returns focus to the trigger.
 */
function useHoverDisclosure({ openOnFocus = true } = {}) {
  const [open, setOpen] = useState(false);
  const openAtTouch = useRef<boolean>(undefined);
  const pointerType = useRef("");
  const container = useRef<HTMLElement | null>(null);
  // A callback ref so any element type can host the portal without widening its own ref.
  const setContainer = useCallback((node: HTMLElement | null) => {
    container.current = node;
  }, []);
  const trigger = useRef<HTMLButtonElement>(null);
  const rootProps = {
    open,
    onOpenChange: (nextOpen, details) => {
      // Touch browsers can emit mouse-leave after a tap; it must not undo the toggle.
      if (
        (pointerType.current === "touch" &&
          details.reason === "trigger-hover") ||
        (!openOnFocus && details.reason === "trigger-focus")
      ) {
        details.cancel();
        return;
      }
      if (!nextOpen && details.reason === "escape-key")
        trigger.current?.focus();
      setOpen(nextOpen);
    },
  } satisfies PreviewCardPrimitive.Root.Props;
  const triggerProps = {
    delay: 200,
    "aria-expanded": open,
    // A tap also focuses and "hovers" the trigger, which opens the card after `delay`; on a slow
    // device that can land before the click. Toggle from the state at touch-down instead.
    onPointerEnter: (event) => {
      pointerType.current = event.pointerType;
    },
    onPointerDown: (event) => {
      pointerType.current = event.pointerType;
      openAtTouch.current = event.pointerType === "touch" ? open : undefined;
    },
    onClick: (event) => {
      // Keyboard activation reports no click count, and toggles like the disclosure it replaces.
      if (openAtTouch.current !== undefined) setOpen(!openAtTouch.current);
      else setOpen(event.detail === 0 ? !open : true);
      openAtTouch.current = undefined;
    },
  } satisfies PreviewCardPrimitive.Trigger.Props;
  return { open, container, setContainer, trigger, rootProps, triggerProps };
}

function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

function HoverCardContent({
  className,
  container,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 4,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<PreviewCardPrimitive.Portal.Props, "container"> &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PreviewCardPrimitive.Portal
      data-slot="hover-card-portal"
      container={container}
    >
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "popup-transition z-50 w-64 origin-(--transform-origin) rounded-lg border border-transparent bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
            className,
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent, useHoverDisclosure };
