"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { Gender } from "@/lib/types";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<Gender>("Male");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const handleForgotPassword = async () => {
    setError("");
    setResetSent(false);
    if (!email.trim()) {
      setError("Enter your email above first, then tap \"Forgot password?\" again.");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      // Don't reveal whether an account exists - show the same message
      if (code === "auth/user-not-found") {
        setResetSent(true);
      } else if (code === "auth/invalid-email") {
        setError("That doesn't look like a valid email address.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts - wait a few minutes and try again.");
      } else {
        setError("Couldn't send the reset email. Check your connection and try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, {
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`,
          username: username.toLowerCase(),
          gender,
        });
      } else {
        await signIn(email, password);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = isSignUp
    ? email && password && firstName && lastName && username
    : email && password;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">🔥</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-gray-500">
            {isSignUp ? "Join CoachODDO today" : "Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {resetSent && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              If an account exists for {email.trim()}, a password-reset email is on its way. Check your inbox (and spam folder), then log in with your new password.
            </div>
          )}

          {isSignUp && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              required
            />
            {!isSignUp && (
              <div className="text-right mt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  {resetLoading ? "Sending..." : "Forgot password?"}
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Log In"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="w-full py-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {isSignUp ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
