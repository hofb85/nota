import { cn } from "cn"
import { initials } from "@/lib/people"

export function PersonAvatar({
  name,
  color,
  size = "md",
}: {
  name: string
  color: string
  size?: "sm" | "md"
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "size-7 text-[10px]" : "size-10 text-xs",
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
