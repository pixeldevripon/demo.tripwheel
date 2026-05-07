function App(){
  const t=useTweaks();
  useEffect(()=>{
    const nav=document.getElementById('chapter-nav');if(!nav)return;nav.innerHTML='';
    const chapters=[['ch-operator','01 · Operator'],['ch-slotpicker','02 · Slot picker'],['ch-edge','03 · Edge cases'],['ch-admin','04 · Admin'],['ch-traveler','05 · Traveler'],['ch-waitlist','06 · Waitlist']];
    chapters.forEach(([id,label])=>{const a=document.createElement('a');a.href='#'+id;a.textContent=label;a.dataset.target=id;a.onclick=e=>{e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})};nav.appendChild(a)});
    const obs=new IntersectionObserver(ents=>ents.forEach(en=>{if(en.isIntersecting)nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active',a.dataset.target===en.target.id))}),{rootMargin:'-40% 0px -55% 0px'});
    chapters.forEach(([id])=>{const el=document.getElementById(id);if(el)obs.observe(el)});
    return()=>obs.disconnect();
  },[]);
  useEffect(()=>{if(t.edge&&t.edge!=='none')document.getElementById('ch-edge')?.scrollIntoView({behavior:'smooth',block:'start'})},[t.edge]);
  return <>
    <OperatorFlowChapter/><SlotPickerChapter/><EdgeCasesChapter/><AdminChapter/><TravelerChapter/><WaitlistChapter/>
    <div className="chapter" style={{marginTop:50,textAlign:'center'}}><div className="line wavy" style={{margin:'30px auto',width:200}}/><div style={{fontFamily:'var(--font-caveat)',fontSize:22,color:'var(--ink-3)'}}>end of wireframe pass · v0.1</div><div style={{fontFamily:'var(--font-caveat)',fontSize:17,color:'var(--ink-3)',marginTop:4}}>press <span className="kbd">T</span> for tweaks</div></div>
  </>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
