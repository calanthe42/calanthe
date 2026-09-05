import { chromium } from "playwright";
const OUT=process.argv[2], BASE=process.argv[3];
const b = await chromium.launch();
for (const vp of [{n:"desktop",w:1440,h:1000},{n:"phone",w:390,h:844}]) {
  const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h} });
  const p = await ctx.newPage();
  await p.goto(BASE,{waitUntil:"networkidle"});
  const h = p.locator('h2:has-text("For every unspoken thing")');
  await h.scrollIntoViewIfNeeded();
  await p.waitForTimeout(2600);
  const box = await h.boundingBox();
  await p.screenshot({ path:`${OUT}/occ2-${vp.n}.png`,
    clip:{x:0,y:Math.max(0,box.y-40),width:vp.w,height:Math.min(vp.h-40, 700)} });
  await ctx.close();
}
await b.close(); console.log("ok");
