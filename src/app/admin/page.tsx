import {requireAdmin} from '@/lib/server/auth';
import AdminPanel from '@/administrador/panel';
export const dynamic='force-dynamic';
export default async function AdminPage(){await requireAdmin();return <AdminPanel initialView="dashboard"/>;}
