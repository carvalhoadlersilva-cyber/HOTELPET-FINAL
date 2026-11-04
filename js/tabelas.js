/* ==========================================================================
   tabelas.js  -  Semana 3: Tabelas dinâmicas das listagens
   --------------------------------------------------------------------------
   - Desenha o <tbody> a partir do localStorage (Dados)
   - UM único listener de clique por tabela (Event Delegation) trata:
       data-acao="editar" | "visualizar" | "excluir" | "mudar-status"
   - Depois de qualquer mudança: redesenha e reaplica os filtros da Semana 2

   Uso (no fim da página, ANTES de Filtros.iniciar):
       Tabelas.montar('#tabela-reservas', 'reservas');
   Carregar com: <script src="js/tabelas.js" defer></script>
   ========================================================================== */
const Tabelas = (function () {
  'use strict';

  const { esc, data, moeda } = Dados.fmt;

  /* ---------- Peças reutilizáveis de HTML ---------- */
  const classeStatus = (s) => ({ Finalizada: 'badge-info', Inativo: 'badge-danger' }[s] || 'badge-success');

  // O selo de status é clicável: cada clique avança para o próximo status
  const badgeStatus = (status) =>
    `<span class="badge ${classeStatus(status)} badge-clicavel" data-acao="mudar-status" ` +
    `role="button" tabindex="0" title="Clique para mudar o status">${esc(status)}</span>`;

  // O ?id=... na URL é como a tela de edição descobre qual registro abrir
  const acoes = (paginaEditar, paginaVer, id) =>
    `<div class="actions-cell">
       <a href="${paginaEditar}?id=${encodeURIComponent(id)}" class="link-acao" data-acao="editar">Editar</a>
       <a href="${paginaVer}?id=${encodeURIComponent(id)}" class="link-acao" data-acao="visualizar">Visualizar</a>
       <a href="#" class="link-acao link-excluir" data-acao="excluir">Excluir</a>
     </div>`;

  /* ---------- Definição de cada tabela: como desenhar uma linha ---------- */
  const DEFINICOES = {
    reservas: {
      colecao: Dados.reservas,
      confirmar: (id) => `Excluir a reserva #${id}? Esta ação não pode ser desfeita.`,
      linha(r) {
        const v = Dados.view.reserva(r);
        return `<td>${esc(r.id)}</td>
          <td>${esc(v.proprietarioNome)}</td>
          <td><strong>${esc(v.petNome)}</strong></td>
          <td>${data(r.chegada)}</td>
          <td>${data(r.partida)}</td>
          <td>${badgeStatus(r.status)}</td>
          <td>${moeda(r.total)}</td>
          <td>${acoes('editar_reserva.html', 'ver_reserva.html', r.id)}</td>`;
      }
    },

    usuarios: {
      colecao: Dados.usuarios,
      confirmar: (id) => `Excluir o usuário #${id}? Esta ação não pode ser desfeita.`,
      linha: (u) =>
        `<td>${esc(u.id)}</td>
          <td><strong>${esc(u.nome)}</strong></td>
          <td>${esc(u.email)}</td>
          <td>${esc(u.funcao)}</td>
          <td>${badgeStatus(u.status)}</td>
          <td>${acoes('editar_usuario.html', 'ver_usuario.html', u.id)}</td>`
    },

    pets: {
      colecao: Dados.pets,
      confirmar: (id) => `Excluir o pet #${id}? Esta ação não pode ser desfeita.`,
      linha: (p) =>
        `<td>${esc(p.id)}</td>
          <td>${p.foto ? `<img src="${esc(p.foto)}" alt="${esc(p.nome)}" class="avatar">` : ''}</td>
          <td><strong>${esc(p.nome)}</strong></td>
          <td>${esc(p.tipo)}</td>
          <td>${esc(p.raca)}</td>
          <td>${esc(p.tamanho)}</td>
          <td>${acoes('editar_pet.html', 'ver_pet.html', p.id)}</td>`
    }
  };

  /* ---------- Função principal ---------- */
  function montar(seletor, nome) {
    const def = DEFINICOES[nome];
    const tabela = document.querySelector(seletor);
    if (!def || !tabela) {
      console.warn('[Tabelas] Tabela ou definição não encontrada:', seletor, nome);
      return;
    }
    const corpo = tabela.tBodies[0];

    function renderizar() {
      corpo.innerHTML = def.colecao
        .listar()
        .map((item) => `<tr data-id="${esc(item.id)}">${def.linha(item)}</tr>`)
        .join('');

      // Reaplica o que o gerente já digitou nos filtros (Semana 2)
      if (typeof Filtros !== 'undefined') Filtros.reaplicar(seletor);
    }

    function tratarAcao(elemento) {
      const id = elemento.closest('tr').dataset.id;

      switch (elemento.dataset.acao) {
        case 'excluir':
          if (!confirm(def.confirmar(id))) return;
          {
            const resultado = Dados.excluir(nome, id);
            if (!resultado.ok && resultado.erro) alert(resultado.erro);
          }
          break;

        case 'mudar-status': {
          const resultado = Dados.mudarStatus(nome, id);
          if (!resultado.ok && resultado.erro) alert(resultado.erro);
          break;
        }
      }
      renderizar();
    }

    /* ===== EVENT DELEGATION =====
       Um listener só, no <tbody>. Como as linhas são recriadas a cada
       renderizar(), listeners nos botões se perderiam; no tbody, não. */
    corpo.addEventListener('click', (evento) => {
      const elemento = evento.target.closest('[data-acao]');
      if (!elemento || !corpo.contains(elemento)) return;

      const acao = elemento.dataset.acao;
      if (acao === 'editar' || acao === 'visualizar') {
        evento.preventDefault();
        HotelPet.Navegacao.ir(elemento.getAttribute('href'));
        return;
      }
      evento.preventDefault();
      tratarAcao(elemento);
    });

    // Acessibilidade: Enter/Espaço no selo de status
    corpo.addEventListener('keydown', (evento) => {
      const selo = evento.target.closest('[data-acao="mudar-status"]');
      if (selo && (evento.key === 'Enter' || evento.key === ' ')) {
        evento.preventDefault();
        tratarAcao(selo);
      }
    });

    renderizar();
    return { renderizar };
  }

  return { montar };
})();
