import { getFarms } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { FarmCard } from "./_components/farm-card";

export default async function FarmsPage() {
  const farms = await getFarms();

  return (
    <>
      <PageHeader title="Fincas" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {farms.map((f) => (
          <FarmCard key={f.id} farm={f} />
        ))}
      </div>

      {farms.length === 0 && (
        <p className="text-sm text-gray-400 text-center mt-8">
          Las fincas se crean al ejecutar el seed.
        </p>
      )}
    </>
  );
}
