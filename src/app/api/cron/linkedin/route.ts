import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";

function extractLinkedInUsername(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.replace(/\/+$/, "").split("/");
    const inIdx = segments.indexOf("in");
    if (inIdx !== -1 && segments[inIdx + 1]) return segments[inIdx + 1];
    return segments.filter(Boolean).pop() || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    let totalProcessed = 0;
    let totalSignalsCreated = 0;

    for (const user of users) {
      const settingsRow = await prisma.userSettings.findUnique({
        where: { userId: user.id },
      });
      const settings = settingsRow ? JSON.parse(settingsRow.data) : {};
      const apiKey = settings.rapidApiKey;

      if (!apiKey) continue;

      const prospects = await prisma.prospect.findMany({
        where: {
          userId: user.id,
          linkedinUrl: { not: null },
        },
        select: {
        id: true,
        firstName: true,
        lastName: true,
        linkedinUrl: true,
        title: true,
        company: true,
      },
    });

      let processed = 0;
      let signalsCreated = 0;

      for (const prospect of prospects) {
      if (!prospect.linkedinUrl) continue;

      const username = extractLinkedInUsername(prospect.linkedinUrl);
      if (!username) continue;

      try {
        const res = await fetch(
          `https://linkedin-data-api.p.rapidapi.com/?username=${encodeURIComponent(username)}`,
          {
            headers: {
              "x-rapidapi-key": apiKey,
              "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
            },
          }
        );
        if (!res.ok) continue;

        const profile = await res.json();
        processed++;

        const currentTitle =
          profile.position?.title ||
          profile.headline ||
          profile.job_title ||
          null;
        const currentCompany =
          profile.position?.companyName ||
          profile.company ||
          profile.experiences?.[0]?.company ||
          null;

        const titleChanged =
          currentTitle &&
          prospect.title &&
          currentTitle !== prospect.title;
        const companyChanged =
          currentCompany &&
          prospect.company &&
          currentCompany !== prospect.company;

        if (titleChanged) {
          await prisma.signal.create({
            data: {
              prospectId: prospect.id,
              type: "job_change",
              summary: `${prospect.firstName} ${prospect.lastName} changed role from "${prospect.title}" to "${currentTitle}"`,
              urgencyScore: 4,
              outreachAngle:
                "Congratulate on the new role and explore how you can support them.",
              sourceUrl: prospect.linkedinUrl,
            },
          });
          signalsCreated++;
        }

        if (companyChanged) {
          await prisma.signal.create({
            data: {
              prospectId: prospect.id,
              type: "job_change",
              summary: `${prospect.firstName} ${prospect.lastName} moved from ${prospect.company} to ${currentCompany}`,
              urgencyScore: 4,
              outreachAngle:
                "Reach out about their new company and explore partnership opportunities.",
              sourceUrl: prospect.linkedinUrl,
            },
          });
          signalsCreated++;
        }

        if (titleChanged || companyChanged) {
          await prisma.prospect.update({
            where: { id: prospect.id },
            data: {
              ...(titleChanged ? { title: currentTitle } : {}),
              ...(companyChanged ? { company: currentCompany } : {}),
            },
          });
        }
      } catch {
        // Skip prospect on network/parse errors
      }
    }

      totalProcessed += processed;
      totalSignalsCreated += signalsCreated;
    }

    return NextResponse.json({
      message: "LinkedIn polling complete.",
      processed: totalProcessed,
      signalsCreated: totalSignalsCreated,
    });
  } catch (error) {
    console.error("LinkedIn cron error:", error);
    return NextResponse.json(
      { error: "LinkedIn polling failed" },
      { status: 500 }
    );
  }
}
