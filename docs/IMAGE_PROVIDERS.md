# Motores de imagen

| Modo | Comportamiento |
| --- | --- |
| auto | Motores configurados: OpenAI → Qwen → local |
| openai_only | Solo OpenAI, falla si no está configurado |
| qwen_only | Solo Qwen |
| local_only | Solo composición local |
| mock | Imagen de prueba marcada MOCK, latencia simulada, sin API |

OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst; OPENAI_IMAGE_QUALITY=high, configurable como xhigh. `/v1/images/edits` recibe dos imágenes: escena y referencia de identidad. La clave vive solo en servidor. El prompt preserva sujetos originales y especifica identidad, perspectiva, luz, sombras, foco, grano y placement. No se promete identidad fotográfica perfecta; el organizador debe revisar resultados reales antes del evento. [Documentación del modelo](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst), [edición](https://developers.openai.com/api/reference/resources/images/methods/edit).

Qwen utiliza QWEN_BASE_URL, QWEN_IMAGE_MODEL=Qwen/Qwen-Image-Edit-2511 y QWEN_API_KEY. Necesita GPU o servicio externo compatible con vLLM-Omni. La URL puede terminar en /v1; se llama /v1/images/edits con campos `image` repetidos y respuesta b64_json. `/v1/models` sirve como comprobación de conectividad desde Configuración del administrador. Ese health check no garantiza memoria GPU ni generación correcta. Usa HTTPS en producción y token privado. No admite credenciales incrustadas, fragmentos o query en la URL. Qwen no se ejecuta dentro de Vercel. [Qwen oficial](https://github.com/QwenLM/Qwen-Image), [API vLLM-Omni](https://docs.vllm.ai/projects/vllm-omni/en/latest/serving/image_edit_api/).

Timeouts/red y HTTP 408, 429, 500, 502, 503, 504 permiten fallback. 400, 401, 403, rechazo de seguridad o respuesta no interpretable detienen la cadena. No se usan fallbacks para eludir restricciones. No se sigue una URL de resultado ni redirecciones remotas: se valida base64 y la imagen al persistir. IMAGE_PROVIDER_TIMEOUT_MS=70000, máximo 90000 por motor. IMAGE_MAX_RETRIES=2 limita intentos totales por sesión; no reintentos automáticos de la misma solicitud pagada.

LocalComposite usa Sharp y segmentación clásica por fondo conectado al borde, con suavizado alfa, posición, escala, rotación, sombra, ajuste de brillo/contraste/color y grano. Funciona mejor con selfies sobre fondo liso contrastante. No es un modelo de segmentación semántica ni genera posturas u oclusiones realistas; su calidad es inferior a edición generativa. El resultado se identifica como local_composite y se etiqueta en pantalla. IMAGE_ENABLE_LOCAL_FALLBACK=false lo desactiva.

La prueba `scripts/smoke-openai.mjs` utiliza el adaptador del proyecto y fixtures sintéticos. Solo se ejecuta manualmente y puede generar un cargo. Las pruebas unitarias simulan transporte de OpenAI/Qwen y ejecutan Sharp real para el motor local.
