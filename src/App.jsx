
import React, { useState, useRef, useEffect, useContext, createContext, useMemo } from "react";

// ── THEME SYSTEM ──────────────────────────────────────────────
const THEMES = {
  aurora_dark:{mode:"dark",family:"aurora",
    bg:"#020B18",surface:"#071828",card:"#0A2035",cardAlt:"#071828",
    border:"rgba(6,182,212,0.28)",borderStrong:"rgba(6,182,212,0.55)",
    glowShadow:"0 0 0 1px rgba(6,182,212,0.25),0 0 14px rgba(6,182,212,0.1)",
    glowShadowStrong:"0 0 0 1px rgba(6,182,212,0.5),0 0 20px rgba(6,182,212,0.18)",
    accent:"#06B6D4",accentSoft:"#67E8F9",accentGlow:"rgba(6,182,212,0.4)",accentPill:"rgba(6,182,212,0.14)",
    text:"#F0FDFF",subtext:"#7DD3FC",muted:"#1E4060",
    bannerFrom:"#0A2540",bannerTo:"#020B18",navBg:"#010D16",inputBg:"#071828",
    macro:["#06B6D4","#A855F7","#F472B6","#34D399"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#071828",remainingText:"#7DD3FC",
    calCell:"#071828",calCellSel:"#06B6D4",calMiss:"#1E4060",barEmpty:"#0A2035",
  },
  aurora_light:{mode:"light",family:"aurora",
    bg:"#F8F9FC",surface:"#EEF0F8",card:"#FFFFFF",cardAlt:"#F2F3FA",
    border:"rgba(79,70,229,0.14)",borderStrong:"rgba(79,70,229,0.32)",
    glowShadow:"0 0 0 1px rgba(79,70,229,0.12),0 2px 14px rgba(79,70,229,0.08)",
    glowShadowStrong:"0 0 0 1px rgba(79,70,229,0.28),0 4px 18px rgba(79,70,229,0.12)",
    accent:"#4F46E5",accentSoft:"#6366F1",accentGlow:"rgba(79,70,229,0.18)",accentPill:"rgba(79,70,229,0.08)",
    text:"#0F0F1A",subtext:"rgba(15,15,26,0.48)",muted:"rgba(15,15,26,0.28)",
    bannerFrom:"#1E1B4B",bannerTo:"#111128",navBg:"rgba(248,249,252,0.98)",inputBg:"#EEF0F8",
    macro:["#4F46E5","#0891B2","#DB2777","#10B981"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#EEF0F8",remainingText:"#4F46E5",
    calCell:"#FFFFFF",calCellSel:"#4F46E5",calMiss:"#DDE0F0",barEmpty:"#EEF0F8",
  },
  forest_dark:{mode:"dark",family:"forest",
    bg:"#040D07",surface:"#081510",card:"#0D1F14",cardAlt:"#081510",
    border:"rgba(16,185,129,0.26)",borderStrong:"rgba(16,185,129,0.5)",
    glowShadow:"0 0 0 1px rgba(16,185,129,0.2),0 0 14px rgba(16,185,129,0.09)",
    glowShadowStrong:"0 0 0 1px rgba(16,185,129,0.45),0 0 20px rgba(16,185,129,0.16)",
    accent:"#10B981",accentSoft:"#34D399",accentGlow:"rgba(16,185,129,0.38)",accentPill:"rgba(16,185,129,0.12)",
    text:"#ECFDF5",subtext:"#6EE7B7",muted:"#14532D",
    bannerFrom:"#052E16",bannerTo:"#040D07",navBg:"#030A05",inputBg:"#081510",
    macro:["#10B981","#818CF8","#F472B6","#FBBF24"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#081510",remainingText:"#6EE7B7",
    calCell:"#081510",calCellSel:"#10B981",calMiss:"#14532D",barEmpty:"#0D1F14",
  },
  forest_light:{mode:"light",family:"forest",
    bg:"#F0FAF5",surface:"#DCFCE8",card:"#FFFFFF",cardAlt:"#E8F5EE",
    border:"rgba(5,150,105,0.16)",borderStrong:"rgba(5,150,105,0.35)",
    glowShadow:"0 0 0 1px rgba(5,150,105,0.11),0 2px 12px rgba(5,150,105,0.07)",
    glowShadowStrong:"0 0 0 1px rgba(5,150,105,0.28),0 4px 18px rgba(5,150,105,0.12)",
    accent:"#059669",accentSoft:"#10B981",accentGlow:"rgba(5,150,105,0.18)",accentPill:"rgba(5,150,105,0.09)",
    text:"#052E16",subtext:"rgba(5,46,22,0.5)",muted:"rgba(5,46,22,0.32)",
    bannerFrom:"#052E16",bannerTo:"#0A4D28",navBg:"rgba(240,250,245,0.98)",inputBg:"#DCFCE8",
    macro:["#059669","#6366F1","#DB2777","#0891B2"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#DCFCE8",remainingText:"#059669",
    calCell:"#FFFFFF",calCellSel:"#059669",calMiss:"#BBF7D0",barEmpty:"#DCFCE8",
  },
  ember_dark:{mode:"dark",family:"ember",
    bg:"#0F0700",surface:"#1A0E00",card:"#221200",cardAlt:"#1A0E00",
    border:"rgba(245,158,11,0.28)",borderStrong:"rgba(245,158,11,0.52)",
    glowShadow:"0 0 0 1px rgba(245,158,11,0.22),0 0 14px rgba(245,158,11,0.1)",
    glowShadowStrong:"0 0 0 1px rgba(245,158,11,0.48),0 0 20px rgba(245,158,11,0.18)",
    accent:"#F59E0B",accentSoft:"#FCD34D",accentGlow:"rgba(245,158,11,0.4)",accentPill:"rgba(245,158,11,0.12)",
    text:"#FFFBEB",subtext:"#FDE68A",muted:"#451A03",
    bannerFrom:"#451A03",bannerTo:"#0F0700",navBg:"#0A0500",inputBg:"#1A0E00",
    macro:["#F59E0B","#EF4444","#A855F7","#10B981"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#1A0E00",remainingText:"#FDE68A",
    calCell:"#1A0E00",calCellSel:"#F59E0B",calMiss:"#451A03",barEmpty:"#221200",
  },
  ember_light:{mode:"light",family:"ember",
    bg:"#FFFBF0",surface:"#FEF3C7",card:"#FFFFFF",cardAlt:"#FEF9EC",
    border:"rgba(217,119,6,0.16)",borderStrong:"rgba(217,119,6,0.35)",
    glowShadow:"0 0 0 1px rgba(217,119,6,0.1),0 2px 12px rgba(217,119,6,0.07)",
    glowShadowStrong:"0 0 0 1px rgba(217,119,6,0.28),0 4px 18px rgba(217,119,6,0.12)",
    accent:"#D97706",accentSoft:"#F59E0B",accentGlow:"rgba(217,119,6,0.18)",accentPill:"rgba(217,119,6,0.09)",
    text:"#1C0A00",subtext:"rgba(28,10,0,0.5)",muted:"rgba(28,10,0,0.3)",
    bannerFrom:"#451A03",bannerTo:"#78350F",navBg:"rgba(255,251,240,0.98)",inputBg:"#FEF3C7",
    macro:["#D97706","#DC2626","#7C3AED","#059669"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#FEF3C7",remainingText:"#D97706",
    calCell:"#FFFFFF",calCellSel:"#D97706",calMiss:"#FDE68A",barEmpty:"#FEF3C7",
  },
  rose_dark:{mode:"dark",family:"rose",
    bg:"#0D0409",surface:"#180A14",card:"#1F0C1A",cardAlt:"#180A14",
    border:"rgba(236,72,153,0.26)",borderStrong:"rgba(236,72,153,0.5)",
    glowShadow:"0 0 0 1px rgba(236,72,153,0.2),0 0 14px rgba(236,72,153,0.09)",
    glowShadowStrong:"0 0 0 1px rgba(236,72,153,0.45),0 0 20px rgba(236,72,153,0.16)",
    accent:"#EC4899",accentSoft:"#F9A8D4",accentGlow:"rgba(236,72,153,0.38)",accentPill:"rgba(236,72,153,0.12)",
    text:"#FFF0F6",subtext:"#FBCFE8",muted:"#500724",
    bannerFrom:"#4A0020",bannerTo:"#0D0409",navBg:"#090306",inputBg:"#180A14",
    macro:["#EC4899","#A78BFA","#06B6D4","#34D399"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#180A14",remainingText:"#FBCFE8",
    calCell:"#180A14",calCellSel:"#EC4899",calMiss:"#500724",barEmpty:"#1F0C1A",
  },
  rose_light:{mode:"light",family:"rose",
    bg:"#FFF5FA",surface:"#FFE4F0",card:"#FFFFFF",cardAlt:"#FFF0F6",
    border:"rgba(219,39,119,0.13)",borderStrong:"rgba(219,39,119,0.32)",
    glowShadow:"0 0 0 1px rgba(219,39,119,0.1),0 2px 12px rgba(219,39,119,0.06)",
    glowShadowStrong:"0 0 0 1px rgba(219,39,119,0.26),0 4px 18px rgba(219,39,119,0.1)",
    accent:"#DB2777",accentSoft:"#EC4899",accentGlow:"rgba(219,39,119,0.16)",accentPill:"rgba(219,39,119,0.08)",
    text:"#1A0010",subtext:"rgba(26,0,16,0.5)",muted:"rgba(26,0,16,0.3)",
    bannerFrom:"#831843",bannerTo:"#4A0020",navBg:"rgba(255,245,250,0.98)",inputBg:"#FFE4F0",
    macro:["#DB2777","#7C3AED","#0891B2","#059669"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#FFE4F0",remainingText:"#DB2777",
    calCell:"#FFFFFF",calCellSel:"#DB2777",calMiss:"#FBCFE8",barEmpty:"#FFE4F0",
  },
  obsidian_dark:{mode:"dark",family:"obsidian",
    bg:"#09090F",surface:"#111118",card:"#161622",cardAlt:"#111118",
    border:"rgba(139,92,246,0.22)",borderStrong:"rgba(139,92,246,0.45)",
    glowShadow:"0 0 0 1px rgba(139,92,246,0.18),0 0 14px rgba(139,92,246,0.08)",
    glowShadowStrong:"0 0 0 1px rgba(139,92,246,0.42),0 0 20px rgba(139,92,246,0.15)",
    accent:"#8B5CF6",accentSoft:"#A78BFA",accentGlow:"rgba(139,92,246,0.36)",accentPill:"rgba(139,92,246,0.11)",
    text:"#F5F3FF",subtext:"#C4B5FD",muted:"#2E1065",
    bannerFrom:"#1E1040",bannerTo:"#09090F",navBg:"#060609",inputBg:"#111118",
    macro:["#8B5CF6","#06B6D4","#F472B6","#34D399"],
    red:"#F87171",green:"#34D399",greenBg:"rgba(52,211,153,0.1)",greenText:"#34D399",
    remaining:"#111118",remainingText:"#C4B5FD",
    calCell:"#111118",calCellSel:"#8B5CF6",calMiss:"#2E1065",barEmpty:"#161622",
  },
  obsidian_light:{mode:"light",family:"obsidian",
    bg:"#F8F7FF",surface:"#EEEBFF",card:"#FFFFFF",cardAlt:"#F2F0FE",
    border:"rgba(124,58,237,0.13)",borderStrong:"rgba(124,58,237,0.3)",
    glowShadow:"0 0 0 1px rgba(124,58,237,0.1),0 2px 12px rgba(124,58,237,0.06)",
    glowShadowStrong:"0 0 0 1px rgba(124,58,237,0.26),0 4px 18px rgba(124,58,237,0.1)",
    accent:"#7C3AED",accentSoft:"#8B5CF6",accentGlow:"rgba(124,58,237,0.16)",accentPill:"rgba(124,58,237,0.08)",
    text:"#13005A",subtext:"rgba(19,0,90,0.5)",muted:"rgba(19,0,90,0.3)",
    bannerFrom:"#2E1065",bannerTo:"#1E1040",navBg:"rgba(248,247,255,0.98)",inputBg:"#EEEBFF",
    macro:["#7C3AED","#0891B2","#DB2777","#059669"],
    red:"#DC2626",green:"#059669",greenBg:"rgba(5,150,105,0.07)",greenText:"#047857",
    remaining:"#EEEBFF",remainingText:"#7C3AED",
    calCell:"#FFFFFF",calCellSel:"#7C3AED",calMiss:"#DDD6FE",barEmpty:"#EEEBFF",
  },
};

const ThemeCtx = createContext(THEMES.aurora_dark);
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

const SEED={breakfast:[],lunch:[],dinner:[],snacks:[]};

function calc(item){
  const g=item.grams/100,m=item.per100;
  return{
    cal:Math.round(m.cal*g),
    protein:Math.round(m.protein*g*10)/10,
    carbs:Math.round(m.carbs*g*10)/10,
    fat:Math.round(m.fat*g*10)/10,
    fiber:Math.round(m.fiber*g*10)/10,
    sugar:Math.round((m.sugar||0)*g*10)/10,
    sodium:Math.round(m.sodium*g),
  };
}

function totals(log){
  return Object.values(log).flat().reduce((a,item)=>{
    const m=calc(item);
    return{cal:a.cal+m.cal,protein:Math.round((a.protein+m.protein)*10)/10,carbs:Math.round((a.carbs+m.carbs)*10)/10,fat:Math.round((a.fat+m.fat)*10)/10,fiber:Math.round((a.fiber+m.fiber)*10)/10,sugar:Math.round((a.sugar+m.sugar)*10)/10,sodium:a.sodium+m.sodium};
  },{cal:0,protein:0,carbs:0,fat:0,fiber:0,sugar:0,sodium:0});
}

// ── LONG-PRESS HOOK ───────────────────────────────────────────────
function useLongPress(onLongPress, ms=500){
  const timer=useRef(null);
  const fired=useRef(false);
  const start=(e)=>{
    fired.current=false;
    timer.current=setTimeout(()=>{fired.current=true;onLongPress(e);},ms);
  };
  const cancel=()=>clearTimeout(timer.current);
  const click=(e)=>{if(fired.current)e.stopPropagation();};
  return{onTouchStart:start,onTouchEnd:cancel,onTouchMove:cancel,onMouseDown:start,onMouseUp:cancel,onMouseLeave:cancel,onClick:click};
}


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
    const url="https://api.nal.usda.gov/fdc/v1/foods/search?query="+encodeURIComponent(query)+"&dataType=Branded,Foundation,SR%20Legacy&pageSize=10&api_key="+USDA_API_KEY;
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
    "https://world.openfoodfacts.org/cgi/search.pl?search_terms="+encodeURIComponent(query)+"&search_simple=1&action=process&json=1&page_size=10&fields=product_name,nutriments,brands,serving_quantity",
    "https://world.openfoodfacts.net/api/v2/search?q="+encodeURIComponent(query)+"&page_size=8&fields=product_name,nutriments,brands,serving_quantity",
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
    const url="https://api.nal.usda.gov/fdc/v1/foods/search?query="+encodeURIComponent(query)+"&dataType=Branded&pageSize=8&api_key="+USDA_API_KEY;
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

// ── SIDE RAIL AI PANEL ──────────────────────────────────────────
// ── ACTIONS contract ────────────────────────────────────────────
// One block per reply, multiplicity inside the array rather than across blocks:
// ACTIONS:[{...},{...}]|message. The old contract could express only one intent
// per reply, so "log 8oz of water and add creatine" had no representation.
//
// Module scope, not inside AISidePanel: parseActions closes over nothing, and at
// component scope it was unreachable from a test.
export const MAX_ACTIONS=10;

// Required fields per type. Optional fields are never checked — a missing
// `timing` degrades the card, a missing `name` makes it meaningless.
export const ACTION_VALID={
  water:a=>Number.isFinite(Number(a.oz))&&Number(a.oz)>0,
  // grams>0 is load-bearing: per100 divides by it, and 0 would write Infinity.
  food:a=>Array.isArray(a.items)&&a.items.length>0&&a.items.every(i=>i&&i.name&&Number(i.grams)>0&&Number.isFinite(Number(i.cal))),
  meal_suggestion:a=>Array.isArray(a.items)&&a.items.length>0&&a.items.every(i=>i&&i.name),
  recipe:a=>!!a.name&&Array.isArray(a.ingredients)&&a.ingredients.length>0,
  workout_plan:a=>!!a.name&&Array.isArray(a.exercises)&&a.exercises.length>0,
  supplement:a=>Array.isArray(a.items)&&a.items.length>0&&a.items.every(i=>i&&i.name&&i.category),
};

// Returns null when this is not an ACTIONS reply OR when the JSON is corrupt.
// Corrupt fails CLOSED — a half-parsed array must never be half-executed.
// Individual actions inside a well-formed array fail OPEN: valid siblings commit
// and the dropped ones are named, because the multi-intent case is the whole
// point and an all-or-nothing drop is the silent-swallow pattern again.
export const parseActions=(reply)=>{
  if(!reply.startsWith("ACTIONS:"))return null;
  const rest=reply.slice("ACTIONS:".length);
  const pipeIdx=rest.indexOf("|");
  const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
  const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"";
  let raw;
  try{raw=JSON.parse(jsonStr);}catch{return null;}
  if(!Array.isArray(raw))return null;
  const capped=raw.slice(0,MAX_ACTIONS);
  const overflow=raw.length-capped.length;
  const valid=[],dropped=[];
  capped.forEach(a=>{
    const rule=a&&ACTION_VALID[a.type];
    if(rule&&rule(a))valid.push(a);
    else dropped.push(a&&a.type?String(a.type):"unknown");
  });
  return{valid,dropped,overflow,msg,total:raw.length};
};

// Prefixes of the pre-ACTIONS contract. Still parsed (see send) so a model that
// regresses mid-rollout keeps working; the warn is the countable signal that
// says when removing the six parsers is safe.
export const LEGACY_PREFIXES=["MULTI_FOOD:","MEAL_SUGGESTION:","RECIPE:","WATER_LOG:","ADD_SUPP:","WORKOUT_PLAN:"];
export const legacyFormatOf=(reply)=>LEGACY_PREFIXES.find(p=>reply.startsWith(p))||null;

// food_log stores macros per 100g; the coach and the recipe card both hand over
// absolute macros for a specific gram weight. This scaling was written out by
// hand in five places, which is exactly how a rounding or field-name slip ships
// unnoticed. Callers must guarantee grams>0 (ACTION_VALID.food does).
export const per100From=(item)=>({
  cal:Math.round((item.cal/item.grams)*100),
  protein:Math.round((item.protein/item.grams)*100),
  carbs:Math.round((item.carbs/item.grams)*100),
  fat:Math.round((item.fat/item.grams)*100),
  fiber:0,sodium:0,
});

// A component, not a branch of renderMsg, because it owns collapsible state.
// renderMsg runs inside a .map, so a useState there made the panel's hook count
// depend on how many recipe messages existed: the first recipe card took it
// from 14 hooks to 15 and React threw "Rendered more hooks than during the
// previous render". With no error boundary above it the whole app went blank,
// which means RECIPE — one of the six shipped coach formats — had never once
// rendered. A component instance owns its own hooks, so the count is stable no
// matter how many recipe cards a conversation accumulates.
function RecipeCard({m,idx,onAddFood,setMessages}){
  const T=useTheme();
  const r=m.recipe;
  const [showSteps,setShowSteps]=useState(false);
  const logRecipe=()=>{
    if(!onAddFood||m.logged)return;
    (r.ingredients||[]).forEach(ing=>{
      onAddFood(r.slot||"snacks",{
        id:Date.now()+Math.random(),
        name:ing.name,grams:ing.grams,
        color:COLORS[Math.floor(Math.random()*COLORS.length)],
        per100:per100From(ing),
      });
    });
    setMessages(prev=>prev.map((x,xi)=>xi===idx?{...x,logged:true}:x));
  };
  return(
    <div style={{alignSelf:"flex-start",maxWidth:"100%",display:"flex",flexDirection:"column",gap:7}}>
      <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
      <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:16,overflow:"hidden",boxShadow:T.glowShadow}}>
        {/* Header */}
        <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),padding:"12px 14px"}}>
          <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{r.name}</div>
          <div style={{display:"flex",gap:14,marginTop:6}}>
            {[["🔥",r.totalCal+" kcal"],["💪",r.totalProtein+"g P"],["🌾",r.totalCarbs+"g C"],["🫐",r.totalFat+"g F"]].map(([ic,val])=>(
              <div key={val} style={{fontSize:11,color:"rgba(255,255,255,0.65)"}}>{ic} {val}</div>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div style={{padding:"10px 14px",borderBottom:("1px solid "+T.border)}}>
          <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Ingredients</div>
          {(r.ingredients||[]).map((ing,ii)=>(
            <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:ii<r.ingredients.length-1?("1px solid "+T.border+"33"):"none"}}>
              <div style={{fontSize:13,color:T.text}}>{ing.name} <span style={{fontSize:11,color:T.muted}}>{ing.grams}g</span></div>
              <div style={{fontSize:11,color:T.muted}}>{ing.cal} kcal</div>
            </div>
          ))}
        </div>

        {/* Steps — collapsible */}
        <div onClick={()=>setShowSteps(s=>!s)} style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderBottom:("1px solid "+T.border)}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text}}>📋 Instructions ({(r.steps||[]).length} steps)</div>
          <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:showSteps?"rotate(180deg)":"none",transition:"transform 0.2s"}}><polyline points="1,3 6,9 11,3" stroke={T.muted} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </div>
        {showSteps&&(
          <div style={{padding:"8px 14px 10px"}}>
            {(r.steps||[]).map((step,si)=>(
              <div key={si} style={{display:"flex",gap:10,padding:"5px 0",borderBottom:si<r.steps.length-1?("1px solid "+T.border+"22"):"none"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.accent,flexShrink:0}}>{si+1}</div>
                <div style={{fontSize:12,color:T.text,lineHeight:1.5}}>{step}</div>
              </div>
            ))}
          </div>
        )}

        {/* Log button */}
        {m.logged
          ?<div style={{padding:"11px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:T.green}}>✓ All ingredients logged to {r.slot||"snacks"}</div>
          :<div onClick={logRecipe} style={{padding:"11px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:T.accent,cursor:"pointer",background:T.accentPill}}>
            + Log all ingredients
          </div>
        }
      </div>
    </div>
  );
}

function AISidePanel({open,onClose,onAddFood,onAddSupp,onAddWorkout,onAddWater,liveContext={},userName="",userId=""}){
  const T=useTheme();
  const STORAGE_KEY="wifit_chat_"+(userId||"demo");

  // ── Feature 7: Persistent chat — load from localStorage ───────
  const [messages,setMessages]=useState(()=>{
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      if(saved){const parsed=JSON.parse(saved);if(parsed?.length>0)return parsed;}
    }catch{}
    return[{bot:true,text:"Hey"+(userName?" "+userName.split(" ")[0]:"")+"! I'm your AI Coach. Tell me what you ate and I'll log it, ask for meal ideas based on your remaining macros, or say make me a workout 💪"}];
  });

  // Persist messages to localStorage whenever they change (keep last 30)
  useEffect(()=>{
    // Never persist error bubbles — a transient failure shouldn't outlive the session.
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(messages.filter(m=>!m.isError).slice(-30)));}catch{}
  },[messages]);

  // Two-step so a mis-tap next to the ✕ can't wipe the history. Reverts on its own.
  const [confirmClear,setConfirmClear]=useState(false);
  const clearChat=()=>{
    setConfirmClear(false);
    setSuggestions([]);
    try{localStorage.removeItem(STORAGE_KEY);}catch{}
    setMessages([{bot:true,text:"Hey"+(userName?" "+userName.split(" ")[0]:"")+"! I'm your AI Coach. Tell me what you ate and I'll log it, ask for meal ideas based on your remaining macros, or say make me a workout 💪"}]);
  };

  const [input,setInput]=useState("");
  const [thinking,setThinking]=useState(false);
  const [suggestions,setSuggestions]=useState([]); // Feature 8
  const [photoLoading,setPhotoLoading]=useState(false); // Feature 9
  const photoInputRef=useRef();
  const bottomRef=useRef();
  const checkinDoneRef=useRef(false);

  const buildContextBlock=()=>{
    const c=liveContext;
    if(!c.calGoal)return "";
    const pctCal=c.calGoal>0?Math.round((c.calConsumed/c.calGoal)*100):0;
    const remaining=Math.max(0,(c.calGoal||2200)-(c.calConsumed||0));
    const protRemain=Math.max(0,(c.protGoal||140)-(c.protConsumed||0));
    const carbRemain=Math.max(0,(c.carbGoal||180)-(c.carbConsumed||0));
    const fatRemain=Math.max(0,(c.fatGoal||78)-(c.fatConsumed||0));
    const waterPct=Math.round(((c.waterOz||0)/128)*100);
    const now=new Date();
    const hour=now.getHours();
    const timeOfDay=hour<12?"morning":hour<17?"afternoon":"evening";
    const mealSlot=hour<10?"breakfast":hour<14?"lunch":hour<18?"dinner":"snacks";
    const timeStr=now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
    // Pre-compute supplement stack string to avoid nested template literals
    const suppStackStr=c.suppList&&c.suppList.length>0
      ?c.suppList.map(s=>{
        const taken=c.suppTakenMap&&c.suppTakenMap[s.k]?" ✅":" ⬜";
        const sub=s.sub?" ("+s.sub+")":"";
        return s.name+sub+taken;
      }).join(", ")
      :"No supplements added yet";
    // Pre-compute weight trend string
    const weightStr=(()=>{
      if(!c.weightLog||c.weightLog.length<2)return "No weight data logged yet.";
      const recent=c.weightLog.slice(-7);
      const diff=recent[recent.length-1].lbs-recent[0].lbs;
      const trend=diff<0?"down "+Math.abs(diff).toFixed(1)+"lbs":diff>0?"up "+diff.toFixed(1)+"lbs":"stable";
      return "User's recent weights: "+recent.map(w=>w.date+": "+w.lbs+"lbs").join(", ")+"\nTrend: "+trend+"\nIf user asks about progress, reference this trend specifically.";
    })();

    return "\n"+
"══════════════════════════════════════\n"+
"USER'S LIVE DATA RIGHT NOW\n"+
"══════════════════════════════════════\n"+
"Name: "+(userName||"the user")+"\n"+
"Time: "+timeOfDay+" ("+timeStr+") — default meal slot: "+mealSlot+"\n\n"+
"TODAY'S CALORIES:\n"+
"  Consumed: "+(c.calConsumed||0)+" kcal ("+pctCal+"% of goal)\n"+
"  Remaining: "+remaining+" kcal\n"+
"  Goal: "+(c.calGoal||2200)+" kcal\n\n"+
"TODAY'S MACROS REMAINING:\n"+
"  Protein: "+protRemain+"g left (consumed "+(c.protConsumed||0)+"g / goal "+(c.protGoal||140)+"g)\n"+
"  Carbs: "+carbRemain+"g left (consumed "+(c.carbConsumed||0)+"g / goal "+(c.carbGoal||180)+"g)\n"+
"  Fat: "+fatRemain+"g left (consumed "+(c.fatConsumed||0)+"g / goal "+(c.fatGoal||78)+"g)\n\n"+
"WATER: "+(c.waterOz||0)+" oz logged today ("+waterPct+"% of 128oz goal)\n"+
"WORKOUT TODAY: "+(c.workoutDone?"✅ Completed":"❌ Not done yet")+"\n"+
"SUPPLEMENT STACK: "+suppStackStr+"\n"+
"SUPPLEMENTS TAKEN: "+(c.suppTaken||0)+"/"+(c.suppTotal||0)+" today\n\n"+
"WEIGHT DATA: "+weightStr+"\n\n"+
"ALWAYS use this live data when giving advice. Reference actual numbers. If they ask what to eat, use their remaining macros.";
  };

  const buildSystem=()=>`You are an expert fitness and nutrition AI coach built into a personal fitness tracking app.

Keep responses concise — mobile chat panel, 3-4 sentences max unless asked for detail. Be direct, specific, and reference the user's actual data when relevant.

CRITICAL — OUTPUT CONTRACT: Output EXACTLY ONE block per response, and it is always an ACTIONS block:

ACTIONS:[{"type":"...", ...}, {"type":"...", ...}]|Your coaching message here.

One block, one pipe, done. Never emit two blocks. When a message contains more than one intent ("log 8oz of water and add creatine to my stack"), that is TWO ENTRIES IN THE ONE ARRAY — not two blocks, and not a choice between them. If a request has no actionable intent, reply in plain text with no ACTIONS block at all.

The sections below say WHEN each action applies and WHAT fields it needs. Their field names are unchanged; only the wrapper differs. Map them to these type values:

- {"type":"food","items":[{name,grams,slot,cal,protein,carbs,fat}]}     — the FOOD LOGGING section
- {"type":"meal_suggestion","items":[{...,description}]}                — the MEAL SUGGESTIONS section
- {"type":"water","oz":16}                                              — the WATER LOGGING section
- {"type":"supplement","items":[{name,dose,timing,category,note}]}      — the SUPPLEMENT section
- {"type":"recipe","name":...,"ingredients":[...],"steps":[...],...}    — the RECIPE section
- {"type":"workout_plan","name":...,"exercises":[...],...}              — the WORKOUT PLAN section

Ignore the literal MULTI_FOOD:/WATER_LOG:/ADD_SUPP:/RECIPE:/WORKOUT_PLAN:/MEAL_SUGGESTION: prefixes shown in the examples below — those are the previous contract. Emit the same data as ACTIONS entries. Maximum 10 actions per response.
${buildContextBlock()}

══════════════════════════════════════
FOOD LOGGING — MANDATORY FORMAT
══════════════════════════════════════
When the user mentions eating or logging food (single OR multiple items), respond ONLY in this format:

MULTI_FOOD:[{"name":"Grilled Chicken Breast","grams":200,"slot":"lunch","cal":330,"protein":62,"carbs":0,"fat":7},{"name":"White Rice","grams":150,"slot":"lunch","cal":195,"protein":4,"carbs":42,"fat":1}]|Your coaching message here.

STRICT RULES:
- Always use MULTI_FOOD format even for a single food item
- Use the current meal slot from live data unless user specifies otherwise
- Use realistic per-100g macros scaled to the actual grams mentioned
- Round all numbers to integers
- The message after | must be 1-2 sentences referencing their remaining macros
- Do NOT add code blocks or extra text

══════════════════════════════════════
MEAL SUGGESTIONS — MANDATORY FORMAT
══════════════════════════════════════
When the user asks what to eat, asks for meal ideas, or asks what fits their macros:

MEAL_SUGGESTION:[{"name":"Grilled Salmon","grams":180,"slot":"dinner","cal":372,"protein":54,"carbs":0,"fat":18,"description":"High protein, fits your fat remaining"},{"name":"Roasted Sweet Potato","grams":150,"slot":"dinner","cal":129,"protein":2,"carbs":30,"fat":0,"description":"Good carb source to hit your target"}]|Explanation of why this fits their goals.

RULES:
- Suggest 2-4 foods that together fit within REMAINING calories and macros
- description field explains why each food was chosen

══════════════════════════════════════
WATER LOGGING — MANDATORY FORMAT  
══════════════════════════════════════
When the user mentions drinking water: WATER_LOG:{"oz":16}|Tip here.
- Convert any unit to oz: 1 glass=8oz, 1 bottle=16oz, 1L=33.8oz

══════════════════════════════════════
SUPPLEMENT LOGGING — MANDATORY FORMAT
══════════════════════════════════════
When the user explicitly asks to add or recommend a supplement — respond ONLY in this format:

ADD_SUPP:[{"name":"Creatine Monohydrate","dose":"5g","timing":"Post-workout","category":"performance","note":"Take with water or juice for better absorption"},{"name":"Vitamin D3","dose":"2000 IU","timing":"Morning with food","category":"vitamin","note":"Pair with K2 for best absorption"}]|Your 1-2 sentence coaching note.

STRICT RULES:
- Use ADD_SUPP format when the user asks to add or get supplement recommendations — not for one-line coaching tips or general advice
- category must be one of: protein, vitamin, mineral, performance, health, sleep, fat_burner, probiotic
- Include realistic dose and optimal timing
- If user already has the supplement in their stack (check SUPPLEMENT STACK above), say so in the message after | instead of adding a duplicate
- Do NOT add code blocks or extra text

══════════════════════════════════════
RECIPE MODE
══════════════════════════════════════
When user asks for a recipe, asks "how do I make X", or says "give me a recipe for X":

RECIPE:{"name":"High Protein Chicken Bowl","totalCal":520,"totalProtein":58,"totalCarbs":42,"totalFat":12,"servings":1,"ingredients":[{"name":"Grilled Chicken Breast","grams":200,"cal":330,"protein":62,"carbs":0,"fat":7},{"name":"Brown Rice","grams":100,"cal":111,"protein":3,"carbs":23,"fat":1},{"name":"Broccoli","grams":80,"cal":27,"protein":3,"carbs":5,"fat":0}],"steps":["Season chicken with salt, pepper, garlic powder","Grill 6-7 mins each side until 165°F","Cook rice per package","Steam broccoli 5 mins","Assemble and serve"],"slot":"lunch"}|Brief coaching note.

RULES: ingredients must have accurate macros, max 6 steps, slot matches time of day.

══════════════════════════════════════
WORKOUT PLAN CREATION — MANDATORY FORMAT
══════════════════════════════════════
When user asks to create, build, or add a workout — respond ONLY in this format:

WORKOUT_PLAN:{"name":"Push Day","tag":"Push","level":"Intermediate","estMin":45,"scheduledDay":"Monday","exercises":[{"name":"Bench Press","sets":4,"reps":8,"weight":135},{"name":"Overhead Press","sets":3,"reps":10,"weight":75},{"name":"Tricep Pushdown","sets":3,"reps":12,"weight":50}]}|One coaching tip about this workout.

RULES:
- scheduledDay must be a day of the week or null
- weight is in lbs, use 0 if bodyweight
- Always include at least 4 exercises
- level: Beginner / Intermediate / Advanced`;
  const callClaude=async(userMsg,history)=>{
    // isError bubbles are our own failure text, not something the coach said.
    // Replayed as assistant turns they poison every later request — and if one
    // lands first in the window, messages[0].role is "assistant" and Anthropic
    // 400s, so a single failure breaks the conversation permanently.
    const contextMsgs=history.filter(m=>!m.type&&!m.isCheckin&&!m.isError).slice(-10).map(m=>({role:m.bot?"assistant":"user",content:m.text}));
    const res=await fetch("/api/coach",{
      method:"POST",
      headers:coachHeaders(),
      body:JSON.stringify({max_tokens:1200,system:buildSystem(),messages:[...contextMsgs,{role:"user",content:userMsg}]}),
    });
    if(!res.ok){
      const errBody=await res.json().catch(()=>({}));
      if(errBody.error)console.error("[WiFit/coach]",errBody.error);
      // Carry the status so callers can tell "signed out" from "network down".
      const err=new Error("API error "+res.status);
      err.status=res.status;
      err.userMessage=errBody.error||"";
      throw err;
    }
    const data=await res.json();
    return data.content?.[0]?.text||"Sorry, I couldn't get a response. Try again!";
  };

  // ── Feature 3: Weekly check-in on Monday ──────────────────────
  useEffect(()=>{
    if(!open||checkinDoneRef.current)return;
    const now=new Date();
    if(now.getDay()!==1)return; // Only Monday
    const lastKey="wifit_checkin_"+now.getFullYear()+"_"+now.getMonth()+"_w"+Math.floor(now.getDate()/7);
    if(localStorage.getItem(lastKey))return;
    checkinDoneRef.current=true;
    localStorage.setItem(lastKey,"1");

    const c=liveContext;
    const generateCheckin=async()=>{
      setThinking(true);
      try{
        const prompt="Generate a Monday weekly check-in summary for "+(userName||"the user")+".\n"+
"Their current stats: "+(c.calConsumed||0)+" kcal consumed today, "+(c.waterOz||0)+"oz water, workout "+(c.workoutDone?"done":"not done")+", "+(c.suppTaken||0)+"/"+(c.suppTotal||0)+" supplements taken.\n"+
"Goal: "+(c.calGoal||2200)+" kcal/day.\n\n"+
"Write a warm, motivating 2-3 sentence Monday check-in message that:\n"+
"1. Acknowledges it's the start of a new week\n"+
"2. Gives 1 specific actionable goal for the week based on their stats\n"+
"3. Ends with encouragement\n\n"+
"Keep it personal and concise. Do NOT use any logging format — just plain text.";
        const reply=await callClaude(prompt,[]);
        setMessages(prev=>[...prev,{bot:true,text:reply,isCheckin:true}]);
      }catch{
        setMessages(prev=>[...prev,{bot:true,text:"Happy Monday"+(userName?" "+userName.split(" ")[0]:"")+"! 🌟 New week, fresh start. What are we tackling today?",isCheckin:true}]);
      }
      setThinking(false);
    };
    setTimeout(generateCheckin,800);
  },[open]);

  const parseMultiFoodReply=(reply)=>{
    if(!reply.startsWith("MULTI_FOOD:"))return null;
    try{
      const rest=reply.slice("MULTI_FOOD:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Logged!";
      const items=JSON.parse(jsonStr);
      return{items,msg};
    }catch{return null;}
  };

  const parseWaterReply=(reply)=>{
    if(!reply.startsWith("WATER_LOG:"))return null;
    try{
      const rest=reply.slice("WATER_LOG:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Water logged!";
      const data=JSON.parse(jsonStr);
      return{oz:data.oz||8,msg};
    }catch{return null;}
  };

  const parseMealSuggestion=(reply)=>{
    if(!reply.startsWith("MEAL_SUGGESTION:"))return null;
    try{
      const rest=reply.slice("MEAL_SUGGESTION:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Here's what fits your goals!";
      const items=JSON.parse(jsonStr);
      return{items,msg};
    }catch{return null;}
  };

  const parseWorkoutReply=(reply)=>{
    if(!reply.startsWith("WORKOUT_PLAN:"))return null;
    try{
      const rest=reply.slice("WORKOUT_PLAN:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Here's your workout!";
      const plan=JSON.parse(jsonStr);
      return{plan,msg};
    }catch{return null;}
  };

  const parseRecipe=(reply)=>{
    if(!reply.startsWith("RECIPE:"))return null;
    try{
      const rest=reply.slice("RECIPE:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Here's your recipe!";
      const recipe=JSON.parse(jsonStr);
      return{recipe,msg};
    }catch{return null;}
  };

  const parseAddSupp=(reply)=>{
    if(!reply.startsWith("ADD_SUPP:"))return null;
    try{
      const rest=reply.slice("ADD_SUPP:".length);
      const pipeIdx=rest.indexOf("|");
      const jsonStr=pipeIdx>-1?rest.slice(0,pipeIdx):rest;
      const msg=pipeIdx>-1?rest.slice(pipeIdx+1).trim():"Supplement added!";
      const items=JSON.parse(jsonStr);
      return{items,msg};
    }catch{return null;}
  };

  // Emits exactly the message objects the six card renderers already consume —
  // no renderer changes. Auto-commit is limited to water and food, both of which
  // have a one-tap undo elsewhere in the app; supplement, workout_plan, recipe
  // and meal_suggestion all render as proposals.
  // recipe and workout_plan carry their payload flat on the action; the card
  // renderers want it nested under .recipe / .plan without the discriminator.
  const withoutType=(a)=>{const o={...a};delete o.type;return o;};

  const applyActions=({valid,dropped,overflow,msg,total})=>{
    const out=[];
    let hasSupp=false;
    valid.forEach(a=>{
      const text=out.length===0?msg:"";
      if(a.type==="water"&&onAddWater){
        const oz=Number(a.oz);
        onAddWater(oz);
        out.push({bot:true,type:"water_logged",oz,text:text||"Water logged!"});
      }else if(a.type==="food"&&onAddFood){
        const logged=[];
        a.items.forEach(item=>{
          onAddFood(item.slot||"snacks",{
            id:Date.now()+Math.random(),
            name:item.name,
            grams:item.grams,
            color:COLORS[Math.floor(Math.random()*COLORS.length)],
            per100:per100From(item),
          });
          logged.push(item);
        });
        out.push({bot:true,type:"multi_food_logged",items:logged,text});
      }else if(a.type==="meal_suggestion"){
        out.push({bot:true,type:"meal_suggestion",items:a.items,text,logged:false});
      }else if(a.type==="recipe"){
        out.push({bot:true,type:"recipe",recipe:withoutType(a),text,logged:false});
      }else if(a.type==="workout_plan"){
        out.push({bot:true,type:"workout_plan",plan:withoutType(a),text,added:false});
      }else if(a.type==="supplement"&&onAddSupp){
        hasSupp=true;
        out.push({bot:true,type:"supp_added",items:a.items,text,added:false});
      }
    });
    // Nothing rendered a card, but the model still said something.
    if(out.length===0&&msg)out.push({bot:true,text:msg});
    // Name what was dropped. Silence here would recreate the failure mode this
    // whole contract exists to avoid.
    const skipped=dropped.length+overflow;
    if(skipped>0){
      const names=dropped.length?dropped.join(", "):"";
      out.push({bot:true,text:"Couldn't apply "+skipped+" of "+total+" actions"+(names?" ("+names+")":"")+(overflow>0?" — over the "+MAX_ACTIONS+"-action limit":"")+"."});
    }
    setMessages(prev=>[...prev,...out]);
    if(hasSupp&&msg)generateSuggestions(msg);
  };

  const send=async(text)=>{
    const msg=text||input.trim();
    if(!msg||thinking)return;
    setInput("");setSuggestions([]);
    const userMsg={bot:false,text:msg};
    setMessages(prev=>[...prev,userMsg]);

    // Every message goes to the model. There is no local pre-classification:
    // the old parseIntent matched substrings against 81 hardcoded product names
    // and committed a write before the model was ever asked. "ate" is a
    // substring of "water", so "how much water should I drink" logged 8 oz; and
    // "protein" in the supplement word list meant "I had 30g of protein" added a
    // whey product to the stack instead of logging food. The model already
    // returns a format prefix — it is the only thing that should choose.
    setThinking(true);
    try{
      const reply=await callClaude(msg,[...messages,userMsg]);

      // ── Current contract ──
      const actions=parseActions(reply);
      if(actions){
        applyActions(actions);
        setThinking(false);return;
      }

      // ── Legacy contract, still honoured (C1) ──
      // Both contracts are live so a mid-rollout regression to a single-format
      // reply routes correctly instead of falling through to raw text. Removing
      // the six parsers is safe only once this warn stops appearing in real use.
      const legacy=LEGACY_PREFIXES.find(p=>reply.startsWith(p));
      if(legacy)console.warn("[coach] legacy format:",legacy,"— still in use; parser removal (C2) not yet safe.");

      // Multi-food
      const foodParsed=parseMultiFoodReply(reply);
      if(foodParsed&&onAddFood){
        const loggedItems=[];
        foodParsed.items.forEach(item=>{
          const foodObj={
            id:Date.now()+Math.random(),
            name:item.name,
            grams:item.grams,
            color:COLORS[Math.floor(Math.random()*COLORS.length)],
            per100:per100From(item),
          };
          onAddFood(item.slot||"snacks",foodObj);
          loggedItems.push(item);
        });
        setMessages(prev=>[...prev,{bot:true,type:"multi_food_logged",items:loggedItems,text:foodParsed.msg}]);
        setThinking(false);return;
      }

      // Meal suggestion
      const mealParsed=parseMealSuggestion(reply);
      if(mealParsed){
        setMessages(prev=>[...prev,{bot:true,type:"meal_suggestion",items:mealParsed.items,text:mealParsed.msg,logged:false}]);
        setThinking(false);return;
      }

      // Recipe
      const recipeParsed=parseRecipe(reply);
      if(recipeParsed){
        setMessages(prev=>[...prev,{bot:true,type:"recipe",recipe:recipeParsed.recipe,text:recipeParsed.msg,logged:false}]);
        setThinking(false);return;
      }
      // Water
      const waterParsed=parseWaterReply(reply);
      if(waterParsed&&onAddWater){
        onAddWater(waterParsed.oz);
        setMessages(prev=>[...prev,{bot:true,type:"water_logged",oz:waterParsed.oz,text:waterParsed.msg}]);
        setThinking(false);return;
      }

      // Supplement add (from Claude structured response)
      const suppParsed=parseAddSupp(reply);
      // Proposed, not committed. The stack is persistent and there is no undo
      // in the chat, so a supplement gets the same confirmation card
      // WORKOUT_PLAN and RECIPE already use. This is what turns a misrouted
      // reply — "please remove my push day workout" answered with a B12 block —
      // into a card the user can ignore instead of a write they have to undo.
      if(suppParsed&&onAddSupp){
        setMessages(prev=>[...prev,{bot:true,type:"supp_added",items:suppParsed.items,text:suppParsed.msg,added:false}]);
        generateSuggestions(suppParsed.msg);
        setThinking(false);return;
      }
      const workoutParsed=parseWorkoutReply(reply);
      if(workoutParsed){
        setMessages(prev=>[...prev,{bot:true,type:"workout_plan",plan:workoutParsed.plan,text:workoutParsed.msg,added:false}]);
        setThinking(false);return;
      }

      // Plain text
      setMessages(prev=>[...prev,{bot:true,text:reply}]);
      generateSuggestions(reply);
    }catch(e){
      setMessages(prev=>[...prev,{bot:true,isError:true,
        text:coachErrorText(e,"I'm having trouble connecting right now. Try again!")}]);
    }
    setThinking(false);
  };

  const addPlanToWorkouts=(msgIdx,plan)=>{
    onAddWorkout&&onAddWorkout(plan);
    setMessages(prev=>prev.map((m,i)=>i===msgIdx?{...m,added:true}:m));
  };

  // Commits the supplements a reply proposed. Mirrors addPlanToWorkouts: the
  // write happens here, on an explicit tap, not on the reply arriving.
  const addSuppsToStack=(msgIdx,items)=>{
    (items||[]).forEach(s=>{
      const dot={protein:"#F472B6",vitamin:"#FBBF24",mineral:"#34D399",performance:"#06B6D4",health:"#A78BFA",sleep:"#818CF8",fat_burner:"#F97316",probiotic:"#6EE7B7"}[s.category]||"#888";
      onAddSupp&&onAddSupp({k:"ai"+Date.now()+Math.random(),name:s.name,sub:(s.dose||"")+(s.timing?" · "+s.timing:""),dot,category:s.category,note:s.note});
    });
    setMessages(prev=>prev.map((m,i)=>i===msgIdx?{...m,added:true}:m));
  };

  // ── Feature 4: Voice input ────────────────────────────────────
  const [listening,setListening]=useState(false);
  const recognitionRef=useRef(null);
  const hasVoice=typeof window!=="undefined"&&("SpeechRecognition" in window||"webkitSpeechRecognition" in window);

  const startListening=()=>{
    if(!hasVoice||listening)return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const rec=new SR();
    rec.continuous=false;rec.interimResults=false;rec.lang="en-US";
    rec.onstart=()=>setListening(true);
    rec.onresult=(e)=>{
      const transcript=e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    rec.onerror=()=>setListening(false);
    rec.onend=()=>setListening(false);
    recognitionRef.current=rec;
    rec.start();
  };

  const stopListening=()=>{
    recognitionRef.current?.stop();
    setListening(false);
  };

  // ── Feature 8: Contextual suggested replies ───────────────────
  const generateSuggestions=async(lastBotMsg)=>{
    if(!lastBotMsg||lastBotMsg.length<10)return;
    try{
      const res=await fetch("/api/coach",{
        method:"POST",headers:coachHeaders(),
        body:JSON.stringify({
          max_tokens:120,
          system:"You are a fitness AI. Given the assistant's last response, output EXACTLY 3 short follow-up questions/actions the user might want next, as a JSON array of strings. Max 6 words each. No punctuation. Output ONLY the JSON array, nothing else.",
          messages:[{role:"user",content:"Assistant just said: \""+lastBotMsg.slice(0,200)+"\"\nGenerate 3 follow-ups:"}],
        }),
      });
      const d=await res.json();
      const rawText=d.content?.[0]?.text||"[]";
      const bt=String.fromCharCode(96);
      const cleanText=rawText.split(bt+bt+bt+"json").join("").split(bt+bt+bt).join("").trim();
      const arr=JSON.parse(cleanText);
      if(Array.isArray(arr))setSuggestions(arr.slice(0,3));
    }catch{setSuggestions([]);}
  };

  // ── Feature 9: Photo food logging ────────────────────────────
  const analyzePhoto=async(file)=>{
    setPhotoLoading(true);setSuggestions([]);
    setMessages(prev=>[...prev,{bot:false,text:"📷 Analyzing photo…"}]);
    try{
      const base64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(",")[1]);
        r.onerror=rej;r.readAsDataURL(file);
      });
      const hour=new Date().getHours();
      const slotHint=hour<12?"breakfast":hour<17?"lunch":"dinner";
      const resp=await fetch("/api/coach",{
        method:"POST",headers:coachHeaders(),
        body:JSON.stringify({
          max_tokens:600,
          system:"You are a nutrition AI analyzing a food photo. Respond ONLY in this exact format:\n"+
"MULTI_FOOD:[{\"name\":\"Food Name\",\"grams\":150,\"slot\":\""+slotHint+"\",\"cal\":247,\"protein\":46,\"carbs\":0,\"fat\":6}]|One sentence about the meal.\n"+
"Rules: estimate grams from visual cues, include ALL visible foods, use slot \""+slotHint+"\". If no food visible: PHOTO_ERROR:Cannot identify food in this image.|",
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}},
            {type:"text",text:"Log the food in this photo."},
          ]}],
        }),
      });
      if(!resp.ok){
        // Without this a 401 fell through as an empty reply and reported
        // "couldn't parse the meal" — blaming the photo for an auth failure.
        const eb=await resp.json().catch(()=>({}));
        if(eb.error)console.error("[WiFit/coach]",eb.error);
        const err=new Error("API error "+resp.status);
        err.status=resp.status;
        err.userMessage=eb.error||"";
        throw err;
      }
      const d=await resp.json();
      const reply=d.content?.[0]?.text||"";
      if(reply.startsWith("PHOTO_ERROR:")){
        setMessages(prev=>[...prev,{bot:true,text:reply.slice(12).split("|")[0]||"Could not identify food. Try a clearer photo."}]);
      }else{
        const parsed=parseMultiFoodReply(reply);
        if(parsed&&onAddFood){
          const items=[];
          parsed.items.forEach(item=>{
            onAddFood(item.slot||slotHint,{id:Date.now()+Math.random(),name:item.name,grams:item.grams,color:COLORS[Math.floor(Math.random()*COLORS.length)],
              per100:per100From(item)});
            items.push(item);
          });
          const msg={bot:true,type:"multi_food_logged",items,text:parsed.msg};
          setMessages(prev=>[...prev,msg]);
          generateSuggestions(parsed.msg);
        }else{
          setMessages(prev=>[...prev,{bot:true,text:"Couldn't parse the meal from that photo. Try again with better lighting."}]);
        }
      }
    }catch(e){setMessages(prev=>[...prev,{bot:true,isError:true,
      text:coachErrorText(e,"Photo analysis failed. Check your connection and try again.")}]);}
    setPhotoLoading(false);
  };

  const renderMsg=(m,i)=>{

    // ── Recipe card ─────────────────────────────────────────────
    // Its own component: it owns collapsible state, and a hook cannot live in
    // renderMsg (see RecipeCard).
    if(m.type==="recipe")return <RecipeCard key={i} m={m} idx={i} onAddFood={onAddFood} setMessages={setMessages}/>;

    // ── Meal suggestion card ────────────────────────────────────
    if(m.type==="meal_suggestion"){
      const totalCal=m.items.reduce((s,it)=>s+(it.cal||0),0);
      const totalProt=m.items.reduce((s,it)=>s+(it.protein||0),0);
      const totalCarbs=m.items.reduce((s,it)=>s+(it.carbs||0),0);
      const totalFat=m.items.reduce((s,it)=>s+(it.fat||0),0);
      const logAll=()=>{
        if(!onAddFood)return;
        m.items.forEach(item=>{
          onAddFood(item.slot||"snacks",{
            id:Date.now()+Math.random(),
            name:item.name,grams:item.grams,
            color:COLORS[Math.floor(Math.random()*COLORS.length)],
            per100:per100From(item),
          });
        });
        setMessages(prev=>prev.map((x,xi)=>xi===i?{...x,logged:true}:x));
      };
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"100%",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,overflow:"hidden",boxShadow:T.glowShadow}}>
            <div style={{padding:"10px 14px 8px",borderBottom:("1px solid "+T.border)}}>
              <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Suggested meal</div>
              {m.items.map((it,ii)=>(
                <div key={ii} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{it.name} <span style={{fontSize:11,color:T.muted,fontWeight:400}}>{it.grams}g</span></div>
                    <div style={{fontSize:12,fontWeight:700,color:T.accent}}>{it.cal} kcal</div>
                  </div>
                  {it.description&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>{it.description}</div>}
                </div>
              ))}
            </div>
            {/* Totals row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0,borderBottom:("1px solid "+T.border)}}>
              {[["Cal",totalCal,T.macro[0]],["Prot",totalProt+"g",T.macro[1]],["Carbs",totalCarbs+"g",T.macro[2]],["Fat",totalFat+"g",T.macro[3]]].map(([l,v,c],ti)=>(
                <div key={l} style={{padding:"7px 4px",textAlign:"center",borderRight:ti<3?"1px solid "+T.border:"none"}}>
                  <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:9,color:T.muted,marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
            {/* Log button */}
            {m.logged
              ?<div style={{padding:"10px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:T.green}}>✓ Logged to your food diary</div>
              :<div onClick={logAll} style={{padding:"11px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:T.accent,cursor:"pointer",background:T.accentPill}}>
                + Log this meal
              </div>
            }
          </div>
        </div>
      );
    }

    // ── Multi-food logged card ──────────────────────────────────
    if(m.type==="multi_food_logged"){
      const totalCal=m.items.reduce((s,it)=>s+(it.cal||0),0);
      const totalProt=m.items.reduce((s,it)=>s+(it.protein||0),0);
      const totalCarbs=m.items.reduce((s,it)=>s+(it.carbs||0),0);
      const totalFat=m.items.reduce((s,it)=>s+(it.fat||0),0);
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"98%",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),borderRadius:14,padding:"12px 14px",color:"#fff"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Logged to {m.items[0]?.slot||"snacks"}</div>
            {m.items.map((it,ii)=>(
              <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:ii<m.items.length-1?"1px solid rgba(255,255,255,0.08)":"none"}}>
                <div style={{fontSize:13,fontWeight:500}}>{it.name} <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{it.grams}g</span></div>
                <div style={{fontSize:12,fontWeight:700,color:T.accentSoft}}>{it.cal} kcal</div>
              </div>
            ))}
            <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.12)",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
              {[["Cal",totalCal,"#A855F7"],["Prot",totalProt+"g","#EC4899"],["Carbs",totalCarbs+"g","#06B6D4"],["Fat",totalFat+"g","#10B981"]].map(([l,v,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,0.07)",borderRadius:7,padding:"5px 3px",textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ── Water logged card ───────────────────────────────────────
    if(m.type==="water_logged"){
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"95%",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:"linear-gradient(135deg,rgba(6,182,212,0.18),rgba(6,182,212,0.06))",border:("1px solid "+T.accent+"44"),borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:24}}>💧</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:T.accent}}>{m.oz} oz logged</div>
              <div style={{fontSize:11,color:T.muted,marginTop:1}}>Added to your daily water intake</div>
            </div>
          </div>
        </div>
      );
    }

    // ── Supplements added card ──────────────────────────────────
    if(m.type==="supp_added"){
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"100%",display:"flex",flexDirection:"column",gap:7}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,overflow:"hidden",boxShadow:T.glowShadow}}>
            <div style={{padding:"8px 14px",borderBottom:("1px solid "+T.border),display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:14}}>💊</div>
              <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>{m.added?"Added to your stack":"Suggested supplements"}</div>
            </div>
            {m.items.map((s,si)=>{
              const dot={protein:"#F472B6",vitamin:"#FBBF24",mineral:"#34D399",performance:"#06B6D4",health:"#A78BFA",sleep:"#818CF8",fat_burner:"#F97316",probiotic:"#6EE7B7"}[s.category]||"#888";
              return(
                <div key={si} style={{padding:"10px 14px",borderBottom:si<m.items.length-1?"1px solid "+T.border:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:dot,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text}}>{s.name}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>{s.dose}{s.timing?" · "+s.timing:""}</div>
                    </div>
                    {m.added&&<div style={{background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,color:"#22C55E"}}>✓ Added</div>}
                  </div>
                  {s.note&&<div style={{fontSize:11,color:T.muted,marginTop:6,paddingLeft:20,lineHeight:1.5,fontStyle:"italic"}}>{s.note}</div>}
                </div>
              );
            })}
            <div style={{padding:"10px 14px",borderTop:("1px solid "+T.border)}}>
              {m.added
                ?<div style={{background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:10,padding:"10px",textAlign:"center",color:"#22C55E",fontSize:13,fontWeight:700}}>✓ Added to your stack</div>
                :<button onClick={()=>addSuppsToStack(i,m.items)} style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>💊 Add to my stack</button>
              }
            </div>
          </div>
        </div>
      );
    }

    // ── Workout plan card ───────────────────────────────────────
    if(m.type==="workout_plan"){
      const p=m.plan;
      return(
        <div key={i} style={{alignSelf:"flex-start",maxWidth:"100%",display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:13,lineHeight:1.5,color:T.text}}>{m.text}</div>
          <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),borderRadius:14,padding:14,border:("1px solid "+T.border)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{p.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>{p.tag} · {p.level} · ~{p.estMin}min{p.scheduledDay?" · "+p.scheduledDay:""}</div>
              </div>
              <div style={{background:"rgba(6,182,212,0.2)",borderRadius:8,padding:"4px 8px",fontSize:10,fontWeight:700,color:T.accent}}>{p.exercises?.length} exercises</div>
            </div>
            {(p.exercises||[]).map((ex,ei)=>(
              <div key={ei} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"7px 10px",marginBottom:5}}>
                <div style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.9)"}}>{ex.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{ex.sets}×{ex.reps}{ex.weight>0?" · "+ex.weight+"lbs":""}</div>
              </div>
            ))}
            {m.added
              ?<div style={{marginTop:8,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:10,padding:"10px",textAlign:"center",color:"#22C55E",fontSize:13,fontWeight:700}}>✓ Added to your workout plans</div>
              :<button onClick={()=>addPlanToWorkouts(i,p)} style={{marginTop:8,width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>💪 Add to my workout plans</button>
            }
          </div>
        </div>
      );
    }

    // ── Plain message ───────────────────────────────────────────
    return(
      <div key={i} style={{maxWidth:"90%",padding:"9px 12px",borderRadius:m.bot?"14px 14px 14px 3px":"14px 14px 3px 14px",fontSize:13,lineHeight:1.5,background:m.bot?T.surface:T.accent,color:m.bot?T.text:"#fff",alignSelf:m.bot?"flex-start":"flex-end"}}>{m.text}</div>
    );
  };

  return(
    <>
      {open&&<div onClick={onClose} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.15)",zIndex:150}}/>}
      <div style={{position:"fixed",top:0,right:0,height:"100%",width:open?"min(300px,82vw)":0,background:T.card,borderLeft:open?"1px solid "+T.border:"none",zIndex:160,transition:"width 0.3s cubic-bezier(.4,0,.2,1)",overflow:"hidden",display:"flex",flexDirection:"column",maxWidth:"80%"}}>
        <div style={{width:"100%",display:"flex",flexDirection:"column",height:"100%"}}>
          <div style={{padding:"16px 14px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,background:thinking?"#F59E0B":T.accent,borderRadius:"50%",transition:"background 0.3s",boxShadow:thinking?"0 0 8px #F59E0B":""}}/>
              <div style={{fontSize:15,fontWeight:600,color:T.text}}>AI Coach</div>
              {thinking&&<div style={{fontSize:11,color:"#F59E0B",fontWeight:500}}>thinking…</div>}
            </div>
            {/* Text, not an icon: this is destructive and sits next to the ✕.
                The only escape from a broken chat, so it lives in the header —
                the message list scrolls away and the composer needs a working
                round trip. */}
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div onClick={()=>{
                if(confirmClear){clearChat();return;}
                setConfirmClear(true);
                setTimeout(()=>setConfirmClear(false),3000);
              }} style={{fontSize:12,fontWeight:confirmClear?700:500,color:confirmClear?"#E24B4A":T.muted,cursor:"pointer",padding:"4px 6px",userSelect:"none"}}>
                {confirmClear?"Clear?":"Clear"}
              </div>
              <div onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"12px 12px 8px",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((m,i)=>renderMsg(m,i))}
            {thinking&&(
              <div style={{alignSelf:"flex-start",background:T.surface,borderRadius:"14px 14px 14px 3px",padding:"10px 14px",display:"flex",gap:5,alignItems:"center"}}>
                {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.accent,opacity:0.8,animation:("bounce 1.2s ease-in-out "+i*0.2+"s infinite")}}/>)}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          {/* Suggested replies — Feature 8 */}
          {suggestions.length>0&&!thinking&&(
            <div style={{padding:"0 10px 6px",display:"flex",gap:5,flexWrap:"wrap"}}>
              {suggestions.map((s,i)=>(
                <div key={i} onClick={()=>send(s)}
                  style={{background:T.accentPill,border:("1px solid "+T.accent+"44"),borderRadius:16,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer",color:T.accent,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                  {s}
                </div>
              ))}
            </div>
          )}
          <div style={{padding:"0 10px 8px",display:"flex",gap:6,flexWrap:"wrap"}}>
            {["Log my lunch","Add creatine to my stack","Make me a leg day","What should I eat now?"].map(c=>(
              <div key={c} onClick={()=>!thinking&&send(c)} style={{background:T.surface,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:500,cursor:thinking?"not-allowed":"pointer",whiteSpace:"nowrap",color:thinking?T.muted:T.text,opacity:thinking?0.5:1}}>{c}</div>
            ))}
          </div>
          <div style={{padding:"8px 10px 20px",borderTop:("1px solid "+T.border),display:"flex",gap:6,flexShrink:0}}>
            {/* Photo button — Feature 9 */}
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
              onChange={e=>{const f=e.target.files?.[0];if(f)analyzePhoto(f);e.target.value="";}}/>
            <button onClick={()=>!thinking&&!photoLoading&&photoInputRef.current?.click()} disabled={thinking||photoLoading}
              title="Log food from photo"
              style={{width:34,height:34,borderRadius:"50%",background:photoLoading?"#F59E0B":T.surface,border:"1px solid "+(photoLoading?"#F59E0B":T.border),display:"flex",alignItems:"center",justifyContent:"center",cursor:(thinking||photoLoading)?"not-allowed":"pointer",flexShrink:0,transition:"all 0.2s"}}>
              {photoLoading
                ?<div style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                :<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.muted} strokeWidth="1.4" strokeLinecap="round">
                  <rect x="1" y="3" width="12" height="9" rx="1.5"/>
                  <circle cx="7" cy="7.5" r="2.5"/>
                  <path d="M5 3V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V3"/>
                </svg>
              }
            </button>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!thinking&&send()}
              placeholder={listening?"Listening…":thinking?"Claude is thinking…":"Log food, water, or ask anything…"}
              disabled={thinking}
              style={{flex:1,background:T.surface,color:T.text,border:("1px solid "+listening?T.accent:T.border),boxShadow:listening?T.glowShadow:"none",borderRadius:20,padding:"8px 12px",fontSize:13,outline:"none",opacity:thinking?0.6:1,transition:"border-color 0.2s"}}/>
            {/* Mic button */}
            {hasVoice&&(
              <button onClick={listening?stopListening:startListening} disabled={thinking}
                title={listening?"Stop listening":"Voice input"}
                style={{width:34,height:34,borderRadius:"50%",background:listening?"#EF4444":T.surface,border:"1px solid "+(listening?"#EF4444":T.border),display:"flex",alignItems:"center",justifyContent:"center",cursor:thinking?"not-allowed":"pointer",flexShrink:0,transition:"all 0.2s",boxShadow:listening?"0 0 8px rgba(239,68,68,0.4)":"none"}}>
                <svg width="13" height="16" viewBox="0 0 13 16" fill="none">
                  <rect x="3.5" y="1" width="6" height="9" rx="3" fill={listening?"#fff":T.muted}/>
                  <path d="M1 8c0 3 2.5 5 5.5 5s5.5-2 5.5-5" stroke={listening?"#fff":T.muted} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  <line x1="6.5" y1="13" x2="6.5" y2="15.5" stroke={listening?"#fff":T.muted} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <button onClick={()=>!thinking&&send()} disabled={thinking}
              style={{width:34,height:34,borderRadius:"50%",background:thinking?T.muted:T.accent,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:thinking?"not-allowed":"pointer",flexShrink:0,transition:"background 0.2s"}}>
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
    addSuppToList({k:"s"+Date.now(),name:s.name,sub:(s.servingG?s.servingG+"g · ":"")+(s.brand||s.category||"Supplement"),dot:DOT_COLORS[s.category]||"#888",category:s.category||null});
    clearSearch();
  };

  const saveCustom=()=>{
    if(!newName.trim())return;
    addSuppToList({k:"m"+Date.now(),name:newName.trim(),sub:newDose.trim()||newCat,dot:DOT_COLORS[newCat]||"#888",category:newCat||null});
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
          style={{flex:1,minWidth:0,background:T.inputBg,color:T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none"}}
        />
        <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,flexShrink:0,minWidth:64}}>
          {loading?"…":"Search"}
        </button>
      </div>

      {/* Category chips — browsing only */}
      {browsing&&(
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
          {["All","Protein","Creatine","Vitamins","Omega-3","Pre-Workout","Electrolytes","Sleep"].map(c=>(
            <div key={c} onClick={()=>setCat(c)} style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:("1px solid "+T.border),background:cat===c?T.accent:T.card,color:cat===c?"#fff":T.muted,whiteSpace:"nowrap",flexShrink:0}}>{c}</div>
          ))}
        </div>
      )}

      {/* Results */}
      {displayed.length>0&&(
        <div>
          <div style={{fontSize:12,color:T.muted,marginBottom:8}}>{browsing?"Browse & add to your stack":"Tap to add to your stack"}</div>
          {displayed.map((s,i)=>(
            <div key={i} onClick={()=>addFromSearch(s)} style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",marginBottom:7,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:DOT_COLORS[s.category]||"#888",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,lineHeight:1.3}}>{s.name}</div>
                <div style={{fontSize:11,color:T.muted,marginTop:1}}>{s.brand||""}{s.category?" · "+s.category:""}{s.servingG?" · "+s.servingG+"g/serving":""}</div>
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
          <div onClick={()=>setShowCreate(true)} style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:6,background:T.accentPill,border:("1px solid "+T.border),borderRadius:20,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}>
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
            Create "{query}"
          </div>
        </div>
      )}

      {/* Create supplement form */}
      {showCreate&&(
        <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:T.accentPill,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
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
            style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}
          />
          <input
            value={newDose} onChange={e=>setNewDose(e.target.value)}
            placeholder="Dose & timing (e.g. 600mg · Morning)"
            style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}
          />
          <div>
            <div style={{fontSize:12,color:T.muted,marginBottom:7}}>Category</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Protein","Vitamins","Creatine","Omega-3","Pre-Workout","Sleep","Supplement"].map(c=>(
                <div key={c} onClick={()=>setNewCat(c)} style={{padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:("1px solid "+T.border),background:newCat===c?T.accent:T.card,color:newCat===c?"#fff":T.muted}}>{c}</div>
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
        <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,overflow:"hidden"}}>
          {suppList.map(({k,name,sub,dot},i)=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:i<suppList.length-1?"1px solid "+T.border:"none"}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:dot,flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:T.text}}>{name}</div><div style={{fontSize:11,color:T.muted,marginTop:1}}>{sub}</div></div>
              <div onClick={()=>setSuppTaken(k,!suppTaken[k])} style={{width:44,height:26,borderRadius:13,background:suppTaken[k]?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:suppTaken[k]?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
          ))}
        </div>
        {/* Add custom shortcut */}
        <div onClick={()=>{setShowCreate(true);setNewName("");}} style={{marginTop:10,border:("1.5px dashed "+T.border),borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.muted} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{fontSize:13,color:T.muted,fontWeight:500}}>Add custom supplement</div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── QUICK-ADD PANEL ─────────────────────────────────────────────
// ── BARCODE SCANNER ──────────────────────────────────────────────
function BarcodeScanner({onResult,onClose}){
  const T=useTheme();
  const videoRef=useRef();
  const streamRef=useRef();
  const detectorRef=useRef();
  const rafRef=useRef();
  const [status,setStatus]=useState("starting"); // starting | scanning | error | manual
  const [manualCode,setManualCode]=useState("");
  const [looking,setLooking]=useState(false);

  const lookupBarcode=async(code)=>{
    setLooking(true);
    setStatus("looking");
    try{
      const r=await fetch("https://world.openfoodfacts.org/api/v0/product/"+code+".json");
      const d=await r.json();
      if(d.status===1&&d.product){
        const p=d.product;
        const n=p.nutriments;
        const food={
          name:p.product_name||(p.brands?p.brands+" product":"Unknown product"),
          brand:p.brands||"",
          servingG:parseFloat(p.serving_quantity)||100,
          isCustom:false,
          per100:{
            cal:Math.round(n["energy-kcal_100g"]||n["energy_100g"]/4.184||0),
            protein:Math.round((n.proteins_100g||0)*10)/10,
            carbs:Math.round((n.carbohydrates_100g||0)*10)/10,
            fat:Math.round((n.fat_100g||0)*10)/10,
            fiber:Math.round((n.fiber_100g||0)*10)/10,
            sodium:Math.round((n.sodium_100g||0)*1000),
          }
        };
        stopCamera();
        onResult(food);
      }else{
        setStatus("notfound");
        setLooking(false);
      }
    }catch{
      setStatus("error");
      setLooking(false);
    }
  };

  const stopCamera=()=>{
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t=>t.stop());
  };

  useEffect(()=>{
    let active=true;
    const start=async()=>{
      // Check BarcodeDetector support
      if(!("BarcodeDetector" in window)){setStatus("manual");return;}
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
        if(!active){stream.getTracks().forEach(t=>t.stop());return;}
        streamRef.current=stream;
        if(videoRef.current){
          videoRef.current.srcObject=stream;
          await videoRef.current.play();
        }
        detectorRef.current=new window.BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39"]});
        setStatus("scanning");
        const scan=async()=>{
          if(!active)return;
          try{
            const codes=await detectorRef.current.detect(videoRef.current);
            if(codes.length>0){
              stopCamera();
              await lookupBarcode(codes[0].rawValue);
              return;
            }
          }catch{}
          rafRef.current=requestAnimationFrame(scan);
        };
        scan();
      }catch{
        setStatus("manual");
      }
    };
    start();
    return()=>{active=false;stopCamera();};
  },[]);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:300,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"100%",maxWidth:420,padding:"0 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
        {/* Header */}
        <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>Scan barcode</div>
          <div onClick={()=>{stopCamera();onClose();}} style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/><line x1="11" y1="1" x2="1" y2="11" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Camera viewport */}
        {(status==="scanning"||status==="starting")&&(
          <div style={{position:"relative",width:"100%",aspectRatio:"1",borderRadius:20,overflow:"hidden",background:"#000"}}>
            <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover"}} playsInline muted/>
            {/* Scan frame overlay */}
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:200,height:120,border:"2px solid rgba(6,182,212,0.8)",borderRadius:12,boxShadow:"0 0 0 9999px rgba(0,0,0,0.4)",position:"relative"}}>
                {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h])=>(
                  <div key={v+h} style={{position:"absolute",[v]:-2,[h]:-2,width:20,height:20,borderTop:v==="top"?"2px solid #06B6D4":"none",borderBottom:v==="bottom"?"2px solid #06B6D4":"none",borderLeft:h==="left"?"2px solid #06B6D4":"none",borderRight:h==="right"?"2px solid #06B6D4":"none",borderRadius:v==="top"&&h==="left"?"4px 0 0 0":v==="top"&&h==="right"?"0 4px 0 0":v==="bottom"&&h==="left"?"0 0 0 4px":"0 0 4px 0"}}/>
                ))}
                <div style={{position:"absolute",top:"50%",left:0,right:0,height:2,background:"rgba(6,182,212,0.6)",animation:"scanLine 2s ease-in-out infinite"}}/>
              </div>
            </div>
            <div style={{position:"absolute",bottom:16,left:0,right:0,textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.7)"}}>Point at a food barcode</div>
          </div>
        )}

        {status==="looking"&&(
          <div style={{textAlign:"center",padding:"40px 0",color:"#fff"}}>
            <div style={{fontSize:32,marginBottom:12}}>🔍</div>
            <div style={{fontSize:15,fontWeight:600}}>Looking up product…</div>
          </div>
        )}

        {status==="notfound"&&(
          <div style={{textAlign:"center",padding:"20px 0",color:"#fff"}}>
            <div style={{fontSize:32,marginBottom:8}}>😕</div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Product not found</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:16}}>This product isn't in the Open Food Facts database.</div>
            <button onClick={()=>setStatus("manual")} style={{background:T.accent,border:"none",borderRadius:10,padding:"10px 20px",color:"#fff",fontWeight:600,cursor:"pointer"}}>Enter barcode manually</button>
          </div>
        )}

        {/* Manual fallback */}
        {(status==="manual"||!("BarcodeDetector" in window))&&(
          <div style={{width:"100%",background:"rgba(255,255,255,0.08)",borderRadius:16,padding:20,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>
              {!("BarcodeDetector" in window)?"Camera scanning isn't supported in this browser.":"Enter the barcode number manually:"}
            </div>
            <input value={manualCode} onChange={e=>setManualCode(e.target.value.replace(/\D/g,""))}
              placeholder="e.g. 0737628064502"
              style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"#fff",outline:"none",textAlign:"center",letterSpacing:2}}/>
            <button onClick={()=>manualCode.length>=8&&lookupBarcode(manualCode)} disabled={manualCode.length<8||looking}
              style={{background:manualCode.length>=8?T.accent:"rgba(255,255,255,0.1)",border:"none",borderRadius:10,padding:"12px",color:"#fff",fontWeight:700,cursor:manualCode.length>=8?"pointer":"default",fontSize:14}}>
              {looking?"Looking up…":"Look up barcode"}
            </button>
          </div>
        )}

        <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",textAlign:"center"}}>Powered by Open Food Facts</div>
      </div>
      <style>{`@keyframes scanLine{0%,100%{top:10%}50%{top:85%}}`}</style>
    </div>
  );
}

const GOAL_OZ=128;

function WeightLogWidget({weightLog=[],onLog}){
  const T=useTheme();
  const [input,setInput]=useState("");
  const [logged,setLogged]=useState(false);
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const todayEntry=weightLog.find(w=>w.date===localDate());
  // The input branch used to be gated on todayEntry alone, so once today had a
  // row the only affordance left was an "update" link that set `logged` — a
  // value this ternary never reads. Today's weight could be logged once and
  // never corrected. `editing` is what reopens it.
  const showInput=!todayEntry||editing;

  // No local range check: logWeight owns validation (finite, 0<w<=1500) and is
  // the only thing that can explain a rejection to the user. A second, narrower
  // guard here returned silently — 45 or 800 lbs did nothing with no message.
  const handleLog=async()=>{
    if(saving)return;
    setSaving(true);
    const ok=await onLog(input);
    setSaving(false);
    if(!ok)return; // logWeight already surfaced the reason and rolled back
    setInput("");setEditing(false);
    setLogged(true);setTimeout(()=>setLogged(false),2000);
  };

  // Trend: difference between first and last entry
  const trend=weightLog.length>1?(weightLog[weightLog.length-1].lbs-weightLog[0].lbs).toFixed(1):null;
  const trendColor=trend===null?"":parseFloat(trend)<0?T.green:parseFloat(trend)>0?"#F97316":T.muted;

  return(
    <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:16,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
      <div style={{fontSize:20}}>⚖️</div>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>Body weight</div>
          {trend!==null&&(
            <div style={{fontSize:11,fontWeight:700,color:trendColor}}>
              {parseFloat(trend)<0?"↓":"↑"} {Math.abs(parseFloat(trend))}lbs ({weightLog.length} days)
            </div>
          )}
        </div>
        {!showInput
          ?<div style={{fontSize:12,color:T.muted}}>Today: <span style={{color:T.accent,fontWeight:700}}>{todayEntry.lbs} lbs</span> — <span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>{setInput(String(todayEntry.lbs));setEditing(true);}}>update</span></div>
          :<div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input type="number" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLog()}
              placeholder="Log today's weight"
              style={{flex:1,background:T.surface,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"7px 10px",fontSize:13,outline:"none"}}/>
            <div style={{fontSize:11,color:T.muted,flexShrink:0}}>lbs</div>
            <div onClick={handleLog} style={{background:logged?"#22C55E":T.accent,border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:700,color:"#fff",cursor:saving?"default":"pointer",opacity:saving?0.6:1,flexShrink:0,transition:"background 0.2s"}}>
              {saving?"…":logged?"✓":"Log"}
            </div>
          </div>
        }
      </div>
    </div>
  );
}



function WeekStrip({log,suppList=[],suppTaken={},workoutHistory=[],waterOz=0,goals={},onViewCalendar}){
  const T=useTheme();
  const todayObj=new Date();
  const todayStr=localDate(todayObj);
  const calGoal=goals?.cal||2200;

  // Build Mon–Sun week containing today
  const dow=todayObj.getDay();
  const diffToMon=dow===0?-6:1-dow;
  const monday=new Date(todayObj);monday.setDate(todayObj.getDate()+diffToMon);

  const days=Array.from({length:7},(_,i)=>{
    const d=new Date(monday);d.setDate(monday.getDate()+i);
    return{
      ds:localDate(d),
      label:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i],
      num:d.getDate(),
    };
  });

  // Compute today's live stats from props
  const todayCal=log?Object.values(log).flat().reduce((s,item)=>{
    return s+Math.round(((item.per100?.cal||0)*(item.grams||0))/100);
  },0):0;
  const takenCount=(suppList||[]).filter(s=>suppTaken?.[s.k]).length;
  const totalSupps=(suppList||[]).length;
  const todayWorkout=(workoutHistory||[]).find(w=>w.date===todayStr);

  // Status dots for a day — today uses live data, past days show from calData (simplified: just streak logic)
  const todayStatus={
    food:todayCal>0,
    workout:!!todayWorkout,
    supps:totalSupps>0&&takenCount>=totalSupps,
    water:waterOz>=(GOAL_OZ*0.75),
  };

  const getDots=(ds)=>{
    if(ds===todayStr)return todayStatus;
    // Past days — show partial info from workout history
    const hadWorkout=!!(workoutHistory||[]).find(w=>w.date===ds);
    return{food:false,workout:hadWorkout,supps:false,water:false};
  };

  return(
    <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:16,padding:"10px 14px 8px"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:11,fontWeight:700,color:T.text}}>This week</div>
        <div onClick={onViewCalendar}
          style={{display:"flex",alignItems:"center",gap:4,background:T.accentPill,border:("1px solid "+T.accent+"44"),borderRadius:20,padding:"3px 9px",cursor:"pointer"}}>
          <svg width="10" height="10" viewBox="0 0 11 11" fill="none" stroke={T.accent} strokeWidth="1.4" strokeLinecap="round">
            <rect x="1" y="2" width="9" height="8" rx="1.5"/>
            <line x1="3.5" y1="1" x2="3.5" y2="3"/>
            <line x1="7.5" y1="1" x2="7.5" y2="3"/>
            <line x1="1" y1="5" x2="10" y2="5"/>
          </svg>
          <div style={{fontSize:9,fontWeight:700,color:T.accent}}>Full calendar</div>
        </div>
      </div>

      {/* Day cells */}
      <div style={{display:"flex",gap:3}}>
        {days.map(({ds,label,num})=>{
          const isToday=ds===todayStr;
          const isFuture=ds>todayStr;
          const st=getDots(ds);
          const allDone=!isFuture&&st.food&&st.workout&&st.supps&&st.water;

          return(
            <div key={ds} style={{
              flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              padding:"5px 1px 4px",borderRadius:10,
              background:isToday?T.accentPill:"transparent",
              border:isToday?"1.5px solid "+T.accent+"44":"1.5px solid transparent",
              opacity:isFuture?0.3:1,
            }}>
              <div style={{fontSize:8,fontWeight:600,color:isToday?T.accent:T.muted}}>{label}</div>
              <div style={{
                width:24,height:24,borderRadius:"50%",
                background:allDone?T.accent:"transparent",
                border:"1.5px solid "+(allDone?T.accent:isToday?T.accent:T.border),
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:allDone?"0 0 7px "+T.accentGlow:"none",
              }}>
                {allDone
                  ?<svg width="11" height="11" viewBox="0 0 12 12"><polyline points="1.5,6 5,9.5 10.5,2.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
                  :<div style={{fontSize:10,fontWeight:700,color:isToday?T.accent:T.text}}>{num}</div>
                }
              </div>
              {/* 4 tiny activity dots */}
              <div style={{display:"flex",gap:2}}>
                {!isFuture&&[
                  [st.food,T.macro[0]],
                  [st.workout,T.macro[2]],
                  [st.supps,T.macro[1]],
                  [st.water,T.accent],
                ].map(([done,color],i)=>(
                  <div key={i} style={{width:3,height:3,borderRadius:"50%",background:done?color:(color+"25")}}/>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



// Serving units we can turn into grams ourselves. g and oz are exact; ml is a
// disclosed water-density default the user can overwrite. cup/tbsp/piece are
// food-dependent — there is no honest constant, so the user supplies the grams.
const CF_UNIT_G={g:1,oz:28.3495,ml:1};
const CF_AUTO_UNITS=["g","oz"];
// Ceilings: one serving tops out around 2 L of liquid; one logged item around
// 5 kg. Both are ~2x anything genuine, and catch a mistyped or doubled amount.
const CF_MAX_SERVING_G=2000;
const MAX_FOOD_GRAMS=5000;
// Numeric fields here are pre-filled, so typing without selecting first appends
// to the default — "100" + "100" = 100100. Select the value on focus instead.
const selectOnFocus=e=>e.target.select();
const cfGramsFor=(qty,unit)=>{
  const f=CF_UNIT_G[unit];
  const n=parseFloat(qty);
  if(!f||!Number.isFinite(n)||n<=0)return"";
  return String(Math.round(n*f*10)/10);
};

function QuickAddPanel({open,onClose,onAddItem,suppList,suppTaken,setSuppTaken,addSuppToList,customFoods,addCustomFood,waterOz=0,setWaterOz}){
  const T=useTheme();
  const [mode,setMode]=useState("food");
  const [foodView,setFoodView]=useState("search");
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
  const [scannerOpen,setScannerOpen]=useState(false);
  const searchRef=useRef();

  // Create food form state
  const [cf,setCf]=useState({name:"",brand:"",servingSize:"100",servingUnit:"g",servingGrams:"100",cal:"",protein:"",carbs:"",fat:"",fiber:"",sugar:"",sodium:""});
  const [cfSaved,setCfSaved]=useState(false);

  const cfChange=(k,v)=>setCf(p=>({...p,[k]:v}));
  const cfSetServing=v=>setCf(p=>({...p,servingSize:v,servingGrams:CF_UNIT_G[p.servingUnit]?cfGramsFor(v,p.servingUnit):p.servingGrams}));
  const cfSetUnit=u=>setCf(p=>({...p,servingUnit:u,servingGrams:cfGramsFor(p.servingSize,u)}));
  // The gram weight of one serving is the only thing per-100g macros may be
  // divided by — per100_* means "per 100 grams" everywhere else in the app.
  const cfGrams=parseFloat(cf.servingGrams);
  const cfGramsOver=Number.isFinite(cfGrams)&&cfGrams>CF_MAX_SERVING_G;
  const cfGramsOk=Number.isFinite(cfGrams)&&cfGrams>0&&!cfGramsOver;

  const cfPreview=cf.cal&&cfGramsOk?(()=>{
    const s=cfGrams;
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
    if(!cf.name.trim()||!cf.cal||!cfGramsOk)return;
    const s=cfGrams;
    const food={
      name:cf.name.trim(),
      brand:cf.brand.trim()||"My foods",
      servingG:s,
      servingQty:parseFloat(cf.servingSize)||null,
      servingUnit:cf.servingUnit,
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
      setCf({name:"",brand:"",servingSize:"100",servingUnit:"g",servingGrams:"100",cal:"",protein:"",carbs:"",fat:"",fiber:"",sugar:"",sodium:""});
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
      {scannerOpen&&<BarcodeScanner onResult={(food)=>{setScannerOpen(false);setSelected(food);setGrams(String(food.servingG||100));setResults([]);setQuery(food.name);}} onClose={()=>setScannerOpen(false)}/>}
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
        <div style={{padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:600}}>Quick add</div>
          <div onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{display:"flex",gap:8,padding:"12px 20px 0",flexShrink:0}}>
          {[["food","🍽 Food"],["supps","💊 Supplements"],["water","💧 Water"]].map(([m,l])=>(
            <div key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",border:("1px solid "+mode===m?T.accent:T.border),boxShadow:mode===m?T.glowShadow:"none",background:mode===m?T.accent:T.card,color:mode===m?"#fff":T.muted}}>{l}</div>
          ))}
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"14px 20px 0"}}>

          {/* ── FOOD MODE ── */}
          {mode==="food"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              {/* Search / Create sub-toggle */}
              <div style={{display:"flex",gap:0,background:T.accentPill,borderRadius:12,padding:3}}>
                {[["search","🔍 Search foods"],["create","✏️ Create food"]].map(([v,l])=>(
                  <div key={v} onClick={()=>{setFoodView(v);setSelected(null);setResults([]);setCfSaved(false);}} style={{flex:1,padding:"8px 10px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",background:foodView===v?T.accent:"transparent",color:foodView===v?"#fff":T.muted,transition:"all 0.15s",boxShadow:foodView===v?("0 2px 8px "+T.accentGlow):"none"}}>{l}</div>
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
                  style={{flex:1,minWidth:0,background:T.bg,color:T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}
                />
                <div onClick={()=>setScannerOpen(true)} title="Scan barcode"
                  style={{width:44,height:44,flexShrink:0,background:T.accentPill,border:("1px solid "+T.accent),borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={T.accent} strokeWidth="1.6" strokeLinecap="round">
                    <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="14" y="1" width="5" height="5" rx="1"/><rect x="1" y="14" width="5" height="5" rx="1"/>
                    <line x1="8" y1="1.5" x2="8" y2="6.5"/><line x1="11" y1="1.5" x2="11" y2="4.5"/><line x1="8" y1="9" x2="8" y2="18.5"/><line x1="11" y1="10" x2="11" y2="14"/><line x1="14" y1="9" x2="18.5" y2="9"/><line x1="14" y1="13" x2="18.5" y2="13"/><line x1="14" y1="16" x2="16" y2="16"/><line x1="16" y1="11" x2="18.5" y2="11"/>
                  </svg>
                </div>
                <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"11px 16px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,whiteSpace:"nowrap",flexShrink:0,minWidth:72}}>
                  {loading?"…":"Search"}
                </button>
              </div>
              {customFoods.length>0&&!query&&(
                <div>
                  <div style={{fontSize:12,color:T.muted,marginBottom:8}}>⭐ My saved foods</div>
                  {customFoods.slice(0,3).map((f,i)=>(
                    <div key={i} onClick={()=>{setSelected(f);setGrams(String(f.servingG||100));setServings("1");}} style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"10px 14px",marginBottom:6,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
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
                  <div style={{width:14,height:14,border:("2px solid "+T.accent),borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                  <div style={{fontSize:12,color:T.muted}}>Searching databases for more results…</div>
                </div>
              )}
              {loading&&results.length===0&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"24px 0"}}>
                  <div style={{width:18,height:18,border:("2px solid "+T.accent),borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                  <div style={{fontSize:13,color:T.muted}}>Searching…</div>
                </div>
              )}

              {/* No results → offer to create */}
              {!selected&&query&&results.length===0&&!loading&&(
                <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:10,alignItems:"center",textAlign:"center"}}>
                  <div style={{fontSize:13,color:T.muted}}>No results found for <span style={{fontWeight:600,color:T.text}}>"{query}"</span></div>
                  <div
                    onClick={()=>{setFoodView("create");setCfSaved(false);}}
                    style={{display:"inline-flex",alignItems:"center",gap:7,background:T.accentPill,border:("1px solid "+T.border),borderRadius:20,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Create "{query}"
                  </div>
                </div>
              )}

              {!selected&&results.map((r,i)=>(
                <div key={i} onClick={()=>{setSelected(r);setGrams(String(r.servingG||100));setServings("1");}} style={{background:r.isCustom?"#F0FBF6":"#fff",border:("1px solid "+r.isCustom?T.accent:T.border),borderRadius:12,padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
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
                      <div key={m} onClick={()=>setServingMode(m)} style={{flex:1,padding:"7px 10px",borderRadius:10,fontSize:12,fontWeight:500,textAlign:"center",cursor:"pointer",border:("1px solid "+T.border),boxShadow:T.glowShadow,background:servingMode===m?T.accent:T.card,color:servingMode===m?"#fff":T.muted}}>{l}</div>
                    ))}
                  </div>
                  {servingMode==="g"&&(
                    <div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:T.muted}}>Amount in grams</div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input type="number" value={grams} onChange={e=>setGrams(e.target.value)} onFocus={selectOnFocus} min="1" style={{width:72,flexShrink:0,background:T.bg,border:("2px solid "+T.accent),borderRadius:10,padding:"9px 8px",fontSize:16,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{fontSize:13,color:T.muted,flexShrink:0}}>g</span>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                          {[50,100,150,200,300].map(g=>(
                            <div key={g} onClick={()=>setGrams(String(g))} style={{padding:"6px 8px",background:grams===String(g)?T.accent:T.card,color:grams===String(g)?"#fff":T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{g}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {servingMode==="serving"&&(
                    <div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:T.muted}}>Servings {selected.servingG?("(1 serving ≈ "+selected.servingG+"g)"):"(1 serving = 100g)"}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input type="number" value={servings} onChange={e=>setServings(e.target.value)} onFocus={selectOnFocus} min="0.25" step="0.25" style={{width:72,flexShrink:0,background:T.bg,border:("2px solid "+T.accent),borderRadius:10,padding:"9px 8px",fontSize:16,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{fontSize:13,color:T.muted,flexShrink:0}}>serving{parseFloat(servings)!==1?"s":""}</span>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                          {[0.5,1,1.5,2,3].map(s=>(
                            <div key={s} onClick={()=>setServings(String(s))} style={{padding:"6px 8px",background:servings===String(s)?T.accent:T.card,color:servings===String(s)?"#fff":T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{s}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {preview&&(
                    <div style={{background:T.card,borderRadius:14,padding:14,color:T.text}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:6}}>
                        {servingMode==="g"?(preview.g+"g of "+selected.name):(servings+" serving"+(parseFloat(servings)!==1?"s":"")+" · "+Math.round(preview.g)+"g")}
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
                </div>
              )}
              </>)}

              {/* ── CREATE FOOD VIEW ── */}
              {foodView==="create"&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>

                  {/* No results notice */}
                  <div style={{background:T.accentPill,border:("1px solid "+T.border),borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="8.5" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.8" fill={T.accent}/></svg>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:T.accent}}>No results found</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>Create a custom food and it'll be saved for future searches.</div>
                    </div>
                  </div>

                  <div style={{fontSize:13,color:T.muted}}>Fill in the nutrition label info below.</div>

                  {/* Name & Brand */}
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <input value={cf.name} onChange={e=>cfChange("name",e.target.value)} placeholder="Food name (required)" style={{background:T.bg,border:("1px solid "+cf.name?T.accent:T.border),borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none",fontWeight:cf.name?500:400}}/>
                    <input value={cf.brand} onChange={e=>cfChange("brand",e.target.value)} placeholder="Brand (optional)" style={{background:T.bg,color:T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}/>
                  </div>

                  {/* Serving size */}
                  <div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Serving size</div>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
                      <input type="number" value={cf.servingSize} onChange={e=>cfSetServing(e.target.value)} onFocus={selectOnFocus} min="1" style={{width:80,flexShrink:0,background:T.bg,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:10,padding:"10px 10px",fontSize:15,fontWeight:600,outline:"none",textAlign:"center"}}/>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:1}}>
                        {["g","ml","oz","cup","tbsp","piece"].map(u=>(
                          <div key={u} onClick={()=>cfSetUnit(u)} style={{padding:"7px 8px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",border:("1px solid "+T.border),boxShadow:T.glowShadow,background:cf.servingUnit===u?T.accent:T.card,color:cf.servingUnit===u?"#fff":T.muted,flexShrink:0}}>{u}</div>
                        ))}
                      </div>
                    </div>
                    {/* Grams is the source of truth for the per-100g macros below.
                        Exact for g/oz, so we just show it; asked for otherwise. */}
                    {CF_AUTO_UNITS.includes(cf.servingUnit)?(
                      <div style={{fontSize:12,color:T.muted,marginTop:8}}>1 serving = {cfGramsOk?cfGrams:"—"} g</div>
                    ):(
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:11,color:T.muted,fontWeight:500,marginBottom:4}}>Weight of 1 serving (g)<span style={{color:"#E24B4A"}}> *</span></div>
                        <input type="number" min="1" value={cf.servingGrams} onChange={e=>cfChange("servingGrams",e.target.value)} onFocus={selectOnFocus} placeholder="grams"
                          style={{width:110,background:T.bg,border:("1px solid "+(cf.servingGrams?T.accent:T.border)),boxShadow:T.glowShadow,borderRadius:10,padding:"10px 10px",fontSize:15,fontWeight:cf.servingGrams?600:400,outline:"none",textAlign:"center",color:T.text}}/>
                        <div style={{fontSize:11,color:T.muted,marginTop:5,lineHeight:1.4}}>
                          {cf.servingUnit==="ml"
                            ?"Pre-filled at 1 ml ≈ 1 g (water). Adjust for oil, honey and other liquids."
                            :"One "+cf.servingUnit+" weighs a different amount for every food — take it from the label."}
                        </div>
                      </div>
                    )}
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
                            style={{background:T.bg,border:("1px solid "+cf[k]?color:T.border),borderRadius:10,padding:"10px 8px",fontSize:15,fontWeight:cf[k]?600:400,outline:"none",textAlign:"center",color:cf[k]?color:T.muted,width:"100%",minWidth:0}}
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

                </div>
              )}
            </div>
          )}

          {mode==="supps"&&(
            <SuppSearchPanel suppList={suppList} suppTaken={suppTaken} setSuppTaken={setSuppTaken} addSuppToList={addSuppToList}/>
          )}

          {mode==="water"&&(
            <div style={{padding:"16px 20px 0"}}>
              {/* Current status */}
              <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:16,padding:16,marginBottom:16,display:"flex",alignItems:"center",gap:16}}>
                <GallonBottle oz={waterOz} size={60}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.5px"}}>{waterOz} <span style={{fontSize:13,color:T.muted,fontWeight:500}}>oz today</span></div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{GOAL_OZ-waterOz>0?(GOAL_OZ-waterOz)+" oz to reach goal":"🎉 Goal reached!"}</div>
                  <div style={{marginTop:8,height:5,background:T.card,borderRadius:3}}>
                    <div style={{width:(Math.min(waterOz/GOAL_OZ,1)*100+"%"),height:"100%",background:("linear-gradient(90deg,#38BDF8,"+T.accent+")"),borderRadius:3,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    <div style={{fontSize:9,color:T.muted}}>0 oz</div>
                    <div style={{fontSize:9,color:T.accent,fontWeight:700}}>{Math.round(waterOz/GOAL_OZ*100)}%</div>
                    <div style={{fontSize:9,color:T.muted}}>{GOAL_OZ} oz</div>
                  </div>
                </div>
              </div>

              {/* Common vessels */}
              <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:10}}>Tap to add</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                {[["🥤","Small glass","8 oz",8],["🍶","Standard bottle","16 oz",16],["🧴","Large bottle","32 oz",32],["🫗","Big glass","12 oz",12]].map(([icon,label,sub,n])=>(
                  <div key={label} onClick={()=>setWaterOz&&setWaterOz(w=>Math.min(GOAL_OZ,w+n))}
                    style={{background:T.surface,border:("1px solid "+T.border),borderRadius:12,padding:"12px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",transition:"border-color 0.15s",boxShadow:T.glowShadow}}>
                    <div style={{fontSize:22,flexShrink:0}}>{icon}</div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:T.text}}>{label}</div>
                      <div style={{fontSize:10,color:T.muted,marginTop:1}}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom amount */}
              <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:8}}>Custom amount</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {[4,8,12,16,20,24,32,40].map(n=>(
                  <div key={n} onClick={()=>setWaterOz&&setWaterOz(w=>Math.min(GOAL_OZ,w+n))}
                    style={{padding:"8px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:T.accentPill,border:("1px solid "+T.accent+"44"),color:T.accent}}>
                    +{n} oz
                  </div>
                ))}
              </div>
              {waterOz>0&&(
                <div onClick={()=>setWaterOz&&setWaterOz(0)}
                  style={{fontSize:12,color:T.muted,cursor:"pointer",textAlign:"center",marginTop:8,padding:"8px",borderRadius:10,border:("1px solid "+T.border)}}>
                  Reset today's intake
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── STICKY FOOTER — always visible ── */}
        {mode==="food"&&foodView==="search"&&selected&&preview&&(
          <div style={{flexShrink:0,borderTop:("1px solid "+T.border),padding:"12px 20px 20px",background:T.card}}>
            <div style={{fontSize:12,fontWeight:500,marginBottom:8,color:T.muted}}>Add to meal</div>
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              {[["breakfast","Breakfast"],["lunch","Lunch"],["dinner","Dinner"],["snacks","Snacks"]].map(([s,l])=>(
                <div key={s} onClick={()=>setTargetSlot(s)} style={{flex:1,padding:"7px 4px",borderRadius:10,fontSize:11,fontWeight:500,textAlign:"center",cursor:"pointer",border:("1px solid "+targetSlot===s?T.accent:T.border),background:targetSlot===s?T.accent:T.card,color:targetSlot===s?"#fff":T.text,transition:"all 0.15s"}}>{l}</div>
              ))}
            </div>
            <button onClick={handleAdd} style={{width:"100%",background:added?"#22C55E":"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",transition:"background 0.2s",boxShadow:added?"none":("0 4px 16px "+T.accentGlow)}}>
              {added?"✓ Added!":"Add to "+targetSlot.charAt(0).toUpperCase()+targetSlot.slice(1)}
            </button>
          </div>
        )}
        {mode==="food"&&foodView==="create"&&(
          <div style={{flexShrink:0,borderTop:("1px solid "+T.border),padding:"12px 20px 20px",background:T.card}}>
            {cfGramsOver&&<div style={{fontSize:13,color:"#E24B4A",marginBottom:10,padding:"9px 12px",background:"rgba(248,113,113,0.1)",borderRadius:10}}>One serving can't weigh more than {CF_MAX_SERVING_G} g — check the amount and unit.</div>}
            <button onClick={saveCustomFood} disabled={!cf.name.trim()||!cf.cal||!cfGramsOk}
              style={{width:"100%",background:cfSaved?"#22C55E":(!cf.name.trim()||!cf.cal||!cfGramsOk?T.border:T.accent),border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:(!cf.name.trim()||!cf.cal||!cfGramsOk)?"not-allowed":"pointer",transition:"background 0.2s"}}>
              {cfSaved?"✓ Saved to My Foods":"Save food to my library"}
            </button>
          </div>
        )}
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
        <div style={{padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:600}}>Add food — {slot}</div>
          <div onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"14px 16px 0"}}>
          <div style={{display:"flex",gap:8,marginBottom:12,width:"100%"}}>
            <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Search food (e.g. white rice, fairlife...)" style={{flex:1,minWidth:0,background:T.bg,color:T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"11px 14px",fontSize:14,outline:"none"}}/>
            <button onClick={doSearch} disabled={loading} style={{background:T.accent,border:"none",borderRadius:12,padding:"11px 16px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?0.7:1,flexShrink:0,minWidth:72}}>{loading?"…":"Search"}</button>
          </div>
          {error&&<div style={{fontSize:13,color:"#E24B4A",marginBottom:12,padding:"10px 14px",background:"rgba(248,113,113,0.1)",borderRadius:10}}>{error}</div>}

          {/* No results → offer to create */}
          {!selected&&query&&results.length===0&&!loading&&(
            <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:10,alignItems:"center",textAlign:"center",marginBottom:12}}>
              <div style={{fontSize:30}}>🔍</div>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>No results for "{query}"</div>
              <div style={{fontSize:13,color:T.muted}}>Can't find it in the database? Create it yourself.</div>
              <div
                onClick={()=>{onClose();}}
                style={{display:"inline-flex",alignItems:"center",gap:7,background:T.accentPill,border:("1px solid "+T.border),borderRadius:20,padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:600,color:T.accent}}
              >
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                Create "{query}" in Quick Add
              </div>
              <div style={{fontSize:11,color:T.muted}}>(Open Quick Add → Food → Create food)</div>
            </div>
          )}

          {!selected&&results.map((r,i)=>(
            <div key={i} onClick={()=>{setSelected(r);setGrams("100");}} style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
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
                    <div key={l} style={{background:T.card,borderRadius:10,padding:"8px 10px",textAlign:"center",minWidth:56,border:("1px solid "+T.border),boxShadow:T.glowShadow,flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:c}}>{v}{u}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>How many grams?</div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <input type="number" value={grams} onChange={e=>setGrams(e.target.value)} onFocus={selectOnFocus} min="1" max={MAX_FOOD_GRAMS} style={{width:80,flexShrink:0,background:T.bg,border:("2px solid "+T.accent),borderRadius:10,padding:"10px 10px",fontSize:17,fontWeight:700,outline:"none",textAlign:"center"}}/>
                  <span style={{fontSize:14,color:T.muted,flexShrink:0}}>grams</span>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,justifyContent:"flex-end"}}>
                    {[50,100,150,200,300].map(g=>(
                      <div key={g} onClick={()=>setGrams(String(g))} style={{padding:"7px 8px",background:grams===String(g)?T.accent:T.card,color:grams===String(g)?"#fff":T.text,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:500,flexShrink:0}}>{g}g</div>
                    ))}
                  </div>
                </div>
              </div>
              {preview&&parseFloat(grams)>0&&(
                <div style={{background:T.card,borderRadius:14,padding:16,marginBottom:8,color:T.text}}>
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
            </div>
          )}
        </div>

        {/* Sticky footer — always visible */}
        {selected&&(
          <div style={{flexShrink:0,borderTop:("1px solid "+T.border),padding:"12px 16px 20px",background:T.card}}>
            <button onClick={()=>{const g=parseFloat(grams);if(!g||g<=0)return;onAdd({id:Date.now(),name:selected.name,grams:g,per100:selected.per100,color:COLORS[Math.floor(Math.random()*COLORS.length)]});}}
              style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 16px "+T.accentGlow)}}>
              Add {grams}g to {slot}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MacroRow({label,value,goal,color,unit="g"}){
  const T=useTheme();
  const pct=Math.min(100,Math.round((value/goal)*100));
  const over=value>goal;
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F0EFE9"}}>
      <div style={{fontSize:14,minWidth:60}}>{label}</div>
      <div style={{display:"flex",alignItems:"center",gap:10,flex:1,marginLeft:10}}>
        <div style={{flex:1,height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:(pct+"%"),background:over?"#E24B4A":color,borderRadius:3,transition:"width 0.4s"}}/>
        </div>
        <div style={{fontSize:12,fontWeight:500,minWidth:88,textAlign:"right",color:over?"#E24B4A":T.text}}>{value}{unit} / {goal}{unit}</div>
      </div>
    </div>
  );
}

function FoodItemRow({item,m,onDelete}){
  const T=useTheme();
  const [delMode,setDelMode]=useState(false);
  const [leaving,setLeaving]=useState(false);

  const confirmDelete=()=>{
    setLeaving(true);
    setTimeout(onDelete,260);
  };

  const lp=useLongPress(()=>{setDelMode(true);},480);

  if(delMode){
    return(
      <div style={{
        borderRadius:12,marginBottom:6,overflow:"hidden",
        display:"flex",alignItems:"stretch",
        transform:leaving?"translateX(-100%)":"translateX(0)",
        transition:"transform 0.26s cubic-bezier(.4,0,.2,1)",
      }}>
        {/* Item — dimmed */}
        <div style={{flex:1,background:T.card,border:"1px solid rgba(239,68,68,0.35)",borderRight:"none",borderRadius:"12px 0 0 12px",padding:"11px 14px",display:"flex",alignItems:"center",gap:10,opacity:0.45}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:item.color,flexShrink:0}}/>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:T.text}}>{item.name}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{item.grams}g · {m.cal} kcal</div></div>
        </div>
        {/* Cancel */}
        <div onClick={()=>setDelMode(false)} style={{background:T.surface,border:"1px solid rgba(239,68,68,0.35)",borderRight:"none",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 14px",cursor:"pointer",flexShrink:0}}>
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/><line x1="11" y1="1" x2="1" y2="11" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>
        </div>
        {/* Confirm delete */}
        <div onClick={confirmDelete} style={{background:"rgba(239,68,68,0.9)",borderRadius:"0 12px 12px 0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 16px",cursor:"pointer",gap:3,flexShrink:0}}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"><polyline points="3,4 12,4"/><path d="M5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1"/><rect x="4" y="4" width="7" height="8" rx="1"/><line x1="6" y1="7" x2="6" y2="10"/><line x1="9" y1="7" x2="9" y2="10"/></svg>
          <span style={{fontSize:10,fontWeight:700,color:"#fff"}}>Delete</span>
        </div>
      </div>
    );
  }

  return(
    <div {...lp} style={{
      background:T.card,borderRadius:12,padding:"11px 14px",
      border:("1px solid "+T.border),boxShadow:T.glowShadow,
      display:"flex",alignItems:"center",gap:10,marginBottom:6,
      userSelect:"none",WebkitUserSelect:"none",cursor:"default",
      transition:"box-shadow 0.15s",
    }}>
      <div style={{width:8,height:8,borderRadius:"50%",background:item.color,flexShrink:0}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:500}}>{item.name}</div>
        <div style={{fontSize:12,color:T.muted,marginTop:1}}>{item.grams}g · {m.protein}g P · {m.carbs}g C · {m.fat}g F · {m.cal} kcal</div>
      </div>
      <div style={{fontSize:13,fontWeight:600,flexShrink:0}}>{m.cal}</div>
      <div style={{fontSize:9,color:T.muted,flexShrink:0,opacity:0.5,marginLeft:2}}>hold</div>
    </div>
  );
}

function WaterStrip({waterOz=0,setWaterOz}){
  const T=useTheme();
  const [open,setOpen]=useState(false);
  return(
    <div style={{margin:"0 16px 12px",background:T.accentPill,border:("1px solid "+T.accent+"33"),borderRadius:14,overflow:"hidden"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer"}}>
        <GallonBottle oz={waterOz} size={30}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>💧 Water intake</div>
          <div style={{height:4,background:T.surface,borderRadius:2,marginTop:4,overflow:"hidden"}}>
            <div style={{width:(Math.min(waterOz/GOAL_OZ,1)*100+"%"),height:"100%",background:("linear-gradient(90deg,#38BDF8,"+T.accent+")"),borderRadius:2,transition:"width 0.5s"}}/>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{waterOz}<span style={{fontSize:10,color:T.muted,fontWeight:500}}> oz</span></div>
          <div style={{fontSize:9,color:T.muted}}>of {GOAL_OZ}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}>
          <polyline points="1,3 6,9 11,3" stroke={T.muted} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </div>
      {open&&(
        <div style={{borderTop:("1px solid "+T.accent+"22"),padding:"10px 14px 12px"}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[8,12,16,24,32].map(n=>(
              <div key={n} onClick={()=>setWaterOz&&setWaterOz(w=>Math.min(GOAL_OZ,w+n))}
                style={{padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",background:T.accent,color:"#fff",boxShadow:("0 2px 8px "+T.accentGlow)}}>
                +{n} oz
              </div>
            ))}
            {waterOz>0&&(
              <div onClick={()=>setWaterOz&&setWaterOz(0)}
                style={{padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:T.surface,border:("1px solid "+T.border),color:T.muted}}>
                reset
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FoodTab({log,setLog,onAddItem,uid,customFoods=[],addCustomFood,goals={cal:2200,protein:140,carbs:180,fat:78,fiber:25,sodium:2300},waterOz=0,setWaterOz}){
  const T=useTheme();
  const [modal,setModal]=useState(null);
  const M=totals(log);
  const calGoal=goals?.cal||2200;
  const remain=Math.max(0,calGoal-M.cal);
  const r=34,circ=2*Math.PI*r,dash=circ*Math.min(1,M.cal/calGoal);
  return(
    <div style={{paddingBottom:80}}>
      {modal&&<AddFoodModal slot={modal} onAdd={item=>{onAddItem(modal,item);setModal(null);}} onClose={()=>setModal(null)} customFoods={customFoods}/>}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:600}}>Food log</div><div style={{fontSize:13,color:T.muted}}>Calorie tracker</div></div>
        <div onClick={()=>setModal("breakfast")} style={{fontSize:13,color:T.accent,fontWeight:500,cursor:"pointer"}}>+ Add food</div>
      </div>
      <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),margin:16,borderRadius:16,padding:18,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:18}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Calories remaining</div>
            <div style={{fontSize:36,fontWeight:600,letterSpacing:"-2px",lineHeight:1}}>{remain.toLocaleString()}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:3}}>of {calGoal.toLocaleString()} · {M.cal} consumed</div>
          </div>
          <svg width="86" height="86" viewBox="0 0 86 86">
            <circle cx="43" cy="43" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7"/>
            <circle cx="43" cy="43" r={r} fill="none" stroke={T.accent} strokeWidth="7" strokeDasharray={dash+" "+circ+""} strokeLinecap="round" transform="rotate(-90 43 43)"/>
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
      {/* ── WATER STRIP ── */}
      <WaterStrip waterOz={waterOz} setWaterOz={setWaterOz}/>
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
                <FoodItemRow key={item.id||i} item={item} m={m} onDelete={async()=>{
                  setLog(p=>({...p,[slot]:p[slot].filter((_,j)=>j!==i)}));
                  if(uid&&item.id)try{await sb.delete("food_log","id=eq."+item.id+"&user_id=eq."+uid);}catch{}
                }}/>
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
        <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:"4px 14px"}}>
          <MacroRow label="Calories" value={M.cal} goal={goals?.cal||2200} color={T.accent} unit=" kcal"/>
          <MacroRow label="Protein" value={M.protein} goal={goals?.protein||140} color="#FF6B4A"/>
          <MacroRow label="Carbs" value={M.carbs} goal={goals?.carbs||180} color="#F5A623"/>
          <MacroRow label="Fat" value={M.fat} goal={goals?.fat||78} color="#5B8DEF"/>
          <MacroRow label="Fiber" value={M.fiber} goal={goals?.fiber||25} color="#9B6DFF"/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
            <div style={{fontSize:14,minWidth:60}}>Sodium</div>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1,marginLeft:10}}>
              <div style={{flex:1,height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:(Math.min(100,Math.round((M.sodium/(goals?.sodium||2300))*100))+"%"),background:M.sodium>(goals?.sodium||2300)?"#E24B4A":"#5B8DEF",borderRadius:3,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontSize:12,fontWeight:500,minWidth:88,textAlign:"right",color:M.sodium>(goals?.sodium||2300)?"#E24B4A":T.text}}>{M.sodium}mg / {goals?.sodium||2300}mg</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GallonBottle({oz,size=52}){
  const T=useTheme();
  const pct=Math.min(oz/GOAL_OZ,1);
  const fillColor=pct>=0.75?T.accent:pct>=0.4?"#38BDF8":"#7DD3FC";
  return(
    <svg width={size} height={size*1.25} viewBox="0 0 40 50" fill="none">
      <defs>
        <clipPath id={"bc"+size}><path d="M8,11 L6,14 L5,18 L5,42 Q5,46 9,46 L31,46 Q35,46 35,42 L35,18 L34,14 L32,11 Z"/></clipPath>
        <linearGradient id={"wg"+size} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.95"/>
          <stop offset="100%" stopColor={fillColor} stopOpacity="1"/>
        </linearGradient>
        <linearGradient id={"bg"+size} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0.14"/>
          <stop offset="100%" stopColor={T.accent} stopOpacity="0.05"/>
        </linearGradient>
      </defs>
      <rect x="14" y="3" width="12" height="8" rx="2" fill={T.accent} fillOpacity="0.45" stroke={T.accent} strokeWidth="0.8" strokeOpacity="0.5"/>
      <path d="M8,11 L6,14 L5,18 L5,42 Q5,46 9,46 L31,46 Q35,46 35,42 L35,18 L34,14 L32,11 Z" fill="url(#bg)" stroke={T.accent} strokeWidth="1.2" strokeOpacity="0.5"/>
      {pct>0&&<rect x="5" y={46-(28*pct)} width="30" height={28*pct} fill={"url(#wg"+size+")"} clipPath={"url(#bc"+size+")"} style={{transition:"y 0.7s cubic-bezier(.4,0,.2,1),height 0.7s"}}/>}
      {pct>0&&<ellipse cx="20" cy={46-(28*pct)} rx="12" ry="2" fill="#93C5FD" fillOpacity="0.35" clipPath={"url(#bc"+size+")"} style={{transition:"cy 0.7s"}}/>}
      <rect x="9" y="17" width="3" height="16" rx="1.5" fill="white" fillOpacity="0.09"/>
      <text x="20" y={38} textAnchor="middle" fill={pct>0.35?"#fff":T.accent} fontSize="7.5" fontWeight="800" fontFamily="-apple-system,sans-serif">{Math.round(pct*100)}%</text>
    </svg>
  );
}

function HomeTab({setTab,log,suppList=[],suppTaken={},workoutHistory=[],isDark:_isDark,toggleTheme,userName="",goals={cal:2200,protein:140,carbs:180,fat:78},onProfileOpen,waterOz=0,setWaterOz,weightLog=[],logWeight}){
  const T=useTheme();
  const isDark=T.mode==="dark";
  const M=totals(log);
  const calGoal=goals?.cal||2200;
  const remain=Math.max(0,calGoal-M.cal);
  const pct=Math.min(M.cal/calGoal,1);
  const takenCount=(suppList||[]).filter(s=>suppTaken[s.k]).length;
  const totalSupps=(suppList||[]).length;
  const todayStr=localDate();
  const todayWorkout=workoutHistory.find(w=>w.date===todayStr);
  const now=new Date();
  const hour=now.getHours();
  const greeting=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const dayLabel=now.toLocaleDateString("en-US",{weekday:"long"});
  const dateLabel=now.toLocaleDateString("en-US",{month:"long",day:"numeric"});
  const monthYearLabel=now.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const initials=userName?userName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";

  // Arc gauge
  const cx=90,cy=82,r=64;
  const arcLen=Math.PI*r;
  const filled=arcLen*pct;
  const arcPath="M "+(cx-r)+","+cy+" A "+r+","+r+" 0 0 1 "+(cx+r)+","+cy;
  const θ=Math.PI*(1-pct);
  const dotX=cx+r*Math.cos(θ);
  const dotY=cy-r*Math.sin(θ);

  const shortcuts=[
    {
      icon:"🍽",label:"Food Log",tab:"food",
      val:M.cal+" kcal",
      sub:remain.toLocaleString()+" remaining",
      pct:pct,
      color:T.macro[0],
    },
    {
      icon:"🏋️",label:"Workout",tab:"workout",
      val:todayWorkout?"Session logged":"No session yet",
      sub:todayWorkout?todayWorkout.workoutName||"Tap to train":"Tap to train",
      pct:todayWorkout?1:0,
      color:T.macro[2],
    },
    {
      icon:"💊",label:"Supplements",tab:"supps",
      val:totalSupps>0?takenCount+"/"+totalSupps+" taken":"Set up stack",
      sub:totalSupps>0?(totalSupps-takenCount)+" remaining":"Tap to add",
      pct:totalSupps>0?takenCount/totalSupps:0,
      color:T.macro[3],
    },
    {
      icon:"📈",label:"Progress",tab:"progress",
      val:weightLog.length>0?weightLog[weightLog.length-1].lbs+" lbs":"Progress projection",
      sub:"View progressions",
      pct:0,
      color:"#F59E0B",
    },
  ];

  return(
    <div style={{paddingBottom:80,background:T.bg,minHeight:"100vh",position:"relative",fontFamily:"-apple-system,sans-serif"}}>
      {/* Background grid texture */}
      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient("+(isDark?"rgba(124,58,237,0.025)":"rgba(79,70,229,0.03)")+" 1px,transparent 1px),linear-gradient(90deg,"+(isDark?"rgba(124,58,237,0.025)":"rgba(79,70,229,0.03)")+" 1px,transparent 1px)",backgroundSize:"22px 22px",pointerEvents:"none",zIndex:0}}/>
      {/* Top radial glow */}
      <div style={{position:"fixed",top:-80,left:"50%",transform:"translateX(-50%)",width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,"+(isDark?"rgba(124,58,237,0.16)":"rgba(79,70,229,0.08)")+" 0%,transparent 65%)",pointerEvents:"none",zIndex:0}}/>

      {/* ── STICKY HEADER ── */}
      <div style={{
        position:"sticky",top:0,zIndex:50,
        padding:"12px 16px 10px",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        background:isDark?"rgba(7,7,15,0.88)":"rgba(248,249,252,0.92)",
        backdropFilter:"blur(16px)",
        WebkitBackdropFilter:"blur(16px)",
        borderBottom:("1px solid "+T.border),
      }}>
        {/* Left — greeting */}
        <div>
          <div style={{fontSize:9,color:T.accentSoft,fontWeight:600,letterSpacing:2,textTransform:"uppercase",opacity:0.8,marginBottom:2}}>{dayLabel} · {dateLabel}</div>
          <div style={{fontSize:18,fontWeight:700,color:T.text,letterSpacing:"-0.4px"}}>{greeting}{userName?", "+userName.split(" ")[0]:""} 👋</div>
        </div>

        {/* Right — streak + toggle + avatar */}
        <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
          {/* Streak */}
          <div style={{background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.28)",borderRadius:20,padding:"3px 8px",fontSize:10,fontWeight:700,color:"#FBBF24",flexShrink:0}}>🔥 7</div>

          {/* Theme toggle — inline, compact */}
          <div onClick={toggleTheme} style={{display:"flex",alignItems:"center",gap:4,background:T.accentPill,border:("1px solid "+T.border),borderRadius:18,padding:"4px 8px 4px 5px",cursor:"pointer",flexShrink:0,transition:"all 0.2s",boxShadow:T.glowShadow}}>
            <div style={{width:16,height:16,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0}}>
              {isDark?"🌙":"☀️"}
            </div>
            <span style={{fontSize:10,fontWeight:600,color:T.accent}}>{isDark?"Dark":"Light"}</span>
          </div>

          {/* Avatar */}
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:700,boxShadow:("0 3px 10px "+T.accentGlow),flexShrink:0,cursor:"pointer"}} onClick={onProfileOpen}>{initials}</div>
        </div>
      </div>

      <div style={{padding:"8px 16px 0 16px"}}>
        <WeekStrip log={log} suppList={suppList} suppTaken={suppTaken} workoutHistory={workoutHistory} waterOz={waterOz} goals={goals} onViewCalendar={()=>setTab("calendar")}/>
      </div>

      <div style={{padding:"10px 16px 0",display:"flex",flexDirection:"column",gap:10}}>

        {/* ── CALORIE ARC + WATER BOTTLE ── */}
        <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:20,padding:"14px 14px 12px",position:"relative"}}>
          <div style={{position:"absolute",top:-20,right:-20,width:90,height:90,borderRadius:"50%",background:T.accentGlow,filter:"blur(22px)",pointerEvents:"none"}}/>
          <div style={{fontSize:8,color:T.accentSoft,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8,opacity:0.85}}>Calorie status</div>

          <div style={{display:"flex",alignItems:"center",gap:4}}>
            {/* Arc — takes most of the space */}
            <div style={{flex:1,display:"flex",justifyContent:"center"}}>
              <svg width="200" height="118" viewBox="0 0 200 118" style={{display:"block",overflow:"visible"}}>
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
                {/* True semicircle: endpoints(15,104)→(185,104), r=85, center=(100,104) */}
                <path d="M 15,104 A 85,85 0 0 1 185,104" fill="none" stroke={T.accentPill} strokeWidth="9" strokeLinecap="round"/>
                <path d="M 15,104 A 85,85 0 0 1 185,104" fill="none" stroke="url(#htArc)" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={(267*pct)+" 267"}/>
                {/* Dot — center=(100,104), r=85 */}
                {pct>0.03&&pct<0.97&&(()=>{
                  const a=Math.PI*(1-pct);
                  return <circle cx={100+85*Math.cos(a)} cy={104-85*Math.sin(a)} r="5.5" fill={T.accentSoft} filter="url(#htGlow)"/>;
                })()}
                {/* Numbers inside arc */}
                <text x="100" y="78" textAnchor="middle" fill={T.text} fontSize="28" fontWeight="800" style={{letterSpacing:"-1px"}}>{remain.toLocaleString()}</text>
                <text x="100" y="92" textAnchor="middle" fill={T.subtext} fontSize="9">kcal remaining</text>
                <text x="100" y="115" textAnchor="middle" fill={T.accentSoft} fontSize="8.5" fontWeight="700">{Math.round(pct*100)}% consumed</text>
                <text x="15"  y="115" textAnchor="middle" fill={T.muted} fontSize="7">0</text>
                <text x="185" y="115" textAnchor="middle" fill={T.muted} fontSize="7">{calGoal}</text>
              </svg>
            </div>

            {/* Divider */}
            <div style={{width:1,height:80,background:T.border,flexShrink:0}}/>

            {/* Water bottle — small badge */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,paddingLeft:6,flexShrink:0,minWidth:56}}>
              <div style={{fontSize:7,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Water</div>
              <GallonBottle oz={waterOz} size={44}/>
              <div style={{fontSize:11,fontWeight:700,color:T.accent,lineHeight:1}}>{waterOz}<span style={{fontSize:8,color:T.muted,fontWeight:500}}>oz</span></div>
              <div onClick={()=>setWaterOz&&setWaterOz(w=>Math.min(GOAL_OZ,w+8))}
                style={{background:T.accentPill,border:("1px solid "+T.accent+"44"),borderRadius:20,padding:"3px 9px",fontSize:9,fontWeight:700,color:T.accent,cursor:"pointer"}}>
                +8
              </div>
            </div>
          </div>

          {/* Protein · Carbs · Fat */}
          <div style={{display:"flex",gap:7,marginTop:10}}>
            {[
              ["Protein", M.protein, goals?.protein||140, T.macro[0]],
              ["Carbs",   M.carbs,   goals?.carbs||180,   T.macro[1]],
              ["Fat",     M.fat,     goals?.fat||78,      T.macro[2]],
            ].map(([l,v,g,c])=>(
              <div key={l} style={{flex:1,background:(c+"12"),border:("1px solid "+c+"28"),borderRadius:11,padding:"8px 6px",textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:800,color:c,letterSpacing:"-0.5px"}}>{Math.round(v)}g</div>
                <div style={{height:3,background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)",borderRadius:2,margin:"5px 5px 4px"}}>
                  <div style={{width:(Math.min(Math.round(v/g*100),100)+"%"),height:"100%",background:c,borderRadius:2}}/>
                </div>
                <div style={{fontSize:8,color:T.subtext}}>{l}</div>
                <div style={{fontSize:7,color:(c+"99"),marginTop:1}}>{Math.round(v)}/{g}g</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BODY WEIGHT ── */}
        <WeightLogWidget weightLog={weightLog} onLog={logWeight}/>

        {/* ── SECTION SHORTCUTS ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {shortcuts.map(s=>(
            <div key={s.label} onClick={()=>setTab(s.tab)}
              style={{background:(s.color+"0E"),border:("1px solid "+s.color+"2A"),boxShadow:("0 0 0 1px "+s.color+"15"),borderRadius:16,padding:"13px 13px",cursor:"pointer",position:"relative",overflow:"hidden",transition:"transform 0.1s"}}>
              <div style={{position:"absolute",top:-14,right:-14,width:50,height:50,borderRadius:"50%",background:(s.color+"20"),filter:"blur(14px)",pointerEvents:"none"}}/>
              <div style={{fontSize:22,marginBottom:7}}>{s.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:T.text,lineHeight:1.25,marginBottom:3}}>{s.val}</div>
              <div style={{fontSize:8.5,color:T.subtext,marginBottom:8}}>{s.sub}</div>
              {/* mini progress */}
              {s.pct>0&&(
                <div style={{height:2.5,background:"rgba(255,255,255,0.07)",borderRadius:2,marginBottom:6,overflow:"hidden"}}>
                  <div style={{width:(Math.round(s.pct*100)+"%"),height:"100%",background:s.color,borderRadius:2}}/>
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
                  style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:13,padding:"10px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{label}</div>
                    <div style={{fontSize:11,color:T.subtext,marginTop:2}}>{log[slot].length} item{log[slot].length!==1?"s":""} · {slotCal} cal</div>
                  </div>
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="12" fill="none" stroke={T.border} strokeWidth="2.5"/>
                    <circle cx="16" cy="16" r="12" fill="none" stroke={T.accent} strokeWidth="2.5"
                      strokeDasharray={Math.min(75,Math.round((slotCal/700)*75))+" 75"} strokeLinecap="round" transform="rotate(-90 16 16)"/>
                  </svg>
                </div>
              );
            }
            return(
              <div key={slot} onClick={()=>setTab("food")}
                style={{background:"transparent",border:("1.5px dashed "+T.border),borderRadius:13,padding:"10px 14px",marginBottom:7,display:"flex",alignItems:"center",justifyContent:"center",gap:7,cursor:"pointer"}}>
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
        <div style={{padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:700,color:T.text}}>{existing?"Edit workout":"Create workout"}</div>
          <div onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px 16px 32px",display:"flex",flexDirection:"column",gap:16}}>
          {/* Name */}
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Workout name (e.g. Push Day)" style={{background:T.inputBg,color:T.text,border:("1px solid "+name?T.accent:T.border),boxShadow:name?T.glowShadow:"none",borderRadius:12,padding:"12px 14px",fontSize:15,fontWeight:500,outline:"none"}}/>

          {/* Meta row */}
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Category</div>
              <select value={tag} onChange={e=>setTag(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none"}}>
                {["Upper Body","Lower Body","Full Body","Push","Pull","Legs","Core","Cardio","Custom"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Level</div>
              <select value={level} onChange={e=>setLevel(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none"}}>
                {["Beginner","Intermediate","Advanced"].map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
            <div style={{width:72}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Est. min</div>
              <input type="number" value={estMin} onChange={e=>setEstMin(e.target.value)} style={{width:"100%",background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 8px",fontSize:13,outline:"none",textAlign:"center"}}/>
            </div>
          </div>

          {/* Exercises */}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:10}}>Exercises ({exercises.length})</div>
            {exercises.map((ex,ei)=>(
              <div key={ex.id} style={{background:T.surface,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:14,marginBottom:10}}>
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
                    <input type="number" value={s.reps} onChange={e=>updateSet(ex.id,si,"reps",parseInt(e.target.value)||0)} style={{background:T.card,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 6px",fontSize:13,fontWeight:500,textAlign:"center",outline:"none",width:"100%"}}/>
                    <input type="number" value={s.weight} onChange={e=>updateSet(ex.id,si,"weight",parseInt(e.target.value)||0)} style={{background:T.card,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 6px",fontSize:13,fontWeight:500,textAlign:"center",outline:"none",width:"100%"}}/>
                    <div onClick={()=>removeSet(ex.id,si)} style={{width:22,height:22,borderRadius:"50%",background:"rgba(248,113,113,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                      <svg width="8" height="8" viewBox="0 0 8 8"><line x1="1" y1="1" x2="7" y2="7" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="1" x2="1" y2="7" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                ))}
                <div onClick={()=>addSet(ex.id)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"7px",border:("1px dashed "+T.border),borderRadius:8,cursor:"pointer",marginTop:4}}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="10" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="6" x2="10" y2="6" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <div style={{fontSize:12,color:T.muted,fontWeight:500}}>Add set</div>
                </div>
              </div>
            ))}

            {/* Add exercise button */}
            <div onClick={()=>setShowLib(true)} style={{border:("1.5px dashed "+T.border),borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
              <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke={T.accent} strokeWidth="1.5" fill="none"/><line x1="8" y1="4" x2="8" y2="12" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="8" x2="12" y2="8" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div style={{fontSize:13,color:T.accent,fontWeight:600}}>Add exercise</div>
            </div>
          </div>

          {/* Exercise library picker */}
          {showLib&&(
            <div style={{background:T.surface,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:14}}>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>Exercise library</div>
              <input value={libSearch} onChange={e=>setLibSearch(e.target.value)} placeholder="Search exercises..." style={{width:"100%",background:T.card,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",marginBottom:10,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:10,paddingBottom:2}}>
                {["All","Push","Pull","Legs","Core","Cardio"].map(c=>(
                  <div key={c} onClick={()=>setLibCat(c)} style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:("1px solid "+T.border),background:libCat===c?T.accent:T.card,color:libCat===c?"#fff":T.muted,whiteSpace:"nowrap",flexShrink:0}}>{c}</div>
                ))}
              </div>
              <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
                {filtered.map((ex,i)=>(
                  <div key={i} onClick={()=>addExercise(ex)} style={{background:T.card,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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
function ActiveWorkout({workout,onFinish,onClose,prHistory={}}){
  const T=useTheme();
  const [sets,setSets]=useState(()=>
    workout.exercises.map(ex=>({
      ...ex,
      sets:ex.sets.map(s=>({...s,done:false,actualReps:s.reps,actualWeight:s.weight}))
    }))
  );
  const [elapsed,setElapsed]=useState(0);
  const [restSecs,setRestSecs]=useState(null);   // null = not resting
  const [restTotal,setRestTotal]=useState(90);   // configured duration
  const [restDuration,setRestDuration]=useState(90); // picker value
  const [newPRs,setNewPRs]=useState([]);         // ["Bench Press","Squat",…]
  const timerRef=useRef();
  const audioCtx=useRef(null);

  // Play a short beep using Web Audio API
  const beep=()=>{
    try{
      if(!audioCtx.current)audioCtx.current=new(window.AudioContext||window.webkitAudioContext)();
      const ctx=audioCtx.current;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=880;gain.gain.setValueAtTime(0.3,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
      osc.start(ctx.currentTime);osc.stop(ctx.currentTime+0.4);
    }catch{}
    try{navigator.vibrate&&navigator.vibrate([100,50,100]);}catch{}
  };

  useEffect(()=>{
    timerRef.current=setInterval(()=>{
      setElapsed(e=>e+1);
      setRestSecs(r=>{
        if(r===null)return null;
        if(r<=1){beep();return null;}
        return r-1;
      });
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
        if(nowDone){
          setRestSecs(restDuration);
          setRestTotal(restDuration);
          // Check PR: beat a recorded best, not merely exist.
          //
          // best===0 means this exercise has no history to beat, and a first-ever
          // lift is a baseline, not a record. Without the best>0 test an empty
          // prHistory made every weighted set a "PR" — that is what put 4 phantom
          // PRs on a 13-second artifact session, and it would fire on every
          // exercise of the first real session too, since prHistory is seeded
          // only when workout_sessions already has rows.
          //
          // Every writer of prHistory stores positive weights only (see the
          // loader and both setPrHistory updaters), so best>0 is exactly "has a
          // baseline". This also fails safe if a workout starts before the
          // history load finishes: no PRs claimed rather than all of them.
          const w=parseInt(s.actualWeight)||0;
          const best=prHistory[ex.name]||0;
          if(w>0&&best>0&&w>best)setNewPRs(p=>p.includes(ex.name)?p:[...p,ex.name]);
        }else{
          setRestSecs(null);
        }
        return{...s,done:nowDone};
      })
    }));
  };

  const updateSet=(exIdx,setIdx,field,val)=>{
    setSets(prev=>prev.map((ex,ei)=>ei!==exIdx?ex:{
      ...ex,sets:ex.sets.map((s,si)=>si!==setIdx?s:{...s,[field]:val})
    }));
  };

  const fmt=(s)=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");

  // Circular ring math
  const R=28,CIRC=2*Math.PI*R;
  const ringPct=restSecs!==null&&restTotal>0?restSecs/restTotal:0;

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:T.bg,zIndex:190,overflowY:"auto",paddingBottom:80}}>
      {/* Header */}
      <div style={{background:T.card,padding:"16px 16px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
        <div onClick={onClose} style={{fontSize:13,color:T.muted,cursor:"pointer"}}>✕ Cancel</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text}}>{workout.name}</div>
          <div style={{fontSize:12,color:T.accent,fontWeight:600}}>{fmt(elapsed)}</div>
        </div>
        <div onClick={()=>onFinish(sets,elapsed,newPRs)} style={{fontSize:13,color:T.accent,fontWeight:700,cursor:"pointer"}}>Finish</div>
      </div>

      {/* Progress bar */}
      <div style={{height:3,background:T.border}}>
        <div style={{height:"100%",width:(pct+"%"),background:("linear-gradient(90deg,"+T.accent+","+T.accentSoft+")"),transition:"width 0.4s"}}/>
      </div>

      {/* Rest timer — ring version */}
      {restSecs!==null&&(
        <div style={{background:T.card,border:("1px solid "+T.accent),margin:"12px 16px 0",borderRadius:16,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:T.accent,marginBottom:4}}>⏱ Rest</div>
            <div style={{display:"flex",gap:6}}>
              {[60,90,120,180].map(d=>(
                <div key={d} onClick={()=>{setRestDuration(d);setRestSecs(d);setRestTotal(d);}}
                  style={{padding:"4px 8px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",
                    background:restDuration===d?T.accent:T.surface,
                    color:restDuration===d?"#fff":T.muted,border:("1px solid "+restDuration===d?T.accent:T.border)}}>
                  {d}s
                </div>
              ))}
            </div>
          </div>
          {/* Circular progress */}
          <div style={{position:"relative",width:72,height:72,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="72" height="72" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
              <circle cx="36" cy="36" r={R} fill="none" stroke={T.border} strokeWidth="4"/>
              <circle cx="36" cy="36" r={R} fill="none" stroke={T.accent} strokeWidth="4"
                strokeDasharray={CIRC} strokeDashoffset={CIRC*(1-ringPct)}
                strokeLinecap="round" style={{transition:"stroke-dashoffset 0.9s linear"}}/>
            </svg>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:17,fontWeight:800,color:T.accent,fontFamily:"monospace",lineHeight:1}}>{fmt(restSecs)}</div>
            </div>
          </div>
          <div onClick={()=>setRestSecs(null)} style={{fontSize:12,color:T.muted,cursor:"pointer",textAlign:"center"}}>Skip</div>
        </div>
      )}

      {/* New PR flash */}
      {newPRs.length>0&&(
        <div style={{margin:"10px 16px 0",background:"linear-gradient(135deg,#F59E0B22,#EF444422)",border:"1px solid #F59E0B55",borderRadius:12,padding:"10px 14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#F59E0B"}}>🏆 New PR{newPRs.length>1?"s":""} this session!</div>
          <div style={{fontSize:12,color:T.muted,marginTop:3}}>{newPRs.join(" · ")}</div>
        </div>
      )}

      {/* Stats */}
      <div style={{display:"flex",gap:10,padding:"12px 16px 0"}}>
        {[[doneSets+"/"+totalSets,"Sets done"],[pct+"%","Complete"],[fmt(elapsed),"Elapsed"]].map(([v,l])=>(
          <div key={l} style={{flex:1,background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:700,color:T.accent}}>{v}</div>
            <div style={{fontSize:10,color:T.muted,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Exercises */}
      {sets.map((ex,ei)=>(
        <div key={ex.id} style={{margin:"12px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>{ex.name}</div>
            {newPRs.includes(ex.name)&&<span style={{fontSize:10,fontWeight:700,color:"#F59E0B",background:"rgba(245,158,11,0.15)",padding:"2px 8px",borderRadius:20}}>🏆 PR</span>}
            {prHistory[ex.name]&&<span style={{fontSize:10,color:T.muted}}>Best: {prHistory[ex.name]}lbs</span>}
          </div>
          <div style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 44px",gap:8,padding:"8px 12px",borderBottom:("1px solid "+T.border),background:T.surface}}>
              {["Set","Reps","lbs","✓"].map((h,i)=>(
                <div key={i} style={{fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8,textAlign:"center"}}>{h}</div>
              ))}
            </div>
            {ex.sets.map((s,si)=>(
              <div key={si} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 44px",gap:8,padding:"10px 12px",borderBottom:si<ex.sets.length-1?"1px solid "+T.border:"none",alignItems:"center",background:s.done?"rgba(6,182,212,0.05)":"transparent",transition:"background 0.2s"}}>
                <div style={{fontSize:13,fontWeight:700,color:T.muted,textAlign:"center"}}>{si+1}</div>
                <input type="number" value={s.actualReps} onChange={e=>updateSet(ei,si,"actualReps",parseInt(e.target.value)||0)} style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 4px",fontSize:14,fontWeight:600,textAlign:"center",outline:"none",width:"100%"}}/>
                <input type="number" value={s.actualWeight} onChange={e=>updateSet(ei,si,"actualWeight",parseInt(e.target.value)||0)} style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"7px 4px",fontSize:14,fontWeight:600,textAlign:"center",outline:"none",width:"100%"}}/>
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
        <button onClick={()=>onFinish(sets,elapsed,newPRs)} style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"16px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 20px "+T.accentGlow)}}>
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
            style={{background:T.card,border:("1px solid "+isOpen?T.accent:T.border),boxShadow:isOpen?T.glowShadow:T.glowShadow,borderRadius:14,marginBottom:8,overflow:"hidden",transition:"border-color 0.2s",cursor:"pointer"}}
            onClick={()=>toggle(ex.id)}
          >
            {/* Header row — always visible */}
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:28,height:28,borderRadius:8,background:isOpen?T.accent:T.accentPill,color:isOpen?"#fff":T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0,transition:"background 0.2s"}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:T.text}}>{ex.name}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:1}}>
                  {ex.sets.length} sets · {ex.sets[0]?.reps} reps
                  {ex.sets[0]?.weight>0?" · "+ex.sets[0].weight+" lbs":" · Bodyweight"}
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
              <div style={{borderTop:("1px solid "+T.border),background:T.surface}}>
                {/* Column headers */}
                <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 1fr",gap:0,padding:"7px 14px",borderBottom:("1px solid "+T.border)}}>
                  {["Set","Target reps","Weight","Volume"].map((h,hi)=>(
                    <div key={h} style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:0.8,textAlign:hi===0?"left":"center"}}>{h}</div>
                  ))}
                </div>
                {/* Set rows */}
                {ex.sets.map((s,si)=>{
                  const vol=s.reps*(s.weight||0);
                  return(
                    <div key={si} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 1fr",gap:0,padding:"9px 14px",borderBottom:si<ex.sets.length-1?"1px solid "+T.border:"none",alignItems:"center"}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.accent}}>S{si+1}</div>
                      <div style={{textAlign:"center"}}>
                        <span style={{background:T.accentPill,color:T.accent,fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20}}>{s.reps} reps</span>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>
                          {s.weight>0?s.weight+" lbs":"BW"}
                        </span>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <span style={{fontSize:12,color:T.muted}}>{vol>0?vol.toLocaleString()+" lbs":"—"}</span>
                      </div>
                    </div>
                  );
                })}
                {/* Summary footer */}
                <div style={{padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:("1px solid "+T.border)}}>
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
function WorkoutTab({workouts,setWorkouts,history=[],onSessionComplete,prHistory,setPrHistory,onSavePlan,onDeletePlan}){
  const T=useTheme();
  const [createOpen,setCreateOpen]=useState(false);
  const [editWorkout,setEditWorkout]=useState(null);
  const [activeWorkout,setActiveWorkout]=useState(null);
  const [view,setView]=useState("today");

  const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const todayDayName=DAYS[new Date().getDay()];
  const todayWorkout=workouts.find(w=>w.scheduledDay===todayDayName)||workouts[0]||null;

  const saveWorkout=(w)=>{
    const isNew=!workouts.find(x=>x.id===w.id);
    setWorkouts(prev=>{
      const exists=prev.find(x=>x.id===w.id);
      return exists?prev.map(x=>x.id===w.id?w:x):[...prev,w];
    });
    onSavePlan&&onSavePlan(w,isNew);
    setCreateOpen(false);setEditWorkout(null);
  };

  const deleteWorkout=(id)=>{
    setWorkouts(prev=>prev.filter(w=>w.id!==id));
    onDeletePlan&&onDeletePlan(id);
  };

  const finishWorkout=(sets,elapsed,newPRs=[])=>{
    const allSets=sets.flatMap(e=>e.sets);
    const doneSets=allSets.filter(s=>s.done).length;
    setPrHistory(prev=>{
      const updated={...prev};
      sets.forEach(ex=>{
        const best=Math.max(0,...ex.sets.filter(s=>s.done).map(s=>parseInt(s.actualWeight)||0));
        if(best>0&&best>(updated[ex.name]||0))updated[ex.name]=best;
      });
      return updated;
    });
    const entry={
      id:"h"+Date.now(),
      workoutName:activeWorkout.name,
      date:localDate(),
      duration:elapsed,
      setsCompleted:doneSets,
      totalSets:allSets.length,
      prs:newPRs,
      exercises:sets.map(ex=>({
        name:ex.name,
        isPR:newPRs.includes(ex.name),
        sets:ex.sets.filter(s=>s.done).map(s=>s.actualReps+"×"+s.actualWeight+"lbs")
      }))
    };
    onSessionComplete&&onSessionComplete(entry);
    setActiveWorkout(null);
    setView("history");
  };

  const fmt=(s)=>Math.floor(s/60)+"m "+s%60+"s";

  // ── VIEWS ──
  const views=[["today","Today"],["plans","My Plans"],["history","History"]];

  return(
    <div style={{paddingBottom:80}}>
      {createOpen&&<CreateWorkoutModal onSave={saveWorkout} onClose={()=>setCreateOpen(false)}/>}
      {editWorkout&&<CreateWorkoutModal existing={editWorkout} onSave={saveWorkout} onClose={()=>setEditWorkout(null)}/>}
      {activeWorkout&&<ActiveWorkout workout={activeWorkout} onFinish={finishWorkout} onClose={()=>setActiveWorkout(null)} prHistory={prHistory}/>}

      {/* Header */}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:700,color:T.text}}>Workout</div><div style={{fontSize:13,color:T.muted}}>{workouts.length} plan{workouts.length!==1?"s":""} · {history.length} sessions logged</div></div>
        <div onClick={()=>setCreateOpen(true)} style={{background:T.accentPill,border:("1px solid "+T.accent),borderRadius:20,padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="1" x2="6" y2="11" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="6" x2="11" y2="6" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/></svg>
          <span style={{fontSize:13,fontWeight:600,color:T.accent}}>New</span>
        </div>
      </div>

      {/* View toggle */}
      <div style={{display:"flex",gap:0,background:T.surface,margin:"12px 16px 0",borderRadius:12,padding:3,border:("1px solid "+T.border)}}>
        {views.map(([v,l])=>(
          <div key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px 6px",borderRadius:10,fontSize:12,fontWeight:600,textAlign:"center",cursor:"pointer",background:view===v?T.accent:"transparent",color:view===v?"#fff":T.muted,transition:"all 0.15s"}}>{l}</div>
        ))}
      </div>

      {/* ── TODAY VIEW ── */}
      {view==="today"&&todayWorkout&&(
        <div style={{padding:"12px 16px 0"}}>
          {/* Today's workout banner */}
          <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),borderRadius:16,padding:20,marginBottom:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:T.accentGlow,filter:"blur(24px)"}}/>
            <div style={{display:"inline-block",background:"rgba(6,182,212,0.3)",color:"#A855F7",fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,marginBottom:10,letterSpacing:"0.5px"}}>TODAY · {todayWorkout.tag.toUpperCase()}</div>
            <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:4}}>{todayWorkout.name}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:14}}>{todayWorkout.exercises.length} exercises · ~{todayWorkout.estMin} min · {todayWorkout.level}</div>
            <button onClick={()=>setActiveWorkout(todayWorkout)} style={{background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 16px "+T.accentGlow)}}>
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
            <div key={w.id} style={{background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:16,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{fontSize:15,fontWeight:700,color:T.text}}>{w.name}</div>
                    {w.scheduledDay===todayDayName&&<span style={{background:T.accentPill,color:T.accent,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>TODAY</span>}
                  </div>
                  <div style={{fontSize:12,color:T.muted}}>{w.exercises.length} exercises · {w.estMin}min · {w.level} · {w.tag}{w.scheduledDay?(" · 📅 "+w.scheduledDay):""}</div>
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
              <button onClick={()=>setActiveWorkout(w)} style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
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
            <div key={h.id} style={{background:T.card,border:"1px solid "+(h.prs?.length>0?"rgba(245,158,11,0.4)":T.border),boxShadow:h.prs?.length>0?"0 0 16px rgba(245,158,11,0.12)":T.glowShadow,borderRadius:14,padding:16,marginBottom:12}}>
              {/* PR banner */}
              {h.prs?.length>0&&(
                <div style={{background:"linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.1))",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>🏆</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#F59E0B"}}>New PR{h.prs.length>1?"s":""} this session!</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:1}}>{h.prs.join(" · ")}</div>
                  </div>
                </div>
              )}
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
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {h.exercises.filter(e=>e.sets.length>0).map((ex,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:ex.isPR?"rgba(245,158,11,0.08)":T.surface,borderRadius:8,border:ex.isPR?"1px solid rgba(245,158,11,0.2)":"1px solid transparent"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {ex.isPR&&<span style={{fontSize:11}}>🏆</span>}
                      <div style={{fontSize:12,fontWeight:500,color:T.text}}>{ex.name}</div>
                    </div>
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
    return h12+":"+String(m).padStart(2,"0")+" "+ampm;
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
        <div style={{background:T.surface,border:("1px solid "+T.border),boxShadow:T.glowShadow,borderRadius:14,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>Daily reminder</div>
            <div style={{fontSize:12,color:T.subtext,marginTop:2}}>Notify me to take this supplement</div>
          </div>
          <div onClick={()=>setEnabled(e=>!e)} style={{width:48,height:28,borderRadius:14,background:enabled?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,boxShadow:enabled?("0 0 10px "+T.accentGlow):"none"}}>
            <div style={{position:"absolute",top:3,left:enabled?23:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.25)"}}/>
          </div>
        </div>

        {/* Time picker */}
        {enabled&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>Reminder time</div>
            <div style={{background:T.surface,border:("1px solid "+T.accent),boxShadow:T.glowShadow,borderRadius:14,padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <div style={{fontSize:42,fontWeight:800,color:T.accent,letterSpacing:"-1px"}}>{fmtTime(time)}</div>
              <input
                type="time"
                value={time}
                onChange={e=>setTime(e.target.value)}
                style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 16px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box",textAlign:"center",cursor:"pointer"}}
              />
            </div>

            {/* Quick time presets */}
            <div>
              <div style={{fontSize:12,color:T.subtext,marginBottom:8}}>Quick presets</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {[["Morning","07:00"],["With breakfast","08:00"],["Midday","12:00"],["Pre-workout","17:00"],["Dinner","18:00"],["Before bed","21:00"],["Night","22:00"]].map(([label,t])=>(
                  <div key={t} onClick={()=>setTime(t)}
                    style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:("1px solid "+time===t?T.accent:T.border),background:time===t?T.accentPill:"transparent",color:time===t?T.accent:T.subtext,transition:"all 0.15s"}}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Info note */}
            <div style={{background:T.accentPill,border:("1px solid "+T.border),borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10}}>
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
          style={{background:T.accent,border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 16px "+T.accentGlow)}}>
          {enabled?"Save reminder · "+fmtTime(time):"Save (no reminder)"}
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
      new Notification("💊 Time for your "+supp.name,{
        body:supp.sub||"Don't forget your daily supplement!",
        icon:"/favicon.ico",
        badge:"/favicon.ico",
        tag:"supp-"+supp.k,
        renotify:true,
      });
    }
  },ms);
}

// ── SUPPS TAB ────────────────────────────────────────────────────
function SuppsTab({suppList,setSuppList,suppTaken,setSuppTaken,taken,total,uid,addSuppToList}){
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

  const removeSupp=async(k)=>{
    setSuppList(p=>p.filter(s=>s.k!==k));
    setSuppTaken(p=>{const n={...p};delete n[k];return n;});
    if(!uid)return;
    try{await sb.delete("supplement_stack","id=eq."+k+"&user_id=eq."+uid);}catch{}
  };

  const saveEdit=async()=>{
    if(!editItem||!newName.trim())return;
    setSuppList(p=>p.map(s=>s.k===editItem.k?{...s,name:newName,sub:newSub}:s));
    setEditItem(null);setNewName("");setNewSub("");
    if(!uid)return;
    try{await sb.update("supplement_stack",{name:newName,sub:newSub},{filter:"id=eq."+editItem.k+"&user_id=eq."+uid});}catch{}
  };

  const addCustom=()=>{
    if(!newName.trim())return;
    const item={k:"m"+Date.now(),name:newName,sub:newSub||"",dot:"#888",reminderEnabled:newReminderEnabled,reminderTime:newReminderTime};
    if(addSuppToList){addSuppToList(item);}
    else{setSuppList(p=>[...p,item]);setSuppTaken(item.k,false);}
    if(newReminderEnabled)scheduleNotification(item);
    setNewName("");setNewSub("");setNewReminderEnabled(false);setNewReminderTime("08:00");
  };

  const saveReminder=async({reminderEnabled,reminderTime})=>{
    setSuppList(p=>p.map(s=>s.k===reminderSupp.k?{...s,reminderEnabled,reminderTime}:s));
    if(reminderEnabled)scheduleNotification({...reminderSupp,reminderEnabled,reminderTime});
    if(uid)try{await sb.update("supplement_stack",{reminder_enabled:reminderEnabled,reminder_time:reminderTime},{filter:"id=eq."+reminderSupp.k+"&user_id=eq."+uid});}catch{}
    setReminderSupp(null);
  };

  const fmtTime=(t)=>{
    if(!t)return"";
    const [h,m]=t.split(":").map(Number);
    const ampm=h>=12?"PM":"AM";
    const h12=h===0?12:h>12?h-12:h;
    return h12+":"+String(m).padStart(2,"0")+" "+ampm;
  };

  const renderGroup=(label,items)=>items.length===0?null:(
    <div key={label}>
      <div style={{padding:"0 16px",margin:"14px 0 8px"}}><div style={{fontSize:14,fontWeight:600,color:T.text}}>{label}</div></div>
      <div style={{background:T.card,margin:"0 16px",borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,overflow:"hidden"}}>
        {items.map((s,i)=>(
          <div key={s.k} style={{borderBottom:i<items.length-1?"1px solid "+T.border:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:s.dot,flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{s.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2,flexWrap:"wrap"}}>
                    {s.sub&&<div style={{fontSize:11,color:T.subtext}}>{s.sub}</div>}
                    {/* Reminder badge */}
                    <div onClick={()=>setReminderSupp(s)}
                      style={{display:"flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:20,cursor:"pointer",background:s.reminderEnabled?T.accentPill:"transparent",border:("1px solid "+s.reminderEnabled?T.accent:T.border),transition:"all 0.15s"}}>
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
              <div onClick={()=>setSuppTaken(s.k,!suppTaken[s.k])}
                style={{width:44,height:26,borderRadius:13,background:suppTaken[s.k]?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,marginLeft:10,boxShadow:suppTaken[s.k]?("0 0 8px "+T.accentGlow):"none"}}>
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
            <div style={{padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontSize:17,fontWeight:700,color:T.text}}>Manage supplements</div>
              <div onClick={()=>{setManageOpen(false);setEditItem(null);setNewName("");setNewSub("");}} style={{width:32,height:32,borderRadius:"50%",background:T.accentPill,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
            </div>
            <div style={{overflowY:"auto",padding:"14px 20px 30px",display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontSize:12,color:T.subtext}}>Daily goal: {total} supplement{total!==1?"s":""} · Tap the clock icon on any supplement to set a reminder.</div>
              <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,overflow:"hidden"}}>
                {suppList.map((s,i)=>(
                  <div key={s.k}
                    draggable
                    onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(i));}}
                    onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";e.currentTarget.style.background=T.accentPill;}}
                    onDragLeave={e=>{e.currentTarget.style.background="transparent";}}
                    onDrop={async e=>{
                      e.preventDefault();e.currentTarget.style.background="transparent";
                      const from=parseInt(e.dataTransfer.getData("text/plain"));
                      if(from===i||isNaN(from))return;
                      setSuppList(prev=>{
                        const arr=[...prev];
                        const [moved]=arr.splice(from,1);
                        arr.splice(i,0,moved);
                        // Persist new sort_order to Supabase
                        if(uid){
                          arr.forEach((s,idx)=>{
                            try{sb.update("supplement_stack",{sort_order:idx},{filter:"id=eq."+s.k+"&user_id=eq."+uid});}catch{}
                          });
                        }
                        return arr;
                      });
                    }}
                  >
                    {editItem?.k===s.k?(
                      <div style={{padding:"12px 14px",borderBottom:i<suppList.length-1?"1px solid "+T.border:"none",display:"flex",flexDirection:"column",gap:8}}>
                        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
                        <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Dose / timing" style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{setEditItem(null);setNewName("");setNewSub("");}} style={{flex:1,background:T.card,border:("1px solid "+T.border),borderRadius:8,padding:"8px",fontSize:12,cursor:"pointer",color:T.text}}>Cancel</button>
                          <button onClick={saveEdit} style={{flex:1,background:T.accent,border:"none",borderRadius:8,padding:"8px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Save</button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:i<suppList.length-1?"1px solid "+T.border:"none",cursor:"grab",userSelect:"none"}}>
                        {/* Drag handle */}
                        <div style={{display:"flex",flexDirection:"column",gap:2.5,flexShrink:0,opacity:0.35,cursor:"grab",padding:"2px 4px"}}>
                          {[0,1,2].map(j=><div key={j} style={{width:14,height:1.5,background:T.muted,borderRadius:1}}/>)}
                        </div>
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
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name (e.g. Ashwagandha)" style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>
                <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Dose / timing (e.g. 600mg · Morning)" style={{background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>

                {/* Optional reminder row */}
                <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:12,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:T.text}}>Set reminder <span style={{fontSize:11,color:T.muted,fontWeight:400}}>(optional)</span></div>
                      <div style={{fontSize:11,color:T.subtext,marginTop:2}}>Get notified when it's time to take this</div>
                    </div>
                    <div onClick={()=>setNewReminderEnabled(e=>!e)} style={{width:42,height:24,borderRadius:12,background:newReminderEnabled?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,boxShadow:newReminderEnabled?("0 0 8px "+T.accentGlow):"none"}}>
                      <div style={{position:"absolute",top:2.5,left:newReminderEnabled?19:2.5,width:19,height:19,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.25)"}}/>
                    </div>
                  </div>

                  {/* Time picker — only shown when toggle is on */}
                  {newReminderEnabled&&(
                    <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{background:T.card,border:("1px solid "+T.accent),borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{fontSize:20,fontWeight:800,color:T.accent,letterSpacing:"-0.5px"}}>
                          {(()=>{const[h,m]=newReminderTime.split(":").map(Number);const ap=h>=12?"PM":"AM";const h12=h===0?12:h>12?h-12:h;return h12+":"+String(m).padStart(2,"0")+" "+ap;})()}
                        </div>
                        <input type="time" value={newReminderTime} onChange={e=>setNewReminderTime(e.target.value)}
                          style={{background:"transparent",color:T.subtext,border:"none",fontSize:12,outline:"none",cursor:"pointer"}}/>
                      </div>
                      {/* Quick presets */}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {[["Morning","07:00"],["Breakfast","08:00"],["Midday","12:00"],["Pre-workout","17:00"],["Dinner","18:00"],["Bedtime","21:00"]].map(([label,t])=>(
                          <div key={t} onClick={()=>setNewReminderTime(t)}
                            style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:("1px solid "+newReminderTime===t?T.accent:T.border),background:newReminderTime===t?T.accentPill:"transparent",color:newReminderTime===t?T.accent:T.subtext,transition:"all 0.15s"}}>
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
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:T.text}}>Supplements</div>
          <div style={{fontSize:13,color:T.subtext}}>Daily tracker</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {/* Bell icon showing active reminders count */}
          {suppList.filter(s=>s.reminderEnabled).length>0&&(
            <div style={{background:T.accentPill,border:("1px solid "+T.accent),borderRadius:20,padding:"4px 10px",display:"flex",alignItems:"center",gap:5}}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1a3.5 3.5 0 0 1 3.5 3.5c0 2 .7 3 1 3.5H1c.3-.5 1-1.5 1-3.5A3.5 3.5 0 0 1 5.5 1z" stroke={T.accent} strokeWidth="1.2"/>
                <path d="M4.5 9.5a1 1 0 0 0 2 0" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{fontSize:10,fontWeight:700,color:T.accent}}>{suppList.filter(s=>s.reminderEnabled).length} active</span>
            </div>
          )}
          <div onClick={()=>setManageOpen(true)} style={{width:34,height:34,borderRadius:10,background:T.inputBg,border:("1px solid "+T.border),boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
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
        <div onClick={()=>setManageOpen(true)} style={{border:("1.5px dashed "+T.border),borderRadius:13,padding:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke={T.muted} strokeWidth="1.5" fill="none"/><line x1="7" y1="3" x2="7" y2="11" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="7" x2="11" y2="7" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{fontSize:13,color:T.muted,fontWeight:500}}>Add or manage supplements</div>
        </div>
      </div>
    </div>
  );
}


function CalendarTab({uid,goals,suppList,userName,log,suppTaken,workoutHistory,waterOz=0}){
  const T=useTheme();
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAY_NAMES=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const WEEK_LABELS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const todayObj=new Date();
  const todayStr=localDate(todayObj);
  const [view,setView]=useState("month");
  const [month,setMonth]=useState(todayObj.getMonth());
  const [year,setYear]=useState(todayObj.getFullYear());
  const [selDate,setSelDate]=useState(todayStr);
  const [calData,setCalData]=useState({});
  const [loading,setLoading]=useState(false);
  const [chartView,setChartView]=useState("week");

  // Local YYYY-MM-DD for a calendar cell (m is 0-based, as from getMonth)
  const fmt=(y,m,d)=>localDate(new Date(y,m,d));

  // Compute today's live entry from in-memory App state (always up-to-date)
  const liveTodayEntry=()=>{
    const stackSize=suppList?.length||0;
    const takenCount=(suppList||[]).filter(s=>suppTaken?.[s.k]).length;
    const todayCal=log?Object.values(log).flat().reduce((sum,item)=>{
      const g=item.grams||0;
      return sum+Math.round(((item.per100?.cal||0)*g)/100);
    },0):0;
    const todayWorkout=workoutHistory?.find(w=>w.date===todayStr);
    return{
      cal:todayCal,
      food:todayCal>0,
      workout:!!todayWorkout,
      workoutName:todayWorkout?.workoutName||"",
      suppTaken:takenCount,
      suppTotal:stackSize,
      waterOz:waterOz,
    };
  };

  // Seed demo mode from the hardcoded dayData constant
  useEffect(()=>{
    if(!uid){
      const demo={};
      Object.entries(dayData).forEach(([d,v])=>{
        const ds=fmt(2026,3,Number(d));
        demo[ds]={cal:v.cal,food:!!v.food,workout:!!v.workout,suppTaken:v.supp?(suppList?.length||1):0,suppTotal:suppList?.length||1,workoutName:v.workout?"Workout":""};
      });
      setCalData(demo);
      return;
    }
    fetchMonthData();
  },[uid,month,year]);

  // Always keep today's cell in sync with live App state
  useEffect(()=>{
    setCalData(prev=>({...prev,[todayStr]:liveTodayEntry()}));
  },[log,suppTaken,suppList,workoutHistory]);

  const fetchMonthData=async()=>{
    if(!uid)return;
    setLoading(true);
    const firstDay=fmt(year,month,1);
    const lastDay=fmt(year,month,new Date(year,month+1,0).getDate());
    try{
      const [foodRows,workoutRows,suppLogRows]=await Promise.all([
        sb.select("food_log","user_id=eq."+uid+"&logged_date=gte."+firstDay+"&logged_date=lte."+lastDay),
        sb.select("workout_sessions","user_id=eq."+uid+"&completed_date=gte."+firstDay+"&completed_date=lte."+lastDay),
        sb.select("supplement_log","user_id=eq."+uid+"&log_date=gte."+firstDay+"&log_date=lte."+lastDay+"&taken=eq.true"),
      ]);
      const data={};
      const stackSize=suppList?.length||0;
      const ensure=ds=>{if(!data[ds])data[ds]={cal:0,food:false,workout:false,suppTaken:0,suppTotal:stackSize,workoutName:""};};
      (foodRows||[]).forEach(r=>{
        ensure(r.logged_date);
        data[r.logged_date].cal+=Math.round((r.per100_cal*r.grams)/100);
      });
      Object.keys(data).forEach(ds=>{if(data[ds].cal>0)data[ds].food=true;});
      (workoutRows||[]).forEach(r=>{
        ensure(r.completed_date);
        data[r.completed_date].workout=true;
        data[r.completed_date].workoutName=r.workout_name||"";
      });
      (suppLogRows||[]).forEach(r=>{
        ensure(r.log_date);
        data[r.log_date].suppTaken++;
      });
      setCalData(data);
    }catch(e){console.error("CalendarTab fetch:",e);}
    setLoading(false);
  };

  const dim=new Date(year,month+1,0).getDate();
  const fdow=new Date(year,month,1).getDay();
  const calGoal=goals?.cal||2200;

  // Return Mon–Sun dates for the week containing selDate
  const getWeekDates=()=>{
    const d=new Date(selDate+"T00:00:00");
    const dow=d.getDay();
    const diff=dow===0?-6:1-dow;
    const mon=new Date(d);mon.setDate(d.getDate()+diff);
    return Array.from({length:7},(_,i)=>{const dd=new Date(mon);dd.setDate(mon.getDate()+i);return localDate(dd);});
  };
  const weekDates=getWeekDates();

  const isFuture=ds=>ds>todayStr;

  // Compute status flags for a given date string
  const dayStatus=ds=>{
    const d=calData[ds];
    if(!d)return{allDone:false,missed:[],suppDone:false};
    const suppDone=d.suppTotal>0?d.suppTaken>=d.suppTotal:false;
    const calMet=d.cal>0&&Math.abs(d.cal-calGoal)<=100;
    const waterDone=(d.waterOz||0)>=GOAL_OZ*0.75;
    const allDone=d.food&&d.workout&&suppDone&&calMet&&waterDone;
    const missed=[!d.food,!d.workout,!suppDone,!calMet,!waterDone].filter(Boolean);
    return{allDone,missed,suppDone,calMet,waterDone};
  };

  // Chart arrays — future days show as 0 but styled differently
  const monthChart=Array.from({length:dim},(_,i)=>{
    const ds=fmt(year,month,i+1);
    return{val:calData[ds]?.cal||0,future:ds>todayStr,ds,label:String(i+1)};
  });
  const weekChart=weekDates.map((ds,i)=>({val:calData[ds]?.cal||0,future:ds>todayStr,ds,label:WEEK_LABELS[i]}));
  const chartItems=chartView==="week"?weekChart:monthChart;
  const chartVals=chartItems.map(c=>c.val);
  const hasAnyData=chartVals.some(v=>v>0);
  const maxB=Math.max(...chartVals.filter(v=>v>0),calGoal);

  // Summary stats (for the visible month)
  const monthEntries=Object.entries(calData).filter(([ds])=>ds.startsWith(year+"-"+String(month+1).padStart(2,"0")));
  const loggedDays=monthEntries.filter(([,d])=>d.food).length;
  const goalMetDays=monthEntries.filter(([,d])=>d.cal>=calGoal*0.9&&d.cal>0).length;
  const workoutDays=monthEntries.filter(([,d])=>d.workout).length;
  const avgCal=loggedDays>0?Math.round(monthEntries.filter(([,d])=>d.food).reduce((a,[,d])=>a+d.cal,0)/loggedDays):0;

  // Selected day data
  const selDD=calData[selDate];
  const selStatus=dayStatus(selDate);
  const selDObj=new Date(selDate+"T00:00:00");
  const initials=userName?userName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";

  return(
    <div style={{paddingBottom:80}}>
      {/* Header */}
      <div style={{background:T.card,padding:"16px 20px 12px",borderBottom:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:20,fontWeight:600}}>Calendar</div><div style={{fontSize:13,color:T.muted}}>{MONTHS[month]} {year}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {loading&&<div style={{width:16,height:16,border:("2px solid "+T.border),borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
          <div style={{width:36,height:36,borderRadius:"50%",background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:600}}>{initials}</div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{display:"flex",gap:8,padding:"14px 16px 0"}}>
        {["month","week"].map(v=>(
          <div key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px",borderRadius:10,fontSize:13,fontWeight:500,textAlign:"center",cursor:"pointer",border:("1px solid "+view===v?T.accent:T.border),boxShadow:view===v?T.glowShadow:"none",background:view===v?T.accent:T.card,color:view===v?"#fff":T.muted,textTransform:"capitalize"}}>{v}</div>
        ))}
      </div>

      {/* Month nav */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px 10px"}}>
        <div onClick={()=>{let m=month-1,y=year;if(m<0){m=11;y--;}setMonth(m);setYear(y);}} style={{width:32,height:32,borderRadius:"50%",background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="14" height="14" viewBox="0 0 14 14"><polyline points="9,2 4,7 9,12" stroke={T.text} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
        <div style={{fontSize:16,fontWeight:600}}>{MONTHS[month]} {year}</div>
        <div onClick={()=>{let m=month+1,y=year;if(m>11){m=0;y++;}setMonth(m);setYear(y);}} style={{width:32,height:32,borderRadius:"50%",background:T.card,border:("1px solid "+T.border),boxShadow:T.glowShadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><svg width="14" height="14" viewBox="0 0 14 14"><polyline points="5,2 10,7 5,12" stroke={T.text} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
      </div>

      {/* Month grid */}
      {view==="month"&&(
        <div style={{padding:"0 16px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,color:T.muted,fontWeight:500,padding:"4px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {Array.from({length:fdow},(_,i)=><div key={"e"+i}/>)}
            {Array.from({length:dim},(_,i)=>{
              const d=i+1,ds=fmt(year,month,d);
              const fut=isFuture(ds),tod=ds===todayStr,isSel=ds===selDate;
              const{allDone,missed}=dayStatus(ds);
              const hasData=!!calData[ds];
              return(
                <div key={d} onClick={()=>{if(!fut)setSelDate(ds);}} style={{borderRadius:10,padding:"4px 2px",textAlign:"center",cursor:"pointer",background:isSel?T.accent:T.card,border:tod?"2px solid "+T.accent:("1px solid "+T.border),minHeight:52,display:"flex",flexDirection:"column",alignItems:"center",gap:2,opacity:fut?0.35:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:isSel?"#fff":tod?T.accent:T.text,paddingTop:4}}>{d}</div>
                  <div style={{height:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {!fut&&allDone?(
                      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill={isSel?"rgba(255,255,255,0.9)":T.accent}/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke={isSel?T.accent:"white"} strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                    ):!fut&&hasData&&missed.length>0?(
                      <div style={{display:"flex",gap:2}}>
                        {missed.map((_,mi)=><div key={mi} style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.5)":"#C8C7C2"}}/>)}
                      </div>
                    ):null}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:10}}>
            {[["#2ECC8F","Food logged"],["#5B8DEF","Workout"],["#F5A623","Supplements"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:c}}/><div style={{fontSize:12,color:T.muted}}>{l}</div></div>
            ))}
          </div>
        </div>
      )}

      {/* Week strip — Mon–Sun of the week containing selDate */}
      {view==="week"&&(
        <div style={{padding:"0 16px",marginBottom:12}}>
          <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:14}}>
            <div style={{display:"flex",gap:6}}>
              {weekDates.map((ds,i)=>{
                const isActive=ds===selDate,fut=isFuture(ds);
                const{allDone,missed}=dayStatus(ds);
                const hasData=!!calData[ds];
                const dayNum=new Date(ds+"T00:00:00").getDate();
                return(
                  <div key={i} onClick={()=>{if(!fut)setSelDate(ds);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",padding:"6px 2px",borderRadius:10,background:isActive?T.accent:"transparent",opacity:fut?0.4:1}}>
                    <div style={{fontSize:11,color:isActive?"rgba(255,255,255,0.6)":T.muted,fontWeight:500}}>{WEEK_LABELS[i]}</div>
                    <div style={{fontSize:13,fontWeight:600,color:isActive?"#fff":T.text}}>{dayNum}</div>
                    <div style={{height:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {!fut&&allDone?(
                        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill={T.accent}/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
                      ):!fut&&hasData&&missed.length>0?(
                        <div style={{display:"flex",gap:2}}>
                          {missed.map((_,mi)=><div key={mi} style={{width:4,height:4,borderRadius:"50%",background:isActive?"rgba(255,255,255,0.4)":"#C8C7C2"}}/>)}
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

      {/* Selected day detail */}
      <div style={{background:T.card,margin:"0 16px 14px",borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:16}}>
        <div style={{fontSize:13,color:T.muted,marginBottom:12}}>{DAY_NAMES[selDObj.getDay()]}, {MONTHS[selDObj.getMonth()]} {selDObj.getDate()}</div>
        {[
          ["🍽","Food log",selDD?.food?(selDD.cal.toLocaleString()+" cal logged"):"Not logged",selDD?.food],
          ["💪","Workout",selDD?.workout?(selDD.workoutName||"Completed"):"Not done",selDD?.workout],
          ["💊","Supplements",selDD?.suppTotal>0?(selDD.suppTaken+"/"+selDD.suppTotal+" taken"):"None tracked",selStatus.suppDone],
          ["💧","Water",selDD?.waterOz>0?(selDD.waterOz+" / "+GOAL_OZ+" oz"):"Not logged",selStatus.waterDone],
          ["🎯","Calorie goal",selDD?.cal?(selDD.cal>=calGoal*0.9?"Goal met ✓":Math.round((selDD.cal/calGoal)*100)+"% of goal"):"—",selStatus.calMet],
        ].map(([icon,label,val,chk],i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<3?"1px solid "+T.border:"none"}}>
            <div style={{width:28,height:28,borderRadius:8,background:T.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{icon}</div>
            <div style={{flex:1,fontSize:14}}>{label}</div>
            <div style={{fontSize:13,color:T.muted}}>{val}</div>
            <div style={{width:22,height:22,borderRadius:"50%",background:chk?T.accent:T.surface,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CheckIcon done={chk}/></div>
          </div>
        ))}
      </div>

      {/* Calorie chart */}
      <div style={{padding:"0 16px",marginBottom:14}}>
        <div style={{background:T.card,borderRadius:14,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:16}}>
          {/* Header row with toggle */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:600}}>Calorie history</div>
            <div style={{display:"flex",gap:4,background:T.surface,borderRadius:8,padding:3}}>
              {["week","month"].map(cv=>(
                <div key={cv} onClick={()=>setChartView(cv)}
                  style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",
                    background:chartView===cv?T.accent:"transparent",
                    color:chartView===cv?"#fff":T.muted,
                    transition:"all 0.15s",textTransform:"capitalize"}}>
                  {cv==="week"?"This week":"Monthly"}
                </div>
              ))}
            </div>
          </div>

          {hasAnyData?(
            <div style={{display:"flex",alignItems:"flex-end",gap:chartView==="week"?8:3,height:90}}>
              {chartItems.map(({val,future,label},i)=>{
                const onTarget=!future&&val>0&&Math.abs(val-calGoal)<=100;
                const color=future||val===0?T.barEmpty:onTarget?"#22C55E":val>calGoal+100?"#FF6B4A":val>calGoal*0.85?"#5B8DEF":"#FF6B4A";
                const borderColor=future||val===0?"transparent":onTarget?"rgba(34,197,94,0.6)":val>calGoal*0.85?"rgba(91,141,239,0.5)":"rgba(255,107,74,0.45)";
                const glowColor=onTarget?"rgba(34,197,94,0.25)":val>calGoal*0.85?"rgba(91,141,239,0.18)":"rgba(255,107,74,0.18)";
                const pct=val&&!future?Math.max(Math.round((val/maxB)*100),6):0;
                return(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{width:"100%",height:72,display:"flex",alignItems:"flex-end",position:"relative"}}>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"100%",background:future?T.surface:T.accentPill,borderRadius:6,opacity:future?0.2:1}}/>
                      {pct>0&&(
                        <div style={{
                          position:"absolute",bottom:0,left:0,right:0,
                          height:(pct+"%"),
                          background:("linear-gradient(to top,"+color+","+color+"cc)"),
                          borderRadius:6,
                          border:("1px solid "+borderColor),
                          boxShadow:val>0&&!future?"0 0 6px "+glowColor+",inset 0 1px 0 rgba(255,255,255,0.18)":"none",
                        }}/>
                      )}
                    </div>
                    <div style={{fontSize:chartView==="week"?10:8,color:T.muted,textAlign:"center",lineHeight:1}}>{label}</div>
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:13,color:T.muted}}>No data logged this {chartView==="week"?"week":"month"} yet</div>
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
            <div style={{fontSize:12,color:T.muted}}>Goal: {calGoal.toLocaleString()}/day</div>
            <div style={{fontSize:12,color:T.accent,fontWeight:500}}>
              {chartView==="week"?(()=>{
                const wLogged=weekChart.filter(c=>c.val>0);
                const wAvg=wLogged.length>0?Math.round(wLogged.reduce((a,c)=>a+c.val,0)/wLogged.length):0;
                return wAvg?"Week avg: "+wAvg.toLocaleString()+" cal":"Log food to see avg";
              })():avgCal?"Month avg: "+avgCal.toLocaleString()+" cal":"Log food to see avg"}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly summary */}
      <div style={{padding:"0 16px",marginBottom:10}}><div style={{fontSize:15,fontWeight:600}}>Monthly summary</div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,padding:"0 16px",marginBottom:14}}>
        {[
          [loggedDays||"0","Days logged",T.text],
          [goalMetDays||"0","Goals met",T.green],
          [avgCal?avgCal.toLocaleString():"—","Avg cal/day",T.text],
          [workoutDays||"0","Workouts done",T.macro[1]],
        ].map(([v,l,c])=>(
          <div key={l} style={{background:T.card,borderRadius:12,border:("1px solid "+T.border),boxShadow:T.glowShadow,padding:14}}>
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

// Every date column in this app stores the user's LOCAL day. toISOString()
// returns the UTC day, which is already tomorrow for anyone west of UTC logging
// in the evening. "en-CA" formats local time as YYYY-MM-DD. Writes, read
// filters and comparisons all go through this so they cannot drift apart.
export const localDate=(d=new Date())=>d.toLocaleDateString("en-CA");

export const sb={
  _url:SUPABASE_URL,_key:SUPABASE_ANON,_session:null,
  headers(extra={}){
    return{"Content-Type":"application/json","apikey":this._key,"Authorization":"Bearer "+(this._session?.access_token||this._key),...extra};
  },
  // Single chokepoint for every /rest/v1 call, so mid-session token expiry is
  // handled in one place instead of six. Before this, an access_token that died
  // while the app sat open (a workout runs well past the token's life) made every
  // subsequent write 401 until the user reloaded — the write was rejected and the
  // session was lost.
  //
  // 401 is the ONLY status retried. A 403 is an RLS denial, which refreshing
  // cannot fix, and a 409/400 is a real request problem.
  //
  // The body is deliberately not read here: a Response body can be read only
  // once, and every caller reads it itself. On a failed refresh the original 401
  // Response is handed back untouched, so each method's failure contract
  // (select -> [], insert/upsert -> null, delete/update -> false) is unchanged.
  //
  // Retries exactly once — this never calls itself, so no loop is possible.
  async _fetch(path,init={},extra={}){
    const sent=this._session?.access_token||null;
    const r=await fetch(this._url+path,{...init,headers:this.headers(extra)});
    if(r.status!==401)return r;
    if(!(await reauth(sent)))return r;
    console.warn("[sb] access_token expired mid-session — refreshed, retrying",path.split("?")[0]);
    return fetch(this._url+path,{...init,headers:this.headers(extra)});
  },
  async signUp(email,password){
    const r=await fetch(this._url+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json","apikey":this._key},body:JSON.stringify({email,password})});
    return r.json();
  },
  async signIn(email,password){
    const r=await fetch(this._url+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json","apikey":this._key},body:JSON.stringify({email,password})});
    const d=await r.json();
    if(d.access_token){this._session=d;localStorage.setItem("sb_session",JSON.stringify(d));}
    return d;
  },
  async signOut(){
    await fetch(this._url+"/auth/v1/logout",{method:"POST",headers:this.headers()});
    this._session=null;localStorage.removeItem("sb_session");
  },
  getUser(){return this._session?.user||null;},
  async select(table,filters="",opts={}){
    const q=[filters,opts.order?"order="+opts.order:"",opts.limit?"limit="+opts.limit:""].filter(Boolean).join("&");
    const r=await this._fetch("/rest/v1/"+table+"?"+q);
    if(!r.ok){console.error("[sb.select]",table,r.status,await r.text().catch(()=>""));return[];}
    return r.json();
  },
  // Auth-critical sibling of select(). Same request construction, different
  // response handling: select() collapses every non-2xx into [], which makes a
  // 401 indistinguishable from "no rows" — the mount profile check then reads an
  // expired session as a brand-new user and routes to onboarding.
  // Never throws; rows is always an array. authError is set ONLY by 401/403, so a
  // 500 or a network blip cannot sign anyone out.
  async selectAuth(table,filters="",opts={}){
    try{
      const q=[filters,opts.order?"order="+opts.order:"",opts.limit?"limit="+opts.limit:""].filter(Boolean).join("&");
      const r=await this._fetch("/rest/v1/"+table+"?"+q);
      if(!r.ok){
        console.error("[sb.selectAuth]",table,r.status,await r.text().catch(()=>""));
        return{authError:r.status===401||r.status===403,rows:[]};
      }
      const d=await r.json();
      return{authError:false,rows:Array.isArray(d)?d:[]};
    }catch(e){
      console.error("[sb.selectAuth]",table,"network",e);
      return{authError:false,rows:[]};
    }
  },
  async insert(table,row){
    const r=await this._fetch("/rest/v1/"+table,{method:"POST",body:JSON.stringify(Array.isArray(row)?row:[row])},{"Prefer":"return=representation"});
    if(!r.ok){console.error("[sb.insert]",table,r.status,await r.text().catch(()=>""));return null;}
    const d=await r.json();return Array.isArray(row)?d:d[0];
  },
  // resolution=merge-duplicates alone is not enough: PostgREST infers the
  // ON CONFLICT target from the PRIMARY KEY unless on_conflict says otherwise.
  // Tables with a surrogate id PK plus a separate composite UNIQUE (water_log,
  // supplement_log, body_weight_log) therefore fall through to a plain INSERT
  // and 409 on the second same-day write. Pass onConflict with the exact
  // columns of the UNIQUE constraint — order does not matter, membership does.
  // Callers that upsert on the PK itself (profiles.id) can omit it.
  async upsert(table,row,{onConflict=""}={}){
    const q=onConflict?"?on_conflict="+onConflict.split(",").map(c=>encodeURIComponent(c.trim())).join(","):"";
    const r=await this._fetch("/rest/v1/"+table+q,{method:"POST",body:JSON.stringify(Array.isArray(row)?row:[row])},{"Prefer":"resolution=merge-duplicates,return=representation"});
    if(!r.ok){console.error("[sb.upsert]",table,r.status,await r.text().catch(()=>""));return null;}
    const d=await r.json();return Array.isArray(row)?d:d[0];
  },
  // delete and update log like the other four: "[sb.<method>] <table> <status>"
  // is the grep the browser-side verification depends on, and without it a
  // genuine failure here left no trace anywhere. Return contract is unchanged —
  // still the boolean r.ok was returning.
  async delete(table,filter){
    const r=await this._fetch("/rest/v1/"+table+"?"+filter,{method:"DELETE"});
    if(!r.ok){console.error("[sb.delete]",table,r.status,await r.text().catch(()=>""));return false;}
    return true;
  },
  async update(table,changes,{filter=""}={}){
    const r=await this._fetch("/rest/v1/"+table+"?"+filter,{method:"PATCH",body:JSON.stringify(changes)},{"Prefer":"return=representation"});
    if(!r.ok){console.error("[sb.update]",table,r.status,await r.text().catch(()=>""));return false;}
    return true;
  },
};

// Headers for /api/coach. The token is read at call time, not captured, so a
// just-refreshed access_token is used rather than a stale one. If there is no
// session the request still goes out and the server answers 401 — the client
// never decides for itself whether a token is valid.
function coachHeaders(){
  const t=sb._session?.access_token;
  return t?{"Content-Type":"application/json","Authorization":"Bearer "+t}
          :{"Content-Type":"application/json"};
}

// One place to turn a coach failure into something honest. 429 prefers the
// server's message because it carries the actual retry time.
function coachErrorText(e,fallback){
  if(e?.status===401)return "Your session expired. Sign out and sign back in to keep using the coach.";
  if(e?.status===429)return e.userMessage||"You've reached the coach's usage limit. Try again later.";
  return fallback;
}

// Treat a token expiring within this window as needing refresh (clock skew buffer).
const REFRESH_SKEW_MS=60*1000;

function persistSession(d){
  // Refresh-grant responses may omit expires_at; derive it from expires_in.
  if(d&&d.access_token&&!d.expires_at&&d.expires_in){
    d.expires_at=Math.floor(Date.now()/1000)+d.expires_in;
  }
  sb._session=d;
  try{localStorage.setItem("sb_session",JSON.stringify(d));}catch{}
}

function clearSession(){
  sb._session=null;
  try{localStorage.removeItem("sb_session");}catch{}
}

// Coalesce concurrent refreshes (StrictMode double-mount, component remount) onto
// ONE network call so the single-use refresh_token is rotated exactly once.
let _refreshInFlight=null;
export async function refreshSession(refresh_token){
  if(_refreshInFlight)return _refreshInFlight;
  _refreshInFlight=(async()=>{
    try{
      const r=await fetch(sb._url+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"Content-Type":"application/json","apikey":sb._key},body:JSON.stringify({refresh_token})});
      if(!r.ok)return null;
      const d=await r.json();
      return d.access_token?d:null;
    }catch{return null;}
    finally{_refreshInFlight=null;}
  })();
  return _refreshInFlight;
}

// sb is a module-level object; authState is React state. A refresh that fails
// deep inside a write has no way to route on its own, so App registers one
// handler at mount. Routing target is "auth" and never "onboarding" — see the
// routing rule in PROJECT_CONTEXT: onboarding as a fallback overwrites a real
// profile.
let _onAuthLost=null;
export function setAuthLostHandler(fn){_onAuthLost=fn;}
function authLost(){
  clearSession();
  if(_onAuthLost)_onAuthLost();
}

// Recover from a 401 on a data request. Returns true if the caller should retry.
//
// `sent` is the access_token the failed request actually used. The in-flight
// guard inside refreshSession only coalesces requests that overlap in time;
// finishing a workout fires several writes that 401 in sequence, microseconds
// apart. Without this comparison the second one would redeem a refresh_token the
// first had already rotated — Supabase rejects the reused single-use token, and
// the user is signed out mid-workout, which is worse than the bug being fixed.
//
// So: if the live session already carries a different access_token, someone else
// refreshed while this request was in flight. Retry on theirs, do not refresh.
async function reauth(sent){
  const cur=sb._session?.access_token||null;
  if(cur&&cur!==sent)return true;
  const rt=sb._session?.refresh_token;
  if(!rt){authLost();return false;}
  const fresh=await refreshSession(rt);
  if(!fresh){authLost();return false;}
  // Refresh responses may omit the user; loadUserData and getUser need it.
  if(!fresh.user&&sb._session?.user)fresh.user=sb._session.user;
  persistSession(fresh);
  return true;
}

// Single auth-resolution gate: turn the stored session into a definite state
// BEFORE any data load runs. Refreshes at most once. Returns
// {status:"valid"|"refreshed"|"logged-out", session?}.
export async function resolveSession(){
  let s;
  try{s=JSON.parse(localStorage.getItem("sb_session")||"null");}catch{s=null;}
  if(!s?.access_token)return{status:"logged-out"};
  const expMs=(s.expires_at||0)*1000;
  const needsRefresh=!s.expires_at||((expMs-Date.now())<REFRESH_SKEW_MS);
  if(!needsRefresh){sb._session=s;return{status:"valid",session:s};}
  // Expired/expiring: attempt a single refresh with the rotated refresh_token.
  if(!s.refresh_token){clearSession();return{status:"logged-out"};}
  const fresh=await refreshSession(s.refresh_token);
  if(!fresh){clearSession();return{status:"logged-out"};}
  // Carry the user forward if the refresh response omits it (loadUserData/getUser need it).
  if(!fresh.user&&s.user)fresh.user=s.user;
  persistSession(fresh);
  return{status:"refreshed",session:fresh};
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
      <div style={{position:"absolute",bottom:-60,left:-60,width:200,height:200,borderRadius:"50%",background:(T.accentSoft+"22"),filter:"blur(40px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:("0 8px 28px "+T.accentGlow)}}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M6 16L11 21L26 9"/><circle cx="16" cy="16" r="13"/></svg>
        </div>
        <div style={{fontSize:28,fontWeight:800,color:T.text,letterSpacing:"-1px"}}>WiFit</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>Your personal fitness companion</div>
      </div>

      {/* Demo mode button */}
      <div style={{width:"100%",maxWidth:400,marginBottom:16}}>
        <button onClick={()=>onAuth({id:"demo",email:"demo@fittrack.app"},true)}
          style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 20px "+T.accentGlow)}}>
          🚀 Try Demo Mode (no account needed)
        </button>
      </div>

      <div style={{width:"100%",maxWidth:400,display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{flex:1,height:1,background:T.border}}/>
        <div style={{fontSize:12,color:T.muted}}>or sign in with account</div>
        <div style={{flex:1,height:1,background:T.border}}/>
      </div>

      <div style={{width:"100%",maxWidth:400,background:T.card,border:("1px solid "+T.border),borderRadius:20,padding:"28px 24px",boxShadow:T.glowShadow}}>
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
                style={{width:"100%",background:T.inputBg,color:T.text,border:("1px solid "+T.border),borderRadius:12,padding:"12px 14px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        {error&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#EF4444",marginBottom:14}}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{width:"100%",background:loading?T.muted:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":("0 4px 20px "+T.accentGlow),transition:"all 0.2s"}}>
          {loading?"Please wait…":isLogin?"Log in →":"Create account →"}
        </button>
      </div>
      <div style={{marginTop:20,fontSize:12,color:T.muted,textAlign:"center"}}>By continuing you agree to our Terms of Service.</div>
    </div>
  );
}

// ── ONBOARDING WIZARD ─────────────────────────────────────────────
// ── GOAL RATES — shared by onboarding + profile ──────────────────
const GOAL_RATES=[
  {id:"lose_2",   label:"Lose 2 lbs/week",   delta:-1000, dir:"lose",  color:"#EF4444", icon:"📉"},
  {id:"lose_1",   label:"Lose 1 lb/week",    delta:-500,  dir:"lose",  color:"#F97316", icon:"🔥"},
  {id:"lose_0.5", label:"Lose 0.5 lb/week",  delta:-250,  dir:"lose",  color:"#FBBF24", icon:"🌤"},
  {id:"maintain", label:"Maintain weight",   delta:0,     dir:"maintain",color:"#22C55E",icon:"⚖️"},
  {id:"gain_0.5", label:"Gain 0.5 lb/week",  delta:250,   dir:"gain",  color:"#06B6D4", icon:"📈"},
  {id:"gain_1",   label:"Gain 1 lb/week",    delta:500,   dir:"gain",  color:"#818CF8", icon:"💪"},
  {id:"gain_2",   label:"Gain 2 lbs/week",   delta:1000,  dir:"gain",  color:"#A855F7", icon:"🚀"},
];

function calcCalFromRate(tdee,rateId){
  const rate=GOAL_RATES.find(r=>r.id===rateId)||GOAL_RATES[3];
  return Math.max(tdee+rate.delta,1200);
}

function GoalRatePicker({rate,setRate,tdee=0}){
  const T=useTheme();
  return(
    <div style={{display:"flex",flexDirection:"column",gap:7}}>
      {GOAL_RATES.map(r=>{
        const isActive=rate===r.id;
        const cal=tdee>0?calcCalFromRate(tdee,r.id):null;
        return(
          <div key={r.id} onClick={()=>setRate(r.id)}
            style={{
              display:"flex",alignItems:"center",gap:12,
              padding:"12px 14px",borderRadius:13,cursor:"pointer",
              background:isActive?T.accentPill:T.card,
              border:("1.5px solid "+isActive?r.color:T.border),
              boxShadow:isActive?"0 0 0 1px "+r.color+"33":"none",
              transition:"all 0.15s",
            }}>
            {/* Radio */}
            <div style={{width:18,height:18,borderRadius:"50%",border:("2px solid "+isActive?r.color:T.muted),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {isActive&&<div style={{width:9,height:9,borderRadius:"50%",background:r.color}}/>}
            </div>
            {/* Icon */}
            <div style={{fontSize:16,flexShrink:0}}>{r.icon}</div>
            {/* Label */}
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:isActive?r.color:T.text}}>{r.label}</div>
              {r.delta!==0&&(
                <div style={{fontSize:10,color:T.muted,marginTop:1}}>
                  {r.delta>0?"+":""}{r.delta} kcal/day from TDEE
                </div>
              )}
            </div>
            {/* Calorie estimate */}
            {cal&&(
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:800,color:r.color}}>{cal.toLocaleString()}</div>
                <div style={{fontSize:9,color:T.muted}}>kcal/day</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OnboardingWizard({userId,onComplete}){
  const T=useTheme();
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [gender,setGender]=useState("male");
  const [age,setAge]=useState("");
  const [weightLbs,setWeightLbs]=useState("");
  const [heightFt,setHeightFt]=useState("5");
  const [heightIn,setHeightIn]=useState("9");
  const [activity,setActivity]=useState("moderate");
  const [goalRate,setGoalRate]=useState("maintain");
  const [saving,setSaving]=useState(false);

  const ACTIVITY=[
    {id:"bmr",     label:"Basal Metabolic Rate (BMR)", sub:"No activity, bed rest",                mult:1.0},
    {id:"sedentary",label:"Little or no exercise",      sub:"Desk job, mostly sitting",             mult:1.2},
    {id:"light",   label:"Exercise 1–3 times/week",    sub:"Light workouts or walks",              mult:1.375},
    {id:"moderate",label:"Exercise 3–5 times/week",    sub:"Gym sessions most days",               mult:1.55},
    {id:"active",  label:"Daily exercise or intense 3–4×/week", sub:"Hard training most days",     mult:1.725},
    {id:"very_active",label:"Intense exercise 6–7×/week",       sub:"Heavy lifting or sport daily", mult:1.9},
    {id:"extremely",label:"Very intense daily or physical job", sub:"Athletes, labour workers",     mult:2.0},
  ];

  const calcGoals=()=>{
    const w=parseFloat(weightLbs)||170;
    const h=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);
    const a=parseInt(age)||25;
    const wKg=w*0.453592;const hCm=h*2.54;
    const bmr=gender==="male"
      ?(13.397*wKg)+(4.799*hCm)-(5.677*a)+88.362
      :(9.247*wKg)+(3.098*hCm)-(4.330*a)+447.593;
    const mult=ACTIVITY.find(x=>x.id===activity)?.mult||1.55;
    const tdee=Math.round(bmr*mult);
    const cal=calcCalFromRate(tdee,goalRate);
    const protein=Math.round(w*0.82);
    const fat=Math.round(cal*0.25/9);
    const carbs=Math.max(Math.round((cal-protein*4-fat*9)/4),50);
    return{cal,protein,carbs,fat,tdee,bmr:Math.round(bmr)};
  };

  const g=calcGoals();

  const finish=async()=>{
    setSaving(true);
    const goals={cal:g.cal,protein:g.protein,carbs:g.carbs,fat:g.fat};
    const hin=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);
    if(userId){
      await sb.upsert("profiles",{
        id:userId,
        name:name.trim()||"Friend",
        gender,
        age:parseInt(age)||null,
        weight_lbs:parseFloat(weightLbs)||null,
        height_in:hin,
        goal_rate:goalRate,
        activity_level:activity,
        cal_goal:g.cal,
        protein_goal:g.protein,
        carbs_goal:g.carbs,
        fat_goal:g.fat,
        bmr:g.bmr,
        tdee:g.tdee,
        theme:"dark",
        updated_at:new Date().toISOString(),
      });
    }
    setSaving(false);
    onComplete(goals,name.trim()||"Friend");
  };

  const inp=(val,set,ph,type="text",extra={})=>(
    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
      style={{background:T.inputBg,color:T.text,border:("1.5px solid "+T.border),borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box",...extra}}/>
  );

  const RadioOpt=({value,current,onChange,label,sub})=>(
    <div onClick={()=>onChange(value)}
      style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",borderRadius:13,cursor:"pointer",
        background:current===value?T.accentPill:T.card,
        border:("1.5px solid "+current===value?T.accent:T.border),
        boxShadow:current===value?T.glowShadow:"none",
        transition:"all 0.15s"}}>
      {/* Radio circle */}
      <div style={{width:20,height:20,borderRadius:"50%",border:("2px solid "+current===value?T.accent:T.muted),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {current===value&&<div style={{width:10,height:10,borderRadius:"50%",background:T.accent}}/>}
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:600,color:T.text}}>{label}</div>
        {sub&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>{sub}</div>}
      </div>
    </div>
  );

  const STEPS=[
    // ── Step 0: Name & Gender ─────────────────────────────────────
    {
      title:"Let's get started 👋",
      sub:"Tell us a little about yourself",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Your name</div>
            {inp(name,setName,"First name")}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Gender</div>
            <div style={{display:"flex",gap:10}}>
              {[["male","♂ Male"],["female","♀ Female"]].map(([v,l])=>(
                <div key={v} onClick={()=>setGender(v)}
                  style={{flex:1,padding:"14px 10px",borderRadius:13,textAlign:"center",cursor:"pointer",
                    background:gender===v?T.accentPill:T.card,
                    border:("1.5px solid "+gender===v?T.accent:T.border),
                    fontSize:14,fontWeight:600,color:gender===v?T.accent:T.text,
                    boxShadow:gender===v?T.glowShadow:"none",transition:"all 0.15s"}}>
                  {l}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Age <span style={{fontSize:10,fontWeight:500,color:T.muted}}>(15 – 80)</span></div>
            {inp(age,setAge,"e.g. 25","number")}
          </div>
        </div>
      ),
    },

    // ── Step 1: Height & Weight ───────────────────────────────────
    {
      title:"Body measurements 📏",
      sub:"Used to calculate your exact calorie target using the Revised Harris-Benedict formula",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Height</div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{flex:1,position:"relative"}}>
                <input type="number" value={heightFt} onChange={e=>setHeightFt(e.target.value)} placeholder="5"
                  style={{width:"100%",background:T.inputBg,color:T.text,border:("1.5px solid "+T.border),borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box"}}/>
                <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:T.muted,pointerEvents:"none"}}>ft</div>
              </div>
              <div style={{flex:1,position:"relative"}}>
                <input type="number" value={heightIn} onChange={e=>setHeightIn(e.target.value)} placeholder="9"
                  style={{width:"100%",background:T.inputBg,color:T.text,border:("1.5px solid "+T.border),borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box"}}/>
                <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:T.muted,pointerEvents:"none"}}>in</div>
              </div>
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Weight</div>
            <div style={{position:"relative"}}>
              <input type="number" value={weightLbs} onChange={e=>setWeightLbs(e.target.value)} placeholder="e.g. 165"
                style={{width:"100%",background:T.inputBg,color:T.text,border:("1.5px solid "+T.border),borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box"}}/>
              <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:T.muted,pointerEvents:"none"}}>lbs</div>
            </div>
          </div>
          {/* Live BMR preview */}
          {weightLbs&&age&&(
            <div style={{background:T.accentPill,border:("1px solid "+T.accent+"33"),borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between"}}>
              <div style={{fontSize:12,color:T.muted}}>Estimated BMR</div>
              <div style={{fontSize:12,fontWeight:700,color:T.accent}}>{g.bmr.toLocaleString()} kcal/day</div>
            </div>
          )}
        </div>
      ),
    },

    // ── Step 2: Activity Level ────────────────────────────────────
    {
      title:"Activity level ⚡",
      sub:"How much do you exercise on average?",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {ACTIVITY.map(({id,label,sub})=>(
            <RadioOpt key={id} value={id} current={activity} onChange={setActivity} label={label} sub={sub}/>
          ))}
        </div>
      ),
    },

    // ── Step 3: Goal Rate ─────────────────────────────────────────
    {
      title:"Choose your goal 🎯",
      sub:"Pick how fast you want to lose or gain. Your daily calories are calculated from this.",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <GoalRatePicker rate={goalRate} setRate={setGoalRate} tdee={g.tdee}/>
          {g.tdee>0&&(
            <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
              <div style={{fontSize:12,color:T.muted}}>Your TDEE (maintenance)</div>
              <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{g.tdee.toLocaleString()} kcal/day</div>
            </div>
          )}
        </div>
      ),
    },

    // ── Step 4: Summary ───────────────────────────────────────────
    {
      title:"Your personalised plan ✨",
      sub:"Calculated from your stats. You can adjust these later in Profile.",
      content:(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Calorie target */}
          <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),borderRadius:16,padding:20,textAlign:"center",border:("1px solid "+T.border)}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Daily calorie target</div>
            <div style={{fontSize:48,fontWeight:800,color:"#fff",letterSpacing:"-2px",lineHeight:1}}>{g.cal.toLocaleString()}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:6}}>kcal / day</div>
          </div>

          {/* Macros */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[["Protein",g.protein+"g",T.macro[0]],["Carbs",g.carbs+"g",T.macro[1]],["Fat",g.fat+"g",T.macro[2]]].map(([l,v,c])=>(
              <div key={l} style={{background:T.card,border:("1px solid "+T.border),borderRadius:12,padding:"12px 8px",textAlign:"center",boxShadow:T.glowShadow}}>
                <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:10,color:T.muted,marginTop:3}}>{l}/day</div>
              </div>
            ))}
          </div>

          {/* Stats summary */}
          <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,overflow:"hidden"}}>
            {[
              ["Name",name||"—"],
              ["Gender",gender==="male"?"Male":"Female"],
              ["Age",age?age+" yrs":"—"],
              ["Weight",weightLbs?weightLbs+" lbs":"—"],
              ["Height",heightFt+"ft "+heightIn+"in"],
              ["Activity",ACTIVITY.find(a=>a.id===activity)?.label||"—"],
              ["Goal",GOAL_RATES.find(r=>r.id===goalRate)?.label||"—"],
              ["BMR",g.bmr.toLocaleString()+" kcal"],
              ["TDEE",g.tdee.toLocaleString()+" kcal"],
            ].map(([k,v],i,arr)=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:i<arr.length-1?"1px solid "+T.border:"none"}}>
                <div style={{fontSize:12,color:T.muted}}>{k}</div>
                <div style={{fontSize:12,fontWeight:600,color:T.text}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const canAdvance=()=>{
    if(step===0)return name.trim().length>0&&age;
    if(step===1)return weightLbs&&heightFt&&heightIn;
    return true;
  };

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",fontFamily:"-apple-system,sans-serif",maxWidth:480,margin:"0 auto",position:"relative",overflow:"hidden"}}>
      {/* Glow */}
      <div style={{position:"absolute",top:-80,right:-60,width:220,height:220,borderRadius:"50%",background:T.accentGlow,filter:"blur(60px)",pointerEvents:"none"}}/>

      {/* Progress bar */}
      <div style={{padding:"52px 20px 0"}}>
        <div style={{display:"flex",gap:6,marginBottom:28}}>
          {STEPS.map((_,i)=>(
            <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?T.accent:T.border,transition:"all 0.3s"}}/>
          ))}
        </div>
        <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Step {step+1} of {STEPS.length}</div>
        <div style={{fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.6px",marginBottom:4}}>{STEPS[step].title}</div>
        <div style={{fontSize:13,color:T.muted,marginBottom:22}}>{STEPS[step].sub}</div>
      </div>

      {/* Step content — scrollable */}
      <div style={{flex:1,overflowY:"auto",padding:"0 20px"}}>
        {STEPS[step].content}
      </div>

      {/* Footer buttons */}
      <div style={{padding:"20px 20px 44px",display:"flex",gap:10,flexShrink:0}}>
        {step>0&&(
          <button onClick={()=>setStep(s=>s-1)}
            style={{flex:1,background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:"15px",color:T.text,fontSize:15,fontWeight:600,cursor:"pointer"}}>
            ← Back
          </button>
        )}
        <button
          onClick={()=>step<STEPS.length-1?setStep(s=>s+1):finish()}
          disabled={!canAdvance()||saving}
          style={{flex:2,background:(!canAdvance()||saving)?T.muted:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:(!canAdvance()||saving)?"not-allowed":"pointer",boxShadow:canAdvance()?("0 4px 20px "+T.accentGlow):"none",transition:"all 0.2s"}}>
          {saving?"Saving your plan…":step<STEPS.length-1?"Continue →":"Let's go 🚀"}
        </button>
      </div>
    </div>
  );
}

// ── SHARED COMPONENTS ────────────────────────────────────────────
function SectionHeader({label}){
  const T=useTheme();
  return <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1.2,padding:"20px 20px 8px",background:T.bg}}>{label}</div>;
}
function SettingRow({label,sub,right,onClick,danger}){
  const T=useTheme();
  return(
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",cursor:onClick?"pointer":"default",borderBottom:("1px solid "+T.border)}}
      onMouseEnter={e=>onClick&&(e.currentTarget.style.background=T.surface)}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:500,color:danger?"#EF4444":T.text}}>{label}</div>
        {sub&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}
function Toggle({value,onChange}){
  const T=useTheme();
  return(
    <div onClick={()=>onChange(!value)} style={{width:44,height:26,borderRadius:13,background:value?T.accent:T.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:value?21:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
    </div>
  );
}
function PageShell({title,onBack,children,footer}){
  const T=useTheme();
  return(
    <div style={{position:"fixed",inset:0,zIndex:310,background:T.bg,display:"flex",flexDirection:"column",animation:"slideInRight 0.22s cubic-bezier(.4,0,.2,1)"}}>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{background:T.card,borderBottom:("1px solid "+T.border),padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <div onClick={onBack} style={{width:34,height:34,borderRadius:"50%",background:T.surface,border:("1px solid "+T.border),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><polyline points="8,2 2,8 8,14" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{fontSize:17,fontWeight:700,color:T.text}}>{title}</div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>{children}</div>
      {footer&&<div style={{flexShrink:0,padding:"12px 16px 32px",borderTop:("1px solid "+T.border),background:T.card}}>{footer}</div>}
    </div>
  );
}

// ── SETTINGS PAGE ─────────────────────────────────────────────────
// ── HEALTH SYNC — Feature 10 ──────────────────────────────────────
function HealthSyncSection({T:TFallback}){
  const T=useTheme()||TFallback;
  const [status,setStatus]=useState("idle"); // idle | connecting | connected | unsupported | error
  const [lastSync,setLastSync]=useState(null);
  const [steps,setSteps]=useState(null);

  // Detect platform
  const hasHealthAPI=typeof navigator!=="undefined"&&"health" in navigator;
  const isIOS=typeof navigator!=="undefined"&&/iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid=typeof navigator!=="undefined"&&/Android/.test(navigator.userAgent);

  const connectHealth=async()=>{
    setStatus("connecting");
    try{
      // Web Health API (experimental — Chrome on Android with Health Connect)
      if(hasHealthAPI){
        const health=navigator.health;
        await health.query({
          metrics:["steps","active_calories_burned","weight"],
          startTime:new Date(Date.now()-7*24*60*60*1000).toISOString(),
          endTime:new Date().toISOString(),
        });
        setStatus("connected");
        setLastSync(new Date().toLocaleTimeString());
        // Try to get today's steps
        const today=new Date();today.setHours(0,0,0,0);
        const stepsData=await health.query({metrics:["steps"],startTime:today.toISOString(),endTime:new Date().toISOString()});
        if(stepsData?.steps)setSteps(stepsData.steps.reduce((s,r)=>s+(r.value||0),0));
        localStorage.setItem("health_sync_connected","1");
      }else{
        // Not supported — show platform-specific instructions
        setStatus("unsupported");
      }
    }catch(e){
      setStatus(e.name==="NotAllowedError"?"error_permission":"error");
    }
  };

  useEffect(()=>{
    if(localStorage.getItem("health_sync_connected")==="1")setStatus("connected");
  },[]);

  const platformName=isIOS?"Apple Health":isAndroid?"Google Fit / Health Connect":"Health App";

  return(
    <div style={{padding:"0 20px 8px"}}>
      {status==="idle"||status==="connecting"?(
        <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:28}}>{isIOS?"🍎":isAndroid?"💚":"❤️"}</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:T.text}}>{platformName}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:2}}>Sync steps, weight and calories burned</div>
            </div>
          </div>
          <button onClick={connectHealth} disabled={status==="connecting"}
            style={{background:status==="connecting"?T.muted:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,fontWeight:700,cursor:status==="connecting"?"not-allowed":"pointer",transition:"background 0.2s"}}>
            {status==="connecting"?"Connecting…":"Connect "+platformName}
          </button>
        </div>
      ):status==="connected"?(
        <div style={{background:T.surface,border:("1px solid "+T.accent+"55"),borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:24}}>{isIOS?"🍎":isAndroid?"💚":"❤️"}</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:T.accent}}>✓ {platformName} connected</div>
                {lastSync&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>Last sync: {lastSync}</div>}
              </div>
            </div>
            <div onClick={()=>{setStatus("idle");localStorage.removeItem("health_sync_connected");}} style={{fontSize:11,color:T.muted,cursor:"pointer",padding:"4px 8px",borderRadius:8,background:T.card,border:("1px solid "+T.border)}}>Disconnect</div>
          </div>
          {steps!==null&&(
            <div style={{background:T.card,borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,color:T.text}}>👟 Steps today</div>
              <div style={{fontSize:14,fontWeight:700,color:T.accent}}>{steps.toLocaleString()}</div>
            </div>
          )}
        </div>
      ):status==="unsupported"?(
        <div style={{background:T.surface,border:("1px solid "+T.border),borderRadius:14,padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:6}}>Health app sync</div>
          <div style={{fontSize:12,color:T.muted,lineHeight:1.6,marginBottom:10}}>
            {isIOS
              ?"Your browser doesn't support direct Health API access. For full Apple Health integration, download the native WiFit app from the App Store."
              :isAndroid
              ?"Requires Chrome on Android with Health Connect installed. Make sure Health Connect is set up in your device settings."
              :"Health app sync requires a supported mobile browser. On iOS use Safari, on Android use Chrome with Health Connect installed."}
          </div>
          <div style={{background:T.accentPill,border:("1px solid "+T.accent+"44"),borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:18}}>📱</div>
            <div style={{fontSize:12,color:T.accent,fontWeight:600}}>Native app coming soon — full Health sync</div>
          </div>
        </div>
      ):(
        <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:14,padding:14}}>
          <div style={{fontSize:13,fontWeight:600,color:"#EF4444",marginBottom:4}}>Connection failed</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:10}}>
            {status==="error_permission"?"Permission was denied. Allow health data access in your device settings to connect.":"Something went wrong. Make sure you're on a supported browser and try again."}
          </div>
          <div onClick={()=>setStatus("idle")} style={{fontSize:12,color:T.accent,cursor:"pointer",fontWeight:600}}>Try again</div>
        </div>
      )}
    </div>
  );
}

function SettingsPage({onBack,isDark,setIsDark,onSignOut,userName}){
  const T=useTheme();
  // One of navItems' ids below; renderSection has no fallback branch, so this
  // must always be a valid id. "account" matches the first nav item.
  const [section,setSection]=useState("account");
  const [notifWorkout,setNotifWorkout]=useState(()=>JSON.parse(localStorage.getItem("notif_workout")||"true"));
  const [notifSupps,setNotifSupps]=useState(()=>JSON.parse(localStorage.getItem("notif_supps")||"true"));
  const [notifGoals,setNotifGoals]=useState(()=>JSON.parse(localStorage.getItem("notif_goals")||"false"));
  const [notifPerm,setNotifPerm]=useState(()=>"Notification" in window?Notification.permission:"denied");
  const [units,setUnits]=useState("imperial");
  const [privMode,setPrivMode]=useState(false);

  const requestAndToggleNotif=async(key,val,setter)=>{
    if(val&&"Notification" in window&&Notification.permission!=="granted"){
      const perm=await Notification.requestPermission();
      setNotifPerm(perm);
      if(perm!=="granted"){setter(false);return;}
    }
    setter(val);
    localStorage.setItem("notif_"+key,JSON.stringify(val));
    if(val&&notifPerm==="granted"){
      scheduleNotif(key);
    }
  };

  const scheduleNotif=(key)=>{
    if(!("Notification" in window)||Notification.permission!=="granted")return;
    const msgs={
      workout:{title:"💪 Time to train!",body:"Your workout is scheduled for today. Let's get it done."},
      supps:{title:"💊 Supplement reminder",body:"Don't forget to take your supplements today."},
      goals:{title:"🎯 Calorie check-in",body:"Have you logged your meals today? Stay on track."},
    };
    const m=msgs[key];
    if(!m)return;
    // Fire a demo notification immediately to confirm it works, then daily
    setTimeout(()=>{
      try{new Notification(m.title,{body:m.body,icon:"/favicon.ico"});}catch{}
    },3000);
  };

  const navItems=[{id:"account",label:"Account"},{id:"notifications",label:"Notifications"},{id:"appearance",label:"Appearance"},{id:"units",label:"Units & data"},{id:"privacy",label:"Privacy"},{id:"advanced",label:"Advanced"}];
  const email=sb.getUser()?.email||"—";
  const initials=userName?userName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";
  const renderSection=()=>{
    if(section==="account")return(<>
      <div style={{padding:"24px 20px 16px",borderBottom:("1px solid "+T.border),display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:700,flexShrink:0}}>{initials}</div>
        <div><div style={{fontSize:18,fontWeight:700,color:T.text}}>{userName||"User"}</div><div style={{fontSize:13,color:T.muted,marginTop:2}}>Signed in as {email}</div></div>
      </div>
      <SectionHeader label="Your account"/>
      <SettingRow label="Email address" sub={email} right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Change password" sub="Update your login credentials" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Connected devices" sub="Manage synced wearables and apps" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SectionHeader label="Subscription"/>
      <SettingRow label="WiFit Plus" sub="Active — renews monthly" right={<span style={{fontSize:12,color:T.accent,fontWeight:600,background:T.accentPill,padding:"3px 10px",borderRadius:20}}>Manage</span>}/>
      <SectionHeader label="Danger zone"/>
      <SettingRow label="Sign out" danger onClick={onSignOut}/>
      <SettingRow label="Delete account" sub="Permanently remove all your data" danger/>
    </>);
    if(section==="notifications")return(<>
      {notifPerm==="denied"&&(
        <div style={{margin:"16px 16px 0",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:16,flexShrink:0}}>🔕</span>
          <div><div style={{fontSize:13,fontWeight:600,color:"#EF4444"}}>Notifications blocked</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>Enable notifications in your browser or device settings to receive reminders.</div></div>
        </div>
      )}
      {notifPerm==="granted"&&(
        <div style={{margin:"16px 16px 0",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:12,padding:"10px 14px",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:14}}>✅</span>
          <div style={{fontSize:12,color:"#22C55E",fontWeight:600}}>Notifications enabled</div>
        </div>
      )}
      <SectionHeader label="Workout reminders"/>
      <SettingRow label="Workout reminders" sub="Daily push notification to train" right={<Toggle value={notifWorkout} onChange={v=>requestAndToggleNotif("workout",v,setNotifWorkout)}/>}/>
      <SettingRow label="Rest day reminder" sub="Remind me to recover on off-days" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SectionHeader label="Nutrition"/>
      <SettingRow label="Supplement reminders" sub="Alerts for each supplement in your stack" right={<Toggle value={notifSupps} onChange={v=>requestAndToggleNotif("supps",v,setNotifSupps)}/>}/>
      <SettingRow label="Calorie goal alerts" sub="Notify when near daily limit" right={<Toggle value={notifGoals} onChange={v=>requestAndToggleNotif("goals",v,setNotifGoals)}/>}/>
      <SettingRow label="Meal logging reminders" sub="Prompt to log breakfast, lunch, dinner" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SectionHeader label="App"/>
      <SettingRow label="Weekly summary" sub="Sunday digest of your progress" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="AI Coach suggestions" sub="Proactive tips from your coach" right={<Toggle value={true} onChange={()=>{}}/>}/>
    </>);
    if(section==="appearance")return(<>
      <SectionHeader label="Theme"/>
      <SettingRow label="Dark mode" sub={isDark?"Midnight Purple":"Clean Slate"} right={<Toggle value={isDark} onChange={setIsDark}/>}/>
      <SectionHeader label="Display"/>
      <SettingRow label="Compact mode" sub="Denser layout with smaller cards" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SettingRow label="Large text" sub="Increase font sizes throughout the app" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SettingRow label="Reduce motion" sub="Disable animations and transitions" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SectionHeader label="Home screen"/>
      <SettingRow label="Show calorie ring" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="Show macro bars" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="Show shortcuts" right={<Toggle value={true} onChange={()=>{}}/>}/>
    </>);
    if(section==="units")return(<>
      <SectionHeader label="Measurements"/>
      {[["imperial","Imperial (lbs, miles)"],["metric","Metric (kg, km)"]].map(([val,label])=>(
        <SettingRow key={val} label={label} onClick={()=>setUnits(val)} right={units===val?<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={T.accent}/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>:<div style={{width:16,height:16,borderRadius:"50%",border:("1.5px solid "+T.border)}}/>}/>
      ))}
      <SectionHeader label="Nutrition display"/>
      <SettingRow label="Energy unit" sub="kcal" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Macro display" sub="Show grams and percentages" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SectionHeader label="Data and export"/>
      <SettingRow label="Export my data" sub="Download all your logs as CSV" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Import food history" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SectionHeader label="Health app integration"/>
      <HealthSyncSection T={T}/>
    </>);
    if(section==="privacy")return(<>
      <SectionHeader label="Data collection"/>
      <SettingRow label="Analytics" sub="Help improve WiFit with usage data" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="Crash reporting" sub="Automatically send error reports" right={<Toggle value={true} onChange={()=>{}}/>}/>
      <SettingRow label="Personalised ads" sub="Allow relevant ads in free tier" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SectionHeader label="Visibility"/>
      <SettingRow label="Private profile" sub="Hide your stats from leaderboards" right={<Toggle value={privMode} onChange={setPrivMode}/>}/>
      <SettingRow label="Friend activity" sub="See what friends are logging" right={<Toggle value={false} onChange={()=>{}}/>}/>
      <SectionHeader label="Legal"/>
      <SettingRow label="Privacy policy" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Terms of service" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
    </>);
    if(section==="advanced")return(<>
      <SectionHeader label="Debug"/>
      <SettingRow label="App version" sub="WiFit 1.0.0 (build 42)"/>
      <SettingRow label="Clear local cache" sub="Reset locally stored data" right={<span style={{fontSize:12,color:"#EF4444",fontWeight:600}}>Clear</span>}/>
      <SettingRow label="Force sync" sub="Re-fetch all data from Supabase" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SectionHeader label="Experimental"/>
      <SettingRow label="AI meal scanner" sub="Use camera to identify foods" right={<span style={{fontSize:10,fontWeight:700,color:T.accent,background:T.accentPill,padding:"2px 7px",borderRadius:10}}>BETA</span>}/>
      <SettingRow label="Smart workout suggestions" sub="Auto-plan based on recovery data" right={<span style={{fontSize:10,fontWeight:700,color:T.accent,background:T.accentPill,padding:"2px 7px",borderRadius:10}}>BETA</span>}/>
    </>);
  };
  return(
    <div style={{position:"fixed",inset:0,zIndex:310,background:T.bg,display:"flex",flexDirection:"column",animation:"slideInRight 0.22s cubic-bezier(.4,0,.2,1)"}}>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <div style={{background:T.card,borderBottom:("1px solid "+T.border),padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <div onClick={onBack} style={{width:34,height:34,borderRadius:"50%",background:T.surface,border:("1px solid "+T.border),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><polyline points="8,2 2,8 8,14" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{fontSize:17,fontWeight:700,color:T.text}}>Settings</div>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{width:140,borderRight:("1px solid "+T.border),background:T.card,display:"flex",flexDirection:"column",gap:2,padding:"12px 0",flexShrink:0,overflowY:"auto"}}>
          {navItems.map(n=>(
            <div key={n.id} onClick={()=>setSection(n.id)} style={{padding:"11px 16px",fontSize:13,fontWeight:section===n.id?700:400,color:section===n.id?T.accent:T.text,background:section===n.id?T.accentPill:"transparent",borderRight:section===n.id?("3px solid "+T.accent):"3px solid transparent",cursor:"pointer",transition:"all 0.12s"}}>{n.label}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>{renderSection()}</div>
      </div>
    </div>
  );
}

// ── PROFILE PAGE ──────────────────────────────────────────────────
function ProfilePage({goals,setGoals,userName,setUserName,isDark,setIsDark,themeFam,logWeight,onSignOut,onClose}){
  const T=useTheme();
  const [name,setName]=useState(userName||"");
  const [calGoal,setCalGoal]=useState(String(goals?.cal||2200));
  const [protGoal,setProtGoal]=useState(String(goals?.protein||140));
  const [carbGoal,setCarbGoal]=useState(String(goals?.carbs||180));
  const [fatGoal,setFatGoal]=useState(String(goals?.fat||78));
  // Body stats — loaded from Supabase on mount
  const [gender,setGender]=useState("male");
  const [age,setAge]=useState("");
  const [weightLbs,setWeightLbs]=useState("");
  const [heightFt,setHeightFt]=useState("5");
  const [heightIn,setHeightIn]=useState("9");
  const [activity,setActivity]=useState("moderate");
  const [goalRate,setGoalRate]=useState("maintain");
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const initials=name?name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";

  const ACTIVITY_LABELS={
    bmr:"BMR only",sedentary:"Little/no exercise",light:"1–3×/week",
    moderate:"3–5×/week",active:"Daily intense",very_active:"6–7×/week",extremely:"Physical job daily",
  };
  const ACTIVITY_MULTS={bmr:1.0,sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9,extremely:2.0};

  useEffect(()=>{
    const load=async()=>{
      const uid=sb.getUser()?.id;
      if(!uid)return;
      const rows=await sb.select("profiles","id=eq."+uid);
      if(rows?.length>0){
        const p=rows[0];
        if(p.gender)setGender(p.gender);
        if(p.age)setAge(String(p.age));
        if(p.weight_lbs)setWeightLbs(String(p.weight_lbs));
        if(p.height_in){const ft=Math.floor(p.height_in/12);setHeightFt(String(ft));setHeightIn(String(p.height_in%12));}
        if(p.activity_level)setActivity(p.activity_level);
        if(p.goal_rate)setGoalRate(p.goal_rate);
        else if(p.goal)setGoalRate(p.goal==="lose"?"lose_1":p.goal==="gain"?"gain_0.5":"maintain");
      }
    };
    load();
  },[]);

  // Live TDEE calc
  const calcTDEE=()=>{
    const w=parseFloat(weightLbs)||0;const h=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);const a=parseInt(age)||25;
    if(!w)return null;
    const wKg=w*0.453592;const hCm=h*2.54;
    const bmrVal=gender==="male"
      ?(13.397*wKg)+(4.799*hCm)-(5.677*a)+88.362
      :(9.247*wKg)+(3.098*hCm)-(4.330*a)+447.593;
    const tdee=Math.round(bmrVal*(ACTIVITY_MULTS[activity]||1.55));
    const cal=calcCalFromRate(tdee,goalRate);
    return{bmr:Math.round(bmrVal),tdee,cal};
  };
  const tdeeData=calcTDEE();

  // Auto-update calorie & macro inputs whenever body stats change
  useEffect(()=>{
    if(!tdeeData)return;
    setCalGoal(String(tdeeData.cal));
    const w=parseFloat(weightLbs)||0;
    if(w>0){
      const protein=Math.round(w*0.82);
      const fat=Math.round(tdeeData.cal*0.25/9);
      const carbs=Math.max(Math.round((tdeeData.cal-protein*4-fat*9)/4),50);
      setProtGoal(String(protein));
      setCarbGoal(String(carbs));
      setFatGoal(String(fat));
    }
  },[weightLbs,heightFt,heightIn,age,gender,activity,goalRate]);

  const save=async()=>{
    setSaving(true);
    const uid=sb.getUser()?.id;
    const g={cal:parseInt(calGoal)||2200,protein:parseInt(protGoal)||140,carbs:parseInt(carbGoal)||180,fat:parseInt(fatGoal)||78};
    const hin=(parseInt(heightFt)||5)*12+(parseInt(heightIn)||9);
    if(uid)await sb.upsert("profiles",{id:uid,name:name.trim()||userName,gender,age:parseInt(age)||null,weight_lbs:parseFloat(weightLbs)||null,height_in:hin,activity_level:activity,goal_rate:goalRate,cal_goal:g.cal,protein_goal:g.protein,carbs_goal:g.carbs,fat_goal:g.fat,theme:themeFam+"_"+(isDark?"dark":"light"),bmr:tdeeData?.bmr||null,tdee:tdeeData?.tdee||null,updated_at:new Date().toISOString()});
    // profiles.weight_lbs is only "current weight" — record the day's entry in
    // body_weight_log too, or the weight chart never accumulates history.
    const wl=parseFloat(weightLbs);
    if(logWeight&&Number.isFinite(wl)&&wl>0)await logWeight(wl);
    setUserName(name.trim()||userName);setGoals(g);
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  const inp=(val,set,ph,type="text",extra={})=>(
    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
      style={{background:T.surface,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"11px 14px",fontSize:14,outline:"none",...extra}}/>
  );

  return(
    <PageShell title="Profile" onBack={onClose} footer={
      <button onClick={save} disabled={saving} style={{width:"100%",background:saved?"#22C55E":saving?T.muted:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:saving?"not-allowed":"pointer",transition:"background 0.2s"}}>{saved?"Saved ✓":saving?"Saving...":"Save changes"}</button>
    }>
      {/* Banner */}
      <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),padding:"28px 20px 24px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:22,fontWeight:700,boxShadow:("0 4px 16px "+T.accentGlow),flexShrink:0}}>{initials}</div>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:"#fff"}}>{name||"Your name"}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginTop:3}}>{sb.getUser()?.email||"Not signed in"}</div>
          <div style={{fontSize:12,color:T.accent,fontWeight:600,marginTop:4,background:"rgba(255,255,255,0.1)",display:"inline-block",padding:"2px 10px",borderRadius:20}}>Plus</div>
        </div>
      </div>

      {/* Personal */}
      <SectionHeader label="Personal info"/>
      <div style={{padding:"0 20px 4px"}}>
        <div style={{fontSize:12,color:T.muted,marginBottom:6}}>Display name</div>
        {inp(name,setName,"Your name","text",{width:"100%",boxSizing:"border-box"})}
      </div>
      <div style={{padding:"12px 20px 4px",display:"flex",gap:10}}>
        {[["male","♂ Male"],["female","♀ Female"]].map(([v,l])=>(
          <div key={v} onClick={()=>setGender(v)} style={{flex:1,padding:"10px",borderRadius:10,textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:600,background:gender===v?T.accentPill:T.surface,border:("1.5px solid "+gender===v?T.accent:T.border),color:gender===v?T.accent:T.muted}}>{l}</div>
        ))}
      </div>
      <div style={{padding:"10px 20px",display:"flex",gap:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:T.muted,marginBottom:5}}>Age</div>
          {inp(age,setAge,"25","number",{width:"100%",boxSizing:"border-box"})}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:T.muted,marginBottom:5}}>Weight (lbs)</div>
          {inp(weightLbs,setWeightLbs,"165","number",{width:"100%",boxSizing:"border-box"})}
        </div>
      </div>
      <div style={{padding:"0 20px 4px"}}>
        <div style={{fontSize:11,color:T.muted,marginBottom:5}}>Height</div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1,position:"relative"}}>
            {inp(heightFt,setHeightFt,"5","number",{width:"100%",boxSizing:"border-box",paddingRight:28})}
            <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:T.muted}}>ft</div>
          </div>
          <div style={{flex:1,position:"relative"}}>
            {inp(heightIn,setHeightIn,"9","number",{width:"100%",boxSizing:"border-box",paddingRight:28})}
            <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:T.muted}}>in</div>
          </div>
        </div>
      </div>

      {/* Activity + Goal */}
      <SectionHeader label="Activity & goal"/>
      <div style={{padding:"0 20px 4px"}}>
        <div style={{fontSize:11,color:T.muted,marginBottom:6}}>Activity level</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[["sedentary","Little/no exercise"],["light","1–3×/week"],["moderate","3–5×/week"],["active","Daily intense exercise"],["very_active","6–7×/week intense"],["extremely","Physical job + daily training"]].map(([v,l])=>(
            <div key={v} onClick={()=>setActivity(v)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,cursor:"pointer",background:activity===v?T.accentPill:T.surface,border:("1.5px solid "+activity===v?T.accent:T.border)}}>
              <div style={{width:16,height:16,borderRadius:"50%",border:("2px solid "+activity===v?T.accent:T.muted),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {activity===v&&<div style={{width:8,height:8,borderRadius:"50%",background:T.accent}}/>}
              </div>
              <div style={{fontSize:13,color:activity===v?T.accent:T.text,fontWeight:activity===v?600:400}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"0 20px 8px"}}>
        <div style={{fontSize:11,color:T.muted,marginBottom:8}}>Goal</div>
        <GoalRatePicker rate={goalRate} setRate={setGoalRate} tdee={tdeeData?.tdee||0}/>
      </div>

      {/* TDEE preview */}
      {tdeeData&&(
        <div style={{margin:"12px 20px 0",background:T.surface,border:("1px solid "+T.border),borderRadius:12,overflow:"hidden"}}>
          {[["BMR",tdeeData.bmr.toLocaleString()+" kcal/day","Calories at complete rest"],["TDEE",tdeeData.tdee.toLocaleString()+" kcal/day","Maintenance with your activity"],["Target",tdeeData.cal.toLocaleString()+" kcal/day","Your adjusted daily goal"]].map(([l,v,sub],i,arr)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:i<arr.length-1?"1px solid "+T.border:"none"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>{l}</div><div style={{fontSize:11,color:T.muted}}>{sub}</div></div>
              <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Nutrition goals */}
      <SectionHeader label="Daily nutrition goals"/>
      <div style={{padding:"0 20px",display:"flex",flexDirection:"column",gap:10}}>
        {[["Calories",calGoal,setCalGoal,"kcal"],["Protein",protGoal,setProtGoal,"g"],["Carbs",carbGoal,setCarbGoal,"g"],["Fat",fatGoal,setFatGoal,"g"]].map(([label,val,set,unit])=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:13,color:T.text,width:72,flexShrink:0}}>{label}</div>
            <input type="number" value={val} onChange={e=>set(e.target.value)} style={{flex:1,background:T.surface,color:T.text,border:("1px solid "+T.border),borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}/>
            <div style={{fontSize:12,color:T.muted,width:28,flexShrink:0}}>{unit}</div>
          </div>
        ))}
      </div>

      {/* Account */}
      <SectionHeader label="Account"/>
      {[["Email",sb.getUser()?.email||"—"],["Member since","May 2026"]].map(([l,v])=>(
        <SettingRow key={l} label={l} right={<span style={{fontSize:13,color:T.muted}}>{v}</span>}/>
      ))}
      <div style={{padding:"12px 20px 0"}}>
        <div onClick={onSignOut} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:12,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:8}}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"><path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3"/><polyline points="11 11 14 8 11 5"/><line x1="14" y1="8" x2="6" y2="8"/></svg>
          <div style={{fontSize:14,fontWeight:600,color:"#EF4444"}}>Sign out</div>
        </div>
      </div>
    </PageShell>
  );
}

// ── PERSONALIZATION PAGE ──────────────────────────────────────────
const THEME_FAMILIES=[
  {id:"aurora", name:"Aurora",     darkBg:"#020B18", lightBg:"#F8F9FC", darkAccent:"#06B6D4", lightAccent:"#4F46E5", darkDesc:"Midnight Teal",   lightDesc:"Clean Indigo"},
  {id:"forest", name:"Forest",     darkBg:"#040D07", lightBg:"#F0FAF5", darkAccent:"#10B981", lightAccent:"#059669", darkDesc:"Deep Emerald",    lightDesc:"Fresh Sage"},
  {id:"ember",  name:"Ember",      darkBg:"#0F0700", lightBg:"#FFFBF0", darkAccent:"#F59E0B", lightAccent:"#D97706", darkDesc:"Warm Amber",      lightDesc:"Golden Hour"},
  {id:"rose",   name:"Rose",       darkBg:"#0D0409", lightBg:"#FFF5FA", darkAccent:"#EC4899", lightAccent:"#DB2777", darkDesc:"Midnight Blush",  lightDesc:"Soft Petal"},
  {id:"obsidian",name:"Obsidian",  darkBg:"#09090F", lightBg:"#F8F7FF", darkAccent:"#8B5CF6", lightAccent:"#7C3AED", darkDesc:"Dark Violet",    lightDesc:"Crisp Lavender"},
];

function PersonalizationPage({onBack,isDark,themeFam,setThemeFam}){
  const T=useTheme();
  const [fitnessGoal,setFitnessGoal]=useState("build_muscle");
  const [activityLevel,setActivityLevel]=useState("moderate");
  const [experience,setExperience]=useState("intermediate");
  const [focusAreas,setFocusAreas]=useState(["chest","back","legs"]);
  const [aiTone,setAiTone]=useState("motivational");
  const [pendingFam,setPendingFam]=useState(themeFam);
  const [saved,setSaved]=useState(false);

  const handleSave=()=>{setThemeFam(pendingFam);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const toggleFocus=f=>setFocusAreas(p=>p.includes(f)?p.filter(x=>x!==f):[...p,f]);

  return(
    <PageShell title="Personalization" onBack={onBack}>

      {/* ── THEME SECTION ── */}
      <SectionHeader label="App theme"/>
      <div style={{padding:"0 16px 8px"}}>
        <div style={{fontSize:12,color:T.muted,marginBottom:12}}>
          Choose a colour family. The dark/light variant follows your Dark Mode toggle in Settings.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {THEME_FAMILIES.map(tf=>{
            const isActive=pendingFam===tf.id;
            const darkTh=THEMES[tf.id+"_dark"];
            const lightTh=THEMES[tf.id+"_light"];
            return(
              <div key={tf.id} onClick={()=>setPendingFam(tf.id)}
                style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"12px 14px",borderRadius:14,cursor:"pointer",
                  border:("2px solid "+isActive?T.accent:T.border),
                  background:isActive?T.accentPill:T.surface,
                  transition:"all 0.15s",
                }}>
                {/* Dark swatch */}
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <div style={{width:42,height:42,borderRadius:10,background:darkTh.bg,border:("1.5px solid "+darkTh.border),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",top:6,left:6,right:6,height:8,borderRadius:2,background:darkTh.accent,opacity:0.9}}/>
                    <div style={{position:"absolute",bottom:6,left:6,right:6,display:"flex",gap:2}}>
                      {darkTh.macro.slice(0,3).map((c,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:c}}/>)}
                    </div>
                  </div>
                  {/* Light swatch */}
                  <div style={{width:42,height:42,borderRadius:10,background:lightTh.bg,border:("1.5px solid "+lightTh.border),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",top:6,left:6,right:6,height:8,borderRadius:2,background:lightTh.accent,opacity:0.9}}/>
                    <div style={{position:"absolute",bottom:6,left:6,right:6,display:"flex",gap:2}}>
                      {lightTh.macro.slice(0,3).map((c,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:c}}/>)}
                    </div>
                  </div>
                </div>
                {/* Labels */}
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:isActive?T.accent:T.text}}>{tf.name}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                    <span style={{color:darkTh.accent}}>●</span> {tf.darkDesc} &nbsp;·&nbsp;
                    <span style={{color:lightTh.accent}}>●</span> {tf.lightDesc}
                  </div>
                </div>
                {isActive&&(
                  <svg width="18" height="18" viewBox="0 0 18 18" style={{flexShrink:0}}>
                    <circle cx="9" cy="9" r="8" fill={T.accent}/>
                    <polyline points="4.5,9 7.5,12 13.5,6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        {pendingFam!==themeFam&&(
          <button onClick={handleSave} style={{width:"100%",marginTop:14,background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:12,padding:"13px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:("0 4px 16px "+T.accentGlow)}}>
            Apply {THEME_FAMILIES.find(f=>f.id===pendingFam)?.name} theme
          </button>
        )}
        {saved&&<div style={{textAlign:"center",fontSize:13,color:T.green,marginTop:8,fontWeight:600}}>✓ Theme applied!</div>}
      </div>

      {/* ── REST OF PERSONALIZATION ── */}
      <SectionHeader label="Primary fitness goal"/>
      {[["build_muscle","Build muscle","Hypertrophy-focused programming"],["lose_fat","Lose fat","Caloric deficit with cardio"],["maintain","Maintain and tone","Recomp at maintenance calories"],["performance","Athletic performance","Sport-specific strength and conditioning"]].map(([val,label,sub])=>(
        <div key={val} onClick={()=>setFitnessGoal(val)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",borderBottom:("1px solid "+T.border),cursor:"pointer",background:fitnessGoal===val?T.accentPill:"transparent"}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:fitnessGoal===val?T.accent:T.text}}>{label}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
          {fitnessGoal===val&&<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={T.accent}/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        </div>
      ))}
      <SectionHeader label="Activity level"/>
      {[["sedentary","Sedentary","Desk job, little movement"],["light","Lightly active","1-3 workouts/week"],["moderate","Moderately active","3-5 workouts/week"],["very","Very active","6+ workouts/week"]].map(([val,label,sub])=>(
        <div key={val} onClick={()=>setActivityLevel(val)} style={{display:"flex",alignItems:"center",padding:"13px 20px",borderBottom:("1px solid "+T.border),cursor:"pointer",gap:14,background:activityLevel===val?T.accentPill:"transparent"}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:activityLevel===val?T.accent:T.text}}>{label}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
          {activityLevel===val&&<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={T.accent}/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        </div>
      ))}
      <SectionHeader label="Training experience"/>
      <div style={{display:"flex",gap:10,padding:"4px 20px 16px"}}>
        {[["beginner","Beginner"],["intermediate","Intermediate"],["advanced","Advanced"]].map(([val,label])=>(
          <div key={val} onClick={()=>setExperience(val)} style={{flex:1,padding:"10px 6px",borderRadius:12,textAlign:"center",fontSize:12,fontWeight:600,cursor:"pointer",border:("1.5px solid "+experience===val?T.accent:T.border),background:experience===val?T.accentPill:"transparent",color:experience===val?T.accent:T.muted}}>{label}</div>
        ))}
      </div>
      <SectionHeader label="Focus muscle groups"/>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"4px 20px 20px"}}>
        {["Chest","Back","Shoulders","Arms","Core","Legs","Glutes","Cardio"].map(f=>{
          const key=f.toLowerCase();const on=focusAreas.includes(key);
          return <div key={key} onClick={()=>toggleFocus(key)} style={{padding:"8px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:("1.5px solid "+on?T.accent:T.border),background:on?T.accentPill:"transparent",color:on?T.accent:T.muted}}>{f}</div>;
        })}
      </div>
      <SectionHeader label="AI Coach tone"/>
      {[["motivational","Motivational","Hype, push-you-hard energy"],["calm","Calm and supportive","Steady, science-based guidance"],["technical","Technical","Detailed breakdowns and data"]].map(([val,label,sub])=>(
        <div key={val} onClick={()=>setAiTone(val)} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",borderBottom:("1px solid "+T.border),cursor:"pointer",background:aiTone===val?T.accentPill:"transparent"}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:aiTone===val?T.accent:T.text}}>{label}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
          {aiTone===val&&<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={T.accent}/><polyline points="4,8 7,11 12,5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
        </div>
      ))}
    </PageShell>
  );
}

// ── UPGRADE PAGE ──────────────────────────────────────────────────
function UpgradePage({onBack}){
  const T=useTheme();
  const [billing,setBilling]=useState("annual");
  const features=[["Unlimited AI Coach","No message limits, full workout planning"],["Advanced analytics","Trends, PRs, body comp tracking"],["Workout periodization","Auto-progressive overload plans"],["Wearable sync","Apple Watch, Garmin, WHOOP"],["Full meal planning","Week plans generated by AI"],["Supplement optimizer","Personalised stack recommendations"]];
  return(
    <PageShell title="Upgrade to Plus" onBack={onBack} footer={
      <button style={{width:"100%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",border:"none",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:("0 6px 20px "+T.accentGlow)}}>
        {billing==="annual"?"Start Plus — $5.99/mo (billed annually)":"Start Plus — $9.99/month"}
      </button>
    }>
      <div style={{background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")"),padding:"28px 20px 24px",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:6}}>&#11088;</div>
        <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>WiFit Plus</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.55)",marginTop:6}}>Unlock every feature. Train smarter.</div>
      </div>
      <div style={{display:"flex",gap:10,padding:"18px 20px 8px"}}>
        {[["annual","Annual — Save 40%"],["monthly","Monthly"]].map(([val,label])=>(
          <div key={val} onClick={()=>setBilling(val)} style={{flex:1,padding:"11px 10px",borderRadius:12,textAlign:"center",fontSize:13,fontWeight:600,cursor:"pointer",border:("2px solid "+billing===val?T.accent:T.border),background:billing===val?T.accentPill:"transparent",color:billing===val?T.accent:T.muted}}>{label}</div>
        ))}
      </div>
      <div style={{padding:"8px 20px 20px"}}>
        <div style={{background:T.surface,borderRadius:14,border:("1px solid "+T.border),overflow:"hidden"}}>
          {features.map(([label,sub],i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:i<features.length-1?"1px solid "+T.border:"none"}}>
              <svg width="14" height="14" viewBox="0 0 14 14" style={{flexShrink:0}}><circle cx="7" cy="7" r="6" fill={T.accent}/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:T.text}}>{label}</div><div style={{fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

// ── HELP PAGE ─────────────────────────────────────────────────────
function HelpPage({onBack}){
  const T=useTheme();
  const [openFaq,setOpenFaq]=useState(null);
  const faqs=[
    ["How do I log food?","Tap the Food tab or use Quick Add in the nav bar. Search the USDA database or add custom foods. You can also tell your AI Coach what you ate and it will log it."],
    ["How does the AI Coach work?","The AI Coach is powered by Claude by Anthropic. It can answer fitness and nutrition questions, log food for you, and create full workout plans. Just describe what you need."],
    ["Can I sync with Apple Health?","Apple Health sync is coming in a future update. For now, manually log workouts and food directly in WiFit."],
    ["How do I track a workout?","Go to the Train tab, select a plan, and tap Start. Log your sets and reps live. When done, finish the session and it will appear in your history and on the Calendar."],
    ["How is my calorie goal calculated?","Your calorie goal is set in Profile. The default is 2,200 kcal. Adjust it to match your TDEE based on your activity level and goal."],
    ["Why is my Calendar not showing data?","The Calendar reflects food logged, workouts completed, and supplements taken. Make sure you are marking supplements taken in the Supps tab."],
  ];
  return(
    <PageShell title="Help and Support" onBack={onBack}>
      <div style={{padding:"20px 20px 16px",background:("linear-gradient(135deg,"+T.bannerFrom+","+T.bannerTo+")")}}>
        <div style={{fontSize:18,fontWeight:700,color:"#fff",marginBottom:4}}>How can we help?</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.55)"}}>Find answers or get in touch with our team.</div>
      </div>
      <SectionHeader label="Quick actions"/>
      <SettingRow label="Chat with support" sub="Average response time: 2 hours" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Email us" sub="support@wifit.app" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SettingRow label="Documentation" sub="Full guide to all features" right={<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}/>
      <SectionHeader label="Frequently asked questions"/>
      {faqs.map(([q,a],i)=>(
        <div key={i} style={{borderBottom:("1px solid "+T.border)}}>
          <div onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{display:"flex",alignItems:"center",padding:"14px 20px",cursor:"pointer",gap:12}}>
            <div style={{flex:1,fontSize:14,fontWeight:500,color:T.text}}>{q}</div>
            <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:openFaq===i?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}><polyline points="1,3 6,9 11,3" stroke={T.muted} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
          </div>
          {openFaq===i&&<div style={{padding:"0 20px 16px",fontSize:13,color:T.muted,lineHeight:1.6}}>{a}</div>}
        </div>
      ))}
      <div style={{padding:"20px 20px 40px",textAlign:"center"}}>
        <div style={{fontSize:12,color:T.muted}}>WiFit v1.0.0 — Made with love for fitness lovers</div>
      </div>
    </PageShell>
  );
}

// ── PROFILE MENU (bottom sheet) ───────────────────────────────────
// ── THEME PICKER ──────────────────────────────────────────────────
function ProfileMenu({userName,isDark,onClose,onOpenProfile,onOpenSettings,onOpenPersonalization,onOpenUpgrade,onOpenHelp,onSignOut}){
  const T=useTheme();
  const initials=userName?userName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";
  const rows=[
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><path d="M9 1l2 5h5l-4 3 1.5 5L9 11l-4.5 3L6 9 2 6h5z"/></svg>,label:"Upgrade plan",action:onOpenUpgrade,chevron:true},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M9 5v4l3 2"/></svg>,label:"Personalization",action:onOpenPersonalization,chevron:false},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="6" r="3"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>,label:"Profile",action:onOpenProfile,chevron:false},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="9" r="3"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.2 3.2l1.4 1.4M13.4 13.4l1.4 1.4M3.2 14.8l1.4-1.4M13.4 4.6l1.4-1.4"/></svg>,label:"Settings",action:onOpenSettings,chevron:false},
    {divider:true},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={T.text} strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M9 6v3"/><circle cx="9" cy="13" r="0.5" fill={T.text}/></svg>,label:"Help",action:onOpenHelp,chevron:true},
    {icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"><path d="M7 16H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3"/><polyline points="12 13 16 9 12 5" stroke="#EF4444"/><line x1="16" y1="9" x2="7" y2="9" stroke="#EF4444"/></svg>,label:"Log out",action:onSignOut,chevron:false,red:true},
  ];
  return(
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(6px)"}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:T.card,borderRadius:"24px 24px 0 0",paddingBottom:34,boxShadow:"0 -8px 40px rgba(0,0,0,0.35)",border:("1px solid "+T.border),borderBottom:"none",animation:"slideUp 0.22s cubic-bezier(.4,0,.2,1)"}}>
        <div style={{display:"flex",justifyContent:"center",paddingTop:10,paddingBottom:4}}>
          <div style={{width:36,height:4,borderRadius:2,background:T.border}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px 14px",borderBottom:("1px solid "+T.border),cursor:"pointer"}} onClick={onOpenProfile}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,fontWeight:700,boxShadow:("0 3px 12px "+T.accentGlow),flexShrink:0}}>{initials}</div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:T.text}}>{userName||"User"}</div>
              <div style={{fontSize:12,color:T.accent,fontWeight:600,marginTop:1}}>Plus</div>
            </div>
          </div>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><polyline points="2,2 8,8 2,14" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round"/></svg>
        </div>
        <div style={{padding:"8px 0"}}>
          {rows.map((r,i)=>{
            if(r.divider)return <div key={i} style={{height:1,background:T.border,margin:"6px 0"}}/>;
            return(
              <div key={i} onClick={r.action||undefined} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",cursor:r.action?"pointer":"default",transition:"background 0.1s"}}
                onMouseEnter={e=>r.action&&(e.currentTarget.style.background=T.surface)}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{width:28,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{r.icon}</div>
                <div style={{flex:1,fontSize:15,fontWeight:500,color:r.red?"#EF4444":T.text}}>{r.label}</div>
                {r.chevron&&<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><polyline points="1,1 7,7 1,13" stroke={T.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


const NAV_LEFT=[
  ["home","Home",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8.5L10 2L18 8.5V18H13V13H7V18H2V8.5Z"/></svg>],
  ["food","Food",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3"/></svg>],
];
const NAV_RIGHT=[
  ["workout","Train",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="8" width="3" height="4" rx="1"/><rect x="16" y="8" width="3" height="4" rx="1"/><rect x="4" y="6" width="3" height="8" rx="1"/><rect x="13" y="6" width="3" height="8" rx="1"/><line x1="7" y1="10" x2="13" y2="10"/></svg>],
  ["supps","Supps",<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="10" cy="6" rx="5" ry="4"/><path d="M5 6s-1 3-1 6c0 3 2.5 5 6 5s6-2 6-5c0-3-1-6-1-6"/><line x1="5" y1="10" x2="15" y2="10"/></svg>],
];
const INITIAL_SUPPS=[
  {k:"a",name:"Whey Protein",sub:"30g · Post-workout",dot:"#A855F7"},
  {k:"b",name:"Creatine",sub:"5g · With breakfast",dot:"#06B6D4"},
  {k:"c",name:"Vitamin D3",sub:"2000 IU · Morning",dot:"#F59E0B"},
  {k:"d",name:"Omega-3",sub:"1000mg · With dinner",dot:"#10B981"},
  {k:"e",name:"Magnesium",sub:"400mg · Before bed",dot:"#F97316"},
  {k:"f",name:"Zinc",sub:"30mg · Before bed",dot:"#10B981"},
];

// ── PROGRESS PAGE ──────────────────────────────────────────────────
function ProgressPage({uid,goals,suppList=[],userName,log={},suppTaken={},workoutHistory=[],waterOz=0,weightLog=[],logWeight,onProfileOpen}){
  const T=useTheme();
  const [range,setRange]=useState("30d");
  const [dailyData,setDailyData]=useState([]);
  const [loading,setLoading]=useState(true);
  const [newWeight,setNewWeight]=useState("");
  const [savingWeight,setSavingWeight]=useState(false);

  const dayCount=range==="7d"?7:range==="30d"?30:90;

  useEffect(()=>{
    let cancel=false;
    (async()=>{
      setLoading(true);
      const today=new Date();
      const start=new Date();
      start.setDate(today.getDate()-(dayCount-1));
      const fmt=(d)=>localDate(d);
      const startStr=fmt(start);
      const endStr=fmt(today);
      try{
        const [foodRows,workoutRows,suppRows]=await Promise.all([
          uid?sb.select("food_log","user_id=eq."+uid+"&logged_date=gte."+startStr+"&logged_date=lte."+endStr,{limit:1000}):[],
          uid?sb.select("workout_sessions","user_id=eq."+uid+"&completed_date=gte."+startStr+"&completed_date=lte."+endStr,{limit:200}):[],
          uid?sb.select("supplement_log","user_id=eq."+uid+"&log_date=gte."+startStr+"&log_date=lte."+endStr+"&taken=eq.true",{limit:500}):[],
        ]);
        if(cancel)return;
        // Build per-day buckets
        const days=[];
        for(let i=dayCount-1;i>=0;i--){
          const d=new Date();d.setDate(today.getDate()-i);
          const key=fmt(d);
          days.push({date:key,label:d.toLocaleDateString("en-US",{month:"numeric",day:"numeric"}),
            cal:0,protein:0,carbs:0,fat:0,workoutDone:false,workoutName:"",suppCount:0,prs:[],weight:null});
        }
        // Map foods
        (foodRows||[]).forEach(r=>{
          const day=days.find(d=>d.date===r.logged_date);
          if(day){
            day.cal+=Math.round((r.per100_cal||0)*(r.grams||0)/100);
            day.protein+=Math.round((r.per100_protein||0)*(r.grams||0)/100);
            day.carbs+=Math.round((r.per100_carbs||0)*(r.grams||0)/100);
            day.fat+=Math.round((r.per100_fat||0)*(r.grams||0)/100);
          }
        });
        // Map workouts
        (workoutRows||[]).forEach(r=>{
          const day=days.find(d=>d.date===r.completed_date);
          if(day){
            day.workoutDone=true;
            day.workoutName=r.workout_name||"";
            if(Array.isArray(r.prs))day.prs=r.prs;
          }
        });
        // Map supps
        (suppRows||[]).forEach(r=>{
          const day=days.find(d=>d.date===r.log_date);
          if(day)day.suppCount++;
        });
        // Map weights
        (weightLog||[]).forEach(w=>{
          const day=days.find(d=>d.date===w.date);
          if(day)day.weight=w.lbs;
        });
        setDailyData(days);
      }catch(e){
        setDailyData([]);
      }
      setLoading(false);
    })();
    return()=>{cancel=true;};
  },[uid,range,dayCount,weightLog]);

  // Stats
  const stats=useMemo(()=>{
    const valid=dailyData;
    if(valid.length===0)return null;
    const totalCal=valid.reduce((a,d)=>a+d.cal,0);
    const daysWithCal=valid.filter(d=>d.cal>0).length;
    const avgCal=daysWithCal>0?Math.round(totalCal/daysWithCal):0;
    const workoutDays=valid.filter(d=>d.workoutDone).length;
    const totalSuppsTaken=valid.reduce((a,d)=>a+d.suppCount,0);
    const suppAdherence=suppList.length>0?Math.round((totalSuppsTaken/(suppList.length*dayCount))*100):0;
    // Weight change
    const weighIns=valid.filter(d=>d.weight!==null).map(d=>({date:d.date,lbs:d.weight}));
    let weightChange=null,startW=null,endW=null;
    if(weighIns.length>=2){
      startW=weighIns[0].lbs;
      endW=weighIns[weighIns.length-1].lbs;
      weightChange=endW-startW;
    }
    // Best (biggest) change in calendar month  
    const monthMap={};
    weightLog.forEach(w=>{
      const ym=w.date.slice(0,7);
      if(!monthMap[ym])monthMap[ym]=[];
      monthMap[ym].push(w);
    });
    let bestMonth=null,bestChange=0;
    Object.entries(monthMap).forEach(([ym,arr])=>{
      if(arr.length>=2){
        arr.sort((a,b)=>a.date.localeCompare(b.date));
        const ch=arr[arr.length-1].lbs-arr[0].lbs;
        if(Math.abs(ch)>Math.abs(bestChange)){bestChange=ch;bestMonth=ym;}
      }
    });
    // All PRs in current month
    const thisMonth=localDate().slice(0,7);
    const monthPRs=[];
    valid.forEach(d=>{
      if(d.date.startsWith(thisMonth)&&d.prs&&d.prs.length>0){
        d.prs.forEach(pr=>monthPRs.push({date:d.date,name:typeof pr==="string"?pr:(pr.name||"PR")}));
      }
    });
    return{avgCal,workoutDays,suppAdherence,weightChange,startW,endW,bestMonth,bestChange,monthPRs};
  },[dailyData,suppList.length,dayCount,weightLog]);

  // Chart bounds
  const calMax=Math.max(...dailyData.map(d=>d.cal),goals.cal||2200,1)*1.1;
  const weights=dailyData.filter(d=>d.weight!==null).map(d=>d.weight);
  const wMin=weights.length>0?Math.min(...weights)-2:0;
  const wMax=weights.length>0?Math.max(...weights)+2:1;

  // No local range check: logWeight owns validation (finite, 0<w<=1500) and is
  // the only thing that can explain a rejection to the user. The guard here was
  // both silent and narrower than the owner's — 800 lbs did nothing at all, with
  // no message — and it cleared the input even when the save then failed.
  const handleLogWeight=async()=>{
    if(savingWeight)return;
    setSavingWeight(true);
    const ok=await logWeight(newWeight);
    setSavingWeight(false);
    if(!ok)return; // logWeight already surfaced the reason and rolled back
    setNewWeight("");
  };

  return(
    <div style={{paddingBottom:80,background:T.bg,minHeight:"100vh",fontFamily:"-apple-system,sans-serif"}}>
      {/* Sticky header */}
      <div style={{position:"sticky",top:0,zIndex:50,background:T.bg+"e8",backdropFilter:"blur(20px)",borderBottom:("1px solid "+T.border),padding:"16px 16px 12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,color:T.accentSoft,fontWeight:600,letterSpacing:2,textTransform:"uppercase",opacity:0.8,marginBottom:2}}>Your journey</div>
            <div style={{fontSize:22,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>Progress 📈</div>
          </div>
          {onProfileOpen&&(
            <div onClick={onProfileOpen} style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>{(userName||"U").charAt(0).toUpperCase()}</div>
          )}
        </div>
      </div>

      <div style={{padding:"14px 16px"}}>
        {/* Range toggle */}
        <div style={{display:"flex",gap:6,background:T.surface,padding:4,borderRadius:12,marginBottom:16}}>
          {[["7d","7 Days"],["30d","30 Days"],["90d","90 Days"]].map(([id,label])=>(
            <div key={id} onClick={()=>setRange(id)} style={{flex:1,textAlign:"center",padding:"8px 0",borderRadius:9,cursor:"pointer",background:range===id?"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")":"transparent",color:range===id?"#fff":T.muted,fontSize:12,fontWeight:600,transition:"all 0.2s"}}>{label}</div>
          ))}
        </div>

        {/* Weight quick log */}
        <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:18}}>⚖️</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>Body weight</div>
              <div style={{fontSize:11,color:T.muted}}>{weightLog.length>0?"Last: "+weightLog[weightLog.length-1].lbs+" lbs":"No weigh-ins yet"}</div>
            </div>
            <input type="number" inputMode="decimal" placeholder="lbs" value={newWeight} onChange={e=>setNewWeight(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogWeight()}
              style={{width:70,padding:"8px 10px",background:T.surface,border:("1px solid "+T.border),borderRadius:10,color:T.text,fontSize:13,outline:"none",textAlign:"center"}}/>
            <button onClick={handleLogWeight} disabled={!newWeight||savingWeight} style={{padding:"8px 14px",background:newWeight?"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")":T.surface,border:"none",borderRadius:10,color:newWeight?"#fff":T.muted,fontSize:12,fontWeight:700,cursor:newWeight&&!savingWeight?"pointer":"not-allowed"}}>{savingWeight?"…":"Log"}</button>
          </div>
        </div>

        {loading?(
          <div style={{textAlign:"center",padding:40,color:T.muted,fontSize:13}}>Loading your progress…</div>
        ):(
          <>
            {/* Summary stat cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,boxShadow:T.glowShadow}}>
                <div style={{fontSize:10,fontWeight:600,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Avg calories</div>
                <div style={{fontSize:22,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>{stats?.avgCal||0}</div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>kcal/day · goal {goals.cal||2200}</div>
              </div>
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,boxShadow:T.glowShadow}}>
                <div style={{fontSize:10,fontWeight:600,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Workouts</div>
                <div style={{fontSize:22,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>{stats?.workoutDays||0}<span style={{fontSize:13,color:T.muted}}>/{dayCount}</span></div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>days trained</div>
              </div>
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,boxShadow:T.glowShadow}}>
                <div style={{fontSize:10,fontWeight:600,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Supp adherence</div>
                <div style={{fontSize:22,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>{stats?.suppAdherence||0}<span style={{fontSize:13,color:T.muted}}>%</span></div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>of stack taken</div>
              </div>
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,boxShadow:T.glowShadow}}>
                <div style={{fontSize:10,fontWeight:600,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Weight change</div>
                {stats?.weightChange!==null&&stats?.weightChange!==undefined?(
                  <>
                    <div style={{fontSize:22,fontWeight:700,letterSpacing:"-0.5px",color:stats.weightChange<0?"#22C55E":stats.weightChange>0?"#F59E0B":T.text}}>{stats.weightChange>0?"+":""}{stats.weightChange.toFixed(1)}<span style={{fontSize:13,color:T.muted}}> lbs</span></div>
                    <div style={{fontSize:10,color:T.muted,marginTop:2}}>{stats.startW}→{stats.endW} lbs</div>
                  </>
                ):(
                  <>
                    <div style={{fontSize:22,fontWeight:700,color:T.muted,letterSpacing:"-0.5px"}}>—</div>
                    <div style={{fontSize:10,color:T.muted,marginTop:2}}>Need 2+ weigh-ins</div>
                  </>
                )}
              </div>
            </div>

            {/* Weight trend chart */}
            {weights.length>=2&&(
              <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.text}}>Weight trend</div>
                  <div style={{fontSize:10,color:T.muted}}>{wMin.toFixed(0)}–{wMax.toFixed(0)} lbs</div>
                </div>
                <svg viewBox="0 0 300 100" style={{width:"100%",height:100,display:"block"}}>
                  <polyline fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    points={dailyData.map((d,i)=>{
                      if(d.weight===null)return null;
                      const x=(i/(dailyData.length-1))*290+5;
                      const y=95-((d.weight-wMin)/(wMax-wMin||1))*85;
                      return x+","+y;
                    }).filter(Boolean).join(" ")}/>
                  {dailyData.map((d,i)=>{
                    if(d.weight===null)return null;
                    const x=(i/(dailyData.length-1))*290+5;
                    const y=95-((d.weight-wMin)/(wMax-wMin||1))*85;
                    return <circle key={i} cx={x} cy={y} r="2.5" fill={T.accent}/>;
                  })}
                </svg>
              </div>
            )}

            {/* Calorie bar chart */}
            <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:T.text}}>Calories per day</div>
                <div style={{fontSize:10,color:T.muted}}>Goal: {goals.cal||2200}</div>
              </div>
              <div style={{display:"flex",gap:2,height:80,alignItems:"flex-end"}}>
                {dailyData.map((d,i)=>{
                  const h=calMax>0?(d.cal/calMax)*100:0;
                  const onGoal=d.cal>0&&Math.abs(d.cal-(goals.cal||2200))<=(goals.cal||2200)*0.1;
                  return(
                    <div key={i} title={d.label+": "+d.cal+" kcal"} style={{flex:1,height:"100%",display:"flex",alignItems:"flex-end"}}>
                      <div style={{width:"100%",height:h+"%",background:d.cal===0?T.surface:onGoal?"linear-gradient(180deg,"+T.accent+","+T.accentSoft+")":T.accent+"66",borderRadius:"3px 3px 0 0",minHeight:d.cal>0?2:0,transition:"all 0.2s"}}/>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.muted,marginTop:6}}>
                <div>{dailyData[0]?.label}</div>
                <div>{dailyData[dailyData.length-1]?.label}</div>
              </div>
            </div>

            {/* Workout consistency */}
            <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Training consistency</div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {dailyData.map((d,i)=>(
                  <div key={i} title={d.label+(d.workoutDone?" · "+(d.workoutName||"Trained"):" · Rest")}
                    style={{width:"calc(100%/15 - 3px)",aspectRatio:"1",borderRadius:4,background:d.workoutDone?"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")":T.surface,border:("1px solid "+T.border),boxShadow:d.workoutDone?"0 0 6px "+T.accentGlow:"none"}}/>
                ))}
              </div>
            </div>

            {/* Monthly highlights */}
            <div style={{background:T.card,border:("1px solid "+T.border),borderRadius:14,padding:14,marginBottom:14,boxShadow:T.glowShadow}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>📅 This month's highlights</div>
              {/* Best weight change */}
              {stats?.bestMonth?(
                <div style={{padding:"10px 12px",background:T.surface,borderRadius:10,marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:18}}>{stats.bestChange<0?"📉":"📈"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.text}}>Best weight change</div>
                    <div style={{fontSize:10,color:T.muted}}>{stats.bestMonth} · {stats.bestChange>0?"+":""}{stats.bestChange.toFixed(1)} lbs</div>
                  </div>
                </div>
              ):(
                <div style={{padding:"10px 12px",background:T.surface,borderRadius:10,marginBottom:10,fontSize:11,color:T.muted}}>Log weight regularly to track monthly changes</div>
              )}
              {/* PRs this month */}
              <div style={{fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>🏆 Workout PRs · this month</div>
              {stats?.monthPRs?.length>0?stats.monthPRs.slice(0,5).map((pr,i)=>(
                <div key={i} style={{padding:"8px 12px",background:T.surface,borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{pr.name}</div>
                  <div style={{fontSize:10,color:T.muted}}>{pr.date.slice(5)}</div>
                </div>
              )):(
                <div style={{padding:"10px 12px",background:T.surface,borderRadius:10,fontSize:11,color:T.muted}}>No PRs logged yet this month — keep training!</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────
export default function App(){
  const [authState,setAuthState]=useState("loading");
  const [isDark,setIsDarkState]=useState(true);
  const [themeFam,setThemeFamState]=useState("aurora");
  const T=THEMES[themeFam+"_"+(isDark?"dark":"light")]||THEMES["aurora_dark"];

  const saveTheme=async(fam,dark)=>{
    const uid=sb.getUser()?.id;
    if(!uid)return;
    try{await sb.upsert("profiles",{id:uid,theme:fam+"_"+(dark?"dark":"light"),updated_at:new Date().toISOString()});}catch{}
  };

  const setIsDark=(val)=>{setIsDarkState(val);saveTheme(themeFam,val);};
  const setThemeFam=(val)=>{setThemeFamState(val);saveTheme(val,isDark);};
  const [tab,setTab]=useState("home");
  const [log,setLog]=useState(SEED);
  const [aiOpen,setAiOpen]=useState(false);
  const [quickOpen,setQuickOpen]=useState(false);
  const [customFoods,setCustomFoods]=useState([]);
  const [suppList,setSuppList]=useState([]);
  const [suppTaken,setSuppTaken]=useState({});
  const [waterOz,setWaterOzState]=useState(0);
  const [weightLog,setWeightLog]=useState([]); // [{date:"2026-05-08",lbs:175}]
  const setWaterOz=async(valOrFn)=>{
    const next=typeof valOrFn==="function"?valOrFn(waterOz):valOrFn;
    const clamped=Math.min(GOAL_OZ,Math.max(0,next));
    const prevOz=waterOz;
    setWaterOzState(clamped);
    if(!uid)return;
    try{
      const row=await sb.upsert("water_log",{user_id:uid,log_date:today,oz:clamped},{onConflict:"user_id,log_date"});
      if(!row)throw new Error("upsert returned no row");
    }catch{
      setWaterOzState(prevOz);
      showError("Water couldn't be saved. Check your connection.");
    }
  };
  const [history,setHistory]=useState([]);
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);
  const [profilePageOpen,setProfilePageOpen]=useState(false);
  const [settingsPageOpen,setSettingsPageOpen]=useState(false);
  const [personalizationPageOpen,setPersonalizationPageOpen]=useState(false);
  const [upgradePageOpen,setUpgradePageOpen]=useState(false);
  const [helpPageOpen,setHelpPageOpen]=useState(false);
  const closeAll=()=>{setProfileMenuOpen(false);setProfilePageOpen(false);setSettingsPageOpen(false);setPersonalizationPageOpen(false);setUpgradePageOpen(false);setHelpPageOpen(false);};
  const [userName,setUserName]=useState("");
  const [goals,setGoals]=useState({cal:2200,protein:140,carbs:180,fat:78});

  const today=localDate();

  // Resolve the session to a definite state before any data load runs.
  useEffect(()=>{
    // Lets a mid-session refresh failure inside any sb.* call route to sign-in.
    setAuthLostHandler(()=>setAuthState("auth"));
    (async()=>{
      try{
        const res=await resolveSession();
        if(res.status==="logged-out"||!res.session?.user?.id){setAuthState("auth");return;}
        await loadUserData(res.session.user.id);
      }catch(e){
        // Without this the spinner would hang forever on an unexpected throw.
        console.error("session resolve failed:",e);
        setAuthState("auth");
      }
    })();
  },[]);

  const loadUserData=async(uid)=>{
    // Has identity been established? Decides where the catch below routes: a
    // failure after the profile loaded is a secondary-load problem and the app
    // stays usable; a failure before it means we never learned who this user is,
    // so sign-in — never onboarding, which is the one path that would overwrite
    // a real profile. Shared by both callers (mount and post-sign-in).
    let profileLoaded=false;
    try{
      // selectAuth, not select: select() turns a 401 into [], which reads as
      // "new user" and sends an expired session to the onboarding wizard.
      const {authError,rows:profiles}=await sb.selectAuth("profiles","id=eq."+uid);
      if(authError){setAuthState("auth");return;}
      if(profiles&&profiles.length>0){
        profileLoaded=true;
        const p=profiles[0];
        setUserName(p.name||"");
        setGoals({cal:p.cal_goal||2200,protein:p.protein_goal||140,carbs:p.carbs_goal||180,fat:p.fat_goal||78});
        if(p.theme){
          if(p.theme.includes("_")){
            const parts=p.theme.split("_");
            setThemeFamState(parts[0]);
            setIsDarkState(parts[parts.length-1]==="dark");
          }else{
            setIsDarkState(p.theme!=="light");
          }
        }
        // Food log for today
        const foodRows=await sb.select("food_log","user_id=eq."+uid+"&logged_date=eq."+today);
        if(foodRows?.length>0){
          const nl={breakfast:[],lunch:[],dinner:[],snacks:[]};
          foodRows.forEach(r=>{
            const item={id:r.id,name:r.food_name,grams:r.grams,color:r.color||COLORS[0],per100:{cal:r.per100_cal,protein:r.per100_protein,carbs:r.per100_carbs,fat:r.per100_fat,fiber:r.per100_fiber||0,sugar:r.per100_sugar||0,sodium:r.per100_sodium||0}};
            if(nl[r.meal_slot])nl[r.meal_slot].push(item);
          });
          setLog(nl);
        }
        // Custom foods
        const cf=await sb.select("custom_foods","user_id=eq."+uid,{order:"created_at.desc"});
        if(cf?.length>0)setCustomFoods(cf.map(f=>({name:f.name,brand:f.brand||"My foods",servingG:f.serving_g,servingQty:f.serving_qty,servingUnit:f.serving_unit||"g",isCustom:true,per100:{cal:f.per100_cal,protein:f.per100_protein,carbs:f.per100_carbs,fat:f.per100_fat,fiber:f.per100_fiber||0,sugar:f.per100_sugar||0,sodium:f.per100_sodium||0}})));
        // Supplement stack
        const suppRows=await sb.select("supplement_stack","user_id=eq."+uid,{order:"sort_order.asc"});
        if(suppRows?.length>0){
          setSuppList(suppRows.map(s=>({k:s.id,name:s.name,sub:s.sub||"",dot:s.dot_color||"#888",category:s.category||null,note:s.note||null,reminderTime:s.reminder_time,reminderEnabled:s.reminder_enabled})));
          const suppLog=await sb.select("supplement_log","user_id=eq."+uid+"&log_date=eq."+today);
          const taken={};
          suppRows.forEach(s=>{taken[s.id]=false;});
          if(suppLog?.length>0)suppLog.forEach(l=>{taken[l.supplement_id]=l.taken;});
          setSuppTaken(taken);
        }
        // Workout history
        const sessions=await sb.select("workout_sessions","user_id=eq."+uid,{order:"created_at.desc",limit:20});
        if(sessions?.length>0){
          const ph={};
          sessions.forEach(s=>(s.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(setStr=>{
            const w=parseInt(String(setStr).split("×")[1])||0;
            if(w>0&&w>(ph[ex.name]||0))ph[ex.name]=w;
          })));
          setPrHistory(ph);
          setHistory(sessions.map(s=>({id:s.id,workoutName:s.workout_name,date:s.completed_date,duration:s.duration_secs,setsCompleted:s.sets_completed,totalSets:s.total_sets,exercises:s.exercises||[],prs:s.prs||[]})));
        }
        // Water intake today
        const waterRows=await sb.select("water_log","user_id=eq."+uid+"&log_date=eq."+today);
        if(waterRows?.length>0)setWaterOzState(waterRows[0].oz||0);
        // Weight log (last 30 days)
        const weightRows=await sb.select("body_weight_log","user_id=eq."+uid,{order:"log_date.asc",limit:30});
        if(weightRows?.length>0)setWeightLog(weightRows.map(w=>({date:w.log_date,lbs:w.weight_lbs})));
        // Workout plans
        const planRows=await sb.select("workout_plans","user_id=eq."+uid,{order:"sort_order.asc"});
        if(planRows?.length>0){
          setWorkouts(planRows.map(p=>({
            id:p.id,
            name:p.name,
            tag:p.tag||"Full Body",
            level:p.level||"Intermediate",
            estMin:p.est_min||45,
            scheduledDay:p.scheduled_day||null,
            exercises:p.exercises||[],
          })));
        }
        setAuthState("app");
      }else{
        setAuthState("onboarding");
      }
    }catch(e){
      console.error("loadUserData error:",e);
      setAuthState(profileLoaded?"app":"auth");
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
    // Clear persisted chat
    try{Object.keys(localStorage).filter(k=>k.startsWith("wifit_chat_")).forEach(k=>localStorage.removeItem(k));}catch{}
    setAuthState("auth");
    setLog(SEED);
    setCustomFoods([]);
    setSuppList([]);
    setSuppTaken({});
    setHistory([]);
    setWaterOzState(0);
    setWeightLog([]);
    setUserName("");
    setGoals({cal:2200,protein:140,carbs:180,fat:78});
    setIsDarkState(true);
    setThemeFamState("aurora");
    setWorkouts(INITIAL_WORKOUTS);
    closeAll();
  };

  // DB-synced actions
  const uid=sb.getUser()?.id;

  const addFoodItem=async(slot,item)=>{
    // grams is NOT NULL in food_log, and JSON.stringify drops undefined keys —
    // an unparsed gram amount would 400 instead of saving. Reject it up front.
    const grams=Number(item?.grams);
    if(!item?.name||!item?.per100||!Number.isFinite(grams)||grams<=0){
      showError("Couldn't log "+(item?.name||"that food")+" — no valid gram amount.");
      return;
    }
    if(grams>MAX_FOOD_GRAMS){
      showError("Couldn't log "+item.name+" — "+grams+" g is over the "+MAX_FOOD_GRAMS+" g limit for one entry.");
      return;
    }
    setLog(p=>({...p,[slot]:[...p[slot],item]}));
    if(!uid)return;
    try{
      const row=await sb.insert("food_log",{user_id:uid,logged_date:today,meal_slot:slot,food_name:item.name,brand:item.brand||"",grams,per100_cal:item.per100.cal,per100_protein:item.per100.protein,per100_carbs:item.per100.carbs,per100_fat:item.per100.fat,per100_fiber:item.per100.fiber||0,per100_sugar:item.per100.sugar||0,per100_sodium:item.per100.sodium||0,color:item.color||COLORS[0]});
      if(!row)throw new Error("insert returned no row");
    }catch{
      setLog(p=>({...p,[slot]:p[slot].filter(i=>i!==item)}));
      showError("Food couldn't be saved. Check your connection.");
    }
  };

  const addCustomFoodDB=async(food)=>{
    setCustomFoods(p=>[food,...p]);
    if(!uid)return;
    try{
      await sb.insert("custom_foods",{user_id:uid,name:food.name,brand:food.brand||"",serving_g:food.servingG,serving_qty:food.servingQty??null,serving_unit:food.servingUnit||"g",per100_cal:food.per100.cal,per100_protein:food.per100.protein,per100_carbs:food.per100.carbs,per100_fat:food.per100.fat,per100_fiber:food.per100.fiber||0,per100_sugar:food.per100.sugar||0,per100_sodium:food.per100.sodium||0});
    }catch{
      setCustomFoods(p=>p.filter(f=>f!==food));
      showError("Custom food couldn't be saved. Check your connection.");
    }
  };

  const addSuppToList=async(item)=>{
    const tempK=item.k||("s"+Date.now());
    // Optimistically add with temp key
    setSuppList(prev=>{if(prev.find(s=>s.k===tempK))return prev;return [...prev,{k:tempK,name:item.name,sub:item.sub||"",dot:item.dot||"#888",category:item.category||null,note:item.note||null,reminderEnabled:item.reminderEnabled||false,reminderTime:item.reminderTime||"08:00"}];});
    setSuppTaken(prev=>prev[tempK]!==undefined?prev:{...prev,[tempK]:false});
    if(!uid)return;
    try{
      const row=await sb.insert("supplement_stack",{user_id:uid,name:item.name,sub:item.sub||"",dot_color:item.dot||"#888",category:item.category||null,note:item.note||null,sort_order:suppList.length,reminder_enabled:item.reminderEnabled||false,reminder_time:item.reminderTime||null});
      if(!row)throw new Error("insert returned no row");
      if(row.id&&row.id!==tempK){
        // Replace temp key with real DB id
        setSuppList(prev=>prev.map(s=>s.k===tempK?{...s,k:row.id}:s));
        setSuppTaken(prev=>{const n={...prev};n[row.id]=n[tempK]||false;delete n[tempK];return n;});
      }
    }catch{
      setSuppList(prev=>prev.filter(s=>s.k!==tempK));
      setSuppTaken(prev=>{const n={...prev};delete n[tempK];return n;});
      showError("Supplement couldn't be saved. Check your connection.");
    }
  };

  const toggleSuppTaken=async(k,val)=>{
    setSuppTaken(p=>({...p,[k]:val}));
    if(!uid)return;
    try{
      // UNIQUE is (supplement_id, log_date) — no user_id. Naming user_id here
      // would 42P10, since no unique constraint matches that column set.
      const row=await sb.upsert("supplement_log",{user_id:uid,supplement_id:k,log_date:today,taken:val},{onConflict:"supplement_id,log_date"});
      if(!row)throw new Error("upsert returned no row");
    }catch{
      setSuppTaken(p=>({...p,[k]:!val}));
      showError("Supplement couldn't be updated. Check your connection.");
    }
  };

  const logWeight=async(lbs)=>{
    // weight_lbs is NOT NULL; parseFloat garbage becomes NaN, which JSON
    // serializes as null → swallowed 400. Reject before touching state.
    const w=Number(lbs);
    if(!Number.isFinite(w)||w<=0||w>1500){showError("Couldn't log weight — enter your weight in lbs.");return false;}
    const prevEntry=weightLog.find(e=>e.date===today);
    const entry={date:today,lbs:w};
    setWeightLog(prev=>{const filtered=prev.filter(e=>e.date!==today);return[...filtered,entry].sort((a,b)=>a.date.localeCompare(b.date));});
    if(!uid)return true;
    try{
      const row=await sb.upsert("body_weight_log",{user_id:uid,log_date:today,weight_lbs:w},{onConflict:"user_id,log_date"});
      if(!row)throw new Error("upsert returned no row");
      return true;
    }catch{
      setWeightLog(prev=>{const filtered=prev.filter(e=>e.date!==today);return prevEntry?[...filtered,prevEntry].sort((a,b)=>a.date.localeCompare(b.date)):filtered;});
      showError("Weight couldn't be saved. Check your connection.");
      return false;
    }
  };
  const saveWorkoutSession=async(session)=>{
    // workout_name is NOT NULL — a nameless session would 400 after the
    // optimistic update and look saved.
    const wname=(session?.workoutName||"").trim();
    if(!wname){showError("Couldn't save workout — it has no name.");return;}
    setHistory(p=>[session,...p]);
    setPrHistory(prev=>{
      const updated={...prev};
      (session.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(setStr=>{
        const w=parseInt(String(setStr).split("×")[1])||0;
        if(w>0&&w>(updated[ex.name]||0))updated[ex.name]=w;
      }));
      return updated;
    });
    if(!uid)return;
    try{
      const row=await sb.insert("workout_sessions",{user_id:uid,workout_name:wname,completed_date:today,duration_secs:session.duration,sets_completed:session.setsCompleted,total_sets:session.totalSets,exercises:session.exercises||[],prs:session.prs||[]});
      if(!row)throw new Error("insert returned no row");
    }catch{
      setHistory(p=>p.filter(s=>s!==session));
      showError("Workout couldn't be saved. Check your connection.");
    }
  };

  const [workouts,setWorkouts]=useState(INITIAL_WORKOUTS);
  const [prHistory,setPrHistory]=useState({});
  const [errorBanner,setErrorBanner]=useState("");
  const errorTimerRef=useRef(null);
  const showError=(msg)=>{setErrorBanner(msg);if(errorTimerRef.current)clearTimeout(errorTimerRef.current);errorTimerRef.current=setTimeout(()=>setErrorBanner(""),3000);};

  const addWorkoutPlan=async(plan)=>{
    // AI-generated plans flow through here. name and exercises are NOT NULL —
    // a malformed plan must be rejected visibly, not 400 after the optimistic
    // add and leave a phantom plan on screen.
    const pname=(plan?.name||"").trim();
    const validExs=(Array.isArray(plan?.exercises)?plan.exercises:[]).filter(ex=>ex&&typeof ex.name==="string"&&ex.name.trim());
    if(!pname||validExs.length===0){
      showError("Couldn't add that workout plan — it's missing a name or exercises.");
      return null;
    }
    const tempId="w"+Date.now();
    const structured={
      id:tempId,
      name:pname,
      tag:plan.tag||"Full Body",
      level:plan.level||"Intermediate",
      estMin:plan.estMin||45,
      scheduledDay:plan.scheduledDay||null,
      exercises:validExs.map((ex,i)=>({
        id:"ex"+Date.now()+i,
        name:ex.name,
        sets:Array.from({length:ex.sets||3},()=>({reps:ex.reps||10,weight:ex.weight||0,done:false})),
      })),
    };
    setWorkouts(prev=>[structured,...prev]);
    if(uid){
      try{
        const row=await sb.insert("workout_plans",{
          user_id:uid,name:structured.name,tag:structured.tag,level:structured.level,
          est_min:structured.estMin,scheduled_day:structured.scheduledDay||null,
          exercises:structured.exercises,sort_order:0,
        });
        if(!row)throw new Error("insert returned no row");
        if(row.id)setWorkouts(prev=>prev.map(w=>w.id===tempId?{...w,id:row.id}:w));
      }catch{
        setWorkouts(prev=>prev.filter(w=>w.id!==tempId));
        showError("Workout plan couldn't be saved. Check your connection.");
        return null;
      }
    }
    return structured;
  };

  const saveWorkoutPlanDB=async(plan,isNew)=>{
    if(!uid)return;
    const pname=(plan?.name||"").trim();
    if(!pname||!Array.isArray(plan?.exercises)){
      showError("Couldn't save that workout plan — it's missing a name or exercises.");
      return;
    }
    if(isNew){
      const tempId=plan.id;
      try{
        const row=await sb.insert("workout_plans",{
          user_id:uid,name:pname,tag:plan.tag,level:plan.level,
          est_min:plan.estMin,scheduled_day:plan.scheduledDay||null,
          exercises:plan.exercises,sort_order:workouts.length,
        });
        if(!row)throw new Error("insert returned no row");
        if(row.id)setWorkouts(prev=>prev.map(w=>w.id===tempId?{...w,id:row.id}:w));
      }catch{
        setWorkouts(prev=>prev.filter(w=>w.id!==tempId));
        showError("Workout plan couldn't be saved. Check your connection.");
      }
    }else{
      try{
        const ok=await sb.update("workout_plans",{
          name:pname,tag:plan.tag,level:plan.level,
          est_min:plan.estMin,scheduled_day:plan.scheduledDay||null,
          exercises:plan.exercises,
        },{filter:"id=eq."+plan.id+"&user_id=eq."+uid});
        if(!ok)throw new Error("update failed");
      }catch{
        showError("Workout plan changes couldn't be saved. Check your connection.");
      }
    }
  };

  const deleteWorkoutPlanDB=async(id)=>{
    if(!uid)return;
    try{
      await sb.delete("workout_plans","id=eq."+id+"&user_id=eq."+uid);
    }catch{}
  };

  const taken=suppList.filter(s=>suppTaken[s.k]).length;
  const total=suppList.length;

  // Loading state
  if(authState==="loading")return(
    <ThemeCtx.Provider value={T}>
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"-apple-system,sans-serif"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:("0 8px 28px "+T.accentGlow)}}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M6 14L11 19L22 9"/><circle cx="14" cy="14" r="12"/></svg>
        </div>
        <div style={{fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.5px"}}>WiFit</div>
        <div style={{width:28,height:28,border:("2.5px solid "+T.border),borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
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
      {errorBanner&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:T.red,color:"#fff",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:600,zIndex:999,maxWidth:340,textAlign:"center",boxShadow:"0 4px 20px rgba(0,0,0,0.3)",pointerEvents:"none"}}>{errorBanner}</div>}
      {profileMenuOpen&&<ProfileMenu userName={userName} isDark={isDark} onClose={()=>setProfileMenuOpen(false)} onOpenProfile={()=>{closeAll();setProfilePageOpen(true);}} onOpenSettings={()=>{closeAll();setSettingsPageOpen(true);}} onOpenPersonalization={()=>{closeAll();setPersonalizationPageOpen(true);}} onOpenUpgrade={()=>{closeAll();setUpgradePageOpen(true);}} onOpenHelp={()=>{closeAll();setHelpPageOpen(true);}} onSignOut={handleSignOut}/>}
      {profilePageOpen&&<ProfilePage goals={goals} setGoals={setGoals} userName={userName} setUserName={setUserName} isDark={isDark} setIsDark={setIsDark} themeFam={themeFam} logWeight={logWeight} onSignOut={handleSignOut} onClose={()=>setProfilePageOpen(false)}/>}
      {settingsPageOpen&&<SettingsPage onBack={()=>setSettingsPageOpen(false)} isDark={isDark} setIsDark={setIsDark} onSignOut={handleSignOut} userName={userName}/>}
      {personalizationPageOpen&&<PersonalizationPage onBack={()=>setPersonalizationPageOpen(false)} isDark={isDark} themeFam={themeFam} setThemeFam={setThemeFam}/>}
      {upgradePageOpen&&<UpgradePage onBack={()=>setUpgradePageOpen(false)}/>}
      {helpPageOpen&&<HelpPage onBack={()=>setHelpPageOpen(false)}/>}
      {tab==="home"&&<HomeTab setTab={setTab} log={log} suppList={suppList} suppTaken={suppTaken} workoutHistory={history} isDark={isDark} toggleTheme={()=>setIsDark(d=>!d)} userName={userName} goals={goals} onProfileOpen={()=>setProfileMenuOpen(true)} waterOz={waterOz} setWaterOz={setWaterOz} weightLog={weightLog} logWeight={logWeight}/>}
      {tab==="food"&&<FoodTab log={log} setLog={setLog} uid={uid} customFoods={customFoods} addCustomFood={addCustomFoodDB} onAddItem={addFoodItem} goals={goals} waterOz={waterOz} setWaterOz={setWaterOz}/>}
      {tab==="workout"&&<WorkoutTab workouts={workouts} setWorkouts={setWorkouts} history={history} onSessionComplete={saveWorkoutSession} prHistory={prHistory} setPrHistory={setPrHistory} onSavePlan={saveWorkoutPlanDB} onDeletePlan={deleteWorkoutPlanDB}/>}
      {tab==="supps"&&<SuppsTab suppList={suppList} setSuppList={setSuppList} suppTaken={suppTaken} setSuppTaken={toggleSuppTaken} taken={taken} total={total} uid={uid} addSuppToList={addSuppToList}/>}
      {tab==="calendar"&&<CalendarTab uid={uid} goals={goals} suppList={suppList} userName={userName} log={log} suppTaken={suppTaken} workoutHistory={history} waterOz={waterOz}/>}
      {tab==="progress"&&<ProgressPage uid={uid} goals={goals} suppList={suppList} userName={userName} log={log} suppTaken={suppTaken} workoutHistory={history} waterOz={waterOz} weightLog={weightLog} logWeight={logWeight} onProfileOpen={()=>setProfileMenuOpen(true)}/>}

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:T.navBg,borderTop:("1px solid "+T.border),display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 8px 18px",zIndex:99,transition:"background 0.25s"}}>
        <div style={{display:"flex",flex:1,justifyContent:"space-around"}}>
          {NAV_LEFT.map(([t,label,icon])=>(
            <div key={t} onClick={()=>setTab(t)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",minWidth:44,color:tab===t?T.accent:T.muted}}>
              {icon}<div style={{fontSize:10,fontWeight:500}}>{label}</div>
            </div>
          ))}
        </div>
        <div onClick={()=>setQuickOpen(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",flexShrink:0,margin:"0 4px"}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,"+T.accent+","+T.accentSoft+")",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-24,border:("4px solid "+T.bg),boxSizing:"border-box",boxShadow:("0 4px 16px "+T.accentGlow)}}>
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

      <div onClick={()=>setAiOpen(o=>!o)} style={{position:"fixed",right:aiOpen?"min(298px,80vw)":0,top:"50%",transform:"translateY(-50%)",background:"linear-gradient(180deg,"+T.accent+","+T.accentSoft+")",color:"#fff",borderRadius:"8px 0 0 8px",padding:"14px 7px",cursor:"pointer",zIndex:170,transition:"right 0.3s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column",alignItems:"center",gap:6,boxShadow:"-2px 0 16px "+T.accentGlow}}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" style={{transform:"rotate(90deg)"}}><rect x="1" y="3" width="14" height="10" rx="2"/><circle cx="5" cy="8" r="1.2" fill="white" stroke="none"/><circle cx="11" cy="8" r="1.2" fill="white" stroke="none"/></svg>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.5px",writingMode:"vertical-rl",textOrientation:"mixed",transform:"rotate(180deg)"}}>AI Coach</div>
      </div>

      <AISidePanel open={aiOpen} onClose={()=>setAiOpen(false)} onAddFood={addFoodItem} onAddWorkout={addWorkoutPlan} onAddWater={(oz)=>setWaterOz(w=>Math.min(GOAL_OZ,w+oz))} userName={userName} userId={uid||"demo"}
        liveContext={{
          calConsumed:Object.values(log).flat().reduce((s,item)=>s+Math.round(((item.per100?.cal||0)*(item.grams||0))/100),0),
          calGoal:goals.cal,
          protConsumed:Object.values(log).flat().reduce((s,item)=>s+Math.round(((item.per100?.protein||0)*(item.grams||0))/100),0),
          protGoal:goals.protein,
          carbConsumed:Object.values(log).flat().reduce((s,item)=>s+Math.round(((item.per100?.carbs||0)*(item.grams||0))/100),0),
          carbGoal:goals.carbs,
          fatConsumed:Object.values(log).flat().reduce((s,item)=>s+Math.round(((item.per100?.fat||0)*(item.grams||0))/100),0),
          fatGoal:goals.fat,
          waterOz:waterOz,
          workoutDone:!!history.find(w=>w.date===today),
          suppTaken:suppList.filter(s=>suppTaken[s.k]).length,
          suppTotal:suppList.length,
          suppList:suppList.map(s=>({k:s.k,name:s.name,sub:s.sub})),
          suppTakenMap:suppTaken,
          weightLog:weightLog,
        }}
        onAddSupp={addSuppToList}/>
      <QuickAddPanel open={quickOpen} onClose={()=>setQuickOpen(false)} onAddItem={addFoodItem} suppList={suppList} suppTaken={suppTaken} setSuppTaken={toggleSuppTaken} addSuppToList={addSuppToList} customFoods={customFoods} addCustomFood={addCustomFoodDB} waterOz={waterOz} setWaterOz={setWaterOz}/>
    </div>
    </ThemeCtx.Provider>
  );
}
