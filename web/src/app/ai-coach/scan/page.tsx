"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { Gym, WorkoutGroup, ScheduledTimeSlot, WorkoutComponentType, workoutComponentLabels, workoutComponentColors, formatTimeSlot } from "@/lib/types";
import Navigation from "@/components/Navigation";

interface GeneratedWorkout {
  id: string;
  title: string;
  type: WorkoutComponentType;
  description: string;
  notes?: string;
}

const COMPONENT_TYPES: WorkoutComponentType[] = ["warmup", "lift", "wod", "skill", "cooldown"];

export default function AIScanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scannedImages, setScannedImages] = useState<string[]>([]); // Track all scanned images
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);

  // Gym/coach state
  const [userGym, setUserGym] = useState<Gym | null>(null);
  const [gymGroups, setGymGroups] = useState<WorkoutGroup[]>([]);
  const [loadingGym, setLoadingGym] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Check if user has coach/owner role OR is associated with a gym as staff
  // userGym being set means they're either gym owner or in coachIds
  const isCoachByRole = user?.role === "coach" || user?.role === "owner";
  const canPublishToGym = isCoachByRole || !!userGym;

  // Check subscription - gym staff use aiProgrammingSubscription, athletes use aiTrainerSubscription
  const relevantSubscription = canPublishToGym
    ? user?.aiProgrammingSubscription
    : user?.aiTrainerSubscription;
  const hasSubscription = relevantSubscription?.status === "active" ||
    relevantSubscription?.status === "trialing";

  // Fetch user's gym if they're a coach
  useEffect(() => {
    const fetchUserGym = async () => {
      if (!user) {
        setLoadingGym(false);
        return;
      }

      try {
        // Check if user is owner of any gym
        let gymDoc = null;
        const ownerQuery = query(collection(db, "gyms"), where("ownerId", "==", user.id));
        const ownerSnapshot = await getDocs(ownerQuery);
        if (!ownerSnapshot.empty) {
          gymDoc = { id: ownerSnapshot.docs[0].id, ...ownerSnapshot.docs[0].data() } as Gym;
        }

        // Check if user is a coach of any gym
        if (!gymDoc) {
          const coachQuery = query(collection(db, "gyms"), where("coachIds", "array-contains", user.id));
          const coachSnapshot = await getDocs(coachQuery);
          if (!coachSnapshot.empty) {
            gymDoc = { id: coachSnapshot.docs[0].id, ...coachSnapshot.docs[0].data() } as Gym;
          }
        }

        if (gymDoc) {
          setUserGym(gymDoc);
          // Fetch groups for this gym
          const groupsQuery = query(collection(db, "groups"), where("gymId", "==", gymDoc.id));
          const groupsSnapshot = await getDocs(groupsQuery);
          const groups = groupsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as WorkoutGroup[];
          setGymGroups(groups);
          // Select all groups by default
          setSelectedGroupIds(groups.map(g => g.id));
        }
      } catch (err) {
        console.error("Error fetching user gym:", err);
      }

      setLoadingGym(false);
    };

    fetchUserGym();
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        // Don't clear workouts - allow accumulating from multiple scans
        setRawResponse(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
    }
  };

  const handleGallerySelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.click();
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
      if (!apiKey) {
        setError("AI service not configured. Please add NEXT_PUBLIC_XAI_API_KEY to your environment.");
        setIsAnalyzing(false);
        return;
      }

      const prompt = `You are a CrossFit coach analyzing a handwritten workout or programming notes.

Look at this image and extract any workout programming you can see. Classify each component into ONE of these types:
- "warmup" - Warm-up exercises, mobility, activation
- "lift" - Strength work (squats, deadlifts, presses, Olympic lifts, etc.)
- "wod" - WOD/Metcon (AMRAP, EMOM, For Time, conditioning pieces)
- "skill" - Skill work (gymnastics movements, technique practice, drills)
- "cooldown" - Cool-down, stretching, recovery

For each workout or component you identify, provide:
1. A title/name for the workout
2. The type (MUST be one of: warmup, lift, wod, skill, cooldown)
3. A clear, formatted description of the workout
4. Any additional notes (scaling options, intended stimulus, etc.)

Format your response as JSON array like this:
[
  {
    "title": "Back Squat",
    "type": "lift",
    "description": "5x5 Back Squat @ 75%",
    "notes": "Rest 2-3 min between sets"
  },
  {
    "title": "Fran",
    "type": "wod",
    "description": "21-15-9\\nThrusters (95/65)\\nPull-ups",
    "notes": "For Time. Scale to jumping pull-ups if needed."
  }
]

If you cannot read the handwriting or the image doesn't contain workout programming, respond with an empty array [] and explain the issue.

IMPORTANT:
- Only respond with valid JSON. No additional text before or after the JSON.
- The "type" field MUST be exactly one of: warmup, lift, wod, skill, cooldown (lowercase)`;

      // Call xAI/Grok Vision API
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "grok-4-latest",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: selectedImage } }
              ]
            }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";

      if (!text) {
        throw new Error("No response from AI");
      }
      setRawResponse(text);

      // Try to parse JSON from response
      try {
        // Clean up the response - remove markdown code blocks if present
        let cleanedText = text.trim();
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.slice(7);
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith("```")) {
          cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();

        const parsed = JSON.parse(cleanedText);
        if (Array.isArray(parsed)) {
          // Map type to valid WorkoutComponentType and add IDs
          const mappedWorkouts: GeneratedWorkout[] = parsed.map((w, idx) => {
            const typeLower = (w.type || "wod").toLowerCase();
            let mappedType: WorkoutComponentType = "wod";
            if (typeLower.includes("warmup") || typeLower.includes("warm")) mappedType = "warmup";
            else if (typeLower.includes("lift") || typeLower.includes("strength")) mappedType = "lift";
            else if (typeLower.includes("skill") || typeLower.includes("gymnastics")) mappedType = "skill";
            else if (typeLower.includes("cooldown") || typeLower.includes("cool")) mappedType = "cooldown";
            else if (typeLower.includes("wod") || typeLower.includes("metcon") || typeLower.includes("conditioning")) mappedType = "wod";

            return {
              id: `workout_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
              title: w.title || "Untitled",
              type: mappedType,
              description: w.description || "",
              notes: w.notes || "",
            };
          });

          // Append to existing workouts (for multi-image scanning)
          setGeneratedWorkouts(prev => [...prev, ...mappedWorkouts]);

          // Track the scanned image
          setScannedImages(prev => [...prev, selectedImage]);

          if (mappedWorkouts.length === 0) {
            setError("Could not identify any workouts in the image. Try a clearer photo of your programming notes.");
          }
        } else {
          setError("Unexpected response format from AI.");
        }
      } catch {
        // If JSON parsing fails, show the raw response
        setError("Could not parse the workout data. See raw AI response below.");
      }
    } catch (err) {
      console.error("Error analyzing image:", err);
      setError("Failed to analyze image. Please try again.");
    }

    setIsAnalyzing(false);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setRawResponse(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearAll = () => {
    setSelectedImage(null);
    setScannedImages([]);
    setGeneratedWorkouts([]);
    setRawResponse(null);
    setError(null);
    setSaveSuccess(null);
    setShowDatePicker(false);
    setEditingWorkoutId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Update a workout field
  const updateWorkout = (workoutId: string, field: keyof GeneratedWorkout, value: string) => {
    setGeneratedWorkouts(prev => prev.map(w =>
      w.id === workoutId ? { ...w, [field]: value } : w
    ));
  };

  // Update workout type
  const updateWorkoutType = (workoutId: string, type: WorkoutComponentType) => {
    setGeneratedWorkouts(prev => prev.map(w =>
      w.id === workoutId ? { ...w, type } : w
    ));
  };

  // Remove a workout
  const removeWorkout = (workoutId: string) => {
    setGeneratedWorkouts(prev => prev.filter(w => w.id !== workoutId));
  };

  // Reorder workouts (move up/down)
  const moveWorkout = (workoutId: string, direction: "up" | "down") => {
    setGeneratedWorkouts(prev => {
      const index = prev.findIndex(w => w.id === workoutId);
      if (index === -1) return prev;
      if (direction === "up" && index === 0) return prev;
      if (direction === "down" && index === prev.length - 1) return prev;

      const newList = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
      return newList;
    });
  };

  // Save to gym programming
  const handleSaveToGym = async () => {
    if (!user || !userGym || generatedWorkouts.length === 0) return;

    setIsSaving(true);
    setSaveSuccess(null);

    try {
      // Parse the selected date as local time
      const [year, month, day] = selectedDate.split("-").map(Number);
      const workoutDate = new Date(year, month - 1, day, 12, 0, 0, 0);

      // Create workout components from generated workouts (type is already WorkoutComponentType)
      const components = generatedWorkouts.map((w, idx) => ({
        id: `comp_${Date.now()}_${idx}`,
        type: w.type,
        title: w.title,
        description: w.description,
        notes: w.notes || "",
        order: idx,
      }));

      // Generate time slots from selected groups' default time slots
      const groupsToUse = selectedGroupIds.length > 0
        ? gymGroups.filter(g => selectedGroupIds.includes(g.id))
        : gymGroups;

      const timeSlots: ScheduledTimeSlot[] = [];
      const seenTimes = new Set<string>();

      groupsToUse.forEach((group) => {
        if (group.defaultTimeSlots?.length > 0) {
          group.defaultTimeSlots.forEach((slot: { hour: number; minute: number; capacity?: number }) => {
            const hour = typeof slot.hour === 'number' ? slot.hour : parseInt(slot.hour as unknown as string) || 0;
            const minute = typeof slot.minute === 'number' ? slot.minute : parseInt(slot.minute as unknown as string) || 0;
            const timeKey = `${hour}:${minute}`;
            if (!seenTimes.has(timeKey)) {
              seenTimes.add(timeKey);
              timeSlots.push({
                id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                hour: hour,
                minute: minute,
                capacity: slot.capacity || 20,
                signups: [],
              });
            }
          });
        }
      });

      // Sort time slots by time
      timeSlots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

      // Generate workout title and description from components
      const wodTitle = generatedWorkouts.length === 1
        ? generatedWorkouts[0].title
        : `${generatedWorkouts.length} Components`;
      const wodDescription = generatedWorkouts.map(w => w.title).join(", ");

      // Create the scheduled workout
      const scheduledWorkout = {
        gymId: userGym.id,
        groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : gymGroups.map(g => g.id),
        date: Timestamp.fromDate(workoutDate),
        wodTitle,
        wodDescription,
        workoutType: "wod",
        recurrenceType: "none",
        hideDetails: false,
        components,
        createdAt: Timestamp.now(),
        createdBy: user.id,
        timeSlots,
      };

      await addDoc(collection(db, "scheduledWorkouts"), scheduledWorkout);

      const selectedGroupNames = gymGroups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name)
        .join(", ");

      setSaveSuccess(`Published to ${selectedGroupNames || "all groups"} for ${workoutDate.toLocaleDateString()}`);
      setShowDatePicker(false);
    } catch (err) {
      console.error("Error saving to gym:", err);
      setError("Failed to save workouts. Please try again.");
    }

    setIsSaving(false);
  };

  // Save to personal workouts
  const handleSaveToPersonal = async (overrideDate?: string) => {
    if (!user || generatedWorkouts.length === 0) return;

    setIsSaving(true);
    setSaveSuccess(null);

    try {
      // Use override date if provided, otherwise use selected date
      const dateToUse = overrideDate || selectedDate;
      // Parse the date as local time
      const [year, month, day] = dateToUse.split("-").map(Number);
      const workoutDate = new Date(year, month - 1, day, 12, 0, 0, 0);

      // Create workout components from generated workouts (type is already WorkoutComponentType)
      const components = generatedWorkouts.map((w, idx) => ({
        id: `comp_${Date.now()}_${idx}`,
        type: w.type,
        title: w.title,
        description: w.description,
        notes: w.notes || "",
        order: idx,
      }));

      // Create a personal workout in the personalWorkouts collection
      const personalWorkout = {
        userId: user.id,
        date: Timestamp.fromDate(workoutDate),
        dateString: dateToUse, // YYYY-MM-DD format for reliable date comparison
        components,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "personalWorkouts"), personalWorkout);

      setSaveSuccess(`Saved ${generatedWorkouts.length} workout${generatedWorkouts.length > 1 ? "s" : ""} to your personal calendar for ${workoutDate.toLocaleDateString()}`);
      setShowDatePicker(false);
      setIsSaving(false);

      // Redirect to weekly page after a short delay to see the workout
      setTimeout(() => {
        window.location.href = "/weekly";
      }, 1500);
      return;
    } catch (err) {
      console.error("Error saving personal workout:", err);
      setError("Failed to save workouts. Please try again.");
    }

    setIsSaving(false);
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!hasSubscription) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {canPublishToGym ? "AI Programming Feature" : "AI Coach Feature"}
            </h2>
            <p className="text-gray-600 mb-4">
              {canPublishToGym
                ? "Photo scanning is available for AI Programming subscribers."
                : "Photo scanning is available for AI Coach subscribers."}
            </p>
            <button
              onClick={() => router.push(canPublishToGym ? "/subscribe?variant=coach" : "/subscribe")}
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              {canPublishToGym ? "Subscribe to AI Programming" : "Subscribe to AI Coach"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Scan Programming</h1>
          <p className="text-gray-600 text-sm mt-1">
            Take a photo of your handwritten workout notes and let AI convert them to structured programming
          </p>
        </div>

        {/* Image Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!selectedImage ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">
                Capture your handwritten programming
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCameraCapture}
                  className="w-full py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Take Photo
                </button>
                <button
                  onClick={handleGallerySelect}
                  className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose from Gallery
                </button>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Tips for best results:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Use good lighting to capture your notes</li>
                <li>• Keep handwriting clear and legible</li>
                <li>• Include workout details like reps, weights, time</li>
                <li>• Works with whiteboard photos too!</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Selected workout notes"
                  className="w-full rounded-lg"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Analyze Button - show if no error and image not yet analyzed */}
              {!error && !scannedImages.includes(selectedImage) && (
                <button
                  onClick={analyzeImage}
                  disabled={isAnalyzing}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing your notes...
                    </>
                  ) : generatedWorkouts.length > 0 ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add to Workout Card
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Analyze with AI
                    </>
                  )}
                </button>
              )}

              {/* Already analyzed indicator */}
              {scannedImages.includes(selectedImage) && (
                <div className="mt-4 py-2 px-4 bg-green-50 text-green-700 text-sm font-medium rounded-lg flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Already scanned - components added below
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-700 text-sm">{error}</p>
                {rawResponse && (
                  <div className="mt-3 p-3 bg-white rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Raw AI Response:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{rawResponse}</p>
                  </div>
                )}
                <button
                  onClick={analyzeImage}
                  disabled={isAnalyzing}
                  className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Generated Workouts */}
            {generatedWorkouts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">
                    {generatedWorkouts.length} Component{generatedWorkouts.length !== 1 ? "s" : ""}
                  </h2>
                  <div className="flex items-center gap-2">
                    {scannedImages.length > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {scannedImages.length} scan{scannedImages.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {generatedWorkouts.map((workout, index) => (
                  <div
                    key={workout.id}
                    className={`bg-white rounded-xl shadow-sm border-2 p-4 transition-colors ${
                      editingWorkoutId === workout.id ? "border-purple-400" : "border-gray-200"
                    }`}
                  >
                    {/* Header with type badge, edit/delete buttons */}
                    <div className="flex items-center justify-between mb-3">
                      {/* Type selector */}
                      <div className="flex flex-wrap gap-1">
                        {COMPONENT_TYPES.map((type) => (
                          <button
                            key={type}
                            onClick={() => updateWorkoutType(workout.id, type)}
                            className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                              workout.type === type
                                ? `${workoutComponentColors[type]?.bg || "bg-gray-100"} ${workoutComponentColors[type]?.text || "text-gray-700"}`
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {workoutComponentLabels[type]}
                          </button>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {/* Move up */}
                        <button
                          onClick={() => moveWorkout(workout.id, "up")}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        {/* Move down */}
                        <button
                          onClick={() => moveWorkout(workout.id, "down")}
                          disabled={index === generatedWorkouts.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {/* Edit toggle */}
                        <button
                          onClick={() => setEditingWorkoutId(editingWorkoutId === workout.id ? null : workout.id)}
                          className={`p-1 rounded transition-colors ${
                            editingWorkoutId === workout.id
                              ? "text-purple-600 bg-purple-50"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => removeWorkout(workout.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Content - editable or display mode */}
                    {editingWorkoutId === workout.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={workout.title}
                          onChange={(e) => updateWorkout(workout.id, "title", e.target.value)}
                          placeholder="Title"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <textarea
                          value={workout.description}
                          onChange={(e) => updateWorkout(workout.id, "description", e.target.value)}
                          placeholder="Description"
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <textarea
                          value={workout.notes || ""}
                          onChange={(e) => updateWorkout(workout.id, "notes", e.target.value)}
                          placeholder="Notes (scaling options, coach notes, etc.)"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-bold text-gray-900 mb-2">{workout.title}</h3>
                        <p className="text-gray-700 text-sm whitespace-pre-line">
                          {workout.description}
                        </p>
                        {workout.notes && (
                          <div className="mt-3 p-2 bg-amber-50 rounded-lg border-l-2 border-amber-300">
                            <p className="text-sm text-amber-800">
                              <span className="font-medium">Notes:</span> {workout.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Success Message */}
                {saveSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-green-700 text-sm">{saveSuccess}</p>
                  </div>
                )}

                {/* Date/Group Picker for Saving (Coach flow) */}
                {showDatePicker && !saveSuccess && userGym && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4">
                    <h3 className="font-semibold text-purple-900">Publish to {userGym.name}</h3>

                    {/* Date Selection */}
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Group Selection for Gym */}
                    {gymGroups.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-purple-800 mb-2">
                          Publish to Groups
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedGroupIds(gymGroups.map(g => g.id))}
                            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                              selectedGroupIds.length === gymGroups.length
                                ? "bg-purple-600 text-white"
                                : "bg-white text-purple-600 border border-purple-300"
                            }`}
                          >
                            All Groups
                          </button>
                          {gymGroups.map((group) => (
                            <button
                              key={group.id}
                              type="button"
                              onClick={() => toggleGroupSelection(group.id)}
                              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                                selectedGroupIds.includes(group.id)
                                  ? "bg-purple-600 text-white"
                                  : "bg-white text-purple-700 border border-purple-300"
                              }`}
                            >
                              {group.name}
                            </button>
                          ))}
                        </div>
                        {selectedGroupIds.length === 0 && (
                          <p className="text-xs text-red-600 mt-1">Select at least one group</p>
                        )}
                      </div>
                    )}

                    {/* Time Slots Preview */}
                    {selectedGroupIds.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-purple-800 mb-2">
                          Class Times (from selected groups)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const seenTimes = new Set<string>();
                            const slots: { hour: number; minute: number }[] = [];
                            gymGroups
                              .filter(g => selectedGroupIds.includes(g.id))
                              .forEach(group => {
                                group.defaultTimeSlots?.forEach(slot => {
                                  const timeKey = `${slot.hour}:${slot.minute}`;
                                  if (!seenTimes.has(timeKey)) {
                                    seenTimes.add(timeKey);
                                    slots.push({ hour: slot.hour, minute: slot.minute });
                                  }
                                });
                              });
                            slots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
                            if (slots.length === 0) {
                              return <span className="text-xs text-gray-500">No time slots configured for selected groups</span>;
                            }
                            return slots.map((slot, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs bg-white text-purple-700 border border-purple-200 rounded"
                              >
                                {formatTimeSlot(slot.hour, slot.minute)}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Publish Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="flex-1 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveToGym}
                        disabled={isSaving || selectedGroupIds.length === 0}
                        className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Publish to Calendar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Date Picker for Personal Workouts (Athlete flow) */}
                {showDatePicker && !saveSuccess && !userGym && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4">
                    <h3 className="font-semibold text-purple-900">Save to My Workouts</h3>

                    {/* Date Selection */}
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Save Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="flex-1 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveToPersonal()}
                        disabled={isSaving}
                        className="flex-1 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!showDatePicker && !saveSuccess && (
                  <div className="space-y-3">
                    {/* Coach/Staff: Publish to Gym Calendar */}
                    {userGym ? (
                      <button
                        onClick={() => setShowDatePicker(true)}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Publish to {userGym.name}
                      </button>
                    ) : (
                      /* Athlete: Friendly date options */
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            const today = new Date().toISOString().split("T")[0];
                            handleSaveToPersonal(today);
                          }}
                          disabled={isSaving}
                          className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          {isSaving ? "Saving..." : "Add to Today"}
                        </button>
                        <button
                          onClick={() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            handleSaveToPersonal(tomorrow.toISOString().split("T")[0]);
                          }}
                          disabled={isSaving}
                          className="w-full py-3 bg-purple-100 text-purple-700 font-bold rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Add to Tomorrow
                        </button>
                        <button
                          onClick={() => setShowDatePicker(true)}
                          className="w-full py-2.5 border border-purple-300 text-purple-700 font-medium rounded-lg hover:bg-purple-50 transition-colors"
                        >
                          Pick a Different Date
                        </button>
                      </div>
                    )}

                    {/* Secondary Actions */}
                    <div className="space-y-2">
                      {/* Scan Another Photo - adds to existing */}
                      <button
                        onClick={() => {
                          clearImage();
                          // File input will open
                        }}
                        className="w-full py-2.5 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Scan Another Photo (Add More)
                      </button>

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            const text = generatedWorkouts.map(w =>
                              `${w.title} (${workoutComponentLabels[w.type]})\n${w.description}${w.notes ? `\nNotes: ${w.notes}` : ""}`
                            ).join("\n\n");
                            navigator.clipboard.writeText(text);
                            alert("Workouts copied to clipboard!");
                          }}
                          className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          Copy
                        </button>
                        <button
                          onClick={clearAll}
                          className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Start Over
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
