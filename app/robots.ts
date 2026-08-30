import type { MetadataRoute } from "next";
const origin=process.env.NEXT_PUBLIC_APP_URL??"https://dealerflow.ai";
export default function robots():MetadataRoute.Robots{return{rules:{userAgent:"*",allow:["/","/product","/ai-product","/integrations","/security","/pricing","/book-demo","/contact"],disallow:["/organizations/","/api/","/demo/","/select-organization"]},sitemap:`${origin}/sitemap.xml`}}
