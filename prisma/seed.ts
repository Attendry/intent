/**
 * Seed script for Supabase/PostgreSQL.
 * Run after migration. Creates a placeholder user and sample data for development.
 *
 * For production: Users are created on first sign-in via Supabase Auth.
 * This seed is optional and mainly for local dev with sample data.
 *
 * To use: Create a user in Supabase Auth first, then run:
 *   npx tsx prisma/seed.ts
 *
 * Or use a test supabaseId for local dev (won't match real auth):
 *   SEED_SUPABASE_ID=seed-user-1 npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seedSupabaseId = process.env.SEED_SUPABASE_ID || "seed-dev-user";
  const seedEmail = process.env.SEED_EMAIL || "dev@intent.local";

  const user = await prisma.user.upsert({
    where: { supabaseId: seedSupabaseId },
    update: {},
    create: {
      supabaseId: seedSupabaseId,
      email: seedEmail,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      data: JSON.stringify({
        userName: "",
        userTitle: "",
        userCompany: "",
        signatureEn: "Best,",
        signatureDe: "Viele Grüße,",
        defaultLanguage: "en",
        germanFormality: "sie",
        tonePreference: "direct",
        customInstructions: "",
        cadence: {
          defaultFollowUpDays: 14,
          coldFollowUpDays: 5,
          reEngagementDays: 30,
          escalateAfterSignals: 3,
        },
        polling: { linkedinDays: 7, newsHours: 6, rssHours: 4 },
        apiKeys: { openai: "", proxycurl: "", gnews: "" },
      }),
    },
  });

  const acme = await prisma.company.upsert({
    where: { userId_name: { userId: user.id, name: "Acme Corp" } },
    update: {},
    create: { userId: user.id, name: "Acme Corp", industry: "Manufacturing" },
  });

  const sarah = await prisma.prospect.upsert({
    where: { userId_email: { userId: user.id, email: "sarah.chen@acmecorp.com" } },
    update: {},
    create: {
      userId: user.id,
      firstName: "Sarah",
      lastName: "Chen",
      email: "sarah.chen@acmecorp.com",
      title: "VP Operations",
      company: "Acme Corp",
      companyId: acme.id,
      industry: "Manufacturing",
      linkedinUrl: "https://linkedin.com/in/sarachen",
      personaSummary:
        "Senior operations leader at a mid-market manufacturer scaling rapidly post-Series B.",
      personaTags: JSON.stringify(["operations", "vp-level", "manufacturing", "scaling"]),
      priorityTier: "high",
      starred: true,
      lastContactedAt: new Date("2026-02-03"),
      nextFollowUpAt: new Date("2026-02-17"),
    },
  });

  await prisma.signal.create({
    data: {
      prospectId: sarah.id,
      type: "linkedin_post",
      rawContent: "We need to rethink our vendor strategy. Too many point solutions.",
      summary: "LinkedIn post about vendor consolidation",
      urgencyScore: 4,
      outreachAngle: "Reference their vendor consolidation post",
    },
  });

  await prisma.content.create({
    data: {
      userId: user.id,
      title: "Vendor Consolidation at Scale",
      type: "case_study",
      url: "https://yourcompany.com/case-studies/vendor-consolidation",
      summary: "How a mid-market manufacturer cut vendor evaluation cycles by 40%.",
      tags: JSON.stringify(["vendor-management", "operations"]),
      personaFit: JSON.stringify(["VP Ops", "Dir. Procurement"]),
      useCaseFit: JSON.stringify(["vendor-consolidation", "scaling"]),
    },
  });

  console.log("Seed completed. User id:", user.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
