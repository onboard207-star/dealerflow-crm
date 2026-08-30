import type { MetadataRoute } from "next";
const origin=process.env.NEXT_PUBLIC_APP_URL??"https://dealerflow.ai";
export default function sitemap():MetadataRoute.Sitemap{return ["/","/product","/ai-product","/integrations","/security","/pricing","/book-demo","/contact"].map((path)=>({url:`${origin}${path}`,changeFrequency:path==="/"?"weekly":"monthly",priority:path==="/"?1:path==="/book-demo" ? 0.9 : 0.7}))}
