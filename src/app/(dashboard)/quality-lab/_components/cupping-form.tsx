"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { createCuppingRecord } from "../actions";
import { formatNumber } from "@/lib/utils/format";

interface LotOption {
  id: string;
  lotNumber: string;
  supplier: { id: string; name: string } | null;
}

const SCA_LEFT = [
  { key: "fragrance", label: "Fragancia / Aroma" },
  { key: "flavor", label: "Sabor" },
  { key: "aftertaste", label: "Resabio" },
  { key: "acidity", label: "Acidez" },
  { key: "body", label: "Cuerpo" },
] as const;

const SCA_RIGHT = [
  { key: "balance", label: "Balance" },
  { key: "uniformity", label: "Uniformidad" },
  { key: "cleanCup", label: "Taza Limpia" },
  { key: "sweetness", label: "Dulzura" },
  { key: "overall", label: "General" },
] as const;

const ALL_SCA = [...SCA_LEFT, ...SCA_RIGHT];

type ScaKey = (typeof ALL_SCA)[number]["key"];

export function CuppingForm({ lots }: { lots: LotOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [lotId, setLotId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [scores, setScores] = useState<Record<ScaKey, string>>({
    fragrance: "7.50",
    flavor: "7.50",
    aftertaste: "7.50",
    acidity: "7.50",
    body: "7.50",
    balance: "7.50",
    uniformity: "10.00",
    cleanCup: "10.00",
    sweetness: "10.00",
    overall: "7.50",
  });

  const [moisturePercent, setMoisturePercent] = useState("");
  const [defectCount, setDefectCount] = useState("");
  const [screenSize, setScreenSize] = useState("");
  const [waterActivity, setWaterActivity] = useState("");
  const [yieldMeasured, setYieldMeasured] = useState("");
  const [notes, setNotes] = useState("");

  const totalScore = useMemo(() => {
    return ALL_SCA.reduce((sum, attr) => {
      const val = parseFloat(scores[attr.key]);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [scores]);

  function updateScore(key: ScaKey, value: string) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!lotId) {
      toast.error("Seleccione un lote");
      return;
    }

    const scaValues: Record<string, number> = {};
    for (const attr of ALL_SCA) {
      const val = parseFloat(scores[attr.key]);
      if (isNaN(val) || val < 6 || val > 10) {
        toast.error(`${attr.label} debe estar entre 6 y 10`);
        return;
      }
      scaValues[attr.key] = val;
    }

    startTransition(async () => {
      try {
        await createCuppingRecord({
          lotId,
          date: new Date(date),
          fragrance: scaValues.fragrance,
          flavor: scaValues.flavor,
          aftertaste: scaValues.aftertaste,
          acidity: scaValues.acidity,
          body: scaValues.body,
          balance: scaValues.balance,
          uniformity: scaValues.uniformity,
          cleanCup: scaValues.cleanCup,
          sweetness: scaValues.sweetness,
          overall: scaValues.overall,
          moisturePercent: moisturePercent ? parseFloat(moisturePercent) : null,
          defectCount: defectCount ? parseInt(defectCount, 10) : null,
          screenSize: screenSize || null,
          waterActivity: waterActivity ? parseFloat(waterActivity) : null,
          yieldMeasured: yieldMeasured ? parseFloat(yieldMeasured) : null,
          notes: notes || null,
        });
        toast.success("Catacion registrada");
        router.push("/quality-lab");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Error al crear catacion"
        );
      }
    });
  }

  const lotOptions = lots.map((l) => ({
    value: l.id,
    label: `${l.lotNumber}${l.supplier ? ` — ${l.supplier.name}` : ""}`,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Lot and Date */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Informacion General
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Lote"
              options={lotOptions}
              placeholder="Seleccionar lote..."
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              required
            />
            <Input
              label="Fecha"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* SCA Attributes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Atributos SCA
            </h2>
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Puntaje Total
              </span>
              <p
                className={`text-xl font-bold ${
                  totalScore >= 85
                    ? "text-emerald-600"
                    : totalScore >= 80
                      ? "text-blue-600"
                      : "text-amber-600"
                }`}
              >
                {formatNumber(totalScore, 2)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4">
              {SCA_LEFT.map((attr) => (
                <Input
                  key={attr.key}
                  label={attr.label}
                  type="number"
                  min={6}
                  max={10}
                  step={0.25}
                  value={scores[attr.key]}
                  onChange={(e) => updateScore(attr.key, e.target.value)}
                  required
                />
              ))}
            </div>
            <div className="space-y-4">
              {SCA_RIGHT.map((attr) => (
                <Input
                  key={attr.key}
                  label={attr.label}
                  type="number"
                  min={6}
                  max={10}
                  step={0.25}
                  value={scores[attr.key]}
                  onChange={(e) => updateScore(attr.key, e.target.value)}
                  required
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Physical Analysis */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Analisis Fisico
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Humedad (%)"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={moisturePercent}
              onChange={(e) => setMoisturePercent(e.target.value)}
              placeholder="10.50"
            />
            <Input
              label="Conteo de Defectos"
              type="number"
              min={0}
              step={1}
              value={defectCount}
              onChange={(e) => setDefectCount(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Tamano de Criba"
              type="text"
              value={screenSize}
              onChange={(e) => setScreenSize(e.target.value)}
              placeholder="15/16"
            />
            <Input
              label="Actividad de Agua (aw)"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={waterActivity}
              onChange={(e) => setWaterActivity(e.target.value)}
              placeholder="0.55"
            />
          </div>
        </CardContent>
      </Card>

      {/* Yield */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Rendimiento
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Rendimiento Medido"
              type="number"
              min={1.0}
              max={2.0}
              step={0.0001}
              value={yieldMeasured}
              onChange={(e) => setYieldMeasured(e.target.value)}
              placeholder="1.3200"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Observaciones
          </h2>
        </CardHeader>
        <CardContent>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notas
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-orion-800 text-slate-900 dark:text-white border-slate-300 dark:border-orion-700 focus:ring-2 focus:ring-orion-400 focus:border-orion-400 outline-none transition-colors"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas de catacion..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/quality-lab")}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={isPending}>
          Registrar Catacion
        </Button>
      </div>
    </form>
  );
}
