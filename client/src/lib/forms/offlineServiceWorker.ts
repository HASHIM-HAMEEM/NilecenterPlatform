export async function registerNileFormsServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    return { supported: false as const };
  }
  const registration = await navigator.serviceWorker.register(
    "/nile-forms-sw.js",
    { scope: "/" }
  );
  await navigator.serviceWorker.ready;
  return { supported: true as const, registration };
}
