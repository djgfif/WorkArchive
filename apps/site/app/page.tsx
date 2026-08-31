import { LandingPage } from "./landing-page";

function getAppPocUrl() {
  const configuredUrl = process.env.APP_POC_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    return url.protocol === "https:" ||
      (url.protocol === "http:" && url.hostname === "localhost")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export default function Home() {
  return <LandingPage appPocUrl={getAppPocUrl()} />;
}
