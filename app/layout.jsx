export const metadata = {
  title: "TixSwap",
  description: "Compra y vende entradas con seguridad",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="">
        {children}
      </body>
    </html>
  );
}
