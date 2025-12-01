"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, addDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym } from "@/lib/types";
import Navigation from "@/components/Navigation";

interface ProgrammingProvider {
  id: string;
  name: string;
  description: string;
  logo: string;
  color: string;
  website: string;
  type: "affiliate" | "online" | "personal";
}

interface ConnectedProgram {
  id: string;
  providerId: string;
  providerName: string;
  userId: string;
  connectedAt: Timestamp;
  status: "active" | "paused";
}

const PROGRAMMING_PROVIDERS: ProgrammingProvider[] = [
  {
    id: "prvn",
    name: "PRVN",
    description: "Evidence-based fitness programming by Marcus Filly. Functional bodybuilding and performance.",
    logo: "🏆",
    color: "bg-orange-500",
    website: "https://prvnfitness.com",
    type: "online",
  },
  {
    id: "crossfit",
    name: "CrossFit.com",
    description: "The official CrossFit workout of the day. Free daily programming for all levels.",
    logo: "🔥",
    color: "bg-red-600",
    website: "https://crossfit.com",
    type: "online",
  },
  {
    id: "hwpo",
    name: "HWPO",
    description: "Hard Work Pays Off. Training programming by Mat Fraser, 5x CrossFit Games Champion.",
    logo: "💪",
    color: "bg-blue-600",
    website: "https://hwpotraining.com",
    type: "online",
  },
  {
    id: "mayhem",
    name: "Mayhem",
    description: "Programming by Rich Froning and the Mayhem team. Competition and lifestyle tracks.",
    logo: "⚡",
    color: "bg-purple-600",
    website: "https://crossfitmayhem.com",
    type: "online",
  },
  {
    id: "comptrain",
    name: "CompTrain",
    description: "Competition training by Ben Bergeron. Multiple tracks for all skill levels.",
    logo: "🎯",
    color: "bg-green-600",
    website: "https://comptrain.co",
    type: "online",
  },
  {
    id: "linchpin",
    name: "Linchpin",
    description: "Programming by Pat Sherwood. Daily workouts designed for real-world fitness.",
    logo: "🔗",
    color: "bg-gray-700",
    website: "https://www.crossfitlinchpin.com",
    type: "online",
  },
  {
    id: "personal",
    name: "Personal Trainer",
    description: "Connect with your personal trainer for custom programming tailored to you.",
    logo: "👤",
    color: "bg-teal-600",
    website: "",
    type: "personal",
  },
  {
    id: "affiliate",
    name: "CrossFit Affiliate",
    description: "Follow your local CrossFit gym's programming. Connect with your box.",
    logo: "🏢",
    color: "bg-indigo-600",
    website: "",
    type: "affiliate",
  },
];

export default function ProgrammingPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();
  const [connectedPrograms, setConnectedPrograms] = useState<ConnectedProgram[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState<ProgrammingProvider | null>(null);
  const [connectCode, setConnectCode] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Gym search state
  const [allGyms, setAllGyms] = useState<Gym[]>([]);
  const [myGyms, setMyGyms] = useState<Gym[]>([]);
  const [showFindGymModal, setShowFindGymModal] = useState(false);
  const [gymSearchQuery, setGymSearchQuery] = useState("");

  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  useEffect(() => {
    if (user) {
      fetchConnectedPrograms();
      fetchGyms();
    }
  }, [user]);

  const fetchConnectedPrograms = async () => {
    if (!user) return;

    try {
      const snapshot = await getDocs(collection(db, "connectedPrograms"));
      const programs = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((p: any) => p.userId === user.id) as ConnectedProgram[];
      setConnectedPrograms(programs);
    } catch (error) {
      console.error("Error fetching connected programs:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchGyms = async () => {
    if (!user) return;

    try {
      const gymsSnapshot = await getDocs(collection(db, "gyms"));
      const gyms = gymsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Gym[];
      setAllGyms(gyms);

      // Filter gyms where user is a member
      const userGyms = gyms.filter(
        (gym) =>
          gym.ownerId === user.id ||
          gym.coachIds?.includes(user.id) ||
          gym.memberIds?.includes(user.id)
      );
      setMyGyms(userGyms);
    } catch (error) {
      console.error("Error fetching gyms:", error);
    }
  };

  // Gyms available to join (not already a member)
  const availableGyms = allGyms.filter(
    (gym) =>
      gym.ownerId !== user?.id &&
      !gym.coachIds?.includes(user?.id || "") &&
      !gym.memberIds?.includes(user?.id || "")
  );

  // Filter available gyms by search query
  const filteredGyms = gymSearchQuery.trim()
    ? availableGyms.filter((gym) =>
        gym.name.toLowerCase().includes(gymSearchQuery.toLowerCase())
      )
    : availableGyms;

  const handleConnect = async (provider: ProgrammingProvider) => {
    if (!user) return;

    // Check if already connected
    const alreadyConnected = connectedPrograms.some((p) => p.providerId === provider.id);
    if (alreadyConnected) {
      alert("You are already connected to this program.");
      return;
    }

    // For personal trainer or affiliate, show modal to enter code
    if (provider.type === "personal" || provider.type === "affiliate") {
      setShowConnectModal(provider);
      return;
    }

    // For online providers, connect directly
    setConnecting(true);
    try {
      await addDoc(collection(db, "connectedPrograms"), {
        providerId: provider.id,
        providerName: provider.name,
        userId: user.id,
        connectedAt: Timestamp.now(),
        status: "active",
      });
      fetchConnectedPrograms();
    } catch (error) {
      console.error("Error connecting:", error);
      alert("Failed to connect. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectWithCode = async () => {
    if (!user || !showConnectModal || !connectCode.trim()) return;

    setConnecting(true);
    try {
      await addDoc(collection(db, "connectedPrograms"), {
        providerId: showConnectModal.id,
        providerName: showConnectModal.name,
        userId: user.id,
        connectedAt: Timestamp.now(),
        status: "active",
        connectionCode: connectCode.trim(),
      });
      setShowConnectModal(null);
      setConnectCode("");
      fetchConnectedPrograms();
    } catch (error) {
      console.error("Error connecting:", error);
      alert("Failed to connect. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (programId: string) => {
    if (!confirm("Are you sure you want to disconnect from this program?")) return;

    try {
      await deleteDoc(doc(db, "connectedPrograms", programId));
      fetchConnectedPrograms();
    } catch (error) {
      console.error("Error disconnecting:", error);
      alert("Failed to disconnect. Please try again.");
    }
  };

  const isConnected = (providerId: string) => {
    return connectedPrograms.some((p) => p.providerId === providerId);
  };

  const getConnectedProgram = (providerId: string) => {
    return connectedPrograms.find((p) => p.providerId === providerId);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const onlineProviders = PROGRAMMING_PROVIDERS.filter((p) => p.type === "online");
  const otherProviders = PROGRAMMING_PROVIDERS.filter((p) => p.type !== "online");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Programming</h1>
          <p className="text-gray-500">Connect to external programming and follow your favorite coaches</p>
        </div>

        {/* My Gyms */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Gyms</h2>
            <button
              onClick={() => setShowFindGymModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <span>🔍</span> Find Gyms
            </button>
          </div>
          {myGyms.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <div className="text-3xl mb-2">🏢</div>
              <p className="text-gray-500 text-sm">You haven&apos;t joined any gyms yet</p>
              <button
                onClick={() => setShowFindGymModal(true)}
                className="mt-3 px-4 py-2 bg-blue-100 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-200"
              >
                Find a Gym
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myGyms.map((gym) => {
                const role = gym.ownerId === user?.id
                  ? "Owner"
                  : gym.coachIds?.includes(user?.id || "")
                  ? "Coach"
                  : "Member";
                const roleColor = role === "Owner"
                  ? "bg-purple-100 text-purple-600"
                  : role === "Coach"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-green-100 text-green-600";
                return (
                  <div
                    key={gym.id}
                    onClick={() => router.push(`/gym/${gym.id}`)}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">
                        🏢
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{gym.name}</h3>
                        <p className="text-sm text-gray-500">
                          {(gym.memberIds?.length || 0) + (gym.coachIds?.length || 0) + 1} members
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${roleColor}`}>
                        {role}
                      </span>
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Connected Programs */}
        {connectedPrograms.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Programs</h2>
            <div className="space-y-3">
              {connectedPrograms.map((program) => {
                const provider = PROGRAMMING_PROVIDERS.find((p) => p.id === program.providerId);
                return (
                  <div
                    key={program.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${provider?.color || "bg-gray-500"} rounded-xl flex items-center justify-center text-2xl text-white`}>
                        {provider?.logo || "📋"}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{program.providerName}</h3>
                        <p className="text-sm text-gray-500">
                          Connected {program.connectedAt?.toDate?.().toLocaleDateString() || ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                        Active
                      </span>
                      <button
                        onClick={() => handleDisconnect(program.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Online Programming */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Online Programming</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {onlineProviders.map((provider) => {
              const connected = isConnected(provider.id);
              return (
                <div
                  key={provider.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 ${provider.color} rounded-xl flex items-center justify-center text-2xl text-white flex-shrink-0`}>
                      {provider.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                        {connected && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{provider.description}</p>
                      <div className="flex items-center gap-3 mt-3">
                        {connected ? (
                          <button
                            onClick={() => handleDisconnect(getConnectedProgram(provider.id)?.id || "")}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(provider)}
                            disabled={connecting}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-300"
                          >
                            Connect
                          </button>
                        )}
                        {provider.website && (
                          <a
                            href={provider.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Visit Website
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Personal & Affiliate */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal & Local</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherProviders.map((provider) => {
              const connected = isConnected(provider.id);
              return (
                <div
                  key={provider.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 ${provider.color} rounded-xl flex items-center justify-center text-2xl text-white flex-shrink-0`}>
                      {provider.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                        {connected && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{provider.description}</p>
                      <div className="flex items-center gap-3 mt-3">
                        {connected ? (
                          <button
                            onClick={() => handleDisconnect(getConnectedProgram(provider.id)?.id || "")}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(provider)}
                            disabled={connecting}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-300"
                          >
                            Connect with Code
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 mb-2">How Programming Works</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Connect to your favorite programming provider above</li>
            <li>• Their daily workouts will appear on your Home page</li>
            <li>• Log your results and track your progress</li>
            <li>• For personal trainers or affiliates, use the code they provide</li>
          </ul>
        </div>
      </main>

      {/* Connect with Code Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 ${showConnectModal.color} rounded-xl flex items-center justify-center text-2xl text-white`}>
                {showConnectModal.logo}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Connect to {showConnectModal.name}</h2>
                <p className="text-sm text-gray-500">Enter the code provided by your trainer</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Connection Code
              </label>
              <input
                type="text"
                value={connectCode}
                onChange={(e) => setConnectCode(e.target.value.toUpperCase())}
                placeholder="e.g., TRAINER123"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-center text-lg font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConnectModal(null);
                  setConnectCode("");
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectWithCode}
                disabled={!connectCode.trim() || connecting}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
              >
                {connecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Find Gym Modal */}
      {showFindGymModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Find Gyms</h2>
              <button
                onClick={() => {
                  setShowFindGymModal(false);
                  setGymSearchQuery("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={gymSearchQuery}
                onChange={(e) => setGymSearchQuery(e.target.value)}
                placeholder="Search gyms..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredGyms.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {gymSearchQuery.trim() ? "No gyms found matching your search" : "No gyms available to join"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredGyms.map((gym) => (
                    <div
                      key={gym.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <h3 className="font-medium text-gray-900">{gym.name}</h3>
                        <p className="text-gray-500 text-sm">
                          {(gym.memberIds?.length || 0) + (gym.coachIds?.length || 0) + 1} members
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          router.push(`/gym/${gym.id}/join`);
                          setShowFindGymModal(false);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowFindGymModal(false);
                setGymSearchQuery("");
              }}
              className="w-full mt-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
