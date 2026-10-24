export async function openConfiguration(page) {
  await page.getByRole('button', { name: 'Omitir presentación', exact: true }).click();
  await page.getByRole('button', { name: 'Configurar mi roster', exact: true }).click();
}
