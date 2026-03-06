import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export type CompanyAccess = "owner" | "collaborator" | null;

/**
 * Check if a user has access to a company (as owner or accepted collaborator).
 */
export async function getCompanyAccess(
  companyId: string,
  userId: string
): Promise<CompanyAccess> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      collaborators: {
        where: { userId, acceptedAt: { not: null } },
        select: { id: true },
      },
    },
  });

  if (!company) return null;
  if (company.userId === userId) return "owner";
  if (company.collaborators.length > 0) return "collaborator";
  return null;
}

/**
 * Require company access. Returns access or an error Response.
 * Use allowCollaborator: false when only the owner may perform the action (e.g. delete, transfer).
 */
export async function requireCompanyAccess(
  companyId: string,
  userId: string,
  options?: { allowCollaborator?: boolean }
): Promise<{ access: CompanyAccess } | { error: Response }> {
  const access = await getCompanyAccess(companyId, userId);
  if (!access) {
    return {
      error: NextResponse.json({ error: "Company not found" }, { status: 404 }),
    };
  }
  if (
    access === "collaborator" &&
    options?.allowCollaborator === false
  ) {
    return {
      error: NextResponse.json(
        { error: "Only the account owner can perform this action" },
        { status: 403 }
      ),
    };
  }
  return { access };
}
