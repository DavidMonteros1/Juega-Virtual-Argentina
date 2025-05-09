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

// Cargar usuario al iniciar
(async () => {
  usuario = await getUsuarioActual();
  if (!usuario) {
    mostrarMensaje('Debes iniciar sesión para jugar');
    location.href = '../../login.html';
  } else {
    actualizarSaldo();
  }
})();

btnJugar.addEventListener('click', async () => {
  const apuesta = parseInt(apuestaInput.value);
  if (isNaN(apuesta) || apuesta < 1) {
    resultado.textContent = 'Ingresa una apuesta válida.';
    return;
  }

  const saldo = await obtenerSaldo();
  if (saldo < apuesta) {
    resultado.textContent = 'No tienes suficientes fichas.';
    return;
  }

  const tirada = [randFruta(), randFruta(), randFruta()];
  reel1.textContent = tirada[0];
  reel2.textContent = tirada[1];
  reel3.textContent = tirada[2];

  let mensaje = '';
  let fichasGanadas = 0;

  if (tirada[0] === tirada[1] && tirada[1] === tirada[2]) {
    fichasGanadas = apuesta * 5;
    mensaje = `¡Jackpot! Ganaste ${fichasGanadas} fichas 🎉`;
  } else if (tirada[0] === tirada[1] || tirada[1] === tirada[2] || tirada[0] === tirada[2]) {
    fichasGanadas = Math.round(apuesta * 2);
    mensaje = `Ganaste ${fichasGanadas} fichas 😄`;
  } else {
    mensaje = 'Perdiste 😢';
  }

  const fichasCambiadas = fichasGanadas - apuesta;
  resultado.textContent = mensaje;

  await registrarResultado(tirada.join(''), fichasCambiadas);
  await actualizarSaldo();
});

// ---------------- FUNCIONES AUXILIARES ---------------- //

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

async function actualizarSaldo() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('fichas')
    .eq('id', usuario.id)
    .single();

  if (!error) {
    saldoActual.textContent = `Saldo: ${data.fichas} fichas`;
  }
}

async function registrarResultado(resultadoTirada, fichas) {
  // Historial de jugadas
  await supabase.from('jugadas').insert([
    {
      usuario_id: usuario.id,
      juego: 'tragamonedas',
      resultado: resultadoTirada,
      fichas_cambiadas: fichas
    }
  ]);

  // Movimiento de fichas
  const motivo = fichas >= 0 ? 'premio tragamonedas' : 'apuesta tragamonedas';
  await supabase.from('movimientos_fichas').insert([
    {
      usuario_id: usuario.id,
      cantidad: fichas,
      motivo
    }
  ]);

  // Actualizar saldo del usuario
  const nuevoSaldo = (await obtenerSaldo()) + fichas;
  await supabase
    .from('usuarios')
    .update({ fichas: nuevoSaldo })
    .eq('id', usuario.id);
}
