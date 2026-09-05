import { chromium } from "playwright";
const OUT = process.argv[2], BASE = process.argv[3];
const browser = await chromium.launch();
for (const s of [{n:"desktop",w:1440,h:900},{n:"phone",w:390,h:844}]) {
  const ctx = await browser.newContext({ viewport:{width:s.w,height:s.h} });
  const page = await ctx.newPage();
  const bad = [];
  page.on("response", r => { if (r.url().includes("images.pexels.com") && r.status() >= 400) bad.push(r.status()+" "+r.url().slice(0,80)); });
  await page.goto(BASE, { waitUntil:"networkidle" });
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.15));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/products-${s.n}.png` });
  console.log(s.n, "| failed image requests:", bad.length, bad.slice(0,3).join(" | "));
  await ctx.close();
}
await browser.close();
