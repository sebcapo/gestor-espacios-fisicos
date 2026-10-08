import { useEffect, useState } from 'react';

const CLAVE = 'gestor-espacios:tema';

function temaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  } catch {
    // localStorage puede no estar disponible (modo privado); seguimos con el default.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function useTema() {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      // ignorar si no se puede persistir
    }
  }, [tema]);

  function alternar() {
    setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro'));
  }

  return { tema, alternar };
}
