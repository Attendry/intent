import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import { getAIClient, getSettingsForUser } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";

async function validateUrl(url: string): Promise<{ ok: boolean; contentType: string; size: number }> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      const getResponse = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Range: "bytes=0-1023",
        },
        redirect: "follow",
      });
      return {
        ok: getResponse.ok,
        contentType: getResponse.headers.get("content-type") || "",
        size: parseInt(getResponse.headers.get("content-length") || "0"),
      };
    }
    return {
      ok: true,
      contentType: response.headers.get("content-type") || "",
      size: parseInt(response.headers.get("content-length") || "0"),
    };
  } catch {
    return { ok: false, contentType: "", size: 0 };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { requireCompanyAccess } = await import("@/lib/access");
    const accessResult = await requireCompanyAccess(companyId, userId, {
      allowCollaborator: true,
    });
    if ("error" in accessResult) return accessResult.error;

    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { name: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const client = await getAIClient(userId);
    const settings = await getSettingsForUser(userId);
    const modelName = (settings as { geminiModel?: string }).geminiModel || "gemini-2.5-flash";

    const prompt = `Find the direct download URL to the most recent annual report PDF for "${company.name}".

IMPORTANT INSTRUCTIONS:
1. Use Google Search to find the ACTUAL URL. Do NOT guess or construct URLs.
2. Look on the company's official investor relations page first.
3. Verify the URL you found exists in the search results - do not fabricate URLs.
4. Prefer direct PDF download links (ending in .pdf).
5. If no direct PDF link, provide the investor relations page URL where reports can be found.

Respond with ONLY a JSON object (no markdown):
{"url": "the actual verified URL", "title": "document title", "year": "publication year"}

If you truly cannot find any report, respond:
{"url": null, "title": null, "year": null}`;

    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction:
          "You are a financial research assistant. Your job is to find REAL, VERIFIED URLs to annual reports using Google Search. Never fabricate or guess URLs. Only return URLs that you have confirmed exist via search results.",
        temperature: 0.0,
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = response.text ?? "";
    console.log("[doc-find] Raw AI response:", rawText);

    let jsonStr = rawText.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    let candidates: { url: string; title: string; year: string | null }[] = [];

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.url) {
        candidates.push({
          url: parsed.url,
          title: parsed.title || `${company.name} Annual Report`,
          year: parsed.year || null,
        });
      }
    } catch {
      // Extract all URLs from the response text
      const urlMatches = rawText.matchAll(/https?:\/\/[^\s"'<>)\]]+/g);
      for (const match of urlMatches) {
        let url = match[0].replace(/[.,;]+$/, "");
        candidates.push({
          url,
          title: `${company.name} Annual Report`,
          year: null,
        });
      }
    }

    // Also extract any additional URLs from the response for fallback
    if (candidates.length <= 1) {
      const allUrls = rawText.matchAll(/https?:\/\/[^\s"'<>)\]]+/g);
      for (const match of allUrls) {
        let url = match[0].replace(/[.,;]+$/, "");
        if (!candidates.some((c) => c.url === url)) {
          candidates.push({
            url,
            title: `${company.name} Report`,
            year: null,
          });
        }
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        message: "No annual report found for this company",
        company: company.name,
      });
    }

    // Validate each candidate URL until we find one that works
    let validCandidate: (typeof candidates)[0] | null = null;

    for (const candidate of candidates) {
      debugLog("[doc-find] Validating URL:", candidate.url);
      const check = await validateUrl(candidate.url);

      if (check.ok) {
        console.log(
          `[doc-find] Valid! Content-Type: ${check.contentType}, Size: ${check.size}`
        );
        validCandidate = candidate;
        break;
      } else {
        debugLog("[doc-find] URL returned non-200, skipping:", candidate.url);
      }
    }

    if (!validCandidate) {
      // If no URLs validated, tell the user what we tried
      const triedUrls = candidates.map((c) => c.url).join(", ");
      debugLog("[doc-find] No valid URLs found. Tried:", triedUrls);
      return NextResponse.json({
        error: `Found ${candidates.length} potential URL(s) but none were accessible. The documents may require authentication or the URLs may have changed. You can try uploading the PDF manually.`,
        triedUrls: candidates.map((c) => c.url),
      }, { status: 422 });
    }

    const doc = await prisma.companyDocument.create({
      data: {
        companyId,
        title: validCandidate.title,
        type: "annual_report",
        sourceUrl: validCandidate.url,
        status: "pending",
      },
    });

    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/companies/${companyId}/documents/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.id }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      url: validCandidate.url,
      title: validCandidate.title,
    });
  } catch (error) {
    console.error("[doc-find] error:", error);
    const message = error instanceof Error ? error.message : "Failed to find annual report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
