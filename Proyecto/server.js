
// ============================================
// BALANCEA360 - SERVIDOR PRINCIPAL
// ============================================


// 1. IMPORTAR LAS HERRAMIENTAS

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

require('dotenv').config();


// 2. CONFIGURAR EL SERVIDOR

const app = express();

const PORT = process.env.PORT || 3000;


// 3. CONFIGURAR LOS MIDDLEWARES

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));


// 4. CONECTAR CON MONGODB ATLAS

// Esta función conecta nuestro servidor con la base de datos.

async function conectarBaseDatos() {

    try {

        // Comprobar que exista la dirección de conexión
        if (!process.env.MONGODB_URI) {
            throw new Error('No se encontró MONGODB_URI en el archivo .env');
        }

        // Conectar con MongoDB Atlas
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'balancea360'
        });

        console.log('MongoDB Atlas conectado correctamente');

    } catch (error) {

        console.error('Error al conectar con MongoDB:', error.message);

        throw error;

    }

}


// 5. CREAR EL MODELO DE MOVIMIENTOS

// Este modelo define cómo se guardarán los movimientos
// financieros dentro de MongoDB.

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


// Crear el modelo que permitirá trabajar con los movimientos.

const Movimiento = mongoose.model(
    'Movimiento',
    movimientoSchema
);


// 6. RUTA PRINCIPAL

// Cuando alguien visite la página principal,
// el servidor mostrará index.html.

app.get('/', (req, res) => {

    res.sendFile(__dirname + '/index.html');

});


// Rutas para cargar los archivos de diseño y JavaScript.

app.get('/style.css', (req, res) => {

    res.sendFile(__dirname + '/style.css');

});

app.get('/calculos.js', (req, res) => {

    res.sendFile(__dirname + '/calculos.js');

});


// 7. RUTA PARA COMPROBAR EL SERVIDOR

// Permite verificar si el servidor y la base de datos funcionan.

app.get('/api/health', (req, res) => {

    res.status(200).json({

        estado: 'correcto',

        mensaje: 'Servidor de Balancea360 funcionando',

        baseDatos: mongoose.connection.readyState === 1
            ? 'conectada'
            : 'desconectada'

    });

});


// 8. CONSULTAR TODOS LOS MOVIMIENTOS (GET)

// También permite filtrar por tipo, mes y categoría.

app.get('/api/movimientos', async (req, res) => {

    try {

        const { tipo, mes, categoria } = req.query;

        const filtros = {};


        // Filtrar por ingreso o gasto.

        if (tipo) {

            if (!['ingreso', 'gasto'].includes(tipo)) {
                return res.status(400).json({
                    mensaje: 'El tipo debe ser ingreso o gasto'
                });
            }

            filtros.tipo = tipo;

        }


        // Filtrar por categoría.

        if (categoria) {

            filtros.categoria = categoria;

        }


        // Filtrar por mes.

        if (mes) {

            if (!/^\d{4}-\d{2}$/.test(mes)) {

                return res.status(400).json({
                    mensaje: 'El mes debe tener formato YYYY-MM'
                });

            }

            const [anio, numeroMes] = mes.split('-').map(Number);

            if (numeroMes < 1 || numeroMes > 12) {
                return res.status(400).json({
                    mensaje: 'El mes debe estar entre 01 y 12'
                });
            }

            const inicio = new Date(Date.UTC(anio, numeroMes - 1, 1));

            const fin = new Date(Date.UTC(anio, numeroMes, 1));

            filtros.fecha = {
                $gte: inicio,
                $lt: fin
            };

        }


        // Buscar los movimientos en MongoDB.

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


// 9. BUSCAR UN MOVIMIENTO POR SU ID (GET)

app.get('/api/movimientos/:id', async (req, res) => {

    try {

        const { id } = req.params;


        // Comprobar que el ID sea válido.

        if (!mongoose.isValidObjectId(id)) {

            return res.status(400).json({
                mensaje: 'Identificador no válido'
            });

        }


        // Buscar el movimiento.

        const movimiento = await Movimiento.findById(id);


        if (!movimiento) {

            return res.status(404).json({
                mensaje: 'Movimiento no encontrado'
            });

        }


        res.status(200).json(movimiento);


    } catch (error) {

        res.status(500).json({

            mensaje: 'Error al buscar movimiento',

            error: error.message

        });

    }

});


// 10. REGISTRAR UN MOVIMIENTO (POST)

app.post('/api/movimientos', async (req, res) => {

    try {

        const { tipo, concepto, categoria, monto, fecha } = req.body;


        // Comprobar que no falte ningún campo.

        if (
            !tipo ||
            !concepto ||
            !categoria ||
            monto === undefined ||
            monto === null ||
            !fecha
        ) {

            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios'
            });

        }


        // Comprobar el tipo de movimiento.

        if (!['ingreso', 'gasto'].includes(tipo)) {

            return res.status(400).json({
                mensaje: 'El tipo debe ser ingreso o gasto'
            });

        }


        // Convertir el monto a número.

        const cantidad = Number(monto);


        if (!Number.isFinite(cantidad) || cantidad <= 0) {

            return res.status(400).json({
                mensaje: 'El monto debe ser mayor que cero'
            });

        }


        // Comprobar la fecha.

        const nuevaFecha = new Date(fecha);


        if (Number.isNaN(nuevaFecha.getTime())) {

            return res.status(400).json({
                mensaje: 'La fecha no es válida'
            });

        }


        // Crear un nuevo movimiento.

        const nuevoMovimiento = new Movimiento({

            tipo,

            concepto,

            categoria,

            monto: cantidad,

            fecha: nuevaFecha

        });


        // Guardar el movimiento en MongoDB.

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


// 11. ACTUALIZAR UN MOVIMIENTO (PUT)

app.put('/api/movimientos/:id', async (req, res) => {

    try {

        const { id } = req.params;


        // Comprobar el ID.

        if (!mongoose.isValidObjectId(id)) {

            return res.status(400).json({
                mensaje: 'Identificador no válido'
            });

        }


        const datos = { ...req.body };


        // Comprobar el monto si se desea modificar.

        if (datos.monto !== undefined) {

            datos.monto = Number(datos.monto);

            if (!Number.isFinite(datos.monto) || datos.monto <= 0) {

                return res.status(400).json({
                    mensaje: 'El monto debe ser mayor que cero'
                });

            }

        }


        // Comprobar el tipo si se desea modificar.

        if (
            datos.tipo !== undefined &&
            !['ingreso', 'gasto'].includes(datos.tipo)
        ) {

            return res.status(400).json({
                mensaje: 'Tipo de movimiento no válido'
            });

        }


        // Solo permitir modificar estos campos.

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


        // Actualizar el movimiento en MongoDB.

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


// 12. ELIMINAR UN MOVIMIENTO (DELETE)

app.delete('/api/movimientos/:id', async (req, res) => {

    try {

        const { id } = req.params;


        // Comprobar el ID.

        if (!mongoose.isValidObjectId(id)) {

            return res.status(400).json({
                mensaje: 'Identificador no válido'
            });

        }


        // Eliminar el movimiento.

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


// 13. INICIAR EL SERVIDOR

// Primero conecta con MongoDB.
// Después inicia el servidor web.

async function iniciarServidor() {

    try {

        await conectarBaseDatos();


        app.listen(PORT, () => {

            console.log('================================');

            console.log('       BALANCEA360');

            console.log('================================');

            console.log(`Servidor: http://localhost:${PORT}`);

            console.log('Base de datos: conectada');

            console.log('Servidor iniciado correctamente');

            console.log('================================');

        });


    } catch (error) {

        console.error('No se pudo iniciar el servidor:', error.message);

        process.exit(1);

    }

}


// Ejecutar la función para iniciar todo.

iniciarServidor();
