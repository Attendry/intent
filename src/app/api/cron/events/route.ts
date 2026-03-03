import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";

interface PredictHQEvent {
  id: string;
  title: string;
  description?: string;
  category: string;
  start: string;
  end?: string;
  entities?: { entity_id: string; name: string; type: string }[];
  labels?: string[];
  location?: [number, number];
}

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    let totalSignalsCreated = 0;
    let totalSuggestionsCreated = 0;

    for (const user of users) {
      const settingsRow = await prisma.userSettings.findUnique({
        where: { userId: user.id },
      });
      const settings = settingsRow ? JSON.parse(settingsRow.data) : {};
      const apiKey = settings.predictHqApiKey;

      if (!apiKey) continue;

      const prospects = await prisma.prospect.findMany({
        where: { userId: user.id, company: { not: null } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          industry: true,
        },
      });

      const companyMap = new Map<
      string,
      { id: string; firstName: string; lastName: string; company: string | null }[]
    >();
      const industries = new Set<string>();
      for (const p of prospects) {
      if (!p.company) continue;
      const entries = companyMap.get(p.company.toLowerCase()) || [];
      entries.push({ id: p.id, firstName: p.firstName, lastName: p.lastName, company: p.company });
      companyMap.set(p.company.toLowerCase(), entries);
        if (p.industry) industries.add(p.industry.toLowerCase());
      }

      let signalsCreated = 0;
      let suggestionsCreated = 0;

      const now = new Date();
      const futureDate = new Date(
        now.getTime() + 90 * 24 * 60 * 60 * 1000
      );

      const params = new URLSearchParams({
      category: "conferences",
      "start.gte": now.toISOString().split("T")[0],
      "start.lte": futureDate.toISOString().split("T")[0],
      limit: "50",
        sort: "start",
      });

      try {
      const res = await fetch(
        `https://api.predicthq.com/v1/events/?${params}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) {
          const errText = await res.text();
          console.error("PredictHQ API error:", res.status, errText);
          continue;
        }

      const data = await res.json();
      const events: PredictHQEvent[] = data.results || [];

      for (const event of events) {
        const eventTitle = event.title || "Unnamed Conference";
        const eventDate = new Date(event.start).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        const eventEntities = event.entities || [];
        const eventLabels = (event.labels || []).map((l) => l.toLowerCase());

        // Match against prospect companies by entity names or title text
        for (const [companyLower, prospectEntries] of companyMap) {
          const titleLower = eventTitle.toLowerCase();
          const descLower = (event.description || "").toLowerCase();

          const companyMentioned =
            titleLower.includes(companyLower) ||
            descLower.includes(companyLower) ||
            eventEntities.some(
              (e) => e.name.toLowerCase() === companyLower
            );

          const industryMatch = eventLabels.some((label) =>
            industries.has(label)
          );

          if (!companyMentioned && !industryMatch) continue;

          const sourceId = `predicthq:${event.id}`;
          const existing = await prisma.signal.findFirst({
            where: {
              sourceUrl: sourceId,
              prospect: { userId: user.id },
            },
          });
          if (existing) continue;

          for (const prospect of prospectEntries) {
            const summary = companyMentioned
              ? `Upcoming: ${prospect.company || companyLower} at ${eventTitle} on ${eventDate}`
              : `Industry event: ${eventTitle} on ${eventDate} — relevant to ${prospect.firstName}'s sector`;

            await prisma.signal.create({
              data: {
                prospectId: prospect.id,
                type: "conference",
                sourceUrl: sourceId,
                rawContent: event.description || eventTitle,
                summary,
                urgencyScore: companyMentioned ? 4 : 3,
                outreachAngle: companyMentioned
                  ? `${prospect.firstName}'s company is involved in ${eventTitle}. Great reason to reach out.`
                  : `Relevant industry event — use as conversation opener.`,
              },
            });
            signalsCreated++;
          }

          // Create suggestions for entity names that don't match existing prospects
          for (const entity of eventEntities) {
            if (entity.type !== "person") continue;

            const nameParts = entity.name.trim().split(/\s+/);
            if (nameParts.length < 2) continue;

            const allNames = prospects.map(
              (p) => `${p.firstName} ${p.lastName}`.toLowerCase()
            );
            if (allNames.includes(entity.name.toLowerCase())) continue;

            const existingSuggestion =
              await prisma.prospectSuggestion.findFirst({
                where: {
                  userId: user.id,
                  firstName: nameParts[0],
                  lastName: nameParts.slice(1).join(" "),
                  status: "pending",
                },
              });
            if (existingSuggestion) continue;

            await prisma.prospectSuggestion.create({
              data: {
                userId: user.id,
                firstName: nameParts[0],
                lastName: nameParts.slice(1).join(" "),
                company: null,
                source: sourceId,
                signalType: "conference",
                reason: `Associated with ${eventTitle} on ${eventDate}`,
              },
            });
            suggestionsCreated++;
          }
        }
      }

      totalSignalsCreated += signalsCreated;
      totalSuggestionsCreated += suggestionsCreated;
      } catch (fetchError) {
        console.error("PredictHQ fetch error for user:", user.id, fetchError);
        // Continue to next user
      }
    }

    return NextResponse.json({
      message: "Event scanning complete.",
      processed: users.length,
      signalsCreated: totalSignalsCreated,
      suggestionsCreated: totalSuggestionsCreated,
    });
  } catch (error) {
    console.error("Events cron error:", error);
    return NextResponse.json(
      { error: "Event scanning failed" },
      { status: 500 }
    );
  }
}
