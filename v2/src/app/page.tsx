import pool from "@/lib/db";

export default async function Home() {
  let dbStatus = "Desconectado 🔴";
  let projectCount = 0;

  try {
    const client = await pool.connect();
    try {
      const res = await client.query("SELECT COUNT(*) FROM projects");
      projectCount = parseInt(res.rows[0].count, 10);
      dbStatus = "Conectado a Supabase 🟢";
    } finally {
      client.release();
    }
  } catch (err) {
    dbStatus = "Error de Conexión ❌ (" + (err as Error).message + ")";
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-950 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
          Visor Gantt v2
        </h1>
        <div className="p-6 rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
          <p className="text-xl font-medium mb-2">Estado del Sistema</p>
          <div className="flex items-center justify-center gap-2 text-lg">
            <span>Base de Datos:</span>
            <span className="font-bold">{dbStatus}</span>
          </div>
          {dbStatus.includes("Conectado") && (
            <p className="text-slate-400 mt-2">
              Proyectos encontrados: {projectCount}
            </p>
          )}
        </div>
        <p className="text-slate-500 text-sm">
          Next.js + Tailwind + Supabase (Free Tier)
        </p>
      </div>
    </div>
  );
}
