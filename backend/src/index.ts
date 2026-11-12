import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import buyerRoutes from './routes/buyer.routes';
import leadRoutes from './routes/lead.routes';
import payerRoutes from './routes/payer.routes';
import paymentRoutes from './routes/payment.routes';
import customerRoutes from './routes/customer.routes';
import turnedRoutes from './routes/turned.routes';
import reportRoutes from './routes/report.routes';
import configRoutes from './routes/config.routes';
import patientAuthRoutes from './routes/patientAuth.routes';
import { startDunningScheduler } from './services/dunningScheduler';
import customerAiAgentRoutes from './modules/customer/ai-agent/routes';
import staffAuthRoutes from './routes/staffAuth.routes';
import healthRoutes from './modules/customer/ai-agent/monitoring/healthRoutes';
import { metricsCollector } from './modules/customer/ai-agent/monitoring/metricsCollector';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Middleware de telemetría y métricas
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    const duration = performance.now() - start;
    metricsCollector.recordRequest(res.statusCode, duration);
  });
  next();
});

// Rutas de salud y observabilidad
app.use('/health', healthRoutes);
app.use('/metrics', healthRoutes);

// Registrar rutas
app.use('/api/buyer', buyerRoutes);
app.use('/api/lead', leadRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/payer', payerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customer/ai-agent', customerAiAgentRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/turned', turnedRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/mart', reportRoutes);
app.use('/api/config', configRoutes);
app.use('/api/patient-auth', patientAuthRoutes);
app.use('/api/staff-auth', staffAuthRoutes);

import { CanvaService } from './services/canvaService';

// Diagnóstico de Canva Connect en producción
app.get('/api/canva-diag', async (req, res) => {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const refreshToken = process.env.CANVA_REFRESH_TOKEN;
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  const templateId = process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID;

  let tokenCheck: any = null;
  try {
    const token = await CanvaService.getValidAccessToken();
    tokenCheck = {
      obtained: Boolean(token),
      tokenLength: token?.length,
    };
  } catch (e: any) {
    tokenCheck = { error: e.message };
  }

  res.json({
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasRefreshToken: Boolean(refreshToken),
    refreshTokenLength: refreshToken?.length,
    hasAccessToken: Boolean(accessToken),
    templateId,
    tokenCheck,
  });
});

app.get('/api/canva/auth-url', (req, res) => {
  const clientId = process.env.CANVA_CLIENT_ID || 'OC-AaDW_EAnA5pf';
  const redirectUri = 'https://proyecto-in-odontologia.vercel.app/lead';
  const codeChallenge = 'Lbn6gs4NoMLnUCyrIV9yLsreYNFd1XtBOt8Cx5igIbI';
  const scopes = [
    'brandtemplate:content:read',
    'brandtemplate:meta:read',
    'design:content:read',
    'design:content:write',
    'design:meta:read',
    'asset:read',
    'asset:write',
  ].join(' ');

  const authUrl = `https://www.canva.com/api/oauth/authorize?code_challenge_method=s256&response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&code_challenge=${codeChallenge}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.json({ authUrl });
});

app.post(['/api/canva/exchange', '/api/canva-exchange'], async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  const clientId = process.env.CANVA_CLIENT_ID || 'OC-AaDW_EAnA5pf';
  const clientSecret = process.env.CANVA_CLIENT_SECRET || '';
  const codeVerifier = 'nexo_salud_canva_secure_verifier_odontologia_2026_pkce_key_unique_882';
  const redirectUri = 'https://proyecto-in-odontologia.vercel.app/lead';

  if (!clientSecret) {
    return res.status(500).json({ error: 'CANVA_CLIENT_SECRET is not configured' });
  }

  try {
    console.log('🔄 [Canva OAuth] Intercambiando authorization code por tokens...');
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data: any = await tokenRes.json();
    if (!tokenRes.ok) {
      console.warn('⚠️ [Canva OAuth Error]:', data);
      return res.status(tokenRes.status).json({ error: 'Canva token exchange failed', details: data });
    }

    console.log('✅ [Canva OAuth] ¡Tokens intercambiados y actualizados exitosamente!');
    await CanvaService.setTokens(data.access_token, data.refresh_token, data.expires_in);

    res.json({
      success: true,
      message: 'Tokens actualizados exitosamente en el servidor',
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });
  } catch (err: any) {
    console.error('❌ [Canva OAuth Exception]:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/canva-dataset', async (req, res) => {
  try {
    const token = await CanvaService.getValidAccessToken();
    const brandTemplateId = process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID || 'EAHWLEXZ1lo';
    const response = await fetch(`https://api.canva.com/rest/v1/brand-templates/${brandTemplateId}/dataset`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/canva-test-run', async (req, res) => {
  try {
    const token = await CanvaService.getValidAccessToken();
    if (!token) {
      return res.status(500).json({ error: 'No token obtained' });
    }

    const brandTemplateId = process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID || 'EAHWLEXZ1lo';
    const dataset = CanvaService.buildAutofillDataset({
      sedeTexto: 'Sede Trujillo - El Golf',
      descuentoTexto: '30',
      contactoTexto: '+51 987 654 321\ninfo@nexosalud.pe',
      horarioTexto: 'Lunes a Sábado\n8:00am a 8:00pm',
      tratamiento1: {
        titulo: 'Ortodoncia Brackets',
        desc: 'Control mensual incluido',
        precio: 'Desde S/ 140.00',
      },
    });

    const autofillRes = await fetch('https://api.canva.com/rest/v1/autofills', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_template_id: brandTemplateId,
        title: 'Flyer NexoSalud - Diagnostic Run',
        data: dataset,
      }),
    });

    const autofillStatus = autofillRes.status;
    const autofillBody = await autofillRes.text();

    res.json({
      tokenSnippet: token.substring(0, 25) + '...',
      brandTemplateId,
      autofillStatus,
      autofillBody,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Ruta de prueba
app.get('/api/ping', async (req, res) => {
  try {
    // Intenta hacer una consulta muy simple para validar conexión a base de datos
    await prisma.$queryRaw`SELECT 1 as result`;
    res.json({ message: 'Pong! Conexión a la base de datos exitosa.', db: 'Connected' });
  } catch (error) {
    console.error('Error de conexión a la base de datos:', error);
    res.status(500).json({ message: 'Error conectando a la base de datos.', error });
  }
});

// Obtener todas las etapas
app.get('/api/etapas', async (req, res) => {
  try {
    const etapas = await prisma.etapas.findMany();
    res.json(etapas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener etapas' });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Servidor backend corriendo en http://localhost:${port}`);
    startDunningScheduler();
  });
}

export default app;
