"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, GymApplication } from "@/lib/types";
import AccountSwitcher from "./AccountSwitcher";

export default function Navigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isGymOwner, setIsGymOwner] = useState(false);
  const [hasGymApplication, setHasGymApplication] = useState(false);

  useEffect(() => {
    const checkGymOwnership = async () => {
      if (!user) {
        setIsGymOwner(false);
        setHasGymApplication(false);
        return;
      }
      try {
        // Check if user owns any gyms
        const gymsSnapshot = await getDocs(collection(db, "gyms"));
        const gyms = gymsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Gym[];

        const ownsGym = gyms.some((gym) => gym.ownerId === user.id);
        setIsGymOwner(ownsGym);

        // Check if user has any gym application (pending or approved awaiting setup)
        if (!ownsGym) {
          const applicationsQuery = query(
            collection(db, "gymApplications"),
            where("userId", "==", user.id)
          );
          const appSnapshot = await getDocs(applicationsQuery);
          // Show gym tab if user has pending or approved (without gym created) application
          const hasApplication = appSnapshot.docs.some(doc => {
            const data = doc.data() as GymApplication;
            if (data.status === "pending") return true;
            if (data.status === "approved" && !data.approvedGymId) return true;
            return false;
          });
          setHasGymApplication(hasApplication);
        } else {
          setHasGymApplication(false);
        }
      } catch (error) {
        console.error("Error checking gym ownership:", error);
        setIsGymOwner(false);
        setHasGymApplication(false);
      }
    };

    checkGymOwnership();
  }, [user]);

  // Only show special tabs to these specific users (by email or UID)
  const allowedEmails = ["indi@user.com", "1@1.com", "cheese@cheese.com", "tyguy4201@gmail.com"];
  const allowedUIDs = ["ttgK41hHOnPiUKemZoPZSiktQXC3"];
  const canSeeSpecialTabs = (user?.email && allowedEmails.includes(user.email)) || (user?.id && allowedUIDs.includes(user.id));

  // Crystal and Reno tabs visible only to specific UIDs
  const crystalRenoAllowedUIDs = ["uknIhGe53pcj6sZBbSYVRo9NF713", "WuxjspCO48ZWyhiuWkTLbRRNKDz2"];
  const canSeeCrystalRenoTabs = user?.id && crystalRenoAllowedUIDs.includes(user.id);

  // My Wife tab visible to specific user
  const myWifeAllowedUIDs = ["WuxjspCO48ZWyhiuWkTLbRRNKDz2"];
  const myWifeAllowedEmails = ["tyguy4201@gmail.com"];
  const canSeeMyWifeTab = (user?.id && myWifeAllowedUIDs.includes(user.id)) || (user?.email && myWifeAllowedEmails.includes(user.email));

  // Hi Dan tab - supercross & jiu-jitsu themed
  const danAllowedEmails = ["indi@user.com", "tyguy4201@gmail.com"];
  const canSeeDanTab = user?.email && danAllowedEmails.some(e => e.toLowerCase() === user.email?.toLowerCase());

  // Hi Claire tab - outdoors & anti-cat themed
  const claireAllowedEmails = ["tyguy4201@gmail.com", "chap@mans.com"];
  const canSeeClairTab = user?.email && claireAllowedEmails.some(e => e.toLowerCase() === user.email?.toLowerCase());

  // Chappy tab - outdoors & beer themed
  const chappyAllowedEmails = ["tyguy4201@gmail.com", "chap@mans.com"];
  const canSeeChappyTab = user?.email && chappyAllowedEmails.some(e => e.toLowerCase() === user.email?.toLowerCase());

  // Hazel tab - birthday & meatball quesadilla themed
  const hazelAllowedEmails = ["tyguy4201@gmail.com", "chap@mans.com"];
  const canSeeHazelTab = user?.email && hazelAllowedEmails.some(e => e.toLowerCase() === user.email?.toLowerCase());

  // Aspen tab - princess & SpongeBob themed
  const aspenAllowedEmails = ["tyguy4201@gmail.com", "chap@mans.com"];
  const canSeeAspenTab = user?.email && aspenAllowedEmails.some(e => e.toLowerCase() === user.email?.toLowerCase());

  // Check if user needs to subscribe - coaches check aiProgrammingSubscription, athletes check aiTrainerSubscription
  const relevantSubscription = isGymOwner
    ? user?.aiProgrammingSubscription
    : user?.aiTrainerSubscription;
  const hasAISubscription = relevantSubscription?.status === "active" ||
    relevantSubscription?.status === "trialing";

  // Super admin check
  const isSuperAdmin = user?.role === "superAdmin";

  // Show Gym tab if user owns a gym OR has an application (pending or approved)
  const showGymTab = isGymOwner || hasGymApplication;

  const navItems = [
    { href: "/weekly", label: "Home", icon: "🏠" },
    ...(showGymTab ? [{ href: "/gym", label: "Gym", icon: "🏢" }] : []),
    { href: "/programming", label: "Programming", icon: "📅" },
    { href: "/workouts", label: "Workouts", icon: "📋" },
    { href: "/profile", label: "Profile", icon: "👤" },
    ...(isSuperAdmin ? [{ href: "/admin/gym-applications", label: "Admin", icon: "🛡️" }] : []),
    ...(!hasAISubscription ? [{ href: isGymOwner ? "/subscribe?variant=coach" : "/subscribe", label: isGymOwner ? "AI Programming" : "AI Coach", icon: "⚡" }] : []),
    ...(canSeeSpecialTabs ? [{ href: "/hi-devin", label: "Hi Devin!", icon: "🎉" }] : []),
    ...(canSeeSpecialTabs ? [{ href: "/hi-blake", label: "Hi Blake...", icon: "💀" }] : []),
    ...(canSeeCrystalRenoTabs ? [{ href: "/hi-crystal", label: "Hi Crystal!", icon: "☕" }] : []),
    ...(canSeeCrystalRenoTabs ? [{ href: "/hi-reno", label: "Hi Reno...", icon: "🤘" }] : []),
    ...(canSeeMyWifeTab ? [{ href: "/my-wife", label: "My Wife!", icon: "👍" }] : []),
    ...(canSeeDanTab ? [{ href: "/hi-dan", label: "Hi Dan!", icon: "🏍️" }] : []),
    ...(canSeeClairTab ? [{ href: "/hi-claire", label: "Hi Claire!", icon: "🌲" }] : []),
    ...(canSeeChappyTab ? [{ href: "/hi-chappy", label: "Hi Chappy!", icon: "🍺" }] : []),
    ...(canSeeHazelTab ? [{ href: "/hi-hazel", label: "Hi Hazel!", icon: "🎂" }] : []),
    ...(canSeeAspenTab ? [{ href: "/hi-aspen", label: "Hi Aspen!", icon: "👑" }] : []),
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
