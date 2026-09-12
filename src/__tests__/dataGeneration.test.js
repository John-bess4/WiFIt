import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {sb,setDataGenerationLostHandler,observeDataGenerationChange} from "../lib/supabase.js";

const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",other="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}});
const session=()=>({access_token:"synthetic",refresh_token:"synthetic-refresh",user:{id:owner}});
beforeEach(()=>{
  localStorage.clear();sb._session=session();sb._dataContext=null;sb._generationBlocked=false;sb._pageDataGenerations=new Map();
  setDataGenerationLostHandler(null);
  vi.spyOn(console,"error").mockImplementation(()=>{});vi.spyOn(console,"warn").mockImplementation(()=>{});
});
afterEach(()=>{vi.restoreAllMocks();setDataGenerationLostHandler(null);});

describe("captured account data generation",()=>{
  it("accepts only the missing-function response as pre-migration zero",async()=>{
    globalThis.fetch=vi.fn(async()=>reply({code:"PGRST202"},404));
    expect((await sb.loadDataGeneration(owner)).context.generation).toBe(0);
    expect(fetch.mock.calls[0][0]).toContain("/rpc/wifit_data_generation");
    for(const response of [reply({code:"PGRST404"},404),reply({},500),reply({},403),reply(null)]){
      globalThis.fetch=vi.fn(async()=>response);
      expect((await sb.loadDataGeneration(owner)).ok).toBe(false);
    }
  });
  it("cleans only this owner's old personal files and preserves assigned drafts",async()=>{
    localStorage.setItem("wifit_chat_"+owner,"private chat");
    localStorage.setItem("wifit_chat_"+other,"other chat");
    localStorage.setItem("wifit_workout_"+owner,JSON.stringify({workout:{name:"personal"}}));
    globalThis.fetch=vi.fn(async()=>reply(3));
    expect((await sb.loadDataGeneration(owner)).ok).toBe(true);
    expect(localStorage.getItem("wifit_chat_"+owner)).toBe(null);
    expect(localStorage.getItem("wifit_workout_"+owner)).toBe(null);
    expect(localStorage.getItem("wifit_chat_"+other)).toBe("other chat");
    sb._dataContext=null;sb._pageDataGenerations=new Map();localStorage.clear();
    const assigned=JSON.stringify({workout:{trainerAssignmentID:other,name:"assigned"}});
    localStorage.setItem("wifit_workout_"+owner,assigned);
    expect((await sb.loadDataGeneration(owner)).ok).toBe(true);
    expect(localStorage.getItem("wifit_workout_"+owner)).toBe(assigned);
  });
  it("does not guess assignment ownership or advance cleanup after corrupt draft",async()=>{
    localStorage.setItem("wifit_workout_"+owner,"not-json");
    globalThis.fetch=vi.fn(async()=>reply(1));
    expect((await sb.loadDataGeneration(owner)).ok).toBe(false);
    expect(sb.dataContext()).toBe(null);
    expect(localStorage.getItem("wifit_data_generation_"+owner)).toBe(null);
    expect(localStorage.getItem("wifit_workout_"+owner)).toBe("not-json");
  });
  it("stamps the loaded generation and keeps ordinary insert return semantics",async()=>{
    globalThis.fetch=vi.fn().mockResolvedValueOnce(reply(3)).mockResolvedValueOnce(reply([{id:other}]));
    await sb.loadDataGeneration(owner);
    expect(await sb.insert("food_log",{user_id:owner})).toEqual({id:other});
    expect(fetch.mock.calls[1][1].headers["x-wifit-data-generation"]).toBe("3");
  });
  it("never rebases pending page data when reload discovers a later removal",async()=>{
    const changed=vi.fn();setDataGenerationLostHandler(changed);
    globalThis.fetch=vi.fn().mockResolvedValueOnce(reply(3)).mockResolvedValueOnce(reply(4));
    const initial=await sb.loadDataGeneration(owner),context=initial.context;
    expect((await sb.loadDataGeneration(owner)).reason).toBe("changed");
    expect(sb.dataContext()).toBe(context);
    expect(context.generation).toBe(3);
    expect(await sb.insert("water_log",{user_id:owner,oz:8})).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(2);expect(changed).toHaveBeenCalled();
  });
  it("retains the page barrier across sign-out and return to the same account",async()=>{
    globalThis.fetch=vi.fn().mockResolvedValueOnce(reply(1)).mockResolvedValueOnce(reply({})).mockResolvedValueOnce(reply(2));
    await sb.loadDataGeneration(owner);await sb.signOut();sb._session=session();
    expect((await sb.loadDataGeneration(owner)).reason).toBe("changed");
    expect(await sb.insert("food_log",{user_id:owner})).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("storage changes invalidate another tab's writes and local persistence context",async()=>{
    globalThis.fetch=vi.fn(async()=>reply(2));
    const {context}=await sb.loadDataGeneration(owner);
    localStorage.setItem("wifit_data_generation_"+owner,"3");
    observeDataGenerationChange({key:"wifit_data_generation_"+owner});
    expect(sb.isDataContextCurrent(context)).toBe(false);
    expect(await sb.update("workout_sessions",{workout_name:"old"},{filter:"user_id=eq."+owner})).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("recognizes the server barrier while preserving read failure distinctions",async()=>{
    const changed=vi.fn();setDataGenerationLostHandler(changed);
    globalThis.fetch=vi.fn().mockResolvedValueOnce(reply(0)).mockResolvedValueOnce(reply({code:"PT409",message:"WiFit data was removed. Discard old drafts and refresh before writing."},409)).mockResolvedValueOnce(reply({},503));
    await sb.loadDataGeneration(owner);
    expect(await sb.delete("food_log","user_id=eq."+owner)).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(await sb.selectAuth("food_log")).toEqual({ok:false,authError:false,status:503,rows:[]});
  });
  it("keeps generation frozen through an ordinary 401 token refresh",async()=>{
    globalThis.fetch=vi.fn().mockResolvedValueOnce(reply(4)).mockResolvedValueOnce(reply({},401))
      .mockResolvedValueOnce(reply({access_token:"refreshed",refresh_token:"next",user:{id:owner}})).mockResolvedValueOnce(reply([{id:other}]));
    await sb.loadDataGeneration(owner);
    expect(await sb.insert("food_log",{user_id:owner})).toEqual({id:other});
    expect(fetch.mock.calls[1][1].headers["x-wifit-data-generation"]).toBe("4");
    expect(fetch.mock.calls[3][1].headers["x-wifit-data-generation"]).toBe("4");
  });
});
