import {isDemo} from '@/lib/server/config';
import {providerMode} from '@/lib/providers/factory';
import {json} from '@/lib/server/http';
export function GET(){return json({demo:isDemo(),mode:providerMode(),supabaseConfigured:!!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});}
