import Sidebar from "@/componenets/admin/Sidebar";
import Topbar from "@/componenets/admin/Topbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Navigation Header */}
        {/* <Topbar /> */}

        {/* Dynamic Page Content */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 bg-slate-100/80">
          {children}
        </main>
      </div>
    </div>
  );
}