import { Router, Request, Response, NextFunction } from 'express';
import { aiAgentAuth, requireRole, principalOf } from '../modules/customer/ai-agent/authContext';
import { AiAgentError } from '../modules/customer/ai-agent/types';
import { limitAuthentication, revokeSession } from '../modules/customer/ai-agent/securityControls';
import { patientAuthService } from '../services/patientAuthService';
import { issueAiAgentToken } from '../modules/customer/ai-agent/authContext';

const router = Router();
router.use(['/login','/send-otp','/verify-otp','/activate-password'],limitAuthentication);
router.post('/logout', aiAgentAuth, async(req,res,next) => { try { await revokeSession(req.header('authorization')!.slice(7)); res.json({success:true}); } catch(error) { next(error); } });

/**
 * 1. Login con DNI + Contraseña
 */
router.post('/login', async (req, res) => {
  const { dni, password } = req.body;
  if (!dni || !password) {
    return res.status(400).json({ error: 'Por favor ingresa tu DNI y tu contraseña.' });
  }

  try {
    const session = await patientAuthService.loginWithPassword(dni, password);
    res.json({ success: true, session, accessToken: issueAiAgentToken({ role: 'PACIENTE', idPersona: session.id_persona }) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al iniciar sesión.' });
  }
});

/**
 * 2. Solicitar Código Express OTP a WhatsApp
 */
router.post('/send-otp', async (req, res) => {
  const { dni } = req.body;
  if (!dni) {
    return res.status(400).json({ error: 'Por favor ingresa tu número de DNI.' });
  }

  try {
    const result = await patientAuthService.sendOtpToWhatsapp(dni);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al enviar código de verificación.' });
  }
});

/**
 * 3. Verificar Código OTP y Login
 */
router.post('/verify-otp', async (req, res) => {
  const { dni, otpCode } = req.body;
  if (!dni || !otpCode) {
    return res.status(400).json({ error: 'Por favor ingresa tu DNI y el código de 4 dígitos.' });
  }

  try {
    const session = await patientAuthService.verifyOtpAndLogin(dni, otpCode);
    res.json({ success: true, session, accessToken: issueAiAgentToken({ role: 'PACIENTE', idPersona: session.id_persona }) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al validar el código.' });
  }
});

/**
 * 4. Validar Token de Activación (One-Time Link)
 */
router.get('/validate-token/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ valid: false, message: 'Token no especificado.' });
  }

  try {
    const result = await patientAuthService.validateActivationToken(token);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ valid: false, message: error.message || 'Error validando enlace.' });
  }
});

/**
 * 5. Activar Contraseña con Token de Un Solo Uso
 */
router.post('/activate-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token y nueva contraseña requeridos.' });
  }

  try {
    const result = await patientAuthService.activatePasswordWithToken(token, newPassword);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al activar la contraseña.' });
  }
});

/**
 * 6. Crear Solicitud de Cita Express para Paciente Autenticado
 */
router.post('/express-appointment', aiAgentAuth, requireRole('PACIENTE'), async (req, res) => {
  const { id_persona, id_servicio, sede_preferida, horario_preferido, duda_especifica } = req.body;
  if (Number(id_persona) !== principalOf(req).idPersona) return res.status(403).json({ error: 'El paciente solicitado no corresponde a la sesion autenticada.' });
  if (!id_persona) {
    return res.status(400).json({ error: 'Identificador de paciente requerido.' });
  }

  try {
    const result = await patientAuthService.createExpressAppointment({
      id_persona: Number(id_persona),
      id_servicio: id_servicio ? Number(id_servicio) : undefined,
      sede_preferida,
      horario_preferido,
      duda_especifica
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al registrar cita express.' });
  }
});

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = error instanceof AiAgentError ? error : new AiAgentError('INTERNAL_ERROR', 'No fue posible completar la operacion.');
  res.status(e.status).json({ error: e.message });
});

export default router;

