import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'BTS Photo Experience · Tu momento, para siempre',description:'Una experiencia de fotos creada para fans. Solicita tu acceso y crea un recuerdo único.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}
