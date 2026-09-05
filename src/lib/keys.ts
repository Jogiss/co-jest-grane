// Simple obfuscation - keys are decoded at runtime
// These are PUBLIC keys (Supabase anon, Firebase API) - safe in frontend by design
// Security is enforced via Supabase RLS and Firebase Security Rules
//
// Możesz nadpisać każdy klucz zmienną środowiskową (NEXT_PUBLIC_*) —
// jeśli zmienna nie istnieje, użyte zostaną wartości poniżej.

function d(encoded: string): string {
  return atob(encoded);
}

// Supabase
const _su = 'aHR0cHM6Ly9uYnhrbmxiZmtsdXhueW5jcHhuai5zdXBhYmFzZS5jbw==';
const _sk = 'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW01aWVHdHViR0ptYTJ4MWVHNTVibU53ZUc1cUlpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpjNE9UTTNPVE1zSW1WNGNDSTZNakE1TXpRMk9UYzVNMzAudlZQVEpXRmN4dkdTVWd5V2lVTG5yN05kOExQLXFpN25nd2JDcnNMX1dWTQ==';

// Firebase
const _fa = 'QUl6YVN5QnZBTzBabjVRZnN3LVJMR094SW5iaWxmZnhEUXdTTWM4';
const _fd = 'Y28tamVzdC1ncmFuZS1mNmFlYi5maXJlYmFzZWFwcC5jb20=';
const _fp = 'Y28tamVzdC1ncmFuZS1mNmFlYg==';
const _fs = 'Y28tamVzdC1ncmFuZS1mNmFlYi5maXJlYmFzZXN0b3JhZ2UuYXBw';
const _fm = 'NDMyOTQ0Nzk2NDUy';
const _fid = 'MTo0MzI5NDQ3OTY0NTI6d2ViOjg3Zjc0NzAxMDQ0OThlYWI1Zjk5YjE=';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? d(_su);
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? d(_sk);

export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? d(_fa),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? d(_fd),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? d(_fp),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? d(_fs),
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? d(_fm),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? d(_fid),
};
