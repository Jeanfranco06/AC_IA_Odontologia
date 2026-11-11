import { Router } from 'express';
import { staffAuthService } from '../services/staffAuthService';

const router = Router();

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email y contraseña son obligatorios.' } });
  try { return res.json({ success: true, ...(await staffAuthService.login(email, password)) }); }
  catch { return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Credenciales institucionales inválidas.' } }); }
});

export default router;
