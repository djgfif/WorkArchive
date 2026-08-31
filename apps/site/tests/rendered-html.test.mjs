import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the Work Archive product landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'none'/,
  );

  const html = await response.text();
  assert.match(html, /<title>Work Archive — 내 감상 기록 서재<\/title>/i);
  assert.match(html, /보고 읽은 모든 것을/);
  assert.match(html, /겨울 궤도/);
  assert.match(html, /유리 정원/);
  assert.match(html, /밤의 지도/);
  assert.match(html, /앱 POC 준비 중/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("serves only the requested single landing route", async () => {
  const response = await render("/not-a-page");
  assert.equal(response.status, 404);
});
