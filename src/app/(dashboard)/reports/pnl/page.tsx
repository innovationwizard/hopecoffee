import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getPnlData } from "../actions";
import { formatGTQ, formatPercent, marginColorClass } from "@/lib/utils/format";
import { PnlContent } from "../_components/pnl-content";

export default async function PnlPage() {
  const data = await getPnlData();

  const totals = data.reduce(
    (acc, d) => ({
      ingreso: acc.ingreso + d.ingresoTotal,
      costo: acc.costo + d.costoTotal,
      utilidad: acc.utilidad + d.utilidadBruta,
    }),
    { ingreso: 0, costo: 0, utilidad: 0 }
  );

  const totalMargen =
    totals.ingreso > 0 ? totals.utilidad / totals.ingreso : 0;

  return (
    <>
      <PageHeader
        title="Estado de Resultados"
        breadcrumbs={[
          { label: "Reportes", href: "/reports" },
          { label: "Estado de Resultados" },
        ]}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Ingreso Total
            </p>
            <p className="text-xl font-bold font-mono text-orion-600 dark:text-orion-400 mt-1">
              {formatGTQ(totals.ingreso)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Costo Total
            </p>
            <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
              {formatGTQ(totals.costo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Utilidad Bruta
            </p>
            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatGTQ(totals.utilidad)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Margen Bruto
            </p>
            <p
              className={`text-xl font-bold font-mono mt-1 ${marginColorClass(totalMargen)}`}
            >
              {formatPercent(totalMargen)}
            </p>
          </CardContent>
        </Card>
      </div>

      <PnlContent data={data} />
    </>
  );
}
