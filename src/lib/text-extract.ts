/**
 * Fetch content from a URL and extract plain text (HTML or PDF).
 */
async function downloadWithHeaders(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "application/pdf,text/html,application/xhtml+xml,*/*;q=0.8",
    },
    redirect: "follow",
  });
}

async function parsePdf(buffer: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return text as string;
}

/**
 * Extract text from a buffer (PDF or plain text).
 */
export async function extractTextFromBuffer(
  buffer: Uint8Array,
  filename?: string
): Promise<string> {
  const isPdf =
    (buffer.length >= 5 &&
      new TextDecoder().decode(buffer.slice(0, 5)).startsWith("%PDF")) ||
    (filename && filename.toLowerCase().endsWith(".pdf"));

  if (isPdf) {
    return parsePdf(buffer);
  }
  return new TextDecoder().decode(buffer);
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ExtractTextResult {
  text: string;
  contentType: "html" | "pdf";
}

/**
 * Fetch a URL and extract plain text. Supports HTML and PDF.
 */
export async function extractTextFromUrl(url: string): Promise<ExtractTextResult> {
  const response = await downloadWithHeaders(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const isPdf =
    contentType.includes("application/pdf") ||
    url.toLowerCase().endsWith(".pdf");

  const arrayBuf = await response.arrayBuffer();
  const rawBuffer = new Uint8Array(arrayBuf);

  if (rawBuffer.length === 0) {
    throw new Error("Downloaded file is empty (0 bytes)");
  }

  if (rawBuffer.length < 100 && !isPdf) {
    const preview = new TextDecoder().decode(rawBuffer.slice(0, 100));
    if (preview.includes("<!DOCTYPE") || preview.includes("Access Denied")) {
      throw new Error("URL returned an error page. The file may require authentication.");
    }
  }

  if (isPdf) {
    if (rawBuffer.length < 10) {
      throw new Error("PDF file too small — likely not valid");
    }
    const header = new TextDecoder().decode(rawBuffer.slice(0, 5));
    if (!header.startsWith("%PDF")) {
      throw new Error("File does not start with %PDF — may not be a valid PDF.");
    }
    const text = await parsePdf(rawBuffer);
    if (text.length < 50) {
      throw new Error("Extracted text too short — document may be image-only.");
    }
    return { text, contentType: "pdf" };
  }

  const html = new TextDecoder().decode(rawBuffer);
  const text = htmlToText(html);
  if (text.length < 50) {
    throw new Error("Extracted text too short — page may be empty or require JavaScript.");
  }
  return { text, contentType: "html" };
}
