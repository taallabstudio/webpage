import sharp from "sharp";
import { readdir } from "node:fs/promises";
import path from "node:path";

const publicDir=path.resolve("public");
async function walk(dir){
 const entries=await readdir(dir,{withFileTypes:true});
 const files=[];
 for(const entry of entries){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory()) files.push(...await walk(full));
  else if(/\.(?:jpe?g|png|webp)$/i.test(entry.name) && !/(?:logo|icon|favicon)/i.test(entry.name)) files.push(full);
 }
 return files;
}
for(const input of await walk(publicDir)){
 const ext=path.extname(input);
 const base=input.slice(0,-ext.length);
 await sharp(input,{failOn:"none"}).avif({quality:58,effort:6}).toFile(base+".avif");
 if(/(?:studio|headphones)/i.test(path.basename(base))){
  await sharp(input,{failOn:"none"}).resize({width:48,withoutEnlargement:true}).avif({quality:28,effort:4}).toFile(base+"-preview.avif");
 }
 console.log("Created AVIF:",path.relative(publicDir,base)+".avif");
}
