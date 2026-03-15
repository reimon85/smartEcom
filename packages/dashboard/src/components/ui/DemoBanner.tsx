'use client';

export default function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;

  return (
    <div className="bg-amber-400 text-amber-950 text-xs font-medium text-center py-1.5 px-4 flex items-center justify-center gap-2">
      <span>⚡</span>
      <span>
        <strong>Modo Demo:</strong> IA simulada activa — los textos generados son ejemplos ficticios.
        Configura <code className="bg-amber-300/60 px-1 rounded">OPENAI_API_KEY</code> para activar GPT-4o-mini real.
      </span>
    </div>
  );
}
