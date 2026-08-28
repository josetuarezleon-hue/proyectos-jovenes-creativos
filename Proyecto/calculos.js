console.log("Calculos cargados")

const Nombre_Emprendimiento= "Farmacia nicole"
let precioFlanes= 1.5
let hayPromocion= true;
 function calcularPrecioTotal(cantidad){
  if(hayPromocion){
    return cantidad*precioFlanes*0.9
  } else{
    return cantidad*precioFlanes
  }
 }