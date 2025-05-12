import { supabase } from '../../js/supabase.js';
import { getUsuarioActual } from '../../js/auth.js';
import { mostrarMensaje } from '../../js/util.js';

const frutas = ['🍒', '🍋', '🍇', '🍉', '🍊', '⭐'];
let usuario = null;

const reel1 = document.getElementById('reel1');
const reel2 = document.getElementById('reel2');
const reel3 = document.getElementById('reel3');
const resultado = document.getElementById('resultado');
const btnJugar = document.getElementById('btnJugar');
const saldoActual = document.getElementById('saldoActual');
const apuestaInput = document.getElementById('apuestaInput');

// Sonidos libres de derechos
const sonidoJackpot = new Audio('https://cdn.mixkit.co/audio/download/3827/'); // win
const sonidoPremio = new Audio('https://cdn.mixkit.co/audio/download/3828/'); // monedas
const sonidoPerder = new Audio('https://cdn.mixkit.co/audio/download/3829/'); // lose
const sonidoGiro = new Audio('https://cdn.mixkit.co/audio/download/3826/'); // puedes cambiarlo por otro de giro

// Cargar sesión y saldo al iniciar
(async () => {
  usuario = await getUsuarioActual();
  if (!usuario) {
    mostrarMensaje('Debes iniciar sesión para jugar');
    location.href = '../../login.html';
    return;
  }
  await actualizarSaldo();
})();

async function actualizarSaldo() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('fichas')
    .eq('id', usuario.id)
    .single();

  if (error) {
    saldoActual.textContent = 'Error al cargar saldo.';
  } else {
    saldoActual.textContent = `Saldo: ${data.fichas} fichas`;
  }
}

// --- Lógica de retención/compensación estilo casino ---

function getModoTragamonedas(apuesta) {
  let jugadas = parseInt(localStorage.getItem('tragamonedas_jugadas') || '0');
  let ganadas = parseInt(localStorage.getItem('tragamonedas_ganadas') || '0');
  let perdidas = parseInt(localStorage.getItem('tragamonedas_perdidas') || '0');
  let acumulado = parseInt(localStorage.getItem('tragamonedas_acumulado') || '0');
  let ultimaApuesta = parseInt(localStorage.getItem('tragamonedas_ultima_apuesta') || '0');

  // Primeras 10 jugadas: más premios chicos
  if (jugadas < 10) return 'enganche';

  // Si sube mucho la apuesta, modo difícil
  if (apuesta > ultimaApuesta * 2 && jugadas > 10) return 'dificil';

  // Muchas pérdidas seguidas: compensar
  if (perdidas >= 5) return 'compensar';

  // Muchas ganadas seguidas o acumulado alto: difícil
  if (ganadas >= 3 || acumulado > 100) return 'dificil';

  // Normal
  return 'normal';
}

function setEstadisticasTragamonedas(ganada, apuesta, premio) {
  let jugadas = parseInt(localStorage.getItem('tragamonedas_jugadas') || '0');
  let ganadas = parseInt(localStorage.getItem('tragamonedas_ganadas') || '0');
  let perdidas = parseInt(localStorage.getItem('tragamonedas_perdidas') || '0');
  let acumulado = parseInt(localStorage.getItem('tragamonedas_acumulado') || '0');

  jugadas++;
  if (ganada) {
    ganadas++;
    perdidas = 0;
    acumulado += (premio - apuesta);
  } else {
    perdidas++;
    acumulado -= apuesta;
  }

  localStorage.setItem('tragamonedas_jugadas', jugadas);
  localStorage.setItem('tragamonedas_ganadas', ganadas);
  localStorage.setItem('tragamonedas_perdidas', perdidas);
  localStorage.setItem('tragamonedas_acumulado', acumulado);
  localStorage.setItem('tragamonedas_ultima_apuesta', apuesta);
}

function generarTiradaLogica(modo) {
  // Devuelve una tirada según el modo
  if (modo === 'enganche') {
    // 30% dos iguales, 5% jackpot, resto perder
    const r = Math.random();
    if (r < 0.05) {
      const f = randFruta();
      return [f, f, f];
    } else if (r < 0.35) {
      const f1 = randFruta(), f2 = randFruta();
      return [f1, f1, f2];
    }
  } else if (modo === 'compensar') {
    // 15% jackpot, 30% dos iguales, resto perder
    const r = Math.random();
    if (r < 0.15) {
      const f = randFruta();
      return [f, f, f];
    } else if (r < 0.45) {
      const f1 = randFruta(), f2 = randFruta();
      return [f1, f1, f2];
    }
  } else if (modo === 'dificil') {
    // 1% jackpot, 7% dos iguales, resto perder
    const r = Math.random();
    if (r < 0.01) {
      const f = randFruta();
      return [f, f, f];
    } else if (r < 0.08) {
      const f1 = randFruta(), f2 = randFruta();
      return [f1, f1, f2];
    }
  } else {
    // normal: 5% jackpot, 15% dos iguales, resto perder
    const r = Math.random();
    if (r < 0.05) {
      const f = randFruta();
      return [f, f, f];
    } else if (r < 0.20) {
      const f1 = randFruta(), f2 = randFruta();
      return [f1, f1, f2];
    }
  }
  // Perder: tres diferentes
  let f1 = randFruta(), f2 = randFruta(), f3 = randFruta();
  while (f1 === f2 || f2 === f3 || f1 === f3) {
    f1 = randFruta(); f2 = randFruta(); f3 = randFruta();
  }
  return [f1, f2, f3];
}

// Animación de giro de rodillos
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

btnJugar.addEventListener('click', async () => {
  const apuesta = parseInt(apuestaInput.value);
  if (isNaN(apuesta) || apuesta <= 0) {
    resultado.textContent = 'Introduce una apuesta válida.';
    return;
  }

  const saldo = await obtenerSaldo();
  if (saldo < apuesta) {
    resultado.textContent = 'No tienes suficientes fichas.';
    return;
  }

  // Animación de giro
  btnJugar.disabled = true;
  resultado.textContent = 'Girando...';
  sonidoGiro.currentTime = 0;
  sonidoGiro.play();
  for (let i = 0; i < 15; i++) {
    reel1.textContent = randFruta();
    reel2.textContent = randFruta();
    reel3.textContent = randFruta();
    await sleep(50 + i * 10);
  }
  sonidoGiro.pause();
  sonidoGiro.currentTime = 0;

  // --- Lógica de retención/compensación ---
  const modo = getModoTragamonedas(apuesta);
  const tirada = generarTiradaLogica(modo);

  reel1.textContent = tirada[0];
  reel2.textContent = tirada[1];
  reel3.textContent = tirada[2];

  // Quitar clases de animación previas
  reel1.classList.remove('win', 'lose');
  reel2.classList.remove('win', 'lose');
  reel3.classList.remove('win', 'lose');
  resultado.classList.remove('win', 'lose');

  let mensaje = '';
  let fichasCambiadas = -apuesta;
  let ganada = false;
  let premio = 0;

  if (tirada[0] === tirada[1] && tirada[1] === tirada[2]) {
    premio = apuesta * 3;
    mensaje = `¡Jackpot! Ganaste ${premio} fichas 🎉`;
    fichasCambiadas = premio - apuesta;
    ganada = true;
    reel1.classList.add('win');
    reel2.classList.add('win');
    reel3.classList.add('win');
    resultado.classList.add('win');
    sonidoJackpot.currentTime = 0;
    sonidoJackpot.play();
  } else if (tirada[0] === tirada[1] || tirada[1] === tirada[2] || tirada[0] === tirada[2]) {
    premio = Math.round(apuesta * 1.5);
    mensaje = `Ganaste ${premio} fichas 😄`;
    fichasCambiadas = premio - apuesta;
    ganada = true;
    reel1.classList.add('win');
    reel2.classList.add('win');
    reel3.classList.add('win');
    resultado.classList.add('win');
    sonidoPremio.currentTime = 0;
    sonidoPremio.play();
  } else {
    mensaje = 'Perdiste 😢';
    reel1.classList.add('lose');
    reel2.classList.add('lose');
    reel3.classList.add('lose');
    resultado.classList.add('lose');
    sonidoPerder.currentTime = 0;
    sonidoPerder.play();
  }

  resultado.textContent = mensaje;

  setEstadisticasTragamonedas(ganada, apuesta, premio);

  const registroExitoso = await registrarResultado(tirada.join(''), fichasCambiadas);
  if (!registroExitoso) {
    resultado.textContent = 'Error al registrar el resultado. Inténtalo nuevamente.';
  }
  await actualizarSaldo();
  btnJugar.disabled = false;
});

function randFruta() {
  return frutas[Math.floor(Math.random() * frutas.length)];
}

async function obtenerSaldo() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('fichas')
    .eq('id', usuario.id)
    .single();
  return error ? 0 : data.fichas;
}

async function registrarResultado(resultadoTirada, fichas) {
  const { error: errorTransaccion } = await supabase.rpc('registrar_resultado_tragamonedas', {
    usuario_id: usuario.id,
    resultado: resultadoTirada,
    fichas_cambiadas: fichas
  });

  if (errorTransaccion) {
    console.error('Error al registrar el resultado:', errorTransaccion.message);
    return false;
  }

  return true;
}