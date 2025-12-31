"use client";
import "./globals.css";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className="bg-[#FAFAFA] text-slate-900 antialiased">
        <header className="sticky top-0 z-[100] bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-4 md:h-20 md:flex md:items-center">
          <div className="max-w-[1600px] mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Logo & Nav Row */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2">
                  <PhotoIcon className="h-7 w-7 text-blue-600" />
                  <h1 className="text-xl font-black italic tracking-tighter">LENS.</h1>
                </Link>
                <nav className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest border-l border-slate-200 pl-4">
                  <Link href="/" className={pathname === "/" ? "text-blue-600" : "text-slate-400"}>Home</Link>
                  <Link href="/admin" className={pathname === "/admin" ? "text-blue-600" : "text-slate-400"}>Admin</Link>
                </nav>
              </div>
              {/* Mobile Plus Button Portal Target */}
              <div id="nav-right-mobile" className="md:hidden" />
            </div>

            {/* Full-width Search on Mobile */}
            <div id="search-container" className="w-full md:max-w-md h-full flex items-center" />

            {/* Desktop Plus Button Portal Target */}
            <div id="nav-right-desktop" className="hidden md:flex shrink-0" />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}