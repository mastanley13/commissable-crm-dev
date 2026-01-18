'use client'

import Link from 'next/link'
import { Beaker } from 'lucide-react'

const prototypePages = [
  {
    title: 'Revenue Schedule Fill-Down Test',
    description:
      'Prototype for the DynamicTable in-cell bulk \"Apply to N selected\" workflow used in revenue schedules.',
    href: '/revenue-schedules/fill-down-test',
    tag: 'Revenue Schedules'
  },
  {
    title: 'Comma-Separated Values (Other Fields)',
    description:
      'Detail-style prototype to add/remove multi-values and preview how they render as comma-separated strings.',
    href: '/admin/prototypes/comma-separated-values',
    tag: 'Matching'
  }
]

export default function PrototypePlaygroundPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-6">
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
            <Beaker className="mr-2 h-4 w-4" />
            Prototype Playground
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Prototype Playground</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Explore in-progress experiments and UX prototypes before they are fully wired into production workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {prototypePages.map(page => (
            <Link key={page.href} href={page.href}>
              <div className="group flex h-full cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg">
                <div className="flex items-center justify-between">
                  {page.tag && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {page.tag}
                    </span>
                  )}
                  <Beaker className="h-5 w-5 text-blue-500" />
                </div>
                <h2 className="mt-3 text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
                  {page.title}
                </h2>
                <p className="mt-2 flex-1 text-sm text-gray-600">
                  {page.description}
                </p>
                <span className="mt-4 text-sm font-semibold text-primary-600 group-hover:underline">
                  Open prototype
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

