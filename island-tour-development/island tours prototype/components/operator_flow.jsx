function LadderView(){return <div className="sk pad-md" style={{background:'var(--paper-2)'}}><h4 style={{fontSize:14,margin:'0 0 4px'}}>How commission works</h4><div className="muted tiny">Higher slot = lower fee.</div><div className="col gap-sm" style={{marginTop:8}}>{[[1,22,'hero, top-of-category, sponsored'],[2,25,'carousel, search boost'],[3,30,'category pin, search boost']].map(([r,p,d])=><div key={r} className="row" style={{alignItems:'center',gap:8}}><div style={{width:36,fontFamily:'var(--font-marker)',fontSize:20,textAlign:'right'}}>#{r}</div><div style={{flex:1,height:10,border:'1.5px solid var(--ink)',borderRadius:999,position:'relative'}}><div style={{position:'absolute',inset:0,width:(p*2)+'%',background:'var(--amber)',borderRadius:999}}/></div><div style={{width:42,fontFamily:'var(--font-marker)',fontSize:15}}>{p}%</div><div className="mono muted tiny" style={{flex:1}}>{d}</div></div>)}<div className="line dashed" style={{margin:'4px 0'}}/><div className="row" style={{alignItems:'center',gap:8,opacity:0.7}}><div style={{width:36}} className="mono muted tiny">std</div><div style={{flex:1,height:10,border:'1.5px solid var(--ink-3)',borderRadius:999}}><div style={{height:'100%',width:'40%',background:'var(--ink-3)',borderRadius:999}}/></div><div style={{width:42,fontFamily:'var(--font-marker)',fontSize:15}}>20%</div><div className="mono muted tiny" style={{flex:1}}>baseline</div></div></div></div>}

function ComparatorView(){return <div className="sk pad-md" style={{background:'var(--paper-2)'}}><h4 style={{fontSize:14,margin:'0 0 4px'}}>Your cut at a glance</h4><div className="muted tiny">Base €89 · 12 bookings/wk avg</div><div className="grid-4" style={{gap:6,marginTop:8}}>{[['Standard','20%','€71.20','€ 854'],['Slot #1','22%','€69.42','€ 833'],['Slot #2','25%','€66.75','€ 801'],['Slot #3','30%','€62.30','€ 747']].map(([l,p,n,wk],i)=><div key={i} className="sk pad-sm" style={{background:i===0?'var(--paper)':'var(--amber-soft)',borderColor:i===0?'var(--ink)':'var(--amber-ink)'}}><div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><span className="mono muted tiny">{l}</span><span className={'chip tiny '+(i===0?'':'amber')}>–{p}</span></div><div style={{fontFamily:'var(--font-marker)',fontSize:18,marginTop:2}}>{n}</div><div className="mono muted tiny">{wk}/wk</div></div>)}</div><div className="line dashed" style={{margin:'8px 0'}}/><div className="col gap-sm">{[['Standard','€ 854','baseline','','ink'],['Slot #1','€ 1,200','+30–60% reach','+€346','green'],['Slot #2','€ 993','+18–30% reach','+€139','green'],['Slot #3','€ 822','+8–14% reach','–€32','red']].map(([l,v,c,delta,col],i)=>(<div key={i} className="row" style={{alignItems:'center',gap:6}}><span className="mono muted tiny" style={{width:56}}>{l}</span><span style={{fontFamily:'var(--font-marker)',fontSize:14,width:56}}>{v}</span><span className="mono muted tiny" style={{flex:1}}>{c}</span>{delta&&<span className={'chip '+col+' tiny'}>{delta}</span>}</div>))}</div></div>}

function DashboardScreen(){return <Screen url="islandtours.co/operator/trips" width="100%"><div className="row" style={{alignItems:'stretch'}}><Rail active="trips"/><div style={{flex:1,paddingLeft:16}}><div className="row" style={{justifyContent:'space-between',alignItems:'baseline'}}><h3>My trips</h3><button className="btn primary">+ Create a trip</button></div><div className="row gap-md" style={{marginTop:10}}><span className="chip">All 8</span><span className="chip green">Live 5</span><span className="chip amber">Featured 2</span><span className="chip">Draft 1</span></div><div style={{marginTop:16}} className="col gap-sm">{[['Sunset catamaran · Santorini','Live · Featured #2 · 25%','green'],['Volcano hike · Stromboli','Live · Standard · 20%','green'],['Private beach picnic · Mallorca','Draft · 3 steps left','amber'],['Snorkel reef tour · Corfu','Waitlisted (position 2)','violet']].map(([n,s,c],i)=><div key={i} className="sk-dbl pad-md row" style={{alignItems:'center',gap:14}}><div className="ph ph-photo" style={{width:80,height:56}}/><div className="grow"><div style={{fontFamily:'var(--font-marker)',fontSize:18}}>{n}</div><div className="mono muted">{s}</div></div><span className={'chip '+c}>edit →</span></div>)}</div></div></div></Screen>}
function TripForm({step,featured}){return <Screen url="islandtours.co/operator/trips/new" width="100%"><Stepper step={step} featured={featured}/><div className="grid-2" style={{gap:28}}><div className="col gap-md">{step===0&&<><h3>Trip details</h3><div><label className="label">Title</label><div className="field placeholder">Sunset Catamaran — Santorini</div></div><div><label className="label">Category</label><div className="row gap-sm wrap">{['Boat & sail','Hike','Food','Culture','Wildlife','Wellness'].map(c=><span key={c} className={'chip'+(c==='Boat & sail'?' amber':'')}>{c}</span>)}</div></div><div><label className="label">Description</label><div className="xbox" style={{minHeight:120}}/></div></>}
{step===1&&<><h3>Pricing & availability</h3><div className="row gap-md"><div style={{flex:1}}><label className="label">Price / person</label><div className="field placeholder">€ 89</div></div><div style={{flex:1}}><label className="label">Group size</label><div className="field placeholder">2 – 12</div></div></div><div><label className="label">Available dates</label><div className="sk pad-md" style={{height:160,background:'var(--paper-2)'}}><div className="grid-4" style={{gap:4}}>{Array.from({length:28}).map((_,i)=><div key={i} style={{aspectRatio:'1',border:'1px solid var(--ink-3)',borderRadius:4,background:[3,7,12,18,22].includes(i)?'var(--green-soft)':'var(--paper)',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-marker)'}}>{i+1}</div>)}</div></div></div></>}
{step===2&&<><h3>Photos & media</h3><div className="grid-3" style={{gap:8}}>{Array.from({length:6}).map((_,i)=><div key={i} className="ph ph-photo" style={{aspectRatio:'4/3'}}/>)}</div><div className="callout">Upload 3+ photos. First is the hero.</div></>}
{step===3&&<><h3>Visibility & placement</h3><div className="col gap-md"><div className="sk-dbl pad-md"><div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontFamily:'var(--font-marker)',fontSize:20}}>Standard</div><div className="muted">Browse + search. <b>20%</b>.</div></div><input type="radio" style={{width:22,height:22}}/></div></div><div className="sk-dbl pad-md" style={{borderColor:'var(--amber-ink)',background:'var(--amber-soft)'}}><div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontFamily:'var(--font-marker)',fontSize:20}}>★ Featured</div><div className="muted" style={{color:'var(--amber-ink)'}}>Hero · pin · boost · sponsored. <b>22–30%</b>.</div></div><input type="radio" style={{width:22,height:22}} defaultChecked/></div></div><LadderView/></div></>}
{step===4&&featured&&<><h3>Pick a featured slot</h3><div className="muted tiny">Category: <b>Boat & sail · Cyclades</b></div><div className="callout">3 slots per category. Higher slot = lower fee.</div><ComparatorView/><Annot>See "Slot picker" chapter for two variations.</Annot></>}
{((featured&&step===5)||(!featured&&step===4))&&<><h3>Review & confirm</h3><div className="sk-dbl pad-md col gap-sm"><div className="row" style={{justifyContent:'space-between'}}><span className="muted">Title</span><span>Sunset Catamaran — Santorini</span></div><div className="line dashed"/><div className="row" style={{justifyContent:'space-between'}}><span className="muted">Price</span><span>€89 / person</span></div><div className="line dashed"/><div className="row" style={{justifyContent:'space-between'}}><span className="muted">Visibility</span><span>{featured?'Featured slot #2 (25%)':'Standard (20%)'}</span></div>{featured&&<><div className="line dashed"/><div className="row" style={{justifyContent:'space-between'}}><span className="muted">Slot</span><span className="chip amber">🔒 12:48 left</span></div></>}</div></>}
</div><div className="col gap-md"><div className="sk pad-md" style={{background:'var(--paper-2)'}}><h4>Live preview</h4><TripCard title="Sunset Catamaran — Santorini" operator="Aegean Blue" price="€89" featured={featured} size="lg"/></div>{featured&&step>=4&&<div className="sk-dbl pad-md" style={{borderColor:'var(--amber-ink)'}}><TTLBar remaining={768}/><Annot>Released automatically if you don't publish in time.</Annot></div>}<div className="row" style={{justifyContent:'space-between'}}><button className="btn ghost">← Back</button><div className="row gap-sm"><button className="btn">Save draft</button><button className="btn primary">{((featured&&step===5)||(!featured&&step===4))?'Publish →':'Continue →'}</button></div></div></div></div></Screen>}
function FeaturedSlotsDashboard(){return <Screen url="islandtours.co/operator/featured" width="100%"><div className="row" style={{alignItems:'stretch'}}><Rail active="featured"/><div style={{flex:1,paddingLeft:16}}>
  <div className="row" style={{justifyContent:'space-between',alignItems:'baseline'}}><h3>Featured slots</h3><div className="row gap-sm"><span className="chip amber">2 active</span><span className="chip violet">3 in queue</span></div></div>

  <div className="section-head" style={{marginTop:18}}><h3 style={{fontSize:15}}>Active featured trips</h3><div className="line-fill"/></div>
  <div className="col gap-md">
    {[{trip:'Sunset Catamaran · Santorini',cat:'Boat & sail · Cyclades',slot:2,rate:25,held:'38d',cap:90,bookings:47,rev:'€ 3,140',vs:'+€ 612 vs standard',perf:'healthy',cta:'manage'},
      {trip:'Volcano Hike · Stromboli',cat:'Hike · Aeolian',slot:3,rate:30,held:'72d',cap:90,bookings:8,rev:'€ 612',vs:'–€ 48 vs standard',perf:'underperforming',cta:'review'}].map((t,i)=>(
      <div key={i} className="sk-dbl pad-md">
        <div className="row" style={{justifyContent:'space-between',alignItems:'flex-start',gap:14}}>
          <div className="grow">
            <div style={{fontFamily:'var(--font-marker)',fontSize:18}}>{t.trip}</div>
            <div className="mono muted">{t.cat}</div>
            <div className="row gap-sm" style={{marginTop:6}}>
              <span className="chip amber">slot #{t.slot} · {t.rate}%</span>
              <span className={'chip tiny '+(t.perf==='healthy'?'green':'red')}>{t.perf}</span>
              <span className="mono muted tiny">held {t.held} / {t.cap}d cap</span>
            </div>
          </div>
          <div className="col" style={{alignItems:'flex-end',minWidth:180}}>
            <div style={{fontFamily:'var(--font-marker)',fontSize:22}}>{t.rev}</div>
            <div className="mono muted tiny">{t.bookings} bookings · 30d</div>
            <div className={'mono tiny '+(t.vs.startsWith('+')?'':'')} style={{color:t.vs.startsWith('+')?'var(--green)':'var(--red)',marginTop:2}}>{t.vs}</div>
          </div>
        </div>
        <div className="ttl-bar" style={{marginTop:10}}><span style={{width:Math.round(parseInt(t.held)/t.cap*100)+'%',background:t.perf==='healthy'?'var(--green)':'var(--amber)'}}/></div>
        <div className="row" style={{justifyContent:'space-between',marginTop:8,alignItems:'center'}}>
          <div className="mono muted tiny">{t.cap - parseInt(t.held)}d until 90-day cap · must re-queue after</div>
          <div className="row gap-sm">
            <button className="btn ghost">Release slot</button>
            <button className={'btn '+(t.perf==='healthy'?'':'amber')}>{t.cta} →</button>
          </div>
        </div>
      </div>
    ))}
  </div>

  <div className="section-head" style={{marginTop:24}}><h3 style={{fontSize:15}}>Slot availability · your categories</h3><div className="line-fill"/></div>
  <div className="grid-2">
    {[{cat:'Boat & sail · Cyclades',slots:[{r:1,rate:22,st:'taken',who:'Aegean Blue',open:'in ~9d'},{r:2,rate:25,st:'mine',who:'You · Sunset Cat.',open:'—'},{r:3,rate:30,st:'taken',who:'Odyssey',open:'in ~18d'}]},
      {cat:'Hike · Aeolian',slots:[{r:1,rate:22,st:'taken',who:'TrekEolie',open:'in ~14d'},{r:2,rate:25,st:'available',who:'—',open:'open now'},{r:3,rate:30,st:'mine',who:'You · Volcano',open:'—'}]}].map((c,i)=>(
      <div key={i} className="sk pad-md">
        <h4 style={{fontSize:14,margin:'0 0 8px'}}>{c.cat}</h4>
        <div className="col" style={{gap:4}}>
          {c.slots.map(s=>(
            <div key={s.r} className="row" style={{gap:8,padding:'4px 6px',border:'1px dashed var(--ink-3)',borderRadius:4,background:s.st==='mine'?'var(--amber-soft)':s.st==='available'?'var(--green-soft)':'var(--paper)',alignItems:'center'}}>
              <span style={{fontFamily:'var(--font-marker)',fontSize:14,width:56}}>#{s.r} · {s.rate}%</span>
              <span className={'chip tiny '+(s.st==='mine'?'amber':s.st==='available'?'green':'')} style={{width:76,justifyContent:'center'}}>{s.st}</span>
              <span className="mono muted tiny" style={{flex:1}}>{s.who}</span>
              <span className="mono muted tiny">{s.open}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>

  <div className="section-head" style={{marginTop:24}}><h3 style={{fontSize:15}}>Your waitlist entries</h3><div className="line-fill"/></div>
  <div className="col gap-sm">
    {[{cat:'Boat & sail · Cyclades',slot:1,rate:22,pos:3,of:5,eta:'~9d',offer:false},
      {cat:'Food · Sicily',slot:2,rate:25,pos:1,of:3,eta:'~2d',offer:true}].map((w,i)=>(
      <div key={i} className="sk pad-sm row" style={{justifyContent:'space-between',alignItems:'center',background:w.offer?'var(--violet-soft)':'var(--paper)',borderColor:w.offer?'var(--violet)':'var(--ink)'}}>
        <div>
          <div style={{fontFamily:'var(--font-marker)',fontSize:15}}>{w.cat}</div>
          <div className="mono muted tiny">slot #{w.slot} · {w.rate}% · position {w.pos}/{w.of} · ETA {w.eta}</div>
        </div>
        {w.offer
          ? <div className="row gap-sm"><span className="chip violet tiny">offer · 23h left</span><button className="btn primary">Claim →</button></div>
          : <button className="btn ghost">View queue</button>}
      </div>
    ))}
    <button className="btn amber" style={{alignSelf:'flex-start',marginTop:4}}>+ Queue for another slot</button>
  </div>

  <div className="section-head" style={{marginTop:24}}><h3 style={{fontSize:15}}>→ "Queue for another slot" modal</h3><div className="line-fill"/></div>
  <div className="sk-dbl pad-md" style={{background:'var(--paper-2)',maxWidth:560}}>
    <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
      <h4 style={{margin:0}}>Join a waitlist</h4>
      <span className="mono muted tiny">× close</span>
    </div>
    <div className="mono muted tiny" style={{marginTop:2}}>Free · FIFO · 24h claim window when your turn comes</div>

    <div className="mono muted tiny" style={{marginTop:12,marginBottom:4}}>1 · Category</div>
    <div className="row gap-sm wrap">{['Boat & sail · Cyclades','Hike · Aeolian','Food · Sicily','Culture · Malta'].map((c,i)=><span key={i} className={'chip '+(i===2?'amber':'')}>{c}</span>)}</div>

    <div className="mono muted tiny" style={{marginTop:12,marginBottom:4}}>2 · Pick slot(s)</div>
    <div className="col" style={{gap:6}}>
      {[{r:1,rate:22,st:'taken',q:4,you:'#5',disabled:false},
        {r:2,rate:25,st:'taken',q:1,you:'offer pending',disabled:true,note:'you have an open offer'},
        {r:3,rate:30,st:'available',q:0,you:'reserve now',disabled:false}].map(s=>(
        <label key={s.r} className="sk pad-sm row" style={{gap:10,alignItems:'center',opacity:s.disabled?0.5:1,cursor:s.disabled?'not-allowed':'pointer',background:'var(--paper)'}}>
          <input type="checkbox" disabled={s.disabled} style={{accentColor:'var(--amber-ink)'}}/>
          <span style={{fontFamily:'var(--font-marker)',fontSize:15,width:70}}>#{s.r} · {s.rate}%</span>
          <span className={'chip tiny '+(s.st==='available'?'green':'')} style={{width:76,justifyContent:'center'}}>{s.st}</span>
          <span className="mono muted tiny" style={{flex:1}}>queue {s.q} · you'd be {s.you}</span>
          {s.note&&<span className="mono tiny" style={{color:'var(--violet)'}}>{s.note}</span>}
        </label>
      ))}
    </div>

    <div className="mono muted tiny" style={{marginTop:12,marginBottom:4}}>3 · Which trip?</div>
    <div className="field placeholder" style={{fontSize:13}}>Street Food Crawl · Palermo ▾</div>

    <div className="callout" style={{marginTop:10}}>Joining is free. You can leave a queue anytime. When a slot opens, we send email + push; you have 24h to claim or the offer passes down (you keep your position if you explicitly pass).</div>

    <div className="row" style={{justifyContent:'flex-end',gap:8,marginTop:12}}>
      <button className="btn ghost">Cancel</button>
      <button className="btn primary">Join queue →</button>
    </div>
  </div>

  <div className="section-head" style={{marginTop:24}}><h3 style={{fontSize:15}}>→ "Manage / Review" slot drawer</h3><div className="line-fill"/></div>
  <div className="grid-2">
    <div className="sk-dbl pad-md">
      <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
        <div className="row gap-sm" style={{alignItems:'center'}}>
          <span className="chip amber">manage</span>
          <span className="mono muted tiny">healthy</span>
        </div>
        <span className="mono muted tiny">× close</span>
      </div>
      <h4 style={{marginTop:6}}>Slot #2 · 25% · Sunset Catamaran</h4>
      <div className="mono muted tiny">Boat & sail · Cyclades</div>

      <div className="sk pad-sm" style={{background:'var(--paper-2)',marginTop:10}}>
        <div className="mono muted tiny">30-day performance</div>
        <div className="grid-4" style={{gap:6,marginTop:4}}>
          {[['Bookings','47'],['Revenue','€ 3,140'],['Rating','4.7'],['vs std','+€ 612']].map(([l,v],i)=>
            <div key={i}><div className="mono muted tiny">{l}</div><div style={{fontFamily:'var(--font-marker)',fontSize:16}}>{v}</div></div>)}
        </div>
      </div>

      <div className="row" style={{justifyContent:'space-between',marginTop:10,alignItems:'center'}}>
        <span className="mono muted tiny">Held 38d / 90d cap</span>
        <span className="mono muted tiny">52d left · must re-queue after</span>
      </div>
      <div className="ttl-bar" style={{marginTop:4}}><span style={{width:'42%',background:'var(--green)'}}/></div>

      <div className="mono muted tiny" style={{marginTop:12,marginBottom:4}}>Swap trip using this slot</div>
      <div className="field placeholder" style={{fontSize:13}}>Sunset Catamaran · Santorini ▾</div>

      <div className="row" style={{marginTop:12,gap:6,justifyContent:'flex-end'}}>
        <button className="btn ghost">Pause 48h</button>
        <button className="btn ghost" style={{color:'var(--red)'}}>Release slot</button>
        <button className="btn primary">Save changes</button>
      </div>
    </div>

    <div className="sk-dbl pad-md" style={{borderColor:'var(--red)',background:'var(--red-soft)'}}>
      <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
        <div className="row gap-sm" style={{alignItems:'center'}}>
          <span className="chip red">review · underperforming</span>
        </div>
        <span className="mono muted tiny">× close</span>
      </div>
      <h4 style={{marginTop:6}}>Slot #3 · 30% · Volcano Hike</h4>
      <div className="mono muted tiny">Hike · Aeolian</div>

      <div className="sk pad-sm" style={{background:'var(--paper)',marginTop:10}}>
        <div className="mono tiny" style={{color:'var(--red)'}}>⚠ You'd net more as standard</div>
        <div className="mono muted tiny" style={{marginTop:4}}>At 30% cut you keep €62.30/booking. At 20% (standard) you'd keep €71.20.</div>
        <div className="mono muted tiny">Current volume (8/30d) doesn't offset the extra commission.</div>
      </div>

      <div className="sk pad-sm" style={{background:'var(--paper-2)',marginTop:8}}>
        <div className="mono muted tiny">30-day performance</div>
        <div className="grid-4" style={{gap:6,marginTop:4}}>
          {[['Bookings','8'],['Revenue','€ 498'],['Rating','4.2'],['vs std','–€ 48',true]].map(([l,v,red],i)=>
            <div key={i}><div className="mono muted tiny">{l}</div><div style={{fontFamily:'var(--font-marker)',fontSize:16,color:red?'var(--red)':'var(--ink)'}}>{v}</div></div>)}
        </div>
      </div>

      <div className="mono muted tiny" style={{marginTop:10,marginBottom:4}}>Recommended actions</div>
      <div className="col" style={{gap:4}}>
        <div className="sk pad-sm row" style={{justifyContent:'space-between',alignItems:'center',background:'var(--paper)'}}><span className="mono tiny">Downgrade to standard (20%)</span><button className="btn amber" style={{padding:'2px 8px',fontSize:12}}>release →</button></div>
        <div className="sk pad-sm row" style={{justifyContent:'space-between',alignItems:'center',background:'var(--paper)'}}><span className="mono tiny">Swap to a better-performing trip</span><button className="btn ghost" style={{padding:'2px 8px',fontSize:12}}>swap →</button></div>
        <div className="sk pad-sm row" style={{justifyContent:'space-between',alignItems:'center',background:'var(--paper)'}}><span className="mono tiny">Keep · ignore warning (7d)</span><button className="btn ghost" style={{padding:'2px 8px',fontSize:12}}>keep</button></div>
      </div>
    </div>
  </div>

  <Annot>This screen is the operator's single source of truth for anything slot-related: active holdings, upcoming availability, queue positions, and pending offers.</Annot>
</div></div></Screen>}

function OperatorFlowChapter(){const t=useTweaks();const featured=t.flow!=='standard';return <Chapter num="01" id="ch-operator" title="Operator flow · trip creation" desc="Happy path from creating a trip to publishing it. Featured adds a slot-picker step with soft-lock and TTL countdown.">
<SectionHead>Dashboard</SectionHead><DashboardScreen/>
<SectionHead>Featured slots dashboard</SectionHead><FeaturedSlotsDashboard/>
<SectionHead>Creation wizard — {featured?'6 steps':'5 steps'}</SectionHead>
<Variations labels={featured?['① Details','② Pricing','③ Photos','④ Visibility','⑤ Slot pick','⑥ Review']:['① Details','② Pricing','③ Photos','④ Visibility','⑤ Review']}>
<TripForm step={0} featured={featured}/><TripForm step={1} featured={featured}/><TripForm step={2} featured={featured}/><TripForm step={3} featured={featured}/><TripForm step={4} featured={featured}/>{featured&&<TripForm step={5} featured={featured}/>}
</Variations>
</Chapter>}
window.OperatorFlowChapter=OperatorFlowChapter;
