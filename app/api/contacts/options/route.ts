import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['contacts.read', 'contacts.manage'],
    async (req) => {
      try {
        const tenantId = req.user.tenantId

        // Fetch all options in parallel
        const [accountTypes, owners, accounts] = await Promise.all([
          // Account types that are assignable to contacts
          prisma.accountType.findMany({
            where: {
              tenantId,
              isAssignableToContacts: true
            },
            select: {
              id: true,
              name: true,
              code: true
            },
            orderBy: { displayOrder: "asc" }
          }),
          
          // Users who can be contact owners
          prisma.user.findMany({
            where: {
              tenantId,
              status: "Active"
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fullName: true
            },
            orderBy: { fullName: "asc" }
          }),
          
          // Accounts for contact assignment
          prisma.account.findMany({
            where: {
              tenantId,
              status: "Active"
            },
            select: {
              id: true,
              accountName: true,
              accountNumber: true,
              accountTypeId: true,
              accountType: {
                select: {
                  name: true
                }
              }
            },
            orderBy: { accountName: "asc" }
          })
        ])

        return NextResponse.json({
          accountTypes: accountTypes.map(type => ({
            value: type.id,
            label: type.name,
            code: type.code
          })),
          owners: owners.map(owner => ({
            value: owner.id,
            label: owner.fullName,
            firstName: owner.firstName,
            lastName: owner.lastName
          })),
          accounts: accounts.map(account => ({
            value: account.id,
            label: account.accountName,
            accountNumber: account.accountNumber,
            accountTypeId: account.accountTypeId,
            accountTypeName: account.accountType ? account.accountType.name : ""
          })),
          contactMethods: [
            { value: "Email", label: "Email" },
            { value: "Phone", label: "Phone" },
            { value: "SMS", label: "SMS" },
            { value: "None", label: "None" }
          ]
        })

      } catch (error) {
        console.error("Failed to load contact options:", error)
        // Log the full error details for debugging
        if (error instanceof Error) {
          console.error("Error message:", error.message)
          console.error("Error stack:", error.stack)
        }
        return NextResponse.json({ 
          error: "Failed to load contact options",
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
      }
    }
  )
}


