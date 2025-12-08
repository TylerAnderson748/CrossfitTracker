"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym } from "@/lib/types";
import Navigation from "@/components/Navigation";

export default function GymEditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gymId = params.id as string;

  const [gym, setGym] = useState<Gym | null>(null);
  const [loadingGym, setLoadingGym] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && gymId) {
      fetchGym();
    }
  }, [user, gymId]);

  const fetchGym = async () => {
    try {
      const gymDoc = await getDoc(doc(db, "gyms", gymId));
      if (gymDoc.exists()) {
        const gymData = { id: gymDoc.id, ...gymDoc.data() } as Gym;
        setGym(gymData);

        // Populate form fields
        setName(gymData.name || "");
        setAddress(gymData.address || "");
        setCity(gymData.city || "");
        setState(gymData.state || "");
        setZip(gymData.zip || "");
        setPhone(gymData.phone || "");
        setWebsite(gymData.website || "");
      }
    } catch (error) {
      console.error("Error fetching gym:", error);
    } finally {
      setLoadingGym(false);
    }
  };

  const handleSave = async () => {
    if (!gym || !user) return;

    if (!name.trim()) {
      alert("Gym name is required");
      return;
    }

    setIsSaving(true);
    try {
      const updateData: Record<string, string> = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
      };

      // Only include optional fields if they have values
      if (phone.trim()) {
        updateData.phone = phone.trim();
      }
      if (website.trim()) {
        updateData.website = website.trim();
      }

      await updateDoc(doc(db, "gyms", gymId), updateData);
      alert("Gym updated successfully!");
      router.push(`/gym/${gymId}`);
    } catch (error) {
      console.error("Error updating gym:", error);
      alert("Failed to update gym. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || loadingGym) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Gym not found</p>
      </div>
    );
  }

  const isOwner = user?.id === gym.ownerId;

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center">
            <p className="text-gray-500">Only the gym owner can edit gym details.</p>
            <button
              onClick={() => router.back()}
              className="mt-4 text-blue-600 hover:underline"
            >
              Go back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            <span>←</span> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Gym</h1>
          <p className="text-gray-500">Update your gym&apos;s information</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {/* Gym Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gym Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter gym name"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="123 Main St"
            />
          </div>

          {/* City, State, Zip */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="City"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="State"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="12345"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://www.yourgym.com"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </main>
    </div>
  );
}
