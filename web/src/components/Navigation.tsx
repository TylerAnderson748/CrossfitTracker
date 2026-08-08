"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AccountSwitcher from "./AccountSwitcher";
import WelcomeTour from "./WelcomeTour";

export default function Navigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [showTour, setShowTour] = useState(false);

  const hasAISubscription = user?.aiTrainerSubscription?.status === "active" ||
    user?.aiTrainerSubscription?.status === "trialing";

  const navItems = [
    { href: "/weekly", label: "Home", icon: "🏠" },
    { href: "/programming", label: "Oddo", icon: "🤖" },
    { href: "/plan", label: "My Plan", icon: "📋" },
    { href: "/workouts", label: "Records", icon: "📖" },
    { href: "/progress", label: "Progress", icon: "📈" },
    { href: "/profile", label: "Profile", icon: "👤" },
    ...(!hasAISubscription ? [{ href: "/subscribe", label: "Get Oddo", icon: "⚡" }] : []),
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/weekly" className="flex items-center space-x-2">
              <span className="text-2xl">🔥</span>
              <span className="text-xl font-bold text-blue-600">CoachODDO</span>
            </Link>
            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href || pathname.startsWith(item.href + "/")
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setShowTour(true)}
                className="px-3 py-1.5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-semibold transition-colors flex items-center gap-1.5"
                title="App tour - what can I do here?"
              >
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">?</span>
                <span className="hidden sm:inline">Help</span>
              </button>
            )}
            {user && <AccountSwitcher />}
          </div>
        </div>
        {/* Mobile navigation */}
        <div className="md:hidden pb-3 flex space-x-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center ${
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="mr-1">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      {showTour && user && (
        <WelcomeTour userId={user.id} onDone={() => setShowTour(false)} />
      )}
    </nav>
  );
}
