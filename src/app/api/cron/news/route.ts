import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAIClient } from "@/lib/ai";
import { verifyCronAuth } from "@/lib/cron-auth";

interface ArticleClassification {
  type: "company_news" | "conference" | "hiring" | "other";
  eventName?: string;
  speakers?: { name: string; title?: string; company?: string }[];
  date?: string;
}

async function classifyArticle(
  article: { title: string; description?: string; url: string },
  company: string,
  userId: string
): Promise<ArticleClassification | null> {
  try {
    const client = await getAIClient(userId);
    const { getSettingsForUser } = await import("@/lib/ai");
    const settings = await getSettingsForUser(userId);
    const modelName = settings.geminiModel || "gemini-2.5-flash";

    const response = await client.models.generateContent({
      model: modelName,
      contents: `Classify this article about "${company}":
Title: ${article.title}
Description: ${article.description || "N/A"}
URL: ${article.url}

Classify as one of: "company_news", "conference", "hiring", "other".
If it's a conference/event/summit/keynote, extract the event name, any speaker names with their titles and companies, and event date if available.

Respond in JSON: { "type": "...", "eventName": "...", "speakers": [{"name": "...", "title": "...", "company": "..."}], "date": "..." }
Only include speakers array if type is "conference". Omit fields that aren't available.`,
      config: {
        systemInstruction:
          "You are a B2B sales intelligence classifier. Analyze news articles and determine if they relate to company news, conferences/events, hiring, or other topics. Be accurate and concise.",
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "";
    return JSON.parse(text) as ArticleClassification;
  } catch {
    return null;
  }
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
      const gnewsKey = settings.gnewsApiKey;
      const hasGemini = !!(settings.geminiApiKey || process.env.GEMINI_API_KEY);

      if (!gnewsKey) continue;

      const prospects = await prisma.prospect.findMany({
        where: { userId: user.id, company: { not: null } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
        },
      });

      const companyMap = new Map<
        string,
        { id: string; firstName: string; lastName: string }[]
      >();
      for (const p of prospects) {
        if (!p.company) continue;
        const entries = companyMap.get(p.company) || [];
        entries.push({ id: p.id, firstName: p.firstName, lastName: p.lastName });
        companyMap.set(p.company, entries);
      }

      const companies = Array.from(companyMap.keys());
      let signalsCreated = 0;
      let suggestionsCreated = 0;

      for (const company of companies) {
      const queries = [
        `"${company}"`,
        `"${company}" conference OR summit OR keynote`,
      ];

      for (const query of queries) {
        try {
          const res = await fetch(
            `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=3&apikey=${gnewsKey}`
          );
          if (!res.ok) continue;

          const data = await res.json();
          const articles = data.articles || [];
          const prospectEntries = companyMap.get(company) || [];

          for (const article of articles) {
            const existing = await prisma.signal.findFirst({
              where: {
                sourceUrl: article.url,
                prospect: { userId: user.id },
              },
            });
            if (existing) continue;

            let classification: ArticleClassification | null = null;
            if (hasGemini) {
              classification = await classifyArticle(article, company, user.id);
            }

            const signalType = classification?.type || "company_news";
            const isConference = signalType === "conference";

            for (const prospect of prospectEntries) {
              let summary = article.title;
              let outreachAngle = `Recent news about ${company}: ${article.title}`;
              let urgency = 3;

              if (isConference && classification?.eventName) {
                summary = `${company} is presenting at ${classification.eventName}`;
                outreachAngle = `${prospect.firstName}'s company is involved in ${classification.eventName}. Great conversation starter.`;
                urgency = 4;
              }

              // Check if a specific speaker matches this prospect
              if (isConference && classification?.speakers) {
                const prospectFullName =
                  `${prospect.firstName} ${prospect.lastName}`.toLowerCase();
                const matchedSpeaker = classification.speakers.find(
                  (s) => s.name.toLowerCase() === prospectFullName
                );
                if (matchedSpeaker) {
                  summary = `${prospect.firstName} ${prospect.lastName} is speaking at ${classification.eventName || "a conference"}`;
                  outreachAngle = `Congratulate on the speaking engagement and explore topics of mutual interest.`;
                  urgency = 5;
                }
              }

              await prisma.signal.create({
                data: {
                  prospectId: prospect.id,
                  type: isConference ? "conference" : signalType,
                  sourceUrl: article.url,
                  rawContent: article.description || article.title,
                  summary,
                  urgencyScore: urgency,
                  outreachAngle,
                },
              });
              signalsCreated++;
            }

            // Create prospect suggestions for unknown speakers
            if (
              isConference &&
              classification?.speakers &&
              classification.speakers.length > 0
            ) {
              const allProspectNames = prospects.map(
                (p) => `${p.firstName} ${p.lastName}`.toLowerCase()
              );

              for (const speaker of classification.speakers) {
                if (allProspectNames.includes(speaker.name.toLowerCase()))
                  continue;

                const nameParts = speaker.name.trim().split(/\s+/);
                if (nameParts.length < 2) continue;

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
                    title: speaker.title || null,
                    company: speaker.company || company,
                    source: article.url,
                    signalType: "conference",
                    reason: `Speaking at ${classification.eventName || "a conference"}`,
                  },
                });
                suggestionsCreated++;
              }
            }
          }
        } catch {
          // Skip query on network/parse errors
        }
      }
    }

      totalSignalsCreated += signalsCreated;
      totalSuggestionsCreated += suggestionsCreated;
    }

    return NextResponse.json({
      message: "News & conference polling complete.",
      processed: users.length,
      signalsCreated: totalSignalsCreated,
      suggestionsCreated: totalSuggestionsCreated,
    });
  } catch (error) {
    console.error("News cron error:", error);
    return NextResponse.json(
      { error: "News polling failed" },
      { status: 500 }
    );
  }
}
