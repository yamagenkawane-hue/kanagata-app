// Read-only: node --env-file=.env.local scripts/inspect-db-metrics.mjs [10..60 seconds]
// Never prints credentials, SQL text, instance addresses or raw metrics labels.
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Supabase metrics configuration is missing");
const sampleSeconds=Number(process.argv[2]??10);
if(!Number.isInteger(sampleSeconds)||sampleSeconds<10||sampleSeconds>60)throw new Error("Sample interval must be 10..60 seconds");
const names=["pg_stat_statements_total_queries","pg_stat_statements_total_time_seconds","pg_stat_activity_xact_runtime","node_load1","connection_stats_connection_count","direct_connection_stats_connection_count","pgrst_db_pool_waiting"];
async function snapshot(){
 const response=await fetch(`${url}/customer/v1/privileged/metrics`,{headers:{Authorization:`Basic ${Buffer.from(`service_role:${key}`).toString("base64")}`},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Metrics request failed (${response.status})`);
 const cpu=new Map();const values={};
 for(const line of (await response.text()).split("\n")){
  const match=line.match(/^([a-zA-Z0-9_]+)(?:\{(.*)\})?\s+([0-9.eE+-]+)(?:\s|$)/);if(!match)continue;
  const value=Number(match[3]);if(!Number.isFinite(value))continue;
  if(match[1]==="node_cpu_seconds_total"){
   const mode=match[2]?.match(/(?:^|,)mode="([^"]+)"/)?.[1];const core=match[2]?.match(/(?:^|,)cpu="([^"]+)"/)?.[1];
   if(mode&&core&&mode!=="guest"&&mode!=="guest_nice")cpu.set(`${core}:${mode}`,value);
  }else if(names.includes(match[1]))values[match[1]]=(values[match[1]]??0)+value;
 }
 return {cpu,values,time:Date.now()};
}
try{
 const first=await snapshot();await new Promise(resolve=>setTimeout(resolve,sampleSeconds*1000));const second=await snapshot();
 const deltaByMode={};let total=0;
 for(const [id,value] of second.cpu){if(!first.cpu.has(id))continue;const delta=value-first.cpu.get(id);if(delta<0)continue;const mode=id.split(":")[1];deltaByMode[mode]=(deltaByMode[mode]??0)+delta;total+=delta;}
 const percentByMode=Object.fromEntries(Object.entries(deltaByMode).map(([mode,value])=>[mode,total?Math.round(value/total*10000)/100:null]));
 const queryDelta=second.values.pg_stat_statements_total_queries-first.values.pg_stat_statements_total_queries;
 const sqlSecondsDelta=second.values.pg_stat_statements_total_time_seconds-first.values.pg_stat_statements_total_time_seconds;
 console.log(JSON.stringify({observedAt:new Date(second.time).toISOString(),intervalSeconds:Math.round((second.time-first.time)/100)/10,cpuCountersUpdated:total>0,cpuPercentByMode:percentByMode,queryCountersUpdated:queryDelta>0,queryCounterDelta:Number.isFinite(queryDelta)&&queryDelta>=0?queryDelta:null,sqlTimeCounterDeltaSeconds:Number.isFinite(sqlSecondsDelta)&&sqlSecondsDelta>=0?Math.round(sqlSecondsDelta*1000)/1000:null,note:"Exporter caching can make counter intervals differ from request intervals; zero delta does not establish zero workload.",metrics:second.values},null,2));
}catch{console.error("Could not collect database metrics; no credentials were logged.");process.exitCode=1;}
