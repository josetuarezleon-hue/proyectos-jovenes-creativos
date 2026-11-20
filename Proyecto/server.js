
// ============================================
// BALANCEA360 - SERVIDOR PRINCIPAL
// ============================================

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 1. CONFIGURACIÓN
// ============================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ============================================
// 2. MODELO DE USUARIO
// ============================================


const usuarioSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    rol: {
        type: String,
        enum: ['usuario', 'admin'],
        default: 'usuario'
    }
}, {
    timestamps: true
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

// ============================================
// 3. MODELO DE MOVIMIENTOS
// ============================================

const movimientoSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    tipo: {
        type: String,
        enum: ['ingreso', 'gasto'],
        required: true
    },
    concepto: {
        type: String,
        required: true,
        trim: true
    },
    categoria: {
        type: String,
        required: true,
        trim: true
    },
    monto: {
        type: Number,
        required: true,
        min: 0.01
    },
    fecha: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

const Movimiento = mongoose.model('Movimiento', movimientoSchema);
const contactoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 180
    },
    asunto: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160
    },
    mensaje: {
        type: String,
        required: true,
        trim: true,
        maxlength: 3000
    }
}, {
    timestamps: true
});

const Contacto = mongoose.model('Contacto', contactoSchema);

// ============================================
// 4. CREAR Y VERIFICAR TOKENS
// ============================================

function crearToken(usuario) {
    return jwt.sign(
        {
            id: usuario._id.toString()
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '1d'
        }
    );
}

// Middleware: comprueba que el usuario haya iniciado sesión.

async function verificarToken(req, res, next) {
    try {
        const encabezado = req.headers.authorization;

        if (!encabezado || !encabezado.startsWith('Bearer ')) {
            return res.status(401).json({
                mensaje: 'Debes iniciar sesión.'
            });
        }

        const token = encabezado.split(' ')[1];

        const datos = jwt.verify(token, process.env.JWT_SECRET);

        const usuario = await Usuario.findById(datos.id).select('-password');

        if (!usuario) {
            return res.status(401).json({
                mensaje: 'La cuenta no existe.'
            });
        }

        req.usuario = usuario;
        next();

    } catch (error) {
        return res.status(401).json({
            mensaje: 'Sesión inválida o vencida. Inicia sesión nuevamente.'
        });
    }
}
// Verificar que el usuario sea administrador
function verificarAdmin(req, res, next) {
    if (!req.usuario || req.usuario.rol !== 'admin') {
        return res.status(403).json({
            mensaje: 'Acceso denegado. Solo administradores.'
        });
    }

    next();
}
// ============================================
// 5. REGISTRO DE USUARIOS
// ============================================

app.post('/api/auth/registro', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;

        if (!nombre || !email || !password) {
            return res.status(400).json({
                mensaje: 'Completa todos los campos.'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                mensaje: 'La contraseña debe tener al menos 8 caracteres.'
            });
        }

        const correo = email.trim().toLowerCase();

        const existe = await Usuario.findOne({ email: correo });

        if (existe) {
            return res.status(409).json({
                mensaje: 'Ya existe una cuenta con ese correo.'
            });
        }

        const passwordProtegida = await bcrypt.hash(password, 12);

        const nuevoUsuario = await Usuario.create({
            nombre: nombre.trim(),
            email: correo,
            password: passwordProtegida
        });

        const token = crearToken(nuevoUsuario);

        res.status(201).json({
            mensaje: 'Cuenta creada correctamente.',
            token,
            usuario: {
                id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email
            }
        });

    } catch (error) {
        res.status(500).json({
            mensaje: 'No se pudo crear la cuenta.'
        });
    }
});

// ============================================
// 6. INICIO DE SESIÓN
// ============================================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                mensaje: 'Ingresa tu correo y contraseña.'
            });
        }

        const usuario = await Usuario.findOne({
            email: email.trim().toLowerCase()
        });

        if (!usuario) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos.'
            });
        }

        const coincide = await bcrypt.compare(
            password,
            usuario.password
        );

        if (!coincide) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos.'
            });
        }

        const token = crearToken(usuario);
console.log('ROL EN LOGIN:', usuario.rol);
        res.status(200).json({
    mensaje: 'Inicio de sesión correcto.',
    token,
    usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
    }
});

    } catch (error) {
        res.status(500).json({
            mensaje: 'No se pudo iniciar sesión.'
        });
    }
});

// ============================================
// 7. CONSULTAR LA SESIÓN ACTUAL
// ============================================

app.get('/api/auth/me', verificarToken, (req, res) => {
    res.json({
        usuario: req.usuario
    });
});

// ============================================
// 8. CERRAR SESIÓN
// ============================================

// El cierre se realiza eliminando el token en el navegador.
// Esta ruta permite confirmar la operación.

app.post('/api/auth/logout', verificarToken, (req, res) => {
    res.json({
        mensaje: 'Sesión cerrada correctamente.'
    });
});

// ============================================
// 9. ESTADO DEL SERVIDOR
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        estado: 'correcto',
        servidor: 'Balancea360',
        baseDatos: mongoose.connection.readyState === 1
            ? 'conectada'
            : 'desconectada'
    });
});

// ============================================
// 10. CONSULTAR MOVIMIENTOS DEL USUARIO
// ============================================

app.get('/api/movimientos', verificarToken, async (req, res) => {
    try {
        const { tipo, mes, categoria } = req.query;

        const filtros = {
            usuario: req.usuario._id
        };

        if (tipo) {
            if (!['ingreso', 'gasto'].includes(tipo)) {
                return res.status(400).json({
                    mensaje: 'Tipo de movimiento no válido.'
                });
            }

            filtros.tipo = tipo;
        }

        if (categoria) {
            filtros.categoria = categoria;
        }

        if (mes) {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
                return res.status(400).json({
                    mensaje: 'El mes debe tener formato YYYY-MM.'
                });
            }

            const [anio, numeroMes] = mes.split('-').map(Number);

            filtros.fecha = {
                $gte: new Date(Date.UTC(anio, numeroMes - 1, 1)),
                $lt: new Date(Date.UTC(anio, numeroMes, 1))
            };
        }

        const movimientos = await Movimiento.find(filtros)
            .sort({ fecha: -1 });

        res.json(movimientos);

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al consultar movimientos.'
        });
    }
});

// ============================================
// 11. REGISTRAR MOVIMIENTO
// ============================================

app.post('/api/movimientos', verificarToken, async (req, res) => {
    try {
        const { tipo, concepto, categoria, monto, fecha } = req.body;

        if (!tipo || !concepto || !categoria || monto == null || !fecha) {
            return res.status(400).json({
                mensaje: 'Completa todos los campos.'
            });
        }

        if (!['ingreso', 'gasto'].includes(tipo)) {
            return res.status(400).json({
                mensaje: 'Tipo de movimiento no válido.'
            });
        }

        const cantidad = Number(monto);
        const nuevaFecha = new Date(fecha);

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            return res.status(400).json({
                mensaje: 'El monto debe ser mayor que cero.'
            });
        }

        if (Number.isNaN(nuevaFecha.getTime())) {
            return res.status(400).json({
                mensaje: 'Fecha no válida.'
            });
        }

        const movimiento = await Movimiento.create({
            usuario: req.usuario._id,
            tipo,
            concepto: concepto.trim(),
            categoria: categoria.trim(),
            monto: cantidad,
            fecha: nuevaFecha
        });

        res.status(201).json({
            mensaje: 'Movimiento guardado correctamente.',
            movimiento
        });

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al guardar el movimiento.'
        });
    }
});

// ============================================
// 12. ACTUALIZAR MOVIMIENTO
// ============================================

app.put('/api/movimientos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                mensaje: 'Identificador no válido.'
            });
        }

        const datos = {};

        const campos = ['tipo', 'concepto', 'categoria', 'monto', 'fecha'];

        for (const campo of campos) {
            if (req.body[campo] !== undefined) {
                datos[campo] = req.body[campo];
            }
        }

        if (datos.tipo && !['ingreso', 'gasto'].includes(datos.tipo)) {
            return res.status(400).json({
                mensaje: 'Tipo no válido.'
            });
        }

        if (datos.monto !== undefined) {
            datos.monto = Number(datos.monto);

            if (!Number.isFinite(datos.monto) || datos.monto <= 0) {
                return res.status(400).json({
                    mensaje: 'Monto no válido.'
                });
            }
        }

        if (datos.fecha !== undefined) {
            datos.fecha = new Date(datos.fecha);

            if (Number.isNaN(datos.fecha.getTime())) {
                return res.status(400).json({
                    mensaje: 'Fecha no válida.'
                });
            }
        }

        const movimiento = await Movimiento.findOneAndUpdate(
            {
                _id: id,
                usuario: req.usuario._id
            },
            datos,
            {
                new: true,
                runValidators: true
            }
        );

        if (!movimiento) {
            return res.status(404).json({
                mensaje: 'Movimiento no encontrado.'
            });
        }

        res.json({
            mensaje: 'Movimiento actualizado.',
            movimiento
        });

    } catch (error) {
        res.status(400).json({
            mensaje: 'No se pudo actualizar el movimiento.'
        });
    }
});

// ============================================
// 13. ELIMINAR MOVIMIENTO
// ============================================

app.delete('/api/movimientos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                mensaje: 'Identificador no válido.'
            });
        }

        const movimiento = await Movimiento.findOneAndDelete({
            _id: id,
            usuario: req.usuario._id
        });

        if (!movimiento) {
            return res.status(404).json({
                mensaje: 'Movimiento no encontrado.'
            });
        }

        res.json({
            mensaje: 'Movimiento eliminado correctamente.'
        });

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al eliminar el movimiento.'
        });
    }
});
// ===============================
// RUTAS DEL PANEL ADMINISTRATIVO
// ===============================

// Listar usuarios
app.get('/api/admin/usuarios', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const usuarios = await Usuario.find()
            .select('-password')
            .sort({ createdAt: -1 });

        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener usuarios' });
    }
});

// Listar contactos
app.get('/api/admin/contactos', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const contactos = await Contacto.find().sort({ createdAt: -1 });
        res.json(contactos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener contactos' });
    }
});

// Listar movimientos
app.get('/api/admin/movimientos', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const movimientos = await Movimiento.find()
            .populate('usuario', 'nombre email')
            .sort({ createdAt: -1 });

        res.json(movimientos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener movimientos' });
    }
});

// Estadísticas generales
app.get('/api/admin/estadisticas', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [usuarios, contactos, movimientos] = await Promise.all([
            Usuario.countDocuments(),
            Contacto.countDocuments(),
            Movimiento.countDocuments()
        ]);

        res.json({
            usuarios,
            contactos,
            movimientos
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener estadísticas' });
    }
});
// ============================================
// 14. FORMULARIO DE CONTACTO
// ============================================

// Guardar un mensaje en MongoDB
app.post('/api/contactos', async (req, res) => {
    try {
        const { nombre, email, asunto, mensaje } = req.body;

        if (!nombre || !email || !asunto || !mensaje) {
            return res.status(400).json({
                mensaje: 'Completa todos los campos.'
            });
        }

        const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        if (!correoValido) {
            return res.status(400).json({
                mensaje: 'Ingresa un correo electrónico válido.'
            });
        }

        const nuevoContacto = await Contacto.create({
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            asunto: asunto.trim(),
            mensaje: mensaje.trim()
        });

        res.status(201).json({
            mensaje: 'Tu mensaje se ha enviado correctamente.',
            contacto: {
                id: nuevoContacto._id,
                fecha: nuevoContacto.createdAt
            }
        });

    } catch (error) {
        console.error('Error al guardar contacto:', error);

        res.status(500).json({
            mensaje: 'No se pudo enviar el mensaje. Inténtalo nuevamente.'
        });
    }
});

// ============================================
// 15 ASISTENTE FINANCIERO CON INTELIGENCIA ARTIFICIAL
// ============================================

app.post('/api/asistente', verificarToken, async (req, res) => {
    try {
        const { ingresos, gastos, objetivo } = req.body;

        const totalIngresos = Number(ingresos);
        const totalGastos = Number(gastos);

        if (
            !Number.isFinite(totalIngresos) ||
            !Number.isFinite(totalGastos) ||
            totalIngresos <= 0 ||
            totalGastos < 0 ||
            typeof objetivo !== 'string' ||
            !objetivo.trim() ||
            objetivo.length > 1000
        ) {
            return res.status(400).json({
                mensaje: 'Verifica los ingresos, gastos y objetivo.'
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Falta configurar GEMINI_API_KEY en .env');
        }

        const { GoogleGenAI } = await import('@google/genai');

        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });

        let resultado;

        for (let intento = 1; intento <= 2; intento++) {
            try {
                resultado = await ai.models.generateContent({
                    model: 'gemini-3.8-flash',
                    contents: `
                Eres el asistente financiero de Balancea360.
                Responde en español, de forma clara y profesional.

                Ingresos mensuales: $${totalIngresos}
                Gastos mensuales: $${totalGastos}
                Objetivo: ${objetivo.trim()}

                Calcula el balance mensual y ofrece recomendaciones
                prácticas para ahorrar y organizar el dinero.

                No inventes datos ni prometas resultados financieros.
                Tus recomendaciones son orientativas.
            `
                });

                break;

            } catch (error) {
                const codigo = Number(
                    error.status ||
                    error.statusCode ||
                    error.response?.status ||
                    (error.message.match(/"code"\s*:\s*(\d{3})/) || [])[1]
                );

                const esTemporal = codigo === 503 || codigo === 429;

                if (!esTemporal || intento === 2) {
                    throw error;
                }

                console.log(
                    'Gemini está ocupado. Reintentando en 2 segundos...'
                );

                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (!resultado) {
            throw new Error('Gemini no pudo generar el análisis.');
        }

        res.json({
            mensaje: 'Análisis generado correctamente.',
            respuesta: resultado.text
        });

    } catch (error) {
        console.error('Error en Gemini:', error.message);

        const estado = error.status || error.statusCode;

        if (estado === 503 || estado === 429) {
            return res.status(503).json({
                mensaje: 'El asistente financiero está ocupado. Espera un momento e inténtalo nuevamente.'
            });
        }

        res.status(500).json({
            mensaje: 'No se pudo generar el análisis. Inténtalo nuevamente.'
        });
    }
});


// ============================================
// 16. INICIAR SERVIDOR
// ============================================

async function iniciarServidor() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('Falta MONGODB_URI en .env');
        }

        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
            throw new Error('Configura un JWT_SECRET de al menos 32 caracteres.');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'balancea360'
        });
        // Configurar cuenta administradora
        await Usuario.updateOne(
        { email: 'jose.tuarezleon@gmail.com' },
        { $set: { rol: 'admin' } }
        );
       

        console.log('Cuenta administradora configurada.');

        console.log('MongoDB conectado correctamente.');

        app.listen(PORT, () => {
            console.log('================================');
            console.log('BALANCEA360');
            console.log(`Servidor: http://localhost:${PORT}`);
            console.log('MongoDB: conectado');
            console.log('================================');
        });

        } catch (error) {
            console.error('No se pudo iniciar el servidor:', error.message);
            process.exit(1);
        }
    }

    iniciarServidor();
