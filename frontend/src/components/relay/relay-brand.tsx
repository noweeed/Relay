import { cn } from "@/lib/utils";

type RelayBrandProps = {
  className?: string;
  size?: "sm" | "md";
};

export function RelayBrand({ className, size = "md" }: RelayBrandProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-foreground", className)}
      aria-label="Relay"
    >
      <img
        src="/icon-64x64.png"
        alt=""
        aria-hidden="true"
        className={cn("shrink-0", size === "sm" ? "size-7" : "size-8")}
      />
      <span
        className={cn(
          "font-brand font-semibold leading-none tracking-tight",
          size === "sm" ? "text-[14px]" : "text-[16px]",
        )}
      >
        Relay
      </span>
    </span>
  );
}
