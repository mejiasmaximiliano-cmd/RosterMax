import { test, expect } from '@playwright/test';
import process from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { openConfiguration } from './helpers/configuration';

const phase = process.env.UX_PHASE || 'after';
const savedState = '.tools/ux-fixture-state.json';
const restoreFixture = (phase === 'after' || process.env.UX_REUSE === '1') && existsSync(savedState);
const api = 'http://127.0.0.1:8086/v1/projects/demo-rostermax/databases/(default)/documents/artifacts/roster-max-production';
const headers = { Authorization:'Bearer owner' };
const authOnlyState = (state) => ({...state,origins:state.origins.map(origin=>({...origin,indexedDB:(origin.indexedDB||[]).filter(db=>db.name==='firebaseLocalStorageDb')}))});
// Restore identity/preferences, not a dead tab's Firestore primary-lease record.
test.use({ storageState: restoreFixture ? authOnlyState(JSON.parse(readFileSync(savedState,'utf8'))) : undefined });
test.beforeEach(async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-10-24T15:00:00Z'));
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (['localhost','127.0.0.1'].includes(u.hostname)) return route.continue();
    if (u.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({body:''});
    if (u.hostname === 'apis.google.com') return route.fulfill({contentType:'application/javascript',body:"document.currentScript.dispatchEvent(new Event('error'));"});
    return route.abort();
  });
});
async function fixture(page, request) {
  await page.goto('/');
  if (!restoreFixture) {
    await openConfiguration(page); await page.getByRole('button',{name:'Comenzar',exact:true}).click();
    await page.getByLabel('Días trabajando').fill('14'); await page.getByLabel('Días de franco').fill('14');
    await page.getByLabel('Inicio conocido del ciclo').fill('2026-10-01');
    await page.getByRole('button',{name:'Guardar y continuar',exact:true}).click();
    await page.getByLabel('Nombre visible',{exact:true}).fill('Demo UX');
    await page.getByRole('button',{name:'Terminar y añadir compañeros',exact:true}).click();
  } else {
    const prior=JSON.parse(await readFile('audit/ux-polish/before/observations.json','utf8'));
    await page.evaluate(async (id)=>{
      const {auth,appEnvironment}=await import('/src/lib/firebase.js');
      if(!appEnvironment.isEmulator) throw Error('Fictitious account restore requires emulators');
      const source=await (await fetch('/src/lib/firebase.js')).text();
      const sdk=await import(source.match(/["'](\/node_modules\/\.vite\/deps\/firebase_auth\.js[^"']*)["']/)[1]);
      await sdk.signInWithCustomToken(auth,JSON.stringify({uid:id}));
    },prior.uidFictitious);
  }
  const uid = await page.evaluate(async ()=>(await import('/src/lib/firebase.js')).auth.currentUser.uid);
  const seed = async (path,fields) => { const r=await request.patch(`${api}/${path}`,{headers,data:{fields}}); expect(r.ok()).toBeTruthy(); };
  // Fixed localhost/demo scope only. Keep the comparison dataset identical
  // when a previous local run saved a synthetic expense or feedback message.
  for (const [collection,keep] of [['tasks','ux-plan'],['expenses','ux-expense']]) {
    const r=await request.get(`${api}/users/${uid}/${collection}`,{headers});
    for(const row of (await r.json()).documents||[]) if(row.name.split('/').at(-1)!==keep) await request.delete(`${api}/users/${uid}/${collection}/${row.name.split('/').at(-1)}`,{headers});
  }
  await request.delete(`${api}/admin_stats/accounts`,{headers});
  const priorFeedback=await request.get(`${api}/public/data/feedback`,{headers});
  for(const row of (await priorFeedback.json()).documents||[]) if(row.fields.ownerUid?.stringValue===uid&&row.fields.message?.stringValue==='Comentario ficticio de control UX') await request.delete(`${api}/public/data/feedback/${row.name.split('/').at(-1)}`,{headers});
  const s=v=>({stringValue:v}), n=v=>({integerValue:String(v)}), b=v=>({booleanValue:v}), m=fields=>({mapValue:{fields}});
  await expect.poll(async()=> (await request.get(`${api}/users/${uid}/settings/sync`,{headers})).status()).toBe(200);
  await seed(`users/${uid}/settings/roster`, {workDays:n(14),restDays:n(14),startDate:s('2026-10-01')});
  await seed(`users/${uid}/settings/profile`, {displayName:s('Demo UX')});
  await seed(`users/${uid}/settings/onboarding`, {completed:b(true)});
  await seed(`users/${uid}/tasks/ux-plan`, {title:s('Almuerzo en familia'),date:s('2026-10-25'),category:s('familia'),priority:s('medium'),estimatedMinutes:n(60),completed:b(false)});
  await seed(`users/${uid}/friends/ux-manual`, {name:s('Camila demo'),workDays:n(7),restDays:n(7),startDate:s('2026-10-15'),isSynced:b(false)});
  await seed(`users/${uid}/friends/ux-linked`, {name:s('Alex demo'),workDays:n(14),restDays:n(14),startDate:s('2026-10-01'),isSynced:b(true),syncCode:s('RM-AA12BB34'),ownerUid:s('ux-missing-colleague')});
  await seed(`users/${uid}/settings/finance`, {currency:s('ARS'),monthlyPlans:m({'2026-10':m({ARS:m({monthlyIncome:n(2500000),fixedCosts:n(700000),plannedSavings:n(200000),currency:s('ARS')})})})});
  await seed(`users/${uid}/expenses/ux-expense`, {amount:n(35000),currency:s('ARS'),category:s('transporte'),date:s('2026-10-23'),note:s('Pasaje de ejemplo')});
  await seed(`admins/${uid}`,{active:b(true)});
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('navigation').getByRole('button',{name:'Roster',exact:true}).click();
  await expect(page.getByRole('region',{name:'Calendario de roster'})).toBeVisible();
  await mkdir('.tools',{recursive:true}); await writeFile(savedState,JSON.stringify(authOnlyState(await page.context().storageState({indexedDB:true}))));
  return uid;
}
async function snap(page,name) {
  await mkdir(`audit/ux-polish/${phase}`,{recursive:true});
  await page.screenshot({path:`audit/ux-polish/${phase}/${name}.png`,animations:'disabled'});
}
test('recorrido comparable de seis secciones, tema y primer vistazo', async ({page,request}) => {
  const uid=await fixture(page,request), observations=[];
  for (const [theme,label] of [['light','Claro'],['dark','Oscuro']]) {
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByText('Sincronizado',{exact:true})).toBeVisible();
    for (const tab of ['Roster','Equipo','Franco','Finanzas','Ajustes','CEO']) {
      await page.getByRole('navigation').getByRole('button',{name:tab,exact:true}).click();
      await page.evaluate(()=>window.scrollTo(0,0));
      await expect(page.getByRole('heading',{name:tab==='Finanzas'?'Tu dinero, con un plan':tab==='Roster'?'Tu calendario':tab==='Equipo'?'Mi equipo':tab==='Franco'?'Tu tiempo de franco':tab==='CEO'?'Centro de Mando':'Cuenta y sincronización',exact:true})).toBeVisible();
      await snap(page,`${tab.toLowerCase()}-${theme}-390`);
      if (tab==='Roster') observations.push(await page.evaluate(()=>({theme:document.documentElement.dataset.theme,transitionTop:[...document.querySelectorAll('p')].find(n=>/Próxima (subida|bajada)/.test(n.textContent))?.getBoundingClientRect().top,calendarHeight:document.querySelector('[aria-label="Calendario de roster"]').getBoundingClientRect().height,navBackground:getComputedStyle(document.querySelector('nav')).backgroundColor})));
    }
  }
  await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  await page.getByRole('button',{name:'Claro',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name:'Roster',exact:true}).click();
  await page.setViewportSize({width:412,height:839}); await snap(page,'roster-light-412');
  await page.setViewportSize({width:1440,height:900}); await snap(page,'roster-light-1440');
  await writeFile(`audit/ux-polish/${phase}/observations.json`,JSON.stringify({environment:'LOCAL EMULATORS, fictitious data, same saved test account for before/after; not production',date:'2026-10-24',uidFictitious:uid,observations},null,2));
});

test('hoy y consulta tienen identidad propia; una licencia nunca se presenta como franco', async ({page,request})=>{
  test.skip(phase==='before','Solo captura inicial');
  const id=await fixture(page,request);
  const today=page.getByRole('region',{name:'Estado de hoy',exact:true});
  await expect(today).toContainText('Día 10 de 14 de franco'); await expect(today).toContainText('Próxima subida: 29 oct');
  expect((await today.boundingBox()).y).toBeLessThan(450);
  await page.getByRole('button',{name:/viernes, 30 de octubre: Trabajo/}).click();
  await expect(page.getByRole('region',{name:'Fecha seleccionada'})).toContainText('Consultando');
  await expect(page.getByRole('region',{name:'Fecha seleccionada'})).toContainText('Día 2 de 14 de trabajo');
  await expect(today).toContainText('Día 10 de 14 de franco');
  await request.patch(`${api}/users/${id}/schedule_exceptions/ux-medical`,{headers,data:{fields:{type:{stringValue:'medical'},startDate:{stringValue:'2026-10-24'},endDate:{stringValue:'2026-10-25'}}}});
  await expect(today).toContainText('Carpeta médica'); await expect(today).not.toContainText('de franco');
  await request.delete(`${api}/users/${id}/schedule_exceptions/ux-medical`,{headers});
});

test('ediciones sin guardar: solo avisa si cambiaron, mantiene el texto y no confunde cancelar con anular', async ({page,request})=>{
  test.skip(phase==='before','Solo captura inicial'); await fixture(page,request);
  const nav=page.getByRole('navigation');
  await nav.getByRole('button',{name:'Franco',exact:true}).click();
  await page.getByRole('button',{name:'Nuevo plan',exact:true}).click();
  await page.getByRole('button',{name:'Cerrar formulario',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Nuevo plan',exact:true}).click();
  await page.getByLabel('¿Qué querés hacer?').fill('Borrador privado de prueba');
  await page.getByRole('button',{name:'Cerrar formulario',exact:true}).click();
  const confirm=page.getByRole('dialog',{name:'¿Descartar cambios sin guardar?',exact:true}); await expect(confirm).toBeVisible();
  await confirm.getByRole('button',{name:'Seguir editando',exact:true}).click();
  await expect(page.getByLabel('¿Qué querés hacer?')).toHaveValue('Borrador privado de prueba');
  await nav.getByRole('button',{name:'Finanzas',exact:true}).click(); await expect(confirm).toBeVisible();
  await confirm.getByRole('button',{name:'Descartar edición',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tu dinero, con un plan'})).toBeVisible();
  await nav.getByRole('button',{name:'Roster',exact:true}).click();
  await page.getByRole('button',{name:'Ver historial y registrar',exact:true}).click();
  const ledger=page.getByRole('dialog',{name:'Compensatorios',exact:true});
  await ledger.getByRole('button',{name:'Registrar días pendientes',exact:true}).click();
  await ledger.getByLabel('Cantidad de días').fill('3');
  await page.keyboard.press('Escape'); await expect(confirm).toBeVisible();
  await confirm.getByRole('button',{name:'Seguir editando',exact:true}).click();
  await expect(ledger.getByLabel('Cantidad de días')).toHaveValue('3');
  await ledger.getByRole('button',{name:'Cancelar edición',exact:true}).click(); await expect(confirm).toBeVisible();
  await confirm.getByRole('button',{name:'Descartar edición',exact:true}).click();
  await expect(ledger.getByLabel('Cantidad de días')).toHaveCount(0); await page.keyboard.press('Escape');
  // A real queued SDK write while navigator stays online must not be offered
  // as an unsaved edit that can be cancelled. Demo emulators only.
  await nav.getByRole('button',{name:'Franco',exact:true}).click();
  await page.getByRole('button',{name:'Nuevo plan',exact:true}).click();
  await page.getByLabel('¿Qué querés hacer?').fill('Plan ficticio en espera');
  const network=async enabled=>page.evaluate(async enabled=>{
    const {db,appEnvironment}=await import('/src/lib/firebase.js');
    if(!appEnvironment.isEmulator) throw Error('Network control requires emulators');
    const source=await (await fetch('/src/lib/firebase.js')).text();
    const sdk=await import(source.match(/["'](\/node_modules\/\.vite\/deps\/firebase_firestore\.js[^"']*)["']/)[1]);
    await (enabled?sdk.enableNetwork(db):sdk.disableNetwork(db));
  },enabled);
  await network(false);
  await page.getByRole('button',{name:'Guardar plan',exact:true}).click();
  await expect(page.getByRole('button',{name:'Guardando…',exact:true})).toBeVisible();
  await nav.getByRole('button',{name:'Ajustes',exact:true}).click();
  const waiting=page.getByRole('dialog',{name:'Guardado en curso',exact:true});
  await expect(waiting).toBeVisible(); await expect(waiting.getByRole('button',{name:'Descartar edición'})).toHaveCount(0);
  await waiting.getByRole('button',{name:'Volver al formulario',exact:true}).click();
  await network(true);
  await expect(page.getByText('Plan ficticio en espera',{exact:true})).toBeVisible();
});

test('barra opaca, acciones finales accesibles y texto aumentado en móvil estrecho, tablet y escritorio',async ({page,request})=>{
  test.skip(phase==='before','Solo captura inicial'); test.setTimeout(120000); await fixture(page,request);
  for(const [theme,label] of [['light','Claro'],['dark','Oscuro']]) {
    await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click(); await page.getByRole('button',{name:label,exact:true}).click();
    for(const width of [320,390,412,768,1440]) {
      await page.setViewportSize({width,height:700});
      for(const tab of ['Roster','Equipo','Franco','Finanzas','Ajustes','CEO']) {
        const nav=page.getByRole('navigation'); await nav.getByRole('button',{name:tab,exact:true}).click();
        await expect(nav.getByRole('button',{name:tab,exact:true})).toHaveAttribute('aria-current','page');
        const bg=await nav.evaluate(el=>getComputedStyle(el).backgroundColor); expect(bg).not.toMatch(/\/\s*0\.|rgba\([^)]*,\s*0\./);
        const title={Roster:'Tu calendario',Equipo:'Mi equipo',Franco:'Tu tiempo de franco',Finanzas:'Tu dinero, con un plan',Ajustes:'Cuenta y sincronización',CEO:'Centro de Mando'}[tab];
        await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await expect.poll(async()=>page.evaluate(()=>{window.scrollTo({top:document.documentElement.scrollHeight}); const nodes=[...document.querySelectorAll('main button,main input,main select,main textarea')].filter(n=>!n.closest('details:not([open])')&&n.checkVisibility()&&n.getClientRects().length&&n.getBoundingClientRect().width>0); return (nodes.at(-1)?.getBoundingClientRect().bottom||0)-document.querySelector('nav').getBoundingClientRect().top;}),{message:`${theme} ${width} ${tab}: último control visible sobre la barra`}).toBeLessThanOrEqual(1);
      }
    }
    await page.setViewportSize({width:390,height:420});
    await page.getByRole('navigation').getByRole('button',{name:'Finanzas',exact:true}).click();
    await page.getByLabel('Detalle (opcional)').fill('Formulario con altura reducida');
    await page.getByRole('button',{name:'Registrar gasto',exact:true}).scrollIntoViewIfNeeded(); await snap(page,`formulario-altura-reducida-${theme}-390`);
    // This is text scaling/reflow, not a claim about a physical keyboard.
    await page.evaluate(()=>{ document.documentElement.style.fontSize='200%'; });
    await page.setViewportSize({width:320,height:700});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.evaluate(()=>{ document.documentElement.style.fontSize=''; });
    await page.getByLabel('Detalle (opcional)').fill('');
  }
});

test('contraste medido de controles modificados y estados en ambos temas',async ({page,request})=>{
  test.skip(phase==='before','Solo captura inicial'); await fixture(page,request); const results=[];
  for(const [theme,label] of [['light','Claro'],['dark','Oscuro']]) {
    await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click(); await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByText('Sincronizado',{exact:true})).toBeVisible();
    const destructive=await page.locator('.ux-danger').first().evaluate(el=>({foreground:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
    const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const a=luminance(destructive.foreground),b=luminance(destructive.background); destructive.ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    expect(destructive.ratio).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('navigation').getByRole('button',{name:'Roster',exact:true}).click();
    const samples=await page.evaluate(()=>{
      const canvas=document.createElement('canvas'); canvas.width=canvas.height=1; const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const paint=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);};
      const lum=rgb=>[...rgb].slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      return ['.ux-primary','.ux-secondary','.ux-sync','[aria-label="Calendario de roster"] button[aria-current="date"]'].map(selector=>{
        const el=document.querySelector(selector); const chain=[]; for(let n=el;n;n=n.parentElement) chain.unshift(n);
        ctx.clearRect(0,0,1,1); paint('#fff'); chain.forEach(n=>paint(getComputedStyle(n).backgroundColor)); const bg=ctx.getImageData(0,0,1,1).data;
        const background=[...bg]; paint(getComputedStyle(el).color);const fg=[...ctx.getImageData(0,0,1,1).data]; const l1=lum(background),l2=lum(fg);
        return {selector,foreground:fg,background,ratio:(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
      });
    });
    for(const sample of samples) expect(sample.ratio,`${theme} ${sample.selector}`).toBeGreaterThanOrEqual(4.5);
    results.push({theme,destructive,samples});
  }
  await mkdir('audit/ux-polish/after',{recursive:true}); await writeFile('audit/ux-polish/after/contrast.json',JSON.stringify(results,null,2));
});

test('error de gasto conserva los campos; guardado offline y doble envío de feedback no producen duplicados',async ({page,request,context})=>{
  test.skip(phase==='before','Solo captura inicial'); const id=await fixture(page,request); await page.setViewportSize({width:412,height:839});
  const nav=page.getByRole('navigation'); await nav.getByRole('button',{name:'Finanzas',exact:true}).click();
  const amount=page.getByLabel('Monto (ARS)',{exact:true}); await amount.fill('2500');
  const form=page.locator('form').filter({has:amount});
  await form.getByLabel('Fecha del gasto').fill('2026-11-01');
  await form.getByLabel('Detalle (opcional)').fill('Gasto ficticio offline UX');
  await form.evaluate(el=>el.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await expect(form.getByRole('alert')).toContainText('Elegí la fecha'); await expect(amount).toHaveValue('2500');
  await snap(page,'error-gasto-light-412');
  await form.getByLabel('Fecha del gasto').fill('2026-10-24');
  await context.setOffline(true);
  await form.evaluate(el=>{el.requestSubmit();el.requestSubmit();});
  await expect(page.getByRole('region',{name:'Tu dinero, con un plan'}).getByRole('status')).toContainText('Se guardó en este dispositivo. Consultá el estado de sincronización arriba.');
  await expect(page.getByText('Guardado en este dispositivo · Pendiente de sincronizar',{exact:true})).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async()=>{const r=await request.get(`${api}/users/${id}/expenses`,{headers});return ((await r.json()).documents||[]).filter(d=>d.fields.note?.stringValue==='Gasto ficticio offline UX').length;}).toBe(1);
  await expect(page.getByText('Sincronizado',{exact:true})).toBeVisible();
  await nav.getByRole('button',{name:'Ajustes',exact:true}).click(); await page.getByRole('button',{name:'Reportar un problema',exact:true}).click();
  const field=page.getByLabel('Qué pasó o qué necesitás'); await field.fill('Comentario ficticio de control UX');
  const feedback=page.locator('form').filter({has:field});
  await feedback.evaluate(el=>{el.requestSubmit();el.requestSubmit();});
  await expect(feedback.getByRole('status')).toContainText('Comentario recibido');
  const r=await request.get(`${api}/public/data/feedback`,{headers});
  expect(((await r.json()).documents||[]).filter(d=>d.fields.ownerUid?.stringValue===id&&d.fields.message?.stringValue==='Comentario ficticio de control UX')).toHaveLength(1);
});
