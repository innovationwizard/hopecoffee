import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  formatUSD,
  formatGTQ,
  formatNumber,
  formatPercent,
  marginColorClass,
} from "@/lib/utils/format";

interface ContractSummaryProps {
  totalPagoQTZ: number;
  precioBolsaDif: number;
  facturacionKgs: number;
  gastosExport: number;
  costoFinanciero: number;
  totalQQPergamino: number;
  totalCompraPergamino: number;
  totalQQSubproducto: number;
  totalVentSubproducto: number;
  margenBrutoContrato: number;
  margenBrutoPonderado: number | null;
  facturacionAcumulada: number | null;
  contenedoresVendidos: number | null;
}

export function ContractSummaryCard(props: ContractSummaryProps) {
  const lines: { label: string; value: string; highlight?: boolean }[] = [
    { label: "Precio por Saco 46kg", value: formatUSD(props.precioBolsaDif) },
    { label: "Total Facturación", value: formatUSD(props.facturacionKgs) },
    { label: "Total Gastos Exportación", value: formatUSD(props.gastosExport) },
    { label: "Total Gastos Financieros", value: formatUSD(props.costoFinanciero) },
    { label: "Total QQ Pergamino", value: formatNumber(props.totalQQPergamino, 2) },
    { label: "Total Compra Pergamino", value: formatGTQ(props.totalCompraPergamino) },
    { label: "Total QQ Subproducto", value: formatNumber(props.totalQQSubproducto, 2) },
    { label: "Total Vent. Subproducto", value: formatGTQ(props.totalVentSubproducto) },
    { label: "Margen Bruto Contrato", value: formatPercent(props.margenBrutoContrato), highlight: true },
    { label: "Margen Bruto Ponderado", value: props.margenBrutoPonderado != null ? formatPercent(props.margenBrutoPonderado) : "—", highlight: true },
    { label: "Facturación Acumulada", value: props.facturacionAcumulada != null ? formatUSD(props.facturacionAcumulada) : "—" },
    { label: "Contenedores Vendidos", value: props.contenedoresVendidos != null ? String(props.contenedoresVendidos) : "—" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Este Contrato
          </h3>
          <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {formatGTQ(props.totalPagoQTZ)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between text-sm">
              <dt className="text-gray-500 dark:text-gray-400">{l.label}</dt>
              <dd
                className={`font-mono font-medium ${
                  l.highlight
                    ? marginColorClass(
                        l.label.includes("Ponderado")
                          ? props.margenBrutoPonderado ?? 0
                          : props.margenBrutoContrato
                      )
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {l.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
