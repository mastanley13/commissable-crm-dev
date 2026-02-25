"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { navigation } from "@/lib/nav"
import { cn } from "@/lib/utils"

export function MainNav() {
  const pathname = usePathname() || ""
  const searchParams = useSearchParams()

  return (
    <nav className="bg-primary-900 text-white border-b border-blue-900 shadow-sm">
      <div className="px-4 flex items-stretch gap-3">
        <div className="flex flex-1 items-stretch gap-1 overflow-x-auto overflow-y-hidden">
          {navigation.map((item) => {
            const ctx = (searchParams?.get("ctx") || "").toLowerCase()
            const ctxHref = ctx ? `/${ctx}` : null
            const isActive = ctxHref
              ? item.href === ctxHref
              : pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))

            const Icon = item.icon

            return (
              <Link
                key={item.name}
                href={item.href}
                data-nav-active={isActive ? "true" : undefined}
                className={cn(
                  "flex items-center px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded-t-md border-b-2 -mb-[2px] transition-colors",
                  isActive
                    ? "bg-white text-primary-900 border-white"
                    : "border-transparent text-blue-100 hover:text-white hover:border-blue-300 hover:bg-primary-800/80"
                )}
              >
                <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>

        <div className="hidden md:flex flex-shrink-0 items-center py-1">
          <Image
            src="/branding/Commissable_Secondary_Logo_Blue_Background.png"
            alt="Commissable"
            width={160}
            height={28}
            unoptimized
            className="rounded object-contain"
            style={{ width: "auto", height: "28px" }}
          />
        </div>
      </div>
    </nav>
  )
}
