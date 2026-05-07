function EdgeHeader({num,title,trigger,actor,impact,accent='amber'}){
  return <div className="row" style={{gap:14,alignItems:'flex-start',marginBottom:14,paddingBottom:12,borderBottom:'1.5px dashed var(--ink-3)'}}>
    <div style={{width:60,height:60,border:'2px solid var(--ink)',background:'var(--paper-2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-marker)',fontSize:26,transform:'rotate(-2deg)'}}>{num}</div>
    <div className="grow">
      <h4 style={{margin:0,fontSize:20}}>{title}</h4>
      <div className="row gap-sm wrap" style={{marginTop:6}}>
        <span className={'chip '+accent+' tiny'}>trigger · {trigger}</span>
        <span className="chip tiny">actor · {actor}</span>
        <span className="chip blue tiny">impact · {impact}</span>
      </div>
    </div>
  </div>
}

function StateTable({rows}){
  return <div className="sk pad-sm" style={{background:'var(--paper-2)'}}>
    <div className="row" style={{gap:8,paddingBottom:4,borderBottom:'1px dashed var(--ink-3)',marginBottom:4}}>
      <span className="mono muted tiny" style={{width:120}}>field</span>
      <span className="mono muted tiny" style={{flex:1}}>before</span>
      <span className="mono muted tiny" style={{flex:1}}>after</span>
    </div>
    {rows.map(([f,b,a,changed],i)=>(
      <div key={i} className="row" style={{gap:8,padding:'3px 0',alignItems:'center'}}>
        <span className="mono muted tiny" style={{width:120}}>{f}</span>
        <span className="mono tiny" style={{flex:1,color:'var(--ink-2)'}}>{b}</span>
        <span className={'mono tiny '+(changed?'':'muted')} style={{flex:1,color:changed?'var(--amber-ink)':'var(--ink-3)',fontWeight:changed?600:400}}>{a}</span>
      </div>
    ))}
  </div>
}

function FlowRow({steps}){
  return <div className="row wrap" style={{gap:0,alignItems:'center'}}>
    {steps.map((s,i)=>{
      const bg=s.state==='done'?'var(--green-soft)':s.state==='active'?'var(--amber-soft)':s.state==='fail'?'var(--red-soft)':'var(--paper)';
      const bc=s.state==='done'?'var(--green)':s.state==='active'?'var(--amber-ink)':s.state==='fail'?'var(--red)':'var(--ink)';
      return <React.Fragment key={i}>
        <div className="sk pad-sm" style={{background:bg,borderColor:bc,minWidth:130,flex:'0 0 auto'}}>
          <div className="mono tiny muted">step {i+1}</div>
          <div style={{fontFamily:'var(--font-marker)',fontSize:14,lineHeight:1.2}}>{s.label}</div>
          {s.note&&<div className="mono muted tiny" style={{marginTop:3}}>{s.note}</div>}
        </div>
        {i<steps.length-1 && <div style={{width:24,textAlign:'center',fontFamily:'var(--font-marker)',fontSize:20,color:'var(--ink-3)'}}>→</div>}
      </React.Fragment>
    })}
  </div>
}

function EdgeCase({num,title,trigger,actor,impact,accent,problem,detection,resolution,flow,stateTable,screens,rules}){
  return <div className="sk-dbl pad-md" style={{marginBottom:24}}>
    <EdgeHeader num={num} title={title} trigger={trigger} actor={actor} impact={impact} accent={accent}/>

    <div className="grid-2" style={{alignItems:'flex-start',marginBottom:14}}>
      <div>
        <div className="mono muted tiny" style={{marginBottom:4}}>— what goes wrong</div>
        <div style={{fontFamily:'var(--font-caveat)',fontSize:18,lineHeight:1.3}}>{problem}</div>
      </div>
      <div>
        <div className="mono muted tiny" style={{marginBottom:4}}>— how we detect it</div>
        <div style={{fontFamily:'var(--font-caveat)',fontSize:18,lineHeight:1.3}}>{detection}</div>
      </div>
    </div>    <div className="mono muted tiny" style={{marginBottom:6}}>— user-visible flow</div>
    <FlowRow steps={flow}/>

    <div className="grid-2" style={{gap:14,marginTop:14,alignItems:'flex-start'}}>
      <div className="col gap-sm">
        <div className="mono muted tiny">— resolution logic</div>
        <div className="callout">{resolution}</div>
        {stateTable && <>
          <div className="mono muted tiny" style={{marginTop:4}}>— data state transition</div>
          <StateTable rows={stateTable}/>
        </>}
        {rules && <>
          <div className="mono muted tiny" style={{marginTop:4}}>— business rules</div>
          <ul style={{margin:0,paddingLeft:18,fontFamily:'var(--font-caveat)',fontSize:17,lineHeight:1.4}}>
            {rules.map((r,i)=><li key={i}>{r}</li>)}
          </ul>
        </>}
      </div>
      <div className="col gap-sm">
        <div className="mono muted tiny">— what the user sees</div>
        <div className="row wrap" style={{gap:14,alignItems:'flex-start'}}>
          {screens}
        </div>
      </div>
    </div>
  </div>
}

function EdgeCasesChapter(){return <Chapter num="03" id="ch-edge" title="Edge cases · six scenarios" desc="Each case documented with problem, detection, state transition, resolution, and the actual UI the operator or traveler sees.">

<EdgeCase
  num="01"
  title="All 3 featured slots are taken"
  trigger="operator picks ‘make featured’"
  actor="operator"
  impact="blocks funnel"
  accent="amber"
  problem="Operator enters the Featured Slot step of trip creation, but all 3 slots for this island are held. The picker has nothing to show."
  detection="Server checks slot_holdings at step render. If count(active)=3 AND no expiring TTLs in next 60s → render waitlist variant."
  flow={[
    {label:'Open slot picker',state:'done'},
    {label:'Server: 3/3 held',state:'fail',note:'block'},
    {label:'Render waitlist view',state:'active',note:'no selectable cards'},
    {label:'Operator picks queue',state:'active'},
    {label:'Publish as standard',state:'done',note:'20% cut'}
  ]}
  resolution="Picker never renders selectable cards. Operator joins FIFO queue for 1+ slots, then must publish trip as standard (20%). When a slot opens they get a 24h claim window (see case 05)."
  stateTable={[
    ['trip.status','draft','published (standard)',true],
    ['trip.commission','—','20%',false],
    ['trip.featured_rank','null','null',false],
    ['waitlist.slot_1','queue: [A,B,C]','queue: [A,B,C,OP]',true],
    ['waitlist.slot_2','queue: [X]','queue: [X,OP]',true]
  ]}
  rules={[
    'Operator can queue for multiple slots simultaneously',
    'Queue position locks at join time · no jumping',
    'Trip must be published to stay queued (no draft-queuing)'
  ]}
  screens={[
    <Phone key="a" label="waitlist view">
      <div style={{padding:6}}>
        <div className="mono muted tiny">Featured slots · Santorini</div>
        <h4 style={{margin:'4px 0'}}>All 3 slots taken</h4>
        <div className="sk pad-sm" style={{background:'var(--red-soft)',borderColor:'var(--red)',marginBottom:6}}>
          <div className="mono tiny" style={{color:'var(--red)'}}>⚠ None available · join queue</div>
        </div>
        <div className="col" style={{gap:4}}>
          {[{r:1,rate:22,q:3,eta:'~9d'},{r:2,rate:25,q:1,eta:'~3d'},{r:3,rate:30,q:0,eta:'—'}].map(s=>(
            <div key={s.r} className="sk pad-sm row" style={{justifyContent:'space-between',alignItems:'center',padding:'4px 6px'}}>
              <span className="mono tiny">#{s.r}·{s.rate}%·q{s.q}·{s.eta}</span>
              <button className="btn ghost" style={{padding:'2px 8px',fontSize:12}}>join</button>
            </div>
          ))}
        </div>
        <button className="btn primary" style={{width:'100%',marginTop:8,padding:'5px',fontSize:13}}>Publish standard →</button>
      </div>
    </Phone>,
    <Phone key="b" label="queue confirm">
      <div style={{padding:6}}>
        <div className="chip violet">queued</div>
        <h4 style={{margin:'6px 0'}}>You're #4 for slot #1</h4>
        <div className="mono muted tiny">ETA ~9 days based on avg hold time</div>
        <div className="line dashed" style={{margin:'10px 0'}}/>
        <div className="mono tiny">We'll notify you by email + push when it's your turn. You'll have 24h to claim.</div>
        <button className="btn amber" style={{width:'100%',marginTop:10}}>Queue for more slots</button>
      </div>
    </Phone>
  ]}
/>

<EdgeCase
  num="02"
  title="Race condition · two operators select the same slot"
  trigger="concurrent submit within ~2s"
  actor="operator A + operator B"
  impact="data integrity"
  accent="red"
  problem="Op A and Op B both see slot #2 as available, both click 'reserve'. Without a lock, both trips get featured_rank=2 — invariant violation."
  detection="Slot picker uses optimistic UI (instant visual hold), but hard-reserve happens at publish with row-level lock: SELECT … FOR UPDATE on slot_holdings."
  flow={[
    {label:'A opens picker',state:'done'},
    {label:'B opens picker',state:'done'},
    {label:'Both see #2 free',state:'active',note:'stale read'},
    {label:'A publishes first',state:'done',note:'DB lock wins'},
    {label:'B gets reject',state:'fail',note:'re-pick modal'}
  ]}
  resolution="Transactional slot reservation at publish time. Loser sees a modal explaining the race, their TTL is cancelled, form state preserved, and the picker re-renders with live availability."
  stateTable={[
    ['slot_2.holder','null','trip_A',true],
    ['slot_2.lock_A','soft (TTL 15m)','hard (confirmed)',true],
    ['slot_2.lock_B','soft (TTL 15m)','cancelled',true],
    ['trip_B.status','pending publish','draft (re-pick)',true]
  ]}
  rules={[
    'Soft-lock is advisory only · never gates other operators',
    'Hard-reserve is atomic · first COMMIT wins',
    'Loser keeps all form data · only the slot choice resets'
  ]}
  screens={[
    <div key="a" className="sk-dbl pad-md" style={{width:280,borderColor:'var(--red)',background:'var(--red-soft)'}}>
      <div className="chip red">conflict</div>
      <h4 style={{marginTop:6}}>Slot #2 just got taken</h4>
      <div style={{fontFamily:'var(--font-caveat)',fontSize:17,marginTop:4}}>Another operator confirmed slot #2 about 3 seconds before you. Your draft is saved — pick a different slot or publish as standard.</div>
      <div className="sk pad-sm" style={{background:'var(--paper)',marginTop:10}}>
        <div className="mono muted tiny">Currently open</div>
        <div className="row gap-sm" style={{marginTop:4}}>
          <span className="chip green tiny">#1 · 22%</span>
          <span className="chip">#2 · 25% taken</span>
          <span className="chip green tiny">#3 · 30%</span>
        </div>
      </div>
      <div className="row" style={{marginTop:10,gap:6,justifyContent:'flex-end'}}>
        <button className="btn ghost">Publish standard</button>
        <button className="btn primary">Pick again</button>
      </div>
    </div>,
    <div key="b" className="col gap-sm" style={{width:220}}>
      <Note color="red" tilt={-2}>B's TTL cancelled instantly — no double hold</Note>
      <Note color="green" tilt={1}>A's slot is hard-reserved atomically</Note>
      <div className="sk pad-sm" style={{background:'var(--paper-2)'}}>
        <div className="mono muted tiny">log</div>
        <div className="mono tiny">12:04:01 A SELECT FOR UPDATE ✓</div>
        <div className="mono tiny">12:04:01 A INSERT rank=2 ✓</div>
        <div className="mono tiny" style={{color:'var(--red)'}}>12:04:03 B INSERT rank=2 ✗ conflict</div>
        <div className="mono tiny">12:04:03 B rollback · reopen picker</div>
      </div>
    </div>
  ]}
/>

<EdgeCase
  num="03"
  title="Editing a live trip · toggling featured off"
  trigger="operator edits featured trip"
  actor="operator"
  impact="destructive · releases slot"
  accent="blue"
  problem="Operator has a live featured trip (slot #2, 25%). They open edit to change title and accidentally flip the featured toggle off. Naively this would silently drop them to 20% and release the slot with no warning."
  detection="Edit diff compares trip.featured_rank before/after. If removing a slot → block save, show destructive confirmation modal."
  flow={[
    {label:'Open edit',state:'done'},
    {label:'Toggle featured off',state:'active'},
    {label:'Confirmation modal',state:'active',note:'destructive'},
    {label:'Confirm → release',state:'fail',note:'→ 20%'},
    {label:'Notify waitlist',state:'done',note:'top of queue'}
  ]}
  resolution="Destructive confirm modal with explicit consequences. On confirm: slot returns to pool, commission drops to 20%, next in queue gets a 24h claim notification (case 05). Cancel → changes discarded."
  stateTable={[
    ['trip.featured_rank','2','null',true],
    ['trip.commission','25%','20%',true],
    ['slot_2.holder','trip_X','null',true],
    ['waitlist.slot_2[0].status','queued','offered (24h)',true]
  ]}
  rules={[
    'Cannot downgrade rank mid-flight · only release entirely',
    'No refund of paid featured fees (explained in modal)',
    'Operator can re-queue but loses FIFO position'
  ]}
  screens={[
    <div key="a" className="sk-dbl pad-md" style={{width:320,background:'var(--paper-2)'}}>
      <div className="chip red">destructive action</div>
      <h4 style={{marginTop:6}}>Release slot #2?</h4>
      <div style={{fontFamily:'var(--font-caveat)',fontSize:17,marginTop:4}}>Your trip "Sunset Sail" will continue selling at the <b>standard 20%</b> commission. Slot #2 returns to the pool and the next operator in queue gets 24h to claim it.</div>
      <div className="sk pad-sm" style={{marginTop:10,background:'var(--red-soft)',borderColor:'var(--red)'}}>
        <div className="mono tiny" style={{color:'var(--red)'}}>✗ Cannot be undone for 7 days</div>
        <div className="mono tiny muted">Paid featured fees are not refunded</div>
      </div>
      <div className="row" style={{marginTop:10,gap:6,justifyContent:'flex-end'}}>
        <button className="btn ghost">Keep slot</button>
        <button className="btn amber">Release →</button>
      </div>
    </div>,
    <Phone key="b" label="post-release">
      <div style={{padding:6}}>
        <div className="chip green">saved</div>
        <h4 style={{margin:'4px 0'}}>Trip updated</h4>
        <div className="sk pad-sm" style={{background:'var(--amber-soft)',borderColor:'var(--amber-ink)',marginTop:4}}>
          <div className="mono tiny" style={{color:'var(--amber-ink)'}}>ℹ Now listed as standard</div>
          <div className="mono muted tiny">Commission: 20% · no featured badge</div>
        </div>
        <div className="line dashed" style={{margin:'10px 0'}}/>
        <div className="mono muted tiny">Re-queue for a slot?</div>
        <div className="col gap-sm" style={{marginTop:4}}>
          <button className="btn ghost" style={{padding:'4px 8px',fontSize:13}}>#1 · 22% · queue 3</button>
          <button className="btn ghost" style={{padding:'4px 8px',fontSize:13}}>#2 · 25% · queue 1</button>
        </div>
      </div>
    </Phone>
  ]}
/>

<EdgeCase
  num="04"
  title="Soft-lock TTL expires mid-creation"
  trigger="15-min inactivity timer runs out"
  actor="operator"
  impact="lose slot mid-flow"
  accent="amber"
  problem="Operator picked slot #2 but paused on the Photos step to upload. 15 minutes later their TTL expires. If they hit publish naively, the system might re-assign the slot to someone else silently."
  detection="Client TTL countdown synced with server. Warning banner at 2:00 remaining, full-screen modal at 0:30."
  flow={[
    {label:'Pick slot #2',state:'done',note:'TTL 15:00'},
    {label:'Warning at 2:00',state:'active',note:'banner'},
    {label:'Modal at 0:30',state:'active',note:'extend/publish'},
    {label:'TTL expires',state:'fail'},
    {label:'Re-validate',state:'active',note:'still free? take it'}
  ]}
  resolution="Two-stage warning (banner → modal). On expiry, form data is preserved and picker re-opens with live state — often the slot is still free and they can re-claim. If taken (case 02), they pick again."
  stateTable={[
    ['slot_2.lock','soft (TTL 0:30)','expired',true],
    ['slot_2.holder','null','null',false],
    ['form.draft_id','draft_abc','draft_abc',false],
    ['form.slot_choice','2','null (re-pick)',true]
  ]}
  rules={[
    'TTL = 15 min · resets on any form interaction',
    'Extending requires active publish flow (anti-hoarding)',
    'Max 1 extension per draft'
  ]}
  screens={[
    <div key="a" className="sk-dbl pad-md" style={{width:280,borderColor:'var(--amber-ink)',background:'var(--amber-soft)'}}>
      <TTLBar remaining={28} total={900}/>
      <div style={{fontFamily:'var(--font-marker)',fontSize:16,color:'var(--amber-ink)',marginTop:10}}>⚠ Slot lock expiring in 30s</div>
      <div style={{fontFamily:'var(--font-caveat)',fontSize:17,marginTop:4}}>Publish now to keep slot #2, or extend if you need more time.</div>
      <div className="row" style={{marginTop:10,gap:6}}>
        <button className="btn amber" style={{flex:1}}>Publish now</button>
        <button className="btn ghost">+5 min</button>
      </div>
    </div>,
    <Phone key="b" label="expired · re-validate">
      <div style={{padding:6}}>
        <div className="chip amber">lock expired</div>
        <h4 style={{margin:'4px 0'}}>Checking slot #2…</h4>
        <div className="sk pad-sm" style={{background:'var(--green-soft)',borderColor:'var(--green)',marginTop:6}}>
          <div className="mono tiny" style={{color:'var(--green)'}}>✓ Still available</div>
          <div className="mono muted tiny">Lock renewed · 15:00</div>
        </div>
        <div className="mono muted tiny" style={{marginTop:8}}>Your draft is intact:</div>
        <div className="sk pad-sm" style={{marginTop:4,background:'var(--paper-2)'}}>
          <div className="mono tiny">✓ Title · Sunset Sail</div>
          <div className="mono tiny">✓ Price · €89</div>
          <div className="mono tiny">✓ 6 photos uploaded</div>
        </div>
        <button className="btn primary" style={{width:'100%',marginTop:8}}>Continue →</button>
      </div>
    </Phone>
  ]}
/>

<EdgeCase
  num="05"
  title="Pre-book activates · 24h claim window"
  trigger="previous slot holder's trip ends"
  actor="queued operator"
  impact="time-sensitive offer"
  accent="violet"
  problem="When a slot holder's featured period ends (trip done / cancelled / released), the top of the waitlist needs to be notified. If they don't respond, the offer needs to bubble down — but we can't lose their queue position unfairly."
  detection="Cron checks slot_holdings for ended trips every minute. On transition: enqueue notification, create offer row with 24h TTL."
  flow={[
    {label:"Holder's trip ends",state:'done'},
    {label:'Offer to #1 in queue',state:'active',note:'email + push'},
    {label:'Accept',state:'done'},
    {label:'Pass (keep pos)',state:'active'},
    {label:'Silent expiry',state:'fail',note:'lose pos'}
  ]}
  resolution="24h claim window with three outcomes: (1) accept → slot assigned, (2) explicit pass → keep position, offer to #2, (3) silent expiry → lose position, offer to #2. Clear differentiation between pass and timeout is critical for fairness."
  stateTable={[
    ['slot_2.holder','trip_X (ended)','trip_Y',true],
    ['waitlist.slot_2[0].status','queued','offered',true],
    ['offer.expires_at','—','now + 24h',true],
    ['waitlist.slot_2[0].position','1','assigned',true]
  ]}
  rules={[
    'Pass = keeps position (next offer when slot re-opens)',
    'Silent expiry = loses position (drops to end of queue)',
    'Accept within 24h or lose the offer'
  ]}
  screens={[
    <Phone key="a" label="push notification">
      <div style={{padding:6}}>
        <div className="sk pad-sm" style={{background:'var(--violet-soft)',borderColor:'var(--violet)'}}>
          <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
            <span className="chip violet tiny">🏝 Island Tours</span>
            <span className="mono muted tiny">now</span>
          </div>
          <div style={{fontFamily:'var(--font-marker)',fontSize:15,marginTop:4}}>Slot #2 is yours to claim</div>
          <div className="mono tiny muted">You have 24h. Tap to accept →</div>
        </div>
        <div className="line dashed" style={{margin:'10px 0'}}/>
        <div className="mono muted tiny">Email + in-app + push sent in parallel</div>
      </div>
    </Phone>,
    <Phone key="b" label="claim screen">
      <div style={{padding:6}}>
        <div className="chip violet">your turn</div>
        <h4 style={{margin:'4px 0'}}>Slot #2 available</h4>
        <div className="sk pad-sm" style={{background:'var(--violet-soft)',borderColor:'var(--violet)',marginTop:6}}>
          <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
            <span className="mono tiny">⏱ Expires in</span>
            <span style={{fontFamily:'var(--font-marker)',fontSize:18,color:'var(--violet)'}}>23h 41m</span>
          </div>
        </div>
        <div className="mono muted tiny" style={{marginTop:8}}>Which trip to feature?</div>
        <div className="col gap-sm" style={{marginTop:4}}>
          {['Sunset Sail','Volcano Hike','Hidden Beaches'].map(t=>(
            <div key={t} className="sk pad-sm row" style={{justifyContent:'space-between',alignItems:'center'}}>
              <span className="mono tiny">{t}</span>
              <input type="radio" name="trip" style={{accentColor:'var(--violet)'}}/>
            </div>
          ))}
        </div>
        <div className="row" style={{marginTop:10,gap:6}}>
          <button className="btn primary" style={{flex:1}}>Accept</button>
          <button className="btn ghost">Pass (keep pos)</button>
        </div>
      </div>
    </Phone>
  ]}
/>

<EdgeCase
  num="06"
  title="Trip deleted or paused while featured"
  trigger="operator deletes OR pauses featured trip"
  actor="operator"
  impact="waitlist + existing bookings"
  accent="amber"
  problem="A featured trip gets deleted or paused. Two sub-cases: (a) hard delete — immediate release, but what about existing bookings? (b) pause — could be temporary, don't want to burn the slot permanently."
  detection="Delete and pause are distinct operator actions with separate flows. Pause has a 48h grace period (configurable)."
  flow={[
    {label:'Delete trip',state:'fail'},
    {label:'Slot released <1s',state:'active',note:'atomic'},
    {label:'Bookings honored',state:'done',note:'no cancel'},
    {label:'Pause · 48h grace',state:'active'},
    {label:'Resume or release',state:'done'}
  ]}
  resolution="DELETE releases slot immediately and notifies waitlist; existing bookings still honored (trip lives in fulfillment-only mode). PAUSE gives 48h grace with visible countdown; un-pause to reclaim, timeout releases to pool."
  stateTable={[
    ['trip.status','featured (live)','deleted / paused',true],
    ['slot.holder','trip_X','null (delete) / trip_X (pause)',true],
    ['bookings.existing','confirmed','confirmed (still valid)',false],
    ['grace_timer','—','now + 48h (pause only)',true]
  ]}
  rules={[
    'Delete: slot released immediately · no recovery',
    'Pause: 48h grace · slot visibly locked to operator',
    'Bookings in either mode are fulfilled as normal',
    'Pause counts against monthly max (anti-abuse)'
  ]}
  screens={[
    <div key="a" className="sk-dbl pad-md" style={{width:280,borderColor:'var(--red)',background:'var(--red-soft)'}}>
      <div className="chip red">delete trip</div>
      <h4 style={{marginTop:6}}>Release immediately</h4>
      <div style={{fontFamily:'var(--font-caveat)',fontSize:17,marginTop:4}}>Slot #2 returns to the pool in &lt;1s. 4 existing bookings will still be fulfilled.</div>
      <div className="sk pad-sm" style={{marginTop:8,background:'var(--paper-2)'}}>
        <div className="mono tiny">✓ 4 bookings honored</div>
        <div className="mono tiny">✓ Slot back in pool</div>
        <div className="mono tiny" style={{color:'var(--red)'}}>✗ No recovery after delete</div>
      </div>
      <div className="row" style={{marginTop:10,gap:6,justifyContent:'flex-end'}}>
        <button className="btn ghost">Cancel</button>
        <button className="btn amber">Delete trip</button>
      </div>
    </div>,
    <div key="b" className="sk-dbl pad-md" style={{width:280,borderColor:'var(--amber-ink)',background:'var(--amber-soft)'}}>
      <div className="chip amber">pause · 48h grace</div>
      <h4 style={{marginTop:6}}>Slot held for 47:52:08</h4>
      <div className="ttl-bar" style={{marginTop:6}}><span style={{width:'96%'}}/></div>
      <div style={{fontFamily:'var(--font-caveat)',fontSize:17,marginTop:8}}>Un-pause any time in the next 48h to keep slot #2. After that, slot returns to the pool.</div>
      <div className="row" style={{marginTop:10,gap:6,justifyContent:'flex-end'}}>
        <button className="btn ghost">Release now</button>
        <button className="btn primary">Resume</button>
      </div>
      <div className="mono muted tiny" style={{marginTop:6}}>2 of 3 monthly pauses used</div>
    </div>
  ]}
/>

</Chapter>}
window.EdgeCasesChapter=EdgeCasesChapter;
