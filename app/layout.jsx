export const metadata = {
  title: "TixSwap",
  description: "Reventa segura de entradas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-white text-black">
        {children}
      </body>
    </html>
  );
}
