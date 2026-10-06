import {notFound} from 'next/navigation';
import {requireAdmin} from '@/lib/server/auth';
import AdminPanel,{type View} from '@/administrador/panel';
const sections:Record<string,View>={users:'users',requests:'requests',artists:'artists',templates:'templates',generations:'generations',activity:'activity',settings:'settings'};
export const dynamic='force-dynamic';
export default async function Section({params}:{params:Promise<{section:string}>}){await requireAdmin();const view=sections[(await params).section];if(!view)notFound();return <AdminPanel initialView={view}/>;}
