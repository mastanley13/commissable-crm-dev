/*
  Report what prevents Accounts from being deleted via the UI workflow.

  This mirrors the server-side deletion constraints in `lib/deletion.ts` for Accounts.

  Usage:
    npx tsx scripts/report-account-deletion-blockers.ts
    npx tsx scripts/report-account-deletion-blockers.ts --tenant <TENANT_ID>
    npx tsx scripts/report-account-deletion-blockers.ts --include-archived
*/
import { AccountStatus } from "@prisma/client";
import { getPrisma } from "../lib/db";
import { checkDeletionConstraints } from "../lib/deletion";

type Args = {
  tenant?: string;
  includeArchived?: boolean;
  showHardDeleteDeps?: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "--tenant" || arg === "-t") && i + 1 < args.length) {
      out.tenant = args[i + 1];
      i++;
      continue;
    }

    if (arg === "--include-archived") {
      out.includeArchived = true;
      continue;
    }

    if (arg === "--hard-delete-deps") {
      out.showHardDeleteDeps = true;
      continue;
    }
  }

  return out;
}

function formatAccountLabel(account: {
  accountName: string;
  accountLegalName: string | null;
}) {
  const legal = (account.accountLegalName ?? "").trim();
  const name = (account.accountName ?? "").trim();
  if (legal && legal !== name) return `${name} (${legal})`;
  return name;
}

function formatConstraintKey(constraint: { entity: string; field: string }) {
  return `${constraint.entity}:${constraint.field}`;
}

async function getHardDeleteDependencyCounts(prisma: Awaited<ReturnType<typeof getPrisma>>, tenantId: string, accountId: string) {
  const [
    contactsTotal,
    opportunitiesTotal,
    groupMembersTotal,
    activitiesTotal,
    accountAssignmentsTotal,
    accountNotesTotal,
    reconciliationsTotal,
    ticketsAsAccountTotal,
    ticketsAsDistributorTotal,
    ticketsAsVendorTotal,
    revenueSchedulesAsAccountTotal,
    revenueSchedulesAsDistributorTotal,
    revenueSchedulesAsVendorTotal,
    depositsAsAccountTotal,
    depositsAsDistributorTotal,
    depositsAsVendorTotal,
    depositLineItemsAsAccountTotal,
    depositLineItemsAsVendorTotal,
    productsAsDistributorTotal,
    productsAsVendorTotal,
  ] = await Promise.all([
    prisma.contact.count({ where: { tenantId, accountId } }),
    prisma.opportunity.count({ where: { tenantId, accountId } }),
    prisma.groupMember.count({ where: { tenantId, accountId } }),
    prisma.activity.count({ where: { tenantId, accountId } }),
    prisma.accountAssignment.count({ where: { tenantId, accountId } }),
    prisma.accountNote.count({ where: { tenantId, accountId } }),
    prisma.reconciliation.count({ where: { tenantId, accountId } }),
    prisma.ticket.count({ where: { tenantId, accountId } }),
    prisma.ticket.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.ticket.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.revenueSchedule.count({ where: { tenantId, accountId } }),
    prisma.revenueSchedule.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.revenueSchedule.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.deposit.count({ where: { tenantId, accountId } }),
    prisma.deposit.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.deposit.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.depositLineItem.count({ where: { tenantId, accountId } }),
    prisma.depositLineItem.count({ where: { tenantId, vendorAccountId: accountId } }),
    prisma.product.count({ where: { tenantId, distributorAccountId: accountId } }),
    prisma.product.count({ where: { tenantId, vendorAccountId: accountId } }),
  ]);

  return [
    { label: "Contacts (total)", count: contactsTotal },
    { label: "Opportunities (total)", count: opportunitiesTotal },
    { label: "Group memberships", count: groupMembersTotal },
    { label: "Activities", count: activitiesTotal },
    { label: "Account assignments", count: accountAssignmentsTotal },
    { label: "Account notes", count: accountNotesTotal },
    { label: "Reconciliations", count: reconciliationsTotal },
    { label: "Tickets (account)", count: ticketsAsAccountTotal },
    { label: "Tickets (as distributor)", count: ticketsAsDistributorTotal },
    { label: "Tickets (as vendor)", count: ticketsAsVendorTotal },
    { label: "Revenue schedules (account)", count: revenueSchedulesAsAccountTotal },
    { label: "Revenue schedules (as distributor)", count: revenueSchedulesAsDistributorTotal },
    { label: "Revenue schedules (as vendor)", count: revenueSchedulesAsVendorTotal },
    { label: "Deposits (account)", count: depositsAsAccountTotal },
    { label: "Deposits (as distributor)", count: depositsAsDistributorTotal },
    { label: "Deposits (as vendor)", count: depositsAsVendorTotal },
    { label: "Deposit line items (account)", count: depositLineItemsAsAccountTotal },
    { label: "Deposit line items (as vendor)", count: depositLineItemsAsVendorTotal },
    { label: "Products (as distributor)", count: productsAsDistributorTotal },
    { label: "Products (as vendor)", count: productsAsVendorTotal },
  ].filter((item) => item.count > 0);
}

async function main() {
  const { tenant, includeArchived, showHardDeleteDeps } = parseArgs();
  const prisma = await getPrisma();

  const statuses: AccountStatus[] = includeArchived
    ? [AccountStatus.Inactive, AccountStatus.Archived]
    : [AccountStatus.Inactive];

  const accounts = await prisma.account.findMany({
    where: {
      ...(tenant ? { tenantId: tenant } : {}),
      status: { in: statuses },
    },
    orderBy: [{ tenantId: "asc" }, { accountName: "asc" }],
    select: {
      id: true,
      tenantId: true,
      accountName: true,
      accountLegalName: true,
      status: true,
      owner: { select: { fullName: true } },
      accountType: { select: { name: true } },
    },
  });

  if (accounts.length === 0) {
    console.log(
      `No ${includeArchived ? "inactive/archived" : "inactive"} accounts found` +
        (tenant ? ` for tenant ${tenant}` : ""),
    );
    return;
  }

  const grouped = new Map<string, typeof accounts>();
  for (const account of accounts) {
    const list = grouped.get(account.tenantId);
    if (list) list.push(account);
    else grouped.set(account.tenantId, [account]);
  }

  const totalsByConstraint = new Map<string, { entity: string; field: string; count: number }>();

  for (const [tenantId, rows] of grouped.entries()) {
    console.log(`\nTenant: ${tenantId}  (Accounts: ${rows.length})`);

    for (const account of rows) {
      const constraints = await checkDeletionConstraints("Account", account.id, tenantId);
      const label = formatAccountLabel(account);
      const owner = account.owner?.fullName ?? "Unassigned";
      const type = account.accountType?.name ?? "";

      console.log(
        `- ${label} | Status: ${account.status} | Owner: ${owner}` +
          (type ? ` | Type: ${type}` : ""),
      );

      if (constraints.length === 0) {
        console.log("  OK: No blocking constraints for soft delete.");
      } else {
        for (const constraint of constraints) {
          console.log(`  Blocked: ${constraint.message}`);
          const key = formatConstraintKey(constraint);
          const existing = totalsByConstraint.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            totalsByConstraint.set(key, {
              entity: constraint.entity,
              field: constraint.field,
              count: 1,
            });
          }
        }
      }

      if (showHardDeleteDeps) {
        const deps = await getHardDeleteDependencyCounts(prisma, tenantId, account.id);
        if (deps.length === 0) {
          console.log("  Hard delete: No detected dependent records.");
        } else {
          console.log("  Hard delete: Dependent records exist:");
          for (const dep of deps) {
            console.log(`    - ${dep.label}: ${dep.count}`);
          }
        }
      }
    }
  }

  if (totalsByConstraint.size > 0) {
    console.log("\nSummary (accounts blocked by constraint):");
    Array.from(totalsByConstraint.values())
      .sort((a, b) => b.count - a.count || a.entity.localeCompare(b.entity))
      .forEach((item) => {
        console.log(`- ${item.entity} (${item.field}): ${item.count}`);
      });
  }
}

main()
  .catch((err) => {
    console.error("Failed to report account deletion blockers:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const prisma = await getPrisma();
    await prisma.$disconnect();
  });
