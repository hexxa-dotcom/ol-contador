// Substitui o beep antigo (2 notas, um oscilador só pulando de frequência no
// meio do som — causava aquele "clique" metálico) por um arpejo suave de 3
// notas, cada uma com seu próprio envelope e um filtro passa-baixa pra tirar
// a aspereza. Reaproveita um único AudioContext em vez de criar um novo a
// cada toque (o código anterior nunca fechava o context criado).
let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new Ctor();
  if (sharedContext.state === "suspended") void sharedContext.resume();
  return sharedContext;
}

function playTone(context: AudioContext, freq: number, start: number, duration: number, peakGain: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2600;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(filter).connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

// Aviso geral (notificação nova, mensagem nova do cliente): tríade maior
// C5-E5-G5 em cascata, suave — usado pelo sino de notificações e pelo chat.
export function playNotificationChime() {
  try {
    const context = getAudioContext();
    if (!context) return;
    [523.25, 659.25, 783.99].forEach((freq, index) =>
      playTone(context, freq, context.currentTime + index * 0.09, 0.24, 0.055),
    );
  } catch {
    /* alguns navegadores exigem interação antes do áudio */
  }
}

// Aviso do cronômetro de atendimento: dois toques curtos na mesma nota — mais
// discreto que o beep único e estridente de antes, mas ainda diferenciável
// do chime de mensagem nova.
export function playTimerWarningSound() {
  try {
    const context = getAudioContext();
    if (!context) return;
    playTone(context, 740, context.currentTime, 0.16, 0.06);
    playTone(context, 740, context.currentTime + 0.22, 0.16, 0.06);
  } catch {
    /* alguns navegadores exigem interação antes do áudio */
  }
}
