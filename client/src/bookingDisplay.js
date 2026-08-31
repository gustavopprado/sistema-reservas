// client/src/bookingDisplay.js
// Como uma reserva de sala deve ser apresentada nas telas.

/**
 * Quem aparece como "Responsável" de uma reserva.
 *
 * Na sala restrita, quem reserva (`userEmail`) não é quem vai usar a sala:
 * apenas alguns e-mails podem reservá-la, e o pedido vem de outra pessoa,
 * gravada em `solicitanteEmail`. Nas telas de visualização interessa saber
 * quem vai efetivamente usar a sala, então o solicitante tem prioridade.
 *
 * A posse da reserva continua com `userEmail` — é quem pode editar e cancelar.
 */
export const responsavelDe = (booking) =>
  (booking?.solicitanteEmail || booking?.userEmail || '').trim();

/** True quando a reserva foi feita por uma pessoa a pedido de outra. */
export const temSolicitante = (booking) =>
  Boolean(booking?.solicitanteEmail && booking.solicitanteEmail !== booking.userEmail);
