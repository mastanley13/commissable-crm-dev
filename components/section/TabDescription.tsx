import { cn } from "@/lib/utils"

interface TabDescriptionProps {
  children: string
  className?: string
}

export function TabDescription({ children, className }: TabDescriptionProps) {
  return (
    <p className={cn("text-[11px] text-gray-500 italic mb-3", className)}>
      {children}
    </p>
  )
}
