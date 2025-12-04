"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";

interface GeneratedWorkout {
  title: string;
  type: string;
  description: string;
  notes?: string;
}

export default function AIScanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check subscription
  const hasSubscription = user?.aiTrainerSubscription?.status === "active" ||
    user?.aiTrainerSubscription?.status === "trialing";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setGeneratedWorkouts([]);
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
    setGeneratedWorkouts([]);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        setError("AI service not configured. Please contact support.");
        setIsAnalyzing(false);
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Extract base64 data from data URL
      const base64Data = selectedImage.split(",")[1];
      const mimeType = selectedImage.split(";")[0].split(":")[1];

      const prompt = `You are a CrossFit coach analyzing a handwritten workout or programming notes.

Look at this image and extract any workout programming you can see. This could include:
- WODs (Workout of the Day)
- Strength work (squats, deadlifts, presses, etc.)
- Skill work (gymnastics movements)
- Conditioning pieces
- EMOM, AMRAP, For Time workouts
- Any other CrossFit-style programming

For each workout or component you identify, provide:
1. A title/name for the workout
2. The type (WOD, Strength, Skill, Conditioning, Warmup, etc.)
3. A clear, formatted description of the workout
4. Any additional notes (scaling options, intended stimulus, etc.)

Format your response as JSON array like this:
[
  {
    "title": "Back Squat",
    "type": "Strength",
    "description": "5x5 Back Squat @ 75%",
    "notes": "Rest 2-3 min between sets"
  },
  {
    "title": "Fran",
    "type": "WOD",
    "description": "21-15-9\\nThrusters (95/65)\\nPull-ups",
    "notes": "For Time. Scale to jumping pull-ups if needed."
  }
]

If you cannot read the handwriting or the image doesn't contain workout programming, respond with an empty array [] and explain the issue.

IMPORTANT: Only respond with valid JSON. No additional text before or after the JSON.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
      ]);

      const response = result.response;
      const text = response.text();
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
          setGeneratedWorkouts(parsed);
          if (parsed.length === 0) {
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
    setGeneratedWorkouts([]);
    setRawResponse(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">AI Coach Feature</h2>
            <p className="text-gray-600 mb-4">
              Photo scanning is an AI Coach premium feature. Subscribe to unlock this and more!
            </p>
            <button
              onClick={() => router.push("/subscribe")}
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              Subscribe to AI Coach
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

              {/* Analyze Button */}
              {generatedWorkouts.length === 0 && !error && (
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
                    Found {generatedWorkouts.length} Workout{generatedWorkouts.length !== 1 ? "s" : ""}
                  </h2>
                  <button
                    onClick={clearImage}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    Scan Another
                  </button>
                </div>

                {generatedWorkouts.map((workout, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{workout.title}</h3>
                        <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full mt-1">
                          {workout.type}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-700 whitespace-pre-line mt-2">
                      {workout.description}
                    </p>
                    {workout.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Notes:</span> {workout.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Copy workouts to clipboard
                      const text = generatedWorkouts.map(w =>
                        `${w.title} (${w.type})\n${w.description}${w.notes ? `\nNotes: ${w.notes}` : ""}`
                      ).join("\n\n");
                      navigator.clipboard.writeText(text);
                      alert("Workouts copied to clipboard!");
                    }}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy All
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
