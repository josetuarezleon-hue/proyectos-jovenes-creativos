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
            !filtroMes || String(movimiento.fecha).startsWith(filtroMes);

        return coincideTipo && coincideMes;
    });

    if (!token) {
        lista.appendChild(
            crearElemento("p", "Inicia sesión para consultar tus movimientos.")
        );
    } else if (filtrados.length === 0) {
        lista.appendChild(
            crearElemento("p", "Todavía no hay movimientos para mostrar.")
        );
    } else {
        filtrados.forEach((movimiento) => {
            const fila = document.createElement("div");
            fila.className = "movimiento-item";

            const informacion = document.createElement("div");

            informacion.append(
                crearElemento("strong", movimiento.concepto),
                crearElemento(
                    "small",
                    `${movimiento.categoria} · ${String(movimiento.fecha).slice(0, 10)}`
                )
            );

            const importe = crearElemento(
                "span",
                `${movimiento.tipo === "ingreso" ? "+" : "-"}${formatoDinero(movimiento.monto)}`
            );

            importe.style.color =
                movimiento.tipo === "ingreso" ? "#15803d" : "#b91c1c";

            const eliminar = crearElemento("button", "Eliminar");
            eliminar.type = "button";

            eliminar.addEventListener("click", async () => {
                if (!confirm("¿Deseas eliminar este movimiento?")) return;

                try {
                    await solicitarAPI(`/movimientos/${movimiento._id}`, {
                        method: "DELETE"
                    });

                    await cargarMovimientos();
                } catch (error) {
                    alert(error.message);
                }
            });

            fila.append(informacion, importe, eliminar);
            lista.appendChild(fila);
        });
    }

    actualizarTotales();
}

function actualizarTotales() {
    const totales = calcularTotales();

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
            formatoDinero(totales.ingresos - totales.gastos);
    }
}

$("form-movimiento")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!token) {
        alert("Debes iniciar sesión antes de registrar movimientos.");
        return;
    }

    const tipo = $("tipo-movimiento")?.value;
    const concepto = $("concepto")?.value.trim();
    const categoria = $("categoria")?.value;
    const monto = Number($("monto")?.value);
    const fecha = $("fecha-movimiento")?.value || fechaActual();

    if (!concepto || !Number.isFinite(monto) || monto <= 0) {
        alert("Ingresa un concepto y un monto mayor que cero.");
        return;
    }

    if (!["ingreso", "gasto"].includes(tipo)) {
        alert("Selecciona un tipo válido.");
        return;
    }

    try {
        await solicitarAPI("/movimientos", {
            method: "POST",
            body: JSON.stringify({
                tipo,
                concepto,
                categoria: categoria || "General",
                monto,
                fecha
            })
        });

        evento.target.reset();

        if ($("fecha-movimiento")) {
            $("fecha-movimiento").value = fechaActual();
        }

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
}

function actualizarEstadoCuenta() {
    const estado = $("estado-cuenta");
    const formularios = document.querySelector(".access-grid");
    const botonCerrar = $("btn-cerrar-sesion");
    const usuarioHeader = $("usuario-header");
    const enlaceLogin = $("enlace-login");
    const enlaceRegistro = $("enlace-registro");

    if (usuarioActual) {
        if (estado) {
            estado.textContent = `¡Bienvenido, ${usuarioActual.nombre}!`;
        }

        if (formularios) formularios.hidden = true;
        if (botonCerrar) botonCerrar.hidden = false;

        if (usuarioHeader) {
            usuarioHeader.textContent = `Hola, ${usuarioActual.nombre}`;
            usuarioHeader.hidden = false;
        }

        if (enlaceLogin) enlaceLogin.hidden = true;
        if (enlaceRegistro) enlaceRegistro.hidden = true;

    } else {
        if (estado) {
            estado.textContent = "No has iniciado sesión.";
        }

        if (formularios) formularios.hidden = false;
        if (botonCerrar) botonCerrar.hidden = true;
        if (usuarioHeader) usuarioHeader.hidden = true;

        if (enlaceLogin) enlaceLogin.hidden = false;
        if (enlaceRegistro) enlaceRegistro.hidden = false;
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

$("form-asistente")?.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const ingresos = Number($("ia-ingresos")?.value);
    const gastos = Number($("ia-gastos")?.value);
    const objetivo = $("ia-objetivo")?.value.trim();

    if (
        !Number.isFinite(ingresos) ||
        !Number.isFinite(gastos) ||
        ingresos <= 0 ||
        gastos < 0
    ) {
        mostrarMensaje(
            "respuesta-asistente",
            "Ingresa ingresos mayores que cero y gastos válidos.",
            true
        );
        return;
    }

    const balance = ingresos - gastos;
    const porcentajeGastos = (gastos / ingresos) * 100;
    const ahorroSugerido = Math.max(0, balance * 0.2);

    let respuesta = `Tu balance mensual es ${formatoDinero(balance)}. `;

    if (balance < 0) {
        respuesta += "Tus gastos superan tus ingresos. Revisa tus gastos no esenciales.";
    } else if (balance === 0) {
        respuesta += "Estás utilizando todos tus ingresos. Intenta reservar una parte para ahorrar.";
    } else {
        respuesta +=
            `Tus gastos representan el ${porcentajeGastos.toFixed(1)} % de tus ingresos. ` +
            `Podrías evaluar ahorrar ${formatoDinero(ahorroSugerido)} al mes.`;
    }

    if (objetivo) {
        respuesta += ` Para tu objetivo "${objetivo}", establece una cantidad y una fecha límite.`;
    }

    mostrarMensaje("respuesta-asistente", respuesta);
});

// ============================================
// CONTACTO
// ============================================

$("form-contacto")?.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const nombre = $("contacto-nombre")?.value.trim();
    const email = $("contacto-email")?.value.trim();
    const asunto = $("contacto-asunto")?.value.trim();
    const mensaje = $("contacto-mensaje")?.value.trim();

    if (!nombre || !email || !asunto || !mensaje) {
        mostrarMensaje("mensaje-contacto", "Completa todos los campos.", true);
        return;
    }

    contactos.push({
        id: Date.now(),
        nombre,
        email,
        asunto,
        mensaje,
        fecha: new Date().toISOString()
    });

    localStorage.setItem(
        "balancea360_contactos",
        JSON.stringify(contactos)
    );

    mostrarMensaje(
        "mensaje-contacto",
        "Mensaje guardado en este navegador. Todavía no se ha enviado."
    );

    evento.target.reset();
    renderizarAdministracion();
});

// ============================================
// ADMINISTRACIÓN DEMOSTRATIVA
// ============================================

function renderizarAdministracion() {
    if ($("admin-total-contactos")) {
        $("admin-total-contactos").textContent = String(contactos.length);
    }

    if ($("admin-total-servicios")) {
        $("admin-total-servicios").textContent = String(servicios.length);
    }

    const panel = $("admin-contenido");
    if (!panel) return;

    panel.replaceChildren();

    if (contactos.length === 0) {
        panel.appendChild(crearElemento("p", "No hay mensajes recibidos."));
        return;
    }

    contactos.forEach((contacto) => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "admin-contacto";

        tarjeta.append(
            crearElemento("h3", contacto.asunto),
            crearElemento("p", `De: ${contacto.nombre} (${contacto.email})`),
            crearElemento("p", contacto.mensaje),
            crearElemento(
                "small",
                new Date(contacto.fecha).toLocaleString("es-EC")
            )
        );

        panel.appendChild(tarjeta);
    });
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

        actualizarEstadoCuenta();
        await cargarMovimientos();

    } catch (error) {
        token = null;
        usuarioActual = null;
        movimientos = [];

        localStorage.removeItem("balancea360_token");

        actualizarEstadoCuenta();
        renderizarMovimientos();
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

    actualizarTotales();
});
