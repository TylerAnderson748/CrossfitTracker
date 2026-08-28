// The known universe of CrossFit / functional-fitness / commercial-gym
// equipment. Athletes tick what they own or what their gym has - the
// coach programs only from this canonical list, so there is no free-text
// interpretation anywhere in the path.

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
      { key: "barbell", label: "Barbell", variants: ["45lb/20kg men's", "35lb/15kg women's", "technique bar", "axle/fat bar", "trap/hex bar", "safety squat bar", "EZ-curl bar", "swiss/football bar", "cambered bar", "deadlift bar"] },
      { key: "bumper_plates", label: "Bumper plates", hasWeights: true, weightHint: "total lbs" },
      { key: "iron_plates", label: "Iron plates", hasWeights: true, weightHint: "total lbs" },
      { key: "change_plates", label: "Change / fractional plates" },
      { key: "lifting_chains", label: "Lifting chains" },
      { key: "jerk_blocks", label: "Jerk blocks" },
      { key: "pulling_blocks", label: "Pulling blocks" },
      { key: "lifting_platform", label: "Lifting platform" },
    ],
  },
  {
    group: "Racks & Benches",
    items: [
      { key: "squat_rack", label: "Squat rack", variants: ["squat stands", "power cage", "wall-mount rig", "free-standing rig", "folding wall rack"] },
      { key: "safety_arms", label: "Safety spotter arms / straps" },
      { key: "bench", label: "Bench", variants: ["flat", "adjustable/incline", "incline + decline"] },
      { key: "ghd", label: "GHD machine" },
    ],
  },
  {
    group: "Dumbbells, Kettlebells & Odd Bells",
    items: [
      { key: "dumbbells", label: "Dumbbells", hasWeights: true, weightHint: "e.g. 35, 50", variants: ["fixed pairs", "adjustable", "full rack/set"] },
      { key: "kettlebells", label: "Kettlebells", hasWeights: true, weightHint: "e.g. 35, 53", variants: ["cast iron", "competition", "adjustable"] },
      { key: "macebell", label: "Macebell", hasWeights: true },
      { key: "clubbells", label: "Clubbells", hasWeights: true },
      { key: "circus_dumbbell", label: "Circus dumbbell", hasWeights: true },
    ],
  },
  {
    group: "Sandbags, Odd Objects & Strongman",
    items: [
      { key: "sandbag_strongman", label: "Strongman sandbag (no handles)", hasWeights: true },
      { key: "sandbag_training", label: "Training sandbag (with handles)", hasWeights: true },
      { key: "bulgarian_bag", label: "Bulgarian bag", hasWeights: true },
      { key: "dball", label: "D-ball (soft atlas ball)", hasWeights: true },
      { key: "slam_ball", label: "Slam ball", hasWeights: true },
      { key: "atlas_stone", label: "Atlas stone", hasWeights: true },
      { key: "husafell_stone", label: "Husafell stone", hasWeights: true },
      { key: "yoke", label: "Yoke" },
      { key: "farmers_handles", label: "Farmer's carry handles" },
      { key: "sled", label: "Sled", variants: ["push", "drag", "push + drag"] },
      { key: "keg", label: "Keg", hasWeights: true },
      { key: "log_bar", label: "Strongman log", hasWeights: true },
      { key: "tire", label: "Flip tire" },
      { key: "sledgehammer", label: "Sledgehammer", hasWeights: true },
    ],
  },
  {
    group: "Balls & Targets",
    items: [
      { key: "wall_ball", label: "Wall ball / medicine ball", hasWeights: true, weightHint: "e.g. 14, 20" },
      { key: "wall_ball_target", label: "Wall-ball target", variants: ["9 ft", "10 ft", "wall marks only"] },
      { key: "stability_ball", label: "Stability ball" },
      { key: "bosu_ball", label: "BOSU ball" },
    ],
  },
  {
    group: "Gymnastics & Bodyweight",
    items: [
      { key: "pull_up_bar", label: "Pull-up bar", variants: ["doorway", "wall/ceiling-mounted", "rig-mounted", "free-standing"] },
      { key: "rings", label: "Gymnastic rings" },
      { key: "parallettes", label: "Parallettes" },
      { key: "dip_station", label: "Dip station" },
      { key: "climbing_rope", label: "Climbing rope" },
      { key: "peg_board", label: "Peg board" },
      { key: "stall_bars", label: "Stall bars" },
      { key: "ab_mat", label: "AbMat" },
      { key: "ab_wheel", label: "Ab wheel" },
      { key: "handstand_wall", label: "Wall space for handstands" },
      { key: "roman_chair", label: "Roman chair / hyperextension bench" },
    ],
  },
  {
    group: "Cardio Machines & Running",
    items: [
      { key: "rower", label: "Rowing erg (Concept2-style)" },
      { key: "air_bike", label: "Air bike / fan bike", variants: ["Assault", "Echo", "other fan bike"] },
      { key: "bike_erg", label: "BikeErg" },
      { key: "ski_erg", label: "SkiErg" },
      { key: "treadmill", label: "Treadmill", variants: ["motorized", "curved/manual"] },
      { key: "elliptical", label: "Elliptical" },
      { key: "stair_climber", label: "Stair climber / stepmill" },
      { key: "jacobs_ladder", label: "Jacobs Ladder" },
      { key: "versaclimber", label: "VersaClimber" },
      { key: "spin_bike", label: "Spin bike" },
      { key: "upright_bike", label: "Upright stationary bike" },
      { key: "recumbent_bike", label: "Recumbent bike" },
      { key: "running_space", label: "Outdoor running route" },
      { key: "track_access", label: "Track access" },
      { key: "pool_access", label: "Pool access" },
    ],
  },
  {
    group: "Plate-Loaded Machines",
    items: [
      { key: "smith_machine", label: "Smith machine" },
      { key: "leg_press", label: "Leg press (45°)" },
      { key: "horizontal_leg_press", label: "Horizontal / seated leg press" },
      { key: "hack_squat", label: "Hack squat machine" },
      { key: "pendulum_squat", label: "Pendulum squat" },
      { key: "v_squat", label: "V-squat machine" },
      { key: "belt_squat", label: "Belt squat" },
      { key: "hip_thrust_machine", label: "Hip thrust machine" },
      { key: "glute_kickback_machine", label: "Glute kickback machine" },
      { key: "t_bar_row", label: "T-bar row" },
      { key: "chest_supported_row", label: "Chest-supported row machine" },
      { key: "iso_lateral_row", label: "Iso-lateral row (Hammer-style)" },
      { key: "plate_loaded_chest_press", label: "Plate-loaded chest press" },
      { key: "plate_loaded_incline_press", label: "Plate-loaded incline press" },
      { key: "plate_loaded_shoulder_press", label: "Plate-loaded shoulder press" },
      { key: "plate_loaded_pulldown", label: "Plate-loaded pulldown" },
      { key: "standing_calf_raise", label: "Standing calf raise machine" },
      { key: "seated_calf_raise", label: "Seated calf raise machine" },
      { key: "reverse_hyper", label: "Reverse hyper" },
      { key: "landmine", label: "Landmine attachment" },
    ],
  },
  {
    group: "Selectorized & Cable Machines",
    items: [
      { key: "cable_machine", label: "Cable machine / functional trainer" },
      { key: "cable_crossover", label: "Cable crossover station" },
      { key: "lat_pulldown", label: "Lat pulldown" },
      { key: "seated_row_machine", label: "Seated cable row" },
      { key: "leg_extension", label: "Leg extension machine" },
      { key: "seated_leg_curl", label: "Seated leg curl" },
      { key: "lying_leg_curl", label: "Lying leg curl" },
      { key: "hip_adduction", label: "Hip adduction machine" },
      { key: "hip_abduction", label: "Hip abduction machine" },
      { key: "pec_deck", label: "Pec deck / reverse fly" },
      { key: "shoulder_press_machine", label: "Shoulder press machine" },
      { key: "chest_press_machine", label: "Chest press machine" },
      { key: "lateral_raise_machine", label: "Lateral raise machine" },
      { key: "bicep_curl_machine", label: "Bicep curl machine" },
      { key: "tricep_extension_machine", label: "Tricep extension machine" },
      { key: "assisted_pullup_machine", label: "Assisted pull-up / dip machine" },
      { key: "ab_crunch_machine", label: "Ab crunch machine" },
      { key: "torso_rotation_machine", label: "Torso rotation machine" },
      { key: "back_extension_machine", label: "Back extension machine (selectorized)" },
      { key: "back_extension", label: "Back extension (45° hyper)" },
      { key: "preacher_bench", label: "Preacher curl bench" },
      { key: "shrug_machine", label: "Shrug machine" },
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
      { key: "dip_belt", label: "Dip belt" },
      { key: "agility_ladder", label: "Agility ladder" },
      { key: "cones", label: "Agility cones" },
      { key: "core_sliders", label: "Core sliders" },
      { key: "ankle_straps", label: "Cable ankle straps" },
    ],
  },
];

export const CATALOG_BY_KEY: Record<string, CatalogEquipment> = Object.fromEntries(
  EQUIPMENT_CATALOG.flatMap(g => g.items.map(it => [it.key, it]))
);

export const EQUIPMENT_COUNT = EQUIPMENT_CATALOG.reduce((n, g) => n + g.items.length, 0);
