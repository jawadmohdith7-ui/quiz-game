//ARXIU QUE WRAPPEA FUNCIONS ASÍNCRONES PER CAPTURAR ERRORS

//=====================
//DECLAREM LA FUNCIÓ ASYNC HANDLER
//=====================
export function asyncHandler(fn) {
  // RETORNEM UNA NOVA FUNCIÓ QUE CAPTURA ERRORS
  return function (req, res, next) {
    // EXECUTEM LA FUNCIÓ ORIGINAL I CAPTUREM REJECTIONS
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
