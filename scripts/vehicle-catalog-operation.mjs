import { readFile } from "node:fs/promises";

const [mode,path]=process.argv.slice(2);
if(!["validate","project"].includes(mode)||!path)throw new Error("Usage: vehicle-catalog-operation.mjs <validate|project> <snapshot.json>");
const base=process.env.DEALERFLOW_STAGING_URL?.replace(/\/$/,"");
const secret=process.env.DEALERFLOW_JOB_SECRET;
if(!base||!secret)throw new Error("DEALERFLOW_STAGING_URL and DEALERFLOW_JOB_SECRET are required.");
if(!/^https:\/\/[^/]+(?:\.onrender\.com|\.dealerflow(?:-ai)?\.com)$/i.test(base))throw new Error("Refusing a target that is not an approved DealerFlow staging host.");
const body=await readFile(path,"utf8");
const response=await fetch(`${base}/api/internal/jobs/vehicle-catalog${mode==="validate"?"?dryRun=true":""}`,{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body});
const result=await response.json();
if(!response.ok){console.error(JSON.stringify(result,null,2));process.exitCode=1;}else console.log(JSON.stringify(result,null,2));
