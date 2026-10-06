import {describe,expect,it} from 'vitest';
import {nextStep,validPhoto,metrics,type UserState,type SessionStatus,type AccessStatus,type AdminUser} from '../../src/lib/model';
function state(access:AccessStatus,session:SessionStatus='approved'):UserState {return {profile:null,access:{user_id:'u',status:access,requested_at:'',approved_at:null,updated_at:'',reactivation_count:0},session:{id:'s',user_id:'u',status:session,artist_id:null,template_id:null,attempts:0,created_at:'',ready_at:null,downloaded_at:null,error_message:null,error_code:null,artists:null}};}
describe('recuperación de la experiencia',()=>{
 it('abre la bienvenida sin acceso',()=>expect(nextStep({profile:null,access:null,session:null})).toBe('welcome'));
 it.each([['pending','waiting'],['rejected','unavailable'],['blocked','unavailable'],['consumed','consumed']] as const)('%s controla el acceso', (s,screen)=>expect(nextStep(state(s))).toBe(screen));
 it.each([['approved','artists'],['artist_selected','selfie'],['selfie_uploaded','selfie'],['processing','processing'],['ready','result'],['failed','selfie']] as const)('recupera %s', (s,screen)=>expect(nextStep(state('approved',s))).toBe(screen));
 it('un bloqueo vence a una foto lista',()=>expect(nextStep(state('blocked','ready'))).toBe('unavailable'));
 it('una reactivación comienza sin artista',()=>expect(nextStep(state('approved','approved'))).toBe('artists'));
});
describe('validación previa de fotos',()=>{
 it.each(['image/jpeg','image/png','image/webp'])('acepta %s',type=>expect(validPhoto({type,size:10485760})).toBe(true));
 it.each([{type:'image/svg+xml',size:100},{type:'image/jpeg',size:10485761},{type:'image/png',size:0},{type:'application/pdf',size:100}])('rechaza un archivo inválido',file=>expect(validPhoto(file)).toBe(false));
});
describe('métricas',()=>{
 it('cuenta cada acceso y el estado de generación',()=>{const users=[state('pending'),state('approved','processing'),state('approved','ready'),state('consumed','consumed'),state('blocked','cancelled'),state('rejected')].map((s,i)=>({id:String(i),display_name:'Fan',created_at:'',access:s.access!,session:s.session,photo_sessions:[]})) as AdminUser[];expect(metrics(users)).toEqual({pending:1,active:2,ready:2,consumed:1,blocked:2});});
});
