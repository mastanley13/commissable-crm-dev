import { NextRequest } from "next/server"
import {
  AuditAction,
  ImportJobRecordOperation,
  ImportJobUndoAction,
  ImportJobUndoStatus,
  JobStatus,
  Prisma
} from "@prisma/client"
import { createErrorResponse, withPermissions } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]

interface UndoPreview {
  importJobId: string
  canUndo: boolean
  undoStatus: ImportJobUndoStatus
  blockers: string[]
  recordCount: number
  countsByEntity: Record<string, number>
}

function summarizeRecords(records: Array<{ entityName: string }>) {
  return records.reduce<Record<string, number>>((counts, record) => {
    counts[record.entityName] = (counts[record.entityName] ?? 0) + 1
    return counts
  }, {})
}

async function buildUndoPreview(
  client: Prisma.TransactionClient | typeof prisma,
  params: { importJobId: string; tenantId: string }
): Promise<UndoPreview | null> {
  const importJob = await client.importJob.findFirst({
    where: {
      id: params.importJobId,
      tenantId: params.tenantId
    },
    select: {
      id: true,
      status: true,
      undoStatus: true,
      records: {
        select: {
          entityName: true,
          entityId: true,
          operation: true,
          undoAction: true,
          undoneAt: true
        }
      }
    }
  })

  if (!importJob) {
    return null
  }

  const blockers: string[] = []
  const undoableRecords = importJob.records.filter(
    record =>
      record.operation === ImportJobRecordOperation.Created &&
      record.undoAction === ImportJobUndoAction.DeleteCreatedRecord
  )
  const updatedRecords = importJob.records.filter(
    record => record.operation === ImportJobRecordOperation.Updated
  )

  if (importJob.status !== JobStatus.Completed) {
    blockers.push("Only completed import jobs can be undone.")
  }
  if (importJob.undoStatus === ImportJobUndoStatus.Undone) {
    blockers.push("This import has already been undone.")
  }
  if (importJob.undoStatus === ImportJobUndoStatus.Undoing) {
    blockers.push("This import is already being undone.")
  }
  if (importJob.undoStatus === ImportJobUndoStatus.UndoFailed) {
    blockers.push("The previous undo attempt failed. Review the error before retrying.")
  }
  if (updatedRecords.length > 0) {
    blockers.push("This import updated existing records. Undo currently supports created records only.")
  }
  if (undoableRecords.length === 0) {
    blockers.push("This import does not have tracked created records to undo.")
  }
  if (undoableRecords.some(record => record.undoneAt)) {
    blockers.push("One or more records from this import were already marked undone.")
  }

  const depositLineItemIds = undoableRecords
    .filter(record => record.entityName === "DepositLineItem")
    .map(record => record.entityId)
  if (depositLineItemIds.length > 0) {
    const matchCount = await client.depositLineMatch.count({
      where: {
        tenantId: params.tenantId,
        depositLineItemId: { in: depositLineItemIds }
      }
    })
    if (matchCount > 0) {
      blockers.push("One or more imported deposit transactions have reconciliation matches.")
    }
  }

  const depositIds = undoableRecords
    .filter(record => record.entityName === "Deposit")
    .map(record => record.entityId)
  if (depositIds.length > 0) {
    const matchGroupCount = await client.depositMatchGroup.count({
      where: {
        tenantId: params.tenantId,
        depositId: { in: depositIds }
      }
    })
    if (matchGroupCount > 0) {
      blockers.push("One or more imported deposits have match groups.")
    }
  }

  const revenueScheduleIds = undoableRecords
    .filter(record => record.entityName === "RevenueSchedule")
    .map(record => record.entityId)
  if (revenueScheduleIds.length > 0) {
    const [matchCount, payoutCount] = await Promise.all([
      client.depositLineMatch.count({
        where: {
          tenantId: params.tenantId,
          revenueScheduleId: { in: revenueScheduleIds }
        }
      }),
      client.commissionPayout.count({
        where: {
          tenantId: params.tenantId,
          revenueScheduleId: { in: revenueScheduleIds }
        }
      })
    ])
    if (matchCount > 0 || payoutCount > 0) {
      blockers.push("One or more imported revenue schedules have financial activity.")
    }
  }

  return {
    importJobId: importJob.id,
    canUndo: blockers.length === 0,
    undoStatus: importJob.undoStatus,
    blockers,
    recordCount: undoableRecords.length,
    countsByEntity: summarizeRecords(undoableRecords)
  }
}

async function deleteTrackedRecord(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; entityName: string; entityId: string }
) {
  const where = { id: params.entityId, tenantId: params.tenantId }

  switch (params.entityName) {
    case "DepositLineItem":
      return tx.depositLineItem.deleteMany({ where })
    case "Deposit":
      return tx.deposit.deleteMany({ where })
    case "RevenueSchedule":
      return tx.revenueSchedule.deleteMany({ where })
    case "OpportunityProduct":
      return tx.opportunityProduct.deleteMany({ where })
    case "OpportunityRole":
      return tx.opportunityRole.deleteMany({ where })
    case "Contact":
      return tx.contact.deleteMany({ where })
    case "Product":
      return tx.product.deleteMany({ where })
    case "Account":
      return tx.account.deleteMany({ where })
    case "Address":
      return tx.address.deleteMany({ where })
    default:
      throw new Error(`Unsupported undo entity: ${params.entityName}`)
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ importJobId: string }> }
) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const { importJobId } = await context.params
    if (!importJobId) {
      return createErrorResponse("Import job id is required.", 400)
    }

    const preview = await buildUndoPreview(prisma, {
      importJobId,
      tenantId: req.user.tenantId
    })

    if (!preview) {
      return createErrorResponse("Import job not found.", 404)
    }

    return Response.json({ data: preview }, { headers: { "Cache-Control": "no-store" } })
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ importJobId: string }> }
) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const { importJobId } = await context.params
    if (!importJobId) {
      return createErrorResponse("Import job id is required.", 400)
    }

    const preview = await buildUndoPreview(prisma, {
      importJobId,
      tenantId: req.user.tenantId
    })

    if (!preview) {
      return createErrorResponse("Import job not found.", 404)
    }
    if (!preview.canUndo) {
      return createErrorResponse(preview.blockers.join(" "), 409)
    }

    const lock = await prisma.importJob.updateMany({
      where: {
        id: importJobId,
        tenantId: req.user.tenantId,
        undoStatus: ImportJobUndoStatus.Undoable
      },
      data: {
        undoStatus: ImportJobUndoStatus.Undoing,
        undoStartedAt: new Date(),
        undoneByUserId: req.user.id,
        undoError: null
      }
    })

    if (lock.count !== 1) {
      return createErrorResponse("Import undo could not be started because the job state changed.", 409)
    }

    try {
      const summary = await prisma.$transaction(async tx => {
        const records = await tx.importJobRecord.findMany({
          where: {
            importJobId,
            tenantId: req.user.tenantId,
            operation: ImportJobRecordOperation.Created,
            undoAction: ImportJobUndoAction.DeleteCreatedRecord,
            undoneAt: null
          },
          orderBy: [{ undoOrder: "asc" }, { createdAt: "desc" }]
        })

        for (const record of records) {
          await deleteTrackedRecord(tx, {
            tenantId: req.user.tenantId,
            entityName: record.entityName,
            entityId: record.entityId
          })
        }

        const undoneAt = new Date()
        await tx.importJobRecord.updateMany({
          where: {
            importJobId,
            tenantId: req.user.tenantId,
            id: { in: records.map(record => record.id) }
          },
          data: {
            undoneAt,
            undoError: null
          }
        })

        const summary = {
          recordCount: records.length,
          countsByEntity: summarizeRecords(records)
        }

        await tx.auditLog.create({
          data: {
            tenantId: req.user.tenantId,
            userId: req.user.id,
            action: AuditAction.Delete,
            entityName: "ImportJob",
            entityId: importJobId,
            metadata: summary
          }
        })

        await tx.importJob.update({
          where: { id: importJobId },
          data: {
            undoStatus: ImportJobUndoStatus.Undone,
            undoCompletedAt: undoneAt,
            undoSummary: summary,
            undoError: null
          }
        })

        return summary
      })

      return Response.json({ data: { importJobId, undoStatus: ImportJobUndoStatus.Undone, ...summary } })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import undo failed."
      await prisma.importJob.updateMany({
        where: {
          id: importJobId,
          tenantId: req.user.tenantId
        },
        data: {
          undoStatus: ImportJobUndoStatus.UndoFailed,
          undoCompletedAt: new Date(),
          undoError: message
        }
      })

      return createErrorResponse(message, 500)
    }
  })
}
