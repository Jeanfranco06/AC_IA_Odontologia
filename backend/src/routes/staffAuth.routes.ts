import { Router } from 'express';
import { aiAgentAuth } from '../modules/customer/ai-agent/authContext';
import { limitAuthentication, revokeSession } from '../modules/customer/ai-agent/securityControls';
import { staffAuthService } from '../services/staffAuthService';

const router = Router();
router.use('/login', limitAuthentication);
router.post('/logout', aiAgentAuth, async(req,res,next) => { try { await revokeSession(req.header('authorization')!.slice(7)); res.json({success:true}); } catch(error) { next(error); } });

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email y contraseña son obligatorios.' } });
  try { return res.json({ success: true, ...(await staffAuthService.login(email, password)) }); }
  catch { return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Credenciales institucionales inválidas.' } }); }
});

export default router;
