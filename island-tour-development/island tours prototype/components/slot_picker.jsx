function SlotPickerA(){
  const [showHistory,setShowHistory]=React.useState(false);
  const data=[
    {rank:1,rate:22,state:'taken',taker:'Aegean Blue · 4d',heat:'stable',fills:[1,1,1,1,1,1,1],note:'held 18d straight · no churn'},
    {rank:2,rate:25,state:'available',heat:'churning',fills:[1,1,0,1,1,0,0],note:'2 turnovers · avg hold 2.3d'},
    {rank:3,rate:30,state:'locked',taker:'Azure Sail',countdown:'12:48',heat:'churning',fills:[0,0,1,0,1,0,2],note:'free 4 of last 7 days'}
  ];
  return <Screen url="islandtours.co/operator/trips/new — step 5" width="100%">
    <div className="row" style={{justifyContent:'space-between',alignItems:'baseline'}}><div><h3>Pick a featured slot</h3><div className="muted tiny">Category · <b>Boat & sail · Cyclades</b> · 3 slots ranked</div></div><div className="chip amber">🔒 selection reserves 15 min</div></div>
    <div style={{marginTop:16}} className="sk-dbl pad-md">
      <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <h4>Occupancy now</h4>
        <div className="row gap-sm" style={{alignItems:'center'}}>
          <span className="mono muted">updated 3s ago</span>
          <button className="btn ghost" style={{padding:'3px 10px',fontSize:13}} onClick={()=>setShowHistory(!showHistory)}>{showHistory?'▾':'▸'} {showHistory?'Hide':'Show'} 7-day turnover</button>
        </div>
      </div>
      <div className="grid-3" style={{gap:12}}>{data.map(s=><SlotCard key={s.rank} {...s}/>)}</div>

      {showHistory && <div className="sk pad-md" style={{background:'var(--paper-2)',marginTop:12}}>
        <div className="row" style={{justifyContent:'space-between',alignItems:'flex-end',marginBottom:6}}>
          <div><h4 style={{margin:0,fontSize:14}}>7-day turnover history</h4><div className="mono muted tiny">Each cell = one day · left = 6d ago · right = today</div></div>
          <div className="row gap-sm" style={{alignItems:'center'}}>
            <span className="row gap-sm" style={{alignItems:'center'}}><span style={{display:'inline-block',width:14,height:10,border:'1px solid var(--ink)',background:'var(--ink)',borderRadius:2}}/><span className="mono tiny muted">taken</span></span>
            <span className="row gap-sm" style={{alignItems:'center'}}><span style={{display:'inline-block',width:14,height:10,border:'1px solid var(--ink)',background:'repeating-linear-gradient(45deg,var(--amber) 0 3px,var(--amber-soft) 3px 6px)',borderRadius:2}}/><span className="mono tiny muted">locked</span></span>
            <span className="row gap-sm" style={{alignItems:'center'}}><span style={{display:'inline-block',width:14,height:10,border:'1px solid var(--ink)',background:'var(--paper)',borderRadius:2}}/><span className="mono tiny muted">open</span></span>
          </div>
        </div>
        <div style={{marginTop:6}}>
          <div className="row" style={{gap:8,alignItems:'center',marginBottom:4}}>
            <div style={{width:70}}/>
            <div className="row" style={{flex:1,gap:3}}>{['−6d','−5d','−4d','−3d','−2d','−1d','today'].map((d,i)=><span key={i} className="mono muted tiny" style={{flex:1,textAlign:'center',fontSize:10}}>{d}</span>)}</div>
            <div style={{width:86}}/>
          </div>
          {data.map(s=><div key={s.rank} style={{marginBottom:6}}>
            <div className="row" style={{alignItems:'center',gap:8}}>
              <div style={{width:70,fontFamily:'var(--font-marker)',fontSize:16}}>#{s.rank} · {s.rate}%</div>
              <div className="row" style={{flex:1,gap:3}}>{s.fills.map((f,i)=><div key={i} style={{flex:1,height:20,borderRadius:3,border:'1px solid var(--ink)',background:f===1?'var(--ink)':f===2?'repeating-linear-gradient(45deg,var(--amber) 0 4px,var(--amber-soft) 4px 8px)':'var(--paper)'}}/>)}</div>
              <span className={'chip tiny '+(s.heat==='stable'?'':'amber')} style={{width:78,justifyContent:'center'}}>{s.heat}</span>
            </div>
            <div className="mono muted tiny" style={{marginLeft:78,marginTop:2}}>{s.note}</div>
          </div>)}
        </div>
        <div style={{fontFamily:'var(--font-caveat)',fontSize:15,marginTop:8,color:'var(--ink-2)'}}>Use to gauge turnover risk: solid-black row = rarely frees up · gappy row = slot churns often · mostly-open row = low demand.</div>
      </div>}

      <div className="line dashed" style={{margin:'12px 0'}}/>
      <div className="row gap-md" style={{alignItems:'flex-start'}}><div className="grow"><div className="row gap-sm"><span className="chip green">1 available</span><span className="chip amber">1 soft-locked</span><span className="chip">1 taken</span></div><div className="callout" style={{marginTop:10}}>Select slot #2 to soft-lock it. You have 15 min to publish.</div></div><button className="btn primary" style={{alignSelf:'flex-end'}}>Reserve slot #2 · 25%</button></div>
    </div>
    <div className="grid-2" style={{marginTop:16}}>
      <div className="sk pad-md"><h4>What you get in slot #2</h4><ul style={{fontFamily:'var(--font-caveat)',fontSize:18,margin:0,paddingLeft:20}}><li>Homepage hero carousel</li><li>Top-of-category pin</li><li>★ Badge + boosted search ranking</li><li>Sponsored card in recommendations</li></ul></div>
      <div className="sk pad-md" style={{background:'var(--paper-2)'}}><h4>Waitlist</h4><div className="muted tiny">Rather wait for a cheaper slot?</div>
        <div className="col gap-sm" style={{marginTop:8}}>
          {[{r:1,rate:22,pos:3,eta:'~9d'},{r:2,rate:25,pos:2,eta:'~5d'},{r:3,rate:30,pos:1,eta:'~2d'}].map(s=>(
            <div key={s.r} className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
              <span>Queue for slot #{s.r} ({s.rate}%)</span>
              <span className="chip violet">you'd be #{s.pos} · {s.eta} ETA</span>
            </div>
          ))}
          <button className="btn ghost">Join waitlist →</button>
        </div>
      </div>
    </div>
  </Screen>;
}
function SlotPickerB(){return <Screen url="islandtours.co/operator/trips/new — step 5" width="100%">
  <div className="row" style={{justifyContent:'space-between',alignItems:'baseline'}}><div><h3>Featured slots · Boat & sail · Cyclades</h3><div className="muted tiny">Heatmap · 7-day turnover</div></div><div className="chip amber">⏱ 15 min to publish</div></div>

  <div className="sk pad-md" style={{background:'var(--paper-2)',marginTop:12}}>
    <h4 style={{fontSize:14,margin:'0 0 6px'}}>How to read this timeline</h4>
    <div className="grid-2" style={{gap:12,alignItems:'flex-start'}}>
      <div>
        <div style={{fontFamily:'var(--font-caveat)',fontSize:17,lineHeight:1.35}}>
          Each row = one of the 3 slots. Each column = one day in the <b>last 7 days</b>, left = 6d ago, right = today. The color tells you what was happening to that slot on that day.
        </div>
      </div>
      <div className="col gap-sm">
        <div className="row gap-sm" style={{alignItems:'center'}}>
          <div style={{width:28,height:18,border:'1px solid var(--ink)',background:'var(--ink)',borderRadius:3}}/>
          <span className="mono tiny"><b>taken</b> — slot was held by someone that day</span>
        </div>
        <div className="row gap-sm" style={{alignItems:'center'}}>
          <div style={{width:28,height:18,border:'1px solid var(--ink)',background:'repeating-linear-gradient(45deg,var(--amber) 0 4px,var(--amber-soft) 4px 8px)',borderRadius:3}}/>
          <span className="mono tiny"><b>soft-locked</b> — someone was mid-creation (TTL active)</span>
        </div>
        <div className="row gap-sm" style={{alignItems:'center'}}>
          <div style={{width:28,height:18,border:'1px solid var(--ink)',background:'var(--paper)',borderRadius:3}}/>
          <span className="mono tiny"><b>open</b> — slot was free all day</span>
        </div>
      </div>
    </div>
    <div className="line dashed" style={{margin:'10px 0'}}/>
    <div style={{fontFamily:'var(--font-caveat)',fontSize:16,lineHeight:1.35}}>
      Use this to gauge <b>turnover risk</b> before you commit: rows that are solid black for 7 days are <span className="chip tiny">stable</span> — they rarely free up. Rows with gaps are <span className="chip amber tiny">churning</span> — slot opens often (short hold cycles). Rows that are mostly open are <span className="chip green tiny">available</span> — easy to grab but likely low-demand too. The rightmost column is <b>today's state</b> — that's what you're actually reserving.
    </div>
  </div>

  <div className="sk-dbl pad-md" style={{marginTop:12}}>
    <div className="row" style={{justifyContent:'space-between',alignItems:'flex-end',marginBottom:6}}>
      <h4 style={{margin:0}}>Timeline · last 7 days</h4>
      <div className="row gap-sm" style={{alignItems:'center'}}>
        {['−6d','−5d','−4d','−3d','−2d','−1d','today'].map((d,i)=><span key={i} className="mono muted tiny" style={{width:'calc((100% - 200px) / 7)',minWidth:28,textAlign:'center',fontSize:10}}>{d}</span>)}
      </div>
    </div>
    {[{rank:1,rate:22,heat:'stable',fills:[1,1,1,1,1,1,1],note:'held 18d straight · no churn'},{rank:2,rate:25,heat:'churning',fills:[1,1,0,1,1,0,2],note:'2 turnovers · avg hold 2.3d'},{rank:3,rate:30,heat:'open',fills:[0,0,1,0,1,0,0],note:'free most of the week'}].map(s=><div key={s.rank} style={{marginBottom:10}}>
      <div className="row" style={{alignItems:'center',gap:10}}>
        <div style={{width:70,fontFamily:'var(--font-marker)',fontSize:20}}>#{s.rank} · <b>{s.rate}%</b></div>
        <div className="row" style={{flex:1,gap:3}}>{s.fills.map((f,i)=><div key={i} style={{flex:1,height:28,borderRadius:3,border:'1px solid var(--ink)',background:f===1?'var(--ink)':f===2?'repeating-linear-gradient(45deg,var(--amber) 0 4px,var(--amber-soft) 4px 8px)':'var(--paper)'}}/>)}</div>
        <span className={'chip tiny '+(s.heat==='open'?'green':s.heat==='churning'?'amber':'')} style={{width:72,justifyContent:'center'}}>{s.heat}</span>
        <button className="btn" disabled={s.fills[6]===1} style={{opacity:s.fills[6]===1?0.4:1}}>{s.fills[6]===1?'taken':s.fills[6]===2?'locked':`reserve · ${s.rate}%`}</button>
      </div>
      <div className="mono muted tiny" style={{marginLeft:80,marginTop:2}}>{s.note}</div>
    </div>)}
  </div>
  <div className="grid-2" style={{marginTop:16}}>
    <div className="sk pad-md"><h4>Compare your cut</h4><div className="mono muted">From €89 · 12 bookings/wk</div><div className="col gap-sm" style={{marginTop:8}}>{[['Standard · 20%','€ 854','baseline'],['Slot #1 · 22%','€ 833','+30–60% reach'],['Slot #2 · 25%','€ 801','+18–30% reach'],['Slot #3 · 30%','€ 747','+8–14% reach']].map(([l,n,r],i)=><div key={i} className="row" style={{justifyContent:'space-between',alignItems:'center'}}><span style={{fontFamily:'var(--font-marker)'}}>{l}</span><span style={{fontFamily:'var(--font-marker)',fontSize:20}}>{n}<span className="mono muted"> /wk</span></span><span className="chip tiny">{r}</span></div>)}</div></div>
    <div className="sk pad-md" style={{background:'var(--paper-2)'}}><h4>If all taken</h4><div className="muted tiny">You'd see a waitlist CTA instead.</div><div className="col gap-sm" style={{marginTop:10}}><div className="row" style={{gap:8,alignItems:'center'}}><span className="chip violet">#3</span><span>your queue place for slot #2</span></div><div className="mono muted">ETA 5–9 days · past turnover</div><button className="btn amber">Pay €45 to skip 1 place</button><div className="tiny muted">Max 3 skips/queue · refundable if queue clears</div></div></div>
  </div>
</Screen>}
function AllTakenWaitlist(){return <Screen url="islandtours.co/operator/trips/new — step 5" width="100%">
  <div className="row" style={{justifyContent:'space-between'}}><h3>Featured slots · Boat & sail · Cyclades</h3><span className="chip red">all 3 slots taken</span></div>
  <div className="grid-3" style={{marginTop:12,gap:12}}><SlotCard rank={1} rate={22} state="taken" taker="Aegean Blue · 4d"/><SlotCard rank={2} rate={25} state="taken" taker="Santorini Charters · 2d"/><SlotCard rank={3} rate={30} state="taken" taker="Cyclades Tours · 9d"/></div>
  <div className="sk-dbl pad-md" style={{marginTop:16,background:'var(--amber-soft)',borderColor:'var(--amber-ink)'}}>
    <h3 style={{color:'var(--amber-ink)'}}>Join the waitlist</h3>
    <div style={{color:'var(--amber-ink)',fontFamily:'var(--font-caveat)',fontSize:18}}>We'll notify you the moment a slot frees up. 24 hours to accept — then it passes to next.</div>
    <div className="grid-3" style={{marginTop:12,gap:12}}>{[{r:1,p:'~9d ETA',q:3},{r:2,p:'~3d ETA',q:1},{r:3,p:'~5d ETA',q:2}].map(s=><div key={s.r} className="sk pad-md" style={{background:'var(--paper)'}}><div className="row" style={{justifyContent:'space-between'}}><span style={{fontFamily:'var(--font-marker)',fontSize:22}}>#{s.r}</span><span className="chip violet">queue {s.q}</span></div><div className="mono muted" style={{marginTop:4}}>{s.p}</div><button className="btn amber" style={{marginTop:8,width:'100%'}}>Join queue</button><div className="tiny muted" style={{marginTop:4}}>or pay €45 to skip 1</div></div>)}</div>
    <div className="line dashed" style={{margin:'14px 0'}}/>
    <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><span className="muted">Publish as Standard while you wait?</span><button className="btn">Publish standard →</button></div>
  </div>
</Screen>}
function RaceModal(){return <Screen url="islandtours.co/operator/trips/new" width="100%">
  <div style={{filter:'grayscale(0.4) blur(0.5px)',opacity:0.5}}><Stepper step={5} featured={true}/><div className="grid-2" style={{gap:28}}><div className="sk pad-md" style={{height:200}}/><div className="sk pad-md" style={{height:200}}/></div></div>
  <div style={{position:'absolute',inset:0,background:'rgba(27,26,23,0.2)',display:'flex',alignItems:'center',justifyContent:'center',padding:40}}>
    <div className="sk-dbl pad-lg" style={{width:520,background:'var(--paper)',borderColor:'var(--red)',borderWidth:2.5}}>
      <div className="chip red" style={{marginBottom:8}}>⚠ race condition</div>
      <h3>Another operator just took slot #2</h3>
      <div style={{fontFamily:'var(--font-caveat)',fontSize:19,color:'var(--ink-2)'}}>Your soft-lock was valid (12:14 left) but they hit <b>Publish</b> first. We've reopened the picker.</div>
      <div className="sk pad-sm" style={{marginTop:12,background:'var(--paper-2)'}}><div className="mono muted tiny">remaining options</div><div className="row gap-sm" style={{marginTop:6}}><span className="chip green">#3 · 30% · available</span><span className="chip">waitlist for #2 · queue 1</span><span className="chip">publish as standard</span></div></div>
      <div className="row" style={{marginTop:16,justifyContent:'flex-end',gap:8}}><button className="btn ghost">Publish standard</button><button className="btn primary">Pick again →</button></div>
    </div>
  </div>
</Screen>}
function SlotPickerChapter(){return <Chapter num="02" id="ch-slotpicker" title="Slot picker · the critical screen" desc="Two variations — communicates occupancy, tier pricing, 15-min soft-lock, waitlist, and the submit-race recovery.">
  <SectionHead>Open state</SectionHead><SlotPickerA/>
  <SectionHead>All slots taken · waitlist only</SectionHead><AllTakenWaitlist/>
  <SectionHead>Race on submit · recovery</SectionHead><div style={{position:'relative'}}><RaceModal/></div>
</Chapter>}
window.SlotPickerChapter=SlotPickerChapter;
