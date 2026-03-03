import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    if (q.length < 2) {
      return NextResponse.json({ prospects: [], companies: [], content: [] });
    }

    const [prospects, companies, content] = await Promise.all([
      prisma.prospect.findMany({
        where: {
          userId,
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { company: { contains: q } },
            { email: { contains: q } },
            { title: { contains: q } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          company: true,
        },
        take: 5,
      }),
      prisma.company.findMany({
        where: {
          userId,
          OR: [
            { name: { contains: q } },
            { industry: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          industry: true,
        },
        take: 5,
      }),
      prisma.content.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: q } },
            { body: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          type: true,
        },
        take: 5,
      }),
    ]);

    return NextResponse.json({ prospects, companies, content });
  } catch {
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
