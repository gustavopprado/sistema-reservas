// Gera o relatório em Excel do Histórico Geral de reservas de veículos.
// O exceljs é carregado sob demanda para não pesar no carregamento do painel.

const STATUS_LABEL = { concluida: 'Concluída', cancelada: 'Cancelada', ativa: 'Ativa', em_uso: 'Em uso' };

// O exceljs grava datas pelo valor UTC; montamos a data com Date.UTC usando os
// componentes locais para que o horário na planilha seja o mesmo exibido na tela.
const localDateTime = (date, time = '00:00') => {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, h || 0, mi || 0));
};

const isoToLocal = (iso) => {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes()));
};

const toNumber = (value) => (value === undefined || value === null || value === '' ? null : Number(value));

const COLUMNS = [
  { header: 'ID', key: 'codigo', width: 14 },
  { header: 'Usuário', key: 'usuario', width: 32 },
  { header: 'Veículo', key: 'veiculo', width: 24 },
  { header: 'Placa', key: 'placa', width: 11 },
  { header: 'Categoria', key: 'categoria', width: 12 },
  { header: 'Centro de Custo', key: 'centroCusto', width: 18 },
  { header: 'Retirada', key: 'retirada', width: 17, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  { header: 'Devolução Prevista', key: 'devolucaoPrevista', width: 19, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  { header: 'Devolução Efetiva', key: 'devolucaoEfetiva', width: 19, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  { header: 'Destino', key: 'destino', width: 28 },
  { header: 'Status', key: 'status', width: 13 },
  { header: 'KM Saída', key: 'kmSaida', width: 11, style: { numFmt: '#,##0' } },
  { header: 'KM Retorno', key: 'kmRetorno', width: 12, style: { numFmt: '#,##0' } },
  { header: 'KM Rodados', key: 'kmRodados', width: 12, style: { numFmt: '#,##0' } },
  { header: 'Nível do Tanque', key: 'nivelTanque', width: 15 },
  { header: 'Cancelada em', key: 'canceladaEm', width: 17, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  { header: 'Registrado por', key: 'registradoPor', width: 28 },
  { header: 'Observações', key: 'observacoes', width: 40 },
  { header: 'Criada em', key: 'criadaEm', width: 17, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
];

const bookingToRow = (b, carsById, normalizeCategory) => {
  const car = carsById[b.carId] || {};
  const regularizada = b.tipo === 'regularizada';

  let status = STATUS_LABEL[b.status] || b.status || '';
  if (regularizada) status = 'Regularizada';
  else if (b.adminFinalized) status = 'Concluída (admin)';

  const kmSaida = toNumber(b.kmSaida);
  const kmRetorno = toNumber(b.kmRetorno);

  return {
    codigo: b.bookingCode || b.id,
    usuario: b.userEmail || '',
    veiculo: b.carModelo || b.carModel || car.modelo || '',
    placa: car.placa || '',
    categoria: normalizeCategory(car.categoria),
    centroCusto: car.centroCusto || '',
    retirada: localDateTime(b.startDate, b.startTime),
    devolucaoPrevista: localDateTime(b.endDate, b.endTime),
    // Regularizadas não passam pela devolução; a tela mostra o fim previsto como efetivo.
    devolucaoEfetiva: regularizada ? localDateTime(b.endDate, b.endTime) : isoToLocal(b.dataDevolucaoReal),
    destino: b.destino || '',
    status,
    kmSaida,
    kmRetorno,
    kmRodados: kmSaida !== null && kmRetorno !== null && kmRetorno >= kmSaida ? kmRetorno - kmSaida : null,
    nivelTanque: b.nivelTanque || '',
    canceladaEm: isoToLocal(b.dataCancelamento),
    registradoPor: b.registradoPor || '',
    observacoes: b.observacoes || '',
    criadaEm: isoToLocal(b.createdAt),
  };
};

export async function exportCarBookingsXlsx({ bookings, cars, normalizeCategory }) {
  const { default: ExcelJS } = await import('exceljs');

  const carsById = Object.fromEntries((cars || []).map(car => [car.id, car]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Reservas FGV-TN';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Reservas', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = COLUMNS;
  bookings.forEach(b => sheet.addRow(bookingToRow(b, carsById, normalizeCategory)));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C6192' } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reservas-veiculos-${stamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
