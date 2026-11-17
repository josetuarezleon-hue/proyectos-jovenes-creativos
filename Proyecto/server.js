
const http = require('http');

const server = http.createServer((request, response) => {

    if (request.method === 'GET' && request.url === '/') {
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.end('Servidor de Balancea360 funcionando correctamente');

    } else {
        response.statusCode = 404;
        response.end('Ruta no encontrada');
    }

});

server.listen(3000, () => {
    console.log('Servidor ejecutándose en el puerto 3000');
});
