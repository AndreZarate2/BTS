# Qwen-Image-Edit-2511 con Hugging Face gratuito

La aplicación conecta el [Space de LPX55](https://huggingface.co/spaces/LPX55/Qwen-Image-Edit-2511-Turbo-Lightning) mediante su API Gradio. Utiliza Qwen-Image-Edit-2511 con el transformer Rapid-AIO y la aceleración Lightning de 4 pasos. Es una variante comunitaria acelerada, no los pesos originales sin modificar. No descarga los pesos del modelo en Vercel y no necesita una GPU local. La plantilla del artista y la foto del visitante se envían juntas; Qwen interpreta las dos referencias para editar la escena. No se pega un recorte local sobre la plantilla.

Las plantillas verticales reciben espacio lateral antes de enviarse al modelo, sin recortar ni estirar a los artistas. La instrucción breve pide completar ese espacio e integrar al visitante a escala natural. La plantilla original guardada por el administrador permanece intacta.

## Activación

1. Crea una cuenta personal **gratuita** en https://huggingface.co/join y verifica tu correo.
2. En https://huggingface.co/settings/tokens crea un token de lectura (**Read**). No lo pegues en chats ni en GitHub. No hace falta contratar PRO ni comprar créditos.
3. Configura únicamente en el servidor/Vercel (Production):

```dotenv
IMAGE_PROVIDER_MODE=qwen_free
HF_TOKEN=tu_token_privado
BTS_DEMO_MODE=false
```

4. Despliega de nuevo para aplicar las variables. En `/admin/settings`, usa **Comprobar conexión Qwen**. Esta comprobación valida cuenta/conectividad, no reserva GPU ni garantiza cuota.
5. Prueba una generación con una fotografía cuyo envío hayas autorizado. Verifica visualmente identidad, proporciones y conservación de los artistas antes de utilizarlo en un evento.

El modo gratuito no llama a OpenAI, Gemini ni a otro proveedor al fallar. Rechaza cuentas PRO/de organización de pago o de tipo desconocido antes de subir fotografías. Las claves existentes de otros proveedores no se utilizan en este modo. `HF_TOKEN` nunca se entrega al navegador. Si falta, la solicitud no consume un intento de generación.

## Límites reales

- ZeroGPU comparte capacidad entre usuarios y aplica una cuota diaria. Al consultar la documentación el 7 de octubre de 2026, una cuenta gratuita incluía 5 minutos de GPU al día; puede cambiar. El Space acelerado solicita GPU xlarge; esa capacidad consume cuota al doble de velocidad. La prueba del Space oficial falló porque solicitaba 360 segundos, por encima del máximo permitido; se eligió la variante acelerada tras obtener una imagen real con la cuenta gratuita. La cuota del organizador se comparte entre todos sus visitantes.
- Una cola larga, cuota agotada, cambios del Space o una interrupción pueden impedir generar. La aplicación muestra errores específicos y conserva el derecho de descarga. Un fallo después de iniciar generación sí cuenta como intento; el administrador puede reactivar el acceso.
- El límite total de este adaptador es 210 segundos, dentro del límite de la función Vercel. No hay reintentos automáticos ni cambio a servicios de pago. No se garantiza capacidad para un concierto completo.
- No se usa Gemini. Antes de subir una foto a Hugging Face, se comprueban localmente un único rostro, tamaño mínimo y nitidez. Después de generar se comprueba una correspondencia facial conservadora; se rechazan coincidencias ambiguas y rostros generados demasiado pequeños o borrosos. Los descriptores permanecen solo en memoria durante el trabajo, no se guardan ni se envían a terceros. Estos controles no garantizan identidad exacta ni detectan todos los defectos. Se solicita salida nativa de hasta 1536 píxeles, con JPEG de alta calidad y vista previa de hasta 1536 píxeles. Aumentar la resolución no recupera detalle ausente en una foto pequeña. El modelo puede alterar detalles, proporciones o añadir elementos no solicitados pese a las instrucciones; revisa cada imagen antes de compartirla. Un resultado descargado no implica que haya superado una revisión humana.

## Privacidad y consentimiento

El Space de LPX55 es público. Su caché de Gradio puede servir archivos temporales a quien tenga su enlace. La política de borrado del evento solo controla las copias almacenadas por esta aplicación; no permite prometer la eliminación de las copias de Hugging Face/LPX55. La aplicación solicita el consentimiento separado `photo-qwen-hf-lpx55-v1` antes de enviar cualquier imagen. Un consentimiento anterior para OpenAI/Gemini no habilita Hugging Face, tampoco al reintentar un trabajo antiguo.

La aplicación descarga el resultado desde el mismo dominio fijo del Space y lo guarda en el almacenamiento privado del evento. Rechaza redirecciones, URLs externas, respuestas inesperadas y archivos demasiado grandes. No publica los enlaces temporales de Hugging Face en su interfaz.

Para control estricto de privacidad o mayor capacidad, el adaptador `qwen_only` permite un servidor privado compatible con `/v1/images/edits`, configurado con `QWEN_BASE_URL` y `QWEN_API_KEY`. Tener el modelo con licencia Apache 2.0 no incluye el cómputo GPU para ese servidor.

## Referencias y validación

- [Modelo y licencia](https://huggingface.co/Qwen/Qwen-Image-Edit-2511)
- [Cuotas y funcionamiento ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu)
- [Código del Space utilizado](https://huggingface.co/spaces/LPX55/Qwen-Image-Edit-2511-Turbo-Lightning/blob/main/app_2511.py)
- [API HTTP de Gradio](https://www.gradio.app/guides/querying-gradio-apps-with-curl)

Las pruebas unitarias comprueban el contrato HTTP, dos imágenes en orden, consentimiento, límite de tiempo, errores, rechazo de URLs externas y ausencia de llamadas a proveedores de pago. Las pruebas con transporte simulado no demuestran calidad visual ni cuota disponible: la validación real requiere un token y una generación completada en Hugging Face.

## Análisis local

Se usan las redes de detección, puntos faciales y descriptor de `@vladmandic/face-api` 1.7.15 (MIT) con TensorFlow.js/WASM 4.22.0, incluidas en el servidor. No se ejecutan los modelos de edad, género ni emociones. Los archivos de modelos y WASM se incluyen expresamente en Vercel. La dependencia transitiva argparse se fija en 2.0.1 para evitar sprintf-js en las herramientas de consola de TensorFlow.js. El proyecto FaceAPI está archivado y requiere revisión antes de futuras actualizaciones.
