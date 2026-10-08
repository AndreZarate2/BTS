# Generación y análisis de imágenes

| Modo | Comportamiento |
| --- | --- |
| auto | OpenAI → Gemini → Qwen ante errores operativos; nunca composición local |
| openai_only | Solo edición OpenAI |
| gemini_only | Solo edición Gemini, con consentimiento v2 |
| qwen_only | Solo el endpoint Qwen del organizador, sin análisis Gemini |
| qwen_free | Space oficial Qwen 2511 en Hugging Face; cuota gratuita compartida, sin proveedores de pago |
| local_only | Composición clásica explícita; no recrea cuerpo, postura o perspectiva |
| mock | Pruebas locales; rechazado en producción |

OpenAI conserva `gpt-image-2.5-sunburst`, calidad high. Recibe la escena y la referencia de la persona. Gemini usa `gemini-3.8-flash` para analizar y revisar, y `gemini-3.1-flash-image` para editar. Las claves se leen únicamente en el servidor. Una clave que puede listar modelos no garantiza cuota para inferencia.

El modo `qwen_free` utiliza consentimiento específico para un Space público. Revisa [Qwen gratuito, privacidad y límites](QWEN_GRATUITO.md). En `qwen_only` y `qwen_free`, Qwen interpreta las dos referencias y no se realiza una revisión independiente con Gemini.

## Flujo de composición (modos con Gemini habilitado)

1. El visitante acepta la autorización para OpenAI, Google Gemini y Qwen. Se registra `photo-ai-v2` antes de encolar. Los trabajos antiguos sin esta versión no envían fotos a Google, incluso si los reintenta un administrador.
2. Gemini analiza las dos imágenes: cantidad de personas, visibilidad del rostro, encuadre, iluminación, posición relativa y proporción de la cabeza respecto a la escena. Se requiere una persona en la foto del visitante.
3. La edición generativa incorpora a la persona a escala coherente, preservando las personas originales. Una selfie puede requerir recrear cuerpo o adaptar el encuadre. Se permite ampliar moderadamente el escenario cuando no hay espacio. No se usa una posición fija para todas las plantillas.
4. Gemini revisa la foto generada: persona añadida, artistas conservados, escala, apoyo, iluminación y ausencia de collage. Un resultado que no pasa esta revisión queda fallido y no se entrega ni consume la descarga.

El análisis es transitorio: no se guarda un perfil facial, nombres inferidos ni observaciones descriptivas en la base de datos. Las imágenes se envían inline, sin publicar URLs ni crear archivos en Google. Permanecen aplicables las políticas de los proveedores y la retención configurada en el evento.

## Límites y errores

Las comprobaciones de IA son probabilísticas y no garantizan una integración perfecta con cualquier fotografía. Funcionan mejor con un rostro nítido, una sola persona y buena luz; se recomienda medio cuerpo o cuerpo completo. Se necesita probar resultados reales antes del evento.

Errores HTTP 408, 429, 500, 502, 503 y 504 o de red admiten otro proveedor generativo. Errores de seguridad, permisos, solicitudes inválidas o respuestas inválidas detienen el flujo. El saldo agotado se comunica con un código saneado. No se aplican fallbacks para eludir restricciones. Sin cuota, el sistema muestra un error y no fabrica una foto local.

El análisis y la revisión tienen 25 segundos cada uno. El presupuesto conjunto de edición termina a los 230 segundos desde el inicio del trabajo y deja margen para validación y persistencia dentro de Vercel. Máximo 2 intentos por sesión; no hay reintentos pagados ocultos de la misma generación.

`IMAGE_ENABLE_LOCAL_FALLBACK` se conserva en ejemplos antiguos pero ya no permite introducir composición local en auto. `local_only` requiere una selección explícita. No confundir los tests con mock con evidencia de calidad generativa.

## Documentación consultada

- [Edición OpenAI](https://developers.openai.com/api/reference/resources/images/methods/edit) y [composición de imágenes](https://developers.openai.com/api/docs/guides/image-prompting).
- [Análisis Gemini](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding?hl=en), [JSON estructurado](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) y [generación y edición](https://ai.google.dev/gemini-api/docs/generate-content/image-generation?hl=en).

La prueba real scripts/smoke-live.mjs requiere SMOKE_REFERENCE_PATH apuntando a una foto JPEG o PNG individual autorizada. Los cuadrados de color de las pruebas unitarias no son selfies válidas para el analizador. ACCESS_ONLY=true conserva la prueba de acceso sin generación.
