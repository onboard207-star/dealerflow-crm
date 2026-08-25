import type { CustomerRecommendation,CustomerRecommendationGateway,RecommendationEvidence,RecommendationGeneration } from "@/lib/application/ai";

export interface OpenAIRecommendationConfiguration{apiKey:string;model:string;fetch?:typeof fetch;now?:()=>number}
export class AIProviderError extends Error{constructor(readonly code:string){super("AI recommendation provider failed.");this.name="AIProviderError";}}
export class OpenAIRecommendationGateway implements CustomerRecommendationGateway{
  private readonly request:typeof fetch;private readonly now:()=>number;
  constructor(private readonly configuration:OpenAIRecommendationConfiguration){this.request=configuration.fetch??fetch;this.now=configuration.now??Date.now;}
  async generate(input:{evidence:readonly RecommendationEvidence[];idempotencyKey:string;promptVersion:string}):Promise<RecommendationGeneration>{
    const started=this.now();let response:Response;
    try{response=await this.request("https://api.openai.com/v1/responses",{method:"POST",headers:{authorization:`Bearer ${this.configuration.apiKey}`,"content-type":"application/json","idempotency-key":input.idempotencyKey,"user-agent":"DealerFlow-AI/1.0"},body:JSON.stringify({model:this.configuration.model,store:false,max_output_tokens:1200,input:[{role:"system",content:`DealerFlow recommendation policy ${input.promptVersion}. Select exactly one next best action using only supplied evidence. Explain the recommendation with cited evidence IDs. Do not reveal chain-of-thought, invent facts, or make decisions for the employee. Keep guidance concise, calm, and operational.`},{role:"user",content:JSON.stringify({evidence:input.evidence})}],text:{format:{type:"json_schema",name:"dealerflow_customer_recommendation",strict:true,schema:recommendationSchema}}}),signal:AbortSignal.timeout(20_000)});}catch{throw new AIProviderError("provider-unavailable");}
    if(!response.ok)throw new AIProviderError(`provider-http-${response.status}`);
    const body:unknown=await response.json();const latencyMs=Math.max(0,this.now()-started);
    if(!isResponse(body))throw new AIProviderError("provider-invalid-response");
    const refusal=findContent(body.output,"refusal");if(refusal)return{providerResponseId:body.id,model:body.model,refusal,latencyMs,...usage(body.usage)};
    const text=findContent(body.output,"output_text");if(!text)throw new AIProviderError(body.status==="incomplete"?"provider-incomplete":"provider-missing-output");
    let recommendation:unknown;try{recommendation=JSON.parse(text);}catch{throw new AIProviderError("provider-invalid-json");}
    if(!isRecommendation(recommendation))throw new AIProviderError("provider-invalid-schema");
    return{providerResponseId:body.id,model:body.model,recommendation,latencyMs,...usage(body.usage)};
  }
}
const stringArray={type:"array",items:{type:"string",maxLength:300},maxItems:5} as const;
const recommendationSchema={type:"object",additionalProperties:false,properties:{primaryAction:{type:"string",maxLength:200},rationale:{type:"string",maxLength:600},evidenceIds:{type:"array",items:{type:"string"},minItems:1,maxItems:30},confidence:{type:"integer",minimum:0,maximum:100},urgency:{type:"string",enum:["low","medium","high","immediate"]},timeHorizon:{type:"string",maxLength:100},risks:stringArray,opportunities:stringArray,supportingActions:stringArray},required:["primaryAction","rationale","evidenceIds","confidence","urgency","timeHorizon","risks","opportunities","supportingActions"]} as const;
interface ResponseBody{id:string;model:string;status:string;output:readonly unknown[];usage?:{input_tokens?:number;output_tokens?:number}}
function isResponse(value:unknown):value is ResponseBody{return isObject(value)&&typeof value.id==="string"&&typeof value.model==="string"&&typeof value.status==="string"&&Array.isArray(value.output);}
function findContent(output:readonly unknown[],type:"refusal"|"output_text"):string|undefined{for(const item of output){if(!isObject(item)||!Array.isArray(item.content))continue;for(const content of item.content){if(isObject(content)&&content.type===type){const value=type==="refusal"?content.refusal:content.text;if(typeof value==="string"&&value.trim())return value;}}}return undefined;}
function isRecommendation(value:unknown):value is CustomerRecommendation{return isObject(value)&&typeof value.primaryAction==="string"&&typeof value.rationale==="string"&&stringList(value.evidenceIds)&&typeof value.confidence==="number"&&["low","medium","high","immediate"].includes(String(value.urgency))&&typeof value.timeHorizon==="string"&&stringList(value.risks)&&stringList(value.opportunities)&&stringList(value.supportingActions);}
function stringList(value:unknown):value is string[]{return Array.isArray(value)&&value.every((item)=>typeof item==="string");}
function isObject(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value);}
function usage(value:ResponseBody["usage"]){return{...(typeof value?.input_tokens==="number"?{inputTokens:value.input_tokens}:{}),...(typeof value?.output_tokens==="number"?{outputTokens:value.output_tokens}:{})};}
