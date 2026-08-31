import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, FileText, Filter, Users, Calendar, BookOpen, Shield, X, UsersRound } from 'lucide-react';
import api from '../api';
import AdminEmailGroupsPanel from './AdminEmailGroupsPanel';

const ID_SALAO = 'j7QOhdPRzEJcza2cMqwM';

const TERMO_TEXTO =
  'Comprometo-me a devolver o salão de eventos logo após o uso nas mesmas condições de recebimento. ' +
  'Garanto a organização do mobiliário (mesas e cadeiras), o desligamento e guarda de equipamentos/fios, ' +
  'bem como a reposição de todos os itens de consumo utilizados (água, sucos, etc.), assim como avisar o ' +
  'responsável caso seja necessário a limpeza do local.';

function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDateTime(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('pt-BR');
}

function generateTermoPDF(booking) {
  const logoUrl = `${window.location.origin}/logo.png`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante de Reserva – Salão de Eventos</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#333;padding:40px;max-width:820px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #7bc258;padding-bottom:20px;margin-bottom:28px}
    .logo img{height:56px;width:auto;display:block}
    .doc-title{text-align:right}
    .doc-title h1{font-size:18px;color:#4a4a4a}
    .doc-title p{font-size:11px;color:#777;margin-top:3px}
    .section{margin-bottom:24px}
    .section-label{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:#7bc258;border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px}
    .field label{font-size:10px;color:#999;text-transform:uppercase;display:block;margin-bottom:2px}
    .field span{font-size:14px;color:#111;font-weight:500}
    .full{grid-column:span 2}
    .termo-box{background:#f8f9fa;border:1px solid #ddd;border-radius:6px;padding:16px}
    .termo-text{font-size:13px;line-height:1.75;color:#444;margin-bottom:14px}
    .confirm-box{background:#f0f9eb;border:1px solid #b8e0a4;border-radius:6px;padding:12px 16px;display:flex;align-items:center;gap:14px}
    .check{font-size:28px;color:#7bc258;font-weight:bold;line-height:1}
    .confirm-text strong{display:block;font-size:13px;color:#4a7a33;margin-bottom:2px}
    .confirm-text span{font-size:12px;color:#5a9040}
    .footer{margin-top:40px;padding-top:14px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:10px;color:#aaa}
    .print-btn{display:block;margin:24px auto 0;padding:11px 32px;background:#7bc258;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:bold}
    @media print{.print-btn{display:none}}
  </style>
</head>
<body>
  <div class="header">
    <div class="logo"><img src="${logoUrl}" alt="FGV Ferragens para Móveis" /></div>
    <div class="doc-title"><h1>Comprovante de Reserva</h1><p>Salão de Eventos</p></div>
  </div>

  <div class="section">
    <div class="section-label">Detalhes da Reserva</div>
    <div class="grid">
      <div class="field"><label>Responsável</label><span>${booking.userEmail}</span></div>
      <div class="field"><label>Sala</label><span>${booking.roomName || 'Salão de Eventos'}</span></div>
      <div class="field"><label>Data</label><span>${fmtDate(booking.date)}</span></div>
      <div class="field"><label>Horário</label><span>${booking.startTime} – ${booking.endTime}</span></div>
      <div class="field full"><label>Título / Evento</label><span>${booking.title || '—'}</span></div>
      ${booking.attendees ? `<div class="field full"><label>Convidados</label><span>${booking.attendees}</span></div>` : ''}
      ${booking.notes ? `<div class="field full"><label>Observações</label><span>${booking.notes}</span></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-label">Termo de Responsabilidade</div>
    <div class="termo-box">
      <p class="termo-text">${TERMO_TEXTO}</p>
      <div class="confirm-box">
        <div class="check">✓</div>
        <div class="confirm-text">
          <strong>Termo confirmado digitalmente</strong>
          <span>Confirmado por <b>${booking.userEmail}</b> em ${fmtDateTime(booking.createdAt)}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
    <span>Sistema de Reservas – FGV TN</span>
  </div>
  <button class="print-btn" onclick="window.print()">Imprimir / Salvar como PDF</button>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=920,height=720');
  win.document.write(html);
  win.document.close();
}

const EMPTY_FILTERS = { startDate: '', endDate: '', roomId: '', userEmail: '' };

export default function AdminRoomPanel({ currentUserEmail, rooms }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [aba, setAba] = useState('reservas');

  const fetchBookings = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    try {
      const params = { adminEmail: currentUserEmail };
      if (activeFilters.startDate) params.startDate = activeFilters.startDate;
      if (activeFilters.endDate)   params.endDate   = activeFilters.endDate;
      if (activeFilters.roomId)    params.roomId    = activeFilters.roomId;
      if (activeFilters.userEmail) params.userEmail = activeFilters.userEmail;
      const res = await api.get('/bookings/admin', { params });
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentUserEmail]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSearch = (e) => { e.preventDefault(); fetchBookings(filters); };

  const handleClear = () => {
    setFilters(EMPTY_FILTERS);
    fetchBookings(EMPTY_FILTERS);
  };

  const exportCSV = () => {
    const headers = ['Data', 'Início', 'Fim', 'Sala', 'Título', 'Responsável', 'Convidados', 'Observações', 'Termo Confirmado', 'Criado em'];
    const rows = bookings.map(b => [
      fmtDate(b.date),
      b.startTime || '',
      b.endTime   || '',
      b.roomName  || '',
      b.title     || '',
      b.userEmail || '',
      b.attendees || '',
      b.notes     || '',
      b.termConfirmed ? 'Sim' : 'Não',
      b.createdAt ? new Date(b.createdAt).toLocaleString('pt-BR') : ''
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `reservas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalSalao      = bookings.filter(b => b.roomId === ID_SALAO).length;
  const uniqueUsers     = new Set(bookings.map(b => b.userEmail)).size;
  const termoConfirmado = bookings.filter(b => b.termConfirmed).length;

  const stats = [
    { label: 'Total de Reservas',    value: bookings.length, Icon: BookOpen, color: 'text-brand'       },
    { label: 'Reservas do Salão',    value: totalSalao,      Icon: Calendar, color: 'text-purple-600'  },
    { label: 'Usuários Distintos',   value: uniqueUsers,     Icon: Users,    color: 'text-green-600'   },
    { label: 'Termos Confirmados',   value: termoConfirmado, Icon: Shield,   color: 'text-amber-600'   },
  ];

  return (
    <div className="animate-fade-in-up">
      {/* Abas do painel */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'reservas', label: 'Reservas', Icon: BookOpen },
          { id: 'grupos',   label: 'Grupos de E-mail', Icon: UsersRound },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              aba === id ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {aba === 'grupos' ? <AdminEmailGroupsPanel /> : (
      <>
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <Icon size={26} className={color} />
            <div>
              <p className="text-2xl font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Sala</label>
            <select
              name="roomId" value={filters.roomId} onChange={handleChange}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            >
              <option value="">Todas</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data início</label>
            <input type="date" name="startDate" value={filters.startDate} onChange={handleChange}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data fim</label>
            <input type="date" name="endDate" value={filters.endDate} onChange={handleChange}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Responsável</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input type="text" name="userEmail" value={filters.userEmail} onChange={handleChange}
                placeholder="email@fgvtn.com.br"
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none w-52" />
            </div>
          </div>

          <button type="submit"
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors">
            <Filter size={14} /> Filtrar
          </button>

          <button type="button" onClick={handleClear}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <X size={14} /> Limpar
          </button>

          <button type="button" onClick={exportCSV}
            className="ml-auto flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
            <Download size={14} /> Exportar CSV
          </button>
        </form>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-3"></div>
            <p className="text-gray-500 text-sm">Carregando reservas...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 opacity-60">
            <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Nenhuma reserva encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Data', 'Horário', 'Sala', 'Título', 'Responsável', 'Convidados', 'Termo', 'Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map(booking => {
                  const isSalao = booking.roomId === ID_SALAO;
                  return (
                    <tr key={booking.id} className={`transition-colors hover:bg-gray-50 ${isSalao ? 'bg-purple-50/40' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {fmtDate(booking.date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {booking.startTime} – {booking.endTime}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isSalao ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {booking.roomName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={booking.title}>
                        {booking.title || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{booking.userEmail}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate" title={booking.attendees}>
                        {booking.attendees || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isSalao ? (
                          booking.termConfirmed
                            ? <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs"><span>✓</span> Confirmado</span>
                            : <span className="text-amber-500 text-xs font-medium">Reserva antiga</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSalao && booking.termConfirmed && (
                          <button
                            onClick={() => generateTermoPDF(booking)}
                            className="inline-flex items-center gap-1.5 bg-brand text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-hover transition-colors whitespace-nowrap"
                          >
                            <FileText size={12} /> Gerar PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              {bookings.length} reserva{bookings.length !== 1 ? 's' : ''} encontrada{bookings.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
