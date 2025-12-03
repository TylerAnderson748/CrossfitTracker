import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

// POST /api/providers/connect
// Endpoint for gyms to connect to an external programming provider
export async function POST(request: NextRequest) {
  try {
    const { gymId, providerId, userId, targetGroupIds, autoPublish, defaultHideDetails } =
      await request.json();

    // Validate required fields
    if (!gymId || !providerId || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: gymId, providerId, userId" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Verify user has permission (must be gym owner or coach)
    const gymDoc = await db.collection("gyms").doc(gymId).get();
    if (!gymDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Gym not found" },
        { status: 404 }
      );
    }

    const gym = gymDoc.data();
    const isOwner = gym?.ownerId === userId;
    const isCoach = gym?.coachIds?.includes(userId);

    if (!isOwner && !isCoach) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Must be gym owner or coach." },
        { status: 403 }
      );
    }

    // Verify provider exists and is active
    const providerDoc = await db.collection("externalProviders").doc(providerId).get();
    if (!providerDoc.exists || !providerDoc.data()?.isActive) {
      return NextResponse.json(
        { success: false, error: "Provider not found or inactive" },
        { status: 404 }
      );
    }

    const provider = providerDoc.data();

    // Check if connection already exists
    const existingConnectionQuery = await db
      .collection("gymProviderConnections")
      .where("gymId", "==", gymId)
      .where("providerId", "==", providerId)
      .limit(1)
      .get();

    if (!existingConnectionQuery.empty) {
      return NextResponse.json(
        { success: false, error: "Connection already exists for this provider" },
        { status: 409 }
      );
    }

    // Generate a unique webhook secret for this gym connection
    const webhookSecret = `whsec_gym_${crypto.randomBytes(24).toString("hex")}`;

    // Create the connection
    const connectionData = {
      gymId,
      providerId,
      providerName: provider?.name,
      targetGroupIds: targetGroupIds || [],
      autoPublish: autoPublish ?? false,
      defaultHideDetails: defaultHideDetails ?? false,
      status: "active",
      connectedAt: FieldValue.serverTimestamp(),
      connectedBy: userId,
      webhookSecret,
    };

    const connectionRef = await db.collection("gymProviderConnections").add(connectionData);

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${provider?.name}`,
      connectionId: connectionRef.id,
      webhookSecret,
    });
  } catch (error) {
    console.error("Connection error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create connection" },
      { status: 500 }
    );
  }
}

// GET /api/providers/connect?gymId=xxx
// Get all provider connections for a gym
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gymId = searchParams.get("gymId");

    if (!gymId) {
      return NextResponse.json(
        { success: false, error: "Missing gymId parameter" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    const connectionsSnapshot = await db
      .collection("gymProviderConnections")
      .where("gymId", "==", gymId)
      .get();

    const connections = connectionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      providerId: doc.data().providerId,
      providerName: doc.data().providerName,
      status: doc.data().status,
      targetGroupIds: doc.data().targetGroupIds,
      autoPublish: doc.data().autoPublish,
      defaultHideDetails: doc.data().defaultHideDetails,
      connectedAt: doc.data().connectedAt?.toDate?.()?.toISOString(),
      lastWorkoutReceivedAt: doc.data().lastWorkoutReceivedAt?.toDate?.()?.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      connections,
    });
  } catch (error) {
    console.error("Error fetching connections:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

// PUT /api/providers/connect
// Update a connection (e.g., change target groups, toggle auto-publish)
export async function PUT(request: NextRequest) {
  try {
    const { connectionId, userId, targetGroupIds, autoPublish, defaultHideDetails, status } =
      await request.json();

    if (!connectionId || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Get the connection
    const connectionRef = db.collection("gymProviderConnections").doc(connectionId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Connection not found" },
        { status: 404 }
      );
    }

    const connection = connectionDoc.data();

    // Verify user has permission
    const gymDoc = await db.collection("gyms").doc(connection?.gymId).get();
    if (!gymDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Gym not found" },
        { status: 404 }
      );
    }

    const gym = gymDoc.data();
    const isOwner = gym?.ownerId === userId;
    const isCoach = gym?.coachIds?.includes(userId);

    if (!isOwner && !isCoach) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (targetGroupIds !== undefined) updateData.targetGroupIds = targetGroupIds;
    if (autoPublish !== undefined) updateData.autoPublish = autoPublish;
    if (defaultHideDetails !== undefined) updateData.defaultHideDetails = defaultHideDetails;
    if (status !== undefined && ["active", "inactive", "paused"].includes(status)) {
      updateData.status = status;
    }

    await connectionRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: "Connection updated successfully",
    });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update connection" },
      { status: 500 }
    );
  }
}

// DELETE /api/providers/connect
// Disconnect from a provider
export async function DELETE(request: NextRequest) {
  try {
    const { connectionId, userId } = await request.json();

    if (!connectionId || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Get the connection
    const connectionRef = db.collection("gymProviderConnections").doc(connectionId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Connection not found" },
        { status: 404 }
      );
    }

    const connection = connectionDoc.data();

    // Verify user has permission (only owner can delete)
    const gymDoc = await db.collection("gyms").doc(connection?.gymId).get();
    if (!gymDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Gym not found" },
        { status: 404 }
      );
    }

    const gym = gymDoc.data();
    if (gym?.ownerId !== userId) {
      return NextResponse.json(
        { success: false, error: "Only gym owner can disconnect providers" },
        { status: 403 }
      );
    }

    // Delete the connection
    await connectionRef.delete();

    // Optionally: Delete all workouts from this provider for this gym
    const workoutsQuery = await db
      .collection("externalProgrammedWorkouts")
      .where("connectionId", "==", connectionId)
      .get();

    const batch = db.batch();
    workoutsQuery.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: "Disconnected from provider and removed associated workouts",
      deletedWorkouts: workoutsQuery.size,
    });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
