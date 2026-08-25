'use client'

import React, { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { X } from 'lucide-react'

export function DashboardShell({ 
  children, 
  role, 
  email,
  clinicName,
  clinicLogoUrl
}: { 
  children: React.ReactNode
  role: string
  email: string
  clinicName?: string
  clinicLogoUrl?: string
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const profile = { role, email, clinicName };

  return (
    <div className="flex h-screen bg-background overflow-hidden relative print:h-auto print:overflow-visible print:block print:bg-white">
      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden no-print ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-background transition-transform duration-300 ease-in-out lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar role={profile?.role || ''} onLinkClick={() => setSidebarOpen(false)} />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full lg:pl-72 print:pl-0 print:h-auto print:overflow-visible print:block transition-all duration-300 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-muted/50 via-background to-background print:bg-none print:bg-white">
        <div className="no-print">
          <Header 
            email={email} 
            role={role} 
            clinicName={clinicName}
            clinicLogoUrl={clinicLogoUrl}
            onMenuClick={() => setSidebarOpen(true)} 
          />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 print:p-0 print:overflow-visible print:h-auto print:block animate-in">
          <div className="mx-auto max-w-7xl print:max-w-none print:w-full print:m-0 print:p-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
