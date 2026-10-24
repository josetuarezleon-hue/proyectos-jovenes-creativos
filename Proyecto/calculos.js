
"use strict";

// ============================================
// BALANCEA360 - LÓGICA PRINCIPAL
// ============================================

const $ = (id) => document.getElementById(id);

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

function leerDatos(clave, valorInicial) {
    try {
        const datos = localStorage.getItem(clave);
        return datos ? JSON.parse(datos) : valorInicial;
    } catch (error) {
        console.error(`No se pudieron leer los datos: ${clave}`, error);
        return valorInicial;
    }
}

function guardarDatos(clave, datos) {
    try {
        localStorage.setItem(clave, JSON.stringify(datos));
        return true;
    } catch (error) {
        console.error(`No se pudieron guardar los datos: ${clave}`, error);
        alert("No se pudieron guardar los datos en este navegador.");
        return false;
    }
}

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================

let movimientos = leerDatos("balancea360_movimientos", []);
let usuarios = leerDatos("balancea360_usuarios", []);
let servicios = leerDatos("balancea360_servicios", [
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
]);

let contactos = leerDatos("balancea360_contactos", []);
let usuarioActual = leerDatos("balancea360_sesion", null);

// ============================================
// MENSAJES Y SEGURIDAD DEL DOM
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

    if (clase) elemento.className = clase;

    return elemento;
}

// ============================================
// PRESUPUESTO Y MOVIMIENTOS
// ============================================

function calcularTotales(lista = movimientos) {
    return lista.reduce(
        (totales, movimiento) => {
            if (movimiento.tipo === "ingreso") {
                totales.ingresos += movimiento.monto;
            } else {
                totales.gastos += movimiento.monto;
            }

            return totales;
        },
        { ingresos: 0, gastos: 0 }
    );
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
            !filtroMes || movimiento.fecha.startsWith(filtroMes);

        return coincideTipo && coincideMes;
    });

    if (filtrados.length === 0) {
        lista.appendChild(
            crearElemento("p", "Todavía no hay movimientos para mostrar.")
        );
    } else {
        filtrados
            .slice()
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .forEach((movimiento) => {
                const fila = document.createElement("div");
                fila.className = "movimiento-item";

                const informacion = document.createElement("div");
                informacion.append(
                    crearElemento("strong", movimiento.concepto),
                    crearElemento(
                        "small",
                        `${movimiento.categoria} · ${movimiento.fecha}`
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
                eliminar.setAttribute(
                    "aria-label",
                    `Eliminar movimiento ${movimiento.concepto}`
                );

                eliminar.addEventListener("click", () => {
                    movimientos = movimientos.filter(
                        (item) => item.id !== movimiento.id
                    );

                    guardarDatos("balancea360_movimientos", movimientos);
                    actualizarPresupuesto();
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
        $("total-ingresos").textContent = formatoDinero(totales.ingresos);
    }

    if ($("total-gastos")) {
        $("total-gastos").textContent = formatoDinero(totales.gastos);
    }

    if ($("balance-total")) {
        $("balance-total").textContent = formatoDinero(
            totales.ingresos - totales.gastos
        );
    }
}

function actualizarPresupuesto() {
    guardarDatos("balancea360_movimientos", movimientos);
    renderizarMovimientos();
}

$("form-movimiento")?.addEventListener("submit", (evento) => {
    evento.preventDefault();

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
        alert("Selecciona un tipo de movimiento válido.");
        return;
    }

    movimientos.push({
        id: Date.now() + Math.random(),
        tipo,
        concepto,
        categoria: categoria || "General",
        monto,
        fecha
    });

    actualizarPresupuesto();
    evento.target.reset();

    if ($("fecha-movimiento")) {
        $("fecha-movimiento").value = fechaActual();
    }
});

$("filtro-tipo")?.addEventListener("change", renderizarMovimientos);
$("filtro-mes")?.addEventListener("change", renderizarMovimientos);

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
        ingresos < 0 ||
        gastos < 0 ||
        ingresos === 0
    ) {
        mostrarMensaje(
            "respuesta-asistente",
            "Ingresa ingresos válidos mayores que cero y gastos que no sean negativos.",
            true
        );
        return;
    }

    const balance = ingresos - gastos;
    const porcentajeGastos = (gastos / ingresos) * 100;
    const ahorroSugerido = Math.max(0, balance * 0.2);

    let respuesta = `Tu balance mensual es ${formatoDinero(balance)}. `;

    if (balance < 0) {
        respuesta +=
            "Tus gastos superan tus ingresos. Revisa primero los gastos no esenciales y prioriza tus obligaciones.";
    } else if (balance === 0) {
        respuesta +=
            "Estás utilizando todos tus ingresos. Intenta reducir algún gasto para crear un fondo de emergencia.";
    } else {
        respuesta +=
            `Tus gastos representan el ${porcentajeGastos.toFixed(1)} % de tus ingresos. ` +
            `Como punto de partida, podrías evaluar ahorrar ${formatoDinero(ahorroSugerido)} al mes, si tus obligaciones lo permiten.`;
    }

    if (objetivo) {
        respuesta += ` Para tu objetivo "${objetivo}", define una cantidad y una fecha límite, y divide el monto necesario entre los meses disponibles.`;
    }

    mostrarMensaje("respuesta-asistente", respuesta);
});

// ============================================
// REGISTRO E INICIO DE SESIÓN DEMOSTRATIVOS
// ============================================

// IMPORTANTE:
// Este ejemplo no es autenticación segura.
// Las contraseñas no deben almacenarse en localStorage.
// Para cuentas reales, utiliza un backend y un proveedor de
// autenticación con almacenamiento seguro de contraseñas.

$("form-registro")?.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const nombre = $("registro-nombre")?.value.trim();
    const email = $("registro-email")?.value.trim().toLowerCase();
    const password = $("registro-password")?.value || "";

    if (!nombre || !email || password.length < 8) {
        mostrarMensaje(
            "mensaje-registro",
            "Completa los campos. La contraseña debe tener al menos 8 caracteres.",
            true
        );
        return;
    }

    if (usuarios.some((usuario) => usuario.email === email)) {
        mostrarMensaje(
            "mensaje-registro",
            "Ya existe un registro con ese correo.",
            true
        );
        return;
    }

    // No se guarda la contraseña en el navegador.
    // Se crea un perfil de demostración sin autenticación real.
    usuarios.push({
        id: Date.now(),
        nombre,
        email
    });

    guardarDatos("balancea360_usuarios", usuarios);

    mostrarMensaje(
        "mensaje-registro",
        "Perfil de demostración creado. Para habilitar el acceso real, conecta un sistema de autenticación seguro."
    );

    evento.target.reset();
});

$("form-login")?.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const email = $("login-email")?.value.trim().toLowerCase();

    if (!email) {
        mostrarMensaje("mensaje-login", "Ingresa tu correo.", true);
        return;
    }

    const usuario = usuarios.find((item) => item.email === email);

    if (!usuario) {
        mostrarMensaje(
            "mensaje-login",
            "No encontramos ese perfil de demostración. Regístrate primero.",
            true
        );
        return;
    }

    usuarioActual = { nombre: usuario.nombre, email: usuario.email };
    guardarDatos("balancea360_sesion", usuarioActual);
    actualizarEstadoCuenta();

    mostrarMensaje(
        "mensaje-login",
        `Hola, ${usuario.nombre}. Entraste en modo demostración.`
    );

    evento.target.reset();
});

function actualizarEstadoCuenta() {
    const estado = $("estado-cuenta");
    if (!estado) return;

    estado.textContent = usuarioActual
        ? `Sesión de demostración: ${usuarioActual.nombre} (${usuarioActual.email})`
        : "No has iniciado sesión.";
}

$("btn-cerrar-sesion")?.addEventListener("click", () => {
    usuarioActual = null;

    try {
        localStorage.removeItem("balancea360_sesion");
    } catch (error) {
        console.error("No se pudo cerrar la sesión local.", error);
    }

    actualizarEstadoCuenta();
});

$("btn-recuperar-password")?.addEventListener("click", () => {
    alert(
        "La recuperación de contraseña estará disponible cuando se conecte un sistema de autenticación real."
    );
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
        mostrarMensaje(
            "mensaje-contacto",
            "Completa todos los campos del formulario.",
            true
        );
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

    if (!guardarDatos("balancea360_contactos", contactos)) return;

    mostrarMensaje(
        "mensaje-contacto",
        "Mensaje guardado en este navegador. Todavía no se ha enviado por correo."
    );

    evento.target.reset();
    renderizarAdministracion();
});

// ============================================
// PANEL ADMINISTRATIVO DE DEMOSTRACIÓN
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
// INICIALIZACIÓN
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    if ($("fecha-movimiento")) {
        $("fecha-movimiento").value = fechaActual();
    }

    renderizarMovimientos();
    renderizarServicios();
    actualizarEstadoCuenta();
    renderizarAdministracion();
});
