import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTenantId } from "@/lib/server-utils";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = await resolveTenantId(searchParams.get("tenantId"));
    const status = searchParams.get("status") || "Active";
    const limit = parseInt(searchParams.get("limit") || "50");
    const type = searchParams.get("type");

    let where: any = {
      tenantId,
      status
    };

    // Handle special user types
    if (type === "special") {
      // For now, return empty array for special users
      // This could be extended to return system users like "House", "Unassigned", etc.
      return NextResponse.json({ data: [] });
    }

    // Get users with role information
    const users = await prisma.user.findMany({
      where,
      take: limit,
      orderBy: { fullName: "asc" },
      include: {
        role: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    // Transform to expected format
    const transformedUsers = users.map(user => ({
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      activeAccountsCount: 0 // This could be calculated if needed
    }));

    return NextResponse.json({
      users: transformedUsers,
      total: transformedUsers.length
    });

  } catch (error) {
    console.error("Failed to load users", error);
    return NextResponse.json({
      error: "Failed to load users"
    }, { status: 500 });
  }
}
