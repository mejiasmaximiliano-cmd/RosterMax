import { test, expect } from '@playwright/test';

const ROOT = 'artifacts/roster-max-production';
const API = 'http://127.0.0.1:8086/v1/projects/demo-rostermax/databases/(default)/documents';
const headers = { Authorization:'Bearer owner' };
test.beforeEach(async ({ page }) => {
  await page.route('**/*',(route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1','localhost'].includes(url.hostname)) return route.continue();
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType:'application/javascript',body:'' });
    if (url.hostname === 'apis.google.com') return route.fulfill({ contentType:'application/javascript',body:"document.currentScript.dispatchEvent(new Event('error'));" });
    return route.abort();
  });
});
async function setup(page) {
  await page.goto('/'); await page.getByRole('button',{name:'Comenzar',exact:true}).click();
  await page.getByLabel('Días trabajando').fill('7'); await page.getByLabel('Días de franco').fill('7');
  await page.getByRole('button',{name:'Guardar y continuar'}).click();
  await page.getByLabel('Nombre visible',{exact:true}).fill('Prueba ficticia de privacidad');
  await page.getByRole('button',{name:'Terminar y añadir compañeros'}).click();
  return page.evaluate(async () => (await import('/src/lib/firebase.js')).auth.currentUser.uid);
}
async function ownedEvents(request, uid) {
  const response = await request.post(API + ':runQuery',{ headers, data:{ structuredQuery:{ from:[{collectionId:'feature_events',allDescendants:true}], where:{fieldFilter:{field:{fieldPath:'ownerUid'},op:'EQUAL',value:{stringValue:uid}}} } } });
  expect(response.ok()).toBeTruthy(); return (await response.json()).filter((row) => row.document).map((row) => row.document);
}
test('consentimiento, operación estable y borrado de medición no borran el plan privado', async ({ page, request }) => {
  const uid = await setup(page);
  expect(await ownedEvents(request,uid)).toHaveLength(0);
  await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  await page.getByRole('switch').click();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','true');
  await page.getByRole('navigation').getByRole('button',{name:'Franco',exact:true}).click();
  await page.getByRole('button',{name:'Nuevo plan',exact:true}).click();
  await page.getByLabel('¿Qué quieres hacer?').fill('Plan privado de prueba');
  await page.getByRole('button',{name:'Guardar plan',exact:true}).click();
  await expect.poll(async () => (await ownedEvents(request,uid)).length).toBe(1);
  const event = (await ownedEvents(request,uid))[0];
  expect(Object.keys(event.fields).sort()).toEqual(['occurredAt','ownerUid','recordedAt','type']);
  expect(event.fields.type.stringValue).toBe('plan_saved');
  await page.reload(); expect(await ownedEvents(request,uid)).toHaveLength(1);
  await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  page.once('dialog',(dialog) => dialog.accept());
  await page.getByRole('button',{name:'Desactivar y borrar mi medición'}).click();
  await expect(page.getByText('Medición desactivada y registros de actividad, funciones y campañas de tu cuenta eliminados del servidor.',{exact:false})).toBeVisible();
  expect(await ownedEvents(request,uid)).toHaveLength(0);
  await page.getByRole('navigation').getByRole('button',{name:'Franco',exact:true}).click();
  await expect(page.getByRole('button',{name:'Editar: Plan privado de prueba',exact:true})).toBeVisible();
});

test('retirar, recargar y reactivar la compartición no recrea un enlace retirado', async ({ page, request }) => {
  const uid = await setup(page);
  await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  const settings = async () => (await (await request.get(`${API}/${ROOT}/users/${uid}/settings/sync`,{headers})).json()).fields;
  const first = (await settings()).code.stringValue;
  await expect.poll(async () => (await request.get(`${API}/${ROOT}/public/data/sync_codes/${first}`,{headers})).status()).toBe(200);
  page.once('dialog',(dialog) => dialog.accept());
  await page.getByRole('button',{name:'Dejar de compartir mi roster'}).click();
  await expect(page.getByRole('button',{name:'Reactivar con un código nuevo'})).toBeEnabled();
  expect((await settings()).enabled.booleanValue).toBe(false);
  await page.reload();
  await page.getByRole('navigation').getByRole('button',{name:'Ajustes',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reactivar con un código nuevo'})).toBeEnabled();
  expect((await request.get(`${API}/${ROOT}/public/data/sync_codes/${first}`,{headers})).status()).toBe(404);
  await page.getByRole('button',{name:'Reactivar con un código nuevo'}).click();
  await expect(page.getByRole('button',{name:'Dejar de compartir mi roster'})).toBeEnabled();
  const next = (await settings()).code.stringValue;
  expect(next).not.toBe(first);
  await expect.poll(async () => (await request.get(`${API}/${ROOT}/public/data/sync_codes/${next}`,{headers})).status()).toBe(200);
  expect((await request.get(`${API}/${ROOT}/public/data/sync_codes/${first}`,{headers})).status()).toBe(404);
});
