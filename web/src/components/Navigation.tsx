"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function Navigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/workouts", label: "Workouts" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/lifts", label: "Lifts" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold text-orange-500">
              CrossFit Tracker
            </Link>
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-gray-900 text-orange-500"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <span className="text-gray-400 text-sm">
                  Hey, {user.firstName || user.displayName}!
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-gray-300 hover:text-white text-sm"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
        {/* Mobile navigation */}
        <div className="md:hidden pb-3 flex space-x-2 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                pathname === item.href
                  ? "bg-gray-900 text-orange-500"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
