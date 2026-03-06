"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PurchaseOrderCreateSchema } from "@/lib/validations/schemas";
import { calculatePurchaseOrder } from "@/lib/services/calculations";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatGTQ } from "@/lib/utils/format";
import { createPurchaseOrder, updatePurchaseOrder } from "../actions";
import type { Supplier } from "@prisma/client";

type POFormValues = Omit<z.infer<typeof PurchaseOrderCreateSchema>, "date"> & {
  date: string;
};

interface POFormProps {
  mode: "create" | "edit";
  suppliers: Supplier[];
  initialData?: Partial<POFormValues> & { id?: string };
}

export function POForm({ mode, suppliers, initialData }: POFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<POFormValues>({
    resolver: zodResolver(PurchaseOrderCreateSchema) as unknown as Resolver<POFormValues>,
    defaultValues: {
      orderNumber: initialData?.orderNumber ?? "",
      supplierId: initialData?.supplierId ?? "",
      date: initialData?.date
        ? new Date(initialData.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      quintalesPerg: initialData?.quintalesPerg ?? undefined,
      precioPerg: initialData?.precioPerg ?? undefined,
      fletePorQQ: initialData?.fletePorQQ ?? 15,
      seguridad: initialData?.seguridad ?? 650,
      seguro: initialData?.seguro ?? 0,
      cadena: initialData?.cadena ?? 0,
      cargas: initialData?.cargas ?? 0,
      descargas: initialData?.descargas ?? 0,
      cosecha: initialData?.cosecha ?? "",
    },
  });

  const w = watch();

  const preview = useMemo(() => {
    if (!w.quintalesPerg || !w.precioPerg) return null;
    return calculatePurchaseOrder({
      quintalesPergamino: w.quintalesPerg,
      precioPorQQ: w.precioPerg,
      fletePorQQ: w.fletePorQQ ?? 0,
      seguridad: w.seguridad ?? 0,
      seguro: w.seguro ?? 0,
      cadena: w.cadena ?? 0,
      cargas: w.cargas ?? 0,
      descargas: w.descargas ?? 0,
    });
  }, [w.quintalesPerg, w.precioPerg, w.fletePorQQ, w.seguridad, w.seguro, w.cadena, w.cargas, w.descargas]);

  async function onSubmit(data: POFormValues) {
    setSubmitting(true);
    try {
      const parsed = PurchaseOrderCreateSchema.parse(data);
      if (mode === "edit" && initialData?.id) {
        await updatePurchaseOrder({ ...parsed, id: initialData.id });
        toast.success("Orden actualizada");
      } else {
        await createPurchaseOrder(parsed);
        toast.success("Orden creada");
      }
      router.push("/inventory");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando orden");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Input
              label="Número OC"
              placeholder="OC-2526-01"
              error={errors.orderNumber?.message}
              {...register("orderNumber")}
            />
            <Select
              label="Proveedor"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Seleccionar"
              error={errors.supplierId?.message}
              {...register("supplierId")}
            />
            <Input
              label="Fecha"
              type="date"
              error={errors.date?.message}
              {...register("date")}
            />
            <Input
              label="Cosecha"
              placeholder="25/26"
              error={errors.cosecha?.message}
              {...register("cosecha")}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Quintales Pergamino"
              type="number"
              step="0.01"
              error={errors.quintalesPerg?.message}
              {...register("quintalesPerg", { valueAsNumber: true })}
            />
            <Input
              label="Precio por QQ"
              type="number"
              step="0.01"
              error={errors.precioPerg?.message}
              {...register("precioPerg", { valueAsNumber: true })}
            />
            <Input
              label="Flete por QQ"
              type="number"
              step="0.01"
              error={errors.fletePorQQ?.message}
              {...register("fletePorQQ", { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Seguridad"
              type="number"
              step="0.01"
              error={errors.seguridad?.message}
              {...register("seguridad", { valueAsNumber: true })}
            />
            <Input
              label="Seguro"
              type="number"
              step="0.01"
              error={errors.seguro?.message}
              {...register("seguro", { valueAsNumber: true })}
            />
            <Input
              label="Cadena"
              type="number"
              step="0.01"
              {...register("cadena", { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Cargas"
              type="number"
              step="0.01"
              {...register("cargas", { valueAsNumber: true })}
            />
            <Input
              label="Descargas"
              type="number"
              step="0.01"
              {...register("descargas", { valueAsNumber: true })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={submitting}>
              {mode === "edit" ? "Guardar Cambios" : "Crear Orden"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Preview de Costos
                </h3>
              </CardHeader>
              <CardContent>
                {preview ? (
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Total Café</dt>
                      <dd className="font-mono">
                        {formatGTQ(preview.totalCafe.toNumber())}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Total Flete</dt>
                      <dd className="font-mono">
                        {formatGTQ(preview.totalFlete.toNumber())}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <dt className="font-semibold text-gray-700 dark:text-gray-300">
                        Costo Total
                      </dt>
                      <dd className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formatGTQ(preview.costoTotalAcumulado.toNumber())}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Precio Promedio</dt>
                      <dd className="font-mono">
                        {formatGTQ(preview.precioPromedio.toNumber())}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-400">
                    Ingresa quintales y precio para ver preview.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </form>
  );
}
