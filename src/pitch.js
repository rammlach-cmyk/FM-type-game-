// Visual interpolation only. This module never changes simulation RNG or match outcomes.
export function formationPoints(formation) {
  const lines=formation.split('-').map(Number);const points=[[.5,.9]];
  lines.forEach((count,row)=>{for(let i=0;i<count;i++)points.push([(i+1)/(count+1),.73-row*(.55/(lines.length-1))]);});return points;
}
export function startPitch(canvas,getMatch,getState,isPlaying=()=>true) {
  const ctx=canvas.getContext('2d');if(!ctx)return ()=>{};
  let stopped=false,frame=0,lastTime=0,visualTime=0;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function draw(time){if(stopped)return;frame=requestAnimationFrame(draw);if(document.hidden||time-lastTime<(reduced?300:33))return;const elapsed=Math.min(60,time-lastTime);lastTime=time;if(isPlaying())visualTime+=elapsed;
    const m=getMatch(),s=getState();if(!m||!s)return;
    const width=Math.min(1000,canvas.clientWidth*devicePixelRatio),height=width/1.55;
    if(canvas.width!==Math.round(width)||canvas.height!==Math.round(height)){canvas.width=Math.round(width);canvas.height=Math.round(height);}
    const w=canvas.width,h=canvas.height,pad=w*.065,pw=w-pad*2,ph=h-pad*2;
    ctx.fillStyle='#13362b';ctx.fillRect(0,0,w,h);
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#174132':'#193d30';ctx.fillRect(pad+i*pw/10,pad,pw/10,ph);}
    ctx.strokeStyle='#9ecdbb55';ctx.lineWidth=1.2*devicePixelRatio;
    ctx.strokeRect(pad,pad,pw,ph);ctx.beginPath();ctx.moveTo(w/2,pad);ctx.lineTo(w/2,h-pad);ctx.stroke();
    ctx.beginPath();ctx.arc(w/2,h/2,ph*.16,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(w/2,h/2,2*devicePixelRatio,0,Math.PI*2);ctx.fillStyle='#92baab';ctx.fill();
    for(const side of [0,1]){const x=side===0?pad:w-pad;ctx.strokeRect(side===0?x:x-pw*.16,h/2-ph*.3,pw*.16,ph*.6);ctx.strokeRect(side===0?x:x-pw*.055,h/2-ph*.15,pw*.055,ph*.3);ctx.strokeRect(side===0?x-7*devicePixelRatio:x,h/2-ph*.065,7*devicePixelRatio,ph*.13);}
    const t=reduced?m.minute*.03:visualTime*.00065,locations=[[],[]];
    const sideOnBall=m.lastEvent?.side??(m.possessionTicks[0]>m.possessionTicks[1]?0:1);
    for(let side=0;side<2;side++){
      const color=s.clubs.find(c=>c.id===m.teams[side]).color;
      const pts=formationPoints(m.tactics[side].formation);
      pts.forEach(([px,py],i)=>{
        if(!m.lineups[side][i]){locations[side].push(null);return;}
        const ownX=(1-py)*.68+.02;const shift=i===0?0:(sideOnBall===side?.035:-.015);
        let x=pad+pw*(side===0?ownX+shift:1-ownX-shift),y=pad+ph*px;
        if(i!==0){x+=Math.sin(t+i*1.7+side)*pw*.018;y+=Math.cos(t*.7+i*1.3)*ph*.025;}
        locations[side].push([x,y]);ctx.beginPath();ctx.arc(x,y,w*.0135,0,Math.PI*2);ctx.fillStyle=i===0?'#e7c86f':color;ctx.fill();ctx.lineWidth=1.5*devicePixelRatio;ctx.strokeStyle='#0a251c';ctx.stroke();
        ctx.fillStyle='#10231b';ctx.font=`700 ${Math.round(w*.012)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x,y);
      });
    }
    const event=m.lastEvent;const shooterIndex=event?.playerId?m.lineups[sideOnBall].indexOf(event.playerId):-1;
    const point=locations[sideOnBall][shooterIndex>0?shooterIndex:5]||locations[sideOnBall].find(Boolean),next=locations[sideOnBall][8]||locations[sideOnBall].filter(Boolean).at(-1);
    const mix=reduced?.3:(Math.sin(t*2)+1)/2;
    let bx=point[0]+(next[0]-point[0])*mix,by=point[1]+(next[1]-point[1])*mix;
    if(event?.type==='goal'||event?.type==='shot'){const goalX=sideOnBall===0?w-pad:pad;bx=point[0]+(goalX-point[0])*mix;by=point[1]+(h/2-point[1])*mix;}
    ctx.beginPath();ctx.arc(bx,by,w*.0065,0,Math.PI*2);ctx.fillStyle='#fff';ctx.shadowColor='#0008';ctx.shadowBlur=5;ctx.fill();ctx.shadowBlur=0;
    ctx.font=`500 ${Math.round(w*.015)}px system-ui`;ctx.textAlign='left';ctx.fillStyle='#a0c5b6';ctx.fillText('2D EVENT VIEW',pad,h-pad*.42);ctx.textAlign='right';ctx.fillText('T O U C H L I N E',w-pad,h-pad*.42);
  }
  frame=requestAnimationFrame(draw);return ()=>{stopped=true;cancelAnimationFrame(frame);};
}
