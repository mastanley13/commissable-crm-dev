export const RESOURCE_CATEGORIES = [
  "Getting Started",
  "CRM Basics",
  "Data Import / Admin",
  "Deposit Upload",
  "Reconciliation",
  "Revenue Schedules",
  "Tickets / Support",
  "Troubleshooting"
] as const

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]

export type ResourceAudience = "admin" | "finance" | "operator" | "manager"

export type ResourceArticleStatus = "draft" | "published" | "needs-review"

export interface ResourceRouteLink {
  label: string
  href: string
}

export interface ResourceBodySection {
  heading: string
  paragraphs?: string[]
  steps?: string[]
  callout?: string
}

export interface ResourceArticle {
  slug: string
  title: string
  description: string
  category: ResourceCategory
  tags: string[]
  audience: ResourceAudience[]
  requiredPermissions?: string[]
  relatedRoutes: ResourceRouteLink[]
  relatedArticles: string[]
  updatedAt: string
  owner: string
  status: ResourceArticleStatus
  readTimeMinutes: number
  featured?: boolean
  excerpt: string
  body: ResourceBodySection[]
}

export const resourceArticles: ResourceArticle[] = [
  {
    slug: "getting-started-in-commissable-crm",
    title: "Getting Started in Commissable CRM",
    description: "A quick orientation to the main workspace areas and the records most users touch first.",
    category: "Getting Started",
    tags: ["start here", "navigation", "dashboard", "tickets"],
    audience: ["operator", "manager", "finance", "admin"],
    relatedRoutes: [
      { label: "Open Dashboard", href: "/dashboard" },
      { label: "Open Tickets", href: "/tickets" }
    ],
    relatedArticles: [
      "accounts-contacts-opportunities-products",
      "tickets-create-support-requests",
      "troubleshooting-import-reconciliation-blockers"
    ],
    updatedAt: "2026-04-20",
    owner: "Product Operations",
    status: "published",
    readTimeMinutes: 4,
    featured: true,
    excerpt:
      "Commissable is organized around customer records, revenue schedules, reconciliation, and support tickets. Start with Dashboard for orientation, then use the sidebar to move into daily work.",
    body: [
      {
        heading: "What to use first",
        paragraphs: [
          "The dashboard is the safest starting point for daily work. It gives you a neutral place to reorient before opening customer, revenue, reconciliation, or support workflows.",
          "Most operational work starts in Accounts, Contacts, Opportunities, Revenue Schedules, Reconciliation, or Tickets. Admin users also use Data Settings when importing or maintaining master data."
        ]
      },
      {
        heading: "How records connect",
        steps: [
          "Use Accounts and Contacts to confirm the customer and people involved.",
          "Use Opportunities and Products to understand what was sold.",
          "Use Revenue Schedules to track expected commission timing and amounts.",
          "Use Reconciliation to compare deposit lines against revenue schedules.",
          "Use Tickets when a blocker needs follow-up, documentation, or handoff."
        ]
      },
      {
        heading: "Good daily habits",
        paragraphs: [
          "Before changing records, confirm that you are in the correct module and that the record name, vendor, distributor, and dates match the task you are handling.",
          "When a workflow is blocked, write the specific record, expected result, actual result, and any import or reconciliation file details into a ticket."
        ],
        callout: "If you are not sure which module owns a problem, start with Tickets and include the record names you already know."
      }
    ]
  },
  {
    slug: "accounts-contacts-opportunities-products",
    title: "Accounts, Contacts, Opportunities, and Products: How They Relate",
    description: "Understand the basic CRM object model before editing customer or sales records.",
    category: "CRM Basics",
    tags: ["accounts", "contacts", "opportunities", "products", "relationships"],
    audience: ["operator", "manager", "admin"],
    relatedRoutes: [
      { label: "Open Accounts", href: "/accounts" },
      { label: "Open Contacts", href: "/contacts" },
      { label: "Open Opportunities", href: "/opportunities" },
      { label: "Open Catalog", href: "/products" }
    ],
    relatedArticles: [
      "getting-started-in-commissable-crm",
      "creating-editing-revenue-schedules",
      "tickets-create-support-requests"
    ],
    updatedAt: "2026-04-20",
    owner: "Product Operations",
    status: "published",
    readTimeMinutes: 5,
    excerpt:
      "Accounts represent organizations, Contacts represent people, Opportunities represent sales work, and Products describe what was sold or commissioned.",
    body: [
      {
        heading: "Core relationship",
        paragraphs: [
          "An Account is the organization or customer. Contacts are people connected to an account or opportunity. Opportunities describe a sale or deal. Products describe the services or items associated with the opportunity.",
          "Revenue Schedules usually depend on this upstream information. If account, opportunity, or product details are wrong, reconciliation can become harder later."
        ]
      },
      {
        heading: "Before editing records",
        steps: [
          "Confirm you are looking at the right customer or opportunity.",
          "Check vendor and distributor details when they are present.",
          "Avoid creating duplicates if an existing record can be corrected.",
          "Use related tabs and supporting details to verify connected records before making changes."
        ]
      },
      {
        heading: "When to create a ticket",
        paragraphs: [
          "Create a ticket when you find duplicate records, missing relationships, unclear ownership, or conflicting customer details that should not be corrected without review."
        ]
      }
    ]
  },
  {
    slug: "creating-editing-revenue-schedules",
    title: "Creating and Editing Revenue Schedules",
    description: "Review the schedule fields that matter most before creating or changing expected commission records.",
    category: "Revenue Schedules",
    tags: ["revenue schedules", "commission", "start date", "rate", "split"],
    audience: ["finance", "operator", "manager"],
    relatedRoutes: [
      { label: "Open Revenue Schedules", href: "/revenue-schedules" },
      { label: "Open Opportunities", href: "/opportunities" }
    ],
    relatedArticles: [
      "accounts-contacts-opportunities-products",
      "reconciliation-matching-deposit-lines",
      "reconciliation-variances-flex-chargebacks"
    ],
    updatedAt: "2026-04-20",
    owner: "Finance Operations",
    status: "published",
    readTimeMinutes: 6,
    featured: true,
    excerpt:
      "Revenue schedules define expected commission behavior. Confirm schedule dates, rates, splits, vendor details, and opportunity relationships before changing them.",
    body: [
      {
        heading: "What a revenue schedule does",
        paragraphs: [
          "A revenue schedule represents expected commission activity for a product or opportunity over time. Reconciliation uses schedules as the expected side of the match against real deposit lines.",
          "Small differences in schedule dates, rates, split ownership, or vendor metadata can affect whether a deposit line matches automatically."
        ]
      },
      {
        heading: "Fields to verify",
        steps: [
          "Confirm the schedule belongs to the correct opportunity and product.",
          "Review the start date, billing status, expected amount, commission rate, and split.",
          "Check vendor, distributor, customer, and order identifiers when they exist.",
          "Look for existing deposit matches before making changes that affect history."
        ]
      },
      {
        heading: "Editing guidance",
        paragraphs: [
          "Use bulk actions only when every selected schedule should receive the same change. For a single exception, open the schedule detail page and update the record directly.",
          "If a schedule has already participated in reconciliation, include the reason for the change in your notes or ticket so the finance trail remains clear."
        ]
      }
    ]
  },
  {
    slug: "importing-admin-data-settings-records",
    title: "Importing Admin/Data Settings Records",
    description: "Prepare account, contact, opportunity, product, and schedule imports with fewer validation failures.",
    category: "Data Import / Admin",
    tags: ["admin", "data settings", "imports", "csv", "xlsx", "validation"],
    audience: ["admin", "operator"],
    requiredPermissions: ["admin.data-settings.read"],
    relatedRoutes: [
      { label: "Open Data Settings", href: "/admin/data-settings" },
      { label: "Open Templates", href: "/admin/data-settings/templates" }
    ],
    relatedArticles: [
      "deposit-upload-preparing-mapping-files",
      "troubleshooting-import-reconciliation-blockers",
      "accounts-contacts-opportunities-products"
    ],
    updatedAt: "2026-04-20",
    owner: "Data Operations",
    status: "published",
    readTimeMinutes: 6,
    featured: true,
    excerpt:
      "Admin imports work best when the workbook structure, required identifiers, and reference values are verified before upload.",
    body: [
      {
        heading: "Before you upload",
        steps: [
          "Use the approved template for the entity you are importing.",
          "Confirm required columns are present and headers have not been renamed unexpectedly.",
          "Check that reference values such as owners, statuses, product families, and revenue types already exist or are included in the import sequence.",
          "Remove test rows, blank rows, formulas that do not resolve to values, and duplicate records unless duplicate handling is intentional."
        ]
      },
      {
        heading: "Import order",
        paragraphs: [
          "Import foundational records before records that depend on them. Accounts and owners usually come before contacts, opportunities, products, opportunity line items, and revenue schedules.",
          "When an import fails, fix the source file and retry the smallest reasonable batch instead of repeatedly uploading a large workbook with unknown issues."
        ]
      },
      {
        heading: "Common blockers",
        paragraphs: [
          "Most import failures come from missing required values, unrecognized picklist values, duplicate identifiers, dates in an unexpected format, or relationships that point to records that do not exist yet."
        ]
      }
    ]
  },
  {
    slug: "deposit-upload-preparing-mapping-files",
    title: "Deposit Upload: Preparing and Mapping Files",
    description: "Prepare commission deposit files and map vendor columns into the fields reconciliation expects.",
    category: "Deposit Upload",
    tags: ["deposit upload", "mapping", "vendor files", "csv", "xlsx"],
    audience: ["finance", "operator"],
    relatedRoutes: [
      { label: "Open Reconciliation", href: "/reconciliation" },
      { label: "Open Deposit Uploads", href: "/reconciliation/deposit-upload-list" }
    ],
    relatedArticles: [
      "reconciliation-matching-deposit-lines",
      "troubleshooting-import-reconciliation-blockers",
      "importing-admin-data-settings-records"
    ],
    updatedAt: "2026-04-20",
    owner: "Finance Operations",
    status: "published",
    readTimeMinutes: 6,
    featured: true,
    excerpt:
      "Deposit upload starts with a clean vendor file and a clear column mapping for amount, customer, product, order, period, vendor, and distributor fields.",
    body: [
      {
        heading: "File preparation",
        steps: [
          "Start from the original vendor deposit report when possible.",
          "Keep one header row and remove summary-only rows that are not real commission lines.",
          "Confirm currency amounts, period dates, customer identifiers, product names, and order identifiers are visible in the file.",
          "Save a working copy before editing so the original report remains available for audit."
        ]
      },
      {
        heading: "Mapping guidance",
        paragraphs: [
          "Map vendor columns to the closest Commissable fields. The most important fields for matching are usually commission amount, customer or account identifier, product, vendor, distributor, order ID, and commission period.",
          "If a vendor file changes format, review the mapping before importing. A previously working template may not be correct for a new layout."
        ]
      },
      {
        heading: "After upload",
        paragraphs: [
          "Review the imported deposit lines before applying matches. If many rows look wrong, stop and fix the mapping or source file before continuing."
        ]
      }
    ]
  },
  {
    slug: "reconciliation-matching-deposit-lines",
    title: "Reconciliation: Matching Deposit Lines to Revenue Schedules",
    description: "Use suggested matches and manual review to connect real deposits with expected revenue schedules.",
    category: "Reconciliation",
    tags: ["reconciliation", "matching", "deposit lines", "suggested matches", "revenue schedules"],
    audience: ["finance", "operator", "manager"],
    relatedRoutes: [
      { label: "Open Reconciliation", href: "/reconciliation" },
      { label: "Open Revenue Schedules", href: "/revenue-schedules" }
    ],
    relatedArticles: [
      "deposit-upload-preparing-mapping-files",
      "reconciliation-variances-flex-chargebacks",
      "finalizing-reopening-deposits"
    ],
    updatedAt: "2026-04-20",
    owner: "Finance Operations",
    status: "published",
    readTimeMinutes: 7,
    featured: true,
    excerpt:
      "Matching compares deposit line facts against expected schedules. Review candidate confidence, metadata, amount, period, and customer context before applying a match.",
    body: [
      {
        heading: "Recommended match review",
        steps: [
          "Open the deposit and review unmatched or suggested lines first.",
          "Compare customer, product, order ID, vendor, distributor, period, and amount against the suggested schedule.",
          "Use the highest-confidence suggestion only when the supporting details are coherent.",
          "For one-to-many or many-to-one situations, verify every allocation before applying the match."
        ]
      },
      {
        heading: "When not to match",
        paragraphs: [
          "Do not apply a match when the customer, product, period, or amount conflict in a way you cannot explain. Leave the line unmatched, add notes if available, and create a ticket if the issue needs another person to resolve."
        ]
      },
      {
        heading: "After applying matches",
        paragraphs: [
          "Review the deposit summary and remaining unmatched lines. If a match was applied incorrectly, use the available undo or unmatch workflow before finalizing the deposit."
        ]
      }
    ]
  },
  {
    slug: "reconciliation-variances-flex-chargebacks",
    title: "Reconciliation: Handling Variances, Flex, and Chargebacks",
    description: "Choose the right path when actual deposits differ from expected schedules.",
    category: "Reconciliation",
    tags: ["variance", "flex", "chargeback", "overage", "underage", "rate discrepancy"],
    audience: ["finance", "operator", "manager"],
    relatedRoutes: [
      { label: "Open Reconciliation", href: "/reconciliation" },
      { label: "Open Flex Review", href: "/reconciliation/flex-review" },
      { label: "Open Low Rate Exceptions", href: "/reconciliation/low-rate-exceptions" }
    ],
    relatedArticles: [
      "reconciliation-matching-deposit-lines",
      "creating-editing-revenue-schedules",
      "finalizing-reopening-deposits"
    ],
    updatedAt: "2026-04-20",
    owner: "Finance Operations",
    status: "published",
    readTimeMinutes: 7,
    excerpt:
      "Variance handling depends on the cause. Rate changes, usage differences, partial payments, overages, underages, and chargebacks should be reviewed before adjustment.",
    body: [
      {
        heading: "Start with the cause",
        paragraphs: [
          "A variance is not automatically an error. It may represent usage, timing, rate changes, partial payment, overpayment, or a chargeback. Identify the cause before applying a correction.",
          "Flex workflows are intended for cases where expected schedule behavior needs review or adjustment rather than a simple direct match."
        ]
      },
      {
        heading: "Review checklist",
        steps: [
          "Compare actual amount, expected amount, rate, commission period, and schedule status.",
          "Check whether the vendor paid for a different period or bundled multiple expectations into one line.",
          "Use flex or rate discrepancy actions when the schedule should change going forward.",
          "Use chargeback handling when the deposit line is reversing or reducing prior commission."
        ]
      },
      {
        heading: "Escalate when unclear",
        paragraphs: [
          "Create a ticket when the variance reason cannot be determined from the deposit line, schedule, and supporting details. Include the deposit, line, schedule, amount, and what you expected to happen."
        ]
      }
    ]
  },
  {
    slug: "finalizing-reopening-deposits",
    title: "Finalizing and Reopening Deposits",
    description: "Know what to review before locking a reconciliation deposit and when to reopen it.",
    category: "Reconciliation",
    tags: ["finalize", "reopen", "deposit", "audit", "undo"],
    audience: ["finance", "manager", "operator"],
    relatedRoutes: [
      { label: "Open Reconciliation", href: "/reconciliation" },
      { label: "Open Deposit Uploads", href: "/reconciliation/deposit-upload-list" }
    ],
    relatedArticles: [
      "reconciliation-matching-deposit-lines",
      "reconciliation-variances-flex-chargebacks",
      "tickets-create-support-requests"
    ],
    updatedAt: "2026-04-20",
    owner: "Finance Operations",
    status: "published",
    readTimeMinutes: 5,
    excerpt:
      "Finalization should happen after match quality, unmatched lines, variances, and audit notes have been reviewed.",
    body: [
      {
        heading: "Before finalizing",
        steps: [
          "Review deposit totals and remaining unmatched lines.",
          "Confirm high-impact variances have been resolved or documented.",
          "Check that one-to-many and many-to-one allocations are intentional.",
          "Create tickets for unresolved blockers that should remain visible after finalization."
        ]
      },
      {
        heading: "When to reopen",
        paragraphs: [
          "Reopen a deposit only when a material issue needs correction, such as an incorrect match, missing vendor line, wrong mapping, duplicate import, or adjustment that should not stand.",
          "When reopening, document what changed and why. The goal is to preserve a clear audit trail, not simply make the screen look clean."
        ]
      }
    ]
  },
  {
    slug: "tickets-create-support-requests",
    title: "Tickets: When and How to Create Support Requests",
    description: "Create actionable support tickets that include enough context for fast triage.",
    category: "Tickets / Support",
    tags: ["tickets", "support", "triage", "blockers", "requests"],
    audience: ["operator", "manager", "finance", "admin"],
    relatedRoutes: [
      { label: "Open Tickets", href: "/tickets" },
      { label: "Open Revenue Schedules", href: "/revenue-schedules" }
    ],
    relatedArticles: [
      "getting-started-in-commissable-crm",
      "troubleshooting-import-reconciliation-blockers",
      "finalizing-reopening-deposits"
    ],
    updatedAt: "2026-04-20",
    owner: "Support Operations",
    status: "published",
    readTimeMinutes: 4,
    excerpt:
      "A good ticket states the record, the expected result, the actual result, and the business impact.",
    body: [
      {
        heading: "Create a ticket when",
        steps: [
          "A record appears wrong but you are not authorized to change it.",
          "An import or reconciliation workflow is blocked.",
          "A variance, duplicate, or missing relationship needs review.",
          "You need another team member to confirm a vendor, customer, or schedule decision."
        ]
      },
      {
        heading: "What to include",
        paragraphs: [
          "Include the account, opportunity, product, revenue schedule, deposit, or line identifiers involved. Add the expected result, actual result, steps taken, and any relevant file name or vendor report period.",
          "Use clear issue titles. A title like \"Telarus September deposit line does not match RS-1042\" is more useful than \"reconciliation issue\"."
        ]
      }
    ]
  },
  {
    slug: "troubleshooting-import-reconciliation-blockers",
    title: "Troubleshooting Common Import and Reconciliation Blockers",
    description: "Work through the most common causes of failed imports, missing matches, and confusing variances.",
    category: "Troubleshooting",
    tags: ["troubleshooting", "import errors", "missing matches", "validation", "blockers"],
    audience: ["admin", "finance", "operator", "manager"],
    relatedRoutes: [
      { label: "Open Data Settings", href: "/admin/data-settings" },
      { label: "Open Reconciliation", href: "/reconciliation" },
      { label: "Open Tickets", href: "/tickets" }
    ],
    relatedArticles: [
      "importing-admin-data-settings-records",
      "deposit-upload-preparing-mapping-files",
      "reconciliation-matching-deposit-lines"
    ],
    updatedAt: "2026-04-20",
    owner: "Support Operations",
    status: "published",
    readTimeMinutes: 6,
    featured: true,
    excerpt:
      "Most blockers come from missing required data, unexpected file structure, duplicate identifiers, relationship gaps, or schedule metadata that does not line up with the deposit.",
    body: [
      {
        heading: "Import blockers",
        steps: [
          "Check the file has one header row and the expected template columns.",
          "Look for blank required fields, invalid dates, and unsupported picklist values.",
          "Confirm referenced records already exist or are included in the import sequence.",
          "Retry with a smaller batch if you need to isolate the failing row."
        ]
      },
      {
        heading: "Reconciliation blockers",
        steps: [
          "Compare deposit line customer, product, order ID, vendor, distributor, period, and amount against candidate schedules.",
          "Check whether the schedule is inactive, starts in a different period, or has already been matched.",
          "Look for bundled payments, partial payments, chargebacks, and rate differences before assuming the match engine failed."
        ]
      },
      {
        heading: "When to stop and escalate",
        paragraphs: [
          "Stop and create a ticket when repeated retries produce the same error, when a file appears structurally wrong, or when the business decision behind a variance is unclear."
        ]
      }
    ]
  }
]

export function getPublishedResourceArticles(): ResourceArticle[] {
  return resourceArticles.filter((article) => article.status === "published")
}

export function getResourceArticle(slug: string): ResourceArticle | undefined {
  return resourceArticles.find((article) => article.slug === slug && article.status === "published")
}

export function getRelatedResourceArticles(article: ResourceArticle): ResourceArticle[] {
  const relatedSlugs = new Set(article.relatedArticles)
  return getPublishedResourceArticles().filter((candidate) => relatedSlugs.has(candidate.slug))
}
