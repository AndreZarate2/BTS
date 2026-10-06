import type {Placement,ProviderName,JobStatus} from '@/types/images';
export type AccessStatus='pending'|'approved'|'rejected'|'blocked'|'consumed';
export type SessionStatus='approved'|'artist_selected'|'selfie_uploaded'|'queued'|'processing'|'ready'|'consumed'|'failed'|'cancelled';
export interface Access {user_id:string;status:AccessStatus;requested_at:string;approved_at:string|null;updated_at:string;reactivation_count:number}
export interface PhotoSession {provider?:ProviderName;fallback_used?:boolean;duration_ms?:number;id:string;user_id:string;status:SessionStatus;artist_id:string|null;template_id:string|null;attempts:number;created_at:string;ready_at:string|null;downloaded_at:string|null;error_message:string|null;error_code:string|null;artists:{name:string}|null}
export interface Profile {id:string;display_name:string;created_at:string}
export interface UserState {job?:GenerationJob|null;mode?:string;access:Access|null;profile:Profile|null;session:PhotoSession|null}
export interface Template {placement?:Placement;uses?:number;id:string;artist_id:string;label:string;active:boolean;url?:string;created_at:string;deleted_at:string|null}
export interface Artist {id:string;slug:string;name:string;enabled:boolean;display_order:number;cover?:string;templates?:Template[]}
export interface AdminUser extends Profile {access:Access;session:PhotoSession|null;photo_sessions:PhotoSession[]}
export interface Audit {entity_id?:string|null;id:number;actor_user_id:string;action:string;target_user_id:string|null;created_at:string;metadata:Record<string,unknown>}
export interface Dashboard {jobs?:GenerationJob[];providers?:{mode:string;openai:boolean;qwen:boolean;local:boolean};users:AdminUser[];artists:Artist[];logs:Audit[];provider_configured:boolean}
export const statusLabel:Record<string,string>={pending:'Pendiente',approved:'Activo',rejected:'Rechazado',blocked:'Bloqueado',consumed:'Finalizado',artist_selected:'Artista elegido',selfie_uploaded:'Foto cargada',queued:'En cola',processing:'Creando foto',ready:'Foto lista',failed:'Requiere atención',cancelled:'Cancelado'};
export function nextStep(state:UserState):'welcome'|'waiting'|'unavailable'|'artists'|'selfie'|'processing'|'result'|'consumed' {
 if(!state.access) return 'welcome';
 if(state.access.status==='pending') return 'waiting';
 if(state.access.status==='consumed') return 'consumed';
 if(state.access.status==='blocked'||state.access.status==='rejected') return 'unavailable';
 if(!state.session||state.session.status==='approved') return 'artists';
 if(['queued','processing'].includes(state.session.status)) return 'processing';
 if(state.session.status==='ready') return 'result';
 return 'selfie';
}
export function validPhoto(file:{type:string;size:number}) {return ['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size>0&&file.size<=10*1048576;}
export function metrics(users:AdminUser[]) {
 return {pending:users.filter(u=>u.access.status==='pending').length,active:users.filter(u=>u.access.status==='approved').length,ready:users.filter(u=>u.session?.status==='ready'||u.session?.status==='processing').length,consumed:users.filter(u=>u.access.status==='consumed').length,blocked:users.filter(u=>['blocked','rejected'].includes(u.access.status)).length};
}

export interface GenerationJob {id:string;session_id:string;user_id:string;status:JobStatus;stage:string;provider:ProviderName|null;fallback_used:boolean;duration_ms:number|null;created_at:string;error_code:string|null;}
