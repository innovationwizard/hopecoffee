import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChangePasswordForm } from "./_components/change-password-form";

export default function ChangePasswordPage() {
  return (
    <>
      <PageHeader
        title="Cambiar contraseña"
        breadcrumbs={[
          { label: "Configuracion" },
          { label: "Cambiar contraseña" },
        ]}
      />
      <div className="max-w-md">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Cambiar tu contraseña
            </h3>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
