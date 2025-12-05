"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, updateDoc, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { GymApplication } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function GymApplicationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<GymApplication[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<GymApplication | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (!loading && user && user.role !== "superAdmin") {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "superAdmin") {
      fetchApplications();
    }
  }, [user]);

  const fetchApplications = async () => {
    try {
      const applicationsSnapshot = await getDocs(collection(db, "gymApplications"));
      const apps = applicationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GymApplication[];

      // Sort by submission date (newest first)
      apps.sort((a, b) => {
        const dateA = a.submittedAt?.toDate?.() || new Date(0);
        const dateB = b.submittedAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setApplications(apps);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleApprove = async (application: GymApplication) => {
    if (!user) return;

    setIsProcessing(true);
    try {
      // Create the gym
      const gymData = {
        name: application.gymName,
        ownerId: application.userId,
        coachIds: [],
        memberIds: [],
        createdAt: Timestamp.now(),
        address: application.gymAddress,
        city: application.gymCity,
        state: application.gymState,
        zip: application.gymZip,
        phone: application.gymPhone || null,
        website: application.gymWebsite || null,
        applicationId: application.id,
        isApproved: true,
        pricingEnabled: false,
      };

      const gymRef = await addDoc(collection(db, "gyms"), gymData);

      // Update the application status
      await updateDoc(doc(db, "gymApplications", application.id), {
        status: "approved",
        reviewedAt: Timestamp.now(),
        reviewedBy: user.id,
        approvedGymId: gymRef.id,
      });

      // Update the user's role to owner
      await updateDoc(doc(db, "users", application.userId), {
        role: "owner",
        gymId: gymRef.id,
      });

      // Refresh applications
      await fetchApplications();
      setShowReviewModal(false);
      setSelectedApplication(null);

      alert(`Gym "${application.gymName}" has been approved and created!`);
    } catch (error) {
      console.error("Error approving application:", error);
      alert("Failed to approve application. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (application: GymApplication) => {
    if (!user || !rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "gymApplications", application.id), {
        status: "rejected",
        reviewedAt: Timestamp.now(),
        reviewedBy: user.id,
        rejectionReason: rejectionReason.trim(),
      });

      // Refresh applications
      await fetchApplications();
      setShowReviewModal(false);
      setSelectedApplication(null);
      setRejectionReason("");

      alert(`Application for "${application.gymName}" has been rejected.`);
    } catch (error) {
      console.error("Error rejecting application:", error);
      alert("Failed to reject application. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (filter === "all") return true;
    return app.status === filter;
  });

  const pendingCount = applications.filter((app) => app.status === "pending").length;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (user.role !== "superAdmin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Access denied</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Gym Applications</h1>
          <p className="text-gray-500">Review and approve gym registration requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{applications.length}</div>
            <div className="text-gray-500 text-sm">Total Applications</div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
            <div className="text-yellow-600 text-sm">Pending Review</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-700">
              {applications.filter((app) => app.status === "approved").length}
            </div>
            <div className="text-green-600 text-sm">Approved</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="text-2xl font-bold text-red-700">
              {applications.filter((app) => app.status === "rejected").length}
            </div>
            <div className="text-red-600 text-sm">Rejected</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === f
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Applications List */}
        {loadingData ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading applications...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500">No {filter !== "all" ? filter : ""} applications found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((application) => (
              <div
                key={application.id}
                className="bg-white rounded-xl border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{application.gymName}</h3>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          application.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : application.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                      <div>
                        <span className="font-medium text-gray-700">Location:</span>{" "}
                        {application.gymAddress}, {application.gymCity}, {application.gymState} {application.gymZip}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Applicant:</span>{" "}
                        {application.userName} ({application.userEmail})
                      </div>
                      {application.gymPhone && (
                        <div>
                          <span className="font-medium text-gray-700">Phone:</span> {application.gymPhone}
                        </div>
                      )}
                      {application.gymWebsite && (
                        <div>
                          <span className="font-medium text-gray-700">Website:</span>{" "}
                          <a
                            href={application.gymWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {application.gymWebsite}
                          </a>
                        </div>
                      )}
                    </div>

                    {application.ownershipProof && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-gray-700">Ownership Proof:</span>
                        <p className="text-sm text-gray-600 mt-1">{application.ownershipProof}</p>
                      </div>
                    )}

                    {application.additionalNotes && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-gray-700">Notes:</span>
                        <p className="text-sm text-gray-600 mt-1">{application.additionalNotes}</p>
                      </div>
                    )}

                    {application.rejectionReason && (
                      <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <span className="text-sm font-medium text-red-700">Rejection Reason:</span>
                        <p className="text-sm text-red-600 mt-1">{application.rejectionReason}</p>
                      </div>
                    )}

                    <div className="text-xs text-gray-400 mt-3">
                      Submitted: {application.submittedAt?.toDate?.().toLocaleString() || "Unknown"}
                      {application.reviewedAt && (
                        <> | Reviewed: {application.reviewedAt?.toDate?.().toLocaleString()}</>
                      )}
                    </div>
                  </div>

                  {application.status === "pending" && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedApplication(application);
                          setShowReviewModal(true);
                        }}
                        className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
                      >
                        Review
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {showReviewModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Review Application</h2>
            <p className="text-gray-500 mb-6">
              Review the application for <strong>{selectedApplication.gymName}</strong>
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Gym:</span> {selectedApplication.gymName}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Location:</span>{" "}
                  {selectedApplication.gymCity}, {selectedApplication.gymState}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Applicant:</span>{" "}
                  {selectedApplication.userName}
                </div>
                {selectedApplication.gymWebsite && (
                  <div>
                    <span className="font-medium text-gray-700">Website:</span>{" "}
                    <a
                      href={selectedApplication.gymWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Verify on website
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (required if rejecting)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the application is being rejected..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedApplication(null);
                  setRejectionReason("");
                }}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedApplication)}
                disabled={isProcessing || !rejectionReason.trim()}
                className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Reject"}
              </button>
              <button
                onClick={() => handleApprove(selectedApplication)}
                disabled={isProcessing}
                className="flex-1 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
