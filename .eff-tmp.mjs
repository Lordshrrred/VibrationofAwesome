import fs from "node:fs";
const root=process.cwd();
for (const l of fs.readFileSync(root+"/.env","utf8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];}
const {default:Anthropic}=await import("@anthropic-ai/sdk");
const c=new Anthropic();
const sys=(await import(root+"/.sysprompt.mjs")).default;
const posts=JSON.parse(fs.readFileSync(root+"/static/_data/boom-posts.json","utf8"));
const list=posts.slice(0,200).map(p=>`- ${p.title} (${p.url})`).join("\n");
const user=[{type:"text",text:list,cache_control:{type:"ephemeral"}},
            {type:"text",text:"Write a Boom Frequency post titled: How to Reset Your Focus After a Distracted Week. Return raw markdown only."}];
console.log("effort |  out tok | words | steady-state $/post");
for (const eff of ["low","medium","high"]) {
  const m=await c.messages.create({model:"claude-opus-5",max_tokens:16000,
    output_config:{effort:eff},
    system:[{type:"text",text:sys,cache_control:{type:"ephemeral"}}],
    messages:[{role:"user",content:user}]});
  const u=m.usage;
  const cached=(u.cache_read_input_tokens||u.cache_creation_input_tokens||0);
  const cost=cached/1e6*5*0.1 + u.output_tokens/1e6*25;
  const words=(m.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").split(/\s+/).length;
  console.log(`${eff.padEnd(6)} |   ${String(u.output_tokens).padStart(5)}  | ${String(words).padStart(5)} | $${cost.toFixed(4)}`);
}
