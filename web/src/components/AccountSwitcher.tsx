"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

export default function AccountSwitcher() {
  const {
    user,
    storedAccounts,
    switchAccount,
    addAccount,
    removeAccount,
    isCurrentAccount,
    signOut,
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAddAccount(false);
        setError("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchAccount = async (accountId: string) => {
    if (isCurrentAccount(accountId)) return;

    setSwitching(true);
    setError("");
    try {
      await switchAccount(accountId);
      setIsOpen(false);
    } catch (err) {
      setError("Failed to switch account. Please try again.");
    } finally {
      setSwitching(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSwitching(true);

    try {
      await addAccount(email, password);
      setEmail("");
      setPassword("");
      setShowAddAccount(false);
      setIsOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("user-not-found")) {
          setError("No account found with this email.");
        } else if (err.message.includes("wrong-password") || err.message.includes("invalid-credential")) {
          setError("Incorrect password.");
        } else {
          setError("Failed to add account. Check your credentials.");
        }
      } else {
        setError("Failed to add account.");
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleRemoveAccount = (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation();
    if (isCurrentAccount(accountId)) {
      // Can't remove current account
      return;
    }
    removeAccount(accountId);
  };

  const currentDisplayName = user?.displayName || user?.firstName || user?.email || "Account";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Account Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {currentDisplayName.charAt(0).toUpperCase()}
        </div>
        <span className="text-gray-700 text-sm font-medium hidden sm:block max-w-[120px] truncate">
          {currentDisplayName}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* Current Account Label */}
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Current Account
          </div>

          {/* Current Account */}
          {user && (
            <div className="px-4 py-2 bg-blue-50 border-l-4 border-blue-500">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                  {currentDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {currentDisplayName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <span className="text-xs text-blue-600 font-medium">Active</span>
              </div>
            </div>
          )}

          {/* Other Accounts */}
          {storedAccounts.filter((a) => !isCurrentAccount(a.id)).length > 0 && (
            <>
              <div className="px-4 py-2 mt-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Switch Account
              </div>
              {storedAccounts
                .filter((a) => !isCurrentAccount(a.id))
                .map((account) => (
                  <div
                    key={account.id}
                    onClick={() => !switching && handleSwitchAccount(account.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && !switching && handleSwitchAccount(account.id)}
                    className={`w-full px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer ${switching ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-medium">
                        {(account.displayName || account.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {account.displayName || account.email}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{account.email}</p>
                      </div>
                      <button
                        onClick={(e) => handleRemoveAccount(e, account.id)}
                        className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove account"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Add Account Form */}
          {showAddAccount ? (
            <form onSubmit={handleAddAccount} className="px-4 py-3 border-t border-gray-100 mt-2">
              <div className="space-y-3">
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAccount(false);
                      setEmail("");
                      setPassword("");
                      setError("");
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={switching}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {switching ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddAccount(true)}
              className="w-full px-4 py-3 border-t border-gray-100 mt-2 flex items-center space-x-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Add another account</span>
            </button>
          )}

          {/* Sign Out */}
          <button
            onClick={() => signOut()}
            className="w-full px-4 py-3 border-t border-gray-100 mt-2 flex items-center space-x-3 hover:bg-gray-50 transition-colors text-red-600"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
