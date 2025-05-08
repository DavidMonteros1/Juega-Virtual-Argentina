import { supabase } from '../../js/supabase.js';
import { getUsuarioActual } from '../../js/auth.js';
import { mostrarMensaje } from '../../js/util.js';

const frutas = ['🍒', '🍋', '🍇', '🍉', '🍊', '⭐'];
const apuesta = 10;
let usuario = null;

const reel1 = document.getElementById('reel1');
const reel2 = document.getElementById('reel2');
const reel3 = document.getElementById('reel3');
const resultado = document.getElementById('resultado');
const btnJugar = document.getElementById('btnJugar');
const saldoActual = document.getElementById('saldoActual');

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

// Actualizar visualmente el saldo
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

btnJugar.addEventListener('click', async () => {
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
  let fichasCambiadas = -apuesta;

  if (tirada[0] === tirada[1] && tirada[1] === tirada[2]) {
    mensaje = '¡Jackpot! Ganaste 50 fichas 🎉';
    fichasCambiadas = 50 - apuesta;
  } else if (tirada[0] === tirada[1] || tirada[1] === tirada[2] || tirada[0] === tirada[2]) {
    mensaje = 'Ganaste 20 fichas 😄';
    fichasCambiadas = 20 - apuesta;
  } else {
    mensaje = 'Perdiste 😢';
  }

  resultado.textContent = mensaje;

  // Actualizar en Supabase
  await registrarResultado(tirada.join(''), fichasCambiadas);
  await actualizarSaldo();
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

  // Actualizar saldo de usuario
  await supabase
    .from('usuarios')
    .update({ fichas: (await obtenerSaldo()) + fichas })
    .eq('id', usuario.id);
}
