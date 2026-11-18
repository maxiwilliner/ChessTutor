/** Jugador público conocido para probar la demo sin cuenta de Chess.com. No se guarda como "último usuario". */
export const EXAMPLE_PLAYER = { username: "hikaru", timeClass: "blitz" };

export const isExampleUser = (username: string | null | undefined) =>
  !!username && username.trim().toLowerCase() === EXAMPLE_PLAYER.username;
