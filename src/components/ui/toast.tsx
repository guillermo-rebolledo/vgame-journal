"use client";

import { Toast } from "@base-ui/react/toast";
import { Check, CircleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const toast = Toast.createToastManager();

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => (
    <Toast.Root
      key={item.id}
      toast={item}
      data-slot="toast"
      swipeDirection={[]}
      className="app-toast pointer-events-auto relative w-full shrink-0 rounded-lg border border-transparent bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground data-limited:hidden"
    >
      <Toast.Content className="flex items-start gap-3 p-4">
        {item.type === "error" ? (
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-destructive"
          />
        ) : (
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1 space-y-1 [overflow-wrap:anywhere]">
          <Toast.Title className="font-medium text-sm" />
          <Toast.Description className="text-muted-foreground text-sm" />
          {item.actionProps && (
            <Toast.Action
              render={<Button variant="outline" className="mt-2 min-h-11" />}
            />
          )}
        </div>
        <Toast.Close
          aria-hidden={false}
          aria-label="Dismiss notification"
          render={
            <Button variant="ghost" size="icon" className="size-11 shrink-0" />
          }
        >
          <X aria-hidden="true" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

/** One notification host per app. Errors and actionable toasts use timeout: 0. */
export function Toaster({
  children,
  toastManager = toast,
  ...props
}: Toast.Provider.Props) {
  return (
    <Toast.Provider toastManager={toastManager} timeout={6000} {...props}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-h-[calc(100dvh-2rem)] w-auto max-w-sm flex-col-reverse gap-3 overflow-y-auto overscroll-contain rounded-lg outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
