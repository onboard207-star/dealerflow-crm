import type { TenantBrandColors } from "./tenant-config";

export interface TenantBrandTokens { [name:string]:string }
export function createTenantBrandTokens(colors:TenantBrandColors):TenantBrandTokens{return{
  "--primary":hexToHsl(colors.primary),"--primary-foreground":accessibleForeground(colors.primary),"--ring":hexToHsl(colors.primary),
  "--secondary":hexToHsl(colors.secondary),"--secondary-foreground":accessibleForeground(colors.secondary),
  "--accent":hexToHsl(colors.accent),"--accent-foreground":accessibleForeground(colors.accent),
};}
export function contrastRatio(first:string,second:string){const [lighter,darker]=[luminance(first),luminance(second)].sort((a,b)=>b-a);return(lighter!+.05)/(darker!+.05);}
function accessibleForeground(background:string){const black=contrastRatio(background,"#000000");const white=contrastRatio(background,"#ffffff");return black>=white?"0 0% 0%":"0 0% 100%";}
function luminance(hex:string){return rgb(hex).map((value)=>{const channel=value/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index]!,0);}
function hexToHsl(hex:string){const[r,g,b]=rgb(hex).map((value)=>value/255) as[number,number,number];const max=Math.max(r,g,b),min=Math.min(r,g,b),light=(max+min)/2,delta=max-min;let hue=0;const saturation=delta===0?0:delta/(1-Math.abs(2*light-1));if(delta){if(max===r)hue=60*(((g-b)/delta)%6);else if(max===g)hue=60*((b-r)/delta+2);else hue=60*((r-g)/delta+4);}if(hue<0)hue+=360;return`${round(hue)} ${round(saturation*100)}% ${round(light*100)}%`;}
function rgb(hex:string):[number,number,number]{if(!/^#[0-9a-f]{6}$/i.test(hex))throw new Error("Brand colors must be six-digit hexadecimal values.");return[Number.parseInt(hex.slice(1,3),16),Number.parseInt(hex.slice(3,5),16),Number.parseInt(hex.slice(5,7),16)];}
function round(value:number){return Math.round(value*10)/10;}
