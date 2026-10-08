# Montaje propio sin API de IA

Seleccionar `IMAGE_PROVIDER_MODE=browser_local` en el servidor y volver a desplegar. No requiere claves OpenAI, Gemini ni Hugging Face. El código de esos proveedores permanece disponible, pero este modo no los llama ni realiza fallback.

La persona elige una foto, acepta el consentimiento local y abre el editor. Un Web Worker del navegador ejecuta MediaPipe Tasks Vision 1.1.0, Selfie Multiclass 256 y un detector de rostros. Todos los modelos y archivos WASM se sirven desde la propia web. Solo se descargan programas; no se envían las fotos a Google. El worker rechaza fetch y XHR a otros orígenes; su política CSP también limita conexiones al mismo origen, incluida la telemetría de la biblioteca. El servidor analiza únicamente las cajas de los rostros de la plantilla para proponer una escala; estos datos no se conservan como perfiles. Es un montaje desarrollado en este proyecto con modelos preentrenados Apache 2.0; no es un modelo generativo entrenado desde cero.

El recorte mantiene los píxeles de la foto. Se propone tamaño según los rostros detectados en la plantilla; si no se detectan, se propone un encuadre provisional. El usuario puede mover, cambiar tamaño, ajustar luz, temperatura y sombra, borrar restos de fondo y recuperar zonas de la foto. La preparación en el navegador no consume intentos.

Solo se envía el JPEG del montaje confirmado al servidor de esta aplicación. Se guarda de forma privada en Supabase con el control de acceso, conservación y descarga única existentes. El servidor normaliza el archivo y elimina metadatos. El consentimiento `photo-browser-local-v1` nunca habilita proveedores externos; tampoco se permite presentar una selfie guardada por un modo anterior como si fuera un montaje. Las fotos originales permanecen en memoria del dispositivo mientras está abierto el editor.

## Límites reales

- No inventa cuerpos, poses, ropa, fondos ni detalles ausentes. Una selfie sigue siendo una selfie recortada. Para escenas de pie, usar cuerpo completo.
- Elegir plantillas con espacio libre y perspectiva compatible. El panel de plantillas permite guardar una posición manual.
- La máscara puede fallar en pelo fino, objetos superpuestos y poca luz; revisar con los pinceles antes de confirmar.
- Una imagen original borrosa sigue teniendo poco detalle. Se escala sin deformar, pero no se garantiza integración fotográfica perfecta.
- Requiere un navegador moderno con Web Workers, WebAssembly, OffscreenCanvas y WebGL2. No se envía la foto a otro servicio si el dispositivo no lo soporta.
- No existe cuota por imagen de un proveedor de IA. Siguen vigentes los límites de alojamiento, transferencia, almacenamiento y las reglas de acceso del evento. Los intentos fallidos anteriores requieren reactivación si ya agotaron el límite del evento.

## Dependencias y verificación

Los archivos vendorizados están en `public/vendor/mediapipe/1.1.0`, con licencia y manifiesto de origen y SHA-256. La primera carga descarga aproximadamente 30 MB (modelo y runtime elegido); el navegador puede reutilizarlos en caché. Los pesos no son fotos ni datos del evento.

Referencias: [MediaPipe web](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js), [ficha del modelo](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf).
