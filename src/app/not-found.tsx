import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-700">
        404
      </h1>
      <p className="text-lg text-gray-500 mt-2 mb-6">
        Página no encontrada
      </p>
      <Link
        href="/dashboard"
        className="text-blue-600 hover:underline text-sm"
      >
        Volver al Dashboard
      </Link>
    </div>
  );
}
