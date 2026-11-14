import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '../src/db';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxChars = 56): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) {
      cur = (cur + ' ' + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function generateEnhancedCard(attentionId: number) {
  const attention = await prisma.atenciones.findUnique({
    where: { id_atencion: attentionId },
    include: {
      Persona: true,
      Profesional: true,
      Sede: true,
      Servicio: true,
      IndicacionesPostatencion: {
        where: { es_version_vigente: true },
        take: 1
      }
    }
  });

  if (!attention) throw new Error(`Attention ${attentionId} not found`);

  // Load available assets
  const assetsDir = path.resolve(__dirname, '../assets');
  const readBase64 = (filename: string) => {
    const p = path.join(assetsDir, filename);
    return fs.existsSync(p) ? fs.readFileSync(p).toString('base64') : '';
  };

  const logoBase64 = readBase64('Logo_NexoSalud.png');
  const heroBase64 = readBase64('hero.png');
  const fondoBase64 = readBase64('Fondo_NexoSalud.png');

  const patientName = `${attention.Persona.nombres} ${attention.Persona.apellidos}`.trim();
  const doctorName = attention.Profesional
    ? `Dra. ${attention.Profesional.nombres} ${attention.Profesional.apellidos}`.trim()
    : 'Equipo Odontológico NexoSalud';
  const cop = attention.Profesional?.numero_colegiatura ? `COP: ${attention.Profesional.numero_colegiatura}` : '';
  const specialty = attention.Profesional?.especialidad || 'Odontología Especializada';
  const serviceName = attention.Servicio?.nombre || 'Consulta Odontológica Especializada';
  const sedeName = attention.Sede?.nombre || 'Sede Principal';
  const procedure = attention.procedimiento_realizado || attention.procedimiento || 'Tratamiento odontológico integral';

  const rawIndications = attention.indicaciones_finales ||
    (attention.IndicacionesPostatencion?.[0]?.contenido_indicaciones) ||
    'Mantener higiene oral adecuada y seguir las recomendaciones de su odontólogo.';

  // Separate sentences
  const rawItems = rawIndications
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 5);

  const formattedItems = rawItems.length > 0 ? rawItems : [rawIndications];

  const dateStr = new Date(attention.fecha_atencion).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const width = 1080;
  const height = 1350;

  // Build indications items
  let currentY = 590;
  let itemsSvg = '';
  const itemIcons = ['🕒', '💊', '🪥', '🥗'];

  formattedItems.slice(0, 3).forEach((item: string, idx: number) => {
    const num = String(idx + 1).padStart(2, '0');
    const icon = itemIcons[idx % itemIcons.length];
    const lines = wrapText(item, 56);
    const cardHeight = Math.max(105, 45 + lines.length * 30);
    const textStartY = lines.length === 1 ? 58 : 42;

    itemsSvg += `
      <!-- Indication Item ${idx + 1} -->
      <g transform="translate(60, ${currentY})">
        <rect width="960" height="${cardHeight}" rx="18" fill="#ffffff" stroke="#86efac" stroke-width="2" />
        <rect x="0" y="0" width="12" height="${cardHeight}" rx="6" fill="#0d9488" />
        
        <!-- Number badge circle -->
        <circle cx="65" cy="${Math.round(cardHeight / 2)}" r="28" fill="#0f766e" />
        <text x="65" y="${Math.round(cardHeight / 2) + 8}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">${num}</text>
        
        <!-- Emoji icon pill -->
        <circle cx="125" cy="${Math.round(cardHeight / 2)}" r="22" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1.5" />
        <text x="125" y="${Math.round(cardHeight / 2) + 7}" font-family="Arial, sans-serif" font-size="20" text-anchor="middle">${icon}</text>

        <!-- Instruction text -->
        <text x="165" y="${textStartY}" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" fill="#064e3b">
          ${lines.map((l, lIdx) => `<tspan x="165" dy="${lIdx === 0 ? 0 : 30}">${escapeXml(l)}</tspan>`).join('')}
        </text>
      </g>
    `;
    currentY += cardHeight + 16;
  });

  const emergencyY = Math.max(currentY + 15, 990);
  const footerY = 1240;

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Background subtle gradient -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f0fdfa" />
        <stop offset="50%" stop-color="#f8fafc" />
        <stop offset="100%" stop-color="#f1f5f9" />
      </linearGradient>

      <!-- Header rich dental gradient -->
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#022c22" />
        <stop offset="45%" stop-color="#0f766e" />
        <stop offset="100%" stop-color="#0d9488" />
      </linearGradient>

      <!-- Gold accent gradient for badges -->
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#fbbf24" />
      </linearGradient>

      <!-- Drop shadow -->
      <filter id="shadow" x="-3%" y="-3%" width="106%" height="112%" filterUnits="userSpaceOnUse">
        <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
        <feOffset dx="0" dy="5" />
        <feComponentTransfer><feFuncA type="linear" slope="0.09" /></feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- Base Canvas Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- System Background Watermark (Fondo_NexoSalud) -->
    ${fondoBase64 ? `
    <g opacity="0.075">
      <image href="data:image/png;base64,${fondoBase64}" x="0" y="240" width="${width}" height="${height - 240}" preserveAspectRatio="xMidYMid slice" />
    </g>` : ''}

    <!-- ==================== TOP HEADER BANNER ==================== -->
    <rect width="${width}" height="240" fill="url(#headerGrad)" />
    <!-- Dynamic overlay curves -->
    <path d="M0,205 Q540,265 1080,205 L1080,0 L0,0 Z" fill="#042f2e" opacity="0.25" />

    <!-- NexoSalud Logo in White Rounded Container -->
    <rect x="60" y="30" width="290" height="95" rx="18" fill="#ffffff" filter="url(#shadow)" />
    ${logoBase64 ? `<image href="data:image/png;base64,${logoBase64}" x="75" y="38" width="260" height="78" preserveAspectRatio="xMidYMid meet" />` : ''}

    <!-- System Hero Illustration Badge -->
    ${heroBase64 ? `
    <g transform="translate(930, 25)" filter="url(#shadow)">
      <circle cx="45" cy="45" r="46" fill="#ffffff" stroke="#5eead4" stroke-width="3" />
      <clipPath id="heroClip">
        <circle cx="45" cy="45" r="43" />
      </clipPath>
      <image href="data:image/png;base64,${heroBase64}" x="2" y="2" width="86" height="86" clip-path="url(#heroClip)" preserveAspectRatio="xMidYMid slice" />
    </g>` : ''}

    <!-- Header Badges and Title -->
    <g transform="translate(380, 42)">
      <rect x="0" y="0" width="320" height="34" rx="17" fill="#ccfbf1" />
      <text x="160" y="23" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" fill="#0f766e" text-anchor="middle" letter-spacing="1.2">PLAN CLÍNICO OFICIAL</text>
    </g>

    <text x="60" y="168" font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="#ffffff" letter-spacing="-0.5">GUÍA DE CUIDADOS POST-ATENCIÓN</text>
    
    <g transform="translate(60, 185)">
      <rect x="0" y="0" width="530" height="30" rx="8" fill="#042f2e" opacity="0.5" />
      <text x="15" y="20" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#99f6e4">Atención #${attention.id_atencion}  •  ${dateStr}  •  ${sedeName}</text>
    </g>

    <!-- ==================== PATIENT & DOCTOR CARD ==================== -->
    <g transform="translate(60, 255)" filter="url(#shadow)">
      <rect width="960" height="155" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
      
      <!-- Patient Section -->
      <g transform="translate(35, 28)">
        <text x="0" y="0" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="900" fill="#64748b" letter-spacing="1.2">PACIENTE TITULAR</text>
        <text x="0" y="34" font-family="'Segoe UI', Arial, sans-serif" font-size="30" font-weight="900" fill="#0f172a">${escapeXml(patientName)}</text>
        <rect x="0" y="48" width="380" height="28" rx="6" fill="#f0fdf4" />
        <text x="10" y="68" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#0d9488">✓ ${escapeXml(serviceName)}</text>
      </g>

      <!-- Vertical divider -->
      <line x1="510" y1="20" x2="510" y2="135" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="4 4" />

      <!-- Doctor Section -->
      <g transform="translate(545, 28)">
        <text x="0" y="0" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="900" fill="#64748b" letter-spacing="1.2">ODONTÓLOGA TRATANTE</text>
        <text x="0" y="32" font-family="'Segoe UI', Arial, sans-serif" font-size="26" font-weight="800" fill="#0f172a">${escapeXml(doctorName)}</text>
        <text x="0" y="60" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#475569">${escapeXml(specialty)}</text>
        <text x="0" y="82" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#0f766e">${cop ? 'Colegiatura: ' + cop : 'Colegiado Habilitado'}</text>
      </g>
    </g>

    <!-- ==================== PROCEDURE CARD ==================== -->
    <g transform="translate(60, 430)" filter="url(#shadow)">
      <rect width="960" height="115" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
      <rect x="0" y="0" width="12" height="115" rx="6" fill="#0d9488" />
      
      <g transform="translate(35, 25)">
        <rect x="0" y="0" width="260" height="24" rx="12" fill="#e0f2fe" />
        <text x="130" y="16" font-family="Arial, sans-serif" font-size="12" font-weight="900" fill="#0369a1" text-anchor="middle" letter-spacing="0.8">PROCEDIMIENTO REALIZADO</text>
        
        <text x="0" y="52" font-family="'Segoe UI', Arial, sans-serif" font-size="25" font-weight="900" fill="#0f172a">${escapeXml(procedure)}</text>
        <text x="0" y="74" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#64748b">Procedimiento concluido y validado clínicamente en Ficha Oficial NexoSalud.</text>
      </g>
    </g>

    <!-- ==================== INDICATIONS TITLE ==================== -->
    <g transform="translate(60, 565)">
      <text x="0" y="0" font-family="'Segoe UI', Arial, sans-serif" font-size="22" font-weight="900" fill="#0f172a" letter-spacing="-0.3">INDICACIONES Y CUIDADOS PRINCIPALES</text>
    </g>

    <!-- Dynamic Items -->
    ${itemsSvg}

    <!-- ==================== EMERGENCY & SUPPORT CARD ==================== -->
    <g transform="translate(60, ${emergencyY})" filter="url(#shadow)">
      <rect width="960" height="150" rx="20" fill="#fffbeb" stroke="#fde047" stroke-width="2.5" />
      <rect x="0" y="0" width="12" height="150" rx="6" fill="#eab308" />
      
      <circle cx="65" cy="75" r="32" fill="#fef3c7" stroke="#fcd34d" stroke-width="2" />
      <text x="65" y="85" font-family="Arial, sans-serif" font-size="30" text-anchor="middle">⚠️</text>
      
      <g transform="translate(120, 32)">
        <text x="0" y="0" font-family="'Segoe UI', Arial, sans-serif" font-size="22" font-weight="900" fill="#92400e">¿Presenta dolor persistente, sangrado o inflamación?</text>
        <text x="0" y="28" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#b45309">No se automedique. Nuestro equipo clínico está disponible para asistirlo de inmediato.</text>
        
        <g transform="translate(0, 48)">
          <rect x="0" y="0" width="780" height="38" rx="10" fill="#ffffff" stroke="#fed7aa" stroke-width="1.5" />
          <text x="15" y="25" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#0f766e">📞 Central Telefónica: (01) 234-5678</text>
          <text x="400" y="25" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#0f766e">💬 WhatsApp de Consultas: 902 455 346</text>
        </g>
      </g>
    </g>

    <!-- ==================== FOOTER ==================== -->
    <g transform="translate(60, ${footerY})">
      <line x1="0" y1="0" x2="960" y2="0" stroke="#cbd5e1" stroke-width="1.5" />
      <text x="0" y="32" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="800" fill="#334155">NexoSalud Red Odontológica Integral</text>
      <text x="0" y="52" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#64748b">Documento digital con certificación profesional • Folio #${attention.id_atencion} • Validez clínica oficial</text>
      
      <rect x="780" y="15" width="180" height="34" rx="17" fill="#0f766e" />
      <text x="870" y="38" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="#ffffff" text-anchor="middle">www.nexosalud.pe</text>
    </g>
  </svg>
  `;

  const outputPath = path.resolve(__dirname, `../storage/aftercare/aftercare-${attentionId}.png`);
  const buffer = await sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(outputPath, buffer);
  return { buffer, filePath: outputPath };
}

generateEnhancedCard(50).then(r => {
  console.log('✅ Generated Enhanced Card successfully:', r.filePath, 'Length:', r.buffer.length);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
