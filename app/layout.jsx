export const metadata = {
  title: "TixSwap",
  description: "Compra y vende entradas de forma segura",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
