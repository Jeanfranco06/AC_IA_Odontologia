import { Router } from 'express';
import { prisma } from '../db';
import { hashStaffPassword } from '../services/staffAuthService';
import fs from 'fs';
import path from 'path';

const router = Router();

// Ruta del archivo de persistencia para datos institucionales de la empresa
const CONFIG_FILE_PATH = path.resolve(__dirname, '../../data/clinicConfig.json');

const DEFAULT_COMPANY_CONFIG = {
  nombreComercial: 'NexoSalud Odontología Especializada',
  razonSocial: 'NexoSalud Dental S.A.C.',
  ruc: '20608945123',
  telefonoPrincipal: '+51 970 292 710',
  emailContacto: 'contacto@nexosalud.pe',
  direccionFiscal: 'Av. Larco 820, Urb. California, Trujillo - La Libertad',
  slogan: 'Red Odontológica Integral de Alta Complejidad',
  horarioAtencion: 'Lunes a Sábado: 08:00 AM - 08:00 PM',
  sitioWeb: 'https://proyecto-in-odontologia.vercel.app',
  ciudadPrincipal: 'Trujillo, Perú',
  metodologia: 'IMPULSE Business Intelligence 360',
};

export function getStoredCompanyConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      return { ...DEFAULT_COMPANY_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.warn('Error reading clinicConfig.json, using defaults:', err);
  }
  return DEFAULT_COMPANY_CONFIG;
}

function saveCompanyConfig(data: any) {
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving clinicConfig.json:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. EMPRESA / CLÍNICA
// ─────────────────────────────────────────────────────────────
router.get('/empresa', (req, res) => {
  res.json(getStoredCompanyConfig());
});

router.put('/empresa', (req, res) => {
  try {
    const current = getStoredCompanyConfig();
    const updated = { ...current, ...req.body };
    saveCompanyConfig(updated);
    res.json({ success: true, empresa: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al guardar configuración de empresa' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. SERVICIOS Y TARIFAS
// ─────────────────────────────────────────────────────────────
// Ruta de persistencia para reglas comerciales de servicios (Descuento Máximo e IDs de tratamientos para venta cruzada)
const SERVICIOS_RULES_FILE = path.resolve(__dirname, '../../data/serviciosRules.json');

export interface ServicioCommercialRule {
  descuentoMaximo: number;
  descuentosPermitidos: number[];
  serviciosRelacionadosIds: number[];
}

const DEFAULT_SERVICIOS_RULES: Record<number, ServicioCommercialRule> = {
  1: {
    descuentoMaximo: 20,
    descuentosPermitidos: [10, 15, 20],
    serviciosRelacionadosIds: [4, 2], // Blanqueamiento dental, Ortodoncia
  },
  2: {
    descuentoMaximo: 20,
    descuentosPermitidos: [10, 15, 20],
    serviciosRelacionadosIds: [4, 3], // Blanqueamiento dental, Control odontológico
  },
  3: {
    descuentoMaximo: 15,
    descuentosPermitidos: [10, 15],
    serviciosRelacionadosIds: [4, 1], // Blanqueamiento dental, Evaluación odontológica
  },
  4: {
    descuentoMaximo: 25,
    descuentosPermitidos: [10, 15, 20, 25],
    serviciosRelacionadosIds: [3, 2], // Control odontológico, Ortodoncia
  },
};

export function getStoredServiciosRules(): Record<number, ServicioCommercialRule> {
  try {
    if (fs.existsSync(SERVICIOS_RULES_FILE)) {
      const data = fs.readFileSync(SERVICIOS_RULES_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const merged: Record<number, ServicioCommercialRule> = { ...DEFAULT_SERVICIOS_RULES };
      for (const [k, v] of Object.entries(parsed)) {
        merged[Number(k)] = v as ServicioCommercialRule;
      }
      return merged;
    }
  } catch (err) {
    console.warn('Error reading serviciosRules.json, using default rules:', err);
  }
  return { ...DEFAULT_SERVICIOS_RULES };
}

export function saveServiciosRules(rules: Record<number, ServicioCommercialRule>) {
  try {
    const dir = path.dirname(SERVICIOS_RULES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SERVICIOS_RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving serviciosRules.json:', err);
  }
}

export function getCommercialRuleForServicio(id_servicio: number): ServicioCommercialRule {
  const allRules = getStoredServiciosRules();
  if (allRules[id_servicio]) {
    return allRules[id_servicio];
  }
  return {
    descuentoMaximo: 20,
    descuentosPermitidos: [10, 15, 20],
    serviciosRelacionadosIds: [],
  };
}

export async function getServicioCommercialInfo(serviceIdOrName: number | string) {
  try {
    let service = null;
    if (typeof serviceIdOrName === 'number' || !isNaN(Number(serviceIdOrName))) {
      service = await prisma.servicios.findUnique({
        where: { id_servicio: Number(serviceIdOrName) },
        include: {
          Tarifas: { where: { activo: true }, take: 1, orderBy: { fecha_inicio: 'desc' } },
        },
      });
    }

    if (!service && typeof serviceIdOrName === 'string') {
      const cleanName = serviceIdOrName.trim();
      service = await prisma.servicios.findFirst({
        where: {
          OR: [
            { nombre: { contains: cleanName } },
            { nombre: { startsWith: cleanName.split(' ')[0] } },
          ],
          activo: true,
        },
        include: {
          Tarifas: { where: { activo: true }, take: 1, orderBy: { fecha_inicio: 'desc' } },
        },
      });
    }

    if (!service) {
      service = await prisma.servicios.findFirst({
        where: { activo: true },
        include: {
          Tarifas: { where: { activo: true }, take: 1, orderBy: { fecha_inicio: 'desc' } },
        },
      });
    }

    const serviceId = service ? service.id_servicio : 1;
    const rule = getCommercialRuleForServicio(serviceId);

    let relatedServices: any[] = [];

    if (rule.serviciosRelacionadosIds && rule.serviciosRelacionadosIds.length > 0) {
      const relDb = await prisma.servicios.findMany({
        where: {
          id_servicio: { in: rule.serviciosRelacionadosIds },
          activo: true,
        },
        include: {
          Tarifas: { where: { activo: true }, take: 1, orderBy: { fecha_inicio: 'desc' } },
        },
      });

      const imageMap = {
        blanqueamiento: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop&q=80',
        ortodoncia: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&auto=format&fit=crop&q=80',
        limpieza: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80',
        control: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80',
        evaluación: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=600&auto=format&fit=crop&q=80',
      };

      relatedServices = relDb.map((r) => {
        const lower = r.nombre.toLowerCase();
        let matchedImg = 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80';
        for (const [key, url] of Object.entries(imageMap)) {
          if (lower.includes(key)) {
            matchedImg = url;
            break;
          }
        }
        return {
          id_servicio: r.id_servicio,
          nombre: r.nombre,
          descripcion: r.descripcion || '',
          precio: r.Tarifas[0] ? Number(r.Tarifas[0].precio) : null,
          imgUrl: matchedImg,
        };
      });
    }

    return {
      id_servicio: serviceId,
      nombre: service?.nombre || (typeof serviceIdOrName === 'string' ? serviceIdOrName : 'Consulta Dental'),
      descripcion: service?.descripcion || '',
      precio: service?.Tarifas?.[0] ? Number(service.Tarifas[0].precio) : 150,
      descuentoMaximo: rule.descuentoMaximo ?? 20,
      descuentosPermitidos: rule.descuentosPermitidos ?? [10, 15, 20],
      serviciosRelacionados: relatedServices,
    };
  } catch (err) {
    console.error('Error in getServicioCommercialInfo:', err);
    return {
      id_servicio: 1,
      nombre: typeof serviceIdOrName === 'string' ? serviceIdOrName : 'Consulta Dental',
      descripcion: '',
      precio: 150,
      descuentoMaximo: 20,
      descuentosPermitidos: [10, 15, 20],
      serviciosRelacionados: [],
    };
  }
}

router.get('/servicios', async (req, res) => {
  try {
    const servicios = await prisma.servicios.findMany({
      include: {
        Tarifas: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
        ProfesionalServicio: {
          include: {
            Profesional: {
              select: { id_profesional: true, nombres: true, apellidos: true, especialidad: true },
            },
          },
        },
      },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });

    const rules = getStoredServiciosRules();
    const serviceNameMap = new Map();
    servicios.forEach((s) => serviceNameMap.set(s.id_servicio, s.nombre));

    const formatted = servicios.map((s) => {
      const rule = rules[s.id_servicio] || {
        descuentoMaximo: 20,
        descuentosPermitidos: [10, 15, 20],
        serviciosRelacionadosIds: [],
      };

      const relNombres = (rule.serviciosRelacionadosIds || [])
        .map((rid) => serviceNameMap.get(rid))
        .filter(Boolean);

      return {
        id_servicio: s.id_servicio,
        nombre: s.nombre,
        descripcion: s.descripcion || '',
        activo: s.activo,
        precio: s.Tarifas[0] ? Number(s.Tarifas[0].precio) : null,
        id_tarifa: s.Tarifas[0]?.id_tarifa || null,
        especialistas: s.ProfesionalServicio.map((ps) => `${ps.Profesional.nombres} ${ps.Profesional.apellidos}`),
        especialistasDetalle: s.ProfesionalServicio.map((ps) => ({
          id_profesional: ps.Profesional.id_profesional,
          nombres: ps.Profesional.nombres,
          apellidos: ps.Profesional.apellidos,
          especialidad: ps.Profesional.especialidad,
        })),
        descuentoMaximo: rule.descuentoMaximo ?? 20,
        descuentosPermitidos: rule.descuentosPermitidos ?? [10, 15, 20],
        serviciosRelacionadosIds: rule.serviciosRelacionadosIds ?? [],
        serviciosRelacionadosNombres: relNombres,
      };
    });

    res.json(formatted);
  } catch (err: any) {
    console.error('Error fetching servicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

router.put('/servicios/:id/especialistas', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { profesionalesIds } = req.body;

    if (!Array.isArray(profesionalesIds)) {
      return res.status(400).json({ error: 'profesionalesIds debe ser un arreglo de IDs' });
    }

    await prisma.profesionalServicio.deleteMany({
      where: { id_servicio: id },
    });

    for (const pId of profesionalesIds) {
      await prisma.profesionalServicio.create({
        data: {
          id_servicio: id,
          id_profesional: Number(pId),
        },
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Especialistas asignados exitosamente' });
  } catch (err: any) {
    console.error('Error assigning especialistas to servicio:', err);
    res.status(500).json({ error: err.message || 'Error al asignar especialistas' });
  }
});

router.post('/servicios', async (req, res) => {
  try {
    const { nombre, descripcion, precio, activo, descuentoMaximo, descuentosPermitidos, serviciosRelacionadosIds } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del servicio es obligatorio' });

    const newServicio = await prisma.servicios.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    if (precio && !isNaN(Number(precio))) {
      await prisma.tarifas.create({
        data: {
          id_servicio: newServicio.id_servicio,
          precio: Number(precio),
          activo: true,
        },
      });
    }

    const currentRules = getStoredServiciosRules();
    currentRules[newServicio.id_servicio] = {
      descuentoMaximo: descuentoMaximo !== undefined ? Number(descuentoMaximo) : 20,
      descuentosPermitidos: Array.isArray(descuentosPermitidos) ? descuentosPermitidos : [10, 15, 20],
      serviciosRelacionadosIds: Array.isArray(serviciosRelacionadosIds) ? serviciosRelacionadosIds.map(Number) : [],
    };
    saveServiciosRules(currentRules);

    res.status(201).json(newServicio);
  } catch (err: any) {
    console.error('Error creating servicio:', err);
    res.status(500).json({ error: err.message || 'Error al crear servicio' });
  }
});

router.put('/servicios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, descripcion, precio, activo } = req.body;

    const updated = await prisma.servicios.update({
      where: { id_servicio: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });

    if (precio !== undefined && !isNaN(Number(precio))) {
      // Desactivar tarifas previas y crear nueva tarifa vigente
      await prisma.tarifas.updateMany({
        where: { id_servicio: id, activo: true },
        data: { activo: false, fecha_fin: new Date() },
      });

      await prisma.tarifas.create({
        data: {
          id_servicio: id,
          precio: Number(precio),
          activo: true,
        },
      });
    }

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating servicio:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar servicio' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. SEDES
// ─────────────────────────────────────────────────────────────
router.get('/sedes', async (req, res) => {
  try {
    const sedes = await prisma.sedes.findMany({
      orderBy: [{ activo: 'desc' }, { id_sede: 'asc' }],
    });
    res.json(sedes);
  } catch (err: any) {
    console.error('Error fetching sedes:', err);
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
});

router.post('/sedes', async (req, res) => {
  try {
    const { nombre, direccion, zona, activo } = req.body;
    if (!nombre || !direccion) {
      return res.status(400).json({ error: 'Nombre y dirección son obligatorios' });
    }

    const newSede = await prisma.sedes.create({
      data: {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        zona: zona?.trim() || null,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    res.status(201).json(newSede);
  } catch (err: any) {
    console.error('Error creating sede:', err);
    res.status(500).json({ error: err.message || 'Error al crear sede' });
  }
});

router.put('/sedes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, direccion, zona, activo } = req.body;

    const updated = await prisma.sedes.update({
      where: { id_sede: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(direccion !== undefined && { direccion: direccion.trim() }),
        ...(zona !== undefined && { zona: zona.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating sede:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar sede' });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. PROFESIONALES / ESPECIALISTAS
// ─────────────────────────────────────────────────────────────
router.get('/profesionales', async (req, res) => {
  try {
    const profesionales = await prisma.profesionales.findMany({
      include: {
        ProfesionalServicio: {
          include: {
            Servicio: {
              select: { id_servicio: true, nombre: true },
            },
          },
        },
      },
      orderBy: [{ activo: 'desc' }, { id_profesional: 'asc' }],
    });

    const formatted = profesionales.map((p) => ({
      id_profesional: p.id_profesional,
      nombres: p.nombres,
      apellidos: p.apellidos,
      numero_colegiatura: p.numero_colegiatura || '',
      especialidad: p.especialidad || 'Odontología General',
      activo: p.activo,
      servicios: p.ProfesionalServicio.map((ps) => ps.Servicio),
    }));

    res.json(formatted);
  } catch (err: any) {
    console.error('Error fetching profesionales:', err);
    res.status(500).json({ error: 'Error al obtener especialistas' });
  }
});

router.post('/profesionales', async (req, res) => {
  try {
    const { nombres, apellidos, numero_colegiatura, especialidad, activo, serviciosIds } = req.body;
    if (!nombres || !apellidos) {
      return res.status(400).json({ error: 'Nombres y apellidos son obligatorios' });
    }

    const newProf = await prisma.profesionales.create({
      data: {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        numero_colegiatura: numero_colegiatura?.trim() || null,
        especialidad: especialidad?.trim() || 'Odontología General',
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    if (Array.isArray(serviciosIds) && serviciosIds.length > 0) {
      for (const sId of serviciosIds) {
        await prisma.profesionalServicio.create({
          data: {
            id_profesional: newProf.id_profesional,
            id_servicio: Number(sId),
          },
        }).catch(() => {});
      }
    }

    res.status(201).json(newProf);
  } catch (err: any) {
    console.error('Error creating profesional:', err);
    res.status(500).json({ error: err.message || 'Error al registrar especialista' });
  }
});

router.put('/profesionales/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombres, apellidos, numero_colegiatura, especialidad, activo, serviciosIds } = req.body;

    const updated = await prisma.profesionales.update({
      where: { id_profesional: id },
      data: {
        ...(nombres !== undefined && { nombres: nombres.trim() }),
        ...(apellidos !== undefined && { apellidos: apellidos.trim() }),
        ...(numero_colegiatura !== undefined && { numero_colegiatura: numero_colegiatura.trim() }),
        ...(especialidad !== undefined && { especialidad: especialidad.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });

    if (Array.isArray(serviciosIds)) {
      await prisma.profesionalServicio.deleteMany({
        where: { id_profesional: id },
      });

      for (const sId of serviciosIds) {
        await prisma.profesionalServicio.create({
          data: {
            id_profesional: id,
            id_servicio: Number(sId),
          },
        }).catch(() => {});
      }
    }

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating profesional:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar especialista' });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. CANALES Y FUENTES
// ─────────────────────────────────────────────────────────────
router.get('/canales-fuentes', async (req, res) => {
  try {
    const [canales, fuentes] = await Promise.all([
      prisma.canales.findMany({ orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }),
      prisma.fuentes.findMany({ orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }),
    ]);
    res.json({ canales, fuentes });
  } catch (err: any) {
    console.error('Error fetching canales y fuentes:', err);
    res.status(500).json({ error: 'Error al obtener canales y fuentes' });
  }
});

router.post('/canales', async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

    const newCanal = await prisma.canales.create({
      data: { nombre: nombre.trim(), activo: activo !== undefined ? Boolean(activo) : true },
    });
    res.status(201).json(newCanal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/canales/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, activo } = req.body;
    const updated = await prisma.canales.update({
      where: { id_canal: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fuentes', async (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

    const newFuente = await prisma.fuentes.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });
    res.status(201).json(newFuente);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/fuentes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, descripcion, activo } = req.body;
    const updated = await prisma.fuentes.update({
      where: { id_fuente: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. USUARIOS Y ROLES
// ─────────────────────────────────────────────────────────────
router.get('/usuarios', async (req, res) => {
  try {
    const [usuarios, roles] = await Promise.all([
      prisma.usuarios.findMany({
        select: {
          id_usuario: true,
          nombres: true,
          apellidos: true,
          email: true,
          id_rol: true,
          activo: true,
          Rol: { select: { id_rol: true, nombre: true } },
        },
        orderBy: [{ activo: 'desc' }, { id_usuario: 'asc' }],
      }),
      prisma.roles.findMany({ orderBy: { id_rol: 'asc' } }),
    ]);

    res.json({ usuarios, roles });
  } catch (err: any) {
    console.error('Error fetching usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/usuarios', async (req, res) => {
  try {
    const { nombres, apellidos, email, id_rol, activo, password, id_profesional } = req.body;
    if (!nombres || !apellidos || !email || !id_rol) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const newUser = await prisma.usuarios.create({
      data: {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        email: email.trim().toLowerCase(),
        password_hash: password ? hashStaffPassword(String(password)) : 'hashedpassword_initial',
        id_rol: Number(id_rol),
        id_profesional: id_profesional ? Number(id_profesional) : null,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
      include: { Rol: true },
    });

    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al crear usuario' });
  }
});

router.put('/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombres, apellidos, email, id_rol, activo, password, id_profesional } = req.body;

    const updated = await prisma.usuarios.update({
      where: { id_usuario: id },
      data: {
        ...(nombres !== undefined && { nombres: nombres.trim() }),
        ...(apellidos !== undefined && { apellidos: apellidos.trim() }),
        ...(email !== undefined && { email: email.trim().toLowerCase() }),
        ...(id_rol !== undefined && { id_rol: Number(id_rol) }),
        ...(id_profesional !== undefined && { id_profesional: id_profesional ? Number(id_profesional) : null }),
        ...(password !== undefined && { password_hash: hashStaffPassword(String(password)) }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
      include: { Rol: true },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al actualizar usuario' });
  }
});

export default router;
