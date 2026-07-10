'use client';

import dynamic from 'next/dynamic';

const GameApp = dynamic(() => import('@/components/GameApp'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-indigo-400 font-black text-2xl">ŁADOWANIE...</div>
      </div>
    </div>
  ),
});

export default function Home() {
  return <GameApp />;
}
