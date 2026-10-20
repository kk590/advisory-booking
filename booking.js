/* supabase helpers */
const SUPABASE_URL=(window.SUPABASE_URL||"").trim();
const SUPABASE_ANON_KEY=(window.SUPABASE_ANON_KEY||"").trim();
let _sb=null;
function getSupabase(){if(_sb)return _sb;if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!window.supabase)return null;try{_sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY)}catch(e){console.warn(e)}return _sb}
async function supabaseUpsertBooking(booking){const sb=getSupabase();if(!sb)return false;try{const row={txn_id:booking.txnId,booking_id:booking.bookingId||booking.id,name:booking.name,email:booking.email,phone:booking.phone,duration:booking.duration,date:booking.date,time:booking.time,amount:booking.amount,status:booking.status||"PENDING",upi_note:booking.upiNote||"",meet_link:booking.meetLink||"",created_at:booking.at||new Date().toISOString()};const{error}=await sb.from("bookings").upsert(row,{onConflict:"txn_id"});if(error){console.warn("supabase upsert",error);return false}return true}catch(e){console.warn(e);return false}}
async function supabaseUpdateStatus(txnId,status,meetLink){const sb=getSupabase();if(!sb||!txnId)return false;try{const patch={status};if(meetLink)patch.meet_link=meetLink;const{error}=await sb.from("bookings").update(patch).eq("txn_id",String(txnId));if(error){console.warn("supabase update",error);return false}return true}catch(e){console.warn(e);return false}}
function resolveMeetLink(time,duration){return (CONFIG.meetLinks&&CONFIG.meetLinks[time])||(CONFIG.meetLinks&&CONFIG.meetLinks[String(duration)])||CONFIG.defaultMeetLink||""}
const CONFIG={vpa:"kkrakshan2006@okaxis",payeeName:"Rakshan Kamalakannan",currency:"INR",prices:{15:500,30:1000},notifyEmail:"",webhookUrl:"",defaultMeetLink:"https://meet.google.com/xvu-hssb-nem",meetLinks:{"15:00":"https://meet.google.com/xvu-hssb-nem","16:00":"https://meet.google.com/xvu-hssb-nem"},titles:{15:"Quick Chat (15 min)",30:"Guided Session (30 min)"},
schedule:{0:[[15*60,17*60]],1:[[15*60,17*60]],2:[[15*60,17*60]],3:[[15*60,17*60]],4:[[15*60,17*60]],5:[[15*60,17*60]],6:[[15*60,17*60]]}};
const state={duration:null,date:null,time:null,details:null,bookingId:null,txnId:null};
const $=s=>document.querySelector(s);
const fmtINR=n=>"₹"+Number(n).toLocaleString("en-IN");
function getCurrentAmount(){return CONFIG.prices[state.duration]}
function generateTxnId(){return String(Date.now())}
function generateBookingId(){const t=Date.now().toString(36).toUpperCase();const r=Math.random().toString(36).slice(2,6).toUpperCase();return "RKK-"+t+"-"+r}
function sanitizeNotePart(s,max){return String(s||"").replace(/[^a-zA-Z0-9]/g,"").slice(0,max||20)}
function buildUpiNote(txnId,phone,name){return "BOOKING-"+txnId+"-"+sanitizeNotePart(phone,13)+"-"+sanitizeNotePart(name,20)}
function buildUpiUrl(amount,note){return "upi://pay?pa="+encodeURIComponent(CONFIG.vpa)+"&pn="+encodeURIComponent(CONFIG.payeeName)+"&am="+amount+"&cu=INR&tn="+encodeURIComponent(note)}
const stageLabels={1:"STAGE: DURATION_VALIDATION",2:"STAGE: TEMPORAL_ALLOCATION",3:"STAGE: CLIENT_DOSSIER",4:"STAGE: UPI_SETTLEMENT",5:"STAGE: CONFIRMED"};
function goTo(step){document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));$("#panel-"+step).classList.add("active");document.querySelectorAll("#stepIndicator .step-item").forEach(li=>{const s=+li.dataset.step;li.classList.toggle("active",s===step);li.classList.toggle("done",s<step);const marker=li.querySelector(".step-label span:last-child");if(marker)marker.textContent=s<step?"✓":s===step?"●":"○"});$("#stageLabel").textContent=stageLabels[step]||"";if(step>=2&&state.duration){$("#manifestBanner").style.display="flex";$("#manifestTitle").textContent=CONFIG.titles[state.duration];$("#manifestMeta").textContent=fmtINR(getCurrentAmount())+" · Google Meet · 1-on-1 · IST"}else{$("#manifestBanner").style.display="none"}window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>goTo(+b.dataset.goto)));
$("#price-15").textContent=fmtINR(CONFIG.prices[15]);$("#price-30").textContent=fmtINR(CONFIG.prices[30]);
document.querySelectorAll(".duration-card").forEach(card=>card.addEventListener("click",()=>{state.duration=+card.dataset.duration;state.date=null;state.time=null;$("#slots").innerHTML='<p style="color:var(--muted);font-size:12px;">Select a date to see slots.</p>';$("#slotsTitle").textContent="Select a date";goTo(2)}));
const calendar=new FullCalendar.Calendar($("#calendar"),{initialView:"dayGridMonth",height:"auto",headerToolbar:{left:"prev,next",center:"title",right:""},selectable:true,validRange:{start:new Date().toISOString().slice(0,10)},dateClick:info=>selectDate(info.dateStr)});calendar.render();
function selectDate(dateStr){state.date=dateStr;state.time=null;const d=new Date(dateStr+"T00:00:00");$("#slotsTitle").textContent=d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",timeZone:"Asia/Kolkata"});renderSlots()}
function getBookedSlotsForDate(dateStr){const set=new Set();try{JSON.parse(localStorage.getItem("bookings")||"[]").forEach(b=>{if(b.date===dateStr&&(b.status==="PENDING"||b.status==="pending"||b.status==="confirmed"||b.status==="CONFIRMED"||b.status==="PAID"))set.add(b.time)})}catch(_){}return set}
function renderSlots(){const box=$("#slots");if(!state.date)return;const dur=state.duration||30;const dayOfWeek=new Date(state.date+"T12:00:00").getDay();const windows=CONFIG.schedule[dayOfWeek]||CONFIG.schedule[1]||[];const booked=getBookedSlotsForDate(state.date);const todayStr=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});const isToday=state.date===todayStr;const now=new Date();const nowMin=isToday?now.getHours()*60+now.getMinutes():-1;let html="";for(const[wStart,wEnd]of windows){for(let m=wStart;m+dur<=wEnd;m+=dur){const hh=String(Math.floor(m/60)).padStart(2,"0");const mm=String(m%60).padStart(2,"0");const t=hh+":"+mm;const past=isToday&&m<=nowMin+5;const taken=booked.has(t);const disabled=past||taken;html+=`<button type="button" class="slot" data-time="${t}" ${disabled?"disabled":""}>${t}${taken?" · taken":""}</button>`}}if(!html)html='<p style="color:var(--muted);font-size:12px;">No slots available for this day.</p>';box.innerHTML=html;box.querySelectorAll(".slot:not([disabled])").forEach(btn=>btn.addEventListener("click",()=>{box.querySelectorAll(".slot").forEach(b=>b.classList.remove("selected"));btn.classList.add("selected");state.time=btn.dataset.time;setTimeout(()=>goTo(3),200)}))}
$("#detailsForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.target);const d=Object.fromEntries(fd.entries());const name=(d.name||"").trim();const email=(d.email||"").trim();const phone=(d.phone||"").replace(/\s+/g,"");$("#formError").textContent="";if(!name){$("#formError").textContent="Name is required.";return}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$("#formError").textContent="Enter a valid email.";return}if(!/^\+?[0-9]{10,13}$/.test(phone)){$("#formError").textContent="Enter a valid phone (10–13 digits).";return}state.details={name,email,phone};$("#summaryChip").textContent=CONFIG.titles[state.duration]+" · "+state.date+" "+state.time+" IST · "+fmtINR(getCurrentAmount());setupPayment();goTo(4)});
function setupPayment(){const amount=getCurrentAmount();state.txnId=generateTxnId();state.bookingId=generateBookingId();const note=buildUpiNote(state.txnId,state.details.phone,state.details.name);const upi=buildUpiUrl(amount,note);$("#payAmount").textContent=fmtINR(amount);try{$("#paySessionTitle").textContent=CONFIG.titles[state.duration]||"-";$("#payDate").textContent=state.date||"-";$("#payTime").textContent=(state.time||"-")+" IST";$("#payName").textContent=state.details.name||"-";$("#payEmail").textContent=state.details.email||"-";$("#payPhone").textContent=state.details.phone||"-"}catch(_){}$("#upiString").textContent=upi;$("#payUpiBtn").href=upi;$("#qr").innerHTML="";const img=document.createElement("img");img.width=180;img.height=180;img.alt="UPI QR";img.src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data="+encodeURIComponent(upi);$("#qr").appendChild(img);$("#waitingBox").style.display="none";$("#payUpiBtn").disabled=false;$("#payUpiBtn").textContent="Pay via UPI App"}
$("#payUpiBtn").addEventListener("click",e=>{if(!state.details||!state.duration||!state.date||!state.time){e.preventDefault();alert("Missing booking details.");return}const amount=getCurrentAmount();const txnId=state.txnId||generateTxnId();const bookingId=state.bookingId||generateBookingId();state.txnId=txnId;state.bookingId=bookingId;const note=buildUpiNote(txnId,state.details.phone,state.details.name);const upi=buildUpiUrl(amount,note);$("#payUpiBtn").href=upi;const meetLink=resolveMeetLink(state.time,state.duration);const booking={txnId,id:bookingId,bookingId,studio:CONFIG.payeeName,name:state.details.name,email:state.details.email,phone:state.details.phone,duration:state.duration,date:state.date,time:state.time,amount,status:"PENDING",paymentStatus:"PENDING",upiNote:note,meetLink,at:new Date().toISOString(),timezone:"Asia/Kolkata"};localStorage.setItem("pending_booking",JSON.stringify(booking));
const bookings=JSON.parse(localStorage.getItem("bookings")||"[]");bookings.push(booking);localStorage.setItem("bookings",JSON.stringify(bookings));
try{const inbox=JSON.parse(localStorage.getItem("rkk_admin_inbox")||"[]");inbox.unshift(booking);localStorage.setItem("rkk_admin_inbox",JSON.stringify(inbox.slice(0,200)));localStorage.setItem("rkk_admin_inbox_ts",String(Date.now()));}catch(_){}
try{supabaseUpsertBooking(booking)}catch(_){}
try{if(typeof BroadcastChannel!=="undefined"){const ch=new BroadcastChannel("rkk_bookings");ch.postMessage({type:"pending",booking});}}catch(_){}
const waitBox=$("#waitingBox");waitBox.style.display="block";$("#waitMeta").textContent=CONFIG.titles[state.duration]+" · "+state.date+" "+state.time+" IST · "+fmtINR(amount);$("#bookingRef").textContent="TxnId "+txnId+" · "+bookingId;e.currentTarget.disabled=true;e.currentTarget.textContent="UPI Opened — Pending…";renderSlots()});
async function pollRemoteStatus(){if(!state.bookingId&&!state.txnId)return;try{const list=JSON.parse(localStorage.getItem("bookings")||"[]");const local=list.find(b=>(state.txnId&&String(b.txnId)===String(state.txnId))||(state.bookingId&&(String(b.id)===String(state.bookingId)||String(b.bookingId)===String(state.bookingId))));if(local&&["CONFIRMED","confirmed","PAID","paid","verified","VERIFIED"].includes(String(local.status||local.paymentStatus||""))){markConfirmed();return}}catch(_){}try{const res=await fetch("payment_status.json?t="+Date.now(),{cache:"no-store"});if(!res.ok)return;const data=await res.json();const matchId=data&&(String(data.id)===String(state.bookingId)||String(data.txnId)===String(state.txnId)||String(data.bookingId)===String(state.bookingId));const ok=data&&matchId&&["verified","paid","PAID","VERIFIED","CONFIRMED","confirmed"].includes(String(data.status));if(ok)markConfirmed()}catch(_){}}
function markConfirmed(){if(window.__payCheckInterval){clearInterval(window.__payCheckInterval);window.__payCheckInterval=null}const amount=getCurrentAmount();const meetLink=resolveMeetLink(state.time,state.duration);try{const list=JSON.parse(localStorage.getItem("bookings")||"[]");const idx=list.findIndex(b=>b.id===state.bookingId||b.txnId===state.txnId);if(idx>=0){list[idx].status="CONFIRMED";list[idx].paymentStatus="CONFIRMED";list[idx].meetLink=meetLink;localStorage.setItem("bookings",JSON.stringify(list));try{const inbox=JSON.parse(localStorage.getItem("rkk_admin_inbox")||"[]").map(x=>{if(String(x.txnId)===String(state.txnId)||String(x.id)===String(state.bookingId)||String(x.bookingId)===String(state.bookingId)){x.status="CONFIRMED";x.paymentStatus="CONFIRMED";x.meetLink=meetLink}return x});localStorage.setItem("rkk_admin_inbox",JSON.stringify(inbox))}catch(_){}}}catch(_){}try{supabaseUpdateStatus(state.txnId,"CONFIRMED",meetLink)}catch(_){}
$("#confirmMsg").textContent="Payment verified. Your session is confirmed for "+state.date+" at "+state.time+" IST.";$("#finalSummary").textContent=CONFIG.titles[state.duration]+" · "+state.date+" at "+state.time+" · "+fmtINR(amount)+" · CONFIRMED · TxnId "+(state.txnId||"")+" · "+(state.bookingId||"");$("#finalMeetLink").href=meetLink;goTo(5)}
function downloadReceiptPdf(ev){if(ev){ev.preventDefault();ev.stopPropagation()}try{generateFilledReceiptPdf()}catch(_){generateFilledReceiptPdf()}}
function generateFilledReceiptPdf(){
try{
  var JsPDFCtor=(window.jspdf&&window.jspdf.jsPDF)||window.jsPDF||(window.jspdf&&window.jspdf.default);
  if(typeof JsPDFCtor!=="function"){alert("PDF library not loaded. Refresh and try again.");return}
  var amount=state.duration?getCurrentAmount():"";
  var meetLink=(typeof resolveMeetLink==="function"?resolveMeetLink(state.time,state.duration):"")||(CONFIG.defaultMeetLink||"");
  var companyName="Rakshan Kamalakannan";
  var companyUrl="https://landing-page-three-ochre-80.vercel.app/";
  var currency="INR ";
  var serviceTitle=(CONFIG.titles&&CONFIG.titles[state.duration])||"Consultation Session";
  var serviceDesc=state.duration===15?"Quick chat: multi-agent AI, SaaS, or simple AI tools.":"Guided session: multi-agent AI, SaaS, performance, or beginner-friendly AI tools.";
  var scheduled=(state.date||"-")+" "+(state.time||"-")+" IST";
  var created=new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})+" IST";
  var bookingId=state.bookingId||"-";
  var txnId=state.txnId||"-";
  var clientName=(state.details&&state.details.name)||"-";
  var clientEmail=(state.details&&state.details.email)||"-";
  var clientPhone=(state.details&&state.details.phone)||"-";
  var dur=state.duration?state.duration+" mins":"-";
  var status="CONFIRMED";
  var doc=new JsPDFCtor({unit:"pt",format:"a4"});
  var W=doc.internal.pageSize.getWidth();
  var H=doc.internal.pageSize.getHeight();
  var left=40, right=W-40, y=40;
  doc.setFillColor(5,5,5);
  doc.rect(0,0,W,H,"F");
  doc.setTextColor(212,175,55);
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text("RK", left, y+8);
  doc.setFontSize(11);
  doc.setTextColor(244,244,245);
  doc.text(companyName, left+32, y);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.setTextColor(161,161,170);
  doc.text(companyUrl, left+32, y+12);
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.setTextColor(244,244,245);
  doc.text("PAYMENT RECEIPT", right, y, {align:"right"});
  doc.setFillColor(30,50,40);
  doc.setDrawColor(110,231,183);
  doc.roundedRect(right-110, y+10, 110, 18, 3, 3, "FD");
  doc.setTextColor(110,231,183);
  doc.setFontSize(9);
  doc.text("OK  "+status, right-55, y+22, {align:"center"});
  y=80;
  var cardW=(right-left-12)/2;
  var cardH=95;
  doc.setFillColor(17,17,19);
  doc.setDrawColor(51,51,54);
  doc.roundedRect(left, y, cardW, cardH, 4, 4, "FD");
  doc.roundedRect(left+cardW+12, y, cardW, cardH, 4, 4, "FD");
  doc.setFont("helvetica","bold");
  doc.setFontSize(9);
  doc.setTextColor(212,175,55);
  doc.text("BOOKING DETAILS", left+12, y+18);
  doc.text("CLIENT INFORMATION", left+cardW+24, y+18);
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  function kv(x, yy, k, v){doc.setTextColor(161,161,170);doc.text(k, x, yy);doc.setTextColor(244,244,245);doc.text(String(v), x+78, yy);}
  kv(left+12, y+36, "Booking ID:", bookingId);
  kv(left+12, y+50, "Created Date:", created);
  kv(left+12, y+64, "Txn ID:", txnId);
  kv(left+12, y+78, "Test Mode:", "No");
  kv(left+cardW+24, y+36, "Name:", clientName);
  kv(left+cardW+24, y+50, "Email:", clientEmail);
  kv(left+cardW+24, y+64, "Phone:", clientPhone);
  y += cardH + 16;
  doc.setFillColor(26,26,28);
  doc.rect(left, y, right-left, 22, "F");
  doc.setTextColor(212,175,55);
  doc.setFont("helvetica","bold");
  doc.setFontSize(8);
  doc.text("Service Description", left+8, y+14);
  doc.text("Scheduled Date & Time", left+200, y+14);
  doc.text("Duration", left+360, y+14);
  doc.text("Amount", left+430, y+14);
  y += 22;
  doc.setFillColor(17,17,19);
  doc.rect(left, y, right-left, 40, "F");
  doc.setFont("helvetica","bold");
  doc.setFontSize(9);
  doc.setTextColor(244,244,245);
  doc.text(serviceTitle, left+8, y+14);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.setTextColor(161,161,170);
  var descLines=doc.splitTextToSize(serviceDesc, 180);
  doc.text(descLines, left+8, y+26);
  doc.setTextColor(244,244,245);
  doc.setFontSize(9);
  doc.text(scheduled, left+200, y+20);
  doc.text(dur, left+360, y+20);
  doc.setTextColor(212,175,55);
  doc.setFont("helvetica","bold");
  doc.text(currency+Number(amount||0).toLocaleString("en-IN"), left+430, y+20);
  y += 56;
  doc.setDrawColor(212,175,55);
  doc.setLineWidth(1);
  doc.setFillColor(17,17,19);
  doc.roundedRect(left, y, right-left, 48, 4, 4, "FD");
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.setTextColor(244,244,245);
  doc.text("Total Amount Paid", left+12, y+20);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.setTextColor(161,161,170);
  doc.text("Payment status verified successfully", left+12, y+34);
  doc.setFont("helvetica","bold");
  doc.setFontSize(16);
  doc.setTextColor(212,175,55);
  doc.text(currency+Number(amount||0).toLocaleString("en-IN"), right-12, y+30, {align:"right"});
  y += 64;
  doc.setFillColor(17,17,19);
  doc.setDrawColor(51,51,54);
  doc.roundedRect(left, y, right-left, 90, 4, 4, "FD");
  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.setTextColor(212,175,55);
  doc.text("Confirmation Notice:", left+12, y+18);
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.setTextColor(200,200,200);
  var notice="This receipt confirms that the payment of "+currency+Number(amount||0).toLocaleString("en-IN")+" for Booking ID ("+bookingId+") has been marked as "+status+". The calendar invitation for ("+scheduled+") has been scheduled and dispatched to ("+clientEmail+").";
  var nlines=doc.splitTextToSize(notice, right-left-24);
  doc.text(nlines, left+12, y+34);
  doc.setTextColor(212,175,55);
  doc.setFontSize(9);
  doc.text("Google Meet: "+(meetLink||"-"), left+12, y+34+nlines.length*11+8);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.setTextColor(100,100,100);
  doc.text(companyName+"  ·  Payment Receipt", left, H-28);
  doc.text("Page 1 of 1", right, H-28, {align:"right"});
  doc.save("RKK-Payment-Receipt-"+(txnId!=="-"?txnId:Date.now())+".pdf");
}catch(err){console.error(err);alert("Could not generate PDF: "+(err&&err.message?err.message:"error"));}
}
window.__payCheckInterval=setInterval(pollRemoteStatus,4000);
document.addEventListener("click",function(e){var t=e.target;if(!t)return;if(t.id==="downloadReceipt"||(t.closest&&t.closest("#downloadReceipt"))){downloadReceiptPdf(e);}});
$("#bookAgain").addEventListener("click",()=>location.reload());
