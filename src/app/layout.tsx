import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Office Claim - Monthly Expense claims Recording System',
  description: 'Secure portal for staff to record and track monthly expense claims. Integrated with Google Document AI OCR and Bukku export.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
