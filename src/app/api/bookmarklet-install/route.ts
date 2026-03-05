import { NextRequest, NextResponse } from "next/server";

const CONTENT_MAX_LEN = 1500;

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const token = request.nextUrl.searchParams.get("token") || "";
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
  const bookmarkletCode = `javascript:(function(){var u=encodeURIComponent(window.location.href);var t=encodeURIComponent(document.title);var s=window.getSelection().toString().trim();var c=(s||document.body.innerText||'').replace(/\\s+/g,' ').trim().slice(0,${CONTENT_MAX_LEN});window.open('${origin}/capture?url='+u+'&title='+t+(c?'&content='+encodeURIComponent(c):'')+'${tokenParam}','TwobrainsCapture','width=420,height=640,top=100,left=100');})();`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Twobrains — Install Bookmarklet</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 2rem; background: #f5f5f5; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 420px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    p { margin: 0 0 1.5rem; color: #666; font-size: 0.875rem; }
    a.bookmarklet { display: inline-flex; align-items: center; gap: 0.5rem; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 0.75rem 1.25rem; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 0.875rem; cursor: grab; }
    a.bookmarklet:hover { filter: brightness(1.1); }
    a.bookmarklet:active { cursor: grabbing; }
    .hint { font-size: 0.75rem; color: #999; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Capture Bookmarklet</h1>
    <p>Drag the button below to your bookmarks bar. Then click it on any page to capture leads and signals.</p>
    <a href="${bookmarkletCode}" class="bookmarklet" draggable="true">📌 Capture Signal</a>
    <p class="hint">← Drag this to your bookmarks bar</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
