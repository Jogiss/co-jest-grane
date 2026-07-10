// Simple obfuscation - keys are decoded at runtime
// These are PUBLIC keys (Supabase anon, Firebase API) - safe in frontend by design
// Security is enforced via Supabase RLS and Firebase Security Rules

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

export const SUPABASE_URL = d(_su);
export const SUPABASE_ANON_KEY = d(_sk);

export const FIREBASE_CONFIG = {
  apiKey: d(_fa),
  authDomain: d(_fd),
  projectId: d(_fp),
  storageBucket: d(_fs),
  messagingSenderId: d(_fm),
  appId: d(_fid),
};
