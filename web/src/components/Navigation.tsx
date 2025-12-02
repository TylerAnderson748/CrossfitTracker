"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym } from "@/lib/types";
import AccountSwitcher from "./AccountSwitcher";

export default function Navigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isGymOwner, setIsGymOwner] = useState(false);

  useEffect(() => {
    const checkGymOwnership = async () => {
      if (!user) {
        setIsGymOwner(false);
        return;
      }
      try {
        const gymsSnapshot = await getDocs(collection(db, "gyms"));
        const gyms = gymsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Gym[];

        const ownsGym = gyms.some((gym) => gym.ownerId === user.id);
        setIsGymOwner(ownsGym);
      } catch (error) {
        console.error("Error checking gym ownership:", error);
        setIsGymOwner(false);
      }
    };

    checkGymOwnership();
  }, [user]);

  // Only show special tabs to these specific users
  const allowedEmails = ["indi@user.com", "1@1.com", "cheese@cheese.com", "tyguy4201@gmail.com"];
  const canSeeSpecialTabs = user?.email && allowedEmails.includes(user.email);

  // Crystal and Reno tabs visible only to specific UIDs
  const crystalRenoAllowedUIDs = ["uknIhGe53pcj6sZBbSYVRo9NF713", "WuxjspCO48ZWyhiuWkTLbRRNKDz2"];
  const canSeeCrystalRenoTabs = user?.id && crystalRenoAllowedUIDs.includes(user.id);

  const navItems = [
    { href: "/weekly", label: "Home", icon: "🏠" },
    ...(isGymOwner ? [{ href: "/gym", label: "Gym", icon: "🏢" }] : []),
    { href: "/programming", label: "Programming", icon: "📅" },
    { href: "/workouts", label: "Workouts", icon: "📋" },
    { href: "/profile", label: "Profile", icon: "👤" },
    ...(canSeeSpecialTabs ? [{ href: "/hi-devin", label: "Hi Devin!", icon: "🎉" }] : []),
    ...(canSeeSpecialTabs ? [{ href: "/hi-blake", label: "Hi Blake...", icon: "💀" }] : []),
    ...(canSeeCrystalRenoTabs ? [{ href: "/hi-crystal", label: "Hi Crystal!", icon: "☕" }] : []),
    ...(canSeeCrystalRenoTabs ? [{ href: "/hi-reno", label: "Hi Reno...", icon: "🤘" }] : []),
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/weekly" className="flex items-center space-x-2">
              <span className="text-2xl">🔥</span>
              <span className="text-xl font-bold text-blue-600">CrossFit Tracker</span>
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
          <div className="flex items-center">
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
    </nav>
  );
}
