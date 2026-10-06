// Retired endpoint. The application now uses same-origin /api/bts on Next.js.
// Gateway JWT verification remains enabled; this function performs no mutations.
Deno.serve(() => Response.json({error:'MIGRATED_TO_APP_SERVER'}, {
 status:410,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
}));
