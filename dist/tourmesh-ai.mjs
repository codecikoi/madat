const engineUrl='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const model='Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const examples={
 hotel:['где поселить группу на ночь','размещение туристов в двухместных комнатах','место для ночёвки','overnight accommodation for a tour group'],
 transport:['довезти группу из одного города в другой','забрать гостей из аэропорта','машина с водителем для туристов','drive our group between two cities'],
 restaurant:['где накормить группу','место поесть всем вместе','организовать стол для группы','a place to feed our group'],
 guide:['кто покажет достопримечательности','провести экскурсию по городу и рассказать историю','человек который познакомит группу с городом','someone to take us sightseeing']
};
const labels=Object.entries(examples).flatMap(([category,phrases])=>phrases.map(phrase=>({category,phrase})));
let modelTask;
function loadModel(){
 if(!modelTask)modelTask=(async()=>{
  const {pipeline,env}=await import(engineUrl);
  env.allowLocalModels=false;
  env.backends.onnx.wasm.numThreads=1;
  env.backends.onnx.wasm.proxy=false;
  const embed=await pipeline('feature-extraction',model,{device:'wasm',dtype:'q8'});
  const reference=(await embed(labels.map(item=>item.phrase),{pooling:'mean',normalize:true})).tolist();
  return {embed,reference};
 })().catch(error=>{modelTask=null;throw error});
 return modelTask;
}
function dot(left,right){
 let score=0;
 for(let index=0;index<left.length;index++)score+=left[index]*right[index];
 return score;
}
globalThis.onmessage=async({data})=>{
 const {id,segments}=data;
 try{
  const {embed,reference}=await loadModel();
  globalThis.postMessage({id,state:'ready'});
  const vectors=(await embed(segments,{pooling:'mean',normalize:true})).tolist();
  const categories=vectors.map(vector=>{
   const scores=Object.keys(examples).map(category=>({
    category,score:Math.max(...reference.map((known,index)=>labels[index].category===category?dot(vector,known):-1))
   })).sort((first,second)=>second.score-first.score);
   return scores[0].score>=.46&&scores[0].score-scores[1].score>=.045?scores[0].category:null;
  });
  globalThis.postMessage({id,categories});
 }catch{
  globalThis.postMessage({id,error:true});
 }
};
