import { chromium } from "playwright";
const OUT=process.argv[2], BASE=process.argv[3];
const b = await chromium.launch();
for (const vp of [{n:"desktop",w:1440,h:900},{n:"phone",w:390,h:844}]) {
  const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:1 });
  const p = await ctx.newPage();
  await p.goto(BASE,{waitUntil:"networkidle"});
  await p.waitForTimeout(1500);
  const grid = p.locator('a[href^="/occasions/"]').first();
  await grid.scrollIntoViewIfNeeded();
  await p.waitForTimeout(2200);
  const tiles = await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('a[href^="/occasions/"]').forEach(a=>{
      const r=a.getBoundingClientRect();
      if(r.width>60) out.push({l:(a.textContent||"").trim().slice(0,14), w:Math.round(r.width), h:Math.round(r.height)});
    });
    return out;
  });
  console.log("\n"+vp.n+" @"+vp.w);
  tiles.forEach(t=>console.log(`  ${t.l.padEnd(14)} ${String(t.w).padStart(4)} x ${String(t.h).padStart(3)}  → export ${t.w*2} x ${t.h*2}`));
  const box = await grid.boundingBox();
  await p.screenshot({ path:`${OUT}/occ-${vp.n}.png`, clip:{x:0,y:Math.max(0,box.y-90),width:vp.w,height:Math.min(760, vp.h-Math.max(0,box.y-90))} });
  await ctx.close();
}
await b.close();
