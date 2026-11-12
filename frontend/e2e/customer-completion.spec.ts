import {test,expect,type Page} from '@playwright/test';
import fs from 'fs';
import path from 'path';
const root=path.resolve(process.cwd(),'..');
const f=JSON.parse(fs.readFileSync(path.join(root,'backend/storage/certification/browser-fixture.private.json'),'utf8'));
const screenshots=path.join(root,'docs/customer/ai-agent/evidencias/subsanacion');fs.mkdirSync(screenshots,{recursive:true});
test.describe.configure({mode:'serial'});
async function patientLogin(page:Page){await page.goto('/portal-customer');await page.getByLabel('Documento de identidad (DNI)',{exact:true}).fill(f.patient.dni);await page.getByLabel('Contraseña',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Entrar a mi historial',exact:true}).click();await expect(page.getByRole('region',{name:'Continuidad y revisión supervisada'})).toBeVisible();}
async function staffLogin(page:Page,actor:'dentist'|'reception'){
 await page.goto('/');await page.getByRole('button',{name:'Personal',exact:true}).click();
 await page.getByLabel('Correo institucional',{exact:true}).fill(f[actor].email);await page.getByLabel('Contraseña',{exact:true}).fill(f.password);await page.getByLabel('Módulo inicial',{exact:true}).selectOption('/customer/agent');await page.getByRole('button',{name:'Entrar al Sistema NexoSalud',exact:true}).click();await expect(page).toHaveURL(/customer\/agent/);await expect(page.getByRole('region',{name:'Continuidad y revisión supervisada'})).toBeVisible();
}
test('Paciente: login real, cronograma, solicitud de programación y persistencia',async({page})=>{
 await patientLogin(page);await expect(page.getByLabel('Sesión prevista',{exact:true})).toBeVisible();await page.getByLabel('Sesión prevista',{exact:true}).selectOption('2');await page.getByLabel('Horario disponible',{exact:true}).selectOption(String(f.next.id_disponibilidad));
 await page.getByRole('button',{name:'Preparar solicitud',exact:true}).click();await expect(page.getByRole('button',{name:'Confirmar y enviar a recepción',exact:true})).toBeVisible();await page.getByRole('button',{name:'Confirmar y enviar a recepción',exact:true}).click();await expect(page.getByRole('status')).toContainText('Solicitud confirmada');
 await page.reload();await page.getByText('Bandeja de solicitudes y revisiones humanas',{exact:true}).click();await expect(page.getByText('Programación de sesión · Pendiente',{exact:false}).first()).toBeVisible();await page.screenshot({path:path.join(screenshots,'portal-solicitud.png'),fullPage:true,animations:'disabled'});
});
test('Recepción: login real, revisión humana y aplicación de agenda oficial',async({page})=>{
 await staffLogin(page,'reception');const card=page.getByRole('region',{name:'Continuidad y revisión supervisada'}).locator('article').filter({hasText:'Programación de sesión'}).filter({hasText:'Sesión 2'}).first();await expect(card).toBeVisible();
 await card.getByRole('textbox').fill('Revisión administrativa sintética de la disponibilidad.');await card.getByRole('button',{name:'Aprobada',exact:true}).click();await expect(card.getByRole('button',{name:'Aplicar programación aprobada',exact:true})).toBeVisible();await card.getByRole('button',{name:'Aplicar programación aprobada',exact:true}).click();await expect(page.getByRole('status')).toContainText('Programación aplicada');await expect(card).toContainText('Aplicada');await page.screenshot({path:path.join(screenshots,'recepcion-programacion.png'),fullPage:true,animations:'disabled'});
});
test('Paciente: reprogramación preparada y confirmada sin alterar agenda',async({page})=>{
 await patientLogin(page);await page.getByRole('tab',{name:/Reprogramar/}).click();const selection=page.getByLabel('Sesión que quieres mover',{exact:true});const option=selection.locator('option').filter({hasText:'Sesión 2'});await expect(option).toHaveCount(1);await selection.selectOption((await option.getAttribute('value'))!);await page.getByLabel('Motivo del cambio',{exact:true}).fill('Cambio administrativo sintético de navegador');await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar y enviar',exact:true}).click();await expect(page.getByText('Pendiente',{exact:true}).first()).toBeVisible();await page.screenshot({path:path.join(screenshots,'portal-reprogramacion.png'),fullPage:true,animations:'disabled'});
});
test('Recepción: revisión y aplicación real de reprogramación',async({page})=>{
 await staffLogin(page,'reception');await page.getByRole('button',{name:/^Reprogramaciones/}).click();const card=page.locator('article').filter({hasText:f.patient.nombres}).filter({hasText:'Sesión #2'}).first();await card.getByRole('button',{name:'Aprobar',exact:true}).click();await page.getByRole('dialog').getByRole('textbox').fill('Disponibilidad revisada para fixture de navegador.');await page.getByRole('dialog').getByRole('button',{name:'Confirmar Estado',exact:true}).click();await card.getByRole('button',{name:'Aplicar en Agenda Oficial',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('combobox').selectOption(String(f.reschedule.id_disponibilidad));await dialog.getByRole('textbox').fill('Cambio oficial de horario sintético.');await dialog.getByRole('button',{name:'Confirmar Cambio en Agenda',exact:true}).click();await expect(card).toContainText('Aplicada');await page.screenshot({path:path.join(screenshots,'recepcion-reprogramacion.png'),fullPage:true,animations:'disabled'});
});
test('Odontólogo: atención sin ID manual, borrador por secciones y transferencia explícita',async({page})=>{
 test.setTimeout(120000);
 await staffLogin(page,'dentist');await page.getByRole('combobox',{name:'Pacientes Asignados a tu Turno',exact:true}).click();await page.getByRole('option').filter({hasText:f.service.nombre}).first().click();
 const panel=page.getByRole('region',{name:'Continuidad y revisión supervisada'});await expect(panel.getByLabel('Notas originales del profesional',{exact:true})).toBeVisible();
 await panel.getByLabel('Notas originales del profesional',{exact:true}).fill('Motivo: Nota sintética de navegador\nAlergias: Antecedente sintético que requiere revisión profesional\nEvaluación: Evaluación declarada por profesional de prueba\nProcedimiento: Procedimiento documental confirmado');
 await panel.getByRole('button',{name:'Preparar borrador extractivo',exact:true}).click();await expect(panel.getByLabel('Evaluación declarada',{exact:true})).toHaveValue('Evaluación declarada por profesional de prueba');
 await panel.getByLabel('Observaciones',{exact:true}).fill('Corrección humana verificada desde navegador');await panel.getByRole('button',{name:'Guardar nueva versión corregida',exact:true}).click();await expect(panel).toContainText('Versión 2');
 await panel.getByRole('checkbox',{name:'He revisado cada sección y confirmo la acción profesional seleccionada.',exact:true}).check();await panel.getByRole('button',{name:'Transferir esta versión a la ficha oficial',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Contenido transferido');
 await panel.getByRole('button',{name:'Comprobar requisitos',exact:true}).click();await expect(panel).toContainText('Requisitos evaluados según política publicada');await page.screenshot({path:path.join(screenshots,'copiloto-ficha.png'),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Generar Borrador Asistido con IA',exact:true}).click();await page.getByRole('button',{name:'Aprobar y Emitir al Paciente',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Aprobar y Emitir',exact:true}).click();await expect(page.getByText('Documento emitido y visible para el paciente en su portal',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Atención & Documentación',exact:true}).click();
 const confirmation=panel.getByRole('checkbox',{name:'Confirmo la revisión y la acción profesional seleccionada.',exact:true});
 await confirmation.check();await panel.getByRole('button',{name:'Registrar atención realizada',exact:true}).click();await expect(confirmation).not.toBeChecked();await expect(confirmation).toBeEnabled({timeout:15000});
 await confirmation.check();await panel.getByRole('button',{name:'Registrar validación profesional',exact:true}).click();await expect(confirmation).not.toBeChecked();await expect(confirmation).toBeEnabled({timeout:15000});
 await confirmation.check();await panel.getByRole('button',{name:'Cerrar sesión con validación',exact:true}).click();await expect(confirmation).not.toBeChecked();await expect(panel.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'Detectar Alertas Documentales',exact:true}).click();await page.getByRole('button',{name:/Alertas Asistenciales/}).click();await expect(page.getByText(/ALT-C/).first()).toBeVisible();await page.screenshot({path:path.join(screenshots,'copiloto-alertas-cierre.png'),fullPage:true,animations:'disabled'});
});
test('Portal móvil: navegación accesible y sin desbordamiento horizontal',async({page})=>{
 await page.setViewportSize({width:390,height:844});await patientLogin(page);await expect(page.getByRole('button',{name:'Contacto profesional',exact:true})).toBeVisible();
 await expect(page.getByLabel('Sesión prevista',{exact:true})).toBeVisible();await expect(page.getByText(f.branch.nombre,{exact:true}).first()).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));
 const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+1);await page.screenshot({path:path.join(screenshots,'portal-movil.png'),fullPage:true,animations:'disabled'});
});
