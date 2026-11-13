const { test, expect } = require('@playwright/test');
const base = process.env.MMC_BASE_URL || 'https://clopez-spmas.github.io/Ergonomic-analyzer/';
const modules = [
  { name: 'Simple', path: 'mmc/' },
  { name: 'Variable', path: 'mmc/variable/' },
  { name: 'Compuesta', path: 'mmc/compuesta/' },
  { name: 'Secuencial', path: 'mmc/secuencial/' },
];
const errors = [];
async function openModule(page, module) {
  await page.goto(base + module.path);
  if (module.name === 'Simple') {
    await page.locator('#enter').click();
    await expect(page.locator('#methods')).toBeVisible();
    await page.locator('[data-method="simple"]').click();
    await expect(page.locator('#simple')).toBeVisible();
  }
}

test.beforeEach(async ({ page }) => {
  // Fuerza la descarga JSON normal, reproducible en Chromium de CI.
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept('prueba-mmc.json'));
});
test.afterEach(async () => { expect(errors.splice(0), 'Errores JavaScript no controlados').toEqual([]); });

test('Portal: enlace MMC accesible', async ({ page }) => {
  await page.goto(base);
  await page.locator('#enterProgram').click();
  await expect(page.locator('#methodScreen')).toBeVisible();
  const entry = page.locator('[data-method="mmc"]');
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page).toHaveURL(/\/mmc\/?$/);
  await expect(page.getByRole('heading', { name: 'MMC Analyzer' })).toBeVisible();
});

test('Documentación PDF publicada y accesible', async ({ request, page }) => {
  await page.goto(base + 'mmc/');
  const link = page.locator('#instructionsLink');
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href).toMatch(/\.pdf(?:$|\?)/);
  const response = await request.get(new URL(href, base + 'mmc/').toString());
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] || '').toMatch(/pdf|octet-stream/);
  const bytes = await response.body();
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
});

for (const module of modules) {
  test(module.name + ': carga, navegación, resultados y simulación', async ({ page }) => {
    await openModule(page, module);
    await expect(page.locator('#page1')).toBeVisible();
    await expect(page.locator('#pageNum')).toHaveText('1');
    for (let i = 2; i <= 4; i++) {
      await page.locator('#next').click();
      await expect(page.locator('#pageNum')).toHaveText(String(i));
      await expect(page.locator('#page' + i)).toBeVisible();
    }
    await expect(page.locator('#results')).toBeVisible().catch(async () => {
      // Simple usa #summary como contenedor de resultados.
      await expect(page.locator('#summary')).toBeVisible();
    });
    await page.locator('#openSimulation, #openSim').click();
    await expect(page.locator('#pageNum')).toHaveText('5');
    await expect(page.locator('#page5')).toBeVisible();
    await page.locator('#backResults').click();
    await expect(page.locator('#pageNum')).toHaveText('4');
  });

  test(module.name + ': guardar JSON y recuperar estudio', async ({ page }) => {
    await openModule(page, module);
    const meta = page.locator('[data-meta]').first();
    if (await meta.count()) await meta.fill('PRUEBA PLAYWRIGHT');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#save').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/i);
    const fs = require('fs');
    const file = await download.path();
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(json.application).toBe('MMC Analyzer');
    expect(json.module).toBe(module.name.toLowerCase());
    await page.reload();
    if (module.name === 'Simple') {
      await page.locator('#enter').click();
      await page.locator('[data-method="simple"]').click();
      await expect(page.locator('#page1')).toBeVisible();
    }
    await page.locator('#load').setInputFiles(file);
    await expect(page.locator('#status')).toContainText(/cargad/i);
    if (await meta.count()) await expect(page.locator('[data-meta]').first()).toHaveValue('PRUEBA PLAYWRIGHT');
  });
}
