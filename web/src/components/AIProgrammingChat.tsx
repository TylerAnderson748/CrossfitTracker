"use client";

import { useState, useRef, useEffect } from "react";
import { collection, addDoc, updateDoc, doc, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { AIProgrammingSession, AIChatMessage, AIGeneratedDay, WorkoutGroup, WorkoutComponent } from "@/lib/types";

interface AIProgrammingChatProps {
  gymId: string;
  userId: string;
  groups: WorkoutGroup[];
  onPublish?: () => void;
}

const SYSTEM_PROMPT = `You are a CrossFit programming assistant helping gym owners and coaches create workout programming.

When generating workouts, you MUST respond with valid JSON in this exact format:
{
  "message": "Your conversational response here explaining the program",
  "workouts": [
    {
      "date": "2024-01-15",
      "dayOfWeek": "Monday",
      "isRestDay": false,
      "components": [
        {
          "type": "warmup",
          "title": "General Warm-up",
          "description": "3 rounds:\\n10 air squats\\n10 push-ups\\n200m run"
        },
        {
          "type": "lift",
          "title": "Back Squat",
          "description": "5x5 @ 75% 1RM\\nRest 2-3 min between sets"
        },
        {
          "type": "wod",
          "title": "Fran",
          "description": "21-15-9\\nThrusters (95/65)\\nPull-ups",
          "scoringType": "fortime"
        }
      ]
    },
    {
      "date": "2024-01-16",
      "dayOfWeek": "Tuesday",
      "isRestDay": true,
      "components": []
    }
  ]
}

Component types: "warmup", "lift", "wod", "skill", "cooldown"
Scoring types for WODs: "fortime", "amrap", "emom"

Guidelines:
- Create varied, balanced programming
- Include proper warm-ups and skill work
- Program appropriate rest days (typically 2 per week)
- Scale difficulty based on the gym's level
- Use standard CrossFit movements and terminology
- Keep descriptions clear and concise
- Use newlines (\\n) for formatting within descriptions

If the user is just chatting or asking questions (not requesting workouts), respond with just:
{
  "message": "Your response here",
  "workouts": []
}

IMPORTANT: Always respond with valid JSON only. No markdown, no code blocks, just pure JSON.`;

export default function AIProgrammingChat({ gymId, userId, groups, onPublish }: AIProgrammingChatProps) {
  const [sessions, setSessions] = useState<AIProgrammingSession[]>([]);
  const [activeSession, setActiveSession] = useState<AIProgrammingSession | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  // Load existing sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessionsQuery = query(
          collection(db, "aiProgrammingSessions"),
          where("gymId", "==", gymId),
          orderBy("updatedAt", "desc")
        );
        const snapshot = await getDocs(sessionsQuery);
        const loadedSessions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AIProgrammingSession[];
        setSessions(loadedSessions);

        // Auto-select first active session
        const activeOne = loadedSessions.find(s => s.status === "active");
        if (activeOne) {
          setActiveSession(activeOne);
        }
      } catch (err) {
        console.error("Error loading sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    loadSessions();
  }, [gymId]);

  const createNewSession = async () => {
    const newSession: Omit<AIProgrammingSession, "id"> = {
      gymId,
      createdBy: userId,
      title: `Program ${new Date().toLocaleDateString()}`,
      status: "active",
      messages: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, "aiProgrammingSessions"), newSession);
      const session = { id: docRef.id, ...newSession };
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
    } catch (err) {
      console.error("Error creating session:", err);
      setError("Failed to create new session");
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || isLoading) return;

    const userMessage: AIChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Timestamp.now(),
    };

    // Add user message to UI immediately
    const updatedMessages = [...activeSession.messages, userMessage];
    setActiveSession(prev => prev ? { ...prev, messages: updatedMessages } : null);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Initialize Google AI
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key not configured. Add NEXT_PUBLIC_GEMINI_API_KEY to your environment.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Build conversation history for context
      const conversationHistory = updatedMessages.map(msg =>
        `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      ).join("\n\n");

      const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${conversationHistory}\n\nRespond to the user's latest message. Remember to output valid JSON only.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse the JSON response
      let parsedResponse: { message: string; workouts: AIGeneratedDay[] };
      try {
        // Clean up the response - remove any markdown code blocks if present
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

        parsedResponse = JSON.parse(cleanedText);
      } catch {
        // If JSON parsing fails, treat as plain message
        parsedResponse = {
          message: text,
          workouts: []
        };
      }

      const assistantMessage: AIChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: parsedResponse.message,
        timestamp: Timestamp.now(),
      };

      // Only add generatedWorkouts if there are workouts
      if (parsedResponse.workouts && parsedResponse.workouts.length > 0) {
        assistantMessage.generatedWorkouts = parsedResponse.workouts;
      }

      const finalMessages = [...updatedMessages, assistantMessage];

      // Prepare update data - filter out any undefined values
      const updateData: Record<string, unknown> = {
        messages: finalMessages,
        updatedAt: Timestamp.now(),
      };

      if (parsedResponse.workouts && parsedResponse.workouts.length > 0) {
        updateData.programWeeks = Math.ceil(parsedResponse.workouts.length / 7);
      }

      // Update session in Firestore
      await updateDoc(doc(db, "aiProgrammingSessions", activeSession.id), updateData);

      setActiveSession(prev => prev ? { ...prev, messages: finalMessages } : null);
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to get AI response. Make sure Vertex AI API is enabled.");
    } finally {
      setIsLoading(false);
    }
  };

  const getAllGeneratedWorkouts = (): AIGeneratedDay[] => {
    if (!activeSession) return [];

    // Get the most recent message with workouts
    for (let i = activeSession.messages.length - 1; i >= 0; i--) {
      const msg = activeSession.messages[i];
      if (msg.generatedWorkouts && msg.generatedWorkouts.length > 0) {
        return msg.generatedWorkouts;
      }
    }
    return [];
  };

  const publishToCalendar = async () => {
    if (!activeSession || selectedGroups.length === 0) return;

    const workouts = getAllGeneratedWorkouts();
    if (workouts.length === 0) return;

    setIsPublishing(true);
    setError(null);

    try {
      // Create scheduled workouts for each day
      for (const day of workouts) {
        if (day.isRestDay) continue;

        const components: WorkoutComponent[] = day.components.map((comp, idx) => {
          const component: WorkoutComponent = {
            id: `comp-${idx}`,
            type: comp.type,
            title: comp.title,
            description: comp.description,
          };
          // Only add scoringType if it exists (typically for WODs)
          if (comp.scoringType) {
            component.scoringType = comp.scoringType;
          }
          return component;
        });

        const scheduledWorkout = {
          gymId,
          wodTitle: `${day.dayOfWeek} Programming`,
          wodDescription: components.map(c => c.title).join(", "),
          date: Timestamp.fromDate(new Date(day.date)),
          workoutType: "wod",
          groupIds: selectedGroups,
          createdBy: userId,
          recurrenceType: "none",
          components,
          hideDetails: false,
        };

        await addDoc(collection(db, "scheduledWorkouts"), scheduledWorkout);
      }

      // Update session status
      await updateDoc(doc(db, "aiProgrammingSessions", activeSession.id), {
        status: "published",
        targetGroupIds: selectedGroups,
        updatedAt: Timestamp.now(),
      });

      setActiveSession(prev => prev ? { ...prev, status: "published" } : null);
      setShowPreview(false);
      onPublish?.();
      alert("Programming published successfully!");
    } catch (err) {
      console.error("Error publishing:", err);
      setError("Failed to publish programming");
    } finally {
      setIsPublishing(false);
    }
  };

  const generatedWorkouts = getAllGeneratedWorkouts();

  if (loadingSessions) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Loading AI Programming...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-blue-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Programming Assistant</h2>
              <p className="text-white/80 text-sm">Generate months of workouts with AI</p>
            </div>
          </div>
          <button
            onClick={createNewSession}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Program
          </button>
        </div>
      </div>

      {/* Session Tabs */}
      {sessions.length > 0 && (
        <div className="flex gap-2 p-3 border-b border-gray-200 overflow-x-auto bg-gray-50">
          {sessions.slice(0, 5).map(session => (
            <button
              key={session.id}
              onClick={() => setActiveSession(session)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                activeSession?.id === session.id
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {session.title}
              {session.status === "published" && (
                <span className="ml-2 text-xs opacity-70">Published</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Chat Area */}
      {activeSession ? (
        <>
          <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {activeSession.messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Start Your Programming</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
                  Tell me about your gym and what kind of programming you need. For example:
                </p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>"Generate 4 weeks of CrossFit programming for intermediate athletes"</p>
                  <p>"Create a strength-focused program with Olympic lifting"</p>
                  <p>"I need 8 weeks of programming with 2 rest days per week"</p>
                </div>
              </div>
            ) : (
              activeSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === "user"
                        ? "bg-purple-600 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Show generated workouts preview */}
                    {message.generatedWorkouts && message.generatedWorkouts.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            Generated {message.generatedWorkouts.length} days of programming
                          </span>
                          <button
                            onClick={() => setShowPreview(true)}
                            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                          >
                            Preview & Publish
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {message.generatedWorkouts.slice(0, 14).map((day, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded text-center text-xs ${
                                day.isRestDay
                                  ? "bg-gray-100 text-gray-500"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {day.dayOfWeek.slice(0, 3)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Display */}
          {error && (
            <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Describe the programming you need..."
                disabled={isLoading || activeSession.status === "published"}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || activeSession.status === "published"}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "..." : "Send"}
              </button>
            </div>
            {activeSession.status === "published" && (
              <p className="text-sm text-gray-500 mt-2">
                This program has been published. Create a new program to continue.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Program</h3>
          <p className="text-gray-500 text-sm mb-4">
            Start a new AI-powered programming session
          </p>
          <button
            onClick={createNewSession}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create New Program
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && generatedWorkouts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Preview Programming</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedWorkouts.map((day, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-4 ${
                      day.isRestDay
                        ? "bg-gray-50 border-gray-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900">{day.dayOfWeek}</span>
                      <span className="text-sm text-gray-500">{day.date}</span>
                    </div>
                    {day.isRestDay ? (
                      <p className="text-gray-500 text-sm">Rest Day</p>
                    ) : (
                      <div className="space-y-2">
                        {day.components.map((comp, compIdx) => (
                          <div key={compIdx} className="text-sm">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${
                              comp.type === "warmup" ? "bg-yellow-100 text-yellow-700" :
                              comp.type === "wod" ? "bg-orange-100 text-orange-700" :
                              comp.type === "lift" ? "bg-purple-100 text-purple-700" :
                              comp.type === "skill" ? "bg-green-100 text-green-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                              {comp.type.toUpperCase()}
                            </span>
                            <p className="font-medium text-gray-900">{comp.title}</p>
                            <p className="text-gray-600 text-xs whitespace-pre-line">{comp.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Publish to Groups
                </label>
                <div className="flex flex-wrap gap-2">
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => {
                        setSelectedGroups(prev =>
                          prev.includes(group.id)
                            ? prev.filter(id => id !== group.id)
                            : [...prev, group.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedGroups.includes(group.id)
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={publishToCalendar}
                  disabled={selectedGroups.length === 0 || isPublishing}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPublishing ? "Publishing..." : `Publish ${generatedWorkouts.filter(d => !d.isRestDay).length} Workouts`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
