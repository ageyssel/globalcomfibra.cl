const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const routes = ["/", "/faq", "/login", "/privacidad", "/terminos", "/robots.txt", "/sitemap.xml"];
let failed = false;
for (const route of routes) {
  const response = await fetch(`${base}${route}`, { redirect: "manual" });
  const ok = response.status >= 200 && response.status < 400;
  console.log(`${ok ? "OK" : "FAIL"} ${response.status} ${route}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
