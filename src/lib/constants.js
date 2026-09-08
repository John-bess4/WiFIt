// Static data the app runs on — the tables the Swift client ships verbatim.
// Moved out of App.jsx unchanged (2026-09-08). No JSX, no state, no fetch.
//
// Where a value is a CONTRACT rather than a catalogue, the contract is noted:
//   SEED / MEAL_SLOTS      the four meal slots; food_log.meal_slot is one of these
//   GOAL_OZ                the water goal in oz; water_log.oz is compared to it
//   MAX_FOOD_GRAMS,        ceilings that reject a mistyped amount before it is
//   CF_MAX_SERVING_G       written (~2x anything genuine)
//   SUPP_CATEGORY_DOTS     the eight PURPOSE values supplement_stack.category
//                          may hold; a category is valid IFF it has a colour
//   SUPP_TYPE_TO_CATEGORY  product type (catalogue axis) -> purpose, mapped at
//                          write time; unmapped -> null, never a passthrough
//   ACTIVITY               the seven activity multipliers used by BOTH the
//                          onboarding TDEE and the profile TDEE — one table
//   GOAL_RATES             kcal delta per weekly-rate option; calcCalFromRate
//                          floors the result at 1200
//
// BMR/TDEE themselves still live inside OnboardingWizard.calcGoals and
// ProfilePage.calcTDEE — the next extraction candidate, see PROJECT_CONTEXT.

// Keep COLORS for food dot randomness
export const COLORS=["#A855F7","#EC4899","#06B6D4","#10B981","#F59E0B","#EF4444"];

export const SEED={breakfast:[],lunch:[],dinner:[],snacks:[]};
// Slot ids and labels in display order. Defined here for the Food redesign;
// today FoodTab still carries an equivalent inline literal and HomeTab uses
// Object.keys(SEED) — both are rewired when that screen is rebuilt.
export const MEAL_SLOTS=[{id:"breakfast",label:"Breakfast"},{id:"lunch",label:"Lunch"},{id:"dinner",label:"Dinner"},{id:"snacks",label:"Snacks"}];

export const GOAL_OZ=128;
// Ceilings: one serving tops out around 2 L of liquid; one logged item around
// 5 kg. Both are ~2x anything genuine, and catch a mistyped or doubled amount.
export const CF_MAX_SERVING_G=2000;
export const MAX_FOOD_GRAMS=5000;

// ── LOCAL FOOD DATABASE ────────────────────────────────────────
// sugar is total sugars per 100 g from the label/USDA where known; null where
// not (a missing value is honest, a 0 is a claim). The catalogue used to have
// no sugar field at all, so every seed food logged per100_sugar = 0.
export const LOCAL_FOOD_DB=[
  // Branded grocery items
  {name:"Real Good Chicken Tenders",brand:"Real Good Foods",servingG:85,per100:{cal:176,protein:24,carbs:2,fat:8,fiber:0,sugar:null,sodium:400}},
  {name:"Real Good Chicken Enchiladas",brand:"Real Good Foods",servingG:227,per100:{cal:106,protein:13,carbs:4,fat:4,fiber:0,sugar:null,sodium:330}},
  {name:"Real Good Pizza (Pepperoni)",brand:"Real Good Foods",servingG:128,per100:{cal:266,protein:23,carbs:5,fat:17,fiber:0,sugar:null,sodium:600}},
  {name:"Fairlife Whole Milk",brand:"Fairlife",servingG:240,per100:{cal:63,protein:6.3,carbs:5,fat:3.3,fiber:0,sugar:2.5,sodium:50}},
  {name:"Fairlife 2% Milk",brand:"Fairlife",servingG:240,per100:{cal:54,protein:6.3,carbs:5,fat:2.1,fiber:0,sugar:2.5,sodium:50}},
  {name:"Fairlife Fat Free Milk",brand:"Fairlife",servingG:240,per100:{cal:42,protein:6.3,carbs:5,fat:0,fiber:0,sugar:2.5,sodium:55}},
  {name:"Fairlife Core Power (Chocolate)",brand:"Fairlife",servingG:414,per100:{cal:60,protein:9.9,carbs:5.5,fat:1.5,fiber:0,sugar:1.7,sodium:60}},
  {name:"Fairlife Core Power (Vanilla)",brand:"Fairlife",servingG:414,per100:{cal:58,protein:9.9,carbs:5.3,fat:1.4,fiber:0,sugar:1.7,sodium:58}},
  {name:"Fairlife Chocolate Milk (2%)",brand:"Fairlife",servingG:240,per100:{cal:75,protein:6.3,carbs:9.6,fat:2.1,fiber:0,sugar:5,sodium:55}},
  {name:"Chobani Plain Greek Yogurt (0%)",brand:"Chobani",servingG:150,per100:{cal:59,protein:10,carbs:4,fat:0,fiber:0,sugar:2.7,sodium:45}},
  {name:"Chobani Plain Greek Yogurt (2%)",brand:"Chobani",servingG:150,per100:{cal:80,protein:9,carbs:5,fat:2,fiber:0,sugar:2.7,sodium:50}},
  {name:"Siggi's Plain Yogurt (0%)",brand:"Siggi's",servingG:150,per100:{cal:63,protein:11,carbs:4,fat:0,fiber:0,sugar:2.7,sodium:53}},
  {name:"RXBAR Chocolate Sea Salt",brand:"RXBAR",servingG:52,per100:{cal:219,protein:23,carbs:37,fat:8,fiber:6,sugar:25,sodium:277}},
  {name:"RXBAR Blueberry",brand:"RXBAR",servingG:52,per100:{cal:210,protein:21,carbs:38,fat:7,fiber:6,sugar:26.9,sodium:200}},
  {name:"Quest Bar Chocolate Chip Cookie Dough",brand:"Quest",servingG:60,per100:{cal:367,protein:35,carbs:47,fat:12,fiber:27,sugar:1.7,sodium:350}},
  {name:"Quest Bar Cookies & Cream",brand:"Quest",servingG:60,per100:{cal:367,protein:35,carbs:47,fat:12,fiber:27,sugar:1.7,sodium:340}},
  {name:"Built Bar Chocolate Mint",brand:"Built Bar",servingG:53,per100:{cal:221,protein:30,carbs:25,fat:4,fiber:13,sugar:7.5,sodium:188}},
  {name:"Kirkland Canned Chicken",brand:"Kirkland/Costco",servingG:56,per100:{cal:109,protein:25,carbs:0,fat:1,fiber:0,sugar:0,sodium:330}},
  {name:"Kirkland Protein Bar (Chocolate Chip)",brand:"Kirkland/Costco",servingG:60,per100:{cal:333,protein:33,carbs:43,fat:10,fiber:17,sugar:3.3,sodium:333}},
  {name:"Applegate Natural Turkey Breast",brand:"Applegate",servingG:56,per100:{cal:80,protein:18,carbs:1,fat:1,fiber:0,sugar:0,sodium:500}},
  {name:"Rao's Marinara Sauce",brand:"Rao's",servingG:125,per100:{cal:80,protein:2,carbs:8,fat:4,fiber:2,sugar:3.2,sodium:280}},
  // Generic whole foods
  {name:"White Rice (cooked)",brand:"Generic",servingG:100,per100:{cal:130,protein:2.7,carbs:28,fat:0.3,fiber:0.4,sugar:0.1,sodium:1}},
  {name:"Chicken Breast (grilled)",brand:"Generic",servingG:100,per100:{cal:165,protein:31,carbs:0,fat:3.6,fiber:0,sugar:0,sodium:74}},
  {name:"Whole Egg (large)",brand:"Generic",servingG:50,per100:{cal:155,protein:13,carbs:1.1,fat:11,fiber:0,sugar:1.1,sodium:124}},
  {name:"Oatmeal (dry)",brand:"Generic",servingG:40,per100:{cal:389,protein:17,carbs:66,fat:7,fiber:11,sugar:1,sodium:6}},
  {name:"Banana",brand:"Generic",servingG:118,per100:{cal:89,protein:1.1,carbs:23,fat:0.3,fiber:2.6,sugar:12.2,sodium:1}},
  {name:"Salmon (cooked)",brand:"Generic",servingG:100,per100:{cal:208,protein:20,carbs:0,fat:13,fiber:0,sugar:0,sodium:59}},
  {name:"Sweet Potato",brand:"Generic",servingG:130,per100:{cal:86,protein:1.6,carbs:20,fat:0.1,fiber:3,sugar:4.2,sodium:55}},
  {name:"Brown Rice (cooked)",brand:"Generic",servingG:100,per100:{cal:216,protein:5,carbs:45,fat:1.8,fiber:3.5,sugar:0.4,sodium:10}},
  {name:"Almonds",brand:"Generic",servingG:28,per100:{cal:579,protein:21,carbs:22,fat:50,fiber:12.5,sugar:4.4,sodium:1}},
  {name:"Broccoli",brand:"Generic",servingG:100,per100:{cal:34,protein:2.8,carbs:7,fat:0.4,fiber:2.6,sugar:1.7,sodium:33}},
  {name:"Ground Beef 80/20",brand:"Generic",servingG:100,per100:{cal:254,protein:17,carbs:0,fat:20,fiber:0,sugar:0,sodium:72}},
  {name:"Cheddar Cheese",brand:"Generic",servingG:28,per100:{cal:403,protein:25,carbs:1.3,fat:33,fiber:0,sugar:0.5,sodium:621}},
  {name:"Avocado",brand:"Generic",servingG:100,per100:{cal:160,protein:2,carbs:9,fat:15,fiber:7,sugar:0.7,sodium:7}},
  {name:"Peanut Butter",brand:"Generic",servingG:32,per100:{cal:588,protein:25,carbs:20,fat:50,fiber:6,sugar:9,sodium:459}},
  {name:"Pasta (cooked)",brand:"Generic",servingG:140,per100:{cal:158,protein:5.8,carbs:31,fat:0.9,fiber:1.8,sugar:0.6,sodium:1}},
  {name:"Bread (whole wheat)",brand:"Generic",servingG:28,per100:{cal:247,protein:13,carbs:41,fat:4.2,fiber:7,sugar:5.6,sodium:400}},
  {name:"Apple",brand:"Generic",servingG:182,per100:{cal:52,protein:0.3,carbs:14,fat:0.2,fiber:2.4,sugar:10.4,sodium:1}},
  {name:"Tuna (canned in water)",brand:"Generic",servingG:85,per100:{cal:109,protein:25,carbs:0,fat:1,fiber:0,sugar:0,sodium:320}},
  {name:"Milk (whole)",brand:"Generic",servingG:240,per100:{cal:61,protein:3.2,carbs:4.8,fat:3.3,fiber:0,sugar:5,sodium:43}},
  {name:"Cottage Cheese (low fat)",brand:"Generic",servingG:113,per100:{cal:72,protein:12,carbs:3,fat:1,fiber:0,sugar:2.7,sodium:320}},
  {name:"Olive Oil",brand:"Generic",servingG:14,per100:{cal:884,protein:0,carbs:0,fat:100,fiber:0,sugar:0,sodium:2}},
  {name:"Greek Yogurt (plain)",brand:"Generic",servingG:150,per100:{cal:59,protein:10,carbs:3.6,fat:0.4,fiber:0,sugar:4,sodium:36}},
];

// ── LOCAL SUPPLEMENT DATABASE ──────────────────────────────────
export const SUPP_DB=[
  // Protein
  {name:"Optimum Nutrition Gold Standard Whey (Chocolate)",brand:"Optimum Nutrition",category:"Protein",servingG:30,per100:{cal:370,protein:80,carbs:10,fat:4,fiber:0,sodium:130}},
  {name:"Optimum Nutrition Gold Standard Whey (Vanilla)",brand:"Optimum Nutrition",category:"Protein",servingG:30,per100:{cal:367,protein:80,carbs:10,fat:3,fiber:0,sodium:140}},
  {name:"Dymatize ISO100 Whey Isolate (Chocolate)",brand:"Dymatize",category:"Protein",servingG:29,per100:{cal:379,protein:90,carbs:4,fat:2,fiber:0,sodium:207}},
  {name:"Ghost Whey Protein (Cereal Milk)",brand:"Ghost",category:"Protein",servingG:36,per100:{cal:361,protein:75,carbs:14,fat:5,fiber:0,sodium:222}},
  {name:"Muscle Milk Genuine (Chocolate)",brand:"Muscle Milk",category:"Protein",servingG:32,per100:{cal:381,protein:63,carbs:19,fat:9,fiber:3,sodium:281}},
  {name:"Orgain Organic Protein (Chocolate)",brand:"Orgain",category:"Protein",servingG:46,per100:{cal:337,protein:54,carbs:28,fat:7,fiber:9,sodium:337}},
  // Creatine
  {name:"Creatine Monohydrate (Micronized)",brand:"Generic",category:"Creatine",servingG:5,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Optimum Nutrition Micronized Creatine",brand:"Optimum Nutrition",category:"Creatine",servingG:5,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Klean Athlete Creatine",brand:"Klean Athlete",category:"Creatine",servingG:5,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  // Pre-workout
  {name:"C4 Original Pre-Workout (Fruit Punch)",brand:"Cellucor",category:"Pre-Workout",servingG:6,per100:{cal:17,protein:0,carbs:17,fat:0,fiber:0,sodium:167}},
  {name:"C4 Sport Pre-Workout",brand:"Cellucor",category:"Pre-Workout",servingG:10,per100:{cal:20,protein:0,carbs:20,fat:0,fiber:0,sodium:200}},
  {name:"Ghost Legend Pre-Workout",brand:"Ghost",category:"Pre-Workout",servingG:12,per100:{cal:8,protein:0,carbs:8,fat:0,fiber:0,sodium:58}},
  {name:"Bucked Up Pre-Workout",brand:"Bucked Up",category:"Pre-Workout",servingG:10,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:50}},
  // BCAAs
  {name:"Optimum Nutrition BCAA 5000",brand:"Optimum Nutrition",category:"BCAAs",servingG:7,per100:{cal:14,protein:14,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Xtend Original BCAAs (Watermelon)",brand:"Scivation",category:"BCAAs",servingG:14,per100:{cal:0,protein:14,carbs:0,fat:0,fiber:0,sodium:214}},
  // Vitamins & Minerals
  {name:"Vitamin D3 2000 IU",brand:"Generic",category:"Vitamins",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Vitamin D3 5000 IU",brand:"Generic",category:"Vitamins",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Magnesium Glycinate 400mg",brand:"Generic",category:"Vitamins",servingG:2,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Zinc 30mg",brand:"Generic",category:"Vitamins",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Vitamin C 1000mg",brand:"Generic",category:"Vitamins",servingG:2,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Vitamin B12 1000mcg",brand:"Generic",category:"Vitamins",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Garden of Life Vitamin D3",brand:"Garden of Life",category:"Vitamins",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  // Omega & Fish Oil
  {name:"Omega-3 Fish Oil 1000mg",brand:"Generic",category:"Omega-3",servingG:1,per100:{cal:900,protein:0,carbs:0,fat:100,fiber:0,sodium:0}},
  {name:"Nordic Naturals Ultimate Omega",brand:"Nordic Naturals",category:"Omega-3",servingG:2,per100:{cal:900,protein:0,carbs:0,fat:100,fiber:0,sodium:0}},
  {name:"Viva Naturals Triple Strength Omega-3",brand:"Viva Naturals",category:"Omega-3",servingG:2,per100:{cal:900,protein:0,carbs:0,fat:100,fiber:0,sodium:0}},
  // Multivitamins
  {name:"Athletic Greens AG1",brand:"Athletic Greens",category:"Greens/Multi",servingG:12,per100:{cal:50,protein:2,carbs:8,fat:0,fiber:2,sodium:83}},
  {name:"Ritual Essential for Men",brand:"Ritual",category:"Multivitamin",servingG:2,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Ritual Essential for Women",brand:"Ritual",category:"Multivitamin",servingG:2,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"One A Day Men's Multivitamin",brand:"One A Day",category:"Multivitamin",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  // Collagen
  {name:"Vital Proteins Collagen Peptides",brand:"Vital Proteins",category:"Collagen",servingG:20,per100:{cal:350,protein:90,carbs:5,fat:0,fiber:0,sodium:175}},
  {name:"Further Food Collagen Peptides",brand:"Further Food",category:"Collagen",servingG:11,per100:{cal:364,protein:91,carbs:0,fat:0,fiber:0,sodium:182}},
  // Probiotics & Gut
  {name:"Garden of Life Dr. Formulated Probiotics",brand:"Garden of Life",category:"Probiotic",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Align Probiotic",brand:"Align",category:"Probiotic",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  // Electrolytes
  {name:"LMNT Electrolytes (Raw Unflavored)",brand:"LMNT",category:"Electrolytes",servingG:5,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:2000}},
  {name:"Liquid IV Hydration Multiplier",brand:"Liquid IV",category:"Electrolytes",servingG:16,per100:{cal:250,protein:0,carbs:63,fat:0,fiber:0,sodium:500}},
  {name:"Nuun Sport Electrolyte Tablets",brand:"Nuun",category:"Electrolytes",servingG:5,per100:{cal:20,protein:0,carbs:20,fat:0,fiber:0,sodium:700}},
  // Melatonin & Sleep
  {name:"Melatonin 5mg",brand:"Generic",category:"Sleep",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
  {name:"Melatonin 10mg",brand:"Generic",category:"Sleep",servingG:1,per100:{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}},
];

// The eight categories the system prompt tells the model to use, and the dot
// colour each one renders as. One object rather than a list plus a lookup, so a
// category is valid IFF it has a colour — the two cannot drift apart.
export const SUPP_CATEGORY_DOTS={
  protein:"#F472B6",vitamin:"#FBBF24",mineral:"#34D399",performance:"#06B6D4",
  health:"#A78BFA",sleep:"#818CF8",fat_burner:"#F97316",probiotic:"#6EE7B7",
};
export const isSuppCategory=(c)=>typeof c==="string"&&Object.hasOwn(SUPP_CATEGORY_DOTS,c);

// supplement_stack.category held two vocabularies: the coach wrote these
// lowercase PURPOSE values, while the manual add path wrote capitalised PRODUCT
// TYPES ("Protein", "Creatine") taken from SUPP_DB and the create picker. Same
// column, different axes — Phase 2 grouping would have treated them as distinct.
//
// Purpose wins for the stack: it is the closed set the model already emits, and
// "what am I taking this for" is the useful question about a personal stack.
// Product type stays on SUPP_DB, where it belongs — that is the catalogue's own
// field, driving browse and search, and it is untouched.
//
// Mapped at WRITE time, so the picker's labels do not change. Covers every value
// in SUPP_DB and in the create picker.
export const SUPP_TYPE_TO_CATEGORY={
  "Protein":"protein",
  "Vitamins":"vitamin",
  "Multivitamin":"vitamin",
  "Creatine":"performance",
  "Pre-Workout":"performance",
  "BCAAs":"performance",
  "Electrolytes":"mineral",
  "Omega-3":"health",
  "Collagen":"health",
  "Greens/Multi":"health",
  "Sleep":"sleep",
  "Probiotic":"probiotic",
  // "Supplement" is the picker's I-don't-know option. It asserts no purpose, so
  // it maps to null and lands in the Uncategorised bucket rather than a guess.
};
// null, never a passthrough: storing an unmapped type would recreate the split.
export const toSuppCategory=(t)=>SUPP_TYPE_TO_CATEGORY[t]||null;

// ── WORKOUT DATA & HELPERS ──────────────────────────────────────
export const EXERCISE_LIBRARY=[
  // Push
  {name:"Bench Press",muscle:"Chest",cat:"Push"},
  {name:"Incline DB Press",muscle:"Chest",cat:"Push"},
  {name:"Cable Flyes",muscle:"Chest",cat:"Push"},
  {name:"Overhead Press",muscle:"Shoulders",cat:"Push"},
  {name:"Lateral Raises",muscle:"Shoulders",cat:"Push"},
  {name:"Tricep Pushdowns",muscle:"Triceps",cat:"Push"},
  {name:"Skull Crushers",muscle:"Triceps",cat:"Push"},
  {name:"Dips",muscle:"Triceps",cat:"Push"},
  // Pull
  {name:"Deadlift",muscle:"Back",cat:"Pull"},
  {name:"Barbell Row",muscle:"Back",cat:"Pull"},
  {name:"Pull-ups",muscle:"Back",cat:"Pull"},
  {name:"Lat Pulldown",muscle:"Back",cat:"Pull"},
  {name:"Seated Cable Row",muscle:"Back",cat:"Pull"},
  {name:"Face Pulls",muscle:"Rear Delt",cat:"Pull"},
  {name:"Barbell Curl",muscle:"Biceps",cat:"Pull"},
  {name:"Hammer Curl",muscle:"Biceps",cat:"Pull"},
  {name:"Incline DB Curl",muscle:"Biceps",cat:"Pull"},
  // Legs
  {name:"Squat",muscle:"Quads",cat:"Legs"},
  {name:"Romanian Deadlift",muscle:"Hamstrings",cat:"Legs"},
  {name:"Leg Press",muscle:"Quads",cat:"Legs"},
  {name:"Leg Curl",muscle:"Hamstrings",cat:"Legs"},
  {name:"Leg Extension",muscle:"Quads",cat:"Legs"},
  {name:"Hip Thrust",muscle:"Glutes",cat:"Legs"},
  {name:"Calf Raises",muscle:"Calves",cat:"Legs"},
  {name:"Walking Lunges",muscle:"Quads",cat:"Legs"},
  // Core / Cardio
  {name:"Plank",muscle:"Core",cat:"Core"},
  {name:"Cable Crunch",muscle:"Abs",cat:"Core"},
  {name:"Hanging Leg Raise",muscle:"Abs",cat:"Core"},
  {name:"Treadmill",muscle:"Cardio",cat:"Cardio"},
  {name:"Cycling",muscle:"Cardio",cat:"Cardio"},
  {name:"Jump Rope",muscle:"Cardio",cat:"Cardio"},
];

export const INITIAL_WORKOUTS=[
  {
    id:"w1",name:"Push Day",tag:"Upper Body",level:"Intermediate",estMin:55,
    exercises:[
      {id:"e1",name:"Bench Press",sets:[{reps:8,weight:135,done:false},{reps:8,weight:135,done:false},{reps:8,weight:135,done:false},{reps:8,weight:135,done:false}]},
      {id:"e2",name:"Overhead Press",sets:[{reps:10,weight:95,done:false},{reps:10,weight:95,done:false},{reps:10,weight:95,done:false}]},
      {id:"e3",name:"Tricep Pushdowns",sets:[{reps:12,weight:50,done:false},{reps:12,weight:50,done:false},{reps:12,weight:50,done:false}]},
      {id:"e4",name:"Incline DB Press",sets:[{reps:10,weight:50,done:false},{reps:10,weight:50,done:false},{reps:10,weight:50,done:false},{reps:10,weight:50,done:false}]},
      {id:"e5",name:"Lateral Raises",sets:[{reps:15,weight:20,done:false},{reps:15,weight:20,done:false},{reps:15,weight:20,done:false}]},
    ]
  },
  {
    id:"w2",name:"Pull Day",tag:"Upper Body",level:"Intermediate",estMin:50,
    exercises:[
      {id:"e6",name:"Deadlift",sets:[{reps:5,weight:185,done:false},{reps:5,weight:185,done:false},{reps:5,weight:185,done:false}]},
      {id:"e7",name:"Barbell Row",sets:[{reps:8,weight:135,done:false},{reps:8,weight:135,done:false},{reps:8,weight:135,done:false}]},
      {id:"e8",name:"Pull-ups",sets:[{reps:8,weight:0,done:false},{reps:8,weight:0,done:false},{reps:8,weight:0,done:false}]},
      {id:"e9",name:"Barbell Curl",sets:[{reps:10,weight:65,done:false},{reps:10,weight:65,done:false},{reps:10,weight:65,done:false}]},
    ]
  },
  {
    id:"w3",name:"Leg Day",tag:"Lower Body",level:"Intermediate",estMin:60,
    exercises:[
      {id:"e10",name:"Squat",sets:[{reps:8,weight:185,done:false},{reps:8,weight:185,done:false},{reps:8,weight:185,done:false},{reps:8,weight:185,done:false}]},
      {id:"e11",name:"Romanian Deadlift",sets:[{reps:10,weight:135,done:false},{reps:10,weight:135,done:false},{reps:10,weight:135,done:false}]},
      {id:"e12",name:"Leg Press",sets:[{reps:12,weight:270,done:false},{reps:12,weight:270,done:false},{reps:12,weight:270,done:false}]},
      {id:"e13",name:"Calf Raises",sets:[{reps:15,weight:90,done:false},{reps:15,weight:90,done:false},{reps:15,weight:90,done:false}]},
    ]
  },
];

// ── GOAL RATES — shared by onboarding + profile ──────────────────
export const GOAL_RATES=[
  {id:"lose_2",   label:"Lose 2 lbs/week",   delta:-1000, dir:"lose",  color:"#EF4444", icon:"📉"},
  {id:"lose_1",   label:"Lose 1 lb/week",    delta:-500,  dir:"lose",  color:"#F97316", icon:"🔥"},
  {id:"lose_0.5", label:"Lose 0.5 lb/week",  delta:-250,  dir:"lose",  color:"#FBBF24", icon:"🌤"},
  {id:"maintain", label:"Maintain weight",   delta:0,     dir:"maintain",color:"#22C55E",icon:"⚖️"},
  {id:"gain_0.5", label:"Gain 0.5 lb/week",  delta:250,   dir:"gain",  color:"#06B6D4", icon:"📈"},
  {id:"gain_1",   label:"Gain 1 lb/week",    delta:500,   dir:"gain",  color:"#818CF8", icon:"💪"},
  {id:"gain_2",   label:"Gain 2 lbs/week",   delta:1000,  dir:"gain",  color:"#A855F7", icon:"🚀"},
];

export function calcCalFromRate(tdee,rateId){
  const rate=GOAL_RATES.find(r=>r.id===rateId)||GOAL_RATES[3];
  return Math.max(tdee+rate.delta,1200);
}

// Used by the onboarding picker (label/sub/mult) and, via ACTIVITY_MULTS_BY_ID,
// by ProfilePage. Was defined inside OnboardingWizard; ProfilePage carried its
// own copy of the seven multipliers, which is how a TDEE can silently fork.
export const ACTIVITY=[
  {id:"bmr",     label:"Basal Metabolic Rate (BMR)", sub:"No activity, bed rest",                mult:1.0},
  {id:"sedentary",label:"Little or no exercise",      sub:"Desk job, mostly sitting",             mult:1.2},
  {id:"light",   label:"Exercise 1–3 times/week",    sub:"Light workouts or walks",              mult:1.375},
  {id:"moderate",label:"Exercise 3–5 times/week",    sub:"Gym sessions most days",               mult:1.55},
  {id:"active",  label:"Daily exercise or intense 3–4×/week", sub:"Hard training most days",     mult:1.725},
  {id:"very_active",label:"Intense exercise 6–7×/week",       sub:"Heavy lifting or sport daily", mult:1.9},
  {id:"extremely",label:"Very intense daily or physical job", sub:"Athletes, labour workers",     mult:2.0},
];
export const ACTIVITY_MULTS_BY_ID=Object.fromEntries(ACTIVITY.map(a=>[a.id,a.mult]));
