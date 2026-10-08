import type { NextConfig } from 'next';
const config: NextConfig = {
 poweredByHeader:false,
 serverExternalPackages:['@vladmandic/face-api','@tensorflow/tfjs','@tensorflow/tfjs-backend-wasm'],
 outputFileTracingIncludes:{'/api/**':['./node_modules/@vladmandic/face-api/model/ssd_mobilenetv1*','./node_modules/@vladmandic/face-api/model/face_landmark_68_model*','./node_modules/@vladmandic/face-api/model/face_recognition_model*','./node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm']},
 async headers() { return [{source:'/workers/:path*',headers:[{key:'Content-Security-Policy',value:"connect-src 'self';"}]},{source:'/vendor/mediapipe/1.1.0/:path*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}]; }
};
export default config;
