// AURA Local Brain: answers common questions instantly without any AI provider.
// Returns null when the question needs a real model.

const isTelugu = (s: string) => /[\u0C00-\u0C7F]/.test(s) || /\b(nuvvu|enti|eanti|ela|cheppu|evaru|ninnu|unnav|chey)\b/i.test(s);

function istNow() {
  return new Date(Date.now() + 5.5 * 3600 * 1000);
}

export function safeMath(expr: string): number | null {
  const e = expr.replace(/\s+/g, "").replace(/x|×/gi, "*").replace(/÷/g, "/");
  if (!/^[\d+\-*/().%^]+$/.test(e) || !/\d/.test(e) || !/\d[+\-*/%^]/.test(e)) return null;
  let i = 0;
  const num = (): number => {
    if (e[i] === "(") { i++; const v = add(); if (e[i++] !== ")") throw 0; return v; }
    if (e[i] === "-") { i++; return -pow(); }
    const m = e.slice(i).match(/^\d+(\.\d+)?/);
    if (!m) throw 0;
    i += m[0].length;
    return +m[0];
  };
  const pow = (): number => { const b = num(); if (e[i] === "^") { i++; return b ** pow(); } return b; };
  const mul = (): number => {
    let v = pow();
    while ("*/%".includes(e[i] ?? "x")) { const o = e[i++]; const r = pow(); v = o === "*" ? v * r : o === "/" ? v / r : v % r; }
    return v;
  };
  const add = (): number => {
    let v = mul();
    while (e[i] === "+" || e[i] === "-") { const o = e[i++]; const r = mul(); v = o === "+" ? v + r : v - r; }
    return v;
  };
  try {
    const v = add();
    return i === e.length && Number.isFinite(v) ? Math.round(v * 1e10) / 1e10 : null;
  } catch {
    return null;
  }
}

export function localAnswer(raw: string): string | null {
  const q = raw.trim();
  if (!q || q.length > 160) return null;
  const s = q.toLowerCase().replace(/[?!.]+$/, "").trim();
  const te = isTelugu(q);

  // Greetings
  if (/^(hi|hello|hey|hii+|namaste|namaskaram|హాయ్|హలో|నమస్తే|నమస్కారం)( aura)?$/.test(s))
    return te ? "నమస్కారం! నేను AURA. మీకు ఈ రోజు ఎలా సహాయం చేయగలను?" : "Hello! I'm AURA. How can I help you today?";
  if (/^(good (morning|afternoon|evening|night)|gm|gn)$/.test(s))
    return te ? "శుభోదయం! మీకు ఏం కావాలో చెప్పండి." : `${q.replace(/^\w/, (c) => c.toUpperCase())}! What can I do for you?`;
  if (/^(how are you|ela unnav|ela unnavu|ఎలా ఉన్నావ్|ఎలా ఉన్నారు)/.test(s))
    return te ? "నేను బాగున్నాను, ధన్యవాదాలు! మీకు ఏం సహాయం కావాలి?" : "I'm doing great, thanks! What can I help you with?";
  if (/^(thanks|thank you|thx|ty|dhanyavadalu|ధన్యవాదాలు|థాంక్యూ|tq)( aura)?$/.test(s))
    return te ? "సంతోషం! ఇంకేమైనా కావాలంటే అడగండి." : "You're welcome! Ask anytime.";
  if (/^(bye|goodbye|see you|tata)$/.test(s)) return te ? "సరే, మళ్ళీ కలుద్దాం!" : "Goodbye! See you soon.";

  // Identity
  if (/(who (are|r) you|what is your name|your name|nuvvu evaru|nee peru|నువ్వు ఎవరు|నీ పేరు)/.test(s))
    return te
      ? "నేను AURA — దీపక్ తయారుచేసిన AI సహాయకుడిని. చాట్, వాయిస్, కోడింగ్, చదువు, వెబ్‌సైట్ బిల్డింగ్, ల్యాప్‌టాప్ పనుల్లో సహాయం చేస్తాను."
      : "I'm AURA, an AI assistant created by Deepak. I help with chat, voice, coding, study, building websites and laptop tasks.";
  if (/(who (made|created|built) you|your (creator|owner)|ninnu evaru|నిన్ను ఎవరు|who is deepak|deepak evaru)/.test(s))
    return te ? "నన్ను దీపక్ తయారుచేశారు. ఆయనే AURA సృష్టికర్త." : "I was created by Deepak, the founder of AURA.";
  if (/(what can you do|your features|em cheyagalav|eam cheyagalav|ఏం చేయగలవు)/.test(s))
    return te
      ? "నేను చేయగలవి:\n- తెలుగు/ఇంగ్లీష్ చాట్ & వాయిస్\n- PDF, ఫోటోలు, కోడ్ విశ్లేషణ\n- చదువు: నోట్స్, సమ్మరీలు\n- పూర్తి వెబ్‌సైట్లు/యాప్‌లు తయారీ\n- AURA Desktop తో ల్యాప్‌టాప్ కంట్రోల్: https://aura-si.lovable.app/download"
      : "I can:\n- Chat and talk in English/Telugu\n- Read PDFs, images and code\n- Help you study with notes and summaries\n- Build complete websites and apps\n- Control your laptop with AURA Desktop: https://aura-si.lovable.app/download";

  // Time / date
  if (/^(what('s| is) the )?time( now)?$|time enta|టైమ్ ఎంత|samayam/.test(s)) {
    const t = istNow().toISOString().slice(11, 16);
    return te ? `ఇప్పుడు సమయం ${t} (IST).` : `It's ${t} IST.`;
  }
  if (/^(what('s| is) )?(today'?s )?date( today)?$|date enta|తేదీ|ఈ రోజు డేట్/.test(s)) {
    const d = istNow().toISOString().slice(0, 10);
    return te ? `ఈ రోజు తేదీ ${d}.` : `Today's date is ${d}.`;
  }

  // Math
  const m = s.replace(/^(what is|what's|calculate|solve|enta|ఎంత)\s*/, "").replace(/\s*(enta|ఎంత|=)$/, "");
  const sq = m.match(/^(?:square root of|sqrt)\s*\(?(\d+(?:\.\d+)?)\)?$/);
  if (sq) return `√${sq[1]} = ${Math.round(Math.sqrt(+sq[1]) * 1e6) / 1e6}`;
  const pc = m.match(/^(\d+(?:\.\d+)?)\s*% of\s*(\d+(?:\.\d+)?)$/);
  if (pc) return `${pc[1]}% of ${pc[2]} = ${Math.round(+pc[1] * +pc[2]) / 100}`;
  const v = safeMath(m);
  if (v !== null) return `${m.replace(/\s+/g, " ")} = ${v}`;

  // Unit conversion
  const c = m.match(/^(-?\d+(?:\.\d+)?)\s*(c|celsius|f|fahrenheit|km|mi|miles|kg|lb|lbs)\s+(?:to|in)\s+(c|celsius|f|fahrenheit|km|mi|miles|kg|lb|lbs)$/);
  if (c) {
    const n = +c[1], a = c[2][0], b = c[3][0];
    const r =
      a === "c" && b === "f" ? n * 9 / 5 + 32 :
      a === "f" && b === "c" ? (n - 32) * 5 / 9 :
      a === "k" && b === "m" ? n * 0.621371 :
      a === "m" && b === "k" ? n / 0.621371 :
      a === "k" && b === "l" ? n * 2.20462 :
      a === "l" && b === "k" ? n / 2.20462 : null;
    if (r !== null) return `${n} ${c[2]} = ${Math.round(r * 100) / 100} ${c[3]}`;
  }
  return null;
}
