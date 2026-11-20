"use strict";

// ============================================
// BALANCEA360 - LÓGICA PRINCIPAL
// ============================================

const $ = (id) => document.getElementById(id);

const API = "/api";

const formatoDinero = (cantidad) =>
    new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD"
    }).format(Number(cantidad) || 0);

const fechaActual = () => {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
};

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================

let movimientos = [];
let usuarioActual = null;
let token = localStorage.getItem("balancea360_token");

let servicios = [
    {
        id: 1,
        nombre: "Plan de ahorro",
        descripcion: "Organiza tus metas y controla cuánto necesitas ahorrar.",
        precio: 0
    },
    {
        id: 2,
        nombre: "Control de gastos",
        descripcion: "Identifica tus gastos y encuentra oportunidades de ahorro.",
        precio: 0
    },
    {
        id: 3,
        nombre: "Planificación mensual",
        descripcion: "Distribuye tus ingresos según tus prioridades.",
        precio: 0
    }
];

let contactos = JSON.parse(
    localStorage.getItem("balancea360_contactos") || "[]"
);

// ============================================
// COMUNICACIÓN CON EL SERVIDOR
// ============================================

async function solicitarAPI(ruta, opciones = {}) {
    const encabezados = {
        "Content-Type": "application/json",
        ...opciones.headers
    };

    if (token) {
        encabezados.Authorization = `Bearer ${token}`;
    }

    const respuesta = await fetch(`${API}${ruta}`, {
        ...opciones,
        headers: encabezados
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
        if (respuesta.status === 401) {
            cerrarSesionLocal();
        }

        throw new Error(datos.mensaje || "Ocurrió un error.");
    }

    return datos;
}

// ============================================
// MENSAJES
// ============================================

function mostrarMensaje(id, mensaje, esError = false) {
    const elemento = $(id);
    if (!elemento) return;

    elemento.textContent = mensaje;
    elemento.style.color = esError ? "#b91c1c" : "#15803d";
}

function crearElemento(etiqueta, texto, clase = "") {
    const elemento = document.createElement(etiqueta);
    elemento.textContent = texto;

    if (clase) {
        elemento.className = clase;
    }

    return elemento;
}

// ============================================
// MOVIMIENTOS FINANCIEROS
// ============================================

function calcularTotales(lista = movimientos) {
    return lista.reduce((totales, movimiento) => {
        if (movimiento.tipo === "ingreso") {
            totales.ingresos += Number(movimiento.monto);
        } else {
            totales.gastos += Number(movimiento.monto);
        }

        return totales;
    }, {
        ingresos: 0,
        gastos: 0
    });
}

async function cargarMovimientos() {
    if (!token) {
        movimientos = [];
        renderizarMovimientos();
        return;
    }

    try {
        movimientos = await solicitarAPI("/movimientos");
        renderizarMovimientos();
    } catch (error) {
        console.error(error);
        mostrarMensaje("respuesta-asistente", error.message, true);
    }
}

function renderizarMovimientos() {
    const lista = $("lista-movimientos");
    if (!lista) return;

    lista.replaceChildren();

    const filtroTipo = $("filtro-tipo")?.value || "todos";
    const filtroMes = $("filtro-mes")?.value || "";

    const filtrados = movimientos.filter((movimiento) => {
        const coincideTipo =
            filtroTipo === "todos" || movimiento.tipo === filtroTipo;

        const coincideMes =
            !filtroMes ||
            String(movimiento.fecha).slice(0, 7) === filtroMes;

        return coincideTipo && coincideMes;
    });

    const mostrarEstado = (mensaje) => {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 5;
        celda.className = "table-empty";
        celda.textContent = mensaje;

        fila.appendChild(celda);
        lista.appendChild(fila);
    };

    if (!token) {
        mostrarEstado("Inicia sesión para consultar tus movimientos.");

    } else if (filtrados.length === 0) {
        mostrarEstado("Todavía no hay movimientos para mostrar.");

    } else {
        filtrados.forEach((movimiento) => {

            const fila = document.createElement("tr");

            // CONCEPTO
            const concepto = document.createElement("td");
            concepto.className = "movement-concept";
            concepto.textContent = movimiento.concepto || "Sin concepto";

            // CATEGORÍA
            const categoria = document.createElement("td");
            categoria.textContent = movimiento.categoria || "—";

            // FECHA
            const fecha = document.createElement("td");
            fecha.textContent =
                String(movimiento.fecha || "").slice(0, 10) || "—";

            // MONTO
            const importe = document.createElement("td");

            importe.className =
                `movement-amount ${movimiento.tipo === "ingreso"
                    ? "is-income"
                    : "is-expense"
                }`;

            importe.textContent =
                `${movimiento.tipo === "ingreso" ? "+" : "-"}${formatoDinero(movimiento.monto)}`;

            // ACCIÓN
            const accion = document.createElement("td");
            accion.className = "movement-action";

            const eliminar = crearElemento(
                "button",
                "Eliminar",
                "btn btn-danger btn-small"
            );

            eliminar.type = "button";

            eliminar.setAttribute(
                "aria-label",
                `Eliminar movimiento ${movimiento.concepto || ""}`
            );

            eliminar.addEventListener("click", async () => {

                if (!confirm("¿Deseas eliminar este movimiento?")) {
                    return;
                }

                try {
                    await solicitarAPI(
                        `/movimientos/${movimiento._id}`,
                        {
                            method: "DELETE"
                        }
                    );

                    await cargarMovimientos();

                } catch (error) {
                    alert(error.message);
                }
            });

            accion.appendChild(eliminar);

            // AGREGAR LAS CINCO COLUMNAS
            fila.append(
                concepto,
                categoria,
                fecha,
                importe,
                accion
            );

            lista.appendChild(fila);
        });
    }

    actualizarTotales();
}


function actualizarTotales() {
    const filtroMes = $("filtro-mes")?.value || "";

    const movimientosDelMes = movimientos.filter((movimiento) => {
        return (
            !filtroMes ||
            String(movimiento.fecha).slice(0, 7) === filtroMes
        );
    });

    const totales = calcularTotales(movimientosDelMes);
    const balance = totales.ingresos - totales.gastos;

    if ($("total-ingresos")) {
        $("total-ingresos").textContent =
            formatoDinero(totales.ingresos);
    }

    if ($("total-gastos")) {
        $("total-gastos").textContent =
            formatoDinero(totales.gastos);
    }

    if ($("balance-total")) {
        $("balance-total").textContent =
            formatoDinero(balance);
    }
}

// Mostrar la categoría únicamente cuando se seleccione "Gasto".
$("tipo-movimiento")?.addEventListener("change", () => {
    const esGasto = $("tipo-movimiento").value === "gasto";
    const detalle = $("detalle-gasto");
    const categoria = $("categoria");

    if (detalle) {
        detalle.hidden = !esGasto;
    }

    if (categoria) {
        categoria.required = esGasto;

        if (!esGasto) {
            categoria.value = "";
        }
    }
});


// Registrar movimientos en MongoDB.
$("form-movimiento")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!token) {
        alert("Debes iniciar sesión antes de registrar movimientos.");
        return;
    }

    const tipo = $("tipo-movimiento")?.value;
    const categoria = $("categoria")?.value || "";
    const monto = Number($("monto")?.value);
    const fecha = $("fecha-movimiento")?.value || fechaActual();

    if (!["ingreso", "gasto"].includes(tipo)) {
        alert("Selecciona un tipo de movimiento válido.");
        return;
    }

    if (tipo === "gasto" && !categoria) {
        alert("Selecciona la categoría del gasto.");
        return;
    }

    if (!Number.isFinite(monto) || monto <= 0) {
        alert("Ingresa un monto mayor que cero.");
        return;
    }

    const concepto = tipo === "ingreso" ? "Ingreso" : categoria;

    try {
        await solicitarAPI("/movimientos", {
            method: "POST",
            body: JSON.stringify({
                tipo,
                concepto,
                categoria: tipo === "ingreso" ? "Ingreso" : categoria,
                monto,
                fecha
            })
        });

        evento.target.reset();

        if ($("fecha-movimiento")) {
            $("fecha-movimiento").value = fechaActual();
        }

        $("tipo-movimiento")?.dispatchEvent(new Event("change"));

        await cargarMovimientos();

        alert("Movimiento guardado correctamente en MongoDB.");

    } catch (error) {
        alert(error.message);
    }
});

$("filtro-tipo")?.addEventListener("change", renderizarMovimientos);
$("filtro-mes")?.addEventListener("change", renderizarMovimientos);

// ============================================
// REGISTRO DE USUARIOS
// ============================================

$("form-registro")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const nombre = $("registro-nombre")?.value.trim();
    const email = $("registro-email")?.value.trim();
    const password = $("registro-password")?.value || "";

    if (!nombre || !email || password.length < 8) {
        mostrarMensaje(
            "mensaje-registro",
            "Completa los campos. La contraseña debe tener al menos 8 caracteres.",
            true
        );
        return;
    }

    try {
        const datos = await solicitarAPI("/auth/registro", {
            method: "POST",
            body: JSON.stringify({ nombre, email, password })
        });

        guardarSesion(datos);

        evento.target.reset();

        await cargarMovimientos();

        window.location.href = "index.html#presupuesto";

    } catch (error) {
        mostrarMensaje("mensaje-registro", error.message, true);
    }
});

// ============================================
// INICIO DE SESIÓN
// ============================================

$("form-login")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const email = $("login-email")?.value.trim();
    const password = $("login-password")?.value || "";

    if (!email || !password) {
        mostrarMensaje("mensaje-login", "Completa tu correo y contraseña.", true);
        return;
    }

    try {
        const datos = await solicitarAPI("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        guardarSesion(datos);

        evento.target.reset();

        await cargarMovimientos();

        window.location.href = "index.html#presupuesto";

    } catch (error) {
        mostrarMensaje("mensaje-login", error.message, true);
    }
});

// ============================================
// SESIÓN Y ESTADO DE LA CUENTA
// ============================================

function guardarSesion(datos) {
    token = datos.token;
    usuarioActual = datos.usuario;

    localStorage.setItem("balancea360_token", token);

    actualizarEstadoCuenta();

    if (typeof renderizarAdministracion === "function") {
        renderizarAdministracion();
    }
}
function actualizarEstadoCuenta() {
    const estado = $("estado-cuenta");
    const formularios = document.querySelector(".access-grid");
    const botonCerrar = $("btn-cerrar-sesion");
    const usuarioHeader = $("usuario-header");
    const enlaceLogin = $("enlace-login");
    const enlaceRegistro = $("enlace-registro");
    const enlaceAdmin = $("enlace-admin");

    // Secciones de bienvenida
    const bienvenida = document.querySelector(".hero");
    const caracteristicas = document.querySelector(".features");

    if (usuarioActual) {
        // Usuario con sesión iniciada
        if (estado) {
            estado.textContent =
                `¡Bienvenido, ${usuarioActual.nombre}!`;
        }
        if (enlaceAdmin) {
            enlaceAdmin.hidden = usuarioActual.rol !== "admin";
        }
        if (formularios) formularios.hidden = true;
        if (botonCerrar) botonCerrar.hidden = false;

        if (usuarioHeader) {
            usuarioHeader.textContent =
                `Hola, ${usuarioActual.nombre}`;
            usuarioHeader.hidden = false;
        }

        if (enlaceLogin) enlaceLogin.hidden = true;
        if (enlaceRegistro) enlaceRegistro.hidden = true;

        // Ocultar la bienvenida
        if (bienvenida) bienvenida.hidden = true;
        if (caracteristicas) caracteristicas.hidden = true;

    } else {
        // Usuario sin sesión iniciada
        if (estado) {
            estado.textContent = "No has iniciado sesión.";
        }
        if (enlaceAdmin) {
            enlaceAdmin.hidden = true;
        }
        if (formularios) formularios.hidden = false;
        if (botonCerrar) botonCerrar.hidden = true;
        if (usuarioHeader) usuarioHeader.hidden = true;

        if (enlaceLogin) enlaceLogin.hidden = false;
        if (enlaceRegistro) enlaceRegistro.hidden = false;

        // Mostrar la bienvenida
        if (bienvenida) bienvenida.hidden = false;
        if (caracteristicas) caracteristicas.hidden = false;
    }
}


function cerrarSesionLocal() {
    token = null;
    usuarioActual = null;
    movimientos = [];

    localStorage.removeItem("balancea360_token");

    actualizarEstadoCuenta();
    renderizarMovimientos();

    window.location.href = "index.html#presupuesto";
}

$("btn-cerrar-sesion")?.addEventListener("click", () => {
    cerrarSesionLocal();
    alert("Has cerrado tu sesión.");
});

$("btn-recuperar-password")?.addEventListener("click", () => {
    alert("La recuperación de contraseña todavía no está implementada.");
});

async function renderizarAdministracion() {
    if (!usuarioActual || usuarioActual.rol !== "admin") return;

    const panel = $("admin-contenido");
    if (!panel) return;

    panel.replaceChildren();

    try {
        const [estadisticas, usuarios, contactos, movimientos] =
            await Promise.all([
                solicitarAPI("/admin/estadisticas"),
                solicitarAPI("/admin/usuarios"),
                solicitarAPI("/admin/contactos"),
                solicitarAPI("/admin/movimientos")
            ]);

        if ($("admin-total-usuarios")) {
            $("admin-total-usuarios").textContent = estadisticas.usuarios;
        }

        if ($("admin-total-contactos")) {
            $("admin-total-contactos").textContent = estadisticas.contactos;
        }

        if ($("admin-total-movimientos")) {
            $("admin-total-movimientos").textContent = estadisticas.movimientos;
        }

        // Crear secciones
        function crearSeccion(titulo, descripcion) {
            const seccion = document.createElement("section");
            seccion.className = "admin-section";

            const encabezado = document.createElement("div");
            encabezado.className = "admin-section-heading";

            const h2 = crearElemento("h2", titulo);
            const p = crearElemento("p", descripcion);

            encabezado.append(h2, p);
            seccion.appendChild(encabezado);

            return seccion;
        }

        // Crear tablas
        function crearTabla(columnas, filas) {
            const contenedor = document.createElement("div");
            contenedor.className = "admin-table-wrapper";

            const tabla = document.createElement("table");
            tabla.className = "admin-table";

            const thead = document.createElement("thead");
            const filaEncabezado = document.createElement("tr");

            columnas.forEach(columna => {
                filaEncabezado.appendChild(
                    crearElemento("th", columna)
                );
            });

            thead.appendChild(filaEncabezado);
            tabla.appendChild(thead);

            const tbody = document.createElement("tbody");

            if (filas.length === 0) {
                const fila = document.createElement("tr");
                const celda = crearElemento(
                    "td",
                    "No hay información disponible."
                );

                celda.colSpan = columnas.length;
                celda.className = "admin-empty";

                fila.appendChild(celda);
                tbody.appendChild(fila);
            } else {
                filas.forEach(datos => {
                    const fila = document.createElement("tr");

                    datos.forEach(dato => {
                        const celda = document.createElement("td");

                        if (dato instanceof Node) {
                            celda.appendChild(dato);
                        } else {
                            celda.textContent = String(dato ?? "—");
                        }

                        fila.appendChild(celda);
                    });

                    tbody.appendChild(fila);
                });
            }

            tabla.appendChild(tbody);
            contenedor.appendChild(tabla);

            return contenedor;
        }

        // USUARIOS
        const seccionUsuarios = crearSeccion(
            "Usuarios registrados",
            "Cuentas creadas en Balancea360."
        );

        seccionUsuarios.appendChild(crearTabla(
            ["Nombre", "Correo electrónico", "Rol", "Registro"],
            usuarios.map(usuario => [
                usuario.nombre,
                usuario.email,
                usuario.rol,
                usuario.createdAt
                    ? new Date(usuario.createdAt).toLocaleDateString("es-EC")
                    : "—"
            ])
        ));

        panel.appendChild(seccionUsuarios);

        // CONTACTOS
        const seccionContactos = crearSeccion(
            "Mensajes de contacto",
            "Consultas recibidas a través del formulario."
        );

        seccionContactos.appendChild(crearTabla(
            ["Nombre", "Correo", "Asunto", "Mensaje"],
            contactos.map(contacto => [
                contacto.nombre,
                contacto.email,
                contacto.asunto,
                contacto.mensaje
            ])
        ));

        panel.appendChild(seccionContactos);

        // MOVIMIENTOS
        const seccionMovimientos = crearSeccion(
            "Movimientos financieros",
            "Ingresos y gastos registrados por los usuarios."
        );

        seccionMovimientos.appendChild(crearTabla(
            ["Usuario", "Tipo", "Concepto", "Monto", "Fecha"],
            movimientos.map(movimiento => [
                movimiento.usuario?.nombre || "Usuario",
                movimiento.tipo,
                movimiento.concepto || "—",
                formatoDinero(movimiento.monto),
                movimiento.fecha
                    ? new Date(movimiento.fecha).toLocaleDateString("es-EC")
                    : "—"
            ])
        ));

        panel.appendChild(seccionMovimientos);

    } catch (error) {
        console.error("Error en administración:", error);

        panel.replaceChildren(
            crearElemento(
                "p",
                "No se pudo cargar la información administrativa."
            )
        );
    }
}

// ============================================
// SERVICIOS
// ============================================

function renderizarServicios() {
    const catalogo = $("catalogo-servicios");
    if (!catalogo) return;

    catalogo.replaceChildren();

    servicios.forEach((servicio) => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "servicio-card";

        tarjeta.append(
            crearElemento("h3", servicio.nombre),
            crearElemento("p", servicio.descripcion),
            crearElemento(
                "p",
                servicio.precio === 0
                    ? "Gratis"
                    : formatoDinero(servicio.precio)
            )
        );

        catalogo.appendChild(tarjeta);
    });
}

// ============================================
// ASISTENTE FINANCIERO
// ============================================

$("form-asistente")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!token) {
        mostrarMensaje(
            "respuesta-asistente",
            "Inicia sesión para utilizar el asistente financiero.",
            true
        );
        return;
    }

    const ingresos = Number($("ia-ingresos")?.value);
    const gastos = Number($("ia-gastos")?.value);
    const objetivo = $("ia-objetivo")?.value.trim();

    if (
        !Number.isFinite(ingresos) ||
        !Number.isFinite(gastos) ||
        ingresos <= 0 ||
        gastos < 0 ||
        !objetivo
    ) {
        mostrarMensaje(
            "respuesta-asistente",
            "Completa los datos financieros correctamente.",
            true
        );
        return;
    }

    const boton = evento.target.querySelector(
        'button[type="submit"]'
    );

    if (boton) {
        boton.disabled = true;
        boton.textContent = "Analizando...";
    }

    mostrarMensaje(
        "respuesta-asistente",
        "La inteligencia artificial está analizando tus datos..."
    );

    try {
        const datos = await solicitarAPI("/asistente", {
            method: "POST",
            body: JSON.stringify({
                ingresos,
                gastos,
                objetivo
            })
        });

        mostrarMensaje(
            "respuesta-asistente",
            datos.respuesta
        );

    } catch (error) {
        mostrarMensaje(
            "respuesta-asistente",
            error.message,
            true
        );

    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = "Obtener recomendaciones";
        }
    }
});

// ============================================
// CONTACTO
// ============================================

// ============================================
// CONTACTO
// ============================================

$("form-contacto")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const formulario = evento.target;

    const nombre = $("contacto-nombre")?.value.trim();
    const email = $("contacto-email")?.value.trim();
    const asunto = $("contacto-asunto")?.value.trim();
    const mensaje = $("contacto-mensaje")?.value.trim();

    if (!nombre || !email || !asunto || !mensaje) {
        mostrarMensaje(
            "mensaje-contacto",
            "Completa todos los campos.",
            true
        );
        return;
    }

    const boton = formulario.querySelector('button[type="submit"]');

    try {
        if (boton) {
            boton.disabled = true;
            boton.textContent = "Enviando...";
        }

        const datos = await solicitarAPI("/contactos", {
            method: "POST",
            body: JSON.stringify({
                nombre,
                email,
                asunto,
                mensaje
            })
        });

        mostrarMensaje(
            "mensaje-contacto",
            datos.mensaje
        );

        formulario.reset();

    } catch (error) {
        mostrarMensaje(
            "mensaje-contacto",
            error.message,
            true
        );

    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = "Enviar mensaje";
        }
    }
});

// ============================================
// ADMINISTRACIÓN DEMOSTRATIVA
// ============================================


async function renderizarAdministracion() {
    if (!usuarioActual || usuarioActual.rol !== "admin") {
        return;
    }

    const panel = $("admin-contenido");
    if (!panel) return;

    panel.replaceChildren();

    try {
        const [estadisticas, usuarios, contactos, movimientos] =
            await Promise.all([
                solicitarAPI("/admin/estadisticas"),
                solicitarAPI("/admin/usuarios"),
                solicitarAPI("/admin/contactos"),
                solicitarAPI("/admin/movimientos")
            ]);

        if ($("admin-total-usuarios")) {
            $("admin-total-usuarios").textContent =
                estadisticas.usuarios;
        }

        if ($("admin-total-contactos")) {
            $("admin-total-contactos").textContent =
                estadisticas.contactos;
        }

        if ($("admin-total-movimientos")) {
            $("admin-total-movimientos").textContent =
                estadisticas.movimientos;
        }

        panel.appendChild(crearElemento("h2", "Usuarios registrados"));

        usuarios.forEach(usuario => {
            panel.appendChild(crearElemento(
                "p",
                `${usuario.nombre} - ${usuario.email} - ${usuario.rol}`
            ));
        });

        panel.appendChild(crearElemento("h2", "Mensajes de contacto"));

        contactos.forEach(contacto => {
            panel.appendChild(crearElemento(
                "p",
                `${contacto.nombre} - ${contacto.asunto}: ${contacto.mensaje}`
            ));
        });

        panel.appendChild(crearElemento("h2", "Movimientos registrados"));

        movimientos.forEach(movimiento => {
            const propietario = movimiento.usuario?.nombre || "Usuario";

            panel.appendChild(crearElemento(
                "p",
                `${propietario} - ${movimiento.tipo} - ${formatoDinero(movimiento.monto)}`
            ));
        });

    } catch (error) {
        console.error("Error en administración:", error);
        panel.appendChild(crearElemento(
            "p",
            "No se pudo cargar la información administrativa."
        ));
    }
}

// ============================================
// COMPROBAR SESIÓN AL ABRIR LA PÁGINA
// ============================================

async function comprobarSesion() {
    if (!token) {
        usuarioActual = null;
        movimientos = [];

        actualizarEstadoCuenta();
        renderizarMovimientos();
        return;
    }

    try {
        const datos = await solicitarAPI("/auth/me");
        usuarioActual = datos.usuario;
        if (
            window.location.pathname.endsWith("/admin.html") &&
            usuarioActual.rol !== "admin"
        ) {
            window.location.href = "index.html";
            return;
        }

        actualizarEstadoCuenta();
        await cargarMovimientos();
        await renderizarAdministracion();
    } catch (error) {
        token = null;
        usuarioActual = null;
        movimientos = [];

        localStorage.removeItem("balancea360_token");

        actualizarEstadoCuenta();
        renderizarMovimientos();
        if (window.location.pathname.endsWith("/admin.html")) {
            window.location.href = "index.html";
            return;
        }
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
    if ($("fecha-movimiento")) {
        $("fecha-movimiento").value = fechaActual();
    }

    renderizarServicios();
    renderizarAdministracion();

    await comprobarSesion();
    await renderizarAdministracion();
    actualizarTotales();
});
