import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

// Types for the webhook payload
interface WorkoutComponent {
  type: "warmup" | "wod" | "lift" | "skill" | "cooldown";
  title: string;
  description: string;
  scoringType?: "fortime" | "emom" | "amrap";
}

interface WebhookPayload {
  event: "workout.created" | "workout.updated" | "workout.deleted";
  timestamp: string;
  provider: {
    id: string;
    name: string;
  };
  workout: {
    externalId: string;
    title: string;
    description: string;
    scheduledDate: string;
    programName?: string;
    trackName?: string;
    difficulty?: string;
    estimatedDuration?: number;
    coachNotes?: string;
    components: WorkoutComponent[];
  };
  signature: string;
}

// Verify webhook signature using HMAC
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// POST /api/providers/webhook
// Endpoint for external programming providers to push workouts
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const payload: WebhookPayload = JSON.parse(rawBody);

    // Validate required fields
    if (!payload.provider?.id || !payload.workout?.externalId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Look up the provider credentials to verify the webhook
    const credentialsQuery = await db
      .collection("providerCredentials")
      .where("providerId", "==", payload.provider.id)
      .limit(1)
      .get();

    if (credentialsQuery.empty) {
      return NextResponse.json(
        { success: false, error: "Unknown provider" },
        { status: 401 }
      );
    }

    const credentials = credentialsQuery.docs[0].data();

    // Verify webhook signature
    if (credentials.webhookSecret) {
      const payloadWithoutSignature = { ...payload };
      delete (payloadWithoutSignature as Partial<WebhookPayload>).signature;
      const payloadString = JSON.stringify(payloadWithoutSignature);

      if (!verifySignature(payloadString, payload.signature, credentials.webhookSecret)) {
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Find all gym connections for this provider
    const connectionsQuery = await db
      .collection("gymProviderConnections")
      .where("providerId", "==", payload.provider.id)
      .where("status", "==", "active")
      .get();

    if (connectionsQuery.empty) {
      return NextResponse.json(
        { success: false, error: "No active connections for this provider" },
        { status: 404 }
      );
    }

    const results: { gymId: string; workoutId?: string; error?: string }[] = [];

    // Process workout for each connected gym
    for (const connectionDoc of connectionsQuery.docs) {
      const connection = connectionDoc.data();
      const gymId = connection.gymId;

      try {
        if (payload.event === "workout.deleted") {
          // Delete the workout
          const existingQuery = await db
            .collection("externalProgrammedWorkouts")
            .where("externalId", "==", payload.workout.externalId)
            .where("gymId", "==", gymId)
            .limit(1)
            .get();

          if (!existingQuery.empty) {
            await existingQuery.docs[0].ref.delete();
            results.push({ gymId, workoutId: existingQuery.docs[0].id });
          }
        } else {
          // Create or update the workout
          const scheduledDate = Timestamp.fromDate(new Date(payload.workout.scheduledDate));

          const workoutData = {
            externalId: payload.workout.externalId,
            providerId: payload.provider.id,
            providerName: payload.provider.name,
            connectionId: connectionDoc.id,
            gymId,
            title: payload.workout.title,
            description: payload.workout.description,
            scheduledDate,
            components: payload.workout.components.map((c, idx) => ({
              id: `comp-${idx}`,
              type: c.type,
              title: c.title,
              description: c.description,
              scoringType: c.scoringType,
            })),
            programName: payload.workout.programName,
            trackName: payload.workout.trackName,
            difficulty: payload.workout.difficulty,
            estimatedDuration: payload.workout.estimatedDuration,
            coachNotes: payload.workout.coachNotes,
            isPublished: connection.autoPublish || false,
            publishedToGroupIds: connection.autoPublish ? connection.targetGroupIds : [],
            receivedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };

          // Check if workout already exists (for updates)
          const existingQuery = await db
            .collection("externalProgrammedWorkouts")
            .where("externalId", "==", payload.workout.externalId)
            .where("gymId", "==", gymId)
            .limit(1)
            .get();

          let workoutId: string;

          if (existingQuery.empty) {
            // Create new workout
            const newDoc = await db.collection("externalProgrammedWorkouts").add(workoutData);
            workoutId = newDoc.id;
          } else {
            // Update existing workout
            workoutId = existingQuery.docs[0].id;
            await existingQuery.docs[0].ref.update({
              ...workoutData,
              receivedAt: existingQuery.docs[0].data().receivedAt, // Preserve original received time
            });
          }

          // Update connection's last workout received timestamp
          await connectionDoc.ref.update({
            lastWorkoutReceivedAt: FieldValue.serverTimestamp(),
          });

          results.push({ gymId, workoutId });
        }
      } catch (err) {
        results.push({ gymId, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed workout for ${results.length} gym(s)`,
      results,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/providers/webhook
// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
