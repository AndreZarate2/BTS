export function generationError(code:string|null|undefined,fallback='No pudimos crear tu foto. Puedes volver a intentarlo.'){
 const messages:Record<string,string>={
  PHOTO_NEEDS_ONE_PERSON:'Elige una foto donde aparezcas solo tú. Así podemos integrarte correctamente en la escena.',
  PHOTO_FACE_UNCLEAR:'Tu rostro no se ve con suficiente claridad. Sube una foto nítida, de frente y con buena luz.',
  COMPOSITION_REJECTED:'La composición no superó la revisión de calidad. No entregamos ese montaje. Prueba con una foto más clara o pide ayuda al organizador.',
  QUALITY_CHECK_UNAVAILABLE:'No pudimos terminar la revisión de la foto. Vuelve a intentarlo en unos minutos.',
  ANALYSIS_INVALID:'No pudimos analizar bien las fotos. Inténtalo con otra foto individual y nítida.',
  PROVIDER_QUOTA:'El servicio de imágenes necesita saldo o cuota disponible. Contacta al organizador; tu descarga no se ha utilizado.',
  GEMINI_QUOTA:'El servicio de imágenes necesita cuota disponible. Contacta al organizador; tu descarga no se ha utilizado.',
  PROVIDER_SAFETY:'No se pudo procesar esta combinación de fotos. Selecciona una foto diferente o contacta al organizador.',
  PROVIDER_NOT_CONFIGURED:'El organizador debe activar un proveedor de generación de imágenes.',
  GEMINI_HTTP_404:'El organizador debe revisar qué modelo de Gemini está disponible en su proyecto.',
  GEMINI_HTTP_503:'El servicio de imágenes está ocupado. Inténtalo de nuevo en unos minutos.',
  GEMINI_NETWORK:'El análisis no pudo terminar a tiempo. Inténtalo de nuevo en unos minutos.',
  GEMINI_HTTP_400:'El organizador debe revisar la configuración del servicio de imágenes.',
  GEMINI_HTTP_401:'El organizador debe revisar las credenciales del servicio de imágenes.',
  GEMINI_HTTP_403:'El organizador debe revisar el acceso al servicio de imágenes.',
  PROVIDER_HTTP_401:'El organizador debe revisar las credenciales del servicio de imágenes.',
  PROVIDER_HTTP_403:'El organizador debe revisar el acceso al servicio de imágenes.',
 };
 return (code&&messages[code])||fallback;
}
