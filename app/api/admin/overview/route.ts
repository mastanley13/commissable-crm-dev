import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions, createApiResponse } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export interface AdminOverviewMetrics {
  userAccess: {
    activeUsers: number
    totalRoles: number
    recentLogins: number
    invitedUsers: number
  }
  crmData: {
    totalAccounts: number
    totalContacts: number
    openOpportunities: number
    activeProducts: number
  }
  revenueFinance: {
    totalRevenueSchedules: number
    unreconciledSchedules: number
    totalDeposits: number
    unmatchedItems: number
  }
  activityTasks: {
    openTickets: number
    highPriorityTickets: number
    overdueActivities: number
    recentAuditActions: number
  }
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ["admin.users.read"],
    async (req) => {
      const tenantId = req.user.tenantId
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const [
        // User & Access metrics
        activeUsers,
        totalRoles,
        recentLogins,
        invitedUsers,
        // CRM Data metrics
        totalAccounts,
        totalContacts,
        openOpportunities,
        activeProducts,
        // Revenue & Finance metrics
        totalRevenueSchedules,
        unreconciledSchedules,
        totalDeposits,
        unmatchedItems,
        // Activity & Tasks metrics
        openTickets,
        highPriorityTickets,
        overdueActivities,
        recentAuditActions
      ] = await Promise.all([
        // User & Access
        prisma.user.count({ where: { tenantId, status: "Active" } }),
        prisma.role.count({ where: { OR: [{ tenantId }, { tenantId: null }] } }),
        prisma.user.count({ where: { tenantId, lastLoginAt: { gte: sevenDaysAgo } } }),
        prisma.user.count({ where: { tenantId, status: "Invited" } }),
        // CRM Data
        prisma.account.count({ where: { tenantId } }),
        prisma.contact.count({ where: { tenantId, deletedAt: null } }),
        prisma.opportunity.count({ where: { tenantId, status: "Open" } }),
        prisma.product.count({ where: { tenantId, isActive: true } }),
        // Revenue & Finance
        prisma.revenueSchedule.count({ where: { tenantId, deletedAt: null } }),
        prisma.revenueSchedule.count({ where: { tenantId, deletedAt: null, status: "Unreconciled" } }),
        prisma.deposit.count({ where: { tenantId } }),
        prisma.depositLineItem.count({ where: { tenantId, status: "Unmatched" } }),
        // Activity & Tasks
        prisma.ticket.count({ where: { tenantId, status: { in: ["Open", "InProgress"] } } }),
        prisma.ticket.count({ where: { tenantId, status: { in: ["Open", "InProgress"] }, priority: { in: ["High", "Urgent"] } } }),
        prisma.activity.count({ where: { tenantId, status: "Open", dueDate: { lt: now } } }),
        prisma.auditLog.count({ where: { tenantId, createdAt: { gte: twentyFourHoursAgo } } })
      ])

      const metrics: AdminOverviewMetrics = {
        userAccess: {
          activeUsers,
          totalRoles,
          recentLogins,
          invitedUsers
        },
        crmData: {
          totalAccounts,
          totalContacts,
          openOpportunities,
          activeProducts
        },
        revenueFinance: {
          totalRevenueSchedules,
          unreconciledSchedules,
          totalDeposits,
          unmatchedItems
        },
        activityTasks: {
          openTickets,
          highPriorityTickets,
          overdueActivities,
          recentAuditActions
        }
      }

      return createApiResponse(metrics)
    }
  )
}
