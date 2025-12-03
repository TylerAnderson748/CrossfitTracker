"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WorkoutGroup } from "@/lib/types";

interface ExternalProvider {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportsScheduledWorkouts: boolean;
  supportsDailyWorkouts: boolean;
  supportsMultiplePrograms: boolean;
}

interface ProviderConnection {
  id: string;
  providerId: string;
  providerName: string;
  status: "active" | "inactive" | "pending" | "error";
  targetGroupIds: string[];
  autoPublish: boolean;
  defaultHideDetails: boolean;
  connectedAt: string;
  lastWorkoutReceivedAt?: string;
}

interface ExternalProgrammingManagerProps {
  gymId: string;
  userId: string;
  groups: WorkoutGroup[];
  isOwner: boolean;
}

export default function ExternalProgrammingManager({
  gymId,
  userId,
  groups,
  isOwner,
}: ExternalProgrammingManagerProps) {
  const [providers, setProviders] = useState<ExternalProvider[]>([]);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ExternalProvider | null>(null);
  const [connectTargetGroups, setConnectTargetGroups] = useState<string[]>([]);
  const [connectAutoPublish, setConnectAutoPublish] = useState(false);
  const [connectHideDetails, setConnectHideDetails] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [gymId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch available providers
      const providersRes = await fetch("/api/providers/list");
      const providersData = await providersRes.json();
      if (providersData.success) {
        setProviders(providersData.providers);
      }

      // Fetch existing connections for this gym
      const connectionsRes = await fetch(`/api/providers/connect?gymId=${gymId}`);
      const connectionsData = await connectionsRes.json();
      if (connectionsData.success) {
        setConnections(connectionsData.connections);
      }
    } catch (err) {
      console.error("Error fetching provider data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedProvider) return;

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/providers/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          providerId: selectedProvider.id,
          userId,
          targetGroupIds: connectTargetGroups,
          autoPublish: connectAutoPublish,
          defaultHideDetails: connectHideDetails,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowConnectModal(false);
        setSelectedProvider(null);
        setConnectTargetGroups([]);
        setConnectAutoPublish(false);
        setConnectHideDetails(false);
        fetchData(); // Refresh connections
      } else {
        setError(data.error || "Failed to connect");
      }
    } catch (err) {
      setError("Failed to connect to provider");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm("Are you sure you want to disconnect? This will remove all workouts from this provider.")) {
      return;
    }

    try {
      const res = await fetch("/api/providers/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, userId }),
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.error("Error disconnecting:", err);
    }
  };

  const handleToggleStatus = async (connectionId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";

    try {
      const res = await fetch("/api/providers/connect", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, userId, status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.error("Error toggling status:", err);
    }
  };

  const getGroupName = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group?.name || "Unknown Group";
  };

  const availableProviders = providers.filter(
    (p) => !connections.some((c) => c.providerId === p.id)
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border-t border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">External Programming</h3>
          <p className="text-sm text-gray-500">
            Connect to external programming providers to automatically receive workouts
          </p>
        </div>
        {availableProviders.length > 0 && (
          <button
            onClick={() => setShowConnectModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            + Connect Provider
          </button>
        )}
      </div>

      {/* Connected Providers */}
      {connections.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No providers connected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Connect to an external programming provider to sync workouts automatically.
          </p>
          {availableProviders.length > 0 && (
            <button
              onClick={() => setShowConnectModal(true)}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Connect Your First Provider
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="p-4 bg-white border border-gray-200 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">{connection.providerName}</h4>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        connection.status === "active"
                          ? "bg-green-100 text-green-700"
                          : connection.status === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {connection.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    <p>
                      <span className="font-medium">Target Groups:</span>{" "}
                      {connection.targetGroupIds.length > 0
                        ? connection.targetGroupIds.map((id) => getGroupName(id)).join(", ")
                        : "All groups"}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium">Auto-publish:</span>{" "}
                      {connection.autoPublish ? "Yes" : "No"}
                      {connection.defaultHideDetails && " (hidden until reveal)"}
                    </p>
                    {connection.lastWorkoutReceivedAt && (
                      <p className="mt-1">
                        <span className="font-medium">Last workout:</span>{" "}
                        {new Date(connection.lastWorkoutReceivedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleStatus(connection.id, connection.status)}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      connection.status === "active"
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {connection.status === "active" ? "Pause" : "Resume"}
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => handleDisconnect(connection.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available Providers (when none connected) */}
      {connections.length === 0 && availableProviders.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Available Providers</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {availableProviders.slice(0, 4).map((provider) => (
              <div
                key={provider.id}
                className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-green-300 cursor-pointer transition-colors"
                onClick={() => {
                  setSelectedProvider(provider);
                  setShowConnectModal(true);
                }}
              >
                <h5 className="font-medium text-gray-900">{provider.name}</h5>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {provider.description}
                </p>
                <div className="mt-2 flex gap-2">
                  {provider.supportsDailyWorkouts && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      Daily
                    </span>
                  )}
                  {provider.supportsScheduledWorkouts && (
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                      Scheduled
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedProvider
                  ? `Connect to ${selectedProvider.name}`
                  : "Connect Provider"}
              </h3>
              <button
                onClick={() => {
                  setShowConnectModal(false);
                  setSelectedProvider(null);
                  setError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!selectedProvider ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {availableProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-green-300 cursor-pointer transition-colors"
                    onClick={() => setSelectedProvider(provider)}
                  >
                    <h4 className="font-medium text-gray-900">{provider.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{provider.description}</p>
                  </div>
                ))}
                {availableProviders.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No providers available to connect
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{selectedProvider.description}</p>
                  {selectedProvider.websiteUrl && (
                    <a
                      href={selectedProvider.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Visit website
                    </a>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Groups
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Select which groups should receive workouts from this provider
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {groups.map((group) => (
                      <label key={group.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={connectTargetGroups.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConnectTargetGroups([...connectTargetGroups, group.id]);
                            } else {
                              setConnectTargetGroups(
                                connectTargetGroups.filter((id) => id !== group.id)
                              );
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{group.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={connectAutoPublish}
                      onChange={(e) => setConnectAutoPublish(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      Auto-publish workouts when received
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={connectHideDetails}
                      onChange={(e) => setConnectHideDetails(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      Hide workout details by default (use group reveal settings)
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setSelectedProvider(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {connecting ? "Connecting..." : "Connect"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
