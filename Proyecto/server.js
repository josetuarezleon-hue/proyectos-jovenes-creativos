
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================
// 1. MIDDLEWARES
// ======================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================
// 2. CONEXION CON MONGODB
// ======================================

mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'balancea360'
})
.then(() => console.log('MongoDB conectado correctamente'))
.catch(error => console.error('Error de MongoDB:', error.message));

// ======================================
// 3. MODELO DE MOVIMIENTOS
// ======================================

const movimientoSchema = new mongoose.Schema({
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

const Movimiento = mongoose.model(
    'Movimiento',
    movimientoSchema
);

// ======================================
// 4. RUTA PRINCIPAL
// ======================================

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Archivos del frontend
app.get('/style.css', (req, res) => {
    res.sendFile(__dirname + '/style.css');
});

app.get('/calculos.js', (req, res) => {
    res.sendFile(__dirname + '/calculos.js');
});

// ======================================
// 5. RUTA DE COMPROBACION
// ======================================

app.get('/api/health', (req, res) => {
    res.status(200).json({
        estado: 'correcto',
        mensaje: 'Servidor de Balancea360 funcionando',
        baseDatos: mongoose.connection.readyState === 1
            ? 'conectada'
            : 'desconectada'
    });
});

// ======================================
// 6. METODO GET: CONSULTAR MOVIMIENTOS
// ======================================

app.get('/api/movimientos', async (req, res) => {
    try {
        // Parametros de consulta: ?tipo=gasto&mes=2026-11
        const { tipo, mes, categoria } = req.query;

        const filtros = {};

        if (tipo) {
            filtros.tipo = tipo;
        }

        if (categoria) {
            filtros.categoria = categoria;
        }

        if (mes) {
            if (!/^\d{4}-\d{2}$/.test(mes)) {
                return res.status(400).json({
                    mensaje: 'El mes debe tener formato YYYY-MM'
                });
            }

            const [anio, numeroMes] = mes.split('-').map(Number);

            const inicio = new Date(Date.UTC(anio, numeroMes - 1, 1));
            const fin = new Date(Date.UTC(anio, numeroMes, 1));

            filtros.fecha = {
                $gte: inicio,
                $lt: fin
            };
        }

        const movimientos = await Movimiento.find(filtros)
            .sort({ fecha: -1 });

        res.status(200).json(movimientos);

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al consultar movimientos',
            error: error.message
        });
    }
});

// ======================================
// 7. METODO GET: BUSCAR POR ID
// ======================================

app.get('/api/movimientos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                mensaje: 'Identificador no válido'
            });
        }

        const movimiento = await Movimiento.findById(id);

        if (!movimiento) {
            return res.status(404).json({
                mensaje: 'Movimiento no encontrado'
            });
        }

        res.status(200).json(movimiento);

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al buscar movimiento'
        });
    }
});

// ======================================
// 8. METODO POST: REGISTRAR MOVIMIENTO
// ======================================

app.post('/api/movimientos', async (req, res) => {
    try {
        const { tipo, concepto, categoria, monto, fecha } = req.body;

        if (!tipo || !concepto || !categoria || !monto || !fecha) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios'
            });
        }

        if (!['ingreso', 'gasto'].includes(tipo)) {
            return res.status(400).json({
                mensaje: 'El tipo debe ser ingreso o gasto'
            });
        }

        const cantidad = Number(monto);

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            return res.status(400).json({
                mensaje: 'El monto debe ser un número mayor que cero'
            });
        }

        const nuevaFecha = new Date(fecha);

        if (Number.isNaN(nuevaFecha.getTime())) {
            return res.status(400).json({
                mensaje: 'La fecha no es válida'
            });
        }

        const nuevoMovimiento = new Movimiento({
            tipo,
            concepto,
            categoria,
            monto: cantidad,
            fecha: nuevaFecha
        });

        const movimientoGuardado = await nuevoMovimiento.save();

        res.status(201).json({
            mensaje: 'Movimiento registrado correctamente',
            movimiento: movimientoGuardado
        });

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al registrar movimiento',
            error: error.message
        });
    }
});

// ======================================
// 9. METODO PUT: ACTUALIZAR MOVIMIENTO
// ======================================

app.put('/api/movimientos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                mensaje: 'Identificador no válido'
            });
        }

        const datos = { ...req.body };

        if (datos.monto !== undefined) {
            datos.monto = Number(datos.monto);

            if (!Number.isFinite(datos.monto) || datos.monto <= 0) {
                return res.status(400).json({
                    mensaje: 'El monto debe ser mayor que cero'
                });
            }
        }

        if (datos.tipo !== undefined &&
            !['ingreso', 'gasto'].includes(datos.tipo)) {
            return res.status(400).json({
                mensaje: 'Tipo de movimiento no válido'
            });
        }

        const camposPermitidos = [
            'tipo',
            'concepto',
            'categoria',
            'monto',
            'fecha'
        ];

        const actualizacion = {};

        for (const campo of camposPermitidos) {
            if (datos[campo] !== undefined) {
                actualizacion[campo] = datos[campo];
            }
        }

        const movimientoActualizado = await Movimiento.findByIdAndUpdate(
            id,
            actualizacion,
            {
                new: true,
                runValidators: true
            }
        );

        if (!movimientoActualizado) {
            return res.status(404).json({
                mensaje: 'Movimiento no encontrado'
            });
        }

        res.status(200).json({
            mensaje: 'Movimiento actualizado correctamente',
            movimiento: movimientoActualizado
        });

    } catch (error) {
        res.status(400).json({
            mensaje: 'No se pudo actualizar el movimiento',
            error: error.message
        });
    }
});

// ======================================
// 10. METODO DELETE: ELIMINAR MOVIMIENTO
// ======================================

app.delete('/api/movimientos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                mensaje: 'Identificador no válido'
            });
        }

        const movimientoEliminado = await Movimiento.findByIdAndDelete(id);

        if (!movimientoEliminado) {
            return res.status(404).json({
                mensaje: 'Movimiento no encontrado'
            });
        }

        res.status(200).json({
            mensaje: 'Movimiento eliminado correctamente'
        });

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al eliminar movimiento',
            error: error.message
        });
    }
});

// ======================================
// 11. INICIAR SERVIDOR
// ======================================

async function iniciarServidor() {
    try {
        await mongoose.connection.asPromise();

        app.listen(PORT, () => {
            console.log('--------------------------------');
            console.log('BALANCEA360');
            console.log(`Servidor: http://localhost:${PORT}`);
            console.log('MongoDB: conectado');
            console.log('--------------------------------');
        });

    } catch (error) {
        console.error(
            'No se pudo iniciar el servidor:',
            error.message
        );
        process.exit(1);
    }
}

iniciarServidor();
