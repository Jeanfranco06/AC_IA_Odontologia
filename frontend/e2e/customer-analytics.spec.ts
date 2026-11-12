import { test, expect, type Page } from '@playwright/test';
import fs from 'fs'; import path from 'path';
const root = path.resolve(process.cwd(), '..'); const f = JSON.parse(fs.readFileSync(path.join(root, 'backend/storage/certification/browser-fixture.private.json'), 'utf8'));
async function login(page: Page, actor: 'dentist' | 'reception') {
    await page.goto('/'); await page.getByRole('button', { name: 'Personal', exact: true }).click(); await page.getByLabel('Correo institucional', { exact: true }).fill(f[actor].email); await page.getByLabel('Contraseña', { exact: true }).fill(f.password); await page.getByLabel('Módulo inicial', { exact: true }).selectOption('/customer/agent'); await page.getByRole('button', { name: 'Entrar al Sistema NexoSalud', exact: true }).click(); await page.getByRole('button', { name: 'Análisis inteligente · BI', exact: true }).click();
}
test('Odontólogo: IA15–IA18, filtros reales, fuente y explicación de herramienta BI', async ({ page }) => {
    test.setTimeout(90000); await login(page, 'dentist'); const panel = page.getByRole('region', { name: 'Análisis inteligente del Data Mart' }); await panel.getByLabel('Hasta', { exact: true }).fill(new Date(f.next.fecha).getUTCFullYear() + '-12-31');
    for (const [kind, fact] of [['treatments', 'Fact_TratamientoCustomer'], ['sessions', 'Fact_SesionCustomer'], ['documentation', 'Fact_AtencionCustomer_V2'], ['ai', 'Fact_InteraccionIACustomer']]) {
        await panel.getByLabel('Actividad analítica', { exact: true }).selectOption(kind); await panel.getByRole('button', { name: 'Consultar indicadores', exact: true }).click(); await expect(panel).toContainText(fact); await expect(panel).toContainText('El Mart no es información en tiempo real');
    }
    await panel.getByLabel('Pregunta sobre estos indicadores', { exact: true }).fill('Explica los indicadores agregados y sus límites.'); await panel.getByRole('button', { name: 'Consultar al asistente analítico', exact: true }).click(); await expect(panel.getByRole('status')).toContainText('IA18'); await expect(panel.getByRole('status')).toContainText('Fact_InteraccionIACustomer');
    await page.screenshot({ path: path.join(root, 'docs/customer/ai-agent/evidencias/subsanacion/analisis-odontologo.png'), fullPage: true, animations: 'disabled' });
});
test('Recepción: catálogo operacional acotado y consulta de sesiones', async ({ page }) => {
    await login(page, 'reception'); const panel = page.getByRole('region', { name: 'Análisis inteligente del Data Mart' }); await expect(panel.getByLabel('Actividad analítica', { exact: true }).locator('option')).toHaveCount(2); await panel.getByLabel('Actividad analítica', { exact: true }).selectOption('sessions'); await panel.getByRole('button', { name: 'Consultar indicadores', exact: true }).click(); await expect(panel).toContainText('Fact_SesionCustomer'); await expect(panel.getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: path.join(root, 'docs/customer/ai-agent/evidencias/subsanacion/analisis-recepcion.png'), fullPage: true, animations: 'disabled' });
});