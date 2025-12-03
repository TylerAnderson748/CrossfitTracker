import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import crypto from "crypto";

const FieldValue = admin.firestore.FieldValue;

interface ProviderRegistrationPayload {
  name: string;
  email: string;
  websiteUrl: string;
  description: string;
  authMethod: "api_key" | "oauth" | "webhook_secret";
  supportsScheduledWorkouts?: boolean;
  supportsDailyWorkouts?: boolean;
  supportsMultiplePrograms?: boolean;
}

// Generate a secure API key
function generateApiKey(): string {
  return `cfp_${crypto.randomBytes(32).toString("hex")}`;
}

// Generate a webhook secret
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString("hex")}`;
}

// POST /api/providers/register
// Endpoint for new programming providers to register for API access
export async function POST(request: NextRequest) {
  try {
    const payload: ProviderRegistrationPayload = await request.json();

    // Validate required fields
    if (!payload.name || !payload.email || !payload.websiteUrl || !payload.description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, email, websiteUrl, description" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Check if provider with same name or email already exists
    const existingNameQuery = await db
      .collection("providerRegistrations")
      .where("name", "==", payload.name)
      .limit(1)
      .get();

    if (!existingNameQuery.empty) {
      return NextResponse.json(
        { success: false, error: "A provider with this name already exists" },
        { status: 409 }
      );
    }

    const existingEmailQuery = await db
      .collection("providerRegistrations")
      .where("email", "==", payload.email)
      .limit(1)
      .get();

    if (!existingEmailQuery.empty) {
      return NextResponse.json(
        { success: false, error: "A provider with this email already exists" },
        { status: 409 }
      );
    }

    // Generate slug from name
    const slug = payload.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Create the registration request
    const registrationData = {
      name: payload.name,
      email: payload.email,
      websiteUrl: payload.websiteUrl,
      description: payload.description,
      slug,
      authMethod: payload.authMethod || "webhook_secret",
      supportsScheduledWorkouts: payload.supportsScheduledWorkouts ?? true,
      supportsDailyWorkouts: payload.supportsDailyWorkouts ?? true,
      supportsMultiplePrograms: payload.supportsMultiplePrograms ?? false,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    };

    const registrationRef = await db.collection("providerRegistrations").add(registrationData);

    return NextResponse.json({
      success: true,
      message: "Registration submitted successfully. You will receive credentials once approved.",
      registrationId: registrationRef.id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process registration" },
      { status: 500 }
    );
  }
}

// PUT /api/providers/register
// Admin endpoint to approve/reject registrations and generate credentials
export async function PUT(request: NextRequest) {
  try {
    const { registrationId, action, adminUserId } = await request.json();

    if (!registrationId || !action || !adminUserId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Verify admin user
    const adminDoc = await db.collection("users").doc(adminUserId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== "superAdmin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get the registration
    const registrationRef = db.collection("providerRegistrations").doc(registrationId);
    const registrationDoc = await registrationRef.get();

    if (!registrationDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Registration not found" },
        { status: 404 }
      );
    }

    const registration = registrationDoc.data();

    if (registration?.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Registration has already been processed" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      await registrationRef.update({
        status: "rejected",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: adminUserId,
      });

      return NextResponse.json({
        success: true,
        message: "Registration rejected",
      });
    }

    // Approve: Create the provider and credentials
    const apiKey = generateApiKey();
    const webhookSecret = generateWebhookSecret();

    // Create the provider
    const providerData = {
      name: registration?.name,
      slug: registration?.slug,
      description: registration?.description,
      logoUrl: null,
      websiteUrl: registration?.websiteUrl,
      authMethod: registration?.authMethod || "webhook_secret",
      webhookEndpoint: `/api/providers/webhook`,
      supportsScheduledWorkouts: registration?.supportsScheduledWorkouts ?? true,
      supportsDailyWorkouts: registration?.supportsDailyWorkouts ?? true,
      supportsMultiplePrograms: registration?.supportsMultiplePrograms ?? false,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const providerRef = await db.collection("externalProviders").add(providerData);

    // Create the credentials (stored separately for security)
    await db.collection("providerCredentials").add({
      providerId: providerRef.id,
      providerName: registration?.name,
      apiKey,
      webhookSecret,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update registration status
    await registrationRef.update({
      status: "approved",
      providerId: providerRef.id,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminUserId,
    });

    return NextResponse.json({
      success: true,
      message: "Provider approved and credentials generated",
      providerId: providerRef.id,
      credentials: {
        apiKey,
        webhookSecret,
        webhookEndpoint: "/api/providers/webhook",
      },
    });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
