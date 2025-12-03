import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

// GET /api/providers/list
// Returns list of available external programming providers
export async function GET() {
  try {
    const db = getAdminDb();

    const providersSnapshot = await db
      .collection("externalProviders")
      .where("isActive", "==", true)
      .orderBy("name")
      .get();

    const providers = providersSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      slug: doc.data().slug,
      description: doc.data().description,
      logoUrl: doc.data().logoUrl,
      websiteUrl: doc.data().websiteUrl,
      supportsScheduledWorkouts: doc.data().supportsScheduledWorkouts,
      supportsDailyWorkouts: doc.data().supportsDailyWorkouts,
      supportsMultiplePrograms: doc.data().supportsMultiplePrograms,
    }));

    return NextResponse.json({
      success: true,
      providers,
    });
  } catch (error) {
    console.error("Error fetching providers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}
