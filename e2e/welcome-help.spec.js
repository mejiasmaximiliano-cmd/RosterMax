import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { openConfiguration } from './helpers/configuration';
import { FAQ_GROUPS } from '../src/lib/helpContent.js';

const API = 'http://127.0.0.1:8086/v1/projects/demo-rostermax/databases/(default)/documents';
const ROOT = 'artifacts/roster-max-production';
const headers = { Authorization: 'Bearer owner' };
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const intro = (page) => page.getByRole('dialog', { name: 'Conocé RosterMax', exact: true });
const uid = (page) => page.evaluate(async () => (await import('/src/lib/firebase.js')).auth.currentUser.uid);
const get = async (request, path) => { const response = await request.get(`${API}/${ROOT}/${path}`, { headers }); return response.status() === 404 ? null : await response.json(); };
const seed = (request, path, fields) => request.patch(`${API}/${ROOT}/${path}`, { headers, data: { fields } });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType: 'application/javascript', body: '' });
    if (url.hostname === 'apis.google.com') return route.fulfill({ contentType: 'application/javascript', body: "document.currentScript.dispatchEvent(new Event('error'));" });
    if (url.hostname === 'www.google.com' && url.pathname.endsWith('cleardot.gif')) return route.fulfill({ body: '' });
    return route.abort();
  });
});
async function configure(page) {
  await page.goto('/'); await openConfiguration(page);
  await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await page.getByLabel('Días trabajando').fill('14'); await page.getByLabel('Días de franco').fill('14');
  await page.getByLabel('Inicio conocido del ciclo').fill('2026-10-01');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await page.getByLabel('Nombre visible', { exact: true }).fill('Ejemplo ficticio');
  await page.getByRole('button', { name: 'Terminar y añadir compañeros' }).click();
  return uid(page);
}
async function screenshot(page, name) {
  await mkdir('audit/welcome', { recursive: true });
  if (await page.getByRole('dialog').count()) await page.getByRole('dialog').evaluate((node) => { node.scrollTop = 0; const body = node.querySelector('[data-dialog-body]'); if (body) body.scrollTop = 0; });
  await page.screenshot({ path: `audit/welcome/${name}.png`, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
}

test('bienvenida nueva clara: cinco escenas manuales sin audio ni escrituras, omitir/reabrir y temas equivalentes', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(intro(page)).toBeVisible(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const id = await uid(page);
  const before = await get(request, `users/${id}/settings/roster`); expect(before).toBeNull();
  await expect(intro(page).getByRole('button', { name: 'Escuchar explicación' })).toHaveCount(0);
  const titles = ['Sabé cuándo subís y cuándo bajás','Encontrá francos en común','Dale lugar a tus planes','Llevá tus compensatorios','Organizá tu dinero'];
  for (const theme of ['light','dark']) {
    if (theme === 'dark') {
      await page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact:true }).click();
      await page.getByRole('button', { name: 'Oscuro', exact:true }).click();
      await page.getByRole('button', { name: 'Conocé RosterMax', exact:true }).click();
    }
    for (let i = 0; i < 5; i++) {
      await expect(intro(page).getByRole('heading', { name: titles[i], exact:true })).toBeVisible();
      await expect(intro(page).getByText(`Historia ${i+1} de 5`, { exact:true })).toBeVisible();
      const footer = intro(page).locator('footer');
      const bounds = await footer.boundingBox();
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
      await expect(footer.getByRole('button', { name:'Ya tengo cuenta', exact:true })).toBeVisible();
      await intro(page).getByRole('button', { name:/· demo$/ }).click();
      if (i === 3) { await expect(intro(page).getByText('Empresa debía 3 − disfrutaste 1 = quedan 2.', { exact:false })).toBeVisible(); }
      await screenshot(page, `historia-${i+1}-${theme}-390`);
      if (i < 4) await intro(page).getByRole('button', { name:'Siguiente', exact:true }).click();
    }
    await intro(page).getByRole('button', { name:'Configurar mi diagrama', exact:true }).click();
    await expect(page.getByRole('button', { name:'Comenzar', exact:true })).toBeVisible();
    expect(await get(request, `users/${id}/settings/roster`)).toEqual(before);
    await page.getByRole('button', { name:'Lo haré más tarde', exact:true }).click();
  }
  for (const name of ['tasks','expenses','goals','compensatory_debts','compensatory_entries']) {
    const response = await request.get(`${API}/${ROOT}/users/${id}/${name}`, { headers }); expect((await response.json()).documents || []).toHaveLength(0);
  }
  await page.reload(); await expect(page.getByRole('region', { name:'Mis compensatorios' })).toBeVisible();
  await expect(intro(page)).toHaveCount(0); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  // A saved preference is recovered from the account, not replaced by the new default.
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('rostermax:theme:')) localStorage.removeItem(key); });
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect((await get(request, `users/${id}/settings/theme`)).fields.mode.stringValue).toBe('dark');
});

test('cerrar y Ya tengo cuenta desde el inicio conservan sesión y no guardan configuración; movimiento reducido y foco', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion:'reduce' }); await page.goto('/'); await expect(intro(page)).toBeVisible();
  const id = await uid(page);
  await expect(intro(page).getByRole('button', { name:'Cerrar Conocé RosterMax' })).toBeFocused();
  const duration = await page.locator('.story-scene').evaluate((node) => parseFloat(getComputedStyle(node).animationDuration)); expect(duration).toBeLessThan(0.001);
  await page.keyboard.press('ArrowRight'); await expect(intro(page).getByText('Historia 2 de 5', { exact:true })).toBeVisible();
  await page.keyboard.press('ArrowLeft'); await expect(intro(page).getByText('Historia 1 de 5', { exact:true })).toBeVisible();
  await intro(page).getByRole('button', { name:'Ya tengo cuenta', exact:true }).click();
  await expect(page.getByRole('dialog', { name:'Ingresar a una cuenta existente' })).toBeVisible();
  await page.getByRole('button', { name:'Cancelar', exact:true }).click();
  expect(await uid(page)).toBe(id); expect(await get(request, `users/${id}/settings/roster`)).toBeNull();
  await page.getByRole('navigation').getByRole('button', { name:'Ajustes', exact:true }).click();
  await page.getByRole('button', { name:'Conocé RosterMax', exact:true }).click(); await page.keyboard.press('Escape');
  await expect(intro(page)).toHaveCount(0);
});

test('usuario configurado, invitación pendiente, ayuda y retorno sin modificar el diagrama; claro/oscuro tablet y escritorio', async ({ page, request }) => {
  const id = await configure(page); const stored = await get(request, `users/${id}/settings/roster`);
  await seed(request, `public/data/sync_codes/RM-AB12CD34`, { ownerUid:{stringValue:'fake-colleague'}, code:{stringValue:'RM-AB12CD34'}, name:{stringValue:'Compañero de demostración'}, workDays:{integerValue:'7'}, restDays:{integerValue:'7'}, startDate:{stringValue:'2026-10-08'}, updatedAt:{timestampValue:'2026-10-24T12:00:00Z'} });
  await page.goto('/?sync=RM-AB12CD34'); await expect(page.getByText('Invitación recibida', {exact:true})).toBeVisible(); await expect(intro(page)).toHaveCount(0);
  for (const width of [768,1440]) for (const [theme,label] of [['light','Claro'],['dark','Oscuro']]) {
    await page.setViewportSize({width,height:900});
    await page.getByRole('navigation').getByRole('button', { name:'Ajustes', exact:true }).click();
    await page.getByRole('button', { name:label, exact:true }).click();
    await page.getByRole('button', { name:'Preguntas frecuentes', exact:true }).click();
    const help = page.getByRole('dialog', { name:'Ayuda y cómo usar RosterMax', exact:true }); await expect(help).toBeVisible();
    await screenshot(page, `faq-${theme}-${width}`);
    await help.getByText('¿Qué pasa al dejar de compartir con todos y al reactivar?', {exact:true}).click();
    await help.getByRole('button', {name:'Ir a compartir mi roster',exact:true}).last().click();
    await expect(page.locator('#section-sharing')).toBeFocused();
    await page.getByRole('button', {name:'Volver a preguntas frecuentes',exact:true}).click(); await expect(help).toBeVisible(); await page.keyboard.press('Escape');
    await page.getByRole('button', {name:'Conocé RosterMax',exact:true}).click();
    for(let i=0;i<4;i++) await intro(page).getByRole('button',{name:'Siguiente',exact:true}).click();
    await intro(page).getByRole('button',{name:'Ver invitación',exact:true}).click();
    await expect(page.getByText('Invitación recibida',{exact:true})).toBeVisible(); expect(new URL(page.url()).searchParams.get('sync')).toBe('RM-AB12CD34');
  }
  expect((await get(request, `users/${id}/settings/roster`)).fields).toEqual(stored.fields);
});

test('compartir: cancelar sin escrituras, fallo de servidor conserva estado y quitar de lista no revoca acceso', async ({ page, request }) => {
  const id=await configure(page); await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  const settings=()=>get(request,`users/${id}/settings/sync`); const initial=await settings(); const code=initial.fields.code.stringValue;
  await expect.poll(async()=> (await get(request,`public/data/sync_codes/${code}`))?.fields.ownerUid.stringValue).toBe(id);
  const button=page.getByRole('button',{name:'Dejar de compartir con todos',exact:true});
  await button.click(); const dialog=page.getByRole('dialog',{name:'Dejar de compartir con todos',exact:true});
  await expect(dialog.getByText('Conservás los compañeros de tu lista y todos tus datos.',{exact:true})).toBeVisible();
  await screenshot(page,'compartir-global-light-412');
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click(); expect(await settings()).toEqual(initial);
  // Emulator-only corruption makes the delete fail rules; the atomic batch must roll back.
  const publicDoc=await get(request,`public/data/sync_codes/${code}`);
  await seed(request,`public/data/sync_codes/${code}`,{...publicDoc.fields,ownerUid:{stringValue:'different-fictional-owner'}});
  await button.click(); await dialog.getByRole('button',{name:'Dejar de compartir con todos',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('No se confirmó');
  expect((await settings()).fields.enabled.booleanValue).not.toBe(false);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await seed(request,`public/data/sync_codes/${code}`,publicDoc.fields);
  await seed(request,`users/${id}/friends/fake-manual`,{name:{stringValue:'Camila demo'},isSynced:{booleanValue:false},workDays:{integerValue:'7'},restDays:{integerValue:'7'},startDate:{stringValue:'2026-10-01'}});
  await page.getByRole('navigation').getByRole('button',{name:'Equipo',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar a Camila demo',exact:true}).click();
  const individual=page.getByRole('dialog',{name:'Quitar a Camila demo de mi lista',exact:true});
  await screenshot(page,'quitar-companero-light-412');
  await expect(individual).toContainText('no revoca su acceso'); await individual.getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await get(request,`users/${id}/friends/fake-manual`)).not.toBeNull();
  await page.getByRole('button',{name:'Eliminar a Camila demo',exact:true}).click(); await individual.getByRole('button',{name:'Quitar de mi lista',exact:true}).click();
  await expect(individual).toHaveCount(0); expect(await get(request,`users/${id}/friends/fake-manual`)).toBeNull();
  expect((await settings()).fields.code.stringValue).toBe(code); expect(await get(request,`public/data/sync_codes/${code}`)).not.toBeNull();
});

test('comprobador visible: red actual, última versión con hora y error posterior sin falso éxito', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:'Omitir presentación',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  let fail=false;
  await page.route('**/api/version?check=*',route=>route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify({version:'beta-0.8',commit:SHA,build:'a'.repeat(20),environment:'emulator',checkedNonce:new URL(route.request().url()).searchParams.get('check'),checkedAt:new Date().toISOString()})}));
  const panel=page.getByRole('region',{name:'Actualización de RosterMax',exact:true});
  await panel.getByRole('button',{name:'Comprobar actualización',exact:true}).click(); await expect(panel.getByRole('heading',{name:'Tenés la última versión',exact:true})).toBeVisible();
  await expect(panel).toContainText('Comprobación por red:'); fail=true;
  await panel.getByRole('button',{name:'Comprobar actualización',exact:true}).click(); await expect(panel.getByRole('heading',{name:'No se pudo comprobar la actualización',exact:true})).toBeVisible();
  await expect(panel.getByText('Tenés la última versión',{exact:true})).toHaveCount(0);
});

test('comprobador coordina comprobando, descarga, fallo y worker listo sin activar ni recargar', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeWorker extends EventTarget { state='installing'; postMessage(data, ports) { window.workerMessages.push(data.type); ports[0].postMessage({type:'ROSTERMAX_VERSION',build:'b'.repeat(20)}); } }
    class FakeRegistration extends EventTarget {
      installing=null; waiting=null; active=null;
      async update() { this.installing=new FakeWorker(); this.dispatchEvent(new Event('updatefound')); }
      complete() { const worker=this.installing; this.installing=null; this.waiting=worker; worker.state='installed'; worker.dispatchEvent(new Event('statechange')); }
      fail() { const worker=this.installing; this.installing=null; worker.state='redundant'; worker.dispatchEvent(new Event('statechange')); }
    }
    window.workerMessages=[]; window.updateFixture=new FakeRegistration();
    Object.defineProperty(navigator,'serviceWorker',{value:{getRegistration:async()=>window.updateFixture,ready:Promise.resolve(window.updateFixture)}});
  });
  await page.goto('/'); await page.getByRole('button',{name:'Omitir presentación',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  let release;
  await page.route('**/api/version?check=*',async(route)=>{ await new Promise(resolve=>{release=resolve;}); return route.fulfill({contentType:'application/json',body:JSON.stringify({version:'next-demo',commit:'e'.repeat(40),build:'b'.repeat(20),environment:'emulator',checkedNonce:new URL(route.request().url()).searchParams.get('check'),checkedAt:new Date().toISOString()})}); });
  const panel=page.getByRole('region',{name:'Actualización de RosterMax',exact:true});
  await panel.getByRole('button',{name:'Comprobar actualización',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'Comprobando…',exact:true})).toBeVisible();
  await expect.poll(()=>typeof release).toBe('function'); release();
  await expect(panel.getByRole('heading',{name:'Descargando actualización',exact:true})).toBeVisible();
  await page.evaluate(()=>window.updateFixture.fail());
  await expect(panel.getByRole('heading',{name:'No se pudo comprobar la actualización',exact:true})).toBeVisible();
  release = undefined;
  await panel.getByRole('button',{name:'Comprobar actualización',exact:true}).click();
  await expect.poll(()=>typeof release).toBe('function'); release();
  await expect(panel.getByRole('heading',{name:'Descargando actualización',exact:true})).toBeVisible();
  await page.evaluate(()=>window.updateFixture.complete());
  await expect(panel.getByRole('heading',{name:'Actualización lista para activar',exact:true})).toBeVisible();
  await screenshot(page,'version-lista-light-412');
  expect(await page.evaluate(()=>window.workerMessages)).toEqual(['GET_ROSTERMAX_VERSION']);
  await expect(panel).toContainText('No borres datos ni reinstales');
});

test('CEO protegido muestra cobertura antes/excluida/incluida y explica muestra vacía por filtros', async ({ page, request }) => {
  const id=await configure(page);
  await expect(page.getByRole('navigation').getByRole('button',{name:'CEO',exact:true})).toHaveCount(0);
  for (const owner of [id,'coverage-test-a','coverage-test-b']) await seed(request,`public/data/activity/${owner}`,{ownerUid:{stringValue:owner},lastActiveAt:{timestampValue:new Date().toISOString()},accountType:{stringValue:'guest'},installDetected:{booleanValue:false},rosterConfigured:{booleanValue:true}});
  await seed(request,`admins/${id}`,{active:{booleanValue:true}});
  const all=await request.get(`${API}/${ROOT}/public/data/activity`,{headers}); const owners=[...new Set(((await all.json()).documents||[]).map(row=>row.fields.ownerUid.stringValue))];
  await page.getByRole('navigation').getByRole('button',{name:'CEO',exact:true}).click();
  const region=page.getByRole('region',{name:'Cuentas y actividad del CEO',exact:true});
  const coverage=region.getByLabel('Cobertura de actividad antes y después de filtros');
  await expect(coverage).toContainText(`Antes de filtros: ${owners.length} cuentas medidas`);
  await region.getByRole('checkbox',{name:'Excluir mi cuenta de la actividad medida',exact:true}).check();
  await expect(coverage).toContainText(`Excluidas: 1 · Incluidas: ${owners.length-1}`);
  await region.getByLabel('UID de pruebas a excluir de actividad').fill(owners.filter(owner=>owner!==id).join(' '));
  await expect(coverage).toContainText('Incluidas: 0'); await expect(coverage).toContainText('vacía por los filtros');
  await expect(coverage).not.toContainText('No hay medición original');
  await screenshot(page,'ceo-cobertura-light-412');
});

test('invitación de usuario nuevo atraviesa bienvenida y configuración sin aceptación automática', async ({ page, request }) => {
  const code = 'RM-CD34EF56';
  await seed(request, `public/data/sync_codes/${code}`, { ownerUid:{stringValue:'new-invite-demo'}, syncCode:{stringValue:code}, name:{stringValue:'Colega ficticio'}, workDays:{integerValue:'7'}, restDays:{integerValue:'7'}, startDate:{stringValue:'2026-10-08'} });
  await page.goto(`/?sync=${code}`); await expect(intro(page)).toBeVisible();
  const id = await uid(page);
  for (let i=0;i<4;i++) await intro(page).getByRole('button',{name:'Siguiente',exact:true}).click();
  await intro(page).getByRole('button',{name:'Configurar mi diagrama',exact:true}).click();
  expect(await get(request, `users/${id}/settings/roster`)).toBeNull();
  await page.getByRole('button',{name:'Comenzar',exact:true}).click();
  await page.getByLabel('Días trabajando').fill('14'); await page.getByLabel('Días de franco').fill('14');
  await page.getByLabel('Inicio conocido del ciclo').fill('2026-10-01');
  await page.getByRole('button',{name:'Guardar y continuar',exact:true}).click();
  await page.getByLabel('Nombre visible',{exact:true}).fill('Nuevo ejemplo ficticio');
  await page.getByRole('button',{name:'Terminar y añadir compañeros',exact:true}).click();
  await expect(page.getByText('Invitación recibida',{exact:true})).toBeVisible();
  expect(new URL(page.url()).searchParams.get('sync')).toBe(code);
  const friends = await request.get(`${API}/${ROOT}/users/${id}/friends`, {headers});
  expect((await friends.json()).documents || []).toHaveLength(0);
});

test('cada destino de FAQ abre la función real, enfoca y permite volver sin cambiar el diagrama', async ({ page, request }) => {
  const id = await configure(page), before = await get(request, `users/${id}/settings/roster`);
  await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  await page.getByRole('button',{name:'Preguntas frecuentes',exact:true}).click();
  const help = page.getByRole('dialog',{name:'Ayuda y cómo usar RosterMax',exact:true});
  const uniqueTargets = new Map();
  for (const question of FAQ_GROUPS.flatMap(group=>group.questions)) if (question.target) uniqueTargets.set(question.target, question);
  for (const [target, question] of uniqueTargets) {
    await help.getByText(question.title,{exact:true}).click();
    await help.getByRole('button',{name:question.action,exact:true}).last().click();
    await expect(page.locator(`#section-${target}`)).toBeFocused();
    await expect(page.locator(`#section-${target}`)).toBeVisible();
    await page.getByRole('button',{name:'Volver a preguntas frecuentes',exact:true}).click();
    await expect(help).toBeVisible();
  }
  await help.getByRole('button',{name:'Reportar un problema',exact:true}).click();
  await expect(page.locator('#section-feedback')).toBeFocused();
  expect((await get(request, `users/${id}/settings/roster`)).fields).toEqual(before.fields);
});
