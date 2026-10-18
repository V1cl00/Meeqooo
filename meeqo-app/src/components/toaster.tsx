import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={72}
      duration={3500}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "card pointer-events-auto flex w-[min(92vw,28rem)] items-center gap-3 px-4 py-3 text-sm font-semibold text-ink shadow-lg",
        },
      }}
    />
  );
}
