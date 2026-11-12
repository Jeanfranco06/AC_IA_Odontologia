import { prisma } from '../db';
import crypto from 'crypto';
import { sendPaymentNoticeOrConfirmation } from '../routes/payer.routes';

export interface PatientSessionData {
  id_persona: number;
  nombres: string;
  apellidos: string;
  fullName: string;
  dni: string;
  email: string | null;
  numero: string | null;
  sede_preferida: string | null;
  id_etapa_actual: number;
  etapa_nombre: string;
  ultima_atencion?: {
    fecha: string;
    servicio: string;
    doctor: string;
    sede: string;
  } | null;
  proxima_cita?: {
    id_reserva: number;
    fecha: string;
    hora: string;
    servicio: string;
    doctor: string;
    sede: string;
    estado: string;
  } | null;
}

class PatientAuthService {
  private initialized = false;

  /**
   * Garantiza que la tabla de Credenciales y Tokens de Pacientes exista en SQL Server.
   */
  async ensureSchema() {
    if (this.initialized) return;
    try {
      await prisma.$executeRawUnsafe(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CredencialesPaciente' AND xtype='U')
        BEGIN
          CREATE TABLE CredencialesPaciente (
            id_credencial INT IDENTITY(1,1) PRIMARY KEY,
            id_persona INT NOT NULL UNIQUE,
            dni VARCHAR(20) NOT NULL,
            password_hash VARCHAR(255) NULL,
            password_salt VARCHAR(64) NULL,
            activation_token VARCHAR(255) NULL,
            token_expires_at DATETIME2 NULL,
            token_used BIT DEFAULT 0,
            otp_code VARCHAR(10) NULL,
            otp_expires_at DATETIME2 NULL,
            ultimo_acceso DATETIME2 NULL,
            fecha_creacion DATETIME2 DEFAULT GETDATE(),
            CONSTRAINT FK_Credenciales_Persona FOREIGN KEY (id_persona) REFERENCES Personas(id_persona) ON DELETE CASCADE
          );
          CREATE INDEX IX_Credenciales_DNI ON CredencialesPaciente(dni);
          CREATE INDEX IX_Credenciales_Token ON CredencialesPaciente(activation_token);
        END
      `);
      this.initialized = true;
      console.log('✅ [PatientAuth] Esquema de Credenciales de Pacientes inicializado.');
    } catch (error) {
      console.error('⚠️ [PatientAuth] Error asegurando tabla CredencialesPaciente:', error);
    }
  }

  /**
   * Genera un hash seguro con sal criptográfica usando PBKDF2 (Nativo de Node.js crypto).
   */
  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = 'pbkdf2$120000$' + crypto.pbkdf2Sync(password, generatedSalt, 120000, 64, 'sha512').toString('hex');
    return { hash, salt: generatedSalt };
  }

  /**
   * Verifica si una contraseña coincide con el hash almacenado.
   */
  verifyPassword(password: string, storedHash: string, salt: string): boolean {
    const modern = /^pbkdf2\$120000\$([a-f0-9]{128})$/.exec(storedHash);
    if (!modern && !/^[a-f0-9]{128}$/.test(storedHash)) return false;
    const actual = crypto.pbkdf2Sync(password, salt, modern ? 120000 : 1000, 64, 'sha512');
    const expected = Buffer.from(modern ? modern[1] : storedHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  /**
   * Genera un token de activación único de 24h para un nuevo cliente (CUSTOMER).
   */
  async generateActivationTokenForCustomer(idPersona: number, dni: string): Promise<string> {
    await this.ensureSchema();
    const token = crypto.randomUUID() + '-' + crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    const existing: any[] = await prisma.$queryRaw<any[]>`SELECT * FROM CredencialesPaciente WHERE id_persona = ${idPersona}`;

    if (existing && existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE CredencialesPaciente
        SET dni = ${dni}, activation_token = ${token}, token_expires_at = ${expiresAt.toISOString()}, token_used = 0
        WHERE id_persona = ${idPersona}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO CredencialesPaciente (id_persona, dni, activation_token, token_expires_at, token_used)
        VALUES (${idPersona}, ${dni}, ${token}, ${expiresAt.toISOString()}, 0)
      `;
    }

    return token;
  }

  /**
   * Envía el correo de agradecimiento post-consulta y activación del Portal del Paciente (etapa TURNED).
   */
  async sendPostConsultationActivationEmail(patient: {
    email: string;
    nombres: string;
    apellidos: string;
    dni: string;
    token: string;
    serviceName?: string;
    doctorName?: string;
    branchName?: string;
    procedure?: string;
    instructions?: string;
  }) {
    const fullName = `${patient.nombres} ${patient.apellidos}`.trim();
    const frontendUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'https://proyecto-in-odontologia.vercel.app').replace(/\/+$/, '');
    const activationUrl = `${frontendUrl}/activar-cuenta?token=${patient.token}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0d9488 0%, #047857 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 32px 28px; }
          .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .message { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
          .card-summary { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
          .card-summary h3 { margin: 0 0 10px 0; font-size: 14px; color: #0f766e; font-weight: 800; }
          .card-summary p { margin: 5px 0; font-size: 13px; color: #134e4a; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #059669 100%); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25); }
          .expiry-note { font-size: 12px; text-align: center; color: #94a3b8; margin-top: 14px; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🦷 NexoSalud Dental</h1>
            <p>Clínica Odontológica Especializada · Resultados y Portal del Paciente</p>
          </div>
          <div class="content">
            <div class="greeting">¡Fue un gusto atenderte hoy, ${fullName}! 👋</div>
            <p class="message">
              Agradecemos tu confianza en nuestro equipo odontológico. Tu atención médica ha finalizado con éxito y tus registros clínicos ya han sido actualizados en tu expediente digital.
            </p>

            <div class="card-summary">
              <h3>📋 Resumen de tu Atención Odontológica</h3>
              <p><strong>🦷 Tratamiento:</strong> ${patient.serviceName || 'Consulta Especializada'}</p>
              ${patient.doctorName ? `<p><strong>👨‍⚕️ Especialista:</strong> ${patient.doctorName}</p>` : ''}
              ${patient.branchName ? `<p><strong>📍 Sede:</strong> ${patient.branchName}</p>` : ''}
              ${patient.procedure ? `<p><strong>✨ Procedimiento:</strong> ${patient.procedure}</p>` : ''}
              ${patient.instructions ? `<p><strong>💊 Indicaciones:</strong> ${patient.instructions}</p>` : ''}
            </div>

            <p class="message">
              Para consultar tu historial de atenciones, descargar tus recetas médicas y solicitar futuros controles semestrales con <strong>1 solo clic (Agendamiento Express)</strong>, configura tu contraseña de acceso aquí:
            </p>
            <div class="btn-container">
              <a href="${activationUrl}" class="btn" target="_blank">Configurar mi Contraseña y Acceder al Portal</a>
            </div>
            <p class="expiry-note">
              ⏱️ <strong>Seguridad Clínica:</strong> Este enlace es personal, de <strong>un solo uso</strong> y válido por <strong>24 horas</strong>.
            </p>
          </div>
          <div class="footer">
            NexoSalud Dental · Trujillo, Perú · Sede California, Primavera y Centro Histórico.<br>
            Cuidamos tu sonrisa con tecnología médica avanzada.
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendPaymentNoticeOrConfirmation({
        toEmail: patient.email,
        patientName: fullName,
        documentNumber: patient.dni,
        subject: `🦷 ¡Gracias por tu visita! Tus Resultados y Acceso al Portal del Paciente NexoSalud`,
        amount: 0,
        channel: 'PORTAL_WEB',
        operationNumber: `CONS-${patient.token.substring(0, 8).toUpperCase()}`,
        serviceName: patient.serviceName || 'Atención Odontológica',
        reservationDate: new Date().toISOString().split('T')[0],
        reservationTime: '10:00',
        branch: patient.branchName || 'NexoSalud Dental',
        professional: patient.doctorName || 'Dirección Médica Odontológica',
        filename: 'Resultados_NexoSalud',
        code: `RES-${patient.dni}`,
        isValidated: true,
        includePdf: false,
        customHtml: htmlBody
      });
      console.log(`[PatientAuth] Correo post-consulta enviado a ${patient.email}`);
    } catch (err) {
      console.error('[PatientAuth] Error enviando correo post-consulta:', err);
    }
  }

  /**
   * Alias para bienvenida y activación general
   */
  async sendWelcomeActivationEmail(patient: {
    email: string;
    nombres: string;
    apellidos: string;
    dni: string;
    token: string;
    serviceName?: string;
    doctorName?: string;
    branchName?: string;
    procedure?: string;
    instructions?: string;
  }) {
    return this.sendPostConsultationActivationEmail(patient);
  }

  /**
   * Valida si un token de activación es válido y no ha expirado ni sido usado.
   */
  async validateActivationToken(token: string) {
    await this.ensureSchema();
    const rows: any[] = await prisma.$queryRaw<any[]>`
      SELECT c.*, p.nombres, p.apellidos, p.email, p.numero
      FROM CredencialesPaciente c
      INNER JOIN Personas p ON c.id_persona = p.id_persona
      WHERE c.activation_token = ${token}
    `;

    if (!rows || rows.length === 0) {
      return { valid: false, message: 'El enlace de activación no existe o no es válido.' };
    }

    const cred = rows[0];
    if (cred.token_used) {
      return { valid: false, message: 'Este enlace ya fue utilizado anteriormente. Por favor inicia sesión con tu contraseña o solicita un código express.' };
    }

    if (cred.token_expires_at && new Date(cred.token_expires_at) < new Date()) {
      return { valid: false, message: 'El enlace de activación ha expirado (límite de 24 horas). Solicita un nuevo código o enlace de acceso.' };
    }

    return {
      valid: true,
      patient: {
        id_persona: cred.id_persona,
        nombres: cred.nombres,
        apellidos: cred.apellidos,
        fullName: `${cred.nombres} ${cred.apellidos}`.trim(),
        dni: cred.dni,
        email: cred.email,
        numero: cred.numero
      }
    };
  }

  /**
   * Establece la contraseña del paciente utilizando su token de activación de un solo uso.
   */
  async activatePasswordWithToken(token: string, newPassword: string) {
    const validation = await this.validateActivationToken(token);
    if (!validation.valid || !validation.patient) {
      throw new Error(validation.message || 'Token inválido.');
    }

    if (!newPassword || newPassword.length < 12 || newPassword.length > 200) {
      throw new Error('La contraseña debe tener entre 12 y 200 caracteres.');
    }

    const { hash, salt } = this.hashPassword(newPassword);

    const activated = await prisma.$executeRaw`
      UPDATE CredencialesPaciente
      SET password_hash = ${hash}, password_salt = ${salt}, token_used = 1, ultimo_acceso = GETDATE()
      WHERE activation_token = ${token} AND token_used = 0 AND token_expires_at > GETDATE()
    `;
    if (activated !== 1) throw new Error('El enlace ya no admite activacion.');

    const sessionData = await this.getPatientFullProfile(validation.patient.id_persona);
    return { success: true, message: 'Contraseña configurada exitosamente.', sessionData };
  }

  /**
   * Login tradicional con DNI y Contraseña.
   */
  async loginWithPassword(dni: string, password: string): Promise<PatientSessionData> {
    await this.ensureSchema();
    const cleanDni = dni.trim().replace(/\D/g, '');

    // 1. Buscar a la persona en etapa CUSTOMER o TURNED
    const persona = await prisma.personas.findFirst({
      where: { dni: cleanDni },
      select: { id_persona: true, dni: true, id_etapa_actual: true }
    });

    if (!persona) {
      throw new Error('El DNI ingresado no se encuentra registrado en nuestra base de datos.');
    }

    // Verificar que sea cliente formal
    if (persona.id_etapa_actual < 4) {
      throw new Error('Tu expediente aún está en proceso de atención inicial. Por favor completa tu solicitud o comunícate con recepción.');
    }

    const creds: any[] = await prisma.$queryRaw<any[]>`
      SELECT * FROM CredencialesPaciente WHERE id_persona = ${persona.id_persona}
    `;

    const cred = creds && creds.length > 0 ? creds[0] : null;

    if (!cred || !cred.password_hash || !cred.password_salt) {
      throw new Error('Aún no has configurado tu contraseña. Utiliza la opción "Recibir código express a mi WhatsApp" para ingresar de inmediato.');
    }

    const isValid = this.verifyPassword(password, cred.password_hash, cred.password_salt);
    if (!isValid) {
      throw new Error('Contraseña incorrecta. Verifica tu contraseña o solicita un código express a tu WhatsApp.');
    }

    if (!cred.password_hash.startsWith('pbkdf2$')) {
      const upgraded = this.hashPassword(password);
      await prisma.$executeRaw`UPDATE dbo.CredencialesPaciente SET password_hash=${upgraded.hash}, password_salt=${upgraded.salt} WHERE id_persona=${persona.id_persona} AND password_hash=${cred.password_hash}`;
    }
    // Actualizar último acceso
    await prisma.$executeRaw`
      UPDATE CredencialesPaciente SET ultimo_acceso = GETDATE() WHERE id_persona = ${persona.id_persona}
    `;

    return await this.getPatientFullProfile(persona.id_persona);
  }

  /**
   * Genera y envía un código OTP de 4 dígitos al WhatsApp del paciente.
   */
  async sendOtpToWhatsapp(dni: string) {
    if (process.env.NODE_ENV !== 'test' || process.env.PATIENT_OTP_SIMULATION_ENABLED !== 'true') throw new Error('OTP no disponible: falta un proveedor institucional de entrega verificado.');
    await this.ensureSchema();
    const cleanDni = dni.trim().replace(/\D/g, '');

    const persona = await prisma.personas.findFirst({
      where: { dni: cleanDni }
    });

    if (!persona) {
      throw new Error('El DNI no está registrado como paciente en la clínica.');
    }

    if (persona.id_etapa_actual < 4) {
      throw new Error('Tu expediente aún no tiene citas confirmadas. Por favor regístrate como paciente nuevo.');
    }

    // Generar código numérico de 4 dígitos
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    const existing: any[] = await prisma.$queryRaw<any[]>`
      SELECT * FROM CredencialesPaciente WHERE id_persona = ${persona.id_persona}
    `;

    if (existing && existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE CredencialesPaciente
        SET otp_code = ${otp}, otp_expires_at = ${expiresAt.toISOString()}
        WHERE id_persona = ${persona.id_persona}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO CredencialesPaciente (id_persona, dni, otp_code, otp_expires_at)
        VALUES (${persona.id_persona}, ${cleanDni}, ${otp}, ${expiresAt.toISOString()})
      `;
    }

    const rawPhone = persona.numero || '987654321';
    const maskedPhone = rawPhone.length >= 4
      ? `+51 ••• ••• ${rawPhone.slice(-3)}`
      : '+51 9•• ••• •••';


    return {
      success: true,
      maskedPhone,
      debugOtp: otp, // Enviado para facilitar pruebas inmediatas en desarrollo
      message: `Código de verificación enviado exitosamente a tu WhatsApp (${maskedPhone}).`
    };
  }

  /**
   * Valida el código OTP y retorna la sesión del paciente.
   */
  async verifyOtpAndLogin(dni: string, otpCode: string): Promise<PatientSessionData> {
    if (process.env.NODE_ENV !== 'test' || process.env.PATIENT_OTP_SIMULATION_ENABLED !== 'true') throw new Error('OTP no disponible: falta un proveedor institucional de entrega verificado.');
    await this.ensureSchema();
    const cleanDni = dni.trim().replace(/\D/g, '');
    const cleanOtp = otpCode.trim().replace(/\D/g, '');

    const persona = await prisma.personas.findFirst({
      where: { dni: cleanDni }
    });

    if (!persona) {
      throw new Error('Paciente no encontrado.');
    }

    const creds: any[] = await prisma.$queryRaw<any[]>`
      SELECT * FROM CredencialesPaciente WHERE id_persona = ${persona.id_persona}
    `;

    const cred = creds && creds.length > 0 ? creds[0] : null;

    if (!cred || !cred.otp_code) {
      throw new Error('No hay un código de verificación activo. Solicita un nuevo código.');
    }

    if (cred.otp_expires_at && new Date(cred.otp_expires_at) < new Date()) {
      throw new Error('El código ha expirado (vigencia 10 minutos). Solicita un nuevo código.');
    }

    if (cred.otp_code !== cleanOtp) {
      throw new Error('El código de 4 dígitos es incorrecto.');
    }

    // Limpiar OTP usado
    await prisma.$executeRaw`
      UPDATE CredencialesPaciente
      SET otp_code = NULL, otp_expires_at = NULL, ultimo_acceso = GETDATE()
      WHERE id_persona = ${persona.id_persona}
    `;

    return await this.getPatientFullProfile(persona.id_persona);
  }

  /**
   * Obtiene el perfil completo del paciente con historial de citas para el Dashboard Express.
   */
  async getPatientFullProfile(idPersona: number): Promise<PatientSessionData> {
    const persona = await prisma.personas.findUnique({
      where: { id_persona: idPersona },
      select: {
        id_persona: true,
        nombres: true,
        apellidos: true,
        dni: true,
        email: true,
        numero: true,
        id_etapa_actual: true,
        Etapa: true,
        Preferencias: true,
        Reservas: {
          orderBy: { id_reserva: 'desc' },
          take: 5,
          include: {
            Solicitud: { include: { Servicio: true } },
            Opcion: { include: { Disponibilidad: { include: { Sede: true, Profesional: true } } } },
            Atenciones: { include: { Servicio: true, Profesional: true, Sede: true } }
          }
        },
        Atenciones: {
          orderBy: { id_atencion: 'desc' },
          take: 5,
          include: { Servicio: true, Profesional: true, Sede: true }
        }
      }
    });

    if (!persona) throw new Error('Paciente no encontrado.');

    // Última atención completada
    const lastAtencion = persona.Atenciones && persona.Atenciones.length > 0 ? persona.Atenciones[0] : null;
    // Próxima cita programada
    const upcomingReserva = persona.Reservas.find(r => r.estado === 'Confirmada' || r.estado === 'Pendiente');

    const pref = persona.Preferencias.length > 0 ? persona.Preferencias[0] : null;

    return {
      id_persona: persona.id_persona,
      nombres: persona.nombres,
      apellidos: persona.apellidos,
      fullName: `${persona.nombres} ${persona.apellidos}`.trim(),
      dni: persona.dni || '',
      email: persona.email,
      numero: persona.numero,
      sede_preferida: pref?.sede_preferida || upcomingReserva?.Opcion?.Disponibilidad?.Sede?.nombre || lastAtencion?.Sede?.nombre || 'Sede California',
      id_etapa_actual: persona.id_etapa_actual,
      etapa_nombre: persona.Etapa?.nombre || 'CUSTOMER',
      ultima_atencion: lastAtencion ? {
        fecha: lastAtencion.fecha_atencion.toISOString().split('T')[0],
        servicio: lastAtencion.Servicio?.nombre || 'Consulta Odontológica',
        doctor: `Dr. ${lastAtencion.Profesional?.nombres} ${lastAtencion.Profesional?.apellidos}`.trim(),
        sede: lastAtencion.Sede?.nombre || 'Sede Principal'
      } : null,
      proxima_cita: upcomingReserva ? {
        id_reserva: upcomingReserva.id_reserva,
        fecha: upcomingReserva.Opcion?.Disponibilidad?.fecha ? upcomingReserva.Opcion.Disponibilidad.fecha.toISOString().split('T')[0] : 'Por coordinar',
        hora: upcomingReserva.Opcion?.Disponibilidad?.hora_inicio ? upcomingReserva.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16) : '10:00',
        servicio: upcomingReserva.Solicitud?.Servicio?.nombre || 'Servicio Odontológico',
        doctor: upcomingReserva.Opcion?.Disponibilidad?.Profesional ? `Dr. ${upcomingReserva.Opcion.Disponibilidad.Profesional.nombres} ${upcomingReserva.Opcion.Disponibilidad.Profesional.apellidos}`.trim() : 'Dr. Asignado',
        sede: upcomingReserva.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede California',
        estado: upcomingReserva.estado
      } : null
    };
  }

  /**
   * Registra una Solicitud de Cita Express para un paciente ya registrado.
   */
  async createExpressAppointment(data: {
    id_persona: number;
    id_servicio?: number;
    sede_preferida?: string;
    horario_preferido?: string;
    duda_especifica?: string;
  }) {
    const persona = await prisma.personas.findUnique({
      where: { id_persona: data.id_persona }
    });

    if (!persona) throw new Error('Paciente no encontrado.');

    // 1. Crear Solicitud formal enlazada a la misma persona
    const solicitud = await prisma.solicitudes.create({
      data: {
        id_persona: persona.id_persona,
        id_servicio: data.id_servicio || null,
        motivo: data.duda_especifica || 'Solicitud Express de Cita - Paciente Frecuente',
        tipo_consulta: 'Paciente Frecuente',
        prioridad: 'Alta',
        estado: 'Abierta'
      }
    });

    // 2. Registrar Interacción de alta prioridad
    await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        tipo: 'Solicitud Web Express',
        mensaje: `[SOLICITUD EXPRESS PACIENTE FRECUENTE] Sede: ${data.sede_preferida || 'No especificada'} | Horario: ${data.horario_preferido || 'Flexible'} | Consulta: ${data.duda_especifica || 'Chequeo / Control regular'}`,
        es_respuesta_util: true,
        resultado: 'Solicitud Express Registrada'
      }
    });

    return {
      success: true,
      id_solicitud: solicitud.id_solicitud,
      message: 'Tu solicitud de cita express ha sido registrada con máxima prioridad. Recepción se comunicará contigo de inmediato para confirmar el horario.'
    };
  }
}

export const patientAuthService = new PatientAuthService();

