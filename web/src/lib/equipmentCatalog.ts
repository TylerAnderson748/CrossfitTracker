// The known universe of CrossFit / functional-fitness equipment.
// Athletes tick what they own instead of describing it in prose, so the
// coach programs from a canonical list - no interpretation, no drift.

export interface CatalogEquipment {
  key: string;
  label: string;
  // Pick-one descriptors that change how the implement is programmed
  variants?: string[];
  // Prompt for the weights owned (entered in lb)
  hasWeights?: boolean;
  weightHint?: string;
}

export interface CatalogGroup {
  group: string;
  items: CatalogEquipment[];
}

export const EQUIPMENT_CATALOG: CatalogGroup[] = [
  {
    group: "Barbell & Plates",
    items: [
      { key: "barbell", label: "Barbell", variants: ["45lb/20kg men's", "35lb/15kg women's", "technique bar", "axle/fat bar", "trap/hex bar", "safety squat bar", "EZ-curl bar"] },
      { key: "bumper_plates", label: "Bumper plates", hasWeights: true, weightHint: "total lbs" },
      { key: "iron_plates", label: "Iron plates", hasWeights: true, weightHint: "total lbs" },
      { key: "change_plates", label: "Change / fractional plates" },
    ],
  },
  {
    group: "Racks & Benches",
    items: [
      { key: "squat_rack", label: "Squat rack", variants: ["squat stands", "power cage", "wall-mount rig", "free-standing rig"] },
      { key: "bench", label: "Bench", variants: ["flat", "adjustable/incline"] },
      { key: "ghd", label: "GHD machine" },
    ],
  },
  {
    group: "Dumbbells & Kettlebells",
    items: [
      { key: "dumbbells", label: "Dumbbells", hasWeights: true, weightHint: "e.g. 35, 50", variants: ["fixed pairs", "adjustable"] },
      { key: "kettlebells", label: "Kettlebells", hasWeights: true, weightHint: "e.g. 35, 53", variants: ["cast iron", "competition", "adjustable"] },
    ],
  },
  {
    group: "Sandbags, Odd Objects & Strongman",
    items: [
      { key: "sandbag_strongman", label: "Strongman sandbag (no handles)", hasWeights: true },
      { key: "sandbag_training", label: "Training sandbag (with handles)", hasWeights: true },
      { key: "dball", label: "D-ball (soft atlas ball)", hasWeights: true },
      { key: "slam_ball", label: "Slam ball", hasWeights: true },
      { key: "atlas_stone", label: "Atlas stone", hasWeights: true },
      { key: "yoke", label: "Yoke" },
      { key: "farmers_handles", label: "Farmer's carry handles" },
      { key: "sled", label: "Sled", variants: ["push", "drag", "push + drag"] },
      { key: "keg", label: "Keg", hasWeights: true },
      { key: "log_bar", label: "Strongman log", hasWeights: true },
    ],
  },
  {
    group: "Balls & Targets",
    items: [
      { key: "wall_ball", label: "Wall ball / medicine ball", hasWeights: true, weightHint: "e.g. 14, 20" },
      { key: "wall_ball_target", label: "Wall-ball target", variants: ["9 ft", "10 ft", "wall marks only"] },
    ],
  },
  {
    group: "Gymnastics",
    items: [
      { key: "pull_up_bar", label: "Pull-up bar", variants: ["doorway", "wall/ceiling-mounted", "rig-mounted", "free-standing"] },
      { key: "rings", label: "Gymnastic rings" },
      { key: "parallettes", label: "Parallettes" },
      { key: "dip_station", label: "Dip station" },
      { key: "climbing_rope", label: "Climbing rope" },
      { key: "peg_board", label: "Peg board" },
      { key: "ab_mat", label: "AbMat" },
    ],
  },
  {
    group: "Cardio Machines & Running",
    items: [
      { key: "rower", label: "Rowing erg (Concept2-style)" },
      { key: "air_bike", label: "Air bike", variants: ["Assault", "Echo", "other fan bike"] },
      { key: "bike_erg", label: "BikeErg / stationary bike" },
      { key: "ski_erg", label: "SkiErg" },
      { key: "treadmill", label: "Treadmill", variants: ["motorized", "curved/manual"] },
      { key: "running_space", label: "Outdoor running route" },
    ],
  },
  {
    group: "Conditioning & Accessories",
    items: [
      { key: "jump_rope", label: "Jump rope", variants: ["speed rope", "heavy rope"] },
      { key: "plyo_box", label: "Plyo box", variants: ["wood 20/24/30", "soft", "stackable"] },
      { key: "battle_ropes", label: "Battle ropes" },
      { key: "weight_vest", label: "Weight vest", hasWeights: true },
      { key: "ruck", label: "Ruck plate / backpack", hasWeights: true },
      { key: "bands", label: "Resistance bands", variants: ["pull-up assist", "mini/monster"] },
      { key: "suspension", label: "Suspension trainer (TRX-style)" },
    ],
  },
];

export const CATALOG_BY_KEY: Record<string, CatalogEquipment> = Object.fromEntries(
  EQUIPMENT_CATALOG.flatMap(g => g.items.map(it => [it.key, it]))
);
