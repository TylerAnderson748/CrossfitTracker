"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Types for family features
interface FamilyEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  color: string;
  createdBy: string;
  createdAt: Timestamp;
}

interface FamilyTodo {
  id: string;
  text: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: string;
  priority: "low" | "medium" | "high";
  createdBy: string;
  createdAt: Timestamp;
}

interface FamilyAnnouncement {
  id: string;
  title: string;
  message: string;
  icon: string;
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp;
}

const familyMembers = [
  { name: "Mom", emoji: "👩", color: "pink" },
  { name: "Dad", emoji: "👨", color: "blue" },
  { name: "Kids", emoji: "👧👦", color: "green" },
  { name: "Everyone", emoji: "👨‍👩‍👧‍👦", color: "purple" },
];

const eventColors = [
  { name: "Blue", value: "bg-blue-500" },
  { name: "Green", value: "bg-green-500" },
  { name: "Purple", value: "bg-purple-500" },
  { name: "Pink", value: "bg-pink-500" },
  { name: "Orange", value: "bg-orange-500" },
  { name: "Yellow", value: "bg-yellow-500" },
];

const announcementIcons = ["📢", "🎉", "⚠️", "💡", "❤️", "🎁", "🏠", "🚗", "🍕", "📅"];

export default function FamilyPage() {
  const { user, loading, switching } = useAuth();
  const router = useRouter();

  // Active tab state
  const [activeTab, setActiveTab] = useState<"hub" | "calendar" | "todos" | "fun" | "announcements">("hub");

  // Calendar state
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", date: "", time: "", description: "", color: "bg-blue-500" });

  // Todo state
  const [todos, setTodos] = useState<FamilyTodo[]>([]);
  const [newTodo, setNewTodo] = useState({ text: "", assignedTo: "", dueDate: "", priority: "medium" as const });

  // Announcements state
  const [announcements, setAnnouncements] = useState<FamilyAnnouncement[]>([]);
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", message: "", icon: "📢" });

  // Fun zone state
  const [showConfetti, setShowConfetti] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Auth check
  useEffect(() => {
    if (!loading && !switching && !user) {
      router.push("/login");
    }
  }, [user, loading, switching, router]);

  // Load events from Firestore
  useEffect(() => {
    if (!user) return;

    const eventsQuery = query(collection(db, "familyEvents"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FamilyEvent[];
      setEvents(eventsList);
    });

    return () => unsubscribe();
  }, [user]);

  // Load todos from Firestore
  useEffect(() => {
    if (!user) return;

    const todosQuery = query(collection(db, "familyTodos"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(todosQuery, (snapshot) => {
      const todosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FamilyTodo[];
      setTodos(todosList);
    });

    return () => unsubscribe();
  }, [user]);

  // Load announcements from Firestore
  useEffect(() => {
    if (!user) return;

    const announcementsQuery = query(collection(db, "familyAnnouncements"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      const announcementsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FamilyAnnouncement[];
      setAnnouncements(announcementsList);
    });

    return () => unsubscribe();
  }, [user]);

  // Sound effects
  const playSuccessSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.2);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.2);
    });
  };

  // Event handlers
  const addEvent = async () => {
    if (!newEvent.title || !newEvent.date || !user) return;

    await addDoc(collection(db, "familyEvents"), {
      ...newEvent,
      createdBy: user.id,
      createdAt: Timestamp.now(),
    });

    setNewEvent({ title: "", date: "", time: "", description: "", color: "bg-blue-500" });
    setShowAddEvent(false);
    playSuccessSound();
    triggerConfetti();
  };

  const deleteEvent = async (eventId: string) => {
    await deleteDoc(doc(db, "familyEvents", eventId));
  };

  const addTodo = async () => {
    if (!newTodo.text || !user) return;

    await addDoc(collection(db, "familyTodos"), {
      text: newTodo.text,
      completed: false,
      assignedTo: newTodo.assignedTo || "Everyone",
      dueDate: newTodo.dueDate,
      priority: newTodo.priority,
      createdBy: user.id,
      createdAt: Timestamp.now(),
    });

    setNewTodo({ text: "", assignedTo: "", dueDate: "", priority: "medium" });
    playSuccessSound();
  };

  const toggleTodo = async (todo: FamilyTodo) => {
    await updateDoc(doc(db, "familyTodos", todo.id), {
      completed: !todo.completed,
    });
    if (!todo.completed) {
      playSuccessSound();
      triggerConfetti();
    }
  };

  const deleteTodo = async (todoId: string) => {
    await deleteDoc(doc(db, "familyTodos", todoId));
  };

  const addAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.message || !user) return;

    await addDoc(collection(db, "familyAnnouncements"), {
      ...newAnnouncement,
      createdBy: user.id,
      createdByName: user.displayName || user.firstName || "Family Member",
      createdAt: Timestamp.now(),
    });

    setNewAnnouncement({ title: "", message: "", icon: "📢" });
    setShowAddAnnouncement(false);
    playSuccessSound();
    triggerConfetti();
  };

  const deleteAnnouncement = async (announcementId: string) => {
    await deleteDoc(doc(db, "familyAnnouncements", announcementId));
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  // Get upcoming events (next 7 days)
  const getUpcomingEvents = () => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= today && eventDate <= nextWeek;
    }).slice(0, 3);
  };

  // Get incomplete todos
  const getIncompleteTodos = () => {
    return todos.filter(todo => !todo.completed).slice(0, 5);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
        <p className="text-white font-bold text-2xl">👨‍👩‍👧‍👦 Loading Family Hub... 👨‍👩‍👧‍👦</p>
      </div>
    );
  }

  const tabs = [
    { id: "hub", label: "Home", icon: "🏠" },
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "todos", label: "To-Dos", icon: "✅" },
    { id: "announcements", label: "Board", icon: "📋" },
    { id: "fun", label: "Fun Zone", icon: "🎮" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pulse-soft {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-confetti { animation: confetti-fall 3s ease-out forwards; }
        .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
        .animate-wiggle { animation: wiggle 0.5s ease-in-out infinite; }
      `}</style>

      <Navigation />

      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da', '#fcbad3'][i % 7],
                animationDelay: `${Math.random() * 2}s`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
              }}
            />
          ))}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
            👨‍👩‍👧‍👦 Family Hub 👨‍👩‍👧‍👦
          </h1>
          <p className="text-gray-600 font-medium">Your family&apos;s command center!</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-6 overflow-x-auto">
          <div className="flex bg-white rounded-2xl p-2 shadow-lg gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* HUB TAB - Overview */}
        {activeTab === "hub" && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-lg text-center">
                <div className="text-3xl mb-2">📅</div>
                <div className="text-2xl font-black text-purple-600">{events.length}</div>
                <div className="text-gray-500 text-sm">Events</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-lg text-center">
                <div className="text-3xl mb-2">✅</div>
                <div className="text-2xl font-black text-green-600">{todos.filter(t => t.completed).length}/{todos.length}</div>
                <div className="text-gray-500 text-sm">Tasks Done</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-lg text-center">
                <div className="text-3xl mb-2">📢</div>
                <div className="text-2xl font-black text-pink-600">{announcements.length}</div>
                <div className="text-gray-500 text-sm">Announcements</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-lg text-center animate-pulse-soft">
                <div className="text-3xl mb-2">❤️</div>
                <div className="text-2xl font-black text-red-500">∞</div>
                <div className="text-gray-500 text-sm">Family Love</div>
              </div>
            </div>

            {/* Upcoming Events Preview */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-gray-800">📅 Coming Up</h2>
                <button
                  onClick={() => setActiveTab("calendar")}
                  className="text-purple-600 font-bold text-sm hover:underline"
                >
                  View All →
                </button>
              </div>
              {getUpcomingEvents().length > 0 ? (
                <div className="space-y-2">
                  {getUpcomingEvents().map((event) => (
                    <div key={event.id} className={`${event.color} text-white p-3 rounded-xl`}>
                      <div className="font-bold">{event.title}</div>
                      <div className="text-sm opacity-90">
                        {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {event.time && ` at ${event.time}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No upcoming events this week</p>
              )}
            </div>

            {/* To-Do Preview */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-gray-800">✅ To-Do List</h2>
                <button
                  onClick={() => setActiveTab("todos")}
                  className="text-purple-600 font-bold text-sm hover:underline"
                >
                  View All →
                </button>
              </div>
              {getIncompleteTodos().length > 0 ? (
                <div className="space-y-2">
                  {getIncompleteTodos().map((todo) => (
                    <div
                      key={todo.id}
                      onClick={() => toggleTodo(todo)}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        todo.priority === 'high' ? 'border-red-400' :
                        todo.priority === 'medium' ? 'border-yellow-400' : 'border-green-400'
                      }`}>
                        {todo.completed && <span className="text-green-500">✓</span>}
                      </div>
                      <span className={todo.completed ? "line-through text-gray-400" : "text-gray-700"}>
                        {todo.text}
                      </span>
                      {todo.assignedTo && (
                        <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
                          {todo.assignedTo}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">All tasks completed! 🎉</p>
              )}
            </div>

            {/* Latest Announcement */}
            {announcements.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl p-6 shadow-lg border-2 border-yellow-300">
                <div className="flex items-start gap-4">
                  <span className="text-4xl animate-wiggle">{announcements[0].icon}</span>
                  <div>
                    <h3 className="font-black text-gray-800">{announcements[0].title}</h3>
                    <p className="text-gray-600">{announcements[0].message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Posted by {announcements[0].createdByName} • {announcements[0].createdAt?.toDate?.().toLocaleDateString() || 'Recently'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CALENDAR TAB */}
        {activeTab === "calendar" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-gray-800">📅 Family Calendar</h2>
              <button
                onClick={() => setShowAddEvent(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-xl font-bold hover:shadow-lg transition-all"
              >
                + Add Event
              </button>
            </div>

            {/* Add Event Modal */}
            {showAddEvent && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-black mb-4">Add New Event</h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Event title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                    />
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                    />
                    <input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                      rows={2}
                    />
                    <div>
                      <label className="text-sm text-gray-500 mb-2 block">Color</label>
                      <div className="flex gap-2">
                        {eventColors.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setNewEvent({ ...newEvent, color: color.value })}
                            className={`w-8 h-8 rounded-full ${color.value} ${
                              newEvent.color === color.value ? 'ring-4 ring-purple-300' : ''
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowAddEvent(false)}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addEvent}
                      className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold"
                    >
                      Add Event
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Events List */}
            <div className="space-y-3">
              {events.length > 0 ? (
                events.map((event) => (
                  <div key={event.id} className={`${event.color} text-white p-4 rounded-2xl shadow-lg`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-lg">{event.title}</h3>
                        <p className="text-sm opacity-90">
                          {new Date(event.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                          {event.time && ` at ${event.time}`}
                        </p>
                        {event.description && (
                          <p className="text-sm mt-2 opacity-80">{event.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="text-white/70 hover:text-white text-xl"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl">
                  <div className="text-5xl mb-4">📅</div>
                  <p className="text-gray-500">No events yet. Add your first family event!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TODOS TAB */}
        {activeTab === "todos" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-800">✅ Family To-Do List</h2>

            {/* Add Todo Form */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={newTodo.text}
                  onChange={(e) => setNewTodo({ ...newTodo, text: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                  className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                />
                <select
                  value={newTodo.assignedTo}
                  onChange={(e) => setNewTodo({ ...newTodo, assignedTo: e.target.value })}
                  className="p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                >
                  <option value="">Assign to...</option>
                  {familyMembers.map((member) => (
                    <option key={member.name} value={member.name}>
                      {member.emoji} {member.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newTodo.priority}
                  onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as "low" | "medium" | "high" })}
                  className="p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
                <button
                  onClick={addTodo}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Todos List */}
            <div className="space-y-3">
              {todos.length > 0 ? (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`bg-white rounded-2xl p-4 shadow-lg flex items-center gap-4 transition-all ${
                      todo.completed ? 'opacity-60' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleTodo(todo)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        todo.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : todo.priority === 'high' ? 'border-red-400 hover:bg-red-50'
                          : todo.priority === 'medium' ? 'border-yellow-400 hover:bg-yellow-50'
                          : 'border-green-400 hover:bg-green-50'
                      }`}
                    >
                      {todo.completed && '✓'}
                    </button>
                    <div className="flex-1">
                      <span className={`font-medium ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {todo.text}
                      </span>
                      {todo.dueDate && (
                        <span className="ml-2 text-xs text-gray-400">
                          Due: {new Date(todo.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {todo.assignedTo && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-3 py-1 rounded-full font-medium">
                        {familyMembers.find(m => m.name === todo.assignedTo)?.emoji} {todo.assignedTo}
                      </span>
                    )}
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="text-gray-400 hover:text-red-500 text-xl"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl">
                  <div className="text-5xl mb-4">✅</div>
                  <p className="text-gray-500">No tasks yet. Add something to do!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === "announcements" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-gray-800">📋 Family Bulletin Board</h2>
              <button
                onClick={() => setShowAddAnnouncement(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-xl font-bold hover:shadow-lg transition-all"
              >
                + Post Announcement
              </button>
            </div>

            {/* Add Announcement Modal */}
            {showAddAnnouncement && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-black mb-4">Post Announcement</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500 mb-2 block">Choose an Icon</label>
                      <div className="flex flex-wrap gap-2">
                        {announcementIcons.map((icon) => (
                          <button
                            key={icon}
                            onClick={() => setNewAnnouncement({ ...newAnnouncement, icon })}
                            className={`text-2xl p-2 rounded-lg ${
                              newAnnouncement.icon === icon ? 'bg-purple-100 ring-2 ring-purple-500' : 'hover:bg-gray-100'
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Announcement title"
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                    />
                    <textarea
                      placeholder="Your message..."
                      value={newAnnouncement.message}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowAddAnnouncement(false)}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addAnnouncement}
                      className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Announcements List */}
            <div className="space-y-4">
              {announcements.length > 0 ? (
                announcements.map((announcement) => (
                  <div key={announcement.id} className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="flex items-start gap-4">
                      <span className="text-4xl animate-float">{announcement.icon}</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-black text-lg text-gray-800">{announcement.title}</h3>
                          <button
                            onClick={() => deleteAnnouncement(announcement.id)}
                            className="text-gray-400 hover:text-red-500 text-xl"
                          >
                            ×
                          </button>
                        </div>
                        <p className="text-gray-600 mt-1">{announcement.message}</p>
                        <p className="text-xs text-gray-400 mt-3">
                          Posted by {announcement.createdByName} • {announcement.createdAt?.toDate?.().toLocaleDateString() || 'Recently'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-gray-500">No announcements yet. Post something for the family!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FUN ZONE TAB */}
        {activeTab === "fun" && (
          <FunZone
            triggerConfetti={triggerConfetti}
            playSound={playSuccessSound}
          />
        )}
      </main>
    </div>
  );
}

// Fun Zone Component with games
function FunZone({ triggerConfetti, playSound }: { triggerConfetti: () => void; playSound: () => void }) {
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [memoryCards, setMemoryCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([]);
  const [memoryMoves, setMemoryMoves] = useState(0);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [diceResult, setDiceResult] = useState<number[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [triviaQuestion, setTriviaQuestion] = useState<{ question: string; options: string[]; answer: number } | null>(null);
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaAnswered, setTriviaAnswered] = useState(false);

  const familyActivities = [
    "🎬 Movie Night!",
    "🎲 Board Game Time!",
    "🍕 Pizza Party!",
    "🌳 Go to the Park!",
    "🎨 Arts & Crafts!",
    "🍪 Bake Cookies!",
    "🎮 Video Games!",
    "📚 Story Time!",
    "🚴 Bike Ride!",
    "🧹 Cleaning Time!",
    "🎉 Dance Party!",
    "🧩 Puzzle Time!",
  ];

  const triviaQuestions = [
    { question: "What color do you get when you mix blue and yellow?", options: ["Purple", "Green", "Orange", "Red"], answer: 1 },
    { question: "How many legs does a spider have?", options: ["6", "8", "10", "4"], answer: 1 },
    { question: "What is the largest planet in our solar system?", options: ["Mars", "Saturn", "Jupiter", "Neptune"], answer: 2 },
    { question: "What do caterpillars turn into?", options: ["Ladybugs", "Butterflies", "Bees", "Dragonflies"], answer: 1 },
    { question: "How many days are in a week?", options: ["5", "6", "7", "8"], answer: 2 },
    { question: "What is the fastest land animal?", options: ["Lion", "Cheetah", "Horse", "Tiger"], answer: 1 },
    { question: "Which fruit is known for keeping doctors away?", options: ["Banana", "Orange", "Apple", "Grape"], answer: 2 },
    { question: "What is the color of grass?", options: ["Blue", "Green", "Yellow", "Red"], answer: 1 },
  ];

  // Memory game setup
  const setupMemoryGame = () => {
    const emojis = ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐸", "🦁"];
    const cards = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
    setMemoryCards(cards);
    setMemoryMoves(0);
    setFlippedCards([]);
    setCurrentGame("memory");
  };

  // Handle memory card flip
  const flipCard = (id: number) => {
    if (flippedCards.length === 2) return;
    if (memoryCards[id].flipped || memoryCards[id].matched) return;

    const newCards = [...memoryCards];
    newCards[id].flipped = true;
    setMemoryCards(newCards);

    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMemoryMoves(m => m + 1);
      const [first, second] = newFlipped;
      if (newCards[first].emoji === newCards[second].emoji) {
        newCards[first].matched = true;
        newCards[second].matched = true;
        setMemoryCards(newCards);
        setFlippedCards([]);
        playSound();

        // Check if game is won
        if (newCards.every(c => c.matched)) {
          triggerConfetti();
        }
      } else {
        setTimeout(() => {
          const resetCards = [...newCards];
          resetCards[first].flipped = false;
          resetCards[second].flipped = false;
          setMemoryCards(resetCards);
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  // Dice roll
  const rollDice = () => {
    setSpinning(true);
    setDiceResult([]);

    setTimeout(() => {
      const results = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ];
      setDiceResult(results);
      setSpinning(false);
      playSound();
    }, 1000);
  };

  // Spin the wheel
  const spinWheel = () => {
    setSpinning(true);
    setWheelResult(null);

    setTimeout(() => {
      const result = familyActivities[Math.floor(Math.random() * familyActivities.length)];
      setWheelResult(result);
      setSpinning(false);
      playSound();
      triggerConfetti();
    }, 2000);
  };

  // Trivia game
  const startTrivia = () => {
    const question = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
    setTriviaQuestion(question);
    setTriviaAnswered(false);
    setCurrentGame("trivia");
  };

  const answerTrivia = (index: number) => {
    if (triviaAnswered || !triviaQuestion) return;
    setTriviaAnswered(true);
    if (index === triviaQuestion.answer) {
      setTriviaScore(s => s + 1);
      playSound();
      triggerConfetti();
    }
  };

  const diceEmojis = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-800 text-center">🎮 Family Fun Zone 🎮</h2>

      {/* Game Selection */}
      {!currentGame && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={setupMemoryGame}
            className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white p-6 rounded-2xl shadow-lg hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-2">🧠</div>
            <div className="font-bold">Memory Game</div>
          </button>
          <button
            onClick={() => setCurrentGame("dice")}
            className="bg-gradient-to-br from-green-500 to-teal-500 text-white p-6 rounded-2xl shadow-lg hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-2">🎲</div>
            <div className="font-bold">Roll Dice</div>
          </button>
          <button
            onClick={() => setCurrentGame("wheel")}
            className="bg-gradient-to-br from-pink-500 to-rose-500 text-white p-6 rounded-2xl shadow-lg hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-2">🎡</div>
            <div className="font-bold">Activity Wheel</div>
          </button>
          <button
            onClick={startTrivia}
            className="bg-gradient-to-br from-orange-500 to-amber-500 text-white p-6 rounded-2xl shadow-lg hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-2">❓</div>
            <div className="font-bold">Family Trivia</div>
          </button>
        </div>
      )}

      {/* Memory Game */}
      {currentGame === "memory" && (
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black">🧠 Memory Match</h3>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">Moves: {memoryMoves}</span>
              <button
                onClick={() => setCurrentGame(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {memoryCards.map((card) => (
              <button
                key={card.id}
                onClick={() => flipCard(card.id)}
                className={`h-16 md:h-20 rounded-xl text-3xl transition-all ${
                  card.flipped || card.matched
                    ? 'bg-white border-2 border-purple-300'
                    : 'bg-gradient-to-br from-purple-500 to-pink-500'
                } ${card.matched ? 'opacity-50' : 'hover:scale-105'}`}
              >
                {(card.flipped || card.matched) ? card.emoji : '?'}
              </button>
            ))}
          </div>
          {memoryCards.every(c => c.matched) && (
            <div className="text-center mt-4">
              <p className="text-2xl font-black text-green-500">🎉 You Won in {memoryMoves} moves! 🎉</p>
              <button
                onClick={setupMemoryGame}
                className="mt-2 bg-purple-500 text-white px-4 py-2 rounded-xl font-bold"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dice Game */}
      {currentGame === "dice" && (
        <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black">🎲 Roll the Dice</h3>
            <button
              onClick={() => setCurrentGame(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>
          <div className="flex justify-center gap-6 mb-6">
            {diceResult.length > 0 ? (
              diceResult.map((result, i) => (
                <div
                  key={i}
                  className="text-7xl animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {diceEmojis[result - 1]}
                </div>
              ))
            ) : (
              <>
                <div className={`text-7xl ${spinning ? 'animate-spin' : ''}`}>🎲</div>
                <div className={`text-7xl ${spinning ? 'animate-spin' : ''}`}>🎲</div>
              </>
            )}
          </div>
          {diceResult.length > 0 && (
            <p className="text-2xl font-bold text-purple-600 mb-4">
              Total: {diceResult[0] + diceResult[1]}
            </p>
          )}
          <button
            onClick={rollDice}
            disabled={spinning}
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-8 py-4 rounded-xl font-bold text-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            {spinning ? 'Rolling...' : 'Roll Dice!'}
          </button>
        </div>
      )}

      {/* Activity Wheel */}
      {currentGame === "wheel" && (
        <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black">🎡 What Should We Do?</h3>
            <button
              onClick={() => setCurrentGame(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>
          <div className={`text-8xl mb-6 ${spinning ? 'animate-spin' : ''}`}>
            🎡
          </div>
          {wheelResult && (
            <div className="bg-gradient-to-r from-pink-100 to-purple-100 p-6 rounded-2xl mb-4">
              <p className="text-3xl font-black text-purple-600">{wheelResult}</p>
            </div>
          )}
          <button
            onClick={spinWheel}
            disabled={spinning}
            className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-8 py-4 rounded-xl font-bold text-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            {spinning ? 'Spinning...' : 'Spin the Wheel!'}
          </button>
        </div>
      )}

      {/* Trivia Game */}
      {currentGame === "trivia" && triviaQuestion && (
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black">❓ Family Trivia</h3>
            <div className="flex items-center gap-4">
              <span className="text-orange-600 font-bold">Score: {triviaScore}</span>
              <button
                onClick={() => setCurrentGame(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
            </div>
          </div>
          <div className="text-center mb-6">
            <p className="text-xl font-bold text-gray-800">{triviaQuestion.question}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {triviaQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => answerTrivia(index)}
                disabled={triviaAnswered}
                className={`p-4 rounded-xl font-bold text-lg transition-all ${
                  triviaAnswered
                    ? index === triviaQuestion.answer
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                    : 'bg-gradient-to-r from-orange-400 to-amber-400 text-white hover:scale-105'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          {triviaAnswered && (
            <div className="text-center mt-4">
              <button
                onClick={startTrivia}
                className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold"
              >
                Next Question
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Fun Buttons */}
      {!currentGame && (
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-black text-gray-800 mb-4">Quick Fun</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => { triggerConfetti(); playSound(); }}
              className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white p-4 rounded-xl font-bold hover:scale-105 transition-transform"
            >
              🎉 Confetti!
            </button>
            <button
              onClick={playSound}
              className="bg-gradient-to-r from-blue-400 to-cyan-400 text-white p-4 rounded-xl font-bold hover:scale-105 transition-transform"
            >
              🔔 Ding!
            </button>
            <button
              onClick={() => alert("You're amazing! 💖")}
              className="bg-gradient-to-r from-pink-400 to-rose-400 text-white p-4 rounded-xl font-bold hover:scale-105 transition-transform"
            >
              💖 Love Note
            </button>
            <button
              onClick={() => alert(`Lucky Number: ${Math.floor(Math.random() * 100) + 1}`)}
              className="bg-gradient-to-r from-purple-400 to-indigo-400 text-white p-4 rounded-xl font-bold hover:scale-105 transition-transform"
            >
              🔮 Lucky #
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
