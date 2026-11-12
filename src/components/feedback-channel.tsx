"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Feedback, type SubmitFeedback } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Channel = {
  open: (trigger: HTMLElement) => void;
  saved: () => void;
  invited: boolean;
  pointerInvitation: boolean;
  dismiss: () => void;
};
const Context = createContext<Channel | null>(null);
export const useFeedbackChannel = () => useContext(Context);

/** One editor shared by permanent entries and the optional first-save invitation. */
export function FeedbackChannel({
  username,
  onSubmit,
  children,
}: {
  username?: string | null;
  onSubmit: SubmitFeedback;
  children: ReactNode;
}) {
  const origin = useRef<HTMLElement | null>(null);
  const opener = useRef<(() => void) | null>(null);
  const [invited, setInvited] = useState(false);
  const [pointerInvitation, setPointerInvitation] = useState(false);
  const pointerAction = useRef(false);
  useEffect(() => {
    const pointer = () => {
      pointerAction.current = true;
    };
    const keyboard = () => {
      pointerAction.current = false;
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, []);
  const activeUsername = useRef(username);
  activeUsername.current = username;
  const [previousUsername, setPreviousUsername] = useState(username);
  if (previousUsername !== username) {
    setPreviousUsername(username);
    setInvited(false);
  }
  const channel: Channel = {
    open(trigger) {
      origin.current = trigger;
      opener.current?.();
    },
    saved() {
      if (username && activeUsername.current === username) {
        setPointerInvitation(pointerAction.current);
        setInvited(true);
      }
    },
    invited,
    pointerInvitation,
    dismiss() {
      setInvited(false);
    },
  };
  return (
    <Context value={username ? channel : null}>
      {children}
      <Feedback
        key={username ?? "guest"}
        username={username}
        onSubmit={onSubmit}
        finalFocus={() => origin.current}
        renderTrigger={(open) => {
          opener.current = open;
          return null;
        }}
      />
    </Context>
  );
}

export function FeedbackLink() {
  const channel = useFeedbackChannel();
  if (!channel) return null;
  return (
    <Button
      variant="link"
      className="min-h-11 h-auto whitespace-normal text-muted-foreground"
      onClick={(event) => channel.open(event.currentTarget)}
    >
      Something confusing or missing?
    </Button>
  );
}

export function FirstSaveFeedback() {
  const channel = useFeedbackChannel();
  if (!channel?.invited) return null;
  return (
    <aside
      aria-label="First game feedback"
      className={`${channel.pointerInvitation ? "enter" : ""} flex flex-wrap items-center gap-2 rounded-lg border p-4 text-sm`}
    >
      <p>Your first game is saved.</p>
      <FeedbackLink />
      <Button variant="ghost" className="min-h-11" onClick={channel.dismiss}>
        Dismiss invitation
      </Button>
    </aside>
  );
}

/** Shared Better Auth session store; server actions independently recheck account identity. */
export function FeedbackSessionChannel(
  props: Omit<Parameters<typeof FeedbackChannel>[0], "username">,
) {
  const session = authClient.useSession();
  return <FeedbackChannel username={session.data?.user.username} {...props} />;
}
