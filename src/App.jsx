
import React, { useState, useRef, useEffect, useContext, createContext } from "react";

// ── MIDNIGHT THEME SYSTEM ──────────────────────────────────────
const THEMES = {
  dark: {
    mode:"dark",
    // ── AURORA BOREALIS ───────────────────────────
    bg:"#020B18",
    surface:"#071828",
    card:"#0A2035",
    cardAlt:"#071828",
    border:"rgba(6,182,212,0.28)",
    borderStrong:"rgba(6,182,212,0.55)",
    glowShadow:"0 0 0 1px rgba(6,182,212,0.25), 0 0 14px rgba(6,182,212,0.1)",
    glowShadowStrong:"0 0 0 1px rgba(6,182,212,0.5), 0 0 20px rgba(6,182,212,0.18)",
    accent:"#06B6D4",
    accentSoft:"#67E8F9",
    accentGlow:"rgba(6,182,212,0.4)",
    accentPill:"rgba(6,182,212,0.14)",
    text:"#F0FDFF",
    subtext:"#7DD3FC",
    muted:"#1E4060",
    bannerFrom:"#0A2540",
    bannerTo:"#020B18",
    navBg:"#010D16",
    inputBg:"#071828",
    // macro / status colors — teal, violet, pink, green
    macro:["#06B6D4","#A855F7","#F472B6","#34D399"],
    red:"#F87171",
    green:"#34D399",
    greenBg:"rgba(52,211,153,0.1)",
    greenText:"#34D399",
    remaining:"#071828",
    remainingText:"#7DD3FC",
    // calendar
    calCell:"#071828",
    calCellSel:"#06B6D4",
    calMiss:"#1E4060",
    // chart bar empty
    barEmpty:"#0A2035",
  },
  light: {
    mode:"light",
    // ── Clean Slate ──────────────────────────────
    bg:"#F8F9FC",
    surface:"#EEF0F8",
    card:"#FFFFFF",
    cardAlt:"#F2F3FA",
    border:"rgba(79,70,229,0.14)",
    borderStrong:"rgba(79,70,229,0.32)",
    glowShadow:"0 0 0 1px rgba(79,70,229,0.12), 0 2px 14px rgba(79,70,229,0.08)",
    glowShadowStrong:"0 0 0 1px rgba(79,70,229,0.28), 0 4px 18px rgba(79,70,229,0.12)",
    accent:"#4F46E5",
    accentSoft:"#6366F1",
    accentGlow:"rgba(79,70,229,0.18)",
    accentPill:"rgba(79,70,229,0.08)",
    text:"#0F0F1A",
    subtext:"rgba(15,15,26,0.48)",
    muted:"rgba(15,15,26,0.28)",
    bannerFrom:"#1E1B4B",
    bannerTo:"#111128",
    navBg:"rgba(248,249,252,0.98)",
    inputBg:"#EEF0F8",
    // macro colors — indigo/cyan/pink/green
    macro:["#4F46E5","#0891B2","#DB2777","#10B981"],
    red:"#DC2626",
    green:"#059669",
    greenBg:"rgba(5,150,105,0.07)",
    greenText:"#047857",
    remaining:"#EEF0F8",
    remainingText:"#4F46E5",
    calCell:"#FFFFFF",
    calCellSel:"#4F46E5",
    calMiss:"#DDE0F0",
    barEmpty:"#EEF0F8",
  },
};

const ThemeCtx = createContext(THEMES.dark);
const useTheme = () => useContext(ThemeCtx);

// Keep COLORS for food dot randomness
const COLORS=["#A855F7","#EC4899","#06B6D4","#10B981","#F59E0B","#EF4444"];
const GOALS={cal:2200,protein:140,carbs:180,fat:78,fiber:25,sodium:2300};

// Inject global responsive styles once
const GLOBAL_CSS=`
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  input,button{font-family:-apple-system,sans-serif;}
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
  body{margin:0;overflow-x:hidden;}
  .glow-card{transition:box-shadow 0.25s,border-color 0.25s,background 0.25s;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}
`;
function GlobalStyle(){
  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=GLOBAL_CSS;
    document.head.appendChild(el);
    return()=>document.head.removeChild(el);
  },[]);
  return null;
}

const dayData={
  14:{food:1,workout:0,supp:1,cal:1820},15:{food:1,workout:1,supp:1,cal:2100},
  16:{food:1,workout:1,supp:0,cal:1950},17:{food:0,workout:0,supp:0,cal:0},
  18:{food:1,workout:0,supp:1,cal:2050},19:{food:1,workout:1,supp:1,cal:1890},
  20:{food:1,workout:1,supp:1,cal:2200},21:{food:1,workout:0,supp:0,cal:720},
};

const SEED={
  breakfast:[
    {id:1,name:"Oatmeal",grams:80,per100:{cal:389,protein:17,carbs:66,fat:7,fiber:11,sodium:6},color:"#2ECC8F"},
    {id:2,name:"Scrambled Eggs",grams:100,per100:{cal:149,protein:10,carbs:1,fat:11,fiber:0,sodium:142},color:"#FF6B4A"},
    {id:3,name:"Banana",grams:118,per100:{cal:89,protein:1,carbs:23,fat:0,fiber:3,sodium:1},color:"#F5A623"},
  ],
  lunch:[
    {id:4,name:"Grilled Chicken Breast",grams:150,per100:{cal:165,protein:31,carbs:0,fat:4,fiber:0,sodium:74},color:"#FF6B4A"},
    {id:5,name:"Mixed Greens Salad",grams:100,per100:{cal:20,protein:2,carbs:3,fat:0,fiber:2,sodium:25},color:"#2ECC8F"},
  ],
  dinner:[],snacks:[],
};

function calc(item){
  const g=item.grams/100,m=item.per100;
  return{
    cal:Math.round(m.cal*g),
    protein:Math.round(m.protein*g*10)/10,
    carbs:Math.round(m.carbs*g*10)/10,
    fat:Math.round(m.fat*g*10)/10,
    fiber:Math.round(m.fiber*g*10)/10,
    sodium:Math.round(m.sodium*g),
  };
}

function totals(log){
  return Object.values(log).flat().reduce((a,item)=>{
    const m=calc(item);
    return{cal:a.cal+m.cal,protein:Math.round((a.protein+m.protein)*10)/10,carbs:Math.round((a.carbs+m.carbs)*10)/10,fat:Math.round((a.fat+m.fat)*10)/10,fiber:Math.round((a.fiber+m.fiber)*10)/10,sodium:a.sodium+m.sodium};
  },{cal:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0});
}

// ── API KEY CONFIGURATION ──────────────────────────────────────
// Paste your free USDA FoodData Central key here:
// Get one free at: https://fdc.nal.usda.gov/api-guide.html
const USDA_API_KEY = "DEMO_KEY"; // Replace with your key for full access

// ── LOCAL FOOD DATABASE ────────────────────────────────────────
const LOCAL_FOOD_DB=[
  // Branded grocery items
  {name:"Real Good Chicken Tenders",brand:"Real Good Foods",servingG:85,per100:{cal:176,protein:24,carbs:2,fat:8,fiber:0,sodium:400}},
  {name:"Real Good Chicken Enchiladas",brand:"Real Good Foods",servingG:227,per100:{cal:106,protein:13,carbs:4,fat:4,fiber:0,sodium:330}},
  {name:"Real Good Pizza (Pepperoni)",brand:"Real Good Foods",servingG:128,per100:{cal:266,protein:23,carbs:5,fat:17,fiber:0,sodium:600}},
  {name:"Fairlife Whole Milk",brand:"Fairlife",servingG:240,per100:{cal:63,protein:6.3,carbs:5,fat:3.3,fiber:0,sodium:50}},
  {name:"Fairlife 2% Milk",brand:"Fairlife",servingG:240,per100:{cal:54,protein:6.3,carbs:5,fat:2.1,fiber:0,sodium:50}},
  {name:"Fairlife Fat Free Milk",brand:"Fairlife",servingG:240,per100:{cal:42,protein:6.3,carbs:5,fat:0,fiber:0,sodium:55}},
  {name:"Fairlife Core Power (Chocolate)",brand:"Fairlife",servingG:414,per100:{cal:60,protein:9.9,carbs:5.5,fat:1.5,fiber:0,sodium:60}},
  {name:"Fairlife Core Power (Vanilla)",brand:"Fairlife",servingG:414,per100:{cal:58,protein:9.9,carbs:5.3,fat:1.4,fiber:0,sodium:58}},
  {name:"Fairlife Chocolate Milk (2%)",brand:"Fairlife",servingG:240,per100:{cal:75,protein:6.3,carbs:9.6,fat:2.1,fiber:0,sodium:55}},
  {name:"Chobani Plain Greek Yogurt (0%)",brand:"Chobani",servingG:150,per100:{cal:59,protein:10,carbs:4,fat:0,fiber:0,sodium:45}},
  {name:"Chobani Plain Greek Yogurt (2%)",brand:"Chobani",servingG:150,per100:{cal:80,protein:9,carbs:5,fat:2,fiber:0,sodium:50}},
  {name:"Siggi's Plain Yogurt (0%)",brand:"Siggi's",servingG:150,per100:{cal:63,protein:11,carbs:4,fat:0,fiber:0,sodium:53}},
  {name:"RXBAR Chocolate Sea Salt",brand:"RXBAR",servingG:52,per100:{cal:219,protein:23,carbs:37,fat:8,fiber:6,sodium:277}},
  {name:"RXBAR Blueberry",brand:"RXBAR",servingG:52,per100:{cal:210,protein:21,carbs:38,fat:7,fiber:6,sodium:200}},
  {name:"Quest Bar Chocolate Chip Cookie Dough",brand:"Quest",servingG:60,per100:{cal:367,protein:35,carbs:47,fat:12,fiber:27,sodium:350}},
  {name:"Quest Bar Cookies & Cream",brand:"Quest",servingG:60,per100:{cal:367,protein:35,carbs:47,fat:12,fiber:27,sodium:340}},
  {name:"Built Bar Chocolate Mint",brand:"Built Bar",servingG:53,per100:{cal:221,protein:30,carbs:25,fat:4,fiber:13,sodium:188}},
  {name:"Kirkland Canned Chicken",brand:"Kirkland/Costco",servingG:56,per100:{cal:109,protein:25,carbs:0,fat:1,fiber:0,sodium:330}},
  {name:"Kirkland Protein Bar (Chocolate Chip)",brand:"Kirkland/Costco",servingG:60,per100:{cal:333,protein:33,carbs:43,fat:10,fiber:17,sodium:333}},
  {name:"Applegate Natural Turkey Breast",brand:"Applegate",servingG:56,per100:{cal:80,protein:18,carbs:1,fat:1,fiber:0,sodium:500}},
  {name:"Rao's Marinara Sauce",brand:"Rao's",servingG:125,per100:{cal:80,protein:2,carbs:8,fat:4,fiber:2,sodium:280}},
  // Generic whole foods
  {name:"White Rice (cooked)",brand:"Generic",servingG:100,per100:{cal:130,protein:2.7,carbs:28,fat:0.3,fiber:0.4,sodium:1}},
  {name:"Chicken Breast (grilled)",brand:"Generic",servingG:100,per100:{cal:165,protein:31,carbs:0,fat:3.6,fiber:0,sodium:74}},
  {name:"Whole Egg (large)",brand:"Generic",servingG:50,per100:{cal:155,protein:13,carbs:1.1,fat:11,fiber:0,sodium:124}},
  {name:"Oatmeal (dry)",brand:"Generic",servingG:40,per100:{cal:389,protein:17,carbs:66,fat:7,fiber:11,sodium:6}},
  {name:"Banana",brand:"Generic",servingG:118,per100:{cal:89,protein:1.1,carbs:23,fat:0.3,fiber:2.6,sodium:1}},
  {name:"Salmon (cooked)",brand:"Generic",servingG:100,per100:{cal:208,protein:20,carbs:0,fat:13,fiber:0,sodium:59}},
  {name:"Sweet Potato",brand:"Generic",servingG:130,per100:{cal:86,protein:1.6,carbs:20,fat:0.1,fiber:3,sodium:55}},
  {name:"Brown Rice (cooked)",brand:"Generic",servingG:100,per100:{cal:216,protein:5,carbs:45,fat:1.8,fiber:3.5,sodium:10}},
  {name:"Almonds",brand:"Generic",servingG:28,per100:{cal:579,protein:21,carbs:22,fat:50,fiber:12.5,sodium:1}},
  {name:"Broccoli",brand:"Generic",servingG:100,per100:{cal:34,protein:2.8,carbs:7,fat:0.4,fiber:2.6,sodium:33}},
  {name:"Ground Beef 80/20",brand:"Generic",servingG:100,per100:{cal:254,protein:17,carbs:0,fat:20,fiber:0,sodium:72}},
  {name:"Cheddar Cheese",brand:"Generic",servingG:28,per100:{cal:403,protein:25,carbs:1.3,fat:33,fiber:0,sodium:621}},
  {name:"Avocado",brand:"Generic",servingG:100,per100:{cal:160,protein:2,carbs:9,fat:15,fiber:7,sodium:7}},
  {name:"Peanut Butter",brand:"Generic",servingG:32,per100:{cal:588,protein:25,carbs:20,fat:50,fiber:6,sodium:459}},
  {name:"Pasta (cooked)",brand:"Generic",servingG:140,per100:{cal:158,protein:5.8,carbs:31,fat:0.9,fiber:1.8,sodium:1}},
  {name:"Bread (whole wheat)",brand:"Generic",servingG:28,per100:{cal:247,protein:13,carbs:41,fat:4.2,fiber:7,sodium:400}},
  {name:"Apple",brand:"Generic",servingG:182,per100:{cal:52,protein:0.3,carbs:14,fat:0.2,fiber:2.4,sodium:1}},
  {name:"Tuna (canned in water)",brand:"Generic",servingG:85,per100:{cal:109,protein:25,carbs:0,fat:1,fiber:0,sodium:320}},
  {name:"Milk (whole)",brand:"Generic",servingG:240,per100:{cal:61,protein:3.2,carbs:4.8,fat:3.3,fiber:0,sodium:43}},
  {name:"Cottage Cheese (low fat)",brand:"Generic",servingG:113,per100:{cal:72,protein:12,carbs:3,fat:1,fiber:0,sodium:320}},
  {name:"Olive Oil",brand:"Generic",servingG:14,per100:{cal:884,protein:0,carbs:0,fat:100,fiber:0,sodium:2}},
  {name:"Greek Yogurt (plain)",brand:"Generic",servingG:150,per100:{cal:59,protein:10,carbs:3.6,fat:0.4,fiber:0,sodium:36}},
];

// ── LOCAL SUPPLEMENT DATABASE ──────────────────────────────────
const SUPP_DB=[
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

function searchLocalFood(query){
  const q=query.toLowerCase().trim();
  const words=q.split(/\s+/).filter(w=>w.length>2);
  return LOCAL_FOOD_DB
    .map(f=>{
      const n=f.name.toLowerCase();
      const b=(f.brand||"").toLowerCase();
      // Score: full match scores higher than partial keyword match
      let score=0;
      if(n.includes(q)||b.includes(q))score+=10;
      words.forEach(w=>{if(n.includes(w)||b.includes(w))score+=1;});
      return{...f,_score:score};
    })
    .filter(f=>f._score>0)
    .sort((a,b)=>b._score-a._score)
    .slice(0,8)
    .map(({_score,...f})=>f);
}

function searchLocalSupp(query){
  const q=query.toLowerCase().trim();
  const words=q.split(/\s+/).filter(w=>w.length>2);
  return SUPP_DB
    .map(s=>{
      const n=s.name.toLowerCase();
      const b=(s.brand||"").toLowerCase();
      const c=(s.category||"").toLowerCase();
      let score=0;
      if(n.includes(q)||b.includes(q)||c.includes(q))score+=10;
      words.forEach(w=>{if(n.includes(w)||b.includes(w)||c.includes(w))score+=1;});
      return{...s,_score:score};
    })
    .filter(s=>s._score>0)
    .sort((a,b)=>b._score-a._score)
    .slice(0,8)
    .map(({_score,...s})=>s);
}

async function searchUSDA(query){
  try{
    const url=`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded,Foundation,SR%20Legacy&pageSize=10&api_key=${USDA_API_KEY}`;
    const res=await fetch(url);
    if(!res.ok)throw new Error("USDA "+res.status);
    const data=await res.json();
    return(data.foods||[])
      .filter(f=>f.description&&f.foodNutrients&&f.foodNutrients.length>0)
      .map(f=>{
        // USDA returns nutrient IDs — map common ones
        const byId={};
        const byName={};
        (f.foodNutrients||[]).forEach(n=>{
          if(n.nutrientId)byId[n.nutrientId]=n.value||0;
          if(n.nutrientName)byName[n.nutrientName.toLowerCase()]=n.value||0;
        });
        // Energy: 1008=kcal, 1062=kcal
        const cal=byId[1008]||byId[1062]||byName["energy"]||0;
        if(!cal)return null;
        return{
          name:f.description,
          brand:f.brandOwner||f.brandName||f.publishedDate||"",
          servingG:f.servingSize||null,
          per100:{
            cal:Math.round(cal),
            protein:Math.round((byId[1003]||byName["protein"]||0)*10)/10,
            carbs:Math.round((byId[1005]||byName["carbohydrate, by difference"]||byName["carbohydrate"]||0)*10)/10,
            fat:Math.round((byId[1004]||byName["total lipid (fat)"]||byName["fat"]||0)*10)/10,
            fiber:Math.round((byId[1079]||byName["fiber, total dietary"]||byName["fiber"]||0)*10)/10,
            sodium:Math.round((byId[1093]||byName["sodium, na"]||byName["sodium"]||0)),
          }
        };
      })
      .filter(Boolean)
      .slice(0,6);
  }catch(e){
    console.warn("USDA search failed:",e.message);
    return [];
  }
}

async function searchOFF(query){
  // Try two OFF endpoints — v2 search is more reliable for CORS
  const urls=[
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,nutriments,brands,serving_quantity`,
    `https://world.openfoodfacts.net/api/v2/search?q=${encodeURIComponent(query)}&page_size=8&fields=product_name,nutriments,brands,serving_quantity`,
  ];
  for(const url of urls){
    try{
      const res=await fetch(url,{mode:"cors",headers:{Accept:"application/json"}});
      if(!res.ok)continue;
      const data=await res.json();
      const products=data.products||data.foods||[];
      const results=products
        .filter(p=>p.product_name&&p.nutriments&&(p.nutriments["energy-kcal_100g"]>0||p.nutriments["energy_100g"]>0))
        .slice(0,6)
        .map(p=>({
          name:p.product_name.trim(),
          brand:(p.brands||"").split(",")[0].trim(),
          servingG:parseFloat(p.serving_quantity)||null,
          per100:{
            cal:Math.round(p.nutriments["energy-kcal_100g"]||p.nutriments["energy_100g"]/4.184||0),
            protein:Math.round((p.nutriments["proteins_100g"]||0)*10)/10,
            carbs:Math.round((p.nutriments["carbohydrates_100g"]||0)*10)/10,
            fat:Math.round((p.nutriments["fat_100g"]||0)*10)/10,
            fiber:Math.round((p.nutriments["fiber_100g"]||0)*10)/10,
            sodium:Math.round((p.nutriments["sodium_100g"]||0)*1000),
          }
        }));
      if(results.length>0)return results;
    }catch(e){
      console.warn("OFF search failed:",e.message);
    }
  }
  return [];
}

// Deduplicate by normalised name prefix
function dedup(arr){
  const seen=new Set();
  return arr.filter(r=>{
    const key=r.name.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,18);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

// Main food search — always runs ALL sources in parallel, merges results
async function searchFood(query,customFoods=[]){
  if(!query||!query.trim())return[];
  const q=query.toLowerCase().trim();
  const custom=(customFoods||[]).filter(f=>
    f.name.toLowerCase().includes(q)||(f.brand||"").toLowerCase().includes(q)
  ).map(f=>({...f,isCustom:true}));
  const local=searchLocalFood(query);
  // Always fire external APIs in parallel — don't short-circuit on local hits
  const [usdaR,offR]=await Promise.allSettled([searchUSDA(query),searchOFF(query)]);
  const usda=usdaR.status==="fulfilled"?usdaR.value:[];
  const off=offR.status==="fulfilled"?offR.value:[];
  // Priority: custom → local → USDA → OFF
  return dedup([...custom,...local,...usda,...off]).slice(0,10);
}

// Supplement search — always runs local + USDA in parallel
async function searchSupp(query){
  if(!query||!query.trim())return[];
  const local=searchLocalSupp(query).map(s=>({...s,isSupp:true}));
  try{
    const url=`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded&pageSize=8&api_key=${USDA_API_KEY}`;
    const res=await fetch(url);
    if(!res.ok)throw new Error();
    const data=await res.json();
    const usdaSupps=(data.foods||[])
      .filter(f=>f.description&&f.foodNutrients)
      .map(f=>{
        const byId={};(f.foodNutrients||[]).forEach(n=>{if(n.nutrientId)byId[n.nutrientId]=n.value||0;});
        const cal=byId[1008]||byId[1062]||0;
        return{
          name:f.description,brand:f.brandOwner||"",
          category:"Supplement",servingG:f.servingSize||null,isSupp:true,
          per100:{
            cal:Math.round(cal),
            protein:Math.round((byId[1003]||0)*10)/10,
            carbs:Math.round((byId[1005]||0)*10)/10,
            fat:Math.round((byId[1004]||0)*10)/10,
            fiber:Math.round((byId[1079]||0)*10)/10,
            sodium:Math.round(byId[1093]||0),
          }
        };
      })
      .filter(f=>f.name)
      .slice(0,5);
    return dedup([...local,...usdaSupps]).slice(0,10);
  }catch{
    return local;
  }
}


function CheckIcon({done,size=12}){
  const T=useTheme();
  return done
    ?<svg width={size} height={size} viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
    :<svg width={size} height={size} viewBox="0 0 12 12"><line x1="3" y1="3" x2="9" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="3" x2="3" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

function GoalDots({dd,size=6}){
  const T=useTheme();
  if(!dd)return null;
  if(dd.food&&dd.workout&&dd.supp)return(
    <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#2ECC8F"/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
  );
  return(
    <div style={{display:"flex",gap:2,flexWrap:"wrap",justifyContent:"center"}}>
      {dd.food&&<div style={{width:size,height:size,borderRadius:"50%",background:"#2ECC8F"}}/>}
      {dd.workout&&<div style={{width:size,height:size,borderRadius:"50%",background:"#5B8DEF"}}/>}
      {dd.supp&&<div style={{width:size,height:size,borderRadius:"50%",background:"#F5A623"}}/>}
    </div>
  );
}

const SUPP_CATS=["All","Protein","Creatine","Pre-Workout","BCAAs","Vitamins","Omega-3","Electrolytes","Sleep","Collagen","Probiotic","Multivitamin","Greens/Multi"];
const DOT_COLORS={"Protein":"#FF6B4A","Creatine":"#5B8DEF","Pre-Workout":"#E24B4A","BCAAs":"#9B6DFF","Vitamins":"#F5A623","Omega-3":"#2ECC8F","Electrolytes":"#5B8DEF","Sleep":"#9B6DFF","Collagen":"#FF6B4A","Probiotic":"#2ECC8F","Multivitamin":"#F5A623","Greens/Multi":"#2ECC8F","Supplement":"#888"};
// ── AI INTENT PARSER ───────────────────────────────────────────
// Parses a message for food/supplement add intent and returns a match or null
function parseIntent(text){
  const t=text.toLowerCase();

  // Detect add intent words
  const addWords=["add","log","ate","had","just had","track","eaten","eating","drank","drink","took","take","logged"];
  const suppWords=["supplement","supp","vitamin","protein","creatine","omega","magnesium","zinc","probiotic","melatonin","bcaa","pre-workout","collagen","fish oil","b12","d3","multivitamin","ashwagandha"];
  const hasAdd=addWords.some(w=>t.includes(w));
  if(!hasAdd)return null;

  // Check if it's a supplement
  const isSuppIntent=suppWords.some(w=>t.includes(w));

  // Extract quantity — look for number + unit patterns
  const qtyMatch=t.match(/(\d+\.?\d*)\s*(g|grams?|oz|ounces?|ml|cups?|tbsp|tablespoons?|tsp|teaspoons?|servings?|scoops?|tablets?|pills?|capsules?|mg|iu)/i);
  const numOnly=t.match(/\b(\d+\.?\d*)\b/);
  const qty=qtyMatch?{amount:parseFloat(qtyMatch[1]),unit:qtyMatch[2].toLowerCase()}
    :numOnly?{amount:parseFloat(numOnly[1]),unit:"g"}
    :{amount:100,unit:"g"};

  // Try to match against LOCAL_FOOD_DB
  if(!isSuppIntent){
    const match=LOCAL_FOOD_DB.find(f=>{
      const fname=f.name.toLowerCase();
      // Split food name into keywords and check if any appear in message
      return fname.split(/[\s()]+/).some(kw=>kw.length>3&&t.includes(kw));
    });
    if(match){
      // Convert qty to grams
      let grams=qty.amount;
      if(qty.unit.startsWith("cup"))grams=match.servingG?match.servingG*qty.amount:qty.amount*240;
      else if(qty.unit.startsWith("oz"))grams=qty.amount*28.35;
      else if(qty.unit.startsWith("ml"))grams=qty.amount;
      else if(qty.unit.startsWith("serving")||qty.unit.startsWith("scoop"))grams=match.servingG?match.servingG*qty.amount:qty.amount*30;
      else if(qty.unit==="g"||qty.unit.startsWith("gram"))grams=qty.amount;
      return{type:"food",item:match,grams:Math.round(grams),slot:"snacks"};
    }
  }

  // Try to match against SUPP_DB
  const suppMatch=SUPP_DB.find(s=>{
    const sname=s.name.toLowerCase();
    return sname.split(/[\s()]+/).some(kw=>kw.length>3&&t.includes(kw));
  });
  if(suppMatch)return{type:"supp",item:suppMatch};

  return null;
}

// ── SIDE RAIL AI PANEL ──────────────────────────────────────────
function AISidePanel({open,onClose,onAddFood,onAddSupp}){
  const T=useTheme();
  const [messages,setMessages]=useState([
    {bot:true,text:"Hey Johnny! I'm your AI Coach powered by Claude. Ask me anything about nutrition, workouts, or recovery — or just say \"I just had a cup of white rice\" and I'll log it for you. 🍽💊"},
  ]);
  const [input,setInput]=useState("");
  const [thinking,setThinking]=useState(false);
  const bottomRef=useRef();

  // Build a system prompt that gives Claude context about the app
  const SYSTEM=`You are an expert fitness and nutrition AI coach built into a personal fitness tracking app. The user's name is Johnny.

You help with:
- Nutrition advice, meal planning, macro targets, and calorie goals
- Workout programming, exercise form, recovery, and progressive overload
- Supplement advice (timing, dosing, what's worth taking)
- Motivation, habit building, and general wellness

Keep responses concise and conversational — this is a mobile chat panel so keep replies under 3-4 sentences unless the user asks for detail. Be direct, positive, and knowledgeable. Use specific numbers and actionable advice.

The app tracks: calories, protein, carbs, fat, fiber, sodium, workouts with sets/reps/weight, and supplements. The user's daily calorie goal is 2,200 kcal with targets of 140g protein, 180g carbs, 78g fat.

If the user says they logged or ate something, confirm it encouragingly and give a brief nutrition insight about that food.`;

  const callClaude=async(userMsg,history)=>{
    // Build message history for context (last 10 messages)
    const contextMsgs=history
      .filter(m=>!m.type) // skip special action cards
      .slice(-10)
      .map(m=>({role:m.bot?"assistant":"user",content:m.text}));

    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:1000,
        system:SYSTEM,
        messages:[...contextMsgs,{role:"user",content:userMsg}],
      }),
    });
    if(!res.ok)throw new Error("API error "+res.status);
    const data=await res.json();
    return data.content?.[0]?.text||"Sorry, I couldn't get a response. Try again!";
  };

  const send=async(text)=>{
    const msg=text||input.trim();
    if(!msg||thinking)return;
    setInput("");
    const userMsg={bot:false,text:msg};
    setMessages(prev=>[...prev,userMsg]);

    // First check for food/supplement logging intent (local, instant)
    const intent=parseIntent(msg);
    if(intent&&intent.type==="food"&&onAddFood){
      const m=calc({...intent.item,grams:intent.grams});
      onAddFood(intent.slot,{
        id:Date.now(),name:intent.item.name,grams:intent.grams,
        per100:intent.item.per100,color:COLORS[Math.floor(Math.random()*COLORS.length)],
      });
      // Also ask Claude for a brief insight about that food
      setThinking(true);
      try{
        const insight=await callClaude(`I just logged ${intent.grams}g of ${intent.item.name}. Give me one short sentence about its nutritional benefits.`,messages);
        setMessages(prev=>[...prev,{
          bot:true,type:"food_logged",
          foodName:intent.item.name,grams:intent.grams,
          cal:m.cal,protein:m.protein,carbs:m.carbs,fat:m.fat,
          slot:intent.slot,text:insight,
        }]);
      }catch{
        setMessages(prev=>[...prev,{
          bot:true,type:"food_logged",
          foodName:intent.item.name,grams:intent.grams,
          cal:m.cal,protein:m.protein,carbs:m.carbs,fat:m.fat,
          slot:intent.slot,
          text:`Logged! ${intent.grams}g of ${intent.item.name} added to your ${intent.slot}.`,
        }]);
      }
      setThinking(false);
      return;
    }

    if(intent&&intent.type==="supp"&&onAddSupp){
      onAddSupp(intent.item);
      setThinking(true);
      try{
        const insight=await callClaude(`I just took ${intent.item.name}. Give me one short sentence about the best time or way to take it for maximum benefit.`,messages);
        setMessages(prev=>[...prev,{
          bot:true,type:"supp_logged",suppName:intent.item.name,text:insight,
        }]);
      }catch{
        setMessages(prev=>[...prev,{
          bot:true,type:"supp_logged",suppName:intent.item.name,
          text:`${intent.item.name} added to your stack and marked taken ✓`,
        }]);
      }
      setThinking(false);
      return;
    }

    // General question — call Claude API
    setThinking(true);
    try{
      const reply=await callClaude(msg,[...messages,userMsg]);
      setMessages(prev=>[...prev,{bot:true,text:reply}]);
    }catch(err){
      setMessages(prev=>[...prev,{
        bot:true,
        text:"I'm having trouble connecting right now. Check your internet connection and try again!",
      }]);
    }
    setThinking(false);
  };

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,thinking]);

  const renderMsg=(m,i)=>{
    if(m.type==="food_logged"){
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"95%",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:`linear-gradient(135deg,${T.bannerFrom},${T.bannerTo})`,borderRadius:12,padding:"10px 12px",color:"#fff"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Logged to {m.slot}</div>
            <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>{m.foodName} · {m.grams}g</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
              {[["Cal",m.cal,"#A855F7"],["Prot",m.protein+"g","#EC4899"],["Carbs",m.carbs+"g","#06B6D4"],["Fat",m.fat+"g","#10B981"]].map(([l,v,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:7,padding:"5px 3px",textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if(m.type==="supp_logged"){
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"95%",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:T.accentPill,border:`1px solid ${T.accent}`,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>💊</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.accent}}>{m.suppName}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:1}}>Added to stack &amp; marked taken ✓</div>
            </div>
          </div>
        </div>
      );
    }
    return(
      <div key={i} style={{maxWidth:"90%",padding:"9px 12px",borderRadius:m.bot?"14px 14px 14px 3px":"14px 14px 3px 14px",fontSize:13,lineHeight:1.5,background:m.bot?T.surface:T.accent,color:m.bot?T.text:"#fff",alignSelf:m.bot?"flex-start":"flex-end"}}>{m.text}</div>
    );
  };

  return(
    <>
      {open&&<div onClick={onClose} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.15)",zIndex:150}}/>}
      <div style={{
        position:"fixed",top:0,right:0,height:"100%",
        width:open?"min(300px, 82vw)":0,
        background:T.card,
        borderLeft:open?`1px solid ${T.border}`:"none",
        zIndex:160,
        transition:"width 0.3s cubic-bezier(.4,0,.2,1)",
        overflow:"hidden",
        display:"flex",flexDirection:"column",
        maxWidth:"80%",
      }}>
        <div style={{width:"100%",display:"flex",flexDirection:"column",height:"100%"}}>
          {/* Header */}
          <div style={{padding:"16px 14px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,background:thinking?"#F59E0B":T.accent,borderRadius:"50%",transition:"background 0.3s",boxShadow:thinking?"0 0 8px #F59E0B":""}}/>
              <div style={{fontSize:15,fontWeight:600,color:T.text}}>AI Coach</div>
              {thinking&&<div style={{fontSize:11,color:"#F59E0B",fontWeight:500}}>thinking…</div>}
            </div>
            <div onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"12px 12px 8px",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((m,i)=>renderMsg(m,i))}
            {/* Typing indicator */}
            {thinking&&(
              <div style={{alignSelf:"flex-start",background:T.surface,borderRadius:"14px 14px 14px 3px",padding:"10px 14px",display:"flex",gap:5,alignItems:"center"}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.accent,opacity:0.8,animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>
                ))}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Quick chips */}
          <div style={{padding:"0 10px 8px",display:"flex",gap:6,flexWrap:"wrap"}}>
            {["What should I eat?","Build my meal plan","Log white rice","Best pre-workout?"].map(c=>(
              <div key={c} onClick={()=>!thinking&&send(c)} style={{background:T.surface,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:500,cursor:thinking?"not-allowed":"pointer",whiteSpace:"nowrap",color:thinking?T.muted:T.text,opacity:thinking?0.5:1}}>{c}</div>
            ))}
          </div>

          {/* Input */}
          <div style={{padding:"8px 10px 20px",borderTop:`1px solid ${T.border}`,display:"flex",gap:6,flexShrink:0}}>
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!thinking&&send()}
              placeholder={thinking?"Claude is thinking…":"Ask anything or log food/supps..."}
              disabled={thinking}
              style={{flex:1,background:T.surface,color:T.text,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:20,padding:"8px 12px",fontSize:13,outline:"none",opacity:thinking?0.6:1}}
            />
            <button
              onClick={()=>!thinking&&send()}
              disabled={thinking}
              style={{width:34,height:34,borderRadius:"50%",background:thinking?T.muted:T.accent,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:thinking?"not-allowed":"pointer",flexShrink:0,transition:"background 0.2s"}}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L12 2L9 7L12 12L2 7Z" fill="white"/></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── SUPPLEMENT SEARCH PANEL ──────────────────────────────────────

function SuppSearchPanel({suppList,suppTaken,setSuppTaken,addSuppToList}){
  const T=useTheme();
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false);
  const [cat,setCat]=useState("All");
  const [showCreate,setShowCreate]=useState(false);
  const [newName,setNewName]=useState("");
  const [newDose,setNewDose]=useState("");
  const [newCat,setNewCat]=useState("Supplement");
  const [createSaved,setCreateSaved]=useState(false);

  const taken=suppList.filter(s=>suppTaken[s.k]).length;
  const total=suppList.length;
  const browsing=!query.trim()&&!searched;
  const displayed=browsing
    ?(cat==="All"?SUPP_DB:SUPP_DB.filter(s=>s.category===cat)).slice(0,12)
    :results;

  const doSearch=async()=>{
    if(!query.trim())return;
    setLoading(true);setResults([]);setSearched(false);setShowCreate(false);
    try{
      const r=await searchSupp(query);
      setResults(r);
      setSearched(true);
      if(r.length===0)setShowCreate(true);
    }catch{
      const fallback=searchLocalSupp(query).map(s=>({...s,isSupp:true}));
      setResults(fallback);
      setSearched(true);
      if(fallback.length===0)setShowCreate(true);
    }
    setLoading(false);
  };

  const clearSearch=()=>{setQuery("");setResults([]);setSearched(false);setShowCreate(false);};

  const addFromSearch=(s)=>{
    addSuppToList({k:"s"+Date.now(),name:s.name,sub:`${s.servingG?s.servingG+"g · ":""}${s.brand||s.category||"Supplement"}`,dot:DOT_COLORS[s.category]||"#888"});
    clearSearch();
  };

  const saveCustom=()=>{
    if(!newName.trim())return;
    addSuppToList({k:"m"+Date.now(),name:newName.trim(),sub:newDose.trim()||newCat,dot:DOT_COLORS[newCat]||"#888"});
    setCreateSaved(true);
    setTimeout(()=>{
      setCreateSaved(false);setNewName("");setNewDose("");setNewCat("Supplement");
      setShowCreate(false);clearSearch();
    },900);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Stats */}
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1,background:T.greenBg,borderRadius:12,padding:"12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:600,color:T.green}}>{taken}/{total}</div>
          <div style={{fontSize:12,color:T.green,marginTop:2}}>taken today</div>
        </div>
        <div style={{flex:1,background:"rgba(249,115,22,0.1)",borderRadius:12,padding:"12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:600,color:"#F97316"}}>{total-taken}</div>
          <div style={{fontSize:12,color:"#F97316",marginTop:2}}>remaining</div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{display:"flex",gap:8,width:"100%"}}>
        <input
          value={query}
          onChange={e=>{setQuery(e.target.value);if(!e.target.value.trim()){setResults([]);setSearched(false);setShowCreate(false);}}}
          onKeyDown={e=>e.key==="Enter"&&doSearch()}
          placeholder="Search supplements (e.g. Creatine, AG1...)"
          style={{flex:1,minWidth:0,background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none"}}
        />
        <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,flexShrink:0,minWidth:64}}>
          {loading?"…":"Search"}
        </button>
      </div>

      {/* Category chips — browsing only */}
      {browsing&&(
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
          {["All","Protein","Creatine","Vitamins","Omega-3","Pre-Workout","Electrolytes","Sleep"].map(c=>(
            <div key={c} onClick={()=>setCat(c)} style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:`1px solid ${T.border}`,background:cat===c?T.accent:T.card,color:cat===c?"#fff":T.muted,whiteSpace:"nowrap",flexShrink:0}}>{c}</div>
          ))}
        </div>
      )}

      {/* Results */}
      {displayed.length>0&&(
        <div>
          <div style={{fontSize:12,color:T.muted,marginBottom:8}}>{browsing?"Browse & add to your stack":"Tap to add to your stack"}</div>
          {displayed.map((s,i)=>(
            <div key={i} onClick={()=>addFromSearch(s)} style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",marginBottom:7,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:DOT_COLORS[s.category]||"#888",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,lineHeight:1.3}}>{s.name}</div>
                <div style={{fontSize:11,color:T.muted,marginTop:1}}>{s.brand||""}{s.category?` · ${s.category}`:""}{s.servingG?` · ${s.servingG}g/serving`:""}</div>
              </div>
              <div style={{width:26,height:26,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="10" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round"/><line x1="2" y1="6" x2="10" y2="6" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results state — show create option */}
      {searched&&results.length===0&&!showCreate&&(
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:14,color:T.muted}}>No results for "{query}"</div>
          <div onClick={()=>setShowCreate(true)} style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:6,background:T.accentPill,border:`1px solid ${T.border}`,borderRadius:20,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}>
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
            Create "{query}"
          </div>
        </div>
      )}

      {/* Create supplement form */}
      {showCreate&&(
        <div style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:T.accentPill,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="8.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.8" fill={T.accent}/></svg>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.accent}}>No results found</div>
              <div style={{fontSize:11,color:T.muted,marginTop:1}}>Create a custom supplement and it'll be saved to your stack.</div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>Create supplement</div>
            <div onClick={()=>{setShowCreate(false);}} style={{fontSize:12,color:T.muted,cursor:"pointer"}}>Cancel</div>
          </div>
          <input
            value={newName} onChange={e=>setNewName(e.target.value)}
            placeholder="Name (e.g. Ashwagandha 600mg)"
            style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}
          />
          <input
            value={newDose} onChange={e=>setNewDose(e.target.value)}
            placeholder="Dose & timing (e.g. 600mg · Morning)"
            style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}
          />
          <div>
            <div style={{fontSize:12,color:T.muted,marginBottom:7}}>Category</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Protein","Vitamins","Creatine","Omega-3","Pre-Workout","Sleep","Supplement"].map(c=>(
                <div key={c} onClick={()=>setNewCat(c)} style={{padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:`1px solid ${T.border}`,background:newCat===c?T.accent:T.card,color:newCat===c?"#fff":T.muted}}>{c}</div>
              ))}
            </div>
          </div>
          <button
            onClick={saveCustom}
            disabled={!newName.trim()}
            style={{background:createSaved?"#22C55E":(!newName.trim()?T.muted:T.accent),border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,fontWeight:600,cursor:newName.trim()?"pointer":"not-allowed",transition:"background 0.2s"}}
          >
            {createSaved?"Added to stack ✓":"Add to my stack"}
          </button>
        </div>
      )}

      {/* Stack divider */}
      {!showCreate&&(
      <div>
        <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}}>Your stack</div>
        <div style={{background:T.card,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,overflow:"hidden"}}>
          {suppList.map(({k,name,sub,dot},i)=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:i<suppList.length-1?`1px solid ${T.border}`:"none"}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:dot,flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:T.text}}>{name}</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{sub}</div></div>
              <div onClick={()=>setSuppTaken(p=>({...p,[k]:!p[k]}))} style={{width:44,height:26,borderRadius:13,background:suppTaken[k]?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:suppTaken[k]?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
          ))}
        </div>
        {/* Add custom shortcut */}
        <div onClick={()=>{setShowCreate(true);setNewName("");}} style={{marginTop:10,border:`1.5px dashed ${T.border}`,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.muted} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{fontSize:13,color:T.muted,fontWeight:500}}>Add custom supplement</div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── QUICK-ADD PANEL ─────────────────────────────────────────────
function QuickAddPanel({open,onClose,onAddItem,suppList,suppTaken,setSuppTaken,addSuppToList,customFoods,addCustomFood}){
  const T=useTheme();
  const [mode,setMode]=useState("food"); // "food" | "supps"
  const [foodView,setFoodView]=useState("search"); // "search" | "create"
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState(null);
  const [servingMode,setServingMode]=useState("g");
  const [grams,setGrams]=useState("100");
  const [servings,setServings]=useState("1");
  const [targetSlot,setTargetSlot]=useState("snacks");
  const [added,setAdded]=useState(false);
  const searchRef=useRef();

  // Create food form state
  const [cf,setCf]=useState({name:"",brand:"",servingSize:"100",servingUnit:"g",cal:"",protein:"",carbs:"",fat:"",fiber:"",sugar:"",sodium:""});
  const [cfSaved,setCfSaved]=useState(false);

  const cfChange=(k,v)=>setCf(p=>({...p,[k]:v}));

  const cfPreview=cf.cal?(()=>{
    const s=parseFloat(cf.servingSize)||100;
    const per100={
      cal:Math.round((parseFloat(cf.cal)||0)/s*100),
      protein:Math.round((parseFloat(cf.protein)||0)/s*100*10)/10,
      carbs:Math.round((parseFloat(cf.carbs)||0)/s*100*10)/10,
      fat:Math.round((parseFloat(cf.fat)||0)/s*100*10)/10,
      fiber:Math.round((parseFloat(cf.fiber)||0)/s*100*10)/10,
      sugar:Math.round((parseFloat(cf.sugar)||0)/s*100*10)/10,
      sodium:Math.round((parseFloat(cf.sodium)||0)/s*100),
    };
    return{per100,servingCal:parseFloat(cf.cal)||0};
  })():null;

  const saveCustomFood=()=>{
    if(!cf.name.trim()||!cf.cal)return;
    const s=parseFloat(cf.servingSize)||100;
    const food={
      name:cf.name.trim(),
      brand:cf.brand.trim()||"My foods",
      servingG:s,
      isCustom:true,
      per100:{
        cal:Math.round((parseFloat(cf.cal)||0)/s*100),
        protein:Math.round((parseFloat(cf.protein)||0)/s*100*10)/10,
        carbs:Math.round((parseFloat(cf.carbs)||0)/s*100*10)/10,
        fat:Math.round((parseFloat(cf.fat)||0)/s*100*10)/10,
        fiber:Math.round((parseFloat(cf.fiber)||0)/s*100*10)/10,
        sugar:Math.round((parseFloat(cf.sugar)||0)/s*100*10)/10,
        sodium:Math.round((parseFloat(cf.sodium)||0)/s*100),
      }
    };
    addCustomFood(food);
    setCfSaved(true);
    setTimeout(()=>{
      setCfSaved(false);
      setCf({name:"",brand:"",servingSize:"100",servingUnit:"g",cal:"",protein:"",carbs:"",fat:"",fiber:"",sugar:"",sodium:""});
      setFoodView("search");
    },1200);
  };

  // Reset when panel opens
  useEffect(()=>{
    if(open){setQuery("");setResults([]);setSelected(null);setError("");setAdded(false);setGrams("100");setServings("1");setFoodView("search");}
  },[open]);

  const doSearch=async()=>{
    if(!query.trim())return;
    setError("");setSelected(null);
    // Show local results immediately so user gets instant feedback
    const localImmediate=[
      ...(customFoods||[]).filter(f=>f.name.toLowerCase().includes(query.toLowerCase())||(f.brand||"").toLowerCase().includes(query.toLowerCase())).map(f=>({...f,isCustom:true})),
      ...searchLocalFood(query),
    ];
    setResults(localImmediate);
    setLoading(true);
    try{
      const r=await searchFood(query,customFoods);
      setResults(r);
      if(r.length===0)setError("No results. Try a brand name like 'Real Good' or a food name.");
    }catch{
      if(localImmediate.length===0)setError("Search failed. Showing local results only.");
    }
    setLoading(false);
  };

  const getMacros=()=>{
    if(!selected)return null;
    let g=0;
    if(servingMode==="g"){g=parseFloat(grams)||0;}
    else{const sSize=selected.servingG||100;g=(parseFloat(servings)||0)*sSize;}
    if(g<=0)return null;
    return{g,macros:calc({...selected,grams:g})};
  };

  const preview=getMacros();

  const handleAdd=()=>{
    if(!selected||!preview)return;
    onAddItem(targetSlot,{
      id:Date.now(),name:selected.name,grams:preview.g,
      per100:selected.per100,
      color:COLORS[Math.floor(Math.random()*COLORS.length)],
    });
    setAdded(true);
    setTimeout(()=>{setAdded(false);setSelected(null);setQuery("");setResults([]);},900);
  };

  return(
    <>
      {open&&<div onClick={onClose} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",zIndex:140,backdropFilter:"blur(4px)"}}/>}
      <div style={{
        position:"fixed",
        top:"50%",left:"50%",
        width:"calc(100% - 32px)",maxWidth:460,
        background:T.card,
        borderRadius:20,
        zIndex:145,
        transition:"opacity 0.25s, transform 0.25s cubic-bezier(.34,1.56,.64,1)",
        transform:open?"translate(-50%,-50%) scale(1)":"translate(-50%,-50%) scale(0.94)",
        opacity:open?1:0,
        pointerEvents:open?"auto":"none",
        maxHeight:"88vh",
        display:"flex",flexDirection:"column",
        overflow:"hidden",
        boxSizing:"border-box",
        boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",
      }}>
        {/* Header */}
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:600}}>Quick add</div>
          <div onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{display:"flex",gap:8,padding:"12px 20px 0",flexShrink:0}}>
          {[["food","🍽 Food"],["supps","💊 Supplements"]].map(([m,l])=>(
            <div key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",border:`1px solid ${mode===m?T.accent:T.border}`,boxShadow:mode===m?T.glowShadow:"none",background:mode===m?T.accent:T.card,color:mode===m?"#fff":T.muted}}>{l}</div>
          ))}
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"14px 20px 36px"}}>

          {/* ── FOOD MODE ── */}
          {mode==="food"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              {/* Search / Create sub-toggle */}
              <div style={{display:"flex",gap:0,background:T.accentPill,borderRadius:12,padding:3}}>
                {[["search","🔍 Search foods"],["create","✏️ Create food"]].map(([v,l])=>(
                  <div key={v} onClick={()=>{setFoodView(v);setSelected(null);setResults([]);setCfSaved(false);}} style={{flex:1,padding:"8px 10px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",background:foodView===v?T.accent:"transparent",color:foodView===v?"#fff":T.muted,transition:"all 0.15s",boxShadow:foodView===v?`0 2px 8px ${T.accentGlow}`:"none"}}>{l}</div>
                ))}
              </div>

              {/* ── SEARCH VIEW ── */}
              {foodView==="search"&&(<>
              <div style={{display:"flex",gap:8,width:"100%"}}>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e=>setQuery(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&doSearch()}
                  placeholder="Search food (e.g. Fairlife milk...)"
                  style={{flex:1,minWidth:0,background:T.bg,color:T.text,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}
                />
                <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"11px 16px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,whiteSpace:"nowrap",flexShrink:0,minWidth:72}}>
                  {loading?"…":"Search"}
                </button>
              </div>
              {customFoods.length>0&&!query&&(
                <div>
                  <div style={{fontSize:12,color:T.muted,marginBottom:8}}>⭐ My saved foods</div>
                  {customFoods.slice(0,3).map((f,i)=>(
                    <div key={i} onClick={()=>{setSelected(f);setGrams(String(f.servingG||100));setServings("1");}} style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:12,padding:"10px 14px",marginBottom:6,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:9,height:9,borderRadius:"50%",background:T.accent,flexShrink:0}}/>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{f.name}</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{f.brand}</div></div>
                      <div style={{fontSize:12,fontWeight:600,color:T.text}}>{f.per100.cal} kcal/100g</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{fontSize:11,color:T.muted,marginTop:-8}}>Includes your saved foods, Fairlife, common brands &amp; more.</div>
              {error&&<div style={{fontSize:13,color:"#E24B4A",padding:"9px 12px",background:"rgba(248,113,113,0.1)",borderRadius:10}}>{error}</div>}

              {/* Loading indicator — shown while APIs are fetching more results */}
              {loading&&results.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",opacity:0.6}}>
                  <div style={{width:14,height:14,border:`2px solid ${T.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                  <div style={{fontSize:12,color:T.muted}}>Searching databases for more results…</div>
                </div>
              )}
              {loading&&results.length===0&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"24px 0"}}>
                  <div style={{width:18,height:18,border:`2px solid ${T.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                  <div style={{fontSize:13,color:T.muted}}>Searching…</div>
                </div>
              )}

              {/* No results → offer to create */}
              {!selected&&query&&results.length===0&&!loading&&(
                <div style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:10,alignItems:"center",textAlign:"center"}}>
                  <div style={{fontSize:13,color:T.muted}}>No results found for <span style={{fontWeight:600,color:T.text}}>"{query}"</span></div>
                  <div
                    onClick={()=>{setFoodView("create");setCfSaved(false);}}
                    style={{display:"inline-flex",alignItems:"center",gap:7,background:T.accentPill,border:`1px solid ${T.border}`,borderRadius:20,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Create "{query}"
                  </div>
                </div>
              )}

              {!selected&&results.map((r,i)=>(
                <div key={i} onClick={()=>{setSelected(r);setGrams(String(r.servingG||100));setServings("1");}} style={{background:r.isCustom?"#F0FBF6":"#fff",border:`1px solid ${r.isCustom?T.accent:T.border}`,borderRadius:12,padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:r.isCustom?T.accent:COLORS[i%COLORS.length],flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,lineHeight:1.3}}>{r.name}{r.isCustom&&<span style={{fontSize:10,color:T.accent,marginLeft:6,fontWeight:600}}>MY FOOD</span>}</div>
                    {r.brand&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>{r.brand}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:600}}>{r.per100.cal}</div><div style={{fontSize:10,color:T.muted}}>kcal/100g</div></div>
                </div>
              ))}
              {selected&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div onClick={()=>{setSelected(null);setResults([]);}} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                      <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="8,2 3,6 8,10" stroke={T.text} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                    </div>
                    <div><div style={{fontSize:14,fontWeight:600,lineHeight:1.2}}>{selected.name}</div>{selected.brand&&<div style={{fontSize:11,color:T.muted}}>{selected.brand}</div>}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {[["Cal",selected.per100.cal,"kcal","#2ECC8F"],["Prot",selected.per100.protein,"g","#FF6B4A"],["Carbs",selected.per100.carbs,"g","#F5A623"],["Fat",selected.per100.fat,"g","#5B8DEF"]].map(([l,v,u,c])=>(
                      <div key={l} style={{flex:1,background:T.bg,borderRadius:10,padding:"7px 4px",textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:600,color:c}}>{v}{u}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:1}}>{l}/100g</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {[["g","By grams"],["serving","By serving"]].map(([m,l])=>(
                      <div key={m} onClick={()=>setServingMode(m)} style={{flex:1,padding:"7px 10px",borderRadius:10,fontSize:12,fontWeight:500,textAlign:"center",cursor:"pointer",border:`1px solid ${T.border}`,boxShadow:T.glowShadow,background:servingMode===m?T.accent:T.card,color:servingMode===m?"#fff":T.muted}}>{l}</div>
                    ))}
                  </div>
                  {servingMode==="g"&&(
                    <div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:T.muted}}>Amount in grams</div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input type="number" value={grams} onChange={e=>setGrams(e.target.value)} min="1" style={{width:72,flexShrink:0,background:T.bg,border:`2px solid ${T.accent}`,borderRadius:10,padding:"9px 8px",fontSize:16,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{fontSize:13,color:T.muted,flexShrink:0}}>g</span>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                          {[50,100,150,200,300].map(g=>(
                            <div key={g} onClick={()=>setGrams(String(g))} style={{padding:"6px 8px",background:grams===String(g)?T.accent:T.card,color:grams===String(g)?"#fff":T.text,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{g}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {servingMode==="serving"&&(
                    <div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:T.muted}}>Servings {selected.servingG?`(1 serving ≈ ${selected.servingG}g)`:"(1 serving = 100g)"}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input type="number" value={servings} onChange={e=>setServings(e.target.value)} min="0.25" step="0.25" style={{width:72,flexShrink:0,background:T.bg,border:`2px solid ${T.accent}`,borderRadius:10,padding:"9px 8px",fontSize:16,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{fontSize:13,color:T.muted,flexShrink:0}}>serving{parseFloat(servings)!==1?"s":""}</span>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                          {[0.5,1,1.5,2,3].map(s=>(
                            <div key={s} onClick={()=>setServings(String(s))} style={{padding:"6px 8px",background:servings===String(s)?T.accent:T.card,color:servings===String(s)?"#fff":T.text,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{s}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {preview&&(
                    <div style={{background:T.card,borderRadius:14,padding:14,color:T.text}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:6}}>
                        {servingMode==="g"?`${preview.g}g of ${selected.name}`:`${servings} serving${parseFloat(servings)!==1?"s":""} · ${Math.round(preview.g)}g`}
                      </div>
                      <div style={{fontSize:28,fontWeight:600,letterSpacing:"-1px",marginBottom:10}}>{preview.macros.cal} <span style={{fontSize:13,color:"rgba(255,255,255,0.45)"}}>kcal</span></div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                        {[["Protein",preview.macros.protein,"g","#FF6B4A"],["Carbs",preview.macros.carbs,"g","#F5A623"],["Fat",preview.macros.fat,"g","#5B8DEF"],["Fiber",preview.macros.fiber,"g","#9B6DFF"]].map(([l,v,u,c])=>(
                          <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:9,padding:"8px 4px",textAlign:"center"}}>
                            <div style={{fontSize:14,fontWeight:600,color:c}}>{v}{u}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:1}}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:T.muted}}>Add to meal</div>
                    <div style={{display:"flex",gap:6}}>
                      {[["breakfast","Breakfast"],["lunch","Lunch"],["dinner","Dinner"],["snacks","Snacks"]].map(([s,l])=>(
                        <div key={s} onClick={()=>setTargetSlot(s)} style={{flex:1,padding:"7px 4px",borderRadius:10,fontSize:11,fontWeight:500,textAlign:"center",cursor:"pointer",border:`1px solid ${T.border}`,boxShadow:T.glowShadow,background:targetSlot===s?T.accent:T.card,color:targetSlot===s?"#fff":T.text}}>{l}</div>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleAdd} style={{background:added?"#27AE60":T.accent,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",transition:"background 0.2s",width:"100%"}}>
                    {added?"Added ✓":`Add to ${targetSlot}`}
                  </button>
                </div>
              )}
              </>)}

              {/* ── CREATE FOOD VIEW ── */}
              {foodView==="create"&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>

                  {/* No results notice */}
                  <div style={{background:T.accentPill,border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="8.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.8" fill={T.accent}/></svg>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:T.accent}}>No results found</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>Create a custom food and it'll be saved for future searches.</div>
                    </div>
                  </div>

                  <div style={{fontSize:13,color:T.muted}}>Fill in the nutrition label info below.</div>

                  {/* Name & Brand */}
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <input value={cf.name} onChange={e=>cfChange("name",e.target.value)} placeholder="Food name (required)" style={{background:T.bg,border:`1px solid ${cf.name?T.accent:T.border}`,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none",fontWeight:cf.name?500:400}}/>
                    <input value={cf.brand} onChange={e=>cfChange("brand",e.target.value)} placeholder="Brand (optional)" style={{background:T.bg,color:T.text,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}/>
                  </div>

                  {/* Serving size */}
                  <div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Serving size</div>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
                      <input type="number" value={cf.servingSize} onChange={e=>cfChange("servingSize",e.target.value)} min="1" style={{width:80,flexShrink:0,background:T.bg,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:10,padding:"10px 10px",fontSize:15,fontWeight:600,outline:"none",textAlign:"center"}}/>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:1}}>
                        {["g","ml","oz","cup","tbsp","piece"].map(u=>(
                          <div key={u} onClick={()=>cfChange("servingUnit",u)} style={{padding:"7px 8px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",border:`1px solid ${T.border}`,boxShadow:T.glowShadow,background:cf.servingUnit===u?T.accent:T.card,color:cf.servingUnit===u?"#fff":T.muted,flexShrink:0}}>{u}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Macros grid */}
                  <div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Per serving nutrition</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
                      {[
                        ["cal","Calories (kcal)","#2ECC8F",true],
                        ["protein","Protein (g)","#FF6B4A",false],
                        ["carbs","Total Carbs (g)","#F5A623",false],
                        ["fat","Total Fat (g)","#5B8DEF",false],
                        ["fiber","Dietary Fiber (g)","#9B6DFF",false],
                        ["sugar","Total Sugar (g)","#F5A623",false],
                        ["sodium","Sodium (mg)","#5B8DEF",false],
                      ].map(([k,label,color,required])=>(
                        <div key={k} style={{display:"flex",flexDirection:"column",gap:4,minWidth:0}}>
                          <div style={{fontSize:11,color:T.muted,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}{required&&<span style={{color:"#E24B4A"}}> *</span>}</div>
                          <input
                            type="number" min="0" value={cf[k]}
                            onChange={e=>cfChange(k,e.target.value)}
                            placeholder="0"
                            style={{background:T.bg,border:`1px solid ${cf[k]?color:T.border}`,borderRadius:10,padding:"10px 8px",fontSize:15,fontWeight:cf[k]?600:400,outline:"none",textAlign:"center",color:cf[k]?color:T.muted,width:"100%",minWidth:0}}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Live preview */}
                  {cfPreview&&cf.name&&(
                    <div style={{background:T.card,borderRadius:14,padding:14,color:T.text}}>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginBottom:6}}>Preview: 1 serving ({cf.servingSize}{cf.servingUnit}) of {cf.name}</div>
                      <div style={{fontSize:28,fontWeight:600,letterSpacing:"-1px",marginBottom:10}}>{cfPreview.servingCal} <span style={{fontSize:13,color:"rgba(255,255,255,0.45)"}}>kcal</span></div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                        {[["Protein",cf.protein||0,"g","#FF6B4A"],["Carbs",cf.carbs||0,"g","#F5A623"],["Fat",cf.fat||0,"g","#5B8DEF"],["Fiber",cf.fiber||0,"g","#9B6DFF"],["Sugar",cf.sugar||0,"g","#F5A623"],["Sodium",cf.sodium||0,"mg","#2ECC8F"]].map(([l,v,u,c])=>(
                          <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:9,padding:"8px 4px",textAlign:"center"}}>
                            <div style={{fontSize:13,fontWeight:600,color:c}}>{v}{u}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:1}}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={saveCustomFood}
                    disabled={!cf.name.trim()||!cf.cal}
                    style={{background:cfSaved?"#27AE60":(!cf.name.trim()||!cf.cal?"#C8C7C2":T.accent),border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:600,cursor:(!cf.name.trim()||!cf.cal)?"not-allowed":"pointer",transition:"background 0.2s",width:"100%"}}
                  >
                    {cfSaved?"Saved to My Foods ✓":"Save food to my library"}
                  </button>
                </div>
              )}
            </div>
          )}

          {mode==="supps"&&(
            <SuppSearchPanel suppList={suppList} suppTaken={suppTaken} setSuppTaken={setSuppTaken} addSuppToList={addSuppToList}/>
          )}

        </div>
      </div>
    </>
  );
}

// ── ADD FOOD MODAL ───────────────────────────────────────────────
function AddFoodModal({slot,onAdd,onClose,customFoods=[]}){
  const T=useTheme();
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(null);
  const [grams,setGrams]=useState("100");
  const [error,setError]=useState("");
  const inputRef=useRef();
  useEffect(()=>{inputRef.current?.focus();},[]);

  const doSearch=async()=>{
    if(!query.trim())return;
    setError("");setSelected(null);
    // Show local results immediately
    const localImmediate=[
      ...(customFoods||[]).filter(f=>f.name.toLowerCase().includes(query.toLowerCase())||(f.brand||"").toLowerCase().includes(query.toLowerCase())).map(f=>({...f,isCustom:true})),
      ...searchLocalFood(query),
    ];
    setResults(localImmediate);
    setLoading(true);
    try{
      const r=await searchFood(query,customFoods);
      setResults(r);
      if(r.length===0)setError("No results found. Try a brand name like 'Real Good' or a food name.");
    }catch{
      if(localImmediate.length===0)setError("Search failed. Check your connection.");
    }
    setLoading(false);
  };
  const preview=selected?calc({...selected,grams:parseFloat(grams)||0}):null;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
      <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:460,maxHeight:"88vh",boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:600}}>Add food — {slot}</div>
          <div onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"14px 16px 36px"}}>
          <div style={{display:"flex",gap:8,marginBottom:12,width:"100%"}}>
            <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Search food (e.g. white rice, fairlife...)" style={{flex:1,minWidth:0,background:T.bg,color:T.text,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}/>
            <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"11px 16px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,flexShrink:0,minWidth:72}}>{loading?"…":"Search"}</button>
          </div>
          {error&&<div style={{fontSize:13,color:"#E24B4A",marginBottom:12,padding:"10px 14px",background:"rgba(248,113,113,0.1)",borderRadius:10}}>{error}</div>}

          {/* No results → offer to create */}
          {!selected&&query&&results.length===0&&!loading&&(
            <div style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:10,alignItems:"center",textAlign:"center",marginBottom:12}}>
              <div style={{fontSize:30}}>🔍</div>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>No results for "{query}"</div>
              <div style={{fontSize:13,color:T.muted}}>Can't find it in the database? Create it yourself.</div>
              <div
                onClick={()=>{onClose();}}
                style={{display:"inline-flex",alignItems:"center",gap:7,background:T.accentPill,border:`1px solid ${T.border}`,borderRadius:20,padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}
              >
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                Create "{query}" in Quick Add
              </div>
              <div style={{fontSize:11,color:T.muted}}>(Open Quick Add → Food → Create food)</div>
            </div>
          )}

          {!selected&&results.map((r,i)=>(
            <div key={i} onClick={()=>{setSelected(r);setGrams("100");}} style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,lineHeight:1.3}}>{r.name}</div>{r.brand&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{r.brand}</div>}</div>
              <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:600}}>{r.per100.cal} kcal</div><div style={{fontSize:11,color:T.muted}}>per 100g</div></div>
            </div>
          ))}
          {selected&&(
            <div>
              <div onClick={()=>setSelected(null)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:14,color:T.accent,fontSize:13,fontWeight:500}}>
                <svg width="14" height="14" viewBox="0 0 14 14"><polyline points="9,2 4,7 9,12" stroke={T.accent} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                Back to results
              </div>
              <div style={{background:T.bg,borderRadius:14,padding:14,marginBottom:16}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:2}}>{selected.name}</div>
                {selected.brand&&<div style={{fontSize:12,color:T.muted,marginBottom:10}}>{selected.brand}</div>}
                <div style={{fontSize:12,color:T.muted,marginBottom:8}}>Per 100g:</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[["Cal",selected.per100.cal,"kcal","#2ECC8F"],["Protein",selected.per100.protein,"g","#FF6B4A"],["Carbs",selected.per100.carbs,"g","#F5A623"],["Fat",selected.per100.fat,"g","#5B8DEF"],["Fiber",selected.per100.fiber,"g","#9B6DFF"]].map(([l,v,u,c])=>(
                    <div key={l} style={{background:T.card,borderRadius:10,padding:"8px 10px",textAlign:"center",minWidth:56,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:c}}>{v}{u}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>How many grams?</div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <input type="number" value={grams} onChange={e=>setGrams(e.target.value)} min="1" max="2000" style={{width:80,flexShrink:0,background:T.bg,border:`2px solid ${T.accent}`,borderRadius:10,padding:"10px 10px",fontSize:17,fontWeight:700,outline:"none",textAlign:"center"}}/>
                  <span style={{fontSize:14,color:T.muted,flexShrink:0}}>grams</span>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                    {[50,100,150,200,300].map(g=>(
                      <div key={g} onClick={()=>setGrams(String(g))} style={{padding:"7px 8px",background:grams===String(g)?T.accent:T.card,color:grams===String(g)?"#fff":T.text,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{g}g</div>
                    ))}
                  </div>
                </div>
              </div>
              {preview&&parseFloat(grams)>0&&(
                <div style={{background:T.card,borderRadius:14,padding:16,marginBottom:16,color:T.text}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:8}}>Nutrition for {grams}g of {selected.name}</div>
                  <div style={{fontSize:30,fontWeight:600,letterSpacing:"-1px",marginBottom:14}}>{preview.cal} <span style={{fontSize:14,fontWeight:400,color:"rgba(255,255,255,0.5)"}}>kcal</span></div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {[["Protein",preview.protein,"g","#FF6B4A"],["Carbs",preview.carbs,"g","#F5A623"],["Fat",preview.fat,"g","#5B8DEF"],["Fiber",preview.fiber,"g","#9B6DFF"],["Sodium",preview.sodium,"mg","#2ECC8F"]].map(([l,v,u,c])=>(
                      <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"9px 8px",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:600,color:c}}>{v}{u}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={()=>{const g=parseFloat(grams);if(!g||g<=0)return;onAdd({id:Date.now(),name:selected.name,grams:g,per100:selected.per100,color:COLORS[Math.floor(Math.random()*COLORS.length)]});}} style={{width:"100%",background:T.accent,border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>
                Add {grams}g to {slot}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MacroRow({label,value,goal,color,unit="g"}){
  const T=useTheme();
  const pct=Math.min(100,Math.round((value/goal)*100));
  const over=value>goal;
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid #F0EFE9`}}>
      <div style={{fontSize:14,minWidth:60}}>{label}</div>
      <div style={{display:"flex",alignItems:"center",gap:10,flex:1,marginLeft:10}}>
        <div style={{flex:1,height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:over?"#E24B4A":color,borderRadius:3,transition:"width 0.4s"}}/>
        </div>
        <div style={{fontSize:12,fontWeight:500,minWidth:88,textAlign:"right",color:over?"#E24B4A":T.text}}>{value}{unit} / {goal}{unit}</div>
      </div>
    </div>
  );
}

function FoodTab({log,setLog,customFoods=[],addCustomFood}){
  const T=useTheme();
  const [modal,setModal]=useState(null);
  const M=totals(log);
  const remain=Math.max(0,GOALS.cal-M.cal);
  const r=34,circ=2*Math.PI*r,dash=circ*Math.min(1,M.cal/GOALS.cal);
  return(
    <div style={{paddingBottom:80}}>
      {modal&&<AddFoodModal slot={modal} onAdd={item=>{setLog(p=>({...p,[modal]:[...p[modal],item]}));setModal(null);}} onClose={()=>setModal(null)} customFoods={customFoods}/>}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:600}}>Food log</div><div style={{fontSize:13,color:T.muted}}>Calorie tracker</div></div>
        <div onClick={()=>setModal("breakfast")} style={{fontSize:13,color:T.accent,fontWeight:500,cursor:"pointer"}}>+ Add food</div>
      </div>
      <div style={{background:`linear-gradient(135deg,${T.bannerFrom},${T.bannerTo})`,margin:16,borderRadius:16,padding:18,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:18}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Calories remaining</div>
            <div style={{fontSize:36,fontWeight:600,letterSpacing:"-2px",lineHeight:1}}>{remain.toLocaleString()}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:3}}>of {GOALS.cal.toLocaleString()} · {M.cal} consumed</div>
          </div>
          <svg width="86" height="86" viewBox="0 0 86 86">
            <circle cx="43" cy="43" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7"/>
            <circle cx="43" cy="43" r={r} fill="none" stroke={T.accent} strokeWidth="7" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 43 43)"/>
            <text x="43" y="40" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">{M.cal}</text>
            <text x="43" y="53" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">consumed</text>
          </svg>
        </div>
        <div style={{display:"flex",gap:8,marginTop:14}}>
          {[["Protein",M.protein+"g","#FF6B4A"],["Carbs",M.carbs+"g","#F5A623"],["Fat",M.fat+"g","#5B8DEF"],["Fiber",M.fiber+"g","#2ECC8F"]].map(([l,v,c])=>(
            <div key={l} style={{flex:1,background:"rgba(255,255,255,0.07)",borderRadius:10,padding:9,textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:600,color:c}}>{v}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {[["Breakfast","breakfast"],["Lunch","lunch"],["Dinner","dinner"],["Snacks","snacks"]].map(([label,slot])=>{
        const slotCal=log[slot].reduce((s,item)=>s+calc(item).cal,0);
        return(
          <div key={slot} style={{margin:"0 16px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div><div style={{fontSize:14,fontWeight:600}}>{label}</div><div style={{fontSize:12,color:T.muted}}>{slotCal} cal</div></div>
              <div onClick={()=>setModal(slot)} style={{fontSize:13,color:T.accent,fontWeight:500,cursor:"pointer"}}>+ Add</div>
            </div>
            {log[slot].map((item,i)=>{
              const m=calc(item);
              return(
                <div key={item.id||i} style={{background:T.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${T.border}`,boxShadow:T.glowShadow,display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:item.color,flexShrink:0}}/>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500}}>{item.name}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{item.grams}g · {m.protein}g P · {m.carbs}g C · {m.fat}g F · {m.cal} kcal</div></div>
                  <div style={{fontSize:13,fontWeight:600,flexShrink:0}}>{m.cal}</div>
                  <div onClick={()=>setLog(p=>({...p,[slot]:p[slot].filter((_,j)=>j!==i)}))} style={{width:26,height:26,borderRadius:"50%",background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                </div>
              );
            })}
            {log[slot].length===0&&(
              <div onClick={()=>setModal(slot)} style={{background:T.card,border:"1.5px dashed #D0CFC9",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke="#D0CFC9" strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke="#D0CFC9" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke="#D0CFC9" strokeWidth="1.5" strokeLinecap="round"/></svg>
                <div style={{fontSize:14,color:T.muted,fontWeight:500}}>Search & add {label.toLowerCase()}</div>
              </div>
            )}
          </div>
        );
      })}
      <div style={{padding:"0 16px",marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>Nutrition breakdown</div>
        <div style={{background:T.card,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,padding:"4px 14px"}}>
          <MacroRow label="Calories" value={M.cal} goal={GOALS.cal} color={T.accent} unit=" kcal"/>
          <MacroRow label="Protein" value={M.protein} goal={GOALS.protein} color="#FF6B4A"/>
          <MacroRow label="Carbs" value={M.carbs} goal={GOALS.carbs} color="#F5A623"/>
          <MacroRow label="Fat" value={M.fat} goal={GOALS.fat} color="#5B8DEF"/>
          <MacroRow label="Fiber" value={M.fiber} goal={GOALS.fiber} color="#9B6DFF"/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
            <div style={{fontSize:14,minWidth:60}}>Sodium</div>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1,marginLeft:10}}>
              <div style={{flex:1,height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(100,Math.round((M.sodium/GOALS.sodium)*100))}%`,background:M.sodium>GOALS.sodium?"#E24B4A":"#5B8DEF",borderRadius:3,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontSize:12,fontWeight:500,minWidth:88,textAlign:"right",color:M.sodium>GOALS.sodium?"#E24B4A":T.text}}>{M.sodium}mg / {GOALS.sodium}mg</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeTab({setTab,log,suppList=[],suppTaken={},workoutHistory=[],isDark:_isDark,toggleTheme}){
  const T=useTheme();
  const isDark=T.mode==="dark";
  const M=totals(log);
  const remain=Math.max(0,GOALS.cal-M.cal);
  const pct=Math.min(M.cal/GOALS.cal,1);
  const takenCount=(suppList||[]).filter(s=>suppTaken[s.k]).length;
  const totalSupps=(suppList||[]).length;

  // Arc gauge — semicircle M(cx-r,cy) A r,r 0 0 1 (cx+r,cy)
  const cx=90,cy=82,r=64;
  const arcLen=Math.PI*r;
  const filled=arcLen*pct;
  const arcPath=`M ${cx-r},${cy} A ${r},${r} 0 0 1 ${cx+r},${cy}`;
  // Glow dot
  const θ=Math.PI*(1-pct);
  const dotX=cx+r*Math.cos(θ);
  const dotY=cy-r*Math.sin(θ);

  // Section shortcut data — live values
  const shortcuts=[
    {
      icon:"🍽",label:"Food Log",tab:"food",
      val:`${M.cal} kcal`,
      sub:`${remain.toLocaleString()} remaining`,
      pct:pct,
      color:T.macro[0],
    },
    {
      icon:"🏋️",label:"Workout",tab:"workout",
      val:workoutHistory.length>0?"Session logged":"No session yet",
      sub:"Tap to train",
      pct:workoutHistory.length>0?1:0,
      color:T.macro[2],
    },
    {
      icon:"💊",label:"Supplements",tab:"supps",
      val:totalSupps>0?`${takenCount}/${totalSupps} taken`:"Set up stack",
      sub:totalSupps>0?`${totalSupps-takenCount} remaining`:"Tap to add",
      pct:totalSupps>0?takenCount/totalSupps:0,
      color:T.macro[3],
    },
    {
      icon:"📅",label:"Calendar",tab:"calendar",
      val:"April 2026",
      sub:"View your history",
      pct:0,
      color:"#F59E0B",
    },
  ];

  return(
    <div style={{paddingBottom:80,background:T.bg,minHeight:"100vh",position:"relative",fontFamily:"-apple-system,sans-serif"}}>
      {/* Background grid texture */}
      <div style={{position:"fixed",inset:0,backgroundImage:`linear-gradient(${isDark?"rgba(124,58,237,0.025)":"rgba(79,70,229,0.03)"} 1px,transparent 1px),linear-gradient(90deg,${isDark?"rgba(124,58,237,0.025)":"rgba(79,70,229,0.03)"} 1px,transparent 1px)`,backgroundSize:"22px 22px",pointerEvents:"none",zIndex:0}}/>
      {/* Top radial glow */}
      <div style={{position:"fixed",top:-80,left:"50%",transform:"translateX(-50%)",width:280,height:280,borderRadius:"50%",background:`radial-gradient(circle,${isDark?"rgba(124,58,237,0.16)":"rgba(79,70,229,0.08)"} 0%,transparent 65%)`,pointerEvents:"none",zIndex:0}}/>

      {/* ── STICKY HEADER ── */}
      <div style={{
        position:"sticky",top:0,zIndex:50,
        padding:"12px 16px 10px",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        background:isDark?"rgba(7,7,15,0.88)":"rgba(248,249,252,0.92)",
        backdropFilter:"blur(16px)",
        WebkitBackdropFilter:"blur(16px)",
        borderBottom:`1px solid ${T.border}`,
      }}>
        {/* Left — greeting */}
        <div>
          <div style={{fontSize:9,color:T.accentSoft,fontWeight:600,letterSpacing:2,textTransform:"uppercase",opacity:0.8,marginBottom:2}}>Tuesday · Apr 21</div>
          <div style={{fontSize:18,fontWeight:700,color:T.text,letterSpacing:"-0.4px"}}>Good morning, Johnny 👋</div>
        </div>

        {/* Right — streak + toggle + avatar */}
        <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
          {/* Streak */}
          <div style={{background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.28)",borderRadius:20,padding:"3px 8px",fontSize:10,fontWeight:700,color:"#FBBF24",flexShrink:0}}>🔥 7</div>

          {/* Theme toggle — inline, compact */}
          <div onClick={toggleTheme} style={{display:"flex",alignItems:"center",gap:4,background:T.accentPill,border:`1px solid ${T.border}`,borderRadius:18,padding:"4px 8px 4px 5px",cursor:"pointer",flexShrink:0,transition:"all 0.2s",boxShadow:T.glowShadow}}>
            <div style={{width:16,height:16,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0}}>
              {isDark?"🌙":"☀️"}
            </div>
            <span style={{fontSize:10,fontWeight:600,color:T.accent}}>{isDark?"Dark":"Light"}</span>
          </div>

          {/* Avatar */}
          <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700,boxShadow:`0 3px 10px ${T.accentGlow}`,flexShrink:0}}>JN</div>
        </div>
      </div>

      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>

        {/* ── CALORIE ARC CARD ── */}
        <div style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:20,padding:"14px 14px 12px",position:"relative"}}>
          <div style={{position:"absolute",top:-20,right:-20,width:90,height:90,borderRadius:"50%",background:T.accentGlow,filter:"blur(22px)",pointerEvents:"none"}}/>
          <div style={{fontSize:8,color:T.accentSoft,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8,opacity:0.85}}>Calorie status</div>

          {/* Arc SVG */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
            <svg width="180" height="100" viewBox="0 0 180 100" style={{overflow:"visible"}}>
              <defs>
                <linearGradient id="htArc" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={T.accent}/>
                  <stop offset="100%" stopColor={T.accentSoft}/>
                </linearGradient>
                <filter id="htGlow">
                  <feGaussianBlur stdDeviation="2.5" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Track */}
              <path d={arcPath} fill="none" stroke={T.accentPill} strokeWidth="9" strokeLinecap="round"/>
              {/* Fill */}
              <path d={arcPath} fill="none" stroke="url(#htArc)" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${filled} ${arcLen}`}/>
              {/* Tip dot */}
              {pct>0.03&&pct<0.97&&(
                <circle cx={dotX} cy={dotY} r="5.5" fill={T.accentSoft} filter="url(#htGlow)" opacity="0.95"/>
              )}
              {/* Remaining number */}
              <text x={cx} y={cy-26} textAnchor="middle" fill={T.text} fontSize="28" fontWeight="800" style={{letterSpacing:"-1px"}}>{remain.toLocaleString()}</text>
              <text x={cx} y={cy-10} textAnchor="middle" fill={T.subtext} fontSize="9">kcal remaining</text>
              {/* % consumed */}
              <text x={cx} y={cy+14} textAnchor="middle" fill={T.accentSoft} fontSize="8.5" fontWeight="700">{Math.round(pct*100)}% consumed</text>
              {/* End labels */}
              <text x={cx-r+2} y={cy+14} textAnchor="start" fill={T.muted} fontSize="7">0</text>
              <text x={cx+r-2} y={cy+14} textAnchor="end" fill={T.muted} fontSize="7">{GOALS.cal}</text>
            </svg>
          </div>

          {/* Protein · Carbs · Fat */}
          <div style={{display:"flex",gap:7}}>
            {[
              ["Protein", M.protein, GOALS.protein, T.macro[0]],
              ["Carbs",   M.carbs,   GOALS.carbs,   T.macro[1]],
              ["Fat",     M.fat,     GOALS.fat,      T.macro[2]],
            ].map(([l,v,g,c])=>(
              <div key={l} style={{flex:1,background:`${c}12`,border:`1px solid ${c}28`,borderRadius:11,padding:"8px 6px",textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:800,color:c,letterSpacing:"-0.5px"}}>{Math.round(v)}g</div>
                <div style={{height:3,background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)",borderRadius:2,margin:"5px 5px 4px"}}>
                  <div style={{width:`${Math.min(Math.round(v/g*100),100)}%`,height:"100%",background:c,borderRadius:2}}/>
                </div>
                <div style={{fontSize:8,color:T.subtext}}>{l}</div>
                <div style={{fontSize:7,color:`${c}99`,marginTop:1}}>{Math.round(v)}/{g}g</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION SHORTCUTS ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {shortcuts.map(s=>(
            <div key={s.label} onClick={()=>setTab(s.tab)}
              style={{background:`${s.color}0E`,border:`1px solid ${s.color}2A`,boxShadow:`0 0 0 1px ${s.color}15`,borderRadius:16,padding:"13px 13px",cursor:"pointer",position:"relative",overflow:"hidden",transition:"transform 0.1s"}}>
              <div style={{position:"absolute",top:-14,right:-14,width:50,height:50,borderRadius:"50%",background:`${s.color}20`,filter:"blur(14px)",pointerEvents:"none"}}/>
              <div style={{fontSize:22,marginBottom:7}}>{s.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:T.text,lineHeight:1.25,marginBottom:3}}>{s.val}</div>
              <div style={{fontSize:8.5,color:T.subtext,marginBottom:8}}>{s.sub}</div>
              {/* mini progress */}
              {s.pct>0&&(
                <div style={{height:2.5,background:"rgba(255,255,255,0.07)",borderRadius:2,marginBottom:6,overflow:"hidden"}}>
                  <div style={{width:`${Math.round(s.pct*100)}%`,height:"100%",background:s.color,borderRadius:2}}/>
                </div>
              )}
              <div style={{fontSize:9,color:s.color,fontWeight:700}}>{s.label} →</div>
            </div>
          ))}
        </div>

        {/* ── TODAY'S MEALS ── */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>Today's meals</div>
            <div style={{fontSize:12,color:T.accent,fontWeight:600,cursor:"pointer"}} onClick={()=>setTab("food")}>View all →</div>
          </div>
          {[["Breakfast","breakfast"],["Lunch","lunch"],["Dinner","dinner"],["Snacks","snacks"]].map(([label,slot])=>{
            const slotCal=log[slot].reduce((s,i)=>s+calc(i).cal,0);
            const hasItems=log[slot].length>0;
            if(hasItems){
              return(
                <div key={slot} onClick={()=>setTab("food")}
                  style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:13,padding:"10px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{label}</div>
                    <div style={{fontSize:11,color:T.subtext,marginTop:2}}>{log[slot].length} item{log[slot].length!==1?"s":""} · {slotCal} cal</div>
                  </div>
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="12" fill="none" stroke={T.border} strokeWidth="2.5"/>
                    <circle cx="16" cy="16" r="12" fill="none" stroke={T.accent} strokeWidth="2.5"
                      strokeDasharray={`${Math.min(75,Math.round((slotCal/700)*75))} 75`} strokeLinecap="round" transform="rotate(-90 16 16)"/>
                  </svg>
                </div>
              );
            }
            return(
              <div key={slot} onClick={()=>setTab("food")}
                style={{background:"transparent",border:`1.5px dashed ${T.border}`,borderRadius:13,padding:"10px 14px",marginBottom:7,display:"flex",alignItems:"center",justifyContent:"center",gap:7,cursor:"pointer"}}>
                <div style={{fontSize:15,color:T.muted,lineHeight:1}}>+</div>
                <div style={{fontSize:13,color:T.muted,fontWeight:500}}>Add {label.toLowerCase()}</div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── WORKOUT DATA & HELPERS ──────────────────────────────────────
const EXERCISE_LIBRARY=[
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

const INITIAL_WORKOUTS=[
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

// ── CREATE WORKOUT MODAL ─────────────────────────────────────────
function CreateWorkoutModal({onSave,onClose,existing}){
  const T=useTheme();
  const [name,setName]=useState(existing?.name||"");
  const [tag,setTag]=useState(existing?.tag||"Upper Body");
  const [level,setLevel]=useState(existing?.level||"Intermediate");
  const [estMin,setEstMin]=useState(String(existing?.estMin||45));
  const [exercises,setExercises]=useState(existing?.exercises||[]);
  const [showLib,setShowLib]=useState(false);
  const [libSearch,setLibSearch]=useState("");
  const [libCat,setLibCat]=useState("All");

  const filtered=EXERCISE_LIBRARY.filter(e=>
    (libCat==="All"||e.cat===libCat)&&
    (e.name.toLowerCase().includes(libSearch.toLowerCase())||e.muscle.toLowerCase().includes(libSearch.toLowerCase()))
  );

  const addExercise=(ex)=>{
    setExercises(prev=>[...prev,{
      id:"ex"+Date.now(),
      name:ex.name,
      sets:[{reps:10,weight:0,done:false},{reps:10,weight:0,done:false},{reps:10,weight:0,done:false}]
    }]);
    setShowLib(false);setLibSearch("");
  };

  const removeExercise=(id)=>setExercises(prev=>prev.filter(e=>e.id!==id));

  const updateSet=(exId,setIdx,field,val)=>{
    setExercises(prev=>prev.map(e=>e.id!==exId?e:{
      ...e,sets:e.sets.map((s,i)=>i!==setIdx?s:{...s,[field]:val})
    }));
  };

  const addSet=(exId)=>{
    setExercises(prev=>prev.map(e=>{
      if(e.id!==exId)return e;
      const last=e.sets[e.sets.length-1]||{reps:10,weight:0};
      return{...e,sets:[...e.sets,{reps:last.reps,weight:last.weight,done:false}]};
    }));
  };

  const removeSet=(exId,setIdx)=>{
    setExercises(prev=>prev.map(e=>e.id!==exId?e:{
      ...e,sets:e.sets.filter((_,i)=>i!==setIdx)
    }));
  };

  const handleSave=()=>{
    if(!name.trim()||exercises.length===0)return;
    onSave({
      id:existing?.id||"w"+Date.now(),
      name:name.trim(),tag,level,
      estMin:parseInt(estMin)||45,
      exercises,
    });
  };

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
      <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:460,maxHeight:"90vh",boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:700,color:T.text}}>{existing?"Edit workout":"Create workout"}</div>
          <div onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px 16px 32px",display:"flex",flexDirection:"column",gap:16}}>
          {/* Name */}
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Workout name (e.g. Push Day)" style={{background:T.inputBg,color:T.text,border:`1px solid ${name?T.accent:T.border}`,boxShadow:name?T.glowShadow:"none",borderRadius:12,padding:"12px 14px",fontSize:15,fontWeight:500,outline:"none"}}/>

          {/* Meta row */}
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Category</div>
              <select value={tag} onChange={e=>setTag(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none"}}>
                {["Upper Body","Lower Body","Full Body","Push","Pull","Legs","Core","Cardio","Custom"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Level</div>
              <select value={level} onChange={e=>setLevel(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none"}}>
                {["Beginner","Intermediate","Advanced"].map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
            <div style={{width:72}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Est. min</div>
              <input type="number" value={estMin} onChange={e=>setEstMin(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 8px",fontSize:13,outline:"none",textAlign:"center"}}/>
            </div>
          </div>

          {/* Exercises */}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:10}}>Exercises ({exercises.length})</div>
            {exercises.map((ex,ei)=>(
              <div key={ex.id} style={{background:T.surface,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,padding:14,marginBottom:10}}>
                {/* Exercise header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.text}}>{ex.name}</div>
                  <div onClick={()=>removeExercise(ex.id)} style={{width:24,height:24,borderRadius:"50%",background:"rgba(248,113,113,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                </div>
                {/* Set headers */}
                <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 24px",gap:6,marginBottom:6}}>
                  {["Set","Reps","Weight (lbs)",""].map((h,i)=>(
                    <div key={i} style={{fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8,textAlign:i>0?"center":"left"}}>{h}</div>
                  ))}
                </div>
                {/* Sets */}
                {ex.sets.map((s,si)=>(
                  <div key={si} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 24px",gap:6,marginBottom:6,alignItems:"center"}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.muted,textAlign:"center"}}>{si+1}</div>
                    <input type="number" value={s.reps} onChange={e=>updateSet(ex.id,si,"reps",parseInt(e.target.value)||0)} style={{background:T.card,color:T.text,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 6px",fontSize:13,fontWeight:500,textAlign:"center",outline:"none",width:"100%"}}/>
                    <input type="number" value={s.weight} onChange={e=>updateSet(ex.id,si,"weight",parseInt(e.target.value)||0)} style={{background:T.card,color:T.text,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 6px",fontSize:13,fontWeight:500,textAlign:"center",outline:"none",width:"100%"}}/>
                    <div onClick={()=>removeSet(ex.id,si)} style={{width:22,height:22,borderRadius:"50%",background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                      <svg width="8" height="8" viewBox="0 0 8 8"><line x1="1" y1="1" x2="7" y2="7" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="1" x2="1" y2="7" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                ))}
                <div onClick={()=>addSet(ex.id)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"7px",border:`1px dashed ${T.border}`,borderRadius:8,cursor:"pointer",marginTop:4}}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="10" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="6" x2="10" y2="6" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <div style={{fontSize:12,color:T.muted,fontWeight:500}}>Add set</div>
                </div>
              </div>
            ))}

            {/* Add exercise button */}
            <div onClick={()=>setShowLib(true)} style={{border:`1.5px dashed ${T.border}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
              <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="8" y1="4" x2="8" y2="12" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="8" x2="12" y2="8" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div style={{fontSize:13,color:T.accent,fontWeight:600}}>Add exercise</div>
            </div>
          </div>

          {/* Exercise library picker */}
          {showLib&&(
            <div style={{background:T.surface,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,padding:14}}>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>Exercise library</div>
              <input value={libSearch} onChange={e=>setLibSearch(e.target.value)} placeholder="Search exercises..." style={{width:"100%",background:T.card,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",marginBottom:10,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:10,paddingBottom:2}}>
                {["All","Push","Pull","Legs","Core","Cardio"].map(c=>(
                  <div key={c} onClick={()=>setLibCat(c)} style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:`1px solid ${T.border}`,background:libCat===c?T.accent:T.card,color:libCat===c?"#fff":T.muted,whiteSpace:"nowrap",flexShrink:0}}>{c}</div>
                ))}
              </div>
              <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
                {filtered.map((ex,i)=>(
                  <div key={i} onClick={()=>addExercise(ex)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:T.text}}>{ex.name}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>{ex.muscle} · {ex.cat}</div>
                    </div>
                    <div style={{width:22,height:22,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="5" y1="1" x2="5" y2="9" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                ))}
                {filtered.length===0&&<div style={{fontSize:13,color:T.muted,textAlign:"center",padding:"16px 0"}}>No exercises found</div>}
              </div>
            </div>
          )}

          {/* Save button */}
          <button onClick={handleSave} disabled={!name.trim()||exercises.length===0} style={{background:!name.trim()||exercises.length===0?T.muted:T.accent,border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:!name.trim()||exercises.length===0?"not-allowed":"pointer",transition:"background 0.2s"}}>
            {existing?"Save changes":"Create workout"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ACTIVE WORKOUT VIEW ──────────────────────────────────────────
function ActiveWorkout({workout,onFinish,onClose}){
  const T=useTheme();
  const [sets,setSets]=useState(()=>
    workout.exercises.map(ex=>({
      ...ex,
      sets:ex.sets.map(s=>({...s,done:false,actualReps:s.reps,actualWeight:s.weight}))
    }))
  );
  const [elapsed,setElapsed]=useState(0);
  const [restTimer,setRestTimer]=useState(null); // seconds remaining
  const timerRef=useRef();

  useEffect(()=>{
    timerRef.current=setInterval(()=>{
      setElapsed(e=>e+1);
      setRestTimer(r=>r!==null&&r>0?r-1:r===0?null:r);
    },1000);
    return()=>clearInterval(timerRef.current);
  },[]);

  const allSets=sets.flatMap(e=>e.sets);
  const doneSets=allSets.filter(s=>s.done).length;
  const totalSets=allSets.length;
  const pct=totalSets>0?Math.round((doneSets/totalSets)*100):0;

  const toggleSet=(exIdx,setIdx)=>{
    setSets(prev=>prev.map((ex,ei)=>ei!==exIdx?ex:{
      ...ex,sets:ex.sets.map((s,si)=>{
        if(si!==setIdx)return s;
        const nowDone=!s.done;
        if(nowDone)setRestTimer(90); // 90s rest timer on completion
        return{...s,done:nowDone};
      })
    }));
  };

  const updateSet=(exIdx,setIdx,field,val)=>{
    setSets(prev=>prev.map((ex,ei)=>ei!==exIdx?ex:{
      ...ex,sets:ex.sets.map((s,si)=>si!==setIdx?s:{...s,[field]:val})
    }));
  };

  const fmt=(s)=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:T.bg,zIndex:190,overflowY:"auto",paddingBottom:80}}>
      {/* Header */}
      <div style={{background:T.card,padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
        <div onClick={onClose} style={{fontSize:13,color:T.muted,cursor:"pointer"}}>✕ Cancel</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text}}>{workout.name}</div>
          <div style={{fontSize:12,color:T.accent,fontWeight:600}}>{fmt(elapsed)}</div>
        </div>
        <div onClick={()=>onFinish(sets,elapsed)} style={{fontSize:13,color:T.accent,fontWeight:700,cursor:"pointer"}}>Finish</div>
      </div>

      {/* Progress bar */}
      <div style={{height:3,background:T.border}}>
        <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${T.accent},${T.accentSoft})`,transition:"width 0.4s"}}/>
      </div>

      {/* Rest timer */}
      {restTimer!==null&&restTimer>0&&(
        <div style={{background:T.accentPill,border:`1px solid ${T.accent}`,margin:"12px 16px 0",borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13,fontWeight:600,color:T.accent}}>⏱ Rest timer</div>
          <div style={{fontSize:18,fontWeight:800,color:T.accent,fontFamily:"monospace"}}>{fmt(restTimer)}</div>
          <div onClick={()=>setRestTimer(null)} style={{fontSize:12,color:T.muted,cursor:"pointer"}}>Skip</div>
        </div>
      )}

      {/* Stats */}
      <div style={{display:"flex",gap:10,padding:"12px 16px 0"}}>
        {[[`${doneSets}/${totalSets}`,"Sets done"],[`${pct}%`,"Complete"],[fmt(elapsed),"Elapsed"]].map(([v,l])=>(
          <div key={l} style={{flex:1,background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:700,color:T.accent}}>{v}</div>
            <div style={{fontSize:10,color:T.muted,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Exercises */}
      {sets.map((ex,ei)=>(
        <div key={ex.id} style={{margin:"12px 16px 0"}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:8}}>{ex.name}</div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,overflow:"hidden"}}>
            {/* Column headers */}
            <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 44px",gap:8,padding:"8px 12px",borderBottom:`1px solid ${T.border}`,background:T.surface}}>
              {["Set","Reps","lbs","✓"].map((h,i)=>(
                <div key={i} style={{fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8,textAlign:"center"}}>{h}</div>
              ))}
            </div>
            {ex.sets.map((s,si)=>(
              <div key={si} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 44px",gap:8,padding:"10px 12px",borderBottom:si<ex.sets.length-1?`1px solid ${T.border}`:"none",alignItems:"center",background:s.done?"rgba(6,182,212,0.05)":"transparent",transition:"background 0.2s"}}>
                <div style={{fontSize:13,fontWeight:700,color:T.muted,textAlign:"center"}}>{si+1}</div>
                <input type="number" value={s.actualReps} onChange={e=>updateSet(ei,si,"actualReps",parseInt(e.target.value)||0)} style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 4px",fontSize:14,fontWeight:600,textAlign:"center",outline:"none",width:"100%"}}/>
                <input type="number" value={s.actualWeight} onChange={e=>updateSet(ei,si,"actualWeight",parseInt(e.target.value)||0)} style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 4px",fontSize:14,fontWeight:600,textAlign:"center",outline:"none",width:"100%"}}/>
                <div onClick={()=>toggleSet(ei,si)} style={{width:36,height:36,borderRadius:10,background:s.done?T.accent:T.border,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"background 0.2s",margin:"0 auto"}}>
                  {s.done?<svg width="14" height="14" viewBox="0 0 14 14"><polyline points="2,7 6,11 12,3" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round"/></svg>:<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1,5 4,8 9,2" stroke={T.muted} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Finish button */}
      <div style={{padding:"20px 16px 0"}}>
        <button onClick={()=>onFinish(sets,elapsed)} style={{width:"100%",background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,border:"none",borderRadius:14,padding:"16px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 20px ${T.accentGlow}`}}>
          🏁 Finish workout
        </button>
      </div>
    </div>
  );
}

// ── EXERCISE PREVIEW LIST (expandable) ───────────────────────────
function ExercisePreviewList({exercises}){
  const T=useTheme();
  const [expanded,setExpanded]=useState(null);
  const toggle=(id)=>setExpanded(e=>e===id?null:id);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:600,color:T.text}}>Exercise preview</div>
        <div style={{fontSize:11,color:T.muted}}>Tap to see sets</div>
      </div>
      {exercises.map((ex,i)=>{
        const isOpen=expanded===ex.id;
        const totalVol=ex.sets.reduce((s,set)=>s+(set.reps*(set.weight||0)),0);
        return(
          <div
            key={ex.id}
            style={{background:T.card,border:`1px solid ${isOpen?T.accent:T.border}`,boxShadow:isOpen?T.glowShadow:T.glowShadow,borderRadius:14,marginBottom:8,overflow:"hidden",transition:"border-color 0.2s",cursor:"pointer"}}
            onClick={()=>toggle(ex.id)}
          >
            {/* Header row — always visible */}
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:28,height:28,borderRadius:8,background:isOpen?T.accent:T.accentPill,color:isOpen?"#fff":T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0,transition:"background 0.2s"}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:T.text}}>{ex.name}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:1}}>
                  {ex.sets.length} sets · {ex.sets[0]?.reps} reps
                  {ex.sets[0]?.weight>0?` · ${ex.sets[0].weight} lbs`:" · Bodyweight"}
                  {totalVol>0&&<span style={{color:T.accent,fontWeight:500}}> · {totalVol.toLocaleString()} lbs vol</span>}
                </div>
              </div>
              {/* Chevron */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0,transform:isOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
                <polyline points="2,4 7,10 12,4" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
            </div>

            {/* Expanded set breakdown */}
            {isOpen&&(
              <div style={{borderTop:`1px solid ${T.border}`,background:T.surface}}>
                {/* Column headers */}
                <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 1fr",gap:0,padding:"7px 14px",borderBottom:`1px solid ${T.border}`}}>
                  {["Set","Target reps","Weight","Volume"].map((h,hi)=>(
                    <div key={h} style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:0.8,textAlign:hi===0?"left":"center"}}>{h}</div>
                  ))}
                </div>
                {/* Set rows */}
                {ex.sets.map((s,si)=>{
                  const vol=s.reps*(s.weight||0);
                  return(
                    <div key={si} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 1fr",gap:0,padding:"9px 14px",borderBottom:si<ex.sets.length-1?`1px solid ${T.border}`:"none",alignItems:"center"}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.accent}}>S{si+1}</div>
                      <div style={{textAlign:"center"}}>
                        <span style={{background:T.accentPill,color:T.accent,fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20}}>{s.reps} reps</span>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>
                          {s.weight>0?`${s.weight} lbs`:"BW"}
                        </span>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <span style={{fontSize:12,color:T.muted}}>{vol>0?`${vol.toLocaleString()} lbs`:"—"}</span>
                      </div>
                    </div>
                  );
                })}
                {/* Summary footer */}
                <div style={{padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${T.border}`}}>
                  <div style={{fontSize:11,color:T.muted}}>{ex.sets.length} sets total</div>
                  {totalVol>0&&(
                    <div style={{fontSize:11,fontWeight:600,color:T.accent}}>Total volume: {totalVol.toLocaleString()} lbs</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── WORKOUT TAB ──────────────────────────────────────────────────
function WorkoutTab(){
  const T=useTheme();
  const [workouts,setWorkouts]=useState(INITIAL_WORKOUTS);
  const [createOpen,setCreateOpen]=useState(false);
  const [editWorkout,setEditWorkout]=useState(null);
  const [activeWorkout,setActiveWorkout]=useState(null);
  const [history,setHistory]=useState([]);
  const [view,setView]=useState("today"); // "today" | "plans" | "history"

  const todayWorkout=workouts[0]||null;

  const saveWorkout=(w)=>{
    setWorkouts(prev=>{
      const exists=prev.find(x=>x.id===w.id);
      return exists?prev.map(x=>x.id===w.id?w:x):[...prev,w];
    });
    setCreateOpen(false);setEditWorkout(null);
  };

  const deleteWorkout=(id)=>setWorkouts(prev=>prev.filter(w=>w.id!==id));

  const finishWorkout=(sets,elapsed)=>{
    const totalSets=sets.flatMap(e=>e.sets);
    const doneSets=totalSets.filter(s=>s.done).length;
    const entry={
      id:"h"+Date.now(),
      workoutName:activeWorkout.name,
      date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
      duration:elapsed,
      setsCompleted:doneSets,
      totalSets:totalSets.length,
      exercises:sets.map(ex=>({
        name:ex.name,
        sets:ex.sets.filter(s=>s.done).map(s=>`${s.actualReps}×${s.actualWeight}lbs`)
      }))
    };
    setHistory(prev=>[entry,...prev]);
    setActiveWorkout(null);
    setView("history");
  };

  const fmt=(s)=>`${Math.floor(s/60)}m ${s%60}s`;

  // ── VIEWS ──
  const views=[["today","Today"],["plans","My Plans"],["history","History"]];

  return(
    <div style={{paddingBottom:80}}>
      {createOpen&&<CreateWorkoutModal onSave={saveWorkout} onClose={()=>setCreateOpen(false)}/>}
      {editWorkout&&<CreateWorkoutModal existing={editWorkout} onSave={saveWorkout} onClose={()=>setEditWorkout(null)}/>}
      {activeWorkout&&<ActiveWorkout workout={activeWorkout} onFinish={finishWorkout} onClose={()=>setActiveWorkout(null)}/>}

      {/* Header */}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:700,color:T.text}}>Workout</div><div style={{fontSize:13,color:T.muted}}>{workouts.length} plan{workouts.length!==1?"s":""} · {history.length} sessions logged</div></div>
        <div onClick={()=>setCreateOpen(true)} style={{background:T.accentPill,border:`1px solid ${T.accent}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="1" x2="6" y2="11" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="6" x2="11" y2="6" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/></svg>
          <span style={{fontSize:13,fontWeight:600,color:T.accent}}>New</span>
        </div>
      </div>

      {/* View toggle */}
      <div style={{display:"flex",gap:0,background:T.surface,margin:"12px 16px 0",borderRadius:12,padding:3,border:`1px solid ${T.border}`}}>
        {views.map(([v,l])=>(
          <div key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px 6px",borderRadius:10,fontSize:12,fontWeight:600,textAlign:"center",cursor:"pointer",background:view===v?T.accent:"transparent",color:view===v?"#fff":T.muted,transition:"all 0.15s"}}>{l}</div>
        ))}
      </div>

      {/* ── TODAY VIEW ── */}
      {view==="today"&&todayWorkout&&(
        <div style={{padding:"12px 16px 0"}}>
          {/* Today's workout banner */}
          <div style={{background:`linear-gradient(135deg,${T.bannerFrom},${T.bannerTo})`,borderRadius:16,padding:20,marginBottom:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:T.accentGlow,filter:"blur(24px)"}}/>
            <div style={{display:"inline-block",background:"rgba(6,182,212,0.3)",color:"#A855F7",fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,marginBottom:10,letterSpacing:"0.5px"}}>TODAY · {todayWorkout.tag.toUpperCase()}</div>
            <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:4}}>{todayWorkout.name}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:14}}>{todayWorkout.exercises.length} exercises · ~{todayWorkout.estMin} min · {todayWorkout.level}</div>
            <button onClick={()=>setActiveWorkout(todayWorkout)} style={{background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 16px ${T.accentGlow}`}}>
              🏋️ Start workout
            </button>
          </div>

          {/* Exercise preview */}
          <ExercisePreviewList exercises={todayWorkout.exercises} />
        </div>
      )}

      {view==="today"&&!todayWorkout&&(
        <div style={{padding:"40px 16px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>💪</div>
          <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:6}}>No workout planned for today</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:20}}>Create your first workout plan to get started</div>
          <button onClick={()=>setCreateOpen(true)} style={{background:T.accent,border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Create a workout</button>
        </div>
      )}

      {/* ── MY PLANS VIEW ── */}
      {view==="plans"&&(
        <div style={{padding:"12px 16px 0"}}>
          {workouts.length===0?(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:6}}>No workout plans yet</div>
              <div style={{fontSize:13,color:T.muted,marginBottom:20}}>Tap "New" to create your first plan</div>
              <button onClick={()=>setCreateOpen(true)} style={{background:T.accent,border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Create first plan</button>
            </div>
          ):workouts.map((w,i)=>(
            <div key={w.id} style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,padding:16,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{fontSize:15,fontWeight:700,color:T.text}}>{w.name}</div>
                    {i===0&&<span style={{background:T.accentPill,color:T.accent,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>TODAY</span>}
                  </div>
                  <div style={{fontSize:12,color:T.muted}}>{w.exercises.length} exercises · {w.estMin}min · {w.level} · {w.tag}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <div onClick={()=>setEditWorkout(w)} style={{width:30,height:30,borderRadius:8,background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={T.accent} strokeWidth="1.5"><path d="M9 2l2 2L4 11H2V9L9 2z"/></svg>
                  </div>
                  <div onClick={()=>deleteWorkout(w.id)} style={{width:30,height:30,borderRadius:8,background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                    <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/><line x1="11" y1="1" x2="1" y2="11" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {w.exercises.slice(0,4).map(ex=>(
                  <span key={ex.id} style={{background:T.accentPill,color:T.accent,fontSize:11,padding:"3px 9px",borderRadius:20}}>{ex.name}</span>
                ))}
                {w.exercises.length>4&&<span style={{background:T.surface,color:T.muted,fontSize:11,padding:"3px 9px",borderRadius:20}}>+{w.exercises.length-4} more</span>}
              </div>
              <button onClick={()=>setActiveWorkout(w)} style={{width:"100%",background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                🏋️ Start this workout
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view==="history"&&(
        <div style={{padding:"12px 16px 0"}}>
          {history.length===0?(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:6}}>No workout history yet</div>
              <div style={{fontSize:13,color:T.muted}}>Complete a workout to see your history here</div>
            </div>
          ):history.map(h=>(
            <div key={h.id} style={{background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,padding:16,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>{h.workoutName}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{h.date}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{fmt(h.duration)}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:1}}>{h.setsCompleted}/{h.totalSets} sets</div>
                </div>
              </div>
              {/* Exercise breakdown */}
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {h.exercises.filter(e=>e.sets.length>0).map((ex,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:T.surface,borderRadius:8}}>
                    <div style={{fontSize:12,fontWeight:500,color:T.text}}>{ex.name}</div>
                    <div style={{fontSize:11,color:T.muted}}>{ex.sets.join(" · ")}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── REMINDER MODAL ───────────────────────────────────────────────
function ReminderModal({supp,onSave,onClose}){
  const T=useTheme();
  const [time,setTime]=useState(supp.reminderTime||"08:00");
  const [enabled,setEnabled]=useState(supp.reminderEnabled||false);
  const [permDenied,setPermDenied]=useState(false);

  const requestPermAndSave=async()=>{
    if(enabled&&"Notification" in window){
      const perm=await Notification.requestPermission();
      if(perm==="denied"){setPermDenied(true);return;}
    }
    onSave({reminderEnabled:enabled,reminderTime:time});
  };

  const fmtTime=(t)=>{
    const [h,m]=t.split(":").map(Number);
    const ampm=h>=12?"PM":"AM";
    const h12=h===0?12:h>12?h-12:h;
    return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
  };

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
      <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:460,padding:"24px 20px 28px",boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",display:"flex",flexDirection:"column",gap:20}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:T.text}}>Set reminder</div>
            <div style={{fontSize:12,color:T.subtext,marginTop:2}}>{supp.name}</div>
          </div>
          <div onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Enable toggle */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,borderRadius:14,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>Daily reminder</div>
            <div style={{fontSize:12,color:T.subtext,marginTop:2}}>Notify me to take this supplement</div>
          </div>
          <div onClick={()=>setEnabled(e=>!e)} style={{width:48,height:28,borderRadius:14,background:enabled?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,boxShadow:enabled?`0 0 10px ${T.accentGlow}`:"none"}}>
            <div style={{position:"absolute",top:3,left:enabled?23:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.25)"}}/>
          </div>
        </div>

        {/* Time picker */}
        {enabled&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>Reminder time</div>
            <div style={{background:T.surface,border:`1px solid ${T.accent}`,boxShadow:T.glowShadow,borderRadius:14,padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <div style={{fontSize:42,fontWeight:800,color:T.accent,letterSpacing:"-1px"}}>{fmtTime(time)}</div>
              <input
                type="time"
                value={time}
                onChange={e=>setTime(e.target.value)}
                style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 16px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box",textAlign:"center",cursor:"pointer"}}
              />
            </div>

            {/* Quick time presets */}
            <div>
              <div style={{fontSize:12,color:T.subtext,marginBottom:8}}>Quick presets</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {[["Morning","07:00"],["With breakfast","08:00"],["Midday","12:00"],["Pre-workout","17:00"],["Dinner","18:00"],["Before bed","21:00"],["Night","22:00"]].map(([label,t])=>(
                  <div key={t} onClick={()=>setTime(t)}
                    style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:`1px solid ${time===t?T.accent:T.border}`,background:time===t?T.accentPill:"transparent",color:time===t?T.accent:T.subtext,transition:"all 0.15s"}}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Info note */}
            <div style={{background:T.accentPill,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10}}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0,marginTop:1}}>
                <circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5"/>
                <line x1="8" y1="5" x2="8" y2="8.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.8" fill={T.accent}/>
              </svg>
              <div style={{fontSize:11,color:T.subtext,lineHeight:1.5}}>
                Browser reminders work while the app is open. For native lock screen alerts even when closed, install the app to your home screen or use the iOS app via Capacitor.
              </div>
            </div>
          </div>
        )}

        {permDenied&&(
          <div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:"10px 14px",fontSize:12,color:T.red}}>
            Notification permission was denied. Please enable it in your browser settings to receive reminders.
          </div>
        )}

        <button onClick={requestPermAndSave}
          style={{background:T.accent,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 16px ${T.accentGlow}`}}>
          {enabled?`Save reminder · ${fmtTime(time)}`:"Save (no reminder)"}
        </button>
      </div>
    </div>
  );
}

// ── BROWSER NOTIFICATION SCHEDULER ──────────────────────────────
function scheduleNotification(supp){
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  const [h,m]=supp.reminderTime.split(":").map(Number);
  const now=new Date();
  const target=new Date();
  target.setHours(h,m,0,0);
  if(target<=now)target.setDate(target.getDate()+1);
  const ms=target-now;
  setTimeout(()=>{
    if(Notification.permission==="granted"){
      new Notification(`💊 Time for your ${supp.name}`,{
        body:supp.sub||"Don't forget your daily supplement!",
        icon:"/favicon.ico",
        badge:"/favicon.ico",
        tag:`supp-${supp.k}`,
        renotify:true,
      });
    }
  },ms);
}

// ── SUPPS TAB ────────────────────────────────────────────────────
function SuppsTab({suppList,setSuppList,suppTaken,setSuppTaken,taken,total}){
  const T=useTheme();
  const [manageOpen,setManageOpen]=useState(false);
  const [reminderSupp,setReminderSupp]=useState(null);
  const [editItem,setEditItem]=useState(null);
  const [newName,setNewName]=useState("");
  const [newSub,setNewSub]=useState("");
  const [newReminderEnabled,setNewReminderEnabled]=useState(false);
  const [newReminderTime,setNewReminderTime]=useState("08:00");

  // Schedule notifications on mount and when reminders change
  useEffect(()=>{
    if(!("Notification" in window))return;
    suppList.forEach(s=>{if(s.reminderEnabled&&s.reminderTime)scheduleNotification(s);});
  },[suppList]);

  const morning=suppList.filter(s=>/(morning|breakfast|workout|am\b)/i.test(s.sub||""));
  const evening=suppList.filter(s=>/(evening|dinner|bed|night|pm\b)/i.test(s.sub||""));
  const other=suppList.filter(s=>!morning.includes(s)&&!evening.includes(s));

  const removeSupp=(k)=>{
    setSuppList(p=>p.filter(s=>s.k!==k));
    setSuppTaken(p=>{const n={...p};delete n[k];return n;});
  };

  const saveEdit=()=>{
    if(!editItem||!newName.trim())return;
    setSuppList(p=>p.map(s=>s.k===editItem.k?{...s,name:newName,sub:newSub}:s));
    setEditItem(null);setNewName("");setNewSub("");
  };

  const addCustom=()=>{
    if(!newName.trim())return;
    const k="m"+Date.now();
    const newSupp={k,name:newName,sub:newSub||"",dot:"#888",reminderEnabled:newReminderEnabled,reminderTime:newReminderTime};
    setSuppList(p=>[...p,newSupp]);
    setSuppTaken(p=>({...p,[k]:false}));
    if(newReminderEnabled)scheduleNotification(newSupp);
    setNewName("");setNewSub("");setNewReminderEnabled(false);setNewReminderTime("08:00");
  };

  const saveReminder=({reminderEnabled,reminderTime})=>{
    setSuppList(p=>p.map(s=>s.k===reminderSupp.k?{...s,reminderEnabled,reminderTime}:s));
    if(reminderEnabled)scheduleNotification({...reminderSupp,reminderEnabled,reminderTime});
    setReminderSupp(null);
  };

  const fmtTime=(t)=>{
    if(!t)return"";
    const [h,m]=t.split(":").map(Number);
    const ampm=h>=12?"PM":"AM";
    const h12=h===0?12:h>12?h-12:h;
    return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
  };

  const renderGroup=(label,items)=>items.length===0?null:(
    <div key={label}>
      <div style={{padding:"0 16px",margin:"14px 0 8px"}}><div style={{fontSize:14,fontWeight:600,color:T.text}}>{label}</div></div>
      <div style={{background:T.card,margin:"0 16px",borderRadius:14,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,overflow:"hidden"}}>
        {items.map((s,i)=>(
          <div key={s.k} style={{borderBottom:i<items.length-1?`1px solid ${T.border}`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:s.dot,flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{s.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2,flexWrap:"wrap"}}>
                    {s.sub&&<div style={{fontSize:11,color:T.subtext}}>{s.sub}</div>}
                    {/* Reminder badge */}
                    <div onClick={()=>setReminderSupp(s)}
                      style={{display:"flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:20,cursor:"pointer",background:s.reminderEnabled?T.accentPill:"transparent",border:`1px solid ${s.reminderEnabled?T.accent:T.border}`,transition:"all 0.15s"}}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <circle cx="5" cy="5" r="4" stroke={s.reminderEnabled?T.accent:T.muted} strokeWidth="1.2"/>
                        <polyline points="5,3 5,5.5 6.5,5.5" stroke={s.reminderEnabled?T.accent:T.muted} strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      <span style={{fontSize:9,fontWeight:600,color:s.reminderEnabled?T.accent:T.muted}}>
                        {s.reminderEnabled?fmtTime(s.reminderTime):"Set time"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Toggle */}
              <div onClick={()=>setSuppTaken(p=>({...p,[s.k]:!p[s.k]}))}
                style={{width:44,height:26,borderRadius:13,background:suppTaken[s.k]?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,marginLeft:10,boxShadow:suppTaken[s.k]?`0 0 8px ${T.accentGlow}`:"none"}}>
                <div style={{position:"absolute",top:3,left:suppTaken[s.k]?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return(
    <div style={{paddingBottom:80}}>
      {/* Reminder modal */}
      {reminderSupp&&<ReminderModal supp={reminderSupp} onSave={saveReminder} onClose={()=>setReminderSupp(null)}/>}

      {/* Manage modal */}
      {manageOpen&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:T.card,borderRadius:20,width:"100%",maxWidth:460,maxHeight:"88vh",boxShadow:"0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontSize:17,fontWeight:700,color:T.text}}>Manage supplements</div>
              <div onClick={()=>{setManageOpen(false);setEditItem(null);setNewName("");setNewSub("");}} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
            </div>
            <div style={{overflowY:"auto",padding:"14px 20px 30px",display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontSize:12,color:T.subtext}}>Daily goal: {total} supplement{total!==1?"s":""} · Tap the clock icon on any supplement to set a reminder.</div>
              <div style={{background:T.card,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,overflow:"hidden"}}>
                {suppList.map((s,i)=>(
                  <div key={s.k}>
                    {editItem?.k===s.k?(
                      <div style={{padding:"12px 14px",borderBottom:i<suppList.length-1?`1px solid ${T.border}`:"none",display:"flex",flexDirection:"column",gap:8}}>
                        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
                        <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Dose / timing" style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{setEditItem(null);setNewName("");setNewSub("");}} style={{flex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px",fontSize:12,cursor:"pointer",color:T.text}}>Cancel</button>
                          <button onClick={saveEdit} style={{flex:1,background:T.accent,border:"none",borderRadius:8,padding:"8px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Save</button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:i<suppList.length-1?`1px solid ${T.border}`:"none"}}>
                        <div style={{width:9,height:9,borderRadius:"50%",background:s.dot,flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:500,color:T.text}}>{s.name}</div>
                          {s.sub&&<div style={{fontSize:11,color:T.subtext,marginTop:1}}>{s.sub}</div>}
                          {s.reminderEnabled&&<div style={{fontSize:10,color:T.accent,marginTop:2}}>🔔 {fmtTime(s.reminderTime)}</div>}
                        </div>
                        <div onClick={()=>{setEditItem(s);setNewName(s.name);setNewSub(s.sub||"");}} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 9l1.5-1.5 5-5L10 4 4.5 9.5 2 10l.5-1.5zM7.5 2.5l2 2" stroke={T.accent} strokeWidth="1.3" strokeLinecap="round"/></svg>
                        </div>
                        <div onClick={()=>removeSupp(s.k)} style={{width:28,height:28,borderRadius:"50%",background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>Add supplement</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name (e.g. Ashwagandha)" style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>
                <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Dose / timing (e.g. 600mg · Morning)" style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>

                {/* Optional reminder row */}
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:T.text}}>Set reminder <span style={{fontSize:11,color:T.muted,fontWeight:400}}>(optional)</span></div>
                      <div style={{fontSize:11,color:T.subtext,marginTop:2}}>Get notified when it's time to take this</div>
                    </div>
                    <div onClick={()=>setNewReminderEnabled(e=>!e)} style={{width:42,height:24,borderRadius:12,background:newReminderEnabled?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,boxShadow:newReminderEnabled?`0 0 8px ${T.accentGlow}`:"none"}}>
                      <div style={{position:"absolute",top:2.5,left:newReminderEnabled?19:2.5,width:19,height:19,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.25)"}}/>
                    </div>
                  </div>

                  {/* Time picker — only shown when toggle is on */}
                  {newReminderEnabled&&(
                    <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{background:T.card,border:`1px solid ${T.accent}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{fontSize:20,fontWeight:800,color:T.accent,letterSpacing:"-0.5px"}}>
                          {(()=>{const[h,m]=newReminderTime.split(":").map(Number);const ap=h>=12?"PM":"AM";const h12=h===0?12:h>12?h-12:h;return`${h12}:${String(m).padStart(2,"0")} ${ap}`;})()}
                        </div>
                        <input type="time" value={newReminderTime} onChange={e=>setNewReminderTime(e.target.value)}
                          style={{background:"transparent",color:T.subtext,border:"none",fontSize:12,outline:"none",cursor:"pointer"}}/>
                      </div>
                      {/* Quick presets */}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {[["Morning","07:00"],["Breakfast","08:00"],["Midday","12:00"],["Pre-workout","17:00"],["Dinner","18:00"],["Bedtime","21:00"]].map(([label,t])=>(
                          <div key={t} onClick={()=>setNewReminderTime(t)}
                            style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:`1px solid ${newReminderTime===t?T.accent:T.border}`,background:newReminderTime===t?T.accentPill:"transparent",color:newReminderTime===t?T.accent:T.subtext,transition:"all 0.15s"}}>
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={addCustom} disabled={!newName.trim()} style={{background:!newName.trim()?T.muted:T.accent,border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,fontWeight:600,cursor:newName.trim()?"pointer":"not-allowed",transition:"background 0.2s"}}>
                  {newReminderEnabled?"Add to stack with reminder 🔔":"Add to daily stack"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:T.text}}>Supplements</div>
          <div style={{fontSize:13,color:T.subtext}}>Daily tracker</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {/* Bell icon showing active reminders count */}
          {suppList.filter(s=>s.reminderEnabled).length>0&&(
            <div style={{background:T.accentPill,border:`1px solid ${T.accent}`,borderRadius:20,padding:"4px 10px",display:"flex",alignItems:"center",gap:5}}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1a3.5 3.5 0 0 1 3.5 3.5c0 2 .7 3 1 3.5H1c.3-.5 1-1.5 1-3.5A3.5 3.5 0 0 1 5.5 1z" stroke={T.accent} strokeWidth="1.2"/>
                <path d="M4.5 9.5a1 1 0 0 0 2 0" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{fontSize:10,fontWeight:700,color:T.accent}}>{suppList.filter(s=>s.reminderEnabled).length} active</span>
            </div>
          )}
          <div onClick={()=>setManageOpen(true)} style={{width:34,height:34,borderRadius:10,background:T.inputBg,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.text} strokeWidth="1.4"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:10,padding:"14px 16px 0",marginBottom:4}}>
        <div style={{flex:1,background:T.greenBg,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:700,color:T.green}}>{taken}/{total}</div>
          <div style={{fontSize:11,color:T.green,marginTop:2}}>taken today</div>
        </div>
        <div style={{flex:1,background:"rgba(249,115,22,0.1)",borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:700,color:"#F97316"}}>{total-taken}</div>
          <div style={{fontSize:11,color:"#F97316",marginTop:2}}>remaining</div>
        </div>
        {suppList.filter(s=>s.reminderEnabled).length>0&&(
          <div style={{flex:1,background:T.accentPill,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:700,color:T.accent}}>{suppList.filter(s=>s.reminderEnabled).length}</div>
            <div style={{fontSize:11,color:T.accent,marginTop:2}}>reminders</div>
          </div>
        )}
      </div>

      {/* Groups */}
      {renderGroup("Morning",morning)}
      {renderGroup("Evening",evening)}
      {renderGroup("All day",other)}

      {/* Add shortcut */}
      <div style={{padding:"14px 16px 0"}}>
        <div onClick={()=>setManageOpen(true)} style={{border:`1.5px dashed ${T.border}`,borderRadius:13,padding:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.muted} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{fontSize:13,color:T.muted,fontWeight:500}}>Add or manage supplements</div>
        </div>
      </div>
    </div>
  );
}


function CalendarTab(){
  const T=useTheme();
  const [view,setView]=useState("month");const [sel,setSel]=useState(21);const [month,setMonth]=useState(3);const [year,setYear]=useState(2026);
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dim=new Date(year,month+1,0).getDate();const fdow=new Date(year,month,1).getDay();
  const chartData=view==="week"?[1820,2100,1950,0,2050,1890,720]:[1900,1850,1950,1820,2100,1950,0,2050,1890,2200,0,1780,2020,1650,0,2150,1980,2300,1750,0,720];
  const chartLabels=view==="week"?["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]:Array.from({length:21},(_,i)=>(i+1)%3===0?String(i+1):"");
  const maxB=Math.max(...chartData.filter(v=>v>0),2200);
  const dd=dayData[sel]||{food:0,workout:0,supp:0,cal:0};
  const dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return(
    <div style={{paddingBottom:80}}>
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:600}}>Calendar</div><div style={{fontSize:13,color:T.muted}}>{MONTHS[month]} {year}</div></div>
        <div style={{width:36,height:36,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:600}}>JN</div>
      </div>
      <div style={{display:"flex",gap:8,padding:"14px 16px 0"}}>
        {["month","week"].map(v=>(
          <div key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",border:`1px solid ${view===v?T.accent:T.border}`,boxShadow:view===v?T.glowShadow:"none",background:view===v?T.accent:T.card,color:view===v?"#fff":T.muted,textTransform:"capitalize"}}>{v}</div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px 10px"}}>
        <div onClick={()=>{let m=month-1,y=year;if(m<0){m=11;y--;}setMonth(m);setYear(y);}} style={{width:32,height:32,borderRadius:"50%",background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="14" height="14" viewBox="0 0 14 14"><polyline points="9,2 4,7 9,12" stroke={T.text} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
        <div style={{fontSize:16,fontWeight:600}}>{MONTHS[month]} {year}</div>
        <div onClick={()=>{let m=month+1,y=year;if(m>11){m=0;y++;}setMonth(m);setYear(y);}} style={{width:32,height:32,borderRadius:"50%",background:T.card,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="14" height="14" viewBox="0 0 14 14"><polyline points="5,2 10,7 5,12" stroke={T.text} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
      </div>
      {view==="month"&&(
        <div style={{padding:"0 16px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,color:T.muted,fontWeight:500,padding:"4px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {Array.from({length:fdow},(_,i)=><div key={"e"+i}/>)}
            {Array.from({length:dim},(_,i)=>{
              const d=i+1,dd2=dayData[d];
              const isToday=month===3&&year===2026&&d===21,isFuture=month===3&&year===2026?d>21:(month>3||year>2026),isSel=d===sel&&month===3&&year===2026;
              const allDone2=dd2&&dd2.food&&dd2.workout&&dd2.supp;
              const missed2=dd2&&!allDone2?[!dd2.food,!dd2.workout,!dd2.supp].filter(Boolean):[];
              return(
                <div key={d} onClick={()=>{if(!isFuture)setSel(d);}} style={{borderRadius:10,padding:"4px 2px",textAlign:"center",cursor:"pointer",background:isSel?T.text:T.card,border:isToday?`2px solid ${T.accent}`:`1px solid ${T.border}`,minHeight:52,display:"flex",flexDirection:"column",alignItems:"center",gap:2,opacity:isFuture?0.35:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:isSel?"#fff":isToday?T.accent:T.text,paddingTop:4}}>{d}</div>
                  <div style={{height:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {!isFuture&&allDone2?(
                      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill={T.accent}/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                    ):!isFuture&&dd2&&missed2.length>0?(
                      <div style={{display:"flex",gap:2}}>
                        {missed2.map((_,mi)=><div key={mi} style={{width:4,height:4,borderRadius:"50%",background:"#C8C7C2"}}/>)}
                      </div>
                    ):null}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:10}}>
            {[["#2ECC8F","Food goal"],["#5B8DEF","Workout"],["#F5A623","Supplements"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:c}}/><div style={{fontSize:12,color:T.muted}}>{l}</div></div>
            ))}
          </div>
        </div>
      )}
      {view==="week"&&(
        <div style={{padding:"0 16px",marginBottom:12}}>
          <div style={{background:T.card,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,padding:14}}>
            <div style={{display:"flex",gap:6}}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i)=>{
                const day=15+i,dd2=dayData[day],isActive=day===sel,isFuture=day>21;
                const allDone3=dd2&&dd2.food&&dd2.workout&&dd2.supp;
                const missed3=dd2&&!allDone3?[!dd2.food,!dd2.workout,!dd2.supp].filter(Boolean):[];
                return(
                  <div key={i} onClick={()=>{if(!isFuture)setSel(day);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",padding:"6px 2px",borderRadius:10,background:isActive?T.accent:"transparent",opacity:isFuture?0.4:1}}>
                    <div style={{fontSize:11,color:isActive?"rgba(255,255,255,0.6)":T.muted,fontWeight:500}}>{d}</div>
                    <div style={{fontSize:13,fontWeight:600,color:isActive?"#fff":T.text}}>{day}</div>
                    <div style={{height:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {!isFuture&&allDone3?(
                        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill={T.accent}/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                      ):!isFuture&&dd2&&missed3.length>0?(
                        <div style={{display:"flex",gap:2}}>
                          {missed3.map((_,mi)=><div key={mi} style={{width:4,height:4,borderRadius:"50%",background:isActive?"rgba(255,255,255,0.4)":"#C8C7C2"}}/>)}
                        </div>
                      ):null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div style={{background:T.card,margin:"0 16px 14px",borderRadius:14,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,padding:16}}>
        <div style={{fontSize:13,color:T.muted,marginBottom:12}}>{dayNames[new Date(year,month,sel).getDay()]}, {MONTHS[month]} {sel}</div>
        {[["🍽","#E8F7F0","Food log",dd.cal?(dd.cal.toLocaleString()+" / 2,200 cal"):"Not logged",dd.food],["💪","#EEF4FF","Workout",dd.workout?"Completed":"Not done",dd.workout],["💊","#FFF8E8","Supplements",dd.supp?"All taken":"Incomplete",dd.supp],["🔥","#FFF0F5","Calories burned",dd.cal?"320 cal":"—",dd.cal>0]].map(([icon,bg,label,val,chk],i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<3?`1px solid #F0EFE9`:"none"}}>
            <div style={{width:28,height:28,borderRadius:8,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{icon}</div>
            <div style={{flex:1,fontSize:14}}>{label}</div>
            <div style={{fontSize:13,color:T.muted}}>{val}</div>
            <div style={{width:22,height:22,borderRadius:"50%",background:chk?T.accent:"#F0EFE9",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CheckIcon done={chk}/></div>
          </div>
        ))}
      </div>
      <div style={{padding:"0 16px",marginBottom:14}}>
        <div style={{background:T.card,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,padding:16}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Calorie history · {view==="week"?"This week":`${MONTHS[month]} ${year}`}</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80}}>
            {chartData.map((v,i)=>{
              const pct=v?Math.round((v/maxB)*100):0,color=v===0?"#E8E6E0":v>=2200?T.accent:v>1870?"#5B8DEF":"#FF6B4A";
              return(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{width:"100%",background:T.accentPill,borderRadius:4,height:70,display:"flex",alignItems:"flex-end",overflow:"hidden"}}>
                    <div style={{width:"100%",height:`${pct}%`,background:color,borderRadius:4}}/>
                  </div>
                  <div style={{fontSize:10,color:T.muted,textAlign:"center"}}>{chartLabels[i]}</div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
            <div style={{fontSize:12,color:T.muted}}>Goal: 2,200/day</div>
            <div style={{fontSize:12,color:T.accent,fontWeight:500}}>Avg: 1,940 cal</div>
          </div>
        </div>
      </div>
      <div style={{padding:"0 16px",marginBottom:10}}><div style={{fontSize:15,fontWeight:600}}>Monthly summary</div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,padding:"0 16px",marginBottom:14}}>
        {[["18","Days logged",T.text],["14","Goals met",T.green],["1,940","Avg cal/day",T.text],["12","Workouts done",T.macro[1]]].map(([v,l,c])=>(
          <div key={l} style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,boxShadow:T.glowShadow,padding:14}}>
            <div style={{fontSize:20,fontWeight:600,color:c}}>{v}</div>
            <div style={{fontSize:12,color:T.muted,marginTop:3}}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── SUPABASE CLIENT ──────────────────────────────────────────────
const SUPABASE_URL="https://vghqqksbjpgdzmvfmnru.supabase.co";
const SUPABASE_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaHFxa3NianBnZHptdmZtbnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjAwNzgsImV4cCI6MjA5MzMzNjA3OH0.1JXmsIs9Jk87wd9uTIpNp93gnoqNMtOR78XiDQHUasg";

const sb={
  _url:SUPABASE_URL,_key:SUPABASE_ANON,_session:null,
  headers(extra={}){
    return{"Content-Type":"application/json","apikey":this._key,"Authorization":`Bearer ${this._session?.access_token||this._key}`,...extra};
  },
  async signUp(email,password){
    const r=await fetch(`${this._url}/auth/v1/signup`,{method:"POST",headers:{"Content-Type":"application/json","apikey":this._key},body:JSON.stringify({email,password})});
    return r.json();
  },
  async signIn(email,password){
    const r=await fetch(`${this._url}/auth/v1/token?grant_type=password`,{method:"POST",headers:{"Content-Type":"application/json","apikey":this._key},body:JSON.stringify({email,password})});
    const d=await r.json();
    if(d.access_token){this._session=d;localStorage.setItem("sb_session",JSON.stringify(d));}
    return d;
  },
  async signOut(){
    await fetch(`${this._url}/auth/v1/logout`,{method:"POST",headers:this.headers()});
    this._session=null;localStorage.removeItem("sb_session");
  },
  getUser(){return this._session?.user||null;},
  async select(table,filters="",opts={}){
    const q=[filters,opts.order?`order=${opts.order}`:"",opts.limit?`limit=${opts.limit}`:""].filter(Boolean).join("&");
    const r=await fetch(`${this._url}/rest/v1/${table}?${q}`,{headers:this.headers()});
    if(!r.ok)return[];
    return r.json();
  },
  async insert(table,row){
    const r=await fetch(`${this._url}/rest/v1/${table}`,{method:"POST",headers:this.headers({"Prefer":"return=representation"}),body:JSON.stringify(Array.isArray(row)?row:[row])});
    if(!r.ok)return null;
    const d=await r.json();return Array.isArray(row)?d:d[0];
  },
  async upsert(table,row){
    const r=await fetch(`${this._url}/rest/v1/${table}`,{method:"POST",headers:this.headers({"Prefer":"resolution=merge-duplicates,return=representation"}),body:JSON.stringify(Array.isArray(row)?row:[row])});
    if(!r.ok)return null;
    const d=await r.json();return Array.isArray(row)?d:d[0];
  },
  async delete(table,filter){
    const r=await fetch(`${this._url}/rest/v1/${table}?${filter}`,{method:"DELETE",headers:this.headers()});
    return r.ok;
  },
};

function loadSession(){
  try{const s=JSON.parse(localStorage.getItem("sb_session")||"null");if(s?.access_token)sb._session=s;return s;}catch{return null;}
}

// ── AUTH SCREEN ───────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const T=useTheme();
  const [isLogin,setIsLogin]=useState(true);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const submit=async()=>{
    setError("");
    if(!email.trim()||!password.trim()){setError("Please fill in all fields.");return;}
    if(!isLogin&&password!==confirm){setError("Passwords don't match.");return;}
    if(password.length<6){setError("Password must be at least 6 characters.");return;}
    setLoading(true);
    try{
      if(isLogin){
        const d=await sb.signIn(email.trim(),password);
        console.log("SignIn response:",JSON.stringify(d));
        if(d.error||d.error_description||d.msg){
          const msg=d.error_description||d.msg||d.error||"Login failed";
          if(msg.toLowerCase().includes("confirm")||msg.toLowerCase().includes("email")){
            setError("Please check your email and click the confirmation link first, then try logging in.");
          } else if(msg.toLowerCase().includes("invalid")||msg.toLowerCase().includes("credentials")){
            setError("Incorrect email or password. Please try again.");
          } else {
            setError(msg);
          }
          setLoading(false);return;
        }
        if(!d.access_token){setError("Login failed — no session returned. Check console for details.");setLoading(false);return;}
        onAuth(d.user,false);
      }else{
        const d=await sb.signUp(email.trim(),password);
        console.log("SignUp response:",JSON.stringify(d));
        if(d.error||d.error_description){setError(d.error_description||d.error||"Signup failed.");setLoading(false);return;}
        // Try signing in immediately (works if email confirmation is disabled)
        const d2=await sb.signIn(email.trim(),password);
        console.log("Post-signup SignIn response:",JSON.stringify(d2));
        if(d2.access_token){
          onAuth(d2.user,true);
        } else {
          setError("Account created! Check your email for a confirmation link, then come back and log in.");
        }
      }
    }catch(e){
      console.error("Auth error:",e);
      setError("Network error — check your connection and try again.");
    }
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",fontFamily:"-apple-system,sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-80,right:-60,width:260,height:260,borderRadius:"50%",background:T.accentGlow,filter:"blur(60px)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-60,left:-60,width:200,height:200,borderRadius:"50%",background:`${T.accentSoft}22`,filter:"blur(40px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:`0 8px 28px ${T.accentGlow}`}}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M6 16L11 21L26 9"/><circle cx="16" cy="16" r="13"/></svg>
        </div>
        <div style={{fontSize:28,fontWeight:800,color:T.text,letterSpacing:"-1px"}}>FitTrack</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>Your personal fitness companion</div>
      </div>

      {/* ── DEMO MODE BANNER ── */}
      <div style={{width:"100%",maxWidth:400,background:`${T.accent}15`,border:`1px solid ${T.accent}40`,borderRadius:14,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"flex-start"}}>
        <div style={{fontSize:18,flexShrink:0}}>💡</div>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:3}}>Running inside Claude's preview</div>
          <div style={{fontSize:11,color:T.muted,lineHeight:1.5}}>External network calls are blocked here. Use <strong style={{color:T.text}}>Demo mode</strong> to explore the full app, or deploy to Vercel/Netlify for real accounts.</div>
        </div>
      </div>

      {/* Demo mode button */}
      <div style={{width:"100%",maxWidth:400,marginBottom:16}}>
        <button onClick={()=>onAuth({id:"demo",email:"demo@fittrack.app"},true)}
          style={{width:"100%",background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 20px ${T.accentGlow}`}}>
          🚀 Try Demo Mode (no account needed)
        </button>
      </div>

      <div style={{width:"100%",maxWidth:400,display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{flex:1,height:1,background:T.border}}/>
        <div style={{fontSize:12,color:T.muted}}>or sign in with account</div>
        <div style={{flex:1,height:1,background:T.border}}/>
      </div>

      <div style={{width:"100%",maxWidth:400,background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:"28px 24px",boxShadow:T.glowShadow}}>
        <div style={{display:"flex",background:T.surface,borderRadius:12,padding:4,marginBottom:24}}>
          {[["Log in",true],["Sign up",false]].map(([l,v])=>(
            <div key={l} onClick={()=>{setIsLogin(v);setError("");}} style={{flex:1,padding:"9px",borderRadius:9,fontSize:13,fontWeight:600,textAlign:"center",cursor:"pointer",background:isLogin===v?T.accent:"transparent",color:isLogin===v?"#fff":T.muted,transition:"all 0.15s"}}>{l}</div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          {[["Email","email",email,setEmail,"you@example.com"],["Password","password",password,setPassword,"6+ characters"],[!isLogin&&"Confirm password","password",confirm,setConfirm,"Repeat password"]].filter(Boolean).map(([label,type,val,set,ph])=>(
            label&&<div key={label}>
              <div style={{fontSize:12,fontWeight:600,color:T.subtext,marginBottom:6}}>{label}</div>
              <input type={type} value={val} onChange={e=>set(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={ph}
                style={{width:"100%",background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        {error&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#EF4444",marginBottom:14}}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{width:"100%",background:loading?T.muted:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":`0 4px 20px ${T.accentGlow}`,transition:"all 0.2s"}}>
          {loading?"Please wait…":isLogin?"Log in →":"Create account →"}
        </button>
      </div>
      <div style={{marginTop:20,fontSize:12,color:T.muted,textAlign:"center"}}>By continuing you agree to our Terms of Service.</div>
    </div>
  );
}

// ── ONBOARDING WIZARD ─────────────────────────────────────────────
function OnboardingWizard({userId,onComplete}){
  const T=useTheme();
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [age,setAge]=useState("");
  const [weightLbs,setWeightLbs]=useState("");
  const [heightFt,setHeightFt]=useState("5");
  const [heightIn,setHeightIn]=useState("9");
  const [goal,setGoal]=useState("maintain");
  const [activity,setActivity]=useState("moderate");
  const [saving,setSaving]=useState(false);

  const calcGoals=()=>{
    const w=parseFloat(weightLbs)||170;
    const h=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);
    const a=parseInt(age)||25;
    const bmr=10*(w*0.453592)+6.25*(h*2.54)-5*a+5;
    const mult={sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9};
    const tdee=Math.round(bmr*(mult[activity]||1.55));
    const cal=goal==="lose"?tdee-500:goal==="gain"?tdee+300:tdee;
    const protein=Math.round(w*0.8);
    const fat=Math.round(cal*0.25/9);
    const carbs=Math.max(Math.round((cal-protein*4-fat*9)/4),50);
    return{cal,protein,carbs,fat};
  };

  const finish=async()=>{
    setSaving(true);
    const g=calcGoals();
    const hin=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);
    if(userId){
      await sb.upsert("profiles",{id:userId,name:name.trim()||"Friend",age:parseInt(age)||null,weight_lbs:parseFloat(weightLbs)||null,height_in:hin,goal,activity_level:activity,cal_goal:g.cal,protein_goal:g.protein,carbs_goal:g.carbs,fat_goal:g.fat,theme:"dark",updated_at:new Date().toISOString()});
    }
    setSaving(false);
    onComplete(g,name.trim()||"Friend");
  };

  const inp=(val,set,ph,type="text")=>(
    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
      style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box"}}/>
  );

  const steps=[
    <div key="name" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:24,fontWeight:800,color:T.text,letterSpacing:"-0.8px"}}>What's your name? 👋</div>
      <div style={{fontSize:14,color:T.muted}}>We'll personalise everything for you.</div>
      {inp(name,setName,"Your first name")}
      {inp(age,setAge,"Age (years)","number")}
    </div>,
    <div key="body" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:24,fontWeight:800,color:T.text,letterSpacing:"-0.8px"}}>Body stats 📏</div>
      <div style={{fontSize:14,color:T.muted}}>Used to calculate your personalised calorie target.</div>
      <div>
        <div style={{fontSize:12,fontWeight:600,color:T.subtext,marginBottom:8}}>Weight</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>{inp(weightLbs,setWeightLbs,"e.g. 175","number")}<span style={{fontSize:14,color:T.muted,flexShrink:0}}>lbs</span></div>
      </div>
      <div>
        <div style={{fontSize:12,fontWeight:600,color:T.subtext,marginBottom:8}}>Height</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input type="number" value={heightFt} onChange={e=>setHeightFt(e.target.value)} placeholder="5" style={{flex:1,background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none"}}/>
          <span style={{fontSize:14,color:T.muted,flexShrink:0}}>ft</span>
          <input type="number" value={heightIn} onChange={e=>setHeightIn(e.target.value)} placeholder="9" style={{flex:1,background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none"}}/>
          <span style={{fontSize:14,color:T.muted,flexShrink:0}}>in</span>
        </div>
      </div>
    </div>,
    <div key="goal" style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:24,fontWeight:800,color:T.text,letterSpacing:"-0.8px"}}>Your goal 🎯</div>
      <div style={{fontSize:14,color:T.muted}}>Sets your daily calorie target.</div>
      {[["lose","🔥 Lose weight","Calorie deficit (−500 kcal)"],["maintain","⚖️ Stay lean","Maintenance calories"],["gain","💪 Build muscle","Calorie surplus (+300 kcal)"]].map(([v,l,sub])=>(
        <div key={v} onClick={()=>setGoal(v)} style={{background:goal===v?T.accentPill:T.card,border:`1.5px solid ${goal===v?T.accent:T.border}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:goal===v?T.glowShadow:"none",transition:"all 0.15s"}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>{l}</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>{sub}</div>
          </div>
          {goal===v&&<div style={{width:22,height:22,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4.5,7.5 8,3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
        </div>
      ))}
    </div>,
    <div key="activity" style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:24,fontWeight:800,color:T.text,letterSpacing:"-0.8px"}}>Activity level ⚡</div>
      <div style={{fontSize:14,color:T.muted,marginBottom:2}}>How active are you most days?</div>
      {[["sedentary","🛋️ Sedentary","Desk job, little exercise"],["light","🚶 Lightly active","Light exercise 1-3x/week"],["moderate","🏃 Moderately active","Exercise 3-5x/week"],["active","🔥 Very active","Hard training 6-7x/week"],["very_active","⚡ Extremely active","Physical job + training daily"]].map(([v,l,sub])=>(
        <div key={v} onClick={()=>setActivity(v)} style={{background:activity===v?T.accentPill:T.card,border:`1.5px solid ${activity===v?T.accent:T.border}`,borderRadius:13,padding:"12px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:activity===v?T.glowShadow:"none",transition:"all 0.15s"}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>{l}</div>
            <div style={{fontSize:11,color:T.muted,marginTop:1}}>{sub}</div>
          </div>
          {activity===v&&<div style={{width:20,height:20,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="9" height="9" viewBox="0 0 9 9"><polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
        </div>
      ))}
    </div>,
  ];

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",padding:"20px 20px 36px",fontFamily:"-apple-system,sans-serif",maxWidth:480,margin:"0 auto",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-80,right:-60,width:220,height:220,borderRadius:"50%",background:T.accentGlow,filter:"blur(60px)",pointerEvents:"none"}}/>
      <div style={{display:"flex",gap:6,justifyContent:"center",margin:"8px 0 28px"}}>
        {steps.map((_,i)=><div key={i} style={{width:i===step?28:8,height:8,borderRadius:4,background:i<=step?T.accent:T.border,transition:"all 0.3s"}}/>)}
      </div>
      <div style={{flex:1}}>{steps[step]}</div>
      <div style={{display:"flex",gap:10,marginTop:28}}>
        {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px",color:T.text,fontSize:15,fontWeight:600,cursor:"pointer"}}>Back</button>}
        <button onClick={()=>step<steps.length-1?setStep(s=>s+1):finish()} disabled={saving}
          style={{flex:2,background:saving?T.muted:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":`0 4px 20px ${T.accentGlow}`,transition:"all 0.2s"}}>
          {saving?"Saving…":step<steps.length-1?"Continue →":"Let's go 🎉"}
        </button>
      </div>
    </div>
  );
}

// ── PROFILE / SETTINGS PAGE ───────────────────────────────────────
function ProfilePage({goals,setGoals,userName,setUserName,isDark,setIsDark,onSignOut,onClose}){
  const T=useTheme();
  const [name,setName]=useState(userName||"");
  const [calGoal,setCalGoal]=useState(String(goals?.cal||2200));
  const [protGoal,setProtGoal]=useState(String(goals?.protein||140));
  const [carbGoal,setCarbGoal]=useState(String(goals?.carbs||180));
  const [fatGoal,setFatGoal]=useState(String(goals?.fat||78));
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);

  const save=async()=>{
    setSaving(true);
    const uid=sb.getUser()?.id;
    const g={cal:parseInt(calGoal)||2200,protein:parseInt(protGoal)||140,carbs:parseInt(carbGoal)||180,fat:parseInt(fatGoal)||78};
    if(uid){
      await sb.upsert("profiles",{id:uid,name:name.trim()||userName,cal_goal:g.cal,protein_goal:g.protein,carbs_goal:g.carbs,fat_goal:g.fat,theme:isDark?"dark":"light",updated_at:new Date().toISOString()});
    }
    setUserName(name.trim()||userName);
    setGoals(g);
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:250,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px",backdropFilter:"blur(4px)"}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,width:"100%",maxWidth:460,maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.35)"}}>
        <div style={{padding:"18px 20px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:18,fontWeight:700,color:T.text}}>Profile & Settings</div>
          <div onClick={onClose} style={{width:30,height:30,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"18px 20px 20px",display:"flex",flexDirection:"column",gap:22}}>
          {/* Personal */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Personal</div>
            <div style={{fontSize:12,fontWeight:600,color:T.subtext,marginBottom:6}}>Your name</div>
            <input type="text" value={name} onChange={e=>setName(e.target.value)}
              style={{width:"100%",background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          {/* Goals */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Daily Goals</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["Calories",calGoal,setCalGoal,"kcal"],["Protein",protGoal,setProtGoal,"g"],["Carbs",carbGoal,setCarbGoal,"g"],["Fat",fatGoal,setFatGoal,"g"]].map(([label,val,set,unit])=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:13,color:T.text,width:70,flexShrink:0}}>{label}</div>
                  <input type="number" value={val} onChange={e=>set(e.target.value)}
                    style={{flex:1,background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>
                  <div style={{fontSize:12,color:T.muted,width:28,flexShrink:0}}>{unit}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Appearance */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Appearance</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px 16px"}}>
              <div style={{fontSize:14,color:T.text,fontWeight:500}}>Dark mode</div>
              <div onClick={()=>setIsDark(d=>!d)} style={{width:44,height:26,borderRadius:13,background:isDark?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s"}}>
                <div style={{position:"absolute",top:3,left:isDark?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
          </div>
          {/* Account */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Account</div>
            <div style={{fontSize:13,color:T.subtext,background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",marginBottom:10}}>{sb.getUser()?.email||"—"}</div>
            <div onClick={onSignOut} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:8}}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"><path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3"/><polyline points="11 11 14 8 11 5"/><line x1="14" y1="8" x2="6" y2="8"/></svg>
              <div style={{fontSize:14,fontWeight:600,color:"#EF4444"}}>Sign out</div>
            </div>
          </div>
        </div>
        <div style={{padding:"0 20px 20px",flexShrink:0}}>
          <button onClick={save} disabled={saving}
            style={{width:"100%",background:saved?"#22C55E":saving?T.muted:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:saving?"not-allowed":"pointer",transition:"background 0.2s"}}>
            {saved?"Saved ✓":saving?"Saving…":"Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NAV & INITIAL DATA ────────────────────────────────────────────
const NAV_LEFT=[
  ["home","Home",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8.5L10 2L18 8.5V18H13V13H7V18H2V8.5Z"/></svg>],
  ["food","Food",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3"/></svg>],
];
const NAV_RIGHT=[
  ["workout","Train",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="8" width="3" height="4" rx="1"/><rect x="16" y="8" width="3" height="4" rx="1"/><rect x="4" y="6" width="3" height="8" rx="1"/><rect x="13" y="6" width="3" height="8" rx="1"/><line x1="7" y1="10" x2="13" y2="10"/></svg>],
  ["supps","Supps",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="10" cy="6" rx="5" ry="4"/><path d="M5 6s-1 3-1 6c0 3 2.5 5 6 5s6-2 6-5c0-3-1-6-1-6"/><line x1="5" y1="10" x2="15" y2="10"/></svg>],
  ["calendar","Cal",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="16" height="15" rx="2"/><line x1="2" y1="8" x2="18" y2="8"/><line x1="6" y1="1" x2="6" y2="5"/><line x1="14" y1="1" x2="14" y2="5"/></svg>],
];
const INITIAL_SUPPS=[
  {k:"a",name:"Whey Protein",sub:"30g · Post-workout",dot:"#A855F7"},
  {k:"b",name:"Creatine",sub:"5g · With breakfast",dot:"#06B6D4"},
  {k:"c",name:"Vitamin D3",sub:"2000 IU · Morning",dot:"#F59E0B"},
  {k:"d",name:"Omega-3",sub:"1000mg · With dinner",dot:"#10B981"},
  {k:"e",name:"Magnesium",sub:"400mg · Before bed",dot:"#F97316"},
  {k:"f",name:"Zinc",sub:"30mg · Before bed",dot:"#10B981"},
];

// ── APP ───────────────────────────────────────────────────────────
export default function App(){
  const [authState,setAuthState]=useState("loading");
  const [isDark,setIsDark]=useState(true);
  const T=THEMES[isDark?"dark":"light"];
  const [tab,setTab]=useState("home");
  const [log,setLog]=useState(SEED);
  const [aiOpen,setAiOpen]=useState(false);
  const [quickOpen,setQuickOpen]=useState(false);
  const [customFoods,setCustomFoods]=useState([]);
  const [suppList,setSuppList]=useState(INITIAL_SUPPS);
  const [suppTaken,setSuppTaken]=useState({a:true,b:true,c:true,d:true,e:false,f:false});
  const [history,setHistory]=useState([]);
  const [profileOpen,setProfileOpen]=useState(false);
  const [userName,setUserName]=useState("Johnny");
  const [goals,setGoals]=useState({cal:2200,protein:140,carbs:180,fat:78});

  const today=new Date().toISOString().split("T")[0];

  // Check session on mount
  useEffect(()=>{
    const s=loadSession();
    if(s?.access_token)loadUserData(s.user.id);
    else setAuthState("auth");
  },[]);

  const loadUserData=async(uid)=>{
    try{
      const profiles=await sb.select("profiles",`id=eq.${uid}`);
      if(profiles&&profiles.length>0){
        const p=profiles[0];
        setUserName(p.name||"Johnny");
        setGoals({cal:p.cal_goal||2200,protein:p.protein_goal||140,carbs:p.carbs_goal||180,fat:p.fat_goal||78});
        setIsDark(p.theme!=="light");
        // Food log for today
        const foodRows=await sb.select("food_log",`user_id=eq.${uid}&logged_date=eq.${today}`);
        if(foodRows?.length>0){
          const nl={breakfast:[],lunch:[],dinner:[],snacks:[]};
          foodRows.forEach(r=>{
            const item={id:r.id,name:r.food_name,grams:r.grams,color:r.color||COLORS[0],per100:{cal:r.per100_cal,protein:r.per100_protein,carbs:r.per100_carbs,fat:r.per100_fat,fiber:r.per100_fiber||0,sodium:r.per100_sodium||0}};
            if(nl[r.meal_slot])nl[r.meal_slot].push(item);
          });
          setLog(nl);
        }
        // Custom foods
        const cf=await sb.select("custom_foods",`user_id=eq.${uid}`,{order:"created_at.desc"});
        if(cf?.length>0)setCustomFoods(cf.map(f=>({name:f.name,brand:f.brand||"My foods",servingG:f.serving_g,isCustom:true,per100:{cal:f.per100_cal,protein:f.per100_protein,carbs:f.per100_carbs,fat:f.per100_fat,fiber:f.per100_fiber||0,sodium:f.per100_sodium||0}})));
        // Supplement stack
        const suppRows=await sb.select("supplement_stack",`user_id=eq.${uid}`,{order:"sort_order.asc"});
        if(suppRows?.length>0){
          setSuppList(suppRows.map(s=>({k:s.id,name:s.name,sub:s.sub||"",dot:s.dot_color||"#888",reminderTime:s.reminder_time,reminderEnabled:s.reminder_enabled})));
          const suppLog=await sb.select("supplement_log",`user_id=eq.${uid}&log_date=eq.${today}`);
          const taken={};
          suppRows.forEach(s=>{taken[s.id]=false;});
          if(suppLog?.length>0)suppLog.forEach(l=>{taken[l.supplement_id]=l.taken;});
          setSuppTaken(taken);
        }
        // Workout history
        const sessions=await sb.select("workout_sessions",`user_id=eq.${uid}`,{order:"created_at.desc",limit:20});
        if(sessions?.length>0)setHistory(sessions.map(s=>({id:s.id,workoutName:s.workout_name,date:s.completed_date,duration:s.duration_secs,setsCompleted:s.sets_completed,totalSets:s.total_sets,exercises:s.exercises||[]})));
        setAuthState("app");
      }else{
        setAuthState("onboarding");
      }
    }catch(e){
      console.error("loadUserData error:",e);
      setAuthState("app"); // fallback — still let them use the app
    }
  };

  const handleAuth=(user,isNew)=>{
    if(user?.id==="demo"){
      // Demo mode — skip onboarding, go straight to app
      setUserName("Johnny");
      setGoals({cal:2200,protein:140,carbs:180,fat:78});
      setAuthState("app");
      return;
    }
    if(isNew)setAuthState("onboarding");
    else loadUserData(user.id);
  };

  const handleSignOut=async()=>{
    await sb.signOut();
    setAuthState("auth");
    setLog(SEED);setCustomFoods([]);setSuppList(INITIAL_SUPPS);
    setSuppTaken({a:true,b:true,c:true,d:true,e:false,f:false});
    setHistory([]);setProfileOpen(false);setUserName("Johnny");setGoals({cal:2200,protein:140,carbs:180,fat:78});
  };

  // DB-synced actions
  const uid=sb.getUser()?.id;

  const addFoodItem=async(slot,item)=>{
    setLog(p=>({...p,[slot]:[...p[slot],item]}));
    if(!uid)return;
    await sb.insert("food_log",{user_id:uid,logged_date:today,meal_slot:slot,food_name:item.name,brand:item.brand||"",grams:item.grams,per100_cal:item.per100.cal,per100_protein:item.per100.protein,per100_carbs:item.per100.carbs,per100_fat:item.per100.fat,per100_fiber:item.per100.fiber||0,per100_sodium:item.per100.sodium||0,color:item.color||COLORS[0]});
  };

  const addCustomFoodDB=async(food)=>{
    setCustomFoods(p=>[food,...p]);
    if(!uid)return;
    await sb.insert("custom_foods",{user_id:uid,name:food.name,brand:food.brand||"",serving_g:food.servingG,per100_cal:food.per100.cal,per100_protein:food.per100.protein,per100_carbs:food.per100.carbs,per100_fat:food.per100.fat,per100_fiber:food.per100.fiber||0,per100_sodium:food.per100.sodium||0});
  };

  const addSuppToList=async(item)=>{
    const k=item.k||("s"+Date.now());
    setSuppList(prev=>{if(prev.find(s=>s.k===k))return prev;return [...prev,{k,name:item.name,sub:item.sub||"",dot:item.dot||"#888"}];});
    setSuppTaken(prev=>prev[k]!==undefined?prev:{...prev,[k]:false});
    if(!uid)return;
    await sb.insert("supplement_stack",{user_id:uid,name:item.name,sub:item.sub||"",dot_color:item.dot||"#888",sort_order:suppList.length});
  };

  const toggleSuppTaken=async(k,val)=>{
    setSuppTaken(p=>({...p,[k]:val}));
    if(!uid)return;
    await sb.upsert("supplement_log",{user_id:uid,supplement_id:k,log_date:today,taken:val});
  };

  const saveWorkoutSession=async(session)=>{
    setHistory(p=>[session,...p]);
    if(!uid)return;
    await sb.insert("workout_sessions",{user_id:uid,workout_name:session.workoutName,completed_date:today,duration_secs:session.duration,sets_completed:session.setsCompleted,total_sets:session.totalSets,exercises:session.exercises});
  };

  const taken=suppList.filter(s=>suppTaken[s.k]).length;
  const total=suppList.length;

  // Loading state
  if(authState==="loading")return(
    <ThemeCtx.Provider value={T}>
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"-apple-system,sans-serif"}}>
        <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 8px 28px ${T.accentGlow}`}}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M6 14L11 19L22 9"/><circle cx="14" cy="14" r="12"/></svg>
        </div>
        <div style={{fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.5px"}}>FitTrack</div>
        <div style={{width:28,height:28,border:`2.5px solid ${T.border}`,borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      </div>
    </ThemeCtx.Provider>
  );

  if(authState==="auth")return(
    <ThemeCtx.Provider value={T}><GlobalStyle/><AuthScreen onAuth={handleAuth}/></ThemeCtx.Provider>
  );
  if(authState==="onboarding")return(
    <ThemeCtx.Provider value={T}><GlobalStyle/><OnboardingWizard userId={uid} onComplete={(g,n)=>{setGoals(g);setUserName(n);setAuthState("app");}}/></ThemeCtx.Provider>
  );

  return(
    <ThemeCtx.Provider value={T}>
    <div style={{background:T.bg,maxWidth:480,margin:"0 auto",minHeight:"100vh",fontFamily:"-apple-system,sans-serif",color:T.text,position:"relative",overflow:"hidden",transition:"background 0.25s,color 0.25s"}}>
      <GlobalStyle/>
      {profileOpen&&<ProfilePage goals={goals} setGoals={setGoals} userName={userName} setUserName={setUserName} isDark={isDark} setIsDark={setIsDark} onSignOut={handleSignOut} onClose={()=>setProfileOpen(false)}/>}
      {tab==="home"&&<HomeTab setTab={setTab} log={log} suppList={suppList} suppTaken={suppTaken} workoutHistory={history} isDark={isDark} toggleTheme={()=>setIsDark(d=>!d)} userName={userName} goals={goals} onProfileOpen={()=>setProfileOpen(true)}/>}
      {tab==="food"&&<FoodTab log={log} setLog={setLog} customFoods={customFoods} addCustomFood={addCustomFoodDB} onAddItem={addFoodItem}/>}
      {tab==="workout"&&<WorkoutTab onSessionComplete={saveWorkoutSession}/>}
      {tab==="supps"&&<SuppsTab suppList={suppList} setSuppList={setSuppList} suppTaken={suppTaken} setSuppTaken={toggleSuppTaken} taken={taken} total={total}/>}
      {tab==="calendar"&&<CalendarTab/>}

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:T.navBg,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 8px 18px",zIndex:99,transition:"background 0.25s"}}>
        <div style={{display:"flex",flex:1,justifyContent:"space-around"}}>
          {NAV_LEFT.map(([t,label,icon])=>(
            <div key={t} onClick={()=>setTab(t)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",minWidth:44,color:tab===t?T.accent:T.muted}}>
              {icon}<div style={{fontSize:10,fontWeight:500}}>{label}</div>
            </div>
          ))}
        </div>
        <div onClick={()=>setQuickOpen(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",flexShrink:0,margin:"0 4px"}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,display:"flex",alignItems:"center",justifyContent:"center",marginTop:-24,border:`4px solid ${T.bg}`,boxSizing:"border-box",boxShadow:`0 4px 16px ${T.accentGlow}`}}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><line x1="11" y1="4" x2="11" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><line x1="4" y1="11" x2="18" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </div>
          <div style={{fontSize:10,fontWeight:600,color:T.accent}}>Quick add</div>
        </div>
        <div style={{display:"flex",flex:1,justifyContent:"space-around"}}>
          {NAV_RIGHT.map(([t,label,icon])=>(
            <div key={t} onClick={()=>setTab(t)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",minWidth:44,color:tab===t?T.accent:T.muted}}>
              {icon}<div style={{fontSize:10,fontWeight:500}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div onClick={()=>setAiOpen(o=>!o)} style={{position:"fixed",right:aiOpen?"min(298px,80vw)":0,top:"50%",transform:"translateY(-50%)",background:`linear-gradient(180deg,${T.accent},${T.accentSoft})`,color:"#fff",borderRadius:"8px 0 0 8px",padding:"14px 7px",cursor:"pointer",zIndex:170,transition:"right 0.3s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column",alignItems:"center",gap:6,boxShadow:`-2px 0 16px ${T.accentGlow}`}}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" style={{transform:"rotate(90deg)"}}><rect x="1" y="3" width="14" height="10" rx="2"/><circle cx="5" cy="8" r="1.2" fill="white" stroke="none"/><circle cx="11" cy="8" r="1.2" fill="white" stroke="none"/></svg>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.5px",writingMode:"vertical-rl",textOrientation:"mixed",transform:"rotate(180deg)"}}>AI Coach</div>
      </div>

      <AISidePanel open={aiOpen} onClose={()=>setAiOpen(false)} onAddFood={addFoodItem} onAddSupp={(item)=>{const k="ai"+Date.now();setSuppList(prev=>[...prev,{k,name:item.name,sub:`${item.servingG?item.servingG+"g · ":""}${item.brand||item.category||"Supplement"}`,dot:DOT_COLORS[item.category]||"#888"}]);setSuppTaken(prev=>({...prev,[k]:true}));}}/>
      <QuickAddPanel open={quickOpen} onClose={()=>setQuickOpen(false)} onAddItem={addFoodItem} suppList={suppList} suppTaken={suppTaken} setSuppTaken={toggleSuppTaken} addSuppToList={addSuppToList} customFoods={customFoods} addCustomFood={addCustomFoodDB}/>
    </div>
    </ThemeCtx.Provider>
  );
}
