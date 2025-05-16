import { supabase } from '../../js/supabase.js';
import { getUsuarioActual } from '../../js/auth.js';
import { inicializarChatGlobal } from '../../js/chatGlobal.js';

const frutas = ['🍒', '🍋', '🍇', '🍉', '🍊', '⭐'];
let usuario = null;

const reel1 = document.getElementById('reel1');
const reel2 = document.getElementById('reel2');
const reel3 = document.getElementById('reel3');
const resultado = document.getElementById('resultado');
const btnJugar = document.getElementById('btnJugar');
const saldoActual = document.getElementById('saldoActual');
const apuestaInput = document.getElementById('apuestaInput');

// Inicializar el juego y el chat global
document.addEventListener('DOMContentLoaded', async () => {
  try {
    usuario = await getUsuarioActual();
    if (!usuario) {
      window.location.href = '../../login.html';
      return;
    }

    // Mostrar saldo inicial
    saldoActual.textContent = `Saldo: ${usuario.fichas} fichas`;

    // Subscribirse a cambios en tiempo real en las fichas del usuario
    supabase
      .channel('usuarios-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'usuarios', filter: `id=eq.${usuario.id}` },
        (payload) => {
          if (payload.new) {
            saldoActual.textContent = `Saldo: ${payload.new.fichas} fichas`;
          }
        }
      )
      .subscribe();

    // Inicializar el chat global
    await inicializarChatGlobal('tragamonedas');
  } catch (err) {
    console.error('Error al inicializar tragamonedas:', err);
  }
});

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

  if (usuario.fichas < apuesta) {
    resultado.textContent = 'No tienes suficientes fichas.';
    return;
  }

  // Animación de giro
  btnJugar.disabled = true;
  resultado.textContent = 'Girando...';
  for (let i = 0; i < 20; i++) {
    reel1.textContent = frutas[Math.floor(Math.random() * frutas.length)];
    reel2.textContent = frutas[Math.floor(Math.random() * frutas.length)];
    reel3.textContent = frutas[Math.floor(Math.random() * frutas.length)];
    await sleep(50 + i * 5);
  }

  // Generar resultado
  const tirada = [frutas[Math.floor(Math.random() * frutas.length)], frutas[Math.floor(Math.random() * frutas.length)], frutas[Math.floor(Math.random() * frutas.length)]];
  reel1.textContent = tirada[0];
  reel2.textContent = tirada[1];
  reel3.textContent = tirada[2];

  let mensaje = '';
  let fichasCambiadas = -apuesta;

  if (tirada[0] === tirada[1] && tirada[1] === tirada[2]) {
    fichasCambiadas = apuesta * 3;
    mensaje = `¡Jackpot! Ganaste ${fichasCambiadas} fichas 🎉`;
  } else if (tirada[0] === tirada[1] || tirada[1] === tirada[2] || tirada[0] === tirada[2]) {
    fichasCambiadas = Math.round(apuesta * 1.5);
    mensaje = `Ganaste ${fichasCambiadas} fichas 😄`;
  } else {
    mensaje = 'Perdiste 😢';
  }

  resultado.textContent = mensaje;

  // Registrar resultado en la base de datos
  const registroExitoso = await registrarResultado(tirada.join(''), fichasCambiadas);
  if (!registroExitoso) {
    resultado.textContent = 'Error al registrar el resultado. Inténtalo nuevamente.';
  }

  btnJugar.disabled = false;
});

async function registrarResultado(resultadoTirada, fichas) {
  const { error } = await supabase.rpc('registrar_resultado_tragamonedas', {
    usuario_id: usuario.id,
    resultado: resultadoTirada,
    fichas_cambiadas: fichas
  });

  if (error) {
    console.error('Error al registrar el resultado:', error.message);
    return false;
  }

  return true;
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

function randFruta() {
  return frutas[Math.floor(Math.random() * frutas.length)];
}