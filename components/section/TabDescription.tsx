import { cn } from "@/lib/utils"

interface TabDescriptionProps {
  children: string
  className?: string
}

export function TabDescription({ children, className }: TabDescriptionProps) {
  return (
    <p className={cn("text-[11px] text-gray-500 italic mb-1.5 mt-1.5 align-middle", className)}>
      {children}
    </p>
  )
}
