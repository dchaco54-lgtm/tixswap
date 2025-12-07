import './globals.css';

export const metadata = {
  title: 'TixSwap',
  description: 'Marketplace de reventa segura de entradas',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}
