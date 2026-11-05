"use client";

import { Plus, X } from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useEditorViewport } from "@/components/use-editor-viewport";

export function ListCreationDrawer({
  open,
  onOpenChange,
  pending = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  children: ReactNode;
}) {
  return (
    <ListEditorDrawer
      open={open}
      onOpenChange={onOpenChange}
      pending={pending}
      title="Create a list"
      description="Choose a title, then add games to your list."
      trigger={
        <Button className="min-h-11">
          <Plus aria-hidden="true" />
          Create a list
        </Button>
      }
    >
      {children}
    </ListEditorDrawer>
  );
}

/** Shared list editor shell; callers own their fields, persistence, and draft. */
export function ListEditorDrawer({
  open,
  onOpenChange,
  pending = false,
  title,
  description,
  trigger,
  children,
  initialFocus,
  finalFocus,
  onOpenChangeComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  title: string;
  description: string;
  trigger?: ReactElement;
  children: ReactNode;
  initialFocus?: ComponentProps<typeof DrawerContent>["initialFocus"];
  finalFocus?: ComponentProps<typeof DrawerContent>["finalFocus"];
  onOpenChangeComplete?: (open: boolean) => void;
}) {
  useEditorViewport(open);
  return (
    <Drawer
      showSwipeHandle
      open={open}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={(value, event) => {
        if (!value && pending) event.cancel();
        else onOpenChange(value);
      }}
    >
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerContent
        keepMounted
        initialFocus={initialFocus}
        finalFocus={finalFocus}
        className="editor-drawer w-full overflow-hidden rounded-t-3xl bg-background"
      >
        <DrawerHeader className="shrink-0 border-b px-4 py-5 sm:px-6">
          <div className="mx-auto flex w-full max-w-xl items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1 text-left [overflow-wrap:anywhere]">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </div>
            <DrawerClose
              render={
                <Button
                  aria-label="Close"
                  variant="ghost"
                  className="size-11 rounded-full"
                  disabled={pending}
                />
              }
            >
              <X aria-hidden="true" />
            </DrawerClose>
          </div>
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}
