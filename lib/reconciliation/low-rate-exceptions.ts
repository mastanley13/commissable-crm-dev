import type { Prisma, PrismaClient, TicketPriority, TicketSeverity, TicketStatus } from "@prisma/client"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

export const LOW_RATE_EXCEPTION_ISSUE = "Low-rate commission exception"
export const LOW_RATE_EXCEPTION_QUEUE_PATH = "/reconciliation/low-rate-exceptions"
export const LOW_RATE_EXCEPTION_BILLING_REASON = "LowRateException"

const OPEN_TICKET_STATUSES = ["Open", "InProgress", "Waiting"] as TicketStatus[]

export async function findOpenLowRateExceptionTicket(
  tx: PrismaClientOrTx,
  {
    tenantId,
    revenueScheduleId,
  }: {
    tenantId: string
    revenueScheduleId: string
  },
) {
  return tx.ticket.findFirst({
    where: {
      tenantId,
      revenueScheduleId,
      issue: LOW_RATE_EXCEPTION_ISSUE,
      status: { in: OPEN_TICKET_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      priority: true,
      severity: true,
      createdAt: true,
    },
  })
}

export async function getLowRateExceptionState(
  tx: PrismaClientOrTx,
  {
    tenantId,
    revenueScheduleId,
  }: {
    tenantId: string
    revenueScheduleId: string
  },
) {
  const [schedule, ticket] = await Promise.all([
    tx.revenueSchedule.findFirst({
      where: { tenantId, id: revenueScheduleId, deletedAt: null },
      select: {
        id: true,
        billingStatus: true,
        billingStatusReason: true,
      },
    }),
    findOpenLowRateExceptionTicket(tx, { tenantId, revenueScheduleId }),
  ])

  const routed = Boolean(
    schedule &&
      schedule.billingStatus === "InDispute" &&
      typeof schedule.billingStatusReason === "string" &&
      schedule.billingStatusReason.startsWith(LOW_RATE_EXCEPTION_BILLING_REASON) &&
      ticket,
  )

  return {
    routed,
    schedule,
    ticket,
  }
}

export function buildLowRateTicketNotes(params: {
  scheduleNumber: string
  depositId: string
  depositLineItemId: string
  expectedRatePercent: number
  receivedRatePercent: number
  differencePercent: number
  remainingCommissionDifference: number
}) {
  return [
    "Auto-created during reconciliation for a lower-than-expected commission rate.",
    `Schedule: ${params.scheduleNumber}`,
    `Deposit ID: ${params.depositId}`,
    `Deposit Line Item ID: ${params.depositLineItemId}`,
    `Expected Rate: ${params.expectedRatePercent.toFixed(2)}%`,
    `Received Rate: ${params.receivedRatePercent.toFixed(2)}%`,
    `Rate Delta: ${params.differencePercent.toFixed(2)}%`,
    `Remaining Commission Difference: ${params.remainingCommissionDifference.toFixed(2)}`,
    `Review Queue: ${LOW_RATE_EXCEPTION_QUEUE_PATH}`,
  ].join("\n")
}

export async function ensureLowRateException(
  tx: PrismaClientOrTx,
  {
    tenantId,
    userId,
    revenueScheduleId,
    scheduleNumber,
    depositId,
    depositLineItemId,
    opportunityId,
    accountId,
    distributorAccountId,
    vendorAccountId,
    expectedRatePercent,
    receivedRatePercent,
    differencePercent,
    remainingCommissionDifference,
    priority = "High",
    severity = "Major",
  }: {
    tenantId: string
    userId: string
    revenueScheduleId: string
    scheduleNumber: string
    depositId: string
    depositLineItemId: string
    opportunityId: string | null
    accountId: string | null
    distributorAccountId: string | null
    vendorAccountId: string | null
    expectedRatePercent: number
    receivedRatePercent: number
    differencePercent: number
    remainingCommissionDifference: number
    priority?: TicketPriority
    severity?: TicketSeverity
  },
) {
  const existingTicket = await findOpenLowRateExceptionTicket(tx, {
    tenantId,
    revenueScheduleId,
  })

  await tx.revenueSchedule.update({
    where: { id: revenueScheduleId },
    data: {
      billingStatus: "InDispute",
      billingStatusSource: "Auto",
      billingStatusUpdatedById: userId,
      billingStatusUpdatedAt: new Date(),
      billingStatusReason: `${LOW_RATE_EXCEPTION_BILLING_REASON}:${depositLineItemId}`,
    },
  })

  const ticket =
    existingTicket ??
    (await tx.ticket.create({
      data: {
        tenantId,
        accountId: accountId ?? undefined,
        opportunityId: opportunityId ?? undefined,
        revenueScheduleId,
        distributorAccountId: distributorAccountId ?? undefined,
        vendorAccountId: vendorAccountId ?? undefined,
        createdById: userId,
        issue: LOW_RATE_EXCEPTION_ISSUE,
        status: "Open",
        priority,
        severity,
        notes: buildLowRateTicketNotes({
          scheduleNumber,
          depositId,
          depositLineItemId,
          expectedRatePercent,
          receivedRatePercent,
          differencePercent,
          remainingCommissionDifference,
        }),
      },
      select: {
        id: true,
        status: true,
        priority: true,
        severity: true,
        createdAt: true,
      },
    }))

  return {
    ticketId: ticket.id,
    queuePath: LOW_RATE_EXCEPTION_QUEUE_PATH,
    reusedTicket: Boolean(existingTicket),
  }
}
