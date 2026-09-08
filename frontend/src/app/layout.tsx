import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DataLab - Modern Data Science Platform",
    template: "%s | DataLab",
  },
  description: "A collaborative data science platform. Explore published datasets, run statistical tests, train machine learning models, and build beautiful visualizations directly in your browser.",
  keywords: ["Data Science", "Machine Learning", "Datasets", "Statistical Testing", "Data Visualization", "DataLab", "Data Analysis"],
  authors: [{ name: "DataLab Researchers" }],
  creator: "DataLab",
  icons: {
    icon: "/favicon.ico?v=3",
    apple: "/favicon.ico?v=3",
  },
  verification: {
    google: "oZselN3LsERDeothB7teAB9IqZI5LoOFXwWtYlWXPZI",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://data-lab-taupe.vercel.app/",
    title: "DataLab - Modern Data Science Platform",
    description: "A collaborative data science platform. Explore published datasets, run statistical tests, train machine learning models, and build beautiful visualizations directly in your browser.",
    siteName: "DataLab",
  },
  twitter: {
    card: "summary_large_image",
    title: "DataLab - Modern Data Science Platform",
    description: "Explore published datasets, train machine learning models, and build visualizations in your browser.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Theme Logic
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else if (savedTheme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                }
                
                // Density Logic
                const savedDensity = localStorage.getItem('density');
                if (savedDensity) {
                  document.documentElement.setAttribute('data-density', savedDensity);
                } else {
                  document.documentElement.setAttribute('data-density', 'default');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
