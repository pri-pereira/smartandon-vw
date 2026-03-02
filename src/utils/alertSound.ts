/**
 * alertSound.ts
 * Gera alertas sonoros usando Web Audio API.
 * Não requer arquivos de áudio externos — o som é sintetizado pelo browser.
 *
 * Política de autoplay: navegadores modernos exigem interação do usuário
 * antes de permitir áudio. O AudioContext é criado na primeira chamada,
 * após o usuário já ter interagido com a página (clique no login, etc.).
 */

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext => {
    if (!ctx || ctx.state === "closed") {
        ctx = new AudioContext();
    }
    // Resume se estiver suspenso (política de autoplay)
    if (ctx.state === "suspended") {
        ctx.resume();
    }
    return ctx;
};

/**
 * Toca um tom puro por uma duração especificada.
 * @param freq - Frequência em Hz
 * @param duration - Duração em segundos
 * @param startAt - Momento de início (relativo ao AudioContext.currentTime)
 * @param volume - Volume (0-1)
 * @param type - Tipo de onda
 */
const playTone = (
    freq: number,
    duration: number,
    startAt: number,
    volume = 0.4,
    type: OscillatorType = "sine"
) => {
    const context = getCtx();
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.connect(gain);
    gain.connect(context.destination);

    osc.type = type;
    osc.frequency.value = freq;

    // Envelope suave para evitar cliques
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
};

/**
 * Alerta sonoro para NOVO PEDIDO na logística.
 * Padrão: dois tons ascendentes "ding-dong" com urgência moderada.
 */
export const playNewOrderAlert = () => {
    try {
        const context = getCtx();
        const now = context.currentTime;

        // Ding (nota mais alta)
        playTone(880, 0.25, now, 0.45);
        // Dong (nota de resolução)
        playTone(660, 0.4, now + 0.28, 0.35);
    } catch (err) {
        // Falha silenciosa — som é melhoria progressiva, não bloqueante
        console.warn("[AlertSound] Não foi possível reproduzir o alerta:", err);
    }
};

/**
 * Alerta sonoro URGENTE (quando o chamado está crítico / SLA estourado).
 * Padrão: três bipes rápidos de aviso.
 */
export const playUrgentAlert = () => {
    try {
        const context = getCtx();
        const now = context.currentTime;

        [0, 0.2, 0.4].forEach((offset) => {
            playTone(1100, 0.15, now + offset, 0.5, "square");
        });
    } catch (err) {
        console.warn("[AlertSound] Não foi possível reproduzir o alerta urgente:", err);
    }
};
